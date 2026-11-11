"use strict";
// Only a new local Docker-owned tmpfs database; no target/URL/secret inputs.
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  crypto = require("node:crypto");
const { execFileSync } = require("node:child_process"),
  assert = require("node:assert/strict");
const safety = require("./safety.cjs"),
  policy = require("../../deploy/staging/policy.json");
const root = path.resolve(__dirname, "../.."),
  backend = path.join(root, "purchase-backend");
const docker = (...args) =>
  execFileSync("docker", ["--host=unix:///var/run/docker.sock", ...args], {
    env: safety.environment(),
    encoding: "utf8",
    maxBuffer: 12 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
const proxyOff = [
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "http_proxy",
  "https_proxy",
  "all_proxy",
].flatMap((k) => ["--env", `${k}=`]);
async function eventually(fn) {
  let last;
  for (let i = 0; i < 120; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw last;
}
async function transactionalSwitch(candidate, previous, health, stop) {
  try {
    await health(candidate);
    return { active: candidate, rollback: "NOT_REQUIRED" };
  } catch (error) {
    await stop(candidate);
    if (previous) {
      await health(previous);
      return {
        active: previous,
        rollback: "PREVIOUS_RELEASE_VERIFIED",
        candidateFailed: true,
      };
    }
    throw Object.assign(Error("CANDIDATE_FAILED_NO_PREVIOUS_RELEASE"), {
      cause: error,
    });
  }
}
async function run({ input, major = "16", local = false }) {
  safety.stopped();
  assert(policy.postgresImages[major], "UNREVIEWED_POSTGRES_VERSION");
  if (!local && !process.env.GITHUB_ACTIONS)
    throw Error("AUTHENTICATED_CI_OR_EXPLICIT_LOCAL_MODE_REQUIRED");
  const commit = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  const source = require("../quality/release.cjs").provenance();
  if (!local && source.dirty) throw Error("DIRTY_REHEARSAL_CHECKOUT");
  const backendPayload = path.join(input, "backend"),
    frontendPayload = path.join(input, "frontend");
  const backendDigest = safety.verifyBackend(backendPayload, commit);
  const candidate = local
    ? null
    : JSON.parse(fs.readFileSync(path.join(input, "candidate.json")));
  if (
    !local &&
    (candidate.selection.commit !== commit ||
      candidate.manifest.gitCommit !== commit ||
      candidate.manifest.sourceDigest !== source.sourceDigest ||
      candidate.manifest.gateConfigDigest !== source.gateConfigDigest)
  )
    throw Error("CHECKOUT_CANDIDATE_MISMATCH");
  if (!fs.existsSync(path.join(frontendPayload, "index.html")))
    throw Error("FRONTEND_BUILD_MISSING");
  if (!local) {
    const expected = candidate.frontendFiles;
    if (
      !expected?.length ||
      JSON.stringify(safety.files(frontendPayload)) !== JSON.stringify(expected)
    )
      throw Error("FRONTEND_BUILD_BINDING_INVALID");
  }
  const token = crypto.randomBytes(8).toString("hex"),
    name = `scop-rehearsal-${token}`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), name)),
    resources = [],
    images = [];
  const password = crypto.randomBytes(24).toString("hex"),
    runtimePassword = crypto.randomBytes(24).toString("hex");
  const report = {
    kind: "scop-staging-rehearsal",
    version: 1,
    commit,
    source,
    postgresMajor: major,
    backendDigest,
    frontendDigest: safety.sha(JSON.stringify(safety.files(frontendPayload))),
    sourceCi: candidate?.selection || null,
    startedAt: new Date().toISOString(),
    scope: local
      ? "LOCAL_SYNTHETIC_ONLY"
      : "AUTHENTICATED_CI_ARTIFACT_REHEARSAL",
    externalStagingActivated: false,
    productionAuthorized: false,
    hostedCompatibility: "NOT_VERIFIED",
    status: "BLOCKED",
    checks: [],
  };
  let db;
  try {
    docker("network", "create", "--internal", name);
    resources.push(["network", "rm", name]);
    const database = `p2p_disposable_${token}`;
    const envFile = path.join(dir, "postgres.env");
    fs.writeFileSync(
      envFile,
      `POSTGRES_PASSWORD=${password}\nPOSTGRES_USER=p2p_test\nPOSTGRES_DB=${database}\n`,
      { mode: 0o600 },
    );
    const pg = `${name}-db`;
    docker(
      "run",
      "--detach",
      "--name",
      pg,
      "--network",
      "bridge",
      ...proxyOff,
      "--env-file",
      envFile,
      "--tmpfs",
      "/var/lib/postgresql/data:rw",
      "--publish",
      "127.0.0.1::5432",
      policy.postgresImages[major],
    );
    resources.push(["rm", "--force", pg]);
    docker("network", "connect", "--alias", "database", name, pg);
    const address = docker("port", pg, "5432/tcp");
    assert.match(address, /^127\.0\.0\.1:\d+$/);
    const url = new URL(
      `postgresql://127.0.0.1:${address.split(":")[1]}/${database}`,
    );
    url.username = "p2p_test";
    url.password = password;
    const { Client } = require(path.join(backend, "node_modules/pg"));
    db = await eventually(async () => {
      const c = new Client({ connectionString: url.toString() });
      try {
        await c.connect();
        return c;
      } catch (e) {
        await c.end();
        throw e;
      }
    });
    report.serverVersion = (
      await db.query("SHOW server_version")
    ).rows[0].server_version;
    assert.equal(report.serverVersion.split(".")[0], major);
    const releaseRef = `synthetic-${commit}`;
    report.fixtureSequence = await require("./fixture.cjs").bootstrap(
      db,
      backend,
      url.toString(),
      releaseRef,
      runtimePassword,
    );
    report.checks.push("canonical_fixture_and_actual_forward_execution");
    const service = require(
      path.join(backend, "services/databaseReleaseService"),
    );
    const verification = await service.verify(db, {
      releaseRef,
      environment: "disposable",
      role: "purchase_backend",
    });
    report.database = {
      status: verification.status,
      findings: verification.findings,
      requiredContract: verification.required_contract,
    };
    assert.equal(verification.required_contract, policy.requiredContract);
    assert.equal(
      verification.status,
      "DATABASE_READY",
      JSON.stringify(verification.findings).slice(0, 2000),
    );
    report.checks.push("schema_role_receipts_attestation");
    const authPassword = crypto.randomBytes(24).toString("hex");
    const hash = await require(path.join(backend, "node_modules/bcrypt")).hash(
      authPassword,
      10,
    );
    await db.query(
      "INSERT INTO institutes(id,name) VALUES(74001,'Synthetic staging'); INSERT INTO departments(id,name,type,institute_id) VALUES(74001,'Synthetic','Medical',74001)",
    );
    await db.query(
      "INSERT INTO users(id,name,email,password,role,institute_id,department_id,is_active) VALUES(74001,'Synthetic staging','staging@example.invalid',$1,'requester',74001,74001,true)",
      [hash],
    );
    await db.query(
      "INSERT INTO institutes(id,name) VALUES(74002,'Foreign synthetic'); INSERT INTO departments(id,name,type,institute_id) VALUES(74002,'Foreign synthetic','Medical',74002); INSERT INTO users(id,name,email,password,role,institute_id,department_id,is_active) VALUES(74002,'Foreign synthetic','foreign-staging@example.invalid','no-login-fixture','requester',74002,74002,true); INSERT INTO requests(id,request_type,status,requester_id,department_id,institute_id) VALUES(74002,'Non-Stock','Approved',74002,74002,74002)",
    );
    await db.end();
    db = null;
    docker("network", "disconnect", "bridge", pg);
    assert.deepEqual(
      Object.keys(
        JSON.parse(docker("inspect", pg))[0].NetworkSettings.Networks,
      ),
      [name],
    );
    assert.equal(
      JSON.parse(docker("network", "inspect", name))[0].Internal,
      true,
    );
    const build = (image, dockerfile, context) => {
      const args = [
        "build",
        "--build-arg",
        `NODE_IMAGE=${policy.nodeImage}`,
        "--file",
        path.join(root, "deploy/staging", dockerfile),
        "--tag",
        image,
      ];
      if (process.env.CODEX_PROXY_CERT)
        args.push(
          "--secret",
          `id=proxy_ca,src=${process.env.CODEX_PROXY_CERT}`,
        );
      docker(...args, context);
      images.push(image);
      report.images ||= {};
      report.images[image.endsWith("-backend") ? "backend" : "frontend"] =
        docker("image", "inspect", "--format", "{{.Id}}", image);
    };
    build(`${name}-backend`, "backend.Dockerfile", backendPayload);
    const frontContext = path.join(dir, "frontend");
    fs.mkdirSync(frontContext);
    fs.cpSync(frontendPayload, path.join(frontContext, "build"), {
      recursive: true,
    });
    fs.copyFileSync(
      path.join(root, "deploy/staging/frontend-server.cjs"),
      path.join(frontContext, "frontend-server.cjs"),
    );
    build(`${name}-frontend`, "frontend.Dockerfile", frontContext);
    const runtimeUrl = new URL("postgresql://database:5432/" + database);
    runtimeUrl.username = "purchase_backend";
    runtimeUrl.password = runtimePassword;
    const runtimeEnv = path.join(dir, "runtime.env");
    fs.writeFileSync(
      runtimeEnv,
      `DATABASE_URL=${runtimeUrl}\nJWT_SECRET=${crypto.randomBytes(32).toString("hex")}\nNODE_ENV=staging\nHOST=0.0.0.0\nPORT=15051\nDB_RELEASE_ENVIRONMENT=disposable\nAPP_RELEASE_REF=${releaseRef}\nLIVE_ROUTING_ENABLED=false\nSCOP_FOUNDATION_ENABLED=false\nGUIDED_REQUESTS_ENABLED=false\nEMAIL_DRY_RUN=true\nSMTP_DRY_RUN=true\nDB_RELEASE_SCHEMA_PROFILE=canonical\n`,
      { mode: 0o600 },
    );
    const locked = [
      "--read-only",
      "--cap-drop=ALL",
      "--security-opt",
      "no-new-privileges",
      "--pids-limit",
      "128",
      "--memory",
      "768m",
      ...proxyOff,
    ];
    const be = `${name}-backend`,
      fe = `${name}-frontend`;
    docker(
      "run",
      "--detach",
      "--name",
      be,
      "--network",
      name,
      "--network-alias",
      "backend",
      ...locked,
      "--env-file",
      runtimeEnv,
      "--tmpfs",
      "/tmp:rw,noexec,nosuid,size=64m",
      "--tmpfs",
      "/app/private-uploads:rw,noexec,nosuid,uid=1000,gid=1000",
      "--tmpfs",
      "/app/uploads:rw,noexec,nosuid,uid=1000,gid=1000",
      be,
    );
    resources.push(["rm", "--force", be]);
    docker("run", "--detach", "--name", fe, "--network", name, ...locked, fe);
    resources.push(["rm", "--force", fe]);
    const check = async (p, status, options) => {
      const script = `fetch('http://127.0.0.1:8080'+${JSON.stringify(p)}, {...${JSON.stringify(options || {})},signal:AbortSignal.timeout(5000)}).then(async r=>console.log(JSON.stringify({status:r.status,body:await r.text()}))).catch(()=>process.exit(1))`;
      const response = JSON.parse(
        execFileSync(
          "docker",
          ["--host=unix:///var/run/docker.sock", "exec", "-i", fe, "node"],
          {
            input: script,
            encoding: "utf8",
            env: safety.environment(),
            timeout: 10000,
            stdio: ["pipe", "pipe", "pipe"],
          },
        ),
      );
      assert.equal(response.status, status, `HTTP ${p}`);
      return { json: async () => JSON.parse(response.body) };
    };
    await transactionalSwitch(
      fe,
      null,
      () => eventually(() => check("/health", 200)),
      () => Promise.resolve(docker("stop", fe)),
    );
    await check("/", 200);
    report.checks.push("frontend_same_origin_proxy_real_backend_startup");
    for (const p of [
      "/api/requests",
      "/api/approvals",
      "/api/warehouses",
      "/api/contracts",
      "/api/procure-to-pay/purchase-orders",
    ])
      await check(p, 401);
    const login = await check("/api/auth/login", 200, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "staging@example.invalid",
        password: authPassword,
      }),
    });
    const session = await login.json();
    assert(session.token);
    await check("/api/auth/me", 200, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    // Existing request object authorization must reject a foreign institute ID.
    // The route's established policy returns 403 rather than exposing payloads.
    await check("/api/requests/74002/full-details", 403, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    report.checks.push("foreign_institute_request_denied");
    await check("/api/auth/me", 401, {
      headers: { Authorization: "Bearer invalid" },
    });
    report.checks.push(
      "login_identity_invalid_token_and_domain_authentication_boundaries",
    );
    docker(
      "exec",
      pg,
      "psql",
      "-U",
      "p2p_test",
      "-d",
      database,
      "-c",
      "UPDATE users SET is_active=false WHERE id=74001",
    );
    await check("/api/auth/me", 401, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    await check("/api/auth/login", 403, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "staging@example.invalid",
        password: authPassword,
      }),
    });
    report.checks.push("deactivated_account_denied");
    // A real exited candidate container must not take the healthy slot away.
    const broken = `${name}-broken`;
    docker(
      "run",
      "--detach",
      "--name",
      broken,
      "--network",
      name,
      ...locked,
      fe,
      "node",
      "-e",
      "process.exit(7)",
    );
    resources.push(["rm", "--force", broken]);
    await eventually(() => {
      assert.equal(
        JSON.parse(docker("inspect", broken))[0].State.Status,
        "exited",
      );
    });
    const rollback = await transactionalSwitch(
      broken,
      fe,
      (slot) =>
        slot === fe
          ? check("/health", 200)
          : Promise.reject(Error("SYNTHETIC_HEALTH_FAILURE")),
      async (slot) => {
        docker("rm", "--force", slot);
        resources.pop();
      },
    );
    assert.equal(rollback.active, fe);
    report.rollback = rollback.rollback;
    report.status = "DISPOSABLE_REHEARSAL_PASSED_NOT_ACTIVATION_APPROVAL";
  } catch (e) {
    report.failure = {
      code: e.code || e.name,
      message: e.message
        .replace(/postgres(?:ql)?:\/\/\S+/g, "[REDACTED]")
        .slice(0, 2000),
    };
    // Disposable diagnostics only, with values redacted before persisting.
    const { spawnSync } = require("node:child_process");
    const log = spawnSync(
      "docker",
      [
        "--host=unix:///var/run/docker.sock",
        "logs",
        "--tail",
        "60",
        `${name}-backend`,
      ],
      { encoding: "utf8", env: safety.environment() },
    );
    const diagnostics = ((log.stdout || "") + (log.stderr || "")).replace(
      /postgres(?:ql)?:\/\/\S+/g,
      "[REDACTED]",
    );
    report.runtimeDiagnostic = diagnostics
      .replace(/[a-f0-9]{48,}/g, "[REDACTED]")
      .slice(-6000);
    throw e;
  } finally {
    if (db) await db.end();
    report.cleanupFailures = [];
    for (const args of resources.reverse())
      try {
        docker(...args);
      } catch {
        report.cleanupFailures.push(args[0]);
      }
    for (const image of images.reverse())
      try {
        docker("image", "rm", image);
      } catch {
        report.cleanupFailures.push("image");
      }
    fs.rmSync(dir, { recursive: true, force: true });
    if (report.cleanupFailures.length) report.status = "BLOCKED";
    report.finishedAt = new Date().toISOString();
    fs.mkdirSync(path.join(root, "quality-results/staging"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(root, `quality-results/staging/pg${major}.json`),
      JSON.stringify(report, null, 2) + "\n",
    );
  }
  if (report.status === "BLOCKED") throw Error("REHEARSAL_CLEANUP_FAILED");
  return report;
}
if (require.main === module) {
  // Relaunch without inherited application credentials, dotenv, runtime or Docker endpoint selectors.
  if (process.env.SCOP_SYNTHETIC_CHILD !== "true") {
    const env = safety.environment();
    env.SCOP_SYNTHETIC_CHILD = "true";
    if (process.env.GITHUB_ACTIONS) env.GITHUB_ACTIONS = "true";
    try {
      execFileSync(process.execPath, [__filename, ...process.argv.slice(2)], {
        env,
        stdio: "inherit",
        timeout: 20 * 60 * 1000,
      });
    } catch {
      process.exitCode = 1;
    }
  } else
    run({
      input: path.resolve("release-artifacts/staging-input"),
      major: process.argv[2] || "16",
      local: process.argv.includes("--local"),
    })
      .then((r) => console.log(r.status))
      .catch((e) => {
        console.error(
          "DISPOSABLE_REHEARSAL_BLOCKED",
          e.code || e.name,
          e.message.slice(0, 500),
        );
        process.exitCode = 1;
      });
}
module.exports = { run, transactionalSwitch, eventually };
