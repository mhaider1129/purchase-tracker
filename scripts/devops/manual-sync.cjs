#!/usr/bin/env node
"use strict";
// Owner-invoked Git synchronization only. No deploy hook, force-push, database or server access.
const { execFileSync, spawnSync } = require("node:child_process");
function git(root, ...args) {
  return execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 16 * 1024 * 1024,
  }).trim();
}
function plan(
  root,
  repositories = {
    backend: "https://github.com/mhaider1129/purchase-backend.git",
    frontend: "https://github.com/mhaider1129/purchase-frontend.git",
  },
) {
  if (git(root, "status", "--porcelain"))
    throw Error("CLEAN_COMBINED_CHECKOUT_REQUIRED");
  if (git(root, "branch", "--show-current") !== "master")
    throw Error("MERGED_MASTER_REQUIRED");
  git(root, "fetch", "origin", "master");
  const source = git(root, "rev-parse", "FETCH_HEAD");
  if (git(root, "rev-parse", "HEAD") !== source)
    throw Error("PULL_LATEST_MASTER_FIRST");
  const components = [];
  for (const [name, repository] of Object.entries(repositories)) {
    if (!["backend", "frontend"].includes(name))
      throw Error("UNKNOWN_COMPONENT");
    git(root, "fetch", "--no-tags", repository, "main");
    const destination = git(root, "rev-parse", "FETCH_HEAD");
    const exported = git(
      root,
      "subtree",
      "split",
      "--quiet",
      "--prefix=purchase-" + name,
      source,
    );
    if (!/^[a-f0-9]{40}$/.test(exported))
      throw Error("IMMUTABLE_EXPORT_REQUIRED");
    const fastForward = spawnSync("git", [
      "-C",
      root,
      "merge-base",
      "--is-ancestor",
      destination,
      exported,
    ]);
    if (![0, 1].includes(fastForward.status))
      throw Error("ANCESTRY_CHECK_FAILED");
    components.push({
      name,
      repository,
      destination,
      exported,
      status:
        destination === exported
          ? "NO_CHANGES"
          : fastForward.status === 0
            ? "FAST_FORWARD"
            : "BLOCKED_DESTINATION_DIVERGENCE",
    });
  }
  return {
    source,
    components,
    publishingAuthorized: false,
    ready: components.every(
      (c) => c.status !== "BLOCKED_DESTINATION_DIVERGENCE",
    ),
  };
}
function publish(
  root,
  p,
  push = (repository, ref) => git(root, "push", repository, ref),
) {
  if (!p.ready) throw Error("RECONCILE_DESTINATION_CHANGES_BEFORE_PUBLISHING");
  if (
    git(root, "status", "--porcelain") ||
    git(root, "rev-parse", "HEAD") !== p.source
  )
    throw Error("SOURCE_CHANGED_AFTER_PLAN");
  const completed = [];
  for (const c of p.components) {
    if (c.status === "NO_CHANGES") continue;
    git(root, "fetch", "--no-tags", c.repository, "main");
    if (git(root, "rev-parse", "FETCH_HEAD") !== c.destination)
      throw Error(
        "DESTINATION_CHANGED_REPLAN_REQUIRED; published=" + completed.join(","),
      );
    try {
      push(c.repository, c.exported + ":refs/heads/main");
      completed.push(c.name);
    } catch {
      throw Error(
        "PUBLISH_FAILED_OR_ACKNOWLEDGMENT_UNCERTAIN; replan both repositories; earlier published=" +
          completed.join(","),
      );
    }
  }
  return { source: p.source, published: completed, deployed: false };
}
if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    if (
      args.length > 1 ||
      args.some((a) => !["--publish", "--plan"].includes(a))
    )
      throw Error("Use --plan (default) or --publish");
    const root = git(process.cwd(), "rev-parse", "--show-toplevel");
    if (
      !/^(?:https:\/\/github\.com\/|git@github\.com:)mhaider1129\/purchase-tracker(?:\.git)?$/.test(
        git(root, "remote", "get-url", "origin"),
      )
    )
      throw Error("AUTHORITATIVE_COMBINED_ORIGIN_REQUIRED");
    const p = plan(root);
    p.publishingAuthorized = args[0] === "--publish";
    console.log(JSON.stringify(p, null, 2));
    if (args[0] === "--publish")
      console.log(JSON.stringify(publish(root, p), null, 2));
    else if (!p.ready) process.exitCode = 1;
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
module.exports = { plan, publish };
