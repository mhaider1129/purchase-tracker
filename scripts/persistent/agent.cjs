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
  return {
    read: () =>
      fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : null,
    write: (v) => core.atomic(file, v),
    append: (r) => {
      const fd = fs.openSync(
        path.join(c.stateDirectory, "audit.jsonl"),
        "a",
        0o600,
      );
      try {
        fs.writeSync(fd, JSON.stringify(r) + "\n");
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
    },
  };
}
async function execute(config, manifest, s) {
  const io = runtime.adapter(config);
  if (manifest.operation === "rollback") {
    const old = s.read();
    core.assert(
      old?.phase === "ACTIVE" && old.previous?.commit === manifest.commit,
      "ROLLBACK_MUST_SELECT_PRESERVED_PREVIOUS_RELEASE",
    );
    return core.deploy({
      config,
      manifest: old.previous.manifest,
      store: s,
      io,
    });
  }
  if (manifest.operation === "recover") {
    return core.recover({ config, commit: manifest.commit, store: s, io });
  }
  core.assert(manifest.operation === "deploy", "UNSUPPORTED_REQUEST_OPERATION");
  return core.deploy({ config, manifest, store: s, io });
}
async function once(c) {
  core.configuration(c);
  const s = store(c),
    token = await gh.appToken(c),
    api = gh.transport(token);
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
  if (fs.existsSync(handled)) return; // failed business execution is never replayed silently
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
    runtime.docker("load", "--input", path.join(extracted, "images.tar.gz"));
  } else
    core.assert(
      m.kind === "wici-staging-request" &&
        m.productionAuthorized === false &&
        /^[a-f0-9]{40}$/.test(m.commit),
      "INVALID_RECOVERY_REQUEST",
    );
  // A durable request journal is written before any application mutation.
  const key = `${run.id}:${run.run_attempt}`;
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
  let outcome;
  try {
    await api(`/deployments/${deployment.id}/statuses`, {
      state: "in_progress",
      log_url: run.html_url,
    });
    outcome = await execute(c, m, s);
    core.atomic(handled, {
      status: "success",
      commit: m.commit,
      outcome: outcome.status,
      deploymentId: deployment.id,
      statusPending: true,
    });
  } catch {
    core.atomic(handled, {
      status: "failure",
      commit: m.commit,
      deploymentId: deployment.id,
      statusPending: true,
    });
  }
  // A failed acknowledgment retries status only, never the business mutation.
  await acknowledge(c, api, handled, run.html_url);
  fs.rmSync(pending, { recursive: true, force: true });
}
async function acknowledge(c, api, file, url) {
  const r = JSON.parse(fs.readFileSync(file));
  if (!r.statusPending) return;
  await api(`/deployments/${r.deploymentId}/statuses`, {
    state: r.status,
    log_url: url,
    description:
      r.status === "success"
        ? "Synthetic staging available; hospital UAT required"
        : "Staging operation failed; review recovery journal",
  });
  core.atomic(file, { ...r, statusPending: false });
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
      const token = await gh.appToken(c),
        api = gh.transport(token);
      for (const f of fs
        .readdirSync(c.stateDirectory)
        .filter((n) => /^handled-\d+-\d+\.json$/.test(n)))
        await acknowledge(
          c,
          api,
          path.join(c.stateDirectory, f),
          "https://github.com/" + policy.repository + "/actions",
        );
      await once(c);
      const current = store(c).read();
      if (current?.phase === "ACTIVE") {
        const io = runtime.adapter(c),
          healthFile = path.join(c.stateDirectory, "health.json");
        try {
          await io.health(current.release);
          await io.routeHealth(current.release);
          core.atomic(healthFile, {
            status: "healthy",
            commit: current.release.commit,
            at: new Date().toISOString(),
          });
        } catch {
          await io.maintenance();
          core.atomic(healthFile, {
            status: "unhealthy",
            commit: current.release.commit,
            at: new Date().toISOString(),
            action: "APPROVED_RECOVERY_REQUIRED",
          });
          console.error("STAGING_HEALTH_FAILED_APPROVED_RECOVERY_REQUIRED");
        }
      } else if (current) await runtime.adapter(c).maintenance();
    } catch {
      console.error("STAGING_AGENT_BLOCKED_REVIEW_LOCAL_JOURNAL");
    }
    await new Promise((r) => setTimeout(r, c.pollSeconds * 1000));
  }
}
if (require.main === module)
  main().catch(() => {
    console.error("STAGING_AGENT_NOT_ACTIVATED");
    process.exitCode = 1;
  });
module.exports = { store, execute, once, acknowledge };
