"use strict";
// Local, network-none control-plane/OCI verification. No live configuration,
// credential, Docker socket mount, provider or database is supplied to agent.
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  crypto = require("node:crypto"),
  assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process"),
  safe = require("../staging/safety.cjs"),
  root = path.resolve(__dirname, "../..");
const docker = (...args) =>
  execFileSync("docker", ["--host=unix:///var/run/docker.sock", ...args], {
    env: safe.environment(),
    encoding: "utf8",
    maxBuffer: 2 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scop-control-test-")),
    owner = crypto.randomBytes(8).toString("hex"),
    containers = [],
    tags = [],
    checks = [];
  const image = "scop-staging-agent:local-review",
    commit = crypto.randomBytes(20).toString("hex");
  try {
    fs.mkdirSync(path.join(dir, "state"));
    fs.copyFileSync(
      path.join(root, "deploy/persistent/config.example.json"),
      path.join(dir, "config.json"),
    );
    const disabled = spawnSync(
      "docker",
      [
        "--host=unix:///var/run/docker.sock",
        "run",
        "--rm",
        "--network",
        "none",
        "--read-only",
        "-v",
        `${dir}/state:/var/lib/scop-staging`,
        "-v",
        `${dir}/config.json:/etc/scop-staging/config.json:ro`,
        image,
      ],
      { env: safe.environment(), encoding: "utf8" },
    );
    assert.notEqual(disabled.status, 0);
    assert((disabled.stderr || "").includes("STAGING_AGENT_NOT_ACTIVATED"));
    checks.push(
      "actual_controller_refuses_activation_without_credentials_or_network",
    );
    const lock = "scop-lock-test-" + owner;
    docker(
      "run",
      "--detach",
      "--name",
      lock,
      "--label",
      `wici.scop.control-test=${owner}`,
      "--network",
      "none",
      "--read-only",
      "-v",
      `${dir}/state:/var/lib/scop-staging`,
      image,
      "flock",
      "-n",
      "/var/lib/scop-staging/fencing.lock",
      "node",
      "-e",
      "console.log('LOCK_HELD');setTimeout(()=>{},10000)",
    );
    containers.push(lock);
    for (let i = 0; i < 40; i++) {
      if (docker("logs", lock).includes("LOCK_HELD")) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    assert(docker("logs", lock).includes("LOCK_HELD"));
    const second = spawnSync(
      "docker",
      [
        "--host=unix:///var/run/docker.sock",
        "run",
        "--rm",
        "--network",
        "none",
        "--read-only",
        "-v",
        `${dir}/state:/var/lib/scop-staging`,
        image,
        "flock",
        "-n",
        "/var/lib/scop-staging/fencing.lock",
        "node",
        "-e",
        "process.exit(0)",
      ],
      { env: safe.environment(), encoding: "utf8" },
    );
    assert.notEqual(second.status, 0);
    checks.push("real_os_flock_prevents_concurrent_controllers");
    const sources = {
        backend: require("../../deploy/staging/policy.json").nodeImage,
        frontend:
          "caddy:2@sha256:4e2425f6009577e7c651010f16679c28f7d12df3e7b1914f941a7a3370746b3c",
      },
      images = {};
    for (const [role, source] of Object.entries(sources)) {
      // BuildKit's image cache is not the Docker daemon image store. Fetch
      // the digest-pinned fixture explicitly on clean CI runners.
      assert.match(source, /@sha256:[a-f0-9]{64}$/);
      docker("pull", source);
      images[role] = docker("image", "inspect", "--format", "{{.Id}}", source);
      const tag = `scop-capsule-${role}:${commit}`;
      docker("tag", images[role], tag);
      tags.push(tag);
    }
    docker("save", "-o", path.join(dir, "images.tar"), ...tags);
    execFileSync("gzip", ["-n", path.join(dir, "images.tar")]);
    fs.writeFileSync(
      path.join(dir, "capsule.json"),
      JSON.stringify({ commit, images }),
    );
    execFileSync("python3", [
      "-c",
      "import pathlib,zipfile,sys;p=pathlib.Path(sys.argv[1]);z=zipfile.ZipFile(p/'capsule.zip','w');z.write(p/'capsule.json','capsule.json');z.write(p/'images.tar.gz','images.tar.gz');z.close()",
      dir,
    ]);
    execFileSync(
      "python3",
      [
        path.join(__dirname, "extract.py"),
        path.join(dir, "capsule.zip"),
        path.join(dir, "verified"),
      ],
      { stdio: "pipe" },
    );
    checks.push(
      "real_docker_save_capsule_metadata_and_image_config_ids_validate",
    );
    assert.throws(
      () => require("./core.cjs").capsule({ commit, images }),
      /INVALID_CAPSULE/,
    );
    checks.push("local_fixture_archive_is_not_deployment_authority");
  } finally {
    for (const name of containers) {
      const v = JSON.parse(docker("inspect", name))[0];
      assert.equal(v.Config.Labels["wici.scop.control-test"], owner);
      docker("rm", "--force", name);
    }
    for (const tag of tags) docker("image", "rm", tag);
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.mkdirSync(path.join(root, "quality-results/persistent"), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(root, "quality-results/persistent/local-control.json"),
    JSON.stringify(
      {
        scope: "LOCAL_NETWORK_NONE_CONTROL_TEST",
        externalActivated: false,
        checks,
        status: "PASSED",
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ status: "CONTROL_COMPONENTS_PASSED", checks }));
}
if (require.main === module)
  main().catch((e) => {
    console.error("LOCAL_CONTROL_TEST_FAILED", e.message.slice(0, 1000));
    process.exitCode = 1;
  });
module.exports = { main };
