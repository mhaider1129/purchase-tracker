# AUD-008 remediation — legacy inspection lifecycle authority

Revalidated on 31 October 2026 (Asia/Baghdad) against current `origin/master`,
`42430e2a` (merged attachment security PR 75). Read the October system audit,
remediation backlog and integration matrix before changing code. Finding remained
confirmed: `createTechnicalInspection` and `updateTechnicalInspection` called
`applyRequestStatusFromInspections` through the pool after saving the form. That
helper directly updated `requests.status`, `completed_at` and request logs using
only inspection counts and a `status <> received` guard. A passed form could
complete unfinished/rejected demand; pending evidence could reopen a terminal
request. Form persistence and the resulting status/log writes were not atomic.

## Authority and correction

Chose **evidence-only** behavior. Legacy CRUD now has no request/case/PO status
writer, inventory posting, financial command, or lifecycle transition call.
The exported compatibility helper remains callable, but returns the read-only
summary with `appliedStatus: null, statusUpdated: false`. Controllers no longer
call it. No competing engine or automatic completion trigger was added.

The existing request lifecycle service/policy and explicit completion workflow
remain the request status owners. Existing explicit `markRequestAsCompleted`
still checks item finalization and the inspection summary; pending legacy forms
and incomplete required GR technical acceptance still block that completion.
Acceptance is evidence consumed by an explicit action, never independent authority
to complete or reopen. A request previously placed in
`technical_inspection_pending` stays there until an authorized user invokes the
existing explicit completion action and its checks pass. No historical request
statuses, completion timestamps, or inspection rows are bulk-rewritten.

This narrow correction does not claim to solve AUD-011's broader competing
completion/read-model semantics or certify every existing request lifecycle path.

## Transaction, authorization and compatibility

- Existing authenticated router capability `technical-inspections.manage` and
  institute/link/item ownership checks are preserved; frontend institute IDs are
  not accepted as authority.
- Create/update/delete use the existing `withTransaction` and `writeAuditEvent`
  services. Parent linkage validation uses that same client with shared locks.
  Mutations and their canonical audit evidence commit or roll back together;
  the response is sent only after commit.
- Updates and deletes lock the scoped inspection row. Audit before/after images
  retain decision revisions, actual actor/institute, linked request, notes and
  timestamps. Deletion retains the original record in its audit before-image;
  it does not recalculate or change request status.
- Optional `expected_updated_at` rejects stale edits with 409. The legacy editor
  supplies the loaded timestamp. Older clients may omit it and retain serialized
  last-writer behavior, with each preceding decision captured in audit. This is
  timestamp-based optimistic checking, not a new persistent version field.
- Existing routes, IDs, payload fields, JSON evidence, unlinked historical forms,
  acceptance states, reviewer identity and timestamps remain supported. No
  attachment reference, GR task, approval route or procurement case is rewritten.
- Worklist/table labels identify technical review status. Historical form/detail
  explicitly explain that request completion and procurement are separate; no
  request or procurement status is fabricated from the inspection decision.

## Receiving controls preserved

No production receiving, delivery-disposition, technical-profile, inventory,
financial matching or procurement-case service was changed. Required profiles
still generate pending delivery tasks with zero accepted quantity. Only the
canonical authorized disposition path releases the accepted delta. Rejected
quantities and the remaining hold remain distinct; quarantine and warehouse
institute/UOM checks remain enforced. Legacy passed evidence cannot satisfy a
required GR task. No schema change or Approval Engine V2 activation occurred.

## Exact changed files

- `purchase-backend/controllers/technicalInspectionsController.js`
- `purchase-backend/utils/technicalInspectionStatus.js`
- `purchase-backend/integration/backendQueryCompatibility.js` — remove obsolete
  expectations that the helper must write request status; retain a read-only
  boundary assertion. The disposable SQL harness was **not executed**.
- `purchase-backend/tests/technicalInspectionsScope.test.js`
- `purchase-backend/tests/technicalInspectionStatus.test.js`
- `purchase-backend/tests/legacyInspectionEvidence.test.js`
- `purchase-backend/tests/legacyInspectionReceivingBoundary.test.js`
- `purchase-backend/tests/goodsReceiptService.test.js`
- `purchase-frontend/src/pages/LegacyTechnicalInspectionsPage.jsx`
- `purchase-frontend/src/pages/TechnicalInspectionsPage.jsx`
- `purchase-frontend/src/components/HistoricalInspectionDetail.jsx`
- `purchase-frontend/src/pages/TechnicalWorklistPage.test.jsx`
- `docs/audits/2026-10-aud008-remediation.md` (this report)

## Regression coverage and local verification

Tests use mocked database runners and local service fixtures, never hosted
Supabase. Concurrent test runners model PostgreSQL row-lock serialization; they
are not proof of deployed PostgreSQL/RLS/trigger behavior.

| Required scenario | Evidence |
| --- | --- |
| Accepted Submitted / Rejected / Cancelled PR | Real controller/helper have no reachable lifecycle DML, tested for each state |
| Partially ordered / active procurement | Same absence of lifecycle/case/PO writers; explicit item completion tests retained |
| Pending inspection on completed/Received/Closed PR | Compatibility helper is read-only; pending edit writes only inspection and audit |
| Multiple inspections | Summary retains total and outstanding counts without a status effect |
| Partial technical acceptance | Real canonical disposition application posts accepted delta only, preserves rejected quantity, quarantine and remaining hold |
| Required GR still pending | Real receipt service produces zero accepted quantity; pending disposition application rejects; summary still gates completion |
| Unauthorized inspector | Actual legacy router permission middleware denies before data access |
| Cross institute | Scoped legacy read/edit/delete and linked-request create deny; foreign receiving warehouse cannot release |
| Concurrent decisions | Locked edits, one stale-token conflict; token-less compatibility keeps serialized before/after audits |
| Rollback | Create/update/delete audit failure leaves records unchanged and responds with error |
| Historical compatibility | Existing format, IDs/links, old token-less edits and aggregate summary remain supported |

From `purchase-backend`:

```sh
npm test -- --runInBand tests/technicalInspectionStatus.test.js tests/legacyInspectionEvidence.test.js tests/legacyInspectionReceivingBoundary.test.js tests/technicalInspectionsScope.test.js tests/goodsReceiptService.test.js tests/markRequestAsCompleted.test.js tests/phase2LifecycleDomain.test.js __tests__/procurementPerformance.test.js tests/technicalWorklistService.test.js
npm test -- --runInBand
```

From `purchase-frontend`:

```sh
CI=true npm test -- --runInBand src/pages/TechnicalWorklistPage.test.jsx src/pages/TechnicalInspectionsPage.test.jsx src/components/DeliveryInspectionDetail.test.jsx
npx --no-install eslint src/pages/LegacyTechnicalInspectionsPage.jsx src/pages/TechnicalInspectionsPage.jsx src/components/HistoricalInspectionDetail.jsx src/pages/TechnicalWorklistPage.test.jsx
CI=false npm run build
```

Final results:

- Full backend Jest: **212 suites passed, 3 failed; 1,680 tests passed, 3 failed**.
  The same three failures were independently reproduced in an isolated checkout
  of unchanged `42430e2a`: `fetchRequestsController.domain.test.js` and
  `procurementHistoryController.test.js` SQL-shape expectations, plus
  `phase5aCanonicalItemWriterBoundary.test.js` existing schema-fixture DML scan.
  No remediation test failed. The earlier focused run passed 9 suites/113 tests;
  the final full run also includes the subsequently added deletion rollback tests.
- Frontend targeted Jest: **3 suites / 11 tests passed** (worklist, inspection
  summaries and delivery-detail behavior). Existing React Router warnings remain.
- ESLint for all four changed frontend files: passed without warnings/errors.
- Production build: passed (`CI=false`), with the two unchanged baseline warnings
  in `DepartmentRequestedItemsBoard.jsx` (unused actionLoading) and
  `fixed-assets/PhysicalInventory.jsx` (effect dependency), plus bundle-size advice.
- Node syntax checks for changed backend implementation/integration JavaScript
  and `git diff --check`: passed.

All executed checks use test database configuration/mocks. No migration-installing
PostgreSQL harness was run, and no hosted database or storage was contacted.

## Database, rollout and remaining risks

**No database migration required.** No frozen migration, dependency or lockfile
changed. Build/restart the backend and rebuild the frontend after manual merge;
no deployment was performed. Review a locally configured approved sample through
legacy form save, explicit completion, and required GR acceptance before release.
Verify Submitted/Rejected/Cancelled/held/terminal request statuses stay unchanged
when creating/editing evidence and a stale editor shows a reload conflict.

Existing historical request statuses may already be incorrect; investigate/reconcile them
through authorized request workflows using original evidence. This PR deliberately
does not guess or repair them. Existing legacy schema initializer/runtime DDL
(AUD-010), broad lifecycle/read-model work (AUD-011), and inspection-to-case event
integration (AUD-018) remain separate findings. New audit writes fail closed if
the existing canonical audit schema is unavailable. Timestamp tokens have the
precision of the existing driver/schema; clients omitting tokens preserve legacy
last-writer semantics. Hosted schema, RLS and deployment are unverified.

LIVE_ROUTING_ENABLED remains FALSE.
The existing approval engine remains authoritative.
No SQL was executed against Development Supabase.
No SQL was executed against Production Supabase.
