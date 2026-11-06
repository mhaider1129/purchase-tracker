# AUD-017 — CI/CD quality gates and release verification (Task 7D)

## Current-master revalidation

Reviewed master **df1f4b73**, including merged 7A–7C. The old October backend failures no longer reproduce: the initial full backend run passed **227 suites / 1,897 tests**. Current frontend baseline had **2 failed / 519 passed tests**, **10 Testing Library lint errors and 2 application warnings**; strict `CI=true` production build failed on the reported unused `actionLoading` and missing `load` dependency. Previous audit counts were not treated as current evidence.

The existing backend-only workflow omitted frontend checks and several native domain suites, used path filters, and had no complete source/build-bound release manifest. The SQL-plan runner validated newer authorization queries against an older database layout; current-source execution reproduced `column cf.institute_id does not exist`. Its snapshot-gap inventory was also easy to mistake for unresolved postflight failures. The canonical writer-boundary regexp was over-escaped and lacked a negative mutation proof.

## Implementation and review artifacts

See [the manual release runbook](../releases/quality-gates-7d.md), [gate registry](../../scripts/quality/gates.json), [manifest/evidence verifier](../../scripts/quality/release.cjs), [workflow](../../.github/workflows/release-quality.yml) and [16-domain smoke plan](../../scripts/quality/smoke-plan.json).

- Require full backend/frontend tests, backend syntax, immutable historical migration comparison, locked source planning, zero-warning ESLint, localization parity/source coverage and a strict production build.
- Require 13 disposable PostgreSQL profiles covering current schema/SQL plans, authorization/P2P/financial controls, contracts/settlement/reconciliation, request/device/technical/completion/reporting workflows and both background-worker reliability models.
- An always-running aggregate check rejects missing/duplicate/failed/skipped/mixed-source evidence, cancelled jobs, incompatible Node versions, changed logs/build artifacts, incomplete manifests and uncommitted inputs. Readiness remains separate from Production approval.
- Use `actionLoading` to block repeated pending follow-up actions and stabilize the inventory loader with `useCallback`. Replace test DOM traversal with semantic accessible groups/links/list items; keep the same assertions.
- Update completion fixtures to supply canonical authority and add a missing-canonical-evidence denial test. Control the existing 350ms hierarchy-search debounce in its pagination test rather than increasing timeouts or retrying a flaky assertion under CPU load.
- Correct the writer-boundary regexp and prove forbidden INSERT/UPDATE/DELETE mutations using temporary files without weakening the existing approved-writer allowlist.
- Add missing interface entries, Arabic plural forms and an English interpolation variable, preserving namespace parity. Remaining literal text candidates are an explicit translation-review inventory, not a claim of full translation coverage.
- Bring the disposable SQL-plan layout through the reviewed current forward schemas, retain all populated-upgrade assertions, report baseline gaps separately, and write generated test reports to CI artifacts.

No backend runtime business source, schema contract or frozen SQL is modified. The backend release inventory is refreshed for the changed test-runner metadata. No hosted SQL, migration application, live smoke operation, merge or deployment is performed. `LIVE_ROUTING_ENABLED=false`; Approval Engine V2 is unchanged.

## Validation results

Results are recorded from current executions; the final focused PR/Actions artifacts provide commit-bound CI evidence.

| Check | Result |
| --- | --- |
| Initial backend baseline | PASS: 227 suites, 1,897 tests |
| Updated backend suite | PASS: 227 suites, 1,900 tests, including 3 new forbidden-writer mutations |
| Frontend full suite / strict lint / production build | PASS: 118 suites / 523 tests; zero-warning ESLint, localization and strict build |
| Quality-policy negative tests | PASS: 29 policy tests, including simulated CI metadata and fail-closed manifests |
| SQL schema and query plans | PASS: 1,825 plans; zero failed plans/postflight findings; populated upgrades and history preserved |
| P2P | PASS: 94 scenarios |
| Contracts | PASS: 51 scenarios |
| Legacy settlement containment | PASS: 32 scenarios |
| Canonical contract finance | PASS: 38 scenarios |
| Historical reconciliation | PASS: 31 reconciliation scenarios plus canonical finance compatibility |
| Request workspace / medical-device demos | PASS: real PostgreSQL workflow assertions |
| Canonical completion | PASS: 35 cases plus stock/technical workflow |
| Receipt, technical acceptance and reporting | PASS: 43 acceptance + 29 reporting scenarios |
| Database governance | PASS: 28 scenarios |
| RFID recovery | PASS: 28 scenarios |
| Transactional audit/notification | PASS: 38 scenarios |
| Missing-evidence manifest | PASS: produces `BLOCKED`, nonzero exit, no deployment authorization |

No test is removed, skipped or excluded to obtain a green result. Mocked SMTP tests reset inherited dry-run aliases while keeping the real transporter mocked; all other child processes retain dry-run/no-hosted-credential safety. Dependency-data age and existing test-console setup warnings remain visible and are not represented as operational acceptance.

## Database, operational and repository requirements

**No database migration required by Task 7D.** Frozen SQL 001–071 remains unchanged. Required current database/worker prerequisites and migration hashes are included in the generated manifest. Hosted compatibility is intentionally `NOT_VERIFIED`; the authorized owner must perform the existing manual compatibility/recovery/acceptance process before rollout.

GitHub returned **403 Resource not accessible by integration** when reading master branch protection. The PR supplies the stable **Release quality gate** check and an owner checklist to require it; existing admin enforcement is not claimed. Manual Production access, actual backup restoration, SMTP/device acceptance and Hetzner/PM2 deployment remain outside CI authority.

## Exact files changed

```text
.github/workflows/database-release-governance.yml
.github/workflows/release-quality.yml
.gitignore
docs/audits/2026-11-aud017-remediation.md
docs/releases/quality-gates-7d.md
purchase-backend/database/releases/migration-inventory.json
purchase-backend/scripts/testBackendContractRefresh.js
purchase-backend/tests/emailService.test.js
purchase-backend/tests/phase5aCanonicalItemWriterBoundary.test.js
purchase-frontend/src/components/CanonicalFinancialDocuments.jsx
purchase-frontend/src/components/CanonicalFinancialDocuments.test.jsx
purchase-frontend/src/components/CompletionReportingSummary.jsx
purchase-frontend/src/components/CompletionReportingSummary.test.jsx
purchase-frontend/src/components/ProcurementCompletionPanel.jsx
purchase-frontend/src/components/ProcurementCompletionPanel.test.jsx
purchase-frontend/src/components/itemMaster/ItemHierarchyWorkspace.test.jsx
purchase-frontend/src/components/requests/AssignedWorkGuidance.test.jsx
purchase-frontend/src/locales/ar.json
purchase-frontend/src/locales/en.json
purchase-frontend/src/locales/interface.ar.json
purchase-frontend/src/locales/interface.en.json
purchase-frontend/src/pages/DepartmentRequestedItemsBoard.jsx
purchase-frontend/src/pages/DepartmentRequestedItemsBoard.test.jsx
purchase-frontend/src/pages/SupplyChainPerformancePage.jsx
purchase-frontend/src/pages/SupplyChainPerformancePage.test.jsx
purchase-frontend/src/pages/fixed-assets/PhysicalInventory.jsx
purchase-frontend/src/pages/fixed-assets/PhysicalInventory.test.jsx
scripts/quality/gates.json
scripts/quality/policy.test.cjs
scripts/quality/release.cjs
scripts/quality/smoke-plan.json
```
