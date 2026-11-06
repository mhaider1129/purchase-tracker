#!/usr/bin/env node
"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { spawn, spawnSync, execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "../..");
const config = require("./gates.json");
const sha = (value) => crypto.createHash("sha256").update(value).digest("hex");
const read = (p) => fs.readFileSync(path.join(root, p));
const json = (p) => JSON.parse(read(p));
const git = (...args) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const relevant = (p) =>
  /^(?:purchase-backend\/|purchase-frontend\/|scripts\/quality\/|\.github\/workflows\/)/.test(
    p,
  );
function parseStatus(status) {
  return status
    .split("\0")
    .filter((line) => relevant(line.slice(3)) || relevant(line));
}
function compareHistory(artifacts, reader) {
  const frozen = artifacts.filter((a) => /migration$/.test(a.classification));
  for (const artifact of frozen) {
    let actual;
    try {
      actual = sha(reader(artifact.path));
    } catch (_) {
      throw Error("Historical migration deleted: " + artifact.path);
    }
    if (actual !== artifact.sha256)
      throw Error("Historical migration modified: " + artifact.path);
  }
  return frozen.length;
}
function history() {
  const base = process.env.QUALITY_BASE_SHA || git("rev-parse", "HEAD^");
  if (!/^[a-f0-9]{40}$/.test(base))
    throw Error("Explicit valid historical base SHA required");
  const inventory = JSON.parse(
    git(
      "show",
      base + ":purchase-backend/database/releases/migration-inventory.json",
    ),
  );
  return {
    baseSha: base,
    unchangedMigrations: compareHistory(inventory.artifacts, (p) =>
      read("purchase-backend/" + p),
    ),
  };
}
function provenance() {
  const paths = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: root, encoding: "utf8" },
  )
    .split("\0")
    .filter((p) => p && relevant(p));
  const files = [...new Set(paths)].sort().map((p) => ({
    path: p,
    sha256: fs.existsSync(path.join(root, p)) ? sha(read(p)) : null,
  }));
  const dirty = parseStatus(
    execFileSync(
      "git",
      ["status", "--porcelain", "--untracked-files=all", "-z"],
      { cwd: root, encoding: "utf8" },
    ),
  );
  return {
    gitCommit: git("rev-parse", "HEAD"),
    sourceDigest: sha(JSON.stringify(files)),
    dirty: dirty.length > 0,
    gateConfigDigest: sha(read("scripts/quality/gates.json")),
  };
}
function environment(out) {
  // Deliberately do not forward application/PG/Supabase/SMTP credentials. Keep
  // platform proxy and CA configuration; dependencies can use the configured proxy.
  const allow =
    /^(?:PATH|HOME|USER|LOGNAME|SHELL|TMPDIR|TEMP|TMP|LANG|LC_.*|SYSTEMROOT|HTTP_PROXY|HTTPS_PROXY|ALL_PROXY|NO_PROXY|http_proxy|https_proxy|no_proxy|NODE_EXTRA_CA_CERTS|SSL_CERT_FILE|SSL_CERT_DIR|CODEX_PROXY_CERT|DOCKER_CONFIG|DOCKER_HOST|DOCKER_CONTEXT|DOCKER_TLS|DOCKER_TLS_VERIFY|DOCKER_CERT_PATH|npm_config_cache)$/;
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => allow.test(key)),
  );
  return {
    ...env,
    CI: "true",
    TZ: "UTC",
    LIVE_ROUTING_ENABLED: "false",
    EMAIL_DRY_RUN: "true",
    SMTP_DRY_RUN: "true",
    DATABASE_URL:
      "postgresql://ci_blocked:ci_blocked@127.0.0.1:1/ci_no_database",
    JWT_SECRET: "disposable-ci-only-not-a-login-secret",
    REACT_APP_API_URL: "/api",
    REACT_APP_API_BASE_URL: "/api",
    REACT_APP_API_BASE: "/api",
    CI_QUALITY_REPORT_DIR: out,
  };
}
function contract() {
  const {
    verifyFiles,
  } = require("../../purchase-backend/scripts/lib/databaseRelease/inventory");
  const inventory = json(
    "purchase-backend/database/releases/migration-inventory.json",
  );
  const errors = verifyFiles(inventory);
  if (errors.length)
    throw Error(
      "Locked database/source inventory differs: " + JSON.stringify(errors),
    );
  const schema = json(
    "purchase-backend/database/releases/schema-contract.json",
  );
  if (schema.version !== config.databaseContract)
    throw Error("Required database contract changed; review release policy");
  const migrations = inventory.artifacts
    .filter((a) => a.id || /migration$/.test(a.classification))
    .map((a) => ({
      id: a.id,
      path: a.path,
      sha256: a.sha256,
      classification: a.classification,
    }));
  for (const id of config.requiredMigrations)
    if (!migrations.some((a) => a.id === id))
      throw Error("Required migration missing: " + id);
  for (const code of [
    "finance.payment.manage",
    "finance.post-ledger",
    "procure-to-pay.purchase-orders.manage",
    "operations.events.view",
  ])
    if (!schema.catalog.permissions.some((p) => p.code === code))
      throw Error("Required permission missing: " + code);
  return {
    requiredContract: schema.version,
    backendApplicationManifestSha256: inventory.application_manifest_sha256,
    contractSha256: sha(JSON.stringify(schema)),
    migrations,
  };
}
function tree(dir) {
  if (!fs.existsSync(dir)) throw Error("Build artifact directory missing");
  const files = [];
  function walk(base) {
    for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
      const p = path.join(base, entry.name);
      if (entry.isSymbolicLink()) throw Error("Artifact symlink rejected");
      if (entry.isDirectory()) walk(p);
      else if (entry.isFile())
        files.push({
          path: path.relative(dir, p).split(path.sep).join("/"),
          sha256: sha(fs.readFileSync(p)),
          bytes: fs.statSync(p).size,
        });
    }
  }
  walk(dir);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}
function localization(
  directory = path.join(root, "purchase-frontend/src/locales"),
) {
  const issues = [],
    suffix = /_(zero|one|two|few|many|other)$/;
  const flatten = (v, prefix = "") =>
    Object.entries(v).flatMap(([k, x]) =>
      typeof x === "object" && x !== null
        ? flatten(x, prefix + k + ".")
        : [[prefix + k, x]],
    );
  for (const family of ["", "interface."]) {
    const en = new Map(
        flatten(
          JSON.parse(fs.readFileSync(path.join(directory, family + "en.json"))),
        ),
      ),
      ar = new Map(
        flatten(
          JSON.parse(fs.readFileSync(path.join(directory, family + "ar.json"))),
        ),
      );
    const canonical = (map) =>
      [...new Set([...map.keys()].map((k) => k.replace(suffix, "")))].sort();
    if (JSON.stringify(canonical(en)) !== JSON.stringify(canonical(ar)))
      issues.push(family + "key parity");
    const tokens = (s) =>
      [
        ...new Set(
          [...String(s).matchAll(/{{\s*-?\s*([^},\s]+)(?:[^}]*)}}/g)].map(
            (m) => m[1],
          ),
        ),
      ].sort();
    for (const [key, value] of ar) {
      if (typeof value !== "string" || !value.trim()) {
        issues.push("Empty/non-string translation: " + key);
        continue;
      }
      const base = en.get(key) ?? en.get(key.replace(suffix, "") + "_other");
      if (base != null) {
        const a = tokens(value).filter(
            (t) => !(/_(zero|one|two)$/.test(key) && t === "count"),
          ),
          b = tokens(base).filter(
            (t) => !(/_(zero|one|two)$/.test(key) && t === "count"),
          );
        if (JSON.stringify(a) !== JSON.stringify(b))
          issues.push("Interpolation parity: " + family + key);
      }
    }
    for (const [key, value] of en)
      if (typeof value !== "string" || !value.trim())
        issues.push("Empty/non-string English: " + key);
    // i18next legitimately omits count for Arabic singular/dual forms. Every
    // plural family must still contain all locale-required grammatical forms.
    const families = [
      ...new Set(
        [...en.keys()]
          .filter((k) => suffix.test(k))
          .map((k) => k.replace(suffix, "")),
      ),
    ];
    for (const base of families)
      for (const form of ["zero", "one", "two", "few", "many", "other"])
        if (!ar.has(base + "_" + form))
          issues.push("Arabic plural form: " + base + "_" + form);
  }
  if (issues.length) throw Error(issues.join("\n"));
  return { namespaces: 2, languages: ["en", "ar"], status: "passed" };
}
async function execute(command, cwd, env, log) {
  return new Promise((resolve) => {
    const child = spawn(command[0], command.slice(1), {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let timer;
    const sink = (chunk) => {
      fs.appendFileSync(log, chunk);
    };
    child.stdout.on("data", sink);
    child.stderr.on("data", sink);
    timer = setTimeout(() => child.kill("SIGTERM"), 18 * 60 * 1000);
    timer.unref();
    child.on("error", (error) => {
      sink(Buffer.from(error.message));
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({ exitCode: code, signal });
    });
  });
}
function syntax() {
  const files = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: root, encoding: "utf8" },
  )
    .split("\0")
    .filter((p) =>
      /^(purchase-backend\/|scripts\/quality\/).*\.(js|cjs)$/.test(p),
    );
  for (const file of [...new Set(files)]) {
    const result = spawnSync(process.execPath, ["--check", file], {
      cwd: root,
      encoding: "utf8",
    });
    if (result.status !== 0) throw Error(file + ": " + result.stderr);
  }
  return { files: files.length, status: "passed" };
}
function validateResult(gate, result, log, out) {
  if (result.exitCode !== 0 || result.signal)
    throw Error("Command failed: " + result.exitCode + " " + result.signal);
  for (const marker of gate.markers || [])
    if (!log.includes(marker))
      throw Error("Missing completion evidence: " + marker);
  if (gate.kind === "jest") {
    const data = JSON.parse(
      fs.readFileSync(path.join(out, gate.id + ".jest.json"), "utf8"),
    );
    if (
      !data.success ||
      data.numFailedTests ||
      data.numFailedTestSuites ||
      data.numPassedTests < 1 ||
      data.numPendingTests
    )
      throw Error("Jest result is failed, empty or skipped");
    return {
      suites: data.numPassedTestSuites,
      passed: data.numPassedTests,
      failed: data.numFailedTests,
      skipped: data.numPendingTests,
    };
  }
  if (gate.kind === "schema") {
    const summary = log
      .split("\n")
      .filter((line) => line.startsWith("{"))
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch (_) {
          return null;
        }
      })
      .find((row) => row?.plansPassed);
    if (!summary || summary.plansFailed || summary.postflightFindings !== 0)
      throw Error("Schema validation did not establish complete compatibility");
    return summary;
  }
  if (gate.kind === "build") {
    const files = tree(path.join(root, "purchase-frontend/build"));
    for (const name of ["index.html", "asset-manifest.json"])
      if (!files.some((f) => f.path === name))
        throw Error("Incomplete production build");
    if (!files.some((f) => /^static\/js\/.+\.js$/.test(f.path)))
      throw Error("Production JS missing");
    return { files };
  }
  if (gate.id === "p2p") {
    const number = (key) => {
      const match = log.match(new RegExp("(?:#|ℹ) " + key + " (\\d+)"));
      return match ? Number(match[1]) : null;
    };
    if (
      !(number("pass") > 0) ||
      number("fail") !== 0 ||
      (number("skipped") ?? number("skip")) !== 0
    )
      throw Error("P2P tests are empty, failed or skipped");
    return {
      passed: number("pass"),
      failed: number("fail"),
      skipped: number("skipped") ?? number("skip"),
    };
  }
  const summaries = [
    ...log.matchAll(/(?:cases|scenarios) passed:\s*(\d+)/g),
  ].map((m) => Number(m[1]));
  if (summaries.some((n) => n < 1))
    throw Error("Empty database scenario suite");
  return { completionMarkers: gate.markers || [], scenarioCounts: summaries };
}
async function runGate(gate, out) {
  fs.mkdirSync(out, { recursive: true });
  const before = provenance(),
    logFile = gate.id + ".log",
    log = path.join(out, logFile);
  fs.writeFileSync(log, "");
  const report = {
    kind: "quality-gate",
    version: 1,
    id: gate.id,
    ...before,
    liveRoutingEnabled: false,
    startedAt: new Date().toISOString(),
    command: gate.command || [gate.kind],
    nodeVersion: process.version,
    status: "failed",
    exitCode: 1,
    signal: null,
  };
  try {
    contract();
    if (["syntax", "localization", "history"].includes(gate.kind)) {
      report.results =
        gate.kind === "syntax"
          ? syntax()
          : gate.kind === "history"
            ? history()
            : localization();
      fs.appendFileSync(log, JSON.stringify(report.results) + "\n");
      report.exitCode = 0;
    } else {
      const command = [...gate.command];
      if (gate.kind === "jest")
        command.push("--outputFile=" + path.join(out, gate.id + ".jest.json"));
      const outcome = await execute(
        command,
        path.join(root, gate.cwd),
        environment(path.join(out, gate.id)),
        log,
      );
      Object.assign(report, outcome);
      report.results = validateResult(
        gate,
        outcome,
        fs.readFileSync(log, "utf8"),
        out,
      );
    }
    const after = provenance();
    if (
      before.gitCommit !== after.gitCommit ||
      before.sourceDigest !== after.sourceDigest
    )
      throw Error("Release inputs changed while gate ran");
    report.status = "passed";
  } catch (error) {
    report.error = error.message;
    report.exitCode = report.exitCode || 1;
  }
  report.finishedAt = new Date().toISOString();
  report.log = { path: logFile, sha256: sha(fs.readFileSync(log)) };
  fs.writeFileSync(
    path.join(out, gate.id + ".json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    gate.id + ": " + report.status + (report.error ? " — " + report.error : ""),
  );
  return report;
}
function evaluate(
  reports,
  current,
  needs = null,
  ci = {
    sha: process.env.GITHUB_SHA,
    actions: process.env.GITHUB_ACTIONS === "true",
  },
) {
  const failures = [];
  for (const gate of config.gates) {
    const matches = reports.filter((r) => r.id === gate.id);
    if (matches.length !== 1) {
      failures.push(gate.id + ": missing or duplicate evidence");
      continue;
    }
    const r = matches[0];
    if (
      Number(String(r.nodeVersion).split(".")[0].replace("v", "")) !==
      config.nodeMajor
    )
      failures.push(gate.id + ": unsupported Node version");
    if (
      JSON.stringify(r.command) !== JSON.stringify(gate.command || [gate.kind])
    )
      failures.push(gate.id + ": command mismatch");
    if (
      r.kind !== "quality-gate" ||
      r.version !== 1 ||
      r.status !== "passed" ||
      r.exitCode !== 0 ||
      r.signal ||
      !r.results ||
      !r.log?.sha256
    )
      failures.push(gate.id + ": failed/incomplete evidence");
    if (
      r.liveRoutingEnabled !== false ||
      r.dirty ||
      r.gitCommit !== current.gitCommit ||
      r.sourceDigest !== current.sourceDigest ||
      r.gateConfigDigest !== current.gateConfigDigest
    )
      failures.push(gate.id + ": source/policy mismatch or dirty inputs");
    if (
      !Number.isFinite(Date.parse(r.startedAt)) ||
      !Number.isFinite(Date.parse(r.finishedAt)) ||
      Date.parse(r.finishedAt) < Date.parse(r.startedAt)
    )
      failures.push(gate.id + ": invalid timestamps");
  }
  if (current.dirty) failures.push("Release source is not committed");
  if (ci.sha && ci.sha !== current.gitCommit)
    failures.push("Checkout does not match workflow SHA");
  if (ci.actions && !needs) failures.push("Workflow job outcomes are required");
  if (needs) {
    for (const job of ["backend", "frontend", "postgres"])
      if (needs[job]?.result !== "success")
        failures.push(job + ": required workflow job did not succeed");
  }
  return failures;
}
function manifest(evidence, buildRoot, needs) {
  const current = provenance(),
    reports = [];
  const findings = [];
  let files = [];
  try {
    files = tree(evidence);
  } catch (error) {
    findings.push(error.message);
  }
  for (const item of files.filter((f) => f.path.endsWith(".json"))) {
    const file = path.join(evidence, item.path);
    let value;
    try {
      value = JSON.parse(fs.readFileSync(file));
    } catch (_) {
      findings.push("Malformed JSON evidence: " + item.path);
      continue;
    }
    if (value.kind === "quality-gate") {
      const log = path.resolve(path.dirname(file), value.log?.path || "");
      if (
        !log.startsWith(path.resolve(evidence) + path.sep) ||
        !fs.existsSync(log) ||
        sha(fs.readFileSync(log)) !== value.log?.sha256
      )
        findings.push("Log integrity failure: " + value.id);
      if (!config.gates.some((g) => g.id === value.id))
        findings.push("Unexpected gate: " + value.id);
      const gate = config.gates.find((g) => g.id === value.id);
      if (
        gate &&
        fs.existsSync(log) &&
        !["syntax", "localization", "history", "build"].includes(gate.kind)
      ) {
        try {
          const actual = validateResult(
            gate,
            value,
            fs.readFileSync(log, "utf8"),
            path.dirname(file),
          );
          if (JSON.stringify(actual) !== JSON.stringify(value.results))
            findings.push("Result evidence mismatch: " + value.id);
        } catch (error) {
          findings.push(value.id + ": " + error.message);
        }
      }
      reports.push(value);
    }
  }
  findings.push(...evaluate(reports, current, needs));
  let database;
  try {
    database = contract();
  } catch (error) {
    findings.push(error.message);
  }
  const build = reports.find((r) => r.id === "frontend-build");
  try {
    if (
      JSON.stringify(tree(buildRoot)) !== JSON.stringify(build?.results?.files)
    )
      findings.push("Build artifact differs from tested files");
  } catch (error) {
    findings.push(error.message);
  }
  return {
    version: 1,
    status: findings.length ? "BLOCKED" : "TEST_READY",
    ...current,
    generatedAt: new Date().toISOString(),
    backendVersion: json("purchase-backend/package.json").version,
    frontendVersion: json("purchase-frontend/package.json").version,
    nodeMajor: config.nodeMajor,
    liveRoutingEnabled: false,
    database: {
      ...database,
      verificationScope: "DISPOSABLE_POSTGRESQL_ONLY",
      hostedCompatibility: "NOT_VERIFIED",
    },
    workers: Object.fromEntries(
      Object.entries(config.workers).map(([name, w]) => [
        name,
        { ...w, sourceSha256: sha(read("purchase-backend/" + w.source)) },
      ]),
    ),
    tests: reports,
    build: { status: build?.status || "missing", ...(build?.results || {}) },
    ci: {
      repository: process.env.GITHUB_REPOSITORY || null,
      runId: process.env.GITHUB_RUN_ID || null,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT || null,
    },
    smokePlan: json("scripts/quality/smoke-plan.json"),
    deploymentPrerequisites: [
      "Genuine governed database receipts and current compatibility verification",
      "Approved backup and tested recovery",
      "Manual migration/release approval",
      "Compatible backend/frontend source binding",
      "Worker health and smoke tests",
      "Queue/error monitoring and owner operational acceptance",
    ],
    operationalAcceptance: {
      status: "PENDING_OWNER_ACCEPTANCE",
      productionDeploymentAuthorized: false,
    },
    failures: findings,
  };
}
async function main(args = process.argv.slice(2)) {
  const [mode, id] = args;
  const option = (key, fallback) => {
    const i = args.indexOf(key);
    return i < 0 ? fallback : args[i + 1];
  };
  const out = path.resolve(option("--out", path.join(root, "quality-results")));
  if (mode === "gate" || mode === "group") {
    const gates = config.gates.filter((g) =>
      mode === "gate" ? g.id === id : g.group === id,
    );
    if (!gates.length) throw Error("Unknown gate/group");
    const reports = [];
    for (const gate of gates) reports.push(await runGate(gate, out));
    if (reports.some((r) => r.status !== "passed")) process.exitCode = 1;
    return;
  }
  if (mode === "manifest") {
    const result = manifest(
      path.resolve(option("--evidence", out)),
      path.resolve(
        option("--build", path.join(root, "purchase-frontend/build")),
      ),
      option("--needs") ? JSON.parse(option("--needs")) : null,
    );
    const file = path.resolve(
      option("--output", path.join(out, "release-manifest.json")),
    );
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(result, null, 2) + "\n");
    console.log(result.status + ": " + file);
    if (result.status !== "TEST_READY") process.exitCode = 1;
    return;
  }
  throw Error("Use gate <id>, group <backend|frontend|postgres>, or manifest");
}
module.exports = {
  compareHistory,
  history,
  parseStatus,
  config,
  provenance,
  environment,
  contract,
  tree,
  localization,
  validateResult,
  evaluate,
  manifest,
  main,
};
if (require.main === module)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
