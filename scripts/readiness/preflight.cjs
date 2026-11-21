"use strict";
// READ-ONLY SOURCE AUDITOR. No provider client, daemon socket, host inspection,
// secret loading, deployment executor, SQL, or approval/attestation interface.
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  crypto = require("node:crypto"),
  net = require("node:net"),
  { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "../..");
const baseline = "f852b6add8596f61d389cb00f5f652ac75cd6cf5";
const sha = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const fail = (ok, code) => {
  if (!ok) throw Error(code);
};
const yaml = () =>
  require(
    require.resolve("js-yaml", {
      paths: [
        path.join(root, "purchase-backend"),
        path.join(root, "purchase-frontend"),
      ],
    }),
  );
function text(file, max = 1024 * 1024) {
  const s = fs.lstatSync(file);
  fail(
    s.isFile() && !s.isSymbolicLink() && s.size <= max,
    "UNSCANNABLE_PREFLIGHT_SOURCE",
  );
  return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
    fs.readFileSync(file),
  );
}
function loadSources(directory = root) {
  const files = [
    "scripts/readiness/preflight.synthetic.json",
    "deploy/persistent/cloud-init.yaml",
    "deploy/persistent/compose.yaml",
    "deploy/persistent/config.example.json",
    "deploy/persistent/policy.json",
    "deploy/persistent/firewall.sh",
    "deploy/persistent/host-policy.py",
    "deploy/persistent/network-policy.example.json",
    "deploy/persistent/docker-staging.conf",
    "deploy/persistent/scop-staging-firewall.service",
    "deploy/persistent/verify-storage.sh",
    "deploy/persistent/squid.conf",
    "deploy/persistent/agent.Dockerfile",
    "deploy/persistent/scop-staging.service",
    "deploy/persistent/scop-staging-infra.service",
    "deploy/persistent/terraform/main.tf.json",
    "deploy/persistent/terraform/.terraform.lock.hcl",
    "deploy/staging/policy.json",
    "deploy/sync/policy.json",
    "purchase-backend/database/releases/migration-inventory.json",
  ];
  for (const sub of [
    "scripts/persistent",
    "scripts/readiness",
    ".github/workflows",
    "docs/devops",
  ]) {
    for (const e of fs.readdirSync(path.join(directory, sub), {
      withFileTypes: true,
    })) {
      if (
        (["scripts/persistent", "scripts/readiness"].includes(sub) &&
          /\.(cjs|py)$/.test(e.name)) ||
        (sub === ".github/workflows" && /\.ya?ml$/.test(e.name)) ||
        (sub === "docs/devops" &&
          /^(12|13|14|15|16|17|18|19)-.*\.md$/.test(e.name))
      ) {
        fail(e.isFile() && !e.isSymbolicLink(), "UNSCANNABLE_PREFLIGHT_SOURCE");
        files.push(`${sub}/${e.name}`);
      }
    }
  }
  return Object.fromEntries(
    [...new Set(files)].sort().map((p) => [p, text(path.join(directory, p))]),
  );
}
function validateConfig(c) {
  const keys = [
    "version",
    "purpose",
    "syntheticOnly",
    "enabled",
    "databasePrepared",
    "activationAuthorized",
    "instance",
    "hostname",
    "database",
    "agentImage",
    "adminCidrs",
    "staffCidrs",
    "dnsResolvers",
  ];
  fail(
    c &&
      typeof c === "object" &&
      !Array.isArray(c) &&
      Object.keys(c).length === keys.length &&
      Object.keys(c).every((k) => keys.includes(k)),
    "EXACT_SYNTHETIC_CONFIGURATION_REQUIRED",
  );
  fail(
    c.version === 1 &&
      c.purpose === "wici-phase3c-offline-preflight" &&
      c.syntheticOnly === true &&
      c.enabled === false &&
      c.databasePrepared === false &&
      c.activationAuthorized === false,
    "PREFLIGHT_MUST_REMAIN_DISABLED",
  );
  fail(
    typeof c.instance === "string" && /^[a-z][a-z0-9-]{2,24}$/.test(c.instance),
    "INVALID_SYNTHETIC_INSTANCE",
  );
  fail(
    c.hostname === "staging.example.invalid" &&
      c.database === "scop_staging_synthetic",
    "SYNTHETIC_TARGETS_ONLY",
  );
  fail(
    typeof c.agentImage === "string" &&
      /^example\.invalid\/scop-agent@sha256:[a-f0-9]{64}$/.test(c.agentImage),
    "SYNTHETIC_DIGEST_REQUIRED",
  );
  const ipv4 = (ip) =>
    net.isIP(ip) === 4 && /^(192\.0\.2|198\.51\.100|203\.0\.113)\./.test(ip);
  for (const key of ["adminCidrs", "staffCidrs"]) {
    fail(
      Array.isArray(c[key]) &&
        c[key].length > 0 &&
        c[key].length <= 16 &&
        c[key].every((v) => {
          if (typeof v !== "string") return false;
          const p = v.split("/");
          return p.length === 2 && ipv4(p[0]) && /^(2[4-9]|3[0-2])$/.test(p[1]);
        }),
      "RESTRICTED_DOCUMENTATION_CIDRS_REQUIRED",
    );
  }
  fail(
    Array.isArray(c.dnsResolvers) &&
      c.dnsResolvers.length > 0 &&
      c.dnsResolvers.length <= 4 &&
      c.dnsResolvers.every((v) => typeof v === "string" && ipv4(v)),
    "DOCUMENTATION_DNS_REQUIRED",
  );
  return c;
}
function document(sources, file) {
  fail(typeof sources[file] === "string", "REQUIRED_SOURCE_MISSING");
  return sources[file];
}
const parse = (s, file) =>
  file.endsWith(".json")
    ? JSON.parse(document(s, file))
    : yaml().load(document(s, file));
function disabled(s) {
  const persistent = parse(s, "deploy/persistent/policy.json"),
    staging = parse(s, "deploy/staging/policy.json"),
    sync = parse(s, "deploy/sync/policy.json"),
    tf = parse(s, "deploy/persistent/terraform/main.tf.json");
  fail(
    persistent.externalActivationEnabled === false &&
      persistent.productionEnabled === false &&
      staging.externalStagingEnabled === false &&
      staging.productionEnabled === false &&
      staging.syntheticOnly === true &&
      sync.enabled === false &&
      tf.variable.activation_authorized.default === false,
    "ACTIVATION_OR_PUBLISHING_HARD_STOP_CHANGED",
  );
  const example = parse(s, "deploy/persistent/config.example.json");
  fail(
    example.enabled === false &&
      example.databasePrepared === false &&
      example.purpose === "wici-isolated-staging-v1" &&
      example.stateDirectory === "/var/lib/scop-staging",
    "EXAMPLE_CONFIGURATION_HARD_STOP_CHANGED",
  );
  require("../persistent/core.cjs").configuration(example, false);
  for (const name of ["hcloud_firewall", "hcloud_volume"])
    fail(
      tf.resource[name].staging.lifecycle.precondition.some(
        (p) => p.condition === "${var.activation_authorized}",
      ),
      "TERRAFORM_HARD_STOP_CHANGED",
    );
  fail(
    JSON.stringify(tf.resource.hcloud_server.staging.firewall_ids) ===
      JSON.stringify(["${hcloud_firewall.staging.id}"]),
    "TERRAFORM_DEPENDENCY_HARD_STOP_CHANGED",
  );
  for (const [file, job] of [
    ["staging-persistent", "package"],
    ["staging-release", "staging"],
    ["production-release", "production"],
    ["production-database-release", "migration"],
    ["repository-sync", "publish"],
  ]) {
    fail(
      parse(s, `.github/workflows/${file}.yml`).jobs?.[job]?.if ===
        "${{ false }}",
      "WORKFLOW_HARD_STOP_CHANGED",
    );
  }
}
function sameResourceSet(tf) {
  const allowed = [
    "hcloud_firewall",
    "hcloud_server",
    "hcloud_volume",
    "hcloud_volume_attachment",
  ];
  return (
    !tf.data &&
    JSON.stringify(Object.keys(tf.resource).sort()) ===
      JSON.stringify(allowed.sort()) &&
    Object.values(tf.resource).every(
      (group) =>
        Object.keys(group).length === 1 &&
        group.staging &&
        !group.staging.provisioner,
    )
  );
}
function validateComposeDocument(value) {
  fail(
    Object.keys(value).every((k) =>
      ["name", "x-staging-log", "services", "networks"].includes(k),
    ),
    "UNREVIEWED_COMPOSE_DOCUMENT",
  );
  fail(
    value.services &&
      value.services.database?.env_file ===
        "/etc/scop-staging/database-owner.env",
    "UNREVIEWED_ENV_FILE_REFERENCE",
  );
  for (const [name, service] of Object.entries(value.services)) {
    fail(
      ![
        "extends",
        "build",
        "label_file",
        "configs",
        "secrets",
        "credential_spec",
      ].some((k) => Object.hasOwn(service, k)),
      "EXTERNAL_COMPOSE_REFERENCE_FORBIDDEN",
    );
    fail(
      name === "database" || !Object.hasOwn(service, "env_file"),
      "EXTERNAL_COMPOSE_ENV_FORBIDDEN",
    );
  }
  return value;
}
// Explicit reviewed source identities, not shell/security substring heuristics.
// Shell bytes are exact. Config/code CRLF normalization is safe for their parsers;
// inventory evidence always retains original bytes. Unknown revisions fail.
const hardeningIdentities = {
  "deploy/persistent/verify-storage.sh":
    "42ffc83172c9e2fdc22f0f3df61e41b015217eeca68f29360413c557cff355f2",
  "deploy/persistent/scop-staging-infra.service":
    "82b281d89ef63deb92ea8e6f12d5e66aa118b9bcf0270f819d2c4a125babac69",
  "deploy/persistent/scop-staging.service":
    "2e01bbf1b91fc5658b2cef0c78fcf95862472a65a0e1c03e3ffe5d8b65045147",
  "deploy/persistent/scop-staging-firewall.service":
    "ef57766df99780991c8ab1f6b56623100b63db8387837ef415c72e1281b9463e",
  "deploy/persistent/docker-staging.conf":
    "fdb96712c5ad503765a94aa28e4767a9f98685727da5547859388624ca73e7f5",
  "deploy/persistent/cloud-init.yaml":
    "68fc904f9f6ce6c568f20657185362d087ee1b0f340548fcdb327a51c9b89081",
  "deploy/persistent/firewall.sh":
    "f8d9189eaf66ac9b838667104842f8b350d680db3eb8c25993a57e6303ea5e0b",
  "deploy/persistent/host-policy.py":
    "8413f85178e1ee5523ed3d00e6c3ba2bd1991c6ff34cb35dae0b6591c3a1d745",
  "deploy/persistent/terraform/main.tf.json":
    "b4a60cb93be3e069df4145cb5ed3bae1c55ce4ec3ee8b3d2b03102a846730bb8",
  "scripts/persistent/runtime.cjs":
    "8bd104c29d1ee82a4c6ebd65db8d203caae29d8ba18422fbe18dce0db956707f",
};
function reviewed(sources, files) {
  return files.every((file) => {
    const value = document(sources, file);
    return (
      sha(file.endsWith(".sh") ? value : value.replace(/\r\n/g, "\n")) ===
      hardeningIdentities[file]
    );
  });
}
function assess({ sources, config, composeEvidence = null, source = null }) {
  validateConfig(config);
  disabled(sources);
  const composeFile = "deploy/persistent/compose.yaml",
    tfFile = "deploy/persistent/terraform/main.tf.json",
    firewallFile = "deploy/persistent/firewall.sh",
    infraFile = "deploy/persistent/scop-staging-infra.service",
    storeFile = "deploy/persistent/verify-storage.sh",
    hostFile = "deploy/persistent/host-policy.py",
    networkUnit = "deploy/persistent/scop-staging-firewall.service",
    dropinFile = "deploy/persistent/docker-staging.conf";
  const networkFiles = [
    hostFile,
    firewallFile,
    networkUnit,
    dropinFile,
    infraFile,
    tfFile,
    "deploy/persistent/scop-staging.service",
    "deploy/persistent/cloud-init.yaml",
  ];
  const compose = validateComposeDocument(parse(sources, composeFile)),
    tf = parse(sources, tfFile),
    firewall = document(sources, firewallFile),
    infra = document(sources, infraFile),
    storage = document(sources, storeFile),
    squid = document(sources, "deploy/persistent/squid.conf");
  const inventory = Object.entries(sources)
    .sort(([a], [b]) => a.localeCompare(b, "en"))
    .map(([p, value]) => ({
      path: p,
      sha256: sha(value),
      bytes: Buffer.byteLength(value),
    }));
  const controls = [];
  function add(
    id,
    description,
    result,
    severity,
    files,
    observation,
    remediation,
    owner,
    dependencies = [],
  ) {
    fail(
      ["PASS", "FAIL", "BLOCKED", "EXTERNAL_VALIDATION_REQUIRED"].includes(
        result,
      ),
      "INVALID_CONTROL_RESULT",
    );
    controls.push({
      control_id: id,
      description,
      evidence: files.map((p) => {
        const v = document(sources, p);
        return { path: p, sha256: sha(v), observation };
      }),
      result,
      severity,
      required_remediation: remediation,
      owner,
      activation_dependency: dependencies,
    });
  }
  const check = (
    id,
    description,
    ok,
    severity,
    files,
    observation,
    remediation,
    owner,
    deps,
  ) =>
    add(
      id,
      description,
      ok ? "PASS" : "FAIL",
      severity,
      files,
      ok &&
        ["TF-04", "CMP-03", "START-01", "NET-03", "NET-04", "STO-01"].includes(
          id,
        )
        ? "Static predicate satisfied in the inspected source. Remediation differs from the reviewed baseline and still needs independent semantic review and external acceptance."
        : observation,
      ok
        ? "None for this static check; external acceptance is separate."
        : remediation,
      owner,
      deps,
    );
  add(
    "SAFE-01",
    "Existing staging, production, database and synchronization hard stops remain disabled",
    "PASS",
    "critical",
    [
      "deploy/persistent/policy.json",
      "deploy/staging/policy.json",
      "deploy/sync/policy.json",
      ".github/workflows/staging-persistent.yml",
      ".github/workflows/production-release.yml",
      ".github/workflows/production-database-release.yml",
      ".github/workflows/staging-release.yml",
      ".github/workflows/repository-sync.yml",
    ],
    "Parsed flags are false and all five executor jobs have literal false guards. Any change rejects report generation.",
    "No activation authorized.",
    "Security reviewer",
  );
  const providerLock =
    document(sources, "deploy/persistent/terraform/.terraform.lock.hcl").match(
      /provider\s+"registry\.terraform\.io\/hetznercloud\/hcloud"\s*\{([^}]+)\}/,
    )?.[1] || "";
  check(
    "TF-01",
    "Terraform provider constraint and checksum lock are coherent",
    tf.terraform.required_providers.hcloud.source === "hetznercloud/hcloud" &&
      tf.terraform.required_providers.hcloud.version === "~> 1.50.0" &&
      /version\s*=\s*"1\.50\.1"/.test(providerLock) &&
      /constraints\s*=\s*"~> 1\.50\.0"/.test(providerLock),
    "high",
    [tfFile, "deploy/persistent/terraform/.terraform.lock.hcl"],
    "Source constraint/lock consistency only. Terraform validate is a separate offline tool check; no provider availability or API compatibility is inferred.",
    "Review and checksum-lock the provider and rerun offline schema validation.",
    "Platform engineer",
  );
  check(
    "TF-02",
    "Server and data volume cannot be destroyed by routine Terraform replacement",
    tf.resource.hcloud_server.staging.lifecycle.prevent_destroy === true &&
      tf.resource.hcloud_volume.staging.lifecycle.prevent_destroy === true &&
      tf.resource.hcloud_volume_attachment.staging.automount === false,
    "high",
    [tfFile],
    "Server/volume prevent_destroy and explicitly manual mount attachment are present; this is not backup or restore evidence.",
    "Restore lifecycle protections; review any replacement or reattachment separately.",
    "Platform engineer",
    ["EXT-STORAGE"],
  );
  check(
    "TF-03",
    "Template has staging identity, no cloud private-network attachment and IPv6 disabled",
    tf.resource.hcloud_server.staging.labels.production === "false" &&
      tf.resource.hcloud_server.staging.labels.purpose ===
        "wici-isolated-staging-v1" &&
      tf.resource.hcloud_server.staging.public_net[0].ipv6_enabled === false &&
      sameResourceSet(tf) &&
      !tf.resource.hcloud_network &&
      !tf.resource.hcloud_server.staging.network,
    "critical",
    [tfFile],
    "No shared cloud private network is defined. Actual project identity, routes and provider reachability are unverified.",
    "Remove shared/production resources and use an independently approved dedicated project.",
    "Security reviewer",
    ["EXT-PROVIDER", "EXT-NETWORK"],
  );
  check(
    "TF-04",
    "Reviewed Terraform enforces bounded SSH IDs, volume, staging identity and canonical restricted IPv4 inputs",
    reviewed(sources, [tfFile]),
    "medium",
    [tfFile],
    "Source identity includes nonempty unique SSH IDs, integer40-200GB volumes, staging-only names, bounded canonical public IPv4 CIDRs/resolvers and explicit endpoints. Real key/project ownership and endpoint authorization remain external requirements.",
    "Add reviewed nonempty SSH-key and bounded storage validation before provisioning; verify actual CIDR/key ownership externally.",
    "Platform engineer",
    ["EXT-PROVIDER"],
  );
  const expectedProfiles = {
    database: "separately-approved-database",
    gateway: "separately-approved-gateway",
    agent: "separately-approved-agent",
    egress: "separately-approved-egress",
  };
  check(
    "CMP-01",
    "All infrastructure services require an explicit profile and avoid Docker auto-restart",
    Object.keys(compose.services).length === 4 &&
      Object.entries(expectedProfiles).every(
        ([name, p]) =>
          JSON.stringify(compose.services[name]?.profiles) ===
            JSON.stringify([p]) && compose.services[name]?.restart === "no",
      ),
    "high",
    [composeFile],
    "All four services must be profiled; an empty-profile projection must have no services.",
    "Restore explicit profiles and restart:no; do not auto-start application workers.",
    "Platform engineer",
    ["EXT-RECOVERY"],
  );
  check(
    "CMP-02",
    "Infrastructure image references are immutable digests or required agent input",
    ["database", "gateway", "egress"].every((k) =>
      /^[^\s]+@sha256:[a-f0-9]{64}$/.test(compose.services[k]?.image || ""),
    ) &&
      compose.services.agent.image ===
        "${SCOP_AGENT_IMAGE:?independently reviewed agent image digest required}",
    "high",
    [composeFile],
    "Base digests are syntactically pinned. Compose itself accepts arbitrary SCOP_AGENT_IMAGE values; this auditor accepts only a synthetic digest. No real image provenance is claimed.",
    "Restore digest references and independently approve the actual agent digest before use.",
    "Security reviewer",
    ["EXT-IMAGES"],
  );
  check(
    "CMP-03",
    "All infrastructure services/networks retain instance, purpose and role ownership and enforced checks",
    [compose.services, compose.networks].every((group) =>
      Object.entries(group).every(
        ([role, value]) =>
          value.labels?.["wici.scop.instance"] === "${SCOP_INSTANCE}" &&
          value.labels?.["wici.scop.purpose"] === "wici-isolated-staging-v1" &&
          value.labels?.["wici.scop.role"] === role,
      ),
    ) &&
      reviewed(sources, [
        hostFile,
        infraFile,
        "deploy/persistent/scop-staging.service",
        "scripts/persistent/runtime.cjs",
      ]),
    "medium",
    [composeFile],
    "Explicit service/network ownership; host pre/post-start inspection refuses missing/foreign labels, controller validates shared network/gateway/DB ownership, and full release provenance protects recovery cleanup. Bind storage uses mount/UUID identity rather than fictitious Docker volume labels.",
    "Add/verify staging instance ownership for agent and egress before external lifecycle changes or acceptance; do not adopt unknown containers.",
    "Platform engineer",
  );
  const mounts = (name) => compose.services[name].volumes;
  const agentMounts = [
    "/var/run/docker.sock:/var/run/docker.sock",
    "/var/lib/scop-staging:/var/lib/scop-staging",
    "/etc/scop-staging/config.json:/etc/scop-staging/config.json:ro",
    "/etc/scop-staging/github-app.pem:/etc/scop-staging/github-app.pem:ro",
    "/etc/scop-staging/runtime.json:/etc/scop-staging/runtime.json:ro",
    "/etc/scop-staging/probe:/etc/scop-staging/probe:ro",
  ];
  const sameStrings = (a, b) =>
    Array.isArray(a) &&
    a.every((v) => typeof v === "string") &&
    JSON.stringify(a.slice().sort()) === JSON.stringify(b.slice().sort());
  const gatewayMounts = [
    "/var/lib/scop-staging/gateway:/routes:ro",
    "/etc/scop-staging/tls:/certs:ro",
    "/etc/scop-staging/access:/access:ro",
  ];
  agentMounts.push("/proc/sys/kernel/random/boot_id:/run/scop-host-boot-id:ro");
  check(
    "CMP-05",
    "Canonical volume paths and staging secret access boundaries are preserved",
    sameStrings(mounts("agent"), agentMounts) &&
      sameStrings(mounts("gateway"), gatewayMounts) &&
      sameStrings(mounts("egress"), [
        "/etc/scop-staging/squid.conf:/etc/squid/squid.conf:ro",
      ]),
    "critical",
    [composeFile],
    "Expected source mount paths/access flags only. Existence, permissions, secret content, symlink safety and volume identity require external inspection. Docker socket authority remains root-equivalent on the dedicated host.",
    "Restore exact canonical mounts and keep DB owner credentials out of agent/application mounts.",
    "Security reviewer",
    ["EXT-STORAGE", "EXT-ACCESS"],
  );
  const cloud = parse(sources, "deploy/persistent/cloud-init.yaml");
  check(
    "BOOT-01",
    "Cloud-init prepares the OS only and leaves explicit activation pending",
    Object.keys(cloud).every((k) =>
      [
        "bootcmd",
        "package_update",
        "packages",
        "ssh_pwauth",
        "disable_root",
        "write_files",
        "runcmd",
      ].includes(k),
    ) &&
      sameStrings(cloud.packages, [
        "docker.io",
        "docker-compose-v2",
        "ca-certificates",
        "nftables",
        "python3",
      ]) &&
      cloud.write_files.length === 2 &&
      cloud.write_files.every((f) =>
        [
          "/etc/scop-staging/host-purpose",
          "/etc/scop-staging/ACTIVATION_PENDING",
        ].includes(f.path),
      ) &&
      cloud.ssh_pwauth === false &&
      cloud.disable_root === true &&
      cloud.write_files.some(
        (f) => f.path === "/etc/scop-staging/ACTIVATION_PENDING",
      ) &&
      !cloud.write_files.some((f) => f.path.endsWith("/ACTIVATION_APPROVED")) &&
      reviewed(sources, ["deploy/persistent/cloud-init.yaml"]) &&
      JSON.stringify(cloud.runcmd) ===
        JSON.stringify([["install", "-d", "-m", "0700", "/etc/scop-staging"]]),
    "critical",
    ["deploy/persistent/cloud-init.yaml"],
    "Reviewed one-time bootcmd masks Docker service/socket before package installation; no app activation, clone, secrets or SQL. First-boot package transport and actual quarantine behavior still need external evidence.",
    "Keep initial user-data non-activating; separately review any initializer or service command.",
    "Platform engineer",
    ["EXT-PROVIDER", "EXT-BOOT"],
  );
  const networkKeys = (v) =>
    Array.isArray(v) ? v.slice().sort() : Object.keys(v || {}).sort();
  const expectedNetworks = {
    database: ["data"],
    gateway: ["edge", "ingress"],
    agent: ["control"],
    egress: ["control", "edge"],
  };
  check(
    "NET-01",
    "Database/control/ingress networks are internal and only gateway publishes HTTPS",
    ["data", "control", "ingress"].every(
      (k) =>
        compose.networks[k]?.internal === true &&
        !compose.networks[k]?.external,
    ) &&
      compose.networks.edge.enable_ipv6 === false &&
      Object.entries(expectedNetworks).every(
        ([k, n]) =>
          JSON.stringify(networkKeys(compose.services[k]?.networks)) ===
            JSON.stringify(n) &&
          !compose.services[k].network_mode &&
          !compose.services[k].privileged &&
          compose.services[k].pid !== "host" &&
          compose.services[k].ipc !== "host",
      ) &&
      compose.services.gateway.networks.edge.ipv4_address === "172.30.60.10" &&
      compose.services.egress.networks.edge.ipv4_address === "172.30.60.20" &&
      !compose.services.database.ports &&
      !compose.services.agent.ports &&
      !compose.services.egress.ports &&
      JSON.stringify(compose.services.gateway.ports) ===
        JSON.stringify(["443:443"]),
    "critical",
    [composeFile],
    "Static topology only; no claim about Docker DNS, forwarding, daemon rules, host routing or real packet isolation.",
    "Restore private application/data/control topology and HTTPS-only ingress.",
    "Security reviewer",
    ["EXT-NETWORK"],
  );
  const squidLines = squid
    .split("\n")
    .map((l) => l.trim().replace(/\s+/g, " "))
    .filter((l) => l && !l.startsWith("#"));
  const expectedSquid = [
    "http_port 3128",
    "acl CONNECT method CONNECT",
    "acl TLS_port port 443",
    "acl private_network dst 0.0.0.0/8 10.0.0.0/8 127.0.0.0/8 169.254.0.0/16 172.16.0.0/12 192.168.0.0/16 ::1/128 fc00::/7 fe80::/10",
    "acl github_targets dstdomain api.github.com .blob.core.windows.net .actions.githubusercontent.com",
    "http_access deny private_network",
    "http_access deny !CONNECT",
    "http_access deny !TLS_port",
    "http_access allow github_targets",
    "http_access deny all",
    "cache deny all",
    "access_log stdio:/dev/stdout",
    "cache_log /dev/stderr",
    "pid_filename /tmp/squid.pid",
  ];
  check(
    "NET-02",
    "Proxy ACL restricts CONNECT/443 to GitHub artifact/API hosts and denies private destinations first",
    JSON.stringify(squidLines) === JSON.stringify(expectedSquid),
    "critical",
    ["deploy/persistent/squid.conf"],
    "Exact supported ACL/directive sequence, not an executable Squid/network test; unknown changes fail this static control. DNS rebinding, routing and actual refusal need external evidence.",
    "Restore reviewed restricted ACL order; verify allowed/denied destinations on a dedicated host.",
    "Security reviewer",
    ["EXT-NETWORK"],
  );
  check(
    "START-01",
    "Reviewed dependencies gate Docker and application startup on restrictive policy",
    reviewed(sources, networkFiles),
    "high",
    networkFiles,
    "Docker service/socket require the fail-closed firewall unit; initial Docker quarantine and dependency-ordered infrastructure prevent application startup after policy failure. Provider egress is bounded at creation; real boot behavior remains external.",
    "Review a firewall-before-connectivity startup sequence, preload images and test failure behavior before enabling units.",
    "Platform engineer",
    ["EXT-BOOT", "EXT-IMAGES"],
  );
  check(
    "NET-03",
    "Reviewed firewall uses owned atomic nftables replacement with no permissive fallback",
    reviewed(sources, networkFiles),
    "high",
    networkFiles,
    "Validated bounded inputs and ownership precede nft --check and one atomic nft -f transaction under flock. Failed replacement retains the old policy; first-load failure blocks Docker/socket. No ExecStop removes the table. Packet enforcement/reboot persistence remain external.",
    "Review atomic/staged rule installation and reboot/Docker-restart persistence; prove denial before connectivity and retain a management recovery path.",
    "Security reviewer",
    ["EXT-NETWORK", "EXT-BOOT"],
  );
  check(
    "NET-04",
    "Reviewed source validates bounded IPv4 resolvers and host/provider TCP/UDP53 policy",
    reviewed(sources, [hostFile, tfFile]),
    "medium",
    [hostFile, tfFile],
    "Strict bounded IPv4 resolver identities and TCP/UDP53 rules exist in host/proxy and provider policies. No unrestricted resolver/web egress is added. Actual approved endpoint mapping and DNS behavior remain external.",
    "Approve resolver identities, strict IP validation and bounded TCP/UDP DNS policy; test truncation/TCP fallback without widening general egress.",
    "Network engineer",
    ["EXT-NETWORK"],
  );
  add(
    "NET-05",
    "Trusted time synchronization and bootstrap/image/patch access have an approved restricted design",
    "BLOCKED",
    "high",
    [firewallFile, tfFile, "deploy/persistent/cloud-init.yaml"],
    "Bounded DNS TCP/UDP53, NTP UDP123 and explicit HTTPS CIDRs are defined, but actual approved time/mirror/CDN endpoints, OS resolver/clock configuration, offline image delivery, bootstrap transport and patch acceptance are unverified. No generic host web egress is allowed.",
    "Approve clock discipline, offline base-image delivery and patching sequence; do not open general outbound access to make bootstrap work.",
    "Platform engineer",
    ["EXT-IMAGES", "EXT-BOOT"],
  );
  check(
    "STO-01",
    "Storage verifier and enforced pre-start unit match the reviewed exact-mount, non-root and UUID validation identities",
    reviewed(sources, [storeFile, infraFile]),
    "high",
    [storeFile, infraFile],
    "Full source identities require exact dedicated mount target, non-root device/UUID identity, rejected missing/malformed information and symlink/nested-mount checks, enforced before Compose. Unknown scripts/units remain FAIL. This is not actual volume acceptance.",
    "Independently review exact mount target, non-root device identity, valid expected UUID, missing-information failure and enforced pre-start behavior. Only an explicitly reviewed full source identity may pass; do not edit the authoritative script to improve this metric. Actual volume identity/durability still requires external evidence.",
    "Storage operator",
    ["EXT-STORAGE"],
  );
  check(
    "STO-02",
    "Database bind refuses silent data-directory creation and boot identity is read-only",
    compose.services.database.volumes.some(
      (v) =>
        v.source === "/var/lib/scop-staging/postgres" &&
        v.bind?.create_host_path === false,
    ) &&
      compose.services.agent.volumes.includes(
        "/proc/sys/kernel/random/boot_id:/run/scop-host-boot-id:ro",
      ),
    "high",
    [composeFile, storeFile],
    "Data directory must exist and PG_VERSION must be present; host boot UUID remains a fixed read-only bind. No UUID, filesystem durability or kernel/daemon identity is observed.",
    "Restore non-creating DB mount and the reviewed host boot-ID bind.",
    "Storage operator",
    ["EXT-STORAGE", "EXT-RECOVERY"],
  );
  add(
    "START-02",
    "Infrastructure readiness, mount initialization and first-boot ordering have approved evidence",
    "BLOCKED",
    "high",
    [
      infraFile,
      "deploy/persistent/scop-staging.service",
      "deploy/persistent/cloud-init.yaml",
      tfFile,
    ],
    "Units require the data mount and activation marker. Compose up -d is not a health/readiness barrier; no fstab/automount or synthetic canonical schema installer is supplied. Runtime DB preflight remains fail-closed.",
    "Review exact mount/preparation/health ordering and readiness failure handling before enabling units; no initialization is performed here.",
    "Platform engineer",
    ["DB-02", "EXT-BOOT", "EXT-STORAGE"],
  );
  const agentUnit = document(sources, "deploy/persistent/scop-staging.service");
  const unitFields = (value) => {
    const section = value.split("[Unit]")[1]?.split(/\n\[/)[0] || "";
    const fields = {};
    for (const line of section.split("\n").map((line) => line.trim())) {
      const m = line.match(/^([A-Za-z]+)=(.*)$/);
      if (!m) continue;
      fail(
        !Object.hasOwn(fields, m[1]),
        "UNSUPPORTED_DUPLICATE_UNIT_DECLARATION",
      );
      fields[m[1]] = m[2];
    }
    return fields;
  };
  const infraFields = unitFields(infra),
    agentFields = unitFields(agentUnit);
  check(
    "START-03",
    "Service unit declarations retain mount, approval and dependency fences",
    [infraFields, agentFields].every(
      (v) =>
        v.RequiresMountsFor === "/var/lib/scop-staging" &&
        v.ConditionPathExists === "/etc/scop-staging/ACTIVATION_APPROVED",
    ) &&
      sameStrings((infraFields.Requires || "").split(" "), [
        "docker.service",
        "scop-staging-firewall.service",
      ]) &&
      sameStrings((agentFields.Requires || "").split(" "), [
        "docker.service",
        "scop-staging-infra.service",
        "scop-staging-firewall.service",
      ]) &&
      ["docker.service", "network-online.target"].every((x) =>
        (infraFields.After || "").split(" ").includes(x),
      ) &&
      [
        "docker.service",
        "scop-staging-infra.service",
        "network-online.target",
      ].every((x) => (agentFields.After || "").split(" ").includes(x)) &&
      infra.includes(
        "ExecStartPre=/bin/sh /opt/scop-staging/verify-storage.sh",
      ),
    "critical",
    [infraFile, "deploy/persistent/scop-staging.service"],
    "Parsed Unit dependency/mount/approval declarations and storage precheck are present. Actual systemd ordering, installed units, mounted device and readiness still require dedicated-host evidence.",
    "Restore exact staging unit dependency, mount and approval declarations; independently review startup behavior.",
    "Platform engineer",
    ["EXT-BOOT", "EXT-STORAGE"],
  );
  const inv = parse(
      sources,
      "purchase-backend/database/releases/migration-inventory.json",
    ),
    sql73 = inv.artifacts.find((r) => r.id === "073");
  check(
    "DB-01",
    "SQL073 remains manual-only with its frozen hash",
    sql73?.classification === "manual_recovery_migration" &&
      sql73.sha256 ===
        "58122f8c2449dd50d37eaa229d9d622faf7be4e34d56848c999aec5a38285ca2" &&
      inv.artifacts.length === 105,
    "critical",
    ["purchase-backend/database/releases/migration-inventory.json"],
    "Manifest metadata only; the independent source-integrity CI check verifies all actual bytes. This auditor never executes SQL or connects to a database.",
    "Restore frozen artifacts and manual-only classification; never regenerate history to obtain readiness.",
    "Database owner",
  );
  add(
    "DB-02",
    "Persistent synthetic schema, restricted runtime identity, genuine receipts and selected-SHA attestation are prepared",
    "BLOCKED",
    "critical",
    [
      "docs/devops/14-staging-database-and-recovery.md",
      "scripts/persistent/runtime.cjs",
    ],
    "An empty PostgreSQL container is not the canonical application schema. Existing runtime verify and startup gates remain required; no owner credentials, execution receipts or historical data are supplied.",
    "Separately review synthetic-only initialization, role/grants, real migration evidence and release attestation. SQL073 remains manual-only.",
    "Database owner",
    ["EXT-DB"],
  );
  add(
    "OPS-01",
    "Staging secrets, certificate lifecycle, App review boundaries and monitoring are independently approved",
    "BLOCKED",
    "critical",
    [
      "deploy/persistent/config.example.json",
      "scripts/persistent/github.cjs",
      "scripts/persistent/agent.cjs",
      "docs/devops/13-persistent-staging-activation.md",
    ],
    "The example remains disabled and contains placeholders. Source implements approval/artifact boundaries and local monitoring, but no external secrets, App, reviewers, clock, certificate or alert acceptance is inferred.",
    "Complete the staged approval checklist without sharing production identities or credentials; no settings change is made by this reporter.",
    "Hospital IT owner",
    ["EXT-ACCESS", "EXT-MONITORING"],
  );
  if (composeEvidence) {
    fail(
      composeEvidence.composeSha256 === sha(document(sources, composeFile)) &&
        composeEvidence.configSha256 === sha(JSON.stringify(config)),
      "COMPOSE_EVIDENCE_BINDING_MISMATCH",
    );
    const expectedSets = Array.from({ length: 16 }, (_, mask) =>
      Object.keys(expectedProfiles)
        .filter((_, i) => mask & (1 << i))
        .sort(),
    );
    const sets = composeEvidence.projections.map((p) =>
      p.services.slice().sort(),
    );
    check(
      "CMP-04",
      "Real offline Compose rendering checks all 16 profile combinations",
      JSON.stringify(sets) === JSON.stringify(expectedSets) &&
        composeEvidence.failures.length === 0,
      "high",
      [composeFile],
      `Docker Compose ${composeEvidence.version}; nonexistent daemon socket; source-derived semantic copy replaces only database env_file with an empty temporary fixture; 16 profiles; no real secrets read or containers, mounts, networks or pulls created.`,
      "Correct invalid profile projections before external deployment preparation.",
      "Platform engineer",
    );
  } else
    add(
      "CMP-04",
      "Real offline Compose profile rendering has been executed for this source/configuration",
      "BLOCKED",
      "medium",
      [composeFile],
      "No rendering evidence supplied to this source-only invocation.",
      "Run report --compose on a machine with Compose v2; it uses an intentionally nonexistent socket and synthetic input only.",
      "Platform engineer",
    );
  const external = [
    [
      "EXT-PROVIDER",
      "Actual provider/project isolation, current SKU/region capacity, cost and resource lifecycle",
      "Platform engineer",
      [tfFile],
    ],
    [
      "EXT-NETWORK",
      "Authorized management/HTTPS, denied outbound/private traffic, DNS, IPv6 and Docker/provider firewall persistence",
      "Network engineer",
      [firewallFile, tfFile, composeFile],
    ],
    [
      "EXT-STORAGE",
      "Dedicated volume attachment/mount, ownership, fsync/power-loss behavior, encryption, backup and restore",
      "Storage operator",
      [storeFile, tfFile],
    ],
    [
      "EXT-BOOT",
      "First boot, Docker restart and service dependency/failure behavior on a dedicated host",
      "Platform engineer",
      [infraFile, "deploy/persistent/scop-staging.service"],
    ],
    [
      "EXT-IMAGES",
      "Approved controller/base image provenance, vulnerability review, canonical Docker store and offline preload",
      "Security reviewer",
      [composeFile, "scripts/persistent/image-store.cjs"],
    ],
    [
      "EXT-RECOVERY",
      "Real host cold reboot, unknown Docker effects, no overlapping workers and retained release recovery",
      "Platform engineer",
      [
        "scripts/persistent/core.cjs",
        "docs/devops/16-pr109-recovery-context-validation.md",
      ],
    ],
    [
      "EXT-DB",
      "Actual isolated synthetic database compatibility, roles, receipts and release attestation",
      "Database owner",
      ["scripts/persistent/runtime.cjs"],
    ],
    [
      "EXT-ACCESS",
      "Real HTTPS/mTLS, credential rotation, institute isolation and hospital browser/UAT",
      "Hospital IT owner",
      [
        "scripts/persistent/gateway-probe.cjs",
        "docs/devops/15-hospital-staging-uat.md",
      ],
    ],
    [
      "EXT-MONITORING",
      "Host capacity, certificate/time drift, log/backup alerts and on-call response",
      "Platform operator",
      [
        "scripts/persistent/agent.cjs",
        "docs/devops/13-persistent-staging-activation.md",
      ],
    ],
  ];
  for (const [id, description, owner, files] of external)
    add(
      id,
      description,
      "EXTERNAL_VALIDATION_REQUIRED",
      "high",
      files,
      "Not observed. Static configuration, local models and CI do not establish this property.",
      "Obtain separate authorization and retain real dedicated-staging-host evidence with source SHA, timestamps, tool versions, reviewer, results and remediation; never test against production.",
      owner,
    );
  const counts = Object.fromEntries(
    ["PASS", "FAIL", "BLOCKED", "EXTERNAL_VALIDATION_REQUIRED"].map((k) => [
      k,
      controls.filter((c) => c.result === k).length,
    ]),
  );
  return {
    kind: "wici-phase3c-infrastructure-readiness",
    version: 1,
    scope: "OFFLINE_SYNTHETIC_PREPARATION_ONLY",
    reviewed_baseline: baseline,
    source,
    inventory_sha256: sha(JSON.stringify(inventory)),
    inventory,
    configuration_sha256: sha(JSON.stringify(config)),
    compose_validation: composeEvidence,
    activation_allowed: false,
    provisioning_allowed: false,
    production_allowed: false,
    readiness: "EXTERNAL_ACTIVATION_BLOCKED",
    counts,
    controls,
    limitations: [
      "Report generation success is not control success or deployment permission.",
      "Known Phase3B source gaps are reported, not silently repaired or waived.",
      "No cloud resource API, Docker daemon, external staging host, credentials or database was accessed.",
      "Modelled or static controls never become external acceptance evidence.",
    ],
  };
}
function renderProfiles(config, { run = execFileSync } = {}) {
  validateConfig(config);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scop-offline-compose-"));
  try {
    const empty = path.join(dir, "empty.env");
    fs.writeFileSync(empty, "", { mode: 0o600 });
    const original = validateComposeDocument(
      yaml().load(text(path.join(root, "deploy/persistent/compose.yaml"))),
    );
    fail(
      original.services.database.env_file ===
        "/etc/scop-staging/database-owner.env",
      "UNREVIEWED_ENV_FILE_REFERENCE",
    );
    // Compose still checks env-file existence with --no-env-resolution. Change
    // exactly one reference in a temporary semantic copy; never touch /etc.
    const projected = structuredClone(original);
    projected.services.database.env_file = empty;
    const syntheticCompose = path.join(dir, "compose.json");
    fs.writeFileSync(syntheticCompose, JSON.stringify(projected), {
      mode: 0o600,
    });
    const env = {
      PATH: process.env.PATH,
      ...(process.env.SYSTEMROOT ? { SYSTEMROOT: process.env.SYSTEMROOT } : {}),
      SCOP_INSTANCE: config.instance,
      SCOP_AGENT_IMAGE: config.agentImage,
      COMPOSE_DISABLE_ENV_FILE: "1",
      DOCKER_CONFIG: dir,
    };
    const base = ["--host=unix:///nonexistent-scop-preflight.sock", "compose"];
    const exec = (args) =>
      String(
        run("docker", [...base, ...args], {
          encoding: "utf8",
          env,
          timeout: 30000,
          maxBuffer: 2 * 1024 * 1024,
          stdio: ["ignore", "pipe", "pipe"],
        }),
      ).trim();
    const version = exec(["version", "--short"]),
      projections = [],
      failures = [];
    fail(
      /^v?2\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/.test(version) ||
        /^v?5\.1\.3$/.test(version),
      "SUPPORTED_COMPOSE_PARSER_REQUIRED",
    );
    const names = ["database", "gateway", "agent", "egress"];
    for (let mask = 0; mask < 16; mask++) {
      const profiles = names
        .filter((_, i) => mask & (1 << i))
        .map((n) => `separately-approved-${n}`);
      const args = [
        "--env-file",
        empty,
        "-f",
        syntheticCompose,
        "--project-name",
        "scop-offline-preflight",
        ...profiles.flatMap((p) => ["--profile", p]),
        "config",
        "--no-env-resolution",
        "--format",
        "json",
      ];
      try {
        const v = JSON.parse(exec(args));
        const normalized = JSON.stringify(v)
          .split(JSON.stringify(empty).slice(1, -1))
          .join("SYNTHETIC_EMPTY_ENV_FILE");
        projections.push({
          profiles,
          services: Object.keys(v.services || {}).sort(),
          projection_sha256: sha(normalized),
        });
      } catch {
        failures.push({ profiles, reason: "COMPOSE_RENDER_FAILED" });
        projections.push({ profiles, services: [] });
      }
    }
    return {
      version,
      syntheticTransforms: [
        {
          path: "services.database.env_file",
          from: "/etc/scop-staging/database-owner.env",
          to: "EMPTY_TEMPORARY_FIXTURE",
        },
      ],
      composeSha256: sha(
        text(path.join(root, "deploy/persistent/compose.yaml")),
      ),
      configSha256: sha(JSON.stringify(config)),
      projections,
      failures,
    };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
function exitCode(report) {
  return report.counts.FAIL ? 1 : 2;
} // this phase can NEVER authorize activation
function reportCode(report) {
  // Existing source gaps remain visible in a successfully generated report.
  // An attempted offline tool check that actually fails must also fail CI.
  return report.controls.some(
    (c) => c.control_id === "CMP-04" && c.result === "FAIL",
  )
    ? 1
    : 0;
}
function writeReport(report, outputRoot = root) {
  const segments = ["quality-results", "persistent", "preflight"];
  let dir = outputRoot;
  for (const s of segments) {
    dir = path.join(dir, s);
    if (fs.existsSync(dir))
      fail(
        fs.lstatSync(dir).isDirectory() && !fs.lstatSync(dir).isSymbolicLink(),
        "UNSAFE_REPORT_DIRECTORY",
      );
    else fs.mkdirSync(dir, { mode: 0o700 });
  }
  const file = path.join(dir, "readiness.json");
  const existing = fs.lstatSync(file, { throwIfNoEntry: false });
  if (existing)
    fail(existing.isFile() && !existing.isSymbolicLink(), "UNSAFE_REPORT_FILE");
  // Replacing a report atomically never follows a last-moment destination link.
  require("../persistent/core.cjs").atomic(file, report);
  return file;
}
function main(args = process.argv.slice(2)) {
  fail(
    args.length >= 1 &&
      ["report", "check"].includes(args[0]) &&
      args.slice(1).every((a) => a === "--compose") &&
      args.filter((a) => a === "--compose").length <= 1,
    "USAGE_PREFLIGHT_REPORT_OR_CHECK_COMPOSE",
  );
  const config = validateConfig(
      JSON.parse(
        text(
          path.join(root, "scripts/readiness/preflight.synthetic.json"),
          65536,
        ),
      ),
    ),
    sources = loadSources();
  const source = {
    commit: execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim(),
    dirty:
      execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], {
        cwd: root,
        encoding: "utf8",
      }).trim() !== "",
  };
  const report = assess({
    sources,
    config,
    source,
    composeEvidence: args.includes("--compose") ? renderProfiles(config) : null,
  });
  if (args[0] === "report") writeReport(report);
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  return args[0] === "check" ? exitCode(report) : reportCode(report);
}
if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (e) {
    console.error(
      JSON.stringify({
        kind: "wici-phase3c-infrastructure-readiness",
        readiness: "INPUT_REJECTED",
        activation_allowed: false,
        provisioning_allowed: false,
        production_allowed: false,
        error: /^[A-Z0-9_]+$/.test(e.message)
          ? e.message
          : "PREFLIGHT_SOURCE_OR_TOOL_ERROR",
      }),
    );
    process.exitCode = 1;
  }
}
module.exports = {
  loadSources,
  validateConfig,
  validateComposeDocument,
  disabled,
  assess,
  renderProfiles,
  writeReport,
  exitCode,
  reportCode,
  main,
};
