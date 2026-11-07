# PR 105 review against the 1,357 production findings

## Decision and evidence

**Current decision: NO-GO for restarting Production.** Application credentials are reported as `postgres`; the required financial-review module is missing; release evidence is unverified. A successful diagnostic as `wici_release_reader`, or a target-role grant assessment, is not application acceptance.

Reviewed source: Draft PR 105, branch `codex/hosted-database-compatibility`, initially `e9811b03`. The standalone backend commit `70c4ee50bd0c8342eb30f573eacbd95f543a5e88` was read from GitHub without connecting to Supabase. Its committed `database/releases/schema-contract.json` has version `hospital-erp-2026-11-scop1`, SHA-256 `9b3efde7cb01433a91453a1d6b94a187fc1c3b221432b370be18c4464ff9efe6`, identical to the unchanged monorepo canonical contract. This verifies the repository artifact, not the server working tree or current database.

Live evidence supplied by the operator is a summary: BLOCKED; 1,357 findings; constraints 686 (640 drift, 46 missing); columns 306 (290 drift, 16 missing); relations 44; runtime role/privilege 35; permissions 157; no visible APPLIED 069–072 receipts or release attestation. The actual application role is `postgres`, while the diagnostic connection is `wici_release_reader`. The latest full observed definitions, role attributes, invocation and unfiltered reference/evidence rows were not attached. Earlier owner-captured metadata remains evidence of the earlier state only (capture SHA-256 `d669e14e15dfce8244fea9e290b8dc1ecb72b4640bd428ff71219f03d2658c2a`).

The previous 1,247 count was a comparison of that older capture to SCOP1. It must not be presented as the new live result.

## Categorized discrepancy analysis

| Reported group | Assessment | Required response |
| --- | --- | --- |
| Relations: 44 | Consistent with missing `contract_financial_reviews` plus the previous 43 enabled-RLS/reference-disabled differences | Create only the missing canonical module; preserve enabled RLS |
| Columns: 306 / 16 missing | The 16 missing columns are consistent with the 066 financial-review module; the 290 existing discrepancies match the earlier core shape | Confirm exact names/definitions; retain generated values and identity semantics; no mass type rewrite |
| Constraints: 686 / 46 missing | Same core counts as earlier capture after accounting for already-installed SCOP | Compare actual keys, predicates, delete actions and validation, not names alone |
| Permissions: 157 | Exactly the number of codes in the deployed SCOP1 contract; an RLS-filtered reader can see zero existing codes | Report insufficient visibility; do not insert 157 guessed permissions or grant DML/BYPASSRLS to the reader |
| Runtime: 35 | The disposable owner-role case reproduces 35 findings, including excess SCOP privileges and release-evidence/DDL authority | Replace application owner credentials; do not “fix” this by upgrading the diagnostic reader |
| 069–072 APPLIED receipts | Missing from a result is not proof of non-execution; reader RLS can hide release rows | Distinguish observable absence from insufficient visibility; retain UNVERIFIED history |
| Attestation | Cannot certify a schema fingerprint from an incomplete reference snapshot | Block acceptance until complete actual-runtime verification and a genuine new reviewed attestation |

### A reconstruction that explains the entire total

A **synthetic model, not a live proof**, starts with the prior full catalog, adds canonical SCOP objects from 072, models its four functions pasted with CRLF bodies, and models reference rows hidden by the reader's RLS. Existing non-RLS evaluation-criteria rows remain visible. The original comparator then produces:

| Catalog group | Model findings |
| --- | ---: |
| Relations | 44 |
| Columns | 306 |
| Constraints | 686 |
| Indexes | 13 |
| Functions | 29 |
| Triggers | 2 |
| Policies | 1 |
| Browser table grants | 11 |
| Browser function grants | 4 |
| Permissions | 157 |
| UI resources | 37 |
| Route policies | 25 |
| Reference accounts | 2 |
| **Catalog subtotal** | **1,317** |
| Owner-role findings (reproduced in PostgreSQL) | 35 |
| Four unobserved migration receipts and one attestation | 5 |
| **Total** | **1,357** |

The fit strongly supports “SCOP already installed + reader visibility + owner-runtime authority + strict reference representation” as an explanation. It does not establish that each current live definition is identical to the model. A fresh complete metadata capture and visibility-aware diagnostic must confirm that before approval.

### Compatibility and genuine write constraints

- `catalog.compare()` compares `format_type()` strings and deparsed definitions exactly; PostgreSQL has already normalized ordinary type aliases. Assignment-compatible types are not universally interchangeable in range, scale or time semantics.
- The prior capture verifies 613 constraints as stronger validated equivalents after removing only reference `NOT VALID`: 591 foreign keys and 22 CHECK constraints. Other foreign-key actions and CHECK expressions require their actual definitions. Do not loosen validated keys or automatically equate CASCADE/SET NULL with RESTRICT.
- The prior 24 differing function bodies match canonical behavior after exact CRLF/marker-comment accounting. Four newly installed SCOP routines can add four more formatting-only hash findings. The production profile still pins exact pre-existing hashes and the repair normalizes only reviewed newly installed routines; arbitrary function changes remain blocked.
- AP `invoice_total`, `open_balance`, voucher debit and credit columns at `numeric(14,2)` match the explicit canonical accounting policy in `services/accountingEntryValidation.js`: two decimals and maximum `999999999999.99`, rejecting rather than rounding sub-cent/out-of-range posting amounts. New regression tests prove that policy. The patch preserves those monetary columns and old values. Currency length, other pricing paths, timestamps and external reporting still require owner review; no generic numeric/varchar/timestamp exemption is added.
- Receipt and conversion quantities are different from monetary amounts. The existing PostgreSQL suite reproduced `0.1001` receipt rounding; 073 removes 13 operational quantity/conversion typmods without reconstructing historical quantities.
- Required hosted journal aliases are populated only on new inserts by two hosted compatibility triggers. The canonical writer is unchanged, so schemas without aliases remain supported. No additional financial posting is created.

## Coverage and authoritative migration sources

| Object/control | Authoritative source | Recovery handling |
| --- | --- | --- |
| `contract_financial_reviews`, all 16 columns, constraints/indexes, preserving function and two guards | `sql/manual/066_contract_financial_reconciliation.sql`; prerequisites complete canonical 059/064/065 and invoice-contract source guard | Reviewed definitions incorporated into forward 073; no legacy review backfill |
| Six SCOP tables, four routines, five guards, reference codes, three permission definitions and least-privilege grants | `sql/manual/072_scop_operational_foundation.sql`; canonical 059/064–071 contracts and governed 071 prerequisite | Reuse existing correct objects; create missing ones; preserve pre-existing immutable command history; postflight rejects incompatible partial definitions |
| Release ledgers and bounded `purchase_backend` grant role | `069_database_release_governance.sql` | Require existing controls; never replay frozen 069 |
| RFID attempt/lease controls | `070_rfid_processing_recovery.sql` | Require and verify observed controls; no historical RFID rewrite |
| Durable notification/audit controls | `071_transactional_event_reliability.sql` | Require and verify controls; no synthetic historical audit/outbox backfill |
| Canonical AP/inventory/journal definitions and unique identities | Consolidated canonical `059_backend_contract_refresh.sql` and its source modules; explicit accounting amount policy in backend | Preserve observed compatible money types; add only demonstrated missing uniqueness/guards; stop on duplicates |
| Extra hosted stock-proposal direct-stock trigger | Actual uploaded hosted definition, outside canonical inventory posting | Disable legacy trigger; never replay/reverse prior stock effects |

The current canonical planner selects only 072 because it is the active delta, not because earlier modules/evidence are proven complete. Missing 066 and owner credentials cannot be corrected by 072 alone. The registry's 069 → 070 → 071 → 072 chain describes required governed evidence; manual execution without receipts remains possible.

**Does PR 105 cover the new state?** It covers the known core discrepancies and the already-installed 072 variant. Its preflight checks the reviewed old core without requiring SCOP absence; its `IF NOT EXISTS`/idempotent reference inserts reuse correct existing SCOP objects. Complete postflight pins the resulting full target schema. New PostgreSQL coverage seeds 072 and an immutable command before recovery, with no 072 receipt, and verifies the command remains unchanged. Unexpected current schema changes still fail the bundle and require a newly reviewed correction, not bypassed checks.

## Verifier corrections in this review

1. Inspect SELECT and effective `row_security_active()` for reference and release-evidence relations before reading rows. Report `catalog_visibility` when rows may be hidden; do not mislabel hidden codes as absent. Do not produce a certifiable schema fingerprint from incomplete visibility.
2. Hidden migration receipts are `UNVERIFIED_INSUFFICIENT_VISIBILITY`; a hidden/incomplete attestation is unverifiable, not proof that none exists. Genuine observable checksum mismatches remain blocking even after a new observed baseline.
3. CLI verification defaults to `--connection-mode diagnostic`. It uses the supplied reader directly and never borrows `DB_RUNTIME_ROLE`. `--backend-role` only assesses grants for a named target; it never proves the application principal.
4. Diagnostic mode deliberately returns BLOCKED and `restart_eligible=false`. Actual acceptance requires explicit `--connection-mode runtime`, actual application credentials, no hypothetical role override, complete visibility and all original release checks. Startup continues to verify the actual pooled connection.
5. SQL 073 records only its real new APPLIED execution and a source/schema-bound attestation. It does not manufacture APPLIED 069–072 history or assume those files never ran.

## Exact manual SQL requiring approval

No new hosted SQL has been executed. No frozen file is modified. No additional 074 migration is needed for the read-only verifier changes.

- Review source: `purchase-backend/sql/manual/073_wici_observed_schema_recovery.sql`, SHA-256 `58122f8c2449dd50d37eaa229d9d622faf7be4e34d56848c999aec5a38285ca2` (unchanged from the reviewed preceding PR revision).
- Execute only the complete generated `purchase-backend/sql/operator-recovery/wici-production-recovery.sql` after review, never raw 073 or an ad hoc replay of 066/069–072. The updated R2 bundle binds the latest backend source manifest and uses a fresh application release reference, `wici-recovery-2026-11-07-r2`. Regenerate with the responsible operator's identity and final backend bytes; do not reuse an attested R1 reference for changed source.
- Separately approve the private `runtime-identity.sql` generated offline by `scripts/prepareRuntimeIdentity.js`. It creates a fresh NOINHERIT login and grants only membership in the existing bounded `purchase_backend` role. It does not alter `postgres`, rotate an existing password, modify business rows or upgrade `wici_release_reader`.

The 073 changes are: missing canonical 066/072 structures; 13 lossless quantity/conversion widenings; insert-only identifier aliases; duplicate-aborting journal uniqueness; four preserving FK actions; future-write retry/value-evidence checks; legacy direct-stock trigger containment; browser table-grant containment; required bounded backend object/sequence/extension usage grants. Monetary precision, RLS, existing histories and approval/financial authority remain preserved. Unknown partial structures or duplicate historical identities abort the transaction.

## Backup, staged rollout and recovery prerequisites

1. Keep PM2/workers stopped. Preserve the current server artifact (`70c4...` plus dirty-file status), private configuration, worker versions, schema/function/grant definitions and redacted reports. Validate server file hashes against the selected release; GitHub commit verification alone is insufficient.
2. Obtain an approved encrypted backup/PITR point and a verified isolated restore procedure. Record the maintenance window, responsible operator, database/project identity and restore point. Retain protected pre-change financial and warehouse reconciliation evidence: currency-specific AP/payment totals, allocations, posting counts, inventory balances and historical row identities. Do not upload financial/patient rows or credentials to the PR/chat.
3. Run the visibility-aware diagnostic with the reader. Keep its findings separate from the application-role assessment. If reader RLS prevents complete evidence, obtain an authorized read-only snapshot under an existing suitable administrative session; do not weaken RLS or silently grant the reader writer/BYPASSRLS authority.
4. Review/approve the PR and synchronize its backend subtree to the standalone backend repository. Stage the matching backend and locked manifest in `/var/www/wici-procurement/backend`, preserving unrelated `.env` settings. Keep PM2 stopped.
5. Generate the R2 bundle offline, inspect all statements/checksums, and have the authorized operator execute the approved transaction manually in Supabase SQL Editor. Any error is a stop/rollback condition; no deleting duplicates, hand-inserting receipts, or removing preflight/postflight is permitted.
6. Provision the new private runtime login manually. Use a direct or session-pooler endpoint, not transaction pooling. Review CONNECT access and role membership. Merge only approved connection/profile/release keys. Keep `postgres` available only for its authorized administrative purposes; do not globally demote/rotate it as part of this application cutover. Keep `wici_release_reader` read-only.
7. Run explicit runtime-mode verification using the **new actual application URL**, in a read-only transaction. Require current role `purchase_backend`, fresh non-owner session principal, no owner/DDL authority or release-evidence writes, full catalog visibility, genuine new receipt/attestation and zero findings. Existing RLS stays enabled; the established trusted backend BYPASSRLS architecture remains protected by server capability/institute checks.
8. Recheck sequence ownership for Goods Receipt/AP voucher generation and preserved financial/inventory evidence. Only then authorize a manual PM2 restart. Verify stable local health, login, required worker versions/leases, audit/outbox queues and controlled operational smoke tests. No Production posting/payment tests without separately approved fixtures.

If any stage fails, keep the backend/workers stopped, retain the failed report and transaction evidence, and use a reviewed forward correction. No destructive rollback, sequence reset, history-table drop, re-enabled legacy stock trigger, or schema-gate bypass is part of recovery. Restoring an older application requires a staged compatibility check against the already-migrated schema/worker protocols. A full database restore is a separate incident decision requiring quiescence and protection of changes after the backup point; never overwrite newer business activity automatically.

## Restart go/no-go

| Criterion | GO requirement | NO-GO examples |
| --- | --- | --- |
| Backup/review | Approved restore point, reviewed final source/SQL, named operator | No restore validation, mixed backend files, unexplained working-tree drift |
| Schema | Exact approved hosted target and complete catalog visibility | Missing 066, incompatible partial 072, unresolved grants/functions/types, hidden reference/evidence rows |
| Runtime identity | New bounded principal; current role `purchase_backend`; actual connection assessment | `postgres` application URL, reader URL, owner principal with SET ROLE, hypothetical `--backend-role` assessment |
| Release evidence | Real new 073 receipt and current source/schema/R2 attestation; unknown earlier history explicitly retained | Conflicting historical checksum, fabricated prior receipt, reused release reference bound to other code |
| Verifier result | `verification_mode=runtime`, `DATABASE_READY`, `restart_eligible=true`, no findings | Any BLOCKED result, diagnostic mode, incomplete snapshot or missing/unverifiable evidence |
| Preservation/operations | Financial/inventory comparison passes; serial dependencies correct; controlled smoke and worker checks approved | Changed historical values, duplicate identities, missing sequence dependency, unhealthy workers or queues |

`LIVE_ROUTING_ENABLED=false`; Approval Engine V2 and optional workflow rollout flags remain disabled. A green PR is test readiness, not approval to execute SQL, restart Production or merge/deploy automatically.

## Validation and limits

Tests exercise real disposable PostgreSQL with both absent and pre-existing SCOP, original command history, owner-role rejection, reader RLS, unknown ledger visibility, receipt checksum conflicts, rollback, restricted-role login and canonical receiving/inventory. Accounting regression tests enforce the retained AP two-decimal policy. Final executed counts/CI status are recorded in PR 105.

No live database compatibility claim is made. Full latest definitions, server bytes, reader attributes/invocation and business reconciliation still require the authorized operator's read-only verification. The numerical 1,357 reconstruction is an explicitly labeled hypothesis until those observations confirm it.
