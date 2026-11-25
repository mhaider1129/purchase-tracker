# Development reconciliation: assessment and operator handoff

**Implementation stage: Phase B handoff. Actual Development startup remains BLOCKED.** This follows the assignment's instruction: “If Codex cannot access the development database, generate the diagnostic tooling and stop at the operator handoff.” Neither dedicated Development diagnostic URL is configured in this execution environment. No `.env` file was opened to obtain credentials, no hosted connection was attempted, and no recovery bundle was generated or SQL applied. Subsequent phases require actual diagnostic evidence, backup verification, reviewed changes and explicit operator approval.

The implementation extends existing draft PR113 on `codex/scop-sync-reconciliation`; its base remains combined `master` at `180ea21c2d8bf233457a6ef6c6ede4bfceea0886`. The prior diagnostic foundation is reused, not replaced with another migration framework. No standalone repository, Production resource or recovery worktree is changed.

## Evidence boundary

| Evidence | Source / confidence |
| --- | --- |
| Development project `bcvfosxcyvarieiinovo`, PostgreSQL 17.6 | Operator confirmed; no independent network capture here |
| Startup findings 1,269; missing `contract_financial_reviews`, `maintenance_stock` | Operator confirmed; full definitions and group breakdown not supplied |
| 269 public tables; 161 RLS enabled; 108 disabled; 0 forced | Operator confirmed; counts do not establish compatibility or identify all differences |
| Release receipt and attestation tables exist, each with 0 rows | Operator confirmed; absence of execution evidence is not proof migrations were never executed |
| Current `postgres` LOGIN/BYPASSRLS/CREATEDB/CREATEROLE; not SUPERUSER | Operator confirmed; already incompatible with canonical runtime's no persistent DDL/owner authority requirement |
| Complete role inventory, actual policies/grants, signatures, ledger visibility | Unverified until the consolidated report |
| Canonical reference | Source verified: SCOP1, 266 table relations, 166 RLS enabled, 100 disabled, 0 forced; comparison must use actual rows, not these totals |

Counts and relation/function names cannot prove schema shape, security policies, migration execution or current source/schema attestation. Do not classify all 1,269 findings as false positives or infer a compatible hosted profile from fewer differences.

## Repository and release infrastructure

All requested paths exist relative to `purchase-backend/`: `scripts/databaseRelease.js`, `scripts/lib/databaseRelease/{catalog,inventory,planner,profiles}.js`, `services/databaseReleaseService.js`, `utils/runtimeDatabaseIdentity.js`, `scripts/prepareRuntimeIdentity.js`; `database/releases/{schema-contract,migration-inventory,runtime-modules}.json`, profile descriptors and `prerequisites/{069, 070, 071}-schema-contract.json`; manual069–073 and the generated operator recovery SQL. Existing governance/profile/visibility/runtime identity tests and disposable recovery fixtures remain authoritative.

| Component | Verified responsibility / consequence |
| --- | --- |
| `catalog.js` | Strict catalog compare, reference visibility and fingerprints. Public functions are the legacy contract scope. Supplemental extension ownership/signature hashes now explain context without broadening that comparator or accepting relocated functions automatically. |
| `inventory.js` | Canonical POSIX paths, SHA-256 verification and frozen/manual classifications. All105 locked artifacts remain untouched; no manifest regeneration is part of this task. |
| `planner.js` | Offline-only source-bound SQL generation. Default active migration 072 depends on genuine 071 receipt. Explicit hosted profile can select manual073; frozen historical replay is denied. Offline selection is not execution authorization or proof of missing DDL. |
| `profiles.js` | Fixed explicit allowlist with canonical/observed hash bindings. Canonical is the diagnostic starting point. Correct final Development profile remains UNDETERMINED; no new profile or automatic selection. |
| `databaseReleaseService.js` | Actual role/privileges, catalog, migration receipts and current attestation must pass before listen/jobs. Exported literal 7C is stale metadata; selected JSON is SCOP1. The literal does not secretly choose a different contract or explain all findings. Independent PG17 work is pending upstream integration. |
| `runtimeDatabaseIdentity.js` | Explicit `SET ROLE purchase_backend`, fixed search_path and close-on-failure. No role creation/grant. |
| `prepareRuntimeIdentity.js` | Offline operator generator; defaults to hosted recovery profile/Production environment and is not a safe Development shortcut. Not executed or modified here. |
| `runtime-modules.json` | Lists existing runtime schema assertion modules. It is not a migration journal and is not authority to bootstrap missing schema at startup. |

### Relation ownership and migration applicability

`contract_financial_reviews` originates in frozen 066. It records append-only finance reconciliation reviews and depends on canonical contracts/invoice protections from 065.073 includes reviewed catch-up. Preserve finance records, triggers, institute references, revisions and evidence; do not replay066 blindly or manufacture a receipt.

`maintenance_stock` comes from `sql/View_Supabase_SQL.sql` and the baseline fixture: integer id/owned sequence, unique item name, integer quantity default0 and timestamp.059 explicitly requires it as a base snapshot relation; 063 and the locked canonical contract also include it. A scoped search of current controller/service/repository/route JavaScript found no active reference; source references were baseline/verification/governance artifacts. Thus it is a **legacy contract requirement with unproven operational necessity**, not proved superseded and not permission to delete the requirement or create a duplicate empty stock ledger. Capture foreign-key dependencies, defaults/sequence ownership, views/triggers/routines and any equivalent stock source before deciding a reviewed additive repair versus a justified future contract change. No such contract change is included here.

The six SCOP tables and `canonical_supply_line_quantity()` reportedly exist. This establishes some072 controls are present, not complete migration application. The diagnostic compares all canonical definitions, plus071 preflight reference and explicit hosted observed/target references. Existing table names, zero ledgers or a near-match cannot mark 072 APPLIED. Default 072 bundle would still require matching071 execution evidence and compatible preflight/postflight.

073 is specialized manual observed-controls recovery. Existing prerequisites include release governance, 070 RFID attempts, 071 email deliveries, 065 contract guard and a reviewed backend grant role; full observed/pre/postflight contracts must match, not only those object names.073 does not create `maintenance_stock`. The existing operator bundle is bound to Production and a different observed catalog/reference: **do not run it on Development or replace environment text**. Its observed-controls mechanism may be reusable only after actual Development comparison, a reviewed Development-specific change and isolated validation. A generated baseline may record its actual new forward operation and observed prior controls, never fabricated historical069–072 execution.

## Consolidated diagnostic

Use [the exact PowerShell handoff](database-handoff.md). It extends `scripts/devops/development-db.cjs`, delegates certification to the existing service and adds `development-db-evidence.cjs` for catalog/evidence SELECTs and classification. It never imports the application, initializes buckets or starts workers.

The report includes exact PostgreSQL/session identity, selected profile and source provenance; public catalog columns/types/defaults/constraints/indexes/triggers/RLS/policies; complete canonical findings and expected/actual pairs; all visible attestations and receipts; role attributes/memberships, target-role privilege assessment via the existing `runtimeAuthority` service, extension ownership/routine hashes/browser grants; canonical, hosted observed/target and historical preflight reference comparisons. It reports schema/RLS totals and missing prerequisite differences without treating a historical reference mismatch as proof a migration never ran. Raw function bodies, password catalogs and business/patient rows are not exported.

Findings retain their original reasons and are classified into missing objects, column/type, constraint, index, routine/trigger, RLS, privilege, migration evidence, attestation, profile, visibility and source-integrity categories. Possible definition/extension representation issues are **unproven review candidates that remain blocking**. Validated-key or monetary precision differences are not dismissed as formatting. No profile, policy, requirement, receipt or attestation is silently changed.

Metadata reads use savepoints to preserve remaining evidence after a permission failure, emit only sanitized error codes and mark capture incomplete. Hidden/RLS-protected attestation rows are UNOBSERVABLE, never an empty-success ledger. Incomplete required application metadata prevents runtime restart eligibility even if the canonical mock/service reports ready. Provider legacy history is separately marked in `contextGaps`/`contextComplete`; inaccessible provider administration records never become fabricated receipts or a new reason to grant the runtime broader privileges. Canonical application ledgers/attestations remain required and fail closed. Diagnostic mode always remains BLOCKED; zero schema differences cannot certify a hypothetical runtime role.

## Runtime identities and configuration plan (not provisioning)

- Existing `postgres` is an assessment/operator identity, not an acceptable local application runtime. Do not strip its provider administration privileges or reuse its password for a new role.
- Proposed Development login `wici_development_runtime`: independently created credentials, LOGIN, NOINHERIT, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, no object ownership. Its existing reviewed `purchase_backend` membership/SET permission must be assessed before using `DB_RUNTIME_ROLE=purchase_backend`.
- Existing architecture expects a trusted backend grant role with specifically reviewed BYPASSRLS plus application authorization/institute enforcement. This task grants none. Do not indiscriminately grant BYPASSRLS to either login or to a verifier to make findings disappear. A change to that architecture needs separate review.
- Proposed verifier `wici_development_reader`: separate LOGIN/credentials, no DDL, DML, ownership or BYPASSRLS. Catalog/release-reference SELECT must have complete, explicitly authorized visibility. Where RLS hides required evidence, approve narrowly appropriate read access/policies or a curated assessment path; do not disable RLS or broaden privileges silently. Its exact safe grants cannot be finalized from table names alone.
- [runtime.env.example](runtime.env.example) is sanitized, intentionally incomplete and NOT READY FOR STARTUP. It supplies explicit environment/profile, loopback endpoints, mail dry-run and no live integration credentials. It does not provision roles or create attestation.

### Additional startup blockers discovered in source

`config/db.js` sets `ssl:false` outside Production by default and `rejectUnauthorized:false` in Production; URI options may also influence pg configuration. Our diagnostic enforces verified TLS independently, but that does **not** repair the application's pool. A reviewed Development TLS correction and its source-attestation consequences are required before claiming secure runtime readiness. Do not add `sslmode=disable`, set `NODE_TLS_REJECT_UNAUTHORIZED=0` or edit locked source hashes to suppress this issue.

`app.js` unconditionally starts RFID processing, approval reassignment/reminders, scheduled requests and notification outbox processing after startup verification; it has no general worker-disable flag. Mail dry-run prevents delivery but does not stop these Development database mutations. Do not invent a `WORKERS_DISABLED` variable or treat the template as worker containment. Require Development-only endpoints/data, no live mail/SAP credentials, reviewed queue state and a separately reviewed worker-containment/startup plan before application start. This Phase B handoff starts nothing.

## Recovery and validation gates

1. Obtain the private complete capture and verify project/role/profile/source identity; preserve originals and classify every discrepancy. Until then no deterministic recovery bundle or startup success can be claimed.
2. Confirm Development-only backup scope, encryption/access/retention, roles/grants/sequence/ledger evidence and successful restore into a new isolated test database. No reset/restore over Development and no Production data copying.
3. Prepare only necessary reviewed forward changes, bound to actual source/contract/observed schema. Preserve locked SQL bytes. Resolve legacy maintenance ambiguity, role least privilege, policies and genuine release evidence explicitly; never replay all frozen migrations or synthesize missing receipts.
4. Validate proposed bundle in a disposable/isolated Development restore: populated compatibility, repeated execution, concurrent operation, audit failure/rollback, row/financial/inventory preservation and actual postflight. Ordinary local application usage need not use Docker; isolated rehearsal can be separately provided by the existing runner.
5. Obtain explicit operator approval for the concrete SQL, prerequisites and backup. Apply manually only to confirmed Development, with transaction/lock/statement timeouts and captured actual execution evidence.
6. For failure before commit, verify rollback and leave backend stopped. For committed changes, use reviewed forward correction or separately approved backup recovery; schema rollback is not assumed safe/reversible and must preserve subsequent writes.
7. After approved remediation and TLS/worker containment, actual-runtime verification must pass catalog, role, privileges, genuine receipts, source/schema attestation and visibility. Then test loopback health, login, institute isolation, frontend API and core workflows with Development-only users/data. This has NOT happened in this task.

## Implemented, verified, proposed, blocked

| Item | State |
| --- | --- |
| Consolidated diagnostics / classification / project guards | Implemented; synthetic test results in PR validation |
| Repository/migration source assessment | Verified against source; no locked changes |
| 269/161/108/0 metadata, missing two relations, empty ledgers, owner attributes | Operator-confirmed, not independently recaptured |
| Correct final Development profile and least-privilege grants | Proposed decision process; requires actual complete evidence |
| Development recovery bundle | BLOCKED; not generated |
| Backup, hosted remediation, runtime startup, browser UAT | BLOCKED / not performed |
| Production, publishing, external staging | Not accessed/activated; hard stops unchanged |

No database migration is included in this handoff. See [database-handoff.md](database-handoff.md) for the operator's next action, then stop for independent review of the resulting private report.

## Validation and limits

Local Linux/Node22.21.1 validation: 587 infrastructure/security tests passed with 0 failures/skips; this includes 23 consolidated-diagnostic/project-guard tests using synthetic clients. Backend quality group: 235 suites / 1,993 tests passed with 0 failures/skips; syntax, frozen history, offline release planning and quality policy passed. Source credential scanning passed; locked-artifact integrity reports 105 artifacts, highest manual 73 and 0 findings. No new SQL, schema-contract or inventory hash changes were made.

Commands used:

```text
node --test --test-reporter=tap scripts/devops/*.test.cjs scripts/quality/*.test.cjs scripts/staging/staging.test.cjs scripts/persistent/*.test.cjs scripts/readiness/preflight.test.cjs
node scripts/quality/release.cjs group backend --out quality-results/development-handoff-backend
node scripts/devops/security.cjs
node scripts/devops/integrity.cjs --base 180ea21c2d8bf233457a6ef6c6ede4bfceea0886
```

New diagnostic SQL is source-reviewed and exercised through mocked clients; it has not been executed on hosted Development or an actual server in this follow-up. Windows/Linux and full frontend CI results for the final commit are recorded on draft PR113. No frontend code changed. Private Development capture, concrete recovery-bundle rehearsal, secure application startup and browser/UAT are not performed and remain blocked. Existing passing synthetic fixtures are not a substitute for those actual checks.
