# Priority Management timeout investigation and correction

## Evidence and limits

The owner-supplied terminal transcript reports a healthy deployment of combined commit `29a1562c614349ce3b1409b7c91b5fe2760ed942`. Later authenticated `/api/users/me`, notifications and UI access requests complete in roughly 70–150ms. Repeated `/api/procurement-priority/requests/manage` access lines have no response status, matching the browser's cancellations at the API client's existing 15-second timeout. A separate earlier missing-token request and historical recovery/startup permission errors are not evidence that these later requests failed authentication.

No production server or database was accessed. The transcript contains no current query plan, lock-wait measurement or completed management SQL error, so an exact production wait/cost attribution is unavailable. The source contains two concrete amplification defects: management embeds a ranking CTE across all institutes and invokes canonical completion repeatedly per case/item; focus/visibility/timer refreshes can overlap an unresolved initial request. Those are corrected here without increasing the global HTTP timeout.

## Changes

- Scope candidate requests by the authenticated institute **before** evaluating canonical completion and HOD decisions. Materialize canonical completion once per candidate request, then reuse its request/item flags for the existing active-case rules.
- Compute departmental request positions over that same active scoped set. Preserve whole-request ranks, most-urgent-item scoring, non-superseded HOD decisions, terminal/rejected/purchased/stock exclusions and group multiplicity. Require matching institute ownership on requests/cases/profiles and displayed groups.
- Keep the canonical completion function authoritative; do not substitute purchased quantities for fulfillment or change approval/financial state. Other queue callers retain the original default SQL helpers.
- Management reads use a repeatable-read, read-only transaction and an eight-second transaction-local statement deadline. Cancellation is converted to a sanitized, retryable HTTP504. Transaction rollback releases resources and resets the setting; no global database setting changes.
- Coalesce automatic refreshes with the initial request. Abort obsolete/unmounted loads and ignore late results. A successful write or explicit conflict reload cancels a pre-write background read and requests a fresh snapshot. Show a localized timeout message and Retry button; preserve the existing 15-second shared Axios timeout and authentication interceptor.

## Validation

The new `npm run test:priority-queue-postgres` uses the existing pinned PostgreSQL16 disposable-container runner, a generated loopback-only database and synthetic fixtures; no application environment URL or hosted data is used. It compares the pre-change SQL oracle with the optimized query, including multiple items/groups, active ranks, unapproved requests, partially stock-resolved requests, terminal/closed/rejected/purchased exclusions and foreign-institute records. It also verifies deadline cancellation/rollback and that the setting does not leak into later work.

A deliberately instrumented synthetic completion function records **162 evaluations before versus 6 after**, with identical valid queue rows/ranks and no foreign-institute completion evaluation after the change. The instrumented function is a transactional test fixture, not a modification to the application's canonical function or proof of production milliseconds. A production index/lock issue could still need further read-only diagnosis if timeouts persist.

Targeted backend/HTTP permission tests and frontend tests cover unauthorized access, forged institute filters, sanitized timeouts, overlapping refreshes, StrictMode, unmount cancellation, retry, and stale reads following assessment saves. Final full-suite results are recorded in the PR.

## Authorized source attestation refresh

The owner explicitly authorized the six source-attestation updates and generated bundle/reproducibility bindings on November 27, 2026. The inventory now verifies with zero findings. Latest master (`9bee5827`) was merged; both assigned-purchase and priority-timeout English/Arabic messages are preserved.

[priority-queue-attestation-proposal.json](priority-queue-attestation-proposal.json) records the six source hashes and applied aggregate digest. The aggregate changed from `9ae4b2541a3d23ff93c040386361a6fafbc43ae5976b491af14a94092f02c624` to `5e5e8b8b357b2f7f16f0d3431f50c8d1beba602c315cc70388801df00b372e62`. The existing offline generator produced release reference `wici-priority-queue-2026-11-27-r1`. Byte comparison proves that only the release-reference and source-digest bindings changed; SQL bodies, permissions, prerequisites and schema-contract hashes are unchanged. All 104 other inventoried artifacts retain their hashes; SQL073 remains manual-only. The reproducibility test now verifies the newly authorized current-source binding rather than substituting the archived digest. No SQL was executed and no database receipt or attestation was created.

No database migration is required by the priority fix. Transaction-local query settings and synthetic fixture SQL are not production schema patches. Do not apply old migrations, grant schema-wide privileges or change JWT secrets to address this timeout.

## Rollout after approval and passing CI

Review and merge the focused fix, then use the existing manual combined-to-standalone synchronization and SSH deployment workflow. No production, staging or synchronization publisher is activated by this PR. Verify the management request finishes without overlapping automatic refreshes; check that active queue membership and departmental positions remain correct. A returned504 is a bounded failure requiring investigation, not an empty queue or successful load. If necessary, roll back through the existing deployment journal; never reverse inventory/financial data for a read-view performance correction.

Post-refresh local checks: all 566 frontend tests (124 suites), strict frontend lint, production frontend build, source/build credential scans, all 175 development-automation regressions, and both disposable PostgreSQL tests pass. All 2,017 backend tests (237 suites) and 372 staging/security/readiness regressions pass with no skipped tests. GitHub Windows/Linux validation must be checked against the pushed head; local Linux results do not establish Windows execution.
