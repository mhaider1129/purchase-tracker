# WICI database/application recovery

This package addresses the startup failure that leaves Nginx returning 502 for login. It does not deploy itself. The operator must review the PR, verify a backup/recovery point, and execute the approved SQL manually. Do not rerun SQL 067–071 as a substitute for this procedure.

## Findings and scope

The uploaded catalog is tied to SHA-256 `d669e14e15dfce8244fea9e290b8dc1ecb72b4640bd428ff71219f03d2658c2a`. It reports a diagnostic connection as `postgres`. The current application gate deliberately refuses an owner/DDL-capable runtime connection.

The reference and hosted schemas are not byte-identical:

- 613 foreign keys are validated in the hosted database where the reference expects `NOT VALID`. 43 hosted tables have RLS enabled where the reference does not. These controls stay in place.
- All 24 differing existing function bodies match the reference after only CRLF-to-LF conversion and removal of four exact RFID version-marker comment lines. Production function hashes are still checked exactly against the reviewed hosted profile; the gate does not ignore arbitrary function changes.
- Existing bounded monetary/string types, timestamp types, identity columns and the generated `item_uom.name` remain unchanged. Thirteen operational quantity/conversion columns are widened to canonical `numeric` because the receipt suite reproduced silent rounding of `0.1001` in two-decimal fields; existing numeric values are preserved. No historical conversion, rounding or timezone inference is performed.
- The financial reconciliation table/function from 066 and the six operational foundation tables/four routines from 072 are missing. The latest approved backend requires them, even when optional business features remain disabled.
- A hosted legacy trigger on `stock_item_requests` attempts to increment stock on catalog-request approval, outside canonical inventory posting. Recovery disables this trigger; it does not replay, reverse or recalculate past effects.
- The canonical journal writer omitted required legacy identifier aliases (`journal_number` and `line_number`). The backend now supplies both identifiers for new entries; it does not rewrite old journal data or create a second posting.

## What the repair changes

The canonical contract remains the default. `DB_RELEASE_SCHEMA_PROFILE=wici-2026-11` selects an explicit, source-checksummed hosted contract. It is bound to the unchanged canonical contract and the reviewed uploaded observations. An unknown profile or changed base contract fails closed. Turning this flag on alone cannot start an incompatible backend.

Forward SQL 073:

1. Creates the missing canonical reconciliation/operational structures using reviewed 066/072 definitions. It records no legacy reconciliation decisions and enrolls no historical requests.
2. Preserves existing RLS, generated columns, monetary precision and validated references. Removes only the 13 operational quantity/conversion typmods that round new canonical receipt/inspection evidence; it never reconstructs previously rounded historical quantities.
3. Adds canonical journal reference/line uniqueness after checking for duplicates. Duplicate history aborts the entire transaction; no records are deleted or merged.
4. Replaces four destructive parent-delete relationships with `RESTRICT` for journal/audit/payment/outbox provenance. Audited or financial parent records must be retained or archived instead of hard-deleted.
5. Adds future-write checks for retry counts and verified cost-avoidance evidence, using `NOT VALID` to preserve existing records requiring investigation.
6. Disables the legacy direct-stock trigger and revokes direct browser/PUBLIC table access. Existing reviewed function execution permissions are preserved; only new recovery routines and two extra hosted trigger functions have their browser/PUBLIC execution removed. The current React application uses authenticated backend APIs, not direct public-table access. Any external public-table consumers need separate owner review.
7. Grants required object access to the existing bounded `purchase_backend` role, including the new structures and read/use access to extension types. Extension schema creation remains forbidden. Human application permission grants are not created.

The bundle checks the observed preflight and complete target schema before inserting one real `073_wici_observed_schema_recovery` receipt and a source/schema/release-bound attestation in the same transaction. It never invents APPLIED receipts for 069–072. Its evidence explicitly retains `historical_execution=UNVERIFIED` while certifying their observed controls now. Existing conflicting historical checksums still block readiness.

## Authority boundary

| Identity | Allowed authority | Release guard |
| --- | --- | --- |
| Authorized database operator | Review/execute additive bundle and provision dedicated login manually | Transactional preflight, postflight, checksum and immutable evidence |
| Dedicated NOINHERIT login | Authenticate, then assume only its granted `purchase_backend` role | Actual session principal must have no schema/owner authority |
| `purchase_backend` | Existing server-authorized business DML and required routines | No persistent DDL or release-evidence writes; existing API institute/capability checks remain authoritative |
| Browser `anon` / `authenticated` | Existing reviewed routine permissions; no direct ERP table DML/read after repair | Exact browser grant contract; authenticated backend routes enforce business access |

`purchase_backend` retains the existing trusted-server BYPASSRLS design. This repair does not turn it into end-user database authorization. Independent server capability and institute checks remain required; the disposable receipt suite exercises foreign institute/warehouse rejection. Retained legacy/public routine permissions and external integrations still need their normal security reviews.

## Manual procedure on Hetzner

### 1. Preserve the current state

Verify a current Supabase backup and recovery capability through the approved operator process. Save the incident logs. Stop the already failing PM2 restart loop:

```bash
pm2 stop purchase-backend
```

Stopping it does not restore login. Keep Nginx available; no Nginx configuration change is part of this repair.

### 2. Put the reviewed backend files in place

Review and merge the recovery PR through normal repository controls, then synchronize its `purchase-backend` subtree to the standalone backend repository using a review branch. Update `/var/www/wici-procurement/backend` using the established deployment procedure, preserving its `.env`. Do not start PM2 yet. Do not use the guided-request PR as a substitute for the recovery code.

The new backend scripts, profiles, SQL 073 and locked source manifest must come from the same reviewed revision. A partial copy or later source edit invalidates the attestation. The backend export includes its own LF `.gitattributes` to preserve checksum-bound bytes on Windows.

### 3. Generate and review the SQL bundle, offline

From the deployed backend directory, replace the actor label with the responsible operator's name:

```bash
cd /var/www/wici-procurement/backend
DB_RELEASE_SCHEMA_PROFILE=wici-2026-11 node scripts/databaseRelease.js plan \
  --migration 073_wici_observed_schema_recovery \
  --environment production \
  --actor 'WICI authorized operator' \
  --release wici-recovery-2026-11-07-r1 \
  --output /tmp/wici-production-recovery.sql
```

This command reads local files only. It does not connect or execute SQL. The release label must match `APP_RELEASE_REF` below and may not be reused for different backend source. Regenerate the bundle after any backend source/profile change.

A pre-generated example is included in `sql/operator-recovery/wici-production-recovery.sql`; its source manifest must still match the reviewed backend. Do not execute raw 073 or an older 071 file instead of the generated bundle, because that omits release evidence and pre/post checks.

Review the **complete** generated file and run it manually in the Supabase SQL Editor during the approved maintenance window. Preserve the transaction boundaries. If preflight, duplicate detection, permissions or postflight fail, stop: the transaction must roll back. Do not remove checks, delete history or insert receipts by hand to make it pass.

Before operational acceptance, check sequence ownership read-only in the SQL Editor:

```sql
SELECT pg_get_serial_sequence('public.goods_receipts','id') AS receipt_sequence,
       pg_get_serial_sequence('public.ap_vouchers','id') AS voucher_sequence;
```

Both must identify the existing canonical sequence. The uploaded catalog captures defaults, not sequence ownership/current values. The disposable fixture reconstructs conventional serial ownership; it does not prove the Production dependency. If either result is null, stop and review that dependency separately. Do not reset or guess sequence values.

### 4. Prepare a dedicated runtime login without sharing credentials

On Hetzner, from the backend directory:

```bash
node scripts/prepareRuntimeIdentity.js \
  --output-dir /home/deployer/wici-private-recovery \
  --release wici-recovery-2026-11-07-r1
```

This is offline. It reads the existing `.env` connection endpoint and writes two new mode-0600 files in a mode-0700 directory outside Git:

- `runtime-identity.sql`: private generated password and a new NOINHERIT login with SET membership in `purchase_backend`. It refuses to rotate an existing role.
- `runtime.env`: proposed connection and release settings.

Execute the private identity SQL manually through the approved secret-handling process. **Never upload these files to chat or GitHub, paste their contents into logs, or put them in frontend environment variables.** If the role already exists, stop and review it or regenerate with a new `--role`; do not overwrite an active password casually.

The proposed endpoint preserves the existing project/database. A Supabase transaction-pooler port 6543 is changed to the session-pooler port 5432 in the private proposal. Review this before use; the backend needs a direct or session-pooler connection that retains session role state. Do not use a transaction/statement pooler for this setup.

Securely back up `.env` outside Git and merge only the generated settings into it, retaining JWT, storage, mail, CORS and all unrelated settings. Do not replace the whole file with `runtime.env`.

The key settings are:

```dotenv
DB_RELEASE_SCHEMA_PROFILE=wici-2026-11
DB_RUNTIME_ROLE=purchase_backend
APP_RELEASE_REF=wici-recovery-2026-11-07-r1
DB_RELEASE_ENVIRONMENT=production
HOST=127.0.0.1
PORT=5000
LIVE_ROUTING_ENABLED=false
```

`DATABASE_URL` must use the new private login, never `postgres`. Every physical pool connection authenticates with the NOINHERIT login and completes a fixed `SET ROLE purchase_backend` and `SET search_path = public, extensions, pg_catalog` before checkout. The same search path is pinned in the recovery bundle so type/function fingerprints are independent of an owner-specific default. This occurs before application queries/guards are exposed. Role setup failure closes the connection. A caller cannot choose an owner role, and readiness still rejects an owner connection principal even after SET ROLE.

Leave Approval Engine V2, guided submission and operational allocation rollout flags disabled unless separately approved.

### 5. Verify the actual connection, read-only

Run on the server after updating `.env`:

```bash
node <<'NODE'
require('dotenv').config({ quiet: true });
process.env.DB_RELEASE_READONLY_URL = process.env.DATABASE_URL;
require('./scripts/databaseRelease').main({
  command: 'verify',
  environment: process.env.DB_RELEASE_ENVIRONMENT,
  release: process.env.APP_RELEASE_REF
}).catch(error => { console.error(error.code || error.message); process.exitCode = 1; });
NODE
```

The dedicated verifier runs a read-only transaction using the same connection initialization as the application. Require `DATABASE_READY`, `assessment_mode=ACTUAL_RUNTIME_CONNECTION`, `connection_role=purchase_backend` and the new unprivileged login as `connection_principal`. Do not use `--backend-role` to assess only a hypothetical role and call that runtime acceptance. Share only redacted status/findings if help is needed; never share the generated private files or connection URL.

### 6. Start and confirm availability

```bash
pm2 restart purchase-backend --update-env
pm2 logs purchase-backend --lines 40 --nostream
curl -i http://127.0.0.1:5000/health
curl -i https://wici-procurement.org/health
```

Use the deployment's actual public health proxy path; some Nginx configurations expose only `/api/*`. The local health response and a stable listening process are required. A public 404 for an unproxied health path is not a database failure. Then test login in the existing frontend. PM2's transient `online` label is insufficient.

Check that PM2/ecosystem or exported shell variables are not overriding the newly reviewed `.env`. Keep credentials private when checking environment precedence. Do not repeatedly restart a process that still reports contract/role errors.

### 7. Obtain operational acceptance

Use controlled fixtures/read-only checks to verify approvals, catalog access, P2P/receiving, audit/outbox, workers and reports. Reconcile currency-specific AP/payment and inventory balances against pre-change evidence. Confirm preserved legacy records, critical delete restrictions, queue recovery and external delivery health. Do not create test payments, post inventory or reverse historical accounting in Production without a separately approved controlled exercise.

Remove private generated files after secure secret-manager import, according to the approved retention policy. Keep the reviewed bundle and its execution evidence.

## Rollback and limits

Do not drop the new history tables, reset sequences, restore a stale database over new business activity, re-enable the legacy stock trigger or disable RLS. Contain by stopping the backend/workers if acceptance fails, preserve evidence, and use a reviewed forward correction. An older application artifact must be checked against the changed schema and credential contract before rollback. Setting the hosted profile back to `canonical` is not a recovery shortcut; the deliberately different hosted schema will be rejected.

This package is tested from metadata, not a copy of Production financial/patient rows. Monetary precision and timestamp conventions remain as observed. Existing stored quantity values are preserved when operational numeric typmods are removed. Previously rounded quantities cannot be recovered from this metadata, and no automatic reconstruction is attempted. Broader data-quality, legacy TCO/financial-report precision and external integrations require owner acceptance. SQL 073 fails on duplicate canonical journal identities rather than guessing a financial reconciliation. Historical missing audit/inspection/financial evidence remains missing; the repair does not fabricate it.

The disposable fixture executes observed constraint/index SQL verbatim. PostgreSQL re-deparses 58 expressions (mainly varchar-array casts), so test-only verifier inputs use those re-deparsed representations. Production profiles and the production bundle retain exact uploaded definitions; no runtime compatibility comparison is loosened for this test accommodation. Two canonical stock views are rebuilt from repository definitions and the unused legacy audit view is represented from audit columns; this is not certification of arbitrary external view consumers. Browser access to these ERP views is denied.

See the PR for executed test counts and remaining operator acceptance. Green CI establishes test readiness, not automatic Production deployment authorization.

## Executed local validation

- Hosted recovery PostgreSQL: 15 scenarios, followed by all 43 canonical goods-receipt/inspection/inventory scenarios against the reconstructed hosted schema and restricted runtime pool. Includes fractional `0.1001`, concurrent releases, quarantine, institute/warehouse authorization and audit rollback.
- Canonical database governance PostgreSQL: all 31 scenarios pass with the default canonical profile.
- Final backend unit/HTTP regression suite: all 233 suites / 1,982 tests pass, including reproducibility of the checked-in operator SQL and manual-only recovery selection.
- Release policy: all 29 checks pass. Backend syntax gate passes.
- Frozen SQL 001–072 and the canonical schema contract are unchanged. No hosted connection or hosted SQL execution was used.

These are disposable fixture results. Production financial/inventory-row acceptance, serial dependency checks, actual restricted-role readiness, worker health and login remain mandatory operator checks.
