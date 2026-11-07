# WICI backend startup incompatibility — 7 November 2026

Status: diagnosis based on operator-provided PM2/Nginx logs and schema metadata. No hosted database access or mutation by this review. A targeted recovery is being verified in disposable PostgreSQL; Production recovery remains an operator-controlled action.

## Confirmed failure chain

Nginx reports connection refused to `127.0.0.1:5000` for login. PM2 repeatedly restarts the backend with approximately one-second uptime. The application connects to PostgreSQL, then reports `DATABASE_RELEASE_INCOMPATIBLE` before it starts the HTTP listener. Neither incorrect login credentials nor the frontend Axios stack explains this failure. The secret-rotation reminders are non-blocking warnings.

The operator reports manually executing SQL 067, 068, 069, 070 and 071 before deploying application PRs 97–101. The subsequently inspected deployment reports Git SHA `2b4267c5f41d500488ab8732c64de2e84c90fbd7`, contract `hospital-erp-2026-11-7c`, and active delta 071. This SHA could not be fetched from the configured repository remote; it must not be represented as a verified upstream release identity.

The timeline requires two investigations: the original migration/application compatibility boundary, and the current startup-gate failure. Current logs prove the latter; they do not prove which earlier migration first caused the outage.

## Uploaded comparison

The read-only catalog diagnostic reports 1,093 differences. Startup reports 1,102 findings and also checks runtime authority, release receipts and attestation. The two captures were made at different times; the additional findings must be obtained from the full release verifier rather than attributed without evidence.

| Group | Count |
| --- | ---: |
| Relations | 44 |
| Columns | 306 |
| Constraints | 686 |
| Indexes | 13 |
| Functions | 25 |
| Triggers | 2 |
| Policies | 1 |
| Browser table grants | 11 |
| Browser function grants | 4 |
| UI resources | 1 |

The initial export contained differences only. The subsequently supplied full catalog and function definitions permit the semantic checks below; neither capture contains business-row evidence. Missing named constraints may have equivalent differently named constraints.

## Reference-contract false positives and stronger controls

- The initial comparison contains 613 findings involving foreign-key validation. This field difference alone does not prove equivalent relationships: the later SCOP1/full-capture review verifies 591 definitions as exact equivalents after removing only reference `NOT VALID`. Making these keys unvalidated to match a reference is not a valid repair.
- Exactly 43 relation findings show RLS enabled in the observed database and disabled in the reference. Do not disable RLS to clear the report. Backend role/bypass and browser-grant behavior still require verification.
- Column differences include bounded numeric and character types versus unbounded reference types, identity versus sequence-default representation, and an existing generated `item_uom.name`. These require semantic review: bounded precision, generated-column writes and timezone changes can affect valid application operations. They are not all harmless and must not be globally ignored or blindly converted.
- A stricter `feature.demandPlanning` permission requirement exists in the observed database where the reference lists no required permissions. Do not erase it just to obtain a matching fingerprint.

These observations establish that exact equality with the synthesized/reference schema is not, by itself, a safe production migration plan. A corrected compatibility contract must be explicitly reviewed and tested, not implemented as a switch bypassing all readiness checks.

## Genuine or unresolved prerequisites

The `contract_financial_reviews` table, its 16 columns, append-only guards, indexes and preserving trigger function are absent. Their canonical implementation exists in frozen SQL 066. This is concrete evidence that numbered execution of 067–071 did not establish all prerequisites. SQL 069 documents dependencies through 066, but its initial DO block checks only completion function existence from 067/068; it cannot certify the entire prerequisite schema.

The full capture resolves the following review areas; the selected repair and preserved differences are documented in [the recovery runbook](wici-database-recovery.md):

- Invoice-identity index expression and serial-location uniqueness.
- Approval route-step uniqueness (observed key is stricter/different).
- Notification recipient/outbox foreign-key delete semantics.
- Financial-value verification and other check constraints.
- Function bodies governing audit immutability, inventory posting, RFID history, cutovers, organization ownership and technical/financial linkage.
- Additional browser grants on legacy/extra relations and a catalog SELECT policy. Some grants may be excessive, but effects of RLS and consumers must be reviewed before changing them.

There is no evidence from this metadata alone of lost or corrupted financial/inventory records. Do not backfill, reverse, repost, delete or rewrite history.

## Why executing database SQL before application rollout matters

SQL 069 changes schema/function/table/sequence grants and creates the restricted backend role. Existing code using runtime schema initialization or different credentials can fail after this change. SQL 070 installs a new RFID attempt/lease protocol. SQL 071 installs durable external-delivery state, recipient/outbox relationships and an immutable cutover marker. A writer/worker cannot be assumed compatible merely because all migration files execute successfully.

An offline `db:plan` listing 071 is a plan for the declared active delta. It is not proof that prior migrations were applied, the database matches their intended contracts, the runtime role is suitable or the exact application source has a valid attestation.

## Recovery constraints

1. Preserve logs and take an operator-approved backup with verified recovery capability before any changes. An authorized operator may stop the already failing PM2 process to contain the restart storm; that does not restore login.
2. Capture the full catalog, function definitions, runtime-role findings and release evidence read-only. Exclude business/patient rows and credentials.
3. Compare real constraints/functions with the reviewed canonical services. Preserve stronger RLS, valid foreign keys, history, generated values and historical financial precision.
4. Prepare separately reviewed corrections: actual missing canonical module(s); genuinely unsafe grants/constraints; and a production-compatible backend contract with meaningful regression tests. Do not fabricate historical migration receipts or attest an unreviewed schema merely to start the process.
5. Test the exact observed schema variant and populated preservation scenarios in disposable PostgreSQL, including old/new application compatibility at each cutover. Keep ordinary release gates enabled.
6. Restore only a reviewed compatible release/database pair, manually. A last-known-good application rollback must first be checked against the already changed database; blindly redeploying older code is unsafe after permission/worker cutovers.
7. Require database readiness, the actual HTTP listener and local `/health` before retrying login. Revalidate queue/worker/audit behavior and controlled financial/procurement smoke tests. PM2's transient `online` label is insufficient.

No blanket SQL rewrite, RLS disablement, schema destruction, startup-gate bypass, forced attestation, historical backfill, automatic deployment or automatic merge is authorized by this diagnosis. The guided-request feature is a separate local change and is not a recovery mechanism.

Input comparison report SHA-256: `97e97baf0dc7923f6233a3530eb8e453796ca0c65044b714412f6d7cd721ebab`. Full observed catalog/function capture SHA-256: `d669e14e15dfce8244fea9e290b8dc1ecb72b4640bd428ff71219f03d2658c2a`. No hosted SQL has been executed by this review.

All 24 differing pre-existing function bodies match the canonical implementation after accounting for CRLF line endings and four exact RFID contract-marker comments. Production verification continues to pin their original hashes. The full capture identifies a disabled-by-recovery legacy stock-proposal trigger, additional browser table grants, missing 066/072 structures and legacy non-null journal aliases. Existing generated values, validated foreign keys, RLS and financial precision are preserved. Disposable receipt tests additionally reproduced two-decimal rounding of four-decimal quantities; the repair widens 13 operational quantity/conversion fields without changing their stored values. The captured connection principal is `postgres`; a fresh restricted login and verified role initialization are part of the manual recovery, rather than running the application as the database owner.

For the current SCOP1 count, evidence categories and minimum restoration sequence, see [the categorized reconciliation diagnosis](wici-scop1-database-reconciliation.md).
