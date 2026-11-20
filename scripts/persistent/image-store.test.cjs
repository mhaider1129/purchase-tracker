"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { canonicalStore, requireCanonicalStore } = require("./image-store.cjs"),
  { configure } = require("./ci-docker-store.cjs");
const classic = {
    Driver: "overlay2",
    DriverStatus: [["Backing Filesystem", "extfs"]],
  },
  native = {
    Driver: "overlayfs",
    DriverStatus: [["driver-type", "io.containerd.snapshotter.v1"]],
  };
const env = {
  GITHUB_ACTIONS: "true",
  RUNNER_ENVIRONMENT: "github-hosted",
  RUNNER_OS: "Linux",
  PATH: "synthetic",
  HOME: "/synthetic",
};
test("canonical config-ID protocol rejects containerd/index and ambiguous stores without relaxing digests", () => {
  assert(canonicalStore(classic));
  assert(canonicalStore({ Driver: "vfs", DriverStatus: null }));
  for (const v of [
    native,
    null,
    {},
    { Driver: "overlay2", DriverStatus: "unknown" },
  ])
    assert.throws(() => requireCanonicalStore(v), /CANONICAL/);
});
test("CI store configuration refuses local, self-hosted and non-Linux environments before any command", () => {
  for (const e of [
    {},
    { ...env, RUNNER_ENVIRONMENT: "self-hosted" },
    { ...env, RUNNER_OS: "Windows" },
    { ...env, GITHUB_ACTIONS: "false" },
  ])
    assert.throws(
      () => configure({ env: e, run: () => assert.fail("no command allowed") }),
      /DISPOSABLE/,
    );
});
test("CI store configuration is a no-op on already compatible Docker", () => {
  let calls = 0;
  configure({
    env,
    run: (cmd, args) => {
      calls++;
      assert.equal(cmd, "docker");
      assert(args.includes("info"));
      return JSON.stringify(classic);
    },
  });
  assert.equal(calls, 1);
});
test("CI store configuration refuses to hide or migrate existing containers", () => {
  assert.throws(
    () =>
      configure({
        env,
        run: (cmd, args) => {
          assert.equal(cmd, "docker");
          return args.includes("info")
            ? JSON.stringify(native)
            : "existing-container";
        },
      }),
    /NONEMPTY/,
  );
});
test("empty ephemeral CI setup preserves the strict protocol and verifies after restart", () => {
  let configured = false;
  const calls = [];
  configure({
    env,
    run: (cmd, args) => {
      calls.push([cmd, ...args]);
      if (cmd === "docker")
        return args.includes("info")
          ? JSON.stringify(configured ? classic : native)
          : "";
      if (args.includes("python3")) {
        assert(args.at(-1).includes("['containerd-snapshotter']=False"));
        configured = true;
      }
      return "";
    },
  });
  assert(configured);
  assert.equal(calls.filter((x) => x.includes("stop")).length, 1);
  assert.equal(calls.filter((x) => x.includes("start")).length, 1);
});
test("CI setup cannot accept an unsupported store after restart", () => {
  assert.throws(
    () =>
      configure({
        env,
        run: (cmd, args) =>
          cmd === "docker"
            ? args.includes("info")
              ? JSON.stringify(native)
              : ""
            : "",
      }),
    /CANONICAL/,
  );
});
test("external controller build excludes privileged CI setup while keeping read-only store verification", () => {
  const fs = require("node:fs"),
    path = require("node:path"),
    os = require("node:os"),
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "scop-context-store-"));
  try {
    require("./build-agent.cjs").context(dir);
    assert.equal(
      fs.existsSync(path.join(dir, "scripts/persistent/ci-docker-store.cjs")),
      false,
    );
    assert(fs.existsSync(path.join(dir, "scripts/persistent/image-store.cjs")));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
