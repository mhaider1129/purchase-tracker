# AUD-011 — Canonical procurement completion (Task 6A)

Review date: 4 November 2026. Base: `origin/master` / `3239d166`.
This review includes AUD-008, AUD-009 and the merged Batch 5 financial work.
No hosted database was inspected or changed. SQL deployment/trigger activation
in production remains an owner verification item. LIVE_ROUTING_ENABLED stays false.

## Confirmed causes

1. Procurement event rollup marked a request completed when purchased counters
   reached demand, without accepted delivery or department handoff.
2. The explicit completion controller accepted purchased/completed/not-procured/
   cancelled item labels. Legacy inspection forms could block completion but
   could not establish canonical receiving acceptance (AUD-008).
3. Shared list/priority SQL treated purchased quantity as fulfilled quantity.
   A stock diversion link was also treated as actual fulfillment.
4. Warehouse close could close partial demand; supplied counters could exist
   without a corresponding stock issue. A scheduled receipt reminder created
   requester acknowledgments and changed request status without a person.
5. Case reporting treated one delivered PO as delivery of the entire case item.
   Technical disposition had no matching case evidence event. Multiple POs,
   held quantities and independent financial stages made those shortcuts unsafe.

## Definitions and authority matrix

All comparisons are per demand line and its UOM. There is no aggregate sum of
incompatible quantities or currencies. Numeric PostgreSQL arithmetic and existing
immutable PO conversion snapshots are used; API quantities are decimal strings.

| Term | Authority / meaning | Does not establish |
| --- | --- | --- |
| Approved demand | Owned request in an existing post-approval state, without a pending/held non-superseded approval; eligible requested lines, or approved warehouse supply lines | An RFx, quotation or payment is not approval |
| Procurement started | At least one issued PO quantity against eligible demand | Department fulfillment |
| Procurement completed | Each eligible line is fully committed on issued POs or legitimately stock-resolved | Receiving, requester confirmation, financial settlement |
| Ordered quantity | `purchase_order_items.quantity` joined by actual requested-item/request/PO ancestry, issued/partial/delivered/closed POs; converted with immutable source/base UOM and conversion factor | Draft PO or specialist purchased counter |
| Delivered quantity | Actual `goods_receipt_items.received_quantity` under its real GR, PO and request | Acceptance of damaged, short, rejected or held units |
| Accepted quantity | Non-required inspection: received less damage/shortage. Required inspection: canonical applied `technical_accepted_quantity`. Inventory acceptance additionally requires net AVAILABLE canonical GR movements | Legacy form acceptance or unsigned technical opinion |
| Rejected / quarantined | Damaged and canonical technically rejected quantities remain separate; unreleased quarantine is never usable acceptance | Accepted/fulfilled demand |
| Warehouse issued | `warehouse_supplied_items` backed by AVAILABLE negative ISSUE ledger entries with exact request/line/institute/warehouse/department source; capped per supply record; net of exact reversals | Counters, transfers or duplicated document links |
| Department fulfilled | Accepted direct NON_INVENTORY receipt plus the greater of actual warehouse issue and requester acknowledgment capped by accepted inventory intake, capped by original demand | Warehouse inventory intake alone |
| Partially fulfilled | Some verified handoff, at least one eligible line still unmet | Completion of the entire request |
| Fully fulfilled | Every eligible positive demand line satisfied, approved root, no terminal cancellation/rejection, conflicting ancestry, requester issue or unsupported policy | Payment is neither required nor sufficient |
| Requester acknowledgment | Explicit original requester action, actor/received timestamp and issue-free received quantity, capped by current accepted/issued evidence | Timer execution or another receipt posting |
| Cancelled/rejected | Terminal root; preserved status; evidence cannot reopen it | Item `not_procured`/`canceled` is not an approved quantity cancellation |
| Financial complete | Existing AP/invoice/payable/commitment obligation gates, independently computed in P2P | Physical or department completion |

Inventory intake, stock issue and requester acknowledgment are not added together.
Direct noninventory handoff and issued stock can cover different portions of one
mixed demand. Multiple GRs/POs accumulate by their own source lines. Flow links
are not joined into quantity aggregates. Reversals subtract from their original
movement. Transfers do not create a receipt or issue source. Receipts with foreign
or inconsistent ancestry cannot clear completion. Existing stock identity and
receiving mapping controls remain required.

`completed_at` remains a compatibility timestamp written only by the existing
request lifecycle coordinator, with canonical evidence captured in the audit
metadata. No historical timestamp is changed. Requester receipt-issue reopening
preserves the existing Received → Completed investigation transition and does not
create fulfillment evidence or a new completion timestamp.

## One projection and compatibility

Manual SQL 067 defines STABLE, SECURITY INVOKER read-only functions:
`canonical_procurement_completion(request_id,institute_id,item_id DEFAULT NULL)`
and `canonical_supply_quantity(item_id,institute_id)`. The optional item filter
supports case/item readers without summing the request repeatedly in JavaScript.
The server coordinator reloads actor permissions and scope, then uses the existing
`requestLifecycleService` transaction, status graph, audit and notification outbox.
There is no new lifecycle or approval engine.

New and existing consumers:

| Reader | Meaning / change |
| --- | --- |
| `/requests/:id/completion`, full-details workspace | Same canonical vector and line evidence; own request/assigned/department/warehouse/capability or existing approval assignment, bounded institute authority |
| P2P lifecycle | Canonical physical vector plus independent existing financial obligation gate |
| Requested item / list / priority helpers | Shared SQL delegates quantity truth to 067; stock-resolution is explicitly separate from fulfillment |
| Request lists, closed history, existing priority/archive queues | Historical stored Completed/Received/Closed and stock-ready labels preserved; these are operational archive labels, not proof of department fulfillment |
| Dashboard | Existing operational counts retained and labeled operational closure; new current-institute procurement, acceptance, fulfillment and unverified-history counts |
| Procurement cases / performance | Item-scoped accepted receiving projection; one PO status cannot clear the whole item. Current vector exposed alongside historical case projection |
| PO receipt cache / GR / matching / assets | Existing accepted quantity controls retained; AUD-008 and AUD-009 technical gates are not replaced |
| Legacy scalar `p2pCompletionService.deriveCompletion` | Compatibility/test helper; live P2P procurement/receiving flags use the canonical projection, not its cross-line scalar sums |
| Buyer workload and historical case timing | Existing workload/priority weights and monotonic historical case stages preserved; current completion vector distinguishes later reversal/investigation |

Stored legacy completion labels are not rewritten, and queues are not silently
reopened. An old completed request with missing source evidence is visibly marked
`legacy_completion_without_fulfillment`. New completion commands require evidence
even on an old label. Fulfillment flags are current evidence, not immutable claims
that a later authorized reversal cannot invalidate.

## Writer inventory and reachability

[Writer inventory](2026-11-aud011-completion-writers.jsonl) and
[backend SQL reader inventory](2026-11-aud011-completion-readers.jsonl) records exact
file, line, enclosing function, DML and classification. Reproduce offline:

```
node purchase-backend/scripts/auditCompletionWriters.js --jsonl > docs/audits/2026-11-aud011-completion-writers.jsonl
node purchase-backend/scripts/auditCompletionWriters.js --readers --jsonl > docs/audits/2026-11-aud011-completion-readers.jsonl
```

The inventory deliberately includes non-completion updates to the same tables to
avoid hiding dynamic updates. It is a source inventory, not proof that every
historical SQL file was applied in production. Dynamic sites require the reviewed
bindings below. No database introspection is run by this script.

| Active writer / trigger | Authority and triggering event | Business effect and downstream readers |
| --- | --- | --- |
| Request create, scheduled processing, pre-approval edits, reclassification | Existing request routes, scheduler and lifecycle validation | Draft/submitted/scheduled demand and item changes; approval lists |
| Approvals controllers, continuation, maintenance approval, SCM intervention | Existing assigned approval/SCM policy, actual approval decisions | Approved/rejected/returned demand and stock diversion; lifecycle/assignment/list readers. Not accepted fulfillment |
| Historical request import | Existing historical-entry permission and historical route | Preserved imported status/evidence; flagged unverified if no current canonical evidence. No automatic reconciliation/backfill |
| `requestLifecycleService.transition` | Existing command policy + new completion evidence guard | Sole new persisted completion/receipt/close authority, audit and outbox atomically; lifecycle/list/history readers |
| `markRequestAsCompleted` | Fresh explicit requests.manage (or exact warehouse capability via warehouse path) | Delegates to existing canonical coordinator; cannot clear using purchased counters |
| `markRequestAsReceived`, `reportReceiptIssue` | Original requester, owned request, fresh scope and accepted evidence | Explicit acknowledgment or investigation; no duplicate inventory intake; canonical status transition |
| Procurement event and requested-item status/quantity controllers | Existing assigned procurement permissions, quantity/identity controls | Commercial progress and costs only. Event rollup no longer writes Completed/completed_at; every fulfillment reader uses 067 |
| Warehouse supply / close | Existing warehouse.manage-supply, exact owned assigned warehouse, locked request; original linked demand institute/department and known generic identity verified | Actual canonical stock issue, conditional coordinator completion, idempotent source outbox. Partial/counter-only close rejected |
| GR service + connected P2P repository | Existing receiving permission, actual PO/line/warehouse scope and transaction locks | Physical receipt and accepted counters; GR, inventory, matching, assets, canonical completion |
| Delivery inspection service / applyTechnicalDisposition | Existing department opinions, SCM decision and receiving application with signed history/version checks | Applied technical acceptance/rejection, AVAILABLE inventory release, new disposition outbox event keyed by authorization; case projection/067 |
| Legacy technical inspection CRUD / technicalInspectionStatus | Existing evidence permissions, AUD-008 boundary | Evidence and pending hold summary only; cannot update request status or replace canonical disposition |
| Inventory posting/reversal repository | Existing inventory authority, posting locks, source idempotency, exact allocation and audit | Immutable source movements/net reversals; stock and completion readers. Legacy same-name requester receipt helper removed |
| Case provisioning, priority coverage and evidence consumer | Existing approved-item case infrastructure / transactional outbox worker | Case/activity projection. Worker re-reads full accepted item demand; rejects missing projection; terminal request never advances. Workload policy unchanged |
| `lifecycleTransitionService` | Existing P2P document services and state graph | Document-stage projection/history only; not physical fulfillment authority |
| RFx award request metadata | Existing sourcing/award authority | Award/PO references and timestamps only; not fulfillment |
| Item Master/requested item write/identity services | Existing catalog/identity and pre-procurement edit rules | Demand identity/quantities, never receiving acceptance |
| `remindPendingReceipts` (app cron) | Existing scheduled reminder | Reminder metadata only. Automatic receipt/status writes removed; no fictional requester |
| Runtime ensure* utilities | Existing schema compatibility bootstrap | Legacy null normalization/columns; never accepted evidence. Retained runtime DML is visible in inventory, not silently reclassified as canonical acceptance |

Compatibility/unreachable sites: `warehouseInventoryController.insertInventoryTransaction`
is defined but has no callers; active inventory controllers use canonical posting.
Dynamic procurement-evaluation inserts/updates target the fixed evaluation tables
passed by its mounted routes, not requests/cases/GR. `updateRequestsController`
dynamic deletion uses its existing allowlisted request-child tables; deletion is
not completion. Item Master dynamic updates target its fixed entity descriptors.
The former same-name `addReceivedStockToWarehouse` helper is removed.

SQL inventory: 045 and consolidated 059 contain approval activation timestamp
trigger logic. These are approval clocks, not request fulfillment writers. Manual
and development SQL remain deployment-unverified; schema snapshots contain table,
function and trigger definitions, not live application entry points. SQL 067 adds
no completion trigger, write function or historical DML. Frozen files are unchanged.
Owner rollout review must inspect hosted trigger bindings for local custom code
that is absent from this repository.

## Request types and policy boundaries

Actual request types are Stock, Non-Stock, Medical Device, Medication, IT Item,
Maintenance, Warehouse Supply and Printing Logbook. Medical/nonmedical distinctions,
capital equipment and maintenance parts are item/profile classifications, not
additional invented request types. Quantity evidence is shared across those types;
existing technical responsibility profiles determine required inspection.

The existing all-stock approval shortcut deactivates future pending approval rows
rather than superseding them. Inactive future rows do not block an all-stock
Available-in-Stock path or its subsequent Completed/Received/Closed projection;
active pending approvals still block it. Stock resolution separately blocks device
demo procurement even before physical fulfillment, preserving that existing policy.

Stock-only and warehouse-fulfilled paths need no PO: approved linked warehouse
issue is sufficient. Stock availability/diversion is procurement resolution, not
proof that the department received the item. Medical devices/medications retain
configured technical receiving gates. Noninventory goods can use accepted direct
receipt. Capital equipment still requires its existing accepted asset source gate.
Services/milestones, unsupported request-UOM packaging identity and undocumented
partial cancellation quantities require a policy decision; they do not silently
become fulfilled. Unmapped legacy stock counters need controlled evidence review,
not a fabricated movement or backfilled accepted amount.

## Authorization, transactions and audit

| Action | Server authority |
| --- | --- |
| Read projection | Active institute account; actual request ownership/assignment/approval, department view, assigned warehouse view/manage or existing manage/lifecycle capability. Cross-institute requires explicit requests.cross-institute AND bounded institute data scope |
| Complete normal request | Fresh explicit requests.manage plus existing lifecycle institute/department/section checks |
| Complete/close warehouse request | Fresh warehouse.manage-supply plus same institute and exact assigned warehouse; legacy cross-department warehouse handoff is preserved |
| Acknowledge | Original requester, active same/authorized institute, actual accepted/issued capacity; explicit confirmation; cannot write inventory |
| Apply technical decision | Existing signed department/SCM/receiving rules, unchanged AUD-009 provenance and PO clearance |
| Read financial completion | Existing P2P financial read scope before canonical financial documents are loaded |

Request row locks serialize lifecycle and warehouse commands. Supply saves require
the existing frontend expected_supplied_quantity token; duplicates/stale saves fail
before another issue. Receipt services retain PO/line locks and source idempotency.
Completion additionally holds contributing inventory movements FOR SHARE, matching
the existing reversal's original movement FOR UPDATE lock; projection is recomputed
after locking. Audit and lifecycle outbox commit with completion; failures roll back
status/timestamps and publication. Disposition events use immutable authorization
IDs; distinct partial rounds retain distinct events and retries do not duplicate
activities. Later authorized reversals change current evidence without rewriting
historical audit/status records.

## Database and manual rollout

**MANUAL DATABASE MIGRATION REQUIRED**:
`purchase-backend/sql/manual/067_canonical_procurement_completion.sql`.
Migration inventory was reviewed through 066 on the base branch. 067 creates two
read-only functions and one source lookup index; it does not backfill historical
status, quantities, timestamps or finances. It revokes PUBLIC/anon/authenticated
execution and grants existing service_role. SECURITY INVOKER keeps table/RLS
permissions; if the backend uses a separate trusted DB role, Development must
review/grant that role EXECUTE explicitly. Do not grant direct browser execution.

1. Review the exact SQL and current schema/roles in Development. Apply manually
   only after the canonical schema/permission and technical/financial prerequisites.
2. Run the disposable completion and P2P tests; exercise representative actual
   request/UOM/warehouse data in Development, including EXPLAIN and response timing.
3. Apply 067 manually before deploying the code that references its functions.
   Shared list/dashboard SQL requires it; do not roll out application first.
4. Keep LIVE_ROUTING_ENABLED=false. This work does not activate Approval Engine V2.
   Deploy/merge only through the owner's separate process; neither was performed.
5. Verify current-institute counts, requester confirmation, actual stock-only issue,
   technical hold/release, source permissions and outbox retries. Review legacy
   evidence gaps without automatically changing rows.
6. Application rollback can restore the previous release; leave additive read-only
   SQL in place. Do not roll back audit evidence or mutate historical values.

Index creation has a short lock timeout and may need an owner-reviewed maintenance
window on a busy ledger. This is deliberately not CONCURRENTLY inside a transaction.
Per-request projection cost on large list/dashboard populations needs representative
Development load testing; no production performance claim is made.

## Validation and residual risks

Results are recorded in the focused PR. Native tests use fresh loopback-only,
tmpfs PostgreSQL 16 containers and forcibly replace application DATABASE_URL.
No production database, hosted SQL or automatic deployment is involved.

Remaining boundaries: historical imports/custom hosted triggers may still contain
unverified labels; the read projection surfaces gaps without rewriting history.
Legacy requester acknowledgment counters support two decimals; quantities that
cannot be represented exactly are rejected and require a separately approved
schema/policy change. Existing raw archive/workload labels remain compatibility
fields; consumers must use verified dimensions for fulfillment claims. Unrelated
legacy authorization findings are not declared remediated by Task 6A. Source
inventory cannot prove absence of out-of-repository scripts or hosted custom SQL.


## Executed checks

| Command (application directory) | Result |
| --- | --- |
| Backend `npm test -- --runInBand` | PASS: 224 suites, 1,869 tests |
| Backend `npm run test:completion-postgres` | PASS: 35 canonical completion scenarios, plus actual request-list/dashboard stock compatibility and complete SQL 054/055 technical workflow regressions |
| Backend `npm run test:p2p-postgres` | PASS: 92 PostgreSQL P2P/authorization/technical-clearance regressions, including AUD-009 |
| Backend `npm run test:request-workspace-postgres` | PASS: actual full-details, native audit IDs, authorized timelines and institute visibility |
| Backend `npm run test:device-demos-postgres` | PASS: existing Medical Device selection, stock-resolution staleness, supplier scope, signed evaluation, COO decision and rollback compatibility |
| Frontend `CI=true npm test -- --runInBand ProcurementCompletionPanel RequestDetailWorkspace ProcureToPayLifecyclePage Dashboard` | PASS: 5 suites, 19 tests |
| Frontend `CI=false npm run build` | PASS with two existing lint warnings: DepartmentRequestedItemsBoard unused actionLoading; fixed-assets PhysicalInventory load dependency. CI=true treats those pre-existing warnings as errors |
| Changed backend JavaScript `node --check`; `git diff --check` | PASS |

The 35 native scenarios include all 22 requested cases and additional exact-once
completion, actual warehouse controller retry/partial-close behavior, requester's
no-duplicate-intake confirmation, actual case outbox retries, concurrent reversal,
pending approval, fresh explicit permissions/inactive users, browser-role function
access, existing all-stock approval shortcut and populated repeat SQL preservation.
Unit regression also verifies that an unanswered receipt reminder cannot acknowledge
receipt and that separate warehouse installments retain distinct outbox evidence.
Stale SQL-shape assertions now refer to shared status projections. The Item Master
writer-boundary test explicitly classifies the existing disposable schema runner as
a fixture, while retaining the production DML boundary and checking its disposable
URL validation.

## Exact changed files

The following is the task-owned file list; unrelated installed-skill files are excluded.

- `docs/audits/2026-11-aud011-canonical-completion.md`
- `docs/audits/2026-11-aud011-completion-readers.jsonl`
- `docs/audits/2026-11-aud011-completion-writers.jsonl`
- `purchase-backend/__tests__/procurementPerformance.test.js`
- `purchase-backend/__tests__/procurementPerformanceActivityPopulation.test.js`
- `purchase-backend/__tests__/supplyChainPerformanceRegression.test.js`
- `purchase-backend/controllers/dashboardController.js`
- `purchase-backend/controllers/procureToPayController.js`
- `purchase-backend/controllers/requests/procurementItemEventsController.js`
- `purchase-backend/controllers/requests/requestWorkspaceController.js`
- `purchase-backend/controllers/requests/updateRequestsController.js`
- `purchase-backend/controllers/utils/remindPendingReceipts.js`
- `purchase-backend/controllers/warehouseSupplyController.js`
- `purchase-backend/domain/statusConstants.js`
- `purchase-backend/domain/statusTransitionService.js`
- `purchase-backend/integration/procurementCompletion.postgres.js`
- `purchase-backend/integration/stockFulfilledRequests.js`
- `purchase-backend/integration/technicalWorkflow.js`
- `purchase-backend/package.json`
- `purchase-backend/policies/requestPolicy.js`
- `purchase-backend/repositories/procurementPerformanceRepository.js`
- `purchase-backend/routes/procurementPerformance.js`
- `purchase-backend/routes/requests.js`
- `purchase-backend/scripts/auditCompletionWriters.js`
- `purchase-backend/scripts/testBackendContractRefresh.js`
- `purchase-backend/scripts/testBackendSchemaReconciliation.js`
- `purchase-backend/services/deviceDemoGate.js`
- `purchase-backend/services/deviceDemoService.js`
- `purchase-backend/services/goodsReceiptService.js`
- `purchase-backend/services/p2pCompletionService.js`
- `purchase-backend/services/procurementCompletionService.js`
- `purchase-backend/services/procurementPerformance/procurementEvidenceService.js`
- `purchase-backend/services/requestFulfillmentSql.js`
- `purchase-backend/services/requestLifecycleService.js`
- `purchase-backend/sql/manual/067_canonical_procurement_completion.sql`
- `purchase-backend/tests/fetchRequestsController.domain.test.js`
- `purchase-backend/tests/legacyInspectionReceivingBoundary.test.js`
- `purchase-backend/tests/markRequestAsCompleted.test.js`
- `purchase-backend/tests/phase5aCanonicalItemWriterBoundary.test.js`
- `purchase-backend/tests/procurementHistoryController.test.js`
- `purchase-backend/tests/procurementItemEventsController.test.js`
- `purchase-backend/tests/receiptReminderCompletionBoundary.test.js`
- `purchase-backend/tests/warehouseSupplyConflict.test.js`
- `purchase-frontend/src/components/ProcurementCompletionPanel.jsx`
- `purchase-frontend/src/components/ProcurementCompletionPanel.test.jsx`
- `purchase-frontend/src/locales/interface.ar.json`
- `purchase-frontend/src/locales/interface.en.json`
- `purchase-frontend/src/pages/Dashboard.jsx`
- `purchase-frontend/src/pages/ProcureToPayLifecyclePage.jsx`
- `purchase-frontend/src/pages/RequestDetailWorkspace.jsx`
