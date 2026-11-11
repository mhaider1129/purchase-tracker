"use strict";
// Authenticated GitHub GETs only. No deployment/SSH/registry write permissions.
const fs = require("node:fs"),
  path = require("node:path"),
  { execFileSync } = require("node:child_process");
const { verifiedCi, sha } = require("./safety.cjs");
const selector = require("../devops/verify-production-selection.cjs");
const repo = "mhaider1129/purchase-tracker";
async function prepare(runId, out) {
  if (!/^[1-9][0-9]*$/.test(String(runId))) throw Error("CI_RUN_ID_REQUIRED");
  const api = (suffix) =>
    JSON.parse(
      execFileSync("gh", ["api", `/repos/${repo}${suffix}`], {
        maxBuffer: 4 * 1024 * 1024,
      }),
    );
  const run = api(`/actions/runs/${runId}`),
    jobs = api(`/actions/runs/${runId}/jobs?filter=latest&per_page=100`).jobs;
  const artifacts = api(
    `/actions/runs/${runId}/artifacts?per_page=100`,
  ).artifacts;
  const actual = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
  const preliminary = selector.ciEvidence(run, jobs, artifacts);
  const binding = selector.artifactEvidence(
    artifacts,
    `code-ci-manifest-attempt-${preliminary.attempt}`,
    run,
  );
  const manifest = await require("../devops/artifact-json.cjs").read(
    binding,
    "code-ci-manifest.json",
  );
  const selection = verifiedCi(run, jobs, artifacts, manifest, actual);
  const source = require("../quality/release.cjs").provenance();
  if (
    source.dirty ||
    source.sourceDigest !== manifest.sourceDigest ||
    source.gateConfigDigest !== manifest.gateConfigDigest
  )
    throw Error("CI_SOURCE_CONTENT_BINDING_INVALID");
  fs.mkdirSync(out, { recursive: true });
  for (const key of ["backend", "frontend"]) {
    const artifact = selection[key];
    const bytes = execFileSync(
      "gh",
      ["api", `/repos/${repo}/actions/artifacts/${artifact.id}/zip`],
      { maxBuffer: 128 * 1024 * 1024 },
    );
    if (`sha256:${sha(bytes)}` !== artifact.digest)
      throw Error("ARTIFACT_TRANSPORT_DIGEST_MISMATCH");
    const zip = path.join(out, `${key}.zip`);
    fs.writeFileSync(zip, bytes, { flag: "wx", mode: 0o600 });
    execFileSync(
      "python3",
      [path.join(__dirname, "unpack.py"), zip, path.join(out, key)],
      { stdio: "pipe" },
    );
    fs.unlinkSync(zip);
  }
  // Build bytes are authenticated by GitHub's immutable ZIP SHA-256, not by a
  // caller-supplied digest or the run head alone. Bind their extracted tree too.
  const frontendFiles = require("./safety.cjs").files(
    path.join(out, "frontend"),
  );
  fs.writeFileSync(
    path.join(out, "candidate.json"),
    JSON.stringify({ selection, manifest, frontendFiles }, null, 2),
  );
  return selection;
}
if (require.main === module)
  prepare(process.argv[2], path.resolve("release-artifacts/staging-input"))
    .then((s) => console.log(JSON.stringify(s)))
    .catch((e) => {
      console.error(e.message);
      process.exitCode = 1;
    });
module.exports = { prepare };
