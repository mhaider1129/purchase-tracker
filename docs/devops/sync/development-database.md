# Development database reconciliation — operator review required

**Current disposition: BLOCKED pending a fresh Development-only catalog/evidence capture.** The owner reports 1,269 findings, missing `contract_financial_reviews` and `maintenance_stock`, and extensive RLS drift. These are user-reported observations, not an independently captured per-object finding set. No connection to either Supabase project was made in this task. No Development SQL, migration, grants, receipts or data changes were executed. Successful frontend compilation and database connection do not establish backend startup readiness.

Development project: `bcvfosxcyvarieiinovo`. Production project: `ytzvnbwrgvkkixtgnjcg` is forbidden. These are project identifiers, not credentials. The helper reuses the existing Development project constant from `scripts/lib/p2pBaseline.js` and the existing release verifier; its diagnostic mode accepts read-only users rather than the baseline collector’s owner-only binding. It accepts only Development direct TLS endpoint `db.bcvfosxcyvarieiinovo.supabase.co:5432` or a supported Supabase **session** pooler on port5432 with an explicit `.bcvfosxcyvarieiinovo` login suffix. Transaction pooler6543, arbitrary host aliases/tunnels, loopback, Production, URL query overrides and foreign project suffixes are rejected before connecting. TLS certificate/hostname verification stays enabled. If an endpoint naming scheme is unfamiliar, review and test a narrow allowlist change; do not broaden to arbitrary Supabase URLs.

The documented local startup guard also requires Development-only `SUPABASE_URL` when storage is configured, rejects unbound storage keys and requires Development/dry-run settings. It does not print or validate opaque key ownership; an authorized operator must supply Development-only keys.

Endpoint/TLS/pooler binding is not an independent Supabase Management API project attestation. The operator must independently confirm the Development dashboard/project, connection settings, role and backup destination. No Management API access or token is needed or supplied by this tool. The client then confirms session database, login/current actor and transaction read-only state. Never paste a URL/password/token into chat or a report.

## Read-only PowerShell diagnostic (exact commands)

Use Node22 LTS and dependencies installed with `npm ci` in `purchase-backend`. Update source through the reviewed combined PR process first so the new helper exists. Commands below neither start the application nor execute migrations. Run from a private terminal; output files contain schema/security metadata and should remain outside Git with owner-only Windows ACLs.

```powershell
Set-Location 'D:\WICI-Projects\purchase-tracker'
node --version
git rev-parse HEAD
git status --short
$reportDir = Join-Path $env:USERPROFILE 'WICI-private-diagnostics'
New-Item -ItemType Directory -Force -Path $reportDir | Out-Null
$release = Read-Host 'Exact Development application release reference being investigated (not a made-up attestation)'
$secure = Read-Host 'Development read-only PostgreSQL URL, explicit :5432/postgres, no query parameters' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $env:WICI_DEVELOPMENT_READONLY_URL = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    $report = Join-Path $reportDir ('development-canonical-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.json')
    node scripts/devops/development-db.cjs --profile canonical --mode diagnostic --release $release --output $report
    $diagnosticExit = $LASTEXITCODE
    Write-Host "Diagnostic exit: $diagnosticExit; report: $report"
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    Remove-Item Env:WICI_DEVELOPMENT_READONLY_URL -ErrorAction SilentlyContinue
    Remove-Variable secure -ErrorAction SilentlyContinue
}
```

The URL is not sourced from `.env`, `DATABASE_URL`, `DB_RELEASE_READONLY_URL`, PG environment fallbacks or the Production runtime. Remove dashboard connection-string query parameters before entry; the helper itself enforces TLS/read-only options. Do not turn off TLS checks for certificate errors. A `BLOCKED` diagnostic intentionally exits1 even if it sees no schema findings, because a reader connection cannot certify the actual runtime. Inspect the file only if it is complete valid JSON; an interrupted/failed capture can leave an empty file and always remains blocked. Choose a new filename rather than overwriting evidence.

The report includes selected contract, actual catalog, expected/observed definition pairs for findings, per-group totals, runtime authority, visibility, migration receipts and attestation returned by the existing verifier. It selects schema/reference/evidence metadata, not patient/procurement/payment rows or raw function bodies. Read-only transactions and a 60-second statement timeout apply. Windows does not implement POSIX mode0600: configure owner-only directory ACLs before capture and handle the report as private security metadata.

If a reader cannot see protected reference/evidence rows, `catalog_visibility` remains blocking. Do not disable RLS, grant writer/superuser/BYPASSRLS to the reader, or interpret hidden permissions as proved missing. An independently approved complete read-only assessment may be necessary. Retain both limited and complete captures with their identities.

## Evidence-based change plan (not an executable migration)

| Finding | Verified source evidence | Required Development decision / missing evidence |
| --- | --- | --- |
| Missing `contract_financial_reviews` (reported) | Canonical creator is frozen `sql/manual/066_contract_financial_reconciliation.sql`; reviewed recovery073 incorporates catch-up, with prerequisite `guard_canonical_invoice_contract_source()` from065 | Confirm actual absence versus visibility, canonical contract/invoice tables, types/FKs, role/security prerequisites and data ownership. Prepare only a reviewed additive forward patch; do not replay066 blindly or claim historical execution. |
| Missing `maintenance_stock` (reported) | Base definition is in `sql/View_Supabase_SQL.sql` (integer id/sequence, unique item_name, quantity default0, timestamp);059 explicitly stops when this base table is absent | Capture sequence/default/constraints/FKs, current references, RLS/role expectations and any legacy equivalent table/data before deciding additive reconstruction.073 does **not** create this table. Do not run the entire historical snapshot or create an empty substitute over unknown existing data. |
| Extensive RLS drift (reported) | Canonical contract and hosted observed/target profiles differ; verifier intentionally checks RLS/force-RLS and browser grants | Obtain exact per-table expected/actual rows. Keep stronger actual protections. Review intended role/institute isolation and policies; use only explicitly justified additive security corrections. Never disable RLS just to match a reference captured with RLS off. |
| Other columns/constraints/functions/permissions | No current full Development report supplied | Classification is unknown, not “all false positives.” Separate true incompatibility, visibility, type rendering, extension ownership/server-version issues and security/evidence gaps. Preserve strict existing comparator. Independent PG17 diagnostics are still pending canonical integration. |
| SQL069–073 receipts | Actual Development receipts/execution history not supplied | Check actual ledger plus trustworthy independent execution records and checksums. Missing receipt is not proof SQL was never executed. Do not insert fabricated receipts, rename release labels or silently replay historical DDL. |
| Attestation/runtime role | No actual runtime Development acceptance supplied | Review least-privilege role provisioning, exact current application manifest/contract fingerprint, environment `development` and genuine reviewed release evidence. A reader report or hypothetical role cannot authorize startup. |

This is the maximum safe plan supported by current evidence. A concrete per-object SQL patch and a claim that startup works would be premature. Share a redacted complete report through the approved private review channel; do not share credentials or business rows. Keep the original failure count and canonical/profile results distinct rather than choosing the smaller count.

## Applicability of SQL073 and existing operator bundles

SQL073 is **manual_recovery_migration**, not the normal canonical automatic plan. It requires reviewed observed-profile preconditions, existing069–071 controls and release tables, the065 contract-finance guard, and the reviewed `purchase_backend` role (including its specifically reviewed privilege model). It checks duplicate journal identifiers before new uniqueness controls, preserves paid amounts, widens operational quantity types, adds missing reconciliation/SCOP controls, contains the legacy stock trigger and changes browser grants/deletion behavior. Those security/schema changes can impact existing Development workflows and require review and backups, even without deleting business rows.

The current `sql/operator-recovery/wici-production-recovery.sql` is bound to **environment production**, a particular observed schema and a historical application/source reference. **Do not execute it in Development, substitute its environment text or reuse its attestation.** It neither fixes a missing maintenance base table nor demonstrates that this Development project matches its preflight. Do not run `prepareRuntimeIdentity.js` or old recovery deployment scripts as a shortcut.

Only if a new Development capture proves the same reviewed profile is appropriate may an operator prepare a **new separately named, source-bound Development bundle** using the existing offline generator, `environment=development`, genuine release reference and explicit profile. Independently review its entire preflight/SQL/postflight, immutable hashes and SQL073 prerequisites. The generator computes SQL; it does not prove prerequisites or authorize execution. Do not register, generate or apply such a bundle merely to reduce findings. Canonical plan072 alone also does not repair these reported missing base/contract objects. No new SQL or source-attestation change is included in this PR.

## Backup, manual change and recovery gates

1. Development owner confirms project identity in dashboard and records approved endpoint, roles, current app commit/reference, report/profile/digests, maintenance window and change owner. Disable local app/workers **on the developer machine only** during manual reconciliation; no Production/recovery process action.
2. Take an encrypted, access-controlled Development-only backup with compatible PostgreSQL tools, including schema/data, roles/grants policy evidence, sequences and migration/attestation ledgers. Verify backup integrity and restore into a **new isolated disposable database**. Record restoration and row/financial totals; existence of a dump file alone is insufficient. Never overwrite/reset the live Development database to test restore, and never copy Production data.
3. Review every discrepancy and data-preserving forward patch. Check populated compatibility, orphan/duplicate prerequisites, institute boundaries and application effects in the disposable restore. Preserve original frozen SQL bytes and all existing105 artifact hashes. Add new registered migrations/source bindings only through a separate reviewed change if actually necessary.
4. Obtain explicit authorization for the exact Development change set and operator. This request authorizes diagnostics/planning, **not automatic database changes**. Apply only approved new forward-only SQL manually to confirmed Development, with timeouts/transaction boundaries and verified prerequisites. No historical execution evidence fabrication; capture actual execution results. Keep manual073 manual.
5. Capture canonical (and only if justified explicitly selected hosted profile) postflight again; verify actual runtime identity separately. Require all schema, RLS/grants, permission, role, genuine migration evidence and source/schema attestation checks to pass. Preserve unresolved findings instead of bypassing them.
6. Roll back application code only to a separately verified schema-compatible release. Do not assume additive DDL has a safe reverse SQL migration. On failed preflight/transaction, stop and assess whether it rolled back completely. On committed incompatible changes, keep backend stopped and use reviewed forward correction; recovery from backup requires a separately approved restore/cutover that preserves subsequent Development writes. Never reset or truncate in this workflow.

## Actual-runtime postflight and local startup

After the operator has completed separately reviewed reconciliation, use an independently supplied **actual application login URL** for the same Development project. No role/password is created by these commands. If the actual approved local app explicitly sets `DB_RUNTIME_ROLE=purchase_backend`, include `--runtime-role purchase_backend`; otherwise omit it. Do not test a hypothetical more privileged role.

```powershell
Set-Location 'D:\WICI-Projects\purchase-tracker'
$reportDir = Join-Path $env:USERPROFILE 'WICI-private-diagnostics'
$release = Read-Host 'Exact reconciled Development application release reference'
$secure = Read-Host 'Actual Development runtime login URL, explicit :5432/postgres, no query parameters' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $env:WICI_DEVELOPMENT_RUNTIME_URL = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    $report = Join-Path $reportDir ('development-runtime-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.json')
    node scripts/devops/development-db.cjs --profile canonical --mode runtime --release $release --output $report
    if ($LASTEXITCODE -ne 0) { throw 'Development runtime remains BLOCKED; do not start backend' }
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    Remove-Item Env:WICI_DEVELOPMENT_RUNTIME_URL -ErrorAction SilentlyContinue
    Remove-Variable secure -ErrorAction SilentlyContinue
}
```

If the approved profile is explicitly `wici-2026-11`, change only the profile selection after its prerequisites and review are satisfied; keep environment fixed to Development. The helper calls the existing canonical service with `requireEvidence=true` defaults, and can never use a diagnostic result for restart. It does not start workers or modify the DB. Follow the [local guide](local-development.md) only after DATABASE_READY and restart_eligible=true. Then independently verify loopback HTTP health, login, permissions/institute boundaries, request/priority/procurement/warehouse/contracts/finance workflows, logs, worker behavior and data preservation with Development users. These startup/browser checks have **not** been executed against the reported database by this task.

## Repeatable future release procedure

For every application release: merge reviewed canonical changes → run local/synthetic CI → pin actual application reference/manifest/contract → capture Development-only read-only compatibility evidence → review migration requirements and backup restore rehearsal → separately approve/apply only necessary additive changes → actual-runtime postflight → local startup/browser validation → controlled synchronization review. Never use Development readiness as Production compatibility or deployment approval. Keep a private evidence ledger of actual operations, source hashes, approvals and recoverability; do not manufacture old migration receipts to fill gaps.
