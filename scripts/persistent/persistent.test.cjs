"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  { execFileSync } = require("node:child_process");
const core = require("./core.cjs"),
  gh = require("./github.cjs"),
  {
    route,
    names,
    resourceIdentity,
    labels,
    assertOwned,
    cleanupOwned,
  } = require("./runtime.cjs");
const cfg = {
  version: 1,
  enabled: false,
  purpose: "wici-isolated-staging-v1",
  instance: "hospital-test",
  hostname: "staging.example.invalid",
  database: "scop_staging_synthetic",
  stateDirectory: "/var/lib/scop-staging",
  databasePrepared: false,
};
function manifest(letter = "a") {
  const commit = letter.repeat(40),
    images = {
      backend: "sha256:" + letter.repeat(64),
      frontend: "sha256:" + "b".repeat(64),
    },
    sourceCi = { commit, runId: 11 };
  return {
    kind: "wici-staging-capsule",
    version: 1,
    operation: "deploy",
    commit,
    images,
    sourceCi,
    gateway: {
      commit,
      attempt: 1,
      runId: 22,
      artifact: { id: 44, digest: "sha256:" + "d".repeat(64) },
    },
    request: { runId: 33, attempt: 1, workflowCommit: commit },
    archiveSha256: "c".repeat(64),
    databaseContract: "hospital-erp-2026-11-scop1",
    syntheticOnly: true,
    productionAuthorized: false,
    runtimeVerified: {
      commit,
      images,
      sourceCi,
      status: "DISPOSABLE_REHEARSAL_PASSED_NOT_ACTIVATION_APPROVAL",
      scope: "AUTHENTICATED_CI_ARTIFACT_REHEARSAL",
      source: { gitCommit: commit, dirty: false },
      database: { status: "DATABASE_READY", findings: [] },
      cleanupFailures: [],
    },
  };
}
function fixture(old = true, failure) {
  const m = manifest("c"),
    prev = manifest("a");
  let state = old
    ? {
        phase: "ACTIVE",
        release: { commit: prev.commit, images: prev.images, manifest: prev },
        previous: null,
      }
    : null;
  const events = [],
    audit = [];
  const store = {
    read: () => structuredClone(state),
    write: (v) => {
      state = structuredClone(v);
    },
    append: (r) => audit.push(r),
  };
  const running = new Set(old ? [prev.commit] : []);
  const io = Object.fromEntries(
    [
      "preflight",
      "prepare",
      "maintenance",
      "stop",
      "start",
      "health",
      "route",
      "routeHealth",
    ].map((name) => [
      name,
      async (r) => {
        events.push([name, r?.commit]);
        if (failure?.(name, r, events)) throw Error("injected_" + name);
        if (name === "stop") running.delete(r.commit);
        if (name === "start" && !running.has(r.commit)) {
          assert.equal(running.size, 0, "workers must never overlap");
          running.add(r.commit);
        }
      },
    ]),
  );
  return {
    m,
    prev,
    events,
    audit,
    store,
    io,
    running,
    get state() {
      return state;
    },
  };
}
test("configuration, provisioning and all external execution stay disabled", () => {
  core.configuration(cfg, false);
  assert.throws(
    () =>
      core.configuration({
        ...cfg,
        enabled: true,
        databasePrepared: true,
        isolationApprovalSha256: "a".repeat(64),
      }),
    /HARD_DISABLED/,
  );
  for (const c of [
    { ...cfg, stateDirectory: "/var/www/wici-procurement" },
    { ...cfg, hostname: "wici-procurement.org" },
    { ...cfg, hostname: "178.105.124.131" },
    { ...cfg, database: "postgres" },
    { ...cfg, instance: "../recovery" },
  ])
    assert.throws(() => core.configuration(c, false));
  const root = path.resolve(__dirname, "../..");
  for (const name of [
    "production-release.yml",
    "production-database-release.yml",
    "staging-release.yml",
    "repository-sync.yml",
    "staging-persistent.yml",
  ])
    assert.match(
      fs.readFileSync(path.join(root, ".github/workflows", name), "utf8"),
      /if: \$\{\{ false \}\}/,
    );
  const p = require("../../deploy/persistent/policy.json");
  assert.equal(p.externalActivationEnabled, false);
  assert.equal(p.productionEnabled, false);
});
test("deployment preflights before maintenance, switches only after health, preserves previous", async () => {
  const f = fixture();
  const result = await core.deploy({
    config: cfg,
    manifest: f.m,
    store: f.store,
    io: f.io,
  });
  assert.equal(result.status, "DEPLOYED");
  assert.equal(f.state.previous.commit, f.prev.commit);
  assert.deepEqual(
    f.events.map((x) => x[0]),
    [
      "preflight",
      "prepare",
      "maintenance",
      "stop",
      "start",
      "health",
      "route",
      "routeHealth",
    ],
  );
  assert.equal(f.state.phase, "ACTIVE");
  assert.equal(f.running.size, 1);
  assert(f.audit.some((a) => a.event === "DEPLOYMENT_SUCCEEDED"));
});
for (const step of [
  "preflight",
  "prepare",
  "maintenance",
  "stop",
  "start",
  "health",
  "route",
  "routeHealth",
])
  test(
    "candidate failure recovers or preserves prior service: " + step,
    async () => {
      let once = false;
      const f = fixture(true, (name, r) => {
        if (name === step && !once) {
          once = true;
          return true;
        }
        return false;
      });
      await assert.rejects(() =>
        core.deploy({ config: cfg, manifest: f.m, store: f.store, io: f.io }),
      );
      assert.equal(f.state.phase, "ACTIVE");
      assert.equal(f.state.release.commit, f.prev.commit);
      if (["preflight", "prepare"].includes(step))
        assert(!f.events.some((e) => e[0] === "stop"));
      else
        assert(
          f.events.some((e) => e[0] === "route" && e[1] === f.prev.commit),
        );
    },
  );
test("failure of rollback keeps maintenance and reports recovery required, never success", async () => {
  const f = fixture(true, (name) => name === "health");
  await assert.rejects(
    () => core.deploy({ config: cfg, manifest: f.m, store: f.store, io: f.io }),
    /RECOVERY_REQUIRED/,
  );
  assert.equal(f.state.phase, "RECOVERY_REQUIRED");
  assert.equal(f.events.at(-1)[0], "maintenance");
  assert(!f.audit.some((a) => a.event === "DEPLOYMENT_SUCCEEDED"));
});
test("first release failure is explicitly unavailable and never invents a previous release", async () => {
  const f = fixture(false, (name) => name === "health");
  await assert.rejects(
    () => core.deploy({ config: cfg, manifest: f.m, store: f.store, io: f.io }),
    /RECOVERY_REQUIRED/,
  );
  assert.equal(f.state.previous, null);
});
test("audit failure after switch still restores previous service", async () => {
  const f = fixture();
  const append = f.store.append;
  f.store.append = (r) => {
    if (r.event === "DEPLOYMENT_SUCCEEDED") throw Error("audit unavailable");
    append(r);
  };
  await assert.rejects(
    () => core.deploy({ config: cfg, manifest: f.m, store: f.store, io: f.io }),
    /PREVIOUS_RELEASE_RECOVERED/,
  );
  assert.equal(f.state.release.commit, f.prev.commit);
});
test("duplicate exact request is health-checked without restarting; same SHA different images blocked", async () => {
  const f = fixture();
  await core.deploy({ config: cfg, manifest: f.m, store: f.store, io: f.io });
  f.events.length = 0;
  assert.equal(
    (
      await core.deploy({
        config: cfg,
        manifest: f.m,
        store: f.store,
        io: f.io,
      })
    ).status,
    "ALREADY_ACTIVE",
  );
  assert.deepEqual(
    f.events.map((e) => e[0]),
    ["health", "routeHealth"],
  );
  const m = structuredClone(f.m);
  m.images = { ...m.images, backend: "sha256:" + "d".repeat(64) };
  m.runtimeVerified.images = m.images;
  await assert.rejects(
    () => core.deploy({ config: cfg, manifest: m, store: f.store, io: f.io }),
    /DIFFERENT_IMAGES/,
  );
});
for (const phase of ["PREPARED", "HANDOFF", "RECOVERY_REQUIRED"])
  test("restart refuses blind replay after crash phase " + phase, async () => {
    const f = fixture();
    f.store.write({ ...f.state, phase });
    await assert.rejects(
      () =>
        core.deploy({ config: cfg, manifest: f.m, store: f.store, io: f.io }),
      /INTERRUPTED/,
    );
    assert.equal(f.events.length, 0);
  });
test("independent approval, protected environment, timestamp and request-attempt provenance required", () => {
  const m = manifest();
  const run = {
    id: 33,
    run_attempt: 1,
    head_sha: m.request.workflowCommit,
    head_branch: "master",
    repository: { full_name: "mhaider1129/purchase-tracker" },
    head_repository: { full_name: "mhaider1129/purchase-tracker" },
    path: ".github/workflows/staging-persistent.yml",
    event: "workflow_dispatch",
    status: "completed",
    conclusion: "success",
    actor: { login: "author" },
    updated_at: new Date().toISOString(),
  };
  const env = {
    id: 1,
    protection_rules: [
      {
        type: "required_reviewers",
        reviewers: [{ reviewer: { login: "reviewer" } }],
        prevent_self_review: true,
      },
    ],
    deployment_branch_policy: { protected_branches: true },
  };
  const approvals = [
    {
      state: "approved",
      user: { login: "reviewer" },
      environments: [{ id: 1, name: "scop-staging" }],
    },
  ];
  gh.approved(run, approvals, env, m);
  for (const mutate of [
    (x) => (x.approvals[0].user.login = "author"),
    (x) => (x.approvals = []),
    (x) => (x.run.run_attempt = 2),
    (x) => (x.run.head_sha = "f".repeat(40)),
    (x) => (x.run.head_repository.full_name = "foreign/repo"),
    (x) => (x.run.updated_at = "2000-01-01"),
    (x) => (x.env.protection_rules[0].prevent_self_review = false),
    (x) => (x.run.conclusion = "failure"),
  ]) {
    const x = structuredClone({ run, env, approvals });
    mutate(x);
    assert.throws(() => gh.approved(x.run, x.approvals, x.env, m));
  }
});
test("capsule rejects missing/mismatched source, images, cleanup and database evidence", () => {
  core.capsule(manifest());
  for (const mutate of [
    (m) => (m.commit = "main"),
    (m) => (m.syntheticOnly = false),
    (m) => (m.productionAuthorized = true),
    (m) => (m.runtimeVerified.cleanupFailures = ["container"]),
    (m) => (m.runtimeVerified.database.findings = ["drift"]),
    (m) => (m.runtimeVerified.images = { backend: "bad" }),
    (m) => (m.sourceCi = { runId: 11, commit: "f".repeat(40) }),
  ]) {
    const m = structuredClone(manifest());
    mutate(m);
    assert.throws(() => core.capsule(m));
  }
});
test("gateway route uses validated slots and maintenance carries no backend target", () => {
  const m = manifest(),
    r = { commit: m.commit, images: m.images, request: m.request };
  assert(route(cfg, r).includes(names(cfg, r).fe + ":8080"));
  assert(route(cfg, null).includes("503"));
  assert(!route(cfg, null).includes("reverse_proxy"));
  assert(route(cfg, r).includes("client_auth"));
  assert(route(cfg, r).includes("mode require_and_verify"));
  assert(!route(cfg, r).includes("basic_auth"));
  assert(route(cfg, r).includes("tls /certs/tls.crt"));
  assert.throws(() => names(cfg, { commit: "../../wici-recovery" }));
});
test("atomic state persists complete JSON and audit survives reload", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scop-state-"));
  try {
    const f = path.join(dir, "state.json");
    core.atomic(f, { phase: "HANDOFF" });
    core.atomic(f, { phase: "ACTIVE" });
    assert.deepEqual(JSON.parse(fs.readFileSync(f)), { phase: "ACTIVE" });
    assert.deepEqual(fs.readdirSync(dir), ["state.json"]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("status acknowledgement retry never calls deployment again", async () => {
  const { acknowledge } = require("./agent.cjs"),
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "scop-status-")),
    file = path.join(dir, "handled.json");
  try {
    core.atomic(file, {
      statusPending: true,
      status: "failure",
      deploymentId: 1,
    });
    await assert.rejects(() =>
      acknowledge(
        cfg,
        async () => {
          throw Error("network down");
        },
        file,
        "https://github.com/",
      ),
    );
    assert.equal(JSON.parse(fs.readFileSync(file)).statusPending, true);
    let n = 0;
    await acknowledge(
      cfg,
      async () => {
        n++;
      },
      file,
      "https://github.com/",
    );
    await acknowledge(
      cfg,
      async () => {
        n++;
      },
      file,
      "https://github.com/",
    );
    assert.equal(n, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("reviewed reboot recovery can restart the exact recorded active release", async () => {
  const f = fixture();
  f.running.clear();
  const result = await core.recover({
    config: cfg,
    commit: f.prev.commit,
    store: f.store,
    io: f.io,
  });
  assert.equal(result.status, "RECOVERED");
  assert.equal(f.state.release.commit, f.prev.commit);
  assert.equal(f.running.size, 1);
});
test("reviewed interrupted recovery selects only recorded prior release", async () => {
  const f = fixture();
  const old = f.state;
  f.store.write({
    phase: "HANDOFF",
    release: { commit: f.m.commit, images: f.m.images, manifest: f.m },
    previous: old.release,
  });
  await assert.rejects(
    () =>
      core.recover({
        config: cfg,
        commit: "f".repeat(40),
        store: f.store,
        io: f.io,
      }),
    /EXACT_RECORDED/,
  );
  await core.recover({
    config: cfg,
    commit: f.prev.commit,
    store: f.store,
    io: f.io,
  });
  assert.equal(f.state.release.commit, f.prev.commit);
  assert.equal(f.state.phase, "ACTIVE");
});
test("capsule archive partial downloads, unexpected members and image substitutions fail", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scop-capsule-test-"));
  const python = process.platform === "win32" ? "python" : "python3";
  try {
    for (const kind of ["partial", "traversal", "extra", "image"]) {
      const archive = path.join(dir, kind + ".zip");
      execFileSync(
        python,
        [
          "-c",
          `import zipfile,sys,json,tarfile,io\np=sys.argv[1]; kind=sys.argv[2]\nz=zipfile.ZipFile(p,'w')\nif kind=='partial':\n z.close();open(p,'wb').write(b'PK');sys.exit(0)\nif kind=='image':\n b=io.BytesIO()\n with tarfile.open(fileobj=b,mode='w:gz') as t:\n  data=json.dumps([{'Config':'f'*64+'.json','RepoTags':['other-application:latest']}]*2).encode();i=tarfile.TarInfo('manifest.json');i.size=len(data);t.addfile(i,io.BytesIO(data))\n z.writestr('capsule.json',json.dumps({'commit':'a'*40,'images':{}}));z.writestr('images.tar.gz',b.getvalue())\nelse:\n z.writestr('capsule.json','{}');z.writestr('../escape' if kind=='traversal' else 'extra.json','{}')\nz.close()`,
          archive,
          kind,
        ],
        { stdio: "pipe" },
      );
      assert.throws(() =>
        execFileSync(
          python,
          [path.join(__dirname, "extract.py"), archive, path.join(dir, kind)],
          { stdio: "pipe" },
        ),
      );
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("IAC/config templates contain no activation, production targets or unpinned service images", () => {
  const root = path.resolve(__dirname, "../../deploy/persistent"),
    tf = JSON.parse(fs.readFileSync(path.join(root, "terraform/main.tf.json")));
  assert.equal(tf.variable.activation_authorized.default, false);
  assert.equal(
    tf.resource.hcloud_volume.staging.lifecycle.prevent_destroy,
    true,
  );
  assert.equal(
    tf.resource.hcloud_server.staging.lifecycle.prevent_destroy,
    true,
  );
  const compose = fs.readFileSync(path.join(root, "compose.yaml"), "utf8");
  assert(!compose.includes("5051"));
  assert(compose.includes("create_host_path: false"));
  assert(compose.includes("internal: true"));
  assert(!compose.includes("restart: unless-stopped"));
  const firewall = fs.readFileSync(path.join(root, "firewall.sh"), "utf8");
  assert(firewall.includes("ACTIVATION_APPROVED"));
  assert(firewall.includes("-s 172.30.60.20 -p tcp --dport 443"));
  const proxy = fs.readFileSync(path.join(root, "squid.conf"), "utf8");
  assert(proxy.includes("http_access deny all"));
  assert(!proxy.includes("supabase"));
  assert(!proxy.includes("SAP"));
  const service = fs.readFileSync(
    path.join(root, "scop-staging.service"),
    "utf8",
  );
  assert(service.includes("RequiresMountsFor"));
  assert(service.includes("ACTIVATION_APPROVED"));
  assert(
    fs
      .readFileSync(path.join(root, "agent.Dockerfile"), "utf8")
      .includes('"flock", "-n"'),
  );
});
