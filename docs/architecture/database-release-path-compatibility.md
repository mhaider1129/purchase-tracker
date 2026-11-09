# Database release inventory path compatibility

## Change and scope

`inventory.js` converts every repository-relative path to forward slashes immediately after `path.relative(root, file)`. SQL classification, fixture classification, runtime-source classification, application-source sorting and locked-manifest membership therefore share one canonical representation. Directory traversal and file reads still use native `path.join`/absolute paths. File contents and hashing algorithms are unchanged.

Downstream review covered `planner.js`, `profiles.js`, `catalog.js`, `databaseRelease.js` and `databaseReleaseService.js`. Their filesystem joins and `path.basename` accept canonical forward-slash paths on Windows and Linux. No downstream edits or dependency changes were necessary. Existing `.gitattributes` requires LF checkout and was preserved.

The initial path-only change preserved all checksums and consequently left the edited source's lock invalid. The user subsequently authorized source-checksum renewal and then explicitly authorized refreshing the generated operator bundle bindings. This document describes that completed offline renewal, not database execution or historical execution evidence.

## Source and generated-artifact bindings

Only the changed `inventory.js` application-source entry was renewed. The aggregate was computed with the canonical `hash(JSON.stringify(application_sources))` logic and compared with `inventory()`'s current result; all other application-source entries were preserved.

| Binding | Previous SHA-256 | Current SHA-256 |
| --- | --- | --- |
| `scripts/lib/databaseRelease/inventory.js` | `4a2280fecdf229e5c5174dea1aba5bb375ef07d197a92c934241e99446eb8288` | `d9aeb65cd81f18edcc12aff99bad53011e035ced097922e8ca375b6c9ac4264a` |
| Aggregate application manifest | `902f0e5a5581d5f6aa39b3bc319c829a97947756be90ecc5b6603e5ea19c364c` | `a081d9611bd8aa364c68734749169f6d8456bf507e646a0ac958ecea03505760` |
| Generated operator bundle | `a35baa9ebc045a7b89cbec9c330119ad45f75114def2fc932a55d33ceeb50b1b` | `785d3e62c1ddcc814b40983b3f62f15d66739d2ad124296cd3baf41b57380746` |

The existing approved offline `planner.bundle()` generator produced `sql/operator-recovery/wici-production-recovery.sql` under the new application reference **`wici-recovery-2026-11-09-r3`**, replacing `wici-recovery-2026-11-07-r2`. The corresponding reproducibility test uses the new reference. Only the generated artifact's checksum was then updated in the artifact inventory.

The complete regenerated bundle was asserted equal to the previous bundle after **only** replacing the old aggregate digest and old application reference with their new values. This full-string comparison proves that SQL bodies, permissions, prerequisites, schema-contract checks, migration checksum guards, actor/environment bindings and execution-evidence controls did not change. This operation did not execute any of that SQL or insert receipts/attestations.

All **104 other SQL/fixture artifact records and hashes** remain unchanged. Every historical migration, including SQL 073, retains its original file bytes and SHA-256. SQL 073 remains `manual_recovery_migration`, `highest_manual_number` is 73, and the ordinary canonical plan selects only 072. Explicitly attempting 073 without its reviewed profile remains blocked. The locked schema contract, profile files, runtime-source metadata and classification/evidence metadata were preserved. `verifyFiles(checkedInManifest)` returns **zero findings**.

## Tests and failure controls

The Linux baseline passed both originally requested suites: 26 tests, zero failures/skips. The new path regressions failed against the original code when Windows relative paths were simulated.

The four path tests compare complete POSIX/Windows inventory metadata, including integration fixtures, runtime/application sources, generated artifacts and SQL 073. They exercise source-bound in-memory planning and confirm that tampered migration hashes remain rejected. They never write a manifest or execute SQL.

Run all three requested suites with:

```bash
cd purchase-backend
npm test -- --runInBand --forceExit databaseReleasePaths.test.js databaseReleaseGovernance.test.js wiciRecoveryProfiles.test.js
```

The `Database release path compatibility` workflow runs the same suites on native Windows and Linux, uploads JSON results, and preserves failing exit codes. It has no database, migration runner, application startup or deployment steps. Final native execution results are linked in the completion report.

The original source mismatch and subsequent stale-bundle reproducibility failure were not suppressed or exempted. Both were resolved through the authorized byte-accurate source/artifact renewals. Checksum tampering, stale aggregate digests, frozen migration replay and unapproved 073 selection remain rejected by the existing tests.

## Rollout limits

No database connection, migration application, production modification, PM2/Nginx change, deployment or merge occurred. No database migration is required for this path fix. The generated bundle is an unexecuted review artifact; it is not an instruction to run recovery SQL or a declaration of live database compatibility. Historical execution remains UNVERIFIED, and `LIVE_ROUTING_ENABLED=false` remains unchanged.
