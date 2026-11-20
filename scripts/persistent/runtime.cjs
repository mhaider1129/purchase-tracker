"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  { execFileSync } = require("node:child_process");
const { assert, atomic, capsule } = require("./core.cjs");
const noProxy = [
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "http_proxy",
  "https_proxy",
  "all_proxy",
].flatMap((k) => ["--env", `${k}=`]);
function docker(...args) {
  return execFileSync(
    "docker",
    ["--host=unix:///var/run/docker.sock", ...args],
    {
      encoding: "utf8",
      env: { PATH: process.env.PATH, HOME: process.env.HOME },
      maxBuffer: 2 * 1024 * 1024,
      timeout: 120000,
      stdio: ["ignore", "pipe", "pipe"],
    },
  ).trim();
}
function names(c, r) {
  const identity = resourceIdentity(c, r);
  const result = {
    be: "scb-" + identity.dns,
    fe: "scf-" + identity.dns,
    network: "scn-" + identity.dns,
    probe: "scp-" + identity.dns,
    data: `scop-${c.instance}-data`,
    ingress: `scop-${c.instance}-ingress`,
    gateway: `scop-${c.instance}-gateway`,
  };
  for (const value of Object.values(result))
    assert(
      /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value),
      "INVALID_DNS_RESOURCE_NAME",
    );
  return result;
}
function resourceIdentity(c, r) {
  assert(/^[a-z][a-z0-9-]{2,24}$/.test(c.instance), "INVALID_INSTANCE");
  assert(/^[a-f0-9]{40}$/.test(r.commit), "INVALID_RELEASE_ID");
  const request = r.manifest?.request || r.request;
  if (r.request && r.manifest?.request)
    assert(
      String(r.request.runId) === String(request.runId) &&
        String(r.request.attempt) === String(request.attempt) &&
        r.request.workflowCommit === request.workflowCommit,
      "REQUEST_PROVENANCE_MISMATCH",
    );
  for (const value of [request?.runId, request?.attempt])
    assert(
      /^[1-9][0-9]*$/.test(String(value)) &&
        Number.isSafeInteger(Number(value)),
      "EXACT_REQUEST_IDENTITY_REQUIRED",
    );
  for (const key of ["backend", "frontend"])
    assert(
      /^sha256:[a-f0-9]{64}$/.test(r.images?.[key] || ""),
      "EXACT_IMAGE_IDENTITY_REQUIRED",
    );
  const digest = require("node:crypto")
    .createHash("sha256")
    .update(
      JSON.stringify([
        c.instance,
        r.commit,
        String(request.runId),
        String(request.attempt),
        r.images.backend,
        r.images.frontend,
      ]),
    )
    .digest();
  // Full 256-bit digest, RFC4648 base32 without padding. No commit or digest
  // prefix is truncated; 52 DNS-safe characters encode every source bit.
  const alphabet = "abcdefghijklmnopqrstuvwxyz234567";
  let bits = 0,
    value = 0,
    dns = "";
  for (const byte of digest) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      dns += alphabet[(value >>> bits) & 31];
    }
    value &= (1 << bits) - 1;
  }
  if (bits) dns += alphabet[(value << (5 - bits)) & 31];
  return {
    key: digest.toString("hex"),
    dns,
    request: `${request.runId}:${request.attempt}`,
  };
}
function labels(c, r) {
  const id = resourceIdentity(c, r);
  return {
    "wici.scop.instance": c.instance,
    "wici.scop.commit": r.commit,
    "wici.scop.request": id.request,
    "wici.scop.release": id.key,
  };
}
function assertOwned(info, c, r, name) {
  const metadata = info?.Config?.Labels || info?.Labels || {};
  assert(info?.Name?.replace(/^\//, "") === name, "RESOURCE_NAME_MISMATCH");
  for (const [key, value] of Object.entries(labels(c, r)))
    assert(metadata[key] === value, "FOREIGN_RELEASE_RESOURCE_REFUSED");
  return info;
}
function inspectOptional(kind, name, run = docker) {
  try {
    const rows = JSON.parse(
      kind === "network"
        ? run("network", "inspect", name)
        : run("inspect", name),
    );
    assert(rows.length === 1 && rows[0], "AMBIGUOUS_RESOURCE_INSPECTION");
    return rows[0];
  } catch (e) {
    if (
      e.status === 1 &&
      /No such (?:object|container|network)|network .* not found/i.test(
        String(e.stderr || ""),
      )
    )
      return null;
    throw e;
  }
}
function cleanupOwned(c, r, retained, run = docker) {
  assert(Array.isArray(retained), "RETAINED_RELEASE_SET_REQUIRED");
  const id = resourceIdentity(c, r).key;
  assert(
    !retained.some((item) => resourceIdentity(c, item).key === id),
    "PRESERVED_RELEASE_CLEANUP_FORBIDDEN",
  );
  const n = names(c, r),
    present = [];
  // Validate all present resources before any mutation. Absence is allowed for
  // an interrupted create; ambiguous inspection/foreign ownership is not.
  for (const name of [n.fe, n.be]) {
    const info = inspectOptional("container", name, run);
    if (!info) continue;
    const value = assertOwned(info, c, r, name);
    assert(!value.State.Running, "RUNNING_RELEASE_CLEANUP_FORBIDDEN");
    present.push(name);
  }
  const net = inspectOptional("network", n.network, run);
  if (net) assertOwned(net, c, r, n.network);
  for (const name of present) run("rm", name);
  if (net) run("network", "rm", n.network);
}
function route(c, r) {
  const body = r
    ? `header X-SCOP-Commit ${r.commit}\nheader X-SCOP-Release ${resourceIdentity(c, r).key}\nreverse_proxy ${names(c, r).fe}:8080`
    : 'respond "Staging maintenance; no production traffic is affected" 503';
  const marker = r ? r.commit : "maintenance";
  return `https://${c.hostname} {\n tls /certs/tls.crt /certs/tls.key {\n client_auth {\n mode require_and_verify\n trust_pool file {\n pem_file /access/client-ca.pem\n }\n }\n }\n ${body}\n}\nhttp://127.0.0.1:8081 {\n respond /__release "${marker}"\n respond /__release-id "${r ? resourceIdentity(c, r).key : "maintenance"}"\n}\n`;
}
function secrets(c, r, read = fs.readFileSync) {
  assert(
    c.runtimeSecretsFile === "/etc/scop-staging/runtime.json",
    "FIXED_RUNTIME_SECRET_FILE_REQUIRED",
  );
  const p = JSON.parse(read(c.runtimeSecretsFile));
  assert(
    /^[A-Za-z0-9_-]{32,}$/.test(p.databasePassword || "") &&
      /^[A-Za-z0-9_-]{32,}$/.test(p.jwtSecret || ""),
    "STRONG_STAGING_ONLY_SECRETS_REQUIRED",
  );
  assert(
    p.purpose === "wici-isolated-staging-v1" && p.instance === c.instance,
    "SECRET_INSTANCE_MISMATCH",
  );
  // No URL, hostname, owner account or arbitrary environment key is accepted.
  const u = new URL("postgresql://database:5432/" + c.database);
  u.username = "purchase_backend";
  u.password = p.databasePassword;
  return `DATABASE_URL=${u}\nDB_RELEASE_READONLY_URL=${u}\nJWT_SECRET=${p.jwtSecret}\nNODE_ENV=staging\nHOST=0.0.0.0\nPORT=15051\nDB_RELEASE_ENVIRONMENT=staging\nAPP_RELEASE_REF=${r.commit}\nDB_RELEASE_SCHEMA_PROFILE=canonical\nLIVE_ROUTING_ENABLED=false\nSCOP_FOUNDATION_ENABLED=false\nGUIDED_REQUESTS_ENABLED=false\nEMAIL_DRY_RUN=true\nSMTP_DRY_RUN=true\n`;
}
function adapter(c, paths = {}) {
  // In-process integration supplies temporary paths; the agent exposes no CLI,
  // request or configuration switch for overriding these production defaults.
  const dir = paths.stateDirectory || c.stateDirectory;
  const probeDirectory = paths.probeDirectory || "/etc/scop-staging/probe";
  function own(container, release) {
    const v = JSON.parse(docker("inspect", container))[0];
    assert(
      v.Config.Labels?.["wici.scop.instance"] === c.instance,
      "FOREIGN_CONTAINER_REFUSED",
    );
    return release ? assertOwned(v, c, release, container) : v;
  }
  function safeRelease(r) {
    capsule(r.manifest);
    assert(
      JSON.stringify(r.images) === JSON.stringify(r.manifest.images) &&
        r.commit === r.manifest.commit,
      "PRESERVED_RELEASE_TAMPERED",
    );
    return names(c, r);
  }
  function envFile(r) {
    return path.join(dir, "releases", r.commit, "runtime.env");
  }
  function switchRoute(r) {
    own(`scop-${c.instance}-gateway`);
    const target = path.join(dir, "gateway", "Caddyfile"),
      tmp = target + ".next";
    fs.writeFileSync(tmp, route(c, r), { mode: 0o600 });
    const routeFd = fs.openSync(tmp, "r");
    try {
      fs.fsyncSync(routeFd);
    } finally {
      fs.closeSync(routeFd);
    }
    // Validate while old route is still available. Both files are in a mounted directory.
    docker(
      "exec",
      `scop-${c.instance}-gateway`,
      "caddy",
      "validate",
      "--config",
      "/routes/Caddyfile.next",
      "--adapter",
      "caddyfile",
    );
    fs.renameSync(tmp, target);
    const routeDir = fs.openSync(path.dirname(target), "r");
    try {
      fs.fsyncSync(routeDir);
    } finally {
      fs.closeSync(routeDir);
    }
    docker(
      "exec",
      `scop-${c.instance}-gateway`,
      "caddy",
      "reload",
      "--config",
      "/routes/Caddyfile",
      "--adapter",
      "caddyfile",
    );
  }
  return {
    async executionEpoch() {
      return require("./core.cjs").validEpoch(
        fs
          .readFileSync(
            paths.executionEpochFile || "/run/scop-host-boot-id",
            "utf8",
          )
          .trim(),
      );
    },
    async preflight(r) {
      requireCanonicalImageStore();
      const n = safeRelease(r);
      const data = JSON.parse(docker("network", "inspect", n.data))[0];
      assert(data.Internal === true, "INTERNAL_DATABASE_NETWORK_REQUIRED");
      const db = own(`scop-${c.instance}-database`);
      assert(
        db.State.Running &&
          Object.keys(db.NetworkSettings.Networks).length === 1 &&
          db.NetworkSettings.Networks[n.data],
        "ISOLATED_PREPARED_DATABASE_REQUIRED",
      );
      for (const id of Object.values(r.images))
        assert(
          docker("image", "inspect", "--format", "{{.Id}}", id) === id,
          "LOADED_IMAGE_ID_MISMATCH",
        );
      fs.mkdirSync(path.dirname(envFile(r)), { recursive: true, mode: 0o700 });
      fs.writeFileSync(envFile(r), secrets(c, r, paths.readSecrets), {
        mode: 0o600,
      });
      // Canonical CLI establishes a READ ONLY transaction; no runtime role override.
      docker(
        "run",
        "--rm",
        "--network",
        n.data,
        "--read-only",
        "--cap-drop=ALL",
        "--security-opt",
        "no-new-privileges",
        ...noProxy,
        "--env-file",
        envFile(r),
        r.images.backend,
        "node",
        "scripts/databaseRelease.js",
        "verify",
        "--connection-mode",
        "runtime",
        "--environment",
        "staging",
        "--release",
        r.commit,
      );
    },
    async prepare(r) {
      const n = safeRelease(r),
        net = () => {
          const existing = inspectOptional("network", n.network);
          if (existing) return existing;
          docker(
            "network",
            "create",
            "--internal",
            ...Object.entries(labels(c, r)).flatMap(([k, v]) => [
              "--label",
              `${k}=${v}`,
            ]),
            n.network,
          );
          return JSON.parse(docker("network", "inspect", n.network))[0];
        };
      const network = assertOwned(net(), c, r, n.network);
      assert(network.Internal, "PRIVATE_RELEASE_NETWORK_REQUIRED");
      const create = (name, image, network, args = []) => {
        const existing = inspectOptional("container", name);
        if (existing) {
          const v = assertOwned(existing, c, r, name);
          assert(
            v.Image === image && !v.State.Running,
            "EXISTING_CANDIDATE_REQUIRES_RECOVERY",
          );
          return;
        }
        docker(
          "create",
          "--name",
          name,
          ...Object.entries(labels(c, r)).flatMap(([k, v]) => [
            "--label",
            `${k}=${v}`,
          ]),
          "--network",
          network,
          "--read-only",
          "--cap-drop=ALL",
          "--security-opt",
          "no-new-privileges",
          "--pids-limit",
          "256",
          "--memory",
          "1g",
          "--log-driver",
          "json-file",
          "--log-opt",
          "max-size=10m",
          "--log-opt",
          "max-file=5",
          ...noProxy,
          ...args,
          image,
        );
      };
      create(n.be, r.images.backend, n.network, [
        "--network-alias",
        "backend",
        "--env-file",
        envFile(r),
        "--tmpfs",
        "/tmp:rw,noexec,nosuid,size=64m",
        "--mount",
        `type=bind,src=${dir}/uploads,dst=/app/uploads`,
        "--mount",
        `type=bind,src=${dir}/private,dst=/app/private-uploads`,
      ]);
      create(n.fe, r.images.frontend, n.network);
      const connect = (network, name) => {
        if (!own(name, r).NetworkSettings.Networks[network])
          docker("network", "connect", network, name);
      };
      connect(n.data, n.be);
      connect(n.ingress, n.fe);
    },
    async stop(r) {
      const n = safeRelease(r);
      for (const name of [n.fe, n.be]) {
        const v = own(name, r);
        if (v.State.Running) docker("stop", "--time", "45", name);
        assert(!own(name, r).State.Running, "OLD_WORKERS_STILL_RUNNING");
      }
    },
    async start(r) {
      const n = safeRelease(r);
      for (const name of [n.be, n.fe]) {
        if (!own(name, r).State.Running) docker("start", name);
      }
    },
    async health(r) {
      const n = safeRelease(r);
      for (const [name, image] of [
        [n.be, r.images.backend],
        [n.fe, r.images.frontend],
      ]) {
        const v = own(name, r);
        assert(
          v.State.Running && v.Image === image,
          "RELEASE_PROCESS_NOT_RUNNING_OR_WRONG_IMAGE",
        );
      }
      const script =
        "Promise.all([fetch('http://127.0.0.1:8080/health',{signal:AbortSignal.timeout(4000)}),fetch('http://127.0.0.1:8080/api/auth/me',{signal:AbortSignal.timeout(4000)})]).then(async r=>{if(r[0].status!==200||r[1].status!==401)process.exit(1)}).catch(()=>process.exit(1))";
      let ok = false;
      for (let i = 0; i < 60; i++) {
        try {
          docker("exec", n.fe, "node", "-e", script);
          ok = true;
          break;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
      assert(ok, "PERSISTENT_HTTP_SMOKE_FAILED");
    },
    async maintenanceStatus() {
      own(`scop-${c.instance}-gateway`);
      return (
        docker(
          "exec",
          `scop-${c.instance}-gateway`,
          "wget",
          "-qO-",
          "http://127.0.0.1:8081/__release",
        ) === "maintenance"
      );
    },
    async maintenance() {
      switchRoute(null);
    },
    async route(r) {
      safeRelease(r);
      switchRoute(r);
    },
    async routeHealth(r) {
      const n = safeRelease(r);
      assert(
        docker(
          "exec",
          n.gateway,
          "wget",
          "-qO-",
          "http://127.0.0.1:8081/__release",
        ) === r.commit,
        "GATEWAY_RELEASE_MARKER_MISMATCH",
      );
      assert(
        docker(
          "exec",
          n.gateway,
          "wget",
          "-qO-",
          "http://127.0.0.1:8081/__release-id",
        ) === resourceIdentity(c, r).key,
        "GATEWAY_REQUEST_MARKER_MISMATCH",
      );
      await verifyGateway(c, r, { probeDirectory });
    },
  };
}
async function verifyGateway(
  c,
  r,
  {
    probeDirectory = "/etc/scop-staging/probe",
    run = docker,
    exec = execFileSync,
  } = {},
) {
  const n = names(c, r),
    existing = inspectOptional("container", n.probe, run);
  const remove = () => {
    const value = inspectOptional("container", n.probe, run);
    if (!value) return;
    assertOwned(value, c, r, n.probe);
    assert(
      value.Image === r.images.frontend &&
        value.Config.Labels["wici.scop.purpose"] === "gateway-probe",
      "FOREIGN_PROBE_REFUSED",
    );
    // Terminating this isolated probe cannot stop a business worker. A lost
    // client/runner may leave one behind; validate full ownership before removal.
    run("rm", "--force", n.probe);
  };
  if (existing) remove();
  const settings = {
    gateway: n.gateway,
    hostname: c.hostname,
    commit: r.commit,
    release: resourceIdentity(c, r).key,
    ca: fs.readFileSync(path.join(probeDirectory, "server-ca.pem"), "utf8"),
    cert: fs.readFileSync(path.join(probeDirectory, "client.crt"), "utf8"),
    key: fs.readFileSync(path.join(probeDirectory, "client.key"), "utf8"),
  };
  const script = `(${require("./gateway-probe.cjs").gatewayProbe.toString()})(JSON.parse(require('node:fs').readFileSync(0,'utf8'))).then(r=>console.log(JSON.stringify(r))).catch(()=>{console.error('GATEWAY_HTTPS_VERIFICATION_FAILED');process.exit(1)});`;
  try {
    const output = exec(
      "docker",
      [
        "--host=unix:///var/run/docker.sock",
        "run",
        "--name",
        n.probe,
        ...Object.entries(labels(c, r)).flatMap(([k, v]) => [
          "--label",
          `${k}=${v}`,
        ]),
        "--label",
        "wici.scop.purpose=gateway-probe",
        "--network",
        n.ingress,
        "--read-only",
        "--cap-drop=ALL",
        "--security-opt",
        "no-new-privileges",
        "--pids-limit",
        "32",
        "--memory",
        "128m",
        "-i",
        ...noProxy,
        r.images.frontend,
        "node",
        "-e",
        script,
      ],
      {
        input: JSON.stringify(settings),
        encoding: "utf8",
        env: { PATH: process.env.PATH, HOME: process.env.HOME },
        timeout: 15000,
        maxBuffer: 1024 * 1024,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    const receipt = JSON.parse(String(output));
    assert(
      receipt.status === "GATEWAY_HTTPS_MTLS_VERIFIED" &&
        receipt.commit === r.commit &&
        receipt.release === settings.release,
      "GATEWAY_RECEIPT_MISMATCH",
    );
    return receipt;
  } finally {
    remove();
  }
}

function requireCanonicalImageStore() {
  return require("./image-store.cjs").requireCanonicalStore(
    JSON.parse(docker("info", "--format", "{{json .}}")),
  );
}

module.exports = {
  docker,
  names,
  route,
  secrets,
  adapter,
  resourceIdentity,
  labels,
  assertOwned,
  cleanupOwned,
  verifyGateway,
  requireCanonicalImageStore,
  inspectOptional,
};
