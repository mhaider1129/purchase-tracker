"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  cp = require("node:child_process"),
  { args, audit, writeReports } = require("./sync-audit.cjs"),
  { build } = require("./sync-bootstrap.cjs");
const git = (cwd, ...argv) =>
  cp
    .execFileSync("git", argv, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
    .trim();
function fixture(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "scop sibling paths "));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const options = { output: path.join(base, "reports with spaces") };
  for (const name of ["source", "backend", "frontend"]) {
    const dir = (options[name] = path.join(base, "purchase " + name));
    fs.mkdirSync(dir);
    git(dir, "init", "-q");
    git(dir, "config", "user.name", "Synthetic Test");
    git(dir, "config", "user.email", "synthetic@example.invalid");
    for (const app of name === "source" ? ["backend", "frontend"] : [name]) {
      const folder =
        name === "source" ? path.join(dir, "purchase-" + app) : dir;
      fs.mkdirSync(folder, { recursive: true });
      fs.writeFileSync(path.join(folder, "app.txt"), app);
    }
    git(dir, "add", ".");
    git(dir, "commit", "-qm", "synthetic");
    options[name + "-sha"] = git(dir, "rev-parse", "HEAD");
  }
  for (const ref of [
    "recovery/wici-database-20261107",
    "codex/pg17-release-diagnostics",
  ])
    git(options.backend, "branch", ref);
  return options;
}
test("CLI preserves native Windows/POSIX paths and rejects duplicate or unknown options", () => {
  for (const source of [
    "D:\\WICI-Projects\\purchase-tracker",
    "/tmp/project with spaces",
  ])
    assert.equal(args(["--source", source]).source, source);
  for (const argv of [
    ["--source"],
    ["--activate", "yes"],
    ["--source", "a", "--source", "b"],
  ])
    assert.throws(() => args(argv));
});
test("sibling audit reads committed objects, writes JSON directly and never mutates refs or copies .env", (t) => {
  const o = fixture(t),
    before = git(o.backend, "show-ref");
  fs.writeFileSync(path.join(o.backend, ".env"), "SYNTHETIC_NOT_A_SECRET");
  fs.writeFileSync(
    path.join(o.source, "purchase-backend/app.txt"),
    "uncommitted not read",
  );
  const result = audit(o);
  assert.equal(result.targets.backend.changeSet.length, 0);
  assert.equal(result.targets.frontend.changeSet.length, 0);
  writeReports(result, o);
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(o.output, "audit.json"))),
    result,
  );
  assert.equal(git(o.backend, "show-ref"), before);
  assert.equal(result.remoteWrites, 0);
  assert.throws(() => writeReports(result, o), /REPORT_ALREADY_EXISTS/);
  assert.equal(
    fs.readFileSync(path.join(o.backend, ".env"), "utf8"),
    "SYNTHETIC_NOT_A_SECRET",
  );
});
test("invalid commit and output paths fail closed without replacing source", (t) => {
  const o = fixture(t),
    result = audit(o);
  assert.throws(
    () => audit({ ...o, "source-sha": "master" }),
    /FULL_IMMUTABLE/,
  );
  for (const output of [
    o.source,
    path.join(o.backend, "reports"),
    path.join(o.source, ".git/reports"),
  ])
    assert.throws(() => writeReports(result, { ...o, output }), /OUTPUT_MUST/);
  assert.equal(git(o.source, "status", "--porcelain"), "");
});
test("bootstrap binds both complete trees and every decision without granting approval", (t) => {
  const o = fixture(t);
  fs.writeFileSync(path.join(o.backend, "destination-only.txt"), "preserve");
  git(o.backend, "add", ".");
  git(o.backend, "commit", "-qm", "independent");
  const proposal = build(o["source-sha"], {
    sourceRepo: o.source,
    branchPrefix: "",
    destinations: {
      backend: { path: o.backend, sha: git(o.backend, "rev-parse", "HEAD") },
      frontend: { path: o.frontend, sha: o["frontend-sha"] },
    },
  });
  assert.equal(proposal.status, "BLOCKED");
  assert.equal(proposal.approval, "PENDING_SEPARATE_REVIEW");
  const target = proposal.targets.backend;
  assert.equal(target.decisions.length, target.plan.changeSet.length);
  assert.ok(target.decisions.every((d) => !d.approved));
  assert.equal(target.independentBranches.length, 2);
  assert.match(target.sourceTreeSha256, /^[a-f0-9]{64}$/);
  assert.match(target.destinationFullTreeSha256, /^[a-f0-9]{64}$/);
  assert.notEqual(target.sourceTreeSha256, target.destinationTreeSha256);
  assert.equal(target.plan.changeSet[0].conflict, "UNMANAGED_DESTINATION_FILE");
});
test("actual CLI output works with sibling paths containing spaces", (t) => {
  const o = fixture(t),
    argv = Object.entries(o).flatMap(([name, value]) => ["--" + name, value]);
  const text = cp.execFileSync(
    process.execPath,
    [path.join(__dirname, "sync-audit.cjs"), ...argv],
    { encoding: "utf8" },
  );
  assert.match(text, /REPORT_GENERATED_NOT_PUBLISHING_APPROVAL/);
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(o.output, "backend-plan.json")))
      .changeSet.length,
    0,
  );
});
