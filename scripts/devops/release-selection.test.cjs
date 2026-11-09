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
      name: "backend-release",
      digest: "sha256:" + "b".repeat(64),
      expired: false,
      workflow_run: { id: 101, head_sha: commit },
    },
    {
      id: 502,
      name: "frontend-build",
      digest: "sha256:" + "c".repeat(64),
      expired: false,
      workflow_run: { id: 101, head_sha: commit },
    },
  ];
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
    r = await p.collect(f.api, "101", "201");
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
    await assert.rejects(p.collect(f.api, 101, 201));
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
