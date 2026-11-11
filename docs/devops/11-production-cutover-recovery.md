# Production readiness, cutover and recovery — preparation only

No operation in this document is authorized by merging the Phase 3 PR. Production cutover is a separate, explicitly approved change. Preserve current `wici-recovery` on port **5051** and its Nginx routing. Do not reuse its working directory, credentials, process name, port, worktree or worker leases.

## Go/no-go evidence

Require one immutable combined-repository SHA with successful code CI, complete current sixteen-suite database evidence, PG16/17 rehearsal results, authenticated isolated staging deployment and independent owner UAT. Verify source/artifact IDs, digest, run attempt, age and completeness through the existing release selector; manually written booleans/JSON are not approval. Existing selector requires protected staging/production environments, branch protections and genuine staging deployment metadata. This PR does not weaken those requirements or supply artificial records.

Before considering cutover, a separately authorized operator must capture the **actual production** schema and verify contract, RLS, permission catalog, function signatures, runtime authority, migration evidence and exact release attestation using a scoped read-only verifier. Absence of a migration receipt means unverified execution, not proof a migration was never run. Review data-preserving discrepancies and actual migration prerequisites. Do not regenerate locked artifacts, bypass validation, disable RLS, fabricate receipts or assume SQL072 repairs unrelated AP/contract differences. Runtime role must follow the approved trusted-server architecture without ownership, DDL or release-ledger write authority. BYPASSRLS is an explicit current server contract, not general authorization to use the owner `postgres` login.

Backup prerequisites: verify a current consistent database backup/PITR position, retention, encryption/access, restoration drill and achievable RPO/RTO. Include application attachments and integration identifiers where applicable. Use authorized recovery staff and documented evidence; merely having a backup filename is insufficient. Production access and backup execution are outside this PR.

## Separately approved sequence

1. Review candidate, operational outage risk, database compatibility report, release manifest, worker protocol, rollback artifact and independent approvers. Resolve every critical blocker; keep recovery routing active.
2. Approve only necessary additive migrations individually, with lock/runtime estimates and populated-restore rehearsals. A distinct authorized operator applies them manually after verified backup. No automatic migration job or frozen replay. Verify postflight and genuine release evidence before deployment.
3. Provision a separate candidate slot alongside recovery using the exact previously tested artifacts/images. Select a separately approved unused loopback port; **do not bind 5051**. No mutable branch pulls, arbitrary rebuild or unverified source at deployment time. Give it independently provisioned runtime credentials and scoped storage.
4. Verify production compatibility before starting its workers. Define worker handoff explicitly: do not let old/new scheduled jobs compete merely because HTTP candidate health is green. Use existing durable leases/idempotency, but do not assume every timer is protected. Keep candidate background execution isolated until an approved handoff mechanism is demonstrated; this is a current cutover blocker.
5. Start candidate without replacing recovery, verify gated startup, identity/authentication, read-only authorized document access and worker readiness. Never create test POs, payments or stock mutations in production without a separately approved controlled test. `/health` alone is insufficient.
6. An independent reviewer explicitly approves a GitHub Actions production environment. Only a separately reviewed activated executor may update routing atomically, validate the candidate target and verify public health. This PR retains a hard-disabled production executor and includes no Nginx/PM2 changes.
7. Monitor 5xx/latency, authentication, permission denials, pool saturation, worker leases, outbox queue/dead letters, audit failures and inventory/financial integrity. Record source SHA, artifact digest, approver, timestamps, old/new route and correlation IDs without clinical/credential payloads. Obtain operational acceptance before retiring anything.

## Rollback triggers and actions

Triggers: startup/database gate failure, health/readiness timeout, elevated 5xx/login failure, unauthorized disclosure, missing audit/outbox evidence, financial/inventory invariants failing, stuck/duplicate workers or failed public smoke. Block traffic promotion when any trigger is present. A failed candidate must not remove the healthy recovery route.

Before cutover: stop only the candidate slot; keep recovery unchanged. After an approved traffic switch: an authorized executor/operator restores the verified previous route atomically, validates public authentication and read-only smoke, stops candidate workers safely, and records rollback success/failure. If previous service is unhealthy or schema is no longer backward compatible, declare incident/escalate; never report successful rollback merely because a command exited zero. Retain both artifacts and diagnostic evidence.

**Do not automatically reverse SQL or restore the database as application rollback.** Committed hospital transactions after a release must be preserved. Classify schema compatibility before reusing the old app. Use forward repair where safe; any restore/PITR requires separate clinical/financial reconciliation, outage authorization and recovery plan. Do not delete new operational records or fabricate old audit/history.

## Current unresolved blockers

Production schema compatibility, backup/recovery capability, candidate port/service boundaries, TLS/database trust, worker handoff, external staging/UAT, protected-environment configuration and activated production executor have not been verified. Backend production DB TLS currently uses `rejectUnauthorized:false`; assess and fix trust configuration separately before cutover rather than copying that pattern into staging. A passing local/CI rehearsal cannot remove these blockers. Production remains **NO-GO**.
