# Validation record and activation verdict

**BLOCKED FOR ACTIVATION.** Passing source CI is a code-readiness result. It does not approve the bootstrap decisions, App installation, governance-reader scope, destination writes, migrations or deployment.

Local verification during implementation:

- 168 infrastructure/policy tests passed, zero failures/skips. This includes 48 new publishing, provenance, bootstrap, protected-file and disabled-credential cases in the new suites.
- Real local Git histories back the simulated GitHub API: initial approved bootstrap, ordinary incremental sync, exact parent/history preservation for both applications, immutable blob identity, protected environment/credential files, retry idempotency, branch divergence, destination-head races, explicit deletion approvals, immutable existing SQL, additive SQL file proposals without execution, secret rejection and content-verified merged baselines.
- CI-evidence regressions reject PR/foreign/stale/dirty/missing/expired/ambiguous or source/build-mismatched evidence. The disabled CLI rejects publication before reading App credentials or making GitHub requests.
- Checked-in bootstrap metadata digest, source managed-tree digest and all 103 existing destination-main SQL blob identities verified. Regeneration against the pinned three repository/remote-branch snapshots is byte-identical. Thirteen decisions remain explicitly unapproved.
- Raw release integrity passes: 105 registered artifacts, zero findings, highest manual number 73. SQL 073 stays manual-only. No backend/frontend application or migration files are changed.
- Official pinned actionlint validates automatic workflows and the two destination CI examples. Its existing intentional constant-false exception now includes the disabled sync publisher; a regression allowlist still rejects hidden disabled ordinary CI gates.
- Source credential scans and final Git diff checks pass. New source files are scanned after staging as well as by automatic CI.

The implementation PR description records final latest-head GitHub Actions results and links once published. Automatic combined CI runs full backend/frontend quality gates, native Windows/Linux Node20/22 governance and the expanded infrastructure tests, security/workflow checks, and actual read-only destination plans. PostgreSQL fixture execution and publishing are not run by PR CI.

Not performed: App minting against GitHub, destination pushes/PR creation/settings changes, environment provisioning, destination end-to-end CI/merge rehearsal, hosted database connections, SQL execution, SSH, staging/production activation, recovery-service or recovery-worktree changes. The destination CI YAML files are templates awaiting separately authorized destination PRs, not installed workflows. Runtime/server state is not inferred from Git repository state.

Activation blockers:

1. Thirteen backend conflicts plus independent recovery/PG17 records need accepted upstream reconciliation and bootstrap approvals.
2. Combined/destination default-branch protections are not configured as required; actual required destination CI is absent or unverified. The current protection reader uses classic branch-protection metadata; ruleset-only configurations need separately reviewed equivalent support before activation.
3. App identity, selected repositories, scoped permissions, read-only governance credential and protected environment reviewers require separate approval/provisioning and real authorization rehearsal. If a destination becomes private, read-only clone/baseline access needs review; never reuse the publishing key in a planning job.
4. Workflow/policy hard stops remain intentional. A separately reviewed activation PR and controlled end-to-end publishing/retry/divergence rehearsal are mandatory.
5. Production deployment/database/recovery authorization remains entirely separate.

## P1 correction — 10 November 2026

The independent review correctly identified an implicit deletion defect: filtered planning omitted `config/.env` and `docs/CODEOWNERS`, so adding regular source files named `config` and `docs` could replace their complete destination directories without a deletion approval.

The exact regression first failed against `04d8bd08` with `Missing expected exception`. After correction, the same test passes, and the independent reproduction script exits 1 with `PROTECTED_OR_IMPLICIT_TREE_REPLACEMENT:config` before reaching its simulated tree write. No GitHub write, SQL or production operation was used for either result.

The correction adds complete unfiltered Git metadata parsing for source and destination (regular files, directories and opaque excluded symlink/Gitlink entries). Git tree hashes are independently recomputed; malformed, incomplete, unsupported, ambiguous, case-colliding or non-canonical trees fail closed. The projection applies only explicit operations, rejects ancestor/descendant collisions and operations on protected paths/ancestors, and checks that every untouched destination entry remains unchanged. Existing SQL edits/deletions remain unconditionally blocked for publication, regardless of ordinary deletion/bootstrap approval. Read-only analysis may still describe SQL differences as unapproved changes; that does not authorize publishing them.

Publication evidence now binds complete source/destination/projected fingerprints and the expected final Git tree SHA. Before any write, the publisher fetches and verifies the complete remote destination tree and reprojects it. It uploads changed source blobs only, then creates a new tree from the complete projected leaf manifest, including unchanged excluded destination entries. It no longer submits implicit replacements over `base_tree`. The returned SHA must equal the independently computed expected SHA; a second full, non-truncated recursive fetch must exactly match the projection before a commit, ref or PR can be created.

Local correction validation: **187 infrastructure/policy tests passed, zero failures/skips**, including 19 new regressions. Coverage includes the original reproduction; nested and reverse collisions; ordinary approval bypass attempts; destination-only descendants; legitimate sibling changes; explicitly reviewed managed file/directory transitions; opaque protected entries; Git-compatible UTF-8/directory ordering; and truncated, omitted, duplicated, malformed or incorrect generated tree responses. Unchanged bootstrap metadata regenerates byte-for-byte. All 105 locked release artifacts and all existing SQL bytes/hashes remain unchanged.

Current-head CI results are recorded in PR #107's description after publication. The implementation is submitted for independent re-review. Publishing remains hard-disabled in workflow and policy; the separate activation blockers above still apply. Real GitHub publishing and provider authorization have not been exercised.

The complete-tree implementation intentionally rejects unsupported empty subtrees and incomplete recursive API responses rather than silently dropping entries. Large trees that exceed provider completeness limits require a separately reviewed traversal strategy; no truncated snapshot can authorize publication. Pre-correction publication digests are not reusable because the new complete-tree binding is required and revalidated.
