# AUD-010 — Database governance and migration hardening (Task 7A)

## Verified finding

Reviewed master `3aecb532` through Batches 1–6. Existing highest migration: **068**; new forward migration: **069**. Repository presence was not accepted as proof of execution. No hosted or Production database was connected to.

The finding remains valid at that baseline: schema responsibility was split between frozen manual patches, exported snapshots, request-time initialization and startup metadata seeds. Partial existence checks and a listener that started without complete schema/release verification could conceal incompatible deployments. Neither supported external ledger convention establishes the required manual-file checksum/release evidence by itself.

The implementation establishes a locked expected schema, SQL/source inventory, read-only compatibility verifier, operator-executed transactional release bundle, append-only forward execution journal and separate current-schema attestation. Historical scripts remain **UNVERIFIED**. The runtime role cannot create persistent schema or write release evidence; startup fails before listeners/workers when compatibility cannot be established.

## Artifacts and scope

- **100 SQL artifacts**: 71 frozen historical, 9 superseded, 8 read-only verifiers, 3 supplied exports, 7 uncertain/non-deployment candidates, 1 active forward migration and 1 test fixture.
- **426 locked production/tool source and package artifacts**; newly discovered unregistered sources/SQL block release planning/readiness.
- **44 request/startup initializer entry points** converted to read-only validation. Original digests, affected tables and exact entry points are recorded under `purchase-backend/database/releases/`.
- Expected catalog: **259 relations, 3,512 columns, 1,499 constraints, 682 indexes, 215 routines and 24 triggers**, plus RLS/policies, effective browser privileges, 153 permission definitions, 37 UI resource definitions, 25 route policies, two reference account codes and six existing evaluation criterion codes.
- Existing reference-account and evaluation criteria seeding moves to SQL 069. Existing criterion identities/configuration and custom policy values are preserved; ambiguous uncoded criteria block execution for explicit review.
- No API business authorization, financial posting, inventory acceptance, assignment/workload or approval-engine policy was changed. `LIVE_ROUTING_ENABLED=false` remains unchanged.

The machine inventory distinguishes superseded *responsibility* from historical execution. Old SQL 035/038–043 overlap structural reconciliation consolidated in 059; 036/037 overlap catalog responsibilities consolidated in 060/061. Their originals are preserved. Dormant exported SQL arrays remain reference material and are never executed by the converted runtime helpers.

## Release authority

| Actor or mechanism | Allowed | Blocked |
| --- | --- | --- |
| Offline planner | Inspect files/checksums, produce a reviewable plan/bundle | Database connection or automatic execution |
| Dedicated read-only verifier | Compare actual catalog/security/evidence with the release contract | DDL, data backfill, marking history applied |
| Reviewed migration owner | Manually execute the transactional forward bundle and record actual execution | Frozen automatic replay; destructive down scripts |
| Dedicated trusted backend role | Required canonical business DML/functions/sequences; read release evidence | Ownership/owner membership, persistent schema creation, release evidence writes |
| Browser database roles | No direct access to reviewed internal ERP tables/routines | Bypassing Express institute/capability authorization |
| Database owner | Trusted provisioning and manual release administration | Must remain outside application credentials; external audit retention is required |

Current-schema verification is not historical execution evidence. APPLIED pre-069 identifiers are rejected. Failed bundles roll back schema/evidence together; failed execution output belongs in the external operator record. The DB owner remains a trusted authority, not something an in-database journal can cryptographically constrain.

## Validation

All database tests use runner-created loopback-only PostgreSQL 16 containers with random disposable credentials. Configured hosted database bindings are never selected. No Production smoke test is claimed.

| Command, from `purchase-backend` | Result |
| --- | --- |
| `npm run db:plan` | PASS, offline checksums and forward plan |
| `npm test -- --runInBand` | PASS: 226 suites, 1,893 tests |
| `npm run test:database-governance-postgres` | PASS: 28 real PostgreSQL scenarios, locked contract, no automatic capture |
| `npm run test:p2p-postgres` | PASS: 92 real PostgreSQL tests |
| `npm run test:completion-reporting-postgres` | PASS: 43 receipt acceptance and 29 unified reporting scenarios |
| Changed JavaScript syntax / `git diff --check` | PASS |

Governance coverage includes empty-database forward-prerequisite rejection; a populated database; repeat execution; dependency/order and checksum rejection; missing table/index/FK; wrong type/function signature; missing capability; RLS drift; absent SQL 067/068 functions; injected mid-bundle failure and full rollback; concurrent advisory-lock rejection; blocked startup callback; read-only verification; byte-equivalent financial/inventory record hashes; an actual non-owner backend connection; all 44 local module registrations; runtime DDL denial; effective privileges; immutable evidence and legacy APPLIED rejection. Permissive hosted-style service-role grants are simulated and removed by the governed payload.

P2P and Batch 6 suites independently exercise preserved approval, technical clearance, receipt/inspection/stock, finance, scoped reporting and concurrency behavior. Unit fixtures mock initializer checks only; the real PostgreSQL suite does not mock the release verifier or runtime authority.

## Migration and manual acceptance

**MANUAL DATABASE MIGRATION REQUIRED**:

`purchase-backend/sql/manual/069_database_release_governance.sql`

Use the reviewed bundle generated offline from the candidate release, rather than executing only the bare file and inventing execution receipts. The payload, full pre/postflight, advisory lock, timeouts and actual APPLIED receipt/attestation commit together.

Follow [the Development rollout runbook](../../purchase-backend/docs/database-release-governance-7a.md). It documents backup/review, explicit environment identity, missing baseline remediation, SQL Editor execution by the owner, dedicated runtime login provisioning, APP_RELEASE_REF / DB_RELEASE_ENVIRONMENT configuration, actual-credential verification, maintenance-window startup and manual functional acceptance.

No frozen SQL 001–068 was modified. No historical financial/clinical/inventory values were backfilled. No hosted SQL, deployment, merge or live-routing activation occurred.

## Remaining risks and explicit limitations

- Hosted compatibility and installed history remain unknown. The reviewed PostgreSQL 16 fixture is an expected contract, not a hosted snapshot. Platform/custom schema or policy differences must receive explicit review and a versioned contract variant.
- Restricted runtime login provisioning and BYPASSRLS capability must be supported by the owner’s platform. The Express server remains the institute/capability boundary; this trusted credential must never be exposed to browsers or suppliers.
- Readiness is strict and checked at startup, not continuously. Maintenance-window stop/verify/start is required around schema/security changes. Reviewed mutable UI/route policy changes may require a new compatible contract/attestation before restart.
- The journal cannot recreate trustworthy historical execution evidence or protect against a malicious database owner. Preserve backup, bundle, review and execution output externally.
- SQL 069 intentionally cannot bootstrap an empty hosted installation or guess repairs for partial historical schemas. Missing prerequisites require separately reviewed forward corrections; do not replay the frozen directory.
- One reviewed transactional forward step is supported per bundle. Future contract versions must explicitly define their own prerequisites and register new SQL/source hashes; there is no automated migration executor or destructive rollback.

## Exact changed files

- `.github/workflows/database-release-governance.yml`
- `docs/audits/2026-11-aud010-remediation.md`
- `purchase-backend/__tests__/ensureWarehouseSupplyTables.test.js`
- `purchase-backend/__tests__/jest.setup.js`
- `purchase-backend/__tests__/procurementEvaluationService.test.js`
- `purchase-backend/app.js`
- `purchase-backend/config/db.js`
- `purchase-backend/controllers/auditRegistryController.js`
- `purchase-backend/controllers/requests/assignRequestController.js`
- `purchase-backend/controllers/requests/createRequestController.js`
- `purchase-backend/controllers/supplierEvaluationsController.js`
- `purchase-backend/controllers/supplierSrmController.js`
- `purchase-backend/controllers/suppliersController.js`
- `purchase-backend/controllers/utils/approvalRouteVersioning.js`
- `purchase-backend/controllers/warehouseSupplyTemplatesController.js`
- `purchase-backend/database/releases/migration-inventory.json`
- `purchase-backend/database/releases/runtime-modules.json`
- `purchase-backend/database/releases/runtime-remediation.json`
- `purchase-backend/database/releases/schema-contract.json`
- `purchase-backend/docs/architecture/manual-migration-governance.md`
- `purchase-backend/docs/database-release-governance-7a.md`
- `purchase-backend/integration/databaseGovernance.postgres.js`
- `purchase-backend/middleware/writeAuditTrail.js`
- `purchase-backend/package.json`
- `purchase-backend/repositories/stockItemRequestRepository.js`
- `purchase-backend/routes/documentBranding.js`
- `purchase-backend/routes/printServiceRequests.js`
- `purchase-backend/scripts/databaseRelease.js`
- `purchase-backend/scripts/lib/databaseRelease/catalog.js`
- `purchase-backend/scripts/lib/databaseRelease/inventory.js`
- `purchase-backend/scripts/lib/databaseRelease/planner.js`
- `purchase-backend/scripts/lib/databaseRelease/sqlStatements.js`
- `purchase-backend/scripts/testBackendContractRefresh.js`
- `purchase-backend/services/databaseReleaseService.js`
- `purchase-backend/services/procurementEvaluationService.js`
- `purchase-backend/sql/manual/069_database_release_governance.sql`
- `purchase-backend/tests/attachmentSchema.test.js`
- `purchase-backend/tests/contractsAttachmentSchema.test.js`
- `purchase-backend/tests/databaseReleaseGovernance.test.js`
- `purchase-backend/tests/ensureHistoricalRequestSchema.test.js`
- `purchase-backend/tests/ensureWarehouseSupplyTables.test.js`
- `purchase-backend/tests/manualMigrationGovernance.test.js`
- `purchase-backend/tests/supplierEvaluationsController.test.js`
- `purchase-backend/tests/suppliersController.test.js`
- `purchase-backend/utils/attachmentsColumnSupport.js`
- `purchase-backend/utils/capabilityPolicyService.js`
- `purchase-backend/utils/ensureApprovalReminderColumn.js`
- `purchase-backend/utils/ensureDepartmentItemFollowUpNotesTable.js`
- `purchase-backend/utils/ensureFinanceCoreTables.js`
- `purchase-backend/utils/ensureHistoricalRequestSchema.js`
- `purchase-backend/utils/ensureItemMasterTables.js`
- `purchase-backend/utils/ensureItemRecallsTable.js`
- `purchase-backend/utils/ensureMaintenanceRequestSchema.js`
- `purchase-backend/utils/ensureMonthlyDispensingTables.js`
- `purchase-backend/utils/ensureProcureToPayTables.js`
- `purchase-backend/utils/ensureProjectsTable.js`
- `purchase-backend/utils/ensureRequestClientSubmissionKey.js`
- `purchase-backend/utils/ensureRequestEditApprovalsTable.js`
- `purchase-backend/utils/ensureRequestSchedulingColumns.js`
- `purchase-backend/utils/ensureRequestedItemApprovalColumns.js`
- `purchase-backend/utils/ensureRequestedItemFinancialsTable.js`
- `purchase-backend/utils/ensureRequestedItemPoIssuanceColumn.js`
- `purchase-backend/utils/ensureRequestedItemReceivedColumns.js`
- `purchase-backend/utils/ensureRequestedItemUnitOfMeasureColumn.js`
- `purchase-backend/utils/ensureRiskRegisterTable.js`
- `purchase-backend/utils/ensureTechnicalInspectionsTable.js`
- `purchase-backend/utils/ensureWarehouseSupplyTables.js`
- `purchase-backend/utils/ensureWarehouseTransferTables.js`
- `purchase-backend/utils/evaluationCriteriaSeeder.js`
- `purchase-backend/utils/notificationService.js`
- `purchase-backend/utils/permissionService.js`
- `purchase-backend/utils/runtimeSchemaContract.js`
- `purchase-backend/utils/runtimeSqlGuard.js`
- `purchase-backend/utils/uiAccessService.js`
