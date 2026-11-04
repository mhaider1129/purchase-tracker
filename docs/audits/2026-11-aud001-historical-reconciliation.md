# AUD-001: controlled historical reconciliation and financial acceptance

Date: 2026-11-04, Asia/Baghdad. Base: `ae78af3a`, merged Phase 5B PR #92. Prerequisites: reviewed Phase 5A containment and Phase 5B canonical authority. Historical reconciliation is **review metadata**, not another financial ledger or an accounting cutover.

## Scope and financial authority

Legacy contract invoices/payments and canonical supplier invoices/AP/payment allocations coexist. The Phase 5A diagnostic identifies candidates but cannot persist a finance decision; Phase 5B correctly holds legacy overlap without assuming those old payments are canonical payments. This continuation adds an authorized worklist, independently reviewed relationships, immutable evidence and exact reporting. It leaves every existing financial writer, historical paid amount, bank reference, legacy endpoint quarantine and settlement hold unchanged.

No amount/date/name-only automatic match exists. An equal amount from a different supplier or invoice never supports confirmation. A **confirmed match** means an authorized independent reviewer attested the supported relationship against the recorded evidence. It is not a bank reconciliation, a confirmed loss, a paid-state correction or permission to settle again.

## Model and review workflow

New table: `contract_financial_reviews` (manual SQL 066). Each append-only revision identifies institute, contract, legacy record type/ID, revision, decision, selected canonical IDs, source fingerprint, evidence snapshot, supporting evidence reference, notes, reviewer, server timestamp and idempotency command/fingerprint. Historical IDs are retained as references, not silently rebound or backfilled. Contract/institute/reviewer foreign keys restrict destructive deletion. UPDATE, DELETE and TRUNCATE are rejected; a correction is a new reviewed revision.

Worklist discovery compares actual owned contract/request/PO/supplier/currency relationships, legacy bill numbers/dates/gross/net values, canonical invoice identity, posted AP provenance/open balances and payment allocation chains. It uses existing P2P read predicates and contract ownership/integrity checks. Broken canonical ancestry is withheld and counted as an integrity defect, not exposed through a candidate ID. Unknown ownership is never inferred from vendor text or frontend filters.

| Classification | Meaning |
| --- | --- |
| Confirmed match | Latest explicit confirmation, with current matching evidence fingerprint |
| Possible match | At least one supported candidate, still awaiting explicit review |
| Unmatched | Identified owned legacy source with no canonical candidate |
| Conflicting | Source/candidate identity, currency, date, monetary or provenance conflict; or explicit conflict decision |
| Insufficient evidence | Missing identity/maker evidence, unsupported source amount, or explicit investigation decision |

Related records can be shown with differences so finance can investigate them; a shared contract/request alone cannot make them a supported match. Rejecting a proposal records the rejected canonical IDs and preserves its history; it does not invent a new financial state or assert that all other candidates are invalid.

Finance personnel can confirm, reject, flag a conflict, or require further investigation. Every decision requires notes and a supporting evidence reference, expected revision and current fingerprint. Evidence references are reviewer-entered citations to supporting material, not automatically dereferenced URLs or verified bank documents. The UI shows the historical source, linked historical invoice for payments, canonical invoice/PO/AP/payment/allocation evidence, differences, review status, author/time and all revisions.

Confirmation rules:

- Invoice: one canonical invoice; actual supplier, normalized bill number, date, currency, gross amount and compatible request/contract source must agree. Inactive canonical invoices and unsupported retention/penalty invoice obligations cannot be confirmed through this adapter.
- Payment: an identified legacy invoice, paid legacy status and matching nonblank payment reference; valid paid unreversed canonical allocation chain backed by posted AP. Selected allocations must sum exactly to that legacy payment, including partial payments and supported multiple allocations. An invoice total alone cannot prove settlement.
- Known makers of the legacy source/linked invoice and canonical invoice/payment must be independent of the confirming reviewer. Missing maker identity prevents confirmation; it is not assumed independent. Investigation remains available without altering that history.
- A canonical invoice/allocation cannot simultaneously be confirmed for two different legacy records of the same type. A prior claim, including stale claims, must be explicitly superseded before reassignment. Same-amount installments do not form an automatic deduplication key.

This is one finance review action using existing permissions and audit infrastructure. No additional approval engine or payment approval chain is introduced.

## Authorization and API

Both capabilities are required for **listing, reporting and all decisions**: `finance.verify` **and** `procure-to-pay.lifecycle.view`. Actors, active state and explicit grants are reloaded server-side. Contract management alone grants no access. Permissions are not seeded or automatically assigned by the migration.

- `GET /api/contracts/financial-reconciliation/worklist?contractId=<optional>`: owned current-institute worklist plus report/acceptance snapshot. Without a contract filter it covers the current institute; with it, the response explicitly declares contract scope. No client institute selector or cross-institute override exists.
- `POST /api/contracts/financial-reconciliation/reviews`: record one append-only decision. Body supplies source identity, selected candidate IDs, decision, fingerprint, expected version, evidence, notes and command key; actor/institute/time/evidence facts are server-derived.

Foreign direct IDs return 404; missing grants return 403. The source graph is revalidated for both first commands and idempotent retries. Historical snapshots are intentionally retained for audit; current reporting exposes only snapshots of sources/contracts within the authorized institute scope. Unowned or inconsistent contract roots are not exposed to ordinary finance personnel; owner diagnostics must resolve missing ownership separately.

## Concurrency, audit and preservation

Read worklists/reports use a repeatable-read snapshot. Review transactions use READ COMMITTED, an institute-scoped advisory transaction lock and source row lock, with contract shared lock, so revision and cross-source mapping checks see committed winning decisions after waiting. Optimistic expected-version/fingerprint checks prevent stale submissions. Unique revision and institute-command keys provide database backstops. Duplicate identical commands return the saved review without another audit; changed commands with the same key are rejected.

Canonical finance can continue under its existing locks. A later change to included source/candidate evidence makes an earlier review stale and removes it from confirmed totals until reviewed again. A review does not freeze bank activity or certify that balances can never change after the snapshot.

The review INSERT and existing `auditService.writeAuditEvent` run in one transaction. Audit failure rolls back the revision. Audit records include institute, actor, source fingerprint, selected canonical IDs, reason and before/after review metadata. Runtime reporting checks for a corresponding audit event for every retained review. No notification outbox, posting, payment, allocation, reversal or historical financial mutation is performed by either endpoint.

## Reporting definitions

All amounts remain decimal strings, grouped **separately by legacy record type and currency**. There is no FX policy or conversion. Invoice obligation and payment evidence totals must never be added together.

- Legacy unreconciled value: signed legacy gross invoice amount (base plus tax minus discount), or legacy payment amount, for rows without a current confirmed relationship. Credits/adjustments remain evidence requiring investigation; they are not replayed as payments.
- Confirmed matched value: the corresponding legacy amount with a current explicit supported confirmation, counted once per source. Stale confirmation contributes to unreconciled value again.
- Potential duplicate settlement exposure: positive unresolved source value with supplier/bill/currency identity evidence (and payment reference for payments) for an unrejected candidate. It is counted once per source, not once per candidate, and excludes amount-only or unrelated supplier/bill evidence. It is an investigation indicator, **not a confirmed financial loss**.
- Conflicting records: count of rows currently classified conflicting, alongside their differences and revision history.
- Progress: record counts confirmed/total, unreviewed and stale; institute or selected-contract scope is explicit.
- Contract completeness: all invoice/payment relationships confirmed, no unmapped consumption rows and no nonzero historical header evidence. A clean contract with no legacy evidence needs no reconciliation. Header counters/consumption are reported as unresolved evidence rather than counted again as invoices or payments. They require a separately approved mapping design.
- Financial acceptance: canonical source/descendant isolation, payment allocation completeness/positivity/currency, posted voucher/posting identity and amounts, and AP open balance versus valid allocations; separate audit-completeness result. Broken foreign descendants are counted without leaking their contents. Existing Phase 5B projection remains the authority for contract money.

A maximum of 5,000 records per queried stage is enforced. An oversized response fails with 413, never a partial report disguised as complete totals. Contract filtering can narrow a worklist; very large institute reports need a future batched reporting design. Foreign/unowned records are not included in current-institute totals, so these reports do not certify an entire hosted database as reconciled.

## Exact implementation files

- `purchase-backend/sql/manual/066_contract_financial_reconciliation.sql`: append-only review metadata, constraints/indices, RLS and bounded privileges.
- `purchase-backend/services/contractFinancialReconciliationService.js`: capabilities, institute scope, discovery/classification, exact totals, acceptance, version/idempotency/mapping exclusion and atomic audit.
- `purchase-backend/controllers/contractFinancialReconciliationController.js`, `routes/contracts.js`: authorized endpoints before parameterized contract routes.
- `purchase-backend/integration/contractFinancialReconciliation.postgres.js`: native PostgreSQL acceptance cases; `integration/canonicalContractFinance.postgres.js` exposes a test-only continuation hook after its unchanged 38 cases. Runner/package command loads the actual schema and manual patches into a disposable instance, with populated history and representative Supabase role names.
- `purchase-frontend/src/components/ContractFinancialReconciliation.jsx` and its test: explicit evidence review, exact reports, audit/progress, errors/reload, stable command key on retries and stale-response protection.
- Existing `ContractsPage.jsx` financial tab and `ProcureToPayAccountsPayablePage.jsx`: contract-specific and institute finance worklists without redesigning either module.
- `interface.en.json`/`interface.ar.json`: equivalent review labels, classifications, evidence differences and limitations. Canonical API values remain unchanged; existing Axios authentication/401 handling remains active.

No canonical financial writer or frozen migration is changed. Existing historical and canonical records remain the original evidence; only reviews and their audit rows are added.

## Manual Development rollout and acceptance

**MANUAL DATABASE MIGRATION REQUIRED:** `purchase-backend/sql/manual/066_contract_financial_reconciliation.sql`.

1. Development owner verifies approved Phase 5A/5B code and complete 059, 064 and 065 schema prerequisites. Take an owner-managed snapshot/backup and preserve a before-run extract of historical/canonical IDs, amounts, currencies and balances. Do not copy production credentials into test scripts.
2. Review 066 and apply it **manually in Development** through SQL Editor. It is atomic with a three-second lock timeout, creates only review metadata and preserves populated financial/review rows on repeats. On lock contention retry in an appropriate maintenance window; do not remove the controls.
3. Confirm both append-only triggers and RLS, and that anonymous/authenticated clients cannot read/write the table or advance its sequence. Existing `service_role`, when present, receives only SELECT/INSERT plus sequence USAGE/SELECT; other backend DB roles require an owner-reviewed equivalent grant and RLS arrangement. Do not grant this table directly to browser users.
4. Assign both existing finance capabilities to the designated independent Development reviewer using existing permission administration. No SQL role-name bypass is added to application authorization.
5. Run `npm run test:contract-reconciliation-postgres` against its disposable fixture, then exercise the Development worklist with independently verified archive references. Verify 403/404, conflicting/missing evidence, two-reviewer races, retries, audit entries, exact currency totals and unchanged financial extracts. Confirm existing Phase 5B payment holds remain after a review.
6. Reconcile each real record explicitly. Review report defects, stale claims and missing ownership; obtain financial-owner acceptance against source documents. Only the owner can schedule an eventual production migration/deployment after review. These local tests do not constitute hosted financial acceptance or authorize a settlement cutover.

No hosted SQL, historical backfill, deployment or merge was performed. `LIVE_ROUTING_ENABLED` remains false and Approval Engine V2 stays disabled.

## Validation and remaining limitations

Final local results:

- `npm run test:contract-reconciliation-postgres`: **31 new cases passed**, plus all **38 Phase 5B cases** and populated initial/repeat patch preservation. Every review command is surrounded by exact historical/canonical/outbox hash comparisons, including successful confirmations, retries, denials, concurrency and audit failures.
- `npm run test:contracts-postgres`: **51 passed**, preserving institute scope and contract lifecycle behavior.
- Backend `npm test -- --runInBand`: **220 suites / 1,864 tests passed; 3 tests failed** (baseline failures listed below).
- Frontend focused component/API/locale regression command: **6 suites / 14 tests passed**, including Arabic controls and exact string amounts.
- `CI=false npm run build`: **passed**. Existing unrelated unused-variable/effect-dependency warnings remain in `DepartmentRequestedItemsBoard.jsx` and `fixed-assets/PhysicalInventory.jsx`, alongside dependency metadata/bundle advisories.
- Changed backend JavaScript syntax checks and `git diff --check`: **passed**.

 The native suite includes the 20 requested cases plus mapping exclusion, multi-allocation precision, append-only/privilege checks, stale evidence, malformed commands and populated migration repeats. It also runs all 38 Phase 5B canonical financial cases. Existing contract lifecycle tests are retained.

The broad backend suite still has the three previously documented baseline failures in `fetchRequestsController.domain.test.js`, `procurementHistoryController.test.js` and `phase5aCanonicalItemWriterBoundary.test.js`; unrelated request/item code is unchanged. The suite is not represented as fully green.

Remaining design/operational work: real-record financial-owner acceptance, missing ownership/maker/bank identity investigation, unsupported credits/reversals or contract source adapters, historical header/consumption reconciliation, scalable large-institute reporting and a separately approved decision on execution-hold release. Text evidence is auditable reviewer testimony, not cryptographic proof of bank settlement. Review metadata may be complete while a separate financial source defect still requires investigation. This implementation deliberately makes no automatic financial correction or claim that all AUD-001 risks are closed in the hosted system.
