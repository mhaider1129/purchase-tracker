"use strict";
const fs = require("node:fs"),
  { execFileSync } = require("node:child_process");
const { assert } = require("./core.cjs");
function main() {
  assert(
    process.env.GITHUB_REF === "refs/heads/master" &&
      process.env.GITHUB_REPOSITORY === "mhaider1129/purchase-tracker",
    "MASTER_REQUEST_REQUIRED",
  );
  if (process.env.OPERATION !== "deploy") return;
  assert(
    /^[1-9][0-9]*$/.test(process.env.REHEARSAL || ""),
    "REHEARSAL_RUN_REQUIRED",
  );
  const repo = "mhaider1129/purchase-tracker",
    run = JSON.parse(
      execFileSync("gh", [
        "api",
        `/repos/${repo}/actions/runs/${process.env.REHEARSAL}`,
      ]),
    );
  require("../devops/verify-production-selection.cjs").runEvidence(
    run,
    ".github/workflows/staging-rehearsal.yml",
    ["workflow_run", "workflow_dispatch"],
  );
  // The triggering CI run is recorded in authenticated runtime receipts. Read
  // that receipt instead of guessing from the newest run or a mutable branch.
  const artifacts = JSON.parse(
    execFileSync("gh", [
      "api",
      `/repos/${repo}/actions/runs/${run.id}/artifacts?per_page=100`,
    ]),
  ).artifacts;
  const a =
    require("../devops/verify-production-selection.cjs").artifactEvidence(
      artifacts,
      `isolated-runtime-pg16-attempt-${run.run_attempt}`,
      run,
    );
  const os = require("node:os"),
    path = require("node:path"),
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "scop-select-"));
  try {
    const bytes = execFileSync(
      "gh",
      ["api", `/repos/${repo}/actions/artifacts/${a.id}/zip`],
      { maxBuffer: 16 * 1024 * 1024 },
    );
    assert(
      "sha256:" + require("./core.cjs").sha(bytes) === a.digest,
      "RECEIPT_DIGEST_MISMATCH",
    );
    fs.writeFileSync(path.join(dir, "a.zip"), bytes);
    execFileSync("python3", [
      path.join(__dirname, "../staging/unpack.py"),
      path.join(dir, "a.zip"),
      path.join(dir, "out"),
    ]);
    const r = JSON.parse(fs.readFileSync(path.join(dir, "out/pg16.json")));
    const actual = execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();
    assert(
      r.commit === actual && r.sourceCi?.commit === r.commit,
      "ACTUAL_TESTED_COMMIT_REQUIRED",
    );
    const id = String(r.sourceCi.runId);
    assert(
      /^[1-9][0-9]*$/.test(id) &&
        (!process.env.MANUAL_CI || process.env.MANUAL_CI === id),
      "CI_REQUEST_ID_MISMATCH",
    );
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `ci_run_id=${id}\n`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
if (require.main === module)
  try {
    main();
  } catch {
    console.error("STAGING_SELECTION_BLOCKED");
    process.exitCode = 1;
  }
module.exports = { main };
