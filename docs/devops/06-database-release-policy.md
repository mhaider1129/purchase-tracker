# Database release and source-integrity policy

The existing backend inventory, schema contracts, overlays, planner, runtime role checks and attestation mechanisms remain authoritative. This infrastructure change does not edit application/SQL hashes or regenerate any expected database catalog. The reviewed path/source-binding dependency preserves all historical SQL. CI calls verifyFiles and frozen-history comparison against the protected base; any historical mismatch must stop review rather than rewriting history.

## Separate gates

| Stage | What it establishes | What it cannot authorize |
| --- | --- | --- |
| PR/branch static integrity | Registered raw SQL/source bytes, classification, frozen history, dependency plans and bundle reproducibility | SQL execution or hosted compatibility |
| Manual disposable validation | Existing synthetic transactional, financial, inventory and worker fixtures on fresh loopback databases | Staging/production readiness or historical migration receipts |
| Approved staging migration | Additive target-specific behavior, schema/role compatibility and preservation in an isolated approved environment | Production execution |
| Production migration approval | Exact source/SQL manifest, genuine preflight evidence, target identity, verified backup/recovery and human operation authorization | Replay of frozen migrations or implicit recovery bundle execution |

No migration execution is reachable from a pull-request workflow. The original sixteen PostgreSQL suites remain in gates.json and are available only through the explicitly confirmed workflow_dispatch fixture workflow. That workflow was not dispatched during this assignment. It receives no hosted database or notification credentials. Existing runners create their own fresh loopback Docker databases and validate disposable identity; they currently pin PostgreSQL 16. Verify the intended deployment major/extensions before approval; the separate PG17 restore is not automatically equivalent.

Production migration and application release workflow definitions remain hard disabled. No executor, production SQL credential or automatic attestation writer is introduced. The read-only release diagnostic must never fabricate missing SQL 069–073 receipts or infer applied history from filenames. Preserve UNVERIFIED history until genuine evidence supports a new reviewed baseline.

## Migration lifecycle

New schema work is forward-only and additive wherever possible, with explicit canonical ownership, concurrency/audit behavior, dependency order, preservation checks and rollback/roll-forward instructions. Review exact SQL bytes and complete execution boundaries. Test non-production compatibility only in an independently authorized environment. Do not execute recovery bundles as a routine migration or from CI PR jobs.

A production preflight must verify actual target identity and authority, schema/function signatures, RLS and grants, permission/UI codes, required worker migrations, accepted execution evidence and source/schema attestation. Missing or ambiguous evidence blocks release. Failed preflight makes no writes. Use transactional execution where supported; lock/statement timeouts, ownership restrictions and exact checksum binding remain mandatory. Record real execution only when the approved operation actually occurs.

Backups must be readable, recoverable and tested in an isolated target before a risky migration. After failure, inspect transaction outcome, schema and business invariants; ambiguous commit state needs reconciliation. Do not automatically rerun a command, reverse posted financial values or restore an old snapshot over live data. Prefer a separately reviewed forward correction. Database restore/recovery requires finance/inventory reconciliation and its own authorization.

Existing full `scripts/quality/release.cjs manifest` still rejects incomplete database evidence; this PR's code-only collector uses a different kind/status and cannot stand in for that release manifest.
