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
  const current = q.provenance();
  if (current.dirty) failures.push("uncommitted inputs");
  return {
    kind: "scop-code-ci",
    version: 1,
    ...current,
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
    if (r.status === "BLOCKED") process.exitCode = 1;
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
module.exports = { evidence };
