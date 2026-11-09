"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  { execFileSync } = require("node:child_process");
const integrity = require("./integrity.cjs"),
  sync = require("./sync-plan.cjs"),
  security = require("./security.cjs"),
  release = require("./release-plan.cjs");
const row = (s) => ({ blob: s.repeat(40), mode: "100644" }),
  map = (rows) => new Map(rows);
function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scop-sync-test-"));
  const git = (...a) =>
    execFileSync("git", a, {
      cwd: dir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  git("init", "--quiet");
  git("config", "user.email", "synthetic@example.invalid");
  git("config", "user.name", "Synthetic fixture");
  git("config", "core.autocrlf", "false");
  return {
    dir,
    git,
    write: (p, c) => {
      fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true });
      fs.writeFileSync(path.join(dir, p), c);
    },
    commit: () => {
      git("add", ".");
      git("commit", "--quiet", "-m", "synthetic fixture");
      return git("rev-parse", "HEAD");
    },
    close: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}
test("CRLF is diagnosed from exact bytes and never accepted as matching", () => {
  const lf = Buffer.from("one\ntwo\n"),
    crlf = Buffer.from("one\r\ntwo\r\n");
  assert.equal(integrity.diagnose(lf, integrity.sha(lf)), "MATCH");
  assert.equal(
    integrity.diagnose(crlf, integrity.sha(lf)),
    "CRLF_CHECKOUT_CONFIRMED_STILL_BLOCKED",
  );
  assert.equal(
    integrity.diagnose(Buffer.from("changed"), integrity.sha(lf), lf),
    "WORKTREE_DIFFERS_FROM_LOCKED_GIT_BLOB",
  );
  assert.equal(
    integrity.diagnose(lf, integrity.sha(Buffer.from("stale"))),
    "CONTENT_OR_LOCK_DIVERGENCE_REQUIRES_REVIEW",
  );
});
for (const p of [
  ".env",
  ".env.production",
  ".env.example",
  "node_modules/a.js",
  "uploads/x",
  "private-uploads/x",
  "logs/a.log",
  ".github/workflows/release.yml",
  "cache/x",
  "secrets.pem",
])
  test("export excludes protected/local path " + p, () =>
    assert(sync.excluded(p)),
  );
for (const p of [
  "../x",
  "/tmp/x",
  "C:/unsafe",
  "sql\\manual\\073.sql",
  "x/../y",
  "x\ny",
])
  test("reject unsafe export identity " + JSON.stringify(p), () =>
    assert.throws(() => sync.safePath(p)),
  );
test("initial differences require reconciliation; unknown destination files cannot be silently removed", () => {
  const c = sync.changes(
    map([
      ["app.js", row("a")],
      ["new.js", row("c")],
    ]),
    map([
      ["app.js", row("b")],
      ["independent.js", row("d")],
    ]),
  );
  assert.equal(
    c.find((r) => r.path === "app.js").conflict,
    "INITIAL_DIFFERENCE_REQUIRES_REVIEW",
  );
  assert.equal(c.find((r) => r.path === "new.js").action, "add");
  assert.equal(
    c.find((r) => r.path === "independent.js").conflict,
    "UNMANAGED_DESTINATION_FILE",
  );
  assert.equal(
    c.find((r) => r.path === "independent.js").deletionRequiresExplicitReview,
    true,
  );
});
test("incremental source deletion is explicit; independent destination edits conflict", () => {
  const old = map([
      ["delete.js", row("a")],
      ["app.js", row("a")],
    ]),
    c = sync.changes(
      map([["app.js", row("b")]]),
      map([
        ["delete.js", row("a")],
        ["app.js", row("c")],
      ]),
      old,
      old,
    );
  assert.equal(c.find((r) => r.path === "delete.js").action, "delete");
  assert.equal(c.find((r) => r.path === "delete.js").conflict, null);
  assert.equal(
    c.find((r) => r.path === "app.js").conflict,
    "DESTINATION_DIVERGED",
  );
});
test("divergent checkpoint contents cannot establish a trusted sync baseline", () =>
  assert.equal(
    sync.changes(
      map([["a", row("a")]]),
      map([["a", row("b")]]),
      map([["a", row("c")]]),
      map([["a", row("d")]]),
    )[0].conflict,
    "BASELINE_CONTENT_NOT_RECONCILED",
  ));
test("Git-object dry run is repeatable, preserves dirty work and excludes environment files", () => {
  const a = fixture(),
    b = fixture();
  try {
    a.write("purchase-backend/app.js", "approved\n");
    a.write("purchase-backend/.env", "synthetic=local\n");
    const sourceSha = a.commit();
    b.write("app.js", "independent\n");
    b.write(".env", "private local configuration\n");
    const destinationSha = b.commit();
    b.write("app.js", "uncommitted work\n");
    const before = b.git("status", "--porcelain"),
      o = {
        sourceRepo: a.dir,
        destinationRepo: b.dir,
        sourceSha,
        destinationSha,
        app: "backend",
      };
    const first = sync.plan(o),
      second = sync.plan(o);
    assert.deepEqual(first, second);
    assert.equal(first.writesPerformed, false);
    assert.equal(first.changeSet.length, 1);
    assert.equal(first.conflicts, 1);
    assert.equal(
      fs.readFileSync(path.join(b.dir, "app.js"), "utf8"),
      "uncommitted work\n",
    );
    assert.equal(
      fs.readFileSync(path.join(b.dir, ".env"), "utf8"),
      "private local configuration\n",
    );
    assert.equal(b.git("status", "--porcelain"), before);
    assert.equal(b.git("rev-parse", "HEAD"), destinationSha);
  } finally {
    a.close();
    b.close();
  }
});
test("matching Git exports produce no changes and bind immutable source/destination commits", () => {
  const a = fixture(),
    b = fixture();
  try {
    a.write("purchase-frontend/app.js", "same\n");
    const sourceSha = a.commit();
    b.write("app.js", "same\n");
    const destinationSha = b.commit();
    const p = sync.plan({
      sourceRepo: a.dir,
      destinationRepo: b.dir,
      sourceSha,
      destinationSha,
      app: "frontend",
    });
    assert.equal(p.status, "NO_CHANGES");
    assert.equal(p.autoMergeEnabled, false);
    assert.equal(p.destinationCIRequired, true);
    assert.throws(
      () =>
        sync.plan({
          sourceRepo: a.dir,
          destinationRepo: b.dir,
          sourceSha: "main",
          destinationSha,
          app: "frontend",
        }),
      /IMMUTABLE/,
    );
  } finally {
    a.close();
    b.close();
  }
});
test("publisher and partial baseline options are unavailable", () => {
  assert.throws(() => sync.args(["--apply"]), /DRY_RUN_ONLY/);
  assert.throws(() => sync.args(["--dry-run", "--push", "yes"]), /UNKNOWN/);
  assert.throws(
    () => sync.plan({ app: "backend", previousSourceSha: "a".repeat(40) }),
    /BOTH_BASELINE/,
  );
});
test("credential checks identify private material without returning credential values", () => {
  const fake = ["ghp", "_", "x".repeat(36)].join("");
  const result = security.scan("key=" + fake);
  assert.equal(result[0].kind, "github-token");
  assert(!JSON.stringify(result).includes(fake));
  const uri = [
    "postgresql:",
    "//owner:",
    "not-a-real-key",
    "@db.example.org/app",
  ].join("");
  assert.equal(security.scan(uri)[0].kind, "database-credential");
  assert.deepEqual(
    security.scan("postgresql://fixture:fixture@127.0.0.1:1/test"),
    [],
  );
});
test("frontend configuration rejects private variables and noncanonical API targets", () => {
  assert.equal(
    security.frontendEnvironment({ REACT_APP_SERVICE_ROLE_KEY: "synthetic" })[0]
      .kind,
    "private-frontend-variable",
  );
  assert.equal(
    security.frontendEnvironment({
      REACT_APP_API_URL: "https://production.invalid/api",
    })[0].kind,
    "noncanonical-ci-api-target",
  );
  assert.deepEqual(
    security.frontendEnvironment({ REACT_APP_API_URL: "/api" }),
    [],
  );
});
test("release assertions cannot enable deployment or impersonate real approval authority", () => {
  assert.equal(release.review({}).status, "BLOCKED");
  const c = {
    commit: "a".repeat(40),
    artifactSha256: "b".repeat(64),
    ciPassed: true,
    disposableDatabaseTestsPassed: true,
    stagingSmokePassed: true,
    ownerUatAccepted: true,
    databaseCompatibilityApproved: true,
    backupRecoveryVerified: true,
    environmentReviewersVerified: true,
  };
  assert.equal(release.review(c).executionEnabled, false);
  assert.equal(release.review(c).productionDeploymentAuthorized, false);
});
test("deployment templates remain hard disabled and PR workflow contains no PostgreSQL execution", () => {
  const root = path.resolve(__dirname, "../..");
  for (const name of [
    "staging-release.yml",
    "production-release.yml",
    "production-database-release.yml",
  ]) {
    const content = fs.readFileSync(
      path.join(root, ".github/workflows", name),
      "utf8",
    );
    assert.match(content, /if: \$\{\{ false \}\}/);
    assert.doesNotMatch(content, /\b(?:ssh|rsync|pm2|psql)\b/);
  }
  const ci = fs.readFileSync(
    path.join(root, ".github/workflows/release-quality.yml"),
    "utf8",
  );
  assert.doesNotMatch(ci, /group postgres|gate.*matrix.gate|^  postgres:/m);
  assert.doesNotMatch(ci, /secrets\.|pull_request_target|id-token: write/);
  assert.equal(
    require("../quality/gates.json").gates.filter((g) => g.group === "postgres")
      .length,
    16,
  );
});

test("case-only cross-tree collisions cannot become a portable export plan", () => {
  assert.throws(
    () =>
      sync.changes(map([["App.js", row("a")]]), map([["app.js", row("b")]])),
    /CASE_COLLISION/,
  );
});
test("unreviewed symbolic-link Git modes cannot enter a synchronization plan", () => {
  const a = fixture();
  try {
    a.write("purchase-backend/link", "not a filesystem symlink\n");
    const first = a.commit();
    const blob = a.git("rev-parse", first + ":purchase-backend/link");
    a.git(
      "update-index",
      "--cacheinfo",
      "120000," + blob + ",purchase-backend/link",
    );
    a.git("commit", "--quiet", "-m", "synthetic link mode");
    assert.throws(
      () => sync.tree(a.dir, a.git("rev-parse", "HEAD"), "purchase-backend/"),
      /SYMLINK/,
    );
  } finally {
    a.close();
  }
});
test("ordinary workflow changes cannot introduce a hidden constant-false check", () => {
  const dir = path.resolve(__dirname, "../../.github/workflows");
  const allowed = new Set([
    "repository-sync.yml", // Only its separately authorized publisher is disabled.
    "production-release.yml",
    "production-database-release.yml",
    "staging-release.yml",
  ]);
  for (const f of fs.readdirSync(dir)) {
    const text = fs.readFileSync(path.join(dir, f), "utf8");
    if (/if: \$\{\{ false \}\}/.test(text)) assert(allowed.has(f));
  }
});
test("code-only evidence rejects missing/skipped jobs and never grants production authority", () => {
  const collect = require("./code-evidence.cjs").evidence;
  const report = collect({ backend: { result: "skipped" } });
  assert.equal(report.status, "BLOCKED");
  assert.equal(report.productionDeploymentAuthorized, false);
  assert(report.failures.some((f) => f.startsWith("backend:")));
});

test("reviewed synthetic-source exceptions expire on any byte edit and do not suppress private keys", () => {
  const file = "purchase-backend/tests/p2pBaseline.test.js";
  const bytes = fs.readFileSync(path.resolve(__dirname, "../..", file));
  assert.equal(
    security.reviewedFixture(file, bytes, "database-credential"),
    true,
  );
  assert.equal(
    security.reviewedFixture(
      file,
      Buffer.concat([bytes, Buffer.from("changed")]),
      "database-credential",
    ),
    false,
  );
  assert.equal(security.reviewedFixture(file, bytes, "private-key"), false);
  assert.equal(
    security.reviewedFixture("another-file.js", bytes, "database-credential"),
    false,
  );
});

test("every isolated database job binds immutable checkout before fixtures and uploads attempt-bound provenance", () => {
  const workflow = fs.readFileSync(
    path.resolve(
      __dirname,
      "../../.github/workflows/isolated-database-validation.yml",
    ),
    "utf8",
  );
  assert(workflow.includes("ref: ${{ github.sha }}"));
  assert(!workflow.includes("ref: ${{ inputs.commit_sha }}"));
  assert(
    workflow.indexOf("db-provenance.cjs check") <
      workflow.indexOf("node scripts/quality/release.cjs gate"),
  );
  assert(
    workflow.includes(
      "db-provenance-${{ matrix.gate }}-attempt-${{ github.run_attempt }}",
    ),
  );
  assert.equal(require("./db-provenance.cjs").gates.length, 16);
});
