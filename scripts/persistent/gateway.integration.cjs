"use strict";
// Explicit local/disposable test only. Never reads a target, hosted DB URL,
// staging credentials, GitHub token or activation setting from the environment.
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  crypto = require("node:crypto"),
  assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process"),
  safe = require("../staging/safety.cjs");
const runtime = require("./runtime.cjs"),
  root = path.resolve(__dirname, "../.."),
  caddy =
    "caddy:2@sha256:4e2425f6009577e7c651010f16679c28f7d12df3e7b1914f941a7a3370746b3c";
const noProxy = [
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "http_proxy",
  "https_proxy",
  "all_proxy",
].flatMap((k) => ["--env", `${k}=`]);
const docker = (...args) =>
  execFileSync("docker", ["--host=unix:///var/run/docker.sock", ...args], {
    env: safe.environment(),
    encoding: "utf8",
    maxBuffer: 3 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
async function eventually(fn) {
  let error;
  for (let i = 0; i < 90; i++) {
    try {
      return await fn();
    } catch (e) {
      error = e;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw error;
}
async function check(report, original) {
  const core = require("./core.cjs"),
    agent = require("./agent.cjs");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scop-gateway-"));
  const nonce = crypto.randomBytes(8).toString("hex");
  const cfg = {
    ...require("../../deploy/persistent/config.example.json"),
    instance: original.persistentInstance,
    database: `scop_staging_${nonce}`,
  };
  const data = `scop-${cfg.instance}-data`,
    ingress = `scop-${cfg.instance}-ingress`,
    gateway = `scop-${cfg.instance}-gateway`,
    database = `scop-${cfg.instance}-database`;
  const local = [],
    ephemeral = [],
    releases = [],
    checks = [],
    images = [];
  const state = path.join(dir, "state"),
    probeDirectory = path.join(dir, "probe");
  let renamed = false,
    moved = false,
    createdGateway = false;
  const readEnv = Object.fromEntries(
    fs
      .readFileSync(original.runtimeEnv, "utf8")
      .trim()
      .split("\n")
      .map((x) => {
        const i = x.indexOf("=");
        return [x.slice(0, i), x.slice(i + 1)];
      }),
  );
  const runtimeUrl = new URL(readEnv.DATABASE_URL);
  const secretBytes = JSON.stringify({
    purpose: cfg.purpose,
    instance: cfg.instance,
    databasePassword: runtimeUrl.password,
    jwtSecret: readEnv.JWT_SECRET,
  });
  const io = runtime.adapter(cfg, {
    stateDirectory: state,
    probeDirectory,
    readSecrets: () => secretBytes,
    executionEpochFile: "/proc/sys/kernel/random/boot_id",
  });
  const store = agent.store({ ...cfg, stateDirectory: state });
  const fixtureManifest = (commit, run, fixtureImages = report.images) => {
    // Synthetic protocol fixtures in this private disposable test only. They
    // are never exported as deployment authority; the real agent stays disabled
    // and independently requires authenticated GitHub metadata before execution.
    const sourceCi = { commit, runId: 1 };
    return {
      kind: "wici-staging-capsule",
      version: 1,
      operation: "deploy",
      commit,
      images: fixtureImages,
      sourceCi,
      gateway: {
        commit,
        attempt: 1,
        runId: 2,
        artifact: { id: 3, digest: "sha256:" + "f".repeat(64) },
      },
      request: { runId: run, attempt: 1, workflowCommit: report.commit },
      archiveSha256: "a".repeat(64),
      databaseContract: "hospital-erp-2026-11-scop1",
      syntheticOnly: true,
      productionAuthorized: false,
      runtimeVerified: {
        commit,
        images: fixtureImages,
        sourceCi,
        status: "DISPOSABLE_REHEARSAL_PASSED_NOT_ACTIVATION_APPROVAL",
        scope: "AUTHENTICATED_CI_ARTIFACT_REHEARSAL",
        source: { gitCommit: commit, dirty: false },
        database: { status: "DATABASE_READY", findings: [] },
        cleanupFailures: [],
      },
    };
  };
  const release = (m) => ({
    commit: m.commit,
    images: m.images,
    request: m.request,
    manifest: m,
  });
  const a = fixtureManifest(report.commit, 1001),
    b = fixtureManifest(crypto.randomBytes(20).toString("hex"), 1002);
  const provenance = {
    deploymentId: 1,
    artifactId: 2,
    artifactDigest: "sha256:" + "f".repeat(64),
  };
  const execute = (m, adapter = io) =>
    agent.execute(cfg, m, store, provenance, adapter);
  const request = async (p, opts = {}, auth = true) => {
    const settings = {
      host: gateway,
      port: 443,
      servername: cfg.hostname,
      ca: fs.readFileSync(path.join(dir, "tls/tls.crt"), "utf8"),
      method: opts.method || "GET",
      path: p,
      headers: { Host: cfg.hostname, ...opts.headers },
      ...(auth
        ? {
            cert: fs.readFileSync(
              path.join(probeDirectory, "client.crt"),
              "utf8",
            ),
            key: fs.readFileSync(
              path.join(probeDirectory, "client.key"),
              "utf8",
            ),
          }
        : {}),
    };
    const script = `const https=require('https');const r=https.request(${JSON.stringify(settings)},s=>{let b='';s.on('data',c=>b+=c);s.on('end',()=>console.log(JSON.stringify({status:s.statusCode,body:b,headers:s.headers})));});r.on('error',()=>process.exit(1));r.setTimeout(5000,()=>r.destroy());r.end(${JSON.stringify(opts.body || "")});`;
    return JSON.parse(
      execFileSync(
        "docker",
        [
          "--host=unix:///var/run/docker.sock",
          "exec",
          "-i",
          original.frontend,
          "node",
        ],
        {
          input: script,
          env: safe.environment(),
          encoding: "utf8",
          timeout: 10000,
          stdio: "pipe",
        },
      ),
    );
  };
  const rawRoute = (text) => {
    fs.writeFileSync(path.join(state, "gateway/Caddyfile"), text, {
      mode: 0o600,
    });
    docker(
      "exec",
      gateway,
      "caddy",
      "reload",
      "--config",
      "/routes/Caddyfile",
      "--adapter",
      "caddyfile",
    );
  };
  try {
    for (const sub of [
      "tls",
      "probe",
      "access",
      "state/gateway",
      "state/uploads",
      "state/private",
    ])
      fs.mkdirSync(path.join(dir, sub), { recursive: true });
    fs.chmodSync(path.join(state, "uploads"), 0o777);
    fs.chmodSync(path.join(state, "private"), 0o777);
    const ssl = (...args) =>
      execFileSync("openssl", args, { cwd: dir, stdio: "pipe" });
    ssl(
      "req",
      "-x509",
      "-nodes",
      "-newkey",
      "rsa:2048",
      "-keyout",
      "tls/tls.key",
      "-out",
      "tls/tls.crt",
      "-days",
      "1",
      "-subj",
      "/CN=" + cfg.hostname,
      "-addext",
      "subjectAltName=DNS:" + cfg.hostname,
    );
    fs.copyFileSync(
      path.join(dir, "tls/tls.crt"),
      path.join(dir, "access/client-ca.pem"),
    );
    fs.copyFileSync(
      path.join(dir, "tls/tls.crt"),
      path.join(probeDirectory, "server-ca.pem"),
    );
    ssl(
      "req",
      "-new",
      "-nodes",
      "-newkey",
      "rsa:2048",
      "-keyout",
      "probe/client.key",
      "-out",
      "client.csr",
      "-subj",
      "/CN=synthetic-runtime-probe",
    );
    fs.writeFileSync(
      path.join(dir, "client.ext"),
      "extendedKeyUsage=clientAuth",
    );
    ssl(
      "x509",
      "-req",
      "-in",
      "client.csr",
      "-CA",
      "tls/tls.crt",
      "-CAkey",
      "tls/tls.key",
      "-CAcreateserial",
      "-out",
      "probe/client.crt",
      "-days",
      "1",
      "-extfile",
      "client.ext",
    );
    docker("stop", "--time", "20", original.backend);
    const pgInfo = JSON.parse(docker("inspect", original.database))[0];
    assert.equal(pgInfo.Config.Labels["wici.scop.rehearsal"], original.owner);
    assert.equal(pgInfo.Config.Labels["wici.scop.instance"], cfg.instance);
    // Only this newly generated synthetic database/container is renamed. No
    // hosted connection, production dump, frozen SQL edit or historical receipt
    // fabrication is involved. The genuine governance bundle executes locally.
    const oldDb = `p2p_disposable_${original.owner}`;
    docker(
      "exec",
      original.database,
      "psql",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "p2p_test",
      "-d",
      "postgres",
      "-c",
      `ALTER DATABASE ${oldDb} RENAME TO ${cfg.database}`,
    );
    docker("rename", original.database, database);
    renamed = true;
    docker(
      "network",
      "create",
      "--internal",
      "--label",
      `wici.scop.gateway-test=${nonce}`,
      "--label",
      `wici.scop.instance=${cfg.instance}`,
      "--label",
      "wici.scop.purpose=wici-isolated-staging-v1",
      "--label",
      "wici.scop.role=data",
      data,
    );
    local.push(["network", data]);
    docker(
      "network",
      "create",
      "--internal",
      "--label",
      `wici.scop.gateway-test=${nonce}`,
      "--label",
      `wici.scop.instance=${cfg.instance}`,
      "--label",
      "wici.scop.purpose=wici-isolated-staging-v1",
      "--label",
      "wici.scop.role=ingress",
      ingress,
    );
    local.push(["network", ingress]);
    docker("network", "connect", "--alias", "database", data, database);
    docker("network", "disconnect", original.network, database);
    moved = true;
    const backend = path.join(root, "purchase-backend");
    for (const m of [a, b]) {
      const bundle = require(
        path.join(backend, "scripts/lib/databaseRelease/planner"),
      ).bundle({
        inventory: require(
          path.join(backend, "services/databaseReleaseService"),
        ).loadInventory(),
        contract: require(
          path.join(backend, "services/databaseReleaseService"),
        ).loadContract(),
        environment: "staging",
        actor: "local-synthetic-adapter-test",
        releaseRef: m.commit,
      });
      execFileSync(
        "docker",
        [
          "--host=unix:///var/run/docker.sock",
          "exec",
          "-i",
          database,
          "psql",
          "-v",
          "ON_ERROR_STOP=1",
          "-U",
          "p2p_test",
          "-d",
          cfg.database,
        ],
        {
          input: bundle,
          env: safe.environment(),
          stdio: "pipe",
          maxBuffer: 3 * 1024 * 1024,
        },
      );
    }
    docker(
      "exec",
      database,
      "psql",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "p2p_test",
      "-d",
      cfg.database,
      "-c",
      "UPDATE users SET is_active=true WHERE id=74001",
    );
    fs.writeFileSync(
      path.join(state, "gateway/Caddyfile"),
      runtime.route(cfg, null),
      { mode: 0o600 },
    );
    docker(
      "run",
      "--detach",
      "--name",
      gateway,
      "--label",
      `wici.scop.instance=${cfg.instance}`,
      "--label",
      "wici.scop.purpose=wici-isolated-staging-v1",
      "--label",
      "wici.scop.role=gateway",
      "--label",
      `wici.scop.gateway-test=${nonce}`,
      "--network",
      ingress,
      ...noProxy,
      "--read-only",
      "--tmpfs",
      "/data",
      "--tmpfs",
      "/config",
      "-v",
      `${dir}/tls:/certs:ro`,
      "-v",
      `${dir}/access:/access:ro`,
      "-v",
      `${state}/gateway:/routes:ro`,
      caddy,
      "caddy",
      "run",
      "--config",
      "/routes/Caddyfile",
      "--adapter",
      "caddyfile",
    );
    createdGateway = true;
    docker("network", "connect", ingress, original.frontend);
    await eventually(() => io.maintenanceStatus().then((x) => assert(x)));
    releases.push(release(a));
    assert.equal((await execute(a)).status, "SUCCEEDED");
    assert.equal((await request("/")).status, 200);
    assert.equal((await request("/health")).status, 200);
    await assert.rejects(() => request("/health", {}, false));
    const login = await request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(original.login),
    });
    assert.equal(login.status, 200);
    const token = JSON.parse(login.body).token;
    assert(token);
    assert.equal(
      (
        await request("/api/auth/me", {
          headers: { Authorization: "Bearer " + token },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await request("/api/requests/74001/full-details", {
          headers: { Authorization: "Bearer " + token },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await request("/api/requests/74002/full-details", {
          headers: { Authorization: "Bearer " + token },
        })
      ).status,
      404,
    );
    checks.push(
      "production_adapter_controller_https_mtls_login_jwt_and_institute_scope",
    );
    const legacy = `scop-review-12345678-${a.commit}-fe`;
    assert(legacy.length > 63);
    docker(
      "run",
      "--detach",
      "--name",
      legacy,
      "--network",
      runtime.names(cfg, release(a)).network,
      "--label",
      `wici.scop.gateway-test=${nonce}`,
      ...noProxy,
      "--read-only",
      report.images.frontend,
    );
    ephemeral.push(legacy);
    docker("network", "connect", ingress, legacy);
    await eventually(() =>
      assert.equal(
        docker(
          "exec",
          legacy,
          "node",
          "-e",
          "fetch('http://127.0.0.1:8080/health').then(r=>{if(r.status!==200)process.exit(1)})",
        ),
        "",
      ),
    );
    // Local marker remains correct while actual TLS reverse-proxy traffic fails.
    rawRoute(
      runtime
        .route(cfg, release(a))
        .replace(
          `reverse_proxy ${runtime.names(cfg, release(a)).fe}:8080`,
          `reverse_proxy ${legacy}:8080`,
        ),
    );
    assert.equal(
      docker(
        "exec",
        gateway,
        "wget",
        "-qO-",
        "http://127.0.0.1:8081/__release",
      ),
      a.commit,
    );
    assert.equal((await request("/health")).status, 502);
    await assert.rejects(io.routeHealth(release(a)));
    await io.route(release(a));
    await io.routeHealth(release(a));
    checks.push("correct_local_markers_cannot_hide_overlong_dns_502");
    // Real ingress failure after route reload must fail candidate verification
    // and exercise the controller's existing previous-release recovery path.
    releases.push(release(b));
    let injected = false;
    const badEdge = {
      ...io,
      route: async (r) => {
        await io.route(r);
        if (r.commit === b.commit && !injected) {
          docker("network", "disconnect", ingress, gateway);
          injected = true;
        } else if (
          !JSON.parse(docker("inspect", gateway))[0].NetworkSettings.Networks[
            ingress
          ]
        )
          docker("network", "connect", ingress, gateway);
      },
    };
    assert.equal((await execute(b, badEdge)).status, "FAILED");
    assert.equal(store.read().release.commit, a.commit);
    assert.equal((await request("/health")).status, 200);
    checks.push("broken_ingress_candidate_recovers_real_previous_release");
    const b2 = { ...b, request: { ...b.request, runId: 1003 } };
    releases.push(release(b2));
    assert.equal((await execute(b2)).status, "SUCCEEDED");
    assert.equal(store.read().previous.commit, a.commit);
    const rollback = {
      kind: "wici-staging-request",
      operation: "rollback",
      commit: a.commit,
      productionAuthorized: false,
      request: { runId: 1004, attempt: 1, workflowCommit: report.commit },
    };
    assert.equal((await execute(rollback)).status, "SUCCEEDED");
    // Delete the cache (if any): the authoritative command outcome is sufficient.
    const before = JSON.stringify(store.control());
    const startedAt = () =>
      JSON.parse(docker("inspect", runtime.names(cfg, release(a)).be))[0].State
        .StartedAt;
    const rollbackStart = startedAt();
    await execute(rollback);
    assert.equal(JSON.stringify(store.control()), before);
    assert.equal(
      startedAt(),
      rollbackStart,
      "completed rollback cannot restart the backend",
    );
    assert.equal((await request("/health")).headers["x-scop-commit"], a.commit);
    checks.push(
      "actual_adapter_rollback_and_duplicate_command_preserve_previous_without_restart",
    );
    // Local monitoring uses the real adapter, even without a GitHub client.
    docker("stop", "--time", "20", runtime.names(cfg, release(a)).fe);
    const monitored = await agent.reconcileLocal(
      { ...cfg, stateDirectory: state },
      { store, io },
    );
    assert.equal(monitored.status, "unhealthy");
    assert.equal((await request("/health")).status, 503);
    assert.equal(
      JSON.parse(docker("inspect", runtime.names(cfg, release(a)).fe))[0].State
        .Running,
      false,
    );
    const recover = {
      kind: "wici-staging-request",
      operation: "recover",
      commit: a.commit,
      productionAuthorized: false,
      request: { runId: 1006, attempt: 1, workflowCommit: report.commit },
    };
    assert.equal((await execute(recover)).status, "SUCCEEDED");
    const recoveryStart = startedAt();
    await execute(recover);
    assert.equal(
      startedAt(),
      recoveryStart,
      "completed recovery cannot restart the backend",
    );
    assert.equal((await request("/health")).status, 200);
    checks.push(
      "real_local_monitoring_maintenance_and_reviewed_recovery_no_duplicate_backend_start",
    );
    const unattested = fixtureManifest(
      crypto.randomBytes(20).toString("hex"),
      1005,
    );
    assert.equal((await execute(unattested)).status, "FAILED");
    assert.equal((await request("/health")).status, 200);
    checks.push(
      "canonical_runtime_preflight_rejects_missing_release_attestation_before_handoff",
    );
    runtime.assertOwned(
      JSON.parse(docker("inspect", runtime.names(cfg, release(a)).be))[0],
      cfg,
      release(a),
      runtime.names(cfg, release(a)).be,
    );
    assert.throws(
      () => runtime.cleanupOwned(cfg, release(a), [release(a), release(b2)]),
      /PRESERVED/,
    );
    return {
      scope: "LOCAL_DISPOSABLE_GATEWAY_TEST",
      externalActivated: false,
      checks,
      gatewayStatus: 200,
    };
  } finally {
    const errors = [];
    for (const name of ephemeral.reverse())
      try {
        const info = JSON.parse(docker("inspect", name))[0];
        assert.equal(info.Config.Labels["wici.scop.gateway-test"], nonce);
        docker("rm", "--force", name);
      } catch (e) {
        errors.push(e.message);
      }
    for (const r of releases.reverse())
      try {
        for (const name of [
          runtime.names(cfg, r).fe,
          runtime.names(cfg, r).be,
        ]) {
          const info = runtime.inspectOptional("container", name);
          if (info) {
            runtime.assertOwned(info, cfg, r, name);
            if (info.State.Running) docker("stop", "--time", "20", name);
          }
        }
        runtime.cleanupOwned(cfg, r, []);
      } catch (e) {
        errors.push(e.message);
      }
    if (createdGateway)
      try {
        const v = JSON.parse(docker("inspect", gateway))[0];
        assert.equal(v.Config.Labels["wici.scop.gateway-test"], nonce);
        docker("rm", "--force", gateway);
      } catch (e) {
        errors.push(e.message);
      }
    try {
      docker("network", "disconnect", ingress, original.frontend);
    } catch {}
    if (renamed)
      try {
        if (moved) {
          docker(
            "network",
            "connect",
            "--alias",
            "database",
            original.network,
            database,
          );
          docker("network", "disconnect", data, database);
        }
        docker("rename", database, original.database);
      } catch (e) {
        errors.push(e.message);
      }
    for (const [kind, name] of local.reverse())
      try {
        const v = JSON.parse(docker("network", "inspect", name))[0];
        assert.equal(v.Labels["wici.scop.gateway-test"], nonce);
        docker(kind, "rm", name);
      } catch (e) {
        errors.push(e.message);
      }
    fs.rmSync(dir, { recursive: true, force: true });
    if (errors.length)
      throw Error("LOCAL_OWNED_CLEANUP_FAILED: " + errors.join(";"));
  }
}

async function main() {
  const commit = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim(),
    input = fs.mkdtempSync(
      path.join(root, "release-artifacts", "persistent-local-"),
    );
  try {
    require("../devops/backend-artifact.cjs").pack(
      root,
      commit,
      path.join(input, "backend"),
    );
    assert(
      fs.existsSync(
        path.join(root, "purchase-frontend/build/asset-manifest.json"),
      ),
      "REAL_FRONTEND_BUILD_REQUIRED",
    );
    fs.cpSync(
      path.join(root, "purchase-frontend/build"),
      path.join(input, "frontend"),
      { recursive: true },
    );
    let gateway;
    const report = await require("../staging/rehearse.cjs").run({
      input,
      major: "16",
      local: true,
      onVerified: async (r, privateContext) => {
        gateway = await check(r, privateContext);
      },
    });
    const result = {
      ...gateway,
      commit,
      source: report.source,
      database: report.database,
      cleanupFailures: report.cleanupFailures,
      status: "LOCAL_GATEWAY_VALIDATED",
    };
    fs.mkdirSync(path.join(root, "quality-results/persistent"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(root, "quality-results/persistent/local-gateway.json"),
      JSON.stringify(result, null, 2),
    );
    console.log(
      JSON.stringify({ status: result.status, checks: result.checks }),
    );
  } finally {
    fs.rmSync(input, { recursive: true, force: true });
  }
}
if (require.main === module) {
  if (process.env.SCOP_LOCAL_GATEWAY_CHILD !== "true") {
    fs.mkdirSync(path.join(root, "release-artifacts"), { recursive: true });
    const env = safe.environment();
    env.SCOP_LOCAL_GATEWAY_CHILD = "true";
    try {
      execFileSync(process.execPath, [__filename], {
        env,
        stdio: "inherit",
        timeout: 25 * 60 * 1000,
      });
    } catch {
      process.exitCode = 1;
    }
  } else
    main().catch((e) => {
      console.error(
        "LOCAL_GATEWAY_BLOCKED",
        e.code || e.name,
        e.message.slice(0, 1000),
      );
      process.exitCode = 1;
    });
}
module.exports = { check };
