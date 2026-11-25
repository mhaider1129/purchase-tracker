# Offline validation evidence

Executed 24 November 2026 on Linux with Node 22.21.1. Runtime source is exactly merged `180ea21c2d8bf233457a6ef6c6ede4bfceea0886`; observed input is `7a896cbe23c3708fb2e183f65df96389151eaffc`. The final PR head and remote CI status are recorded in the PR, not fabricated inside this document. No Windows execution or hosted database validation was performed locally.

| Check | Result |
| --- | --- |
| `node --test scripts/devops/development-schema-audit.test.cjs` | 8/8 pass, no skips: quoted SQL parsing, malformed context evidence, type precision, nonexecuting literal evaluator, dynamic SQL uncertainty, portable paths, observed/historical bytes, full source-bound reproducibility, guarded SQL generation and stale-report rejection |
| `node --test scripts/devops/*.test.cjs scripts/quality/*.test.cjs scripts/staging/staging.test.cjs scripts/persistent/*.test.cjs scripts/readiness/preflight.test.cjs` | 567/567 pass, zero failures/skips; synthetic/offline infrastructure/security tests, no external activation |
| `node scripts/quality/release.cjs group backend --out /tmp/development-schema-backend` | All five gates pass: 235 Jest suites / 1,993 tests; syntax, frozen history, offline release plan, quality policy |
| Frontend unit / localization / source localization / production build | 122 suites / 555 tests pass; both localization gates and build pass |
| `node scripts/quality/release.cjs gate frontend-lint --out /tmp/development-schema-frontend` | Pass, `--max-warnings=0`. Initial group run rejected lint evidence because review-file inputs changed during execution; stabilized rerun passed. Initial group process correctly retained exit 1; no failed evidence was relabeled. |
| `node scripts/devops/integrity.cjs --base 180ea21c2d8bf233457a6ef6c6ede4bfceea0886` | PASSED, 105 locked artifacts, highest manual number 73, zero findings, no database connection |
| `node scripts/devops/security.cjs` and `node scripts/devops/security.cjs build` | PASSED; committed/staged source and generated frontend assets scanned, zero credential findings |
| Python `pglast==7.25` `parse_sql` and `parse_plpgsql` | All five candidate files parse: SQL statement counts 5/11/10/9/5; DO-block counts 0/3/2/2/1. **Grammar only, no SQL or dynamic DDL execution.** |
| Follow-up `required-object-check.sql` | pglast grammar parsing confirms only read-only transaction/settings/SELECT/rollback statements. Embedded JSON matches all 268 relation names/kinds and 3,604 column identities from the locked contract exactly. Eight offline reconciliation tests and all 105 artifact checks pass again. No query execution. |
| `git diff --check`; historical SQL/releases/fixture comparison against baseline | Clean; historical paths match baseline byte-for-byte. No SQL migration or stored historical digest modified. |

The dated auditor deliberately refuses to recertify this report against different runtime sources. It is an explicit offline review tool/test, not a permanent CI requirement to freeze future application development. Later application changes need a new dated evidence review, not rewriting this historical report. No workflow or deployment controls were changed for this task.

## Unresolved acceptance

- Development table/column/RLS/ACL/function/trigger/index/role visibility and execution history require actual read-only metadata reviewed by the owner.
- The demand-planning contract/merged-policy conflict requires a separately reviewed versioned contract correction; stronger observed authorization remains intact.
- `requests.view` metadata is optional pending design approval; frontend custody authorization alignment remains a separate application issue.
- Character fingerprint typmods and existing value integrity, array element types, malformed context constraints and generated/default expressions require actual PostgreSQL definitions.
- Conditional review-history SQL is neither an executed migration nor a claim that its runtime privileges are sufficient.
- No SQL candidate execution, Development startup, role/institute end-to-end test, attestation issuance, local-to-hosted workflow validation or production readiness is certified.
