# Persistent staging database and recovery plan

## Authority and initialization

Only synthetic hospital/institute/user/item/supplier/financial fixtures are allowed. Do not copy production Supabase data, dumps, credentials, patient identifiers, settlement records or bank details. Application startup continues to require the locked `hospital-erp-2026-11-scop1` contract, correct actual runtime authority/RLS/grants, genuine execution receipts and **the selected commit's** release attestation.

The persistent deploy agent performs no migrations or seeding. Its preflight launches the exact candidate image with the canonical CLI:

`node scripts/databaseRelease.js verify --connection-mode runtime --environment staging --release <exact-tested-SHA>`

The existing CLI opens a read-only transaction. Host-generated `DB_RELEASE_READONLY_URL` selects the same local `purchase_backend` identity as the application. No role override, owner login, hosted URL, schema profile override, receipt insertion or approval-engine activation is permitted. Backend startServer then repeats its normal fail-closed startup verification before workers/listening. DB failure occurs before planned maintenance or stopping the previous service.

## Separately approved initial preparation

SQL072 is not an empty database installer. The current canonical dependency model is: schema-only reviewed snapshot + SQL059 → permission/UI catalog 060/061 and canonical contracts 064/065/066 → completion/acceptance 067/068 → governed controls 069 → RFID recovery 070 → transactional events 071 → SCOP foundation 072. Some prerequisite functions must precede later contract patches; use the proven Phase 3A fixture sequence when reviewing this dependency graph, not numerical filenames alone. Preserve SQL files/checksums and verify actual prerequisites before every operation.

The existing disposable bootstrap is intentionally restricted to a newly created loopback `p2p_disposable_<random>` database; **do not remove its guard or point it at persistent staging**. It is a reference/test harness, not a persistent installer. Before activation, the DB owner must separately review an explicit empty synthetic-schema bootstrap for staging, provision the canonical roles, and execute the appropriate reviewed transaction bundles in the staging environment. The canonical planner intentionally refuses frozen replay. If the approved initialization strategy needs a new governed baseline/bootstrap, develop/review that forward-only change separately; do not reclassify SQL069–071 in the locked manifest or manufacture receipts to make startup green. This remains an explicit activation blocker.

Use a non-owner application identity meeting current canonical server architecture, without persistent DDL or release-ledger writes. Current architecture explicitly requires trusted-server BYPASSRLS, while tables retain RLS and server-side institute/object authorization. This is not permission to use `postgres` or disable RLS. The current adapter uses a direct `purchase_backend` login: the separately approved staging initialization must set its LOGIN/password without granting ownership/DDL, since SQL069 initially creates a NOLOGIN grant role. Do not change production identities. Keep an owner credential only for separately approved DB operations, never inside application or CI environments.

For every new release SHA, arrange real staging-compatible release evidence/attestation through approved governance before requesting application deployment. Unchanged schema does not allow fabricating a new release attestation. `db:plan` is offline, `db:verify` is read-only; neither constitutes authorization to execute a migration. SQL073 remains **manual_recovery_migration**, excluded from automatic planning; the existing hosted-shape disposable regression is a test, not permission to replay it into persistent staging.

## Rehearsal and postflight evidence

- Require successful source CI and Phase 3A PG16/17 runtime + all sixteen canonical transaction suites for the same immutable source. Rehearsal report artifact IDs/digests and actual tested commit are checked; HTTP 200 alone cannot substitute.
- Rehearse future approved additive migrations on a disposable synthetic populated restore, checking quantities, AP/payment allocations, contract history, approvals, audit/outbox, RLS/grants, signatures and rollback on failure. Static migration review flags destructive DDL, type/nullability, data writes and authority changes; any SQL change requires manual review.
- Postflight the actual persistent staging database using its real runtime role, observe zero schema/permission/evidence findings, confirm canonical AP/inventory totals and preserve all historical synthetic records. Record actor/reviewer, exact SQL hashes, timing, result and release SHA. Missing receipts mean unverified execution, not proof SQL was never run.

## Application rollback and crash recovery

Before handoff, DB verification and container preparation occur while the previous application remains active. Handoff displays maintenance, stops/verifies the previous worker process, starts and checks the candidate, validates/reloads the gateway route and verifies its release marker. Stopped previous containers, images, runtime files and upload directories are retained. No global Docker prune, source force update or destructive data cleanup exists.

An approved rollback selects only the exact retained previous commit. Its DB compatibility is verified **before** stopping the current application. If intervening schema changes invalidate that version, rollback is blocked; use an approved forward repair or separate database recovery plan. Application rollback never runs SQL rollback, resets stock, reverses accounting or restores a snapshot over new records.

Agent crash during `PREPARED`, `HANDOFF` or `RECOVERY_REQUIRED` refuses blind replay. Review the fsynced state/audit journal and independently approve `recover` for the retained previous SHA. Recovery stops known candidate/previous processes, verifies DB compatibility, starts the retained previous release, proves health and restores its route. If recovery fails, keep maintenance, report failure and escalate. The first deployment has no previous release; failed initial activation stays explicitly unavailable.

OS `flock` releases automatically when its process/container dies. State transitions persist; do not delete lock/state files, edit state to ACTIVE, restore a different volume or fabricate success to bypass recovery. A crash after ACTIVE persistence but before GitHub acknowledgment can be acknowledged without repeating business mutations. Failed status delivery is retried from a durable status record.

Test disk-full/audit-write failure, proxy/GitHub outage, database loss, gateway validation/reload failure, process termination at each transition, host reboot/missing volume and failed prior-release startup externally before acceptance. Local adapter tests prove sequencing/failure decisions, not real host networking, crash durability or external traffic recovery.
