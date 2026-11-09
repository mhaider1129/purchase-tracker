# Rollback and disaster recovery

These are decision procedures, not authorization to access or change infrastructure. No recovery worktree, snapshot, backup, database or live service was modified. Keep the emergency recovery backend and routing untouched during candidate preparation; its restoration/traffic use requires a separately approved operation if it is not already serving traffic.

| Failure | Immediate decision | Recovery requirements |
| --- | --- | --- |
| Frontend artifact incorrect | Block promotion; preserve exact failed digest and logs | Select previously verified frontend artifact compatible with active API; approve routing/static switch and retest authentication/workflows |
| Backend startup/health failure | Keep traffic on the existing service; do not repeatedly restart it | Diagnose isolated candidate logs/schema/role mismatch; select prior compatible artifact or a reviewed forward correction |
| Authentication failure | Stop rollout; preserve safe request IDs and token-free diagnostics | Verify origin/API configuration, identity provider/runtime contract and prior artifact compatibility; never disable auth to make health green |
| API/frontend mismatch | Block cutover | Bind matching version IDs and artifact digests, rerun safe smoke tests and operator acceptance |
| Database preflight failure | No migration execution | Review genuine schema, permission, RLS, role and evidence differences; do not bypass validation |
| Migration execution failure | Determine rollback/commit state before retry | Verify transaction result and preservation; use reviewed forward repair or separately authorized tested restore/reconciliation |
| Incorrect commit released | Stop promotion and retain evidence | Identify approved prior artifacts, compare DB compatibility, authorize bounded application rollback and monitor business invariants |
| Worker/outbox regression | Block further rollout and preserve pending evidence | Verify leases/idempotency and supported prior worker protocol; do not delete queues or fabricate delivery acknowledgments |

Application rollback changes executable artifacts; it does not reverse schema/data changes. An older application may be incompatible after an additive migration or worker protocol change. Verify before use.

Database recovery is a separate financial/operational event. It can lose committed work and invalidate stock/AP/payment/audit continuity. Require a tested backup, restoration into an isolated target, comparison against authoritative business evidence and an explicit plan for transactions committed after the snapshot. Never assume `migrate:down`, blind snapshot replacement or deleting new tables is safe.

Record incident/candidate/prior source IDs, digest, operator and approvals, timestamps, symptoms, request IDs, affected scopes, backup identity, chosen correction, smoke results and remaining reconciliation. Do not include patient identifiers, secrets, connection strings or raw financial records in public GitHub artifacts.
