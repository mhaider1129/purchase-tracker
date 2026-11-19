"use strict";
// SETUP FOR EMPTY DISPOSABLE GITHUB-HOSTED LINUX RUNNERS ONLY.
// Never invoked by the pull agent or any external host installation command.
const { execFileSync } = require("node:child_process");
const { canonicalStore, requireCanonicalStore } = require("./image-store.cjs");
const socket = "--host=unix:///var/run/docker.sock";
function configure({ env = process.env, run = execFileSync } = {}) {
  if (
    env.GITHUB_ACTIONS !== "true" ||
    env.RUNNER_ENVIRONMENT !== "github-hosted" ||
    env.RUNNER_OS !== "Linux"
  )
    throw Error("DISPOSABLE_GITHUB_HOSTED_LINUX_ONLY");
  const options = {
    encoding: "utf8",
    timeout: 60000,
    maxBuffer: 1024 * 1024,
    env: { PATH: env.PATH, HOME: env.HOME },
    stdio: ["ignore", "pipe", "pipe"],
  };
  const docker = (...args) =>
    String(run("docker", [socket, ...args], options)).trim();
  const info = () => JSON.parse(docker("info", "--format", "{{json .}}"));
  if (canonicalStore(info())) return;
  if (docker("ps", "-aq") !== "")
    throw Error("NONEMPTY_DOCKER_RUNNER_MUST_NOT_BE_RECONFIGURED");
  run(
    "sudo",
    ["-n", "systemctl", "stop", "docker.service", "docker.socket"],
    options,
  );
  const script = `import json,pathlib,os
p=pathlib.Path('/etc/docker/daemon.json')
c=json.loads(p.read_text()) if p.exists() else {}
c.setdefault('features',{})['containerd-snapshotter']=False
p.parent.mkdir(parents=True,exist_ok=True)
t=p.with_name('daemon.json.scop-ci.tmp')
with t.open('w') as f:
 json.dump(c,f);f.flush();os.fsync(f.fileno())
os.replace(t,p)
f=os.open(str(p.parent),os.O_RDONLY)
try:os.fsync(f)
finally:os.close(f)
`;
  run("sudo", ["-n", "python3", "-c", script], options);
  run("sudo", ["-n", "systemctl", "start", "docker.service"], options);
  requireCanonicalStore(info());
}
if (require.main === module) {
  try {
    configure();
    console.log("DISPOSABLE_CI_CANONICAL_CONFIG_ID_STORE_VERIFIED");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
module.exports = { configure };
