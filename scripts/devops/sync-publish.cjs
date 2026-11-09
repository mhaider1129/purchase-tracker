"use strict";
// Publisher accepts verified immutable plans, not filesystem overlays. No PATCH,
// forced refs, main writes, merge API, SQL or server/deployment commands exist.
const cp = require("node:child_process"),
  crypto = require("node:crypto"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const planner = require("./sync-plan.cjs"),
  security = require("./security.cjs");
const repositories = {
  backend: "mhaider1129/purchase-backend",
  frontend: "mhaider1129/purchase-frontend",
};
const digest = (x) =>
  crypto.createHash("sha256").update(JSON.stringify(x)).digest("hex");
const git = (dir, ...args) =>
  cp.execFileSync("git", args, {
    cwd: dir,
    maxBuffer: 32 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function protection(p, check) {
  if (
    !p?.required_pull_request_reviews ||
    p.required_pull_request_reviews.required_approving_review_count < 1 ||
    p.required_pull_request_reviews.dismiss_stale_reviews !== true ||
    p.enforce_admins?.enabled !== true ||
    p.allow_force_pushes?.enabled !== false ||
    p.allow_deletions?.enabled !== false ||
    p.required_status_checks?.strict !== true ||
    !p.required_status_checks.contexts?.includes(check)
  )
    throw Error("DESTINATION_CI_AND_REVIEW_PROTECTION_REQUIRED");
}
function destinationChecks(checks, requiredCheck, destinationSha) {
  if (
    checks.total_count >= 100 ||
    !checks.check_runs?.some(
      (c) =>
        c.name === requiredCheck &&
        c.app?.slug === "github-actions" &&
        c.head_sha === destinationSha &&
        c.status === "completed" &&
        c.conclusion === "success",
    )
  )
    throw Error("DESTINATION_DEFAULT_BRANCH_CI_REQUIRED");
}
function prepare(options, policy, ci) {
  const app = options.app,
    target = policy.targets[app];
  if (
    !repositories[app] ||
    target?.repository !== repositories[app] ||
    target.branch !== "main"
  )
    throw Error("FIXED_DESTINATION_REQUIRED");
  if (
    ci.commit !== options.sourceSha ||
    !Number.isSafeInteger(ci.runId) ||
    !Number.isSafeInteger(ci.attempt) ||
    ci.attempt < 1 ||
    ci.runId < 1 ||
    !/^sha256:[a-f0-9]{64}$/.test(ci.manifestDigest || "")
  )
    throw Error("VERIFIED_SOURCE_CI_REQUIRED");
  if (
    options.previousSourceSha &&
    planner.changes(
      planner.tree(
        options.sourceRepo,
        options.previousSourceSha,
        `purchase-${app}/`,
      ),
      planner.tree(options.destinationRepo, options.previousDestinationSha),
    ).length
  )
    throw Error("BASELINE_CONTENT_NOT_RECONCILED");
  const plan = planner.plan(options),
    sourceTreeSha256 = digest([
      ...planner
        .tree(options.sourceRepo, options.sourceSha, `purchase-${app}/`)
        .entries(),
    ]),
    blockers = [];
  if (
    policy.enabled !== true ||
    policy.bootstrapApproval !== "APPROVED" ||
    !/^[a-z0-9-]+$/.test(policy.appSlug || "")
  )
    blockers.push("PUBLISHING_NOT_AUTHORIZED");
  if (!options.previousSourceSha) {
    const b = target.approvedBootstrap;
    if (
      !b ||
      b.sourceTreeSha256 !== sourceTreeSha256 ||
      b.destinationSha !== plan.destinationSha ||
      b.changeSetSha256 !==
        digest({
          destinationSha: plan.destinationSha,
          changeSet: plan.changeSet,
        })
    )
      blockers.push("APPROVED_BOOTSTRAP_REQUIRED");
  }
  for (const row of plan.changeSet) {
    if (planner.excluded(row.path)) throw Error("PROTECTED_PATH_IN_PLAN");
    if (row.conflict) {
      const decision = target.approvedBootstrap?.decisions?.find(
        (d) =>
          d.path === row.path &&
          d.decision === "adopt-source" &&
          same(d.before, row.before) &&
          same(d.after, row.after),
      );
      if (options.previousSourceSha || !decision)
        blockers.push("UNRESOLVED_CONFLICT:" + row.path);
    }
    if (row.before && /\.sql$/i.test(row.path))
      blockers.push("EXISTING_SQL_IMMUTABLE:" + row.path);
    if (
      row.action === "delete" &&
      !policy.approvedDeletions.some(
        (d) =>
          d.app === app &&
          d.path === row.path &&
          d.sourceTreeSha256 === sourceTreeSha256 &&
          d.destinationSha === plan.destinationSha &&
          same(d.before, row.before),
      )
    )
      blockers.push("DELETION_REVIEW_REQUIRED:" + row.path);
  }
  const binding = {
    version: 1,
    repository: repositories[app],
    plan,
    ci,
    sourceTreeSha256,
    policySha256: digest(policy),
  };
  return {
    ...binding,
    publicationSha256: digest(binding),
    blockers,
    status: blockers.length
      ? "BLOCKED"
      : plan.changeSet.length
        ? "READY_FOR_REVIEWED_PUBLICATION"
        : "NO_CHANGES",
  };
}
function payload(sourceRepo, app, row) {
  if (!row.after) return null;
  const data = git(sourceRepo, "cat-file", "blob", row.after.blob);
  const hash = crypto
    .createHash("sha1")
    .update(Buffer.from(`blob ${data.length}\0`))
    .update(data)
    .digest("hex");
  if (hash !== row.after.blob) throw Error("SOURCE_BLOB_IDENTITY_MISMATCH");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scop-export-"));
  try {
    const file = path.join(dir, path.basename(row.path));
    fs.writeFileSync(file, data);
    const text = security.readText(file);
    if (
      text &&
      security
        .scan(text.text)
        .some(
          (f) =>
            !security.reviewedFixture(
              `purchase-${app}/${row.path}`,
              data,
              f.kind,
            ),
        )
    )
      throw Error("SECRET_IN_IMMUTABLE_EXPORT:" + row.path);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  return data;
}
const marker = "SCOP-Sync-v1: ";
async function baseline(
  api,
  sourceRepo,
  destinationRepo,
  sourceSha,
  destinationSha,
  app,
  policy,
) {
  const target = policy.targets[app],
    rows = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await api(
      "GET",
      `/repos/${repositories[app]}/pulls?state=closed&sort=updated&direction=desc&per_page=100&page=${page}`,
    );
    if (!Array.isArray(batch)) throw Error("INVALID_BASELINE_HISTORY");
    rows.push(...batch);
    if (batch.length < 100) break;
    if (page === 10) throw Error("BASELINE_HISTORY_REVIEW_REQUIRED");
  }
  const matches = rows
    .filter(
      (p) =>
        p.merged_at &&
        p.user?.login === `${policy.appSlug}[bot]` &&
        p.base?.ref === "main" &&
        p.base?.repo?.full_name === repositories[app] &&
        p.head?.repo?.full_name === repositories[app] &&
        p.head.ref.startsWith(`scop-sync/${app}/`),
    )
    .sort((a, b) => b.merged_at.localeCompare(a.merged_at));
  if (!matches.length) return target.baseline;
  if (matches.length > 1 && matches[0].merged_at === matches[1].merged_at)
    throw Error("AMBIGUOUS_MERGED_SYNC_BASELINE");
  const p = matches[0],
    c = await api(
      "GET",
      `/repos/${repositories[app]}/git/commits/${p.head.sha}`,
    );
  const lines = c.message.split("\n").filter((l) => l.startsWith(marker));
  if (lines.length !== 1) throw Error("MERGED_SYNC_PROVENANCE_REQUIRED");
  const proof = JSON.parse(
    Buffer.from(lines[0].slice(marker.length), "base64url").toString("utf8"),
  );
  if (
    proof.app !== app ||
    proof.repository !== "mhaider1129/purchase-tracker" ||
    !/^[a-f0-9]{40}$/.test(proof.sourceSha || "") ||
    !/^[a-f0-9]{40}$/.test(p.merge_commit_sha || "")
  )
    throw Error("INVALID_MERGED_SYNC_BASELINE");
  // Actual source and merged destination managed trees, plus both ancestries,
  // establish a baseline. A trailer or PR author alone is insufficient.
  git(sourceRepo, "merge-base", "--is-ancestor", proof.sourceSha, sourceSha);
  git(
    destinationRepo,
    "merge-base",
    "--is-ancestor",
    p.merge_commit_sha,
    destinationSha,
  );
  const source = planner.tree(sourceRepo, proof.sourceSha, `purchase-${app}/`),
    dest = planner.tree(destinationRepo, p.merge_commit_sha);
  if (planner.changes(source, dest).length)
    throw Error("MERGED_BASELINE_CONTENT_NOT_RECONCILED");
  return { sourceSha: proof.sourceSha, destinationSha: p.merge_commit_sha };
}
async function publish(
  api,
  prepared,
  sourceRepo,
  policy,
  approvedDigest,
  governanceApi = api,
) {
  // Rebuild and compare this object at the command boundary, after approval.
  if (
    prepared.status === "BLOCKED" ||
    prepared.blockers.length ||
    policy.enabled !== true ||
    approvedDigest !== prepared.publicationSha256 ||
    prepared.policySha256 !== digest(policy)
  )
    throw Error("PUBLICATION_APPROVAL_BINDING_REQUIRED");
  if (
    digest({
      version: prepared.version,
      repository: prepared.repository,
      plan: prepared.plan,
      ci: prepared.ci,
      sourceTreeSha256: prepared.sourceTreeSha256,
      policySha256: prepared.policySha256,
    }) !== prepared.publicationSha256
  )
    throw Error("PUBLICATION_PLAN_TAMPERED");
  const { plan, ci, repository } = prepared,
    app = plan.app;
  if (repository !== repositories[app])
    throw Error("FIXED_DESTINATION_REQUIRED");
  const prefix = `/repos/${repository}`;
  const checkHead = async () => {
    const ref = await api("GET", `${prefix}/git/ref/heads/main`);
    if (ref.object?.sha !== plan.destinationSha)
      throw Error("DESTINATION_HEAD_CHANGED");
  };
  protection(
    await governanceApi("GET", `${prefix}/branches/main/protection`),
    policy.targets[app].requiredCheck,
  );
  await checkHead();
  const checks = await governanceApi(
    "GET",
    `${prefix}/commits/${plan.destinationSha}/check-runs?per_page=100`,
  );
  destinationChecks(
    checks,
    policy.targets[app].requiredCheck,
    plan.destinationSha,
  );
  if (!plan.changeSet.length)
    return { status: "NO_CHANGES", writesPerformed: false };
  const branch = `scop-sync/${app}/${plan.sourceSha}-${plan.destinationSha}`;
  const pulls = await api(
    "GET",
    `${prefix}/pulls?state=all&head=mhaider1129:${branch}&base=main&per_page=100`,
  );
  if (pulls.length > 1) throw Error("AMBIGUOUS_SYNC_PULL_REQUEST");
  if (pulls[0] && pulls[0].state !== "open")
    throw Error("PREVIOUS_SYNC_CLOSED_REVIEW_REQUIRED");
  // Read and scan every changed blob before ANY remote write.
  const files = plan.changeSet.map((row) => ({
    row,
    data: payload(sourceRepo, app, row),
  }));
  const parent = await api(
    "GET",
    `${prefix}/git/commits/${plan.destinationSha}`,
  );
  const tree = [];
  for (const { row, data } of files) {
    if (data) {
      const b = await api("POST", `${prefix}/git/blobs`, {
        content: data.toString("base64"),
        encoding: "base64",
      });
      if (b.sha !== row.after.blob)
        throw Error("UPLOADED_BLOB_IDENTITY_MISMATCH");
    }
    tree.push({
      path: row.path,
      mode: (row.after || row.before).mode,
      type: "blob",
      sha: row.after?.blob || null,
    });
  }
  const t = await api("POST", `${prefix}/git/trees`, {
    base_tree: parent.tree.sha,
    tree,
  });
  const proof = {
    repository: "mhaider1129/purchase-tracker",
    app,
    sourceSha: plan.sourceSha,
    destinationSha: plan.destinationSha,
    publicationSha256: prepared.publicationSha256,
    ci,
  };
  const message = `SCOP ${app} synchronization\n\n${marker}${Buffer.from(JSON.stringify(proof)).toString("base64url")}`;
  const date = git(sourceRepo, "show", "-s", "--format=%cI", plan.sourceSha)
    .toString()
    .trim();
  const identity = {
    name: "SCOP Synchronization",
    email: "scop-sync@users.noreply.github.com",
    date,
  };
  const commit = await api("POST", `${prefix}/git/commits`, {
    message,
    tree: t.sha,
    parents: [plan.destinationSha],
    author: identity,
    committer: identity,
  });
  await checkHead();
  const refs = await api("GET", `${prefix}/git/matching-refs/heads/${branch}`);
  if (refs.length) {
    if (
      refs.length !== 1 ||
      refs[0].ref !== `refs/heads/${branch}` ||
      refs[0].object.sha !== commit.sha
    )
      throw Error("SYNC_BRANCH_DIVERGED");
  } else
    await api("POST", `${prefix}/git/refs`, {
      ref: `refs/heads/${branch}`,
      sha: commit.sha,
    });
  await checkHead();
  let pr = pulls[0];
  if (pr && pr.head?.sha !== commit.sha)
    throw Error("EXISTING_PR_HEAD_MISMATCH");
  if (!pr)
    pr = await api("POST", `${prefix}/pulls`, {
      head: branch,
      base: "main",
      draft: true,
      maintainer_can_modify: false,
      title: `SCOP: ${app} from ${plan.sourceSha.slice(0, 12)}`,
      body: `Authoritative source: https://github.com/mhaider1129/purchase-tracker/commit/${plan.sourceSha}\n\nSource CI: https://github.com/mhaider1129/purchase-tracker/actions/runs/${ci.runId} (attempt ${ci.attempt})\n\nPublication digest: ${prepared.publicationSha256}\nCI manifest: ${ci.manifestDigest}\n\nDestination CI and independent review required. No merge, deployment or database execution is authorized.\n\n${marker}${Buffer.from(JSON.stringify(proof)).toString("base64url")}`,
    });
  return {
    status: "PR_REVIEW_REQUIRED",
    writesPerformed: true,
    branch,
    commit: commit.sha,
    pullRequest: pr.html_url,
    sourceSha: plan.sourceSha,
    destinationSha: plan.destinationSha,
    publicationSha256: prepared.publicationSha256,
  };
}
module.exports = {
  repositories,
  destinationChecks,
  digest,
  protection,
  prepare,
  payload,
  baseline,
  publish,
  marker,
};
