#!/usr/bin/env node
"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  { execFileSync } = require("node:child_process"),
  { plan } = require("./sync-plan.cjs");
const root = path.resolve(__dirname, "../..");
const head = (cwd) =>
  execFileSync("git", ["rev-parse", "HEAD"], { cwd, encoding: "utf8" }).trim();
const out = path.join(root, "quality-results/sync");
try {
  fs.mkdirSync(out, { recursive: true });
  for (const app of ["backend", "frontend"]) {
    const dest = path.join(root, "sync-inputs", app);
    const p = plan({
      sourceRepo: root,
      destinationRepo: dest,
      sourceSha: head(root),
      destinationSha: head(dest),
      app,
    });
    fs.writeFileSync(
      path.join(out, app + "-plan.json"),
      JSON.stringify(p, null, 2) + "\n",
    );
    console.log(
      app +
        ": " +
        p.status +
        ", changes=" +
        p.changeSet.length +
        ", conflicts=" +
        p.conflicts +
        ", remote writes=0",
    );
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
