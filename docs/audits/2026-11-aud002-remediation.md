# AUD-002 remediation — P2P, finance and budget authorization

Date: 2026-11-01 (Asia/Baghdad). Revalidated against master `77cfa549`.

## Confirmed root causes and boundary decisions

The October system, security, backlog and integration audits remain accurate at that HEAD. The live P2P controller accepted capability OR role-name fallbacks; its commercial/finance services and repository loaded globally addressed financial documents without establishing the actor's institute. Matching route request IDs did not authorize that request. Lists, counts, dashboard aggregates and document-flow queries were similarly global. The budget controller admitted role names, accepted arbitrary department/project references and wrote outside a transaction without canonical change audit. A PO could also be returned by the RFx award retry before reaching the PO service.

The existing canonical services already provide important positive controls: technical clearance/receipt acceptance, exact amount and currency checks, effective invoice matching, verified vouchers, remaining encumbrance, posted-payable authority, immutable allocations, idempotency and atomic audit/outbox writes. Direct invoice-to-payable, payment-pending and status-only paid actions are already disabled. These are not reimplemented or re-enabled here. Contract financial consolidation remains AUD-001; general contract/RFx authorization remains AUD-005/AUD-004.

The baseline also records an owner-confirmed requirement for different PO creator and approver, without an administrator exception (`purchase-backend/docs/architecture/p2p-control-baseline.md`, “Confirmed owner policies”). Current application code had not enforced it. This patch enforces that recorded PO requirement at approval and verifies it before issuance; it does not introduce amount tiers, new approver positions, V2 routing or a payment approval workflow.

### Authority model

- Use current effective user/role permission mappings from the existing permission service inside the transaction. Its new opt-in `explicitGrants` mode excludes the global implicit Admin shortcut for these finance checks; other consumers retain their existing behavior. An explicit role-permission mapping remains a legitimate grant; a role name alone does not.
- Existing financial capabilities authorize their named operation across departments of the actor's institute. This preserves the established Finance/SCM operating model while removing global institute access. Budget references must additionally match the actual request department and project. This is not a new per-request financial delegation or departmental approval model.
- Ordinary request read/approval visibility does not confer financial-module access. Conversely, finance-specific capability plus validated institute ownership authorizes the financial parent request without requiring Finance staff to be its requester or procurement assignee.
- There is no finance-specific cross-institute capability in the existing catalog. Therefore cross-institute financial mutations and reads are denied. `requests.cross-institute`, `inventory.cross-institute`, job titles, Admin status, frontend filters and `data_scopes.institute_ids` do not substitute for financial authority. No broad cross-institute capability was invented.
- Business roots with NULL/missing/inconsistent ownership fail closed. Shared supplier and project masters retain their established semantics: existing NULL-owned/global masters are not treated as foreign; any explicit owner is restrictive. Budget ownership comes from its actual department, not today's creator or a shared project label.

## Endpoint and command authorization matrix

All paths below are under `/api`; application JWT authentication remains required. “View” means `procure-to-pay.lifecycle.view`; “PO manage” means `procure-to-pay.purchase-orders.manage`. Parent/child checks occur before business state errors or idempotent disclosure.

| Endpoint / canonical command | Required capability | Authoritative object scope / additional controls |
| --- | --- | --- |
| GET `/procure-to-pay/dashboard` | View | Every count/sum filtered by owned, consistent financial source; no global aggregate |
| GET `/procure-to-pay/purchase-orders`, `/procure-to-pay/po-source-requests` | View OR PO manage | Request → institute/department; awards/lines/suppliers and present RFx provenance agree; same predicates in page and count |
| GET `/procure-to-pay/purchase-orders/:poId` | View OR PO manage OR `procure-to-pay.receipts.manage` | Lock/authorize actual PO graph first; supplier invoices omitted unless View is present |
| POST `/procure-to-pay/requests/:requestId/purchase-orders` — create from awards | PO manage | Actual route request, every award/request item/supplier, and supplied RFx source IDs agree; existing technical/UOM/remaining-award gates retained |
| POST `/procure-to-pay/purchase-orders/:poId/submit-approval` | PO manage | Owned PO/request; existing draft-state gate |
| POST `/procure-to-pay/purchase-orders/:poId/approve` | PO manage | Owned pending PO; known creator must differ from current authorized approver; no Admin exception |
| POST `/procure-to-pay/purchase-orders/:poId/issue` | PO manage | Owned PO/lines/awards/budget; persisted independent approval, eligibility, technical clearance, provenance and budget gates retained |
| POST `/procure-to-pay/purchase-orders/:poId/cancel`, `/procure-to-pay/purchase-orders/:poId/close` | PO manage | Owned actual commitment/envelope and request; receipt/reason/remaining-commitment release gates retained; no payment reversal |
| GET `/procure-to-pay/goods-receipts`, `/procure-to-pay/open-pos-for-receipt`, `/procure-to-pay/requests/:requestId/receipts` | View OR `procure-to-pay.receipts.manage` | Owned PO/request/receipt lines; appropriate scope also applies to count and lookup |
| POST `/procure-to-pay/requests/:requestId/receipts` | `procure-to-pay.receipts.manage` | Actual PO, each selected line and warehouse; existing received/accepted capacity, physical inventory and required inspection policy retained |
| POST `/technical-inspections/workflow/delivery/:id/apply` | `procure-to-pay.receipts.manage` plus existing disposition authority | Task → receipt line → receipt → PO → request; current version, immutable disposition evidence, independent inspector/SCM/receiver, quantity and inventory controls retained |
| GET `/procure-to-pay/ap-invoices` | View OR `procure-to-pay.invoices.manage` | Owned invoice → PO → request, supplier and all referenced invoice/PO lines |
| POST `/procure-to-pay/requests/:requestId/invoices` | `procure-to-pay.invoices.manage` | Actual request/PO/supplier and selected lines; existing duplicate-bill registry and backend totals retained |
| GET `/procure-to-pay/invoice-matching-queue` | View OR `procure-to-pay.match.manage` | Owned consistent invoice/PO/match roots |
| POST `/procure-to-pay/requests/:requestId/invoices/:invoiceId/match` | `procure-to-pay.match.manage` | Invoice/PO/receipt and prior invoice relationships; existing matching engine and technical acceptance gate remain authoritative |
| POST `/procure-to-pay/requests/:requestId/match-results/:matchResultId/override`, `/procure-to-pay/requests/:requestId/match-results/:matchResultId/decline` | `finance.override-mismatch` | Actual match/invoice/request; current effective result, reason and technical-clearance requirements preserved |
| POST `/procure-to-pay/requests/:requestId/verify` | `finance.verify` | All financially active invoice roots belong to the request; whole coordinator now uses one authorized transaction, including readiness and per-invoice verification |
| POST `/procure-to-pay/requests/:requestId/vouchers` | `finance.voucher.create` | Actual invoice/request, declared accounting-document references and any provided cost-center scope; backend source total/effective match and accounting balance retained |
| POST `/procure-to-pay/ap-vouchers/:voucherId/verify` | `finance.voucher.verify` | Voucher → invoice → PO → request and line references; existing draft/balance/match gates |
| POST `/procure-to-pay/requests/:requestId/post-ledger` | `finance.post-ledger` | Exact voucher/invoice/PO/encumbrance/envelope chain; verified voucher, effective match, technical acceptance and exact actualization retained |
| GET `/procure-to-pay/accounts-payable`, `/procure-to-pay/payments` | View OR `finance.payment.manage` | Posted-source relationships and allocations belong to the same owned request/invoice/voucher; filters/counts/pagination scoped |
| POST `/procure-to-pay/accounts-payable/:payableId/payments` | `finance.payment.manage` | Payable → posted voucher/invoice/PO/request; exact requested payable/allocation on retry, currency, remaining balance and technical gate retained |
| GET `/procure-to-pay/document-flow`, `/procure-to-pay/document-flow/request/:requestId` | View | Typed source/target identities and actual header parent chains; unrelated numeric ID collisions cannot join other document types |
| GET `/procure-to-pay/requests/:requestId/lifecycle` | View | Authorize whole financial request graph and any linked warehouse before returning related records; legacy journal/GL references require an owned invoice source |
| GET `/budget-control` and its browser CSV export | View | Actual department institute; exclude inconsistent budget-ledger contributors; server supplies scoped department options and actual management capability |
| POST `/budget-control` | New `finance.budget.manage` | Actual department/project; normalized IDs and transaction/advisory lock plus existing-row lock; before/after canonical audit; no automatic grants |
| POST `/rfx-portal/:id/award` | Existing RFx authority AND PO manage for its financial effect | Current financial actor/request verified before award/PO work; exact existing PO reauthorized before retry return |
| GET `/requests/:requestId/full-details` | Existing request access; View additionally for canonical financial linked records | Unauthorized/unverifiable P2P links are withheld; general request/clinical/contract access is not expanded |
| GET `/requests/pending-approvals`, `/requests/pending-maintenance-approvals` | Existing active-approval authority | Embedded budget context additionally requires actor/request/department institute agreement; no foreign budget disclosure through an approval list |
| GET `/contracts/:id/consumption` — canonical P2P links only | Existing contract access plus View | Contract must have a verifiable owned source request; each optional canonical link matches that request and institute. Legacy contract balances/writers remain separate work |
| POST legacy `/procure-to-pay/purchase-orders` | Existing disabled endpoint | Still 410; does not create a PO |
| POST `/procure-to-pay/ap-invoices/:invoiceId/post-payable`, `/procure-to-pay/requests/:requestId/payment-pending`, `/procure-to-pay/requests/:requestId/payments/:paymentId/paid` | Existing named finance capability | Still 410; no direct AP posting, scheduling-as-settlement, or status-only approval/paid mutation |

The public RFx router uses optional authentication for supplier responses. Its internal award action still requires an authenticated current financial actor; this change does not alter anonymous supplier submission policy.

No separate export capability exists for these financial screens: their CSV export uses the already-authorized read result and cannot request broader data. No live AP payment-approval/preparation or payment-reversal endpoint exists to secure as a separate state machine. `finance.payment.manage` remains the existing canonical payment command capability; unsupported legacy commands remain disabled. This PR does not invent those workflows.

## Implementation and preserved financial controls

`p2pAuthorization.authorizeCommand` reloads the current active actor and effective explicit grants, discovers the actual root, locks the request, then verifies/locks financial documents and traverses their real relationships. It verifies department/project/supplier references, PO demand/award links, inbound receipt/invoice line links, invoice/match/voucher/payable/payment sources, payment allocations, budget envelopes/contributors and commitment sources. Referenced requests in accounting lines must equal the authorized request, not merely be substituted by a caller ID. Present RFx header/response links must agree with the owned source and award supplier. A NULL redundant response request field can still be verified through its actual parent event; an explicit conflicting value is rejected. Missing/inconsistent/foreign objects return a generic 404 without foreign names/status/amounts.

Authorization runs in the canonical service transaction before idempotency lookup/return or mutation. Retry rows are reauthorized with the original expected parent/root, preventing foreign replay disclosure and cross-request lock inversion on reused keys. PO commitment retry/cancellation paths validate the actual source commitment as well. Request locks serialize commands on the same aggregate; financial parent UPDATE locks prevent child insertion/ownership changes during validation. Existing operation locks, unique keys, quantity locks and exact decimal code remain in place.

`p2pReadScope` supplies repeatable-read transactions with fresh grants and bound institute predicates. Page counts and result sets share scope. Detail/linked-request views validate the graph before child queries. Financial report predicates reject inconsistent parent/child ownership. Document-flow reporting validates typed header identities directly, rather than recursively expanding every descendant predicate for every source/target type; actual line content and mutations still use full canonical checks. An initial expanded flow query hit the local statement timeout; the corrected typed-header query passed the real PostgreSQL suite without disabling timeouts/JIT or weakening document ownership checks.

No new financial writer, payment workflow, contract-to-AP adapter, bank operation, GL redesign or approval engine was introduced. PO pricing/award consumption, technical approval fingerprints/evidence, receipt acceptance and physical movement policies, effective invoice match authority, exact balanced vouchers, verified posting, commitment reduction/actualization, payment currency/amount limits, immutable allocations and duplicate posting prevention retain their canonical services. Canonical audit events now include trusted institute and relevant before/after state. Budget configuration gains the same transactionally consistent audit pattern; it no longer performs runtime schema/account seeding on read/write requests.

## Validation

- Isolated PostgreSQL: repository `npm run test:p2p-postgres`, pinned disposable PostgreSQL 16, fresh tmpfs data and strict loopback-only test URL guard. **63 tests passed**, including existing full financial workflow/concurrency/rollback tests and new two-institute security cases.
- New cases cover same-institute PO creation and audit institute; role-only/anonymous/inactive actors; foreign PO read/approval; inappropriate request/inventory cross-scope overrides; unauthorized receipt and replay; foreign/mismatched invoice/matching sources; both directions of local-parent/foreign-child grafts; unauthorized voucher/AP/payment; foreign allocations; disabled status-only paid/approval; independent PO approval; foreign budgets; forged institute ID; viewer versus budget manager; null-project concurrent configuration; scoped pagination/count/export source; every generated report predicate against actual PostgreSQL; revoked/moved-actor retries; receipt-only compatibility; financial cancellation authorization; budget audit rollback; normalized concurrent department IDs; technical-task and warehouse/department consistency; unknown accounting reference types; legacy journal source isolation; typed flow collisions; repeatable permission seed/no grants; accounting-source request substitution; owned/foreign RFx provenance; atomic multi-invoice verification rollback; and concurrent cross-request key reuse.
- Backend Jest: `npm test -- --runInBand` — **219 suites / 1,854 tests passed; 3 baseline suites/tests failed** (222 suites / 1,857 tests total). Domain-only fake repositories explicitly mock the authorization helper so they continue testing existing financial calculations/gates; the security boundary is exercised without that mock against actual disposable PostgreSQL. RFx workflow regression also checks denial before existing-PO retry disclosure.
- Frontend: `CI=true npm test -- --runInBand` — 108 suites / 478 tests passed, including three budget authorization/control tests. Changed frontend ESLint is clean. `npm run build` passed with existing unrelated warnings in DepartmentRequestedItemsBoard/PhysicalInventory, bundle size and stale browser metadata.
- Existing baseline backend failures were independently reproduced on untouched `77cfa549`: `fetchRequestsController.domain.test.js` and `procurementHistoryController.test.js` (SQL-shape fixtures), and `phase5aCanonicalItemWriterBoundary.test.js` (existing integration-fixture writer classification). They are not hidden or fixed by weakening financial tests.
- Node syntax, offline PostgreSQL grammar parsing of generated predicates/manual permission SQL and diff whitespace checks passed in final verification (37 backend JavaScript files; permission seed grammar and disposable fixture parsed offline). No hosted SQL or application financial mutation was performed.

## Exact files changed

- `docs/audits/2026-11-aud002-remediation.md`
- `purchase-backend/__tests__/accountsPayableValidation.test.js`
- `purchase-backend/__tests__/phase4cEffectiveMatchState.test.js`
- `purchase-backend/__tests__/phase4cInvoiceMatching.test.js`
- `purchase-backend/__tests__/phase4dAccountingBridge.test.js`
- `purchase-backend/controllers/budgetControlController.js`
- `purchase-backend/controllers/contractsController.js`
- `purchase-backend/controllers/procureToPayController.js`
- `purchase-backend/controllers/requests/fetchRequestsController.js`
- `purchase-backend/controllers/requests/requestWorkspaceController.js`
- `purchase-backend/controllers/rfxPortalController.js`
- `purchase-backend/integration/fixtures/p2p.sql`
- `purchase-backend/integration/p2p.postgres.test.js`
- `purchase-backend/services/accountsPayableService.js`
- `purchase-backend/services/apPostingService.js`
- `purchase-backend/services/budgetCommitmentService.js`
- `purchase-backend/services/financeVerificationService.js`
- `purchase-backend/services/goodsReceiptService.js`
- `purchase-backend/services/p2pAuthorization.js`
- `purchase-backend/services/p2pReadScope.js`
- `purchase-backend/services/paymentService.js`
- `purchase-backend/services/purchaseOrderService.js`
- `purchase-backend/services/supplierInvoiceService.js`
- `purchase-backend/sql/manual/058_financial_budget_authorization.sql`
- `purchase-backend/tests/fetchRequestsController.pendingApprovals.test.js`
- `purchase-backend/tests/goodsReceiptService.test.js`
- `purchase-backend/tests/helpers/p2pDomainAuthorization.js`
- `purchase-backend/tests/helpers/technicalAwardFixture.js`
- `purchase-backend/tests/legacyInspectionReceivingBoundary.test.js`
- `purchase-backend/tests/p2pBatch1Hardening.test.js`
- `purchase-backend/tests/phase4AwardEligibilityCorrection.test.js`
- `purchase-backend/tests/phase4ConnectedP2P.test.js`
- `purchase-backend/tests/phase4ControllerCutover.test.js`
- `purchase-backend/tests/phase4PurchaseOrderClose.test.js`
- `purchase-backend/tests/phase4PurchaseOrderCutover.test.js`
- `purchase-backend/tests/phase5a2UomAuthority.test.js`
- `purchase-backend/tests/requestIdentityHardening.test.js`
- `purchase-backend/tests/rfxIdentityCorrection.test.js`
- `purchase-backend/tests/technicalAwardWorkflow.test.js`
- `purchase-backend/utils/permissionService.js`
- `purchase-frontend/src/App.js`
- `purchase-frontend/src/api/budgetControl.js`
- `purchase-frontend/src/components/Navbar.js`
- `purchase-frontend/src/pages/BudgetControlPage.authorization.test.jsx`
- `purchase-frontend/src/pages/BudgetControlPage.jsx`

## Manual permission migration and deployment

**MANUAL DATABASE MIGRATION REQUIRED**

`purchase-backend/sql/manual/058_financial_budget_authorization.sql`

This is a permission seed only, the next manual number after 057. It inserts `finance.budget.manage` idempotently and grants nothing to any user/role. No existing permissions, frozen migrations, financial records, root ownership, approval history or historical keys are rewritten. The seed was tested only in disposable local PostgreSQL, including repeated execution and unchanged user/role grant counts.

Owner must review and apply the file manually in Development first. Through existing permission management, review actual financial user/role mappings against the matrix; grant only intended existing action capabilities and the new budget-management capability where appropriate. Financial access previously obtained only through a role-name fallback or implicit Admin shortcut will now be denied until explicit grants are established. Budget readers need lifecycle-view; configuration requires its dedicated capability. Do not blanket-grant new permissions or infer authority from job titles.

Verify existing canonical P2P, audit, outbox, inventory and source schema prerequisites manually in Development; the isolated fixture is not a hosted schema/RLS certification. Validate two institutes, receiver access, a different PO approver and financial command retries before any reviewed rollout. Deploy backend before/together with the budget frontend, which consumes scoped department/options and the server management flag. Avoid mixed old/new finance writers during rollout. No merge or deployment was performed.

## Compatibility and remaining risks

- Historical rows remain unchanged. Legacy journal/GL rows with unrecognized or mismatched invoice sources are excluded from the financial lifecycle read; no source type or ownership is guessed. Missing source/request/institute/voucher links, inconsistent ownership and unknown document-flow source types cannot be treated as verified financial records: protected detail/mutation paths fail closed and list/linked views exclude unverifiable records. Manual reconciliation remains necessary; no institute is inferred from a current creator, supplier name or frontend field.
- Cross-department finance operations within one institute remain supported through explicit financial capabilities. There is no finance cross-institute exception; future centralized finance authority needs a separately governed capability/scope design.
- The recorded PO maker/approver separation is enforced without changing PR approval routing. Existing self-approved or creator-less unissued POs require valid approval evidence before issue. Voucher maker/checker tiers and a payment preparation/approval/reversal lifecycle are not implemented by this patch. The baseline's payment-separation policy remains an outstanding financial-control work package; scope authorization is not certification of all financial policy decisions.
- Contract invoice/payment writers and legacy contract balances remain AUD-001/AUD-005. RFx CRUD/public supplier identity remains AUD-004. This patch secures their canonical PO creation/retry or joined financial-read boundary, not those entire modules. Dormant, unmounted generic journal/accrual helpers in financeCoreService are not activated or redesigned; active posting stays with the canonical AP service.
- Current budget reporting/projection formulas are preserved, not reconciled or redesigned. Inconsistent contributors are excluded/fail closed; missing historical accounting/stock evidence is not manufactured. Existing unrelated request-read schema helpers and wider AUD-014 delivery/audit issues are not globally remediated here.
- Real PostgreSQL tests prove application query/transaction behavior in an isolated schema. Hosted constraints, grants, RLS, deployment prerequisites, query plans at hospital scale and existing data integrity remain unverified. Source modules outside this patch may retain their own lock order; PostgreSQL deadlock/serialization aborts must be retried through the existing idempotent command, never by a second uncontrolled writer.
- The three independently reproduced baseline Jest failures remain open.

LIVE_ROUTING_ENABLED remains FALSE.
The existing approval engine remains authoritative.
No SQL was executed against Development Supabase.
No SQL was executed against Production Supabase.
