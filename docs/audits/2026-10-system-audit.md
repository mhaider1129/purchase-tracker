# Purchase Tracker — October 2026 system audit

Audit date: 30 October 2026 (Asia/Baghdad). Repository: `mhaider1129/purchase-tracker`.
Reviewed baseline: `f254a6da68ae8268a8afc0149dd903ed10f42de5` (`origin/master`, includes merged PRs 72 and 73).
Branch: `codex/october-system-audit`. Scope: audit/documentation only.

## Executive assessment

The repository is an implemented modular monolith with substantive request approvals, canonical inventory, award/PO traceability, invoice matching, AP settlement, asset/RFID and technical workflows. It is not an empty scaffold. It is also not ready for an unqualified end-to-end ERP assurance claim: legacy contract finance competes with canonical AP, institute isolation varies by module, completion has competing representations, and runtime schema writers remain.

**No CRITICAL defect is confirmed by this audit.** HIGH findings are material and actionable; lack of production access must not be promoted into evidence of actual patient harm, financial loss or deployed cross-tenant exploitation. The highest immediate priorities are controlled file access, financial writer ownership, institute authorization and the technical-quotation award/issue regression.

Recent features are present: request-level active priority queues, stock-fulfilled completion projections, hold-adjusted dashboard timing, SCM early rejection, technical profiles/GR inspections, device demos and surgical consignment. Older reports describing these as absent are superseded by the current source. V2 approval is still shadow-only (`LIVE_ROUTING_ENABLED=false`), not live operational routing.

## Method and evidence limits

Inspected mounted routes, authentication middleware, controllers, canonical services/repositories, SQL sources, frontend routes/APIs and existing tests across all 20 requested domains. Material findings below identify concrete functions and current source anchors. API authentication, UI visibility and institute ownership were evaluated as different controls. Compared older architecture reports to the current implementations; do not treat their planned-state tables as deployed facts.

CONFIRMED means the reported code behavior/defect is established by the current source, optionally a controlled local probe. It does **not** mean exploited in production. PARTIALLY VERIFIED means a code fact exists but the operational/policy consequence needs more evidence. NOT VERIFIED records an assurance limitation only. Mocked tests do not establish PostgreSQL syntax, constraints, RLS, deployment compatibility or bank settlement.

No SQL was executed against Development Supabase or Production Supabase. No migrations were applied, locally or hosted, in this audit. Existing Jest migration tests were allowed to inspect migration text/mock query calls; disposable migration-installing PostgreSQL harnesses were deliberately not invoked. No credentials, hosted datasets or clinical documents were read. Three extra probes used in-memory query stubs and fixture-only objects, with no network/storage calls.

## Finding register

20 findings: 9 HIGH, 10 MEDIUM, 1 LOW; 18 CONFIRMED code findings, 1 PARTIALLY VERIFIED policy risk, 1 NOT VERIFIED deployment assurance limitation. No CRITICAL finding confirmed.

| Finding | Module                                           | Severity | Evidence           |
| ------- | ------------------------------------------------ | -------- | ------------------ |
| AUD-001 | Contracts / AP / Payments                        | HIGH     | CONFIRMED          |
| AUD-002 | P2P commercial and finance isolation             | HIGH     | CONFIRMED          |
| AUD-003 | Attachments / clinical confidentiality           | HIGH     | CONFIRMED          |
| AUD-004 | RFx / supplier selection                         | HIGH     | CONFIRMED          |
| AUD-005 | Contracts and obligations institute isolation    | HIGH     | CONFIRMED          |
| AUD-006 | Procurement plans / replenishment                | HIGH     | CONFIRMED          |
| AUD-007 | Automatic procurement assignment                 | HIGH     | CONFIRMED          |
| AUD-008 | Legacy technical inspection / request completion | HIGH     | CONFIRMED          |
| AUD-009 | Technical review → RFx award → PO issue          | HIGH     | CONFIRMED          |
| AUD-010 | Database governance / runtime schema             | MEDIUM   | CONFIRMED          |
| AUD-011 | Completion / operational status                  | MEDIUM   | CONFIRMED          |
| AUD-012 | RFID processing recovery                         | MEDIUM   | CONFIRMED          |
| AUD-013 | Approval Engine V2 readiness                     | MEDIUM   | CONFIRMED          |
| AUD-014 | Notifications / transactional audit              | MEDIUM   | CONFIRMED          |
| AUD-015 | Legacy files API                                 | MEDIUM   | CONFIRMED          |
| AUD-016 | Technical-review UX / workspace complexity       | LOW      | CONFIRMED          |
| AUD-017 | Release verification / static baseline           | MEDIUM   | CONFIRMED          |
| AUD-018 | Inspection → procurement reporting integration   | MEDIUM   | CONFIRMED          |
| AUD-019 | Supplier / clinical qualification completeness   | MEDIUM   | PARTIALLY VERIFIED |
| AUD-020 | Deployed database and external operations        | MEDIUM   | NOT VERIFIED       |

## AUD-001 — Contracts / AP / Payments

**HIGH · CONFIRMED**

Evidence: `purchase-backend/controllers/contractsController.js:3817`; `purchase-backend/controllers/contractsController.js:3820`; `purchase-backend/routes/contracts.js:132`; `purchase-backend/services/paymentService.js:11`.

**Defect / risk:** Active contract payment commands insert/update contract_payments and contract_invoices independently of posted AP payables, effective canonical invoice matches and payment allocations. contracts.manage is sufficient; payment status can default directly to paid. The balance check is a SUM followed by INSERT without a transaction/row lock/idempotency key; update/status paths do not repeat an overpayment check. This is an active competing financial writer, not merely historical tables.

**Business impact:** Two ledgers can disagree on supplier liability/settlement; concurrent or edited contract payments can exceed an invoice. A controlled mocked interleaving of the actual controller admitted two paid amounts of 60 against net payable 100. This records ERP settlement, not evidence of bank funds moving.

**Recommended correction:** Design a canonical contract-liability source adapter, then route contract payments through the posted-payable payment service. Preserve historic records, reconcile them explicitly, and disable legacy settlement mutations after cutover. Use exact decimal arithmetic, immutable allocations and independent finance authority.

**Dependencies:** Contract-to-canonical invoice mapping; legacy balance reconciliation; AUD-002/AUD-005 institute policy. Do not simply hide contract payment UI.

**Regression tests required:** Concurrent 60+60 against 100; retry/different-payload key; mismatch/held receipts; edits of paid records; currency mismatch; contract without PO; separate finance authority; rollback of audit/outbox.

## AUD-002 — P2P commercial and finance isolation

**HIGH · CONFIRMED**

Evidence: `purchase-backend/controllers/budgetControlController.js:12` (`listDepartmentBudgets` and `upsertDepartmentBudget` also lack institute root ownership); `purchase-backend/controllers/procureToPayController.js:40`; `purchase-backend/services/supplierInvoiceService.js:29`; `purchase-backend/services/paymentService.js:11`; `purchase-backend/repositories/connectedP2PRepository.js:189`.

**Defect / risk:** The P2P controller and commercial repository load document/request IDs without actor-institute predicates. Matching requestId to a document proves document linkage, not institute authorization. Role/permission gates do not supply that missing boundary. Payment locks a payable by ID; commercial services do not enforce actor institute. Physical inventory posting separately enforces institute/warehouse scope, so its protection must not be generalized to all P2P commands.

**Business impact:** A privileged actor can address foreign-institute commercial/financial documents through ID-based routes in application code. Hosted RLS/role behavior is unverified; backend-only RLS bypass roles would leave this application defect exposed.

**Recommended correction:** Carry immutable actor scope through repository construction or explicitly authorize each root request/document, then bind all dependent reads/writes to it. Require explicit cross-institute authority rather than assuming a global finance role.

**Dependencies:** Institution-wide finance policy, global/shared supplier policy, approval/delegation rules; audit event institute metadata.

**Regression tests required:** Two institutes using identical roles: PO/read/invoice/match/voucher/payment foreign IDs; mismatched route IDs; authorized explicit cross-institute actor; idempotency key cannot disclose a foreign retry.

## AUD-003 — Attachments / clinical confidentiality

**HIGH · CONFIRMED**

Evidence: `purchase-backend/app.js:265`; `purchase-backend/routes/attachments.js:302`; `purchase-backend/routes/attachments.js:428`; `purchase-backend/routes/attachments.js:394`.

**Defect / risk:** Local uploads are mounted publicly before authenticated API routes. Authenticated attachment list/download/upload handlers look up attachment/request/item IDs without institute, requester or assignment visibility checks. Path traversal checks constrain filesystem paths but do not authorize the underlying request. SQL 054 evidence deletion FK protects retained rows, not confidentiality.

**Business impact:** Known local URLs are accessible without authentication when files exist; authenticated users may access or add evidence to another request/institute by ID. Whether stored files contain patient data and whether an external proxy blocks /uploads are NOT VERIFIED.

**Recommended correction:** Use one request/contract-aware attachment authorization service for every read/write/delete and signed/download URL. Remove or gate the public local mount. Retain evidence deletion protection and safe path handling.

**Dependencies:** Clinical case visibility, contract file visibility, local/Supabase storage adapters, AUD-015 legacy file route.

**Regression tests required:** Anonymous local download; unrelated same-institute user; foreign-institute user; assigned reviewer allowed; upload to foreign request; retained evidence delete; URL expiry; path traversal and local fallback.

## AUD-004 — RFx / supplier selection

**HIGH · CONFIRMED**

Evidence: `purchase-backend/controllers/rfxPortalController.js:593`; `purchase-backend/controllers/rfxPortalController.js:210`; `purchase-backend/app.js:426`.

**Defect / risk:** RFx award authorization checks rfx.manage or SCM/procurement role, but event/response/request selection is by IDs without institute predicates. The controller passes only {id} as actor into canonical award/PO services, dropping institute and permission context. Canonical commercial provenance is implemented and does not repair this missing authorization boundary.

**Business impact:** A manager can act on foreign events in application logic; document provenance can be correct while the actor is unauthorized. The optional-auth portal also permits name-based public responses; whether that public model is intentional and sufficiently constrained needs owner confirmation.

**Recommended correction:** Scope RFx events/responses through their root request and pass the complete authenticated context. Separate public supplier submission from internal management, with verified supplier identity/invitations where required.

**Dependencies:** AUD-002 commercial scopes; supplier identity policy; public portal business requirements.

**Regression tests required:** Foreign event/response/request permutations; disabled user; anonymous internal award denied; supplier cannot impersonate another supplier; normalized quote and legacy aggregate paths preserve provenance.

## AUD-005 — Contracts and obligations institute isolation

**HIGH · CONFIRMED**

Evidence: `purchase-backend/controllers/contractsController.js:1337`; `purchase-backend/controllers/contractsController.js:3809`; `purchase-backend/controllers/contractsController.js:3730`; `purchase-backend/routes/contracts.js:136`.

**Defect / risk:** contracts.manage controls mutation, but contract roots and child obligation/invoice/payment queries use global IDs with no institute constraint in this controller. Financial and obligation records inherit the problem. A permission to manage contracts is not an institute ownership check.

**Business impact:** A contract manager can access/mutate another institute contract by ID in application code. Actual tenant population and hosted RLS privileges remain unknown.

**Recommended correction:** Define contract ownership (including an explicit policy for genuinely shared contracts); authorize root contract once transactionally and enforce it on every child, file, renewal and approval command.

**Dependencies:** Legacy ownership reconciliation without guessing institute IDs; AUD-001 liability cutover; equipment coverage references.

**Regression tests required:** Foreign root and mixed-parent child IDs; shared contract explicit policy; assigned obligation owner; approvals; attachments; renewal status transitions; finance history remains immutable.

## AUD-006 — Procurement plans / replenishment

**HIGH · CONFIRMED**

Evidence: `purchase-backend/routes/planning.js:21`; `purchase-backend/controllers/demandPlanningController.js:496`; `purchase-backend/routes/procurementPlans.js:24`; `purchase-backend/controllers/procurement/plansController.js:70`.

**Defect / risk:** These routers authenticate users but have no planning capability gates. Plan upload accepts a body department_id, and planning controllers read/write warehouse defaults and replenishment policies by supplied warehouse/item IDs without institute ownership checks. Plan item/link commands similarly select plans/items by global IDs.

**Business impact:** An ordinary authenticated user can change another department/warehouse replenishment settings or link demand/consumption outside their authorized scope. Wrong replenishment decisions can affect clinical supply continuity.

**Recommended correction:** Introduce explicit planning view/manage capabilities and department/warehouse scope, validate linked request/stock/movement ownership, and audit configuration/version changes. Keep forecasts advisory until controlled release.

**Dependencies:** Permission catalog/UI policy; inventory identity; canonical movement consumption linkage; departmental planning ownership.

**Regression tests required:** Requester denied policy writes; foreign warehouse/plan/item links; planner permitted in assigned scope; duplicate link retry; immutable version history; forecast cannot issue a PO or inventory movement.

## AUD-007 — Automatic procurement assignment

**HIGH · CONFIRMED**

Evidence: `purchase-backend/services/requestAutoAssignmentService.js:39`; `purchase-backend/controllers/requestAutoAssignmentRulesController.js:35`; `purchase-backend/controllers/requestAutoAssignmentRulesController.js:69`.

**Defect / risk:** Rule lookup uses request type and optional warehouse only, joins any active assignee and has no institute/department ownership predicate. Management rule listing and assignee validation are also global. Non-stock rules can therefore route across institutes; shared type criteria are not tenant-specific.

**Business impact:** Wrong procurement owner, unintended disclosure through email/notification, and lost clinical request ownership. Explicit identity of existing production rules is not known.

**Recommended correction:** Give rules a defined institute scope, validate assignee/warehouse within it and resolve using request institute. Reconcile duplicates before adding uniqueness; preserve original decisions in audit history.

**Dependencies:** Organization ownership, requests/roles scope, migration for rule ownership only after explicit reconciliation; AUD-014 notifications.

**Regression tests required:** Two non-stock rules in different institutes; foreign assignee/warehouse rejected; missing/ambiguous current assignee; deterministic retry; approval transaction rollback has no outbound email.

## AUD-008 — Legacy technical inspection / request completion

**HIGH · CONFIRMED**

Evidence: `purchase-backend/controllers/technicalInspectionsController.js:300`; `purchase-backend/utils/technicalInspectionStatus.js:33`; `purchase-backend/routes/technicalInspections.js:42`.

**Defect / risk:** Legacy inspection creation/update calls applyRequestStatusFromInspections using pool operations. That helper sets a linked request to technical_inspection_pending/completed whenever inspection rows exist, excluding only status received; it does not validate current request lifecycle or full procurement completion. resolveRequestLink enforces institute/linkage, not eligibility. New required GR acceptance is counted, so the old claim that a legacy form can release held inventory is NOT made.

**Business impact:** An accepted historical form can mark an otherwise unfinished, submitted or rejected linked request completed and remove it from active operational lists; a pending form can also reopen a terminal request. Insert/status/audit are not one atomic transaction.

**Recommended correction:** Make historical forms evidence-only or require a canonical lifecycle transition with current eligibility, completion facts and terminal-state guards. Preserve new receipt acceptance as separate authority.

**Dependencies:** AUD-011 shared completion semantics; historical compatibility policy; request priority exclusions.

**Regression tests required:** Accepted inspection on Submitted/Rejected/Cancelled/partially ordered requests cannot complete; pending inspection cannot reopen terminal; held required GR remains blocked; rollback of inspection and derived status/audit is atomic.

## AUD-009 — Technical review → RFx award → PO issue

**HIGH · CONFIRMED**

Evidence: `purchase-backend/services/technicalProposalSnapshot.js:13`; `purchase-backend/controllers/rfxPortalController.js:730`; `purchase-backend/services/purchaseOrderService.js:93`.

**Defect / risk:** Quotation technical fingerprints include rfx_responses.status and other response header content. RFx award creates the award/PO and then changes the same response status to awarded. PO issue rechecks the fingerprint against the now-awarded response. A normal commercial state transition therefore invalidates an otherwise unchanged technically approved quotation.

**Business impact:** Quotation-bound technically approved procurement can create a PO but then fail to issue it with TECHNICAL_PROPOSAL_CHANGED. A controlled call to assertCurrent reproduces this for submitted→awarded with unchanged price/specifications.

**Recommended correction:** Fingerprint immutable technical/commercial source content separately from expected workflow status. Preserve review invalidation for real supplier/product/specification/quantity/price changes. Do not remove the PO issue gate.

**Dependencies:** Canonical quote schema, audit snapshot versioning, RFx status semantics.

**Regression tests required:** Prepare→opinions→SCM sign-off→RFx award→PO approval→issue succeeds unchanged; changed content still fails; old fingerprints handled explicitly; retries after award do not bypass source checks.

## AUD-010 — Database governance / runtime schema

**MEDIUM · CONFIRMED**

Evidence: `purchase-backend/utils/ensureProcureToPayTables.js:279`; `purchase-backend/utils/ensureFinanceCoreTables.js:121`; `purchase-backend/controllers/contractsController.js:1150`; `purchase-backend/utils/ensureRequestClientSubmissionKey.js:12`.

**Defect / risk:** Production request paths still execute CREATE/ALTER/index statements and some projection/backfill UPDATEs in ensure helpers alongside numbered SQL and node-pg-migrate. Contract DDL swallows selected permission/duplicate errors. Cached success flags are process-local. A catalog snapshot and CREATE TABLE IF NOT EXISTS do not establish complete schema compatibility.

**Business impact:** Runtime role may need schema authority, concurrent startups can race, partial module creation can look initialized, and an HTTP call can discover drift only after a mutation attempt. SQL 055 fixes a current directory gap; its existence is not proof of deployment.

**Recommended correction:** Introduce read-only module contract preflights and an applied-version/checksum ledger under manual governance; replace runtime DDL incrementally with new forward patches. Never edit frozen migrations or blindly execute all numbered files.

**Dependencies:** Owner-provided migration history, baseline contract review, role privileges and compatible populated-data plan.

**Regression tests required:** Application startup/read/write with DDL denied; complete/absent/partial module; repeated forward patch; two-worker startup; transaction rollback; migration checksum mismatch.

## AUD-011 — Completion / operational status

**MEDIUM · CONFIRMED**

Evidence: `purchase-backend/services/p2pCompletionService.js:3`; `purchase-backend/repositories/connectedP2PRepository.js:209`; `purchase-backend/controllers/requests/updateRequestsController.js:808`.

**Defect / risk:** The structured procurement/receipt/financial completion helper and repository facts exist, but repository-wide references consume them only in tests/integration, not a production application entry point. Live legacy request completion remains driven by item procurement status and historical inspection summary. These dimensions are not exposed through one canonical live completion read model.

**Business impact:** Operational Completed can be mistaken for receipt or financial completion. Requester receipt is also distinct from warehouse GR. This audit does not assume requests must stay operationally open until payment; that policy must be decided explicitly.

**Recommended correction:** Expose separate procurement, receipt/requester acknowledgment and financial completion dimensions in a shared read model; use operationally agreed terminal rules for priority/worklists. Remove competing writable projections only after compatibility planning.

**Dependencies:** AUD-008 legacy inspection behavior; stock-fulfilled rules; partial/cancelled obligations and request-level aggregation policy.

**Regression tests required:** Mixed stocked/procured/partially cancelled items; receipts complete but invoices open; paid invoice with unresolved commitment; inspection holds; requester issue/reopen; all dashboards use the same dimensions.

## AUD-012 — RFID processing recovery

**MEDIUM · CONFIRMED**

Evidence: `purchase-backend/services/rfidEventProcessor.js:13`.

**Defect / risk:** RFID processor commits a PROCESSING claim before processing each event. Future claims select only PENDING/FAILED; no stale PROCESSING lease/reclaim path was found in current production code. A process crash between claim and completion can strand events. This differs from notification outbox, which explicitly reclaims stale processing.

**Business impact:** Missed asset observations and delayed movement exceptions after worker crashes. RFID observations do not themselves authorize custody/inventory movements, which is a positive control.

**Recommended correction:** Add bounded processing leases/claim timestamps and safe stale-claim recovery with idempotent business-event aggregation and operator visibility.

**Dependencies:** RFID scheduler/worker ownership, current aggregation keys, event retention and replay policy.

**Regression tests required:** Kill after committed claim; restart reclaims once; concurrent worker fencing; retry exhaustion visible; duplicate reads do not create duplicate movement exceptions.

## AUD-013 — Approval Engine V2 readiness

**MEDIUM · CONFIRMED**

Evidence: `purchase-backend/services/approvalPolicyService.js:75`; `purchase-backend/services/approvalPolicyEngine.js:1`.

**Defect / risk:** readiness() reports unresolved/exact-match counts, but its cutoverStatus uses only organization/policy blockers and evaluated>=20. Twenty mismatches/unresolved runs may still produce READY_FOR_PILOT_REVIEW. LIVE_ROUTING_ENABLED remains false, so this is a misleading readiness indicator, not an active V2 live-route bypass.

**Business impact:** Pilot review may be proposed without demonstrated route equivalence. The code currently preserves the shadow/live boundary; enabling V2 is a future milestone.

**Recommended correction:** Define explicit representative coverage, unresolved/ambiguous/mismatch thresholds and reviewed waivers, with diagnostics linked to each readiness decision.

**Dependencies:** Owner-approved pilot acceptance criteria, canonical legacy route snapshots and delegation coverage.

**Regression tests required:** 20 mismatches/unresolved never imply pilot readiness; sufficient representative matches; intentional semantic differences require documented waiver; shadow never writes live approvals.

## AUD-014 — Notifications / transactional audit

**MEDIUM · CONFIRMED**

Evidence: `purchase-backend/services/requestAutoAssignmentService.js:123`; `purchase-backend/services/approvalContinuationService.js:70`; `purchase-backend/middleware/writeAuditTrail.js:59`.

**Defect / risk:** Canonical P2P services enqueue durable transactional outbox events, but approval/autoassignment still send email inside the caller workflow and use legacy notification helpers. Generic governance auditing runs after response finish and logs/warns on persistence failure. These are not equivalent delivery/audit guarantees.

**Business impact:** Email can escape a rolled-back transaction; retries can duplicate delivery; after-response audit failure leaves a successful action without that generic record. Canonical business audit events are not claimed absent where services already write them transactionally.

**Recommended correction:** Move external delivery to deterministic outbox events and require transactional business audit for material legacy commands. Keep generic request audit as supplementary telemetry with explicit failure monitoring.

**Dependencies:** Existing email action-token semantics; outbox delivery adapters and retry/terminal operations; audit privacy/retention policy.

**Regression tests required:** Injected failure after queued event vs after external send; no email before commit; retry once; audit insert failure rolls back material mutation; dead-letter replay and redaction.

## AUD-015 — Legacy files API

**MEDIUM · CONFIRMED**

Evidence: `purchase-backend/controllers/filesController.js:2`; `purchase-backend/utils/storage.js:395`; `purchase-backend/routes/files.js:6`.

**Defect / risk:** filesController imports getSignedUrl/deleteS3File, but storage exports createSignedUrl/removeObject. Existing-row GET/DELETE therefore fail with TypeError; controller also expects s3_key while canonical attachments use file_path. These handlers lack ownership authorization, but working cross-tenant download/deletion through them is NOT claimed because the missing functions currently fail first.

**Business impact:** Broken legacy clients and a dangerous future repair if only function aliases are changed. The deletion sequence in this obsolete handler would remove storage before database evidence restrictions; that is latent, not a currently demonstrated deletion.

**Recommended correction:** Deprecate this duplicate API or delegate fully to the authorized canonical attachment service, with database retention checks before storage effects. Inventory actual frontend consumers before removal.

**Dependencies:** AUD-003 unified attachment access; legacy URL/client compatibility; SQL 054 evidence references.

**Regression tests required:** Actual storage export contract; existing and missing attachment; local and remote; unrelated/foreign actor; retained evidence cannot lose object; consistent 404/409 responses.

## AUD-016 — Technical-review UX / workspace complexity

**LOW · CONFIRMED**

Evidence: `purchase-frontend/src/pages/PreprocurementTechnicalReviewsPage.jsx:55`; `purchase-frontend/src/components/TechnicalReviewSettings.jsx:1`.

**Defect / risk:** The worklist redesign is implemented, but its proposal/detail screen remains a 1,941-line component containing review preparation, revisions, per-item evidence, opinion and final sign-off flows. Category/check configuration and manual proposal fields still require substantial interpretation. Component size is maintainability evidence, not a measured usability failure.

**Business impact:** Higher training burden and greater regression surface around role-specific actions; no user timing/error-rate study was performed.

**Recommended correction:** After integrity fixes, separate role-specific proposal, opinion and sign-off panels; prefill authoritative transaction fields and reveal optional details progressively. Validate with SCM/requester/inspector walkthroughs before broad visual redesign.

**Dependencies:** Clinical sample/data-sheet workflow, configured responsibilities, Arabic/English labels; AUD-009 source lifecycle.

**Regression tests required:** Keyboard and Arabic RTL flow; role-specific visibility; required evidence guidance; preserved draft on errors; simple/complex device cases and revised proposal round.

## AUD-017 — Release verification / static baseline

**MEDIUM · CONFIRMED**

Evidence: `purchase-backend/tests/phase5aCanonicalItemWriterBoundary.test.js:1`; `purchase-backend/tests/fetchRequestsController.domain.test.js:1`; `purchase-backend/tests/procurementHistoryController.test.js:1`; `purchase-frontend/src/pages/fixed-assets/PhysicalInventory.test.jsx:1`; `purchase-frontend/src/pages/DepartmentRequestedItemsBoard.jsx:1`.

**Defect / risk:** Current master backend tests have three failures; frontend full tests pass, but lint has two test-file errors plus two warnings, and CI=true production build fails on warnings. No application code was changed in this audit, so these are baseline failures, not audit-induced regressions.

**Business impact:** A clean release gate is unavailable; teams may normalize ignoring failures. Test success does not prove hosted schema, authorization or live hardware compatibility.

**Recommended correction:** Reconcile SQL assertion expectations deliberately, separate test-fixture writes from production writer-boundary scanning without weakening it, fix test lint and application warnings, and retain strict CI.

**Dependencies:** Review intent of each SQL shape assertion; maintain boundary allowlist policy; no suppression-only fix.

**Regression tests required:** Full backend/frontend suites, lint, strict production build; deliberate foreign-writer mutation must still fail boundary test.

## AUD-018 — Inspection → procurement reporting integration

**MEDIUM · CONFIRMED**

Evidence: `purchase-backend/services/goodsReceiptService.js:395`; `purchase-backend/services/procurementPerformance/procurementEvidenceService.js:18`; `purchase-backend/services/notificationOutboxProcessor.js:7`.

**Defect / risk:** Initial held GR emits GOODS_RECEIPT_POSTED with a non-delivered PO status. Later technical-disposition application updates accepted quantities and PO status, but emits history/direct reviewer notifications rather than the canonical performance outbox event with requestedItemIds and completion status. The consumer projects procurement-case delivery only from the receipt event.

**Business impact:** After technical release, canonical stock/PO can be correct while case delivery evidence/status remains supplier fulfillment, affecting performance and operational priority where case status is consumed. No claim that stock itself remains held after successful canonical release.

**Recommended correction:** Publish an idempotent accepted-receipt/disposition event transactionally and extend the existing performance consumer; use authorization/application ID rather than replaying the original receipt event key.

**Dependencies:** Existing case projection monotonicity, receipt completion aggregation, reporting coverage semantics.

**Regression tests required:** Held GR→partial release→final release→consumer produces one completed delivery; duplicate consumer/retry; rejection+replacement; immutable timeline and failure rollback.

## AUD-019 — Supplier / clinical qualification completeness

**MEDIUM · PARTIALLY VERIFIED**

Evidence: `purchase-backend/services/supplierEligibilityService.js:5`.

**Defect / risk:** Current supplier eligibility intentionally evaluates represented inactive/compliance facts and explicitly states category qualification/blacklist registry is not implemented. Whether hospital procurement requires additional category licenses, device registration or clinical qualification gates is not established from repository code alone.

**Business impact:** Potential regulatory/clinical sourcing gap; not a confirmed violation or a claim that all supplier eligibility checks are absent.

**Recommended correction:** Obtain approved qualification requirements, inventory existing SRM artifacts and model mandatory category-specific expiry/waiver controls only where policy requires them.

**Dependencies:** Clinical governance and jurisdiction-specific supplier policy; product regulatory identifiers; SRM owner.

**Regression tests required:** If required: expired license, category mismatch, shared supplier, documented emergency waiver, recheck before PO issue; existing compliance blockers remain effective.

## AUD-020 — Deployed database and external operations

**MEDIUM · NOT VERIFIED**

Evidence: `purchase-backend/docs/architecture/manual-migration-governance.md:7`; `purchase-backend/sql/manual/055_technical_proposal_scope_compatibility.sql:1`.

**Defect / risk:** Applied migration versions/checksums, hosted RLS/role privileges, actual schema drift, backups, storage exposure and worker deployment cannot be established by repository inspection. Merged PRs and old deployment assumptions do not prove a migration ran. This is an explicit assurance limitation, not a confirmed production defect.

**Business impact:** Repository controls may not match a deployment until the owner provides non-sensitive version/schema evidence and operational checks.

**Recommended correction:** Owner supplies migration ledger/checksums, read-only schema/privilege exports and deployment/worker/backup evidence through the governed process. Do not run audit SQL against hosted environments during this task.

**Dependencies:** Database owner and deployment operator; distinction between development and production.

**Regression tests required:** Later approved isolated restore compatibility test, worker crash/recovery drill and backup restore verification; never destructive hosted tests.

## Tests and commands executed

Commands ran against this unchanged code baseline. Logs were kept under `/tmp/oct-audit-*` in the execution workspace; they are not a durable deployment evidence store. Results below are the durable report.

| Command / working directory                                                             | Result                                                                | Interpretation                                                                                                                                                                                        |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test -- --runInBand` / `purchase-backend`                                          | 208 suites: 205 passed, 3 failed. 1,597 tests: 1,594 passed, 3 failed | Jest setup sets NODE_ENV=test, a test JWT secret and loopback DATABASE_URL. Primarily mocked/unit coverage; no hosted DB assurance.                                                                   |
| `CI=true npm test -- --runInBand` / `purchase-frontend`                                 | 99 suites / 448 tests passed                                          | Component/API/helper tests; React act warnings appear; no live browser walkthrough.                                                                                                                   |
| `npm run lint` / `purchase-frontend`                                                    | Exit 1: 2 errors, 2 warnings                                          | PhysicalInventory.test.jsx: testing-library/no-node-access and render-result-naming-convention. DepartmentRequestedItemsBoard unused actionLoading; PhysicalInventory effect missing load dependency. |
| `CI=true npm run build` / `purchase-frontend`                                           | Exit 1                                                                | Strict CI converts the two application warnings into errors. This audit did not relax CI to report a green build.                                                                                     |
| `node --check <file>` across controllers/services/repositories/routes/middleware        | 302 JS files checked, zero failures                                   | Parser validation only; no modules executed by this check.                                                                                                                                            |
| `node /tmp/oct-audit-probes.js` / repository                                            | 3 probes passed after correcting the local mock harness               | Existing-file API missing export; quotation status-only fingerprint invalidation; concurrent contract payments accepting 120 against 100 under a controlled mocked interleaving.                      |
| `node purchase-backend/scripts/validateManualSql.js <file>` for all 54 manual SQL files | 54 passed                                                             | Only checks for Git patch metadata; not PostgreSQL parsing or execution.                                                                                                                              |
| `git diff --check`                                                                      | Passed                                                                | Documentation formatting only; no business code patch.                                                                                                                                                |

Backend failures are `tests/phase5aCanonicalItemWriterBoundary.test.js` (scanner includes existing generic_items/item_uom fixture writes in testBackendSchemaReconciliation.js), `tests/fetchRequestsController.domain.test.js`, and `tests/procurementHistoryController.test.js` (SQL-shape assertions differ from current normalized fulfillment SQL). These failures were observed on audited master; the audit does not dismiss the underlying expectations without review.

### Controlled probe reproduction

For the three probes, inject `config/db.js` through Node's require cache with a query stub before importing controllers. Set NODE_ENV=test and a loopback-only DATABASE_URL. Do not load application startup or invoke real storage.

1. Return one attachment fixture for `SELECT * FROM attachments WHERE id=$1`, call `filesController.getFileById`, and capture `next(error)`. Result: `getSignedUrl is not a function`. Inspect `utils/storage.js` exports to corroborate.
2. Compute `fingerprint({id:7,supplier_id:3,response_status:'submitted',unit_price:'10'})`. Pass this quotation evidence to `technicalProposalSnapshot.assertCurrent`; return the same quote with only response_status='awarded'. Matching supplier/source IDs still yield `TECHNICAL_PROPOSAL_CHANGED`.
3. Call actual `contractsController.createContractPayment` twice with Promise.all; actor has only contracts.manage, contract=8, invoice=9, amount=60, status=paid. Stub invoice net payable=100 with pending/exception state. Force both SUM queries to return 0 before either INSERT, return inserted rows and permit subsequent projection/log queries. Both calls return 201 and INSERT amounts total 120. This proves the missing serialization in the handler under that interleaving; it is not a real database isolation/load test. Production schema uniqueness, hosted RLS and actual users remain unverified.

## Cross-report navigation and next implementation scope

- [Module inventory](2026-10-module-inventory.md): functionality, ownership, routes/UI, transitions, controls, coverage and operational questions for all 20 domains.
- [Integration matrix](2026-10-integration-matrix.md): producer/consumer contracts and missing links.
- [Database migration audit](2026-10-database-migration-audit.md): schema authorities, forward patch dependencies and unknown deployment state.
- [Security and authorization audit](2026-10-security-and-authorization-audit.md): institute/role/object boundaries and evidence limits.
- [UX audit](2026-10-ux-audit.md): current entry points, duplication and safe simplification sequence.
- [Remediation backlog](2026-10-remediation-backlog.md): prioritized implementation batches and acceptance tests.

Recommended next implementation PR: close AUD-003 attachment access boundaries and AUD-015 obsolete file API together, with negative cross-institute/request visibility tests, retained-evidence protection and no public local-upload bypass. In parallel planning terms only, freeze new uses of legacy contract settlement until AUD-001 has an approved migration/cutover design. AUD-009 is a small separate integration correction with a complete quote→issue regression test. This audit implements none of those changes.
