# PR #106 blocker remediation and pre-merge re-review

Date: 9 November 2026. PR: https://github.com/mhaider1129/purchase-tracker/pull/106.
Branch: `codex/scop-devops-automation`. Original reviewed head: `0cd86411f4d4dd03f196a368aa1c6e6a149eb6d9`.

Verdict pending updated-head automatic CI. This document supersedes the two code blockers in the original pre-merge review; it does not authorize deployment.

## P1: Database evidence provenance

The defect was real: the manual run's API head SHA described dispatch A while a dynamic checkout could test B. The old selector consumed job conclusions without the tested checkout's gate artifacts.

Every matrix job now checks out immutable `github.sha` and verifies input SHA = dispatch SHA = actual `git rev-parse HEAD` before fixtures. After a successful gate it rechecks HEAD, clean source and policy digests and the actual log hash. It uploads a single JSON receipt bound to repository, workflow path, run ID, run attempt, actual tested commit and the complete gate report. All sixteen original suites and their transaction tests are retained, without executing them during this assignment.

The selector reads both the selected code-CI manifest and all sixteen database receipts through authenticated GitHub artifact IDs. It checks the downloaded ZIP's SHA-256 against authenticated API metadata before parsing, accepts only one bounded JSON file with the expected name, and never extracts or executes artifact content. The receipt digests are retained in the selection record. Repository/workflow/run/attempt, gate success/completeness, actual checkout, source and policy digests must match the successful selected CI and staging candidate. Missing, expired, old-attempt, duplicate, failed or inconsistent evidence blocks selection. Receipt timestamps expire after 30 days, independently of artifact expiry.

This is GitHub-authenticated producer provenance, not an assertion of external exactly-once delivery or independent SLSA signing. The repository and reviewed workflows remain a trust boundary. Required branch/environment review protections must be configured before activation.

Operational consequence: dispatch must reference the candidate's exact commit; the commit input is a consistency assertion, no longer a dynamic checkout override. A candidate whose branch has advanced must be selected again through genuine same-commit code CI. A partial rerun does not constitute a fresh sixteen-suite cohort: use GitHub's **Re-run all jobs** for a new acceptable attempt. Old receipts cannot be upgraded or fabricated.

## P2: Credential scanning

The scanner recognizes `sb_secret_` keys and structured JWTs whose decoded claims carry `role=service_role`. The detection inspects values in committed source, frontend variables (including innocuous aliases), and production frontend output. It does not need or log actual credentials and does not claim to validate JWT signatures. Public configuration, anonymous JWTs and publishable keys have explicit positive regression coverage.

Source and build use one strict UTF-8 reader. Oversized text (>32 MiB), NUL-containing text, malformed UTF-8, read errors and unsupported entries fail closed. The bound accommodates the existing approximately 13 MiB frontend source map; it is not a skip threshold. Recognized non-text document/image/font assets require both expected extensions and signatures; they are counted separately from scanned source text. An unknown binary/text format blocks review rather than silently disappearing. This remains a bounded credential-pattern scanner, not an exhaustive detector or a decoder of credentials hidden in binary documents.

The broad loopback/example-host exemption is removed. Only exact unusable port-1 dummy pairs remain inline. Existing synthetic examples/tests use individually justified whole-file SHA-256 exceptions scoped to `database-credential`; modifying any byte expires the exception, and no Supabase/private-key rule is exempted. Built output has no source exceptions.

## Regression and validation evidence

The initial adversarial run against the pre-fix implementation had 34 passing and **four failing** tests: dispatch A/checkout B, privileged Supabase values, oversized/unreadable text, and credential-bearing frontend build. The dispatch regression reported the expected missing rejection. Those cases pass after the corrections.

Local validation: backend 235 suites / 1,993 tests; frontend 121 suites / 549 tests, all passing with zero skips. Frontend lint, localization and production build pass. Offline infrastructure/policy regressions pass (final count recorded by updated-head CI). Linux governance/path/recovery: 3 suites / 30 tests pass. Source and built-output security scans pass; workflow lint and diff checks pass. Authenticated GitHub artifact parsing was also exercised against an existing code-CI manifest and its API-provided ZIP digest.

Updated-head Ubuntu/Windows Node20/22 CI verification is pending publication; no final green CI claim is made here before it completes.

## Scope and safety

Only combined-repository infrastructure code, workflows, tests and documentation are changed by this follow-up. The backend and frontend application trees, locked migration inventory and schema contract are byte-identical to the previously reviewed PR head. All 105 registered artifact records and existing SQL bytes/hashes are preserved; SQL 073 remains manual-only and highest_manual_number remains 73. No source-attestation or generated SQL rebinding is needed for root-level infrastructure changes.

The dependency `db877290` remains included through PR #106. No separate dependency PR or replacement PR is needed. The previous thirteen backend mirror conflicts remain explicit dry-run output, not permission to overwrite standalone work. Resolve the one-time ownership/bootstrap through reviewed automation before enabling a publisher; do not reintroduce owner-run manual synchronization.

Staging, production and production-database executors remain hard-disabled with fail-stop placeholders. No SQL workflow was dispatched, no migration was executed, no standalone repository was pushed, and no production/recovery backend, Nginx, PM2 or server configuration was accessed or modified. Automatic CI is migration-free. The separately confirmed manual disposable workflow can execute synthetic PostgreSQL fixtures if explicitly authorized; it is not a production migration capability.

Remaining activation work is unchanged: configure protected branches and environment reviewers; rehearse the complete CI/database/staging/UAT artifact exchange in an authorized isolated environment; implement reviewed deployment executors with post-approval revalidation and shared concurrency; reconcile production schema/runtime roles and verify backups/recovery. Hosted-runner networking is not an enforced deny-all network boundary. Passing this PR's automatic CI establishes code readiness, not live database compatibility or production authorization.

No database migration required.
