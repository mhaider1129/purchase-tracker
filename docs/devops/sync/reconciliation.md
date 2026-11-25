# Repository reconciliation — 24 November 2026 (Baghdad)

**BLOCKED FOR PUBLISHING ACTIVATION.** This is a content review and an unapproved bootstrap proposal, not synchronization, database acceptance or deployment authorization. No destination branch, setting, secret, worktree or service was changed. No SQL was executed. Never run the legacy `deploy.sh`: it targets the wrong PM2 process and modifies dependencies shared by the emergency recovery application.

## Immutable observations

| Repository/ref | Audited SHA | Observed SHA | Assessment |
| --- | --- | --- | --- |
| purchase-tracker/master | f852b6add8596f61d389cb00f5f652ac75cd6cf5 | 180ea21c2d8bf233457a6ef6c6ede4bfceea0886 | Advanced; refreshed plans use this actual source |
| purchase-backend/main | 70c4ee50bd0c8342eb30f573eacbd95f543a5e88 | 70c4ee50bd0c8342eb30f573eacbd95f543a5e88 | Unchanged |
| purchase-frontend/main | 8a4ac51a52d30877c21e7300af9d4a1d5d410d6e | 8a4ac51a52d30877c21e7300af9d4a1d5d410d6e | Unchanged |

Destinations were inspected with separate disposable bare clones, reading committed Git objects and remote metadata only. Local configuration, credentials and uncommitted work were not imported. Remote heads/protection and check-run observations were independently read through GitHub API. All three default branches report `protected:false`; this does not certify the absence of organization rulesets. Effective rules and bypass actors still require governance review.

The backend plan remains **29 differences: 16 additions, 13 updates, zero deletions**, byte-identical change set to the audited source. `INITIAL_DIFFERENCE_REQUIRES_REVIEW` means no approved baseline exists for unequal blobs. It is not a reproduced incompatible merge conflict. The frontend at the audited source remains exactly equal; latest master instead has **four differences: two additions, two updates**.

[bootstrap-proposal.json](bootstrap-proposal.json) binds actual source/destination SHAs, managed and complete tree digests, change-set digest, all before/after blobs and modes, all 29 decisions, required destination checks, SQL preservation and independent branch comparisons. Every decision is unapproved. Its `proposalSha256` hashes the compact JSON object with only that digest field omitted, using the existing publisher digest function. Complete-tree digests include excluded entries; they do not copy their contents. These are local review evidence, never authenticated CI or publishing approval.

[reconciliation-evidence.json](reconciliation-evidence.json) separately binds the genuine equal frontend pair, its four-change incremental plan, all existing destination SQL SHA-256 values and the 105 unchanged locked artifacts. Its own digest uses the same omission rule. Checked-in snapshots do not update themselves when remote heads advance; regenerate and independently review before authorization.

## Every backend difference: content assessment

Paths below are relative to `purchase-backend/`. “Propose include” is a recommendation for a future reviewed canonical payload, not permission to publish. Security-sensitive units must remain atomic with their tests, manifest and generated-source bindings.

| Path | Classification | Content assessment and proposed decision |
| --- | --- | --- |
| `.gitattributes` | Valid upstream enhancement | Adds LF checkout policy for checksum-bound export. Propose include; never renormalize historical SQL to satisfy it. |
| `config/db.js` | Security-sensitive change | Client wrapper opts into restricted role before pooled use. Propose include with identity helper/tests; no role is created or granted by this source sync. |
| `database/releases/migration-inventory.json` | Database migration or recovery-sensitive change | Registers profiles, source bindings, SQL073 and operator artifact. Raw verification is clean. Preserve all prior SQL hashes; resolve independent branch attestation differences atomically before approving final payload. |
| `database/releases/profiles/wici-observed.json` | Database migration or recovery-sensitive change | Explicit observed overlay bound to canonical contract bytes, retaining actual hosted RLS, validated keys and AP monetary types. Propose include only as selected diagnostic input; not automatic schema equivalence. |
| `database/releases/profiles/wici-target.json` | Database migration or recovery-sensitive change | Target recovery overlay adds reconciliation/SCOP prerequisites, restricts browser grants and contains legacy stock trigger. Propose include with manual073; not proof any host meets it. |
| `docs/database-release-governance-7a.md` | Documentation-only change | Distinguishes diagnostic capture from actual-runtime restart acceptance. Propose include. |
| `docs/rfid-crash-recovery-7b.md` | Documentation-only change | Adds explicit runtime verification instructions; no worker-policy change. Propose include. |
| `docs/transactional-event-reliability-7c.md` | Documentation-only change | Same actual-runtime acceptance clarification for outbox/audit. Propose include. |
| `integration/fixtures/wici-function-styles.json` | Valid upstream enhancement | Synthetic CRLF/function-definition reconstruction metadata, including contained legacy trigger fixture. Propose include as fixture only. |
| `integration/wiciObservedFixture.js` | Security-sensitive change | Reconstructs observed schema only behind disposable URL guard; destructive fixture SQL never belongs in application startup. Propose include with guarded runner, not standalone execution. |
| `integration/wiciRecovery.postgres.js` | Valid upstream enhancement | Disposable recovery tests for preserved history, role boundaries, drift, duplicate identifiers, audit failure and CRLF binding. Propose include; fixture test success is not production acceptance. |
| `package.json` | Valid upstream enhancement | Adds hosted-recovery fixture command; no dependency/lockfile changes. Propose include with runner and fixtures. |
| `scripts/databaseRelease.js` | Security-sensitive change | Explicit diagnostic/runtime connection selection, profile selection, fixed search path and restart denial for diagnostics. Propose include; runtime override remains forbidden. |
| `scripts/lib/databaseRelease/catalog.js` | Compatible change requiring integration | Adds RLS/SELECT visibility evidence instead of falsely claiming hidden reference rows are absent. Preserve this and integrate independent PG17 routine evidence as a separate reviewed upstream unit first. |
| `scripts/lib/databaseRelease/inventory.js` | Database migration or recovery-sensitive change | Canonical POSIX repository paths, native filesystem access, profile sources and manual-only073. Functionally equivalent portable-path work exists independently; reconcile exact source bytes/bindings, not hashes alone. |
| `scripts/lib/databaseRelease/planner.js` | Database migration or recovery-sensitive change | Explicit recovery profile and checksum-bound generation, unknown execution history retained, frozen replay still denied. Propose include without executing generated SQL. |
| `scripts/lib/databaseRelease/profiles.js` | Security-sensitive change | Fixed profile allowlist, base contract hash binding and checked overlay removal/replacement. Propose include; no arbitrary path/profile autoselection. |
| `scripts/prepareRuntimeIdentity.js` | Security-sensitive change | Offline generator emits private role SQL/config outside Git; SQL requires operator review, role-name and release input checks. Propose include as operator tool; do not run it for repository reconciliation or local startup. |
| `scripts/testBackendContractRefresh.js` | Valid upstream enhancement | Routes hosted-recovery fixture through existing disposable runner. Propose include with fixtures. |
| `services/databaseReleaseService.js` | Incompatible change requiring resolution | Profile/visibility/runtime safeguards are useful, but independent branch has contract-version validation/getter and extension diagnostics absent here. Stale exported 7C metadata remains in combined source while actual verification loads JSON SCOP1. Do not overwrite that branch's fixes; integrate/review before final backend bootstrap. This discrepancy alone does not prove wrong runtime contract selection. |
| `sql/manual/073_wici_observed_schema_recovery.sql` | Database migration or recovery-sensitive change | New manual-only recovery against verified observed prerequisites. Adds missing contract review and SCOP controls, quantity widening, restrictive deletion references/browser grants and trigger containment. Requires existing065/069–071 controls, reviewed backend role, duplicate-finance review and source-bound pre/postflight. Propose retain as unexecuted artifact; never automatic synchronization-triggered SQL. |
| `sql/operator-recovery/wici-production-recovery.sql` | Database migration or recovery-sensitive change | Generated 4 MB operator bundle, reproducible offline from current final bindings and release reference `wici-recovery-2026-11-09-r3`. Independent branches have different bindings. Preserve every existing artifact/history; no automatic replacement of any destination SQL. |
| `tests/databaseReleaseGovernance.test.js` | Valid upstream enhancement | Highest manual migration73 and visibility/startup expectations. Propose include and retain independent tests rather than replacing them. |
| `tests/databaseReleasePaths.test.js` | Valid upstream enhancement | Windows/POSIX path inventory, canonical planning, source binding and checksum rejection. Propose include; actual checked-in manifest independently verifies clean. |
| `tests/databaseReleaseVisibility.test.js` | Valid upstream enhancement | Hidden rows/SELECT/role-mode separation, numeric/RLS/constraint drift and accounting precision. Propose include without accepting blanket type equivalence. |
| `tests/prepareRuntimeIdentity.test.js` | Valid upstream enhancement | Synthetic offline URL/role/release injection checks; no database access. Propose include. |
| `tests/runtimeDatabaseIdentity.test.js` | Valid upstream enhancement | Mocked pool setup completion/closure, restricted role allowlist and unchanged default identity. Propose include. |
| `tests/wiciRecoveryProfiles.test.js` | Database migration or recovery-sensitive change | Base/profile binding, precision, no financial backfill, manual-only073 and exact generated-bundle reproducibility. Propose include with final reviewed binding, preserving branch-specific evidence. |
| `utils/runtimeDatabaseIdentity.js` | Security-sensitive change | Only explicit `purchase_backend` selection, `SET ROLE` before connection becomes usable, fixed search path and close on error. Default connection unchanged. Propose include; grants/provisioning remain separate approval. |

All 103 existing destination SQL blobs match source, with independent SHA-256 evidence. SQL073 and the generated bundle are additions relative to main, not modification or execution of an existing main artifact. All 105 locked artifact bytes/hashes are unchanged by this PR, with zero inventory findings. The canonical contract and finance/inventory code are unchanged by this reconciliation PR.

## Independent backend preservation and unresolved integration

| Ref | Observed SHA | Differences from current combined payload | Disposition |
| --- | --- | --- | --- |
| `recovery/wici-database-20261107` | 2c2a4651a10a54a20a1f74dfade66260b8a1e46e | 9 differences; 8 initial-review markers | Preserve ref/history; no checkout, reset, deletion or overwrite |
| `codex/pg17-release-diagnostics` | 1541dd727e95700111f62ea93a30f1e6774f0fe5 | 19 differences; 18 initial-review markers | Preserve diagnostics, tests and attestation provenance; integrate through reviewed combined PR first |

These are branch comparisons, **not authorized deletion plans**. Recovery-only documents requiring preservation: `docs/database-inventory-path-compatibility.md`, `docs/database-release-source-attestation-r3.json`, `docs/database-release-source-attestation-r3.md`. Its portable-path implementation is semantically similar but has different final bytes; operator-bundle reference is `wici-recovery-2026-11-07-r3`, with independent source binding. Do not re-label or replace it with the canonical artifact.

PG17 additionally contains destination-only `docs/isolated-pg17-release-verification.md`, `docs/isolated-pg17-source-binding.json`, `integration/releaseRoutineCatalog.postgres.js`, `scripts/captureIsolatedReleaseDiagnostic.js`, `scripts/testReleaseRoutineCatalog.js`, `tests/databaseReleaseRoutines.test.js`, `tests/databaseReleaseVersions.test.js`, `tests/isolatedReleaseDiagnostic.test.js`. The catalog/service changes add extension ownership/browser-grant evidence while retaining the original blocking comparator, plus selected-contract version enforcement. The diagnostic capture is constrained to numeric loopback, port55432 and `wici_migration_test`, read-only transactions, explicit evidence identity and no runtime-role assumption. These are real enhancements, not redundant files to delete. The extra runner is disposable PG16/17 only; its presence does not authorize executing it on hosted databases.

Minimum next upstream review: integrate these source/tests/documents into combined master, independently verify unchanged legacy catalog fingerprint semantics and strict browser grant checks, then review source-attestation changes and offline bundle bindings together. Retain the old SQL artifact path/history; use an explicitly reviewed new artifact if a new binding is required. Existing SQL cannot be updated through the publisher even by bootstrap/deletion approval. This PR intentionally does not make that separate security-sensitive application/governance change or rewrite locked artifacts merely to make backend reconciliation appear complete.

`purchase-backend-recovery` worktree and every independent branch remain untouched. Keeping a remote branch is preservation, not completion of its upstream integration. **Backend baseline stays null.**

## Frontend proposed baseline and incremental review

Proposed, unapproved equal baseline: source `f852b6add8596f61d389cb00f5f652ac75cd6cf5`, destination `8a4ac51a52d30877c21e7300af9d4a1d5d410d6e`. Managed trees are genuinely equal; this is not a fabricated merged-sync receipt. Current master descends from this source; the existing publisher validates ancestry and old managed-tree equality independently.

The new four-file incremental plan has zero divergence conflicts. It adds `src/components/priority/PriorityAssessmentDialog.jsx` and `src/pages/ProcurementPriorityManagementPage.workspace.test.jsx`, updates `src/pages/ProcurementPriorityManagementPage.jsx` and its `.css`. Content is an upstream priority-workspace enhancement: canonical API calls/assessment fields retained, modal focus restoration/trap, unsaved draft protection, stale preview cancellation, saving guards, responsive queue layout and regression tests. Destination CI and independent review still required. This PR changes none of these application files. The original zero-difference observation remains true only at the older audited source.

## Reviewed synchronization boundaries

- `sync-plan` reads immutable objects and filters credentials/generated paths from managed changes. `sync-tree` additionally projects complete trees, so excluded/protected/destination-only descendants cannot be implicitly removed by ancestor replacements.
- `sync-bootstrap` describes content; it neither approves nor applies changes. It now accepts explicit repository paths/SHAs for local inspection, binds both managed and full trees, and records every changed file, including additions.
- `sync-audit` accepts native sibling paths (including spaces), optionally full SHA pins, and writes private JSON directly. Git-object plans ignore dirty working trees. Unknown/duplicate options, non-immutable SHA inputs and unsafe report destinations fail. Output files cannot overwrite earlier reports. No fetch, copy, checkout, token or GitHub operation occurs.
- `sync-release` authenticates same-commit successful master-push CI artifact evidence; an API run `head_sha` alone is insufficient. Missing/expired evidence and source/destination drift fail closed. Revalidation runs after environment approval.
- `sync-publish` requires approved policy/App identity, protections/checks, exact bootstrap decisions or a genuine verified baseline; validates the final generated Git tree and immutable existing SQL; opens a draft PR on a new branch. No force push, direct-main write, bypass, merge or reverse synchronization.
- Policy remains `enabled:false`, approval pending, App null and both baselines/approved bootstraps null. Workflow publishing retains literal `if: false`. Production, staging and database activation guards remain unchanged.

## Readiness and operator actions

| Area | Status | Next action |
| --- | --- | --- |
| Backend reconciliation | BLOCKED | Review/integrate independent PG17/recovery unit and final source bindings; regenerate immutable proposal |
| Frontend reconciliation | PROPOSED, locally verified | Approve genuine equal baseline and four-change incremental review; install destination CI separately |
| Synchronization bootstrap | BLOCKED, proposal complete | Approve exact content/digests only after backend integration and current-head re-audit |
| Controlled publishing | DISABLED / BLOCKED | Complete [activation checklist](activation.md), protected environment/App permissions and independently authorized activation PR |
| Local development | DOCUMENTED; offline audit verified | Follow [isolated development guide](local-development.md); developer database startup not tested here |
| Staging validation | NOT PERFORMED | Separate existing Phase3 approval and isolated staging process; source CI rehearsal is not external activation |
| Production deployment | NOT AUTHORIZED | Separate production readiness/cutover approval; no synchronization action is deployment permission |

No manual database migration is required by this PR. Refer to [validation](reconciliation-validation.md) for exact local and GitHub results and limitations. The next owner actions can be requested through Codex PRs; routine manual backend/frontend copying or history replacement is unnecessary.
