# AUD-006 remediation — procurement planning authorization and isolation

Revalidated on 31 October 2026 (Asia/Baghdad) against current `origin/master`
`951634fe` (includes merged AUD-003/015, AUD-008 and AUD-009 remediations).
Reviewed the October system audit, security/authorization audit, remediation
backlog and integration matrix before defining this correction.

## Confirmed root cause and existing corrections

Both routers authenticated users, but lacked planning capability gates. Forecasts
and reports aggregated globally; defaults had a NULL-warehouse global key with no
institute owner. Replenishment policy/task commands trusted warehouse/item IDs.
Plan items and source-link handlers loaded global child IDs without verifying
actor scope or all linked request/consumption parents. Writes generally lacked
transactional business audit. The consumption link's nullable unique tuple did
not reliably prevent retries creating duplicate links.

A controlled probe loaded the **unchanged `951634fe` controller** with a mocked
query runner. An authenticated ordinary user with no planning permission could
insert a replenishment policy using fixture foreign warehouse/stock IDs, without
any parent ownership lookup. No database or hosted service was contacted.

PR 75 had already secured plan upload/list/detail/download through attachment
parent checks. That correction was preserved and tightened to the new planning
capability policy, including registered local/path aliases. It did not cover the
remaining plan-item/link/default/replenishment boundaries. No duplicate attachment
security implementation or alternate storage adapter was introduced.

## Authorization matrix

No semantically equivalent planning capability existed in the checked-in catalog.
`procurement.update-status` is operational procurement authority;
`warehouse.manage-supply` is stock-supply authority. Neither is reused as a silent
planning grant. New codes follow the established `domain.action` convention and
use the same permission catalog, role/user grants and data-scope retrieval.

| Operation | Required capability | Scope |
| --- | --- | --- |
| Forecast, safety stock, MRP, defaults read | `planning.view` or an applicable `planning.manage` / `replenishment.manage` capability | Active server-loaded institute account; actual selected department/warehouse and scoped history |
| Plan list, request-plan match, detail, items, variance, insights, file download | Same read capability | Actual plan department belongs to the actor institute and authorized departments; linked sources checked before reports |
| Plan upload, add items, link request/consumption evidence | `planning.manage` | Actual parent plan/department, child-plan membership, source request department/institute and source warehouse scope |
| Save warehouse defaults | `planning.manage` | Actual authorized active warehouse and institute |
| Save institute-wide defaults | `planning.manage` plus both cross-department and cross-warehouse capabilities | Actor's server-side institute only |
| Save replenishment policy / generate advisory tasks | `replenishment.manage` | Actual authorized active warehouse, eligible scoped stock identity and locked policy/task records |
| Extend department scope | `planning.cross-department` OR explicit `department_ids` data-scope values, otherwise actual home department | Always restricted to the actor institute; scope alone grants no action capability |
| Extend warehouse scope | `planning.cross-warehouse` OR explicit `warehouse_ids`, otherwise actual assigned warehouse or the warehouse of the home department | Always restricted to the actor institute; inconsistent warehouse/department ownership fails closed |
| Submit/approve/cancel a plan | Not implemented by this model | No approval code/route/state was invented |

The actual permission system's case normalization is reused. User ID is the only
input accepted when reloading the actor; active user, institute, assignments,
permissions and bounded ID scopes come from server-side data. The existing grant
lookup accepts an optional transaction client, retaining its old default behavior
for other callers. There is no SCM/admin role bypass, no frontend institute
selector authority, no wildcard-ID grant and no planning cross-institute override.
Even broad local scope capabilities or a foreign ID in `data_scopes` cannot bypass
actual institute ownership.

The manual seed grants SCM all five planning capabilities, Procurement Specialist
view/preparation in assigned scope, and Warehouse Manager view/replenishment in
assigned scope. Existing admin catalog semantics are unchanged. Other planners,
HODs, viewers or delegates require explicit grants through Management. No individual
user ID or new organization structure is hardcoded.

## Canonical scope and data rules

`planningAuthorizationService` is the shared scope owner for both routers and
plan-file compatibility paths. It verifies departments, warehouses, plans, plan
items, stock identities, requested-item roots and legacy consumption roots.
Foreign, missing, ambiguous or unowned references fail closed without returning
protected metadata. An explicitly foreign stock identity is never treated as
shared; a NULL-owned legacy stock identity needs a concrete authorized warehouse
or department stocking association. Name matching or the creator's current HR
placement never establishes ownership.

Request links must use the exact plan department and actual request/item parent;
the request's actual warehouse must independently pass warehouse authorization.
Warehouse consumption must target that department and come from an authorized
warehouse; department consumption is resolved through its actual stock-level
parent and source warehouse. Existing foreign or ambiguous links block report
aggregation instead of leaking their amounts into an authorized plan report.

Forecast/safety history now filters actual request institute, department and
warehouse relationships. Name-only `monthly_dispensing` lacks durable institute,
department and warehouse ownership. It is excluded rather than guessed from
`facility_name` or current importer placement. Forecast history identifies its
source as requests. Plan insights return explicit data limitations and unavailable
seasonal consumption values, displayed in the UI. Replenishment averages are
restricted to authorized, consistently owned warehouses. Statistical forecasting,
MRP calculations and business sizing formulas were not redesigned.

Replenishment remains **advisory**. One recommendation is calculated per scoped
policy using the aggregate existing warehouse balances. The existing quantity
basis is retained; this is not a new inventory availability or quarantine release
model. No command creates/approves a PR or PO, posts inventory, changes Goods
Receipt acceptance, commits a PO budget, or creates AP obligations. Existing
request links are provenance, not a downstream demand-creation authority.

## Transactions, concurrency, audit and files

- Plan mutation locks its actual parent before changing children. Scope reads and
  current permission lookup use the same transaction client. Source rows are held
  while their links are persisted. Variance/insight reads also hold parent/source
  scope checks through the report transaction.
- Settings and policy changes retain before/after records through the existing
  canonical `auditService`; every event carries actual actor/institute, affected
  entity, business action and database timestamp. Audit failure rolls back data.
- Defaults use the institute/warehouse unique key and advisory/row locks. Policies
  and task generation share a warehouse advisory lock; repeated/concurrent runs
  reuse an existing open/planned/ordered advisory task. Existing active tasks are
  not silently edited. Historical duplicate tasks are not deleted.
- Request links remain upserts. Consumption retries explicitly reuse an existing
  matching link under the parent lock rather than relying on NULL tuple uniqueness.
  Existing historical duplicates remain for explicit reconciliation.
- Plan upload checks permission/scope before storage and rechecks it transactionally
  before publishing metadata/audit. Failure cleans up only the new uploaded object;
  failed storage cleanup leaves a private orphan for operational recovery.
- Plan storage continues through the protected local/remote adapter. The legacy
  attachment plan/department paths delegate to the same planning policy; old
  request-management/request-creation grants cannot bypass it. Private file denial
  retains its generic not-found response.
- No planning request creates tables or caches uncommitted DDL. Existing child
  definitions moved to manual SQL 056; application schema preflights fail with
  `PLANNING_SCOPE_SCHEMA_REQUIRED` instead of mutating schema at runtime.

## Existing workflow and UI compatibility

Existing endpoints and payloads remain. Properly granted SCM users retain scoped
plan upload/preparation, report/download, global/warehouse defaults, policy changes
and advisory task generation. Viewer-only users can inspect but cannot mutate;
scoped managers cannot change institute-wide defaults without explicit broad scope.
Warehouse/departments supplied by the UI remain selectors, never grants.

The frontend now uses explicit capabilities for route/navigation access and disables
unauthorized mutation controls. Defaults load/save failures display the existing
server message; a scoped manager selects a warehouse before saving defaults.
The old `feature.procurementPlans` UI resource was also used for PO navigation:
it remains unchanged for those consumers. New `feature.procurementPlanning` and
`feature.demandPlanning` resources isolate planning UI policy. Review these resources
in Management if custom UI rules are needed; no PO/finance workflow was changed.

There is no plan status/approval lifecycle in the current file/item schema or
router. No `planning.approve` permission, substitute approver, cancellation command
or approval requirement was invented. Existing replenishment task statuses remain
unchanged. Arbitrary request approval/status fields are not accepted as writers.

## Exact files changed

- `purchase-backend/services/planningAuthorizationService.js`
- `purchase-backend/middleware/planningPermission.js`
- `purchase-backend/routes/planning.js`
- `purchase-backend/routes/procurementPlans.js`
- `purchase-backend/controllers/demandPlanningController.js`
- `purchase-backend/controllers/procurement/plansController.js`
- `purchase-backend/services/attachmentAuthorizationService.js`
- `purchase-backend/utils/permissionService.js`
- `purchase-backend/utils/uiAccessService.js`
- `purchase-backend/utils/ensureProcurementPlanTables.js`
- `purchase-backend/sql/manual/056_planning_authorization_scope.sql`
- `purchase-backend/tests/planningAuthorization.test.js`
- `purchase-backend/tests/planningEndpoints.test.js`
- `purchase-backend/tests/planningSchemaGate.test.js`
- `purchase-backend/tests/helpers/planningFixture.js`
- `purchase-backend/tests/attachmentAuthorization.test.js`
- `purchase-frontend/src/App.js`
- `purchase-frontend/src/components/Navbar.js`
- `purchase-frontend/src/config/featureRegistry.js`
- `purchase-frontend/src/pages/PlanningWorkbench.jsx`
- `purchase-frontend/src/pages/ProcurementPlansPage.jsx`
- `purchase-frontend/src/pages/PlanningWorkbench.permissions.test.jsx`
- `purchase-frontend/src/pages/ProcurementPlansPage.permissions.test.jsx`
- `docs/audits/2026-10-aud006-remediation.md` (this report)

## Automated tests and limits

Real Express routers, JWT authentication, capability middleware, controllers,
shared authorization and canonical transaction/audit helpers run with mocked
persistence/storage and local HTTP only. Mutable fixture transactions simulate
serialization/rollback; they do not establish real PostgreSQL locks/RLS or hosted
schema compatibility. No hosted SQL or migration-installing local SQL harness ran.

Coverage includes anonymous/no-capability access; viewer/manager/SCM; foreign and
unowned roots; unauthorized department/warehouse; bounded and foreign data scopes;
forged institute/actor fields; policy/default changes; absent approval API; repeated
and concurrent advisory generation; serialized revisions; full audit rollback;
protected plan files; mixed-source batch rollback; stale/ambiguous legacy links;
permission revoked during upload; read-only UI and management controls. Canonical
request/procurement/inventory/approval owners remain unwritten.

From `purchase-backend`:

```sh
npm test -- --runInBand tests/planningAuthorization.test.js tests/planningEndpoints.test.js tests/planningSchemaGate.test.js tests/attachmentAuthorization.test.js tests/permissionService.test.js
npm test -- --runInBand
```

From `purchase-frontend`:

```sh
CI=true npm test -- --runInBand src/pages/PlanningWorkbench.permissions.test.jsx src/pages/ProcurementPlansPage.permissions.test.jsx src/pages/PlanningWorkbench.test.jsx
CI=true npm test -- --runInBand
CI=false npm run build
```

Verification results:

- Focused backend authorization, endpoint, schema, attachment and permission suites:
  5 suites / 76 tests passed.
- Full backend: 217 of 220 suites passed; 1,782 of 1,785 tests passed. The three
  failures were independently reproduced on unchanged master `951634fe`:
  `fetchRequestsController.domain.test.js`, `procurementHistoryController.test.js`
  (SQL-shape expectations), and `phase5aCanonicalItemWriterBoundary.test.js`
  (existing schema-fixture DML scan). No new backend regression test failed.
- Initial full frontend run: 101 suites / 457 tests passed. After adding the last
  two planning-page tests, the full run passed 100 of 102 suites and 456 of 459
  tests. It had two five-second timeouts in unchanged surgical-consignment and
  request-selector tests, followed by a selector assertion failure. An immediate
  rerun of both affected suites together with all three planning suites passed
  all 5 suites / 23 tests. These intermittent full-run failures remain disclosed;
  the latest full frontend run is not claimed as green.
- Production frontend build passed with two existing unrelated ESLint warnings
  (department requested-items `actionLoading`, physical-inventory effect dependency).
- ESLint passed for all changed frontend source and new test files; `node --check`
  passed for changed/new backend JavaScript; `git diff --check` passed.

PostgreSQL syntax parsing is **not SQL execution**: SQL 056 parsed as 20 statements and three PL/pgSQL
blocks; all 38 unique SQL statements captured from mocked endpoint tests parsed
successfully; the final revised request/warehouse ownership query also parsed.
The parser and temporary tracing artifacts stayed outside the commit;
no application dependency/lockfile changed.

## Manual Development SQL and rollout

**MANUAL DATABASE MIGRATION REQUIRED**

Apply the complete new forward-only file manually:
`purchase-backend/sql/manual/056_planning_authorization_scope.sql`.
No frozen migration was changed. The patch registers the five permissions, seeds
known operational role grants and bounded data-scope definitions, adds institute
ownership to existing planning defaults and creates only missing legacy plan-child
structures. It replaces the old warehouse-only unique index with a verified
institute/warehouse index; no table or historical record is dropped/truncated.

1. Review/back up **Development** and check the existing base permissions, roles,
   audit, warehouses/departments, inventory and plan schema before applying SQL 056
   through the Development SQL Editor yourself. Codex did not execute it.
2. Explicit warehouse ownership may bind an old warehouse defaults row. Unknown
   global rows remain NULL-owned and preserved; they are not adopted by an importer
   or a guessed institute. Re-enter approved global defaults for each institute in
   the secured UI, or explicitly reconcile historical rows through a separately
   reviewed data decision. Numeric settings/history are not silently overwritten.
3. Restart all backend instances on the new code and rebuild the changed frontend
   during the same controlled release window. Do not mix the old global-default
   runtime writer with the new institute-scoped key. Do not rerun the older baseline
   schema patch to recreate its superseded warehouse-only index.
4. Sign in again/refresh current permissions. Verify SCM role grants; explicitly
   grant designated departmental planners/viewers and their department/warehouse
   ID scopes through existing Management. Scope values must belong to that account's
   institute. Review the new planning UI resources without altering the old PO one.
5. Validate two institutes and two departments/warehouses in Development: authorized
   operations work, foreign selectors fail, view-only users cannot save, repeat runs
   reuse a task, and a failed audit leaves records unchanged. Confirm report source
   limitations rather than assuming unowned dispensing history was reclassified.

Production migration/deployment requires separate owner review after Development
validation. Nothing was merged, applied to a database or deployed automatically.

## Remaining risks

Hosted schema/RLS/trigger state, real PostgreSQL lock interleavings and deployment
are unverified. Syntax parsing does not prove column types, constraints, migration
execution or real clinical data. The manual patch may take table/index locks and
must stop for incompatible ownership/index drift rather than guessing a repair.
Unknown global defaults, orphan/shared stock without scoped association, historical
foreign/ambiguous links and historical duplicate tasks/consumptions require explicit
reconciliation; they are preserved, not silently fixed. Tasks remain advisory and
use the existing stock quantity basis, not a new fulfilment/availability model.
No new approval lifecycle, forecasting algorithm, AI replenishment, inventory
writer, financial workflow or organization restructuring was introduced.

LIVE_ROUTING_ENABLED remains FALSE.
The existing approval engine remains authoritative.
No SQL was executed against Development Supabase.
No SQL was executed against Production Supabase.
