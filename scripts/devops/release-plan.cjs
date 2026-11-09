#!/usr/bin/env node
"use strict";
// Offline readiness checklist only. No deployment, SSH, SQL, PM2 or HTTP client.
const fs = require("node:fs");
function review(candidate) {
  const missing = [];
  if (!/^[a-f0-9]{40}$/.test(candidate.commit || ""))
    missing.push("immutable commit SHA");
  if (!/^[a-f0-9]{64}$/.test(candidate.artifactSha256 || ""))
    missing.push("tested artifact digest");
  for (const key of [
    "ciPassed",
    "disposableDatabaseTestsPassed",
    "stagingSmokePassed",
    "ownerUatAccepted",
    "databaseCompatibilityApproved",
    "backupRecoveryVerified",
    "environmentReviewersVerified",
  ])
    if (candidate[key] !== true) missing.push(key);
  return {
    kind: "disabled-release-plan",
    status: missing.length ? "BLOCKED" : "READY_FOR_HUMAN_REVIEW_ONLY",
    commit: candidate.commit || null,
    artifactSha256: candidate.artifactSha256 || null,
    missing,
    executionEnabled: false,
    productionDeploymentAuthorized: false,
    liveRoutingEnabled: false,
    warning:
      "Input assertions are not authenticated approval evidence. GitHub environment enforcement and separate operational authorization are still required.",
  };
}
if (require.main === module) {
  try {
    const result = review(JSON.parse(fs.readFileSync(process.argv[2], "utf8")));
    console.log(JSON.stringify(result, null, 2));
    if (result.status === "BLOCKED") process.exitCode = 1;
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
module.exports = { review };
