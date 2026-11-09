#!/usr/bin/env node
"use strict";
// GitHub metadata GETs only. Never reads a deployment target or database URL.
const fs = require("node:fs"),
  path = require("node:path");
const repo = "mhaider1129/purchase-tracker",
  branch = "master";
const requiredCi = [
  "backend",
  "frontend",
  "security",
  "sync-dry-run",
  "Code CI gate (not deployment approval)",
  ...["ubuntu-latest", "windows-latest"].flatMap((os) =>
    ["20", "22"].map((n) => `integrity (${os}, ${n})`),
  ),
];
const requiredStage = [
  "stage-deploy",
  "stage-smoke",
  "database-compatibility",
  "owner-uat-acceptance",
];
function number(value) {
  if (
    !/^[1-9][0-9]*$/.test(String(value)) ||
    !Number.isSafeInteger(Number(value))
  )
    throw Error("POSITIVE_GITHUB_ID_REQUIRED");
  return Number(value);
}
function runEvidence(run, workflow, events) {
  if (
    run.status !== "completed" ||
    run.conclusion !== "success" ||
    run.path !== workflow ||
    run.head_branch !== branch ||
    run.repository?.full_name !== repo ||
    run.head_repository?.full_name !== repo ||
    !events.includes(run.event) ||
    !/^[a-f0-9]{40}$/.test(run.head_sha || "")
  )
    throw Error("UNVERIFIED_OR_UNTRUSTED_WORKFLOW_RUN");
  return run;
}
function jobsEvidence(jobs, names) {
  for (const name of names) {
    const found = jobs.filter((j) => j.name === name);
    if (
      found.length !== 1 ||
      found[0].status !== "completed" ||
      found[0].conclusion !== "success"
    )
      throw Error("MANDATORY_JOB_NOT_SUCCESSFUL: " + name);
  }
}
function artifactEvidence(artifacts, name, run) {
  const found = artifacts.filter((a) => a.name === name);
  if (found.length !== 1)
    throw Error("MISSING_OR_AMBIGUOUS_TESTED_ARTIFACT: " + name);
  const a = found[0];
  number(a.id);
  if (
    a.expired !== false ||
    !/^sha256:[a-f0-9]{64}$/.test(a.digest || "") ||
    a.workflow_run?.id !== run.id ||
    a.workflow_run?.head_sha !== run.head_sha
  )
    throw Error("ARTIFACT_PROVENANCE_OR_DIGEST_INVALID");
  return { id: a.id, name: a.name, digest: a.digest };
}
function environmentEvidence(environment) {
  const reviews = environment.protection_rules?.find(
    (r) => r.type === "required_reviewers",
  );
  if (
    !reviews?.reviewers?.length ||
    reviews.prevent_self_review !== true ||
    environment.deployment_branch_policy?.protected_branches !== true
  )
    throw Error("REQUIRED_ENVIRONMENT_APPROVAL_NOT_ENFORCED");
}
function ciEvidence(run, jobs, artifacts) {
  runEvidence(run, ".github/workflows/release-quality.yml", ["push"]);
  jobsEvidence(jobs, requiredCi);
  return {
    runId: run.id,
    commit: run.head_sha,
    backend: artifactEvidence(artifacts, "backend-release", run),
    frontend: artifactEvidence(artifacts, "frontend-build", run),
  };
}
function stageEvidence(stage, jobs, selection) {
  runEvidence(stage, ".github/workflows/staging-release.yml", [
    "workflow_dispatch",
    "workflow_run",
  ]);
  if (stage.head_sha !== selection.commit)
    throw Error("STAGING_COMMIT_DOES_NOT_MATCH_TESTED_CANDIDATE");
  jobsEvidence(jobs, requiredStage);
}
function deploymentEvidence(deployment, status, selection, stageRunId) {
  const p = deployment.payload;
  if (
    deployment.environment !== "scop-staging" ||
    deployment.production_environment !== false ||
    deployment.sha !== selection.commit ||
    deployment.creator?.login !== "github-actions[bot]" ||
    !p ||
    p.commit_sha !== selection.commit ||
    p.source_ci_run_id !== selection.runId ||
    p.staging_run_id !== stageRunId ||
    p.backend_artifact_id !== selection.backend.id ||
    p.backend_artifact_digest !== selection.backend.digest ||
    p.frontend_artifact_id !== selection.frontend.id ||
    p.frontend_artifact_digest !== selection.frontend.digest
  )
    throw Error("STAGING_DEPLOYMENT_NOT_BOUND_TO_TESTED_ARTIFACTS");
  if (
    status?.state !== "success" ||
    status.creator?.login !== "github-actions[bot]" ||
    status.log_url !== `https://github.com/${repo}/actions/runs/${stageRunId}`
  )
    throw Error("STAGING_DEPLOYMENT_NOT_CURRENTLY_SUCCESSFUL");
  return number(p.database_validation_run_id);
}
async function collect(api, ciId, stageId) {
  ciId = number(ciId);
  stageId = number(stageId);
  const ci = await api(`/actions/runs/${ciId}`),
    stage = await api(`/actions/runs/${stageId}`);
  const selection = ciEvidence(
    ci,
    await api(`/actions/runs/${ciId}/jobs?filter=latest&per_page=100`, "jobs"),
    await api(`/actions/runs/${ciId}/artifacts?per_page=100`, "artifacts"),
  );
  stageEvidence(
    stage,
    await api(
      `/actions/runs/${stageId}/jobs?filter=latest&per_page=100`,
      "jobs",
    ),
    selection,
  );
  const protectedBranch = await api(`/branches/${branch}`);
  if (protectedBranch.protected !== true)
    throw Error("PROTECTED_RELEASE_BRANCH_REQUIRED");
  environmentEvidence(await api("/environments/scop-production"));
  environmentEvidence(await api("/environments/scop-staging-acceptance"));
  const deployments = await api(
    `/deployments?sha=${selection.commit}&environment=scop-staging&per_page=100`,
  );
  const matches = deployments.filter(
    (d) =>
      d.payload?.source_ci_run_id === ciId &&
      d.payload?.staging_run_id === stageId,
  );
  if (matches.length !== 1)
    throw Error("GENUINE_UNAMBIGUOUS_STAGING_DEPLOYMENT_REQUIRED");
  const deployment = matches[0],
    statuses = await api(
      `/deployments/${number(deployment.id)}/statuses?per_page=100`,
    );
  const dbId = deploymentEvidence(deployment, statuses[0], selection, stageId),
    db = await api(`/actions/runs/${dbId}`);
  runEvidence(db, ".github/workflows/isolated-database-validation.yml", [
    "workflow_dispatch",
  ]);
  if (db.head_sha !== selection.commit)
    throw Error("DATABASE_VALIDATION_COMMIT_MISMATCH");
  const gates = require("../quality/gates.json")
    .gates.filter((g) => g.group === "postgres")
    .map((g) => `postgres (${g.id})`);
  jobsEvidence(
    await api(`/actions/runs/${dbId}/jobs?filter=latest&per_page=100`, "jobs"),
    gates,
  );
  return {
    kind: "verified-production-selection",
    version: 1,
    ...selection,
    stagingRunId: stageId,
    stagingDeploymentId: deployment.id,
    databaseValidationRunId: dbId,
    environment: "scop-production",
    status: "AWAITING_PRODUCTION_ENVIRONMENT_APPROVAL",
    operationalAcceptance:
      "Production DB compatibility, verified backup/recovery and the executor require separate approval; GitHub selection is not live verification",
    productionDeploymentAuthorized: false,
    executionEnabled: false,
  };
}
async function main() {
  if (
    process.env.GITHUB_REPOSITORY !== repo ||
    process.env.GITHUB_REF !== "refs/heads/master"
  )
    throw Error("TRUSTED_DEFAULT_BRANCH_CONTROL_PLANE_REQUIRED");
  const token = process.env.GH_TOKEN;
  if (!token) throw Error("READ_ONLY_GITHUB_TOKEN_REQUIRED");
  async function api(route, key) {
    const result = [];
    for (let page = 1; page <= 10; page++) {
      const suffix = route.includes("per_page=") ? `&page=${page}` : "";
      const response = await fetch(
        `https://api.github.com/repos/${repo}${route}${suffix}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
          redirect: "error",
          signal: AbortSignal.timeout(30000),
        },
      );
      if (!response.ok)
        throw Error("GITHUB_EVIDENCE_READ_FAILED: " + response.status);
      const body = await response.json();
      if (!route.includes("per_page=")) return body;
      const rows = key ? body[key] : body;
      if (!Array.isArray(rows)) throw Error("INVALID_GITHUB_EVIDENCE_SHAPE");
      result.push(...rows);
      if (rows.length < 100) return result;
    }
    throw Error("GITHUB_EVIDENCE_PAGINATION_LIMIT");
  }
  const selected = await collect(
    api,
    process.env.SELECTED_CI_RUN_ID,
    process.env.SELECTED_STAGING_RUN_ID,
  );
  fs.mkdirSync("release-selection", { recursive: true });
  fs.writeFileSync(
    "release-selection/selection.json",
    JSON.stringify(selected, null, 2) + "\n",
    { flag: "wx" },
  );
  if (process.env.GITHUB_OUTPUT)
    for (const [key, value] of Object.entries({
      commit_sha: selected.commit,
      ci_run_id: selected.runId,
      backend_artifact_id: selected.backend.id,
      backend_artifact_digest: selected.backend.digest,
      frontend_artifact_id: selected.frontend.id,
      frontend_artifact_digest: selected.frontend.digest,
    })) {
      if (!/^(?:[a-f0-9]+|sha256:[a-f0-9]{64})$/.test(String(value)))
        throw Error("UNSAFE_SELECTION_OUTPUT");
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
    }
  console.log(
    "Verified immutable candidate metadata; production execution remains disabled.",
  );
}
if (require.main === module)
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
module.exports = {
  number,
  runEvidence,
  jobsEvidence,
  artifactEvidence,
  environmentEvidence,
  ciEvidence,
  stageEvidence,
  deploymentEvidence,
  collect,
  requiredCi,
  requiredStage,
  repo,
};
