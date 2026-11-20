"use strict";
const crypto = require("node:crypto"),
  fs = require("node:fs");
const { assert } = require("./core.cjs"),
  policy = require("../../deploy/persistent/policy.json");
const selector = require("../devops/verify-production-selection.cjs");
function approved(run, approvals, environment, manifest) {
  assert(
    Number(run.run_attempt) === 1,
    "FRESH_REQUEST_REQUIRED_INSTEAD_OF_RERUN",
  );
  assert(
    run.status === "completed" &&
      run.conclusion === "success" &&
      run.path === policy.requestWorkflow &&
      ["workflow_run", "workflow_dispatch"].includes(run.event) &&
      run.head_branch === "master" &&
      run.repository?.full_name === policy.repository &&
      run.head_repository?.full_name === policy.repository,
    "UNTRUSTED_REQUEST_RUN",
  );
  assert(
    String(run.id) === String(manifest.request.runId) &&
      String(run.run_attempt) === String(manifest.request.attempt) &&
      run.head_sha === manifest.request.workflowCommit,
    "REQUEST_BINDING_MISMATCH",
  );
  const date = Date.parse(run.updated_at);
  assert(
    Number.isFinite(date) &&
      date <= Date.now() + 60000 &&
      Date.now() - date < policy.maxAgeHours * 3600000,
    "REQUEST_STALE_OR_FUTURE",
  );
  selector.environmentEvidence(environment);
  assert(
    Array.isArray(approvals) &&
      approvals.some(
        (a) =>
          a.state === "approved" &&
          a.user?.login &&
          a.user.login !== run.actor?.login &&
          a.environments?.some(
            (e) => e.name === policy.environment && e.id === environment.id,
          ),
      ),
    "INDEPENDENT_ENVIRONMENT_APPROVAL_REQUIRED",
  );
}
function transport(token) {
  return async function api(route, data) {
    assert(
      /^\/(?:actions|environments|branches|deployments)\b/.test(route),
      "UNEXPECTED_GITHUB_ROUTE",
    );
    const r = await fetch(
      `https://api.github.com/repos/${policy.repository}${route}`,
      {
        method: data ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: data ? JSON.stringify(data) : undefined,
        redirect: "error",
        signal: AbortSignal.timeout(30000),
      },
    );
    assert(r.ok, "GITHUB_REQUEST_FAILED_" + r.status);
    return r.json();
  };
}
async function appToken(config) {
  for (const value of [config.githubAppId, config.githubInstallationId])
    assert(/^[1-9][0-9]*$/.test(String(value)), "STAGING_APP_ID_REQUIRED");
  assert(
    config.githubAppKeyFile === "/etc/scop-staging/github-app.pem",
    "FIXED_STAGING_APP_KEY_REQUIRED",
  );
  const now = Math.floor(Date.now() / 1000),
    enc = (x) => Buffer.from(JSON.stringify(x)).toString("base64url");
  const data =
    enc({ alg: "RS256", typ: "JWT" }) +
    "." +
    enc({ iat: now - 60, exp: now + 540, iss: config.githubAppId });
  const jwt =
    data +
    "." +
    crypto
      .sign(
        "RSA-SHA256",
        Buffer.from(data),
        fs.readFileSync(config.githubAppKeyFile),
      )
      .toString("base64url");
  const r = await fetch(
    `https://api.github.com/app/installations/${config.githubInstallationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        repositories: ["purchase-tracker"],
        permissions: {
          actions: "read",
          contents: "read",
          deployments: "write",
        },
      }),
      redirect: "error",
      signal: AbortSignal.timeout(30000),
    },
  );
  assert(r.ok, "STAGING_APP_AUTHENTICATION_FAILED");
  const result = await r.json();
  assert(
    result.permissions?.actions === "read" &&
      result.permissions?.contents === "read" &&
      result.permissions?.deployments === "write" &&
      !Object.entries(result.permissions).some(
        ([k, v]) => v === "write" && k !== "deployments",
      ),
    "STAGING_APP_PERMISSIONS_TOO_BROAD",
  );
  return result.token;
}
async function download(id, digest, out, token) {
  assert(
    Number.isSafeInteger(Number(id)) &&
      Number(id) > 0 &&
      /^sha256:[a-f0-9]{64}$/.test(digest),
    "IMMUTABLE_ARTIFACT_REQUIRED",
  );
  let r = await fetch(
    `https://api.github.com/repos/${policy.repository}/actions/artifacts/${id}/zip`,
    {
      headers: { Authorization: `Bearer ${token}` },
      redirect: "manual",
      signal: AbortSignal.timeout(30000),
    },
  );
  if (r.status === 302) {
    const u = new URL(r.headers.get("location"));
    assert(
      u.protocol === "https:" &&
        !u.username &&
        !u.password &&
        u.port === "" &&
        /\.blob\.core\.windows\.net$|\.actions\.githubusercontent\.com$/.test(
          u.hostname,
        ),
      "UNTRUSTED_ARTIFACT_REDIRECT",
    );
    r = await fetch(u, {
      redirect: "error",
      signal: AbortSignal.timeout(120000),
    });
  }
  assert(r.ok && r.body, "ARTIFACT_DOWNLOAD_FAILED");
  const fd = fs.openSync(out, "wx", 0o600),
    hash = crypto.createHash("sha256");
  let bytes = 0;
  try {
    for await (const chunk of r.body) {
      bytes += chunk.length;
      assert(bytes <= policy.maxCapsuleBytes, "CAPSULE_TOO_LARGE");
      hash.update(chunk);
      fs.writeSync(fd, chunk);
    }
    assert(
      "sha256:" + hash.digest("hex") === digest,
      "CAPSULE_TRANSPORT_CHECKSUM_MISMATCH",
    );
    fs.fsyncSync(fd);
  } catch (e) {
    fs.closeSync(fd);
    fs.rmSync(out, { force: true });
    throw e;
  }
  fs.closeSync(fd);
}
module.exports = { approved, transport, appToken, download };
