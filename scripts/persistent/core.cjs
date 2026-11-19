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
  if (old?.phase !== "ACTIVE" && old !== null)
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
async function recover({ config, commit, store, io }) {
  configuration(config, false);
  const old = store.read();
  const target =
    old?.phase === "ACTIVE" && old.release.commit === commit
      ? old.release
      : old?.previous?.commit === commit
        ? old.previous
        : null;
  assert(target, "EXACT_RECORDED_RECOVERY_TARGET_REQUIRED");
  capsule(target.manifest);
  journal(store, "RECOVERY_REQUEST_VERIFIED", { commit });
  await io.preflight(target);
  await io.maintenance();
  store.write({
    phase: "RECOVERY_REQUIRED",
    release: old.release,
    previous: target,
  });
  const stop = new Map(
    [old.release, old.previous].filter(Boolean).map((r) => [r.commit, r]),
  );
  for (const release of stop.values()) await io.stop(release);
  await io.start(target);
  await io.health(target);
  await io.route(target);
  await io.routeHealth(target);
  store.write({
    phase: "ACTIVE",
    release: target,
    previous:
      old.phase === "ACTIVE"
        ? target.commit === old.release.commit
          ? old.previous
          : old.release
        : null,
  });
  journal(store, "REVIEWED_RECOVERY_SUCCEEDED", { commit });
  return { status: "RECOVERED" };
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
  if (control.activeOperation) {
    assert(
      manifest.operation === "recover",
      "PREVIOUS_OPERATION_REQUIRES_REVIEWED_RECOVERY",
    );
    assert(
      control.operations[control.activeOperation],
      "CORRUPT_OPERATION_LEDGER",
    );
  }
  const timestamp = () => new Date().toISOString();
  const previousOperation = control.activeOperation;
  const record = {
    ...id,
    status: "RUNNING",
    stage: "CLAIMED",
    deploymentId: provenance.deploymentId,
    createdAt: timestamp(),
    transitions: [],
    acknowledgmentPending: true,
  };
  control = structuredClone(control);
  if (previousOperation) {
    control.operations[previousOperation].status = "UNCERTAIN";
    control.operations[previousOperation].supersededBy = id.key;
  }
  control.operations[id.key] = record;
  control.activeOperation = id.key;
  // Must succeed before preflight, prepare, maintenance or container operations.
  store.commit(control);
  let storageFault = false,
    effectUncertain = false;
  const transition = (stage, deployment) => {
    assert(
      !storageFault && !effectUncertain,
      "OPERATION_EFFECT_OR_STORAGE_UNCERTAIN",
    );
    control = store.control();
    const next = structuredClone(control);
    if (deployment !== undefined) next.deployment = deployment;
    const r = next.operations[id.key];
    r.stage = stage;
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
        transition(`BEFORE_${name}`);
        let result;
        try {
          result = await fn(...args);
        } catch (error) {
          // Killing/timing out the Docker CLI does not prove the daemon aborted
          // a mutating request. Never restart another worker generation while
          // such an effect may still be in flight.
          if (
            ["prepare", "maintenance", "stop", "start", "route"].includes(
              name,
            ) &&
            (error.code === "ETIMEDOUT" || error.signal || error.killed)
          )
            effectUncertain = true;
          throw error;
        }
        transition(`AFTER_${name}`);
        return result;
      },
    ]),
  );
  const businessStore = {
    read: () => store.read(),
    write: (value) => transition(value?.phase || "EMPTY", value),
    append: (row) => store.append({ ...row, operationKey: id.key }),
  };
  let result, error;
  try {
    if (manifest.operation === "recover") {
      result = await recover({
        config,
        commit: manifest.commit,
        store: businessStore,
        io: guarded,
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
  control = store.control();
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
  terminal.transitions.push({
    stage: terminal.status,
    at: terminal.completedAt,
  });
  next.activeOperation = terminal.status === "UNCERTAIN" ? id.key : null;
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
};
