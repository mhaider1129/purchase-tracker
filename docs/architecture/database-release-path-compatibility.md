# Database release inventory path compatibility

## Change and scope

`inventory.js` now converts every repository-relative path to forward slashes immediately after `path.relative(root, file)`. SQL classification, fixture classification, runtime-source classification, application-source sorting and locked-manifest membership therefore share one canonical representation. Directory traversal and file reads still use native `path.join`/absolute paths. File contents and hashing algorithms are unchanged.

Downstream review covered `planner.js`, `profiles.js`, `catalog.js`, `databaseRelease.js` and `databaseReleaseService.js`. Their filesystem joins accept canonical forward-slash paths on Windows and Linux. Native `path.basename` also accepts those forward-slash paths on both systems. No downstream edits or dependency changes were necessary. Existing `.gitattributes` already requires LF checkout; it was preserved.

No SQL, contract/profile, migration inventory, generated operator bundle, migration ID/classification, execution evidence, release evidence or stored checksum was modified. SQL 073 remains `manual_recovery_migration`; automatic canonical planning must not select it. No database connection, SQL migration or deployment was performed.

## Tests

The Linux baseline passed both requested suites: 26 tests, zero failures/skips; the locked inventory originally verified with no findings. New regressions failed against the original implementation when Windows relative paths were simulated.

After the fix, all four new path tests pass. They compare complete inventory metadata under POSIX/Windows relative-path representations, including integration fixtures, runtime sources, application sources, generated artifacts and SQL 073. They also verify canonical planning and manual-only 073 selection using a source-bound **in-memory** review manifest and confirm that tampered migration hashes remain rejected. No manifest is written by these tests.

Requested Linux rerun (including path tests):

```bash
cd purchase-backend
npm test -- --runInBand --forceExit databaseReleasePaths.test.js databaseReleaseGovernance.test.js wiciRecoveryProfiles.test.js
```

Result: **25 passed, 5 failed, 0 skipped**. All five failures are the preserved source-attestation gate described below, not path discovery or SQL checksum mismatches. Existing tests were not changed to ignore those failures.

The separate `Database release path compatibility` workflow runs unit tests on native Windows and Linux. It has no database, migration runner, application startup or deployment steps and retains failing exit codes. Native results are recorded in the review branch's final report.

## Source-attestation blocker

The user's requirements preserve stored SHA-256 values. The manifest includes `inventory.js` itself, so changing that file while preserving its stored checksum necessarily leaves a genuine mismatch:

| Source | SHA-256 |
| --- | --- |
| Locked `scripts/lib/databaseRelease/inventory.js` | `4a2280fecdf229e5c5174dea1aba5bb375ef07d197a92c934241e99446eb8288` |
| Edited file bytes | `d9aeb65cd81f18edcc12aff99bad53011e035ced097922e8ca375b6c9ac4264a` |

`verifyFiles(checkedInManifest)` returns exactly:

```json
[{"file":"scripts/lib/databaseRelease/inventory.js","reason":"CHECKSUM_MISMATCH"}]
```

There are no path-driven `UNREGISTERED_RELEASE_ARTIFACT` findings or changed SQL checksums. `highest_manual_number` is 73. The five blocked tests are:

- locked inventory discovers the actual highest migration and records unverified history;
- planner blocks frozen history, changed checksums and dependency reversal;
- offline plans bind actor, environment, source digest, contract and execution evidence;
- recovery is manual and cannot enter a canonical release plan;
- checked-in operator SQL is reproducible from the final source-bound plan.

A zero-finding checked-in verification cannot coexist with both the requested source edit and immutable source-checksum values. No bypass, checksum exemption, manifest regeneration or rewritten expected history is used. This branch is **not release-ready**.

A separately authorized source-attestation update would need to review and bind only this changed source's real bytes, recompute the aggregate application-source digest, and rebind the existing operator artifact under an approved new application release reference. Any bundle change must be proved limited to legitimate source/reference bindings; all migration SQL/checksums and historical evidence must stay intact. That update was not performed here. No database migration is required for this path fix.
