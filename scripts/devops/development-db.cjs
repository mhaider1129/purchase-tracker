#!/usr/bin/env node
"use strict";
// Explicit Development-only, read-only diagnostics. No dotenv, fallback URL or migration executor.
const fs = require("node:fs"),
  path = require("node:path");
const {
  DEVELOPMENT_PROJECT_REF: project,
} = require("../../purchase-backend/scripts/lib/p2pBaseline");
function connection(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw Error("EXPLICIT_DEVELOPMENT_URL_REQUIRED");
  }
  const host = url.hostname.toLowerCase(),
    user = decodeURIComponent(url.username);
  const direct = host === `db.${project}.supabase.co` && url.port === "5432";
  const pooler =
    /^aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(host) &&
    url.port === "5432" &&
    user.endsWith("." + project);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    (!direct && !pooler) ||
    url.pathname !== "/postgres" ||
    url.search ||
    url.hash ||
    !url.password ||
    !/^[a-z_][a-z0-9_]*(?:\.[a-z0-9]+)?$/.test(user) ||
    (direct && user.includes(".") && !user.endsWith("." + project))
  )
    throw Error("DEVELOPMENT_PROJECT_IDENTITY_OR_URL_POLICY_REJECTED");
  return {
    host,
    port: 5432,
    database: "postgres",
    user,
    password: decodeURIComponent(url.password),
    ssl: { rejectUnauthorized: true, servername: host },
    options: "-c default_transaction_read_only=on",
    connectionTimeoutMillis: 10000,
    application_name: "scop-development-read-only-release-verifier",
  };
}
// Used by the documented local launcher only. Diagnostic capture never loads dotenv or storage credentials.
function localConfiguration(env) {
  connection(env.DATABASE_URL);
  if (
    env.NODE_ENV !== "development" ||
    env.DB_RELEASE_ENVIRONMENT !== "development" ||
    env.LIVE_ROUTING_ENABLED !== "false" ||
    env.EMAIL_DRY_RUN !== "true" ||
    env.SMTP_DRY_RUN !== "true"
  )
    throw Error("EXPLICIT_SAFE_DEVELOPMENT_CONFIGURATION_REQUIRED");
  if (env.SUPABASE_URL) {
    let url;
    try {
      url = new URL(env.SUPABASE_URL);
    } catch {
      throw Error("DEVELOPMENT_STORAGE_IDENTITY_REJECTED");
    }
    if (
      url.protocol !== "https:" ||
      url.hostname !== `${project}.supabase.co` ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/"
    )
      throw Error("DEVELOPMENT_STORAGE_IDENTITY_REJECTED");
  } else if (
    [
      "SUPABASE_SERVICE_ROLE_KEY",
      "SUPABASE_SERVICE_KEY",
      "SUPABASE_KEY",
      "SUPABASE_ANON_KEY",
    ].some((key) => env[key])
  ) {
    throw Error("DEVELOPMENT_STORAGE_URL_REQUIRED_FOR_CONFIGURED_KEY");
  }
  return {
    project,
    storage: env.SUPABASE_URL ? "DEVELOPMENT_ONLY" : "NOT_CONFIGURED",
  };
}
function args(argv) {
  const options = {},
    names = new Set(["release", "profile", "mode", "runtime-role", "output"]);
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].slice(2);
    if (
      !argv[i].startsWith("--") ||
      !names.has(key) ||
      options[key] !== undefined ||
      !argv[i + 1] ||
      argv[i + 1].startsWith("--")
    )
      throw Error("INVALID_DIAGNOSTIC_OPTION");
    options[key] = argv[++i];
  }
  if (
    !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(options.release || "") ||
    !["canonical", "wici-2026-11"].includes(options.profile) ||
    !["diagnostic", "runtime"].includes(options.mode) ||
    !options.output ||
    (options["runtime-role"] &&
      (options.mode !== "runtime" ||
        options["runtime-role"] !== "purchase_backend"))
  )
    throw Error("EXPLICIT_RELEASE_PROFILE_MODE_OUTPUT_REQUIRED");
  return options;
}
function outputPath(value) {
  if (!path.isAbsolute(value)) throw Error("ABSOLUTE_PRIVATE_OUTPUT_REQUIRED");
  const parent = fs.realpathSync(path.dirname(value)),
    file = path.join(parent, path.basename(value));
  for (let dir = parent; ; dir = path.dirname(dir)) {
    if (
      fs.existsSync(path.join(dir, ".git")) ||
      (fs.existsSync(path.join(dir, "HEAD")) &&
        fs.existsSync(path.join(dir, "objects")))
    )
      throw Error("OUTPUT_MUST_BE_OUTSIDE_GIT");
    if (path.dirname(dir) === dir) break;
  }
  try {
    fs.lstatSync(file);
    throw Error("OUTPUT_ALREADY_EXISTS");
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  return file;
}
async function capture(options, env = process.env, dependencies = {}) {
  // Validate everything before requiring a driver or opening a connection.
  const config = connection(
    env[
      options.mode === "runtime"
        ? "WICI_DEVELOPMENT_RUNTIME_URL"
        : "WICI_DEVELOPMENT_READONLY_URL"
    ],
  );
  const file = outputPath(options.output);
  const service =
      dependencies.service ||
      require("../../purchase-backend/services/databaseReleaseService"),
    catalog =
      dependencies.catalog ||
      require("../../purchase-backend/scripts/lib/databaseRelease/catalog"),
    contract =
      dependencies.contract ||
      (options.profile === "canonical"
        ? require("../../purchase-backend/database/releases/schema-contract.json")
        : require("../../purchase-backend/scripts/lib/databaseRelease/profiles").loadProfile(
            options.profile,
          ));
  let Client =
    dependencies.Client ||
    require("../../purchase-backend/node_modules/pg").Client;
  if (options["runtime-role"])
    Client =
      require("../../purchase-backend/utils/runtimeDatabaseIdentity").clientClass(
        "purchase_backend",
        Client,
      );
  const db = new Client(config);
  const fd = fs.openSync(file, "wx", 0o600);
  let begun = false;
  try {
    await db.connect();
    await db.query(
      "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
    );
    begun = true;
    await db.query("SET LOCAL statement_timeout='60s'");
    await db.query("SET LOCAL search_path=public,extensions,pg_catalog");
    const identity = (
      await db.query(
        "SELECT current_database() AS database, current_user AS actor, session_user AS login, current_setting('transaction_read_only') AS read_only, current_setting('server_version_num') AS server_version",
      )
    ).rows[0];
    const expectedLogin = config.user.split(".")[0];
    if (
      identity.database !== "postgres" ||
      identity.read_only !== "on" ||
      identity.login !== expectedLogin ||
      identity.actor !== (options["runtime-role"] || expectedLogin)
    )
      throw Error("DEVELOPMENT_SESSION_IDENTITY_REJECTED");
    const verification = await service.verify(db, {
      releaseRef: options.release,
      environment: "development",
      contract,
    });
    const visibility = await catalog.visibility(db),
      actual = await catalog.snapshot(db, visibility);
    const findings = verification.findings.map((f) => ({
      ...f,
      expected: (contract.catalog[f.group] || []).find(
        (r) => catalog.key(f.group, r) === f.object,
      ),
      actual: (actual[f.group] || []).find(
        (r) => catalog.key(f.group, r) === f.object,
      ),
    }));
    const summary = {};
    for (const f of findings) summary[f.group] = (summary[f.group] || 0) + 1;
    const report = {
      kind: "development-database-reconciliation",
      project,
      environment: "development",
      projectIdentityEvidence:
        "ALLOWLISTED_TLS_HOST_AND_POOLER_USERNAME_NOT_AN_INDEPENDENT_CLOUD_API_ATTESTATION",
      verification_mode: options.mode,
      identity,
      sourceContract: contract.version,
      status: options.mode === "runtime" ? verification.status : "BLOCKED",
      restart_eligible:
        options.mode === "runtime" && verification.restart_eligible === true,
      diagnosticOnly: options.mode !== "runtime",
      approval: "NO_DATABASE_CHANGES_AUTHORIZED",
      findingCount: findings.length,
      summary,
      verification,
      findings,
      catalog: actual,
    };
    if (options.mode !== "runtime") {
      report.verification = {
        ...verification,
        status: "BLOCKED",
        restart_eligible: false,
      };
    }
    await db.query("ROLLBACK");
    begun = false;
    fs.writeFileSync(fd, JSON.stringify(report, null, 2) + "\n");
    return report;
  } finally {
    fs.closeSync(fd);
    if (begun) await db.query("ROLLBACK").catch(() => {});
    await db.end().catch(() => {});
  }
}
if (require.main === module) {
  capture(args(process.argv.slice(2)))
    .then((report) => {
      console.log(
        JSON.stringify({
          status: report.status,
          project,
          mode: report.verification_mode,
          findingCount: report.findingCount,
          summary: report.summary,
          restart_eligible: report.restart_eligible,
        }),
      );
      if (report.status !== "DATABASE_READY" || !report.restart_eligible)
        process.exitCode = 1;
    })
    .catch(() => {
      // Driver messages may contain connection strings/passwords. Never print them.
      console.error("DEVELOPMENT_DIAGNOSTIC_BLOCKED_REPORT_MAY_BE_INCOMPLETE");
      process.exitCode = 1;
    });
}
module.exports = {
  connection,
  localConfiguration,
  args,
  outputPath,
  capture,
  project,
};
