# Development schema reconciliation — 24 November 2026

Status: **REVIEW CANDIDATES ONLY; DATABASE COMPATIBILITY NOT CERTIFIED.** No database was contacted and no SQL was executed. Do not apply this package to Production.

Continuation: [startup-triage.md](startup-triage.md) uses newly supplied required-object/release-ledger results: two missing relations, 38 missing columns, empty ledgers. The full catalog remains unavailable. It separates these operator-reported findings from the earlier incomplete export, confirmed code/contract conflicts and reproduced comparator behavior. No unconditional mutation approval is made.

The application baseline is merged master `180ea21c2d8bf233457a6ef6c6ede4bfceea0886`. The observed input is commit `7a896cbe23c3708fb2e183f65df96389151eaffc` on `review/development-schema-20261124`. Pending draft PR #113 at `9c1bbb7ef43be8f1c2a5a3b9eb9c0c1a7e94520e` was reviewed for development diagnostics, project identity and release-governance proposals. It is **unmerged**, supplies no execution evidence, and is not promoted into the merged application requirements here.

## Evidence and governance

The supplied three files are context exports, not executable backups or complete PostgreSQL catalogs. Their exact incoming bytes are preserved in [observed/](observed/). [provenance.json](provenance.json) records original paths, observed hashes and restored historical hashes. The original three `purchase-backend/sql/` paths were explicitly restored to master bytes because all three are locked `export_snapshot` artifacts. They are also bound through `docs/database-audit/current/contract-refresh.json`; integration fixture generation and contract-refresh/schema-reconciliation runners consume those historical paths. Organization/item-master tests consume the schema snapshot too.

Changing those historical paths in place would invalidate the 105-artifact manifest and alter historical fixture behavior. No historical checksum, migration SQL, fixture, schema contract or source manifest was regenerated. Future observed evidence belongs in dated review directories. A future executable change needs a separately reviewed forward migration and release contract, not an edited historical snapshot.

[reconciliation.json](reconciliation.json) is the reproducible full worklist, including source hashes, source locations, definition sources, SQL references, unresolved dynamic SQL, schema comparison and permission consumers. It is bound to all 718 inspected backend/frontend source files and the merged contract. The auditor fails if those runtime bytes differ from the baseline. It does not import the application, load environment secrets, execute SQL or connect to a database. Reproduce from the repository root:

```text
node scripts/devops/development-schema-audit.cjs
node scripts/devops/development-schema-patches.cjs
node --test scripts/devops/development-schema-audit.test.cjs
node scripts/devops/integrity.cjs --base 180ea21c2d8bf233457a6ef6c6ede4bfceea0886
```

Regeneration must produce an identical report and SQL. The report digest excludes its own digest field. It is source evidence, not a database release attestation.

## Findings

The table below describes the **original context export**, not the later required-object results. Those later results supersede its existence assertions; in particular `maintenance_stock` and 38 columns are reported missing. Use [startup-triage.md](startup-triage.md) and `evidence/` for the current findings and partial, individually guarded candidates. Do not treat this historical export analysis as current live compatibility evidence.

For the complete human-readable list of unexported required relations, see [missing-relations.md](missing-relations.md), including backend query references and registered CREATE sources where resolved. [required-object-check.sql](required-object-check.sql) can be pasted unchanged into the independently confirmed Development SQL Editor: it checks all 268 required relations and 3,604 column identities, not merely the latest migration. It is read-only; empty results do not certify types, permissions, RLS or release readiness.

| Area | Verified from supplied bytes / merged code | Safe response |
| --- | --- | --- |
| Schema coverage | 100 exported tables versus 268 canonical relations and 3,604 columns. 168 relations are absent from the export. No missing canonical columns or nullability differences within the 100 supplied tables. | Absence from this file does not prove absence from the database. Obtain read-only metadata before considering creation. |
| Fingerprints | `ap_vouchers`, `goods_receipts`, `payment_records`, `supplier_invoices`: `payload_fingerprint` exported as `character`, expected `text`. | Candidate 01 widens recognized ordinary columns only. Verify actual types/typmods first. Existing truncated hashes cannot be reconstructed. `bpchar::text` removes padding; review this storage conversion and lock requirements. |
| Array types | `governance_audit_trail.required_permissions` and `ui_resource_permissions.permissions` are bare `ARRAY`. | Element types cannot be inferred from this lossy export; no automatic cast. |
| Export anomalies | Two conversion-factor constraints end with `NOT VALI)`; `item_uom.name` has context-only `DEFAULT uom_name`. | Not runnable SQL. Determine actual constraint validation and generated/default expressions from PostgreSQL; do not reconstruct or drop them from this text. |
| Permissions | All 157 canonical codes are present; merged core definitions, role defaults and capability matrix are covered. | No bulk permission seeding or broad role grants. Role/user assignments, active identities and scopes are not supplied. |
| Backend authorization | `services/procurementCompletionService.js:74` uses undefined catalog code `requests.view` within existing institute/scope guards. | Candidate 02 is optional metadata-only, subject to authorization design review. No automatic role assignment. |
| Frontend authorization | `FixedAssetsWorkspace.jsx:18` references undeclared `custody.create`; backend custody creation is warehouse-role controlled and asset APIs use fixed-assets permissions. | Application-policy alignment required; do not invent a broad database permission/grant to hide the mismatch. |
| UI resources | All 37 observed UI rows match merged `uiAccessService.defaultResources` permissions/require-all behavior. | Preserve them. |
| Release contract conflict | Observed and merged `feature.demandPlanning` require one of `planning.view`, `planning.manage`, `replenishment.manage`; locked contract expects an empty list. | **Release blocker.** Preserve the stricter observed rule. Separately version/review the contract against the merged authorization policy; do not empty the database rule or silently regenerate the lock. |
| Contract review history | `contract_financial_reviews` absent from export; authoritative foundation is merged SQL 066. | Candidate 03 creates only a missing empty foundation, with strict prerequisites, immutable evidence triggers, RLS and no runtime grants. Existing objects are inspected, not replaced. Confirm actual absence first. |
| Maintenance inventory | `maintenance_stock` is present in this observed export. | Do not recreate it or transfer/reseed stock based on earlier error messages. |
| Tracking/security | No complete RLS, policies, role grants, indexes, functions, triggers, migration receipts or release attestations are supplied. | Unknown, not compatible. Missing receipts are not proof a migration never ran. Never replay SQL 069–073 wholesale or fabricate receipts. SQL 073 stays manual-only. |

## Whole-application trace

The scan covers 436 backend and 282 frontend runtime files, not just SQL 072/073. It extracts 2,680 backend SQL literals, of which 2,215 are direct query-call literals, and records 5,990 CREATE/ALTER source references across registered merged manual SQL. There are 914 uncertainty entries: 465 indirect literals and 449 interpolated SQL expressions. These require targeted review; static extraction is not proof that every dynamic query is compatible. Alias/qualified-column and unclassified relation worklists remain explicit. Unknown calls are never counted as compatibility passes.

| Application boundary | Existing authority reviewed | Remaining verification |
| --- | --- | --- |
| Requests / approvals / SCOP | Canonical requests, requested-items, approvals, allocations; route/permission middleware, completion projections and SQL 067/068/072 | Actual functions, RLS, role privileges, institute scopes and migration evidence |
| Procurement / RFx / PO / receipt | Existing procurement services, PO source references, accepted-receipt and inspection ownership | Constraint definitions/validation, receipt fingerprints and transactional acceptance functions |
| Warehouse / assets / RFID | Canonical inventory services, stock tables, custody/asset permissions, worker governance | Runtime grants, warehouse/institute isolation, worker migration/evidence; no inventory reconstruction |
| Contracts / reconciliation | Canonical contracts, financial review history and SQL 066 | Review table presence, trigger/function identity, authorized runtime access |
| Invoices / AP / payments | Canonical supplier invoice, vouchers, payables, payment records/allocations | Actual financial numeric types/defaults/functions/constraints and fingerprints; no financial backfill |
| Reporting / UI / authorization | Frontend capability consumers, core permission definitions, default resources and role defaults | User/role assignments and stale contract rule above; UI filtering alone is not authorization |

Constraint names in the context export cannot certify all 1,567 canonical constraint definitions or their validation state. Canonical indexes (710), functions (221), triggers (31), RLS and ACL checks remain unverified. Extra observed contract-institute and PO-contract references are retained as evidence, not removed to force contract equality. Use the machine report's source locations to trace individual discrepancies.

## Delivery boundaries

See [operator-runbook.md](operator-runbook.md) before any manual action and [validation.md](validation.md) for test evidence. Review SQL is deliberately outside migration discovery in `docs/`; it is not registered execution history. No AP posting, payment creation, settlement edit, stock adjustment, historical paid-amount update, role change or UI-policy weakening is proposed.

Full local startup remains **BLOCKED/UNVERIFIED** until real Development metadata, runtime privileges, migration history and the versioned contract conflict are resolved through existing governance. No hosted runtime success, Windows execution or production readiness is claimed by this offline audit.
