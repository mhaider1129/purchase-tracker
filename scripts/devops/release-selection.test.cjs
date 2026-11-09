"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  { execFileSync } = require("node:child_process");
const p = require("./verify-production-selection.cjs"),
  { pack } = require("./backend-artifact.cjs");
function fixture() {
  const commit = "a".repeat(40),
    run = (id, file, event) => ({
      id,
      run_attempt: 1,
      head_sha: commit,
      head_branch: "master",
      repository: { full_name: p.repo },
      head_repository: { full_name: p.repo },
      path: `.github/workflows/${file}`,
      event,
      status: "completed",
      conclusion: "success",
    });
  const ci = run(101, "release-quality.yml", "push"),
    stage = run(201, "staging-release.yml", "workflow_dispatch"),
    db = run(401, "isolated-database-validation.yml", "workflow_dispatch");
  const jobs = (names) =>
    names.map((name) => ({ name, status: "completed", conclusion: "success" }));
  const artifacts = [
    {
      id: 501,
      name: "backend-release-attempt-1",
      digest: "sha256:" + "b".repeat(64),
      expired: false,
      workflow_run: { id: 101, head_sha: commit },
    },
    {
      id: 502,
      name: "frontend-build-attempt-1",
      digest: "sha256:" + "c".repeat(64),
      expired: false,
      workflow_run: { id: 101, head_sha: commit },
    },
  ];
  artifacts.push({
    id: 503,
    name: "code-ci-manifest-attempt-1",
    digest: "sha256:" + "e".repeat(64),
    expired: false,
    workflow_run: { id: 101, head_sha: commit },
  });
  const reports = {
    503: {
      kind: "scop-code-ci",
      version: 1,
      status: "CODE_TEST_READY",
      gitCommit: commit,
      ciRunId: "101",
      ciRunAttempt: "1",
      dirty: false,
      liveRoutingEnabled: false,
      failures: [],
      artifacts: { backend: "501", frontend: "502" },
      sourceDigest: "f".repeat(64),
      gateConfigDigest: "a".repeat(64),
    },
  };
  const dbArtifacts = require("./db-provenance.cjs").gates.map(
    (gate, index) => {
      const id = 601 + index;
      const profile = require("../quality/gates.json").gates.find(
        (g) => g.id === gate,
      );
      reports[id] = require("./db-provenance.cjs").receipt(
        {
          SELECTED_COMMIT: commit,
          GITHUB_SHA: commit,
          GITHUB_REPOSITORY: p.repo,
          GITHUB_RUN_ID: "401",
          GITHUB_RUN_ATTEMPT: "1",
        },
        commit,
        gate,
        {
          id: gate,
          kind: "quality-gate",
          version: 1,
          nodeVersion: "v22.0.0",
          command: profile.command,
          signal: null,
          status: "passed",
          gitCommit: commit,
          dirty: false,
          liveRoutingEnabled: false,
          sourceDigest: "f".repeat(64),
          gateConfigDigest: "a".repeat(64),
          exitCode: 0,
          log: { sha256: "b".repeat(64) },
          results:
            gate === "schema"
              ? { plansPassed: 1, plansFailed: 0, postflightFindings: 0 }
              : gate === "p2p"
                ? { passed: 1, failed: 0, skipped: 0 }
                : {
                    completionMarkers: profile.markers || [],
                    scenarioCounts: [1],
                  },
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
        },
      );
      return {
        id,
        name: `db-provenance-${gate}-attempt-1`,
        digest: "sha256:" + "d".repeat(64),
        expired: false,
        workflow_run: { id: 401, head_sha: commit },
      };
    },
  );
  const readArtifact = async (a) => structuredClone(reports[a.id]);
  const env = {
    protection_rules: [
      {
        type: "required_reviewers",
        prevent_self_review: true,
        reviewers: [
          { type: "User", reviewer: { login: "synthetic-reviewer" } },
        ],
      },
    ],
    deployment_branch_policy: { protected_branches: true },
  };
  const deployment = {
    id: 301,
    environment: "scop-staging",
    production_environment: false,
    sha: commit,
    creator: { login: "github-actions[bot]" },
    payload: {
      commit_sha: commit,
      source_ci_run_id: 101,
      staging_run_id: 201,
      backend_artifact_id: 501,
      backend_artifact_digest: artifacts[0].digest,
      frontend_artifact_id: 502,
      frontend_artifact_digest: artifacts[1].digest,
      database_validation_run_id: 401,
    },
  };
  const statuses = [
    {
      state: "success",
      creator: { login: "github-actions[bot]" },
      log_url: `https://github.com/${p.repo}/actions/runs/201`,
    },
  ];
  const routes = {
    "/actions/runs/101": ci,
    "/actions/runs/201": stage,
    "/actions/runs/401": db,
    "/actions/runs/401/artifacts?per_page=100": dbArtifacts,
    "/actions/runs/101/jobs?filter=latest&per_page=100": jobs(p.requiredCi),
    "/actions/runs/101/artifacts?per_page=100": artifacts,
    "/actions/runs/201/jobs?filter=latest&per_page=100": jobs(p.requiredStage),
    "/branches/master": { protected: true },
    "/environments/scop-production": env,
    "/environments/scop-staging-acceptance": env,
    [`/deployments?sha=${commit}&environment=scop-staging&per_page=100`]: [
      deployment,
    ],
    "/deployments/301/statuses?per_page=100": statuses,
    "/actions/runs/401/jobs?filter=latest&per_page=100": jobs(
      require("../quality/gates.json")
        .gates.filter((g) => g.group === "postgres")
        .map((g) => `postgres (${g.id})`),
    ),
  };
  return {
    reports,
    dbArtifacts,
    readArtifact,
    ci,
    stage,
    db,
    jobs,
    artifacts,
    env,
    deployment,
    statuses,
    routes,
    api: async (route) => {
      assert(route.startsWith("/"));
      assert(route in routes, "unexpected metadata route");
      return routes[route];
    },
  };
}
test("genuine same-commit CI, stage, DB and policy metadata selects immutable artifacts, never execution", async () => {
  const f = fixture(),
    r = await p.collect(f.api, "101", "201", f.readArtifact);
  assert.equal(r.commit, f.ci.head_sha);
  assert.equal(r.backend.id, 501);
  assert.equal(r.frontend.id, 502);
  assert.equal(r.databaseValidationRunId, 401);
  assert.equal(r.executionEnabled, false);
  assert.equal(r.productionDeploymentAuthorized, false);
  assert.equal(r.status, "AWAITING_PRODUCTION_ENVIRONMENT_APPROVAL");
});
for (const [label, mutate] of [
  ["PR run", (f) => (f.ci.event = "pull_request")],
  [
    "foreign repository",
    (f) => (f.ci.head_repository.full_name = "other/repository"),
  ],
  [
    "unprotected development branch",
    (f) => (f.ci.head_branch = "codex/unverified"),
  ],
  ["failed CI", (f) => (f.ci.conclusion = "failure")],
  [
    "other producer workflow",
    (f) => (f.ci.path = ".github/workflows/other.yml"),
  ],
  ["expired artifact", (f) => (f.artifacts[0].expired = true)],
  ["missing digest", (f) => delete f.artifacts[0].digest],
  ["artifact from another run", (f) => (f.artifacts[0].workflow_run.id = 999)],
  [
    "artifact from another SHA",
    (f) => (f.artifacts[0].workflow_run.head_sha = "d".repeat(40)),
  ],
  [
    "ambiguous artifacts",
    (f) => f.artifacts.push({ ...f.artifacts[0], id: 599 }),
  ],
  ["staging different source", (f) => (f.stage.head_sha = "d".repeat(40))],
  [
    "skipped acceptance",
    (f) =>
      (f.routes[
        "/actions/runs/201/jobs?filter=latest&per_page=100"
      ][3].conclusion = "skipped"),
  ],
  ["missing reviewers", (f) => (f.env.protection_rules = [])],
  [
    "self-approval allowed",
    (f) => (f.env.protection_rules[0].prevent_self_review = false),
  ],
  [
    "unprotected master",
    (f) => (f.routes["/branches/master"].protected = false),
  ],
  [
    "different staged artifact",
    (f) =>
      (f.deployment.payload.frontend_artifact_digest =
        "sha256:" + "d".repeat(64)),
  ],
  ["wrong staged CI run", (f) => (f.deployment.payload.source_ci_run_id = 999)],
  [
    "fabricated untrusted creator",
    (f) => (f.deployment.creator.login = "unknown-user"),
  ],
  [
    "latest staging failed",
    (f) => f.statuses.unshift({ ...f.statuses[0], state: "failure" }),
  ],
  [
    "unrelated staging status link",
    (f) => (f.statuses[0].log_url = "https://example.invalid"),
  ],
  ["DB source mismatch", (f) => (f.db.head_sha = "d".repeat(40))],
  [
    "DB suite skipped",
    (f) =>
      (f.routes[
        "/actions/runs/401/jobs?filter=latest&per_page=100"
      ][0].conclusion = "skipped"),
  ],
])
  test("production selection blocks " + label, async () => {
    const f = fixture();
    mutate(f);
    await assert.rejects(p.collect(f.api, 101, 201, f.readArtifact));
  });
for (const id of [
  "master",
  "https://example.invalid/1",
  "1;exit",
  0,
  -1,
  "9007199254740992",
])
  test("untrusted run identifier is rejected: " + id, () =>
    assert.throws(() => p.number(id)),
  );
function repo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "scop-artifact-test-"));
  const git = (...args) =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  git("init", "--quiet");
  git("config", "user.email", "synthetic@example.invalid");
  git("config", "user.name", "Synthetic fixture");
  git("config", "core.autocrlf", "false");
  fs.mkdirSync(path.join(root, "purchase-backend"));
  fs.writeFileSync(
    path.join(root, "purchase-backend/app.js"),
    "module.exports = 1;\n",
  );
  fs.writeFileSync(
    path.join(root, "purchase-backend/package-lock.json"),
    "{}\n",
  );
  fs.writeFileSync(
    path.join(root, "purchase-backend/.env"),
    "private fixture\n",
  );
  git("add", ".");
  git("commit", "--quiet", "-m", "synthetic fixture");
  return { root, commit: git("rev-parse", "HEAD") };
}
test("backend artifact contains only committed tested bytes, excludes env, and never overwrites output", () => {
  const r = repo();
  try {
    const out = path.join(r.root, "payload"),
      m = pack(r.root, r.commit, out);
    assert.equal(m.commit, r.commit);
    assert.equal(m.files.length, 2);
    assert(!fs.existsSync(path.join(out, ".env")));
    assert.equal(
      fs.readFileSync(path.join(out, "app.js"), "utf8"),
      "module.exports = 1;\n",
    );
    assert.throws(() => pack(r.root, r.commit, out), /ALREADY_EXISTS/);
  } finally {
    fs.rmSync(r.root, { recursive: true, force: true });
  }
});
test("backend payload rejects worktree/line-ending drift before creating output", () => {
  const r = repo();
  try {
    fs.writeFileSync(
      path.join(r.root, "purchase-backend/app.js"),
      "module.exports = 2;\r\n",
    );
    const out = path.join(r.root, "payload");
    assert.throws(
      () => pack(r.root, r.commit, out),
      /DIFFERS_FROM_TESTED_COMMIT/,
    );
    assert(!fs.existsSync(out));
  } finally {
    fs.rmSync(r.root, { recursive: true, force: true });
  }
});
test("Deploy to Production accepts only evidence IDs, uses trusted verifier code, requires environment and remains disabled", () => {
  const root = path.resolve(__dirname, "../.."),
    yaml = require(
      require.resolve("js-yaml", {
        paths: [path.join(root, "purchase-backend")],
      }),
    ),
    w = yaml.load(
      fs.readFileSync(
        path.join(root, ".github/workflows/production-release.yml"),
        "utf8",
      ),
    );
  assert.equal(w.name, "Deploy to Production");
  assert.deepEqual(Object.keys(w.on.workflow_dispatch.inputs), [
    "ci_run_id",
    "staging_run_id",
  ]);
  assert.equal(w.jobs.production.if, "${{ false }}");
  assert.equal(w.jobs.production.needs, "verify");
  assert.equal(w.jobs.production.environment.name, "scop-production");
  assert.equal(
    w.jobs.production.env.VERIFIED_COMMIT_SHA,
    "${{ needs.verify.outputs.commit_sha }}",
  );
  assert(w.jobs.result.steps[0].run.includes("exit 1"));
  const ci = yaml.load(
    fs.readFileSync(
      path.join(root, ".github/workflows/release-quality.yml"),
      "utf8",
    ),
  );
  const producer = ci.jobs.backend.steps.find(
    (step) => step.id === "backend_release",
  );
  assert.equal(producer.with["include-hidden-files"], true);
  assert.equal(w.jobs.verify.steps[0].with.ref, "${{ github.workflow_sha }}");
  assert.equal(w.permissions.actions, "read");
  assert.equal(w.permissions.deployments, "read");
  assert(w.jobs.production.steps[0].run.includes("exit 1"));
});

test("a retried CI run cannot silently reuse artifacts from its earlier attempt", async () => {
  const f = fixture();
  f.ci.run_attempt = 2;
  await assert.rejects(
    p.collect(f.api, 101, 201, f.readArtifact),
    /MISSING_OR_AMBIGUOUS_TESTED_ARTIFACT/,
  );
});

test("dispatch A cannot authorize checkout B even when API head_sha says A", async () => {
  const f = fixture();
  f.reports[601].testedCommit = "b".repeat(40);
  await assert.rejects(
    p.collect(f.api, 101, 201, f.readArtifact),
    /DATABASE_RECEIPT_PROVENANCE_MISMATCH/,
  );
});

for (const [name, mutate] of [
  ["missing receipt", (f) => f.dbArtifacts.pop()],
  ["ambiguous receipt", (f) => f.dbArtifacts.push(f.dbArtifacts[0])],
  ["expired receipt artifact", (f) => (f.dbArtifacts[0].expired = true)],
  ["previous DB attempt", (f) => (f.db.run_attempt = 2)],
  [
    "wrong source digest",
    (f) => (f.reports[601].report.sourceDigest = "c".repeat(64)),
  ],
  ["incomplete gate", (f) => delete f.reports[601].report.results],
  ["failed gate", (f) => (f.reports[601].report.status = "failed")],
  [
    "expired report",
    (f) => (f.reports[601].report.finishedAt = "2020-01-01T00:00:00Z"),
  ],
  [
    "wrong CI manifest commit",
    (f) => (f.reports[503].gitCommit = "b".repeat(40)),
  ],
])
  test("rejects " + name, async () => {
    const f = fixture();
    mutate(f);
    await assert.rejects(p.collect(f.api, 101, 201, f.readArtifact));
  });
test("producer rejects dispatch A with checkout B or selected B", () => {
  const { checkout } = require("./db-provenance.cjs"),
    a = "a".repeat(40),
    b = "b".repeat(40);
  assert.throws(() => checkout({ GITHUB_SHA: a, SELECTED_COMMIT: b }, b));
  assert.throws(() => checkout({ GITHUB_SHA: a, SELECTED_COMMIT: a }, b));
  assert.equal(checkout({ GITHUB_SHA: a, SELECTED_COMMIT: a }, a), a);
});

test("missing and skipped database results are rejected", async () => {
  for (const result of [{}, { passed: 1, failed: 0, skipped: 1 }]) {
    const f = fixture();
    f.reports[602].report.results = result;
    await assert.rejects(p.collect(f.api, 101, 201, f.readArtifact));
  }
});
