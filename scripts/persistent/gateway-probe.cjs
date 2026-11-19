"use strict";
// Self-contained so the identical implementation can execute in an isolated
// short-lived probe container. Credentials arrive over stdin, never argv/logs.
async function gatewayProbe(options) {
  const https = require("node:https");
  const assert = (ok) => {
    if (!ok) throw Error("GATEWAY_END_TO_END_VERIFICATION_FAILED");
  };
  assert(
    /^[a-f0-9]{40}$/.test(options.commit) &&
      /^[a-f0-9]{64}$/.test(options.release),
  );
  const request = (path) =>
    new Promise((resolve, reject) => {
      const r = https.request(
        {
          hostname: options.gateway,
          port: options.port || 443,
          servername: options.hostname,
          headers: { Host: options.hostname },
          ca: options.ca,
          cert: options.cert,
          key: options.key,
          rejectUnauthorized: true,
          method: "GET",
          path,
          signal: AbortSignal.timeout(4000),
        },
        (response) => {
          let body = "",
            bytes = 0;
          response.on("data", (chunk) => {
            bytes += chunk.length;
            if (bytes > 2 * 1024 * 1024) {
              response.destroy();
              reject(Error("GATEWAY_RESPONSE_LIMIT"));
            } else body += chunk.toString("utf8");
          });
          response.on("error", reject);
          response.on("aborted", () =>
            reject(Error("GATEWAY_RESPONSE_ABORTED")),
          );
          response.on("end", () =>
            resolve({
              status: response.statusCode,
              headers: response.headers,
              body,
            }),
          );
        },
      );
      r.on("error", reject);
      r.end();
    });
  for (const path of ["/", "/health", "/api/auth/me"]) {
    const r = await request(path);
    assert(
      r.headers["x-scop-commit"] === options.commit &&
        r.headers["x-scop-release"] === options.release,
    );
    assert(r.status === (path === "/api/auth/me" ? 401 : 200));
    if (path === "/")
      assert(
        /text\/html/i.test(r.headers["content-type"] || "") &&
          /<html[\s>]/i.test(r.body),
      );
    if (path === "/health") assert(JSON.parse(r.body).status === "✅ OK");
  }
  return {
    status: "GATEWAY_HTTPS_MTLS_VERIFIED",
    commit: options.commit,
    release: options.release,
  };
}
module.exports = { gatewayProbe };
