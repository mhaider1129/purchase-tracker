# PR109 recovery context and uncertainty-fence correction

Review baseline: `e987844da9e003f217aab0e1522d3b6bcee1ea7c`. Work remains on `codex/scop-persistent-staging` and existing draft PR109. The correction commit and authenticated per-commit CI links are recorded in the PR description; this document does not attest its own enclosing commit.

## Verified causes and changes

1. Recovery wrote the selected target into `previous` before handoff. With active C, previous A and target C, an interruption persisted C/C, losing A's eligibility. Recovery now persists a distinct context before preflight: original state and digest, complete original active/previous capsules, selected target, operation identity, stage, uncertainty and attempts. Handoff retains both release references. Subsequent reviewed recovery uses the preserved original snapshot, not container discovery. Successful recovery preserves the displaced active release where appropriate.
2. A recovery claim previously superseded an uncertain operation immediately. A DB preflight failure while phase remained ACTIVE then cleared `activeOperation`, allowing ordinary deployment despite unresolved Docker effects. Unresolved ledger entries and recovery context now fence independently of phase. Failed recoveries remain fences; attempted recovery records history without resolving predecessors. Only the successful terminal commit archives the context and resolves the full inherited set atomically.

Before each mutating call the controller durably records a pending effect and execution epoch. An error is not cancellation; an unacknowledged effect retains its fence. Acknowledged effects clear pending state only in their durable after-transition. Local monitor maintenance reloads are journaled too; a lost maintenance reply cannot be silently retried or race a later recovery. Completed commands still return recorded outcomes without re-execution; GitHub status delivery remains at-least-once.

For an unknown effect, same-boot recovery cannot proceed to maintenance/handoff/start/route. A separately reviewed restart of the **dedicated isolated staging host** may establish a new host execution epoch, after which a fresh approved request reconciles recorded releases and verifies actual traffic. The controller never reboots a host. Legacy uncertainty first records a real observation barrier and requires a later host boot; it never receives fabricated historical evidence. Missing or malformed pending-effect/barrier evidence fails closed. See [the recovery runbook](14-staging-database-and-recovery.md#quiescence-prerequisite-for-uncertain-effects) for prerequisites and limitations.

## Changed files in this correction

- `scripts/persistent/core.cjs`: explicit recovery context, inherited fences, pending-effect boundaries, host-epoch quiescence proofs, atomic resolution and preserved history.
- `scripts/persistent/agent.cjs`: independent unresolved-fence monitoring and durable local maintenance effects.
- `scripts/persistent/runtime.cjs`: fixed read-only host boot-ID reader; only trusted in-process tests supply an alternate path.
- `deploy/persistent/compose.yaml`: read-only host kernel boot-ID bind.
- `scripts/persistent/recovery.test.cjs`: original reproductions, checkpoint/storage faults, delayed effects, repeated failed recoveries, legacy barriers, malformed evidence and local maintenance uncertainty.
- `scripts/persistent/persistent.test.cjs`: existing low-level recovery fixtures explicitly supply operation identity and synthetic quiescence evidence.
- `scripts/persistent/gateway.integration.cjs`: real local adapter reads the actual local kernel boot ID without requiring the external controller mount.
- `docs/devops/14-staging-database-and-recovery.md` and this document: state machine, operator prerequisites, validation and remaining limits.

## Independently reproduced regressions

The same two exact tests were executed against the original committed core loaded in memory, without modifying repository sources:

- Crash after the recovery handoff checkpoint: failed because `previous` was C instead of A.
- ACTIVE state plus old uncertain operation, followed by valid recovery and failed DB preflight: failed because ordinary deployment was allowed (missing expected rejection).

Both failed on the baseline and passed with the correction. Additional tests cover both C and A as target, handoff and before/after stop/start/route boundaries, final ACTIVE-before-terminal interruption, and terminal write failure on either side of persistence. A remains selectable through a fresh reviewed request. Pending mutations require a separately modeled host boundary; no unintended starts occur while fenced.

The delayed-effect model actually delivers a timed-out old route callback while the controller remains fenced. Same-boot reviewed retries perform no application starts. Only a new modeled host boot, which terminates old-kernel pending work, permits fresh reviewed recovery. A second unknown mutation requires another boundary. This is a model of quiescence, not evidence of an external reboot drill.

## Validation evidence

Local validation used the working tree derived from the review baseline; dirty local results are explicitly **not authenticated deployment evidence**. Final committed-code CI results, including Linux/Windows jobs and real disposable gateway execution, must be inspected at the exact correction SHA in PR109 before re-review.

| Check | Local result |
| --- | --- |
| Original exact reproductions, baseline vs corrected core | 2 failures before / 2 passes after |
| Infrastructure, synchronization, release selection, security, staging, recovery, TLS and image-store regressions | 427 passed; zero failures/skips |
| Backend | 235 suites, 1,993 tests passed; zero failures/skips |
| Frontend | 121 suites, 549 tests passed; zero failures/skips |
| Frontend production build, lint and localization gates | Passed |
| Database path/governance/recovery-profile unit tests | 3 suites, 30 tests passed; zero failures/skips |
| Locked release artifact verification against Phase3B base | 105 unchanged; zero findings; no database connection |
| SQL073 | `manual_recovery_migration`; SHA-256 unchanged: `58122f8c2449dd50d37eaa229d9d622faf7be4e34d56848c999aec5a38285ca2` |
| Controller image and actual OS-lock/disabled-agent/archive components | Passed |
| Real disposable Docker/PostgreSQL16 HTTPS/mTLS gateway/controller test | `LOCAL_GATEWAY_VALIDATED`, HTTP200, database ready with zero findings, zero cleanup failures |
| Terraform1.10.5 init/validate | Passed with pinned checksum and locked provider; no plan/apply |
| Docker Compose rendering and shell syntax | Passed; no Compose activation |
| Pinned actionlint and source-security scan | Passed; zero findings |

Actual gateway cases exercise the production adapter and command controller: frontend/API access; login/JWT and institute isolation; healthy overlong-name frontend causing HTTP502 despite correct markers; disconnected candidate ingress recovering the prior release; rollback and completed-command deduplication; local maintenance and approved recovery without duplicate starts; missing release attestation rejected before handoff. They create only owned disposable synthetic resources and remove them with ownership checks.

## Safety and remaining activation blockers

No application features, SQL files, migration inventories, release contracts, credentials, approval policy or workflow permissions changed. No database migration is required by this correction. SQL073 remains manual-only. External staging, production and synchronization publishing switches remain false; their workflow hard stops remain unchanged. No standalone repository, production server, Supabase database, Nginx, PM2, emergency service or recovery worktree was modified. PR109 remains draft and unmerged.

Quiescence depends on one dedicated host/kernel, its authoritative local Docker daemon, intact durable state and the root-controlled boot-ID bind. Controller restarts and container inspection are insufficient. Remote daemons, cloned/restored authority, VM snapshot rollback, root compromise and out-of-band Docker mutations require separate review. Real host reboot/disk-full/power-loss drills, external network isolation, infrastructure provisioning, approved synthetic database initialization/evidence, secrets, independent approvals and browser/UAT acceptance remain unverified activation prerequisites. Production is not authorized.

Requested disposition after final CI is green: **READY FOR INDEPENDENT RE-REVIEW — DISABLED STAGING INFRASTRUCTURE ONLY**. This is not a merge or activation verdict.
