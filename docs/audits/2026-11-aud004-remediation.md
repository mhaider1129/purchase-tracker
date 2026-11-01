# AUD-004 remediation — sourcing authorization and institute isolation

Revalidated on 1 November 2026 (Asia/Baghdad) against master `d192cef5`, including merged AUD-002 PR #83 and the AUD-009 fixes. Read the October system audit, security/authorization audit, remediation backlog, integration matrix and AUD-009 remediation report. No hosted database, live supplier account, clinical record or storage object was accessed.

## Verified root causes

AUD-004 remained confirmed. RFx management admitted role-name fallbacks; event listing and catalog offering lookup were public; event/response reads, status updates, evaluation and PDF generation used global IDs without checking the owning request/institute. Public submission trusted a supplier name and could create a supplier master. Linked request workspaces independently exposed quotation prices. AUD-002 had already protected the final PO boundary and its retry return; it did not secure the preceding sourcing operations.

Canonical award creation enforced identity, supplier eligibility, technical clearance, cumulative quantity, audit/outbox and payload-bound idempotency, but lacked its own current-actor and source ownership boundary. A stored award could also carry a quotation source from a different request. Technical proposal preparation checked response/request identity but did not verify the response's RFx event parent.

The separate Procurement Evaluations router also accepted role-name fallbacks and globally addressed cases, offers, tests, scores, results and report IDs. Its helpers used the global pool, its audit fallback swallowed failures and its import committed before audit. A child belonging to another case could be used by bulk writes. The integration audit correctly states that this evaluation model has no mounted evaluation-to-canonical-award conversion; none is added here.

## Authority and supplier compatibility decisions

Existing permissions are reused, without new seeds or automatic grants:

- `rfx.manage` governs internal RFx reads, quotation recording, event management and advisory quotation analysis.
- `evaluations.manage` governs the existing independent evaluation model, including supplier selection/finalization, reopening, calculation and reports. Generic request visibility, procurement update permission and job titles do not authorize confidential evaluations.
- RFx award requires `rfx.manage` **and** `procure-to-pay.purchase-orders.manage`, because its established command creates a canonical draft PO.
- Technical review continues to require its existing management permission and independent assigned departmental opinion/SCM sign-off. PO submission/approval/issue retain canonical PO capability and independent creator/approver checks. No extra approval workflow is introduced.

These boundaries reload the active database actor and effective explicit grants through the existing permission service, using the AUD-002 helper's opt-in exclusion of implicit Admin-all. Existing explicit role-permission mappings remain valid. No individual user or role name grants sourcing authority. Current institute comes from the actor record, never a body/query filter; there is no existing sourcing-specific cross-institute capability, so request/inventory cross-scope grants do not extend sourcing access. Named management capabilities authorize same-institute operations across its departments; linked department/section/warehouse references must still be consistent.

The schema includes `supplier_users` and `supplier_portal_sessions`, but repository review found no active supplier authentication/session issuer or RFx invitation relation/command. The UI's automatic-invitation description is not an authorization mechanism. This patch does not invent invitations, sessions or a new portal feature. It **disables anonymous/name-based supplier access** and preserves quotation recording/revision by explicitly authorized internal buyers. `rfx.respond` alone and a Supplier role/claimed supplier ID cannot read events, competitor quotations, catalog offerings, evaluations or award recommendations. Existing supplier session tables are not treated as internal user identities.

This is a deliberate compatibility restriction: the previous anonymous submission path is unavailable. External self-service must remain disabled until verified supplier identity and bounded invitations are implemented under an agreed policy. Internal buyers select an existing supplier ID, or an unambiguous existing name within institute/shared scope. A quotation no longer creates a supplier master. New suppliers use existing governed supplier-management operations. No claim is made that an external invitation workflow was implemented or tested.

## Authorization matrix

Paths below are under `/api`. JWT authentication remains required. A sourcing capability is not a grant to the general request or attachment module.

| Surface / existing action | Capability | Object boundary and preserved authority |
| --- | --- | --- |
| GET `/rfx-portal` and browser search/filter/report source | `rfx.manage` | Event → actual request → department/institute; response counts include only consistent owned responses; unlinked events withheld |
| POST `/rfx-portal` | `rfx.manage` | Required linked request, actual department/project/warehouse; existing approved/active sourcing eligibility and item readiness; details items derived from persisted demand |
| GET `/rfx-portal/offerings` | `rfx.manage` | Actual requested item → request/institute; existing scoped/shared supplier and product; existing active Generic/Product/Catalog/UOM and mandatory-product restrictions |
| POST `/rfx-portal/:id/responses` and canonical `submitLinkedRfxResponse` | `rfx.manage` | Actual event/root, existing supplier, actual requested items, Product/Catalog linkage; open/deadline gate, governed pricing/coverage/UOM retained; full actor passed to readiness |
| GET `/rfx-portal/:id/responses` | `rfx.manage` | Authorize event first; exclude inconsistent request/item/product/supplier children; no public supplier response listing |
| POST `/rfx-portal/:id/analyze` | `rfx.manage` | Authorize event before existing advisory scoring of submitted inputs; this neither persists an award nor substitutes for canonical source pricing |
| PATCH `/rfx-portal/:id/status` | `rfx.manage` | Owned locked event; canonical PO lifecycle must resolve an active linked PO before changing RFx status; `awarded` can only come from canonical award command |
| POST `/rfx-portal/:id/award` | `rfx.manage` + PO manage | Request → event → exact response, supplier and every affected sibling bid; actual quotation lines and demand; source terms, quantity, technical clearance and canonical PO creation in one transaction; retries reauthorized |
| Canonical `createAward`, including direct service callers | `rfx.manage` | Actual item/root/supplier, approved/active demand, exact quotation event/response/item/supplier and price/currency/Product/Catalog; valid partial quantities; supplier eligibility and technical gate retained |
| PO creation/approval/issue, canonical award reports | Existing financial capabilities | AUD-002 graph now additionally rejects foreign/inconsistent persisted quotation-award sources, including headerless historical awards; no bypass of technical or financial gates |
| GET `/requests/:id/rfx` (PDF export) | `rfx.manage` | Actual owned request authorized in the transaction before document queries/rendering; no role fallback |
| GET `/requests/:id/full-details` — RFx/quotation links only | Existing request access + `rfx.manage` for sourcing links | Separate current sourcing authorization; unauthorized/foreign sourcing links withheld; no grant from ordinary workspace visibility |
| GET `/technical-inspections/pre-procurement/proposals` proposal directory; technical proposal preparation/current checks | Existing technical management/reviewer policy | Additional event → response → requested item → request agreement; supplier/product ownership, evidence retention and signed-round rules retained |
| GET `/procurement-evaluations` | `evaluations.manage` | Actual case department/institute and optional actual request/section; exclude inconsistent selected offers, suppliers, cost/score/result parent relationships in both directions |
| POST `/procurement-evaluations` | `evaluations.manage` | Actual request department or explicit owned department; for a new independent case only, omitted department derives from the trusted actor department. Missing ownership fails closed; no historical creator inference |
| GET/PATCH/DELETE `/procurement-evaluations/:id` | `evaluations.manage` | Lock/authorize actual case graph; source ownership cannot be reassigned through draft fields; direct `Finalized` status bypass rejected |
| `/procurement-evaluations/:id/offers`, `/scenarios`, `/tests`, `/criteria`, `/scores`, `/offer-test-costs` and existing child/bulk variants | `evaluations.manage` | Actual case, every route/body offer/test/criterion/selected-offer ID and referenced supplier; prevents cross-case grafts and conflicting unique-key writes |
| POST `/procurement-evaluations/:id/import/preview`, `/offers/:offerId/import` | `evaluations.manage` | Case and actual offer; existing validation/import options/calculations retained; outer transaction includes import, ownership checks and audit |
| POST `/procurement-evaluations/:id/calculate`, `/break-even` | `evaluations.manage` | Owned case graph; existing algorithms and criteria unchanged; result writes and audit share authorized client |
| PATCH `/procurement-evaluations/:id/finalize`, `/reopen` | `evaluations.manage` | Actual selected offer/case; existing finalization readiness, required scoring/coverage/compliance and read-only finalized edit rules retained; no canonical award/PO conversion |
| GET `/procurement-evaluations/:id/results`, `/sensitivity`, `/optimization`, `/recommendation`, `/risk-adjusted-tco`, `/coverage`, `/item-comparison`, `/compliance-matrix`, `/disqualification-review`, `/report-summary` | `evaluations.manage` | Owned consistent graph before queries/calculations; report helpers' existing lazy result persistence uses same client and transactional report audit |
| GET `/procurement-evaluations/import/template.csv`; browser exports | `evaluations.manage` | Template contains no case data; data exports use authorized read results; no separate export permission exists |
| Supplier invitation/self-service operations | No mounted implementation | No new endpoint or invitation model added; anonymous and respond-only internal access denied |

Generic file downloads retain the previously remediated attachment service's actual-parent authorization. No public file mount, storage URL or extra supplier attachment grant is introduced. Technical evidence selection still validates selected attachment IDs against the exact reviewed request and retains revision fingerprints. Supplier performance scoring/SRM and contract financial integration remain outside this PR.

## Exact behavior and transaction changes

`rfxAuthorization` reuses the financial helper for current explicit grants and actual request/department/project/warehouse checks. It locks the root before RFx event/response locks, rechecks discovered ownership after locking, validates requested-item/product/supplier ancestry and validates all bids that the award command will close. Supplier/catalog product masters with NULL ownership retain existing shared semantics; explicit foreign ownership is rejected. Active source request eligibility reuses the existing procurement-case eligible states and unresolved-approval policy, rather than inventing a sourcing approval engine.

Canonical award service checks authority before business gates or idempotent return. Normalized quotation terms must match the exact source line; partial quantities remain bounded by the reviewed payable quantity and the existing cumulative award lock. Legacy single-item aggregate pricing retains its exact division/reconciliation rules. A numeric source ID that ambiguously collides with a different quotation line is not silently reinterpreted as a legacy aggregate. Existing persisted award ownership is also checked in canonical financial graph/read predicates. Idempotency keys never disclose a different parent/supplier's award.

RFx create, quotation submit, status and award now use canonical audit with trusted actor/institute, affected root, source decisions and before/after data in the business transaction. Existing notification outbox and document-flow services remain authoritative. RFx runtime CREATE/ALTER initializers were removed from these handlers; the existing schema must already be installed, not modified by a sourcing request.

Independent evaluations retain the existing calculation service. Its new database-bound factory allows route helpers to use the authorized transaction. A request-local `AsyncLocalStorage` adapter has no global-pool fallback; all existing route queries and calculation persistence resolve the same client. The case/root graph is locked before reads/writes, and the response is deferred until commit. Existing nested import commit and swallowed audit fallback were removed. Report calls that may lazily persist results record evidence in the same transaction. No pricing/scoring formula, supplier performance model or evaluation-to-award writer was introduced.

## AUD-009 and workflow compatibility

No fingerprint version, fields, approved packet, hash, technical decision, timestamp or historical review link was rewritten. The query changes add actual event ancestry without changing selected snapshot content. Version-2 workflow status remains excluded; material specifications, product/manufacturer/model, quantity/UOM, price/currency, selected attachments and revisions remain material. Historical approvals keep their existing exact version rules and explicit review-required handling.

The unchanged canonical department opinion, independent SCM sign-off, exact signed review provenance and PO technical-clearance gate still govern the connected flow. Existing PO maker/approver separation and finance/budget gates from AUD-002 remain enabled. Existing supplier eligibility, physical catalog/UOM checks, whole-request quotation coverage, valid partial canonical awards/PO quantities, cumulative limits, response/award/PO links, duplicate winner detection, idempotency, audit and outbox remain in their canonical services.

Independent evaluations remain advisory; finalization does not create an award or PO. Same-institute named-capability operations remain supported. Role-only/implicit Admin and generic request/procurement permissions no longer expose sourcing data. Legacy events without a verified linked request and independent cases without a verified department/request are withheld; historical rows are never silently assigned to the current creator/institute. A nullable redundant case department can be verified through its actual request; an explicit conflicting department cannot.

## Tests and results

- `purchase-backend`: `npm run test:p2p-postgres` — **92 tests passed, zero failures** (63 existing financial scenarios plus 29 new sourcing/evaluation scenarios). Uses the repository's guarded new empty loopback-only PostgreSQL 16 database in a disposable tmpfs container. No hosted SQL. Real grants, actual controllers/services/routers, SQL predicates, row locks, concurrent commands, audit/outbox and rollback are exercised without production authorization mocks.
- New security cases cover unauthorized creation/listing/evaluation/award; foreign event/request/item/response/supplier; competitor response denial for respond-only/claimed supplier users; no supplier-master creation by name; valid same-institute award → PO approval → issuance; forged body institutes; exact source terms; partial/cumulative awards; duplicate/concurrent winner retry; revoked/moved-actor replay; cancellation/status restrictions; foreign/inconsistent report/count/PDF/export sources; creation/response/status/award audit rollback; direct-service bypasses; persisted award source grafts; evaluation case/child/bulk/report isolation, incoming result grafts, audit rollback and complete valid calculation/finalization; real quotation fingerprint workflow-status/material-change/event-parent cases.
- All 20 requested test categories are represented as applicable to mounted workflows. Invitation denial is fail-closed at the internal sourcing boundary; there is no invitation service to exercise. External verified-supplier sessions/invitations are not claimed as covered. Existing technical controller/service end-to-end tests cover reviewer opinion, SCM sign-off and exact approved PO issue in addition to the real PostgreSQL sourcing flow.
- AUD-009 focused command: `npm test -- --runInBand tests/technicalAwardWorkflow.test.js tests/technicalProposalContentIdentity.test.js tests/technicalProposalSnapshot.test.js tests/preprocurementTechnicalReviewGate.test.js tests/rfxIdentityCorrection.test.js tests/rfxAwardPricing.test.js tests/phase4PurchaseOrderCutover.test.js` — **7 suites / 83 tests passed**.
- Full backend `npm test -- --runInBand` — **219 suites / 1,854 tests passed; 3 baseline suites/tests failed**. Reproduced all three in detached unchanged `d192cef5`: `fetchRequestsController.domain.test.js`, `procurementHistoryController.test.js` (existing SQL-shape fixtures), and `phase5aCanonicalItemWriterBoundary.test.js` (existing reconciliation-script DML classification). No new remediation Jest failure. Existing domain-only fakes explicitly mock sourcing authorization; real database tests do not.
- Frontend `CI=true npm test -- --runInBand` — **109 suites / 482 tests passed**, including four new supplier/role-versus-capability controls. Build passed with existing unrelated warnings in DepartmentRequestedItemsBoard/PhysicalInventory, bundle size and stale browser metadata. Changed-file ESLint clean apart from the browser metadata notice.
- Syntax checks on **24 changed/new backend JavaScript files**, locale JSON parsing and `git diff --check` passed. `LIVE_ROUTING_ENABLED` source remains `false`; no frozen migration or environment/configuration binding changed.

## Exact files changed

- `docs/audits/2026-11-aud004-remediation.md`
- `purchase-backend/__tests__/nonStockIdentityGovernance.test.js`
- `purchase-backend/app.js`
- `purchase-backend/controllers/requests/generateRfxController.js`
- `purchase-backend/controllers/requests/requestWorkspaceController.js`
- `purchase-backend/controllers/rfxPortalController.js`
- `purchase-backend/integration/fixtures/p2p.sql`
- `purchase-backend/integration/p2p.postgres.test.js`
- `purchase-backend/routes/procurementEvaluations.js`
- `purchase-backend/services/p2pAuthorization.js`
- `purchase-backend/services/p2pReadScope.js`
- `purchase-backend/services/procurementAwardService.js`
- `purchase-backend/services/procurementEvaluationAuthorization.js`
- `purchase-backend/services/procurementEvaluationService.js`
- `purchase-backend/services/rfxAuthorization.js`
- `purchase-backend/services/rfxResponseService.js`
- `purchase-backend/services/technicalProposalDirectory.js`
- `purchase-backend/services/technicalProposalSnapshot.js`
- `purchase-backend/tests/generateRfxController.test.js`
- `purchase-backend/tests/helpers/p2pDomainAuthorization.js`
- `purchase-backend/tests/helpers/technicalAwardFixture.js`
- `purchase-backend/tests/phase4AwardEligibilityCorrection.test.js`
- `purchase-backend/tests/phase4ConnectedP2P.test.js`
- `purchase-backend/tests/requestIdentityHardening.test.js`
- `purchase-backend/tests/rfxIdentityCorrection.test.js`
- `purchase-backend/tests/technicalAwardWorkflow.test.js`
- `purchase-frontend/src/App.js`
- `purchase-frontend/src/components/Navbar.js`
- `purchase-frontend/src/locales/ar.json`
- `purchase-frontend/src/locales/en.json`
- `purchase-frontend/src/pages/RfxPortalPage.authorization.test.jsx`
- `purchase-frontend/src/pages/RfxPortalPage.jsx`

## Migration, rollout and remaining risks

**No new database migration required.** Existing permission definitions, owner columns, RFx/quotation/evaluation relations, review JSONB, audit and outbox storage suffice. No permission grants, schemas, histories, amounts or approvals are backfilled. The expanded SQL file is strictly a disposable integration fixture, not a migration. Existing evaluation schema compatibility hooks remain separate AUD-010 work; this patch does not claim hosted schema/RLS certification.

Before reviewed rollout, the owner must verify existing schema prerequisites and effective explicit `rfx.manage`, `evaluations.manage`, technical and PO grants through the existing permission-management system. Do not restore access with role-name or global Admin bypasses. Deploy the backend before/together with the frontend route/control updates. Verify an internal buyer recording a known supplier quotation, a distinct technical reviewer/SCM signer, a distinct PO approver, valid issue/retry, and two-institute denial using a local fixture. No assistant-run hosted SQL or deployment is authorized.

Remaining risks:

- External supplier self-service/invitation attestation is not implemented in the current application and remains disabled here. It needs a separately agreed verified identity/invitation policy; do not reconnect anonymous names as authority.
- Legacy unowned or inconsistent sourcing/evaluation records and ambiguous aggregate source IDs may need owner-led reconciliation. No historical owner, quotation version or approval is guessed, rewritten or silently upgraded.
- Existing whole-request RFx winner rules remain; partial allocations use the existing canonical award/PO services, not a new RFx split-award UI or algorithm. Independent evaluations do not become canonical supplier decisions automatically.
- Hosted tables, RLS/DB roles, deployment prerequisites, storage immutability and production-scale query plans remain unverified. Attachment metadata hashing retains AUD-009's documented limitation against out-of-band byte replacement at the same key.
- General contract finance/authorization, supplier performance scoring, broad SRM, dormant generic financial writers and unrelated audit-delivery/runtime-DDL findings remain separate work.
- Three reproduced baseline backend test failures remain open.

LIVE_ROUTING_ENABLED remains FALSE.
The existing approval engine remains authoritative.
No SQL was executed against Development Supabase.
No SQL was executed against Production Supabase.
