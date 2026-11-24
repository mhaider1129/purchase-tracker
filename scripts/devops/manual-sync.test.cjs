"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os");
const { execFileSync } = require("node:child_process");
const { plan, publish } = require("./manual-sync.cjs");
const git = (root, ...args) =>
  execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    stdio: "pipe",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "fixture",
      GIT_AUTHOR_EMAIL: "fixture@example.invalid",
      GIT_COMMITTER_NAME: "fixture",
      GIT_COMMITTER_EMAIL: "fixture@example.invalid",
    },
  }).trim();
function setup(fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wici-sync-"));
  try {
    const root = path.join(tmp, "combined");
    fs.mkdirSync(root);
    git(root, "init", "-b", "master");
    for (const n of ["backend", "frontend"]) {
      fs.mkdirSync(path.join(root, "purchase-" + n));
      fs.writeFileSync(path.join(root, "purchase-" + n, "app.txt"), "initial");
    }
    git(root, "add", ".");
    git(root, "commit", "-m", "initial");
    const origin = path.join(tmp, "origin.git");
    git(root, "clone", "--bare", root, origin);
    git(root, "remote", "add", "origin", origin);
    const repos = {};
    for (const n of ["backend", "frontend"]) {
      const sha = git(
        root,
        "subtree",
        "split",
        "--quiet",
        "--prefix=purchase-" + n,
        "HEAD",
      );
      const dest = path.join(tmp, n + ".git");
      git(root, "init", "--bare", dest);
      git(root, "push", dest, sha + ":refs/heads/main");
      repos[n] = dest;
    }
    fs.writeFileSync(path.join(root, "purchase-backend/app.txt"), "enhanced");
    fs.writeFileSync(path.join(root, "purchase-frontend/app.txt"), "enhanced");
    git(root, "add", ".");
    git(root, "commit", "-m", "enhancement");
    git(root, "push", "origin", "master");
    fn({ tmp, root, repos });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
test("default plan is read-only for destinations; explicit publication is fast-forward and retry idempotent", () =>
  setup(({ root, repos }) => {
    const p = plan(root, repos);
    assert.equal(p.ready, true);
    assert.equal(p.publishingAuthorized, false);
    for (const c of p.components)
      assert.equal(
        git(root, "ls-remote", c.repository, "main").split(/\s/)[0],
        c.destination,
      );
    assert.deepEqual(publish(root, p).published, ["backend", "frontend"]);
    assert(
      plan(root, repos).components.every((c) => c.status === "NO_CHANGES"),
    );
    assert.deepEqual(publish(root, plan(root, repos)).published, []);
  }));
test("destination-only recovery work blocks all writes and remains intact", () =>
  setup(({ tmp, root, repos }) => {
    const clone = path.join(tmp, "recovery");
    git(root, "clone", "--branch", "main", repos.backend, clone);
    fs.writeFileSync(path.join(clone, "independent-recovery.txt"), "preserve");
    git(clone, "add", ".");
    git(clone, "commit", "-m", "independent recovery");
    git(clone, "push", "origin", "main");
    const p = plan(root, repos);
    assert.equal(p.ready, false);
    assert.throws(() => publish(root, p), /RECONCILE_DESTINATION/);
    assert(
      git(root, "ls-tree", "--name-only", p.components[0].destination).includes(
        "independent-recovery.txt",
      ),
    );
  }));
test("changed destination invalidates an earlier plan without force-push", () =>
  setup(({ root, repos }) => {
    const p = plan(root, repos);
    git(
      root,
      "push",
      repos.backend,
      p.components[0].exported + ":refs/heads/main",
    );
    let calls = 0;
    assert.throws(() => publish(root, p, () => calls++), /DESTINATION_CHANGED/);
    assert.equal(calls, 0);
  }));
test("partial publication failure is visible and can be replanned without reverting history", () =>
  setup(({ root, repos }) => {
    const p = plan(root, repos);
    let calls = 0;
    assert.throws(
      () =>
        publish(root, p, (repo, ref) => {
          if (calls++ === 1) throw Error("timeout");
          git(root, "push", repo, ref);
        }),
      /earlier published=backend/,
    );
    const next = plan(root, repos);
    assert.equal(next.components[0].status, "NO_CHANGES");
    assert.equal(next.components[1].status, "FAST_FORWARD");
    assert.deepEqual(publish(root, next).published, ["frontend"]);
  }));
