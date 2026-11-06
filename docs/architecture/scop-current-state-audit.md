# SCOP current-state audit

**Repository baseline:** `origin/master` at `e72bf67d` (2026-11-06). SCOP means WICI Supply Chain Operations Platform. This is a source and checked-in database-contract audit, not verification of the deployed Hetzner application, hosted Supabase database, or SAP installation. No database or production credentials were accessed. This PR changes documentation only.

Read together: [target operating model](scop-target-operating-model.md), [transaction ownership](scop-transaction-ownership.md), [implementation roadmap](scop-implementation-roadmap.md).

## Executive finding

Purchase Tracker is already a substantial modular monolith with request approvals, item identity, procurement assignment, RFx/awards, purchase orders, receipts, technical review, warehouse fulfillment, inventory posting, contracts, AP and payments. Evolving it does not require replacing these modules. The significant change is **authority**, because current local inventory and financial services perform postings that the proposed operating model assigns to SAP Business One.

The Central Supply feature currently records whether a request was sent; it does not model the center's line-level acceptance, partial commitment, delay, decline, delivery or authorized local sourcing of the remainder. SAP integration is listed as planned in the two application READMEs. The inspected routes, services and schema contract do not establish a SAP connector or SAP document identity mapping. Neither a working supplier-facing identity boundary nor a dedicated petty cash workflow should be inferred from page names or the presence of RFx/payment functionality.

## Evidence and limitations

Primary evidence is current executable code, [API composition](../../purchase-backend/app.js), [database schema contract](../../purchase-backend/database/releases/schema-contract.json), [locked migration inventory](../../purchase-backend/database/releases/migration-inventory.json) and current tests. Earlier [system audit](../audits/2026-10-system-audit.md), [security audit](../audits/2026-10-security-and-authorization-audit.md), [integration matrix](../audits/2026-10-integration-matrix.md) and [remediation backlog](../audits/2026-10-remediation-backlog.md) supply context; they are not proof their original defects remain.

The checked-in contract is `hospital-erp-2026-11-7c`. Manual SQL currently ends at `071_transactional_event_reliability.sql`. Tasks 6A–6C and 7A–7D are incorporated into this baseline, including completion SQL 067/068, release governance 069, RFID recovery 070 and transactional events 071. Installed schema compatibility and historical execution remain unverified without an operator-run read-only environment verification. A SQL dump or migration filename is not execution evidence.

The older [ERP transition roadmap](../../purchase-backend/docs/architecture/erp-transition-roadmap.md) and [module boundary manifest](../../purchase-backend/docs/architecture/module-boundary-manifest.yaml) are useful orientation. Statements about independent active contract settlement writers and unresolved future GL ownership must be interpreted against current containment code and this task's explicit SAP authority decision.

## Structure and reusable capabilities

| Area | Current implementation and frontend | Assessment for SCOP |
|---|---|---|
| Application boundary | `purchase-backend/app.js`; Express routers/controllers/services; `purchase-frontend/src/pages`; React/Tailwind and existing API client | Retain modular monolith and navigation. Do not introduce another authentication/API client or a replacement ERP shell. |
| Demand and approvals | `routes/requests.js`, `controllers/requests/createRequestController.js`, `controllers/utils/approvalRoutes.js`, `services/approvalContinuationService.js`; request forms, `RequestDetailWorkspace.jsx`, approvals panels | Reuse request identities, approval snapshots and existing routes. Approval Policy V2/shadow infrastructure exists; SCOP does not activate it. |
| Item identity/master stewardship | `services/itemMasterFoundationService.js`, `procurementItemIdentityService.js`, `routes/itemMaster.js`, `routes/stockItemRequests.js` | Three-level clinical/procurement identity already exists. Integrate SAP item identity with it rather than create another catalog. |
| Assignment and sourcing | `procurementAssignmentService.js`, `procurementAssignmentPolicy.js`, `requestAutoAssignmentService.js`, `routes/rfxPortal.js`, `services/rfxAuthorization.js`, `procurementAwardService.js` | Preserve capability, institute, eligibility, workload, award provenance and separation of duties. Add sourcing channels around these controls. |
| Central Supply | `controllers/requests/centralSupplyChainController.js`, `AllRequestsPage.jsx`, `services/procurementReportingService.js` | Existing sent/not-sent marker and filters are reusable compatibility behavior, not a center fulfillment ledger. |
| P2P | `routes/procureToPay.js`, `purchaseOrderService.js`, `goodsReceiptService.js`, `invoiceMatchingService.js`, `apPostingService.js`, `paymentService.js`; `ProcureToPay*Page.jsx` | Substantial connected workflow. SAP authority requires explicit command/readback cutover, not a second implementation of matching or payment controls. |
| Technical controls | `preprocurementTechnicalReviewService.js`, `deliveryInspectionService.js`, `routes/technicalWorkflow.js`; pre-procurement reviews, SCM review pages, device demos | Preserve AUD-008 containment and AUD-009 signed provenance and technical-clearance gates. |
| Completion/reporting | `procurementCompletionService.js`, SQL 067/068; `DepartmentRequestedItemsBoard.jsx`, `SupplyChainPerformancePage.jsx` | Reuse separate accepted-delivery and departmental fulfillment measures; never make a single status stand for all progress. |
| Inventory and warehouse | `inventoryPostingService.js`, `inventoryReservationService.js`, `inventoryStatusTransferService.js`, `inventoryReversalService.js`, `warehouseTransferService.js`, `controllers/warehouseSupplyController.js` | Existing canonical stock writer, reservations, provenance and transfer lifecycle. Current local posting authority conflicts with future SAP posted-stock authority until cutover is designed. |
| Planning | `routes/planning.js`, procurement plans, `PlanningWorkbench.jsx` | Forecasting, safety stock, MRP/replenishment are reusable advisory tools; not authorization to buy or post inventory. |
| Contracts/finance | `routes/contracts.js`, `contractAuthorizationService.js`, `contractFinanceIntegrationService.js`, `contractFinancialProjectionService.js`, `contractFinancialReconciliationService.js`; `ContractsPage.jsx`, AP/payment pages | Preserve commercial lifecycle and canonical financial links. Historical reconciliation infrastructure already exists. |
| Specialized operations | Surgical consignment cases/receipts/F20 evidence; device demos; assets/custody, equipment, maintenance, spare parts, recalls, dispensing reports | Reuse per-domain workflows. Monthly dispensing imports do not establish prescribing or a live pharmacy system. |
| Reliability and release | `auditService.js`, notification outbox/processor, RFID jobs; release quality workflow and database release tooling | Reuse transactional audit, durable delivery and recovery patterns. Notification events are not automatically a SAP command queue. |

## Current canonical records and competing representations

These are **today's local authorities**, not a declaration that WICI should remain the posted-financial authority after SAP cutover. Relationship scope often comes through a parent request rather than a tenant column on every child; APIs must traverse the actual ownership graph.

| Business object | Canonical current tables / relationships | Compatibility or caveat |
|---|---|---|
| Demand | `requests` → `requested_items`; institute and department belong to the request | `requests.status` primarily expresses approval/lifecycle state. `requested_items` holds identity snapshots, quantity, approval and procurement/receipt compatibility counters. Do not reinterpret those counters as a stock ledger. |
| Warehouse demand | `warehouse_supply_items` → request, with optional `requested_item_id` linkage | Warehouse Supply has a distinct item lifecycle. Do not assume every request has interchangeable `requested_items` lines. |
| Approval | `approvals`, `approval_logs`, route snapshots on requests and related approval structures | Maintain original approval route/evidence, including historical snapshots; do not reroute existing records on category changes. |
| Procurement execution | `procurement_cases`, `procurement_case_activities`, `procurement_item_events`, priority/history tables | Case/workload and purchase progress are operational facts, not physical receipt or AP settlement. |
| Sourcing and award | `rfx_events` → `rfx_responses` → `rfx_response_items`; `procurement_awards` links request/item/supplier/source | Award source IDs are typed provenance. A quotation-line ID and response-header ID cannot be interchanged. |
| PO | `purchase_orders` → `purchase_order_items`, linked to request, award and optional contract | Request header PO references are summaries, not sufficient for multiple PO/partial award accounting. |
| Receipt/acceptance | `goods_receipts` → `goods_receipt_items`, PO-line/requested-item references; `delivery_inspection_tasks`, `delivery_inspection_assignments`, `goods_receipt_inventory_status_links` | GR header existence is not acceptance. Legacy `technical_inspections` is not permission to mutate PR approval status. |
| Stock | `stock_items`, `inventory_transactions`, `inventory_transaction_allocations`, `warehouse_stock_levels`; reservation/allocation/transfer tables | Ledger is canonical, balances are projections. `stock_items.available_quantity`, `warehouse_stock_movements`, department stock and maintenance stock representations must not become parallel global ledgers. Trace each adapter before changing its writer. |
| Item identities | `generic_items` → `approved_products` → `supplier_catalog_items`; stock identity maps through `stock_item_master_mappings` and related read models | `item_master`, `item_master_items`, aliases/staging are existing compatibility/migration structures. Existing stock mappings are internal identity review, not SAP company/object/document mappings. |
| Suppliers | `suppliers`, supplier catalog/SRM/compliance/evaluation data | Names and nullable shared institute records are not external supplier login identities or SAP business-partner keys. |
| Contracts | `contracts`, `contract_items`, versions, documents, approvals, obligations, amendments, risk/renewal/coverage tables | `contract_invoices`, `contract_payments`, `contract_consumption` retain historical evidence; they are not an independent new settlement path. |
| Invoice capture | `supplier_invoices` → `invoice_items`; receipt/PO/contract links; `invoice_match_results`, override decisions | Invoice capture/match is not AP posting. Supplier invoice identity, currency, normalized number and source provenance matter. |
| AP posting | `ap_vouchers` → `ap_voucher_lines`; `ap_payables`, `finance_postings`, `journal_entries`, `journal_entry_lines` and budget/commitment records | Local verified-voucher posting currently creates financial facts. These are not proof of SAP posting or HANA accounting. |
| Payment | `payment_records` → `payment_allocations` → `ap_payables` | Payment headers/status labels alone cannot settle obligations. Canonical allocation/reversal controls must remain until a controlled SAP authority transition. |
| Document provenance | `document_flow_links`, attachments, audit events and domain logs | Existing internal document graph should be extended or linked to external identity, not replaced by loose SAP document numbers. |
| Historical review | `contract_financial_reviews` stores source/evidence fingerprints, reviewed canonical IDs, reviewer/revision and decision | Confirming a relationship does not create a payment or fabricate a historical posting. |
| Durable operations | `audit_logs`, `notification_outbox`, RFID `rfid_read_events`/`rfid_processing_attempts` and domain operation keys | Preserve tenant, event/source identity, retries and visibility. Do not repurpose RFID integration-client credentials as SAP credentials. |

## Lifecycle traced through current APIs

API paths below are mounted under `/api`; module handlers still enforce domain capability and object ownership. Authentication alone is not authority.

1. **Submit demand.** `POST /api/requests` creates the request, item identities/snapshots and approval route. Stock, Non-Stock, Medication, Medical Device, IT Item and Warehouse Supply are existing canonical form values. Printing/bulk logbook forms can submit Non-Stock despite their display names. Desired business categories are not automatically new `request_type` strings.
2. **Approve/reject.** `/api/approvals` and request HOD/SCM actions follow existing approval continuation and route snapshots. Current-state and permission gates precede downstream execution. Historical import is a distinct route and must not become a routine sourcing bypass.
3. **Assign and source.** Existing assignment services choose eligible buyers using the current workload policies. Central Supply tracking is `PATCH /api/requests/:id/central-supply-status`. Internal `/api/rfx-portal` supports events, responses, analysis and awards. `rfxAuthorization` requires `rfx.manage`, derives request ownership, locks source records and validates response/item/supplier relationships. It does not establish an external supplier account merely from a supplier name.
4. **Create and issue PO.** `POST /api/procure-to-pay/requests/:requestId/purchase-orders` uses canonical P2P/award lineage. PO submit-approval/approve/issue/cancel/close actions retain gates and audit. Unscoped `POST /api/procure-to-pay/purchase-orders` deliberately returns 410; do not revive it for SAP imports. Preserve signed department opinion, SCM technical clearance and changed-proposal re-review before issue.
5. **Receive and inspect.** `/api/procure-to-pay/requests/:requestId/receipts` records receipt lines. `/api/technical-inspections/workflow/delivery/:id/{start,opinion,decide,reopen,apply}` manages inspection. Canonical disposition and inventory services govern accepted/rejected/quarantined stock, applying changes transactionally. A receipt may be partial or pending inspection.
6. **Project completion and fulfill.** `GET /api/requests/:id/completion`, P2P lifecycle and departmental reports use canonical completion evidence. `/api/warehouse-supply/:requestId/items` issues stock through canonical posting in the supply controller. Warehouse transfer dispatch/receipt is separate. Goods accepted into warehouse are not proof that a department received them.
7. **Capture and verify invoice.** Request invoice/match routes, matching overrides and AP voucher verification preserve source/quantity/value controls. Goods use receipt/matching evidence; service-specific matching must retain its existing rules rather than invent physical receipts.
8. **Post payable and allocate payment.** Verified voucher posting via `/api/procure-to-pay/requests/:requestId/post-ledger` uses `apPostingService`. Canonical `/api/procure-to-pay/accounts-payable/:payableId/payments` uses `paymentService`. Direct invoice-to-payable and status-only payment shortcuts return 410. Today these are local financial operations; SAP adoption must explicitly replace the authority, not silently add a second posting.
9. **Contract and historical reporting.** `/api/contracts/:id/canonical-financials` reads canonical financial projection. `/api/contracts/financial-reconciliation/worklist` and `/reviews` support authorized evidence-based historical review. `legacyContractSettlementPolicy.js` contains legacy writes even where old controller function bodies remain in source. Existing contracts, balances and immutable evidence must survive migration.

### Receipt quantities and service boundaries

Current receipt service first computes usable received quantity as gross `received_quantity - damaged_quantity - short_quantity`, preserving all discrepancy evidence and immutable PO UOM conversion. When inspection is required, accepted quantity initially remains zero. Later `applyTechnicalDisposition` uses authorized inspection evidence and existing locks to apply accepted/rejected deltas; accepted plus rejected cannot exceed the remaining usable quantity. This distinction matters when designing SAP receipt fields: gross receipt, usable received and technical acceptance are not interchangeable.

SQL 068 adds exact receipt-to-status-transfer provenance, differentiates pending inspection from physical quarantine, and follows reversal descendants. Authorized quarantine release already exists through the internal inventory status-transfer service; it is not a new public release endpoint/UI. Conflicting or unlinked pooled-stock evidence must remain an evidence gap, not be guessed from matching item/quantity. See the current [AUD-018 integration report](../audits/2026-11-aud018-receipt-acceptance.md).

### Startup, deployment and trust boundary

`app.js` exposes `/health` and uses `databaseReleaseService.startWhenReady` before starting protected runtime processing, including `jobs/rfidWorker` and notification processing. Existing release manifests identify worker protocols and migration prerequisites. No tracked Docker/Compose or PM2 deployment definition was found by filename inventory; that does not establish the deployed server process configuration. The operator must confirm Hetzner proxy, process manager, backup/recovery and worker topology during P0.

Database governance provisions a privileged backend role, and not every canonical table has RLS. Object authorization in server services is therefore essential; neither a schema-contract match nor browser access restrictions prove a newly added worker is safe. Preserve RLS/grants and existing server ownership guards; audit new integration reads, exports and service credentials separately.

## Specific gaps and rollout hazards

| Finding | Evidence / implication | Required treatment |
|---|---|---|
| Central Supply is a marker | Only `sent_to_central_supply_at/by` on requests; no line commitments or authorized residual | Preserve marker compatibility; introduce reviewed center coordination only after lifecycle/quantity decisions. Historical sent markers must stay “outcome unknown.” |
| Marker authority/audit needs strengthening | Controller uses `requests.manage`; nullable actor institute broadens its scope predicate. Audit/log savepoints can fail without rolling back the marker | Harden this bounded existing operation first; do not elevate it to authoritative center authorization evidence as-is. |
| Local posted stock and finance exist | Inventory/AP/payment services perform actual local mutations | Define per-scope authority epochs and in-flight document rules before SAP writes/imports. Never sum the two systems' representation of the same movement. |
| SAP identity/API not established | SAP is planned in READMEs; no SAP-like company/DocEntry/CardCode columns found in current schema contract | Discover installed B1 version/company/Service Layer availability, supported objects, permissions and mapping before interface design is finalized. No direct HANA writes. |
| Master creation paths vary | Foundation CRUD and supplier routes exist; `supplierReferenceService` can resolve/create by name, while RFx authorization requires existing scoped supplier evidence | Inventory callers before cutover; convert SAP-owned field writes to stewardship requests. Do not globally remove local enrichment or all legacy name fallbacks without reconciliation. |
| Legacy stock matching | `warehouseSupplyController` retains a stock-name fallback in addition to identity resolution | Establish reviewed mappings; ambiguous names must not resolve a SAP material or receive imported financial identity. |
| Supplier portal ambiguity | Current RFx router is inside authenticated internal API and `rfx.manage` authorization | Preserve current internal quotation capture. External supplier identity/invitation-only access is a separate security design if later commissioned. |
| Categories differ from routes | OHS, housekeeping, infection control, nuclear medicine, patient-specific and recurring demand are not proven one-to-one request types | Use controlled classification/profile mapping with existing forms/approval policies. Explicit clinical/regulatory discovery is required. |
| Petty cash not established | No dedicated petty cash route/table/module identified by scoped repository search | Design operational voucher/custody/evidence workflow only after finance policy; do not duplicate payment_records or build a local cash accounting ledger. |
| Runtime schema isn't the checked-in contract | Frozen SQL, compatibility structures and deployment drift can coexist | Use release verifier with an operator-approved environment. Never run all migrations based on a directory listing. |

## Existing regression protection

Use the exact commands in [quality gate policy](../../scripts/quality/gates.json) and [release workflow](../../.github/workflows/release-quality.yml), not an abbreviated new CI path. Relevant existing protection includes:

- Request/approval/assignment authorization tests, `centralSupplyChainController.test.js`, workspace tests, frontend `AllRequestsPage.test.jsx`, `RequestDetailWorkspace.test.jsx` and identity flow tests.
- RFx source/identity/pricing tests, P2P native PostgreSQL suite, device demo gates and AUD-009 review/PO clearance regressions.
- Inventory foundation/integrity tests; disposable completion and completion-reporting suites covering SQL 067/068, receipt inspection, stock issue, institute isolation and rollback.
- Contract lifecycle/settlement containment/canonical integration/historical reconciliation PostgreSQL profiles; allocation, duplicate-payment and audit rollback controls.
- Database governance, populated migration compatibility, RFID recovery and event reliability PostgreSQL profiles; release manifest policy tests and frontend localization/build gates.

These protect current behavior, not SAP integration. Add mapping, unknown-commit, replay, stale-stock, central residual and authority-switch tests before each corresponding rollout. Keep current acceptance suites running against pre-cutover cohorts.

## Read-only checks for this documentation PR

Executed against the baseline without any database connection:

- Locked database/source inventory and required contract/permission checks using the exported `contract()` quality helper: passed.
- English/Arabic localization key and interpolation parity using `localization()`: passed.
- `node purchase-backend/scripts/databaseRelease.js plan`: passed, explicitly `OFFLINE_DRY_RUN_NO_DATABASE_CONNECTION`; historical execution remains `UNVERIFIED`.
- Documentation relative-file links and `git diff --check`: passed at final review.

No application code changed. Backend/frontend business suites, production build, live authentication, hosted schema, SAP connectivity and operational acceptance were not re-executed or certified by these read-only checks. Future implementation PRs must run the full affected quality gates and disposable PostgreSQL profiles.
