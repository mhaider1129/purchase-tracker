"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os");
const q = require("./release.cjs");
const context = {
  gitCommit: "a".repeat(40),
  sourceDigest: "b".repeat(64),
  gateConfigDigest: "c".repeat(64),
  dirty: false,
};
const evaluate = (reports, current, needs = null) =>
  q.evaluate(reports, current, needs, {});
const evidence = () =>
  q.config.gates.map((g) => ({
    kind: "quality-gate",
    version: 1,
    id: g.id,
    ...context,
    nodeVersion: "v22.0.0",
    command: g.command || [g.kind],
    liveRoutingEnabled: false,
    status: "passed",
    exitCode: 0,
    signal: null,
    results: { passed: 1 },
    log: { path: g.id + ".log", sha256: "d".repeat(64) },
    startedAt: "2026-11-06T00:00:00Z",
    finishedAt: "2026-11-06T00:01:00Z",
  }));
test("complete bound evidence establishes test readiness, never deployment authorization", () =>
  assert.deepEqual(evaluate(evidence(), context), []));
for (const state of ["failed", "cancelled", "skipped"])
  test("required job " + state + " blocks release", () =>
    assert.ok(
      evaluate(evidence(), context, {
        backend: { result: state },
        frontend: { result: "success" },
        postgres: { result: "success" },
      }).length,
    ),
  );
for (const change of [
  (r) => r.pop(),
  (r) => r.push(r[0]),
  (r) => (r[0].status = "failed"),
  (r) => (r[0].exitCode = 1),
  (r) => (r[0].signal = "SIGTERM"),
  (r) => (r[0].gitCommit = "f".repeat(40)),
  (r) => (r[0].sourceDigest = "e".repeat(64)),
  (r) => (r[0].liveRoutingEnabled = true),
  (r) => (r[0].dirty = true),
  (r) => (r[0].results = null),
  (r) => (r[0].nodeVersion = "v24.0.0"),
  (r) => (r[0].command = ["npm", "test", "--", "--passWithNoTests"]),
  (r) => (r[0].finishedAt = null),
])
  test(
    "mutated/incomplete gate evidence fails closed " + String(change),
    () => {
      const reports = evidence();
      change(reports);
      assert.ok(evaluate(reports, context).length);
    },
  );
test("a dirty candidate cannot be declared release ready", () =>
  assert.ok(evaluate(evidence(), { ...context, dirty: true }).length));
test("child environments cannot inherit hosted database or notification credentials", () => {
  const keys = [
    "DATABASE_URL",
    "DB_RELEASE_READONLY_URL",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "PGHOST",
    "PGPASSWORD",
    "EMAIL_HOST",
    "EMAIL_PASS",
  ];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  try {
    for (const key of keys) process.env[key] = "sensitive-do-not-forward";
    const env = q.environment("/tmp/quality");
    assert.match(env.DATABASE_URL, /127\.0\.0\.1:1/);
    for (const key of keys.filter((k) => k !== "DATABASE_URL"))
      assert.equal(env[key], undefined);
    assert.equal(env.EMAIL_DRY_RUN, "true");
    for (const key of [
      "REACT_APP_API_URL",
      "REACT_APP_API_BASE_URL",
      "REACT_APP_API_BASE",
    ])
      assert.equal(env[key], "/api");
    assert.equal(env.LIVE_ROUTING_ENABLED, "false");
  } finally {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
});
test("empty, failed or skipped Jest result cannot pass through a zero exit", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "quality-test-"));
  const gate = { id: "unit", kind: "jest" };
  try {
    for (const data of [
      { success: true, numPassedTests: 0 },
      { success: true, numPassedTests: 2, numFailedTests: 1 },
      { success: true, numPassedTests: 2, numPendingTests: 1 },
    ]) {
      fs.writeFileSync(path.join(dir, "unit.jest.json"), JSON.stringify(data));
      assert.throws(() => q.validateResult(gate, { exitCode: 0 }, "", dir));
    }
    assert.throws(() =>
      q.validateResult(
        { markers: ["finished"] },
        { exitCode: 0 },
        "started",
        dir,
      ),
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("locale key, placeholder and required plural drift blocks parity", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "quality-locale-"));
  try {
    for (const family of ["", "interface."])
      for (const lang of ["en", "ar"])
        fs.writeFileSync(
          path.join(dir, family + lang + ".json"),
          JSON.stringify({ x: "Hello {{name}}" }),
        );
    assert.equal(q.localization(dir).status, "passed");
    fs.writeFileSync(
      path.join(dir, "ar.json"),
      JSON.stringify({ x: "Hello {{other}}" }),
    );
    assert.throws(() => q.localization(dir), /Interpolation/);
    fs.writeFileSync(path.join(dir, "ar.json"), JSON.stringify({ y: "hello" }));
    assert.throws(() => q.localization(dir), /parity/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("build files are byte-bound and symlinks are rejected", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "quality-build-"));
  try {
    fs.writeFileSync(path.join(dir, "index.html"), "old");
    const before = q.tree(dir);
    fs.writeFileSync(path.join(dir, "index.html"), "new");
    assert.notDeepEqual(q.tree(dir), before);
    fs.symlinkSync("/etc/passwd", path.join(dir, "link"));
    assert.throws(() => q.tree(dir), /symlink/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("workflow requires every gate, strict frontend checks, isolated databases and an always-running aggregator", () => {
  const root = path.resolve(__dirname, "../..");
  const yaml = require(
    require.resolve("js-yaml", {
      paths: [path.join(root, "purchase-backend")],
    }),
  );
  const file = fs.readFileSync(
      path.join(root, ".github/workflows/release-quality.yml"),
      "utf8",
    ),
    workflow = yaml.load(file);
  assert.ok(
    workflow.on.pull_request === null || workflow.on.pull_request !== undefined,
  );
  assert.equal(workflow.on.pull_request?.paths, undefined);
  assert.equal(workflow.on.pull_request_target, undefined);
  assert.deepEqual(workflow.permissions, { contents: "read" });
  assert.equal(workflow.env.LIVE_ROUTING_ENABLED, "false");
  assert.deepEqual(
    workflow.jobs.postgres.strategy.matrix.gate.slice().sort(),
    q.config.gates
      .filter((g) => g.group === "postgres")
      .map((g) => g.id)
      .sort(),
  );
  assert.equal(workflow.jobs.postgres.strategy["fail-fast"], false);
  const aggregate = workflow.jobs["release-quality-gate"];
  assert.equal(aggregate.if, "always()");
  assert.deepEqual(aggregate.needs, ["backend", "frontend", "postgres"]);
  assert.ok(
    aggregate.steps.some(
      (s) => s.run?.includes("manifest") && s.if === "always()",
    ),
  );
  assert.doesNotMatch(
    file,
    /continue-on-error|secrets\.|pull_request_target|environment:\s*production|ssh\s|scp\s|migrate:up/,
  );
  for (const job of Object.values(workflow.jobs))
    for (const step of job.steps)
      if (step.uses) assert.match(step.uses, /@[a-f0-9]{40}$/);
  assert.ok(
    q.config.gates
      .find((g) => g.id === "frontend-lint")
      .command.includes("--max-warnings=0"),
  );
  assert.equal(q.config.gates.filter((g) => g.kind === "jest").length, 2);
});

test("status parsing preserves leading porcelain status columns and rename paths", () => {
  assert.equal(q.parseStatus(" M purchase-frontend/src/x.jsx\0").length, 1);
  assert.equal(q.parseStatus("?? .agents/skills/local/file\0").length, 0);
  assert.ok(q.parseStatus("R  purchase-backend/new.js\0old.js\0").length);
});

test("all smoke domains are explicit and have required fixture gates with no automatic live mutation", () => {
  const plan = require("./smoke-plan.json");
  assert.equal(plan.checks.length, 16);
  assert.equal(plan.automaticLiveWrites, false);
  assert.equal(plan.liveChecksPerformedByCI, false);
  for (const check of plan.checks) {
    assert.ok(check.production);
    assert.ok(check.development);
    for (const id of check.ciGates)
      assert.ok(q.config.gates.some((g) => g.id === id));
  }
});
test("schema baseline gaps never become unresolved compatibility failures or hide failed plans", () => {
  const gate = { kind: "schema" },
    status = { exitCode: 0 };
  assert.equal(
    q.validateResult(
      gate,
      status,
      JSON.stringify({
        plansPassed: 2,
        plansFailed: 0,
        baselineMissingRelations: 100,
        postflightFindings: 0,
      }),
      "/tmp",
    ).plansPassed,
    2,
  );
  for (const result of [
    { plansPassed: 2, plansFailed: 1, postflightFindings: 0 },
    { plansPassed: 2, plansFailed: 0, postflightFindings: 1 },
  ])
    assert.throws(() =>
      q.validateResult(gate, status, JSON.stringify(result), "/tmp"),
    );
});
test("missing evidence creates an explicit blocked manifest, never a deploy authorization", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "quality-absent-"));
  try {
    const result = q.manifest(dir, path.join(dir, "missing-build"), null);
    assert.equal(result.status, "BLOCKED");
    assert.equal(
      result.operationalAcceptance.productionDeploymentAuthorized,
      false,
    );
    assert.equal(result.database.hostedCompatibility, "NOT_VERIFIED");
    assert.ok(result.failures.length);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("CI cannot omit required job results or substitute a different checkout", () => {
  const needs = Object.fromEntries(
    ["backend", "frontend", "postgres"].map((id) => [
      id,
      { result: "success" },
    ]),
  );
  assert.deepEqual(
    q.evaluate(evidence(), context, needs, {
      actions: true,
      sha: context.gitCommit,
    }),
    [],
  );
  assert.ok(
    q.evaluate(evidence(), context, null, {
      actions: true,
      sha: context.gitCommit,
    }).length,
  );
  assert.ok(
    q.evaluate(evidence(), context, needs, {
      actions: true,
      sha: "f".repeat(40),
    }).length,
  );
});

test("frozen and already-approved forward migrations cannot be modified or deleted", () => {
  const contents = Buffer.from("original SQL");
  const digest = require("node:crypto")
    .createHash("sha256")
    .update(contents)
    .digest("hex");
  const artifacts = [
    {
      path: "sql/manual/071_test.sql",
      classification: "active_forward_migration",
      sha256: digest,
    },
  ];
  assert.equal(
    q.compareHistory(artifacts, () => contents),
    1,
  );
  assert.throws(
    () => q.compareHistory(artifacts, () => Buffer.from("edited SQL")),
    /modified/,
  );
  assert.throws(
    () =>
      q.compareHistory(artifacts, () => {
        throw Error("missing");
      }),
    /deleted/,
  );
});
