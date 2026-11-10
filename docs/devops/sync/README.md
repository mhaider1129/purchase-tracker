# Phase 2: controlled repository synchronization

**Verdict: BLOCKED FOR ACTIVATION.** The code and local Git/API fixture tests implement the publishing path; no destination write or credential provisioning is authorized by this PR. Review this plan and publishing permissions separately. Merging this infrastructure PR enables only the publishing-credential-free audit job after successful combined-master CI. Staging, production, SQL execution and the recovery service are unrelated and remain untouched.

## Current verified state (9 November 2026, Baghdad)

Authoritative source: `purchase-tracker/master` at `3d5d236c94300ad8551eca5f1731660a07b2b05c` (PR #106 merge).

| Destination | Observed main | Managed comparison | Protection and CI |
| --- | --- | --- | --- |
| purchase-backend | `70c4ee50bd0c8342eb30f573eacbd95f543a5e88` | 29 changes: 13 conflicting updates, 16 additions | main unprotected; one recovery-path workflow, no verified full Backend synchronization gate |
| purchase-frontend | `8a4ac51a52d30877c21e7300af9d4a1d5d410d6e` | NO_CHANGES | main unprotected; no workflow |

Combined master is also reported unprotected. These observations are metadata reads, not configuration changes. No publishing credentials were provisioned or read. Existing App installations/secrets are not asserted absent; the checked-in policy deliberately specifies no App identity or approval.

[bootstrap-proposal.json](bootstrap-proposal.json) is the deterministic, unapproved Git-object proposal. It includes complete before/after blob IDs and modes, all sixteen additions, all thirteen explicit `REQUIRES_UPSTREAM_REVIEW` decisions, existing SQL preservation evidence, and comparisons against both independent remote branches. Its proposal digest binds the whole document. No timestamp, fabricated synchronization receipt, migration receipt or claimed financial/database acceptance is generated. Regenerate offline from fresh disposable clones with `node scripts/devops/sync-bootstrap.cjs <full-source-sha>`; do not use or alter the recovery worktree.

All **103 SQL files already in destination main** match the canonical source's Git blobs. SQL 073 and the generated operator artifact are additions against that main, never executions. Recovery branch `2c2a4651a10a54a20a1f74dfade66260b8a1e46e` and PG17 branch `1541dd727e95700111f62ea93a30f1e6774f0fe5` have independent content and remain unchanged. Their generated recovery SQL has different bindings from combined source: preserve both existing histories/artifacts during upstream reconciliation; do not relabel an older artifact with a newer checksum.

## Initial reconciliation decisions requiring approval

The thirteen conflicts mean different real Git blobs plus no accepted synchronization baseline. They are not whitespace guesses or merge-conflict markers.

| Path | Verified difference and recommended review unit |
| --- | --- |
| config/db.js | Runtime identity Client/Pool integration; review atomically with runtimeDatabaseIdentity and tests; no live role change |
| database/releases/migration-inventory.json | Recovery/profile/source/073/operator inventory and attestation bindings; validate raw bytes, never merge or regenerate historical checksums blindly |
| docs/database-release-governance-7a.md | Diagnostic versus runtime acceptance and connection-mode documentation |
| docs/rfid-crash-recovery-7b.md | Explicit runtime verification instructions; no RFID policy change |
| docs/transactional-event-reliability-7c.md | Explicit runtime verification instructions; no event-processing policy change |
| package.json | Hosted-recovery fixture command; include its runner/modules without executing them |
| scripts/databaseRelease.js | Profile-aware diagnostic/runtime selection, search_path and restart denial; preserve fail-closed behavior |
| scripts/lib/databaseRelease/catalog.js | Visibility/comparison changes; upstream the independent PG17 extension/routine diagnostics before deciding final canonical content |
| scripts/lib/databaseRelease/inventory.js | Portable paths, profile/073/operator classification and locked source binding; preserve frozen migrations and manual-only 073 |
| scripts/lib/databaseRelease/planner.js | Explicit recovery profile selection and source-bound generation; no automatic migration plan override |
| scripts/testBackendContractRefresh.js | Hosted-recovery fixture routing; preserve disposable-only boundaries |
| services/databaseReleaseService.js | Role/visibility/profile handling; reconcile PG17 contract-version/extension diagnostics rather than overwrite them |
| tests/databaseReleaseGovernance.test.js | Highest migration and visibility expectations; preserve independent regression coverage |

Recommended order:

1. Review independent recovery/PG17 source into combined-repository PRs first where still needed. Preserve destination-only diagnostic code, documentation and attestation records; do not approve their deletion as housekeeping. A canonical preservation decision belongs in reviewed source, not an ad hoc publisher overlay.
2. Keep existing SQL immutable. Reconcile operator bundle bindings explicitly: retain the existing artifact, and use a newly named reviewed artifact if a new binding is needed. Never overwrite an existing `.sql` through the publisher, even with a deletion approval.
3. Regenerate the proposal from actual accepted commits and re-review changed blob pairs and all accompanying additions. Install/review destination CI separately before enabling credentials. This PR supplies examples but installs nothing remotely.
4. Approve bootstrap content in a protected combined-policy PR: each conflicting path needs `adopt-source`, exact before/after blob+mode, exact destination SHA, the approved source managed-tree digest and the change-set digest. Unknown destination-only files still block; only explicit deletion approval can remove a non-SQL file. Frontend can instead record its genuinely equal initial baseline after review.
5. Separately authorize publishing permissions and activation. First destination publication is a draft PR based on destination main, never a direct replacement or reset. Preserve the actual merged source/destination baseline after CI/review; do not fabricate a past synchronization.

## Architecture and authority

```mermaid
flowchart LR
  M[Reviewed combined master] --> C[Successful master push code CI]
  C --> A[Read-only immutable audit and plan digest]
  A --> G[Separately activated protected publishing environment]
  G --> V[Fresh source CI, policy and destination revalidation]
  V --> T[Single-target short-lived App token]
  T --> B[New branch and draft destination PR]
  B --> Q[Destination CI and independent review]
  Q --> H[Human merge; histories retained]
  H --> N[Content-verified next baseline]
```

`sync-plan.cjs` remains a read-only Git-object planner. `sync-publish.cjs` adds policy validation and the isolated Git-data/PR operations. `sync-release.cjs` orchestrates CI/approval checks, scoped token minting/revocation and audit artifacts. `sync-bootstrap.cjs` only describes immutable source/destination state. No application table, migration, contract, finance or inventory implementation changes.

Only a successful `Release quality` **push** run on this combined repository's master can trigger the new workflow. PR/fork/manual/foreign/development evidence is rejected. The actual checkout must equal the immutable control-plane workflow SHA, current protected master and the selected CI's tested SHA. The GitHub-authenticated code-manifest ZIP digest, clean source and policy digests, all required jobs, build IDs and run attempt must verify. Stale or incomplete data blocks. No untrusted workflow artifact is extracted or executed. An unchanged managed payload records NO_CHANGES without minting a publishing token. No publisher is triggered from a destination event, and no reverse sync exists.

A separate explicitly approved read-only governance reader supplies protection/check visibility without granting administrative permission to the publisher. Without it, inaccessible metadata blocks activation.

The read-only plan's publication digest binds the immutable source/destination commits, full change set, CI run/attempt and manifest digest, approved managed-tree digest and reviewed policy. Environment approval carries that digest through same-run `needs` outputs. After approval, fresh destination checkouts, metadata and regenerated plans must match it before an App token is minted. Source/default branch CI and required reviews must be verified first. Source master advancing makes an older candidate fail closed; the next passing cumulative source snapshot is authoritative.

Bootstrap approval binds **managed content**, not a self-referencing future policy commit SHA: `sourceTreeSha256` hashes `JSON.stringify([...tree(sourceRepo, sourceSha, prefix).entries()])`; `changeSetSha256` hashes `JSON.stringify({destinationSha,changeSet})`. This lets a later reviewed policy-only commit approve an unchanged app payload without pretending to know its own future Git SHA. The eventual actual source commit remains bound by verified CI. Non-SQL deletion approvals similarly require app, path, exact old blob/mode, destination commit and source-tree digest. See tests for concrete objects.

Normal publication creates a complete projected Git tree for the exact destination parent, copies only immutable changed source blobs with Git identity checks and source credential validation, and adds a new child commit. Complete unfiltered trees are inspected before approval: implicit ancestor/descendant replacements cannot delete excluded or destination-only content. Publication binds the projected full tree, revalidates the full remote destination before writes, submits a complete leaf manifest, and verifies both the generated Git tree SHA and its full recursive contents before creating any commit/ref/PR. Ordinary bootstrap/deletion approvals cannot override protected-entry preservation. See the [P1 correction validation](validation.md#p1-correction--10-november-2026). Executable modes and destination-protected files are preserved. Existing SQL updates/deletions are always blocked; new additive SQL may be proposed but never run. Missing/invalid UTF-8 or oversized text is rejected; known binary assets use the existing strict reader. Hash-bound synthetic fixture exceptions remain exact and rule-specific. Protected `.env*`, workflows, uploads, caches, node_modules and credentials remain excluded.

Branches have deterministic names `scop-sync/<app>/<source-sha>-<destination-sha>`. The commit identity/time and provenance are deterministic. A retry can reuse only an identical branch commit and open PR; a divergent branch or previously closed PR requires review. There is no force update, default-branch write, branch deletion, merge API or auto-merge. Destination-head changes are checked before writes, before branch creation and before PR creation. Concurrent external changes after the last check are resolved by strict up-to-date destination CI, stale-review dismissal and human merge—not by claiming an atomic cross-repository transaction. Interrupted object uploads may leave harmless unreachable objects or an unmerged branch; audit and inspect, never force repair.

After a genuine merged App-authored synchronization PR, the next run reads its immutable head provenance and actual merged destination commit. Both source/destination ancestries and the complete managed-tree equality are verified before using it as the next baseline (including squash merges whose merged tree matches). A PR author/trailer alone is insufficient. Unmerged PRs and independently edited destinations cannot become accepted baselines. History lookup is bounded to ten pages/1,000 closed PRs and fails closed when incomplete; no receipts are invented to get around this limit. Source changes only, destination divergence, initial conflicts and deletions keep their existing planner semantics.

## Audit, retry and rollback

Artifacts retain per-app plans, publication digests, source CI/build IDs and manifest digests, exact base commits, decisions/blockers and success/blocked status. Successful destination commits/PRs carry the same source/CI/provenance. Failed runs upload a sanitized fixed error category; GitHub retains the run, App actor and any unmerged branch. Treat an API timeout after a successful write as uncertain until a same-candidate retry verifies the deterministic commit/PR. PRs are drafts with maintainer modification disabled; owner/reviewer marks ready after inspection, and destination CI/review remain mandatory.

Workflow and per-app concurrency use `cancel-in-progress: false`. GitHub may replace an older pending run with a newer pending run; this is not a durable FIFO. Full cumulative source snapshots and revalidation preserve correctness. Re-run the latest eligible CI/workflow if an older snapshot is rejected; do not move a destination ref backward.

Disable publication by reverting the activation workflow/policy or revoking the App installation/key. This stops future PR creation, not runtime applications. Close an unmerged sync PR through review if needed. For an already merged source error, create reviewed forward/revert commits in combined source and synchronize through another CI-reviewed PR; never reset/force a destination history. Existing SQL cannot be reverted by this publisher; use approved additive migration/recovery procedures separately. Do not touch the live recovery service.

## Required configuration and activation

See [activation.md](activation.md) and the [validation record](validation.md). Until all prerequisites and the first controlled source-to-destination rehearsal are separately approved, the verdict remains **BLOCKED**, even if combined CI is green. Automatic combined CI performs local fixtures/static checks only; no publishing secrets or destination writes are available there. Real App authentication and end-to-end PR publication have deliberately not been exercised in this assignment.
