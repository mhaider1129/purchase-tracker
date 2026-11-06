# SCOP Phase 1 operational foundation

Implementation baseline: `2d27e3f2`, 6 November 2026 (Asia/Baghdad). This is an additive, explicitly enrolled operational overlay. It does not replace requests, approval routes, procurement cases, receipts, inventory, contracts, AP or payments.

## Scope amendment and correctness decisions

The approved [roadmap](scop-implementation-roadmap.md) called its first small PR P1 (Central Supply marker hardening), and deferred line coordination to P3. The implementation request explicitly expands Phase 1 to classification and multi-source item allocations. This PR includes that P1 hardening and the requested backend foundation. It does not implement SAP integration, a center portal, new technical inspection, automatic residual procurement or a replacement approval engine.

Repository inspection exposed two correctness issues requiring a bounded initial contract:

- A warehouse-supply item may already point back to an original requested item. Enrolling both would double the same demand. Such diverted warehouse lines must use the original `requested_item` profile; independently created warehouse items can enroll natively.
- Canonical execution lines do not yet carry an allocation ID. A PO, GR or actual warehouse-supplied issue row is therefore attributed **whole** to one allocation, enforced by unique canonical foreign keys. Do not prorate a receipt's technical approval or reuse the same line in two allocations. Create separate canonical execution lines for separate allocations. In particular, two issues of 4 and 6 units against one 10-unit warehouse requirement are separate `warehouse_supplied_items` execution rows. Their read-only `canonical_supply_line_quantity` projection preserves the existing aggregate supply invariants and attributes each issue once; it does not post inventory or alter aggregate completion. Binding progress is read-only attribution, not authority to order or reserve stock. Existing execution routes are not re-engineered in this phase.

This foundation must not be advertised as global enforcement of source-channel policy in all legacy execution routes. Existing writers still enforce their canonical approval, scope, inventory and financial controls. Allocate and execute in reviewed pilot cohorts; future execution-aware integration must carry allocation IDs at canonical service boundaries before claiming complete prevention of off-plan procurement.

## Data model and ownership

Manual SQL **072_scop_operational_foundation.sql** adds only supporting operational structures:

| Structure | Meaning |
|---|---|
| `scop_request_purposes` | Normalized purpose vocabulary: routine, replacement, recurring, patient-specific, urgent. Labels grant no emergency approval bypass. |
| `scop_fulfillment_policies` | Normalized standard, center-first, stock-first and contract-first classification. Nonstandard policies require an explicit evidenced local-allocation exception. They do not replace procurement approvals. |
| `scop_requirement_profiles` | Explicit enrollment and classification of one canonical request item; institute/request, original item, existing `item_categories` category, requesting function via original `departments` ID, purpose, policy, UOM/quantity and approval snapshot. Unique source identity; immutable after enrollment. |
| `scop_fulfillment_allocations` | Positive allocated responsibility quantities, source channel, responsible user and applicable warehouse/contract/transfer references. Split lineage, revision and terminal history are preserved. |
| `scop_allocation_evidence` | Immutable unique links to existing `purchase_order_items`, `goods_receipt_items` or `warehouse_supplied_items`. No receipt/inventory/payment copy and no independent inspection counters. |
| `scop_allocation_commands` | Successful command fingerprint/result with institute, actor and request identity. Transactional idempotency; never a SAP posting queue. |

Profiles capture real request approval and item provenance. Source rows and requesting department must belong to the same institute. The department is the requesting function's existing organizational identity; no parallel department/function master is introduced. Classification does not change `request_type`, item identity, requester, approval route, procurement priority, buyer assignment or workload policy. A new category/purpose/policy selection does not automatically recalculate an old approval.

`WAREHOUSE_STOCK`, `CENTRAL_SUPPLY`, `LOCAL_PROCUREMENT`, `CONTRACT` and `TRANSFER` are fulfillment responsibility channels. Stock allocations are not inventory reservations. Center allocations are not center acceptance promises. Contract allocations are not contract consumption/financial commitments. Existing blanket arrangements use the canonical contract/framework-agreement lifecycle; no standalone blanket-order engine was found or introduced. Transfer allocations refer to an already authorized transfer header and exact stock line; they do not dispatch it.

## Implementation files

- [Foundation service](../../purchase-backend/services/scopFoundationService.js): explicit enrollment, current authorization, transaction/idempotency boundary, source responsibility and transitions.
- [Evidence projection](../../purchase-backend/services/scopAllocationEvidence.js): unique canonical execution-line binding, original source provenance and live quantities.
- [Quantity/lifecycle policy](../../purchase-backend/policies/scopFoundationPolicy.js): exact decimal arithmetic, allocation ceilings and independent derived states.
- [API router](../../purchase-backend/routes/scopFoundation.js): protected backend endpoints with the feature gate.
- [Database release verifier](../../purchase-backend/services/databaseReleaseService.js): explicit minimum/forbidden SCOP grants alongside existing startup checks.
- [PostgreSQL profile](../../purchase-backend/integration/scopFoundation.postgres.js): actual canonical receiving/inspection/issue services plus allocation, authorization, concurrency and rollback scenarios.

## Quantity and state contract

All API quantities are exact decimal strings, up to six decimal places and 18 integral digits. Numeric integer inputs remain compatible; fractional JSON numbers, exponential notation, negatives, zero allocations, excess precision and non-finite values are rejected. No JavaScript floating-point quantity arithmetic is used. Existing canonical request quantities remain unchanged.

- Sum of ACTIVE and CLOSED allocation quantities cannot exceed the explicitly enrolled approved quantity or the current canonical quantity. SPLIT parents and CANCELLED rows are history and do not count again. A split replaces an unused parent with 2–20 positive parts whose sum exactly equals the parent.
- Request row locking serializes capacity changes. The database trigger also guards aggregate capacity and shared transfer-line capacity. Expected revisions fence simultaneous changes to one allocation. Actor/responsibility and source records are locked and validated before mutation.
- A reduced canonical quantity, changed item identity or changed approval-route snapshot blocks new commands pending reconciliation. An increase does not silently expand the frozen profile ceiling. GET exposes approval drift and current evidence.
- `ordered_quantity` is issued PO-line quantity converted through its immutable base-UOM snapshot. Draft/cancelled POs cannot prove ordering. A full PO line cannot be attributed beyond an allocation's quantity.
- `received_quantity` preserves gross canonical GR history. `rejected_quantity` includes damaged and technically rejected quantities; `short_quantity` remains separate. Replacement deliveries can make gross received exceed allocated demand; rejected history does not inflate accepted progress.
- `accepted_quantity` follows canonical technical receipt outcomes and, for inventory, the SQL 068 receipt-linked available movement evidence. Pending inspection and quarantine are distinct. A GR header or locally entered purchased quantity is insufficient.
- `issued_quantity` comes from existing canonical warehouse-supply issue evidence. A transfer's dispatch/arrival does not count as issue to a department. Canonical stock corrections and reversals remain owned by the inventory services.
- Warehouse fulfillment requires issue evidence. Existing non-inventory/direct goods acceptance can satisfy direct fulfillment through canonical receipt evidence; direct delivery and warehouse issue cannot both be credited to one allocation. Mixed delivery modes require separate allocations. Service/milestone acceptance is deliberately unsupported in this initial goods-based evidence API.
- `fulfilled_quantity` and `outstanding_quantity` are independent from purchasing. GET labels these quantities `ATTRIBUTED_LINES_ONLY` and also exposes the unchanged canonical completion projection; unbound historical execution must not be mistaken for missing physical activity. Item totals sum only allocations marked `counts_toward_requirement`; item outstanding also includes unallocated demand. Do not sum parent and child split rows or add ordered/received/accepted/issued as if they were disjoint buckets.
- Closure records an operational allocation state after full canonical fulfillment with no evidence conflict or pending inspection. It never writes request completion. If evidence is subsequently reversed, GET exposes current quantities and closure validity; it does not rewrite history.

Independent dimensions returned by GET:

| Dimension | Authority |
|---|---|
| Approval | Current request/item state and unresolved approval steps, plus immutable enrollment snapshot |
| Sourcing | Allocation responsibility and issued canonical PO evidence |
| Physical fulfillment | Canonical receipt/inspection/availability/issue evidence, with typed quantities |
| Financial settlement | Read-only request-scoped canonical AP currency totals: NOT_POSTED, OPEN or SETTLED; RESTRICTED without existing P2P lifecycle-view authority; never inferred from physical completion |

Financial amounts require existing `procure-to-pay.lifecycle.view` in addition to foundation read authority. Financial totals are at **request scope**, not prorated to allocations. They are current local canonical evidence, not SAP confirmation. No API can modify financial state, stock balances, inspection decisions or PR completion.

### Release-governance compatibility correction

The existing runtime verifier assumed all business tables needed SELECT/INSERT/UPDATE/DELETE. That assumption is incompatible with immutable classification/evidence/command history and read-only classification reference data. Phase 1 adds explicit required **and forbidden** privilege checks for the six new tables. The migration grants only SELECT to lookups, SELECT/INSERT to history, SELECT/INSERT/UPDATE to allocations, sequence usage and backend-only trigger-function execution. Existing tables retain their established checks. Disposable governance tests reject excess DELETE/UPDATE grants and missing required INSERT authority.

## Authorization

`SCOP_FOUNDATION_ENABLED` must equal the literal `true` to expose the new endpoints; otherwise they return 404 `SCOP_DISABLED` before foundation database access (standard authentication/audit middleware still applies). The default is disabled. Existing workflows remain reachable through their unchanged routes.

New permissions are cataloged by migration and startup verification, with **no automatic user or role grants**:

- `scop.allocations.view`: read owned-institute classification/allocation progress.
- `scop.allocations.manage`: classify/enroll and change owned-institute fulfillment responsibility; also read.
- `scop.allocations.override-policy`: in addition to manage, record an evidenced local-source exception under a nonstandard sourcing policy. This is an operational allocation exception, not authority to place a PO or bypass approval.

Existing permission middleware protects writes; the service reloads active actor, institute and explicit grants inside every transaction, including replay and reads. Request/item relationships derive institute from the database. Body ownership/status fields are rejected. No role name or null institute grants cross-institute request access.

Responsible users must be active, same-institute and have allocation-management authority. Local-procurement responsibility additionally reuses existing procurement assignee eligibility. Warehouse-backed allocations reuse warehouse scope checks. Contract selection requires current `contracts.manage`, owned active contract and matching canonical generic/product identity. Transfers require authorized state, matching stock/UOM, destination institute, `inventory.transfer`, and existing explicit, bounded cross-institute authority for a foreign origin. This grants no access to a foreign institute's request.

Center/local exception notes, reasons, original/new responsibility and source links are included in required audit evidence. Business mutation, audit, command result and evidence binding share a transaction; failure rolls all of them back. No new business notification is invented for allocation metadata changes.

The existing Central Supply marker now reloads `requests.manage`, uses strict institute equality, treats repeated boolean state as a no-op, and requires transactional audit. Its compatibility `request_logs` sink remains optional after the mandatory audit. Existing foreign or malformed IDs remain unavailable. This hardening operates independently of the new feature flag; it fixes the established route without changing its boolean contract.

## API contract

Base path: `/api/scop`. Existing bearer authentication and error envelope apply. Responses are `{ "success": true, "data": ... }`; errors retain centralized status/message/code/request ID handling. Responses contain current internal operational evidence and must not be exposed as an external supplier portal.

| Method and suffix | Operation |
|---|---|
| GET `/classifications` | Active existing categories and normalized purpose/policy/source choices |
| GET `/requests/:requestId/items/:itemKind/:itemId` | Enrollment, original approval, allocations/history, current progress/totals and request-scoped financial projection |
| POST same item path + `/classification` | Explicitly enroll an approved canonical item with classification and approval snapshot |
| POST same item path + `/allocations` | Create a positive responsibility allocation within approved capacity |
| POST same item path + `/allocations/:allocationId/reassign` | Change unused allocation source/responsibility without changing its quantity |
| POST same item path + `/allocations/:allocationId/split` | Atomically replace unused parent with conserved child allocations |
| POST same item path + `/allocations/:allocationId/cancel` | Cancel unused responsibility, preserving history and releasing capacity |
| POST same item path + `/allocations/:allocationId/evidence` | Bind one whole canonical execution line; recompute current progress and reject conflicts |
| POST same item path + `/allocations/:allocationId/close` | Close this operational allocation only when canonical fulfillment is sufficient |

`itemKind` is `requested_item` or `warehouse_supply_item`. IDs are canonical positive integers. Linked/diverted warehouse items return `SCOP_USE_ORIGINAL_ITEM`; follow their existing original item reference. Standalone warehouse items retain native warehouse quantity units and cannot bind a PO/GR without a canonical requested-item ancestor. No assumed EA conversion is invented.

Every POST requires `command_key` (1–120 characters, unique within actor institute). Mutations of an existing allocation also require its current integer `expected_revision`. Replaying the identical command key/body/actor/route returns the original committed result; reusing it for another operation returns 409 `SCOP_IDEMPOTENCY_CONFLICT`. A replay response is historical; use GET for live progress. Do not generate a new key merely because an HTTP response was lost.

Classification example:

```json
{
  "command_key": "requirement-434-item-17-classification-v1",
  "category_id": 12,
  "purpose_code": "ROUTINE",
  "policy_code": "CENTER_FIRST"
}
```

Allocation example:

```json
{
  "command_key": "requirement-434-item-17-center-portion-v1",
  "source_kind": "CENTRAL_SUPPLY",
  "responsible_user_id": 42,
  "quantity": "4.000000",
  "reason": "Approved center responsibility for this portion"
}
```

Source references are strict: WAREHOUSE_STOCK requires `warehouse_id`; CONTRACT requires `contract_id`; TRANSFER requires destination `warehouse_id`, `transfer_id` and `transfer_line_id`. Other channels accept none of those fields. Reassign uses the same fields without `quantity`. Add `evidence_note` for a required policy exception. Split uses `parts` containing full allocation objects and a parent-level `reason`.

Evidence example:

```json
{
  "command_key": "allocation-9-receipt-line-22",
  "expected_revision": 2,
  "kind": "RECEIPT_LINE",
  "source_id": "22",
  "reason": "Attribute canonical delivery to the original approved portion"
}
```

Evidence kinds: `PO_LINE`, `RECEIPT_LINE`, `SUPPLY_LINE` (the actual `warehouse_supplied_items.id`, not its parent requirement ID). Bind the issued PO line first, then its GR lines. Binding neither receives stock nor signs technical acceptance. A supplied warehouse execution row must lead back through its warehouse requirement to the original requirement/department/institute; a linked line cannot be attributed twice. Canonical UOM or identity ambiguity fails closed. Existing allocations with execution evidence cannot be moved, split or cancelled via these APIs; use domain cancellation/reversal and reviewed forward reconciliation instead of erasing provenance.

Typical errors: 400 invalid body/ID/quantity, 403 missing authority, 404 disabled/foreign reference, 409 stale revision/capacity/state/UOM/evidence conflict, 503 missing reviewed database contract. Concurrency failures return 409; reload, verify the original command result and retry the same identity as appropriate.

## Manual migration and recovery

**MANUAL DATABASE MIGRATION REQUIRED:** [072_scop_operational_foundation.sql](../../purchase-backend/sql/manual/072_scop_operational_foundation.sql).

Order is existing reviewed baseline and 064–068 contracts, then governed 069 → 070 → 071 → **072**. This is a dependency description, not permission to replay frozen SQL. Existing installations at 071 need only the reviewed additive 072 governed step. Unverified older installations must use the existing release verifier and reconcile actual prerequisite contracts/receipts first.

1. Review backup/recovery capability, deployed schema/source/worker versions and the preserved `071-schema-contract.json` prerequisite. Existing source rows remain unchanged and new profiles start empty.
2. Generate the single governed step offline from repository root:

   ```sh
   node purchase-backend/scripts/databaseRelease.js plan --migration 072_scop_operational_foundation --environment development --actor REVIEWER --release REVIEWED_COMMIT --output /tmp/scop-072-reviewed.sql
   ```

3. Development owner reviews the generated SQL, source/migration checksums, prerequisite 071 execution receipt, RLS/grants, lock/statement timeouts and no historical writes. Apply manually in the approved Development SQL Editor. This task executes no hosted SQL.
4. Run the existing operator-controlled read-only release verification with a dedicated read-only connection supplied by the operator. Expect contract `hospital-erp-2026-11-scop1`. No credentials belong in this document or generated review artifacts.
5. Deploy compatible backend with the feature flag unset/false, `LIVE_ROUTING_ENABLED=false`, unchanged worker protocols and existing execution paths. Do not activate Approval Engine V2.
6. Grant reviewed capabilities through existing permission administration to named pilot personnel. Review category/purpose/policy choices and scoped warehouse/contract/transfer authority.
7. Enable the flag only in the approved pilot environment. Explicitly enroll selected fully approved items, allocate portions and bind existing canonical evidence; no bulk lifecycle conversion. Reconcile totals and logs before expanding use.

Recovery is containment and forward correction: disable the feature flag to stop all new foundation traffic, retain canonical services and all profile/allocation/evidence/audit/command history, reconcile any committed command by its key, then deploy a reviewed compatible fix. A failed migration transaction rolls back; a successful governed replay is idempotent. Do not drop the new tables, remove audit evidence, reset sequences, delete profiles or reverse canonical stock/payments as a rollback of operational metadata. Database/source contract remains required for this backend even when the feature is disabled. A cold rollback to the pre-Phase-1 verifier is unsupported after 072: its blanket CRUD requirement rejects the new least-privilege tables. Plan a controlled SQL/backend release window, retain a compatible forward-fix artifact, and use flag disablement for immediate containment. Do not broaden history-table grants to make an old binary start.

## Verification and remaining limitations

Executed locally using isolated test configuration and runner-created loopback-only PostgreSQL:

| Check | Result |
|---|---|
| Backend unit/regression suite | 229 suites, 1,927 tests passed |
| Existing frontend request/Central Supply consumers | 2 suites, 15 tests passed |
| SCOP PostgreSQL profile | 34 foundation scenarios plus 43 canonical receipt/inspection/inventory scenarios passed |
| Database governance PostgreSQL profile | 31 scenarios passed, including exact grants, rollback, governed replay, source digest and startup |
| Existing canonical P2P PostgreSQL suite | 94 tests passed |
| Populated schema/backend query compatibility | 1,868 query plans passed; zero failed plans or postflight findings |
| Historical contract preservation comparison | Zero incompatible changes to the 071 contract; six additive operational tables |
| Release contract/localization/offline plan | Passed; plan explicitly makes no database connection |

The CI PostgreSQL matrix includes `scop-foundation`; migration contract/source checks and existing release gates remain mandatory. Local verification does not certify the hosted schema, SAP connectivity or operational acceptance. No frontend application source changed; the full frontend build and all existing worker profiles remain required CI gates. A passing test is not authorization to deploy.

Known boundaries:

- No SAP posting, external center submission/acceptance protocol, auto-procurement, financial mutation or inventory reservation. Canonical AP/payment and stock services remain authoritative today.
- Center commitment acceptance is not technical acceptance. This phase attributes existing canonical receipt evidence; standalone external center delivery without a canonical source document remains uncounted, visibly pending.
- Whole-line attribution, compatible base-UOM goods evidence and resolved generic/product identity are required. Service milestones, ambiguous free-text transfers/contracts, partial redistribution of executed lines and automated reconciliation need separately reviewed work.
- No reclassification or expansion of a frozen enrolled ceiling after approval amendments; flag drift and reconcile explicitly. No automatic historical enrollment or repair.
- Closure is operational history. Later canonical reversals can invalidate its current evidence; GET must display that discrepancy rather than interpret CLOSED as irrevocable physical truth.
- Financial evidence is request-scoped and currency-separated. It is not allocation-level settlement or confirmation that SAP has posted anything.
- Existing inventory helper limitations remain canonical; unsupported/ambiguous evidence cannot be guessed into an accepted result. Existing AUD-008/AUD-009 and 067/068 completion protections remain in force.
