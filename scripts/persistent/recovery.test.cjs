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
  let fault,
    epoch = "00000000-0000-0000-0000-000000000001";
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
  io.executionEpoch = async () => epoch;
  return {
    advanceEpoch: () => {
      epoch = epoch.replace(/([0-9]+)$/, (n) =>
        String(Number(n) + 1).padStart(n.length, "0"),
      );
    },
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
  f.advanceEpoch(); // separately reviewed host restart, never a controller restart
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
        executionEpoch: async () => "00000000-0000-0000-0000-000000000001",
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

// These faults model lost durability acknowledgments and Docker calls that may
// still complete. Epoch advancement is an explicit test-only host reboot, never
// an automatic controller retry or a claim inferred from container state.
function reviewed(letter, runId) {
  return {
    ...manifest(letter, runId, "recover"),
    kind: "wici-staging-request",
  };
}
function crash() {
  return Object.assign(Error("SIMULATED_PROCESS_LOSS"), {
    simulatedCrash: true,
  });
}
async function ordinaryMustStayFenced(f) {
  const before = f.effects.length;
  await assert.rejects(run(f, manifest("d", 900)), /PREVIOUS_OPERATION/);
  assert.equal(f.effects.length, before);
}
for (const target of ["c", "a"])
  for (const stage of [
    "RECOVERY_HANDOFF",
    "BEFORE_stop",
    "AFTER_stop",
    "BEFORE_start",
    "AFTER_start",
    "AFTER_route",
    "RECOVERY_VERIFIED_AWAITING_TERMINAL_COMMIT",
  ])
    test(`P1 context: target ${target} survives interruption at ${stage}`, async () => {
      const f = fixture("recover");
      f.m = reviewed(target, 3);
      let injected = false;
      f.setFault((side, value, actualStage) => {
        if (!injected && side === "after" && actualStage === stage) {
          injected = true;
          throw crash();
        }
      });
      await assert.rejects(run(f), /UNCERTAIN/);
      assert.equal(injected, true);
      f.setFault(null);
      const ctl = f.store.control(),
        ctx = ctl.deployment.recoveryContext;
      assert.equal(ctx.originalActive.commit, "c".repeat(40));
      assert.equal(ctx.originalPrevious.commit, "a".repeat(40));
      assert.equal(ctx.selectedTarget.commit, target.repeat(40));
      assert.equal(ctx.operation.key, "3:1");
      assert.equal(ctx.uncertainty.status, "UNRESOLVED");
      assert.equal(ctx.originDigest, core.sha(JSON.stringify(ctx.origin)));
      if (stage === "RECOVERY_HANDOFF") {
        assert.equal(ctl.deployment.release.commit, "c".repeat(40));
        assert.equal(ctl.deployment.previous.commit, "a".repeat(40));
        assert.equal(f.effects.filter((x) => x[0] === "start").length, 0);
      }
      await ordinaryMustStayFenced(f);
      // Only an unacknowledged mutation needs host quiescence. Completed calls
      // whose acknowledgment was durably stored need no fabricated reboot.
      if (ctl.operations["3:1"].pendingEffect) f.advanceEpoch();
      const result = await run(f, reviewed("a", 4));
      assert.equal(result.status, "SUCCEEDED");
      const done = f.store.control();
      assert.equal(done.deployment.release.commit, "a".repeat(40));
      assert.equal(done.deployment.previous.commit, "c".repeat(40));
      assert.equal(done.deployment.recoveryContext, undefined);
      assert.equal(done.operations["3:1"].resolvedBy, "4:1");
      assert.equal(
        done.operations["4:1"].recoveryContext.originalPrevious.commit,
        "a".repeat(40),
      );
      assert.equal(
        done.operations["4:1"].recoveryContext.uncertainty.status,
        "RESOLVED",
      );
      assert.equal(done.activeOperation, null);
      const effects = f.effects.length;
      assert.equal((await run(f, reviewed("a", 4))).status, "SUCCEEDED");
      assert.equal(f.effects.length, effects);
    });

async function pendingRoute(f) {
  const route = f.io.route;
  f.io.route = async () => {
    throw Object.assign(Error("DOCKER_TIMEOUT_STILL_PENDING"), {
      code: "ETIMEDOUT",
    });
  };
  await assert.rejects(run(f), /UNCERTAIN/);
  f.io.route = route;
  assert.equal(f.store.control().operations["2:1"].pendingEffect.name, "route");
}
test("P1 fence: invalid target and repeated failed preflights cannot supersede old uncertain Docker work", async () => {
  const f = fixture();
  await pendingRoute(f);
  const preflight = f.io.preflight;
  for (const [runId, target] of [
    [4, "f"],
    [5, "a"],
    [6, "a"],
  ]) {
    f.io.preflight = async () => {
      throw Error("DATABASE_PREFLIGHT_FAILED");
    };
    assert.equal((await run(f, reviewed(target, runId))).status, "UNCERTAIN");
    await ordinaryMustStayFenced(f);
    const c = f.store.control();
    assert.equal(c.operations["2:1"].resolvedBy, undefined);
    assert.equal(c.operations["2:1"].supersededBy, undefined);
    assert.equal(c.operations[`${runId}:1`].fenceRequired, true);
  }
  f.io.preflight = preflight;
  f.advanceEpoch();
  assert.equal((await run(f, reviewed("a", 7))).status, "SUCCEEDED");
  const c = f.store.control();
  for (const key of ["2:1", "4:1", "5:1", "6:1"])
    assert.equal(c.operations[key].resolvedBy, "7:1");
  assert.equal(c.activeOperation, null);
});
test("P1 fence: ACTIVE deployment does not release inherited uncertainty after preflight fails", async () => {
  const f = fixture("recover");
  // State after a route timeout may still say ACTIVE. The uncertain ledger,
  // rather than the deployment phase, remains the source of the fence.
  const c = f.store.control();
  const id = core.operationIdentity(manifest("c", 2), provenance);
  c.operations[id.key] = {
    ...id,
    status: "UNCERTAIN",
    executionProtocol: 2,
    executionEpoch: await f.io.executionEpoch(),
    pendingEffect: {
      name: "route",
      executionEpoch: await f.io.executionEpoch(),
    },
    fenceRequired: true,
  };
  c.activeOperation = id.key;
  f.store.commit(c);
  f.io.preflight = async () => {
    throw Error("DATABASE_PREFLIGHT_FAILED");
  };
  assert.equal((await run(f, reviewed("c", 3))).status, "FAILED");
  assert.equal(f.store.read().phase, "ACTIVE");
  await ordinaryMustStayFenced(f);
  assert.deepEqual(core.unresolvedOperations(f.store.control()), [
    "2:1",
    "3:1",
  ]);
});
test("P1 fence: delayed old route cannot be declared resolved by retries on the same host boot", async () => {
  const f = fixture();
  let pending,
    actualRoute = "a";
  const route = f.io.route;
  f.io.route = async () => {
    pending = () => {
      actualRoute = "stale-delayed-route";
    };
    throw Error("LOST_DOCKER_REPLY");
  };
  await assert.rejects(run(f), /UNCERTAIN/);
  f.io.route = async (r) => {
    await route(r);
    actualRoute = r.commit[0];
  };
  const starts = f.effects.filter((x) => x[0] === "start").length;
  for (const runId of [4, 5]) {
    assert.equal((await run(f, reviewed("a", runId))).status, "UNCERTAIN");
    assert.equal(f.effects.filter((x) => x[0] === "start").length, starts);
    assert.equal(f.store.control().operations["2:1"].resolvedBy, undefined);
    await ordinaryMustStayFenced(f);
  }
  pending(); // Timeout was NOT cancellation; the old effect really can arrive.
  assert.equal(actualRoute, "stale-delayed-route");
  assert.equal(core.recoveryRequired(f.store.control()), true);
  // Separately authorized host reboot kills pending old-kernel work. A fresh
  // reviewed operation can then reconcile the recorded releases and real route.
  f.advanceEpoch();
  pending = null;
  assert.equal((await run(f, reviewed("a", 6))).status, "SUCCEEDED");
  assert.equal(actualRoute, "a");
  assert.equal(pending, null);
  assert.equal(
    f.store.control().operations["2:1"].resolution.proof.operations[0].method,
    "HOST_BOOT_CHANGED",
  );
});
for (const failure of ["maintenance", "stop", "start", "routeHealth"])
  test(`P1 fence: failed recovery ${failure} retains context, history and ordinary-deploy fence`, async () => {
    const f = fixture("recover"),
      original = f.io[failure];
    f.io[failure] = async () => {
      throw Error("RECOVERY_EFFECT_FAILED");
    };
    if (failure === "routeHealth")
      assert.equal((await run(f)).status, "UNCERTAIN");
    else await assert.rejects(run(f), /UNCERTAIN/);
    await ordinaryMustStayFenced(f);
    assert.equal(
      f.store.read().recoveryContext.originalPrevious.commit,
      "a".repeat(40),
    );
    assert.equal(f.store.control().operations["3:1"].resolvedBy, undefined);
    f.io[failure] = original;
    if (f.store.control().operations["3:1"].pendingEffect) f.advanceEpoch();
    assert.equal((await run(f, reviewed("a", 4))).status, "SUCCEEDED");
  });
test("P1 fence: legacy uncertainty requires observed barrier followed by a host boot change", async () => {
  const f = fixture("recover"),
    c = f.store.control(),
    id = core.operationIdentity(manifest("c", 2), provenance);
  c.operations[id.key] = { ...id, status: "UNCERTAIN" };
  c.activeOperation = id.key;
  f.store.commit(c);
  for (const runId of [3, 4]) {
    assert.equal((await run(f, reviewed("a", runId))).status, "FAILED");
    assert.equal(f.store.control().operations["2:1"].executionEpoch, undefined);
    await ordinaryMustStayFenced(f);
  }
  assert.equal(f.store.control().quiescenceBarriers["2:1"].digest, id.digest);
  f.advanceEpoch();
  assert.equal((await run(f, reviewed("a", 5))).status, "SUCCEEDED");
});
test("P1 context: tampered recovery origin fails closed without container mutations", async () => {
  const f = fixture("recover");
  f.setFault((side, v, stage) => {
    if (side === "after" && stage === "RECOVERY_HANDOFF") throw crash();
  });
  await assert.rejects(run(f));
  f.setFault(null);
  const c = f.store.control();
  c.deployment.recoveryContext.origin.previous.commit = "f".repeat(40);
  f.store.commit(c);
  const effects = f.effects.length;
  assert.equal((await run(f, reviewed("a", 4))).status, "UNCERTAIN");
  assert.equal(f.effects.length, effects);
  await ordinaryMustStayFenced(f);
});
test("P1 context: exact original checkpoint reproduction retains C and previous A", async () => {
  const f = fixture("recover");
  let injected = false;
  f.setFault((side, v, stage) => {
    if (
      !injected &&
      side === "after" &&
      ["RECOVERY_REQUIRED", "RECOVERY_HANDOFF"].includes(stage)
    ) {
      injected = true;
      throw crash();
    }
  });
  await assert.rejects(run(f));
  f.setFault(null);
  assert.equal(injected, true);
  assert.equal(f.store.read().release.commit, "c".repeat(40));
  assert.equal(f.store.read().previous.commit, "a".repeat(40));
  assert.equal(f.effects.filter((x) => x[0] === "start").length, 0);
  assert.equal((await run(f, reviewed("a", 4))).status, "SUCCEEDED");
});
test("P1 fence: local maintenance timeout is durable, not automatically retried, and fences later deployments", async () => {
  const f = fixture("recover"),
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "scop-monitor-fence-"));
  let reloads = 0;
  const io = {
    ...f.io,
    health: async () => {
      throw Error("UNHEALTHY");
    },
    maintenanceStatus: async () => false,
    maintenance: async () => {
      reloads++;
      throw Error("DOCKER_TIMEOUT");
    },
  };
  try {
    for (let i = 0; i < 2; i++) {
      const health = await agent.reconcileLocal(
        { ...config, stateDirectory: dir },
        { store: f.store, io },
      );
      assert.equal(health.action, "MANUAL_GATEWAY_INTERVENTION_REQUIRED");
    }
    assert.equal(reloads, 1);
    assert.equal(core.unresolvedOperations(f.store.control()).length, 1);
    await ordinaryMustStayFenced(f);
    assert.equal((await run(f, reviewed("a", 3))).status, "FAILED");
    f.advanceEpoch();
    assert.equal((await run(f, reviewed("a", 4))).status, "SUCCEEDED");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("host execution epoch is required, validated and read from the fixed trusted mount", async () => {
  const { adapter } = require("./runtime.cjs"),
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "scop-epoch-")),
    file = path.join(dir, "boot-id");
  try {
    const io = adapter(config, { executionEpochFile: file });
    await assert.rejects(io.executionEpoch(), /ENOENT/);
    fs.writeFileSync(file, "controller-restarted");
    await assert.rejects(io.executionEpoch(), /VERIFIED_HOST_EXECUTION_EPOCH/);
    fs.writeFileSync(file, "00000000-0000-0000-0000-000000000001\n");
    assert.equal(
      await io.executionEpoch(),
      "00000000-0000-0000-0000-000000000001",
    );
    assert.equal(
      await adapter(config, { executionEpochFile: file }).executionEpoch(),
      await io.executionEpoch(),
    );
    const compose = fs.readFileSync(
      path.join(__dirname, "../../deploy/persistent/compose.yaml"),
      "utf8",
    );
    assert.match(
      compose,
      /\/proc\/sys\/kernel\/random\/boot_id:\/run\/scop-host-boot-id:ro/,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("P1 fence: a second uncertain recovery mutation needs a new reviewed host boundary", async () => {
  const f = fixture();
  await pendingRoute(f);
  f.advanceEpoch();
  const start = f.io.start;
  f.io.start = async (r) => {
    await start(r);
    throw Error("SECOND_LOST_REPLY");
  };
  await assert.rejects(run(f, reviewed("a", 4)), /UNCERTAIN/);
  f.io.start = start;
  const starts = f.effects.filter((x) => x[0] === "start").length;
  assert.equal((await run(f, reviewed("a", 5))).status, "UNCERTAIN");
  assert.equal(f.effects.filter((x) => x[0] === "start").length, starts);
  assert.equal(f.store.control().operations["2:1"].resolvedBy, undefined);
  f.advanceEpoch();
  assert.equal((await run(f, reviewed("a", 6))).status, "SUCCEEDED");
  for (const key of ["2:1", "4:1", "5:1"])
    assert.equal(f.store.control().operations[key].resolvedBy, "6:1");
});
for (const side of ["before", "after"])
  test(`P1 fence: terminal ${side}-write failure atomically preserves context or records full resolution`, async () => {
    const f = fixture("recover");
    f.setFault((when, v, stage) => {
      if (when === side && stage === "SUCCEEDED") throw crash();
    });
    await assert.rejects(run(f));
    f.setFault(null);
    const c = f.store.control();
    if (side === "before") {
      assert.equal(
        c.deployment.recoveryContext.originalPrevious.commit,
        "a".repeat(40),
      );
      assert.equal(c.activeOperation, "3:1");
      await ordinaryMustStayFenced(f);
      assert.equal((await run(f, reviewed("a", 4))).status, "SUCCEEDED");
    } else {
      assert.equal(c.deployment.recoveryContext, undefined);
      assert.equal(c.activeOperation, null);
      const before = f.effects.length;
      assert.equal((await run(f)).status, "SUCCEEDED");
      assert.equal(f.effects.length, before);
    }
  });
for (const malformed of [false, {}, "acknowledged"])
  test(`P1 fence: malformed pending-effect evidence ${JSON.stringify(malformed)} cannot prove quiescence`, async () => {
    const f = fixture();
    await pendingRoute(f);
    f.advanceEpoch();
    const c = f.store.control();
    c.operations["2:1"].pendingEffect = malformed;
    f.store.commit(c);
    const effects = f.effects.filter((x) =>
      ["start", "route"].includes(x[0]),
    ).length;
    assert.equal((await run(f, reviewed("a", 4))).status, "UNCERTAIN");
    assert.equal(
      f.effects.filter((x) => ["start", "route"].includes(x[0])).length,
      effects,
    );
    await ordinaryMustStayFenced(f);
    assert.equal(f.store.control().operations["2:1"].resolvedBy, undefined);
  });
test("P1 fence: malformed legacy barrier cannot replace an observed host epoch", async () => {
  const f = fixture("recover"),
    c = f.store.control(),
    id = core.operationIdentity(manifest("c", 2), provenance);
  c.operations[id.key] = { ...id, status: "UNCERTAIN" };
  c.activeOperation = id.key;
  c.quiescenceBarriers = { [id.key]: { digest: id.digest } };
  f.store.commit(c);
  const before = f.effects.length;
  assert.equal((await run(f, reviewed("a", 3))).status, "FAILED");
  assert.equal(f.effects.length, before + 1); // read-only DB preflight only
  await ordinaryMustStayFenced(f);
  assert.equal(f.store.control().operations["2:1"].resolvedBy, undefined);
});
