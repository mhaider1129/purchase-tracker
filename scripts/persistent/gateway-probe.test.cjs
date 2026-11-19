"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  https = require("node:https"),
  http = require("node:http"),
  { execFileSync } = require("node:child_process");
const { gatewayProbe } = require("./gateway-probe.cjs");
test("actual HTTPS/mTLS probe rejects bad listener, certificates, routes, identity and responses", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scop-probe-tls-"));
  let server, plain;
  const sockets = new Set();
  const openssl = (...args) =>
      execFileSync("openssl", args, { cwd: dir, stdio: "pipe" }),
    read = (p) => fs.readFileSync(path.join(dir, p), "utf8");
  try {
    openssl(
      "req",
      "-x509",
      "-nodes",
      "-newkey",
      "rsa:2048",
      "-keyout",
      "ca.key",
      "-out",
      "ca.crt",
      "-days",
      "1",
      "-subj",
      "/CN=Disposable SCOP probe CA",
    );
    for (const role of ["server", "client"]) {
      openssl(
        "req",
        "-new",
        "-nodes",
        "-newkey",
        "rsa:2048",
        "-keyout",
        role + ".key",
        "-out",
        role + ".csr",
        "-subj",
        "/CN=" + role,
      );
      fs.writeFileSync(
        path.join(dir, role + ".ext"),
        role === "server"
          ? "subjectAltName=DNS:staging.example.invalid\nextendedKeyUsage=serverAuth"
          : "extendedKeyUsage=clientAuth",
      );
      openssl(
        "x509",
        "-req",
        "-in",
        role + ".csr",
        "-CA",
        "ca.crt",
        "-CAkey",
        "ca.key",
        "-CAcreateserial",
        "-out",
        role + ".crt",
        "-days",
        "1",
        "-extfile",
        role + ".ext",
      );
    }
    let failure = "none",
      requests = 0;
    server = https.createServer(
      {
        key: read("server.key"),
        cert: read("server.crt"),
        ca: read("ca.crt"),
        requestCert: true,
        rejectUnauthorized: true,
      },
      (req, res) => {
        requests++;
        if (failure === "hang") return;
        res.setHeader(
          "X-SCOP-Commit",
          failure === "commit" ? "b".repeat(40) : "a".repeat(40),
        );
        res.setHeader(
          "X-SCOP-Release",
          failure === "release" ? "e".repeat(64) : "c".repeat(64),
        );
        if (failure === "502") {
          res.writeHead(502);
          res.end("Bad Gateway");
          return;
        }
        if (failure === "wrong-status") {
          res.writeHead(302);
          res.end();
          return;
        }
        if (req.url === "/") {
          res.setHeader("Content-Type", "text/html");
          res.end(
            failure === "html"
              ? "not frontend"
              : "<html><body>synthetic</body></html>",
          );
        } else if (req.url === "/health") {
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              status: failure === "health" ? "unhealthy" : "✅ OK",
            }),
          );
        } else {
          res.writeHead(401);
          res.end("{}");
        }
      },
    );
    server.on("connection", (s) => {
      sockets.add(s);
      s.on("close", () => sockets.delete(s));
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const settings = {
      gateway: "127.0.0.1",
      port: server.address().port,
      hostname: "staging.example.invalid",
      ca: read("ca.crt"),
      cert: read("client.crt"),
      key: read("client.key"),
      commit: "a".repeat(40),
      release: "c".repeat(64),
    };
    await t.test(
      "valid listener proves HTML, health, protected API and release identity",
      async () => {
        const r = await gatewayProbe(settings);
        assert.equal(r.status, "GATEWAY_HTTPS_MTLS_VERIFIED");
        assert.equal(requests, 3);
      },
    );
    for (const kind of [
      "502",
      "commit",
      "release",
      "html",
      "health",
      "wrong-status",
      "hang",
    ])
      await t.test(
        `local markers cannot authorize a broken edge: ${kind}`,
        async () => {
          failure = kind;
          await assert.rejects(gatewayProbe(settings));
          for (const s of sockets) s.destroy();
        },
      );
    failure = "none";
    for (const [label, change] of [
      ["hostname/SNI", { hostname: "wrong.example.invalid" }],
      ["untrusted CA", { ca: read("client.crt") }],
      ["missing mTLS", { cert: undefined, key: undefined }],
      ["wrong client key", { key: read("server.key") }],
    ])
      await t.test(label, async () => {
        await assert.rejects(gatewayProbe({ ...settings, ...change }));
      });
    plain = http.createServer((q, s) => s.end("plain HTTP"));
    await new Promise((r) => plain.listen(0, "127.0.0.1", r));
    await t.test("non-TLS listener", () =>
      assert.rejects(gatewayProbe({ ...settings, port: plain.address().port })),
    );
    const port = server.address().port;
    for (const s of sockets) s.destroy();
    await new Promise((r) => server.close(r));
    server = null;
    await t.test("ingress/listener unreachable", () =>
      assert.rejects(gatewayProbe({ ...settings, port })),
    );
  } finally {
    for (const s of sockets) s.destroy();
    if (server) await new Promise((r) => server.close(r));
    if (plain) await new Promise((r) => plain.close(r));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
