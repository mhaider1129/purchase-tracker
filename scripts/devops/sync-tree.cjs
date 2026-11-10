"use strict";
// Pure, complete Git-tree projection. Never extracts files or executes Git/SQL.
const crypto = require("node:crypto");
const sha = (x) =>
  crypto.createHash("sha256").update(JSON.stringify(x)).digest("hex");
const same = (a, b) => JSON.stringify(a || null) === JSON.stringify(b || null);
const modes = {
  100644: "blob",
  100755: "blob",
  120000: "blob",
  160000: "commit",
};
const parents = (p) => {
  const parts = p.split("/");
  return parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join("/"));
};
function ordered(map) {
  return [...map.entries()].sort(([a], [b]) =>
    Buffer.compare(Buffer.from(a), Buffer.from(b)),
  );
}
function shape(leaves, safePath) {
  const seen = new Map(),
    dirs = new Set();
  for (const [p, row] of leaves) {
    safePath(p);
    if (!/^[a-f0-9]{40}$/.test(row.blob || "") || modes[row.mode] !== row.type)
      throw Error("UNSUPPORTED_FULL_TREE_ENTRY");
    for (const name of [...parents(p), p]) {
      const folded = name.toLowerCase();
      if (seen.has(folded) && seen.get(folded) !== name)
        throw Error("FULL_TREE_CASE_COLLISION");
      seen.set(folded, name);
    }
    for (const parent of parents(p)) {
      if (leaves.has(parent)) throw Error("FULL_TREE_ANCESTOR_COLLISION");
      dirs.add(parent);
    }
  }
  return dirs;
}
function hashTree(leaves, safePath) {
  const dirs = shape(leaves, safePath),
    directoryHashes = new Map();
  const make = (prefix) => {
    const entries = [];
    for (const [p, row] of leaves)
      if (!p.slice(prefix.length).includes("/") && p.startsWith(prefix))
        entries.push({
          name: p.slice(prefix.length),
          mode: row.mode,
          sha: row.blob,
          type: row.type,
        });
    for (const p of dirs)
      if (p.startsWith(prefix) && !p.slice(prefix.length).includes("/"))
        entries.push({
          name: p.slice(prefix.length),
          mode: "40000",
          sha: make(p + "/"),
          type: "tree",
        });
    entries.sort((a, b) =>
      Buffer.compare(
        Buffer.from(a.name + (a.type === "tree" ? "/" : "")),
        Buffer.from(b.name + (b.type === "tree" ? "/" : "")),
      ),
    );
    const data = Buffer.concat(
      entries.map((e) =>
        Buffer.concat([
          Buffer.from(e.mode + " " + e.name + "\0"),
          Buffer.from(e.sha, "hex"),
        ]),
      ),
    );
    const digest = crypto
      .createHash("sha1")
      .update(Buffer.from(`tree ${data.length}\0`))
      .update(data)
      .digest("hex");
    if (prefix) directoryHashes.set(prefix.slice(0, -1), digest);
    return digest;
  };
  const gitTreeSha = make("");
  return { gitTreeSha, directoryHashes };
}
function parse(entries, safePath, expectedSha) {
  if (!Array.isArray(entries)) throw Error("INCOMPLETE_FULL_TREE");
  const leaves = new Map(),
    directories = new Map(),
    seen = new Set();
  for (const row of entries) {
    const p = safePath(row.path);
    if (seen.has(p)) throw Error("DUPLICATE_FULL_TREE_ENTRY");
    seen.add(p);
    if (row.type === "tree") {
      if (row.mode !== "040000" || !/^[a-f0-9]{40}$/.test(row.sha || ""))
        throw Error("UNSUPPORTED_FULL_TREE_DIRECTORY");
      directories.set(p, row.sha);
    } else leaves.set(p, { blob: row.sha, mode: row.mode, type: row.type });
  }
  const actual = hashTree(leaves, safePath);
  if (
    directories.size !== actual.directoryHashes.size ||
    [...directories].some(([p, s]) => actual.directoryHashes.get(p) !== s)
  )
    throw Error("INCOMPLETE_OR_UNSUPPORTED_FULL_TREE_DIRECTORIES");
  if (expectedSha !== actual.gitTreeSha)
    throw Error("FULL_TREE_IDENTITY_MISMATCH");
  return leaves;
}
function protectedPath(p, excluded) {
  return [p, ...parents(p)].some(excluded);
}
function project(
  source,
  destination,
  changes,
  { safePath, excluded, preserveSql = true },
) {
  shape(source, safePath);
  shape(destination, safePath);
  const result = new Map(destination),
    changed = new Set();
  for (const row of changes) {
    const p = safePath(row.path);
    if (changed.has(p)) throw Error("DUPLICATE_TREE_OPERATION");
    changed.add(p);
    if (protectedPath(p, excluded))
      throw Error("PROTECTED_TREE_OPERATION:" + p);
    const before = destination.get(p),
      after = source.get(p);
    const plain = (r) => (r ? { blob: r.blob, mode: r.mode } : null);
    if (!same(plain(before), row.before) || !same(plain(after), row.after))
      throw Error("TREE_OPERATION_IDENTITY_MISMATCH");
    if (
      preserveSql &&
      before &&
      /\.sql$/i.test(p) &&
      !same(plain(before), plain(after))
    )
      throw Error("EXISTING_SQL_IMMUTABLE:" + p);
    if (
      row.after &&
      (!after ||
        after.type !== "blob" ||
        !["100644", "100755"].includes(after.mode))
    )
      throw Error("UNSUPPORTED_SOURCE_TREE_OPERATION");
    if (!row.after) result.delete(p);
  }
  // Explicit removals are handled first. New entries may never implicitly
  // remove remaining leaves, whether excluded or destination-only.
  for (const row of changes.filter((r) => r.after)) {
    const p = row.path;
    for (const existing of result.keys())
      if (
        existing !== p &&
        (existing.startsWith(p + "/") || p.startsWith(existing + "/"))
      )
        throw Error("PROTECTED_OR_IMPLICIT_TREE_REPLACEMENT:" + p);
    result.set(p, source.get(p));
  }
  for (const [p, row] of destination) {
    if (
      (protectedPath(p, excluded) || (preserveSql && /\.sql$/i.test(p))) &&
      !same(row, result.get(p))
    )
      throw Error("PROTECTED_TREE_NOT_PRESERVED:" + p);
    if (!changed.has(p) && !same(row, result.get(p)))
      throw Error("UNREVIEWED_DESTINATION_TREE_CHANGE:" + p);
  }
  const expected = hashTree(result, safePath);
  return {
    entries: result,
    summary: {
      version: 1,
      sourceSha256: sha(ordered(source)),
      destinationSha256: sha(ordered(destination)),
      projectedSha256: sha(ordered(result)),
      gitTreeSha: expected.gitTreeSha,
      protectedEntries: [...destination.keys()].filter(
        (p) => protectedPath(p, excluded) || /\.sql$/i.test(p),
      ).length,
    },
  };
}
function remote(response, expectedSha, safePath) {
  if (response?.truncated !== false || response.sha !== expectedSha)
    throw Error("INCOMPLETE_REMOTE_GIT_TREE");
  return parse(response.tree, safePath, expectedSha);
}
module.exports = { ordered, hashTree, parse, project, remote, protectedPath };
