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
    ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
    ["github-token", /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g],
    ["aws-access-key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
    ["provider-api-key", /\b(?:sk-proj-|sk-ant-api)[A-Za-z0-9_-]{24,}\b/g],
  ];
  for (const [kind, regex] of rules)
    for (const m of text.matchAll(regex))
      findings.push({ kind, line: text.slice(0, m.index).split("\n").length });
  for (const m of text.matchAll(/postgres(?:ql)?:\/\/[^\s'"<>`]+/g)) {
    try {
      const url = new URL(m[0]);
      const fixture =
        /^(?:localhost|127\.0\.0\.1|\[::1\])$/.test(url.hostname) ||
        /\.(?:invalid|example|test)$/.test(url.hostname);
      const placeholder =
        /^(?:CHANGE_ME|OWNER_PROVIDED_STAGING_ONLY|your_password|YOUR_PASSWORD|\$.*|%.*)$/.test(
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
function frontendEnvironment(env) {
  const findings = [];
  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith("REACT_APP_") || !value) continue;
    if (
      /SECRET|PASSWORD|SERVICE_ROLE|DATABASE|PRIVATE|API_KEY|ACCESS_TOKEN/.test(
        key,
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
function source() {
  const files = execFileSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean);
  const findings = [];
  for (const file of files) {
    const p = path.join(root, file);
    if (!fs.existsSync(p) || fs.statSync(p).size > 12 * 1024 * 1024) continue;
    const data = fs.readFileSync(p);
    if (data.includes(0)) continue;
    for (const f of scan(data.toString("utf8")))
      if (!reviewedFixture(file, data, f.kind)) findings.push({ file, ...f });
    if (/(^|\/)\.env(?:\.|$)/.test(file) && !file.endsWith(".example")) {
      for (const [index, line] of data
        .toString("utf8")
        .split(/\r?\n/)
        .entries()) {
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
    filesScanned: files.length,
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
      else if (entry.isFile())
        for (const f of scan(fs.readFileSync(file, "utf8")))
          findings.push({
            file: path.relative(directory, file).replace(/\\/g, "/"),
            ...f,
          });
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
module.exports = { scan, source, build, frontendEnvironment, reviewedFixture };
