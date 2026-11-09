#!/usr/bin/env node
"use strict";
// GitHub's immutable upload-artifact ID and authenticated ZIP digest bind this
// receipt to its producer run. A run head_sha alone is never test evidence.
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const config = require("../quality/gates.json");
const profiles = config.gates.filter((g) => g.group === "postgres");
const gates = profiles.map((g) => g.id);
function checkout(env, actual) {
  const sha = env.SELECTED_COMMIT;
  if (
    !/^[a-f0-9]{40}$/.test(sha || "") ||
    sha !== env.GITHUB_SHA ||
    sha !== actual
  )
    throw Error("DISPATCH_CHECKOUT_COMMIT_MISMATCH");
  return sha;
}
function receipt(env, actual, gate, report) {
  const testedCommit = checkout(env, actual);
  if (
    !gates.includes(gate) ||
    report.kind !== "quality-gate" ||
    report.version !== 1 ||
    !new RegExp(`^v${config.nodeMajor}\\.`).test(report.nodeVersion || "") ||
    JSON.stringify(report.command) !==
      JSON.stringify(profiles.find((g) => g.id === gate)?.command) ||
    report.signal !== null ||
    report.id !== gate ||
    report.status !== "passed" ||
    report.gitCommit !== testedCommit ||
    report.dirty !== false ||
    report.liveRoutingEnabled !== false ||
    !/^[a-f0-9]{64}$/.test(report.sourceDigest || "") ||
    !/^[a-f0-9]{64}$/.test(report.gateConfigDigest || "") ||
    !/^[a-f0-9]{64}$/.test(report.log?.sha256 || "") ||
    report.exitCode !== 0 ||
    !report.results ||
    !Object.keys(report.results).length
  )
    throw Error("INCOMPLETE_DATABASE_GATE_EVIDENCE");
  const profile = profiles.find((g) => g.id === gate),
    result = report.results;
  if (
    (profile.kind === "schema" &&
      (!(result.plansPassed > 0) ||
        result.plansFailed !== 0 ||
        result.postflightFindings !== 0)) ||
    (gate === "p2p" &&
      (!(result.passed > 0) || result.failed !== 0 || result.skipped !== 0)) ||
    (profile.kind !== "schema" &&
      gate !== "p2p" &&
      (JSON.stringify(result.completionMarkers) !==
        JSON.stringify(profile.markers || []) ||
        !Array.isArray(result.scenarioCounts) ||
        result.scenarioCounts.some((n) => !Number.isInteger(n) || n < 1)))
  )
    throw Error("INCOMPLETE_DATABASE_GATE_RESULTS");
  return {
    kind: "scop-database-provenance",
    version: 1,
    repository: env.GITHUB_REPOSITORY,
    workflow: ".github/workflows/isolated-database-validation.yml",
    runId: String(env.GITHUB_RUN_ID),
    attempt: String(env.GITHUB_RUN_ATTEMPT),
    dispatchCommit: env.GITHUB_SHA,
    testedCommit,
    gate,
    report,
  };
}
function verify(r, run, gate, commit) {
  if (
    r?.kind !== "scop-database-provenance" ||
    r.version !== 1 ||
    r.repository !== "mhaider1129/purchase-tracker" ||
    r.workflow !== run.path ||
    r.runId !== String(run.id) ||
    r.attempt !== String(run.run_attempt) ||
    r.dispatchCommit !== commit ||
    r.testedCommit !== commit ||
    r.gate !== gate
  )
    throw Error("DATABASE_RECEIPT_PROVENANCE_MISMATCH");
  receipt(
    { SELECTED_COMMIT: commit, GITHUB_SHA: commit },
    commit,
    gate,
    r.report,
  );
  const start = Date.parse(r.report.startedAt),
    end = Date.parse(r.report.finishedAt);
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start > end ||
    end > Date.now() + 60000 ||
    Date.now() - end > 30 * 86400000
  )
    throw Error("DATABASE_RECEIPT_EXPIRED_OR_INVALID");
  return r.report.sourceDigest + ":" + r.report.gateConfigDigest;
}
if (require.main === module) {
  const actual = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
  checkout(process.env, actual);
  if (process.argv[2] !== "check") {
    const gate = process.argv[2],
      r = receipt(
        process.env,
        actual,
        gate,
        JSON.parse(fs.readFileSync(`quality-results/${gate}.json`, "utf8")),
      );
    const current = require("../quality/release.cjs").provenance();
    const hash = require("node:crypto")
      .createHash("sha256")
      .update(fs.readFileSync(`quality-results/${gate}.log`))
      .digest("hex");
    if (
      current.dirty ||
      current.gitCommit !== r.testedCommit ||
      current.sourceDigest !== r.report.sourceDigest ||
      current.gateConfigDigest !== r.report.gateConfigDigest ||
      hash !== r.report.log.sha256
    )
      throw Error("DATABASE_PROVENANCE_SOURCE_OR_LOG_CHANGED");
    fs.mkdirSync("quality-results/provenance", { recursive: true });
    fs.writeFileSync(
      `quality-results/provenance/${gate}.json`,
      JSON.stringify(r) + "\n",
      {
        flag: "wx",
      },
    );
  }
}
module.exports = { checkout, receipt, verify, gates };
