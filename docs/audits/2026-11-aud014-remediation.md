# AUD-014 — Transactional audit and notification reliability (Task 7C)

## Review and verified root cause

Reviewed current master **d6fc982f**, including merged Tasks 7A and 7B. AUD-014 is confirmed in legacy approval/request notification paths and external delivery acknowledgment. Canonical P2P, stock, contract and RFID transactions already preserve authoritative business audit evidence; the after-response HTTP trail cannot supply that guarantee. This remediation keeps those owners and corrects the gaps rather than adding another audit or approval engine.

The [architecture, event inventory, audit authority matrix, security policy and Development rollout](../../purchase-backend/docs/transactional-event-reliability-7c.md) identify active producers across all twelve requested business domains and distinguish required audit, required internal projection/user notification, optional notification and HTTP telemetry.

## Changes

- Critical audit/outbox writers require the actual business transaction. Legacy request creation, approval/rejection, continuation, scheduled activation and reminders enqueue required work before commit. Approval concurrency refreshes under the existing request lock. Audit or required outbox failure rolls back the command.
- Keep central audit source/actor/institute/before-after evidence and existing approval/request/technical histories. Stable audit operation keys serialize retries. HTTP telemetry failures emit a sanitized category and correlation identifier and never pretend to be an authoritative business audit.
- Preserve the existing in-app outbox and add a separate durable leased external email handoff. In-app insertion/projection/acknowledgment share a transaction; external transport runs after committed claiming/preparation with fenced acknowledgment. Recovery, bounded backoff, terminal/suppressed states, stable transport identity and sanitized failure visibility prevent crash-stranded delivery intentions.
- Recheck persisted active recipients, source ownership and fresh permissions. Preserve canonical assignment eligibility, request access, technical reviewer responsibility and supplier/internal identity boundaries. Source-linked notification reads also recheck current authority. Completed/cancelled requests cannot deliver stale approval action links.
- Add an explicitly authorized, institute-scoped, read-only operational diagnostic with evidence gaps, queue summaries, leases, failures, dead letters, duplicate candidates and a real immutable installation cutover. No historical audits, delivery acknowledgments, liabilities, payments, stock balances or inspection outcomes are fabricated.
- Update Task 7A release governance for forward SQL 071, preserve the frozen 070 prerequisite contract, and retain 7B RFID recovery. Existing approval/workload/technical-clearance/financial policies are unchanged. The frontend already displays the server reminder message, which now accurately says queued.

## Executed validation

All database tests use generated, validated loopback-only disposable PostgreSQL 16 instances. Hosted URLs are never selected. SMTP is stubbed only at the external boundary; real PostgreSQL transactions, row locks, authorization, insert failures, persistence and connection termination are exercised.

| Command (from purchase-backend) | Result |
| --- | --- |
| `npm test -- --runInBand --forceExit` | PASS: 227 suites, 1,897 tests |
| `npm run test:event-reliability-postgres` | PASS: 38 scenarios |
| `npm run test:p2p-postgres` | PASS: 94 scenarios, including new actual payment and PO audit INSERT rollback cases |
| `npm run test:completion-reporting-postgres` | PASS: 43 receipt/technical/inventory scenarios plus 29 reporting scenarios |
| `npm run test:completion-postgres` | PASS: stock fulfillment and full technical workflow, plus 35 canonical completion cases |
| `npm run test:contract-finance-postgres` | PASS: 38 cases |
| `npm run test:rfid-recovery-postgres` | PASS: 28 scenarios |
| `npm run test:database-governance-postgres` | PASS: 28 scenarios |
| Offline `databaseRelease.js plan ... --output /tmp/review-071.sql` | PASS: selects only 071 and generates reviewable SQL without connecting |
| `git diff --check`, locked inventory/source verification | PASS |

Jest's force-exit option accommodates existing test-resource handles; it is not a substitute for PostgreSQL transaction tests, whose pools/containers are closed normally. Existing mock-based unit clients explicitly assume a business transaction; the new native suite tests the real guard without that mock. No frontend source changed, so no frontend build/test result is claimed for this backend-only change.

## Requested test coverage

| Requested case | Actual verification |
| --- | --- |
| 1. Successful business transaction | Canonical P2P lifecycle, actual legacy rejection and scheduled activation; audit and queued notice assertions |
| 2. Audit INSERT failure | Actual PostgreSQL trigger failure for generic transaction, payment and PO; legacy approval rollback; existing technical/receipt/inventory/RFID fault cases |
| 3–4. Outbox INSERT failure / rollback | Native outbox trigger and explicit rollback; AP liability/commitment rollback and acceptance/release event rollback |
| 5–6. Timeout retry / duplicate command | Lost-response model after committed change, concurrent duplicate commands, audit key serialization, conflicting event payload rejection |
| 7. Worker crash | Persisted external claim recovery; actual `pg_terminate_backend` before in-app commit; injected post-insert failure; ambiguous external acknowledgment |
| 8. Concurrent workers | SKIP LOCKED in-app claims and unstealable active external lease |
| 9. Stale recovery | Expired processing state and committed external lease recovery |
| 10. Permanent delivery failure | Permanent internal source failure, SMTP rejection, exhausted internal and external retry budgets, dry-run/unavailable transport |
| 11–12. Deactivation / foreign recipient | Deactivation before in-app and between channels, moved institute, rejected foreign envelope/recipient and supplier recipient kind; notification read revocation |
| 13–14. Payment / PO issuance audit | 94-case P2P suite includes actual PostgreSQL audit INSERT failures and complete business-state rollback |
| 15–16. Technical acceptance / inventory audit | 43 receipt cases verify audit/event rollback, stock provenance, duplicate acceptance and scope; P2P receipt/inventory regressions |
| 17. RFID | All 28 7B recovery/scope/audit/idempotency/stock-isolation cases |
| 18. Historical diagnostics | Missing historical PO audit/outbox is reported by institute, no audit fabrication; read-only snapshot and authorization assertions |
| 19. No duplicate mutation | Concurrent command and worker tests, unique in-app/email intentions; canonical payment/receipt/PO retry compatibility |
| 20. Notification compatibility | Existing notification/performance/assignment tests, versioned technical notices, legacy personal metadata containment, existing controller and reminder behavior |

## Migration and manual acceptance

**MANUAL DATABASE MIGRATION REQUIRED:**

`purchase-backend/sql/manual/071_transactional_event_reliability.sql`

Use the reviewed generated bundle and the [manual Development instructions](../../purchase-backend/docs/transactional-event-reliability-7c.md#manual-development-rollout), preserving genuine governed 069/070 receipts, restricted runtime credentials, source binding and current schema attestation. Do not run frozen scripts with the new planner or fabricate old execution evidence. No SQL was executed against hosted Supabase. No merge or deployment was performed. `LIVE_ROUTING_ENABLED=false`; Approval Engine V2 remains unchanged.

## Remaining risks and explicit limits

- SMTP may accept a message before its acknowledgment is lost. At-least-once retry can duplicate external delivery; Message-ID is not a downstream exactly-once guarantee. The native fault test demonstrates this deliberately.
- A healthy worker/database and configured transport are necessary. Queue summaries need an operator/monitoring consumer; no paging service or public dead-letter replay endpoint is invented.
- Recipient revocation after the last committed authority check cannot atomically retract an external handoff. Linked documents remain independently authorized; messages should contain minimal information.
- Historical unscoped/unknown personal notices retain compatibility and cannot be certified retroactively. Diagnostics are bounded review worklists; missing evidence or repeated source identity never proves a financial loss or reconstructs every historical transition/recipient.
- No hosted schema/grants, real SMTP provider, ordinary live recipient, physical device, Hetzner/PM2 restart or production rollout was tested. Development acceptance and historical evidence review remain owner work. Existing retention policy for notification/audit payloads is unchanged.

## Exact changed files

The following list excludes the unrelated pre-existing taste-skill installation files.

```text
docs/audits/2026-11-aud014-remediation.md
purchase-backend/__tests__/approvalContinuationService.test.js
purchase-backend/__tests__/createRequest.test.js
purchase-backend/__tests__/jest.setup.js
purchase-backend/__tests__/supplyChainPerformanceRegression.test.js
purchase-backend/controllers/approvalsController.js
purchase-backend/controllers/requestedItemsController.js
purchase-backend/controllers/requests/createRequestController.js
purchase-backend/controllers/utils/processScheduledRequests.js
purchase-backend/controllers/utils/remindPendingApprovals.js
purchase-backend/controllers/utils/remindPendingReceipts.js
purchase-backend/database/releases/migration-inventory.json
purchase-backend/database/releases/prerequisites/070-schema-contract.json
purchase-backend/database/releases/schema-contract.json
purchase-backend/docs/database-release-governance-7a.md
purchase-backend/docs/rfid-crash-recovery-7b.md
purchase-backend/docs/transactional-event-reliability-7c.md
purchase-backend/integration/databaseGovernance.postgres.js
purchase-backend/integration/databaseReleasePrerequisite.js
purchase-backend/integration/eventReliability.postgres.js
purchase-backend/integration/fixtures/p2p.sql
purchase-backend/integration/p2p.postgres.test.js
purchase-backend/integration/rfidRecovery.postgres.js
purchase-backend/integration/technicalWorkflow.js
purchase-backend/middleware/writeAuditTrail.js
purchase-backend/package.json
purchase-backend/routes/notifications.js
purchase-backend/scripts/lib/databaseRelease/inventory.js
purchase-backend/scripts/testBackendContractRefresh.js
purchase-backend/services/approvalContinuationService.js
purchase-backend/services/auditService.js
purchase-backend/services/databaseReleaseService.js
purchase-backend/services/deliveryInspectionService.js
purchase-backend/services/eventAuthority.js
purchase-backend/services/eventReconciliationService.js
purchase-backend/services/notificationEmailDelivery.js
purchase-backend/services/notificationOutboxProcessor.js
purchase-backend/services/notificationOutboxService.js
purchase-backend/services/preprocurementTechnicalReviewService.js
purchase-backend/services/procurementAssignmentNotification.js
purchase-backend/services/workflowNotificationService.js
purchase-backend/sql/manual/071_transactional_event_reliability.sql
purchase-backend/tests/assignmentSecurity.test.js
purchase-backend/tests/databaseReleaseGovernance.test.js
purchase-backend/tests/helpers/assignmentFixture.js
purchase-backend/tests/helpers/legacyTechnicalReviewClient.js
purchase-backend/tests/helpers/technicalAwardFixture.js
purchase-backend/tests/notifyCurrentApprovalByEmail.test.js
purchase-backend/tests/phase2FoundationCorrections.test.js
purchase-backend/tests/receiptReminderCompletionBoundary.test.js
purchase-backend/tests/updateApprovalItemsConversion.test.js
purchase-backend/utils/emailService.js
purchase-backend/utils/notificationService.js
purchase-backend/utils/notificationVisibility.js
purchase-backend/utils/permissionService.js
purchase-backend/utils/requireAuditTransaction.js
purchase-backend/utils/workflowEmailNotifications.js
```
