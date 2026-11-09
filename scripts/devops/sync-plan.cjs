#!/usr/bin/env node
"use strict";
// Read-only Git objects -> deterministic review plan. There is no apply/push/PR API.
const path = require("node:path"),
  crypto = require("node:crypto"),
  { execFileSync } = require("node:child_process");
const sha = (value) => crypto.createHash("sha256").update(value).digest("hex");
function safePath(p) {
  if (
    !p ||
    p.includes("\\") ||
    /[\0\r\n]/.test(p) ||
    p.startsWith("/") ||
    /^[A-Za-z]:/.test(p) ||
    p.split("/").some((x) => x === "." || x === "..")
  )
    throw Error("NONCANONICAL_REPOSITORY_PATH");
  return p;
}
function excluded(p) {
  safePath(p);
  return (
    /(?:^|\/)(?:\.git|\.github|node_modules|private-uploads|uploads|logs|cache|\.cache|coverage|build|dist)(?:\/|$)/i.test(
      p,
    ) ||
    /(?:^|\/)\.env(?:\.|$)/i.test(p) ||
    /\.(?:log|pem|key|p12|pfx|sqlite|dump|bak)$/i.test(p)
  );
}
function git(repo, ...args) {
  return execFileSync("git", args, {
    cwd: repo,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
}
function commit(repo, ref) {
  if (!/^[a-f0-9]{40}$/.test(ref || ""))
    throw Error("FULL_IMMUTABLE_COMMIT_REQUIRED");
  const resolved = git(repo, "rev-parse", ref + "^{commit}").trim();
  if (resolved !== ref) throw Error("COMMIT_BINDING_MISMATCH");
  return resolved;
}
function tree(repo, ref, prefix = "") {
  commit(repo, ref);
  const rows = git(
    repo,
    "ls-tree",
    "-r",
    "-z",
    ref,
    ...(prefix ? ["--", prefix] : []),
  )
    .split("\0")
    .filter(Boolean);
  const result = new Map(),
    seen = new Map();
  for (const row of rows) {
    const at = row.indexOf("\t"),
      [mode, type, id] = row.slice(0, at).split(" ");
    const p = safePath(row.slice(at + 1).slice(prefix.length));
    if (excluded(p)) continue;
    if ((mode !== "100644" && mode !== "100755") || type !== "blob")
      throw Error("SUBMODULE_OR_SYMLINK_REQUIRES_REVIEW");
    const folded = p.toLowerCase();
    if (seen.has(folded) && seen.get(folded) !== p)
      throw Error("CASE_COLLISION_REQUIRES_REVIEW");
    seen.set(folded, p);
    result.set(p, { blob: id, mode });
  }
  return result;
}
const same = (a, b) => JSON.stringify(a || null) === JSON.stringify(b || null);
function changes(source, destination, oldSource, oldDestination) {
  const incremental = !!oldSource && !!oldDestination;
  const paths = [
    ...new Set([
      ...source.keys(),
      ...destination.keys(),
      ...(oldSource?.keys() || []),
      ...(oldDestination?.keys() || []),
    ]),
  ].sort();
  const list = [];
  const folded = new Set();
  for (const p of paths) {
    if (folded.has(p.toLowerCase()))
      throw Error("CROSS_TREE_CASE_COLLISION_REQUIRES_REVIEW");
    folded.add(p.toLowerCase());
  }
  for (const p of paths) {
    const a = source.get(p),
      b = destination.get(p),
      wasA = oldSource?.get(p),
      wasB = oldDestination?.get(p);
    if (same(a, b)) continue;
    let conflict = null;
    if (incremental && !same(wasA, wasB))
      conflict = "BASELINE_CONTENT_NOT_RECONCILED";
    else if (incremental && !same(b, wasB)) conflict = "DESTINATION_DIVERGED";
    else if (!incremental && b)
      conflict = a
        ? "INITIAL_DIFFERENCE_REQUIRES_REVIEW"
        : "UNMANAGED_DESTINATION_FILE";
    list.push({
      path: p,
      action: a ? (b ? "update" : "add") : "delete",
      before: b || null,
      after: a || null,
      conflict,
      deletionRequiresExplicitReview: !a,
    });
  }
  return list;
}
function plan({
  sourceRepo,
  destinationRepo,
  sourceSha,
  destinationSha,
  app,
  previousSourceSha,
  previousDestinationSha,
}) {
  if (!["backend", "frontend"].includes(app))
    throw Error("APP_MUST_BE_BACKEND_OR_FRONTEND");
  if (!!previousSourceSha !== !!previousDestinationSha)
    throw Error("BOTH_BASELINE_COMMITS_REQUIRED");
  const prefix = "purchase-" + app + "/";
  const source = tree(sourceRepo, sourceSha, prefix),
    dest = tree(destinationRepo, destinationSha);
  let priorSource, priorDest;
  if (previousSourceSha) {
    commit(sourceRepo, previousSourceSha);
    commit(destinationRepo, previousDestinationSha);
    git(
      sourceRepo,
      "merge-base",
      "--is-ancestor",
      previousSourceSha,
      sourceSha,
    );
    git(
      destinationRepo,
      "merge-base",
      "--is-ancestor",
      previousDestinationSha,
      destinationSha,
    );
    priorSource = tree(sourceRepo, previousSourceSha, prefix);
    priorDest = tree(destinationRepo, previousDestinationSha);
  }
  const changeSet = changes(source, dest, priorSource, priorDest);
  const result = {
    kind: "sync-dry-run",
    version: 1,
    app,
    sourceSha,
    destinationSha,
    previousSourceSha: previousSourceSha || null,
    previousDestinationSha: previousDestinationSha || null,
    changeSet,
    conflicts: changeSet.filter((r) => r.conflict).length,
    status: changeSet.some((r) => r.conflict)
      ? "REQUIRES_RECONCILIATION"
      : changeSet.length
        ? "REVIEWABLE_CHANGE_SET"
        : "NO_CHANGES",
    writesPerformed: false,
    destinationCIRequired: true,
    autoMergeEnabled: false,
    publishEnabled: false,
    workingTreesUsed: false,
  };
  return { ...result, planSha256: sha(JSON.stringify(result)) };
}
function args(argv) {
  const out = {};
  if (!argv.includes("--dry-run"))
    throw Error("DRY_RUN_ONLY_NO_PUBLISHER_IMPLEMENTED");
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key === "--dry-run") continue;
    if (
      ![
        "--source",
        "--destination",
        "--source-sha",
        "--destination-sha",
        "--app",
        "--previous-source-sha",
        "--previous-destination-sha",
      ].includes(key) ||
      !argv[i + 1]
    )
      throw Error("UNKNOWN_OR_INCOMPLETE_OPTION");
    out[key.slice(2)] = argv[++i];
  }
  return out;
}
if (require.main === module) {
  try {
    const o = args(process.argv.slice(2));
    const result = plan({
      sourceRepo: path.resolve(o.source || "."),
      destinationRepo: path.resolve(o.destination),
      sourceSha: o["source-sha"],
      destinationSha: o["destination-sha"],
      app: o.app,
      previousSourceSha: o["previous-source-sha"],
      previousDestinationSha: o["previous-destination-sha"],
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
module.exports = { safePath, excluded, tree, changes, plan, args };
