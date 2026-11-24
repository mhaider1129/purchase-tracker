# Manual Development-only review and reconciliation

**MANUAL DATABASE MIGRATION REQUIRED only for individually approved, confirmed discrepancies.** The candidate files below are not permission to apply them or a complete release migration. SQL 073 is not automatically selected, replayed, or modified.

## Prerequisites and stop conditions

1. Owner independently opens the Supabase **Development** project `bcvfosxcyvarieiinovo`. Verify the browser project reference and connection identity against approved records. Never open Production for this procedure. Portable SQL cannot independently authenticate a Supabase project; transaction-local acknowledgment strings are review acknowledgments, not identity proof.
2. Capture an access-controlled Development backup using the approved Supabase backup/export process, including schema, roles/grants, sequences and all application data. Demonstrate restore capability to a separately authorized isolated target. Do not copy Production data. Save checksums, backup timestamp, recovery owner and maintenance window.
3. Review current application commit, report/provenance hashes, each candidate's exact bytes and its lock/storage impact. Do not paste connection strings, patient rows or credentials into issue reports. Confirm no concurrent schema changes or application writers during approved DDL. Stop if metadata differs from the reviewed shape.
4. Keep startup validation, RLS, release attestation and manual-only migration restrictions enabled. A successful candidate patch cannot certify the complete database.

## Read-only evidence first

In the independently verified Development SQL Editor, run [00_readonly_catalog.sql](patches/00_readonly_catalog.sql). This is a read-only repeatable-read transaction and returns metadata, not procurement/financial rows. Review object owners, role attributes/memberships, ACLs, extension identities and catalog definitions in the result. RLS or privilege-restricted visibility must be reported as unknown. Share only an appropriately restricted metadata export; role names and security configuration can be sensitive.

Then run [04_readonly_release_evidence.sql](patches/04_readonly_release_evidence.sql). It refuses to misrepresent absent/invisible evidence tables as empty execution history. Match actual receipts to original source checksums and independent change records. Neither script inserts receipts or attestations. A filename or successful partial patch is not historical execution evidence.

Reconcile actual definitions against the machine report and merged release contract. Verify exact array element types, fingerprint widths, column defaults/generated expressions, constraint validation states, RLS policies, grants, runtime role, missing objects and extensions before selecting changes. Any of the 168 unexported relations may already exist. Do not run the original context schema as a migration.

## Candidate selection and order

Each mutation file defaults to **BLOCKED before changes**. Only after its independent review, replace the two `REVIEW_REQUIRED` literals in its transaction with the Development project reference and the exact `APPROVED:<reportSha256>:<patch number>` value required by that file. Review the entire transaction; do not remove the guard, locks or postflight. GUCs are transaction-local so approvals do not leak into pooled sessions. Use one file/transaction at a time. A timeout, unexpected shape or permission failure means stop, retain the error and investigate; do not weaken checks.

| Order | Candidate and prerequisites | Postflight / limitations |
| --- | --- | --- |
| 1 | [01_widen_payload_fingerprints.sql](patches/01_widen_payload_fingerprints.sql): confirm the four existing ordinary fingerprint columns are character/varchar/text with no default/generated expression. Maintenance window, short lock timeout, capacity for table rewrite. | Four `text` types, unchanged row counts/business values, no fingerprint recomputation. Unknown old/truncated hash integrity remains unresolved. Repeat is a no-op for text. |
| 2, optional | [02_optional_requests_view_catalog.sql](patches/02_optional_requests_view_catalog.sql): authorization owner approves the new code's semantics. Confirm the permissions table's owned ID sequence is already safe. | Adds only absent code, no role/user grant, no ID rewrite or sequence reset. Behind/unsafe sequence aborts and requires separate review. Sequence allocation may leave normal gaps on failures. It does not fix custody policy. |
| 3, conditional | [03_conditional_contract_reviews.sql](patches/03_conditional_contract_reviews.sql): actual absence confirmed; canonical contracts/users/institutes and `guard_canonical_invoice_contract_source()` already exist. Existing immutable function must match canonical hash or abort. | New empty review-history table only; immutable triggers, RLS, strict shape/index/function checks; no backfill, postings, runtime-role grants or replacement of existing functions/tables. Default ACLs inconsistent with the constrained new-object policy abort. Runtime access requires a separate least-privilege review. |

Candidate 03 extracts a narrowly whitelisted foundation from frozen SQL 066 instead of re-running its financial migration. Existing table shapes or function deparser/hash differences can conservatively block it; retain that failure and compare actual PostgreSQL definitions. Do not blindly replace functions to satisfy an MD5.

## Forward release and acceptance

These candidates intentionally do not modify execution ledgers or issue attestations. Before application activation, the approved subset must be incorporated into separately reviewed, registered forward-only release governance with verified prerequisites and source digests. Existing SQL 069–072 execution requires genuine historical evidence, not a new receipt claiming it ran. SQL 073 remains manual recovery only. Resolve the stale demand-planning contract through a versioned contract review that preserves the current stricter authorization rule.

After approved changes, repeat both read-only captures and the complete governed verifier using its explicit Development environment/release, actual restricted runtime-role assessment and an independently configured read-only URL. Do not place URLs in shell history or this documentation. Review permission/RLS visibility, missing objects, all findings and attestation requirements. Zero selected patch errors is not zero release findings.

Only after the full compatibility and release-evidence gates pass may an authorized operator attempt local backend startup. Then test login, approved request lifecycle, institute isolation, procurement/receipt, warehouse, contracts and financial projections using controlled Development fixtures. Confirm no overlapping workers and no unauthorized external integrations. This task did not start the application against Development and cannot certify those tests.

## Recovery

An error before COMMIT rolls back the transaction's DDL/DML; do not assume sequence allocations roll back. Record the exact error and metadata and verify state before retrying. After COMMIT, prefer reviewed forward corrections; do not narrow fingerprint columns, drop review history, reverse financial entries or rewind sequences as an automatic rollback. Restore is a separately approved, tested backup procedure with application write coordination and documented data-loss implications. Preserve original and postflight evidence for audit.

Future releases: keep current evidence in dated directories, compare the entire merged application and governed contract, plan only registered forward migrations, rehearse in a separately authorized disposable database, obtain manual SQL approval, capture truthful execution evidence, verify compatibility and then perform local acceptance. Never edit historical hashes to make startup green.
