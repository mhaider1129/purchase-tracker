"use strict";
// Static review evidence only. A keyword-free migration is still not approved.
const { execFileSync } = require("node:child_process"),
  fs = require("node:fs"),
  path = require("node:path");
function classify(sql) {
  const risks = [];
  // Intentionally conservative: procedural/dynamic SQL and strings may contain
  // these terms. False positives require review, never automatic acceptance.
  if (/\b(?:DROP|TRUNCATE)\b/i.test(sql)) risks.push("DESTRUCTIVE_DDL_REVIEW");
  if (/\bALTER\b[\s\S]*?\b(?:TYPE|NOT\s+NULL)\b/i.test(sql))
    risks.push("COLUMN_COMPATIBILITY_REVIEW");
  if (/\b(?:UPDATE|DELETE|INSERT)\b/i.test(sql))
    risks.push("DATA_PRESERVATION_REVIEW");
  if (/\b(?:GRANT|REVOKE|POLICY|BYPASSRLS|SECURITY\s+DEFINER)\b/i.test(sql))
    risks.push("AUTHORITY_REVIEW");
  return {
    risks,
    approval: "MANUAL_REVIEW_REQUIRED",
    automaticExecution: false,
  };
}
function review(root, base) {
  if (!/^[a-f0-9]{40}$/.test(base || ""))
    throw Error("IMMUTABLE_BASE_REQUIRED");
  const rows = execFileSync(
    "git",
    ["diff", "--name-only", "-z", base, "HEAD", "--", "purchase-backend/sql"],
    { cwd: root, encoding: "utf8" },
  )
    .split("\0")
    .filter(Boolean);
  const changes = rows.map((file) => ({
    file,
    ...(fs.existsSync(path.join(root, file))
      ? classify(fs.readFileSync(path.join(root, file), "utf8"))
      : {
          risks: ["SQL_DELETION_REVIEW"],
          approval: "MANUAL_REVIEW_REQUIRED",
          automaticExecution: false,
        }),
  }));
  return {
    kind: "migration-change-review",
    base,
    changes,
    automaticExecution: false,
    status: changes.length
      ? "MANUAL_SQL_CHANGE_REVIEW_REQUIRED"
      : "NO_SQL_CHANGES",
  };
}
if (require.main === module) {
  const root = path.resolve(__dirname, "../..");
  const base = execFileSync("git", ["rev-parse", "HEAD^1"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  const report = review(root, base);
  fs.mkdirSync(path.join(root, "quality-results/staging"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "quality-results/staging/migration-review.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(report.status);
  if (report.changes.length) process.exitCode = 1;
}
module.exports = { classify, review };
