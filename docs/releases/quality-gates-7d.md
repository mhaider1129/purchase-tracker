# Release quality and manual operational acceptance — Task 7D

## Baseline and ownership

Reviewed master `df1f4b73` (merged 7C) and the 7A database-release gate, 7B RFID recovery and 7C transactional notification/audit controls. The existing workflow ran backend tests, an offline database plan, governance, RFID and P2P only, with backend path filters. There was no frontend check, complete business-regression matrix, tested build artifact or complete release manifest. No versioned Production Dockerfile, PM2 deployment recipe or automatic deployment workflow was found. Disposable PostgreSQL Docker runners are test infrastructure, not Production images.

The existing application verifies database/source/role compatibility before listening or starting jobs. `/health` is liveness after startup; it does not continuously revalidate database drift, financial balances or worker progress. Preserve that distinction during acceptance.

## Required check and trust boundary

`.github/workflows/release-quality.yml` runs on every PR, master push and manual workflow dispatch. There are no path filters, Production secrets, deployment environments, `pull_request_target`, automatic migrations, deployment, merge or tag/publish steps. Actions are pinned to immutable official revisions with read-only repository permissions and no persisted checkout credentials. Native jobs have independent disposable databases, bounded timeouts and `fail-fast: false` so one failure does not erase other evidence.

Configure the stable **Release quality gate** check as required in the repository ruleset/branch protection before treating it as a merge requirement. Coordinate replacement of the superseded `contract-and-regressions` requirement if present. The agent's integration received HTTP 403 when reading branch protection, so existing admin enforcement could not be verified or changed. CI blocks readiness artifacts on failure; it cannot prevent an administrator from deploying through an unrelated server procedure.

PR runs test GitHub's merge-candidate SHA. A deployable candidate must have a fresh passing run on the intended immutable release commit (for example the later master push), a matching manifest/build artifact and separate owner acceptance. PR success is not permission to merge or deploy.

## Gate inventory

The single command registry is `scripts/quality/gates.json`. The workflow's database matrix is checked against it by policy tests, preventing an accidentally omitted required suite.

| Group | Required checks |
| --- | --- |
| Backend | Entire Jest suite, all backend/quality JavaScript syntax, immutable migration history, offline locked-source/schema planning, quality-policy negative tests |
| Frontend | Entire Jest suite including critical workflows, ESLint with `--max-warnings=0`, English/Arabic key/type/interpolation/plural parity in both namespaces, source-to-interface catalogue coverage, `CI=true` production build |
| PostgreSQL | Full current SQL-plan/schema preservation runner; canonical P2P; contracts; contained legacy settlement; canonical contract finance; historical reconciliation; request workspace; medical-device demos; completion; receipt/technical acceptance/reporting; release governance; RFID; transactional events |

Authorization, segregation of duties, assignment, AUD-008 containment, AUD-009 clearance and item-writer boundaries remain mandatory in the entire backend suite and native domain tests. The corrected canonical writer scanner retains its existing allowlist and tests forbidden INSERT/UPDATE/DELETE mutations against real temporary files, including schema-qualified/quoted names.

All numbered and dated migrations already present in the comparison base are immutable: the history gate compares their actual bytes with the baseline inventory. PRs use the actual PR base SHA; master pushes use the previous master SHA; manual runs use the parent commit. Backend checkout fetches history for this check. New forward migrations can be added through the existing reviewed governance process; old migration SQL cannot be edited/deleted by updating the new lock file.

## Local reproduction

Use Node 22 LTS and locked `npm ci` installs in both applications. Docker must use a local daemon. Do not supply hosted database URLs or application secrets. From repository root:

```sh
node scripts/quality/release.cjs group backend
node scripts/quality/release.cjs group frontend
node scripts/quality/release.cjs gate governance
node scripts/quality/release.cjs gate events
# Run every other registered PostgreSQL gate, or the full sequential group:
node scripts/quality/release.cjs group postgres
node scripts/quality/release.cjs manifest --output release-artifacts/release-manifest.json
```

For an explicit local PR comparison, set `QUALITY_BASE_SHA` to the reviewed base commit. The history gate requires available Git history. A different Node major, dirty release inputs, mixed source versions or missing gates prevents `TEST_READY`; test success on an uncommitted working tree does not authorize a release. The unrelated local `.agents`/skills metadata is outside deployable inputs and is not part of this PR.

The runner forwards a small allowlist of tool/proxy/CA settings, removes application/PG/Supabase/SMTP credentials, forces `LIVE_ROUTING_ENABLED=false`, uses a blocked loopback fallback database and dry-run email, and supplies same-origin `/api` to every frontend API-base alias. The production build artifact therefore remains deployable behind the existing same-origin API proxy; it does not contain the unreachable CI fallback database/API host. SMTP unit tests use a fully mocked transporter and explicitly reset all dry-run aliases so safety flags cannot hide transporter assertions.

Every PostgreSQL command creates its own random-name/password, loopback-only PostgreSQL 16 container with the existing pinned image and validates the generated target before application imports. No runner accepts a hosted Development/Production target. All 7A/7B/7C migration execution is confined to those new disposable databases. The old schema-plan runner now applies the current reviewed forward structures before checking current backend queries; its report separates historical snapshot gaps from unresolved postflight/SQL-plan failures. CI reports go to ignored artifact directories rather than rewriting tracked audit evidence.

## Manifest and artifacts

The workflow uploads named evidence artifacts, the exact frontend `build/` and a `release-manifest` artifact. The aggregate job always evaluates required job outcomes, even when upstream work fails/skips. Missing/cancelled/failed evidence or artifact download yields a failed aggregate check and a blocked manifest where source/evidence can be read; it never produces a readiness declaration by ignoring missing jobs.

The generated manifest contains:

- Actual Git SHA, deployable/validation source digest, registry digest, exact per-gate Node version, backend/frontend package versions and CI run identity.
- Required database contract/digest, backend application-source manifest digest, all migration checksums/classifications, required migration prerequisites and worker protocol/source hashes.
- Test command, timestamps, result counts or completion markers, exit/signal status and byte-bound logs for every required gate. Empty/failed/skipped Jest and P2P results cannot pass via exit zero alone.
- The production build result and every tested artifact file's checksum/size, verified again after artifact download.
- The 16-domain smoke plan, deployment prerequisites and `PENDING_OWNER_ACCEPTANCE` with `productionDeploymentAuthorized: false`.

`TEST_READY` means reproducible CI/fixture readiness for that source. `BLOCKED` means no release readiness. Hosted compatibility always says `NOT_VERIFIED`, because CI must not connect to the live database. Artifact hashes detect accidental corruption/substitution; these are GitHub run artifacts, not an independently signed external attestation. Obtain them from the verified successful run rather than trusting a copied local JSON file. Keep the selected manifest, artifact hashes and acceptance record beyond CI artifact retention in the organization's release record.

## Manual release sequence

1. **Review database prerequisites.** Confirm the actual target identity, governed 069/070/071/072 receipts, current contract `hospital-erp-2026-11-scop1`, capability definitions, critical RLS/grants and worker versions. Review previous 7A–7C runbooks. CI's disposable database is not evidence of the hosted database state.
2. **Backup and recovery capability.** Preserve an approved database/files backup and demonstrate the approved restoration procedure in an isolated recovery environment. Record owner, backup time, recovery point and restoration evidence. Do not discover recovery failures during Production deployment.
3. **Apply approved additive migrations manually, if needed.** If changing schema/source attestation, use the approved maintenance window and prior runbooks to drain/stop incompatible writers and workers before manual SQL. Task 7D introduces no schema migration and edits no frozen SQL. Any missing earlier release must follow its original governed manual process. Never fabricate receipts, run a glob of historical SQL or use destructive down migrations. If a changed backend source digest needs a new attestation, use the reviewed existing governed bundle/process, not a new invented APPLIED row.
4. **Verify the actual database contract.** The authorized operator uses the existing read-only `db:verify` procedure with the actual restricted runtime identity and intended `APP_RELEASE_REF`/environment; require `DATABASE_READY`. Missing permission codes, invalid RLS, missing worker migration or incompatible functions blocks continuation. The agent/CI does not execute this hosted verification.
5. **Deploy a compatible backend manually.** Use the organization's established Hetzner/PM2 procedure and actual reviewed paths. Keep the restricted credential and the verified source binding. The runtime backend application-source digest is unchanged by 7D, so an already-approved identical backend can be retained with its valid release reference; do not claim a different reference was attested. A failed startup gate must leave listener/jobs stopped. Keep `LIVE_ROUTING_ENABLED=false` and V2 disabled.
6. **Deploy the compatible frontend manually.** Use the artifact from the same selected manifest; verify checksums, same-origin `/api` proxy, TLS, cache behavior and intended backend compatibility. Do not rebuild with an unreviewed environment and keep claiming the CI artifact hash.
7. **Verify background workers.** Check RFID claim/lease/retry/dead-letter visibility and notification in-app/external queues, heartbeats/leases and retry budgets. Process availability is not proof that jobs progress. Do not reset attempts or replay terminal work to make metrics appear healthy.
8. **Execute the smoke plan.** Use dedicated Development fixtures for approved writes. Production checks are non-mutating unless a separately approved controlled test exists. Record expected/actual behavior, role/institute, fixture IDs, correlation IDs and reviewer. Never record credentials or confidential payloads.
9. **Monitor errors and queues.** Review request error rates/500s, authorization denials, queue age, processing leases, permanent failures, duplicates requiring review and dead letters. `GET /api/notifications/operations` requires the existing explicit scoped diagnostic capability. SMTP acknowledgment ambiguity can still cause redelivery; no exactly-once claim is made.
10. **Obtain operational acceptance.** The owner reviews all evidence and signs the release decision. Keep service, physical-device, financial-control and stakeholder acceptance distinct from passing unit/native tests. No pipeline step grants Production deployment authority.

## Smoke tests

The executable manifest embeds `scripts/quality/smoke-plan.json`: authentication; request creation; approval routing; assignment; RFx; PO; GR; technical acceptance; warehouse fulfillment; contracts; AP posting; payment; RFID; audit; notifications; reporting. Each domain maps to required fixture gates and concrete Development/Production checks.

No live smoke request was executed by this task. A GET/export/report URL is not automatically non-mutating: some sourcing reports calculate persisted results and print/email endpoints can send messages. Confirm the handler's behavior before any live check. Do not create live payments, stock movements, approval decisions, RFID events or external test notifications without separate controlled-test authorization.

## Rollback strategy and stop conditions

- Stop release if any required gate, manifest check, hosted compatibility verification, worker check or operational acceptance fails. A healthy `/health` endpoint cannot override a failed gate.
- Before rollout, retain the previous approved backend/frontend pair, manifest, source/database attestations and restore-tested backups. Revert application artifacts only to a pair compatible with the installed additive schema and an existing valid source attestation; verify that compatibility before restarting.
- Stop new job claims during an approved rollback window and allow current transactions to finish. Abrupt failures rely on existing fenced leases/recovery. Preserve queues, attempt history, event identities and audit evidence.
- Do not drop newly added schema, erase audit/outbox history, reset sequences, rewrite historical financial values or run disabled `migrate:down`. Use an approved forward correction or an explicitly authorized canonical compensating business operation for financial/stock errors.
- A full database restoration is a separately approved recovery decision with established recovery-point consequences. It is not an automatic code rollback action.

## Limits

Repository branch rules and actual hosted infrastructure could not be verified with the integration's permissions. Physical RFID devices, real SMTP, Hetzner/PM2, actual hosted grants and recovery capability require owner acceptance. Existing test-console React/router/i18n warnings and dependency-data age advisories remain visible; strict ESLint/build gates do not suppress code warnings. Backend Jest uses its documented force-exit behavior after all assertions/results; native database tests close their pools and disposable resources normally. This is test readiness, not successful Production acceptance.

## SCOP Phase 1 extension

The PostgreSQL matrix now includes `scop-foundation`, which exercises the additive 072 contract, allocation concurrency/audit rollback, and existing canonical receiving/inspection/inventory regressions. Release checks also require the three `scop.allocations.*` permission definitions; no grants or feature activation are automatic. Follow the [Phase 1 manual migration and recovery instructions](../architecture/scop-phase1-foundation.md#manual-migration-and-recovery). Existing RFID/notification worker protocols remain unchanged.
