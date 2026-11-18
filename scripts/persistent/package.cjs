"use strict";
// Request artifact only. This script has no remote Docker/SSH/deployment target.
const fs = require("node:fs"),
  path = require("node:path"),
  { execFileSync } = require("node:child_process");
const { assert, sha } = require("./core.cjs"),
  { environment } = require("../staging/safety.cjs");
async function main() {
  assert(
    process.env.GITHUB_REF === "refs/heads/master" &&
      process.env.GITHUB_REPOSITORY === "mhaider1129/purchase-tracker",
    "MASTER_CONTROL_PLANE_REQUIRED",
  );
  const operation = process.env.STAGING_OPERATION || "deploy";
  assert(
    ["deploy", "rollback", "recover"].includes(operation),
    "UNSUPPORTED_OPERATION",
  );
  const request = {
    runId: process.env.GITHUB_RUN_ID,
    attempt: process.env.GITHUB_RUN_ATTEMPT,
    workflowCommit: process.env.GITHUB_SHA,
  };
  const out = path.resolve("release-artifacts/persistent-request");
  fs.mkdirSync(out, { recursive: true });
  if (operation !== "deploy") {
    assert(
      /^[a-f0-9]{40}$/.test(process.env.PREVIOUS_COMMIT || ""),
      "EXACT_PRESERVED_COMMIT_REQUIRED",
    );
    fs.writeFileSync(
      path.join(out, "capsule.json"),
      JSON.stringify({
        kind: "wici-staging-request",
        version: 1,
        operation,
        commit: process.env.PREVIOUS_COMMIT,
        request,
        productionAuthorized: false,
      }),
    );
    return;
  }
  const selection = await require("../staging/prepare.cjs").prepare(
    process.env.SOURCE_CI_RUN,
    path.resolve("release-artifacts/staging-input"),
  );
  const rehearsal = await require("./rehearsal.cjs").ghVerify(
    process.env.REHEARSAL_RUN,
    selection,
  );
  const inputManifest = JSON.parse(
    fs.readFileSync("release-artifacts/staging-input/candidate.json"),
  );
  const gateway = await require("./rehearsal.cjs").ghGateway(
    selection,
    inputManifest.manifest.sourceDigest,
  );
  // The child rehearsal strips inherited credentials; this CLI owns only a
  // read-only GitHub token while preparing metadata, never staging credentials.
  process.env = { ...environment(), GITHUB_ACTIONS: "true" };
  const report = await require("../staging/rehearse.cjs").run({
    input: path.resolve("release-artifacts/staging-input"),
    major: "16",
    onVerified: async (r) => {
      const docker = (...args) =>
        execFileSync(
          "docker",
          ["--host=unix:///var/run/docker.sock", ...args],
          { env: environment(), maxBuffer: 2 * 1024 * 1024 },
        );
      const tags = [
        `scop-capsule-backend:${r.commit}`,
        `scop-capsule-frontend:${r.commit}`,
      ];
      try {
        docker("tag", r.images.backend, tags[0]);
        docker("tag", r.images.frontend, tags[1]);
        const tar = path.join(out, "images.tar");
        docker("save", "--output", tar, ...tags);
        execFileSync("gzip", ["-n", tar], { env: environment() });
      } finally {
        for (const tag of tags)
          try {
            docker("image", "rm", tag);
          } catch {
            /* tagged copies only; runner removes tested images */
          }
      }
    },
  });
  const imageFile = path.join(out, "images.tar.gz");
  const hash = require("node:crypto").createHash("sha256");
  for await (const chunk of fs.createReadStream(imageFile)) hash.update(chunk);
  const result = {
    kind: "wici-staging-capsule",
    version: 1,
    operation,
    commit: selection.commit,
    sourceCi: selection,
    rehearsal,
    gateway,
    request,
    images: report.images,
    archiveSha256: hash.digest("hex"),
    runtimeVerified: report,
    databaseContract: require("../../deploy/persistent/policy.json")
      .databaseContract,
    syntheticOnly: true,
    productionAuthorized: false,
  };
  require("./core.cjs").capsule(result);
  fs.writeFileSync(
    path.join(out, "capsule.json"),
    JSON.stringify(result, null, 2),
  );
  console.log("APPROVED_REQUEST_PACKAGED_NOT_DEPLOYED");
}
if (require.main === module)
  main().catch((e) => {
    console.error("STAGING_REQUEST_BLOCKED", e.code || e.name);
    process.exitCode = 1;
  });
module.exports = { main };
