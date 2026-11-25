# Operator handoff: capture Development, then stop for review

**No migration or backend startup is authorized by these commands.** The existing database is `wici-procurement-dev`, project `bcvfosxcyvarieiinovo`. Production `ytzvnbwrgvkkixtgnjcg` is rejected before any driver/connection. No Docker is required for this capture or for ordinary future local application development.

The helper currently lives in draft PR113, not master. Review that source before using it. Preserve any local edits and use a clean reviewed feature-branch checkout, or wait for an independently approved merge and then update master. Do not merge merely to obtain diagnostics. Do not copy a few scripts between repositories, use a Production environment file or run `deploy.sh`.

## One consolidated read-only command (PowerShell 5.1/7)

Use supported Node 22 LTS (CI also checks Node 20). In `D:\WICI-Projects\purchase-tracker`, inspect source state. Install with existing backend package lock only:

```powershell
Set-Location 'D:\WICI-Projects\purchase-tracker'
git status --short
git rev-parse HEAD
node --version
if (-not (Test-Path 'scripts/devops/development-db.cjs')) {
    throw 'Reviewed PR113 diagnostics are not present in this checkout. Stop; do not use another database tool as a shortcut.'
}
Push-Location purchase-backend
try {
    npm ci
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed' }
} finally { Pop-Location }
```

If `APP_RELEASE_REF` is not configured, the actual full `git rev-parse HEAD` is a valid **investigation reference** for the prompt below. Its attestation will be missing; this does not fabricate or establish a release. No ledger or attestation is inserted.

Use an existing authorized metadata reader. If none exists, an approved Development owner can perform this explicit read-only diagnostic using its own private connection; the report will identify it as owner/assessment identity, never application-runtime acceptance. Do not create a reader or grant BYPASSRLS simply to run this capture. It deliberately does not load `.env` or fall back to any existing `DATABASE_URL`/`DB_RELEASE_READONLY_URL`.

```powershell
Set-Location 'D:\WICI-Projects\purchase-tracker'
$reportDir = Join-Path $env:USERPROFILE 'WICI-private-diagnostics'
New-Item -ItemType Directory -Force -Path $reportDir | Out-Null
$account = [Security.Principal.WindowsIdentity]::GetCurrent().Name
icacls $reportDir /inheritance:r /grant:r "$($account):(OI)(CI)F" | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Private report directory ACL setup failed' }
$release = Read-Host 'Exact Development application reference being investigated (not a fabricated attestation)'
$secure = Read-Host 'Authorized Development PostgreSQL URL; explicit :5432/postgres; no query or fragment' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $env:WICI_DEVELOPMENT_READONLY_URL = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    $report = Join-Path $reportDir ('development-full-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.json')
    node scripts/devops/development-db.cjs --profile canonical --mode diagnostic --runtime-login wici_development_runtime --verification-login wici_development_reader --release $release --output $report
    $captureExit = $LASTEXITCODE
    if (-not (Test-Path $report)) { throw 'No report generated; investigate the blocked diagnostic' }
    $result = Get-Content -Raw -LiteralPath $report | ConvertFrom-Json
    Write-Host "Exit=$captureExit; project=$($result.project); required evidence complete=$($result.supplemental.complete); context complete=$($result.supplemental.contextComplete); canonical findings=$($result.canonicalFindingCount); report=$report"
    if (-not $result.supplemental.complete) {
        Write-Warning 'Partial visibility or unavailable supplemental metadata. Preserve report; no compatibility/startup acceptance.'
    }
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    Remove-Item Env:WICI_DEVELOPMENT_READONLY_URL -ErrorAction SilentlyContinue
    Remove-Variable secure -ErrorAction SilentlyContinue
}
```

Expected diagnostic exit is 1 and status BLOCKED even if the schema comparison reports 0: the reader/owner assessment is not actual runtime verification. Parse the report only when it is complete valid JSON. Driver/connection/write failures may leave no file or an empty file, always blocked. Existing files are never overwritten. No application startup, scheduled job, mail, external integration or migration is invoked.

The canonical service also reports runtime-privilege findings for the connection it assesses. In diagnostic mode that is the reader/owner, not proof of the actual application login. `runtimeAssessmentScope` makes this explicit. Do not grant DML or BYPASSRLS to a reader to clear those findings; review the separately labeled target-role context and later the genuine runtime connection.

The proposed login arguments select **inventory labels only**; they create no roles, perform no SET ROLE and are not assumed present. Adjust labels only to actual independently reviewed role names. All role attributes/memberships are included to discover existing candidates. CLI runtime mode and its narrowly permitted `--runtime-role purchase_backend` are separate actual-runtime postflight tools, not substitutes for diagnostic capture or role review.

For direct connections use `db.bcvfosxcyvarieiinovo.supabase.co:5432`, or the authorized session pooler with login suffix `.bcvfosxcyvarieiinovo` and port 5432. Transaction pooler 6543, custom host aliases, localhost, other projects and URL overrides are rejected. Verified TLS is mandatory; resolve trusted certificate/IPv6 connectivity issues using approved provider guidance, never disabling verification. Endpoint/TLS/pooler identity still requires independent confirmation against the Development dashboard, not a claim of cloud API attestation.

The report contains private security/schema metadata. Do not commit or publicly attach it. Share the redacted report through the authorized private review channel; never share connection URLs, passwords, tokens, business records or patient data.

## Handoff evidence required

Return the capture source commit/digest, actual version/session/role, selected profile, visibility, per-group/category counts and complete expected/actual findings, especially for the two missing relations and RLS/grant differences. Preserve full private originals and backup identity. Zero rows hidden by RLS are not proof a ledger is empty. Provider legacy history can remain unknown in `contextGaps`; this does not justify broader runtime/reader privileges. Required application evidence remains blocking when unobservable. The helper explicitly labels unavailable evidence and never creates missing receipts.

`canonicalFindingCount` preserves the original verifier count; extra capture failures are separately counted. Profile comparisons and possible representation issues stay unapproved/blocking review context. Do not pick the profile with the smallest count. After capture, **stop at independent review** of [database-assessment.md](database-assessment.md). There is no executable recovery bundle yet.

## Later local workflow, after separate remediation approval

1. Preserve local edits; update the reviewed combined source with `git switch master` and `git pull --ff-only origin master` only in a clean developer checkout. Record exact source/reference.
2. Confirm Node 22, run backend/frontend `npm ci`, and keep real configuration privately outside Git. [runtime.env.example](runtime.env.example) is an incomplete template, not a runnable setup.
3. Capture Development project/schema/role/release evidence with the command above. Review the offline `npm run db:plan` from `purchase-backend`; it does not prove any migration is safe or missing. Do not pass `--output` to generate SQL as a shortcut.
4. Follow backup/isolated rehearsal/forward correction/explicit approval gates in the assessment. Ordinary application use can continue using Development Supabase; a disposable runner is only for approved rehearsal.
5. Resolve the application's TLS pool and unconditional-job containment before startup. Mail dry-run alone is insufficient; no general worker-disable setting currently exists. No startup is claimed now.
6. Actual-runtime postflight must use the genuine dedicated login, explicit Development environment/profile and matching current source/schema attestation. No hypothetical-role acceptance, forged evidence, RLS relaxation or owner runtime.
7. Only after those gates pass, start loopback backend through reviewed existing startup, then frontend with `HOST=127.0.0.1`, `PORT=3000` and local API base. Verify health/login/permissions, approvals, procurement, warehouse, contracts/finance, cross-institute isolation and priority-workspace behavior using approved Development-only data. These HTTP/browser checks remain pending.
8. Run canonical backend/frontend quality gates; only after local acceptance request controlled synchronization approval. Publishing, staging and Production approvals remain separate and disabled by this work.

No database migration is included in this handoff. A proposed future correction must be based on the captured schema, preserve Development data and frozen SQL, and be reviewed before any execution.
