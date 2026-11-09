"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  { verifiedCi } = require("./sync-release.cjs"),
  s = require("./verify-production-selection.cjs");
function fixture() {
  const sha = "a".repeat(40),
    run = {
      id: 101,
      run_attempt: 1,
      status: "completed",
      conclusion: "success",
      path: ".github/workflows/release-quality.yml",
      head_sha: sha,
      head_branch: "master",
      repository: { full_name: s.repo },
      head_repository: { full_name: s.repo },
      event: "push",
    };
  const jobs = s.requiredCi.map((name) => ({
    name,
    status: "completed",
    conclusion: "success",
  }));
  const artifacts = [
    "backend-release",
    "frontend-build",
    "code-ci-manifest",
  ].map((name, i) => ({
    id: 501 + i,
    name: name + "-attempt-1",
    expired: false,
    digest: "sha256:" + "b".repeat(64),
    workflow_run: { id: 101, head_sha: sha },
  }));
  const current = {
    gitCommit: sha,
    dirty: false,
    sourceDigest: "c".repeat(64),
    gateConfigDigest: "d".repeat(64),
  };
  const manifest = {
    ...current,
    kind: "scop-code-ci",
    version: 1,
    status: "CODE_TEST_READY",
    ciRunId: "101",
    ciRunAttempt: "1",
    liveRoutingEnabled: false,
    productionDeploymentAuthorized: false,
    artifacts: { backend: "501", frontend: "502" },
    failures: [],
  };
  const api = async (method, route) => {
    assert.equal(method, "GET");
    if (route.endsWith("/101")) return run;
    if (route.includes("/jobs?")) return { jobs };
    if (route.includes("/artifacts?")) return { artifacts };
    throw Error("UNEXPECTED_EVIDENCE_ROUTE");
  };
  return {
    run,
    jobs,
    artifacts,
    current,
    manifest,
    api,
    read: async () => manifest,
  };
}
test("same-commit master push CI and authenticated source manifest are required", async () => {
  const f = fixture();
  const r = await verifiedCi(f.api, 101, f.current, f.read);
  assert.equal(r.commit, f.current.gitCommit);
  assert.equal(r.manifestDigest, f.artifacts[2].digest);
});
for (const [name, mutate] of [
  ["PR evidence", (f) => (f.run.event = "pull_request")],
  ["foreign source", (f) => (f.run.repository.full_name = "other/repository")],
  ["different checkout", (f) => (f.current.gitCommit = "f".repeat(40))],
  ["dirty checkout", (f) => (f.current.dirty = true)],
  ["stale run attempt", (f) => (f.run.run_attempt = 2)],
  ["expired manifest", (f) => (f.artifacts[2].expired = true)],
  ["missing job", (f) => f.jobs.pop()],
  ["skipped job", (f) => (f.jobs[0].conclusion = "skipped")],
  ["missing digest", (f) => delete f.artifacts[2].digest],
  ["manifest source drift", (f) => (f.manifest.sourceDigest = "e".repeat(64))],
  ["unverified build IDs", (f) => (f.manifest.artifacts.frontend = "999")],
  ["duplicate manifest", (f) => f.artifacts.push(f.artifacts[2])],
  ["incomplete evidence", (f) => f.jobs.push(...Array(100).fill(f.jobs[0]))],
])
  test("rejects " + name, async () => {
    const f = fixture();
    mutate(f);
    await assert.rejects(verifiedCi(f.api, 101, f.current, f.read));
  });
test("checked-in CLI cannot access publishing credentials while disabled", () => {
  const cp = require("node:child_process"),
    path = require("node:path");
  const result = cp.spawnSync(
    process.execPath,
    [path.resolve(__dirname, "sync-release.cjs"), "publish"],
    {
      encoding: "utf8",
      env: {
        PATH: process.env.PATH,
        SYSTEMROOT: process.env.SYSTEMROOT,
        TEMP: process.env.TEMP,
        GITHUB_REPOSITORY: s.repo,
        GITHUB_REF: "refs/heads/master",
        SCOP_SYNC_ENVIRONMENT: "scop-sync-publish",
      },
    },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /PUBLISHING_DISABLED_NO_CREDENTIAL_ACCESS/);
});

test("governance transport cannot perform writes even if misconfigured with broader credentials", async () => {
  const { readOnly } = require("./sync-release.cjs");
  let calls = 0;
  const read = readOnly(async () => {
    calls++;
    return true;
  });
  await assert.rejects(read("POST", "/repos/other/git/refs", {}), /READ_ONLY/);
  assert.equal(calls, 0);
  assert.equal(await read("GET", "/metadata"), true);
  assert.equal(calls, 1);
});
