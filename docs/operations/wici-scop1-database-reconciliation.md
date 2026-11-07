# WICI SCOP1 database reconciliation diagnosis

## Evidence and limits

This report compares the unchanged repository contract `hospital-erp-2026-11-scop1` against the operator-uploaded `wici-full-catalog.json`, SHA-256 `d669e14e15dfce8244fea9e290b8dc1ecb72b4640bd428ff71219f03d2658c2a`. It uses catalog metadata and function definitions, not Production business rows. No live database connection, hosted SQL execution, production mutation or restart was performed.

The operator now reports 1,138 startup findings and a stopped backend. Replaying `catalog.compare(expected.catalog, captured.catalog)` offline produces **1,247 catalog findings** against SCOP1. The earlier deployed 7C comparison reported 1,093 differences. These are different observations and must not be conflated. The current 1,138 cannot be reproduced from the older capture and current repository contract alone. Possible explanations include an intervening schema change, a different deployed contract/source or capture timing; none is established without the current complete verifier output and deployed file hashes.

Startup adds source-checksum, runtime-authority, migration-receipt and attestation findings to catalog comparison. A finding count is neither a count of missing tables nor proof that all listed objects require alteration. The captured diagnostic principal was `postgres`; that proves the capture identity, not the current stopped application's credentials.

## Reproduced offline categories

| Catalog group | Findings against uploaded capture | Interpretation |
| --- | ---: | --- |
| Relations | 50 | Seven missing canonical tables and 43 RLS differences |
| Columns | 358 | 68 missing columns; 290 existing-column discrepancies; type is one differing field in 264 of those |
| Constraints | 736 | 96 missing names and 640 definition/validation discrepancies; equivalent differently named constraints require relationship review |
| Indexes | 27 | Missing/different definitions; a name difference alone does not establish missing protection |
| Functions | 29 | Five missing functions; 24 differing definition hashes |
| Triggers | 7 | Missing/different triggers, including missing module guards and an extra active legacy stock trigger |
| Policies | 1 | Extra existing policy; evaluate effective grants and RLS rather than deleting it to match a reference |
| Browser table grants | 23 | Includes absent SCOP grant rows and extra hosted relation grants |
| Browser function grants | 12 | Includes missing new function grant rows and extra hosted routines |
| Permission definitions | 3 | Missing SCOP allocation permission codes; this is not authorization to assign them to users |
| UI resources | 1 | Existing demand-planning permission requirement is stricter than reference |
| **Total** | **1,247** | Offline capture comparison only; not the reported current live count |

### Genuine missing objects — verified in capture

- `contract_financial_reviews`, its 16 columns, preserving function/trigger and related constraints/indexes: canonical definitions are in SQL 066.
- SQL 072 tables: `scop_request_purposes`, `scop_fulfillment_policies`, `scop_requirement_profiles`, `scop_fulfillment_allocations`, `scop_allocation_evidence`, `scop_allocation_commands`.
- SQL 072 functions: `canonical_supply_line_quantity(integer,integer)`, `scop_guard_profile()`, `scop_guard_allocation()`, `scop_preserve_evidence()`.
- Related new-module columns, guards, permissions and object grants are missing as consequences of those absent structures; they are not hundreds of independent migration tasks.

Their absence in the current live database must still be confirmed with a new read-only report before applying any patch derived from this capture.

### Genuine incompatible columns/writes — reproduced locally

The hosted `goods_receipt_items.received_quantity` has type `numeric(14,2)`, while canonical receipt/inspection services support exact fractional quantities. The hosted-schema PostgreSQL fixture reproduced `0.1001` rounding before technical acceptance. The reviewed patch widens 13 operational quantity/conversion columns to canonical `numeric`. Existing stored values remain unchanged. Previously rounded historical values cannot be reconstructed from metadata and are not backfilled.

Hosted journal identifier aliases (`journal_entries.journal_number`, `journal_entry_lines.line_number`) are required, whereas the canonical writer supplies `journal_reference` and `line_no`. A global writer change broke the minimal canonical schema gate because those aliases do not exist there. The correction therefore belongs to the hosted schema: two BEFORE INSERT compatibility triggers supply only missing identifier aliases from canonical identifiers. The canonical writer remains unchanged. No second journal/payment posting or historical UPDATE is introduced.

Other column differences remain individually reviewed, not globally equivalent:

- Bounded varchar versus text/unbounded varchar can accept ordinary writes but reject longer inputs. Do not silently remove business length limits.
- Integer versus bigint differs in range. Assignment-compatible casts do not establish that all identifiers will fit.
- `numeric(14,2)` versus unbounded/six-decimal numeric differs in scale/range. Monetary columns are preserved pending explicit finance policy; operational quantity rounding has a demonstrated repair.
- Timestamp/date/time-zone differences require business interpretation. Automatic conversion could change historical meaning and is excluded.
- Existing generated `item_uom.name`, identity/default and NOT NULL differences require appropriate write behavior; they must not be removed solely to match the reference.

### RLS and constraints — verified metadata, qualified interpretation

All 43 RLS differences in this capture show hosted RLS enabled and reference RLS disabled. Do not disable hosted RLS. Preserve the existing trusted-server architecture, verify the restricted backend role, and retain API capability/institute checks.

Of 635 constraints differing in validation plus definition, **613 match exactly after removing only the reference's trailing `NOT VALID`: 591 foreign keys and 22 CHECK constraints**. Those are validated equivalents and stronger than the reference's validation state. The remaining 22 definition differences in this group are not certified by this simplification; inspect their real keys, relationships, delete actions and business semantics. The reviewed patch changes only four demonstrated destructive audit/journal/payment/outbox parent-delete relationships to `RESTRICT`, preserving records. Other text differences include non-deferrable NO ACTION/RESTRICT behavior and equivalent CHECK casts; CASCADE/SET NULL changes have substantive provenance consequences. Existing checks may also be stronger than a reference.

### Validator limitations — verified from code

`scripts/lib/databaseRelease/catalog.js` compares expected field values with exact JSON/string equality. `format_type()` output is treated as a contract string, not analyzed for assignment compatibility. `definition_md5` is compared exactly. This is deterministic drift detection, but it cannot classify semantic safety by itself.

All 24 captured differing pre-existing function bodies match reviewed canonical implementations after CRLF-to-LF conversion and removal of four exact RFID contract-marker comment lines. The proposed hosted profile retains their exact original hashes; it does not globally ignore function changes.

Safe correction is an explicitly reviewed, source-pinned hosted compatibility contract plus targeted SQL, retaining strict checking. A generic rule that treats all numeric, integer, varchar or timestamp variants as interchangeable would hide real incompatibilities. RLS differences should receive security-aware classification, never automatic relaxation.

`databaseReleaseService.CONTRACT_VERSION` still exports a stale 7C string, but startup loads the JSON contract through `loadContract()`; this unused export does not explain SCOP1 startup findings.

## SQL 072 and historical execution

**072 is required for the current SCOP1 backend contract.** Feature flags preserve old operational workflows, but do not remove required database objects from startup verification.

The migration header requires reviewed canonical 059/064–071 contracts and a governed 071 execution receipt. Its DO preflight checks the canonical receipt projection and release-control table. The registry/planner additionally requires `071_transactional_event_reliability` with the correct file checksum/environment and uses the 071 prerequisite contract. The prior governed chain is 069 → 070 → 071 → 072, with canonical 066/067/068 and supporting permissions/UI/contract structures already established.

`db:plan` is offline. A registered filename or successful manual SQL Editor run is not proof of an APPLIED receipt. `db:verify` intentionally requires explicit environment, release and `DB_RELEASE_READONLY_URL`, then runs in a repeatable-read read-only transaction. Startup also requires an attestation bound to the actual observed schema and application source manifest. Missing historical evidence must remain UNVERIFIED; do not manufacture old receipts.

The recovery proposal records only a real new forward execution, validates the already-observed earlier controls, and binds the resulting schema to the reviewed backend. This is an explicit new observed baseline, not a claim that old scripts were executed through the governed planner.

## Minimum safe restoration plan

1. Keep the backend stopped; preserve logs and verify an approved backup/recovery point. Record the deployed Git SHA, contract-file digest and release settings without exposing credentials.
2. Obtain a current complete read-only verifier report with explicit environment/release and a dedicated diagnostic URL. Reconcile its 1,138 findings against this older 1,247-finding capture; use the actual runtime principal for final acceptance, not a hypothetical `--backend-role` override.
3. Review the hosted compatibility profile and additive SQL in Draft PR 105. Preserve stronger RLS/validated keys, historical money, generated fields and existing business authority. Do not replay frozen 059–071 or run 072 blindly over missing prerequisites.
4. Once current metadata matches the reviewed preflight, stage the matching backend artifact, generate the source-bound SQL bundle offline, and have the authorized operator review/apply it manually. Missing structures and demonstrated quantity/identifier defects are corrected together, transactionally. Duplicate history or metadata drift aborts the patch without cleanup/backfill.
5. Provision/review a fresh restricted login through the private offline helper, retain unrelated environment settings, and verify actual-connection authority, current catalog, receipt and attestation read-only. Owner/DDL-capable application credentials remain blocked.
6. Only after `DATABASE_READY`, manually start PM2, verify the local listener/health, login, required workers, audit/outbox queues and controlled operational smoke tests. Obtain owner financial/inventory acceptance before declaring recovery complete.

No step requires disabling RLS, bypassing release validation, automatically executing hosted SQL, recreating populated tables, rewriting financial history or enabling optional approval/routing features. `LIVE_ROUTING_ENABLED=false`.

## Verification status

The recovery branch has passed 15 hosted recovery scenarios and all 43 receipt/inspection/inventory scenarios after the hosted-only trigger correction. The canonical schema gate now passes all 1,872 SQL plans with zero failures. The final full backend rerun passes all 233 suites / 1,982 tests. Canonical governance passed 31 scenarios locally and in the first CI run; final CI status is recorded in the PR. Draft PR 105 is **not** Production acceptance. Final test status must be taken from its latest commit/checks, not earlier green results.

Production compatibility, current migration receipts/attestation, serial sequence ownership, actual runtime identity and operational acceptance remain unverified. No claim of live compatibility is made by this report.
