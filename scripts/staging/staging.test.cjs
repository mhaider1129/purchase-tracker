"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  { execFileSync } = require("node:child_process");
const s = require("./safety.cjs"),
  { transactionalSwitch } = require("./rehearse.cjs");
const root = path.resolve(__dirname, "../.."),
  policy = require("../../deploy/staging/policy.json");
test("runtime subprocess environment excludes real application credentials and Docker endpoints", () => {
  const output = s.environment({
    PATH: "safe",
    DATABASE_URL: "forbidden",
    SUPABASE_URL: "forbidden",
    JWT_SECRET: "forbidden",
    GH_TOKEN: "forbidden",
    DOCKER_HOST: "forbidden",
    NODE_OPTIONS: "forbidden",
    BASH_ENV: "forbidden",
    DB_RELEASE_SCHEMA_PROFILE: "forbidden",
  });
  assert.deepEqual(output, { PATH: "safe" });
});
test("both external executors remain disabled and pinned images are required", () => {
  assert.equal(policy.externalStagingEnabled, false);
  assert.equal(policy.productionEnabled, false);
  s.stopped();
  for (const image of [
    policy.nodeImage,
    ...Object.values(policy.postgresImages),
  ])
    assert.match(image, /@sha256:[a-f0-9]{64}$/);
  for (const file of [
    "staging-release.yml",
    "production-release.yml",
    "production-database-release.yml",
    "repository-sync.yml",
  ])
    assert.match(
      fs.readFileSync(path.join(root, ".github/workflows", file), "utf8"),
      /if: \$\{\{ false \}\}/,
    );
});
test("non-root runtime copies explicitly own artifact bytes even under private extraction umask", () => {
  for (const file of ["backend.Dockerfile", "frontend.Dockerfile"]) {
    const text = fs.readFileSync(
      path.join(root, "deploy/staging", file),
      "utf8",
    );
    assert.match(text, /USER node/);
    for (const line of text.split("\n").filter((l) => l.startsWith("COPY ")))
      assert.match(line, /--chown=node:node/);
  }
});
test("successful candidate does not stop old release; failed candidate retains verified old release", async () => {
  const stopped = [];
  const success = await transactionalSwitch(
    "new",
    "old",
    async () => {},
    async (n) => stopped.push(n),
  );
  assert.equal(success.active, "new");
  assert.deepEqual(stopped, []);
  const failed = await transactionalSwitch(
    "new",
    "old",
    async (n) => {
      if (n === "new") throw Error("bad");
    },
    async (n) => stopped.push(n),
  );
  assert.equal(failed.active, "old");
  assert.equal(failed.candidateFailed, true);
  assert.deepEqual(stopped, ["new"]);
});
test("no previous release and unhealthy rollback both fail closed", async () => {
  await assert.rejects(
    () =>
      transactionalSwitch(
        "new",
        null,
        async () => {
          throw Error("bad");
        },
        async () => {},
      ),
    /NO_PREVIOUS/,
  );
  await assert.rejects(
    () =>
      transactionalSwitch(
        "new",
        "old",
        async () => {
          throw Error("both unhealthy");
        },
        async () => {},
      ),
    /both unhealthy/,
  );
});
function evidence() {
  const p = require("../devops/verify-production-selection.cjs"),
    commit = "a".repeat(40);
  const run = {
    id: 41,
    run_attempt: 1,
    head_sha: commit,
    head_branch: "master",
    repository: { full_name: p.repo },
    head_repository: { full_name: p.repo },
    path: ".github/workflows/release-quality.yml",
    event: "push",
    status: "completed",
    conclusion: "success",
    updated_at: new Date().toISOString(),
  };
  const jobs = p.requiredCi.map((name) => ({
    name,
    status: "completed",
    conclusion: "success",
  }));
  const artifacts = ["backend-release", "frontend-build"].map((name, i) => ({
    id: i + 1,
    name: name + "-attempt-1",
    expired: false,
    digest: "sha256:" + "b".repeat(64),
    workflow_run: { id: 41, head_sha: commit },
  }));
  const manifest = {
    kind: "scop-code-ci",
    version: 1,
    status: "CODE_TEST_READY",
    gitCommit: commit,
    ciRunId: "41",
    ciRunAttempt: "1",
    dirty: false,
    liveRoutingEnabled: false,
    failures: [],
    artifacts: { backend: "1", frontend: "2" },
    sourceDigest: "c".repeat(64),
    gateConfigDigest: "d".repeat(64),
  };
  return { run, jobs, artifacts, manifest, commit };
}
test("immutable CI source, artifact IDs and actual checkout must agree", () => {
  const f = evidence();
  assert.equal(
    s.verifiedCi(f.run, f.jobs, f.artifacts, f.manifest, f.commit).commit,
    f.commit,
  );
  assert.throws(
    () => s.verifiedCi(f.run, f.jobs, f.artifacts, f.manifest, "f".repeat(40)),
    /UNVERIFIED/,
  );
  f.manifest.artifacts.frontend = "999";
  assert.throws(() =>
    s.verifiedCi(f.run, f.jobs, f.artifacts, f.manifest, f.commit),
  );
});
for (const mutate of [
  (f) => (f.run.updated_at = "invalid"),
  (f) => (f.run.updated_at = "2000-01-01"),
  (f) => (f.run.head_repository.full_name = "foreign/repo"),
  (f) => f.jobs.pop(),
  (f) => (f.artifacts[0].expired = true),
  (f) => f.artifacts.push({ ...f.artifacts[0] }),
  (f) => (f.manifest.dirty = true),
])
  test(
    "incomplete, expired, foreign or ambiguous CI evidence is rejected " +
      mutate.toString(),
    () => {
      const f = evidence();
      mutate(f);
      assert.throws(() =>
        s.verifiedCi(f.run, f.jobs, f.artifacts, f.manifest, f.commit),
      );
    },
  );
test("payload tampering and extra credentials are rejected; paths stay POSIX", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scop-staging-test-"));
  try {
    fs.mkdirSync(path.join(dir, "nested"));
    fs.writeFileSync(path.join(dir, "nested", "app.js"), "fixture");
    const files = s.files(dir).map((f) => ({ ...f, mode: "100644" }));
    assert.equal(files[0].path, "nested/app.js");
    fs.writeFileSync(
      path.join(dir, "release-source-manifest.json"),
      JSON.stringify({
        kind: "backend-source-release",
        version: 1,
        commit: "a",
        files,
        payloadSha256: s.sha(JSON.stringify(files)),
      }),
    );
    s.verifyBackend(dir, "a");
    fs.writeFileSync(path.join(dir, ".env"), "synthetic");
    assert.throws(() => s.verifyBackend(dir, "a"));
    fs.unlinkSync(path.join(dir, ".env"));
    fs.writeFileSync(path.join(dir, "nested", "app.js"), "tampered");
    assert.throws(() => s.verifyBackend(dir, "a"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("all 105 locked artifacts, source hashes and manual-only migration controls remain intact", () => {
  const inv = require("../../purchase-backend/scripts/lib/databaseRelease/inventory");
  const locked = require("../../purchase-backend/database/releases/migration-inventory.json");
  assert.equal(locked.artifacts.length, 105);
  assert.deepEqual(inv.verifyFiles(locked), []);
  const p = require("../../purchase-backend/scripts/lib/databaseRelease/planner");
  assert.equal(
    locked.artifacts.find((a) => a.id === "073").classification,
    "manual_recovery_migration",
  );
  assert(!p.selectMigrations(locked).some((a) => a.id === "073"));
});
test("rehearsal workflow has read-only token, no external environments or deployment commands", () => {
  const yaml = fs.readFileSync(
    path.join(root, ".github/workflows/staging-rehearsal.yml"),
    "utf8",
  );
  assert.doesNotMatch(
    yaml,
    /secrets\.|environment:|pull_request_target|\b(?:ssh|rsync|pm2|psql)\b|(?:contents|deployments|id-token): write/,
  );
  const gates = require("../quality/gates.json")
    .gates.filter((g) => g.group === "postgres")
    .map((g) => g.id);
  assert.equal(gates.length, 16);
  for (const gate of gates) assert(yaml.includes(gate));
});
test("artifact extraction rejects traversal, symlinks and duplicate paths", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scop-zip-test-"));
  try {
    for (const kind of ["traversal", "symlink", "duplicate"]) {
      const zip = path.join(dir, kind + ".zip");
      const python = process.platform === "win32" ? "python" : "python3";
      execFileSync(
        python,
        [
          "-c",
          `import zipfile,sys\nz=zipfile.ZipFile(sys.argv[1],'w')\ni=zipfile.ZipInfo('../escape' if sys.argv[2]=='traversal' else 'safe')\ni.external_attr=(0o120777 if sys.argv[2]=='symlink' else 0o100644)<<16\nz.writestr(i,'fixture')\nif sys.argv[2]=='duplicate': z.writestr(i,'fixture')\nz.close()`,
          zip,
          kind,
        ],
        { stdio: "pipe" },
      );
      assert.throws(() =>
        execFileSync(
          python,
          [path.join(__dirname, "unpack.py"), zip, path.join(dir, kind)],
          { stdio: "pipe" },
        ),
      );
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("static migration review flags destructive, type, data and permission changes without authorizing SQL", () => {
  const { classify } = require("./migration-review.cjs");
  assert.deepEqual(
    classify(
      "DROP TABLE x; TRUNCATE y; ALTER TABLE z ALTER COLUMN n TYPE text; UPDATE z SET n=1; GRANT ALL ON z TO role",
    ).risks,
    [
      "DESTRUCTIVE_DDL_REVIEW",
      "COLUMN_COMPATIBILITY_REVIEW",
      "DATA_PRESERVATION_REVIEW",
      "AUTHORITY_REVIEW",
    ],
  );
  assert.equal(
    classify("CREATE TABLE x(id int)").approval,
    "MANUAL_REVIEW_REQUIRED",
  );
  assert.equal(classify("CREATE TABLE x(id int)").automaticExecution, false);
});
