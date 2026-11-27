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

## Governance approval blocker

**This draft is not deployable yet.** Automatic approval review rejected refreshing the locked source attestations and generated recovery bundle without separate, exact authorization for this branch. No workaround is used: those files and every historical SQL/checksum remain unchanged. Existing checksum gates therefore intentionally fail for the five modified registered sources and the new management query source.

The concrete proposal is [priority-queue-attestation-proposal.json](priority-queue-attestation-proposal.json): six reviewed source entries, their old/new hashes, the proposed aggregate source digest, and three requested governance files. Approval would permit only source-attestation updates, refreshing the generated bundle's source-digest/release-reference bindings under `wici-priority-queue-2026-11-27-r1`, and updating its reproducibility test. After approval the exact generated SQL-body comparison and all governance tests must pass. No authorization to execute that SQL, fabricate receipts, change schema contracts or alter historical migrations is requested.

No database migration is required by the priority fix. Transaction-local query settings and synthetic fixture SQL are not production schema patches. Do not apply old migrations, grant schema-wide privileges or change JWT secrets to address this timeout.

## Rollout after approval and passing CI

Review and merge the focused fix, then use the existing manual combined-to-standalone synchronization and SSH deployment workflow. No production, staging or synchronization publisher is activated by this PR. Verify the management request finishes without overlapping automatic refreshes; check that active queue membership and departmental positions remain correct. A returned504 is a bounded failure requiring investigation, not an empty queue or successful load. If necessary, roll back through the existing deployment journal; never reverse inventory/financial data for a read-view performance correction.

Local development checks: 61 priority backend tests, 561 frontend tests, strict frontend lint, the production frontend build, build-output credential scanning and two disposable PostgreSQL tests pass. The complete backend run passes 2,003 tests and fails ten governance/startup checks across four suites because the six source bindings remain intentionally stale. Official release-quality gates stop on those same six findings before running either group; underlying development checks are not represented as passing release gates.
