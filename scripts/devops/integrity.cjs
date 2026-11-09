#!/usr/bin/env node
"use strict";
// Offline only: raw byte checks are authoritative; diagnosis never repairs files.
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "../..");
const sha = (data) => crypto.createHash("sha256").update(data).digest("hex");
function diagnose(bytes, expected, gitBytes) {
  if (sha(bytes) === expected) return "MATCH";
  if (
    bytes.includes(Buffer.from("\r\n")) &&
    sha(Buffer.from(bytes.toString("utf8").replace(/\r\n/g, "\n"))) === expected
  )
    return "CRLF_CHECKOUT_CONFIRMED_STILL_BLOCKED";
  if (gitBytes && sha(gitBytes) === expected)
    return "WORKTREE_DIFFERS_FROM_LOCKED_GIT_BLOB";
  return "CONTENT_OR_LOCK_DIVERGENCE_REQUIRES_REVIEW";
}
function inspect(base) {
  if (!/^[a-f0-9]{40}$/.test(base || ""))
    throw Error("EXPLICIT_FULL_BASE_SHA_REQUIRED");
  const inv = require("../../purchase-backend/scripts/lib/databaseRelease/inventory");
  const manifest = JSON.parse(
    fs.readFileSync(
      path.join(inv.root, "database/releases/migration-inventory.json"),
    ),
  );
  const current = inv.inventory(),
    findings = inv.verifyFiles(manifest);
  const rows = [...manifest.artifacts, ...manifest.application_sources];
  const diagnostics = findings.map((f) => {
    const row = rows.find((r) => r.path === f.file);
    if (!row || !fs.existsSync(path.join(inv.root, row.path))) return f;
    let gitBytes;
    try {
      gitBytes = execFileSync(
        "git",
        ["show", "HEAD:purchase-backend/" + row.path],
        {
          cwd: root,
          stdio: ["ignore", "pipe", "ignore"],
          maxBuffer: 16 * 1024 * 1024,
        },
      );
    } catch (_) {
      /* diagnostic only */
    }
    return {
      ...f,
      expectedSha256: row.sha256,
      actualSha256: sha(fs.readFileSync(path.join(inv.root, row.path))),
      diagnosis: diagnose(
        fs.readFileSync(path.join(inv.root, row.path)),
        row.sha256,
        gitBytes,
      ),
    };
  });
  if (current.highest_manual_number !== manifest.highest_manual_number)
    diagnostics.push({ reason: "HIGHEST_MIGRATION_NUMBER_DRIFT" });
  for (const r of current.artifacts) {
    const locked = manifest.artifacts.find((v) => v.path === r.path);
    if (
      locked &&
      (locked.id !== r.id || locked.classification !== r.classification)
    )
      diagnostics.push({
        file: r.path,
        reason: "MIGRATION_CLASSIFICATION_DRIFT",
      });
  }
  const prior = JSON.parse(
    execFileSync(
      "git",
      [
        "show",
        base + ":purchase-backend/database/releases/migration-inventory.json",
      ],
      { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
    ),
  );
  require("../quality/release.cjs").compareHistory(prior.artifacts, (p) =>
    fs.readFileSync(path.join(inv.root, p)),
  );
  return {
    kind: "source-integrity",
    status: diagnostics.length ? "BLOCKED" : "PASSED",
    base,
    highestManualNumber: current.highest_manual_number,
    artifactCount: manifest.artifacts.length,
    findings: diagnostics,
    databaseConnected: false,
  };
}
if (require.main === module) {
  try {
    const at = process.argv.indexOf("--base");
    const refAt = process.argv.indexOf("--base-ref");
    const base =
      at >= 0
        ? process.argv[at + 1]
        : refAt >= 0
          ? execFileSync(
              "git",
              ["rev-parse", "--verify", process.argv[refAt + 1] + "^{commit}"],
              { cwd: root, encoding: "utf8" },
            ).trim()
          : undefined;
    const result = inspect(base);
    console.log(JSON.stringify(result, null, 2));
    if (result.status !== "PASSED") process.exitCode = 1;
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
module.exports = { diagnose, inspect, sha };
