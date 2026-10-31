# Warehouse supply save conflict remediation

Date: 2026-10-31. Base: master `7291b867`.

## Reported failure and root cause

The supplied response for `POST /api/warehouse-supply/1343/items` is HTTP 409, code `INSUFFICIENT_STOCK`, available 0 and requested 3. This is the canonical inventory engine's eligible-stock check, not an Axios failure or approval conflict.

Code inspection confirmed a caller mapping defect capable of producing that exact result: `warehouseSupplyController` converted numeric `warehouse_item_batches.id` (`batch_id`) into the canonical text `batch_number` filter. Those are different identities. For example, legacy ID 500 and batch number `BATCH-A` previously produced a search for batch number `500`, finding zero stock despite an available balance.

A second confirmed integrity defect used `(request, stock item, quantity)` as the posting idempotency key. Supplying five units again from another lot reused the key with a different fingerprint and conflicted. Supplying five units again from the same lot could reuse the old movement without another stock deduction, while recording a new supplied quantity.

The production payload and database were not inspected. The response confirms the failed availability check, but cannot alone prove the actual selected batch or rule out genuinely depleted, reserved or non-issuable stock for request 1343. No live record was changed.

## Changes

- Resolve a selected balance by its actual `warehouse_stock_levels.id` constrained to the fulfilling warehouse, resolved stock item and AVAILABLE unreserved stock. Resolve legacy `batch_id` payloads through actual balance data; reject missing/ambiguous legacy selections explicitly. Never treat a numeric batch foreign key as a batch number.
- Pass the trusted balance's canonical batch/lot/serial/expiry and exact balance allocation into the existing inventory posting service. The canonical engine continues to enforce actor/institute/warehouse authority, stock status, reserved quantities, availability, signed allocations and transactional audit. A selected lot cannot silently fall through to another lot.
- Link each movement and posting key to the newly inserted `warehouse_supplied_items.id` within the same transaction. Legitimate equal-quantity installments receive distinct source-line identities. Historical movements and keys remain unchanged.
- The page submits the supplied-total snapshot that the user saw. Under the existing request row lock, a stale repeat is rejected before another supply record or movement is created. This additive field is optional for legacy clients; those clients retain existing explicit repeat-command semantics and do not gain protection against a lost-response retry. This is not full HTTP exactly-once delivery.
- Reject duplicate line entries within one save and non-finite quantities. Preserve requested-quantity limits, permission/warehouse/request-state checks and existing recall blocking.
- Add canonical balance ID, batch number, status, reservations and unreserved availability to the existing warehouse item response. No schema changes or new endpoint.
- The supply page chooses the balance ID and stock item ID, excludes non-AVAILABLE/fully reserved rows, and sums available quantities across lots rather than overwriting the amount with the last row. It refreshes supplied/outstanding totals and stock after success. Errors stay visible with the actual server message and a manual reload action; the client never automatically retries issuance.

Files:

- `purchase-backend/controllers/warehouseSupplyController.js`
- `purchase-backend/controllers/warehouseInventoryController.js`
- `purchase-backend/tests/warehouseSupplyConflict.test.js`
- `purchase-frontend/src/pages/requests/SupplyItemsPage.jsx`
- `purchase-frontend/src/pages/requests/SupplyItemsPage.test.jsx`

## Verification

Backend regressions execute the real supply controller, canonical inventory posting service, repository, validator, policy and audit service against a transaction-aware in-memory SQL boundary. They cover canonical identity versus legacy batch ID, exact allocations, same/different-lot equal-quantity installments, stale resubmission, legacy compatibility, foreign/quarantined/reserved/missing balances, genuine shortage with no lot substitution, ambiguous legacy selection, audit rollback, permission/warehouse/approval/recall enforcement, and default FEFO allocation when no batch is selected.

Frontend regressions cover exact selection and snapshot payload, summed unreserved availability with quarantine exclusion, refresh after success, and actionable conflict display/manual reload without reposting.

Executed checks:

- Focused backend: `npm test -- --runInBand tests/warehouseSupplyConflict.test.js tests/warehouseInventoryController.test.js tests/inventoryIntegrityCorrection.test.js` — 3 suites, 41 tests passed (including 15 new supply regressions). Reran after preserving canonical advisory-before-balance lock order.
- Full backend: `npm test -- --runInBand` — 218 suites / 1,806 tests passed; three known baseline tests failed: `fetchRequestsController.domain.test.js`, `procurementHistoryController.test.js` (SQL-shape fixtures), `phase5aCanonicalItemWriterBoundary.test.js` (existing schema-fixture writer). The same failures were independently reproduced on this unchanged master earlier in this session.
- Full frontend: `CI=true npm test -- --runInBand` — 105 suites, 471 tests passed, including four new supply page tests.
- ESLint on the changed page and its tests: no errors or warnings.
- `npm run build`: passed, with existing unrelated warnings in DepartmentRequestedItemsBoard/PhysicalInventory and the existing bundle-size advisory.
- Backend JavaScript syntax checks and `git diff --check`: passed.

All database boundaries were mocked. The canonical posting engine retains advisory-before-balance lock ordering; the selection preflight does not hold a balance lock before posting.

## Database, compatibility and rollout

No database migration required. No SQL was executed against Development or Production Supabase. No frozen migration, inventory posting service, approval engine or routing configuration was changed.

Deploy the backend before or together with the frontend after review. The new page needs the additive balance identity and availability fields. Legacy batch-only callers are supported when their selection resolves unambiguously. Keep all existing canonical inventory/audit schema prerequisites installed. No stock adjustment or blanket retry is an appropriate workaround for an unexplained 409.

Validate manually in Development: create/select AVAILABLE stock whose legacy batch ID differs from its batch number; issue three units; verify exactly one supply row/movement/allocation and the correct balance deduction. Record another same-quantity installment from the same and another lot, and verify separate movement identities and deductions. Retry a stale page, reserve/deplete the selected balance, and verify a conflict with no extra supplied row or movement.

Actual PostgreSQL concurrency and the production condition of request 1343 remain unverified. No historical stock/supply discrepancy was automatically repaired. Existing unmatched-stock compatibility behavior (a warning instead of an inventory posting when no stock selection is supplied) remains outside this focused correction.

LIVE_ROUTING_ENABLED remains FALSE.
