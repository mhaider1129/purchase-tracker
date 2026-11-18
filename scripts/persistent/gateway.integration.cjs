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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scop-gateway-")),
    cfg = {
      instance: "review-" + crypto.randomBytes(8).toString("hex"),
      hostname: "staging.example.invalid",
    };
  const nonce = crypto.randomBytes(8).toString("hex"),
    gateway = "scop-gateway-test-" + nonce,
    client = original.frontend;
  const release = (attempt) => ({
      commit: report.commit,
      images: report.images,
      request: { runId: 123456789, attempt },
    }),
    a = release(1),
    b = release(2),
    bad = release(3),
    unattested = release(4);
  const local = [],
    releases = [],
    checks = [];
  let gatewayRunning = false;
  const testOwner = (name) => {
    const v = JSON.parse(docker("inspect", name))[0];
    assert.equal(v.Config.Labels["wici.scop.gateway-test"], nonce);
    return v;
  };
  const owned = (r) => {
    const n = runtime.names(cfg, r);
    for (const name of [n.be, n.fe])
      runtime.assertOwned(JSON.parse(docker("inspect", name))[0], cfg, r, name);
    return n;
  };
  const labelArgs = (r) =>
    Object.entries(runtime.labels(cfg, r)).flatMap(([k, v]) => [
      "--label",
      `${k}=${v}`,
    ]);
  const command = (container, script) =>
    execFileSync(
      "docker",
      ["--host=unix:///var/run/docker.sock", "exec", "-i", container, "node"],
      {
        input: script,
        env: safe.environment(),
        encoding: "utf8",
        timeout: 15000,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );

  const request = async (p, opts = {}, auth = true) => {
    const settings = {
      host: gateway,
      port: 443,
      servername: cfg.hostname,
      ca: fs.readFileSync(path.join(dir, "certs/tls.crt"), "utf8"),
      method: opts.method || "GET",
      path: p,
      ...(auth
        ? {
            cert: fs.readFileSync(path.join(dir, "client.crt"), "utf8"),
            key: fs.readFileSync(path.join(dir, "client.key"), "utf8"),
          }
        : {}),
      headers: { Host: cfg.hostname, ...opts.headers },
    };
    // mTLS leaves Authorization free for the canonical Bearer JWT.
    const script = `const https=require('https');const r=https.request(${JSON.stringify(settings)},s=>{let b='';s.on('data',c=>b+=c);s.on('end',()=>console.log(JSON.stringify({status:s.statusCode,body:b,headers:s.headers})));});r.on('error',()=>process.exit(1));r.setTimeout(10000,()=>r.destroy());r.end(${JSON.stringify(opts.body || "")});`;
    return JSON.parse(command(client, script));
  };
  const switchTo = (r, legacy) => {
    let text = runtime.route(cfg, r);
    if (legacy)
      text = text.replace(
        `reverse_proxy ${runtime.names(cfg, r).fe}:8080`,
        `reverse_proxy ${legacy}:8080`,
      );
    const target = path.join(dir, "routes/Caddyfile"),
      next = target + ".next";
    fs.writeFileSync(next, text, { mode: 0o600 });
    if (gatewayRunning) {
      testOwner(gateway);
      docker(
        "exec",
        gateway,
        "caddy",
        "validate",
        "--config",
        "/routes/Caddyfile.next",
        "--adapter",
        "caddyfile",
      );
    }
    fs.renameSync(next, target);
    if (gatewayRunning)
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
  const prepare = (r, kind) => {
    const n = runtime.names(cfg, r);
    for (const value of Object.values(n)) assert(value.length <= 63);
    docker("network", "create", "--internal", ...labelArgs(r), n.network);
    releases.push(r);
    docker(
      "create",
      "--name",
      n.be,
      "--network",
      n.network,
      "--network-alias",
      "backend",
      ...labelArgs(r),
      ...noProxy,
      "--read-only",
      "--env-file",
      original.runtimeEnv,
      ...(kind === "unattested"
        ? ["--env", "APP_RELEASE_REF=unattested-local-gateway-test"]
        : []),
      "--tmpfs",
      "/tmp:rw,noexec,nosuid,size=64m",
      "--tmpfs",
      "/app/uploads:rw,uid=1000,gid=1000",
      "--tmpfs",
      "/app/private-uploads:rw,uid=1000,gid=1000",
      r.images.backend,
      ...(kind === "failed" ? ["node", "-e", "process.exit(7)"] : []),
    );
    docker("network", "connect", original.network, n.be);
    docker(
      "create",
      "--name",
      n.fe,
      "--network",
      n.network,
      ...labelArgs(r),
      ...noProxy,
      "--read-only",
      r.images.frontend,
    );
    docker("network", "connect", original.network, n.fe);
  };
  const stop = (r) => {
    const n = owned(r);
    for (const name of [n.fe, n.be]) {
      if (JSON.parse(docker("inspect", name))[0].State.Running)
        docker("stop", "--time", "20", name);
    }
  };
  const start = (r) => {
    const n = owned(r);
    for (const name of [n.be, n.fe]) docker("start", name);
  };
  try {
    for (const sub of ["certs", "access", "routes"])
      fs.mkdirSync(path.join(dir, sub));
    execFileSync(
      "openssl",
      [
        "req",
        "-x509",
        "-nodes",
        "-newkey",
        "rsa:2048",
        "-keyout",
        path.join(dir, "certs/tls.key"),
        "-out",
        path.join(dir, "certs/tls.crt"),
        "-days",
        "1",
        "-subj",
        "/CN=" + cfg.hostname,
        "-addext",
        "subjectAltName=DNS:" + cfg.hostname,
      ],
      { stdio: "pipe" },
    );
    fs.copyFileSync(
      path.join(dir, "certs/tls.crt"),
      path.join(dir, "access/client-ca.pem"),
    );
    execFileSync(
      "openssl",
      [
        "req",
        "-new",
        "-nodes",
        "-newkey",
        "rsa:2048",
        "-keyout",
        path.join(dir, "client.key"),
        "-out",
        path.join(dir, "client.csr"),
        "-subj",
        "/CN=synthetic-test-client",
      ],
      { stdio: "pipe" },
    );
    fs.writeFileSync(
      path.join(dir, "client.ext"),
      "extendedKeyUsage=clientAuth\n",
    );
    execFileSync(
      "openssl",
      [
        "x509",
        "-req",
        "-in",
        path.join(dir, "client.csr"),
        "-CA",
        path.join(dir, "certs/tls.crt"),
        "-CAkey",
        path.join(dir, "certs/tls.key"),
        "-CAcreateserial",
        "-out",
        path.join(dir, "client.crt"),
        "-days",
        "1",
        "-extfile",
        path.join(dir, "client.ext"),
      ],
      { stdio: "pipe" },
    );
    const legacy = `scop-${cfg.instance}-${a.commit}-fe`;
    assert(legacy.length > 63);
    docker(
      "run",
      "--detach",
      "--name",
      legacy,
      "--network",
      original.network,
      "--label",
      `wici.scop.gateway-test=${nonce}`,
      ...noProxy,
      "--read-only",
      report.images.frontend,
    );
    local.push(legacy);
    await eventually(() =>
      assert.equal(
        JSON.parse(
          command(
            legacy,
            "fetch('http://127.0.0.1:8080/health').then(async r=>console.log(JSON.stringify({status:r.status}))).catch(()=>process.exit(1))",
          ),
        ).status,
        200,
      ),
    );
    switchTo(a, legacy);
    docker(
      "run",
      "--detach",
      "--name",
      gateway,
      "--network",
      original.network,
      "--label",
      `wici.scop.gateway-test=${nonce}`,
      ...noProxy,
      "--read-only",
      "--tmpfs",
      "/data",
      "--tmpfs",
      "/config",
      "-v",
      `${dir}/certs:/certs:ro`,
      "-v",
      `${dir}/access:/access:ro`,
      "-v",
      `${dir}/routes:/routes:ro`,
      caddy,
      "caddy",
      "run",
      "--config",
      "/routes/Caddyfile",
      "--adapter",
      "caddyfile",
    );
    local.push(gateway);
    gatewayRunning = true;
    await eventually(async () =>
      assert.equal((await request("/health")).status, 502),
    );
    const logs = require("node:child_process").spawnSync(
      "docker",
      ["--host=unix:///var/run/docker.sock", "logs", gateway],
      { env: safe.environment(), encoding: "utf8" },
    );
    assert(
      /lookup|DNS|domain|no such host|name too long/i.test(
        (logs.stdout || "") + (logs.stderr || ""),
      ),
      "LEGACY_DNS_FAILURE_NOT_CONFIRMED",
    );
    checks.push(
      "legacy_overlong_dns_gateway_502_reproduced_with_healthy_upstream",
    );
    switchTo(null);
    assert.equal((await request("/health")).status, 503);
    for (const name of [original.backend]) {
      const v = JSON.parse(docker("inspect", name))[0];
      assert.equal(v.Config.Labels["wici.scop.rehearsal"], original.owner);
      docker("stop", "--time", "20", name);
    }
    docker(
      "exec",
      original.database,
      "psql",
      "-U",
      "p2p_test",
      "-d",
      `p2p_disposable_${original.owner}`,
      "-c",
      "UPDATE users SET is_active=true WHERE id=74001",
    );
    prepare(a);
    start(a);
    switchTo(a);
    await eventually(async () =>
      assert.equal((await request("/health")).status, 200),
    );
    const html = await request("/");
    assert.equal(html.status, 200);
    assert(/<html/i.test(html.body));
    await assert.rejects(() => request("/health", {}, false));
    const login = await request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(original.login),
    });
    assert.equal(login.status, 200);
    const token = JSON.parse(login.body).token;
    assert(token);
    const identity = await request("/api/auth/me", {
      headers: { Authorization: "Bearer " + token },
    });
    assert.equal(identity.status, 200);
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
      "real_frontend_tls_perimeter_login_jwt_same_origin_health_and_institute_scope",
    );
    prepare(b);
    switchTo(null);
    stop(a);
    start(b);
    switchTo(b);
    await eventually(async () =>
      assert.equal((await request("/health")).status, 200),
    );
    assert.equal(
      (await request("/health")).headers["x-scop-release"],
      runtime.resourceIdentity(cfg, b).key,
    );
    assertOwnedPreserved(a);
    checks.push(
      "same_commit_different_attempt_successful_handoff_preserves_previous",
    );
    prepare(bad, "failed");
    switchTo(null);
    stop(b);
    start(bad);
    await eventually(() =>
      assert.equal(
        JSON.parse(docker("inspect", runtime.names(cfg, bad).be))[0].State
          .Status,
        "exited",
      ),
    );
    stop(bad);
    start(a);
    switchTo(a);
    await eventually(async () =>
      assert.equal((await request("/health")).status, 200),
    );
    assert.equal(
      (await request("/health")).headers["x-scop-release"],
      runtime.resourceIdentity(cfg, a).key,
    );
    checks.push("failed_candidate_real_previous_service_and_gateway_recovery");
    assert.throws(() => runtime.cleanupOwned(cfg, a, [a, b]), /PRESERVED/);
    assertOwnedPreserved(b);
    prepare(unattested, "unattested");
    switchTo(null);
    stop(a);
    start(unattested);
    await eventually(() =>
      assert.equal(
        JSON.parse(docker("inspect", runtime.names(cfg, unattested).be))[0]
          .State.Status,
        "exited",
      ),
    );
    const failure = require("node:child_process").spawnSync(
      "docker",
      [
        "--host=unix:///var/run/docker.sock",
        "logs",
        runtime.names(cfg, unattested).be,
      ],
      { env: safe.environment(), encoding: "utf8" },
    );
    assert(
      ((failure.stdout || "") + (failure.stderr || "")).includes(
        "database_release_startup_blocked",
      ),
    );
    stop(unattested);
    start(a);
    switchTo(a);
    await eventually(async () =>
      assert.equal((await request("/health")).status, 200),
    );
    checks.push("real_startup_refuses_missing_release_attestation");
    return {
      scope: "LOCAL_DISPOSABLE_GATEWAY_TEST",
      externalActivated: false,
      checks,
      legacyDnsLength: legacy.length,
      gatewayStatus: 200,
    };
    function assertOwnedPreserved(r) {
      owned(r);
      for (const image of Object.values(r.images))
        assert.equal(
          docker("image", "inspect", "--format", "{{.Id}}", image),
          image,
        );
    }
  } finally {
    const errors = [];
    for (const r of releases.reverse()) {
      try {
        const n = runtime.names(cfg, r);
        for (const name of [n.fe, n.be]) {
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
    }
    for (const name of local.reverse()) {
      try {
        testOwner(name);
        docker("rm", "--force", name);
      } catch (e) {
        errors.push(e.message);
      }
    }
    fs.rmSync(dir, { recursive: true, force: true });
    if (errors.length)
      throw Error("LOCAL_GATEWAY_OWNED_CLEANUP_FAILED: " + errors.join(";"));
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
