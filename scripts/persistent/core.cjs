"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const policy = require("../../deploy/persistent/policy.json");
const sha = (data) => crypto.createHash("sha256").update(data).digest("hex");
function assert(value, code) {
  if (!value) throw Error(code);
}
function configuration(c, activated = true) {
  assert(
    c?.version === 1 && c.purpose === "wici-isolated-staging-v1",
    "STAGING_IDENTITY_REQUIRED",
  );
  assert(/^[a-z][a-z0-9-]{2,24}$/.test(c.instance), "INVALID_INSTANCE");
  assert(
    c.stateDirectory === "/var/lib/scop-staging",
    "FIXED_STAGING_STATE_ROOT_REQUIRED",
  );
  assert(
    /^[a-z][a-z0-9_]{3,50}$/.test(c.database) &&
      c.database.startsWith("scop_staging_"),
    "SYNTHETIC_DATABASE_REQUIRED",
  );
  assert(
    /^(?=.{1,200}$)(?:scop-)?staging\.[a-z0-9]+(?:[.-][a-z0-9]+)*\.[a-z]{2,63}$/.test(
      c.hostname,
    ) &&
      !/(?:wici-procurement\.org|supabase\.(?:com|co)|localhost)$/.test(
        c.hostname,
      ),
    "SEPARATE_STAGING_HOSTNAME_REQUIRED",
  );
  assert(policy.productionEnabled === false, "PRODUCTION_FORBIDDEN");
  if (activated) {
    assert(
      policy.externalActivationEnabled === true && c.enabled === true,
      "EXTERNAL_STAGING_HARD_DISABLED",
    );
    assert(
      c.databasePrepared === true &&
        /^[a-f0-9]{64}$/.test(c.isolationApprovalSha256 || ""),
      "DATABASE_AND_ISOLATION_ACCEPTANCE_REQUIRED",
    );
    assert(
      !c.hostname.endsWith(".invalid"),
      "REAL_APPROVED_STAGING_HOST_REQUIRED",
    );
  }
  return c;
}
function capsule(m) {
  assert(
    m?.kind === "wici-staging-capsule" && m.version === 1,
    "INVALID_CAPSULE",
  );
  assert(/^[a-f0-9]{40}$/.test(m.commit || ""), "IMMUTABLE_COMMIT_REQUIRED");
  for (const key of ["backend", "frontend"])
    assert(
      /^sha256:[a-f0-9]{64}$/.test(m.images?.[key] || ""),
      "IMAGE_ID_REQUIRED",
    );
  assert(
    /^[a-f0-9]{64}$/.test(m.archiveSha256 || ""),
    "IMAGE_ARCHIVE_DIGEST_REQUIRED",
  );
  assert(
    m.databaseContract === policy.databaseContract &&
      m.syntheticOnly === true &&
      m.productionAuthorized === false,
    "CAPSULE_SCOPE_INVALID",
  );
  assert(
    m.runtimeVerified?.status ===
      "DISPOSABLE_REHEARSAL_PASSED_NOT_ACTIVATION_APPROVAL" &&
      m.runtimeVerified.commit === m.commit &&
      m.runtimeVerified.database?.status === "DATABASE_READY" &&
      m.runtimeVerified.database.findings?.length === 0 &&
      m.runtimeVerified.cleanupFailures?.length === 0,
    "TESTED_RUNTIME_REQUIRED",
  );
  assert(
    !m.runtimeVerified.failure &&
      JSON.stringify(m.runtimeVerified.images) === JSON.stringify(m.images) &&
      JSON.stringify(m.runtimeVerified.sourceCi) === JSON.stringify(m.sourceCi),
    "RUNTIME_PROVENANCE_MISMATCH",
  );
  assert(
    m.runtimeVerified.scope === "AUTHENTICATED_CI_ARTIFACT_REHEARSAL" &&
      m.runtimeVerified.source?.gitCommit === m.commit &&
      m.runtimeVerified.source.dirty === false,
    "AUTHENTICATED_CLEAN_RUNTIME_REQUIRED",
  );
  assert(
    m.sourceCi?.commit === m.commit && Number.isSafeInteger(m.sourceCi.runId),
    "SOURCE_CI_REQUIRED",
  );
  assert(
    m.gateway?.commit === m.commit &&
      Number.isSafeInteger(m.gateway.runId) &&
      /^sha256:[a-f0-9]{64}$/.test(m.gateway.artifact?.digest || ""),
    "SAME_COMMIT_GATEWAY_EVIDENCE_REQUIRED",
  );
  assert(
    m.request?.runId &&
      m.request?.attempt &&
      /^[a-f0-9]{40}$/.test(m.request.workflowCommit || ""),
    "REQUEST_PROVENANCE_REQUIRED",
  );
  return m;
}
function atomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${crypto.randomBytes(8).toString("hex")}.tmp`;
  const fd = fs.openSync(temporary, "wx", 0o600);
  try {
    fs.writeFileSync(fd, JSON.stringify(value, null, 2) + "\n");
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(temporary, file);
  // Persistent host is Linux. Windows runs portability tests; Windows does not
  // support opening/fsyncing a directory through Node's ordinary file API.
  if (process.platform !== "win32") {
    const dir = fs.openSync(path.dirname(file), "r");
    try {
      fs.fsyncSync(dir);
    } finally {
      fs.closeSync(dir);
    }
  }
}
function journal(store, event, detail = {}) {
  const row = {
    version: 1,
    timestamp: new Date().toISOString(),
    event,
    ...detail,
  };
  store.append(row);
  return row;
}
// The Docker/HTTP adapter is explicit. This model never runs migrations. A prior
// backend is stopped before the candidate starts: workers cannot overlap.
async function deploy({ config, manifest, store, io }) {
  configuration(config, false);
  capsule(manifest);
  const old = store.read(),
    release = {
      commit: manifest.commit,
      images: manifest.images,
      sourceCi: manifest.sourceCi,
      request: manifest.request,
      manifest,
    };
  if (old?.recoveryContext || (old?.phase !== "ACTIVE" && old !== null))
    throw Error("INTERRUPTED_OPERATION_REQUIRES_REVIEWED_RECOVERY");
  if (old?.release.commit === release.commit) {
    assert(
      JSON.stringify(old.release.images) === JSON.stringify(release.images),
      "COMMIT_ALREADY_ACTIVE_WITH_DIFFERENT_IMAGES",
    );
    await io.health(old.release);
    try {
      await io.routeHealth(old.release);
    } catch {
      await io.route(old.release);
      await io.routeHealth(old.release);
    }
    return { status: "ALREADY_ACTIVE", release: old.release };
  }
  let maintenance = false,
    candidateStarted = false;
  journal(store, "REQUEST_VERIFIED", {
    commit: release.commit,
    previous: old?.release.commit || null,
  });
  try {
    await io.preflight(release); // read-only actual runtime role/schema/evidence gate
    await io.prepare(release);
    store.write({ phase: "PREPARED", release, previous: old?.release || null });
    maintenance = true;
    await io.maintenance();
    store.write({ phase: "HANDOFF", release, previous: old?.release || null });
    if (old) await io.stop(old.release);
    // adapter must verify the previous process exited before returning.
    candidateStarted = true;
    await io.start(release);
    await io.health(release);
    await io.route(release);
    await io.routeHealth(release);
    store.write({ phase: "ACTIVE", release, previous: old?.release || null });
    journal(store, "DEPLOYMENT_SUCCEEDED", { commit: release.commit });
    return { status: "DEPLOYED", release };
  } catch (error) {
    try {
      journal(store, "CANDIDATE_FAILED", {
        commit: release.commit,
        category: "DEPLOYMENT_FAILED",
      });
    } catch {
      /* recovery must still run if audit storage fails */
    }
    if (!maintenance) {
      store.write(old);
      journal(store, "OLD_RELEASE_UNCHANGED", {
        commit: old?.release.commit || null,
      });
      throw error;
    }
    try {
      if (candidateStarted) await io.stop(release);
      if (!old) throw Error("NO_PREVIOUS_RELEASE");
      await io.start(old.release);
      await io.health(old.release);
      await io.route(old.release);
      await io.routeHealth(old.release);
      store.write(old);
      journal(store, "PREVIOUS_RELEASE_RECOVERED", {
        commit: old.release.commit,
      });
    } catch {
      await io.maintenance();
      store.write({
        phase: "RECOVERY_REQUIRED",
        release,
        previous: old?.release || null,
      });
      journal(store, "RECOVERY_REQUIRED", { commit: release.commit });
      throw Error("STAGING_RECOVERY_REQUIRED_NOT_SUCCESSFUL");
    }
    throw Error("CANDIDATE_FAILED_PREVIOUS_RELEASE_RECOVERED");
  }
}
function unresolvedOperations(control) {
  const entries = Object.entries(control.operations || {});
  return entries
    .filter(([key, r]) => {
      assert(r && r.key === key, "CORRUPT_OPERATION_LEDGER");
      return (
        !r.resolvedBy &&
        (r.fenceRequired === true ||
          ["RUNNING", "UNCERTAIN"].includes(r.status))
      );
    })
    .map(([key]) => key);
}
function recoveryRequired(control) {
  return Boolean(
    control.activeOperation ||
      control.deployment?.recoveryContext ||
      unresolvedOperations(control).length,
  );
}
function validEpoch(value) {
  assert(
    typeof value === "string" &&
      /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value),
    "VERIFIED_HOST_EXECUTION_EPOCH_REQUIRED",
  );
  return value;
}
function recoveryOrigin(state) {
  const context = state?.recoveryContext;
  if (context) {
    assert(
      context.version === 1 &&
        context.origin &&
        context.originDigest === sha(JSON.stringify(context.origin)),
      "RECOVERY_CONTEXT_INTEGRITY_FAILED",
    );
    return context.origin;
  }
  assert(state?.release, "EXACT_RECORDED_RECOVERY_TARGET_REQUIRED");
  return {
    phase: state.phase,
    release: state.release,
    previous: state.previous || null,
  };
}
async function recover({
  config,
  commit,
  store,
  io,
  recoveryOperation,
  quiescence,
}) {
  configuration(config, false);
  assert(
    recoveryOperation?.identity?.operation === "recover" &&
      recoveryOperation.identity.commit === commit &&
      recoveryOperation.key ===
        `${recoveryOperation.identity.runId}:${recoveryOperation.identity.attempt}` &&
      recoveryOperation.digest ===
        sha(JSON.stringify(recoveryOperation.identity)),
    "BOUND_RECOVERY_OPERATION_REQUIRED",
  );
  const old = store.read(),
    origin = recoveryOrigin(old);
  const target =
    origin.phase === "ACTIVE" && origin.release.commit === commit
      ? origin.release
      : origin.previous?.commit === commit
        ? origin.previous
        : null;
  assert(target, "EXACT_RECORDED_RECOVERY_TARGET_REQUIRED");
  capsule(target.manifest);
  assert(typeof quiescence === "function", "VERIFIED_QUIESCENCE_REQUIRED");
  let context = {
    version: 1,
    origin: structuredClone(origin),
    originDigest: sha(JSON.stringify(origin)),
    originalActive: origin.phase === "ACTIVE" ? origin.release : null,
    originalPrevious: origin.previous,
    selectedTarget: target,
    operation: structuredClone(recoveryOperation),
    stage: "PREFLIGHT",
    uncertainty: { status: "UNRESOLVED" },
    attempts: [
      ...(old.recoveryContext?.attempts || []),
      {
        operation: structuredClone(recoveryOperation),
        target: target.commit,
        stage: "PREFLIGHT",
      },
    ],
  };
  const checkpoint = (stage, update = {}) => {
    // Retain both original references and the target until the terminal ledger
    // commit resolves the entire inherited fence. Never use previous as scratch.
    context = { ...context, stage, ...update };
    context.attempts.at(-1).stage = stage;
    store.write({ ...store.read(), recoveryContext: structuredClone(context) });
  };
  checkpoint("PREFLIGHT");
  journal(store, "RECOVERY_REQUEST_VERIFIED", {
    commit,
    operationKey: recoveryOperation.key,
  });
  await io.preflight(target);
  const proof = await quiescence();
  checkpoint("QUIESCENT", { quiescence: proof });
  await io.maintenance();
  store.write({
    ...store.read(),
    phase: "RECOVERY_REQUIRED",
    recoveryContext: { ...context, stage: "HANDOFF" },
  });
  // Context may outlive several interrupted attempts. Stop every recorded
  // generation, not just whichever references happened to survive the last one.
  const stop = new Map(
    [old.release, old.previous, origin.release, origin.previous, target]
      .filter(Boolean)
      .map((r) => [
        sha(JSON.stringify([r.commit, r.images, r.manifest.request])),
        r,
      ]),
  );
  for (const release of stop.values()) {
    checkpoint("STOPPING");
    await io.stop(release);
  }
  checkpoint("STARTING");
  await io.start(target);
  checkpoint("VERIFYING");
  await io.health(target);
  await io.route(target);
  await io.routeHealth(target);
  store.write({
    phase: "ACTIVE",
    release: target,
    previous:
      origin.phase === "ACTIVE"
        ? target.commit === origin.release.commit
          ? origin.previous
          : origin.release
        : null,
    recoveryContext: { ...context, stage: "VERIFIED_AWAITING_TERMINAL_COMMIT" },
  });
  journal(store, "REVIEWED_RECOVERY_SUCCEEDED", { commit });
  return { status: "RECOVERED", quiescence: proof };
}

function operationIdentity(manifest, provenance) {
  const request = manifest.request;
  for (const value of [
    request?.runId,
    request?.attempt,
    provenance?.deploymentId,
    provenance?.artifactId,
  ])
    assert(
      /^[1-9][0-9]*$/.test(String(value)) &&
        Number.isSafeInteger(Number(value)),
      "EXACT_OPERATION_PROVENANCE_REQUIRED",
    );
  assert(
    /^[a-f0-9]{40}$/.test(request.workflowCommit) &&
      /^[a-f0-9]{40}$/.test(manifest.commit),
    "IMMUTABLE_OPERATION_REQUIRED",
  );
  assert(
    ["deploy", "rollback", "recover"].includes(manifest.operation),
    "UNSUPPORTED_REQUEST_OPERATION",
  );
  assert(
    /^sha256:[a-f0-9]{64}$/.test(provenance.artifactDigest),
    "AUTHENTICATED_REQUEST_DIGEST_REQUIRED",
  );
  const identity = {
    runId: String(request.runId),
    attempt: String(request.attempt),
    operation: manifest.operation,
    commit: manifest.commit,
    workflowCommit: request.workflowCommit,
    artifactId: String(provenance.artifactId),
    artifactDigest: provenance.artifactDigest,
  };
  return {
    key: `${identity.runId}:${identity.attempt}`,
    identity,
    digest: sha(JSON.stringify(identity)),
  };
}
// The deployment and command ledger share ONE fsynced atomic state replacement.
// Docker effects cannot be transacted with a file: an interrupted effect is
// deliberately uncertain, never blindly repeated. Only a fresh approved recover
// can supersede it. External status delivery is at-least-once, not exactly-once.
async function operation({ config, manifest, provenance, store, io }) {
  const id = operationIdentity(manifest, provenance);
  let control = store.control();
  const recorded = control.operations[id.key];
  if (recorded) {
    assert(recorded.digest === id.digest, "OPERATION_IDENTITY_REUSED");
    assert(
      ["SUCCEEDED", "FAILED"].includes(recorded.status),
      "INTERRUPTED_OPERATION_REQUIRES_REVIEWED_RECOVERY",
    );
    return recorded;
  }
  const inherited = unresolvedOperations(control);
  if (recoveryRequired(control)) {
    assert(
      manifest.operation === "recover",
      "PREVIOUS_OPERATION_REQUIRES_REVIEWED_RECOVERY",
    );
    if (control.activeOperation)
      assert(
        control.operations[control.activeOperation],
        "CORRUPT_OPERATION_LEDGER",
      );
  }
  assert(
    typeof io.executionEpoch === "function",
    "VERIFIED_HOST_EXECUTION_EPOCH_REQUIRED",
  );
  const executionEpoch = validEpoch(await io.executionEpoch());
  const timestamp = () => new Date().toISOString();
  const record = {
    ...id,
    status: "RUNNING",
    stage: "CLAIMED",
    deploymentId: provenance.deploymentId,
    executionProtocol: 2,
    executionEpoch,
    pendingEffect: null,
    fenceRequired: true,
    inheritedUncertainty: inherited,
    createdAt: timestamp(),
    transitions: [],
    acknowledgmentPending: true,
  };
  control = structuredClone(control);
  for (const key of inherited) {
    const prior = control.operations[key];
    if (prior.status === "RUNNING") prior.status = "UNCERTAIN";
    prior.recoveryAttempts = [...(prior.recoveryAttempts || []), id.key];
  }
  control.operations[id.key] = record;
  control.activeOperation = id.key;
  // Must succeed before preflight, prepare, maintenance or container operations.
  store.commit(control);
  let storageFault = false,
    effectUncertain = false;
  const transition = (stage, deployment, pendingUpdate) => {
    assert(
      !storageFault && !effectUncertain,
      "OPERATION_EFFECT_OR_STORAGE_UNCERTAIN",
    );
    control = store.control();
    assert(control.activeOperation === id.key, "OPERATION_OWNERSHIP_CHANGED");
    const next = structuredClone(control);
    if (deployment !== undefined) next.deployment = deployment;
    const r = next.operations[id.key];
    r.stage = stage;
    if (pendingUpdate !== undefined) r.pendingEffect = pendingUpdate;
    if (
      deployment === undefined &&
      next.deployment?.recoveryContext?.operation.key === id.key
    )
      next.deployment.recoveryContext.stage = stage;
    r.transitions.push({ stage, at: timestamp() });
    try {
      store.commit(next);
    } catch (e) {
      storageFault = true;
      throw e;
    }
  };
  const guarded = Object.fromEntries(
    Object.entries(io).map(([name, fn]) => [
      name,
      async (...args) => {
        const mutating = [
          "prepare",
          "maintenance",
          "stop",
          "start",
          "route",
        ].includes(name);
        transition(
          `BEFORE_${name}`,
          undefined,
          mutating ? { name, executionEpoch, at: timestamp() } : undefined,
        );
        let result;
        try {
          result = await fn(...args);
        } catch (error) {
          // An error/closed connection is not a cancellation acknowledgment.
          // Preserve pendingEffect until a different verified host boot proves
          // old Docker processes/requests cannot run after reviewed recovery.
          if (mutating) effectUncertain = true;
          throw error;
        }
        transition(`AFTER_${name}`, undefined, mutating ? null : undefined);
        return result;
      },
    ]),
  );
  const businessStore = {
    read: () => store.read(),
    write: (value) =>
      transition(
        value?.recoveryContext
          ? `RECOVERY_${value.recoveryContext.stage}`
          : value?.phase || "EMPTY",
        value,
      ),
    append: (row) => store.append({ ...row, operationKey: id.key }),
  };
  const proveQuiescence = async () => {
    const observedEpoch = validEpoch(await guarded.executionEpoch());
    assert(
      observedEpoch === executionEpoch,
      "HOST_EXECUTION_EPOCH_CHANGED_DURING_OPERATION",
    );
    let observed = store.control(),
      needsRestart = false;
    const proof = {
      version: 1,
      recoveryOperation: id.key,
      recoveryDigest: id.digest,
      observedEpoch,
      operations: [],
    };
    for (const key of inherited) {
      const prior = observed.operations[key];
      assert(
        prior &&
          !prior.resolvedBy &&
          prior.digest === sha(JSON.stringify(prior.identity)),
        "UNCERTAINTY_HISTORY_CHANGED",
      );
      if (
        prior.executionProtocol === 2 &&
        Object.hasOwn(prior, "pendingEffect") &&
        prior.executionEpoch
      ) {
        validEpoch(prior.executionEpoch);
        assert(
          prior.pendingEffect === null ||
            (prior.pendingEffect &&
              typeof prior.pendingEffect === "object" &&
              ["prepare", "maintenance", "stop", "start", "route"].includes(
                prior.pendingEffect.name,
              )),
          "CORRUPT_PENDING_EFFECT",
        );
        if (prior.pendingEffect) {
          assert(
            prior.pendingEffect.executionEpoch === prior.executionEpoch,
            "CORRUPT_PENDING_EFFECT",
          );
          if (prior.executionEpoch === observedEpoch) needsRestart = true;
        }
        proof.operations.push({
          key,
          digest: prior.digest,
          method: prior.pendingEffect
            ? "HOST_BOOT_CHANGED"
            : "DURABLY_ACKNOWLEDGED_EFFECTS",
          sourceEpoch: prior.executionEpoch,
        });
      } else {
        // Legacy records never receive invented execution evidence. Observe a
        // barrier now, then require a separately authorized cold host restart.
        observed.quiescenceBarriers ||= {};
        let barrier = observed.quiescenceBarriers[key];
        if (!barrier || barrier.digest !== prior.digest) {
          barrier = { digest: prior.digest, observedEpoch, at: timestamp() };
          observed.quiescenceBarriers[key] = barrier;
          try {
            store.commit(observed);
          } catch (error) {
            storageFault = true;
            throw error;
          }
        }
        validEpoch(barrier.observedEpoch);
        if (barrier.observedEpoch === observedEpoch) needsRestart = true;
        proof.operations.push({
          key,
          digest: prior.digest,
          method: "REVIEW_BARRIER_HOST_BOOT_CHANGED",
          sourceEpoch: barrier.observedEpoch,
        });
      }
    }
    assert(!needsRestart, "REVIEWED_HOST_RESTART_REQUIRED_TO_QUIESCE_DOCKER");
    return proof;
  };
  let result, error;
  try {
    if (manifest.operation === "recover") {
      result = await recover({
        config,
        commit: manifest.commit,
        store: businessStore,
        io: guarded,
        recoveryOperation: id,
        quiescence: proveQuiescence,
      });
    } else {
      let selected = manifest;
      if (manifest.operation === "rollback") {
        const old = store.read();
        assert(
          old?.phase === "ACTIVE" && old.previous?.commit === manifest.commit,
          "ROLLBACK_MUST_SELECT_PRESERVED_PREVIOUS_RELEASE",
        );
        selected = old.previous.manifest;
      }
      result = await deploy({
        config,
        manifest: selected,
        store: businessStore,
        io: guarded,
      });
    }
  } catch (e) {
    error = e;
  }
  // A failed state write, abrupt interruption or unresolved handoff cannot be
  // converted into a known failure/success. Keep the durable claim fenced.
  if (storageFault || effectUncertain || error?.simulatedCrash)
    throw Error("OPERATION_OUTCOME_UNCERTAIN_REVIEW_REQUIRED");
  if (!error) {
    assert(
      validEpoch(await io.executionEpoch()) === executionEpoch,
      "HOST_EXECUTION_EPOCH_CHANGED_DURING_OPERATION",
    );
  }
  control = store.control();
  assert(control.activeOperation === id.key, "OPERATION_OWNERSHIP_CHANGED");
  const next = structuredClone(control),
    terminal = next.operations[id.key];
  terminal.status = error
    ? next.deployment && next.deployment.phase !== "ACTIVE"
      ? "UNCERTAIN"
      : "FAILED"
    : "SUCCEEDED";
  terminal.stage = terminal.status;
  terminal.outcome = result?.status || "OPERATION_FAILED_REVIEW_JOURNAL";
  terminal.completedAt = timestamp();
  terminal.fenceRequired =
    !!error &&
    (manifest.operation === "recover" || terminal.status === "UNCERTAIN");
  terminal.transitions.push({
    stage: terminal.status,
    at: terminal.completedAt,
  });
  if (!error && manifest.operation === "recover") {
    const proof = result.quiescence;
    assert(
      next.deployment?.phase === "ACTIVE" &&
        next.deployment.recoveryContext?.operation.digest === id.digest,
      "RECOVERY_CONTEXT_INTEGRITY_FAILED",
    );
    assert(
      proof?.recoveryOperation === id.key &&
        proof.recoveryDigest === id.digest &&
        proof.observedEpoch === executionEpoch,
      "VERIFIED_QUIESCENCE_REQUIRED",
    );
    assert(
      JSON.stringify(proof.operations.map((r) => r.key)) ===
        JSON.stringify(inherited),
      "INCOMPLETE_QUIESCENCE_PROOF",
    );
    for (const key of inherited) {
      const prior = next.operations[key];
      prior.resolvedBy = id.key;
      prior.supersededBy = id.key;
      prior.resolution = { at: terminal.completedAt, proof };
    }
    terminal.recoveryContext = {
      ...next.deployment.recoveryContext,
      stage: "RESOLVED",
      uncertainty: { status: "RESOLVED" },
      resolvedAt: terminal.completedAt,
      quiescence: proof,
    };
    delete next.deployment.recoveryContext;
  }
  const remaining = unresolvedOperations(next);
  next.activeOperation = remaining.at(-1) || null;
  // This commit precedes the handled-file cache and GitHub acknowledgment. A
  // crash on either side never permits a second execution of this identity.
  store.commit(next);
  return terminal;
}
module.exports = {
  assert,
  sha,
  configuration,
  capsule,
  atomic,
  journal,
  deploy,
  recover,
  operationIdentity,
  operation,
  unresolvedOperations,
  recoveryRequired,
  validEpoch,
};
