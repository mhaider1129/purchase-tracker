"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const s = require("./security.cjs");
const jwt = (role) =>
  [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ),
    Buffer.from(JSON.stringify({ role, iss: "supabase" })).toString(
      "base64url",
    ),
    Buffer.alloc(32, 7).toString("base64url"),
  ].join(".");
test("service role claims and secret keys are rejected without logging values", () => {
  assert(
    s.scan(jwt("service_role")).some((f) => f.kind === "supabase-service-role"),
  );
  assert(s.scan("sb_secret_" + "x".repeat(32)).length);
});
test("public keys and ordinary public configuration pass", () => {
  assert.deepEqual(
    s.scan(
      jwt("anon") +
        " sb_publishable_" +
        "p".repeat(32) +
        " https://example.supabase.co",
    ),
    [],
  );
});
test("oversized, malformed and binary-disguised text fails closed", () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "scop-scan-"));
  try {
    fs.writeFileSync(path.join(d, "index.html"), "ok");
    for (const bytes of [
      Buffer.alloc(33 * 1024 * 1024, 97),
      Buffer.from([0xff, 0xfe]),
      Buffer.from([97, 0, 98]),
    ]) {
      fs.writeFileSync(path.join(d, "payload.js"), bytes);
      assert.equal(s.build(d).status, "BLOCKED");
    }
  } finally {
    fs.rmSync(d, { recursive: true, force: true });
  }
});
test("frontend build catches both Supabase credential forms", () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "scop-scan-"));
  try {
    fs.writeFileSync(
      path.join(d, "index.html"),
      jwt("service_role") + " sb_secret_" + "x".repeat(32),
    );
    assert.equal(s.build(d).status, "BLOCKED");
  } finally {
    fs.rmSync(d, { recursive: true, force: true });
  }
});

test("committed oversized text is blocked, not silently skipped", () => {
  const { execFileSync } = require("node:child_process"),
    d = fs.mkdtempSync(path.join(os.tmpdir(), "scop-source-"));
  try {
    execFileSync("git", ["init", "--quiet"], { cwd: d });
    fs.writeFileSync(
      path.join(d, "huge.js"),
      Buffer.alloc(33 * 1024 * 1024, 97),
    );
    execFileSync("git", ["add", "huge.js"], { cwd: d });
    const result = s.source(d);
    assert.equal(result.status, "BLOCKED");
    assert.equal(result.filesScanned, 0);
    assert.equal(result.findings[0].kind, "unscannable-file");
  } finally {
    fs.rmSync(d, { recursive: true, force: true });
  }
});
test("read failure blocks scanning and source credential values never enter findings", () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "scop-read-"));
  try {
    fs.writeFileSync(path.join(d, "index.html"), "ok");
    const original = fs.readFileSync;
    fs.readFileSync = function (file, ...args) {
      if (file === path.join(d, "index.html")) throw Error("synthetic EACCES");
      return original.call(this, file, ...args);
    };
    try {
      assert.equal(s.build(d).status, "BLOCKED");
    } finally {
      fs.readFileSync = original;
    }
    const token = jwt("service_role");
    assert(!JSON.stringify(s.scan(token)).includes(token));
  } finally {
    fs.rmSync(d, { recursive: true, force: true });
  }
});
test("ordinary frontend public and publishable configuration is accepted", () => {
  assert.deepEqual(
    s.frontendEnvironment({
      REACT_APP_API_URL: "/api",
      REACT_APP_SUPABASE_URL: "https://example.supabase.co",
      REACT_APP_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_" + "p".repeat(32),
    }),
    [],
  );
  assert(
    s.frontendEnvironment({ REACT_APP_CONFIG: jwt("service_role") }).length,
  );
});

test("loopback and example hosts cannot hide real-looking passwords", () => {
  for (const host of ["localhost", "127.0.0.1", "db.example", "db.invalid"]) {
    const text =
      "postgresql://operator:" +
      "synthetic-private-material" +
      "@" +
      host +
      ":5432/db";
    assert(s.scan(text).some((f) => f.kind === "database-credential"));
  }
  assert.deepEqual(s.scan("postgresql://fixture:fixture@127.0.0.1:1/test"), []);
});

test("publishable or anonymous Supabase API_KEY aliases are public, secret aliases stay blocked", () => {
  for (const value of ["sb_publishable_" + "p".repeat(32), jwt("anon")]) {
    assert.deepEqual(
      s.frontendEnvironment({ REACT_APP_SUPABASE_API_KEY: value }),
      [],
    );
  }
  assert(
    s.frontendEnvironment({ REACT_APP_SUPABASE_API_KEY: jwt("service_role") })
      .length,
  );
  assert(
    s.frontendEnvironment({
      REACT_APP_SECRET: "sb_publishable_" + "p".repeat(32),
    }).length,
  );
  assert.deepEqual(s.scan("plain service_role documentation"), []);
});
test(
  "long non-token identifiers do not cause quadratic token scanning",
  { timeout: 5000 },
  () => {
    assert.deepEqual(s.scan("a".repeat(1024 * 1024)), []);
  },
);
