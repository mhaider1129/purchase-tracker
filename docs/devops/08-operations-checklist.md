# Operations and acceptance checklist

## Implemented development checks

- [ ] Feature branch and draft PR reference the requirement, canonical source ownership and source-integrity dependency.
- [ ] Backend/API tests, frontend tests/lint/build/localization, credential checks and Node/platform compatibility pass with nonempty evidence.
- [ ] Raw inventory verification, historical SQL preservation, migration classification/dependencies and generated recovery-bundle reproducibility pass on clean Windows/Linux checkouts.
- [ ] Sync dry runs bind source/destination commits and show expected additions/updates/deletions/conflicts. Excluded environment/uploads/logs/dependencies remain untouched. No remote writes, force pushes, auto merge or circular triggers are implemented.
- [ ] Code CI artifacts say CODE_TEST_READY only; missing manual DB/staging/production acceptance is not implied.

## Required owner decisions before automation can progress

- [ ] Reconcile standalone main/recovery/feature branch differences and approve initial synchronization baselines; preserve all histories and local work.
- [ ] Configure destination CI, protected branches, required checks/reviewers and any supported no-bypass/no-self-review rules. Validate them with a separate reviewer.
- [ ] Approve least-privilege scoped GitHub App installation before implementing synchronization PR publishing. Current dry-run code has no publisher.
- [ ] Approve staging target, isolated network, PostgreSQL major/extensions, synthetic/sanitized fixtures, immutable image builder and independent credentials.
- [ ] Authorize/select complete manual disposable DB validation for the exact candidate, then separately approve staging schema setup and smoke/UAT.
- [ ] Resolve production DB reconciliation and obtain genuine current schema/runtime-role/evidence verification under separately authorized access.
- [ ] Verify backup recovery, immutable artifacts, monitoring, rollback ownership, production environment review enforcement and explicit release/cutover authorization.

## Routine release review once prerequisites are implemented

- [ ] Exact candidate SHA/digest passed code CI, all sixteen DB suites and staging smoke/UAT.
- [ ] Finance/inventory/approval/audit controls and institute isolation have acceptance evidence; no unapproved historical values changed.
- [ ] Application-only versus schema-changing release scope is explicit; production migration is separately approved and forward-only.
- [ ] Recovery service remains protected; no candidate workflow can overwrite its directory, port, process or routing.
- [ ] Logs, worker leases, outbox/dead letters, API health and authentication are monitored; operational acceptance and rollback decision are recorded.

## Assignment boundaries

GitHub repository metadata and source trees were accessed read-only for the audit; the combined review branch/PR and its non-production CI are the only intended remote writes. No standalone synchronization PR/write, repository setting change, staging provision, server login, production connection, SQL execution, deployment or merge is authorized here. The database fixture workflow was defined, not executed. Staging and both production workflow templates remain hard disabled. Run-specific test results and unresolved defects are recorded in the PR/completion report rather than assumed green.

Zero-command owner operation and the one-time activation review are specified in [09-zero-command-activation.md](09-zero-command-activation.md). Current activation blockers are intentional; no disabled workflow should be enabled merely by removing its condition.
