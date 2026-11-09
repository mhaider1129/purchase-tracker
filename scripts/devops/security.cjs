#!/usr/bin/env node
"use strict";
// Local credential-pattern checks report locations/categories, never values.
const fs = require("node:fs"),
  path = require("node:path");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "../..");
function scan(text) {
  const findings = [];
  const rules = [
    ["supabase-secret-key", /\bsb_secret_[A-Za-z0-9_-]{16,}\b/g],
    ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
    ["github-token", /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g],
    ["aws-access-key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
    ["provider-api-key", /\b(?:sk-proj-|sk-ant-api)[A-Za-z0-9_-]{24,}\b/g],
  ];
  for (const [kind, regex] of rules)
    for (const m of text.matchAll(regex))
      findings.push({ kind, line: text.slice(0, m.index).split("\n").length });
  for (const m of text.matchAll(
    /(?<![A-Za-z0-9_-])[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{16,}(?![A-Za-z0-9_-])/g,
  )) {
    try {
      const parts = m[0].split(".");
      const header = JSON.parse(
        Buffer.from(parts[0], "base64url").toString("utf8"),
      );
      const claims = JSON.parse(
        Buffer.from(parts[1], "base64url").toString("utf8"),
      );
      if (
        typeof header.alg === "string" &&
        header.alg !== "none" &&
        Buffer.from(parts[2], "base64url").length >= 16 &&
        claims.role === "service_role"
      )
        findings.push({
          kind: "supabase-service-role",
          line: text.slice(0, m.index).split("\n").length,
        });
    } catch (_) {
      /* Not a structured service-role JWT. */
    }
  }
  for (const m of text.matchAll(/postgres(?:ql)?:\/\/[^\s'"<>`]+/g)) {
    try {
      const url = new URL(m[0]);
      const fixture =
        /^(?:localhost|127\.0\.0\.1|\[::1\])$/.test(url.hostname) &&
        url.port === "1" &&
        ((url.username === "fixture" && url.password === "fixture") ||
          (url.username === "ci_blocked" && url.password === "ci_blocked"));
      const placeholder =
        /^(?:CHANGE_ME|OWNER_PROVIDED_STAGING_ONLY|your_password|YOUR_PASSWORD|\$\{[A-Za-z_][A-Za-z0-9_]*\}|\$[A-Z_][A-Z0-9_]*|%[A-Z_][A-Z0-9_]*%)$/.test(
          decodeURIComponent(url.password),
        );
      if (url.password && !fixture && !placeholder)
        findings.push({
          kind: "database-credential",
          line: text.slice(0, m.index).split("\n").length,
        });
    } catch (_) {
      /* incomplete source-code URL expression */
    }
  }
  return findings;
}
function publicSupabase(value) {
  if (/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(value)) return true;
  try {
    const parts = value.split(".");
    return (
      parts.length === 3 &&
      /^[A-Za-z0-9_-]{16,}$/.test(parts[2]) &&
      JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")).typ ===
        "JWT" &&
      JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")).role ===
        "anon"
    );
  } catch (_) {
    return false;
  }
}
function frontendEnvironment(env) {
  const findings = [];
  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith("REACT_APP_") || !value) continue;
    findings.push(...scan(String(value)).map((f) => ({ ...f, variable: key })));
    if (
      /SECRET|PASSWORD|SERVICE_ROLE|DATABASE|PRIVATE|API_KEY|ACCESS_TOKEN/.test(
        key,
      ) &&
      !(
        /^REACT_APP_SUPABASE_(?:KEY|API_KEY|ANON_KEY|PUBLISHABLE_KEY)$/.test(
          key,
        ) && publicSupabase(value)
      )
    )
      findings.push({ kind: "private-frontend-variable", variable: key });
    if (
      [
        "REACT_APP_API_BASE_URL",
        "REACT_APP_API_BASE",
        "REACT_APP_API_URL",
      ].includes(key) &&
      value !== "/api"
    )
      findings.push({ kind: "noncanonical-ci-api-target", variable: key });
  }
  return findings;
}
function reviewedFixture(file, bytes, kind) {
  const digest = require("node:crypto")
    .createHash("sha256")
    .update(bytes)
    .digest("hex");
  return require("./security-exceptions.json").entries.some(
    (r) => r.file === file && r.sha256 === digest && r.kind === kind,
  );
}
// Explicit bounded scan: maps can exceed 12 MiB. No oversized text is skipped.
const MAX_TEXT_BYTES = 32 * 1024 * 1024;
function readText(file) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile()) throw Error("UNSCANNABLE_FILE_TYPE");
  const fd = fs.openSync(file, "r");
  let prefix;
  try {
    prefix = Buffer.alloc(16);
    const n = fs.readSync(fd, prefix, 0, 16, 0);
    prefix = prefix.subarray(0, n);
  } finally {
    fs.closeSync(fd);
  }
  const ext = path.extname(file).toLowerCase();
  const signature = (hex) =>
    prefix.subarray(0, hex.length / 2).equals(Buffer.from(hex, "hex"));
  const binary =
    (ext === ".png" && signature("89504e470d0a1a0a")) ||
    ([".jpg", ".jpeg"].includes(ext) && signature("ffd8ff")) ||
    (ext === ".gif" && prefix.toString("ascii", 0, 3) === "GIF") ||
    (ext === ".ico" && signature("00000100")) ||
    (ext === ".woff" && signature("774f4646")) ||
    (ext === ".woff2" && signature("774f4632")) ||
    (ext === ".ttf" && signature("00010000")) ||
    (ext === ".pdf" && prefix.toString("ascii", 0, 5) === "%PDF-") ||
    ([".xlsx", ".docx", ".zip"].includes(ext) && signature("504b0304"));
  if (binary) return null;
  if (stat.size > MAX_TEXT_BYTES) throw Error("TEXT_SIZE_LIMIT");
  const bytes = fs.readFileSync(file);
  if (bytes.length > MAX_TEXT_BYTES || bytes.includes(0))
    throw Error("TEXT_ENCODING_LIMIT");
  return {
    bytes,
    text: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
  };
}
function source(directory = root) {
  const files = execFileSync("git", ["ls-files", "-z"], {
    cwd: directory,
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean);
  const findings = [];
  let filesScanned = 0,
    binaryAssets = 0;
  for (const file of files) {
    const p = path.join(directory, file);
    let data, text;
    try {
      data = readText(p);
      if (data === null) {
        binaryAssets++;
        continue;
      }
      text = data.text;
      data = data.bytes;
    } catch (_) {
      findings.push({ file, kind: "unscannable-file" });
      continue;
    }
    filesScanned++;
    for (const f of scan(text))
      if (!reviewedFixture(file, data, f.kind)) findings.push({ file, ...f });
    if (/(^|\/)\.env(?:\.|$)/.test(file) && !file.endsWith(".example")) {
      for (const [index, line] of text.split(/\r?\n/).entries()) {
        const m = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.+)/);
        if (m)
          findings.push({
            file,
            line: index + 1,
            kind: "active-committed-environment",
            variable: m[1],
          });
      }
    }
  }
  return {
    kind: "source-security",
    status: findings.length ? "BLOCKED" : "PASSED",
    filesScanned,
    binaryAssets,
    findings,
  };
}
function build(directory) {
  const findings = frontendEnvironment(process.env);
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) throw Error("BUILD_SYMLINK_REJECTED");
      if (entry.isDirectory()) walk(file);
      else if (entry.isFile()) {
        const relative = path.relative(directory, file).replace(/\\/g, "/");
        try {
          const data = readText(file);
          if (data)
            for (const f of scan(data.text))
              findings.push({ file: relative, ...f });
        } catch (_) {
          findings.push({ file: relative, kind: "unscannable-file" });
        }
      } else throw Error("UNSCANNABLE_BUILD_ENTRY");
    }
  }
  if (!fs.existsSync(path.join(directory, "index.html")))
    throw Error("BUILD_MISSING");
  walk(directory);
  return {
    kind: "frontend-build-security",
    status: findings.length ? "BLOCKED" : "PASSED",
    findings,
  };
}
if (require.main === module) {
  try {
    const result =
      process.argv[2] === "build"
        ? build(path.join(root, "purchase-frontend/build"))
        : source();
    console.log(JSON.stringify(result, null, 2));
    if (result.status !== "PASSED") process.exitCode = 1;
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
module.exports = {
  readText,
  scan,
  source,
  build,
  frontendEnvironment,
  reviewedFixture,
};
