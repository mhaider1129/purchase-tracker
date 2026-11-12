"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const policy = require("../../deploy/staging/policy.json");
const sha = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
function environment(input = process.env) {
  const result = {};
  for (const key of [
    "PATH",
    "HOME",
    "TMPDIR",
    "SYSTEMROOT",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "NO_PROXY",
    "http_proxy",
    "https_proxy",
    "no_proxy",
    "NODE_EXTRA_CA_CERTS",
    "CODEX_PROXY_CERT",
  ])
    if (input[key]) result[key] = input[key];
  return result;
}
function stopped() {
  if (
    policy.externalStagingEnabled !== false ||
    policy.productionEnabled !== false ||
    policy.syntheticOnly !== true
  )
    throw Error("EXTERNAL_ACTIVATION_NOT_IMPLEMENTED_OR_AUTHORIZED");
}
function files(root, prefix = "") {
  return fs
    .readdirSync(path.join(root, prefix))
    .sort()
    .flatMap((name) => {
      const p = prefix ? `${prefix}/${name}` : name;
      const stat = fs.lstatSync(path.join(root, p));
      if (stat.isSymbolicLink()) throw Error("PAYLOAD_SYMLINK_REJECTED");
      return stat.isDirectory()
        ? files(root, p)
        : [
            {
              path: p,
              sha256: sha(fs.readFileSync(path.join(root, p))),
              bytes: stat.size,
            },
          ];
    })
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}
function verifyBackend(root, commit) {
  const m = JSON.parse(
    fs.readFileSync(path.join(root, "release-source-manifest.json")),
  );
  if (
    m.kind !== "backend-source-release" ||
    m.commit !== commit ||
    m.version !== 1 ||
    m.payloadSha256 !== sha(JSON.stringify(m.files))
  )
    throw Error("BACKEND_MANIFEST_BINDING_INVALID");
  const observed = files(root).filter(
    (f) => f.path !== "release-source-manifest.json",
  );
  const expected = m.files.map(({ path, sha256, bytes }) => ({
    path,
    sha256,
    bytes,
  }));
  if (JSON.stringify(observed) !== JSON.stringify(expected))
    throw Error("BACKEND_PAYLOAD_CHANGED");
  if (
    observed.some((f) =>
      /(?:^|\/)\.env(?:\.|$)|(?:^|\/)(?:uploads|private-uploads|node_modules)\//.test(
        f.path,
      ),
    )
  )
    throw Error("LOCAL_FILES_IN_PAYLOAD");
  return m.payloadSha256;
}
function verifiedCi(run, jobs, artifacts, manifest, actual) {
  const select =
    require("../devops/verify-production-selection.cjs").ciEvidence(
      run,
      jobs,
      artifacts,
    );
  if (
    actual !== select.commit ||
    manifest.kind !== "scop-code-ci" ||
    manifest.version !== 1 ||
    manifest.status !== "CODE_TEST_READY" ||
    manifest.gitCommit !== actual ||
    manifest.ciRunId !== String(run.id) ||
    manifest.ciRunAttempt !== String(select.attempt) ||
    manifest.dirty !== false ||
    manifest.liveRoutingEnabled !== false ||
    manifest.failures?.length !== 0 ||
    manifest.artifacts?.backend !== String(select.backend.id) ||
    manifest.artifacts?.frontend !== String(select.frontend.id) ||
    !/^[a-f0-9]{64}$/.test(manifest.sourceDigest || "") ||
    !/^[a-f0-9]{64}$/.test(manifest.gateConfigDigest || "") ||
    !Number.isFinite(Date.parse(run.updated_at)) ||
    Date.now() - Date.parse(run.updated_at) >
      policy.maxArtifactAgeDays * 86400000 ||
    Date.parse(run.updated_at) > Date.now() + 60000
  )
    throw Error("UNVERIFIED_STAGING_CANDIDATE");
  return select;
}
module.exports = {
  environment,
  stopped,
  files,
  sha,
  verifyBackend,
  verifiedCi,
};
