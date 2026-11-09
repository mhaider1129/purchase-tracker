# Controlled production release — definitions only

The Actions workflow is named **Deploy to Production**. Production execution is hard disabled in `production-release.yml`; its read-only GitHub metadata preflight selects immutable tested artifacts and genuine matching staging/DB evidence before an environment-gated job. The placeholder exits with failure if its hard stop is accidentally removed. The audit found no GitHub environments and unprotected default branches; required reviewers are not currently established. No input boolean or local JSON assertion replaces enforced approval. `release-plan.cjs` is an offline missing-prerequisite checklist and always returns executionEnabled=false / productionDeploymentAuthorized=false, even when every assertion is true.

## Go/no-go prerequisites

Require all of the following for the exact immutable candidate:

- Reviewed source in the combined authority and reconciled destination branches; required CI jobs passed, with nonempty tests and no skipped mandatory evidence.
- Full disposable database suite evidence, valid raw source/SQL inventory, generated-bundle reproducibility and a complete existing quality manifest. CODE_TEST_READY alone is insufficient.
- Successful deployment to an explicitly approved isolated staging target, smoke tests and owner UAT acceptance bound to the same artifact digest/source SHA.
- Current genuine production schema/runtime-role compatibility evidence under separately authorized access. The isolated PG17/hosted reconciliation remains unresolved; never treat fewer findings as readiness.
- Verified backup and tested recovery capability with retention/access authorization; no destructive database rollback assumption.
- GitHub plan support, configured production environment required reviewers, no self-approval where supported, protection against administrative bypass, restricted protected release refs and least-privilege credentials. A second reviewer should verify settings before enabling any executor.
- Explicit production operation and cutover authorization, maintenance/monitoring plan, rollback owner and readiness checklist.

If any evidence is missing, stale, wrong-SHA, unverifiable or failed, stop. Application-only changes still need compatibility with the current database; they do not automatically require or authorize migrations. Production migration is a separate disabled workflow and distinct approval operation.

## Future executor requirements (not implemented here)

Deploy a previously tested immutable artifact into a new candidate release directory, validate its digest/provenance and use an allowlisted target. Never build a different artifact on the server or directly replace a running recovery process. Do not use /opt/wici-recovery, the recovery entrypoint, port 5051, current PM2 process names or active /api routing as automation targets. The historical /var/www layout is not permission to write there.

Preserve the recovery application, process, routing, backups and snapshots until a separately approved cutover. Health checks, version compatibility, authentication and critical workflow smoke checks must pass before any traffic decision. Nginx/PM2/firewall/systemd changes need their own explicit reviewed authorization; this assignment provides no commands that perform them.

Record deployment actor/approval, source SHA, artifact digest, prior release, DB contract/evidence, start/finish time, health/smoke results and rollback outcome. Monitor errors, worker heartbeats, outbox retries/dead letters and financial/stock invariants. Operational acceptance is a final human decision, not automatic merge or deployment.

## Current owner decisions

Approve staging and reviewer enforcement; finish production DB reconciliation; decide the immutable artifact/image builder and registry; select bounded deployment credentials/target allowlists; reconcile standalone recovery branches; verify backup and recovery. No settings, credentials or live services were changed by this implementation.

See [09-zero-command-activation.md](09-zero-command-activation.md) for the owner UI sequence, exact evidence contract and one-time activation checklist. No arbitrary branch/source or URL can be selected. GitHub metadata checks do not replace separately authorized live DB compatibility and backup/recovery acceptance.
