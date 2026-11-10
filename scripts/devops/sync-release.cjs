#!/usr/bin/env node
"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  cp = require("node:child_process"),
  crypto = require("node:crypto");
const publisher = require("./sync-publish.cjs"),
  selection = require("./verify-production-selection.cjs"),
  q = require("../quality/release.cjs");
const root = path.resolve(__dirname, "../..");
function github(token) {
  return async (method, route, body) => {
    if (
      !route.startsWith("/") ||
      route.includes("..") ||
      !["GET", "POST", "DELETE"].includes(method)
    )
      throw Error("UNSAFE_GITHUB_REQUEST");
    try {
      const result = cp.execFileSync(
        "gh",
        [
          "api",
          "--method",
          method,
          route.slice(1),
          ...(body ? ["--input", "-"] : []),
        ],
        {
          input: body ? JSON.stringify(body) : undefined,
          env: { ...process.env, GH_TOKEN: token },
          encoding: "utf8",
          maxBuffer: 32 * 1024 * 1024,
          timeout: 30000,
          stdio: ["pipe", "pipe", "pipe"],
        },
      );
      return result ? JSON.parse(result) : null;
    } catch (_) {
      throw Error("GITHUB_SYNC_REQUEST_FAILED");
    }
  };
}
function readOnly(api) {
  return async (method, ...args) => {
    if (method !== "GET") throw Error("GOVERNANCE_READ_ONLY");
    return api(method, ...args);
  };
}
async function verifiedCi(
  api,
  id,
  current,
  readArtifact = require("./artifact-json.cjs").read,
) {
  const base = `/repos/${selection.repo}/actions/runs/${selection.number(id)}`;
  const run = await api("GET", base),
    jobs = await api("GET", base + "/jobs?filter=latest&per_page=100"),
    artifacts = await api("GET", base + "/artifacts?per_page=100");
  if (jobs.jobs.length >= 100 || artifacts.artifacts.length >= 100)
    throw Error("CI_EVIDENCE_PAGINATION_REVIEW_REQUIRED");
  const ci = selection.ciEvidence(run, jobs.jobs, artifacts.artifacts),
    a = selection.artifactEvidence(
      artifacts.artifacts,
      `code-ci-manifest-attempt-${ci.attempt}`,
      run,
    ),
    manifest = await readArtifact(a, "code-ci-manifest.json");
  if (
    ci.commit !== current.gitCommit ||
    manifest.kind !== "scop-code-ci" ||
    manifest.version !== 1 ||
    manifest.status !== "CODE_TEST_READY" ||
    manifest.ciRunId !== String(ci.runId) ||
    manifest.ciRunAttempt !== String(ci.attempt) ||
    manifest.gitCommit !== ci.commit ||
    current.dirty ||
    manifest.dirty !== false ||
    manifest.liveRoutingEnabled !== false ||
    manifest.productionDeploymentAuthorized !== false ||
    manifest.sourceDigest !== current.sourceDigest ||
    manifest.gateConfigDigest !== current.gateConfigDigest ||
    manifest.artifacts?.backend !== String(ci.backend.id) ||
    manifest.artifacts?.frontend !== String(ci.frontend.id) ||
    manifest.failures?.length !== 0
  )
    throw Error("SOURCE_CI_PROVENANCE_MISMATCH");
  return {
    ...ci,
    manifestArtifactId: a.id,
    manifestDigest: a.digest,
    sourceDigest: manifest.sourceDigest,
  };
}
async function mint(policy, app) {
  const id = process.env.SCOP_SYNC_APP_ID,
    installation = process.env.SCOP_SYNC_INSTALLATION_ID;
  if (
    !/^[1-9][0-9]*$/.test(id || "") ||
    !/^[1-9][0-9]*$/.test(installation || "") ||
    !process.env.SCOP_SYNC_PRIVATE_KEY
  )
    throw Error("APP_CONFIGURATION_REQUIRED");
  const enc = (v) => Buffer.from(JSON.stringify(v)).toString("base64url"),
    now = Math.floor(Date.now() / 1000);
  const unsigned =
    enc({ alg: "RS256", typ: "JWT" }) +
    "." +
    enc({ iat: now - 60, exp: now + 300, iss: id });
  const jwt =
    unsigned +
    "." +
    crypto
      .sign(
        "RSA-SHA256",
        Buffer.from(unsigned),
        process.env.SCOP_SYNC_PRIVATE_KEY,
      )
      .toString("base64url");
  const appApi = github(jwt),
    identity = await appApi("GET", "/app");
  if (identity.slug !== policy.appSlug) throw Error("APP_IDENTITY_MISMATCH");
  const r = await appApi(
      "POST",
      `/app/installations/${installation}/access_tokens`,
      {
        repositories: [`purchase-${app}`],
        permissions: { contents: "write", pull_requests: "write" },
      },
    ),
    api = github(r.token);
  process.stdout.write(`::add-mask::${r.token}\n`);
  try {
    const repos = await api("GET", "/installation/repositories?per_page=100");
    if (
      repos.total_count !== 1 ||
      repos.repositories[0]?.full_name !== publisher.repositories[app] ||
      Object.entries(r.permissions).some(
        ([k, v]) =>
          !(["contents", "pull_requests"].includes(k) && v === "write") &&
          !(k === "metadata" && v === "read"),
      )
    )
      throw Error("INSTALLATION_TOKEN_SCOPE_INVALID");
  } catch (e) {
    await api("DELETE", "/installation/token");
    throw e;
  }
  return { api, revoke: () => api("DELETE", "/installation/token") };
}
async function main() {
  const mode = process.argv[2],
    policy = JSON.parse(
      fs.readFileSync(path.join(root, "deploy/sync/policy.json"), "utf8"),
    );
  if (!["plan", "publish"].includes(mode))
    throw Error("EXPLICIT_SYNC_MODE_REQUIRED");
  if (
    process.env.GITHUB_REPOSITORY !== selection.repo ||
    process.env.GITHUB_REF !== "refs/heads/master"
  )
    throw Error("TRUSTED_COMBINED_MASTER_ONLY");
  if (
    mode === "publish" &&
    (policy.enabled !== true ||
      policy.bootstrapApproval !== "APPROVED" ||
      process.env.SCOP_SYNC_ENVIRONMENT !== "scop-sync-publish")
  )
    throw Error("PUBLISHING_DISABLED_NO_CREDENTIAL_ACCESS");
  const governance = readOnly(
    github(process.env.SCOP_SYNC_GOVERNANCE_TOKEN || process.env.GH_TOKEN),
  );
  const api = readOnly(github(process.env.GH_TOKEN)),
    current = q.provenance(),
    event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
  if (
    current.gitCommit !== process.env.GITHUB_WORKFLOW_SHA ||
    event.workflow_run?.event !== "push" ||
    event.workflow_run?.head_branch !== "master" ||
    event.workflow_run?.conclusion !== "success"
  )
    throw Error("IMMUTABLE_MASTER_WORKFLOW_REQUIRED");
  const ci = await verifiedCi(api, event.workflow_run.id, current);
  const sourceBranch = await api(
    "GET",
    `/repos/${selection.repo}/branches/master`,
  );
  let sourceReview = false;
  try {
    publisher.protection(
      await governance(
        "GET",
        `/repos/${selection.repo}/branches/master/protection`,
      ),
      "Code CI gate (not deployment approval)",
    );
    sourceReview = true;
  } catch (_) {
    /* Remains blocked without a verified source review policy. */
  }
  const out = path.join(root, "quality-results/sync-release");
  fs.mkdirSync(out, { recursive: true });
  const reports = {};
  for (const app of mode === "plan"
    ? ["backend", "frontend"]
    : [process.env.SYNC_APP]) {
    if (!publisher.repositories[app]) throw Error("FIXED_APP_REQUIRED");
    const dest = path.join(root, "sync-inputs", app),
      destSha = cp
        .execFileSync("git", ["rev-parse", "HEAD"], {
          cwd: dest,
          encoding: "utf8",
        })
        .trim();
    const baseline = await publisher.baseline(
      api,
      root,
      dest,
      ci.commit,
      destSha,
      app,
      policy,
    );
    const p = publisher.prepare(
      {
        sourceRepo: root,
        destinationRepo: dest,
        sourceSha: ci.commit,
        destinationSha: destSha,
        app,
        previousSourceSha: baseline?.sourceSha,
        previousDestinationSha: baseline?.destinationSha,
      },
      policy,
      ci,
    );
    try {
      publisher.protection(
        await governance(
          "GET",
          `/repos/${publisher.repositories[app]}/branches/main/protection`,
        ),
        policy.targets[app].requiredCheck,
      );
      publisher.destinationChecks(
        await governance(
          "GET",
          `/repos/${publisher.repositories[app]}/commits/${destSha}/check-runs?per_page=100`,
        ),
        policy.targets[app].requiredCheck,
        destSha,
      );
    } catch (_) {
      p.blockers.push("DESTINATION_CI_AND_PROTECTION_UNVERIFIED");
      p.status = "BLOCKED";
    }
    if (
      !sourceReview ||
      sourceBranch.protected !== true ||
      sourceBranch.commit.sha !== ci.commit
    ) {
      p.blockers.push("CURRENT_PROTECTED_SOURCE_MASTER_REQUIRED");
      p.status = "BLOCKED";
    }
    reports[app] = p;
    if (mode === "publish") {
      if (
        p.status === "BLOCKED" ||
        p.publicationSha256 !== process.env.APPROVED_PLAN_DIGEST
      )
        throw Error("POST_APPROVAL_REVALIDATION_FAILED");
      if (!p.plan.changeSet.length) {
        reports[app].publication = {
          status: "NO_CHANGES",
          writesPerformed: false,
        };
        continue;
      }
      const token = await mint(policy, app);
      try {
        reports[app].publication = await publisher.publish(
          token.api,
          p,
          root,
          policy,
          process.env.APPROVED_PLAN_DIGEST,
          governance,
        );
      } finally {
        await token.revoke();
      }
    } else if (process.env.GITHUB_OUTPUT)
      fs.appendFileSync(
        process.env.GITHUB_OUTPUT,
        `${app}_plan=${p.publicationSha256}\n`,
      );
  }
  fs.writeFileSync(
    path.join(out, mode + ".json"),
    JSON.stringify(
      {
        kind: "scop-sync-audit",
        version: 1,
        ci,
        reports,
        productionDeploymentAuthorized: false,
      },
      null,
      2,
    ) + "\n",
  );
  for (const [app, p] of Object.entries(reports))
    console.log(
      `${app}: ${p.status}, ${p.plan.conflicts} conflicts; publication ${p.publication?.status || "NOT_ATTEMPTED"}`,
    );
}
if (require.main === module)
  main().catch((e) => {
    const category = /^[A-Z0-9_]+$/.test(e.message.split(":")[0])
      ? e.message.split(":")[0]
      : "SYNC_FAILED_CLOSED";
    const out = path.join(root, "quality-results/sync-release");
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(
      path.join(out, "failure.json"),
      JSON.stringify({
        status: "BLOCKED",
        category,
        runId: process.env.GITHUB_RUN_ID || null,
        productionDeploymentAuthorized: false,
      }) + "\n",
    );
    console.error(
      category + ": inspect the audit artifact; credentials are never printed",
    );
    process.exitCode = 1;
  });
module.exports = { github, verifiedCi, readOnly };
