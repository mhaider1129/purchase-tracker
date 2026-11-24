#!/usr/bin/env node
"use strict";
// Local committed Git objects only: no fetch, checkout, credentials, API or writes to repositories.
const fs = require("node:fs"),
  path = require("node:path"),
  { execFileSync } = require("node:child_process"),
  { plan } = require("./sync-plan.cjs");
const root = path.resolve(__dirname, "../..");
function head(cwd) {
  return execFileSync("git", ["rev-parse", "HEAD"], {
    cwd,
    encoding: "utf8",
  }).trim();
}
function args(argv) {
  const allowed = new Set([
      "source",
      "backend",
      "frontend",
      "source-sha",
      "backend-sha",
      "frontend-sha",
      "output",
    ]),
    result = {};
  for (let i = 0; i < argv.length; i++) {
    const name = argv[i].slice(2);
    if (
      !argv[i].startsWith("--") ||
      !allowed.has(name) ||
      result[name] !== undefined ||
      !argv[i + 1] ||
      argv[i + 1].startsWith("--")
    )
      throw Error("INVALID_OR_DUPLICATE_AUDIT_OPTION");
    result[name] = argv[++i];
  }
  return result;
}
function audit(options = {}) {
  const sourceRepo = fs.realpathSync(options.source || root),
    sourceSha = options["source-sha"] || head(sourceRepo),
    targets = {};
  for (const app of ["backend", "frontend"]) {
    const destinationRepo = fs.realpathSync(
      options[app] || path.join(sourceRepo, "sync-inputs", app),
    );
    if (sourceRepo === destinationRepo)
      throw Error("SEPARATE_DESTINATION_REQUIRED");
    targets[app] = plan({
      sourceRepo,
      destinationRepo,
      sourceSha,
      destinationSha: options[app + "-sha"] || head(destinationRepo),
      app,
    });
  }
  return {
    kind: "local-sync-audit",
    version: 1,
    sourceSha,
    remoteWrites: 0,
    approval: "NOT_GRANTED",
    publishingEnabled: false,
    workingTreeChanges: "NOT_READ_COMMITTED_GIT_OBJECTS_ONLY",
    targets,
  };
}
function within(parent, child) {
  const relative = path.relative(parent, child);
  return (
    relative === "" ||
    (!relative.startsWith(".." + path.sep) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
}
function writeReports(report, options = {}) {
  const source = fs.realpathSync(options.source || root),
    destination = path.resolve(
      options.output || path.join(source, "quality-results/sync"),
    );
  // Resolve the nearest existing ancestor before creating anything (including symlink aliases).
  let ancestor = destination;
  while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
  const canonical = path.resolve(
    fs.realpathSync(ancestor),
    path.relative(ancestor, destination),
  );
  const allowed = path.join(source, "quality-results/sync");
  const repositories = [
    source,
    ...["backend", "frontend"].map((app) =>
      fs.realpathSync(options[app] || path.join(source, "sync-inputs", app)),
    ),
  ];
  for (const repo of repositories)
    if (
      within(repo, canonical) &&
      !(repo === source && within(allowed, canonical))
    )
      throw Error(
        "OUTPUT_MUST_BE_OUTSIDE_REPOSITORIES_OR_IN_QUALITY_RESULTS_SYNC",
      );
  fs.mkdirSync(canonical, { recursive: true, mode: 0o700 });
  const files = {
    "audit.json": report,
    "backend-plan.json": report.targets.backend,
    "frontend-plan.json": report.targets.frontend,
  };
  // Never overwrite an earlier report, tracked source, or a symlink.
  for (const name of Object.keys(files))
    if (
      fs.existsSync(path.join(canonical, name)) ||
      (() => {
        try {
          fs.lstatSync(path.join(canonical, name));
          return true;
        } catch (e) {
          if (e.code === "ENOENT") return false;
          throw e;
        }
      })()
    )
      throw Error("REPORT_ALREADY_EXISTS_USE_NEW_OUTPUT_DIRECTORY");
  for (const [name, value] of Object.entries(files))
    fs.writeFileSync(
      path.join(canonical, name),
      JSON.stringify(value, null, 2) + "\n",
      { flag: "wx", mode: 0o600 },
    );
  return canonical;
}
if (require.main === module) {
  try {
    const options = args(process.argv.slice(2)),
      report = audit(options);
    writeReports(report, options);
    for (const [app, p] of Object.entries(report.targets))
      console.log(
        `${app}: ${p.status}, changes=${p.changeSet.length}, conflicts=${p.conflicts}, remote writes=0`,
      );
    console.log("REPORT_GENERATED_NOT_PUBLISHING_APPROVAL");
  } catch (e) {
    // Avoid printing local paths/remote URLs or Git stderr that could contain credentials.
    console.error(
      e.message.split("\n")[0].startsWith("Command failed")
        ? "LOCAL_GIT_AUDIT_FAILED"
        : e.code || e.message.split("\n")[0],
    );
    process.exitCode = 1;
  }
}
module.exports = { args, audit, writeReports, within };
