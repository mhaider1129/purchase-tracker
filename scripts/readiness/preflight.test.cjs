"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  { execFileSync } = require("node:child_process");
const p = require("./preflight.cjs"),
  root = path.resolve(__dirname, "../.."),
  base = p.loadSources(),
  fixture = require("./preflight.synthetic.json");
const yaml = require(
  require.resolve("js-yaml", { paths: [path.join(root, "purchase-backend")] }),
);
const clone = (v) => structuredClone(v),
  sha = (s) => crypto.createHash("sha256").update(s).digest("hex"),
  control = (r, id) => r.controls.find((c) => c.control_id === id);
function mutate(file, change) {
  const s = { ...base },
    v = file.endsWith(".json") ? JSON.parse(s[file]) : yaml.load(s[file]);
  change(v);
  s[file] = file.endsWith(".json") ? JSON.stringify(v) : yaml.dump(v);
  return s;
}
function audit(sources = base, config = fixture, composeEvidence = null) {
  return p.assess({ sources, config, composeEvidence });
}
test("readiness schema inventories all authoritative sources and never authorizes activation", () => {
  const r = audit(),
    ids = new Set(r.controls.map((c) => c.control_id));
  assert.equal(ids.size, r.controls.length);
  for (const c of r.controls) {
    for (const k of [
      "control_id",
      "description",
      "evidence",
      "result",
      "severity",
      "required_remediation",
      "owner",
      "activation_dependency",
    ])
      assert(Object.hasOwn(c, k));
    assert(
      ["PASS", "FAIL", "BLOCKED", "EXTERNAL_VALIDATION_REQUIRED"].includes(
        c.result,
      ),
    );
    assert(c.evidence.length);
    for (const d of c.activation_dependency) assert(ids.has(d), d);
  }
  for (const field of [
    "activation_allowed",
    "provisioning_allowed",
    "production_allowed",
  ])
    assert.equal(r[field], false);
  assert.equal(r.readiness, "EXTERNAL_ACTIVATION_BLOCKED");
  assert.equal(r.counts.EXTERNAL_VALIDATION_REQUIRED, 9);
  for (const x of [
    "cloud-init.yaml",
    "firewall.sh",
    "verify-storage.sh",
    "compose.yaml",
    "scop-staging.service",
    "scop-staging-infra.service",
  ])
    assert(r.inventory.some((i) => i.path === `deploy/persistent/${x}`));
  assert(r.inventory.some((i) => i.path === "scripts/persistent/core.cjs"));
  assert(r.inventory.some((i) => i.path.endsWith(".terraform.lock.hcl")));
  assert.equal(r.inventory_sha256, sha(JSON.stringify(r.inventory)));
  for (const f of r.inventory) assert.equal(f.sha256, sha(base[f.path]));
});
for (const [name, change] of [
  ["enabled", (c) => (c.enabled = true)],
  ["database prepared", (c) => (c.databasePrepared = true)],
  ["provisioning authorized", (c) => (c.activationAuthorized = true)],
  ["synthetic marker missing", (c) => delete c.syntheticOnly],
  ["unknown credential", (c) => (c.token = "synthetic-not-a-real-secret")],
  ["missing instance", (c) => delete c.instance],
  ["instance array", (c) => (c.instance = [c.instance])],
  ["overlong instance", (c) => (c.instance = "a".repeat(26))],
  ["shell instance", (c) => (c.instance = "abc;id")],
  [
    "mutable image",
    (c) => (c.agentImage = "example.invalid/scop-agent:latest"),
  ],
  ["image array", (c) => (c.agentImage = [c.agentImage])],
  [
    "malformed digest",
    (c) => (c.agentImage = "example.invalid/scop-agent@sha256:abcd"),
  ],
  [
    "other registry",
    (c) =>
      (c.agentImage = c.agentImage.replace(
        "example.invalid",
        "unreviewed.example",
      )),
  ],
  ["real target", (c) => (c.hostname = "staging.real.example")],
  ["arbitrary database", (c) => (c.database = "other_database")],
  ["empty admin list", (c) => (c.adminCidrs = [])],
  ["world admin CIDR", (c) => (c.adminCidrs = ["0.0.0.0/0"])],
  ["wide documentation network", (c) => (c.staffCidrs = ["198.51.100.0/8"])],
  ["invalid CIDR", (c) => (c.staffCidrs = ["198.51.100.999/24"])],
  ["real resolver", (c) => (c.dnsResolvers = ["8.8.8.8"])],
  ["resolver missing", (c) => delete c.dnsResolvers],
])
  test(`incomplete or unsafe synthetic configuration is rejected: ${name}`, () => {
    const c = clone(fixture);
    change(c);
    assert.throws(() => p.validateConfig(c));
    assert.throws(() => audit(base, c));
  });
for (const [file, change] of [
  [
    "deploy/persistent/policy.json",
    (v) => (v.externalActivationEnabled = true),
  ],
  ["deploy/persistent/policy.json", (v) => delete v.productionEnabled],
  ["deploy/staging/policy.json", (v) => (v.externalStagingEnabled = true)],
  ["deploy/sync/policy.json", (v) => (v.enabled = true)],
  [
    "deploy/persistent/terraform/main.tf.json",
    (v) => (v.variable.activation_authorized.default = true),
  ],
  ...[
    ["staging-persistent", "package"],
    ["staging-release", "staging"],
    ["production-release", "production"],
    ["production-database-release", "migration"],
    ["repository-sync", "publish"],
  ].map(([file, job]) => [
    `.github/workflows/${file}.yml`,
    (v) => (v.jobs[job].if = "${{ true }}"),
  ]),
])
  test(`hard-stop changes reject the assessment, not merely add an advisory: ${file}`, () =>
    assert.throws(() => audit(mutate(file, change)), /HARD_STOP_CHANGED/));
for (const [id, change] of [
  ["CMP-01", (v) => delete v.services.agent.profiles],
  ["CMP-01", (v) => (v.services.database.restart = "always")],
  ["CMP-02", (v) => (v.services.gateway.image = "caddy:latest")],
  ["NET-01", (v) => (v.services.database.ports = ["5432:5432"])],
  ["NET-01", (v) => (v.networks.data.internal = false)],
  ["NET-01", (v) => (v.services.agent.networks = ["edge"])],
  [
    "CMP-05",
    (v) =>
      v.services.agent.volumes.push(
        "/etc/scop-staging/database-owner.env:/owner.env:ro",
      ),
  ],
  [
    "CMP-05",
    (v) =>
      (v.services.gateway.volumes = v.services.gateway.volumes.filter(
        (m) => !m.includes("/certs"),
      )),
  ],
  [
    "STO-02",
    (v) => (v.services.database.volumes[0].bind.create_host_path = true),
  ],
  [
    "STO-02",
    (v) =>
      (v.services.agent.volumes = v.services.agent.volumes.filter(
        (m) => !m.includes("boot_id"),
      )),
  ],
])
  test(`structural deployment regression is a FAIL control: ${id}`, () =>
    assert.equal(
      control(audit(mutate("deploy/persistent/compose.yaml", change)), id)
        .result,
      "FAIL",
    ));
test("source gaps remain visible rather than being passed by synthetic host observations", () => {
  const r = audit();
  assert.equal(control(r, "NET-05").result, "BLOCKED");
  assert.equal(control(r, "DB-02").result, "BLOCKED");
  const unit = "deploy/persistent/scop-staging-infra.service";
  const s = {
    ...base,
    [unit]:
      base[unit].replace(
        "Requires=docker.service scop-staging-firewall.service",
        "Requires=docker.service",
      ) + "\n# firewall-before-start\n",
  };
  assert.equal(control(audit(s), "START-01").result, "FAIL");
  assert.equal(control(audit(), "START-01").result, "PASS");
  // A source-only ordering correction can never turn host/network verification
  // into a PASS, regardless of rendering or modeled health.
  assert.equal(
    control(audit(s), "EXT-NETWORK").result,
    "EXTERNAL_VALIDATION_REQUIRED",
  );
  assert.notEqual(p.exitCode(audit(s)), 0);
});
test("missing source and malformed policy cannot silently produce a successful assessment", () => {
  const s = { ...base };
  delete s["deploy/persistent/compose.yaml"];
  assert.throws(() => audit(s));
  assert.throws(() =>
    audit({ ...base, "deploy/persistent/policy.json": "not-json" }),
  );
});
test("offline render wrapper uses a nonexistent socket, fresh empty env and no inherited credentials", () => {
  const seen = [];
  const evidence = p.renderProfiles(fixture, {
    run: (bin, args, options) => {
      assert.equal(bin, "docker");
      assert.equal(args[0], "--host=unix:///nonexistent-scop-preflight.sock");
      assert.equal(args[1], "compose");
      assert.equal(options.env.SCOP_INSTANCE, fixture.instance);
      assert.equal(options.env.SCOP_AGENT_IMAGE, fixture.agentImage);
      assert(
        !options.env.DATABASE_URL &&
          !options.env.GH_TOKEN &&
          !options.env.DOCKER_HOST &&
          !options.env.COMPOSE_PROFILES,
      );
      if (args.includes("version")) return "2.40.3";
      assert(args.includes("config") && args.includes("--no-env-resolution"));
      assert(
        !args.includes("up") && !args.includes("pull") && !args.includes("run"),
      );
      assert.equal(
        fs.readFileSync(args[args.indexOf("--env-file") + 1], "utf8"),
        "",
      );
      const actual = JSON.parse(
        fs.readFileSync(args[args.indexOf("-f") + 1], "utf8"),
      );
      const expected = yaml.load(base["deploy/persistent/compose.yaml"]);
      expected.services.database.env_file =
        args[args.indexOf("--env-file") + 1];
      assert.deepEqual(
        actual,
        expected,
        "synthetic rendering must change only the owner env-file reference",
      );
      seen.push(args);
      const services = {};
      for (let i = 0; i < args.length; i++)
        if (args[i] === "--profile")
          services[args[i + 1].replace("separately-approved-", "")] = {};
      return JSON.stringify({ services });
    },
  });
  assert.equal(seen.length, 16);
  assert.equal(evidence.failures.length, 0);
  assert.equal(
    control(audit(base, fixture, evidence), "CMP-04").result,
    "PASS",
  );
  const tampered = clone(evidence);
  tampered.composeSha256 = "0".repeat(64);
  assert.throws(() => audit(base, fixture, tampered), /BINDING/);
  const incomplete = clone(evidence);
  incomplete.projections.pop();
  assert.equal(
    control(audit(base, fixture, incomplete), "CMP-04").result,
    "FAIL",
  );
  const unsafe = clone(evidence);
  unsafe.projections[0].services = ["agent"];
  assert.equal(control(audit(base, fixture, unsafe), "CMP-04").result, "FAIL");
});
test("failed Compose rendering is a FAIL and never converted into accepted evidence", () => {
  const e = p.renderProfiles(fixture, {
    run: (bin, args) => {
      if (args.includes("version")) return "2.40.3";
      throw Error("synthetic render failure");
    },
  });
  assert.equal(e.failures.length, 16);
  assert.equal(control(audit(base, fixture, e), "CMP-04").result, "FAIL");
});
test("CLI strict check is nonzero while incomplete/external readiness remains and does not authorize anything", () => {
  const r = require("node:child_process").spawnSync(
    process.execPath,
    [path.join(__dirname, "preflight.cjs"), "check"],
    {
      encoding: "utf8",
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        SYSTEMROOT: process.env.SYSTEMROOT,
      },
    },
  );
  assert.equal(r.status, p.exitCode(audit()));
  const report = JSON.parse(r.stdout);
  assert.equal(report.activation_allowed, false);
  assert.equal(report.provisioning_allowed, false);
  const unknown = require("node:child_process").spawnSync(
    process.execPath,
    [path.join(__dirname, "preflight.cjs"), "apply"],
    { encoding: "utf8" },
  );
  assert.equal(unknown.status, 1);
  assert.equal(JSON.parse(unknown.stderr).activation_allowed, false);
});
test("offline assessment tooling and synthetic configuration are excluded from the privileged controller image", () => {
  const os = require("node:os"),
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "scop-preflight-context-"));
  try {
    require("../persistent/build-agent.cjs").context(dir);
    assert(!fs.existsSync(path.join(dir, "scripts/readiness/preflight.cjs")));
    assert(
      !fs.existsSync(
        path.join(dir, "scripts/readiness/preflight.synthetic.json"),
      ),
    );
    assert(fs.existsSync(path.join(dir, "scripts/persistent/agent.cjs")));
    assert(fs.existsSync(path.join(dir, "scripts/persistent/core.cjs")));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

for (const [file, change] of [
  ["deploy/persistent/config.example.json", (v) => (v.enabled = true)],
  ["deploy/persistent/config.example.json", (v) => (v.databasePrepared = true)],
  [
    "deploy/persistent/terraform/main.tf.json",
    (v) => (v.resource.hcloud_firewall.staging.lifecycle.precondition = []),
  ],
  [
    "deploy/persistent/terraform/main.tf.json",
    (v) => (v.resource.hcloud_volume.staging.lifecycle.precondition = []),
  ],
  [
    "deploy/persistent/terraform/main.tf.json",
    (v) => (v.resource.hcloud_server.staging.firewall_ids = []),
  ],
])
  test(`actual template guard/dependency change fails closed: ${file}`, () =>
    assert.throws(() => audit(mutate(file, change)), /HARD_STOP_CHANGED/));
for (const [id, change] of [
  ["NET-01", (v) => (v.services.egress.networks.data = {})],
  ["NET-01", (v) => (v.services.gateway.network_mode = "host")],
  [
    "NET-01",
    (v) => (v.services.egress.networks.edge.ipv4_address = "172.30.60.21"),
  ],
  ["CMP-05", (v) => v.services.gateway.volumes.push("/etc:/host:rw")],
  [
    "CMP-05",
    (v) => v.services.agent.volumes.push("/unreviewed:/unreviewed:rw"),
  ],
])
  test(`unsupported topology/mount expansion is rejected: ${id}`, () =>
    assert.equal(
      control(audit(mutate("deploy/persistent/compose.yaml", change)), id)
        .result,
      "FAIL",
    ));
for (const prefix of [
  "http_access allow all\n",
  "include /unreviewed/squid.conf\n",
])
  test(`permissive or unreviewed Squid directive cannot hide behind existing safe lines: ${prefix.trim()}`, () =>
    assert.equal(
      control(
        audit({
          ...base,
          "deploy/persistent/squid.conf":
            prefix + base["deploy/persistent/squid.conf"],
        }),
        "NET-02",
      ).result,
      "FAIL",
    ));
test("additional cloud-init boot hooks require review rather than passing the base runcmd check", () =>
  assert.equal(
    control(
      audit(
        mutate(
          "deploy/persistent/cloud-init.yaml",
          (v) => (v.bootcmd = ["unreviewed-command"]),
        ),
      ),
      "BOOT-01",
    ).result,
    "FAIL",
  ));
test("unreviewed Terraform resources cannot hide behind the staging server's labels", () =>
  assert.equal(
    control(
      audit(
        mutate(
          "deploy/persistent/terraform/main.tf.json",
          (v) => (v.resource.hcloud_network = { unreviewed: {} }),
        ),
      ),
      "TF-03",
    ).result,
    "FAIL",
  ));
test("report output refuses directory redirection and preserves a hardlinked outside sentinel", () => {
  const os = require("node:os"),
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "scop-report-safety-")),
    r = audit();
  try {
    const file = p.writeReport(r, dir);
    assert.equal(JSON.parse(fs.readFileSync(file)).activation_allowed, false);
    fs.unlinkSync(file);
    fs.mkdirSync(file);
    assert.throws(() => p.writeReport(r, dir), /UNSAFE_REPORT_FILE/);
    fs.rmdirSync(file);
    const sentinel = path.join(dir, "outside-sentinel.json");
    fs.writeFileSync(sentinel, "preserve-outside-file");
    fs.linkSync(sentinel, file);
    p.writeReport(r, dir);
    assert.equal(fs.readFileSync(sentinel, "utf8"), "preserve-outside-file");
    assert.equal(JSON.parse(fs.readFileSync(file)).activation_allowed, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("preparation-only changes do not trigger SQL rehearsal, while runtime paths and evidence gates remain protected", () => {
  const w = yaml.load(
      base[".github/workflows/persistent-local-validation.yml"],
    ),
    expected = [
      "docs/**",
      "scripts/readiness/**",
      ".github/workflows/release-quality.yml",
      ".github/workflows/persistent-local-validation.yml",
    ];
  assert.deepEqual(w.on.pull_request["paths-ignore"], expected);
  assert.deepEqual(w.on.push["paths-ignore"], expected);
  assert.deepEqual(w.on.push.branches, ["master", "codex/**"]);
  assert(Object.hasOwn(w.on, "workflow_dispatch"));
  for (const p of [
    "purchase-backend/**",
    "purchase-frontend/**",
    "scripts/persistent/**",
    "deploy/persistent/**",
    "scripts/staging/**",
    "scripts/devops/**",
  ])
    assert(!expected.includes(p));
  assert(
    base["scripts/persistent/rehearsal.cjs"].includes(
      '"SAME_COMMIT_GATEWAY_CI_REQUIRED"',
    ),
  );
  assert(base["scripts/persistent/rehearsal.cjs"].includes('"push"'));
});
test("another provider's version cannot satisfy the locked hcloud compatibility check", () => {
  const file = "deploy/persistent/terraform/.terraform.lock.hcl",
    s = { ...base };
  s[file] = s[file]
    .replace('version     = "1.50.1"', 'version     = "1.50.2"')
    .replace('version = "1.50.1"', 'version = "1.50.2"');
  // Whitespace-independent mutation of the actual lock version.
  s[file] = s[file].replace(/version\s*=\s*"1\.50\.1"/, 'version = "1.50.2"');
  s[file] +=
    '\nprovider "registry.terraform.io/example/other" { version = "1.50.1" }\n';
  assert.equal(control(audit(s), "TF-01").result, "FAIL");
});
for (const [file, before] of [
  [
    "deploy/persistent/scop-staging-infra.service",
    "RequiresMountsFor=/var/lib/scop-staging",
  ],
  [
    "deploy/persistent/scop-staging.service",
    "Requires=docker.service scop-staging-infra.service",
  ],
  [
    "deploy/persistent/scop-staging.service",
    "After=docker.service scop-staging-infra.service scop-staging-firewall.service network-online.target",
  ],
  [
    "deploy/persistent/scop-staging.service",
    "ConditionPathExists=/etc/scop-staging/ACTIVATION_APPROVED",
  ],
])
  test(`startup dependency regression fails the declared fence: ${before}`, () => {
    const s = { ...base, [file]: base[file].replace(before, "") };
    assert.equal(control(audit(s), "START-03").result, "FAIL");
  });
test("instance ownership labels must agree after both existing agent and egress gaps are corrected", () => {
  const fixed = { ...base };
  assert.equal(control(audit(fixed), "CMP-03").result, "PASS");
  for (const svc of ["database", "gateway", "agent", "egress"]) {
    const s = { ...fixed },
      v = yaml.load(s["deploy/persistent/compose.yaml"]);
    v.services[svc].labels["wici.scop.instance"] = "foreign-instance";
    s["deploy/persistent/compose.yaml"] = yaml.dump(v);
    assert.equal(control(audit(s), "CMP-03").result, "FAIL");
  }
});
for (const [name, mutate] of [
  ["include", (v) => (v.include = ["/unreviewed/file.yaml"])],
  [
    "extends",
    (v) =>
      (v.services.agent.extends = {
        file: "/unreviewed/compose.yaml",
        service: "agent",
      }),
  ],
  ["extra env", (v) => (v.services.agent.env_file = "/unreviewed/secret.env")],
  [
    "label file",
    (v) => (v.services.gateway.label_file = "/unreviewed/labels.env"),
  ],
  [
    "secret file",
    (v) => (v.secrets = { unreviewed: { file: "/unreviewed/secret" } }),
  ],
  ["build context", (v) => (v.services.agent.build = "/unreviewed/context")],
])
  test(`unreviewed Compose file/secret reference is rejected before CLI rendering: ${name}`, () => {
    const v = yaml.load(base["deploy/persistent/compose.yaml"]);
    mutate(v);
    assert.throws(() => p.validateComposeDocument(v), /COMPOSE/);
    const s = { ...base, "deploy/persistent/compose.yaml": yaml.dump(v) };
    assert.throws(() => audit(s), /COMPOSE/);
  });
test("LF and CRLF unit files preserve the same declared startup dependencies", () => {
  assert.equal(control(audit(), "START-03").result, "PASS");
  const s = { ...base };
  for (const f of [
    "deploy/persistent/scop-staging.service",
    "deploy/persistent/scop-staging-infra.service",
  ])
    s[f] = s[f].replace(/\n/g, "\r\n");
  assert.equal(control(audit(s), "START-03").result, "PASS");
});
test("the exact CI Compose5.1.3 parser supports the bounded config-only interface", () => {
  const e = p.renderProfiles(fixture, {
    run: (bin, args) => {
      assert.equal(args[0], "--host=unix:///nonexistent-scop-preflight.sock");
      if (args.includes("version")) return "5.1.3";
      const services = {};
      for (let i = 0; i < args.length; i++)
        if (args[i] === "--profile")
          services[args[i + 1].replace("separately-approved-", "")] = {};
      return JSON.stringify({ services });
    },
  });
  const r = audit(base, fixture, e);
  assert.equal(control(r, "CMP-04").result, "PASS");
  assert.equal(p.reportCode(r), 0);
  assert.equal(p.exitCode(r), 2);
});
for (const version of ["1.29.2", "3.0.0", "5.1.4", "6.0.0", "malformed"])
  test(`unsupported Compose parser remains fail-closed: ${version}`, () =>
    assert.throws(
      () =>
        p.renderProfiles(fixture, {
          run: (bin, args) => {
            assert(args.includes("version"));
            return version;
          },
        }),
      /SUPPORTED_COMPOSE_PARSER_REQUIRED/,
    ));
test("real offline rendering failures fail report-generation status while preserving the blocked assessment", () => {
  const e = p.renderProfiles(fixture, {
      run: (bin, args) => {
        if (args.includes("version")) return "2.40.3";
        throw Error("synthetic render failure");
      },
    }),
    r = audit(base, fixture, e);
  assert.equal(r.activation_allowed, false);
  assert.equal(p.reportCode(r), 1);
  assert.equal(p.reportCode(audit()), 0);
});

// Source-identity fixture only: never install or invoke this against the host.
// Runtime tests below rewrite both fixed paths into a synthetic temporary tree
// and replace findmnt with an explicit fixture. No mount/host probe is made.
const reviewedStorageFixture = `#!/bin/sh
set -eu
test -f /etc/scop-staging/ACTIVATION_APPROVED
test "$(cat /etc/scop-staging/host-purpose)" = wici-isolated-staging-v1
mount=/var/lib/scop-staging
test ! -L "$mount" || exit 1
target=$(findmnt --noheadings --raw --output TARGET --mountpoint "$mount") || exit 1
test "$target" = "$mount" || exit 1
device=$(findmnt --noheadings --raw --output MAJ:MIN --mountpoint "$mount") || exit 1
root_device=$(findmnt --noheadings --raw --output MAJ:MIN --mountpoint /) || exit 1
for identity in "$device" "$root_device"; do
  case "$identity" in ''|*[!0-9:]*|:*|*:|*:*:*) exit 1;; esac
  case "$identity" in *:*) ;; *) exit 1;; esac
  printf '%s\\n' "$identity" | LC_ALL=C grep -Eq '^(0|[1-9][0-9]*):(0|[1-9][0-9]*)$' || exit 1
done
test "$device" != "$root_device" || exit 1
expected_uuid=$(cat /etc/scop-staging/volume-uuid) || exit 1
test "\${#expected_uuid}" -eq 36 || exit 1
printf '%s\\n' "$expected_uuid" | LC_ALL=C grep -Eq '^[[:xdigit:]]{8}-[[:xdigit:]]{4}-[[:xdigit:]]{4}-[[:xdigit:]]{4}-[[:xdigit:]]{12}$' || exit 1
actual_uuid=$(findmnt --noheadings --raw --output UUID --mountpoint "$mount") || exit 1
test "$actual_uuid" = "$expected_uuid" || exit 1
test ! -L "$mount/postgres" || exit 1
test ! -L "$mount/postgres/PG_VERSION" || exit 1
data_target=$(findmnt --noheadings --raw --output TARGET --target "$mount/postgres") || exit 1
test "$data_target" = "$mount" || exit 1
test -s /var/lib/scop-staging/postgres/PG_VERSION
`;
const storagePath = "deploy/persistent/verify-storage.sh";
function storageAudit(
  script,
  unit = base["deploy/persistent/scop-staging-infra.service"],
) {
  return audit({
    ...base,
    [storagePath]: script,
    "deploy/persistent/scop-staging-infra.service": unit,
  });
}
for (const [name, script] of [
  [
    "original containing-filesystem lookup",
    '#!/bin/sh\nset -eu\ntest "$(findmnt -n -o UUID --target /var/lib/scop-staging)" = "$(cat /etc/scop-staging/volume-uuid)"\ntest -s /var/lib/scop-staging/postgres/PG_VERSION\n',
  ],
  [
    "comment mentioning mountpoint",
    base[storagePath] + "\n# TODO: add exact mountpoint validation\n",
  ],
  [
    "comment mentioning findmnt --mountpoint",
    base[storagePath] + "\n# findmnt --mountpoint /var/lib/scop-staging\n",
  ],
  [
    "unused variable",
    base[storagePath] + "\nhint='findmnt --mountpoint /var/lib/scop-staging'\n",
  ],
  [
    "echo",
    base[storagePath] + "\necho 'findmnt --mountpoint /var/lib/scop-staging'\n",
  ],
  [
    "unreachable branch",
    base[storagePath] +
      "\nif false; then mountpoint -q /var/lib/scop-staging; fi\n",
  ],
  [
    "ignored failure",
    base[storagePath] + "\nmountpoint -q /var/lib/scop-staging || true\n",
  ],
  [
    "quoted no-op",
    base[storagePath] + "\n: 'findmnt --mountpoint /var/lib/scop-staging'\n",
  ],
  [
    "safe-looking checks after exit",
    "#!/bin/sh\nexit 0\n" + reviewedStorageFixture,
  ],
  [
    "wrong dedicated path",
    reviewedStorageFixture.replaceAll(
      "/var/lib/scop-staging",
      "/var/lib/other",
    ),
  ],
  [
    "root-only lookup",
    reviewedStorageFixture.replace("mount=/var/lib/scop-staging", "mount=/"),
  ],
  [
    "containing-filesystem lookup retained",
    reviewedStorageFixture.replaceAll(
      '--mountpoint "$mount"',
      '--target "$mount"',
    ),
  ],
  [
    "root comparison removed",
    reviewedStorageFixture.replace(
      'test "$device" != "$root_device" || exit 1\n',
      "",
    ),
  ],
  [
    "UUID comparison ignored",
    reviewedStorageFixture.replace(
      'test "$actual_uuid" = "$expected_uuid" || exit 1',
      'test "$actual_uuid" = "$expected_uuid" || true',
    ),
  ],
  [
    "missing lookup failure ignored",
    reviewedStorageFixture.replaceAll(") || exit 1", ") || true"),
  ],
  ["unfamiliar executable addition", reviewedStorageFixture + "true\n"],
  ["CRLF shell bytes", reviewedStorageFixture.replaceAll("\n", "\r\n")],
])
  test(`STO-01 rejects insufficient or unreviewed storage evidence: ${name}`, () =>
    assert.notEqual(control(storageAudit(script), "STO-01").result, "PASS"));
test("STO-01 recognizes only the constrained source identity and enforced pre-start unit", () => {
  assert.equal(
    base[storagePath],
    reviewedStorageFixture,
    "actual storage implementation must match the separately exercised fixture",
  );
  for (const unit of [
    base["deploy/persistent/scop-staging-infra.service"],
    base["deploy/persistent/scop-staging-infra.service"].replace(
      /\r?\n/g,
      "\r\n",
    ),
  ]) {
    const r = storageAudit(reviewedStorageFixture, unit);
    assert.equal(control(r, "STO-01").result, "PASS");
    assert.equal(
      control(r, "EXT-STORAGE").result,
      "EXTERNAL_VALIDATION_REQUIRED",
    );
    assert.equal(r.activation_allowed, false);
    assert.notEqual(p.exitCode(r), 0);
  }
  const unit = base["deploy/persistent/scop-staging-infra.service"];
  for (const changed of [
    unit.replace(
      "ExecStartPre=/bin/sh /opt/scop-staging/verify-storage.sh",
      "ExecStartPost=/bin/sh /opt/scop-staging/verify-storage.sh",
    ),
    unit.replace("ExecStartPre=/bin/sh", "ExecStartPre=-/bin/sh"),
    unit.replace("Type=oneshot", "Type=simple"),
    unit.replace(
      "ExecStartPre=/bin/sh /opt/scop-staging/verify-storage.sh",
      "",
    ),
  ])
    assert.notEqual(
      control(storageAudit(reviewedStorageFixture, changed), "STO-01").result,
      "PASS",
    );
});

test("recognized storage fixture enforces invalid mount failures in a synthetic filesystem", () => {
  const os = require("node:os"),
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "scop-storage-fixture-"));
  const unix = (v) =>
    process.platform === "win32"
      ? v
          .replaceAll("\\", "/")
          .replace(/^([A-Za-z]):/, (_, d) => "/" + d.toLowerCase())
      : v;
  const shell =
    process.platform === "win32"
      ? path.join(
          process.env.ProgramFiles || "C:\\Program Files",
          "Git/bin/bash.exe",
        )
      : "/bin/sh";
  try {
    const etc = path.join(dir, "etc"),
      mount = path.join(dir, "data"),
      bin = path.join(dir, "bin");
    for (const d of [etc, path.join(mount, "postgres"), bin])
      fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(etc, "ACTIVATION_APPROVED"), "synthetic-only");
    fs.writeFileSync(
      path.join(etc, "host-purpose"),
      "wici-isolated-staging-v1\n",
    );
    fs.writeFileSync(path.join(mount, "postgres/PG_VERSION"), "16\n");
    const uuid = "11111111-2222-4333-8444-555555555555";
    fs.writeFileSync(path.join(etc, "volume-uuid"), uuid + "\n");
    fs.writeFileSync(
      path.join(bin, "findmnt"),
      `#!/bin/sh
printf '%s\\n' "$*" >> "$SYNTHETIC_CALLS"
test "$SYNTHETIC_LOOKUP_FAIL" = 0 || exit 1
case "$*" in
  "--noheadings --raw --output TARGET --mountpoint $SYNTHETIC_MOUNT") printf '%s\\n' "$SYNTHETIC_TARGET";;
  "--noheadings --raw --output MAJ:MIN --mountpoint $SYNTHETIC_MOUNT") printf '%s\\n' "$SYNTHETIC_DEVICE";;
  "--noheadings --raw --output MAJ:MIN --mountpoint /") printf '%s\\n' "$SYNTHETIC_ROOT_DEVICE";;
  "--noheadings --raw --output UUID --mountpoint $SYNTHETIC_MOUNT") printf '%s\\n' "$SYNTHETIC_UUID";;
  "--noheadings --raw --output TARGET --target $SYNTHETIC_MOUNT/postgres") printf '%s\\n' "$SYNTHETIC_DATA_TARGET";;
  *) exit 90;;
esac
`,
      { mode: 0o700 },
    );
    const script = path.join(dir, "verify.sh"),
      calls = path.join(dir, "calls");
    fs.writeFileSync(
      script,
      reviewedStorageFixture
        .replaceAll("/etc/scop-staging", unix(etc))
        .replaceAll("/var/lib/scop-staging", unix(mount)),
    );
    const env = {
      ...(process.env.SYSTEMROOT ? { SYSTEMROOT: process.env.SYSTEMROOT } : {}),
      PATH: unix(bin) + ":/usr/bin:/bin",
      HOME: unix(dir),
      SYNTHETIC_MOUNT: unix(mount),
      SYNTHETIC_TARGET: unix(mount),
      SYNTHETIC_DATA_TARGET: unix(mount),
      SYNTHETIC_DEVICE: "8:16",
      SYNTHETIC_ROOT_DEVICE: "8:1",
      SYNTHETIC_UUID: uuid,
      SYNTHETIC_LOOKUP_FAIL: "0",
      SYNTHETIC_CALLS: unix(calls),
    };
    function run(changes = {}) {
      return require("node:child_process").spawnSync(shell, [unix(script)], {
        env: { ...env, ...changes },
        encoding: "utf8",
      });
    }
    const positive = run();
    assert.equal(positive.status, 0, positive.stderr || String(positive.error));
    assert.equal(
      fs.readFileSync(calls, "utf8").trim().split(/\r?\n/).length,
      5,
    );
    for (const change of [
      { SYNTHETIC_TARGET: "" },
      { SYNTHETIC_TARGET: "/" },
      { SYNTHETIC_DATA_TARGET: "/" },
      { SYNTHETIC_DEVICE: "8:1" },
      { SYNTHETIC_DEVICE: "" },
      { SYNTHETIC_DEVICE: "8:16\ninvalid" },
      { SYNTHETIC_DEVICE: "8::16" },
      { SYNTHETIC_DEVICE: "08:16" },
      { SYNTHETIC_DEVICE: "8:016" },
      { SYNTHETIC_ROOT_DEVICE: "" },
      { SYNTHETIC_ROOT_DEVICE: "08:1" },
      { SYNTHETIC_ROOT_DEVICE: "invalid" },
      { SYNTHETIC_UUID: "" },
      { SYNTHETIC_UUID: uuid + "\ninvalid" },
      { SYNTHETIC_UUID: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" },
      { SYNTHETIC_LOOKUP_FAIL: "1" },
    ])
      assert.equal(run(change).status, 1, JSON.stringify(change));
    for (const invalid of ["", "not-a-uuid", uuid + "\ninvalid"]) {
      fs.writeFileSync(path.join(etc, "volume-uuid"), invalid);
      assert.equal(run().status, 1, "invalid expected UUID must fail");
    }
    fs.writeFileSync(path.join(etc, "volume-uuid"), uuid + "\n");
    fs.writeFileSync(path.join(mount, "postgres/PG_VERSION"), "");
    assert.equal(run().status, 1, "missing initialized data marker must fail");
    fs.writeFileSync(path.join(mount, "postgres/PG_VERSION"), "16\n");
    fs.unlinkSync(path.join(etc, "ACTIVATION_APPROVED"));
    assert.equal(run().status, 1, "missing approval must fail");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("host-policy synthetic transaction, input and ownership regressions", () => {
  const python = process.platform === "win32" ? "python" : "python3";
  const result = execFileSync(
    python,
    [path.join(__dirname, "host-policy.test.py")],
    {
      env: {
        PATH: process.env.PATH,
        SYSTEMROOT: process.env.SYSTEMROOT,
        PYTHONDONTWRITEBYTECODE: "1",
      },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 30000,
    },
  );
  assert.equal(typeof result, "string");
});
test("nft syntax helper refuses ordinary hosts before any firewall command", () => {
  const python = process.platform === "win32" ? "python" : "python3";
  const result = require("node:child_process").spawnSync(
    python,
    [path.join(__dirname, "nft-validate.py")],
    {
      env: {
        PATH: process.env.PATH,
        SYSTEMROOT: process.env.SYSTEMROOT,
        PYTHONDONTWRITEBYTECODE: "1",
      },
      encoding: "utf8",
      timeout: 30000,
    },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /ISOLATED_HOSTED_CI_NAMESPACE_REQUIRED/);
});
for (const [file, ids] of [
  ["deploy/persistent/host-policy.py", ["NET-03", "NET-04", "CMP-03"]],
  ["deploy/persistent/firewall.sh", ["NET-03", "START-01"]],
  ["deploy/persistent/docker-staging.conf", ["START-01"]],
  ["deploy/persistent/scop-staging-firewall.service", ["START-01", "NET-03"]],
  ["deploy/persistent/terraform/main.tf.json", ["TF-04", "NET-04"]],
])
  test(`unreviewed hardening source cannot obtain static acceptance: ${file}`, () => {
    const changed = {
      ...base,
      [file]:
        base[file] +
        (file.endsWith(".json") ? "\n" : "\n# suggestive policy comment\n"),
    };
    for (const id of ids)
      assert.equal(control(audit(changed), id).result, "FAIL");
  });
test("all six source controls pass without converting external acceptance or activation", () => {
  const r = audit();
  for (const id of [
    "TF-04",
    "CMP-03",
    "START-01",
    "NET-03",
    "NET-04",
    "STO-01",
  ])
    assert.equal(control(r, id).result, "PASS", id);
  assert.equal(r.counts.EXTERNAL_VALIDATION_REQUIRED, 9);
  assert.equal(r.counts.FAIL, 0);
  assert.equal(p.exitCode(r), 2);
  assert.equal(r.activation_allowed, false);
});
test("early firewall avoids the basic/sockets/Docker dependency cycle and never removes policy on stop", () => {
  const unit = base["deploy/persistent/scop-staging-firewall.service"];
  assert.match(unit, /^DefaultDependencies=no$/m);
  assert.match(unit, /^After=local-fs.target systemd-sysctl.service$/m);
  assert.match(unit, /^Before=.*docker\.service docker\.socket/m);
  assert(!/^ExecStop=/m.test(unit));
  const changed = {
    ...base,
    "deploy/persistent/scop-staging-firewall.service": unit.replace(
      "DefaultDependencies=no",
      "DefaultDependencies=yes",
    ),
  };
  assert.equal(control(audit(changed), "START-01").result, "FAIL");
});
