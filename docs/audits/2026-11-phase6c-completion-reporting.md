# AUD-011 / AUD-018 — Unified completion reporting (Task 6C)

Date: 2026-11-05. Base: `41b97847`, after merged Phase 6A (#95) and
Phase 6B (#96). Current completion authority is SQL 067 as extended by SQL 068.
This task changes read models and display labels, not persisted lifecycle states,
approval authority, assignment/workload policy, inventory posting or financial
settlement. No hosted database was accessed.

## Verified root causes

The originally missing inspection-acceptance event is already fixed by Phase 6A;
Phase 6B also establishes receipt-aware quarantine/reclassification provenance.
The remaining failures were competing **read-side** definitions:

- Incomplete endpoints excluded requests by `Completed`/`Received` labels and
  purchased item markers. An ordered, undelivered or quarantined request could
  disappear before department fulfillment, while terminal requests could remain.
- Request exports maintained a separate status/filter query and exposed no
  canonical accepted/fulfilled dimensions. This query was not institute bounded.
- Dashboard canonical counts were duplicated, used a different cohort from legacy
  totals and ignored report filters. Several legacy aggregate queries were global;
  approval throughput did not join the authorized request population.
- Department and specialist lists showed entry/assignment/archive status without
  the current canonical completion category. Department board role scope needed an
  institute and relationship boundary even for privileged roles.
- Weekly warehouse stocking read `warehouse_stock_movements`, rather than net
  canonical issues, with no warehouse/institute predicate. The transaction browser
  was likewise unbounded. Neither source proves accepted receiving.
- Case reporting counted raw receipt-complete flags even for cancelled demand,
  and accepted bounded institute IDs without checking cross-institute permission.
- Dashboard average approval duration used request `updated_at`, which is not an
  approval endpoint. It now reads actual non-superseded approval timestamps.

## Calculation inventory and disposition

| Surface / owner | Existing calculation and consumers | Final treatment |
| --- | --- | --- |
| `dashboardController.getDashboardSummary`, `Dashboard.jsx` | Archive statuses/stock readiness, fulfilled-item rollups, request/cost trends and aging; separate ad hoc canonical counts | Legacy numeric keys remain historical, scoped to authorized requests; canonical summary is one shared contract, rendered separately with an explicit archive explanation |
| `getWorkloadAnalysis`, `WorkloadAnalysis.jsx` | Active approval rows, pending/hold/urgent counts, completed approvals per day | Approval-row grain and original filter/window policy preserved; every approval belongs to the authorized request cohort. Current request completion shown in a separate shared panel |
| `getLifecycleAnalytics`, `LifecycleAnalytics.jsx` | Hold-adjusted approval and first-PO clocks; spend categories | Existing clocks retained, current request dimensions reuse the shared contract. Missing canonical fulfillment endpoint is disclosed, never replaced with updated_at |
| `fetchRequestsController`: SCM all/my/assigned request lists; AllRequests/AssignedRequests UI | Effective archive labels, purchased quantities, assignment entry summaries | Add the same server-computed canonical vector/category; keep archive filters and entry counters distinct. Specialist close readiness follows canonical can_complete; missing evidence cannot be inferred from entry counters. All/my/assigned visibility now has explicit institute/relationship scope |
| `incompleteController`; three incomplete dashboards and local CSV/print | Purchased/status-based exclusions | Same canonical list source, excluding terminal and fulfilled requests. Whole authorized cohort remains an array for existing browser filtering/pagination/export |
| `departmentRequestedItemsController`; department board / grouped summaries / Excel / CSV | Remaining-to-purchase quantities and overdue/partial-purchase flags | Retain purchasing follow-up selection and its historical/item grain; add canonical whole-request category to rows/exports, with institute guard intersecting existing department/section access |
| `warehouseSupplyController`; supply cards | Header closure and legacy supplied counters | Preserve workflow counters, add canonical request completion vector/category; bind actual warehouse/request/department institute |
| `warehouseInventoryController`; weekly report and transaction browser | Legacy out-movement sums; global transactions | Default weekly report uses canonical net ISSUE/reversal quantities by department, stock and base UOM, restricted by existing warehouse policy. Balance/transaction reads are also warehouse bounded. Historical archive is explicit `basis=historical` and is still warehouse scoped |
| `procurementPerformance` dashboard/case detail; performance cards | Case-stage coverage/workload; item-scoped raw accepted flags | Coverage/workload policy preserved. Accepted/fulfilled case numerators use the shared canonical eligibility gate and actual case ancestry. Case grain and opened-at date basis disclosed |
| `procurementMetricsService` buyer workload / `procurementCycleTimeService` | Historical monotonic CLOSED/DELIVERED counts and raw known-event elapsed milliseconds | Retained as workload/history, not fulfillment or SLA evidence; existing API continues marking unsafe/incomplete cycle-time coverage unavailable |
| `routes/requests` CSV/PDF; AllRequests export actions | Independently built filter/status SQL | Default export uses exactly the canonical list reader without pagination; CSV includes typed stage flags, category, basis and per-line evidence. PDF displays basis/category/fulfillment. Explicit historical mode preserves old columns with scoped access |
| `requestFulfillmentSql` and Phase 6A SQL projections; request workspace/P2P lifecycle/case consumers | Canonical source movements, actual GR acceptance, issues, requester evidence; separate finance | Reused without modifying SQL or writers; historical effective status helpers remain compatibility selectors, never fulfillment authority |
| `ProcureToPayDashboardPage` / financial APIs | Open RFx/PO/GR/AP work queues and obligations | Not a fulfillment rate. Retained; no payment or liability status enters the operational reporting contract |
| Priority/assignment queues / procurement history / closed request archives | Assignment eligibility, archived operational labels, purchasing events | Policies and history retained. Assigned completion archives add the same current canonical badge and institute/relationship boundary. No reassignment, re-ranking, request status rewrite or reinterpretation of historical closure timestamps |

This inventory distinguishes a current completion metric from a legitimate
historical, financial, assignment or approval-throughput metric. Different cohorts
and units must not be compared as though they were the same denominator.

## Unified KPI contract — `canonical_completion_v1`

Authority: `procurementReportingService`, using the Phase 6A/6B function in a materialized
authorized cohort. No reporting-specific stock or
inspection calculator is introduced. Category derivation consumes that function's
flags; it never writes a lifecycle status.

### Shared rules applying to every request completion metric

- **Population:** all established request types, including Warehouse Supply, after
  authorized institute/relationship and explicit report filters. Historical legacy
  widgets still exclude Warehouse Supply where they did before; they are labelled
  archive indicators and are not the canonical denominator.
- **Eligible denominator:** `approved_demand=true`, `terminal=false`, and at least
  one eligible line. Pending/unapproved and cancelled/rejected/withdrawn records
  appear in total/category counts but not eligible-rate numerators/denominators.
  Unsupported policy or missing evidence is disclosed; it is not assumed complete
  or silently removed to improve a rate.
- **Excluded:** foreign/inconsistent request-department ownership; records outside
  actual authorization or selected filters. Rejected item treatment, stock
  diversion, requester receipt issues and technical/PO eligibility follow SQL 067/068.
- **Partials:** one request remains one denominator unit. Partial line quantities
  remain exact decimal strings and distinguish partial receiving and partial
  fulfillment. There is no sum across UOMs or currencies. Counts are not weighted
  by item count, cost, price, assignment or payment.
- **Stock:** a verified stock-ready decision may satisfy procurement resolution
  without a PO. It does not establish issue or department fulfillment. Canonical
  issue evidence against approved demand remains necessary.
- **Technical acceptance:** accepted delivery uses Phase 6B usable accepted
  quantities. Gross receipt, rejected quantity, pending review and unreleased
  quarantine are not accepted delivery. Ambiguous unlinked status changes and
  unpaired corrections remain evidence gaps. Acceptance is not a PR approval.
- **Scope:** own institute plus bounded server-side scopes only with explicit
  `requests.cross-institute`. Request view-all/manage grant broad request scope;
  otherwise own/assigned/actual approval relationships, permitted department,
  assigned warehouse supply, authorized incomplete records or actual permitted
  procurement cases establish visibility. Filters only narrow access. Caller
  `institute_id` is never an authority source. Existing department/section board
  restrictions and warehouse inventory policies remain additional boundaries.
- **Dates:** canonical request metrics are *current evidence over a creation-date
  cohort*, not historical month-end snapshots or completion-event throughput.
  `from_date`/`to_date` (also `date_from`/`date_to`) use inclusive calendar days in
  UTC, implemented as a half-open interval. Canonical snapshot request timestamps
  are timestamp-without-time-zone and are interpreted as UTC. Return dates include
  the UTC offset. Invalid/reversed dates fail with 400.
- **SLA:** `approval_active_elapsed_seconds` (SQL 048) remains the single hold
  authority, including clipped/parallel holds. Current elapsed request age is not
  a completion duration. Production DB/session timestamp interpretation must be UTC,
  matching the canonical snapshot; verify this during Development review.
- **History:** the read model describes current evidence, including later reversals.
  It does not reconstruct an unsupported historical as-of balance, create a
  fulfillment timestamp, backfill inspections or rewrite imported Completed labels.

### Metrics

| Name / response field | Business definition / numerator | Denominator / partial treatment | Clock and date basis |
| --- | --- | --- | --- |
| Authorized requests / `total_requests` | Unique authorized filtered request IDs, including pending and terminal | Count, no percentage; every request counted once | Request creation cohort; current evidence |
| Approved eligible requests / `eligible_requests` | Requests meeting the shared eligibility rule | Count; basis for all three current request rates | Same request creation cohort |
| Procurement completion / `procurement_complete_requests` | Eligible requests with canonical `procurement_complete=true`; committed quantities or supported stock resolution cover demand | Eligible requests; partial orders do not count as fully resolved | Current resolution over creation cohort; not PO issuance count |
| Accepted receiving / `receipt_complete_requests` | Eligible requests with canonical `receipt_complete=true` | Eligible requests; partial acceptance/rejection/hold cannot complete a request | Current accepted evidence; not receipt-header date |
| Department fulfillment / `fulfilled_requests`, `fulfillment_rate` | Eligible requests with canonical `fulfillment_complete=true` | Eligible requests; rate is 100 × numerator / denominator, NULL if denominator is zero | Current fulfillment over request creation cohort; no inferred completion timestamp |
| Stock ready / `stock_ready_requests` | Eligible requests with canonical stock resolution | Eligible requests if expressed as a rate; decision does not imply issue | Current stock resolution, not balance size |
| Legacy unverified / `legacy_unverified_requests` | Imported/stored completion without canonical fulfillment | Authorized cohort; disclosure only, never counted as proven loss or fulfillment | Current evidence versus preserved historical label |
| Exclusions / `excluded_terminal_requests`, `evidence_gap_requests` | Terminal records or explicitly unsupported/conflicting evidence | Authorized cohort; disclosed separately | Current evidence |
| Category breakdown / `categories` | One derived display category per authorized filtered request | Category counts sum to total_requests | Same creation cohort and current evidence |
| Monthly / `monthly` | Unique request, eligible and fulfilled counts for each creation month | Monthly eligible requests for a rate; not an event throughput series | UTC request creation month; no historical snapshot claim |
| Department / `departments` | Unique request/fulfilled counts grouped by actual request department ID | Same department's eligible cohort for rates; names are not grouping identities | Same request creation filters |
| Case accepted delivery / `metrics.completion.accepted_delivery_cases` | Actual authorized cases whose item-scoped canonical vector is eligible and receipt-complete | Eligible case count (`eligible_cases`), not request count; case must belong to actual request/item/institute/department | Current evidence over case opened-at cohort; explicit `unit=case` |
| Case fulfillment / `metrics.completion.fulfilled_cases` | Same eligible case population with item-scoped fulfillment complete | Case count; no substitution of historical DELIVERED/CLOSED stage | Same case opened-at cohort; inclusive UTC start/end date filters |
| Weekly warehouse issue quantities | Sum of signed original AVAILABLE ISSUE movements and their actual recursive compensations, floored at zero by department/stock/base-UOM group | Quantity, not a request completion percentage; no cross-UOM summation | Original issue posted-at cohort, net of known reversals as of generation; assigned/explicitly authorized actual warehouse |
| Approval throughput / `completions_trend.approvals_completed` | Approved approval rows in the existing window, restricted to authorized requests | Approval rows, not request fulfillment; existing configured window preserved | Actual approval timestamp; no new SLA definition |
| Approval/first-PO durations | Existing SQL 048 hold-adjusted intervals using known approval or actual PO/legacy procurement-event endpoints | Existing observed samples, never all requests; missing evidence remains unknown | Existing endpoint policy disclosed; summary approval average no longer uses updated_at |
| Canonical fulfillment cycle / `completion_cycle_time` | Not currently measurable from a trustworthy immutable current-fulfillment endpoint | NULL, with reason; never zero or created→updated | No invented timing endpoint |

Warehouse filters on the request report select requests that reference that actual
warehouse through supply or a real owned PO/GR line. `quantity_scope=whole_request`
is explicit: line evidence remains the **whole request**, including other
warehouses. These are warehouse-related request counts, not warehouse-attributed
quantity totals. The dedicated net-issue report provides warehouse-specific
quantities; combining the two would misstate fulfillment.

### Display categories and precedence

Terminal → evidence review → fully fulfilled → awaiting approval → partially
fulfilled → awaiting technical acceptance → partially received → awaiting department
fulfillment (accepted or stock ready) → awaiting delivery (fully procured) →
procurement in progress → awaiting procurement. This precedence is only a display
category. Underlying dimensions/items preserve simultaneous holds, acceptance and
fulfillment evidence. No new stored status, approval route or notification is added.

## APIs, filters and exports

- `GET /dashboard/completion`: canonical paginated request rows and vector/category.
- `GET /dashboard/completion-summary`: same authorized cohort and aggregate contract.
- Existing summary/workload/lifecycle responses add `completion_report`; old
  `completion_dimensions` keys remain compatible numeric aliases where present.
- Supported canonical filters: request ID/type/domain, department, section,
  assigned-to (including unassigned), actual warehouse, search, creation dates,
  completion category, and `incomplete=true`. Compatibility selectors for historical
  effective status/current approval step, maintenance reference and central-supply
  status remain distinct from canonical completion category.
- List order is stable created-at/ID descending. Count and page use **one SQL
  statement/snapshot**, including an empty out-of-range page. Page size is bounded
  to 250. Ordinary pages project only their selected rows; category/incomplete filters
  evaluate the full cohort to keep count/membership correct. A materialized per-row
  projection prevents repeated function evaluation for each category condition.
  Summary is independent of pagination.
- Default request CSV/PDF exports use the exact same source and filters without
  pagination. CSV contains per-line canonical evidence, stage flags, category and
  version; PDF labels its completion basis and category. Canonical operational
  exports omit costs, prices and paid amounts. `basis=historical` deliberately
  preserves historical export columns/formulas but applies actual request scope.
- Existing incomplete browser CSV/print and department Excel/CSV use their displayed
  authorized rows and add the canonical category. Existing incomplete estimated
  request costs remain only on that already-authorized compatibility endpoint;
  no financial amount enters the operational-only contract.
- Warehouse weekly report defaults to `basis=canonical_net_issue_quantities`;
  `basis=historical` explicitly reads the former archive and labels it accordingly.
  Existing inventory cross-warehouse/cross-institute grants are checked by the
  canonical inventory policy against the actual warehouse.

## Historical compatibility assessment

Raw request/item/approval/GR/case/payment/inventory history is never rewritten.
Archive completion counts, purchase-entry counters, stock-ready queue semantics,
priority/assignment rules, financial open obligations and workload weights are
retained. They are not relabelled as fulfillment. The default incomplete cohort
intentionally changes: ordered-but-undelivered, unaccepted, quarantined and
historically closed-but-unverified requests remain visible; terminal and verified
fulfilled demand leaves the list. Export default columns intentionally become
operational canonical columns; historical mode preserves prior columns. Counts
formerly obtained from other institutes are removed as an authorization correction.

The department board remains a purchasing follow-up view, so its open-item selection
and remaining-to-purchase quantities need not equal a fulfillment backlog. Its
canonical badge/export field is the same whole-request metric used elsewhere.
Likewise, specialist assignment queues retain their assignment/archive selection.

## Database governance and manual Development review

**No new database migration required.** Prerequisites are existing canonical schema
059, hold timing 048 (included in the snapshot), and Phase 6A/6B SQL 067/068. The
new reader returns a controlled schema-required error if Phase 6B is missing.
No frozen SQL, grants, triggers or historical financial/inspection values are edited.
No Approval Engine V2 activation: `LIVE_ROUTING_ENABLED=false` remains unchanged.

Before manually deploying after review:

1. Verify the existing 067/068 prerequisites and trusted backend role, UTC database
   timestamp interpretation and required read privileges in Development.
2. Run the disposable PostgreSQL and reporting/frontend suites below. Exercise real
   historical, stock-only, mixed-UOM, department and assigned-warehouse examples.
3. Review legacy export callers; choose explicit historical basis only where the
   old columns are required. Confirm canonical filter/count/export parity.
4. Review query plans on representative histories. No hosted SQL, status backfill,
   automatic deployment, merge, stock adjustment or historical relinking is part
   of this task.

## Regression matrix and results

Results are recorded after execution below. Native reporting tests reuse the real
Phase 6B independent-reviewer → SCM disposition → GR application → canonical
inventory posting/issue fixtures, not a mocked completion function. The validated
disposable URL replaces configured DATABASE_URL before application imports.

| Requested scenario | Verification |
| --- | --- |
| 1. Fully fulfilled | Actual accepted inventory and full canonical warehouse issue |
| 2. Partial fulfillment | Full receiving, partial actual issue, distinct category and quantity |
| 3. Stock-fulfilled | Stock-ready demand without a PO requires actual issue |
| 4. Ordered undelivered | Awaiting delivery with zero accepted/fulfilled evidence |
| 5. Received unaccepted | Real pending delivery-inspection task remains unaccepted |
| 6. Rejected receipt | Actual authorized rejection contributes zero acceptance |
| 7. Quarantine | Technically accepted quarantine still contributes zero usable delivery |
| 8–9. Multiple POs/receipts | Actual two-PO/two-GR acceptance aggregates, one request denominator |
| 10. Mixed stock/purchase | Direct accepted line plus stock line only completes after stock issue |
| 11. Terminal exclusions | Cancelled/rejected denominator and rate semantics; cancelled case excluded |
| 12. Institute isolation | Bounded scopes require explicit cross-institute permission |
| 13. Department | Filter intersection, department totals and actual board/controller parity |
| 14. Warehouse | Actual owned warehouse cohort, foreign rejection, scoped canonical net-issue report |
| 15. Holds | Actual held approval timestamp subtracts known hold, no invented completion clock |
| 16. Dates | Inclusive UTC boundary, reversed/invalid dates rejected |
| 17. Pagination | Stable page union equals unpaginated export source; no duplicate IDs; empty page retains total |
| 18. Export parity | Same reader/vector, actual CSV handler, foreign empty export and scoped historical mode |
| 19. Arabic/English | Real i18next instances render all operational category translations |
| 20. Historical compatibility | Raw Completed preserved and flagged unverified; read snapshots unchanged; old stock/archive regressions |
| 21. Cross-view consistency | Actual summary/workload/lifecycle/incomplete/all/assigned/department controllers return the same vector or dimensions |
| 22. Reporting regressions | Full backend, existing Phase 6A/6B/P2P and targeted frontend checks |

### Executed checks

| Check | Result |
| --- | --- |
| Backend `npm test -- --runInBand` | PASS: 225 suites / 1,877 tests |
| `npm run test:completion-reporting-postgres` | PASS: 29 reporting scenarios plus all 43 real Phase 6B receipt/inspection/inventory scenarios |
| `npm run test:completion-postgres` | PASS: all 35 Phase 6A cases plus actual stock/archive dashboard compatibility and SQL 054/055 technical-workflow regressions |
| `npm run test:p2p-postgres` | PASS: 92 existing authorization, technical-clearance and P2P regressions |
| Targeted frontend reporting/request/warehouse tests | PASS: 9 suites / 40 tests, including real English/Arabic i18next rendering |
| Frontend `CI=false npm run build` | PASS with two pre-existing lint warnings: DepartmentRequestedItemsBoard unused actionLoading, fixed-assets PhysicalInventory effect dependency |
| Changed backend `node --check` and `git diff --check` | PASS |

The stricter request/warehouse read boundaries required updating old unit fixtures
that supplied no actor/institute or warehouse ownership. Tests still verify their
original domain/section filters and balance identity. The Phase 6A stock/dashboard
fixture now supplies its actual institute. No permission check was weakened to
make a fixture pass. PDF uses the same canonical list source; authoritative export
query/CSV parity is tested in PostgreSQL, while no automated PDF text-extraction
check is claimed. CI=true production builds treat the existing lint warnings as
errors; no unrelated lint fixes are included.

## Remaining risks

The projection is current-state reporting, not historical month-end reconstruction.
Existing unlinked receipt reclassifications and missing historical source evidence
still require controlled review; no amount/status matching is invented. Large
cohorts invoke canonical quantity functions and recursive reversal reads; production
query-plan/load testing remains required. Existing exports/incomplete arrays remain
unpaginated by design for compatibility and may need a separately designed streaming
solution at scale. Department item exports follow their existing multi-page browser
fetch behavior and are not an immutable multi-request snapshot under concurrent edits.
Legacy archive fields remain semantically historical, not accepted-delivery proof.
No production role/RLS/custom-trigger inspection or hosted data reconciliation was
performed. Existing production cost-report access policy is retained; new operational
rows add no cost amounts. Missing trustworthy fulfillment timestamps prevent a new
fulfillment cycle-time SLA; the API says so explicitly.

## Exact changed files

- `docs/audits/2026-11-phase6c-completion-reporting.md`
- `purchase-backend/controllers/dashboardController.js`
- `purchase-backend/controllers/departmentRequestedItemsController.js`
- `purchase-backend/controllers/requests/fetchRequestsController.js`
- `purchase-backend/controllers/requests/incompleteController.js`
- `purchase-backend/controllers/requests/procurementHistoryController.js`
- `purchase-backend/controllers/warehouseInventoryController.js`
- `purchase-backend/controllers/warehouseSupplyController.js`
- `purchase-backend/integration/completionReporting.postgres.js`
- `purchase-backend/integration/goodsReceiptAcceptance.postgres.js`
- `purchase-backend/integration/stockFulfilledRequests.js`
- `purchase-backend/package.json`
- `purchase-backend/routes/dashboard.js`
- `purchase-backend/routes/procurementPerformance.js`
- `purchase-backend/routes/requests.js`
- `purchase-backend/scripts/testBackendContractRefresh.js`
- `purchase-backend/services/procurementReportingService.js`
- `purchase-backend/tests/departmentRequestedItemsController.test.js`
- `purchase-backend/tests/fetchRequestsController.assigned.test.js`
- `purchase-backend/tests/fetchRequestsController.domain.test.js`
- `purchase-backend/tests/procurementHistoryController.test.js`
- `purchase-backend/tests/procurementReportingService.test.js`
- `purchase-backend/tests/warehouseSupplyConflict.test.js`
- `purchase-frontend/src/components/CompletionReportingSummary.jsx`
- `purchase-frontend/src/components/CompletionReportingSummary.test.jsx`
- `purchase-frontend/src/components/requests/IncompleteRequestsDashboard.jsx`
- `purchase-frontend/src/locales/interface.ar.json`
- `purchase-frontend/src/locales/interface.en.json`
- `purchase-frontend/src/pages/AllRequestsPage.jsx`
- `purchase-frontend/src/pages/AssignedRequestsPage.jsx`
- `purchase-frontend/src/pages/CompletedAssignedRequestsPage.jsx`
- `purchase-frontend/src/pages/Dashboard.jsx`
- `purchase-frontend/src/pages/DepartmentRequestedItemsBoard.jsx`
- `purchase-frontend/src/pages/LifecycleAnalytics.jsx`
- `purchase-frontend/src/pages/WarehouseInventoryPage.jsx`
- `purchase-frontend/src/pages/WarehouseSupplyRequestsPage.jsx`
- `purchase-frontend/src/pages/WorkloadAnalysis.jsx`
