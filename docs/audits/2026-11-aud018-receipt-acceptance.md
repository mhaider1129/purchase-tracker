# AUD-018 — Goods Receipt and technical acceptance integration (Task 6B)

Reviewed 5 November 2026 (Asia/Baghdad), against current master `67c186ea`.
Phase 6A / PR 95 is merged and incorporated. Reviewed the October system audit,
remediation backlog/integration matrix, AUD-008/AUD-009 remediation reports,
and the Phase 6A authority model. No hosted SQL or production data was accessed.

## Revalidated root cause

The original audit identified a missing disposition-acceptance outbox event.
**That producer/consumer gap is already fixed by Phase 6A on this HEAD.** Its
`GOODS_RECEIPT_ACCEPTANCE_APPLIED` event, independent delivery inspection,
transactional posting and case consumer are retained rather than duplicated.

Remaining reproduced gaps:

- An INVENTORY receipt requiring inspection could be persisted without an actual
  warehouse. Warehouse validation lived inside the immediate accepted-stock posting
  branch, which is skipped while acceptance is held at zero. A real PostgreSQL
  test first reproduced the missing rejection on unchanged master receiving code.
  The canonical GR service now requires the warehouse before persisting any inventory
  receipt/task; existing authorization still validates its actual ownership.

- SQL 067 recognizes AVAILABLE `GOODS_RECEIPT` movements, but an authorized
  quarantine release uses the existing status-transfer coordinator's paired
  adjustment movements. There was no durable receipt-source binding for those
  movements. General stock could become available while receiving/case completion
  remained unaccepted. Matching by stock item, amount, batch or name would risk
  crediting another receipt in a pooled stock balance.
- SQL 067's quarantine field also represented a pending technical hold on an
  AVAILABLE-designated line. Pending review and physical quarantine needed
  separate quantities; technical acceptance and usable stock availability were
  not separately exposed.
- Reversal arithmetic considered direct compensations only, missing a reversal
  of a prior reversal. Completion locking also needed that descendant lineage.

A real PostgreSQL regression applies unchanged current-master SQL 067 inside a
rollback-only transaction **after a canonical, authorized quarantine release**.
It returns accepted quantity `0` / receipt incomplete. Restoring SQL 068 through
rollback returns accepted quantity `10` / receipt complete, with identical
historical row snapshots. This reproduces the difference without hosted SQL or
rewriting inspection/financial data.

## Ownership and event boundaries

| Operation | Existing owner | Authoritative outcome / consumers |
| --- | --- | --- |
| Create Goods Receipt | `goodsReceiptService.createGoodsReceipt`, connected P2P repository | Locked PO/lines, gross/damaged/short quantities, real actor and actual request/warehouse ancestry; `GOODS_RECEIPT_POSTED` |
| Determine required inspection | `deliveryInspectionService.prepare/generate`, technical responsibility profiles | Independent assignments, immutable profile snapshot, required task; zero accepted stock before application |
| Attest and authorize disposition | `deliveryInspectionService.opinion/decide` | Required checks/files, independent clinical/specialist signatures and SCM authorization; decision alone posts no inventory |
| Apply authorized disposition | `goodsReceiptService.applyTechnicalDisposition` | Existing task advisory lock, PO/line/GR locks, exact accepted/rejected delta, canonical inventory adapter, immutable application history/audit, idempotent acceptance outbox event |
| Post accepted receipt inventory | `goodsReceiptInventoryAdapter` → existing `inventoryPostingService` | Canonical immutable movements and exact allocations, owned warehouse and immutable PO UOM snapshot |
| Release/reclassify stock status | Existing `inventoryStatusTransferService` → `postStatusTransferMovement` | Same paired debit/credits, same inventory permissions/allocations/audit; now optional verified receipt provenance and mapped stock-status event |
| Read receiving/fulfillment | Phase 6A `canonical_procurement_completion`, `procurementCompletionService` | Same request/item/case/API/report authority, additional typed acceptance/hold quantities; no second status engine |
| Consume evidence | Existing `notificationOutboxProcessor` / `procurementEvidenceService` | Re-read current canonical quantities, idempotent case activities, monotonic historical case projection |
| Issue warehouse stock | Existing warehouse supply / inventory posting services | AVAILABLE stock only, actual source movements; separate department fulfillment evidence |
| Legacy inspection form | AUD-008 controllers/summary helper | Evidence only. Cannot apply required GR acceptance, post stock or mutate PR status |

No new inspection service, inventory balance writer, receiving endpoint, technical
approval engine or portal feature is introduced. The extension is to the existing
internal status-transfer service API. There is no new public release endpoint or
release UI in this task.

## Acceptance and quantity invariants

All receiving quantities use persisted GR lines and immutable PO UOM conversion.
API quantities remain decimal strings; no cross-UOM quantity totals are invented.
For each line, usable received quantity is gross received minus damaged and short
quantities, using the established GR semantics.

| Quantity / flag | Rule |
| --- | --- |
| `delivered_quantity` | Actual gross GR line quantity under the correct PO/request ancestry; a header alone contributes nothing |
| `technically_accepted_quantity` | Applied canonical technical acceptance when inspection is required; otherwise existing authenticated receiving acceptance policy |
| `pending_inspection_quantity` | Required inspection's usable received balance less applied accepted and rejected quantities; opinions/authorization alone do not clear it |
| `rejected_quantity` | Damaged plus applied technical rejection, separately visible; replacement must have its own receipt and acceptance |
| `quarantined_quantity` | Actual source-bound QUARANTINE stock, plus physically quarantined pending inspection quantity not yet posted. An AVAILABLE-designated pending review is a pending inspection, not a quarantine balance |
| `accepted_quantity` / “Available accepted” | Direct noninventory acceptance under existing rules; inventory acceptance capped by both quality-accepted quantity and net AVAILABLE receipt-source ledger quantity |
| `accepted_pending_release_quantity` | Quality acceptance not yet available for receiving/fulfillment; a quarantine/recall/reversal cannot silently become usable accepted stock |
| `partially_received` | Some eligible usable accepted receiving, without all eligible lines complete; distinct from partial department fulfillment |
| `receipt_complete` | All eligible demand lines satisfied by the canonical usable receiving or established stock-only issue path |
| `fulfillment_complete` | Existing Phase 6A department handoff rules; warehouse intake/technical acceptance alone remains insufficient |

Rejected quantities cannot be released by relabeling them: required inspection
posts only the accepted delta; the rejected portion creates no receipt inventory
movement to release. Pending inspection cannot consume another receipt's movement
or borrow pooled stock source capacity. Rejection frees replacement capacity under
the existing canonical GR capacity rules. Partial acceptance retains the remaining
hold. Multiple suppliers, POs and receipts aggregate by actual immutable source
identities, not activity counts or document-link joins.

SQL 068 reads original GR movements, explicitly linked status-transfer debit/credits
and their recursively scoped compensating reversals. Debit movements are counted
once even when one debit has multiple credit allocations. Credits, source line,
stock identity, warehouse, institute and statuses must agree with the durable link.
Unpaired reversal of a status-transfer leg invalidates usable source quantity until
canonical compensations restore conservation; the projection flags conflicting
evidence and does not guess a repair.
Generic adjustments and transfers cannot claim a GR acceptance relationship merely
by resembling one. An unlinked status change after a matching receipt movement
(same institute/warehouse/stock and tracking identity) makes its current availability
ambiguous: the projection returns zero usable acceptance and flags an evidence gap.
It does not guess which pooled receipt was quarantined or released. This also
prevents an unlinked quarantine from leaving a false accepted-delivery completion.

If existing accepted/rejected counters violate usable received conservation, the
canonical projection marks conflicting evidence and blocks completion. Inspection
application retains its existing row locks and conservation guards; this task
neither repairs counters nor backfills historical decisions.

## Receipt-aware status transfer and durable provenance

Existing `transferStatus`, `quarantine` and `releaseQuarantine` accept an optional
`receiptMovementId`, identifying the original canonical GR inventory movement.
For example, an **already authorized internal caller** can use:

```js
await inventoryStatusTransferService.releaseQuarantine({
  receiptMovementId: originalCanonicalReceiptMovement.id,
  quantity: '4', // inventory/base units, not purchasing packages
  reason: 'Authorized release of the conforming receipt quantity',
  actor: authenticatedActor,
  idempotencyKey: existingOperationKey,
});
```

The server derives actual receipt/request/item, institute, warehouse, stock item,
tracking identity and base UOM. Supplied conflicting references are rejected.
The actor is reloaded as active with current explicit permissions and warehouse
assignment. Existing quarantine/release/recall and warehouse override permissions
still apply within the receipt institute. Receipt attribution retains canonical GR
institute isolation; generic inventory cross-institute authority does not grant
foreign receipt authority. Generic inventory transfer behavior is otherwise unchanged. No SCM user ID or new role exception is hardcoded.

The original movement is locked before checking its remaining source quantity.
The existing inventory posting advisory mutex and ordered outbound balance locks
serialize the check with issues, including commands without tracking filters.
For AVAILABLE source transfers, a net unreversed pooled issue after the receipt
requires controlled source review: historical accepted intake is not proof those
units remain available for receipt-specific retagging. No FIFO/source consumption
allocation is invented. Generic transfers retain their existing policies and lock
affected original GR movements before posting, serializing quarantine with
lifecycle completion evidence locks.
The warehouse row is held FOR SHARE, preventing concurrent deactivation or
ownership edits from invalidating the authorized scope before commit.
Status-transfer execution continues through the **existing** posting coordinator.
An append-only `goods_receipt_inventory_status_links` bridge records original
movement, receipt line, actual debit/credit movements, actual actor/institute/
warehouse, statuses, quantity, reason and timestamp. It is provenance, not another
inspection decision table or inventory balance. There is no historical backfill.

Exact retries use existing normalized debit/credit idempotency keys, produce no
new quantity, link, audit or event, and cannot substitute another original receipt.
Separate partial releases have separate movement/event identities. The mapped
`GOODS_RECEIPT_STOCK_STATUS_CHANGED` event is published in the same transaction;
the consumer re-reads current quantities instead of trusting supplied completion
flags. Audit or event failure rolls back stock, links and publication together.

The existing inventory posting engine has a Number-based interface. Receipt-aware
operations check decimal round-trip representability and verify persisted credit
quantity conservation before committing. Unsupported precision fails with a
controlled error instead of rounding evidence. This does not rewrite the general
inventory allocator or claim universal arbitrary-precision inventory support.

Completion holds shared locks on contributing movements **and their reversal
descendants** until lifecycle audit/outbox commit. Existing reversal/status-transfer
locks serialize changes to that evidence. Acceptance/status application never
updates PR approval status or automatically marks a request completed.

## Compatibility and boundaries

- AUD-008 legacy forms remain contained and evidence-only.
- AUD-009 quotation fingerprints, independent technical sign-off, signed review
  provenance and issue-time PO clearance are unchanged.
- Existing required reviewer evidence and opinion agreement rules are unchanged.
- PO `received_quantity` / `PO_DELIVERED` retain their existing quality-acceptance
  cache semantics. They do not prove AVAILABLE stock or department fulfillment;
  canonical dimensions remain authoritative for those claims.
- Stock-only warehouse fulfillment still needs no PO. Generic inventory status
  transfers without receipt context retain existing behavior but are not silently
  attributed to a procurement receipt. A caller claiming `goods_receipt` source
  must supply the verified original movement.
- Case stage monotonicity/workload/priority policy remains unchanged. Raw historical
  `DELIVERED` can remain after later authorized re-quarantine; current canonical
  acceptance/fulfillment dimensions expose the new evidence. No historical case,
  request timestamp or rank is rewritten.
- Previously unlinked status-change history requires controlled evidence review. An
  automatic match by amount, stock name, lot or warehouse is intentionally absent.
- New fields are additive; `accepted_quantity` retains its Phase 6A usable-acceptance
  meaning. The shared panel labels quality acceptance, pending inspection, accepted
  unavailable quantity and available accepted quantity separately, in English/Arabic.
  The performance page also exposes the existing canonical accepted-delivery and
  department-fulfillment case counts separately, without changing workload formulas.

## Database and manual Development rollout

**MANUAL DATABASE MIGRATION REQUIRED**:
`purchase-backend/sql/manual/068_goods_receipt_acceptance_integration.sql`.

Current master migration inventory ended at 067 when 068 was assigned. No frozen
migration is edited. 068 adds the empty immutable bridge/index, a SECURITY INVOKER
read function and a forward replacement of the Phase 6A read-only projection. It
contains no historical status/inspection/financial DML. RLS is enabled on the
bridge, browser/PUBLIC access is revoked, and existing `service_role` receives
only the required SELECT/INSERT/sequence/function grants.

1. Review 068 against the current canonical schema and applied 067 in Development.
   Verify the backend connection uses the table owner or the trusted existing
   BYPASSRLS service role. A separate restricted backend DB role requires explicit
   owner-reviewed permissions/RLS configuration; do not grant browser access.
2. Run the disposable tests below, then exercise representative real Development
   receipt/profile/UOM/lot data. Inspect list/report query plans and timing.
3. Apply 068 manually through the owner's SQL process **before deploying code**.
   New completion reads fail closed with an actionable schema-required response
   if either 067 or the 068 read function is absent. Review the short index/DDL
   lock timeout and choose an appropriate maintenance window.
4. Verify a held receipt, partial/final independent acceptance, rejection and
   replacement, linked quarantine release, retry, actual issue, audit history and
   outbox processing. Confirm raw PR approval fields do not change.
5. Keep `LIVE_ROUTING_ENABLED=false`; do not activate Approval Engine V2.
   No merge, deployment or hosted SQL execution is performed by this task.
6. Rollback application code if necessary; leave additive provenance/history in
   place. Do not delete links, rewrite decisions, replay frozen SQL over the new
   projection, or silently backfill old release relationships.

## Verification

Results and all 22 requested scenarios are detailed in the focused PR. The native
suite uses fresh loopback-only tmpfs PostgreSQL 16 containers and replaces
DATABASE_URL with the validated disposable URL before importing application code.
No hosted SQL is used. It exercises real receiving, signed inspection decisions,
posting, audit/outbox, source locks and immutable populated migration repetition.
The unchanged master projection is tested transactionally as the reproduction.

## Remaining risks

Hosted triggers, role/RLS configuration and custom scripts were not inspected.
Existing held receipts without warehouses are preserved and require controlled
source correction; no warehouse or inspection outcome is automatically backfilled.
Large receipt histories and recursive reversal chains require representative
Development query-plan/load testing. Historical status changes without source links
remain unverified until separately reviewed. Receipt-specific retagging after net
pooled issue is conservatively refused; no new source-consumption allocator is
introduced. Noninventory quarantine has no stock movement to release; its unresolved
correction policy must not be bypassed by inventing an inventory posting.
Services/milestones, ambiguous UOM
policies and partial-cancellation policy boundaries remain as documented in Phase
6A. General inventory allocation's numeric precision limits are retained; the new
receipt-aware path fails closed on unrepresentable quantities. This task adds no
new public quarantine-release UI/endpoint or approval policy.


### Executed checks

| Check | Result |
| --- | --- |
| Backend `npm test -- --runInBand` | PASS: 224 suites / 1,869 tests |
| `npm run test:receipt-acceptance-postgres` | PASS: 43 real PostgreSQL scenarios |
| `npm run test:completion-postgres` | PASS: all 35 Phase 6A scenarios, stock list/dashboard compatibility and full SQL 054/055 technical workflow regressions |
| `npm run test:p2p-postgres` | PASS: 92 existing PostgreSQL P2P/security/technical-clearance regressions |
| `npm run test:request-workspace-postgres` / `npm run test:device-demos-postgres` | PASS: owned workspace/audit visibility and existing medical-device selection/clearance workflows |
| Targeted frontend tests | PASS: 6 suites / 22 tests (completion panel, request/P2P/dashboard and performance reporting) |
| `CI=false npm run build` | PASS with two pre-existing lint warnings: DepartmentRequestedItemsBoard unused actionLoading; fixed-assets PhysicalInventory effect dependency. CI=true treats these existing warnings as errors |

The source-format architectural test in `phase3bIntegrity.test.js` now checks the
same permission codes without depending on single versus double quote style.
Its controlled-posting assertions and all runtime authorization checks remain.
Runtime status-transfer mocks now provide the transaction query method used by
the receipt-evidence lock; actual lock behavior is tested in PostgreSQL.

### Requested regression matrix

The dedicated native suite is
`purchase-backend/integration/goodsReceiptAcceptance.postgres.js`.

| Requested case | Actual regression evidence |
| --- | --- |
| 1. Full receipt accepted | Independent opinions + SCM decision + canonical application → accepted inventory 10; no department fulfillment |
| 2. Partial receipt accepted | Accepted 4; partially_received true, fulfillment false |
| 3. Pending inspection | GR header/line present; pending 10, available accepted 0, no stock |
| 4. Entire receipt rejected | Rejection 10; no accepted stock; replacement capacity retained |
| 5. Partial rejection | Accepted 6 / rejected 2 / pending 2; distinct quantities |
| 6. Quarantine | Technical acceptance 10 but quarantine 10 / available accepted 0; issue refused |
| 7. Authorized release | Existing status-transfer operation + source provenance → accepted 10, case DELIVERED, department fulfillment false |
| 8. Multiple GRs | Separate accepted receipts of 4 and 6 accumulate to 10 |
| 9. Multiple POs | Two owned suppliers/POs; first receipt alone cannot complete; second independently accepted receipt completes receiving |
| 10. Replacement | Rejected original 10 followed by independently accepted replacement 10; accepted stays 10 |
| 11. Duplicate acceptance | Retry leaves rows, audit, stock and outbox unchanged |
| 12. Concurrent acceptance | Two real transactions; exactly one application posts stock |
| 13. Foreign institute | Actual foreign actor cannot apply or replay local receipt/release |
| 14. Foreign warehouse | Receiving substitution and receipt-source warehouse substitution rejected; required-inspection inventory receipt without a warehouse rejected before persistence |
| 15. Unauthorized reviewer | Unassigned reviewer denied; existing SQL 054/AUD-009 suite retains independent signatures, evidence and clearance tests |
| 16. Legacy isolation | Passed legacy form cannot release pending canonical task or mutate PR |
| 17. Issue after acceptance | Partial intake/partial issue distinct; full accepted intake + actual issue enables fulfillment |
| 18. No early issue | Required pending/quarantined intake has no usable AVAILABLE stock |
| 19. Case progress | Actual acceptance/status events and real outbox consumer; retries do not duplicate activities |
| 20. Request projection | Receiving versus department fulfillment remains separate; PR/item approval fields unchanged |
| 21. Audit rollback | Applied technical acceptance and stock-release audit/outbox failures roll back all coupled effects |
| 22. P2P compatibility | Existing 92-test P2P PostgreSQL suite passes |

Additional regressions cover current-master reproduction, per-receipt source
capacity in pooled balances, separate technical rounds on one GR line with distinct
release provenance/events, release idempotency/source substitution, concurrent
release, stale permission claims, unlinked generic release/quarantine, rejection of
ambiguous receipt retagging after pooled issue, generic quarantine/completion locking, re-quarantine,
reversal-of-reversal, unpaired status corrections, decimal conservation, browser
DB-role isolation and immutable populated migration repetition.


## Exact changed files

- `docs/audits/2026-11-aud018-receipt-acceptance.md`
- `purchase-backend/integration/goodsReceiptAcceptance.postgres.js`
- `purchase-backend/integration/procurementCompletion.postgres.js`
- `purchase-backend/integration/technicalWorkflow.js`
- `purchase-backend/package.json`
- `purchase-backend/scripts/testBackendContractRefresh.js`
- `purchase-backend/scripts/testBackendSchemaReconciliation.js`
- `purchase-backend/services/goodsReceiptService.js`
- `purchase-backend/services/inventoryStatusTransferService.js`
- `purchase-backend/services/procurementCompletionService.js`
- `purchase-backend/services/procurementPerformance/procurementEvidenceService.js`
- `purchase-backend/services/receiptInventoryStatusService.js`
- `purchase-backend/sql/manual/068_goods_receipt_acceptance_integration.sql`
- `purchase-backend/tests/phase3bIntegrity.test.js`
- `purchase-backend/tests/phase3bRuntimeIntegrity.test.js`
- `purchase-frontend/src/components/ProcurementCompletionPanel.jsx`
- `purchase-frontend/src/components/ProcurementCompletionPanel.test.jsx`
- `purchase-frontend/src/locales/interface.ar.json`
- `purchase-frontend/src/locales/interface.en.json`
- `purchase-frontend/src/pages/SupplyChainPerformancePage.jsx`
- `purchase-frontend/src/pages/SupplyChainPerformancePage.test.jsx`
