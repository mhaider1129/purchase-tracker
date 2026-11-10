"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  cp = require("node:child_process");
const pub = require("./sync-publish.cjs"),
  planner = require("./sync-plan.cjs");
function fixture(app = "backend") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scop-publish-test-")),
    source = path.join(dir, "source"),
    dest = path.join(dir, "destination");
  const git = (cwd, args, input, extra = {}) =>
    cp
      .execFileSync("git", args, {
        cwd,
        input,
        encoding: "utf8",
        env: { ...process.env, ...extra },
        stdio: ["pipe", "pipe", "pipe"],
      })
      .trim();
  const write = (base, name, data) => {
    const p = path.join(base, name);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, data);
  };
  const commit = (base) => {
    git(base, ["add", "."]);
    git(base, ["commit", "--quiet", "-m", "synthetic fixture"]);
    return git(base, ["rev-parse", "HEAD"]);
  };
  for (const repo of [source, dest]) {
    fs.mkdirSync(repo);
    git(repo, ["init", "--quiet", "--initial-branch=main"]);
    git(repo, ["config", "user.name", "Synthetic fixture"]);
    git(repo, ["config", "user.email", "fixture@example.invalid"]);
    git(repo, ["config", "core.autocrlf", "false"]);
  }
  write(source, `purchase-${app}/app.js`, "initial\n");
  write(dest, "app.js", "initial\n");
  write(source, `purchase-${app}/.env`, "DO_NOT_EXPORT=synthetic\n");
  write(dest, ".env", "PRESERVE_DESTINATION=synthetic\n");
  const s0 = commit(source),
    d0 = commit(dest);
  write(source, `purchase-${app}/app.js`, "enhancement\n");
  const s1 = commit(source);
  const policy = structuredClone(require("../../deploy/sync/policy.json"));
  policy.enabled = true;
  policy.bootstrapApproval = "APPROVED";
  policy.appSlug = "synthetic-scop";
  const options = {
    sourceRepo: source,
    destinationRepo: dest,
    sourceSha: s1,
    destinationSha: d0,
    app,
    previousSourceSha: s0,
    previousDestinationSha: d0,
  };
  const ci = {
    commit: s1,
    runId: 101,
    attempt: 1,
    manifestDigest: "sha256:" + "a".repeat(64),
  };
  const state = {
    calls: [],
    prs: [],
    checks: true,
    protection: true,
    head: d0,
  };
  const protect = {
    required_pull_request_reviews: {
      required_approving_review_count: 1,
      dismiss_stale_reviews: true,
    },
    enforce_admins: { enabled: true },
    allow_force_pushes: { enabled: false },
    allow_deletions: { enabled: false },
    required_status_checks: {
      strict: true,
      contexts: [policy.targets[app].requiredCheck],
    },
  };
  async function api(method, route, body) {
    state.calls.push({ method, route, body });
    const prefix = `/repos/${pub.repositories[app]}`;
    assert(route.startsWith(prefix));
    const p = route.slice(prefix.length);
    if (method === "GET" && p === "/branches/main/protection")
      return state.protection ? protect : {};
    if (method === "GET" && p === "/git/ref/heads/main")
      return { object: { sha: state.head } };
    if (method === "GET" && p.includes("/check-runs"))
      return {
        total_count: 1,
        check_runs: state.checks
          ? [
              {
                name: policy.targets[app].requiredCheck,
                app: { slug: "github-actions" },
                head_sha: state.head,
                status: "completed",
                conclusion: "success",
              },
            ]
          : [],
      };
    if (method === "GET" && p.startsWith("/pulls?")) return state.prs;
    if (method === "GET" && p.startsWith("/git/commits/")) {
      const sha = p.slice("/git/commits/".length);
      return {
        tree: { sha: git(dest, ["rev-parse", sha + "^{tree}"]) },
        message: git(dest, ["show", "-s", "--format=%B", sha]),
      };
    }
    if (method === "GET" && p.startsWith("/git/trees/")) {
      const sha = p.slice("/git/trees/".length).split("?")[0];
      const rows = git(dest, ["ls-tree", "-r", "-t", "-z", sha])
        .split("\0")
        .filter(Boolean)
        .map((row) => {
          const at = row.indexOf("\t"),
            [mode, type, id] = row.slice(0, at).split(" ");
          return { path: row.slice(at + 1), mode, type, sha: id };
        });
      const response = { sha, truncated: false, tree: rows };
      return state.treeResponse ? state.treeResponse(response) : response;
    }
    if (method === "POST" && p === "/git/blobs")
      return {
        sha: git(
          dest,
          ["hash-object", "-w", "--stdin"],
          Buffer.from(body.content, "base64"),
        ),
      };
    if (method === "POST" && p === "/git/trees") {
      const env = { GIT_INDEX_FILE: path.join(dir, "temporary-index") };
      git(
        dest,
        body.base_tree
          ? ["read-tree", body.base_tree]
          : ["read-tree", "--empty"],
        undefined,
        env,
      );
      for (const row of [...body.tree].sort(
        (a, b) => Number(!!a.sha) - Number(!!b.sha),
      ))
        if (row.sha)
          git(
            dest,
            [
              "update-index",
              "--add",
              "--cacheinfo",
              row.mode,
              row.sha,
              row.path,
            ],
            undefined,
            env,
          );
        else
          git(
            dest,
            ["update-index", "--force-remove", row.path],
            undefined,
            env,
          );
      return { sha: git(dest, ["write-tree"], undefined, env) };
    }
    if (method === "POST" && p === "/git/commits")
      return {
        sha: git(
          dest,
          ["commit-tree", body.tree, "-p", body.parents[0]],
          body.message + "\n",
          {
            GIT_AUTHOR_DATE: body.author.date,
            GIT_COMMITTER_DATE: body.committer.date,
            GIT_AUTHOR_NAME: body.author.name,
            GIT_AUTHOR_EMAIL: body.author.email,
            GIT_COMMITTER_NAME: body.committer.name,
            GIT_COMMITTER_EMAIL: body.committer.email,
          },
        ),
      };
    if (method === "GET" && p.startsWith("/git/matching-refs/heads/")) {
      const ref = p.slice("/git/matching-refs/".length);
      try {
        return [
          {
            ref: "refs/" + ref,
            object: {
              sha: git(dest, ["rev-parse", "--verify", "refs/" + ref]),
            },
          },
        ];
      } catch {
        return [];
      }
    }
    if (method === "POST" && p === "/git/refs") {
      assert(body.ref.startsWith(`refs/heads/scop-sync/${app}/`));
      git(dest, ["update-ref", body.ref, body.sha]);
      return { ref: body.ref };
    }
    if (method === "POST" && p === "/pulls") {
      const pr = {
        ...body,
        html_url: "https://example.invalid/synthetic-pr",
        state: "open",
        head: { sha: git(dest, ["rev-parse", "refs/heads/" + body.head]) },
      };
      state.prs.push(pr);
      return pr;
    }
    throw Error("UNEXPECTED_TEST_API_ROUTE: " + method + " " + p);
  }
  return {
    dir,
    source,
    dest,
    git,
    write,
    commit,
    s0,
    s1,
    d0,
    policy,
    options,
    ci,
    state,
    api,
    prepare: () => pub.prepare(options, policy, ci),
    close: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}
for (const app of ["backend", "frontend"])
  test(`${app}: reviewed incremental publication preserves history and protected files; retry reuses branch/PR`, async () => {
    const f = fixture(app);
    try {
      const p = f.prepare(),
        r = await pub.publish(
          f.api,
          p,
          f.source,
          f.policy,
          p.publicationSha256,
        );
      assert.equal(r.status, "PR_REVIEW_REQUIRED");
      assert.equal(f.git(f.dest, ["rev-parse", "main"]), f.d0);
      assert.equal(
        f.git(f.dest, ["show", r.commit + ":.env"]),
        "PRESERVE_DESTINATION=synthetic",
      );
      assert.equal(
        f.git(f.dest, ["show", r.commit + ":app.js"]),
        "enhancement",
      );
      assert.equal(f.git(f.dest, ["rev-parse", r.commit + "^"]), f.d0);
      assert.equal(f.git(f.source, ["rev-parse", "HEAD"]), f.s1);
      const retry = await pub.publish(
        f.api,
        p,
        f.source,
        f.policy,
        p.publicationSha256,
      );
      assert.equal(retry.commit, r.commit);
      assert.equal(f.state.prs.length, 1);
      assert.equal(
        f.state.calls.filter(
          (c) => c.method === "POST" && c.route.endsWith("/git/refs"),
        ).length,
        1,
      );
      assert(
        !f.state.calls.some((c) =>
          ["PATCH", "PUT", "DELETE"].includes(c.method),
        ),
      );
      assert(f.state.prs[0].draft);
      assert(!f.state.prs[0].maintainer_can_modify);
    } finally {
      f.close();
    }
  });
test("initial reconciliation is denied until exact plan and each conflicting blob pair are approved", async () => {
  const f = fixture();
  try {
    delete f.options.previousSourceSha;
    delete f.options.previousDestinationSha;
    let p = f.prepare();
    assert(p.blockers.some((b) => b.includes("BOOTSTRAP")));
    await assert.rejects(
      pub.publish(f.api, p, f.source, f.policy, p.publicationSha256),
    );
    assert.equal(f.state.calls.length, 0);
    const raw = planner.plan(f.options);
    f.policy.targets.backend.approvedBootstrap = {
      sourceTreeSha256: pub.digest([
        ...planner.tree(f.source, f.s1, "purchase-backend/").entries(),
      ]),
      destinationSha: f.d0,
      changeSetSha256: pub.digest({
        destinationSha: raw.destinationSha,
        changeSet: raw.changeSet,
      }),
      decisions: raw.changeSet.map((r) => ({
        path: r.path,
        before: r.before,
        after: r.after,
        decision: "adopt-source",
      })),
    };
    p = f.prepare();
    assert.equal(p.blockers.length, 0);
    await pub.publish(f.api, p, f.source, f.policy, p.publicationSha256);
  } finally {
    f.close();
  }
});
for (const [name, mutate] of [
  ["disabled authorization", (f) => (f.policy.enabled = false)],
  ["unapproved bootstrap", (f) => (f.policy.bootstrapApproval = "PENDING")],
  [
    "independent destination edit",
    (f) => {
      f.write(f.dest, "app.js", "independent recovery\n");
      f.options.destinationSha = f.commit(f.dest);
    },
  ],
  [
    "deletion without review",
    (f) => {
      fs.unlinkSync(path.join(f.source, "purchase-backend/app.js"));
      f.options.sourceSha = f.commit(f.source);
      f.ci.commit = f.options.sourceSha;
    },
  ],
])
  test("blocks " + name + " before remote writes", async () => {
    const f = fixture();
    try {
      mutate(f);
      const p = f.prepare();
      assert.equal(p.status, "BLOCKED");
      await assert.rejects(
        pub.publish(f.api, p, f.source, f.policy, p.publicationSha256),
      );
      assert.equal(f.state.calls.length, 0);
    } finally {
      f.close();
    }
  });
for (const [name, mutate, pattern] of [
  [
    "moved destination main",
    (f) => (f.state.head = "f".repeat(40)),
    /HEAD_CHANGED/,
  ],
  ["missing protection", (f) => (f.state.protection = false), /PROTECTION/],
  ["missing destination CI", (f) => (f.state.checks = false), /CI_REQUIRED/],
])
  test("fails closed on " + name, async () => {
    const f = fixture();
    try {
      mutate(f);
      const p = f.prepare();
      await assert.rejects(
        pub.publish(f.api, p, f.source, f.policy, p.publicationSha256),
        pattern,
      );
      assert(!f.state.calls.some((c) => c.method !== "GET"));
    } finally {
      f.close();
    }
  });
test("tampered or stale approval cannot authorize publication", async () => {
  const f = fixture();
  try {
    const p = f.prepare();
    await assert.rejects(
      pub.publish(f.api, p, f.source, f.policy, "0".repeat(64)),
      /APPROVAL/,
    );
    p.plan.changeSet = [];
    await assert.rejects(
      pub.publish(f.api, p, f.source, f.policy, p.publicationSha256),
      /TAMPERED/,
    );
    assert.equal(f.state.calls.length, 0);
  } finally {
    f.close();
  }
});
test("immutable payload secrets are rejected before any write, regardless of worktree content", async () => {
  const f = fixture();
  try {
    f.write(
      f.source,
      "purchase-backend/app.js",
      "sb_secret_" + "synthetic".repeat(6),
    );
    f.options.sourceSha = f.commit(f.source);
    f.ci.commit = f.options.sourceSha;
    const p = f.prepare();
    f.write(f.source, "purchase-backend/app.js", "innocent worktree\n");
    await assert.rejects(
      pub.publish(f.api, p, f.source, f.policy, p.publicationSha256),
      /SECRET_IN_IMMUTABLE_EXPORT/,
    );
    assert(!f.state.calls.some((c) => c.method !== "GET"));
  } finally {
    f.close();
  }
});
test("existing SQL cannot be edited or deleted even with deletion approval", () => {
  const f = fixture();
  try {
    f.write(f.source, "purchase-backend/history.sql", "original\n");
    f.options.previousSourceSha = f.commit(f.source);
    f.write(f.dest, "app.js", "enhancement\n");
    f.write(f.dest, "history.sql", "original\n");
    f.options.previousDestinationSha = f.commit(f.dest);
    f.options.destinationSha = f.options.previousDestinationSha;
    f.write(f.source, "purchase-backend/history.sql", "rewritten\n");
    f.options.sourceSha = f.commit(f.source);
    f.ci.commit = f.options.sourceSha;
    assert(
      f.prepare().blockers.some((x) => x.startsWith("EXISTING_SQL_IMMUTABLE")),
    );
  } finally {
    f.close();
  }
});
test("genuine merged App PR advances baseline after verifying source/destination trees and ancestry", async () => {
  const f = fixture();
  try {
    const p = f.prepare(),
      r = await pub.publish(f.api, p, f.source, f.policy, p.publicationSha256);
    f.git(f.dest, ["merge", "--quiet", "--ff-only", r.commit]);
    f.state.prs = [
      {
        merged_at: "2026-11-09T00:00:00Z",
        user: { login: "synthetic-scop[bot]" },
        base: { ref: "main", repo: { full_name: pub.repositories.backend } },
        head: {
          ref: r.branch,
          sha: r.commit,
          repo: { full_name: pub.repositories.backend },
        },
        merge_commit_sha: r.commit,
      },
    ];
    const b = await pub.baseline(
      f.api,
      f.source,
      f.dest,
      f.s1,
      r.commit,
      "backend",
      f.policy,
    );
    assert.deepEqual(b, { sourceSha: f.s1, destinationSha: r.commit });
    f.write(f.source, "purchase-backend/app.js", "second enhancement\n");
    f.options.sourceSha = f.commit(f.source);
    f.ci.commit = f.options.sourceSha;
    f.options.destinationSha = r.commit;
    f.options.previousSourceSha = b.sourceSha;
    f.options.previousDestinationSha = b.destinationSha;
    assert.equal(f.prepare().blockers.length, 0);
    f.write(f.dest, "app.js", "independent recovery\n");
    const bad = f.commit(f.dest);
    f.state.prs[0].merge_commit_sha = bad;
    await assert.rejects(
      pub.baseline(
        f.api,
        f.source,
        f.dest,
        f.options.sourceSha,
        bad,
        "backend",
        f.policy,
      ),
      /CONTENT_NOT_RECONCILED/,
    );
  } finally {
    f.close();
  }
});
test("destination-only files remain conflicts, not silently approved deletions", () => {
  const f = fixture();
  try {
    f.write(f.dest, "recovery-only.js", "preserve\n");
    f.options.destinationSha = f.commit(f.dest);
    const p = f.prepare();
    assert(p.blockers.some((x) => x.includes("recovery-only.js")));
  } finally {
    f.close();
  }
});
test("publishing workflow stays hard-disabled, read-only until separately reviewed activation", () => {
  const y = fs.readFileSync(
      path.resolve(__dirname, "../../.github/workflows/repository-sync.yml"),
      "utf8",
    ),
    p = require("../../deploy/sync/policy.json");
  assert.equal(p.enabled, false);
  assert.equal(p.bootstrapApproval, "PENDING_SEPARATE_REVIEW");
  assert.match(y, /publish:\s*[\s\S]*?if: \$\{\{ false \}\}/);
  assert.match(y, /environment: scop-sync-publish/);
  assert.doesNotMatch(
    y,
    /contents: write|pull-requests: write|pull_request_target|workflow_dispatch/,
  );
  assert.match(y, /cancel-in-progress: false/);
  assert.match(y, /head_branch == 'master'/);
  assert.match(y, /persist-credentials: false/);
});

test("explicit deletion approval binds the source tree, destination commit and removed blob", async () => {
  const f = fixture();
  try {
    fs.unlinkSync(path.join(f.source, "purchase-backend/app.js"));
    f.options.sourceSha = f.commit(f.source);
    f.ci.commit = f.options.sourceSha;
    const raw = planner.plan(f.options);
    f.policy.approvedDeletions = [
      {
        app: "backend",
        path: "app.js",
        sourceTreeSha256: pub.digest([
          ...planner
            .tree(f.source, f.options.sourceSha, "purchase-backend/")
            .entries(),
        ]),
        destinationSha: f.d0,
        before: raw.changeSet[0].before,
      },
    ];
    const p = f.prepare();
    assert.equal(p.blockers.length, 0);
    const r = await pub.publish(
      f.api,
      p,
      f.source,
      f.policy,
      p.publicationSha256,
    );
    assert.equal(f.git(f.dest, ["ls-tree", r.commit, "app.js"]), "");
  } finally {
    f.close();
  }
});
test("a diverged synchronization branch is never force-updated", async () => {
  const f = fixture();
  try {
    const p = f.prepare(),
      r = await pub.publish(f.api, p, f.source, f.policy, p.publicationSha256);
    f.git(f.dest, ["update-ref", "refs/heads/" + r.branch, f.d0]);
    await assert.rejects(
      pub.publish(f.api, p, f.source, f.policy, p.publicationSha256),
      /BRANCH_DIVERGED/,
    );
    assert.equal(f.git(f.dest, ["rev-parse", "refs/heads/" + r.branch]), f.d0);
  } finally {
    f.close();
  }
});
test("destination advancing during object upload prevents branch publication", async () => {
  const f = fixture();
  try {
    const p = f.prepare();
    const api = async (...args) => {
      const result = await f.api(...args);
      if (args[0] === "POST" && args[1].endsWith("/git/commits"))
        f.state.head = "f".repeat(40);
      return result;
    };
    await assert.rejects(
      pub.publish(api, p, f.source, f.policy, p.publicationSha256),
      /HEAD_CHANGED/,
    );
    assert(
      !f.state.calls.some(
        (c) =>
          c.method === "POST" &&
          (c.route.endsWith("/pulls") || c.route.endsWith("/git/refs")),
      ),
    );
  } finally {
    f.close();
  }
});
test("new additive SQL files can be proposed while existing SQL remains immutable", async () => {
  const f = fixture();
  try {
    f.write(
      f.source,
      "purchase-backend/sql/manual/999_synthetic.sql",
      "-- fixture only, never executed\n",
    );
    f.options.sourceSha = f.commit(f.source);
    f.ci.commit = f.options.sourceSha;
    const p = f.prepare();
    assert.equal(p.blockers.length, 0);
    const r = await pub.publish(
      f.api,
      p,
      f.source,
      f.policy,
      p.publicationSha256,
    );
    assert(
      f
        .git(f.dest, ["show", r.commit + ":sql/manual/999_synthetic.sql"])
        .includes("never executed"),
    );
  } finally {
    f.close();
  }
});

for (const name of [
  "CODEOWNERS",
  "docs/CODEOWNERS",
  ".npmrc",
  ".netrc",
  ".gitconfig",
  "secrets/client.json",
  "credentials/key.json",
  ".ssh/id_rsa",
  ".aws/config",
  "service-account.json",
])
  test("publisher excludes protected identity " + name, () =>
    assert(planner.excluded(name)),
  );

test("read-only governance visibility does not broaden destination write token", async () => {
  const f = fixture();
  try {
    const p = f.prepare(),
      reads = [];
    const governance = async (...args) => {
      assert.equal(args[0], "GET");
      reads.push(args[1]);
      return f.api(...args);
    };
    const writer = async (...args) => {
      assert(
        !args[1].includes("/protection") && !args[1].includes("/check-runs"),
      );
      return f.api(...args);
    };
    await pub.publish(
      writer,
      p,
      f.source,
      f.policy,
      p.publicationSha256,
      governance,
    );
    assert.equal(reads.length, 2);
  } finally {
    f.close();
  }
});
test("checked-in bootstrap is deterministic metadata with no approved conflict or historical SQL edit", () => {
  const proposal = require("../../docs/devops/sync/bootstrap-proposal.json"),
    copy = structuredClone(proposal);
  delete copy.proposalSha256;
  assert.equal(pub.digest(copy), proposal.proposalSha256);
  assert.equal(proposal.approval, "PENDING_SEPARATE_REVIEW");
  assert.equal(proposal.remoteWrites, 0);
  assert.equal(proposal.targets.backend.plan.conflicts, 13);
  assert.equal(proposal.targets.frontend.plan.changeSet.length, 0);
  assert(
    proposal.targets.backend.decisions.every(
      (x) => !x.approved && x.decision === "REQUIRES_UPSTREAM_REVIEW",
    ),
  );
  const root = path.resolve(__dirname, "../.."),
    tree = planner.tree(root, proposal.sourceSha, "purchase-backend/");
  assert.equal(
    pub.digest([...tree.entries()]),
    proposal.targets.backend.sourceTreeSha256,
  );
  for (const row of proposal.targets.backend.historicalSql) {
    assert(row.unchanged);
    assert.equal(tree.get(row.path).blob, row.destinationBlob);
  }
});

test("P1: directory replacements cannot remove config/.env or docs/CODEOWNERS", () => {
  const f = fixture();
  try {
    f.write(f.dest, "config/.env", "SYNTHETIC_ONLY=preserve\n");
    f.write(f.dest, "docs/CODEOWNERS", "* @synthetic-reviewer\n");
    const d = f.commit(f.dest);
    f.options.destinationSha = d;
    f.options.previousDestinationSha = d;
    f.write(f.source, "purchase-backend/config", "replacement\n");
    f.write(f.source, "purchase-backend/docs", "replacement\n");
    f.options.sourceSha = f.commit(f.source);
    f.ci.commit = f.options.sourceSha;
    assert.throws(() => f.prepare(), /PROTECTED|TREE/);
    assert.equal(f.state.calls.length, 0);
  } finally {
    f.close();
  }
});

for (const [oldPath, newPath] of [
  ["runtime/shared/deep/.env", "runtime/shared"],
  ["nested/.github/workflows/check.yml", "nested"],
  ["local/CODEOWNERS", "local/CODEOWNERS/child.js"],
  ["tls/client.pem", "tls/client.pem/readme.txt"],
])
  test("P1: complete tree rejects structural replacement of " + oldPath, () => {
    const f = fixture();
    try {
      f.write(f.dest, oldPath, "synthetic protected content\n");
      const d = f.commit(f.dest);
      f.options.previousDestinationSha = d;
      f.options.destinationSha = d;
      f.write(f.source, "purchase-backend/" + newPath, "source addition\n");
      f.options.sourceSha = f.commit(f.source);
      f.ci.commit = f.options.sourceSha;
      assert.throws(() => f.prepare(), /PROTECTED|TREE/);
      assert.equal(f.state.calls.length, 0);
    } finally {
      f.close();
    }
  });
test("P1: ordinary bootstrap/deletion approvals cannot authorize removal of protected entries", () => {
  const f = fixture();
  try {
    f.write(f.dest, "config/.env", "synthetic protected\n");
    const d = f.commit(f.dest);
    f.options.destinationSha = d;
    f.options.previousDestinationSha = d;
    f.write(f.source, "purchase-backend/config", "replacement\n");
    f.options.sourceSha = f.commit(f.source);
    f.ci.commit = f.options.sourceSha;
    const before = planner.fullTree(f.dest, d).get("config/.env");
    f.policy.approvedDeletions = [
      {
        app: "backend",
        path: "config/.env",
        sourceTreeSha256: pub.digest([
          ...planner.tree(f.source, f.options.sourceSha, "purchase-backend/"),
        ]),
        destinationSha: d,
        before: { blob: before.blob, mode: before.mode },
      },
    ];
    f.policy.targets.backend.approvedBootstrap = {
      decisions: [
        { path: "config/.env", decision: "adopt-source", before, after: null },
      ],
    };
    assert.throws(() => f.prepare(), /PROTECTED|TREE/);
    const full = require("./sync-tree.cjs");
    assert.throws(
      () =>
        full.project(
          planner.fullTree(f.source, f.options.sourceSha, "purchase-backend/"),
          planner.fullTree(f.dest, d),
          [
            {
              path: "config/.env",
              before: { blob: before.blob, mode: before.mode },
              after: null,
            },
          ],
          planner,
        ),
      /PROTECTED_TREE_OPERATION/,
    );
  } finally {
    f.close();
  }
});
test("P1: legitimate sibling changes retain all protected entries in the generated full Git tree", async () => {
  const f = fixture();
  try {
    for (const p of [
      "config/.env",
      "docs/CODEOWNERS",
      ".github/workflows/check.yml",
      "private-uploads/recovery.txt",
    ]) {
      f.write(f.dest, p, "protected fixture\n");
    }
    const d = f.commit(f.dest);
    f.options.destinationSha = d;
    f.options.previousDestinationSha = d;
    f.state.head = d;
    const before = planner.fullTree(f.dest, d);
    f.write(f.source, "purchase-backend/config/new.js", "legitimate sibling\n");
    f.options.sourceSha = f.commit(f.source);
    f.ci.commit = f.options.sourceSha;
    const p = f.prepare(),
      r = await pub.publish(f.api, p, f.source, f.policy, p.publicationSha256);
    const after = planner.fullTree(f.dest, r.commit);
    for (const [name, row] of before)
      if (require("./sync-tree.cjs").protectedPath(name, planner.excluded))
        assert.deepEqual(after.get(name), row);
    assert.equal(
      f.git(f.dest, ["rev-parse", r.commit + "^{tree}"]),
      p.projection.gitTreeSha,
    );
    assert.equal(
      f.state.calls.filter(
        (c) => c.method === "GET" && c.route.includes("/git/trees/"),
      ).length,
      2,
    );
  } finally {
    f.close();
  }
});
for (const [name, mutate] of [
  [
    "truncated",
    (r) => {
      r.truncated = true;
    },
  ],
  [
    "omitted protected entry",
    (r) => {
      r.tree = r.tree.filter((e) => e.path !== ".env");
    },
  ],
  [
    "duplicate path",
    (r) => {
      r.tree.push(r.tree[0]);
    },
  ],
  [
    "wrong root identity",
    (r) => {
      r.sha = "f".repeat(40);
    },
  ],
  [
    "unknown entry mode",
    (r) => {
      r.tree[0].mode = "100600";
    },
  ],
])
  test(
    "P1: remote full tree " + name + " blocks before any write",
    async () => {
      const f = fixture();
      try {
        f.state.treeResponse = (r) => {
          mutate(r);
          return r;
        };
        const p = f.prepare();
        await assert.rejects(
          pub.publish(f.api, p, f.source, f.policy, p.publicationSha256),
        );
        assert(!f.state.calls.some((c) => c.method !== "GET"));
      } finally {
        f.close();
      }
    },
  );
test("P1: unexpected generated Git tree identity blocks commits and branch creation", async () => {
  const f = fixture();
  try {
    const p = f.prepare(),
      api = async (...args) => {
        const r = await f.api(...args);
        return args[0] === "POST" && args[1].endsWith("/git/trees")
          ? { sha: "f".repeat(40) }
          : r;
      };
    await assert.rejects(
      pub.publish(api, p, f.source, f.policy, p.publicationSha256),
      /GENERATED_GIT_TREE_IDENTITY_MISMATCH/,
    );
    assert(
      !f.state.calls.some(
        (c) => c.method === "POST" && /\/(?:commits|refs|pulls)$/.test(c.route),
      ),
    );
  } finally {
    f.close();
  }
});
test("P1: generated tree metadata must retain protected entries before commit creation", async () => {
  const f = fixture();
  try {
    let reads = 0;
    f.state.treeResponse = (r) => {
      if (++reads === 2) r.tree = r.tree.filter((e) => e.path !== ".env");
      return r;
    };
    const p = f.prepare();
    await assert.rejects(
      pub.publish(f.api, p, f.source, f.policy, p.publicationSha256),
      /FULL_TREE/,
    );
    assert(
      !f.state.calls.some(
        (c) => c.method === "POST" && /\/(?:commits|refs|pulls)$/.test(c.route),
      ),
    );
  } finally {
    f.close();
  }
});
test("P1: implicit changes to destination-only descendants cannot hide in a partial change list", () => {
  const f = fixture();
  try {
    f.write(f.dest, "independent/recovery.js", "preserve\n");
    const d = f.commit(f.dest);
    f.write(f.source, "purchase-backend/independent", "replacement\n");
    const s = f.commit(f.source),
      after = planner.tree(f.source, s, "purchase-backend/").get("independent");
    assert.throws(
      () =>
        require("./sync-tree.cjs").project(
          planner.fullTree(f.source, s, "purchase-backend/"),
          planner.fullTree(f.dest, d),
          [{ path: "independent", before: null, after }],
          planner,
        ),
      /IMPLICIT_TREE_REPLACEMENT/,
    );
  } finally {
    f.close();
  }
});
for (const direction of ["directory-to-file", "file-to-directory"])
  test(
    "P1: fully reviewed managed " +
      direction +
      " changes preserve protected siblings",
    async () => {
      const f = fixture();
      try {
        const old =
            direction === "directory-to-file" ? "manual/old.txt" : "manual",
          next =
            direction === "directory-to-file" ? "manual" : "manual/new.txt";
        f.write(f.source, "purchase-backend/" + old, "old managed\n");
        const s0 = f.commit(f.source);
        f.write(f.dest, "app.js", "enhancement\n");
        f.write(f.dest, old, "old managed\n");
        const d0 = f.commit(f.dest);
        fs.rmSync(path.join(f.source, "purchase-backend/manual"), {
          recursive: true,
          force: true,
        });
        f.write(f.source, "purchase-backend/" + next, "new managed\n");
        const s1 = f.commit(f.source);
        Object.assign(f.options, {
          sourceSha: s1,
          destinationSha: d0,
          previousSourceSha: s0,
          previousDestinationSha: d0,
        });
        f.ci.commit = s1;
        f.state.head = d0;
        const raw = planner.plan(f.options),
          sourceTreeSha256 = pub.digest([
            ...planner.tree(f.source, s1, "purchase-backend/"),
          ]);
        f.policy.approvedDeletions = raw.changeSet
          .filter((r) => !r.after)
          .map((r) => ({
            app: "backend",
            path: r.path,
            before: r.before,
            sourceTreeSha256,
            destinationSha: d0,
          }));
        const p = f.prepare(),
          r = await pub.publish(
            f.api,
            p,
            f.source,
            f.policy,
            p.publicationSha256,
          );
        assert.equal(
          f.git(f.dest, ["show", r.commit + ":" + next]),
          "new managed",
        );
        assert.equal(
          f.git(f.dest, ["show", r.commit + ":.env"]),
          "PRESERVE_DESTINATION=synthetic",
        );
      } finally {
        f.close();
      }
    },
  );

test("P1: excluded symlinks and Gitlinks remain opaque and unchanged", async () => {
  const f = fixture();
  try {
    f.write(f.dest, "private-uploads/link", "opaque-symlink-target\n");
    f.git(f.dest, ["add", "private-uploads/link"]);
    const blob = f.git(f.dest, ["rev-parse", ":private-uploads/link"]);
    f.git(f.dest, [
      "update-index",
      "--cacheinfo",
      "120000",
      blob,
      "private-uploads/link",
    ]);
    f.git(f.dest, [
      "update-index",
      "--add",
      "--cacheinfo",
      "160000",
      f.d0,
      ".github/opaque-submodule",
    ]);
    f.git(f.dest, [
      "commit",
      "--quiet",
      "-m",
      "synthetic opaque protected entries",
    ]);
    const d = f.git(f.dest, ["rev-parse", "HEAD"]);
    f.options.previousDestinationSha = d;
    f.options.destinationSha = d;
    f.state.head = d;
    const before = planner.fullTree(f.dest, d),
      p = f.prepare(),
      r = await pub.publish(f.api, p, f.source, f.policy, p.publicationSha256),
      after = planner.fullTree(f.dest, r.commit);
    for (const name of ["private-uploads/link", ".github/opaque-submodule"])
      assert.deepEqual(after.get(name), before.get(name));
  } finally {
    f.close();
  }
});
test("P1: projected tree hashes match Git for directory sort boundaries and UTF-8 paths", async () => {
  const f = fixture();
  try {
    f.write(f.source, "purchase-backend/assets/data.txt", "data\n");
    f.write(f.source, "purchase-backend/assets.txt", "sibling\n");
    f.write(f.source, "purchase-backend/ملف.txt", "UTF-8 fixture\n");
    f.options.sourceSha = f.commit(f.source);
    f.ci.commit = f.options.sourceSha;
    const p = f.prepare(),
      r = await pub.publish(f.api, p, f.source, f.policy, p.publicationSha256);
    assert.equal(
      f.git(f.dest, ["rev-parse", r.commit + "^{tree}"]),
      p.projection.gitTreeSha,
    );
    const request = f.state.calls.find(
      (c) => c.method === "POST" && c.route.endsWith("/git/trees"),
    );
    assert.equal(request.body.base_tree, undefined);
    assert(request.body.tree.some((e) => e.path === ".env"));
  } finally {
    f.close();
  }
});
