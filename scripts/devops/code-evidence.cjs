#!/usr/bin/env node
"use strict";
const fs = require("node:fs"),
  path = require("node:path");
const q = require("../quality/release.cjs");
function evidence(needs) {
  const failures = [];
  for (const key of [
    "backend",
    "frontend",
    "integrity",
    "security",
    "sync-dry-run",
  ])
    if (needs[key]?.result !== "success")
      failures.push(key + ": required code check did not succeed");
  const artifacts = {
    backend: needs.backend?.outputs?.backend_artifact_id,
    frontend: needs.frontend?.outputs?.frontend_artifact_id,
  };
  if (!Object.values(artifacts).every((v) => /^[1-9][0-9]*$/.test(v || "")))
    failures.push("tested release artifacts missing");
  const current = q.provenance();
  if (current.dirty) failures.push("uncommitted inputs");
  return {
    kind: "scop-code-ci",
    ciRunId: process.env.GITHUB_RUN_ID || null,
    ciRunAttempt: process.env.GITHUB_RUN_ATTEMPT || null,
    version: 1,
    ...current,
    artifacts,
    status: failures.length ? "BLOCKED" : "CODE_TEST_READY",
    databaseExecutionTests: "REQUIRED_SEPARATE_MANUAL_ISOLATED_VALIDATION",
    stagingAcceptance: "NOT_ESTABLISHED",
    productionDeploymentAuthorized: false,
    liveRoutingEnabled: false,
    failures,
  };
}
if (require.main === module) {
  try {
    const out = process.argv[2];
    if (!out) throw Error("OUTPUT_REQUIRED");
    const r = evidence(JSON.parse(process.env.REQUIRED_JOB_RESULTS || "{}"));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(r, null, 2) + "\n");
    console.log(r.status);
    if (process.env.GITHUB_STEP_SUMMARY)
      fs.appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        `## ${r.status}\n\nCode CI run ID: ${r.ciRunId} (attempt ${r.ciRunAttempt})\n\nCommit: ${r.gitCommit}\n\nBackend artifact ID: ${r.artifacts.backend || "missing"}\n\nFrontend artifact ID: ${r.artifacts.frontend || "missing"}\n\nProduction is not activated; this is code evidence only.\n`,
      );
    if (r.status === "BLOCKED") process.exitCode = 1;
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
module.exports = { evidence };
