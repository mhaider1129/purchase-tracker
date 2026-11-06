# AUD-012 — RFID worker crash recovery (Task 7B)

## Verified root cause and scope

Reviewed current master **68c36468**, including the merged Task 7A governance implementation. Discovered SQL **069** as the highest existing migration; this task adds **070** without modifying frozen SQL 001–069.

The finding is confirmed. The old processor committed PROCESSING claims before processing reads and selected only PENDING/FAILED on subsequent runs, leaving no recovery for crash-stranded claims. Its manual endpoint selected work globally rather than restricting execution to the authenticated institute. It had no durable lease, heartbeat, scheduled recovery or retry backoff, and could expose raw processing-error text through read listings.

See [the architecture, authorization matrix and rollout runbook](../../purchase-backend/docs/rfid-crash-recovery-7b.md) for the full current workflow inventory. Reader ingestion is synchronous and atomic per upload; interpretation is asynchronous and atomic per read. Asset assignment/movement, inventory count/reconciliation and stock posting remain separate canonical services. No second stock or inspection mechanism was introduced.

## Implementation

Reuse raw RFID reads as the durable queue. Claim one read just before processing with `FOR UPDATE SKIP LOCKED`, UUID fencing, a 60-second lease and a durable attempt/audit record. Processing commits the business observation, exception, completion audit, final job state and attempt outcome atomically. An expired worker token cannot overwrite a later success, including after an uncertain COMMIT acknowledgement.

This is checkpointed batch processing with an atomic transaction per read. Committed reads are never reapplied; uncommitted work rolls back and resumes independently. PostgreSQL timestamps, row locks and 3/10/15-second lock/statement/idle-transaction timeouts protect the short database-only operation. Heartbeat is recorded at claim/start/completion; no external I/O runs in the processing transaction.

Preserve five attempts with durable exponential backoff and a visible DEAD_LETTER state. Reclaim expired PROCESSING jobs, including legacy rows without a fabricated historical lease. Final-attempt crashes become terminal rather than permanently PROCESSING. Already-linked inconsistent evidence is contained for explicit investigation. Finalized attempt history is immutable and non-deletable; grants exclude runtime TRUNCATE and sequence reset.

New uploads use client-scoped stable source identity. Existing external IDs remain authoritative and distinct; contradictory reuse returns 409. Uploads without IDs use normalized reader/antenna/portal/EPC/TID/timestamp/type/RSSI fingerprints. Historical source fingerprints and raw outcomes are not backfilled. Source identity never authorizes stock identity from EPC alone.

The worker starts after Task 7A's release gate, polls every five seconds and stops claiming on shutdown. Manual processing, recovery and visibility use the existing infrastructure capability, active-user checks and authenticated institute context. Every execution rechecks original integration-client authority, reader/location ownership and asset/tag identity. Unsupported warehouse/count-session authority selectors are rejected; this processor has no warehouse stock mutation role.

Infrastructure managers receive a queue panel on the existing RFID event monitor plus scoped list/history/recovery endpoints. Recovery requires a reason, preserves retry limits and cannot steal live leases or replay completed/terminal outcomes. Responses expose categories and timestamps rather than internal stack traces, lease tokens or credentials.

RFID processing still emits no notifications. The existing canonical notification outbox remains the delivery owner; integration tests exercise its rollback/retry idempotency alongside RFID retries rather than adding a new notification mechanism.

## Task 7A integration and database requirements

**MANUAL DATABASE MIGRATION REQUIRED:**

`purchase-backend/sql/manual/070_rfid_processing_recovery.sql`

Use the generated, reviewed, environment-specific bundle. SQL 069 is frozen and required as an actual same-environment APPLIED receipt with the correct filename/checksum. The saved 7A prerequisite contract supports actual prior/target preflight without inferring execution from schema appearance. The runtime gate requires both governed receipts and a current 7B schema/source attestation. Only real transactional forward execution creates a successful 070 receipt.

The locked inventory now covers **101 SQL artifacts and 431 source/package artifacts**. The 7B schema contract includes **260 relations, 3,533 columns, 1,507 constraints, 690 indexes, 216 routines and 25 triggers**, along with the existing capability, UI, RLS and privilege checks. No automatic hosted migration runner or frozen replay was added. The disposable fixture explicitly executes 069 to establish its prerequisite on a runner-owned test database; that helper is unreachable from runtime and the release CLI.

The runbook covers owner review, backup, maintenance-window stop, exact-source offline bundle generation, manual Development SQL Editor execution, restricted credentials, new APP_RELEASE_REF, read-only verification and manual startup. Hosted compatibility and execution history remain unverified.

## Tests and reproduced failure scenarios

| Executed command | Result |
| --- | --- |
| Backend `npm test -- --runInBand` | PASS: 227 suites, 1,897 tests |
| `npm run test:rfid-recovery-postgres` | PASS: 28 real disposable PostgreSQL scenarios |
| `npm run test:database-governance-postgres` | PASS: 28 locked-contract PostgreSQL scenarios, no automatic capture |
| `npm run test:p2p-postgres` | PASS: 92 PostgreSQL tests |
| Frontend targeted RFID/fixed-assets tests | PASS: 2 suites, 11 tests |
| Frontend `CI=false npm run build` | PASS, with two existing unrelated lint warnings |
| Offline `db:plan`, locked-artifact verification, changed JavaScript syntax and `git diff --check` | PASS |

The build warnings are the existing unused `actionLoading` in `DepartmentRequestedItemsBoard.jsx` and missing hook dependency in `PhysicalInventory.jsx`; neither file was changed. React Router/i18next test setup warnings are likewise unrelated to the recovery behavior.

The PostgreSQL suite covers all requested cases: normal processing; duplicate uploads; concurrent workers; crash after claim; disconnect before commit; lost acknowledgement after commit; expiry; active lease/row-lock protection; retry exhaustion; partial batch failure; scheduler restart/shutdown; actual `pg_terminate_backend` interruption; foreign institute; unsupported warehouse authority; unauthorized/inactive operators; duplicate EPC reads; asset ownership mismatch; audit rollback; notification retry; and populated inventory/asset/count/custody preservation. An additional evidence-context case ensures invalid neighboring reads and incompatible historical aggregates cannot influence or absorb a valid observation. Additional cases verify explicit recovery idempotency, stale-token rejection, immutable history, final-attempt crashes, inconsistent foreign-reader references, containment of previously linked evidence and actual non-owner backend execution.

No hosted or Production URL is selected by the test runners. All database instances use generated loopback-only targets and disposable credentials. Local test databases may contain synthetic failure/history fixtures; no historical hosted RFID data was rewritten.

## Remaining risks and manual acceptance

- No physical readers, vendor gateways, hosted schema/grants, Production PM2 behavior or live deployment were tested. Owner Development acceptance remains required.
- A healthy worker and database must be running for recovery; lease expiry is not an external outage alert. Hardware/event-retention policy is unchanged.
- Gateways without stable external IDs retain ambiguity for truly identical measurement tuples; milliseconds remain the existing timestamp precision. Supply stable external event IDs where available.
- Terminal identity/authority/evidence conflicts and uncertain historical links require investigation and a separately approved reconciliation. There is no automatic exhausted-budget reset or historical replay.
- The model is deliberately short, per-read and database-only. Adding vendor I/O or long-running batch work would require a reviewed heartbeat/checkpoint design.
- Database-owner access remains trusted. Preserve backups and external bundle/review/execution evidence, as required by Task 7A.

`LIVE_ROUTING_ENABLED=false` remains unchanged. No hosted SQL, deployment, merge, clinical/financial/inventory backfill, direct asset assignment or approval bypass occurred.

## Exact changed files

- `.github/workflows/database-release-governance.yml`
- `docs/audits/2026-11-aud012-remediation.md`
- `purchase-backend/__tests__/fixedAssetsRfidCore.test.js`
- `purchase-backend/__tests__/rfidRecovery.test.js`
- `purchase-backend/app.js`
- `purchase-backend/controllers/rfidController.js`
- `purchase-backend/database/releases/migration-inventory.json`
- `purchase-backend/database/releases/prerequisites/069-schema-contract.json`
- `purchase-backend/database/releases/schema-contract.json`
- `purchase-backend/docs/architecture/fixed-assets-rfid.md`
- `purchase-backend/docs/database-release-governance-7a.md`
- `purchase-backend/docs/rfid-crash-recovery-7b.md`
- `purchase-backend/domain/rfidObservationIdentity.js`
- `purchase-backend/integration/databaseGovernance.postgres.js`
- `purchase-backend/integration/databaseReleasePrerequisite.js`
- `purchase-backend/integration/rfidRecovery.postgres.js`
- `purchase-backend/jobs/rfidWorker.js`
- `purchase-backend/package.json`
- `purchase-backend/routes/rfid.js`
- `purchase-backend/scripts/lib/databaseRelease/inventory.js`
- `purchase-backend/scripts/lib/databaseRelease/planner.js`
- `purchase-backend/scripts/testBackendContractRefresh.js`
- `purchase-backend/services/databaseReleaseService.js`
- `purchase-backend/services/rfidEventProcessor.js`
- `purchase-backend/services/rfidJobService.js`
- `purchase-backend/services/rfidProcessingPolicy.js`
- `purchase-backend/services/rfidService.js`
- `purchase-backend/sql/manual/070_rfid_processing_recovery.sql`
- `purchase-backend/tests/databaseReleaseGovernance.test.js`
- `purchase-frontend/src/api/fixedAssets.js`
- `purchase-frontend/src/pages/fixed-assets/RfidJobQueue.jsx`
- `purchase-frontend/src/pages/fixed-assets/RfidJobQueue.test.jsx`
- `purchase-frontend/src/pages/fixed-assets/RfidOperations.jsx`
