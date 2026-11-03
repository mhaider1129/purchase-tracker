# AUD-001: canonical contract finance integration

Review date: 2026-11-03 (UTC). Base: `07fe202e` (master; Phase 5A PR #87 merged). This is the supported-source continuation of [Phase 5A](2026-11-aud001-phase5a-remediation.md), not completion of historical reconciliation or every contract financial model.

## Verified problem and authority

Phase 5A stopped the eight independent contract invoice/payment/consumption mutators with HTTP 410, but did not provide a safe replacement for registering a new contract obligation. Canonical AP could proceed without selecting an authoritative contract source, could not enforce its ceiling across POs, and could encounter old contract payments without treating them as a reconciliation hold. Contract screens still presented legacy counters and a voucher-based consumption estimate as financial balances, with a fallback USD/IQD portfolio conversion.

This change associates a contract at canonical PO creation, carries that identity into supplier invoices, and keeps liability/payment writes in the existing services. It does not reinterpret old paid counters as payment allocations. Existing history is preserved, including inconsistent historical associations; inconsistent sources cannot enter new finance commands or misleading projections.

## Supported source and document graph

Supported: a clean **purchasing contract for goods**, with one authoritative purchase request, supplier and currency, valid dates/status, positive exact two-decimal ceiling, and completed existing contract approvals. Multiple POs per contract, multiple invoices per PO, partial payments and multiple allocations per payable remain supported.

The authoritative graph is `contracts.source_request_id -> requests.id`; `purchase_orders.contract_id -> contracts.id`, with PO request/supplier/currency matching that contract; `goods_receipts.purchase_order_id -> purchase_orders.id`; `supplier_invoices.purchase_order_id -> purchase_orders.id` with PO-derived contract/request/supplier/currency; AP vouchers/payables/postings reference the canonical invoice; payment allocations reference that payable and its payment record. Award items, price/UOM provenance, receipt acceptance and technical clearance continue through existing canonical relationships and gates.

The contract is selected explicitly at creation, never guessed from vendor text, dates, amounts, frontend institute IDs or old invoice links. Known contract request/supplier pairs cannot evade selection by omitting `contract_id`. Existing unlinked documents for such sources require reviewed mapping rather than retroactive attachment. The RFx award-and-PO path and direct award-to-PO path both carry the optional explicit source. A retry with a different source is rejected.

Blocked pending an approved source adapter: contracts without a source PO/request, leases and other non-purchasing types, service acceptance, advances, retention, penalties and milestone terms. The canonical invoice model represents one source PO per invoice; this change does not invent consolidated multi-PO invoice identities. Existing canonical invoices linked to a contract but not their PO are not silently repaired. Expired/inactive or pending-approval contracts cannot register new obligations; expiration does not erase an already valid posted liability or automatically prevent its lawful settlement.

## Authorization matrix

| Action | Existing authority retained | Additional contract check |
| --- | --- | --- |
| Create linked PO, including RFx award path | Existing PO creation capability and sourcing/award permissions | `contracts.manage`; contract relationship authorization; matching owned request/supplier/currency |
| Approve/issue PO | Existing PO approval/issue capabilities and maker/checker rules | Owned source; valid contract; exact issued commitment ceiling |
| Register invoice | Existing supplier invoice capability and invoice idempotency | Active valid PO contract, inherited identity, reconciliation hold |
| Verify/match/create AP/post | Existing matching, finance verification, AP and posting capabilities | Owned source graph; reconciliation and monetary authority consistency |
| Settle payable | Existing payment capability, posted liability, matching/technical/overpayment controls | Owned source; no legacy reconciliation/reversal conflict; exact payment precision |
| Read contract financial projection | **Both** `contracts.manage` and `procure-to-pay.lifecycle.view`, plus contract relationship authorization | Same institute and complete canonical source graph |
| Follow financial document link | Existing request-scoped lifecycle view authorization | Existing P2P read predicates include contract ancestry |
| Change contract source or ceiling | Existing contract management/update authorization | Linked source immutable; ceiling cannot invalidate issued commitments |
| Legacy settlement / unsupported reversal | No new authority | Remains blocked; no replacement writer activated |

Actors and explicit grants are reloaded server-side inside the transaction. Finance permissions do not imply contract management and contract management does not grant payment authority. A finance user can process a valid existing linked payable without needing contract management. No new cross-institute exception or role-name bypass exists.

## Transaction and integrity design

`contractFinanceIntegrationService` adds validation to the existing services; it is not an AP or settlement repository. `p2pAuthorization` locks owned contract roots in ID order before the existing request lock, matching the contract boundary lock order. The authoritative source request is then locked for update. Contracts supported here share that request, so concurrent issues serialize before summing reserved commitments. Contract updates conflict with the shared root lock. Existing PO/invoice/payable locks, duplicate invoice keys and payment idempotency continue to protect settlement. Native concurrent tests exercise real separate connections.

Ceiling checks occur before the existing budget commitment and PO issue inside the canonical transaction. Posting, allocation, open-balance and invoice payment projections remain owned by the existing repository/services, with audit and notification outbox in the same transaction. Events carry contract identity alongside existing request, actor and institute provenance. Injected audit/outbox failures leave no financial changes. Duplicate payment retries return the original result without a second allocation or notification.

Migration 065 adds/guards provenance and checks that required triggers/FK exist. Services fail closed if the migration controls are missing or disabled. Database triggers prevent linked PO/invoice source rewrites and contract edits that invalidate issued commitments. They do not turn direct administrative SQL into a fully authorized application financial command.

Legacy invoices, payments, consumption or nonzero old counters for the selected contract or corresponding source request produce a reconciliation hold. A known supplier and normalized legacy invoice identity also hold possible replay; invoice-less legacy payment evidence for that supplier holds ambiguous replay. These are risk holds, **not proof that the liability was paid**. No canonical AP/payment is generated from a legacy row, and no legacy record is deleted or relabelled. Missing historical supplier/bill identity can prevent reliable cross-source detection; reviewed evidence and a future approved mapping process are still required. Holds are intentionally conservative and can require finance intervention for otherwise legitimate work.

## Read-only projection definitions

`GET /api/contracts/:id/canonical-financials` runs a repeatable-read snapshot and returns amounts as decimal strings, in the contract currency. No FX conversion or JavaScript floating-point monetary aggregation is used for these metrics. They represent separate stages and must not be added together.

| Metric | Authoritative definition |
| --- | --- |
| Contract ceiling | `contracts.contract_value`, positive and representable in canonical precision |
| Approved and issued PO commitments | Sum of linked PO `total_amount` for `PO_ISSUED`, `PO_PARTIAL`, `PO_DELIVERED`, `PO_CLOSED`; draft and merely approved/unissued POs reserve nothing |
| Accepted receipt value | Existing accepted quantity expression (technical accepted quantity where inspection required, otherwise received less damaged/short) times the source PO purchase-unit price; excludes separate tax/freight/charges |
| Registered invoice value | Canonical supplier invoice face totals, excluding cancelled/voided/declined/superseded/replaced invoices; registration does not claim verification |
| Posted AP liability | AP invoice totals backed by a posted canonical voucher and matching finance posting |
| Recorded paid allocations | Positive canonical allocations belonging to paid, unreversed payment records; an ERP recorded payment is not evidence of bank reconciliation |
| Outstanding AP balance | Posted AP invoice total less those allocations, cross-checked against stored payable open balance |
| Remaining contract capacity | Contract ceiling less issued PO commitments only, including closed orders; conservatively does not recycle closed PO capacity |

Totals are unavailable with a reconciliation error if linked source records are out of scope/inconsistent, AP authority amounts/open balances disagree, or unsupported reversal/payment evidence exists. A legacy-only evidence hold is displayed separately without adding old counters to canonical totals. Empty supported stages can legitimately show zero; failed requests do not fabricate zero balances.

Closing a PO can release unused **budget** commitment under existing policy; this does not automatically recycle **contract** face-value capacity. A future approved cancellation/amendment policy is required to change that conservative rule. Receipt values and full invoice/PO face totals have different tax/charge bases and are not interchangeable.

## Exact code changes

- New `services/contractFinanceIntegrationService.js`: source, schema, active-term, ceiling, reconciliation, graph and edit guards.
- New `services/contractFinancialProjectionService.js` and `controllers/contractFinancialProjectionController.js`; registered in `routes/contracts.js`: authorized read-only summary.
- `p2pAuthorization.js`, `p2pReadScope.js`, `contractAuthorizationService.js`, `financialHistoryRetentionService.js`: owned immutable source ancestry, compatible lock order, scoped reads and historical retention.
- `purchaseOrderService.js`, `supplierInvoiceService.js`, `accountsPayableService.js`, `financeVerificationService.js`, `apPostingService.js`, `paymentService.js`: validation inside canonical command transactions. `accountingEntryValidation.js` exports the existing amount parser for reuse.
- `connectedP2PRepository.js`: linked-document inserts persist authoritative contract IDs; existing non-contract insert path remains. No new financial repository/model.
- `procureToPayController.js`, `rfxPortalController.js`, `rfxAuthorization.js`: explicit source forwarding and retry validation, preserving award/PO transaction boundaries.
- New frontend `ContractCanonicalFinancials` and `CanonicalFinancialDocuments`: exact-string metrics, loading/error/retry/reconciliation states and actual authorized lifecycle document anchors. Contracts financial/history/consumption tabs use canonical data; historical counters are labelled. Unsupported legacy settlement buttons remain absent. The fallback FX portfolio balance and misleading voucher-as-paid consumption display are removed.
- PO and RFx award forms/API allow the optional contract ID; server decisions remain authoritative. English/Arabic interface catalog entries preserve canonical values and centralized Axios authentication/401 handling.
- New native integration suite plus focused component/API tests; existing disposable fixtures/domain test doubles updated for the optional contract module without removing existing financial assertions.

The refreshed [writer inventory](2026-11-aud001-canonical-writer-sites.jsonl) has 1,030 sites: A62/B34/C3/D20/E902/F9. The two additional canonical INSERT sites are conditional linked PO/invoice branches in the existing repository, not a competing writer. Extra E sites are schema/fixture DDL. The same nine F sites remain uncalled/unmounted helpers. Preserve the Phase 5A inventory as its historical baseline; static classification is not proof of hosted execution or exhaustive dynamic SQL analysis.

## Manual database requirements

**MANUAL DATABASE MIGRATION REQUIRED**: `purchase-backend/sql/manual/065_canonical_contract_finance.sql`.

Prerequisites are the full canonical schema from 059 and contract authorization patch 064. Previously reported hosted `contracts.institute_id` errors indicate 064 was missing at that time; no hosted application of it has been verified. The owner must review/apply prerequisites and 065 through Supabase SQL Editor before deploying this code. Existing migrations are unchanged.

065 is atomic with a three-second lock timeout, compatible-column checks, an unvalidated FK enforcing new references, partial indices and three source/ceiling guard triggers. It does not populate links, replay settlements, recalculate historical balances, grant permissions or create another AP model. Existing inconsistent rows remain intact and require reconciliation; the FK does not certify old history. On lock timeout the owner should retry during an appropriate maintenance window, not remove guards. Applying 065 initially and repeatedly to populated native fixtures preserves historical and canonical row values. Nonconforming existing column/FK definitions stop the patch for manual review. No production/hosted SQL was executed.

## Verification

Final local results follow. Native tests use a fresh loopback-only disposable PostgreSQL container with no hosted URL or data volume.

- `npm run test:contract-finance-postgres`: 38 cases plus initial populated upgrade preservation; covers all 22 requested scenarios, concurrent ceiling/settlement, audit/outbox rollback, source detachment, schema controls, RFx award retry, unsupported terms and repeat application.
- `npm run test:p2p-postgres`: 92 passed; existing canonical AP, technical approval, sourcing and transactional authorization regressions retained.
- `npm run test:contracts-postgres`: 51 passed.
- `npm run test:contract-settlement-postgres`: 32 passed.
- Backend `npm test -- --runInBand`: 220 suites / 1,864 tests passed; three failed suites with one failing test each. Reproduced the same failures on base master `42fc1782`; current master `07fe202e` changes only incomplete-request frontend pages. Failures: `fetchRequestsController.domain.test.js`, `procurementHistoryController.test.js`, `phase5aCanonicalItemWriterBoundary.test.js`. They remain unresolved and are not claimed as a green full suite.
- Frontend focused run: six suites / 19 tests passed (canonical metrics/documents, API whitelist, RFx authorization, locale parity and the newly merged incomplete-request dashboard).
- `CI=false npm run build`: production build succeeded with existing unrelated warnings in `DepartmentRequestedItemsBoard.jsx` (unused variable) and `fixed-assets/PhysicalInventory.jsx` (effect dependency), plus dependency metadata/deprecation notices.
- `git diff --check` and changed backend JavaScript syntax checks: required before commit.

## Remaining risks and release constraints

This provides canonical integration for supported clean PO-backed goods contracts, not migration of historical liabilities. There is no approved reconciliation execution/mapping UI or generic service/milestone/advance adapter. No canonical reversal/credit execution command exists in this baseline; reversal evidence stays blocked and the old contract ledger cannot execute reversals. No new payment approval workflow, banking confirmation or GL journal writer is activated. Existing authorization, PO maker/checker, technical and payment gates remain; any broader payment segregation-of-duties or reversal design remains separate reviewed work.

Existing legacy risk/health/report APIs remain compatibility diagnostics, not canonical financial authority. Migration 064/065 and hosted schema/grants still require owner review; production data, query plans and rollout are unverified. Large contract projections and supplier-wide legacy holds may need measured production tuning without weakening scope. Deploy only after manual prerequisite verification and migration review. `LIVE_ROUTING_ENABLED` remains false; Approval Engine V2 is not enabled. No automatic deployment or merge.
