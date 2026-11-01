# AUD-005 — Contract authorization and institute isolation

Revalidated against master `8b6461c7` on 2026-11-01. **CONFIRMED in source and disposable PostgreSQL; no claim of a production exploit or hosted verification.** Read the October system audit, security/authorization audit, remediation backlog and integration matrix. AUD-001 settlement consolidation remains separate.

## Confirmed causes

- Authenticated contract routes selected global contract/child IDs without a common institute and capability boundary. `contracts.manage` checks were inconsistent; contract evaluations also used a global role-name allowlist.
- `contracts.institute` is display text. Contract-file and equipment policies could fall back to the creator's current placement, which does not establish historical business ownership.
- Lists, active items, risk dashboards, due-soon worklists and approval reconciliation could read or affect foreign contracts. Supplier and request summaries and AI supplier tools also exposed contract records through other entry points.
- Document/version, invoice/payment, supplier, department, owner and source references were not consistently checked as one graph. An invoice read could include payments whose `invoice_id` pointed across contracts.
- Obligation completion locked a row but generated another successor on every retry. Sequential duplicate calls were unsafe even without a race.
- Several mutations and logs used separate pool statements. Some log failures were swallowed. Request-time schema repair included global data updates; AI error handling attempted writes after rollback. A compliance helper opened another connection while the authorized transaction held locks.

## Ownership and authorization matrix

All operations reload the active actor and explicit effective grants from the database. The implicit Admin-all permission expansion is disabled for this boundary. There are no new permission codes or automatic grants.

| Operation | Existing authority | Additional object boundary |
| --- | --- | --- |
| List/read a contract and its ordinary children | `contracts.manage`, or existing creator/manager/current or decided reviewer delegation; assignment-specific evaluator/obligation access is restricted to their own records | Verified institute ownership and actual relationship; SQL filtering precedes limits and aggregation |
| Active contracted-item lookup | Above, or `stock-requests.create` / `requests.manage` for the request catalog | Active/priced item rules unchanged; institute, master references and contract ownership must agree |
| Create/edit, amend, submit, sign/activate, renew, terminate, archive | `contracts.manage` | Existing status transitions remain; source request ownership is immutable; department edits must stay in the same institute; pending approval evidence cannot be bypassed or deleted by resubmission |
| Decide an approval | Actual active pending step and existing assigned reviewer/role-alias policy | Fresh active actor, institute and reviewer department; management permission alone is not approval authority |
| Read assigned evaluations / obligations | Actual evaluator / obligation owner assignment | Own rows only; no general contract, file, financial or unrelated child access is conferred |
| Complete an obligation | `contracts.manage` or its assigned owner | Exact obligation/contract pair; root lock and unique successor source |
| Manage obligations, renewal events, checklist or document versions | `contracts.manage` | Exact contract/child pair and validated owner, department, evidence and version references |
| Canonical attachment read/upload | Existing related-parent or management authority | Same canonical contract ownership policy; existing attachment retention and file audits remain |
| Canonical attachment delete | `contracts.manage` | Existing signed/evidence retention checks still apply |
| Document delete | `contracts.manage` | Existing archive behavior preserves every version |
| AI extraction / extraction history | Manage for extraction; related read for history | Actual contract/document/version relationship checked before the placeholder executes; no new AI provider feature |
| Legacy invoice, payment, consumption and financial summary reads | `contracts.manage` + `procure-to-pay.lifecycle.view` | Actor's own institute; references and graph must agree |
| Legacy invoice/consumption writes | `contracts.manage` + `procure-to-pay.invoices.manage` | Same own-institute boundary; canonical P2P authority verifies linked PO/receipt sources against the contract's source request |
| Legacy payment writes / changed header `amount_paid` | `contracts.manage` + `finance.payment.manage` | Same own-institute boundary; related invoice must belong to that contract |
| Changed header `actual_consumed_value` | `contracts.manage` + `procure-to-pay.invoices.manage` | Same own-institute boundary; unchanged zero initialization remains allowed |
| Risk/health calculation, history and dashboards | Existing related/management boundary, with `procure-to-pay.lifecycle.view`; risk calculation/dashboard mutations require management | Finance-derived evidence stays in the actor's own institute |
| Shared template/clause library | `contracts.manage` | Existing global master library remains shared; writes are transactionally audited and are not treated as contract-owned records |
| Supplier/request/AI summaries and equipment coverage | Existing entry-point authority plus contract relationship where contract payload is exposed | Canonical contract ownership predicates; request item price snapshots and equipment references must agree with their actual institute |

Existing explicitly bounded contract cross-institute access is preserved: both `requests.cross-institute` and the target in `institute_ids` are necessary, alongside actual contract authority. This is the pre-existing contract-file rule. It grants no cross-institute finance authority. SCM/Admin names alone grant nothing; role aliases remain only in the existing approval resolver.

For a root, the new nullable `institute_id` is authoritative when populated. Otherwise an actual source request and/or end-user department must establish one unambiguous institute. Every populated provenance reference must agree. Missing or conflicting provenance fails closed; creator placement and the free-text label are never ownership fallbacks. New standalone contracts receive the actor's institute. New request/department-bound contracts derive ownership from those database records after checking bounded authority. Body institute values cannot select ownership.

## Code changes

Paths below are relative to the repository root.

- `purchase-backend/services/contractAuthorizationService.js`: shared actor, ownership, delegation, SQL predicates, child/reference graph checks, root locks, request-local transaction adapter, response deferral, canonical before/after audit and financial capability checks. Existing controller `BEGIN`/`COMMIT` calls compose with the outer transaction; controller rollback or an audit failure makes the whole operation fail.
- `purchase-backend/controllers/contractsController.js`: wraps exported HTTP handlers, scopes lists/worklists/candidates, limits reconciliation to authorized management on the actual contract, replaces runtime schema/data writers with readiness reads, adds recurrence source identity/retry handling, removes log sequence rewriting and post-rollback AI writes. Fixes AI-skip argument order and risk response interception so the response follows the actual commit. Existing invoice matching, pricing, risk factors and settlement calculations are retained.
- `purchase-backend/controllers/contractEvaluationsController.js`: same transaction boundary, explicit management capability, assigned evaluator access and scoped derived evidence.
- `purchase-backend/controllers/contractGovernanceController.js`: same boundary for health/governance and shared libraries; removes runtime schema writers.
- `purchase-backend/services/attachmentAuthorizationService.js`: canonical contract-file authorization reuses this policy and freshly loaded grants; other attachment modules retain their existing policies.
- `purchase-backend/services/p2pReadScope.js`: factors the existing canonical read authorization into a client-bound form; contract consumption uses the same transaction without relaxing actor, capability or graph checks. Standalone read transactions are unchanged.
- `purchase-backend/controllers/supplierSrmController.js`: compliance reads can use the existing transaction without a second connection or schema repair.
- `purchase-backend/controllers/supplierPrincipalsController.js`, `purchase-backend/modules/ai-intelligence/tools/index.js`: contract snippets and contract-linked supplier evidence use actual contract authority.
- `purchase-backend/controllers/requests/requestWorkspaceController.js`: scopes linked contracts/item metadata and prevents full contract audit snapshots leaking through broad request audit search.
- `purchase-backend/controllers/requestedItemsController.js`, `purchase-backend/controllers/requests/createRequestController.js`: contract price references must match the actual request/actor institute.
- `purchase-backend/repositories/contractEquipmentCoverageRepository.js`: replaces creator/manager placement inference with canonical ownership, including coverage listings.
- `purchase-backend/sql/manual/064_contract_authorization_scope.sql`: additive ownership and recurrence identity only.
- `purchase-backend/integration/contracts.postgres.js`, `purchase-backend/scripts/testBackendContractRefresh.js`, `purchase-backend/package.json`: guarded disposable PostgreSQL regression mode and command. It reconstructs the supplied exports, applies prerequisite schema/catalog SQL and applies 064 twice. It never uses the configured application database URL and does not overwrite the existing database-audit artifacts in this mode.
- Updated domain fixtures/tests: `purchase-backend/__tests__/{aiIntelligence,contractEquipmentCoverageRepository,contractItemIdentityMigration}.test.js`, `purchase-backend/tests/{attachmentAuthorization,attachmentEndpoints,contractApprovalWorkflow,contractEvaluationsController}.test.js`, `purchase-backend/tests/helpers/attachmentFixture.js`. Domain-only fakes do not establish production authorization; the PostgreSQL suite exercises actual policies, grants, handlers and SQL.

## Verification

- `node scripts/testBackendContractRefresh.js --contracts` (equivalently `npm run test:contracts-postgres`), from `purchase-backend`: **51 regression cases pass** on runner-created loopback PostgreSQL 16 in a tmpfs Docker container. The runner creates and removes its own database/container; no hosted SQL, credentials or clinical records are used.
- PostgreSQL coverage includes all 20 requested categories: authorized/unauthorized/anonymous viewers, foreign and unresolved/conflicting roots, forged institute, amendment and lifecycle denial, canonical file access, deletion/evidence retention, foreign version/obligation/renewal, concurrent idempotent recurrence, invoice/finance permission separation, foreign invoice/payment/PO links, risk isolation, AI authorization, concurrent changes, canonical audit failure rollback, and legitimate create/edit/version/approval/catalog/financial workflows. It also exercises bounded cross-institute access without financial override, AI summary isolation, direct header payment authorization and the V2-disabled assertion.
- `npm run test:p2p-postgres`: **92 canonical P2P/AUD-002/AUD-004 PostgreSQL regressions pass** after the read-helper refactor.
- Focused Jest command: `npx jest --runInBand --testPathPatterns='contract|attachment|aiIntelligence|requestedItemsController|createRequestController|requestWorkspace|supplierPrincipals'`: **22 suites / 152 tests pass**.
- Full `npx jest --runInBand`: **219 suites pass / 3 fail; 1,854 tests pass / 3 fail**. All three failures were independently reproduced on unchanged master `8b6461c7` in a detached worktree: `fetchRequestsController.domain.test.js` (current-step SQL expectation), `procurementHistoryController.test.js` (SQL-shape expectation), `phase5aCanonicalItemWriterBoundary.test.js` (existing reconciliation fixture classification). They remain outside AUD-005 and are not silently ignored.
- JavaScript syntax checks and `git diff --check` pass. No frontend file changed; no browser or hosted deployment validation is claimed.

## Manual database application and compatibility

**MANUAL DATABASE MIGRATION REQUIRED**

Apply `purchase-backend/sql/manual/064_contract_authorization_scope.sql` manually before deploying this backend. The existing contract module tables/columns must already be installed (including the earlier manual schema reconciliation/refresh as applicable). This patch does not auto-install other migrations or change permission grants. It adds nullable `contracts.institute_id` and `contract_obligations.generated_from_obligation_id`, foreign keys and indexes. Historical rows are neither backfilled nor rewritten. The unique successor index applies to populated source IDs, so historical duplicate recurrences are not deleted or guessed into a lineage. The migration verifies actual successor uniqueness rather than trusting an existing index name.

After applying the patch, this read-only query identifies roots requiring an owner's review. Resolve ownership from real records through a separately reviewed correction; do not infer it from free text, current staff placement or an arbitrary institute:

```sql
SELECT c.id, c.title, c.institute_id, c.source_request_id,
       r.institute_id AS request_institute_id,
       c.end_user_department_id, d.institute_id AS department_institute_id
FROM public.contracts c
LEFT JOIN public.requests r ON r.id=c.source_request_id
LEFT JOIN public.departments d ON d.id=c.end_user_department_id
WHERE COALESCE(c.institute_id,r.institute_id,d.institute_id) IS NULL
   OR (c.source_request_id IS NOT NULL AND
       r.institute_id IS DISTINCT FROM COALESCE(c.institute_id,r.institute_id,d.institute_id))
   OR (c.end_user_department_id IS NOT NULL AND
       d.institute_id IS DISTINCT FROM COALESCE(c.institute_id,r.institute_id,d.institute_id))
ORDER BY c.id;
```

Review existing effective grants for contract finance operators: management alone now cannot operate the legacy payment/invoice endpoints or changed balance fields. Use existing financial permissions through the normal administrator grant mechanism; there are no seed additions. Check institute scope and document provenance in Development manually after review. No Development or Production Supabase execution was performed by this task.

Normal lifecycle transitions, historical-contract creation, stage aliases, assigned evaluator/obligation-owner behavior, document version retention, recurrence schedules, risk algorithms and legacy settlement calculations remain. Assignment-only delegates retain only their own obligation/evaluation records. The source request is intentionally immutable through ordinary edits; department edits remain available within the verified institute. Unresolvable contracts and inconsistent linked graphs are intentionally inaccessible pending evidence-based review. Only an empty, unsigned, non-historical draft can be physically deleted, and its legacy log history is copied into the canonical deletion audit. Contract deletion is denied when legally/business-significant evidence exists; document deletion continues to archive. The existing globally shared template/clause catalogs remain shared master data.

## Remaining risks / follow-up

- **AUD-001 remains open**: legacy contract invoices/payments, paid/consumed counters and canonical AP are not consolidated. Capability checks and scope do not prove canonical posting, matching, reconciliation, prevention of overpayment or bank settlement. No new financial writer or settlement model is introduced.
- Historical missing/conflicting ownership, inconsistent references and already-duplicated recurring obligations require owner review. The patch preserves those records instead of silently rewriting them. Unsupported legacy consumption source references fail closed where their provenance cannot be verified.
- The transaction boundary takes a contract root lock and captures substantial before/after evidence. Large histories may need measured query/audit-size optimization; root serialization is deliberate for integrity. No production performance claim is made.
- AI extraction remains the existing placeholder; no live document retrieval/provider behavior or external processing is activated. No recurring contract-renewal notification sender was found in mounted contract controllers or jobs; due-soon worklists and stored renewal events are scoped, without inventing a sender.
- This is application authorization, not a new RLS/service-role isolation design. Hosted schema, storage policies and live grants remain operational validation work.
- Request-time contract schema repair was removed: a missing prerequisite now fails closed and must be installed manually. Existing migrations remain frozen.
- Three baseline Jest failures remain as listed above.

`LIVE_ROUTING_ENABLED` remains `false`; the legacy approval engine remains authoritative. No merge, deployment, hosted SQL execution, automatic grant or notification dispatch is authorized or performed by this change.
