"use strict";
// Pull-only staging host entrypoint. No listening management endpoint or SSH.
const fs = require("node:fs"),
  path = require("node:path"),
  { execFileSync } = require("node:child_process");
const core = require("./core.cjs"),
  policy = require("../../deploy/persistent/policy.json"),
  gh = require("./github.cjs"),
  runtime = require("./runtime.cjs");
function store(c) {
  const file = path.join(c.stateDirectory, "state.json");
  const control = () => {
    const value = fs.existsSync(file)
      ? JSON.parse(fs.readFileSync(file))
      : null;
    if (value?.version === 2) {
      core.assert(
        value.operations && typeof value.operations === "object",
        "CORRUPT_OPERATION_LEDGER",
      );
      return value;
    }
    // Read legacy disabled-infrastructure state without discarding a release.
    return {
      version: 2,
      deployment: value,
      operations: {},
      activeOperation: null,
    };
  };
  return {
    control,
    commit: (value) => core.atomic(file, value),
    read: () => control().deployment,
    write: (value) => core.atomic(file, { ...control(), deployment: value }),
    append: (row) => {
      const fd = fs.openSync(
        path.join(c.stateDirectory, "audit.jsonl"),
        "a",
        0o600,
      );
      try {
        fs.writeSync(fd, JSON.stringify(row) + "\n");
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
    },
  };
}
async function execute(
  config,
  manifest,
  s,
  provenance,
  io = runtime.adapter(config),
) {
  return core.operation({ config, manifest, provenance, store: s, io });
}
function outcomeCache(c, record) {
  const file = path.join(
    c.stateDirectory,
    `handled-${record.identity.runId}-${record.identity.attempt}.json`,
  );
  core.atomic(file, {
    operationKey: record.key,
    status:
      record.status === "SUCCEEDED"
        ? "success"
        : record.status === "FAILED"
          ? "failure"
          : "error",
    commit: record.identity.commit,
    outcome: record.outcome || "APPROVED_RECOVERY_REQUIRED",
    deploymentId: record.deploymentId,
    statusPending: record.acknowledgmentPending,
  });
  return file;
}

async function once(c, dependencies = {}) {
  core.configuration(c);
  const s = dependencies.store || store(c),
    token = dependencies.token || (await gh.appToken(c)),
    api = dependencies.api || gh.transport(token);
  const data = await api(
    "/actions/workflows/staging-persistent.yml/runs?status=success&branch=master&per_page=20",
  );
  const run = data.workflow_runs?.find(
    (r) => r.status === "completed" && r.conclusion === "success",
  );
  if (!run) return;
  const handled = path.join(
    c.stateDirectory,
    `handled-${run.id}-${run.run_attempt}.json`,
  );
  const key = `${run.id}:${run.run_attempt}`;
  const recorded = s.control().operations[key];
  if (recorded) {
    // The authoritative ledger survives loss of the handled-file cache. Never
    // download artifacts or call execute again for a claimed request.
    if (recorded.acknowledgmentPending) {
      const cache = outcomeCache(c, recorded);
      await acknowledge(c, api, cache, run.html_url, s);
    }
    return;
  }
  core.assert(
    !fs.existsSync(handled),
    "UNBOUND_LEGACY_HANDLED_RECORD_REQUIRES_REVIEW",
  );
  const a = (
    await api(`/actions/runs/${run.id}/artifacts?per_page=100`)
  ).artifacts.filter(
    (a) => a.name === `persistent-staging-request-attempt-${run.run_attempt}`,
  );
  core.assert(
    a.length === 1 &&
      !a[0].expired &&
      a[0].workflow_run?.id === run.id &&
      a[0].workflow_run?.head_sha === run.head_sha,
    "REQUEST_ARTIFACT_REQUIRED",
  );
  const pending = path.join(
    c.stateDirectory,
    `incoming-${run.id}-${run.run_attempt}`,
  );
  fs.mkdirSync(pending, { recursive: true, mode: 0o700 });
  const zip = path.join(pending, "capsule.zip");
  if (fs.existsSync(zip)) fs.rmSync(zip);
  await gh.download(a[0].id, a[0].digest, zip, token);
  const extracted = path.join(pending, "verified");
  if (fs.existsSync(extracted)) fs.rmSync(extracted, { recursive: true });
  execFileSync(
    "python3",
    [path.join(__dirname, "extract.py"), zip, extracted],
    { stdio: "pipe" },
  );
  const m = JSON.parse(fs.readFileSync(path.join(extracted, "capsule.json")));
  gh.approved(
    run,
    await api(`/actions/runs/${run.id}/approvals`),
    await api(`/environments/${policy.environment}`),
    m,
  );
  core.assert(
    (await api("/branches/master")).protected === true,
    "PROTECTED_MASTER_REQUIRED",
  );
  if (m.operation === "deploy") {
    core.capsule(m);
    const select = require("../devops/verify-production-selection.cjs");
    const ci = await api(`/actions/runs/${m.sourceCi.runId}`);
    const selection = select.ciEvidence(
      ci,
      (await api(`/actions/runs/${ci.id}/jobs?filter=latest&per_page=100`))
        .jobs,
      (await api(`/actions/runs/${ci.id}/artifacts?per_page=100`)).artifacts,
    );
    core.assert(
      JSON.stringify(selection) === JSON.stringify(m.sourceCi),
      "HOST_CI_PROVENANCE_MISMATCH",
    );
    const gatewayRun = await api(`/actions/runs/${m.gateway.runId}`);
    select.runEvidence(
      gatewayRun,
      ".github/workflows/persistent-local-validation.yml",
      ["push"],
    );
    core.assert(
      gatewayRun.head_sha === m.commit &&
        gatewayRun.run_attempt === m.gateway.attempt,
      "HOST_GATEWAY_COMMIT_MISMATCH",
    );
    select.jobsEvidence(
      (
        await api(
          `/actions/runs/${gatewayRun.id}/jobs?filter=latest&per_page=100`,
        )
      ).jobs,
      ["gateway"],
    );
    const gatewayArtifact = select.artifactEvidence(
      (await api(`/actions/runs/${gatewayRun.id}/artifacts?per_page=100`))
        .artifacts,
      `persistent-local-gateway-attempt-${gatewayRun.run_attempt}`,
      gatewayRun,
    );
    core.assert(
      JSON.stringify(gatewayArtifact) === JSON.stringify(m.gateway.artifact),
      "HOST_GATEWAY_ARTIFACT_MISMATCH",
    );
    const hash = require("node:crypto").createHash("sha256");
    for await (const chunk of fs.createReadStream(
      path.join(extracted, "images.tar.gz"),
    ))
      hash.update(chunk);
    core.assert(
      hash.digest("hex") === m.archiveSha256,
      "IMAGE_ARCHIVE_CHECKSUM_MISMATCH",
    );
    runtime.requireCanonicalImageStore();
    runtime.docker("load", "--input", path.join(extracted, "images.tar.gz"));
  } else
    core.assert(
      m.kind === "wici-staging-request" &&
        m.productionAuthorized === false &&
        /^[a-f0-9]{40}$/.test(m.commit),
      "INVALID_RECOVERY_REQUEST",
    );
  // A durable request journal is written before any application mutation.
  const existing = (
    await api(`/deployments?environment=scop-staging&per_page=100`)
  ).filter((d) => d.payload?.requestKey === key);
  core.assert(existing.length <= 1, "AMBIGUOUS_DEPLOYMENT_RECORD");
  const deployment =
    existing[0] ||
    (await api("/deployments", {
      ref: m.commit,
      environment: "scop-staging",
      production_environment: false,
      auto_merge: false,
      required_contexts: [],
      payload: {
        requestKey: key,
        staging_run_id: run.id,
        commit_sha: m.commit,
        source_ci: m.sourceCi || null,
        capsule_artifact_id: a[0].id,
        capsule_artifact_digest: a[0].digest,
        instance: c.instance,
      },
    }));
  await api(`/deployments/${deployment.id}/statuses`, {
    state: "in_progress",
    log_url: run.html_url,
  });
  const record = await execute(c, m, s, {
    deploymentId: deployment.id,
    artifactId: a[0].id,
    artifactDigest: a[0].digest,
  });
  // Cache/ack failures are outside business execution. They cannot turn a
  // durable success into failure or cause deployment effects to run again.
  outcomeCache(c, record);
  await acknowledge(c, api, handled, run.html_url, s);
  fs.rmSync(pending, { recursive: true, force: true });
}

async function acknowledge(c, api, file, url, s = store(c)) {
  const r = JSON.parse(fs.readFileSync(file));
  if (!r.statusPending) return;
  await api(`/deployments/${r.deploymentId}/statuses`, {
    state: r.status,
    log_url: url,
    description:
      r.status === "success"
        ? "Synthetic staging available; hospital UAT required"
        : r.status === "error"
          ? "Staging outcome uncertain; independently approved recovery required"
          : "Staging operation failed; review recovery journal",
  });
  if (r.operationKey) {
    const control = s.control(),
      operation = control.operations[r.operationKey];
    core.assert(
      operation && operation.deploymentId === r.deploymentId,
      "ACKNOWLEDGMENT_OPERATION_MISMATCH",
    );
    operation.acknowledgmentPending = false;
    s.commit(control);
  }
  core.atomic(file, { ...r, statusPending: false });
}
// Maintenance reloads also cross the Docker/disk boundary. A lost reply must
// not become an untracked route change that can outlive reviewed recovery.
async function localMaintenance(s, io, stateReadable) {
  if (!stateReadable) return io.maintenance(); // corrupt authority stays unusable
  const epoch = core.validEpoch(await io.executionEpoch()),
    key = `local-maintenance:${require("node:crypto").randomUUID()}`,
    control = s.control(),
    identity = { operation: "local-maintenance", key, executionEpoch: epoch },
    record = {
      key,
      identity,
      digest: core.sha(JSON.stringify(identity)),
      status: "RUNNING",
      executionProtocol: 2,
      executionEpoch: epoch,
      pendingEffect: { name: "maintenance", executionEpoch: epoch },
      fenceRequired: true,
      acknowledgmentPending: false,
      createdAt: new Date().toISOString(),
    };
  control.operations[key] = record;
  s.commit(control); // claim before the reload; never repeat an unknown effect
  await io.maintenance();
  core.assert(
    core.validEpoch(await io.executionEpoch()) === epoch,
    "HOST_EXECUTION_EPOCH_CHANGED_DURING_OPERATION",
  );
  const next = s.control();
  core.assert(
    next.operations[key]?.digest === record.digest,
    "MAINTENANCE_OWNERSHIP_CHANGED",
  );
  Object.assign(next.operations[key], {
    status: "SUCCEEDED",
    pendingEffect: null,
    fenceRequired: false,
    completedAt: new Date().toISOString(),
  });
  s.commit(next);
}
async function reconcileLocal(c, dependencies = {}) {
  const s = dependencies.store || store(c),
    io = dependencies.io || runtime.adapter(c);
  let control = { activeOperation: "UNREADABLE", deployment: null },
    current,
    stateReadable = false;
  const file = path.join(c.stateDirectory, "health.json");
  let status = "healthy",
    action = "NONE",
    maintenance = false;
  try {
    control = s.control();
    current = control.deployment;
    stateReadable = true;
    core.assert(
      !core.recoveryRequired(control) && current?.phase === "ACTIVE",
      "INCOMPLETE_OPERATION_OR_NO_ACTIVE_RELEASE",
    );
    await io.health(current.release);
    await io.routeHealth(current.release);
  } catch {
    status = "unhealthy";
    action = stateReadable
      ? "APPROVED_RECOVERY_REQUIRED"
      : "MANUAL_STATE_JOURNAL_REVIEW_REQUIRED";
    // Recheck the loaded gateway marker each time; a persisted boolean cannot
    // establish whether maintenance survived a gateway/host restart.
    try {
      if (!(await io.maintenanceStatus())) {
        // An unacknowledged maintenance call is never automatically replayed.
        const blocked =
          stateReadable &&
          core
            .unresolvedOperations(s.control())
            .some(
              (key) =>
                s.control().operations[key].pendingEffect?.name ===
                "maintenance",
            );
        core.assert(!blocked, "PENDING_MAINTENANCE_REQUIRES_REVIEWED_RECOVERY");
        await localMaintenance(s, io, stateReadable);
      }
      maintenance = await io.maintenanceStatus();
      core.assert(maintenance, "MAINTENANCE_NOT_VERIFIED");
    } catch {
      action = "MANUAL_GATEWAY_INTERVENTION_REQUIRED";
    }
  }
  let old = null;
  try {
    if (fs.existsSync(file)) old = JSON.parse(fs.readFileSync(file));
  } catch {
    /* Regenerate diagnostic state only; never edit the operation ledger. */
  }
  const value = {
    status,
    action,
    maintenance,
    commit: current?.release?.commit || null,
    phase: current?.phase || "EMPTY",
    operationKey: control.activeOperation,
    unresolvedOperations: (() => {
      try {
        return core.unresolvedOperations(s.control());
      } catch {
        return ["UNREADABLE"];
      }
    })(),
    firstObservedAt:
      old?.status === status && old?.action === action
        ? old.firstObservedAt
        : new Date().toISOString(),
    checkedAt: new Date().toISOString(),
  };
  core.atomic(file, value);
  if (status !== old?.status || action !== old?.action)
    s.append({ event: "LOCAL_HEALTH_CHANGED", ...value });
  return value;
}
async function tick(c, dependencies = {}) {
  const s = dependencies.store || store(c);
  const reconcile = () => reconcileLocal(c, { store: s, io: dependencies.io });
  // Local reconciliation runs before network work and again in finally. No
  // GitHub token, acknowledgment, download or API failure can suppress it.
  try {
    await reconcile();
  } catch {
    console.error("LOCAL_HEALTH_JOURNAL_FAILED_MANUAL_REVIEW_REQUIRED");
  }
  let polling = "success";
  try {
    const token = await (dependencies.appToken || gh.appToken)(c),
      api = dependencies.api || gh.transport(token);
    for (const record of Object.values(s.control().operations)) {
      if (!record.acknowledgmentPending) continue;
      const file = outcomeCache(c, record);
      await acknowledge(
        c,
        api,
        file,
        "https://github.com/" + policy.repository + "/actions",
        s,
      );
    }
    await (dependencies.once || once)(c, { store: s, token, api });
  } catch {
    polling = "blocked";
  } finally {
    try {
      await reconcile();
    } catch {
      console.error("LOCAL_HEALTH_JOURNAL_FAILED_MANUAL_REVIEW_REQUIRED");
    }
    core.atomic(path.join(c.stateDirectory, "poll.json"), {
      status: polling,
      at: new Date().toISOString(),
      action:
        polling === "blocked"
          ? "CHECK_GITHUB_AND_REQUEST_JOURNAL_LOCAL_MONITORING_CONTINUES"
          : "NONE",
    });
  }
}
async function main() {
  const c = JSON.parse(fs.readFileSync("/etc/scop-staging/config.json"));
  core.configuration(c);
  core.assert(
    c.pollSeconds >= 30 && c.pollSeconds <= 300,
    "BOUNDED_POLL_REQUIRED",
  );
  fs.mkdirSync(c.stateDirectory, { recursive: true, mode: 0o700 });
  for (;;) {
    try {
      await tick(c);
    } catch {
      console.error("STAGING_AGENT_LOCAL_STORAGE_REQUIRES_REVIEW");
    }
    await new Promise((r) => setTimeout(r, c.pollSeconds * 1000));
  }
}

if (require.main === module)
  main().catch(() => {
    console.error("STAGING_AGENT_NOT_ACTIVATED");
    process.exitCode = 1;
  });
module.exports = {
  store,
  execute,
  once,
  acknowledge,
  outcomeCache,
  reconcileLocal,
  tick,
};
