# Developer and owner workflow

## Normal feature delivery

The owner describes the workflow, users, institute scope, approval behavior, data preservation rules and acceptance examples in ChatGPT. The technical specification should name canonical source records, required permissions, concurrency/audit behavior, API/UI changes, migration needs, flags, tests and rollout limits. Separate requested behavior from hypotheses.

Codex inspects the implementation and creates a dedicated combined-repository branch. Application changes require tests and reviewed byte-accurate source attestations; never regenerate locks just to reduce failures. Preserve historical SQL. Open a draft PR to master, link the requirement and include validation results, database requirements and rollout risks. Do not merge automatically.

Branch pushes and PRs run backend tests/API contracts, syntax, frozen-history/plan checks, frontend tests/lint/localization/build, credential checks, native Windows/Linux integrity and governance, and read-only synchronization audits. The owner reads checks and artifacts in GitHub; no routine local Git Bash synchronization, checksum calculation or test command is needed.

Review `code-ci-manifest`, per-gate logs/test counts, platform results and `synchronization-dry-run`. A sync job can successfully produce a plan requiring reconciliation: that is a truthful dry run, not permission to overwrite a destination. Resolve conflicts in reviewed source changes first. Nonempty/stale/dirty/failed test evidence cannot be used as full release evidence.

For schema-sensitive releases, an authorized operator separately selects the exact commit in **Manual isolated database validation** and explicitly confirms disposable-only execution. Never use a production URL or operator bundle as input. This workflow is not triggered by a pull request. It was not executed as part of this assignment. Its reference runners currently use PostgreSQL 16; validate the intended target major/extensions before staging, including the PG17 restore differences already under separate review.

The owner reviews staging smoke results and UAT only after an isolated target has been approved and provisioned. Current staging/production templates are hard disabled, so a green CI run does not deploy anywhere. Production requires independently verified approvals and explicit operational authorization.

## Interpreting integrity failures

- A raw checksum mismatch remains blocking. `CRLF_CHECKOUT_CONFIRMED_STILL_BLOCKED` means LF-normalized bytes match the registered hash; the diagnostic does not alter or accept them.
- `WORKTREE_DIFFERS_FROM_LOCKED_GIT_BLOB` identifies a workspace difference when the Git blob matches the lock.
- `CONTENT_OR_LOCK_DIVERGENCE_REQUIRES_REVIEW` means a stale lock, different source branch or substantive edit needs investigation; do not assume line endings.
- Unregistered SQL, migration classification drift and historical edits require source review. If historical content differs, stop; no automatic rewrite or new checksum is allowed.
- Intentional current application-source changes need narrowly reviewed source/aggregate renewal and, where applicable, offline generated-bundle rebinding. Compare complete bundles allowing only legitimate binding substitutions. Never execute a recovery artifact to repair source tests.

Optional local commands for developers (not an owner operating requirement):

```text
node scripts/devops/integrity.cjs --base-ref refs/remotes/origin/master
node --test scripts/devops/automation.test.cjs
node scripts/devops/security.cjs
```

CI performs clean npm installations and uses LF checkouts through the existing `.gitattributes`. No blind `git add --renormalize` or repository restructuring is part of this change.

## Security check scope

The local credential gate detects private keys, common provider/access tokens, Supabase secret keys and structured service-role JWTs, credential-bearing database URLs and active committed environment assignments; the build scan also rejects private frontend environment variables and noncanonical CI API targets. It is not a guarantee that arbitrary novel secrets cannot exist; retain provider scanning and human review. Individually reviewed pre-existing synthetic URL fixture/template files have narrowly scoped database-credential exceptions in security-exceptions.json, bound to exact raw whole-file SHA-256 values. Any byte edit expires an exception, and no private-key/provider-token rule is exempted. No blanket test-directory exclusion is used. The production build scanner applies no such source exceptions.

Workflow lint uses checksum-pinned actionlint 1.7.12. Its only ignored diagnostic is the intentional constant-false condition on the three disabled staging/production templates; regression tests forbid that guard in ordinary checks. Do not remove a safety stop to satisfy a lint suggestion.

The owner-facing zero-command sequence and one-time replacement of manual delivery are in [09-zero-command-activation.md](09-zero-command-activation.md). Deploy to Production is a manual evidence-ID selection with required environment review; its executor remains hard disabled.

Source and build text scanning fails closed on read errors, invalid UTF-8, NUL-containing text and text exceeding 32 MiB. Recognized non-text assets require both a known extension and signature; they are counted separately. Public Supabase publishable/anonymous keys remain allowed in public aliases. See [the blocker remediation review](10-premerge-review.md) for evidence provenance and activation limits.
