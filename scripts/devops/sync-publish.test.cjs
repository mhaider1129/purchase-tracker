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
                head_sha: d0,
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
      git(dest, ["read-tree", body.base_tree], undefined, env);
      for (const row of body.tree)
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
