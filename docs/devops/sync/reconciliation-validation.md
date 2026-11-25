# Reconciliation validation record

Source audited: `180ea21c2d8bf233457a6ef6c6ede4bfceea0886` (latest observed combined master). Destination main SHAs and independent branch SHAs are in [reconciliation evidence](reconciliation-evidence.json). Local results are below. Exact-head GitHub CI links and final status are recorded on the draft PR; this document is not publishing or deployment evidence.

Tests are local/synthetic only. No Supabase, live database, production server, recovery worktree, standalone write, migration executor or deployment script is used. Development actual-runtime startup remains unverified pending the private report and reviewed reconciliation.

## Commands

```text
node --test --test-reporter=tap scripts/devops/*.test.cjs scripts/quality/*.test.cjs scripts/staging/staging.test.cjs scripts/persistent/*.test.cjs scripts/readiness/preflight.test.cjs
node scripts/quality/release.cjs group backend
node scripts/quality/release.cjs group frontend
node scripts/devops/security.cjs
node scripts/devops/security.cjs build
node scripts/devops/integrity.cjs --base f852b6add8596f61d389cb00f5f652ac75cd6cf5
```

The new audit tests exercise real synthetic local Git repositories, paths with spaces, native path option preservation, committed-only reads, no ref mutations or credential copying, strict inputs/report output protection and unapproved complete-tree bootstrap digests. Development tests use mocked clients only: exact Development TLS/session-pooler binding, Production/lookalike/override denial, no fallback URL, canonical verifier/read-only calls, session identity, diagnostic restart denial, runtime acceptance delegation and rollback on verification failure.

An initial broad run exposed an outdated snapshot assertion expecting frontend zero changes. It was updated to assert the current four-change proposal plus the separately bound genuine old equal pair and conflict-free incremental plan, without approving either. An initial frontend quality run had all555 tests pass but correctly rejected its evidence because release inputs were edited during the run; rerun with stable inputs is required. Neither failure is suppressed.

## Existing source CI (not this PR)

Verified read-only at the audited master SHA:

- [Release quality, success](https://github.com/mhaider1129/purchase-tracker/actions/runs/45419288871)
- [Persistent staging local integration, success](https://github.com/mhaider1129/purchase-tracker/actions/runs/45419288734)
- [Isolated staging rehearsal, success](https://github.com/mhaider1129/purchase-tracker/actions/runs/45419966355)
- [Repository synchronization, success with publishing disabled](https://github.com/mhaider1129/purchase-tracker/actions/runs/45419966243)
- External persistent staging activation request: skipped/disabled, not an activated environment.

Historical green CI does not certify new source changes, App permissions, destination protection, hosted Development compatibility or Production readiness. See the eventual draft PR checks for its exact tested head. Windows execution must come from actual Windows CI, not simulated separators on Linux.

No database migration required by this change. A future Development repair may require separately reviewed additive SQL; no executable patch is justified by a finding count alone.

## Local results (Node22.21.1, Linux)

| Validation | Result |
| --- | --- |
| Backend quality group | PASS: 235 suites, 1,993 tests, zero failed/skipped; syntax780 files, frozen-history85 migrations, offline plan and quality policy pass |
| Frontend quality group | PASS: 122 suites,555 tests, zero failed/skipped; six priority-workspace tests pass; lint, localization parity/source and production build pass |
| Offline infrastructure/synchronization/security | PASS:573 tests, zero failed/skipped, including five new audit and nine Development-only regressions, plus existing protected-tree/publisher/provenance/recovery tests |
| Disposable PostgreSQL | All16 groups pass; no hosted Development/Production connection. Schema postflight0 findings and1,872 query plans passed. Groups: schema, P2P, contracts, settlement, finance, reconciliation, request workspace, devices, completion, receipt reporting, governance, RFID, events, SCOP foundation, guided requests and hosted recovery |
| Source security | PASS: staged new files included, no findings; synthetic credential fixtures use assembled values without scanner exemptions |
| Frontend build security | PASS after completed build; an attempted scan during build correctly returned BUILD_MISSING and was repeated after build completion |
| Locked artifact integrity | PASS: all105 artifact hashes preserved, manifest findings0, highest manual73; SQL073 remains manual-only |
| Existing destination SQL | All103 SQL blobs match combined source; SHA-256 values captured in bound JSON |
| Actual hosted Development startup | NOT VERIFIED: no fresh private report, approved repair, genuine current evidence or runtime postflight supplied |
| External staging / Production / publishing | NOT ACTIVATED / NOT AUTHORIZED; all execution hard stops unchanged |

One initial RFID gate also rejected its evidence because a synthetic test fixture was edited during execution. Its SQL scenarios were not reported as accepted release evidence; the stable-input rerun (`gate rfid --out quality-results/reconciliation-rfid-final`) passed. These deliberate fail-closed source checks were retained. No failing/skipped test was removed. Windows validation must be checked on the new draft PR's real Windows20/22 jobs; Linux path simulations are not claimed as Windows execution.
