# Isolated staging rehearsal and activation

## Available now after merge

`Isolated staging rehearsal` automatically follows successful **master-push** `Release quality` runs. It can also be dispatched through GitHub Actions with a successful master CI run ID, on that exact commit. Dispatch A with CI artifacts B is rejected. No routine owner Git, SSH, file copy, mirror sync or database command is needed for these disposable rehearsals.

Two runtime jobs use pinned PostgreSQL 16 and 17 and the authenticated backend/frontend artifacts from that run. Sixteen transaction jobs preserve the existing canonical domain regression suites. Every job verifies the selected CI/checkout binding. Runtime jobs bootstrap an empty synthetic database, execute real prerequisite/forward bundles and verify SCOP1, runtime-role authority, RLS/grants, current receipts and release attestation. This evidence describes actual synthetic executions only; it never claims historical production migrations were executed.

The temporary administrative connection is loopback-only on a fresh Docker bridge, before application startup. It is closed and disconnected after preparation. Backend, frontend and database then have only an internal network. HTTP smoke runs inside the frontend container; no public preview is exposed. Backend/frontend use non-root, read-only images; generated credentials exist only in private temporary files/container environment. Temporary containers, networks and images are removed in `finally`; cleanup failure blocks the report. Abrupt host termination may interrupt cleanup: use ephemeral GitHub-hosted runners, never a shared production/self-hosted runner. Do not point Docker at a remote daemon.

Runtime evidence: `quality-results/staging/pg16.json` and `pg17.json`, uploaded as `isolated-runtime-pg<major>-attempt-<attempt>`. It binds commit, source digest, artifact metadata, image inputs, DB version/contract/findings, named smoke checks, rollback result and cleanup outcome. Transaction reports bind commit/source digest, command, outcomes and log hashes. GitHub artifact identity/digest and authenticated run metadata provide provenance; editing JSON locally does not create acceptance evidence. Retention is 30 days; expired evidence must be rerun.

Domain transactions cover successful procurement/P2P, approvals, receipt/warehouse, contracts, AP/payments, audit/outbox/RFID and SCOP behavior. HTTP smoke separately covers real startup, frontend proxy, login/me, invalid tokens, deactivated login and unauthenticated domain routes. Human browser workflow acceptance and foreign-institute HTTP testing remain additional external-staging acceptance requirements; existing canonical transaction tests cover institute isolation.

## GitHub configuration

- GitHub-hosted Ubuntu runners with local Docker and Python3; Node22 for fixture tools. No self-hosted/production runner labels.
- Read-only `contents` and `actions` token scopes; no environment, registry, cloud, SSH, Supabase or application secrets. Standard GitHub artifact download access only.
- Keep master protected and require existing code CI plus infrastructure/security tests. Add the rehearsal `readiness` check to release policy once it has actually run successfully on master; it is not a PR check because master CI artifacts are required.
- Keep `.github/workflows/staging-release.yml`, production workflows and repository-sync publisher hard stops unchanged. Merge does not activate external deployment or publishing.
- Actions logs/artifacts visible only to authorized repository reviewers; avoid uploading container environment, tokens or raw login responses.

## Separate external activation prerequisites

1. Approve a dedicated host/account/namespace, hostname/access control, resource budget, isolated PostgreSQL and synthetic-only dataset. No production restore, credentials, volumes or network routes. Select PG major/extensions from successful rehearsal evidence.
2. Implement and independently review a remote/persistent executor and isolated secret provisioning. This PR deliberately supplies no remote executor or remote target. Old `compose.yaml` remains a non-executable template; do not assume its internal-network port publishing provides an external preview.
3. Approve immutable image construction/registry provenance and runtime dependency/image vulnerability review. Rehearsal builds images from verified source/build payloads; those local image IDs do not authorize production delivery.
4. Create protected `scop-staging` and `scop-staging-acceptance` environments with independent reviewers/prevent-self-review, protected-branch restrictions and narrowly scoped staging-only credentials. Deny egress to production, SAP, SMTP and RFID services at the infrastructure layer.
5. Obtain explicit authorization for the staging-only database preparation. Keep manual-only SQL manual; never replay SQL073 or frozen history as an automatic staging upgrade. Synthetic fixture reconstruction is solely a disposable test, not an installer for persistent data.
6. Implement real deployment records binding tested source SHA, CI run/attempt, artifact IDs/digests and database-validation evidence; implement authenticated browser/UAT acceptance. Do not fabricate deployment statuses or relax the production selector to accept a dry run.
7. Test two actual release slots, traffic switch, worker ownership and failure recovery on isolated staging. Prove healthy previous service remains available before enabling any external executor.
8. In a separate reviewed activation PR, change the literal external hard stop only after all above evidence and owner authorization. Production remains disabled separately.

## Local development verification

Tests: `node --test scripts/staging/staging.test.cjs`. Local runtime development uses `node scripts/staging/rehearse.cjs 16 --local` (or 17) only after constructing local artifact inputs at ignored `release-artifacts/staging-input/{backend,frontend}`. The backend packager must match committed backend bytes. Local mode is explicitly synthetic/non-promotable and cannot activate a target; it ignores inherited application/DB secrets. CI input preparation is `node scripts/staging/prepare.cjs <master-ci-run-id>` using authenticated GitHub GETs and refuses an unrelated checkout.

## Verdict

**BLOCKED for external staging activation.** A passing disposable rehearsal establishes repeatable synthetic test readiness only. Dedicated external infrastructure, executor review, isolation controls, staging secrets, full browser/UAT and independent approval remain unprovided. No new production database migration is introduced by this infrastructure PR.
