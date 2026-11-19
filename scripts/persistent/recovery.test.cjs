"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const core = require("./core.cjs"),
  agent = require("./agent.cjs");
const config = { ...require("../../deploy/persistent/config.example.json") };
function manifest(letter = "a", run = 1, operation = "deploy") {
  const commit = letter.repeat(40),
    images = {
      backend: "sha256:" + letter.repeat(64),
      frontend: "sha256:" + "b".repeat(64),
    },
    sourceCi = { commit, runId: 11 };
  return {
    kind: "wici-staging-capsule",
    version: 1,
    operation,
    commit,
    images,
    sourceCi,
    request: { runId: run, attempt: 1, workflowCommit: commit },
    gateway: {
      commit,
      attempt: 1,
      runId: 22,
      artifact: { id: 44, digest: "sha256:" + "d".repeat(64) },
    },
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
const provenance = {
  deploymentId: 7,
  artifactId: 8,
  artifactDigest: "sha256:" + "f".repeat(64),
};
function fixture(operation = "deploy") {
  const old = manifest("a"),
    next = manifest("c", 2),
    release = (m) => ({
      commit: m.commit,
      images: m.images,
      request: m.request,
      manifest: m,
    });
  let control = {
    version: 2,
    deployment: { phase: "ACTIVE", release: release(old), previous: null },
    operations: {},
    activeOperation: null,
  };
  if (operation !== "deploy")
    control.deployment = {
      phase: "ACTIVE",
      release: release(next),
      previous: release(old),
    };
  const m =
    operation === "deploy"
      ? next
      : {
          ...manifest(operation === "recover" ? "c" : "a", 3, operation),
          kind: "wici-staging-request",
        };
  const stages = [],
    effects = [],
    running = new Set([control.deployment.release.commit]);
  let fault;
  const store = {
    control: () => structuredClone(control),
    commit: (v) => {
      const stage =
        v.operations[v.activeOperation]?.stage ||
        Object.values(v.operations).at(-1)?.stage;
      stages.push(stage);
      if (fault) fault("before", v, stage);
      control = structuredClone(v);
      if (fault) fault("after", v, stage);
    },
    read: () => structuredClone(control.deployment),
    write: (v) => {
      control.deployment = structuredClone(v);
    },
    append: () => {},
  };
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
        effects.push([name, r?.commit]);
        if (name === "stop") running.delete(r.commit);
        if (name === "start") {
          assert.equal(running.size, 0, "no overlapping workers");
          running.add(r.commit);
        }
      },
    ]),
  );
  return {
    store,
    io,
    m,
    stages,
    effects,
    setFault: (f) => (fault = f),
    running,
  };
}
async function run(f, m = f.m) {
  return core.operation({
    config,
    manifest: m,
    provenance,
    store: f.store,
    io: f.io,
  });
}
for (const kind of ["deploy", "rollback", "recover"]) {
  test(`completed ${kind} survives handled-cache and acknowledgment loss without repeated starts`, async () => {
    const f = fixture(kind),
      first = await run(f);
    assert.equal(first.status, "SUCCEEDED");
    const before = f.effects.length;
    for (let i = 0; i < 3; i++) assert.deepEqual(await run(f), first);
    assert.equal(f.effects.length, before);
    assert.equal(f.effects.filter((x) => x[0] === "start").length, 1);
    const corrupted = {
      ...f.m,
      request: { ...f.m.request, workflowCommit: "e".repeat(40) },
    };
    await assert.rejects(run(f, corrupted), /IDENTITY_REUSED/);
  });
  test(`${kind} fences crashes/write failures before and after every significant durable transition`, async (t) => {
    const baseline = fixture(kind);
    await run(baseline);
    for (let index = 0; index < baseline.stages.length; index++)
      for (const side of ["before", "after"]) {
        await t.test(`${side} ${index} ${baseline.stages[index]}`, async () => {
          const f = fixture(kind);
          let count = -1;
          f.setFault((when) => {
            if (when === "before") count++;
            if (count === index && when === side) {
              const e = Error("SIMULATED_PROCESS_LOSS");
              e.simulatedCrash = true;
              throw e;
            }
          });
          await assert.rejects(run(f));
          f.setFault(null);
          const effects = f.effects.length,
            record = f.store.control().operations[`${f.m.request.runId}:1`];
          if (!record) {
            assert.equal(effects, 0);
            return;
          } // claim failed before persistence
          if (record.status === "SUCCEEDED")
            assert.equal((await run(f)).status, "SUCCEEDED");
          else await assert.rejects(run(f), /INTERRUPTED_OPERATION/);
          assert.equal(
            f.effects.length,
            effects,
            "an uncertain/completed identity must never execute again",
          );
          if (record.status !== "SUCCEEDED") {
            const another = manifest("d", 99);
            await assert.rejects(run(f, another), /PREVIOUS_OPERATION/);
            assert.equal(f.effects.length, effects);
          }
        });
      }
  });
}
test("a fresh reviewed recovery can supersede an uncertain operation, whose original identity stays fenced", async () => {
  const f = fixture();
  let crash = true;
  const start = f.io.start;
  f.io.start = async (r) => {
    await start(r);
    if (crash) {
      crash = false;
      const e = Error("CRASH");
      e.simulatedCrash = true;
      throw e;
    }
  };
  // Throw outside Docker effect handling via the durable transition fault.
  f.setFault((when, v, stage) => {
    if (when === "before" && stage === "AFTER_start") {
      const e = Error("CRASH");
      e.simulatedCrash = true;
      throw e;
    }
  });
  await assert.rejects(run(f));
  f.setFault(null);
  f.io.start = start;
  const recovery = {
    ...manifest("a", 66, "recover"),
    kind: "wici-staging-request",
  };
  assert.equal((await run(f, recovery)).status, "SUCCEEDED");
  await assert.rejects(run(f), /INTERRUPTED_OPERATION/);
  assert.equal(f.store.control().operations["2:1"].supersededBy, "66:1");
});
test("terminal failure with a healthy preserved release is durable and never repeats candidate effects", async () => {
  const f = fixture(),
    health = f.io.health;
  f.io.health = async (r) => {
    if (r.commit === f.m.commit) throw Error("FAILED_CANDIDATE");
    return health(r);
  };
  assert.equal((await run(f)).status, "FAILED");
  const count = f.effects.length;
  assert.equal((await run(f)).status, "FAILED");
  assert.equal(f.effects.length, count);
  assert.deepEqual([...f.running], ["a".repeat(40)]);
});
for (const phase of ["ACTIVE", "HANDOFF", "RECOVERY_REQUIRED"])
  for (const outage of ["authentication", "acknowledgment", "artifact"]) {
    test(`local safety remains active during ${outage} outage in ${phase}`, async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scop-local-health-")),
        c = { ...config, stateDirectory: dir },
        s = agent.store(c);
      let maintained = false,
        maintenances = 0,
        health = 0,
        starts = 0;
      s.write({ phase, release: { commit: "a".repeat(40) } });
      if (outage === "acknowledgment") {
        const ctl = s.control();
        ctl.operations["4:1"] = {
          key: "4:1",
          identity: { runId: 4, attempt: 1, commit: "a".repeat(40) },
          status: "FAILED",
          deploymentId: 8,
          acknowledgmentPending: true,
        };
        s.commit(ctl);
      }
      const io = {
        health: async () => {
          health++;
          throw Error("STOPPED_AFTER_REBOOT");
        },
        routeHealth: async () => {
          throw Error("BROKEN_EDGE");
        },
        maintenanceStatus: async () => maintained,
        maintenance: async () => {
          maintained = true;
          maintenances++;
        },
        start: async () => starts++,
      };
      try {
        const deps = {
          store: s,
          io,
          appToken: async () => {
            if (outage === "authentication") throw Error("GITHUB_UNAVAILABLE");
            return "synthetic";
          },
          api: async () => {
            throw Error("ACK_FAILED");
          },
          once: async () => {
            throw Error("ARTIFACT_DOWNLOAD_FAILED");
          },
        };
        await agent.tick(c, deps);
        await agent.tick(c, deps);
        assert.equal(starts, 0);
        assert.equal(maintenances, 1);
        if (phase === "ACTIVE") assert.equal(health, 4);
        const r = JSON.parse(fs.readFileSync(path.join(dir, "health.json")));
        assert.equal(r.maintenance, true);
        assert.equal(r.status, "unhealthy");
        assert.equal(
          JSON.parse(fs.readFileSync(path.join(dir, "poll.json"))).status,
          "blocked",
        );
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
  }
test("healthy active release continues to be checked during a GitHub outage without entering maintenance", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scop-local-good-")),
    c = { ...config, stateDirectory: dir },
    s = agent.store(c);
  s.write({ phase: "ACTIVE", release: { commit: "a".repeat(40) } });
  let checks = 0;
  try {
    await agent.tick(c, {
      store: s,
      appToken: async () => {
        throw Error("OFFLINE");
      },
      io: {
        health: async () => checks++,
        routeHealth: async () => checks++,
        maintenance: async () =>
          assert.fail("healthy release must remain active"),
      },
    });
    assert.equal(checks, 4);
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(dir, "health.json"))).status,
      "healthy",
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("lost handled cache and failed GitHub acknowledgment reconstruct the durable successful rollback outcome", async () => {
  const f = fixture("rollback"),
    record = await run(f),
    effects = f.effects.length;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scop-lost-ack-")),
    c = { ...config, stateDirectory: dir },
    s = agent.store(c);
  s.commit(f.store.control());
  let calls = 0;
  try {
    let file = agent.outcomeCache(c, record);
    await assert.rejects(
      agent.acknowledge(
        c,
        async () => {
          calls++;
          throw Error("NETWORK_LOST");
        },
        file,
        "https://example.invalid/run",
        s,
      ),
    );
    fs.unlinkSync(file);
    assert.equal(s.control().operations[record.key].status, "SUCCEEDED");
    file = agent.outcomeCache(c, s.control().operations[record.key]);
    await agent.acknowledge(
      c,
      async () => {
        calls++;
      },
      file,
      "https://example.invalid/run",
      s,
    );
    assert.equal(JSON.parse(fs.readFileSync(file)).status, "success");
    assert.equal(
      s.control().operations[record.key].acknowledgmentPending,
      false,
    );
    assert.equal((await run(f)).status, "SUCCEEDED");
    assert.equal(f.effects.length, effects);
    assert.equal(calls, 2);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("unreadable operation state still enters maintenance and preserves corrupt evidence for manual review", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scop-corrupt-state-")),
    c = { ...config, stateDirectory: dir },
    s = agent.store(c);
  let maintained = false,
    changes = 0;
  fs.writeFileSync(path.join(dir, "state.json"), "not-json-preserve-this");
  fs.writeFileSync(path.join(dir, "health.json"), "also-not-json");
  try {
    await agent.tick(c, {
      store: s,
      appToken: async () => {
        throw Error("OFFLINE");
      },
      io: {
        health: async () => assert.fail("unknown deployment cannot be trusted"),
        maintenanceStatus: async () => maintained,
        maintenance: async () => {
          maintained = true;
          changes++;
        },
      },
    });
    assert.equal(changes, 1);
    const r = JSON.parse(fs.readFileSync(path.join(dir, "health.json")));
    assert.equal(r.action, "MANUAL_STATE_JOURNAL_REVIEW_REQUIRED");
    assert.equal(r.maintenance, true);
    assert.equal(
      fs.readFileSync(path.join(dir, "state.json"), "utf8"),
      "not-json-preserve-this",
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("timed-out mutating Docker request is uncertain and cannot restart the previous worker generation", async () => {
  const f = fixture(),
    start = f.io.start;
  f.io.start = async (r) => {
    await start(r);
    const e = Error("DOCKER_CLIENT_TIMED_OUT");
    e.code = "ETIMEDOUT";
    throw e;
  };
  await assert.rejects(run(f), /UNCERTAIN/);
  assert.equal(f.store.control().activeOperation, "2:1");
  assert.deepEqual([...f.running], [f.m.commit]);
  assert.equal(f.effects.filter((x) => x[0] === "start").length, 1);
  const effects = f.effects.length;
  await assert.rejects(run(f), /INTERRUPTED/);
  assert.equal(f.effects.length, effects);
});
for (const kind of ["rollback", "recover"])
  test(`handled-record persistence failure after completed ${kind} cannot repeat its backend start`, async () => {
    const f = fixture(kind),
      record = await run(f),
      before = f.effects.length,
      dir = fs.mkdtempSync(path.join(os.tmpdir(), "scop-cache-failure-"));
    try {
      const bad = path.join(dir, "not-a-directory");
      fs.writeFileSync(bad, "occupied");
      assert.throws(() =>
        agent.outcomeCache({ ...config, stateDirectory: bad }, record),
      );
      assert.equal((await run(f)).status, "SUCCEEDED");
      assert.equal(f.effects.length, before);
      assert.equal(f.effects.filter((x) => x[0] === "start").length, 1);
      agent.outcomeCache({ ...config, stateDirectory: dir }, record);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
test("reviewed recovery to the preserved previous release retains the formerly active release for rollback", async () => {
  const f = fixture("recover");
  f.m = { ...manifest("a", 3, "recover"), kind: "wici-staging-request" };
  assert.equal((await run(f)).status, "SUCCEEDED");
  assert.equal(f.store.read().release.commit, "a".repeat(40));
  assert.equal(f.store.read().previous.commit, "c".repeat(40));
  const effects = f.effects.length;
  await run(f);
  assert.equal(f.effects.length, effects);
});
