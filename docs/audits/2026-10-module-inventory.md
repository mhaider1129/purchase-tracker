# October 2026 — module inventory and readiness

Reviewed commit `f254a6da68ae8268a8afc0149dd903ed10f42de5`. Readiness is a repository-level assessment, **not deployment certification**. Implemented means source and tested paths exist; At risk means specific integrity/security gaps require remediation. Shadow is an intentional boundary, not an implementation failure. See the system audit for severity/evidence definitions and exact executed tests.

| Domain                                                      | Readiness                                       | Primary concern                                                                                                                                                                                  |
| ----------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| M01 Purchase requests and request lifecycle                 | At risk                                         | AUD-008, AUD-011, AUD-002; hold-adjusted timing and stock completion features already exist.                                                                                                     |
| M02 Organization hierarchy and Approval Engine 2.0          | Shadow / controlled pilot prerequisite          | AUD-013 readiness count weakness; AUD-014 delivery semantics. No current live V2 bypass confirmed.                                                                                               |
| M03 Procurement assignment and procurement cases            | Implemented / boundary gaps                     | AUD-007 and AUD-014; case projections depend on AUD-018 inspection event completeness.                                                                                                           |
| M04 Procurement priority and performance                    | Implemented / reporting caveats                 | AUD-011 and AUD-018; KPI basis across all screens is PARTIALLY VERIFIED, not a confirmed regression.                                                                                             |
| M05 RFx, quotations, evaluations and awards                 | At risk                                         | AUD-004, AUD-009; evaluation→award handoff is a scoped follow-up question, not a claim that normalized RFx provenance is missing.                                                                |
| M06 Purchase orders                                         | Canonical core / scope gap                      | AUD-002, AUD-009; exact source/price authority is implemented, not merely a document attachment.                                                                                                 |
| M07 Goods receipts and receiving                            | Canonical core / integration caveats            | AUD-018 case-delivery projection not emitted on release; no claim that all received gross units become available inventory.                                                                      |
| M08 Technical reviews and delivery inspections              | Implemented / specific regression               | AUD-008, AUD-009, AUD-016, AUD-018; generic attachment routes still AUD-003 despite retained-evidence FK.                                                                                        |
| M09 Warehouse inventory, reservations, transfers and supply | Canonical core / scope review required          | AUD-006 planning mutation boundary; deployment balance constraints and operational expiry/recall policy require owner evidence.                                                                  |
| M10 Item Master, UOM and product identity                   | Implemented / policy consistency caveat         | AUD-010 runtime schema, AUD-020 deployed contract. Global catalog vs institute asset links is PARTIALLY VERIFIED integration policy debt.                                                        |
| M11 Fixed assets, RFID and custody                          | Implemented / recovery gap                      | AUD-012 stranded RFID processing; AUD-017 physical-inventory test lint. Hardware/live gateway NOT VERIFIED.                                                                                      |
| M12 Contracts and financial obligations                     | At risk                                         | AUD-001 competing writers; AUD-005 institute access; AUD-010 runtime DDL; incomplete transactional handling is a follow-up investigation, not a proven deployed leak.                            |
| M13 Supplier master, SRM and evaluations                    | Implemented / policy evidence needed            | AUD-019 policy-dependent qualification; AUD-004 public supplier identity; AUD-005 linked contract visibility.                                                                                    |
| M14 Accounts payable, matching and payments                 | Canonical core / competing legacy writers       | AUD-001 and AUD-002; absence of hosted financial reconciliation is AUD-020, not a confirmed monetary loss.                                                                                       |
| M15 Budget control and general ledger                       | Implemented internal accounting / boundary gaps | AUD-002 commercial scope also applies; budget-specific root department isolation is not certified. Accounting/report semantics need a focused follow-up, not a claim of absent balanced posting. |
| M16 Procurement planning                                    | At risk                                         | AUD-006 and AUD-003; historical demand/movement coverage remains incomplete evidence, not invented forecast certainty.                                                                           |
| M17 Maintenance and spare parts                             | Implemented / integration validation needed     | No new confirmed canonical-part bypass found in inspected paths. AUD-020 deployment and separate legacy request completion caveats still apply.                                                  |
| M18 Notifications, audit logs and reporting                 | Mixed guarantees                                | AUD-014, AUD-018, AUD-011; approved hold timing changes exist and should not be reported globally missing.                                                                                       |
| M19 Authentication, authorization and institute isolation   | At risk                                         | AUD-002 through AUD-007, AUD-020; database role privileges cannot be inferred from API mocks.                                                                                                    |
| M20 Frontend navigation, usability and API integration      | Implemented / quality gates fail                | AUD-016, AUD-017; no broad redesign is implemented in this documentation-only audit.                                                                                                             |

## M01 — Purchase requests and request lifecycle

**Actual functionality:** Submission/editing, historical entry, status communication, assignment, requester receipt/issue reporting, reclassification, SCM early rejection and stock-fulfilled views.

**Service and database ownership:** requests, requested_items, approvals, request_logs; demand belongs to requests, resolved identity to requested-item service, final status still has competing writers. Source: `purchase-backend/controllers/requests/createRequestController.js`, `purchase-backend/services/requestLifecycleService.js`, `purchase-backend/controllers/requests/updateRequestsController.js`, `purchase-backend/services/scmRequestInterventionService.js`.

**API and frontend entry points:** /api/requests; /api/requested-items; `purchase-frontend/src/pages/OpenRequestsPage.jsx`, `purchase-frontend/src/pages/MyMaintenanceRequests.jsx`.

**States and approval requirements:** Draft/Submitted→approval progression→Approved→procurement/Completed→requester Received; rejected/cancelled terminal variants, On Hold at approval level. Stored display/case variants differ.

**Dependencies:** Organization/resolvers, identity/UOM, procurement events, warehouse supply, technical reviews and completion reporting.

**Authorization, scope, segregation, concurrency and audit:** Canonical lifecycle service locks requests, checks expected state and scope policy, writes transactional audit/outbox. Creation supports requester submission keys. Legacy completion controller checks permission but lacks the same institute/state policy; no blanket canonical guarantee.

**Competing writes, recovery, schema and operating gaps:** Compatibility receipt and historical status paths remain; exact request completion meaning needs operational agreement. Test partial stock/procurement mixtures and requester issues, not only happy-path submissions. Runtime/schema dependencies are expanded in the database audit; unknown deployment/configuration is not a confirmed defect.

**Test evidence:** `purchase-frontend/src/pages/RequestIdentityWorkspaceFlow.test.jsx`, `purchase-backend/tests/requestReclassificationApprovers.test.js`, `purchase-backend/tests/requestReclassificationErrors.test.js`, `purchase-backend/tests/requestReclassificationSnapshotIdentity.test.js`, `purchase-backend/tests/scmRequestIntervention.test.js`. Tests establish only their mocked/local scope; see required regression scenarios in linked findings.

**Readiness and UX follow-up:** At risk. AUD-008, AUD-011, AUD-002; hold-adjusted timing and stock completion features already exist.

## M02 — Organization hierarchy and Approval Engine 2.0

**Actual functionality:** Hierarchy/structural authority, effective positions/delegations, legacy route snapshots/continuation, V2 condition/resolver simulation, shadow comparison and readiness diagnostics.

**Service and database ownership:** organization_units/positions, approval snapshots, approvals; policy/version/rule/condition/step and shadow-run tables are diagnostic ownership, not live approval ownership. Source: `purchase-backend/services/organizationService.js`, `purchase-backend/services/approvalEngine.js`, `purchase-backend/services/approvalContinuationService.js`, `purchase-backend/services/approvalPolicyEngine.js`, `purchase-backend/services/approvalPolicyService.js`, `purchase-backend/services/approvalPolicyShadowService.js`.

**API and frontend entry points:** /api/organization; /api/approvals; /api/approval-routes; /api (approval-policies / approval-policy-versions / approval-policy-shadow-runs / approval-policy-readiness); /api/approval-authority-delegations; `purchase-frontend/src/pages/OrganizationHierarchy.jsx`, `purchase-frontend/src/pages/ApprovalPoliciesPage.jsx`, `purchase-frontend/src/pages/ApprovalsPanel.jsx`.

**States and approval requirements:** Policy DRAFT→VALIDATED→SHADOW; engine LIVE_ROUTING_ENABLED=false. Current live Pending/On Hold→Approved/Rejected decisions still use existing route/continuation.

**Dependencies:** Department/request facts, immutable route provenance, user permission authority and delegation scope.

**Authorization, scope, segregation, concurrency and audit:** Policy endpoints require explicit view/manage/shadow capabilities; version institute joins, validation, transaction locks and audit are implemented. Simulation returns zero live mutations. Direct approval emails remain outside durable outbox guarantees.

**Competing writes, recovery, schema and operating gaps:** Do not enable V2 by treating SHADOW as ACTIVE. Missing/ambiguous heads, same-principal different purpose, parallel approvals, delegations and threshold boundaries need representative cutover evidence. Runtime/schema dependencies are expanded in the database audit; unknown deployment/configuration is not a confirmed defect.

**Test evidence:** `purchase-backend/__tests__/approvalPolicyDiagnosticsRoutes.test.js`, `purchase-backend/__tests__/approvalPolicyEngine.test.js`, `purchase-backend/__tests__/approvalPolicyMigration.test.js`, `purchase-backend/__tests__/approvalPolicyNonStockDiagnostics.test.js`, `purchase-backend/__tests__/approvalPolicyReadiness.test.js`, `purchase-backend/__tests__/approvalPolicyService.test.js`. Tests establish only their mocked/local scope; see required regression scenarios in linked findings.

**Readiness and UX follow-up:** Shadow / controlled pilot prerequisite. AUD-013 readiness count weakness; AUD-014 delivery semantics. No current live V2 bypass confirmed.

## M03 — Procurement assignment and procurement cases

**Actual functionality:** Manual/split assignments, management autoassignment rules, approved-item case provisioning, complexity/activity/evidence tracking and buyer workload.

**Service and database ownership:** requests.assigned_to and item assignment projections; procurement_cases and case activities are item-grain evidence owned by performance repository. Source: `purchase-backend/services/requestAutoAssignmentService.js`, `purchase-backend/controllers/requestAutoAssignmentRulesController.js`, `purchase-backend/services/procurementPerformance/procurementCaseService.js`, `purchase-backend/repositories/procurementPerformanceRepository.js`.

**API and frontend entry points:** /api/requests; /api/request-auto-assignment-rules; /api/procurement-performance; `purchase-frontend/src/pages/AssignedRequestsPage.jsx`, `purchase-frontend/src/pages/Management.jsx`.

**States and approval requirements:** Approved demand provisions ITEM_IDENTITY_RESOLUTION/READY_FOR_SOURCING; case progression through sourcing/award/PO/fulfillment/delivery. Case is not the whole-request priority position.

**Dependencies:** Final request approval, identity resolution, canonical P2P outbox events, buyer authority and priority provisioning.

**Authorization, scope, segregation, concurrency and audit:** Case creation uses active-item uniqueness/retry and transaction composition. Performance routes scope institute/user visibility. Autoassignment criteria/assignee validation are global and require repair.

**Competing writes, recovery, schema and operating gaps:** Recovery when current buyer deactivates, reassignment of split cases and missing event coverage need controlled operations. Current legacy autoassignment emails may escape rollback. Runtime/schema dependencies are expanded in the database audit; unknown deployment/configuration is not a confirmed defect.

**Test evidence:** `purchase-backend/__tests__/procurementPerformance.test.js`, `purchase-backend/__tests__/procurementPerformanceActivityPopulation.test.js`. Tests establish only their mocked/local scope; see required regression scenarios in linked findings.

**Readiness and UX follow-up:** Implemented / boundary gaps. AUD-007 and AUD-014; case projections depend on AUD-018 inspection event completeness.

## M04 — Procurement priority and performance

**Actual functionality:** Whole-request departmental/institutional ranking, HOD post-approval placement, active eligibility, system tier/score, transparent coverage/workload/value metrics.

**Service and database ownership:** request_priority_rankings/request queue persistence and procurement_priority_profiles/case factors; case evidence does not independently own request completion. Source: `purchase-backend/services/procurementPriority/requestQueueService.js`, `purchase-backend/services/procurementPriority/hodRankingGateService.js`, `purchase-backend/services/procurementPriority/activePrioritySql.js`, `purchase-backend/services/procurementPerformance/procurementMetricsService.js`.

**API and frontend entry points:** /api/procurement-priority; /api/procurement-performance; `purchase-frontend/src/pages/DepartmentPrioritiesPage.jsx`, `purchase-frontend/src/pages/InstitutionalPrioritiesPage.jsx`, `purchase-frontend/src/pages/SupplyChainPerformancePage.jsx`.

**States and approval requirements:** Only eligible uncompleted requests rank actively; rejected/completed/closed/cancelled/stock-fulfilled states are excluded by shared active predicates. Item assessment contributes most urgent item, not item-count sum.

**Dependencies:** HOD approval ownership, request completion, stock fulfillment, procurement case evidence and organization permissions.

**Authorization, scope, segregation, concurrency and audit:** Queue version/snapshot validation, transaction/advisory locks and audit. Department HOD authority is distinguished from a technical opinion. Performance metrics mark missing/partial evidence instead of inventing measurements.

**Competing writes, recovery, schema and operating gaps:** Disposition-driven case delivery event gap remains. Hold-adjusted main dashboard timing exists; raw cycleTime helper uses elapsed timestamps, so reconcile every published KPI basis before comparing workspaces. Runtime/schema dependencies are expanded in the database audit; unknown deployment/configuration is not a confirmed defect.

**Test evidence:** `purchase-backend/__tests__/procurementPriority/procurementPriorityRepository.test.js`, `purchase-backend/__tests__/procurementPriority/procurementPriorityService.test.js`, `purchase-backend/__tests__/procurementPriority/requestQueueService.test.js`, `purchase-backend/__tests__/procurementPriority/hodPlacementRoutes.test.js`, `purchase-backend/__tests__/procurementPerformance.test.js`, `purchase-backend/__tests__/procurementPerformanceActivityPopulation.test.js`. Tests establish only their mocked/local scope; see required regression scenarios in linked findings.

**Readiness and UX follow-up:** Implemented / reporting caveats. AUD-011 and AUD-018; KPI basis across all screens is PARTIALLY VERIFIED, not a confirmed regression.

## M05 — RFx, quotations, evaluations and awards

**Actual functionality:** RFx publication/responses, normalized line pricing/catalog identity, aggregate single-item compatibility, TCO/commercial scenario analysis, winning response→canonical award→PO.

**Service and database ownership:** rfx_events/responses/response_items; procurement_awards is canonical commercial selection; procurement_evaluation_* stores analytical scenarios/results. Source: `purchase-backend/controllers/rfxPortalController.js`, `purchase-backend/services/rfxResponseService.js`, `purchase-backend/services/rfxAwardPricingService.js`, `purchase-backend/services/procurementAwardService.js`, `purchase-backend/services/procurementEvaluationService.js`.

**API and frontend entry points:** /api/rfx-portal; /api/procurement-evaluations; `purchase-frontend/src/pages/RfxPortalPage.jsx`, `purchase-frontend/src/pages/ProcurementEvaluationsPage.jsx`.

**States and approval requirements:** Event open/closed/cancelled, response submitted/awarded/closed; analytical evaluation Draft/In Review/Finalized/Cancelled is not itself a released award/PO.

**Dependencies:** Approved request quantities, supplier eligibility, product/catalog UOM, technical/demo clearance, canonical PO.

**Authorization, scope, segregation, concurrency and audit:** Award locks request item and caps active awarded quantity; fingerprint/idempotency, catalog relationships, exact pricing and transactional audit/outbox. RFx root institute checks are missing; public response name identity needs policy evidence.

**Competing writes, recovery, schema and operating gaps:** Multi-item quotes require complete normalized lines; no arbitrary aggregate allocation. Analytical recommendation is not proven to have a production conversion command to award; contract/direct price helper is not a mounted creation workflow. Runtime/schema dependencies are expanded in the database audit; unknown deployment/configuration is not a confirmed defect.

**Test evidence:** `purchase-backend/tests/rfxAwardPricing.test.js`, `purchase-backend/tests/rfxIdentityCorrection.test.js`, `purchase-backend/tests/generateRfxController.test.js`, `purchase-backend/__tests__/procurementEvaluationService.test.js`, `purchase-backend/tests/phase4ConnectedP2P.test.js`. Tests establish only their mocked/local scope; see required regression scenarios in linked findings.

**Readiness and UX follow-up:** At risk. AUD-004, AUD-009; evaluation→award handoff is a scoped follow-up question, not a claim that normalized RFx provenance is missing.

## M06 — Purchase orders

**Actual functionality:** Request-scoped award-backed PO creation, generated numbers, submit/approve/issue/cancel/close, exact totals and budget encumbrance.

**Service and database ownership:** purchase_orders/items, award quantity allocation, document_flow_links, commitment_ledger encumbrance. Source: `purchase-backend/services/purchaseOrderService.js`, `purchase-backend/services/purchaseOrderTotalsService.js`, `purchase-backend/services/budgetCommitmentService.js`, `purchase-backend/repositories/connectedP2PRepository.js`.

**API and frontend entry points:** /api/procure-to-pay; `purchase-frontend/src/pages/ProcureToPayPurchaseOrdersPage.jsx`.

**States and approval requirements:** PO_DRAFT→PO_PENDING_APPROVAL→PO_APPROVED→PO_ISSUED→partial/delivered/closed; cancellation constraints prevent ungoverned reversals. Unscoped POST returns 410.

**Dependencies:** Award provenance, supplier eligibility, UOM snapshots, technical/demo approvals, budget envelope and receiving.

**Authorization, scope, segregation, concurrency and audit:** Award/PO/envelope locks, number collision retry, idempotent release/commitment, immutable commercial source/UOM facts and audit/outbox. Permission gates exist; institute commercial scope is incomplete.

**Competing writes, recovery, schema and operating gaps:** Quotation-bound issue currently fails on expected source-status mutation. Contract/direct award creation availability and amendment/cancel financial effects need dedicated end-to-end coverage before promising full ERP purchasing. Runtime/schema dependencies are expanded in the database audit; unknown deployment/configuration is not a confirmed defect.

**Test evidence:** `purchase-backend/tests/phase4ConnectedP2P.test.js`, `purchase-backend/tests/goldenTransactionRelationships.test.js`, `purchase-backend/tests/p2pBaseline.test.js`, `purchase-backend/tests/p2pBatch1Hardening.test.js`. Tests establish only their mocked/local scope; see required regression scenarios in linked findings.

**Readiness and UX follow-up:** Canonical core / scope gap. AUD-002, AUD-009; exact source/price authority is implemented, not merely a document attachment.

## M07 — Goods receipts and receiving

**Actual functionality:** PO-linked receipt, partial/damaged/short quantities, warehouse/UOM checks, inspection policy generation, accepted quantity projection and inventory links.

**Service and database ownership:** goods_receipts/items owned by canonical GR service/repository; accepted inventory delegated to inventory posting, not a second stock ledger. Source: `purchase-backend/services/goodsReceiptService.js`, `purchase-backend/services/goodsReceiptInventoryAdapter.js`, `purchase-backend/repositories/connectedP2PRepository.js`, `purchase-backend/services/receiptInspectionQuantities.js`.

**API and frontend entry points:** /api/procure-to-pay; /api/technical-inspections/workflow; `purchase-frontend/src/pages/ProcureToPayGoodsReceiptsPage.jsx`.

**States and approval requirements:** Physically delivered required units start held; authorized application increments accepted/rejected, leaves remaining held; accepted totals update PO partial/delivered status.

**Dependencies:** Issued PO, item/stock mapping, warehouse permission, technical profiles/dispositions, invoice matching and asset acceptance.

**Authorization, scope, segregation, concurrency and audit:** PO/line locks, receipt idempotency fingerprints and capacity calculation; held reserves capacity, rejected frees replacement capacity. Physical posting checks warehouse/institute; general commercial ID scope still needs AUD-002.

**Competing writes, recovery, schema and operating gaps:** No new owned-stock ledger for held vendor units. Vendor return/credit is not fabricated for rejected unposted goods. Crash/retry and mixed inspected/non-inspected receipts need real isolated DB validation later. Runtime/schema dependencies are expanded in the database audit; unknown deployment/configuration is not a confirmed defect.

**Test evidence:** `purchase-backend/tests/goodsReceiptService.test.js`, `purchase-backend/tests/goldenTransactionRelationships.test.js`, `purchase-backend/tests/receiptStockIdentityService.test.js`. Tests establish only their mocked/local scope; see required regression scenarios in linked findings.

**Readiness and UX follow-up:** Canonical core / integration caveats. AUD-018 case-delivery projection not emitted on release; no claim that all received gross units become available inventory.

## M08 — Technical reviews and delivery inspections

**Actual functionality:** Task worklist, filtered counts, configurable requesting/specialist reviewers, automatic required reviews, sample/data-sheet/description proposal, authentic signatures and evidence, multi-supplier device demos/COO selection, surgical consignment workflow as clinical adjuncts.

**Service and database ownership:** preprocurement_technical_reviews/assignments/policy, technical_review_profiles, delivery_inspection_tasks/assignments, immutable history/evidence references. Source: `purchase-backend/services/preprocurementTechnicalReviewService.js`, `purchase-backend/services/technicalReviewProfiles.js`, `purchase-backend/services/deliveryInspectionService.js`, `purchase-backend/services/technicalProposalSnapshot.js`, `purchase-backend/services/technicalWorklistService.js`.

**API and frontend entry points:** /api/technical-inspections; /api/technical-inspections/pre-procurement; /api/technical-inspections/workflow; /api/device-demos; /api/surgical-consignments; `purchase-frontend/src/pages/TechnicalInspectionsPage.jsx`, `purchase-frontend/src/pages/PreprocurementTechnicalReviewsPage.jsx`, `purchase-frontend/src/components/DeliveryInspectionDetail.jsx`.

**States and approval requirements:** Review pending/in-progress→approve/conditions/clarification/reject→new attested round→SCM sign-off; delivery task PENDING/IN_PROGRESS→DECIDED→ON_HOLD/CLOSED after authorized receiving application.

**Dependencies:** Final PR approval, current structural HODs, actual supplier/product/quote, attachments, GR/inventory/finance/assets; SQL 049/054/055.

**Authorization, scope, segregation, concurrency and audit:** Institute/assignment visibility, authenticated signatures, SCM/inspector independence, versioned rounds and current fingerprints. Profiles default absent/off; required routing fails closed when unresolved. Legacy form still writes request status.

**Competing writes, recovery, schema and operating gaps:** Actual configuration completeness and deployed schema unknown. Shared-product behavior corrected by SQL055/follow-up backend; do not re-report resolved missing column as a current source defect. Readiness/level selection needs user walkthrough. Runtime/schema dependencies are expanded in the database audit; unknown deployment/configuration is not a confirmed defect.

**Test evidence:** `purchase-backend/tests/technicalInspectionsScope.test.js`, `purchase-backend/tests/technicalProposalDirectory.test.js`, `purchase-backend/tests/technicalProposalSnapshot.test.js`, `purchase-backend/tests/technicalWorklistService.test.js`, `purchase-backend/tests/technicalMatching.test.js`, `purchase-backend/tests/preprocurementTechnicalReviewGate.test.js`. Tests establish only their mocked/local scope; see required regression scenarios in linked findings.

**Readiness and UX follow-up:** Implemented / specific regression. AUD-008, AUD-009, AUD-016, AUD-018; generic attachment routes still AUD-003 despite retained-evidence FK.

## M09 — Warehouse inventory, reservations, transfers and supply

**Actual functionality:** Receipts/issues/adjustments/reversals, reservations/releases/consumption, allocation/FEFO and stock-state gates, dispatch vs destination receipt, warehouse request fulfillment and dispensing.

**Service and database ownership:** inventory_movements/allocations authoritative; warehouse_stock_levels/reserved quantities are guarded projections; transfer/reservation/supply records own coordination. Source: `purchase-backend/services/inventoryPostingService.js`, `purchase-backend/repositories/inventoryRepository.js`, `purchase-backend/services/inventoryReservationService.js`, `purchase-backend/services/warehouseTransferService.js`, `purchase-backend/controllers/warehouseSupplyController.js`.

**API and frontend entry points:** /api/warehouse-inventory; /api/warehouse-transfers; /api/warehouse-supply; /api/dispensing; `purchase-frontend/src/pages/WarehouseInventoryPage.jsx`, `purchase-frontend/src/pages/WarehouseSupplyRequestsPage.jsx`.

**States and approval requirements:** Reserve→consume/release; transfer requested/approved→dispatch/in-transit→partial/final receipt; reversal is compensating evidence, not movement deletion.

**Dependencies:** Stock identity/UOM/batch/expiry/status, warehouse authorization, request approvals and maintenance parts.

**Authorization, scope, segregation, concurrency and audit:** Posting keys/fingerprints, locked balances, guarded unreserved stock update, movement+allocation audit, warehouse/institute policy. Legacy business controller direct balance writers were migrated; test scanner is supplementary evidence only.

**Competing writes, recovery, schema and operating gaps:** Fractional inventory uses Number at posting boundaries despite exact UOM helper; audit precision/tolerance with real use cases before calling it a proven loss. Transfer cancel/retry fast paths need tenant negative tests; no confirmed physical posting bypass asserted. Runtime/schema dependencies are expanded in the database audit; unknown deployment/configuration is not a confirmed defect.

**Test evidence:** `purchase-backend/tests/inventoryFoundation.test.js`, `purchase-backend/tests/inventoryIntegrityCorrection.test.js`, `purchase-backend/tests/warehouseInventoryController.test.js`, `purchase-backend/__tests__/maintenanceInventoryMigration.test.js`, `purchase-backend/__tests__/maintenanceInventoryService.test.js`, `purchase-backend/__tests__/physicalInventoryMigration.test.js`. Tests establish only their mocked/local scope; see required regression scenarios in linked findings.

**Readiness and UX follow-up:** Canonical core / scope review required. AUD-006 planning mutation boundary; deployment balance constraints and operational expiry/recall policy require owner evidence.

## M10 — Item Master, UOM and product identity

**Actual functionality:** Governed lifecycle, duplicates/aliases, approved product/catalog identity, pending referrals, non-stock/free-text exceptions, starter reference lists and controlled stock mapping.

**Service and database ownership:** generic_items functional identity; approved_products exact manufacture; supplier_catalog_items commercial offer; item_uom/conversions and request identity/stock mappings. Source: `purchase-backend/services/itemMasterFoundationService.js`, `purchase-backend/services/procurementItemIdentityService.js`, `purchase-backend/services/requestItemResolutionService.js`, `purchase-backend/services/uomConversionService.js`, `purchase-backend/services/stockItemMappingService.js`.

**API and frontend entry points:** /api/item-master; /api/stock-items; /api/stock-item-requests; `purchase-frontend/src/pages/ItemMasterPage.jsx`, `purchase-frontend/src/components/requests/RequestItemIdentityFields.jsx`.

**States and approval requirements:** Generic draft/review/validation/approval/active; request unresolved/pending/approved exception/catalogued. Identity enforcement switch permits only explicitly bounded non-inventory compatibility.

**Dependencies:** All requests, awards, PO/GR, inventory, assets and contracts. Universal UOM differs from product/package conversion.

**Authorization, scope, segregation, concurrency and audit:** Exact decimal-string conversion with BigInt, canonical requested-item write service, consumed-line immutability and authority checks. Physical receipt still requires governed stock mapping even with enforcement off.

**Competing writes, recovery, schema and operating gaps:** NULL shared supplier/product scope is supported by technical proposals; assets require exact institute for linked master IDs. Confirm intended global catalog policy before changing it. Missing starter lists is data/configuration, not proof of missing tables. Runtime/schema dependencies are expanded in the database audit; unknown deployment/configuration is not a confirmed defect.

**Test evidence:** `purchase-backend/tests/itemMasterFoundationSearch.test.js`, `purchase-backend/tests/itemMasterFoundationService.test.js`, `purchase-backend/tests/itemMasterFoundationValidator.test.js`, `purchase-backend/tests/itemMasterMigration.test.js`, `purchase-backend/tests/procurementIdentityPolicyAuthorization.test.js`, `purchase-backend/tests/procurementIdentityPolicyService.test.js`. Tests establish only their mocked/local scope; see required regression scenarios in linked findings.

**Readiness and UX follow-up:** Implemented / policy consistency caveat. AUD-010 runtime schema, AUD-020 deployed contract. Global catalog vs institute asset links is PARTIALLY VERIFIED integration policy debt.

## M11 — Fixed assets, RFID and custody

**Actual functionality:** Register/valuation, acceptance-aware procurement links, deployment/movement approvals, physical counts/variance verification, tags/readers/portals, service-credential ingestion, directional evidence/exceptions and custody approval.

**Service and database ownership:** assets/movements/tags/locations/physical inventory and rfid_read/business events; legacy custody tables coexist with asset movements rather than inventory quantity ownership. Source: `purchase-backend/services/fixedAssetService.js`, `purchase-backend/repositories/fixedAssetRepository.js`, `purchase-backend/services/rfidService.js`, `purchase-backend/services/rfidEventProcessor.js`, `purchase-backend/controllers/custodyController.js`.

**API and frontend entry points:** /api/assets; /api/rfid; /api/rfid (service credentials only on ingestion); /api/custody; `purchase-frontend/src/pages/fixed-assets/Operations.jsx`, `purchase-frontend/src/pages/fixed-assets/RfidOperations.jsx`, `purchase-frontend/src/pages/fixed-assets/PhysicalInventory.jsx`, `purchase-frontend/src/pages/custody/CustodyApprovals.jsx`.

**States and approval requirements:** Movement requested→approved/in-transit→received/cancelled; asset service/storage/maintenance/disposal variants; RFID observation processing is separate from authorized movement.

**Dependencies:** Equipment register, department/location ownership, accepted GR capacity, users and hardware integration.

**Authorization, scope, segregation, concurrency and audit:** Scoped repositories, optimistic row versions, link validation, movement audit, scoped RFID service credentials. Observation never directly transfers ownership. RFID worker lacks stale committed-claim recovery.

**Competing writes, recovery, schema and operating gaps:** Hardware read quality, service deployment, physical count procedures and legacy custody→asset reconciliation not established from unit mocks. Shared catalog link acceptance needs explicit policy. Runtime/schema dependencies are expanded in the database audit; unknown deployment/configuration is not a confirmed defect.

**Test evidence:** `purchase-backend/__tests__/fixedAssetOperations.test.js`, `purchase-backend/__tests__/fixedAssetsRfidCore.test.js`, `purchase-backend/__tests__/rfidIngestionRoutes.test.js`, `purchase-backend/__tests__/physicalInventoryMigration.test.js`, `purchase-backend/__tests__/physicalInventoryService.test.js`. Tests establish only their mocked/local scope; see required regression scenarios in linked findings.

**Readiness and UX follow-up:** Implemented / recovery gap. AUD-012 stranded RFID processing; AUD-017 physical-inventory test lint. Hardware/live gateway NOT VERIFIED.

## M12 — Contracts and financial obligations

**Actual functionality:** Contract authoring/review/signing/archive/renewal, terms/docs/versioning, obligations, risk/AI extraction, item prices and equipment coverage; separate invoice/payment registers.

**Service and database ownership:** contracts/items/amendments/documents/approvals/obligations/renewals/coverage; contract_invoices/payments/consumption remain competing financial authority. Source: `purchase-backend/controllers/contractsController.js`, `purchase-backend/controllers/contractGovernanceController.js`, `purchase-backend/services/contractItemIdentityService.js`, `purchase-backend/services/contractEquipmentCoverageService.js`.

**API and frontend entry points:** /api/contracts; /api/contract-evaluations; /api/contract-templates; /api/contract-clauses; `purchase-frontend/src/pages/ContractsPage.jsx`, `purchase-frontend/src/pages/ContractApprovalsPanel.jsx`, `purchase-frontend/src/pages/ContractApprovalStageMonitor.jsx`.

**States and approval requirements:** draft→under_review/legal/technical/finance/executive→sent_for_signature→active→renewed/expired/terminated/archived; obligation open→completed/waived/cancelled with recurrence.

**Dependencies:** Supplier, equipment, identity/catalog, approvals, files, canonical AP and budgeting.

**Authorization, scope, segregation, concurrency and audit:** Management capability and contract approval roles, logs and selected row locks exist; child scopes are global and settlement paths lack canonical posting/locking. Some early next(error) branches in transaction code need cleanup tests before classifying pooled-session leakage.

**Competing writes, recovery, schema and operating gaps:** Do not convert records blindly or run duplicate payment history into AP. Need full historical reconciliation, supplier/currency/retention/tax obligations and non-PO service liability design. Runtime/schema dependencies are expanded in the database audit; unknown deployment/configuration is not a confirmed defect.

**Test evidence:** `purchase-backend/tests/contractApprovalWorkflow.test.js`, `purchase-backend/__tests__/contractItemIdentityMigration.test.js`, `purchase-backend/__tests__/contractItemIdentityService.test.js`, `purchase-backend/__tests__/contractEquipmentCoverageMigration.test.js`, `purchase-backend/__tests__/contractEquipmentCoverageRepository.test.js`, `purchase-backend/__tests__/contractEquipmentCoverageService.test.js`. Tests establish only their mocked/local scope; see required regression scenarios in linked findings.

**Readiness and UX follow-up:** At risk. AUD-001 competing writers; AUD-005 institute access; AUD-010 runtime DDL; incomplete transactional handling is a follow-up investigation, not a proven deployed leak.

## M13 — Supplier master, SRM and evaluations

**Actual functionality:** Supplier directory and classification, principals/authorized representation, compliance issues/artifacts, KPI/weighted evaluations and eligibility facts used before commercial actions.

**Service and database ownership:** suppliers/principals/authorizations, scorecards/issues/compliance artifacts and supplier_evaluations; name snapshots are not canonical supplier identity. Source: `purchase-backend/controllers/suppliersController.js`, `purchase-backend/controllers/supplierSrmController.js`, `purchase-backend/controllers/supplierEvaluationsController.js`, `purchase-backend/services/supplierEligibilityService.js`, `purchase-backend/services/supplierReferenceService.js`.

**API and frontend entry points:** /api/suppliers; /api/supplier-srm; /api/supplier-evaluations; `purchase-frontend/src/pages/SuppliersPage.jsx`, `purchase-frontend/src/pages/SupplierSrmPage.jsx`, `purchase-frontend/src/pages/SupplierEvaluationsPage.jsx`.

**States and approval requirements:** Active/inactive/suspended/blacklisted supplier status; issues and compliance vary by module. Evaluation score is advisory unless an explicit gate consumes it.

**Dependencies:** RFx/awards, contracts, PO/invoice supplier identity and product regulatory metadata.

**Authorization, scope, segregation, concurrency and audit:** Manage/evaluation permissions and referential validation exist. Shared suppliers are explicit NULL-owned compatibility, not intrinsically a tenant leak. Legacy SRM/evaluation queries require root supplier visibility review; no blanket isolation certification.

**Competing writes, recovery, schema and operating gaps:** Category/license qualification is explicitly deferred in eligibility service; policy necessity is not established. Name-based public response resolution may create duplicate or spoofed representation. Runtime/schema dependencies are expanded in the database audit; unknown deployment/configuration is not a confirmed defect.

**Test evidence:** `purchase-backend/tests/supplierEvaluationsController.test.js`, `purchase-backend/tests/supplierReferenceService.test.js`, `purchase-backend/tests/suppliersController.test.js`, `purchase-backend/__tests__/supplierPrincipalsController.test.js`. Tests establish only their mocked/local scope; see required regression scenarios in linked findings.

**Readiness and UX follow-up:** Implemented / policy evidence needed. AUD-019 policy-dependent qualification; AUD-004 public supplier identity; AUD-005 linked contract visibility.

## M14 — Accounts payable, matching and payments

**Actual functionality:** Invoice source identity and duplicate number control, exact 2/3-way matching/authorized override, finance verification, balanced voucher/posting, payable creation/partial settlement.

**Service and database ownership:** supplier_invoices/invoice_items/match_results, verified AP vouchers, finance_postings, ap_payables/payment_records/payment_allocations; not contract_* settlement tables. Source: `purchase-backend/services/supplierInvoiceService.js`, `purchase-backend/services/invoiceMatchingService.js`, `purchase-backend/services/financeVerificationService.js`, `purchase-backend/services/apPostingService.js`, `purchase-backend/services/paymentService.js`, `purchase-backend/services/technicalFinancialGate.js`.

**API and frontend entry points:** /api/procure-to-pay; `purchase-frontend/src/pages/ProcureToPayInvoicesPage.jsx`, `purchase-frontend/src/pages/ProcureToPayMatchingPage.jsx`, `purchase-frontend/src/pages/ProcureToPayAccountsPayablePage.jsx`, `purchase-frontend/src/pages/ProcureToPayPaymentsPage.jsx`.

**States and approval requirements:** Invoice submitted/match exception or verified→finance verified→AP voucher verified/posted→payable open/partially paid/paid; inactive invoices excluded by explicit predicates.

**Dependencies:** Canonical PO, accepted GR quantities (including technical services), commitment actualization, ledger dimensions and supplier currency.

**Authorization, scope, segregation, concurrency and audit:** PO/invoice/payable locks, source fingerprints, deterministic retry keys, balanced-account validation, accepted-unit cumulative guard and transactional audit/outbox. Institute authorization and independent legacy contract settlement remain gaps.

**Competing writes, recovery, schema and operating gaps:** Tax/discount/retention, credit notes/refunds/reversals and non-PO contract service invoices require an explicitly bounded roadmap; do not infer fully implemented statutory AP from internal posting labels. Runtime/schema dependencies are expanded in the database audit; unknown deployment/configuration is not a confirmed defect.

**Test evidence:** `purchase-backend/__tests__/phase4cEffectiveMatchState.test.js`, `purchase-backend/__tests__/phase4cInvoiceMatching.test.js`, `purchase-backend/__tests__/phase4dAccountingBridge.test.js`, `purchase-backend/tests/technicalMatching.test.js`. Tests establish only their mocked/local scope; see required regression scenarios in linked findings.

**Readiness and UX follow-up:** Canonical core / competing legacy writers. AUD-001 and AUD-002; absence of hosted financial reconciliation is AUD-020, not a confirmed monetary loss.

## M15 — Budget control and general ledger

**Actual functionality:** Department/project/year/currency budgets, release-time encumbrance, invoice actualization, balanced posting records and financial summaries.

**Service and database ownership:** budget_envelopes, commitment_ledger stages/projections, journal_entries/lines, gl_postings/lines, accounts/cost centers. Source: `purchase-backend/services/budgetCommitmentService.js`, `purchase-backend/services/financeCoreService.js`, `purchase-backend/services/accountingEntryValidation.js`, `purchase-backend/controllers/budgetControlController.js`, `purchase-backend/services/apPostingService.js`.

**API and frontend entry points:** /api/budget-control; /api/procure-to-pay; `purchase-frontend/src/pages/BudgetControlPage.jsx`, `purchase-frontend/src/pages/ProcureToPayAccountsPayablePage.jsx`.

**States and approval requirements:** Reservation/encumbrance/actual are distinct ledger stages; AP posting reduces active commitment. Payment settles liability, not another purchase expense.

**Dependencies:** PR department/project dimensions, canonical PO release, finance/AP voucher matching and payment.

**Authorization, scope, segregation, concurrency and audit:** Canonical budget commitment locks envelope, filters year/currency and uses exact totals. Older financeCore snapshots and budget controller aggregate ledger stages without canonical active-state semantics, and budget authorization is broad roles without institute constraints.

**Competing writes, recovery, schema and operating gaps:** Budget dashboard historical totals can differ from active PO headroom: validate active/released stage semantics with a controlled fixture before certifying availability. Statutory fiscal close, FX/revaluation and external GL export/acknowledgment are not demonstrated. Runtime/schema dependencies are expanded in the database audit; unknown deployment/configuration is not a confirmed defect.

**Test evidence:** `purchase-backend/__tests__/accountingEntryValidation.test.js`, `purchase-backend/__tests__/phase4dAccountingBridge.test.js`, `purchase-backend/__tests__/connectedP2PRepositoryFinance.test.js`. Tests establish only their mocked/local scope; see required regression scenarios in linked findings.

**Readiness and UX follow-up:** Implemented internal accounting / boundary gaps. AUD-002 commercial scope also applies; budget-specific root department isolation is not certified. Accounting/report semantics need a focused follow-up, not a claim of absent balanced posting.

## M16 — Procurement planning

**Actual functionality:** Upload annual plans, item budget/quantity lines, demand linking/variance, forecast/safety-stock/MRP and replenishment suggestions/settings.

**Service and database ownership:** procurement_plans/items/request_links/consumption links; warehouse defaults/replenishment policies; advisory demand outputs do not own purchasing. Source: `purchase-backend/controllers/procurement/plansController.js`, `purchase-backend/controllers/demandPlanningController.js`, `purchase-backend/utils/ensureProcurementPlanTables.js`.

**API and frontend entry points:** /api/procurement-plans; /api/planning; `purchase-frontend/src/pages/ProcurementPlansPage.jsx`, `purchase-frontend/src/pages/PlanningWorkbench.jsx`.

**States and approval requirements:** Advisory forecasts and links, not automatic released purchasing approval. No evidenced full plan version approval/release lifecycle.

**Dependencies:** Department/warehouse scope, request quantities, canonical inventory movement consumption, budget and source identity.

**Authorization, scope, segregation, concurrency and audit:** Authentication only on many planning commands; no appropriate role/institute scope. Link transactions exist but do not establish authorization. Some consumption reads still use legacy movement tables rather than canonical inventory allocations.

**Competing writes, recovery, schema and operating gaps:** Canonical consumption-link migration and controlled plan versioning needed. Distinguish calculated forecast from confirmed budget or approved order. Local plan-file URL is affected by upload exposure. Runtime/schema dependencies are expanded in the database audit; unknown deployment/configuration is not a confirmed defect.

**Test evidence:** `purchase-frontend/src/pages/PlanningWorkbench.test.jsx`. Tests establish only their mocked/local scope; see required regression scenarios in linked findings.

**Readiness and UX follow-up:** At risk. AUD-006 and AUD-003; historical demand/movement coverage remains incomplete evidence, not invented forecast certainty.

## M17 — Maintenance and spare parts

**Actual functionality:** Equipment/approved part compatibility, technical decisions, stock policy, work order assignment/status/downtime, reserve/issue/release via canonical inventory service.

**Service and database ownership:** maintenance_work_orders/parts and inventory-operation links, spare_parts/compatibility, equipment and contract_equipment_coverage. Source: `purchase-backend/services/maintenanceService.js`, `purchase-backend/repositories/maintenanceRepository.js`, `purchase-backend/services/sparePartsService.js`, `purchase-backend/repositories/sparePartsRepository.js`.

**API and frontend entry points:** /api/maintenance; /api/spare-parts; /api/equipment; `purchase-frontend/src/pages/EquipmentManagementPage.jsx`, `purchase-frontend/src/pages/SparePartsRegisterPage.jsx`, `purchase-frontend/src/pages/SparePartDetailPage.jsx`.

**States and approval requirements:** OPEN→IN_PROGRESS↔ON_HOLD→COMPLETED/CANCELLED; completion requires resolution summary and no active part reservations; terminal work cannot add/reserve parts.

**Dependencies:** Equipment/assets/coverage, approved compatible Stock Item, warehouse authorization and existing maintenance purchase-request route.

**Authorization, scope, segregation, concurrency and audit:** Explicit route capabilities, institute-scoped repositories, row versions, row locks, operation keys and transactional business audit. Inventory calls preserve stock permission boundaries.

**Competing writes, recovery, schema and operating gaps:** Legacy maintenance purchase requests and equipment work orders are distinct workspaces. No verified automatic crosslink from every maintenance request to a work order. Real downtime/parts/contract SLA procedure needs user validation. Runtime/schema dependencies are expanded in the database audit; unknown deployment/configuration is not a confirmed defect.

**Test evidence:** `purchase-backend/tests/maintenanceApprovalReportingPolicy.test.js`, `purchase-backend/tests/maintenanceApprovalScorecards.test.js`, `purchase-backend/tests/maintenanceNotifications.test.js`, `purchase-backend/__tests__/maintenanceInventoryMigration.test.js`, `purchase-backend/__tests__/maintenanceInventoryService.test.js`, `purchase-backend/__tests__/maintenanceMigration.test.js`. Tests establish only their mocked/local scope; see required regression scenarios in linked findings.

**Readiness and UX follow-up:** Implemented / integration validation needed. No new confirmed canonical-part bypass found in inspected paths. AUD-020 deployment and separate legacy request completion caveats still apply.

## M18 — Notifications, audit logs and reporting

**Actual functionality:** Transactional business events, in-app delivery/retries, trace IDs, governance audit, pending approval role/person scorecards, Excel and hold-adjusted dashboards.

**Service and database ownership:** notification_outbox/notifications, audit_logs/governance_audit_trail, request/contract historical logs and performance read models. Source: `purchase-backend/services/notificationOutboxService.js`, `purchase-backend/services/notificationOutboxProcessor.js`, `purchase-backend/services/auditService.js`, `purchase-backend/middleware/writeAuditTrail.js`, `purchase-backend/controllers/dashboardController.js`, `purchase-backend/services/approvalTimingSql.js`.

**API and frontend entry points:** /api/notifications; /api/audit-log; /api/audit-registry; /api/dashboard; /api/procurement-performance; `purchase-frontend/src/pages/MyMaintenanceRequests.jsx`, `purchase-frontend/src/pages/SupplyChainPerformancePage.jsx`.

**States and approval requirements:** Outbox pending/failed→processing→delivered; bounded retry and stale processing reclaim; multiple legacy email/notification paths still exist.

**Dependencies:** Canonical event producer payloads/item IDs, current approval snapshots, request scope and retained immutable evidence.

**Authorization, scope, segregation, concurrency and audit:** Outbox transaction/savepoint/skip-locked/idempotency; transactional canonical audit. Generic audit is after-response/best-effort and records sanitized payload, not a universal business transaction guarantee.

**Competing writes, recovery, schema and operating gaps:** Clinical payload retention policy, dead-letter visibility and owner-operated recovery not established. Missing inspection acceptance event leaves case reporting stale even when PO/inventory is correct. Runtime/schema dependencies are expanded in the database audit; unknown deployment/configuration is not a confirmed defect.

**Test evidence:** `purchase-frontend/src/pages/ProcureToPayDashboardPage.test.jsx`. Tests establish only their mocked/local scope; see required regression scenarios in linked findings.

**Readiness and UX follow-up:** Mixed guarantees. AUD-014, AUD-018, AUD-011; approved hold timing changes exist and should not be reported globally missing.

## M19 — Authentication, authorization and institute isolation

**Actual functionality:** JWT algorithm/optional issuer/audience restrictions, active database user refresh, fail-closed permission lookup, capability catalog/UI resource policies and service-only RFID credentials.

**Service and database ownership:** users/roles/permissions/user section assignments/capability policies; current DB authority loaded on each JWT-authenticated request. Source: `purchase-backend/middleware/authMiddleware.js`, `purchase-backend/utils/permissionService.js`, `purchase-backend/middleware/requirePermission.js`, `purchase-backend/policies/requestPolicy.js`, `purchase-backend/policies/inventoryPolicy.js`.

**API and frontend entry points:** /api/auth; /api/permissions; /api/roles; /api/capability-policies; /api/ui-access; `purchase-frontend/src/api/axios.js`, `purchase-frontend/src/App.js`.

**States and approval requirements:** Token valid→current active user/authority; absent/malformed/expired token rejected; permission lookup failure is 503, not broad access.

**Dependencies:** All modules must add object scope; authentication is not an institute filter. UI policy is navigation guidance, not backend authority.

**Authorization, scope, segregation, concurrency and audit:** Canonical request/inventory/technical/asset modules demonstrate explicit scope. Contracts/P2P/RFx/planning/attachments/autoassignment have identified gaps. Role fallbacks coexist with configurable permissions and need explicit governance.

**Competing writes, recovery, schema and operating gaps:** Hosted RLS/service role, token lifetimes/revocation policy, CORS/proxy deployment and audit retention are unknown. No credential scan/export was performed and no claim of deployed breach is made. Runtime/schema dependencies are expanded in the database audit; unknown deployment/configuration is not a confirmed defect.

**Test evidence:** `purchase-backend/tests/authController.test.js`, `purchase-backend/tests/authMiddleware.test.js`, `purchase-backend/tests/authRoutes.test.js`, `purchase-backend/__tests__/authMiddleware.test.js`, `purchase-backend/tests/phase5a2UomAuthority.test.js`, `purchase-backend/tests/procurementIdentityPolicyAuthorization.test.js`. Tests establish only their mocked/local scope; see required regression scenarios in linked findings.

**Readiness and UX follow-up:** At risk. AUD-002 through AUD-007, AUD-020; database role privileges cannot be inferred from API mocks.

## M20 — Frontend navigation, usability and API integration

**Actual functionality:** Role/resource-aware navigation, request workspace, P2P transaction/list routes, worklists, Management setup and Arabic/English export paths through common API clients.

**Service and database ownership:** UI state only; canonical backend remains authority. Local storage carries token; no independent financial/inventory ledger in frontend is authorized.. Source: `purchase-frontend/src/App.js`, `purchase-frontend/src/api/axios.js`, `purchase-frontend/src/pages/Management.jsx`.

**API and frontend entry points:** ; `purchase-frontend/src/App.js`, `purchase-frontend/src/api/axios.js`, `purchase-frontend/src/pages/Management.jsx`.

**States and approval requirements:** Frontend loading/error/version conflict states mirror backend; parallel legacy request/technical/finance workspaces remain accessible for compatibility.

**Dependencies:** Backend capabilities, scoped directory setup, deployed API/frontend version alignment and correct build publication.

**Authorization, scope, segregation, concurrency and audit:** Canonical Axios injects token and centralizes explicit session-expired 401 handling; route visibility is supplementary. Broad API errors currently surface schema text; modules vary in recovery and draft preservation.

**Competing writes, recovery, schema and operating gaps:** Strict CI build and lint fail despite passing component tests. No live browser/mobile/RTL or assistive-technology evaluation. Progressive disclosure and role-specific task screens should follow integrity corrections. Runtime/schema dependencies are expanded in the database audit; unknown deployment/configuration is not a confirmed defect.

**Test evidence:** `purchase-frontend/src/pages/RequestListNavigation.test.jsx`, `purchase-frontend/src/api/axios.test.js`, `purchase-frontend/src/pages/TechnicalWorklistPage.test.jsx`, `purchase-frontend/src/pages/ProcureToPayDashboardPage.test.jsx`, `purchase-frontend/src/pages/ProcureToPayLifecyclePage.test.jsx`, `purchase-frontend/src/pages/DepartmentPrioritiesPage.test.jsx`. Tests establish only their mocked/local scope; see required regression scenarios in linked findings.

**Readiness and UX follow-up:** Implemented / quality gates fail. AUD-016, AUD-017; no broad redesign is implemented in this documentation-only audit.

## Mounted endpoint evidence appendix

Base mounts come from purchase-backend/app.js. Literal routes below are extracted from each current router to make the inventory reviewable; dynamic/generated routes (for example technical delivery actions) require reading the router. This is not an OpenAPI specification or proof every endpoint is authorized correctly. API prefixes and frontend App.js routes must be read together.

### requests — /api/requests

Source: `purchase-backend/routes/requests.js`.

`POST /`, `POST /historical`, `GET /`, `GET /my`, `GET /my-maintenance`, `GET /pending-approvals`, `GET /hod-approvers`, `GET /assigned`, `GET /completed-assigned`, `GET /closed`, `GET /audit/approved-rejected`, `GET /approval-history`, `GET /procurement-users`, `PATCH /:id/central-supply-status`, `POST /:id/scm-rejection`, `POST /:id/request-hod-approval`, `PATCH /:id/mark-completed`, `PATCH /:id/mark-received`, `PATCH /:id/report-receipt-issue`, `PUT /:id/cost`, `PUT /:id/edit`, `PUT /:id/request-type`, `POST /:requestId/items/:itemId/procurement-events`, `PATCH /:requestId/procurement-events/:eventId/overage-decision`, `POST /:requestId/items/:itemId/resolve-identity`, `POST /:requestId/items/:itemId/pending-item`, `GET /:requestId/items/:itemId/procurement-events`, `DELETE /:id/hard-delete`, `GET /pending-maintenance-approvals`, `POST /approve-maintenance`, `PUT /maintenance/reassign-to-requester`, `GET /incomplete`, `GET /incomplete/medical`, `GET /incomplete/operational`, `GET /export/csv`, `GET /export/pdf`, `GET /:requestId/full-details`, `POST /:requestId/notes`, `GET /:id/items`, `GET /:id/logs`, `GET /:id/status-communications`, `POST /:id/status-communications`, `POST /:id/direct-purchase-communications`, `GET /:id/rfx`, `GET /:id/print`, `GET /:id`, `PUT /approval/:id`, `PUT /assign`, `PUT /assign-procurement`, `PUT /:id/split-assign-procurement`

### requestedItems — /api/requested-items

Source: `purchase-backend/routes/requestedItems.js`.

`POST /`, `PUT /:id/cost`, `PUT /:item_id/procurement-status`, `PUT /:item_id/purchased-quantity`

### organization — /api/organization

Source: `purchase-backend/routes/organization.js`.

`GET /tree`, `GET /units`, `GET /options`, `GET /resolve/:departmentId`, `GET /health`, `GET /head-reconciliation`, `GET /head-reconciliation/preview`, `POST /head-reconciliation/bulk`, `GET /units/:id`, `GET /units/:id/positions`, `POST /units`, `PATCH /units/:id`, `DELETE /units/:id`, `POST /units/:id/move`, `POST /units/:id/head`, `POST /units/:id/reconcile-head`, `POST /units/:id/reconciliation-decision`, `POST /units/:id/positions`, `PATCH /positions/:positionId`, `DELETE /positions/:positionId`

### approvals — /api/approvals

Source: `purchase-backend/routes/approvals.js`.

`GET /summary`, `GET /request/:request_id/approvals`, `POST /request/:request_id/remind-current`, `PATCH /:id/decision`, `GET /:id/department-ranking`, `POST /:id/department-ranking`, `GET /email-action`, `PATCH /:id/hold`, `PATCH /:id/items`, `GET /summary/statistics`

### approvalRoutes — /api/approval-routes

Source: `purchase-backend/routes/approvalRoutes.js`.

`GET /`, `POST /`, `POST /simulate`, `PUT /:id`, `DELETE /:id`

### approvalPolicies — /api (approval-policies / approval-policy-versions / approval-policy-shadow-runs / approval-policy-readiness)

Source: `purchase-backend/routes/approvalPolicies.js`.

### approvalDelegations — /api/approval-authority-delegations

Source: `purchase-backend/routes/approvalDelegations.js`.

### requestAutoAssignmentRules — /api/request-auto-assignment-rules

Source: `purchase-backend/routes/requestAutoAssignmentRules.js`.

`GET /`, `POST /`, `PUT /:id`, `DELETE /:id`

### procurementPerformance — /api/procurement-performance

Source: `purchase-backend/routes/procurementPerformance.js`.

`GET /dashboard`, `GET /cases/:id`, `POST /cases/:id/complexity`, `POST /cases/:id/value-events/verify`, `POST /cases/:id/activities`

### procurementPriority — /api/procurement-priority

Source: `purchase-backend/routes/procurementPriority.js`.

`PUT /department/reorder`, `PUT /institutional-order`, `PUT /cases/:id/institutional-rank`, `GET /public`, `GET /department`, `GET /cases/:id`, `GET /cases/:id/history`, `PUT /cases/:id/assessment`, `POST /cases/:id/preview`, `POST /groups`, `GET /manage`, `GET /groups`, `PUT /groups/:id`, `PUT /groups/:id/archive`

### rfxPortal — /api/rfx-portal

Source: `purchase-backend/routes/rfxPortal.js`.

`GET /`, `GET /offerings`, `POST /`, `PATCH /:id/status`, `GET /:id/responses`, `POST /:id/responses`, `POST /:id/analyze`, `POST /:id/award`

### procurementEvaluations — /api/procurement-evaluations

Source: `purchase-backend/routes/procurementEvaluations.js`.

`GET /import/template.csv`, `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`, `GET /:id/offers`, `POST /:id/offers`, `PATCH /:id/offers/:offerId`, `DELETE /:id/offers/:offerId`, `GET /:id/scenarios`, `POST /:id/scenarios`, `GET /:id/tests`, `POST /:id/tests`, `PATCH /:id/tests/:testId`, `DELETE /:id/tests/:testId`, `GET /:id/offer-test-costs`, `DELETE /:id/offer-test-costs/:offerId/:testId`, `PUT /:id/offer-test-costs/bulk`, `GET /:id/coverage`, `GET /:id/item-comparison`, `POST /:id/import/preview`, `POST /:id/offers/:offerId/import`, `GET /:id/criteria`, `POST /:id/criteria`, `PATCH /:id/criteria/:criteriaId`, `DELETE /:id/criteria/:criteriaId`, `GET /:id/scores`, `PUT /:id/scores/bulk`, `POST /:id/calculate`, `GET /:id/results`, `GET /:id/sensitivity`, `POST /:id/break-even`, `GET /:id/optimization`, `GET /:id/recommendation`, `GET /:id/compliance-matrix`, `GET /:id/disqualification-review`, `GET /:id/risk-adjusted-tco`, `GET /:id/report-summary`, `PATCH /:id/finalize`, `PATCH /:id/reopen`

### procureToPay — /api/procure-to-pay

Source: `purchase-backend/routes/procureToPay.js`.

`GET /dashboard`, `GET /purchase-orders`, `GET /po-source-requests`, `GET /purchase-orders/:poId`, `GET /goods-receipts`, `GET /open-pos-for-receipt`, `GET /ap-invoices`, `GET /invoice-matching-queue`, `GET /accounts-payable`, `GET /payments`, `GET /document-flow`, `GET /requests/:requestId/lifecycle`, `POST /purchase-orders`, `POST /requests/:requestId/purchase-orders`, `POST /purchase-orders/:poId/submit-approval`, `POST /purchase-orders/:poId/approve`, `POST /purchase-orders/:poId/issue`, `POST /purchase-orders/:poId/cancel`, `POST /purchase-orders/:poId/close`, `POST /requests/:requestId/receipts`, `GET /requests/:requestId/receipts`, `POST /requests/:requestId/invoices`, `POST /requests/:requestId/invoices/:invoiceId/match`, `POST /requests/:requestId/match-results/:matchResultId/override`, `POST /requests/:requestId/match-results/:matchResultId/decline`, `POST /ap-invoices/:invoiceId/post-payable`, `POST /accounts-payable/:payableId/payments`, `GET /document-flow/request/:requestId`, `POST /requests/:requestId/vouchers`, `POST /ap-vouchers/:voucherId/verify`, `POST /requests/:requestId/verify`, `POST /requests/:requestId/post-ledger`, `POST /requests/:requestId/payment-pending`, `POST /requests/:requestId/payments/:paymentId/paid`

### technicalWorkflow — /api/technical-inspections/workflow

Source: `purchase-backend/routes/technicalWorkflow.js`.

`GET /profiles`, `PUT /profiles`, `GET /receipt-options`, `POST /generate`, `GET /delivery/:id`, `POST /delivery/:id/apply`

### technicalInspections — /api/technical-inspections

Source: `purchase-backend/routes/technicalInspections.js`.

`GET /worklist`, `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id`

### preprocurementTechnicalReviews — /api/technical-inspections/pre-procurement

Source: `purchase-backend/routes/preprocurementTechnicalReviews.js`.

`GET /schema`, `GET /proposals`, `GET /policy`, `PUT /policy`, `GET /reviewers`, `GET /eligible-requests`, `GET /`, `POST /`, `GET /:id`, `POST /:id/opinion`, `POST /:id/sign-off`, `POST /:id/cancel`, `POST /:id/revise`, `POST /:id/start`

### deviceDemos — /api/device-demos

Source: `purchase-backend/routes/deviceDemos.js`.

`GET /schema`, `GET /eligible-items`, `GET /reviewers`, `GET /`, `POST /`, `GET /:id`, `GET /:id/options`

### surgicalConsignments — /api/surgical-consignments

Source: `purchase-backend/routes/surgicalConsignments.js`.

`GET /schema`, `GET /settings`, `PUT /settings`, `GET /routing`, `GET /options`, `GET /`, `POST /`, `GET /:id`, `GET /:id/purchase-orders`, `POST /:id/files`, `GET /:id/files/:fileId/download`

### warehouseInventory — /api/warehouse-inventory

Source: `purchase-backend/routes/warehouseInventory.js`.

`POST /stock`, `POST /stock/discard`, `POST /stock/issue`, `GET /transactions`, `GET /reports/weekly`, `GET /:warehouseId/items`

### warehouseTransfers — /api/warehouse-transfers

Source: `purchase-backend/routes/warehouseTransfers.js`.

`POST /`, `GET /:transferId`, `POST /:transferId/approve`, `POST /:transferId/reject`, `POST /:transferId/receive`, `POST /:transferId/cancel`

### warehouseSupply — /api/warehouse-supply

Source: `purchase-backend/routes/warehouseSupply.js`.

`GET /`, `POST /:requestId/items`, `POST /:requestId/close`, `GET /:id/print`

### dispensing — /api/dispensing

Source: `purchase-backend/routes/dispensing.js`.

`POST /monthly/import`, `GET /monthly`, `GET /monthly/analytics`

### itemMaster — /api/item-master

Source: `purchase-backend/routes/itemMaster.js`.

`GET /procurement-policy`, `PUT /procurement-policy`, `GET /foundation/generic-items`, `GET /foundation/references`, `POST /foundation/references/initialize`, `GET /foundation/references/:type`, `POST /foundation/references/:type`, `DELETE /foundation/references/:type/:id`, `POST /foundation/generic-items`, `POST /foundation/generic-items/:id/transition`, `GET /foundation/products`, `POST /foundation/products`, `POST /foundation/products/:id/approve`, `POST /foundation/products/:id/decision`, `GET /foundation/supplier-catalog`, `POST /foundation/supplier-catalog`, `PUT /foundation/supplier-catalog/:id`, `DELETE /foundation/supplier-catalog/:id`, `POST /foundation/pending-items`, `GET /foundation/pending-items`, `POST /foundation/pending-items/:id/resolve`, `POST /foundation/duplicates/:id/resolve`, `POST /foundation/merges`, `GET /foundation/legacy/coverage`, `GET /foundation/legacy/unmapped`, `POST /foundation/legacy/mappings`, `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `POST /:id/submit`, `POST /:id/approve`, `POST /:id/reject`, `POST /:id/documents`

### stockItems — /api/stock-items

Source: `purchase-backend/routes/stockItems.js`.

`GET /`, `GET /unassigned`, `POST /add-from-master`, `GET /mappings`, `GET /mapping-coverage`, `GET /mappings/:mappingId`, `GET /:stockItemId/mappings`, `POST /mappings/propose`, `POST /mappings/:mappingId/review`, `POST /mappings/:mappingId/approve`, `POST /mappings/:mappingId/reject`, `POST /mappings/:mappingId/mark-duplicate`, `POST /mappings/:mappingId/mark-obsolete`, `POST /mappings/:mappingId/exclude`, `POST /:stockItemId/mappings/:mappingId/supersede`, `POST /:stockItemId/mappings/:mappingId/rollback`, `POST /assign-warehouses`

### stockItemRequests — /api/stock-item-requests

Source: `purchase-backend/routes/stockItemRequests.js`.

`POST /`, `GET /`, `PATCH /:id/status`

### fixedAssets — /api/assets

Source: `purchase-backend/routes/fixedAssets.js`.

`GET /inventory/sessions`, `POST /inventory/preview`, `POST /inventory/sessions`, `GET /inventory/sessions/:sessionId`, `POST /inventory/sessions/:sessionId/open`, `POST /inventory/sessions/:sessionId/start-counting`, `POST /inventory/sessions/:sessionId/review`, `POST /inventory/sessions/:sessionId/complete`, `POST /inventory/sessions/:sessionId/cancel`, `POST /inventory/sessions/:sessionId/observations`, `POST /inventory/sessions/:sessionId/discoveries`, `PATCH /inventory/findings/:findingId`, `POST /inventory/discoveries/:discoveryId/register`, `GET /options`, `GET /dashboard`, `GET /categories`, `GET /locations`, `POST /locations`, `PATCH /locations/:id`, `GET /currencies`, `GET /sections`, `PATCH /locations/:id/reparent`, `PATCH /locations/:id/active`, `GET /movements`, `POST /movements/:id/submit`, `POST /movements/:id/approve`, `POST /movements/:id/reject`, `POST /movements/:id/cancel`, `POST /movements/:id/dispatch`, `POST /movements/:id/receive`, `POST /movements/:id/initiate-return`, `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `GET /:id/movements`, `POST /:id/movements`, `GET /:id/tags`, `POST /:id/tags`, `GET /:id/rfid-events`

### rfid — /api/rfid

Source: `purchase-backend/routes/rfid.js`.

`GET /tags/lookup/:epc`, `PATCH /tags/:tagId/status`, `POST /tags/:tagId/replace`, `PATCH /exceptions/:id`, `POST /process`, `GET /integration-clients`, `POST /integration-clients`, `POST /integration-clients/:id/rotate`, `POST /integration-clients/:id/disable`, `GET /portals/:id/antennas`, `PUT /portals/:id/antennas`, `DELETE /portals/:id/antennas/:antennaId`, `POST /:resource`, `GET /:resource`

### rfidIngestion — /api/rfid (service credentials only on ingestion)

Source: `purchase-backend/routes/rfidIngestion.js`.

`POST /read-events`, `POST /read-events/batch`

### custody — /api/custody

Source: `purchase-backend/routes/custody.js`.

`GET /recipients/search`, `GET /pending`, `GET /issued`, `POST /`, `PATCH /:id/decision`

### contracts — /api/contracts

Source: `purchase-backend/routes/contracts.js`.

`GET /`, `GET /items/active`, `GET /:contractId/evaluation-candidates`, `GET /pending-approvals`, `GET /approval-stage-monitor`, `GET /:id`, `POST /`, `PATCH /:id`, `PATCH /:id/archive`, `PATCH /:id/unarchive`, `POST /:id/renew`, `POST /:id/submit-review`, `GET /:id/approvals`, `POST /:id/approvals/:approvalId/decision`, `GET /:id/items`, `POST /:id/items`, `PATCH /:id/items/:itemId`, `DELETE /:id/items/:itemId`, `GET /:id/document-checklist`, `PATCH /:id/document-checklist/:documentId`, `GET /:id/consumption`, `GET /dashboard/risk`, `GET /risk/high`, `GET /obligations/due-soon`, `GET /renewals/due-soon`, `GET /:id/risk`, `POST /:id/risk/recalculate`, `GET /:id/risk/history`, `POST /:id/ai-extract`, `GET /:id/ai-extractions`, `GET /:id/ai-extractions/:extractionId`, `GET /:id/documents`, `POST /:id/documents`, `GET /:id/documents/:documentId`, `PATCH /:id/documents/:documentId`, `POST /:id/documents/:documentId/versions`, `PATCH /:id/documents/:documentId/versions/:versionId/current`, `PATCH /:id/documents/:documentId/archive`, `DELETE /:id/documents/:documentId`, `GET /:id/health`, `PATCH /:id/governance`, `GET /:id/obligations`, `POST /:id/obligations`, `GET /:id/obligations/:obligationId`, `PATCH /:id/obligations/:obligationId`, `PATCH /:id/obligations/:obligationId/complete`, `PATCH /:id/obligations/:obligationId/waive`, `PATCH /:id/obligations/:obligationId/cancel`, `GET /:id/renewal-events`, `POST /:id/renewal-events`, `PATCH /:id/renewal-events/:renewalEventId`, `PATCH /:id/renewal-events/:renewalEventId/decision`, `GET /:id/payments`, `POST /:id/payments`, `PATCH /:id/payments/:paymentId`, `PATCH /:id/payments/:paymentId/status`, `GET /:id/invoices`, `POST /:id/invoices`, `GET /:id/invoices/:invoiceId`, `PATCH /:id/invoices/:invoiceId`, `PATCH /:id/invoices/:invoiceId/match`, `PATCH /:id/invoices/:invoiceId/status`, `GET /:id/financial-summary`, `GET /:id/consumption-entries`, `POST /:id/consumption-entries`, `GET /:id/amendments`, `POST /:id/amendments`, `DELETE /:id`, `GET /:contractId/attachments`, `POST /:contractId/attachments`, `DELETE /:contractId/attachments/:attachmentId`

### contractEvaluations — /api/contract-evaluations

Source: `purchase-backend/routes/contractEvaluations.js`.

`GET /criteria`, `GET /my-evaluations`, `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id`

### contractTemplates — /api/contract-templates

Source: `purchase-backend/routes/contractTemplates.js`.

`GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id`

### contractClauses — /api/contract-clauses

Source: `purchase-backend/routes/contractClauses.js`.

`GET /`, `POST /`, `PATCH /:id`, `DELETE /:id`

### suppliers — /api/suppliers

Source: `purchase-backend/routes/suppliers.js`.

`GET /`, `GET /dashboard`, `GET /:id/profile`, `PATCH /:id/classification`, `GET /:id/principals`, `GET /:id/contacts`, `POST /:id/contacts`, `PATCH /:id/contacts/:contactId`, `DELETE /:id/contacts/:contactId`, `POST /:id/principals`, `PATCH /:id/principals/:principalId/verify`, `PATCH /:id/principals/:principalId/suspend`, `PATCH /:id/principals/:principalId`, `DELETE /:id/principals/:principalId`, `POST /`, `PATCH /:id`, `DELETE /:id`

### supplierSrm — /api/supplier-srm

Source: `purchase-backend/routes/supplierSrm.js`.

`GET /:supplierId/status`, `GET /:supplierId/scorecards`, `POST /:supplierId/scorecards`, `GET /:supplierId/issues`, `POST /:supplierId/issues`, `PATCH /issues/:issueId`, `GET /:supplierId/compliance`, `POST /:supplierId/compliance`

### supplierEvaluations — /api/supplier-evaluations

Source: `purchase-backend/routes/supplierEvaluations.js`.

`GET /`, `GET /benchmarks`, `GET /dashboard`, `GET /criteria`, `POST /criteria`, `PUT /criteria/:id`, `DELETE /criteria/:id`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id`

### budgetControl — /api/budget-control

Source: `purchase-backend/routes/budgetControl.js`.

`GET /`, `POST /`

### procurementPlans — /api/procurement-plans

Source: `purchase-backend/routes/procurementPlans.js`.

`POST /`, `GET /`, `GET /request/:id`, `POST /:id/items`, `GET /:id/items/variance`, `GET /:id/integration-insights`, `GET /:id/items`, `POST /:id/items/:itemId/requests`, `POST /:id/items/:itemId/consumptions`, `GET /:id/download`, `GET /:id`

### planning — /api/planning

Source: `purchase-backend/routes/planning.js`.

`POST /forecast`, `POST /safety-stock`, `POST /mrp`, `GET /defaults`, `POST /defaults`, `POST /replenishment/policies`, `POST /replenishment/run`

### maintenance — /api/maintenance

Source: `purchase-backend/routes/maintenance.js`.

`GET /`, `POST /`, `GET /:id`, `PATCH /:id/status`, `POST /:id/parts`, `POST /:id/parts/:partId/reserve`, `POST /:id/parts/:partId/issue`, `POST /:id/parts/:partId/release`

### spareParts — /api/spare-parts

Source: `purchase-backend/routes/spareParts.js`.

`GET /`, `POST /`, `GET /stock-items`, `GET /equipment`, `POST /equipment`, `GET /equipment/:equipmentId`, `PATCH /equipment/:equipmentId`, `GET /:id`, `PATCH /:id`, `PATCH /:id/stock-policy`, `POST /:id/archive`, `POST /:id/technical-approval`, `GET /:id/compatibility`, `POST /:id/compatibility`, `PATCH /:id/compatibility/:compatibilityId`, `POST /:id/compatibility/:compatibilityId/decision`

### equipment — /api/equipment

Source: `purchase-backend/routes/equipment.js`.

`GET /`, `POST /`, `GET /available-assets`, `GET /:id/contracts`, `POST /:id/contracts`, `DELETE /:id/contracts/:coverageId`, `GET /:id`, `PATCH /:id`

### notifications — /api/notifications

Source: `purchase-backend/routes/notifications.js`.

`GET /`, `PATCH /read-all`, `PATCH /read-many`, `PATCH /:id/read`

### auditLog — /api/audit-log

Source: `purchase-backend/routes/auditLog.js`.

`GET /`, `POST /`, `DELETE /:id`

### auditRegistry — /api/audit-registry

Source: `purchase-backend/routes/auditRegistry.js`.

`GET /my-requests`, `POST /entries`, `POST /requests/:requestId/entries`, `PATCH /entries/:entryId`

### dashboard — /api/dashboard

Source: `purchase-backend/routes/dashboard.js`.

`GET /summary`, `GET /department-spending`, `GET /department-request-costs`, `GET /lifecycle`, `GET /workload`

### auth — /api/auth

Source: `purchase-backend/routes/auth.js`.

`POST /register`, `POST /login`, `POST /verify-password`, `POST /register-request`, `GET /register-requests`, `POST /register-requests/:id/approve`, `POST /register-requests/:id/reject`, `GET /register-request/institutes`, `GET /register-request/departments`, `PUT /change-password`, `GET /me`

### permissions — /api/permissions

Source: `purchase-backend/routes/permissions.js`.

`GET /`, `GET /users/:userId`, `PUT /users/:userId`

### roles — /api/roles

Source: `purchase-backend/routes/roles.js`.

`GET /`, `POST /`, `PUT /:id`, `DELETE /:id`

### capabilityPolicies — /api/capability-policies

Source: `purchase-backend/routes/capabilityPolicies.js`.

`GET /`, `PUT /`

### uiAccess — /api/ui-access

Source: `purchase-backend/routes/uiAccess.js`.

`GET /`, `PUT /:resourceKey`
