"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "../..");
function context(out) {
  for (const directory of [
    "scripts/persistent",
    "scripts/devops",
    "scripts/staging",
    "scripts/quality",
    "deploy/persistent",
  ]) {
    const copy = (relative) => {
      for (const entry of fs.readdirSync(path.join(root, relative), {
        withFileTypes: true,
      })) {
        const file = path.posix.join(relative, entry.name);
        if (entry.isSymbolicLink()) throw Error("CONTROL_SOURCE_SYMLINK");
        if (entry.isDirectory()) copy(file);
        else if (
          /\.(?:cjs|json|py)$/.test(file) &&
          !file.endsWith(".test.cjs") &&
          !file.endsWith(".integration.cjs") &&
          !file.endsWith("/ci-docker-store.cjs") &&
          !file.endsWith("/host-policy.py")
        ) {
          fs.mkdirSync(path.dirname(path.join(out, file)), { recursive: true });
          fs.copyFileSync(path.join(root, file), path.join(out, file));
        }
      }
    };
    copy(directory);
  }
}
if (require.main === module) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "scop-agent-context-"));
  try {
    context(out);
    execFileSync(
      "docker",
      [
        "--host=unix:///var/run/docker.sock",
        "build",
        "-f",
        path.join(root, "deploy/persistent/agent.Dockerfile"),
        "-t",
        "scop-staging-agent:local-review",
        out,
      ],
      { stdio: "inherit" },
    );
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
}
module.exports = { context };
