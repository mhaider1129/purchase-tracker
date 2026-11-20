"use strict";
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  { execFileSync } = require("node:child_process");
const { assert, sha } = require("./core.cjs"),
  select = require("../devops/verify-production-selection.cjs");
async function verify(id, selection, api, read) {
  const r = await api(`/actions/runs/${id}`);
  select.runEvidence(r, ".github/workflows/staging-rehearsal.yml", [
    "workflow_run",
    "workflow_dispatch",
  ]);
  assert(r.head_sha === selection.commit, "REHEARSAL_REQUEST_COMMIT_MISMATCH");
  assert(
    Date.now() - Date.parse(r.updated_at) < 24 * 3600000 &&
      Date.parse(r.updated_at) <= Date.now() + 60000,
    "REHEARSAL_TOO_OLD",
  );
  const gates = require("../quality/gates.json")
    .gates.filter((g) => g.group === "postgres")
    .map((g) => g.id);
  select.jobsEvidence(
    (await api(`/actions/runs/${id}/jobs?filter=latest&per_page=100`)).jobs,
    [
      "readiness",
      "runtime (16)",
      "runtime (17)",
      ...gates.map((g) => `transactions (${g})`),
    ],
  );
  const artifacts = (await api(`/actions/runs/${id}/artifacts?per_page=100`))
    .artifacts;
  const result = [];
  for (const major of ["16", "17"]) {
    const a = select.artifactEvidence(
        artifacts,
        `isolated-runtime-pg${major}-attempt-${r.run_attempt}`,
        r,
      ),
      report = await read(a, major);
    assert(
      report.commit === selection.commit &&
        report.postgresMajor === major &&
        report.status ===
          "DISPOSABLE_REHEARSAL_PASSED_NOT_ACTIVATION_APPROVAL" &&
        report.database?.status === "DATABASE_READY" &&
        report.database.findings?.length === 0 &&
        report.cleanupFailures?.length === 0 &&
        JSON.stringify(report.sourceCi) === JSON.stringify(selection),
      "REHEARSAL_RUNTIME_RECEIPT_MISMATCH",
    );
    result.push(a);
  }
  return {
    runId: r.id,
    attempt: r.run_attempt,
    commit: selection.commit,
    artifacts: result,
  };
}
async function ghVerify(id, selection) {
  assert(/^[1-9][0-9]*$/.test(String(id)), "REHEARSAL_RUN_ID_REQUIRED");
  const repo = "mhaider1129/purchase-tracker";
  const api = async (route) =>
    JSON.parse(
      execFileSync("gh", ["api", `/repos/${repo}${route}`], {
        maxBuffer: 4 * 1024 * 1024,
      }),
    );
  return verify(id, selection, api, async (a, major) => {
    const zip = execFileSync(
      "gh",
      ["api", `/repos/${repo}/actions/artifacts/${a.id}/zip`],
      { maxBuffer: 16 * 1024 * 1024 },
    );
    assert(
      "sha256:" + sha(zip) === a.digest,
      "REHEARSAL_ARCHIVE_DIGEST_MISMATCH",
    );
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scop-receipt-"));
    try {
      fs.writeFileSync(path.join(dir, "in.zip"), zip);
      execFileSync("python3", [
        path.join(__dirname, "../staging/unpack.py"),
        path.join(dir, "in.zip"),
        path.join(dir, "out"),
      ]);
      return JSON.parse(
        fs.readFileSync(path.join(dir, "out", `pg${major}.json`)),
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}
async function ghGateway(selection, sourceDigest) {
  const repo = "mhaider1129/purchase-tracker";
  const api = (route) =>
    JSON.parse(
      execFileSync("gh", ["api", `/repos/${repo}${route}`], {
        maxBuffer: 4 * 1024 * 1024,
      }),
    );
  const runs = api(
    `/actions/workflows/persistent-local-validation.yml/runs?head_sha=${selection.commit}&per_page=100`,
  ).workflow_runs.filter(
    (r) =>
      r.head_sha === selection.commit &&
      r.event === "push" &&
      r.head_branch === "master",
  );
  runs.sort((a, b) => b.id - a.id);
  const run = runs[0];
  assert(run, "SAME_COMMIT_GATEWAY_CI_REQUIRED");
  select.runEvidence(run, ".github/workflows/persistent-local-validation.yml", [
    "push",
  ]);
  select.jobsEvidence(
    api(`/actions/runs/${run.id}/jobs?filter=latest&per_page=100`).jobs,
    ["gateway"],
  );
  const artifact = select.artifactEvidence(
    api(`/actions/runs/${run.id}/artifacts?per_page=100`).artifacts,
    `persistent-local-gateway-attempt-${run.run_attempt}`,
    run,
  );
  const report = require("../devops/artifact-json.cjs").read(
    artifact,
    "local-gateway.json",
  );
  assert(
    report.status === "LOCAL_GATEWAY_VALIDATED" &&
      report.commit === selection.commit &&
      report.source?.gitCommit === selection.commit &&
      report.source.dirty === false &&
      report.source.sourceDigest === sourceDigest &&
      report.gatewayStatus === 200 &&
      report.database?.status === "DATABASE_READY" &&
      report.database.findings?.length === 0 &&
      report.cleanupFailures?.length === 0,
    "GATEWAY_CI_RECEIPT_MISMATCH",
  );
  return {
    runId: run.id,
    attempt: run.run_attempt,
    commit: report.commit,
    artifact,
  };
}
module.exports = { verify, ghVerify, ghGateway };
