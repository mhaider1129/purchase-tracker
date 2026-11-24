#!/usr/bin/env node
"use strict";
// Offline Git-object analysis only. Does not fetch, checkout, publish or approve.
const fs = require("node:fs"),
  path = require("node:path"),
  cp = require("node:child_process"),
  p = require("./sync-plan.cjs"),
  { digest } = require("./sync-publish.cjs");
const root = path.resolve(__dirname, "../..");
function build(sourceSha, options = {}) {
  const sourceRepo = options.sourceRepo || root;
  const result = {
    kind: "proposed-sync-bootstrap",
    version: 1,
    status: "BLOCKED",
    approval: "PENDING_SEPARATE_REVIEW",
    sourceRepository: "mhaider1129/purchase-tracker",
    sourceSha,
    remoteWrites: 0,
    migrationExecution: "NOT_PERFORMED",
    targets: {},
  };
  for (const app of ["backend", "frontend"]) {
    const destinationRepo =
        options.destinations?.[app]?.path ||
        path.join(root, "sync-inputs", app),
      ref = (ref) =>
        cp
          .execFileSync("git", ["rev-parse", ref], {
            cwd: destinationRepo,
            encoding: "utf8",
          })
          .trim();
    const plan = p.plan({
      sourceRepo,
      destinationRepo,
      sourceSha,
      destinationSha: options.destinations?.[app]?.sha || ref("origin/main"),
      app,
    });
    const src = p.tree(sourceRepo, sourceSha, `purchase-${app}/`),
      dest = p.tree(destinationRepo, plan.destinationSha);
    const sql = [...dest]
      .filter(([name]) => /\.sql$/i.test(name))
      .map(([name, row]) => ({
        path: name,
        destinationBlob: row.blob,
        sourceBlob: src.get(name)?.blob || null,
        unchanged: src.get(name)?.blob === row.blob,
      }));
    result.targets[app] = {
      repository: `mhaider1129/purchase-${app}`,
      plan,
      sourceTreeSha256: digest([...src.entries()]),
      destinationTreeSha256: digest([...dest.entries()]),
      sourceFullTreeSha256: digest([
        ...p.fullTree(sourceRepo, sourceSha, `purchase-${app}/`).entries(),
      ]),
      destinationFullTreeSha256: digest([
        ...p.fullTree(destinationRepo, plan.destinationSha).entries(),
      ]),
      requiredCheck:
        app === "backend"
          ? "Backend synchronization gate"
          : "Frontend synchronization gate",
      changeSetSha256: digest({
        destinationSha: plan.destinationSha,
        changeSet: plan.changeSet,
      }),
      decisions: plan.changeSet.map((c) => ({
        path: c.path,
        before: c.before,
        after: c.after,
        decision: "REQUIRES_CONTENT_REVIEW",
        plannerMarker: c.conflict,
        approved: false,
      })),
      historicalSql: sql,
    };
    if (app === "backend")
      result.targets[app].independentBranches = [
        "recovery/wici-database-20261107",
        "codex/pg17-release-diagnostics",
      ].map((branch) => {
        const sha = ref((options.branchPrefix ?? "origin/") + branch);
        return {
          branch,
          sha,
          preservationRequired: true,
          comparison: p.plan({
            sourceRepo,
            destinationRepo,
            sourceSha,
            destinationSha: sha,
            app,
          }),
        };
      });
  }
  return { ...result, proposalSha256: digest(result) };
}
if (require.main === module) {
  const sha = process.argv[2];
  console.log(JSON.stringify(build(sha), null, 2));
}
module.exports = { build };
