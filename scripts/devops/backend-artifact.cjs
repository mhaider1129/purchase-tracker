#!/usr/bin/env node
"use strict";
// Package only committed, already-tested bytes. No installation or deployment.
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  { execFileSync } = require("node:child_process"),
  { tree } = require("./sync-plan.cjs");
const digest = (bytes) =>
  crypto.createHash("sha256").update(bytes).digest("hex");
function pack(repo, commit, out) {
  const prefix = "purchase-backend/",
    source = path.join(repo, prefix),
    relative = path.relative(source, out);
  if (!relative.startsWith(".." + path.sep) && !path.isAbsolute(relative))
    throw Error("ARTIFACT_OUTPUT_MUST_BE_OUTSIDE_APPLICATION");
  if (fs.existsSync(out)) throw Error("ARTIFACT_OUTPUT_ALREADY_EXISTS");
  const entries = tree(repo, commit, prefix),
    files = [];
  if (!entries.has("app.js") || !entries.has("package-lock.json"))
    throw Error("BACKEND_RELEASE_INCOMPLETE");
  // Validate all bytes before creating any payload; CRLF/worktree drift is fatal.
  const payload = [...entries]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([file, entry]) => {
      const p = path.join(source, file);
      if (fs.lstatSync(p).isSymbolicLink())
        throw Error("ARTIFACT_SOURCE_SYMLINK_REJECTED");
      const data = fs.readFileSync(p),
        blob = crypto
          .createHash("sha1")
          .update("blob " + data.length + "\0")
          .update(data)
          .digest("hex");
      if (blob !== entry.blob)
        throw Error("ARTIFACT_WORKTREE_DIFFERS_FROM_TESTED_COMMIT: " + file);
      files.push({
        path: file,
        sha256: digest(data),
        bytes: data.length,
        mode: entry.mode,
      });
      return { file, data, mode: entry.mode };
    });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.mkdirSync(out);
  for (const p of payload) {
    const target = path.join(out, p.file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, p.data, {
      flag: "wx",
      mode: parseInt(p.mode.slice(-3), 8),
    });
  }
  const manifest = {
    kind: "backend-source-release",
    version: 1,
    commit,
    files,
    payloadSha256: digest(JSON.stringify(files)),
    dependencies:
      "Locked package dependencies; runtime image/build acceptance remains a staging prerequisite",
    deploymentAuthorized: false,
  };
  fs.writeFileSync(
    path.join(out, "release-source-manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
    { flag: "wx" },
  );
  return manifest;
}
if (require.main === module) {
  try {
    const root = path.resolve(__dirname, "../.."),
      commit = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: root,
        encoding: "utf8",
      }).trim();
    const result = pack(
      root,
      commit,
      path.join(root, "release-artifacts/backend"),
    );
    console.log(
      JSON.stringify({
        kind: result.kind,
        commit,
        files: result.files.length,
        payloadSha256: result.payloadSha256,
      }),
    );
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
module.exports = { pack };
