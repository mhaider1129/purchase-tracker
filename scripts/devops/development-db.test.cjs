"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  {
    connection,
    localConfiguration,
    args,
    capture,
    project,
  } = require("./development-db.cjs");
const scheme = ["postgresql", "://"].join("");
const url = `${scheme}dev_reader:synthetic@db.${project}.supabase.co:5432/postgres`;
test("Development identity allows only exact TLS-validated direct or session-pooler binding", () => {
  const config = connection(url);
  assert.equal(config.ssl.rejectUnauthorized, true);
  assert.equal(config.ssl.servername, config.host);
  assert.match(config.options, /default_transaction_read_only=on/);
  const pool = connection(
    `${scheme}dev_reader.${project}:synthetic@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`,
  );
  assert.equal(pool.user, `dev_reader.${project}`);
});
test("production, lookalikes, query overrides, transaction pools and localhost are rejected before connecting", () => {
  for (const input of [
    url.replace(project, "ytzvnbwrgvkkixtgnjcg"),
    url.replace(".supabase.co", ".supabase.co.attacker.invalid"),
    url + "?sslmode=disable",
    url + "?host=localhost",
    url + "#override",
    url.replace(":5432", ":6543"),
    url.replace(`db.${project}.supabase.co`, "127.0.0.1"),
    url.replace("/postgres", "/other"),
    `${scheme}dev_reader.ytzvnbwrgvkkixtgnjcg:synthetic@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`,
    url.replace("postgresql:", "https:"),
    url.replace("synthetic@", "@"),
  ])
    assert.throws(() => connection(input));
});
test("explicit modes, profiles and references are required; no arbitrary environment or SQL command exists", () => {
  assert.throws(() => args(["--environment", "production"]));
  assert.throws(() => args(["--mode", "diagnostic"]));
  assert.throws(() =>
    args([
      "--release",
      "a",
      "--profile",
      "canonical",
      "--mode",
      "diagnostic",
      "--runtime-role",
      "purchase_backend",
      "--output",
      "/tmp/test",
    ]),
  );
  assert.equal(
    args([
      "--release",
      "a",
      "--profile",
      "canonical",
      "--mode",
      "runtime",
      "--output",
      "/tmp/test",
    ]).mode,
    "runtime",
  );
});
function fixture(t, { fail = false, wrongIdentity = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scop-dev-diagnostic-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const calls = [],
    options = {
      release: "synthetic-only",
      profile: "canonical",
      mode: "diagnostic",
      output: path.join(dir, "report.json"),
    };
  class Client {
    constructor(config) {
      assert.equal(config.host, `db.${project}.supabase.co`);
    }
    async connect() {
      calls.push("CONNECT");
    }
    async query(sql) {
      calls.push(sql);
      return {
        rows: [
          {
            database: wrongIdentity ? "other" : "postgres",
            actor: "dev_reader",
            login: "dev_reader",
            read_only: "on",
            server_version: "170000",
          },
        ],
      };
    }
    async end() {
      calls.push("END");
    }
  }
  const dependencies = {
    Client,
    contract: { version: "synthetic", catalog: {} },
    service: {
      async verify(db, o) {
        assert.equal(o.environment, "development");
        assert(calls.some((x) => x.endsWith("READ ONLY")));
        if (fail) throw Error("synthetic audit failure");
        return {
          status: "DATABASE_READY",
          restart_eligible: true,
          findings: [],
        };
      },
    },
    catalog: {
      async visibility() {
        return { complete: true };
      },
      async snapshot() {
        return {};
      },
    },
  };
  return {
    options,
    dependencies,
    calls,
    env: {
      WICI_DEVELOPMENT_READONLY_URL: url,
      WICI_DEVELOPMENT_RUNTIME_URL: url,
    },
  };
}
test("diagnostic cannot authorize restart even when mocked canonical verifier passes; report is private and exclusive", async (t) => {
  const f = fixture(t),
    report = await capture(f.options, f.env, f.dependencies);
  assert.equal(report.status, "BLOCKED");
  assert.equal(report.restart_eligible, false);
  assert.equal(report.verification.restart_eligible, false);
  assert.equal(report.project, project);
  assert(f.calls.includes("ROLLBACK"));
  assert.equal(f.calls.at(-1), "END");
  assert(!fs.readFileSync(f.options.output, "utf8").includes("synthetic@"));
  await assert.rejects(
    capture(f.options, f.env, f.dependencies),
    /OUTPUT_ALREADY_EXISTS/,
  );
});
test("runtime acceptance retains canonical gates rather than accepting diagnostic zero findings", async (t) => {
  const f = fixture(t);
  f.options.mode = "runtime";
  const report = await capture(f.options, f.env, f.dependencies);
  assert.equal(report.status, "DATABASE_READY");
  assert.equal(report.restart_eligible, true);
});
test("missing dedicated URL never falls back to DATABASE_URL", async (t) => {
  const f = fixture(t);
  await assert.rejects(
    capture(f.options, { DATABASE_URL: url }, f.dependencies),
  );
  assert.deepEqual(f.calls, []);
});
test("verification failures roll back and disconnect, without producing successful evidence", async (t) => {
  const f = fixture(t, { fail: true });
  await assert.rejects(capture(f.options, f.env, f.dependencies));
  assert(f.calls.includes("ROLLBACK"));
  assert.equal(f.calls.at(-1), "END");
  assert.equal(fs.readFileSync(f.options.output, "utf8"), "");
});
test("contradictory session identity blocks verification before catalog access", async (t) => {
  const f = fixture(t, { wrongIdentity: true });
  f.dependencies.service.verify = () =>
    assert.fail("must not verify foreign database");
  await assert.rejects(
    capture(f.options, f.env, f.dependencies),
    /SESSION_IDENTITY_REJECTED/,
  );
  assert(f.calls.includes("ROLLBACK"));
});

test("local startup binds storage and database to Development and requires dry-run outbound settings", () => {
  const env = {
    DATABASE_URL: url,
    NODE_ENV: "development",
    DB_RELEASE_ENVIRONMENT: "development",
    LIVE_ROUTING_ENABLED: "false",
    EMAIL_DRY_RUN: "true",
    SMTP_DRY_RUN: "true",
    SUPABASE_URL: `https://${project}.supabase.co`,
  };
  assert.equal(localConfiguration(env).storage, "DEVELOPMENT_ONLY");
  for (const SUPABASE_URL of [
    "https://ytzvnbwrgvkkixtgnjcg.supabase.co",
    `https://${project}.supabase.co.attacker.invalid`,
    `https://${project}.supabase.co/?override=true`,
    `http://${project}.supabase.co`,
  ])
    assert.throws(() => localConfiguration({ ...env, SUPABASE_URL }));
  assert.throws(() => localConfiguration({ ...env, EMAIL_DRY_RUN: "false" }));
  assert.throws(() =>
    localConfiguration({ ...env, SUPABASE_URL: "", SUPABASE_KEY: "synthetic" }),
  );
});
