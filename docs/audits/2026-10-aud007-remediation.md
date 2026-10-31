# AUD-007 remediation: procurement assignment authority and institute scope

Date: 2026-10-31. Revalidated against master `7291b867` before implementation.

## Root cause and evidence

The four October audit references remain accurate at that HEAD. Rule management admitted broad user/permission administrators and SCM/Admin role names, although these are not an assignment capability. Rules were global by request type and warehouse, with no institute owner. Automatic resolution accepted a globally active recipient. Manual, split and legacy assignment routes used separate writers with inconsistent state, institute and recipient checks. Assignment emails could escape a rolled-back approval transaction; assignment history and user lookup lacked consistent object authorization.

An offline probe compiled the unchanged HEAD autoassignment module with mocked SQL and email boundaries. A Non-stock rule pointing to the foreign-institute fixture user was selected, and the rule query contained no institute predicate. No database was contacted. Regression fixtures exercise actual routes, middleware, controllers, policy, assignment service, case projection, audit and outbox code against a two-institute SQL boundary fake.

The established algorithm is fixed request-type assignment, with exact submitted warehouse matching for Stock. It is not workload balancing. The supported types and aliases remain unchanged. Existing procurement complexity, priority and workload formulas are untouched.

## Authorization matrix

| Operation | Required authority | Object boundary |
| --- | --- | --- |
| Rule list/create/update/delete | Current `requests.manage` | Actor's actual institute; configuration ownership and assignee/warehouse references verified server-side |
| Manual whole/split/reassignment, including legacy route | Current `requests.manage` | Actual request, department, warehouse, recipient and existing cases |
| Automatic execution | Existing approval transaction plus current `requests.manage`, or a persisted non-superseded Approved approval belonging to that actor | Fresh locked request must be fully Approved, with no unresolved approvals; configured rule must have matching institute |
| Procurement directory | Current `requests.manage` or `requests.view-all` | Actor institute, or institute derived from an authorized actual `request_id` |
| Assignment history | Current `requests.manage`, or canonical request-read authority | Actual request institute and canonical requester/approver/assignee/read policy |
| Assignment recipient | Active user, current `procurement.update-status`, and canonical default-role catalog eligibility | Same actual institute as request, consistent department when present |
| Cross-institute request assignment/history/directory | Required operation permission plus `requests.cross-institute` AND explicit target in `data_scopes.institute_ids` | Positive known server-derived target institute; no unbounded/global fallback |

Actor authority is refreshed from users and permission services inside the transaction. Frontend institute IDs and caller snapshots do not confer ownership. Authentication and SCM/Admin role labels alone grant no assignment-management bypass. Existing procurement staff eligibility is derived from the canonical role permission catalog; granting a random user a single procurement permission does not make them procurement staff. No permission seeds or hardcoded actor IDs were added.

Rule configuration is deliberately confined to the manager's own institute. Explicit cross-institute execution can use the target institute's owned rules and recipients, but does not confer foreign rule-administration authority.

## Exact changes

- `services/procurementAssignmentPolicy.js`: shared fresh actor, capability, institute, request/department/warehouse ownership, active recipient/staff eligibility, effective Approved lifecycle and unresolved-approval checks.
- `services/procurementAssignmentService.js`: one transaction-bound mutation path for automatic, whole, split, legacy and reassignment operations. Locks the request and items, validates selected item ownership, optionally checks the assignee snapshot seen by the caller, synchronizes existing active cases, then writes history, audit and durable notifications atomically.
- `services/requestAutoAssignmentService.js`: retains normalization/type/warehouse selection; filters rules and active recipients by actual institute, locks selected rule/recipient, rejects ambiguity, delegates mutation to the shared service. No global fallback or inline assignment email.
- `controllers/requestAutoAssignmentRulesController.js`, its router and schema helper: use existing permission middleware and transactional policy; scoped CRUD and UI lookup options; institute advisory lock and unique index; before/after canonical audit; read-only schema preflight instead of rule runtime DDL.
- `controllers/requests/assignRequestController.js`, `updateRequestsController.js` and request routes: thin adapters and existing capability middleware replace duplicate assignment writers. Existing response envelopes and legacy route remain supported.
- `controllers/requests/fetchRequestsController.js`: server-scoped active eligible directory; request-scoped history authorization via the canonical read-authority service.
- `repositories/procurementPerformanceRepository.js` and canonical `procurementCaseService.js`: lock and validate existing active case ownership and update buyer projection only. Delivered/closed case projections are retained. No case provisioning, lifecycle, priority, ownership or workload changes.
- `services/procurementAssignmentNotification.js` and existing outbox processor: committed-event delivery, recipient and request ownership revalidation, terminal/stale-recipient suppression and unique in-app delivery.
- `controllers/approvalsController.js` and `services/approvalContinuationService.js`: complete transactional assignment work before sending the existing approval-success email, so assignment validation/audit failures cannot leak that success notice.
- `AssignRequestPanel.jsx` and `AllRequestsPage.jsx`: submit current header/item assignee snapshots for conflict detection; resolve directory scope using request ID. Existing UI and API client retained.
- `Management.jsx`: assignment tab requires the assignment capability and consumes server-scoped rule dropdowns instead of global management directories. Other management tabs and the existing management feature-access policy are preserved.
- Regression files: `tests/assignmentSecurity.test.js`, `tests/helpers/assignmentFixture.js`, updated `tests/splitAssignRequestController.test.js`, updated `__tests__/approvalContinuationService.test.js`, and two focused frontend suites.
- Forward-only SQL patch: `sql/manual/057_autoassignment_authorization_scope.sql`.

All backend paths above are under `purchase-backend`; frontend files are under `purchase-frontend/src`.

## Integrity, concurrency and compatibility

Only an active fully Approved effective request can be assigned. Submitted, pending approval, Rejected, Cancelled, completed, closed, received and available-in-stock states fail closed. Assignment does not approve requests, alter approvers/requester/department/institute, or modify procurement priority, quantities or inventory.

Whole assignment retains all non-Rejected requested items. Split assignment retains untouched item owners; the request header has one assignee only when all eligible items share that owner. A partial split therefore cannot misrepresent the whole request as assigned to one recipient. This intentionally corrects the old misleading header behavior.

Initial/manual, reassignment, split, automatic and automatic reassignment are recorded distinctly. Existing policy permits a configured automatic rule to change an already assigned Approved request; that behavior is preserved and audited. An inactive or ineligible configured recipient leaves approval unassigned rather than choosing an unrelated fallback user. Scope/schema corruption and ambiguous rules fail explicitly.

Request/item row locks serialize assignment decisions. Recipient SHARE locks prevent concurrent deactivation or institute relocation from committing across recipient validation and assignment commit. Rule SHARE locks and scoped configuration advisory locks coordinate rule changes. Optional expected header/item owners produce HTTP 409 on stale UI decisions. Older API clients without snapshots retain serialized manual override semantics. No workload snapshot is used or changed by fixed-rule selection.

A repeat that changes neither header, items nor cases writes no new history, audit or notifications. Real changes include original/new owners, method, actor, institute, timestamp, optional reason and rule/history provenance in canonical audit. Existing request history is retained. Audit/outbox failure rolls back assignment and case projections; automatic assignment uses the parent's approval transaction without independently committing it.

Notification identity is per committed history event and recipient. Existing outbox locking plus unique event/in-app keys prevent duplicate rows and normal repeat delivery. The worker checks that the recipient remains active, eligible, in the request institute and currently assigned before disclosing metadata.

## Tests and results

Commands executed from the respective application directories:

- `npm test -- --runInBand tests/assignmentSecurity.test.js tests/splitAssignRequestController.test.js __tests__/approvalContinuationService.test.js`: 3 suites, 54 tests passed.
- `npm test -- --runInBand`: backend 218 suites passed, 3 failed; 1,838 tests passed, 3 failed (1,841 total).
- The same three failures were independently reproduced on untouched `7291b867` in an isolated temporary worktree: `fetchRequestsController.domain.test.js` and `procurementHistoryController.test.js` use outdated SQL-shape fixtures; `phase5aCanonicalItemWriterBoundary.test.js` flags an existing schema-fixture writer. No new backend failure was introduced.
- `CI=true npm test -- --runInBand`: frontend 106 suites, 471 tests passed. Focused assignment/management tests reran after the final request-ID effect dependency fix: 2 suites, 4 tests passed.
- ESLint on all five changed/new frontend files: zero errors or warnings.
- `npm run build`: production frontend build passed, with existing unused `actionLoading` and missing `load` effect-dependency warnings in untouched DepartmentRequestedItemsBoard and PhysicalInventory pages, plus the existing bundle-size advisory.
- Node syntax checks and `git diff --check`: passed.
- Offline PostgreSQL grammar parsing of SQL 057: 13 statements and three PL/pgSQL blocks parsed. Parsing does not validate real schema compatibility or execute SQL.

Coverage includes unauthorized actor; foreign request/recipient/configuration/case; inactive and non-staff recipients; revoked capability; valid automatic/manual/reassignment; exact warehouse and type aliases; bounded cross-institute authority; concurrent duplicate and stale manual/split attempts; terminal and pending approval states; transactional audit/outbox/outer-approval rollback; normal notification deduplication and recipient revalidation; unchanged case complexity/workload; legacy API behavior; unowned historical rules; and schema-preflight failure. The approval-continuation test confirms assignment failure precedes approval-success email.

## Manual database and rollout requirements

**MANUAL DATABASE MIGRATION REQUIRED**

`purchase-backend/sql/manual/057_autoassignment_authorization_scope.sql`

No SQL was executed against any hosted database. No frozen migration was modified. SQL 057 uses an additive institute FK, institute/type/warehouse unique scope, and existing requested-item assignment columns/indexes where missing. It checks canonical audit/outbox prerequisites and uniqueness, and aborts inconsistent already-owned references or incompatible index definitions. It does not rewrite legacy rules or infer their institute from today's assignee/creator placement.

The owner must review and apply the complete file manually in Development first, validate with representative two-institute data, then review any later rollout separately. Stop old assignment/configuration writers during rollout, install the patch, start all updated backend instances, and review/recreate each institute's intended rules using the secured Management page. Keep NULL-owned historical rules as historical evidence; they are not executable and do not appear as owned configuration. Until rules are reconciled, automatic assignment may leave requests unassigned; authorized manual assignment remains available. Old backend instances must not recreate the former global unique index. No new permission seed SQL is required.

Verify the existing outbox worker is running and monitor retries after rollout. Assignment notification delivery is asynchronous rather than immediate best effort.

## Remaining risks and limits

- Database tests are SQL-boundary simulations, including lock-driven serialized concurrent commands. Actual PostgreSQL locks, migration/index/catalog compatibility and representative live data remain for manual Development validation. No hosted integration test was run.
- External email is at-least-once: provider acceptance followed by transaction/process failure may repeat an email. Unique outbox/in-app rows do not provide provider-level exactly-once email delivery.
- Other approval/requester/SCM inline emails and the wider AUD-014 delivery/audit findings remain outside this focused change. The ordering fix protects assignment failures, not every later approval-transaction failure.
- Existing canonical case provisioning remains a separate integration responsibility. This patch synchronizes existing active cases and creates none; it does not repair historical missing cases or change later provisioning's existing buyer-source rules.
- The existing requested-item assignment-column helper remains for unrelated workspace READ callers and still contains legacy runtime schema DDL. Secured assignment mutation paths use read-only preflight and the manual migration.
- Existing global role/permission administration and institute-move workflows must continue to follow their own authorization policies. Recipient active/institute rows are locked, but global grant administration was not redesigned here.
- The three baseline backend test failures remain open as described above.

LIVE_ROUTING_ENABLED remains FALSE.
The existing approval engine remains authoritative.
No SQL was executed against Development Supabase.
No SQL was executed against Production Supabase.
