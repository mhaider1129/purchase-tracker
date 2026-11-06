# SCOP transaction ownership and authority

**Status:** target authority contract for review, not an implemented connector or authority switch. Baseline `e72bf67d`, 2026-11-06. See [current state](scop-current-state-audit.md), [operating model](scop-target-operating-model.md) and [phased plan](scop-implementation-roadmap.md).

## Meaning of ownership

A system that captures evidence is not necessarily the system authorized to post the resulting stock or financial transaction. WICI remains the operational interface; SAP Business One is the authoritative master, posted inventory and accounting system. The external Central Supply Center owns its response/commitment evidence, subject to authenticated or explicitly attested receipt by WICI. It is not a second WICI accounting authority.

“SAP owns” below describes the target state, not current behavior. Today local inventory/AP/payment services are canonical inside Purchase Tracker. They must remain auditable until an approved, scoped cutover replaces their authority. No deploy-time flag may silently reinterpret already posted history.

## Transaction ownership matrix

| Object / operation | WICI operational ownership | Target posted/master authority | Current local anchor and required control |
|---|---|---|---|
| Department demand and amendments | Create, classify, attach evidence, approve/reject through existing routes | WICI | `requests`, `requested_items`, warehouse demand lines. Preserve institute, route snapshots, identity and quantity approvals. |
| Procurement assignment and workload | Eligible actor/assignee, buyer case, reassignment and workload | WICI | `procurement_cases`, assignment services/history. No SAP import may change buyer authority or priority implicitly. |
| Central Supply request | Submit/revise approved line allocation; record authorized local residual | WICI coordination; center owns its response evidence | Existing sent marker remains compatibility evidence. Future source allocation and response records require current actor, scope, revision and mandatory audit. |
| Central Supply acceptance/delay/decline | Validate/attest response and retain reference/evidence; reconcile revisions | External center for its commitment; WICI for acceptance of evidence and local sourcing authority | No center promise creates WICI stock/AP. Center invoices/intercompany/free supply require separate Finance-approved SAP document treatment. |
| RFx, quotations, commercial evaluation and awards | Existing sourcing, evaluation, supplier selection and signed award evidence | WICI for operational decision; SAP reflects resulting approved procurement documents | `rfx_*`, `procurement_awards`; source binding, confidentiality, partial-award limits and segregation remain mandatory. |
| PO preparation, approval and issue intent | Build from approved demand/award/contract, preserve technical clearance | WICI approval authority; SAP owns authoritative SAP PO document once integration is enabled | `purchase_orders/items` remain operational source/history. Decide with Finance/SCM whether supplier issuance waits for SAP PO acknowledgment; never issue two independent orders. |
| Physical delivery and receipt capture | Record actual quantity, lot/serial/expiry, location, damage and evidence | SAP for posted GRPO/inventory receipt; WICI for physical evidence | `goods_receipts/items`. Map existing receipt operation to one SAP posting and acknowledgment; exact B1 object selection requires discovery. |
| Technical opinion / acceptance / quarantine release | Independent reviewers, evidence, signatures, SCM sign-off and authorized disposition | WICI technical decision; SAP for resulting stock status/warehouse posting | Existing inspection and status-transfer services. Decision alone cannot create usable stock before required posting acknowledgment. |
| Item master / UOM / purchasing master attributes | Search, stewardship requests, review mappings | SAP for designated master attributes | Retain generic/product/catalog structures, stock IDs and clinical enrichment. Explicit field-level stewardship; no unapproved local material creation in SAP-authoritative scope. |
| Clinical specification, preferences and restrictions | Product suitability, clinical text, local sourcing/technical restrictions | WICI | Existing item identity and approved product metadata. SAP master import cannot erase restrictions or alter signed snapshots. |
| Supplier master / payment terms / tax identity | Select approved supplier, submit stewarded change request; retain SRM/compliance evidence | SAP for designated business-partner master fields | `suppliers`; preserve local IDs and names on old documents. Shared supplier records require reviewed institute entitlement. Supplier account identity is separate. |
| Warehouse master | Operational entitlements, department destinations, local display enrichment | SAP for warehouse codes and posting properties | `warehouses` mapped with institute/company. Central Supply premises are not WICI stock without approved ownership mapping. |
| On-hand, stock issue, transfer, return, correction | Physical execution, requested operations, local evidence and reservations | SAP for posted inventory movements and quantities | Current `inventory_transactions`, allocations, balances and canonical services. Cutover adapter must prevent both local and SAP posting of one action. |
| Reservations / planned allocation | Pending operational demand and source/warehouse reservation policy | WICI operational reservations; any SAP reservation commitment reconciled explicitly | Existing reservation tables/services. Show overlays separately from SAP posted on-hand; avoid subtracting an integrated SAP commitment twice. |
| Valuation and inventory cost | Display approved SAP values/source dates | SAP | No local rolling cost/valuation engine or reconciliation by silently changing historical unit costs. |
| Department fulfillment | Issue/delivery evidence, receiving acknowledgment, shortage follow-up | WICI operational completion; SAP posted issue is required where applicable | Warehouse supply/transfer/department records and canonical completion projection. SAP issue alone need not equal department acknowledgment. |
| Contracts, amendments, obligations and SLA | Commercial/legal lifecycle and approval | WICI; any SAP contract/purchasing agreement mirrors need explicit mapping | `contracts` and existing lifecycle tables. Contract value is not posted AP; legacy settlement writers remain contained. |
| Supplier invoice capture and matching | Evidence capture, invoice identity, receipt/service/contract match, exceptions, verification | WICI pre-posting controls; SAP for posted AP invoice/tax/accounting | `supplier_invoices`, matching results, verified vouchers. Preserve AUD-009 clearance and existing finance separation. |
| AP liability / open payable | Authorize posting intent, display/reconcile SAP status | SAP | Existing `ap_vouchers`, `ap_payables` currently post locally. New SAP scope must use provenance-aware projection/readback, not call the local posting writer on import. |
| Payment execution, allocation and reversal | Request/preparation where authorized; monitor and reconcile evidence | SAP and its governed bank/treasury process | Existing `payment_records/allocations` preserve local history. Imported settlement is not a new local payment command. Prevent duplicate settlement across cutover. |
| Accounting, tax, exchange differences, periods | Supply operational dimensions/evidence, display authorized financial projection | SAP | Existing local finance structures remain attributable history, not a parallel new GL. Finance decides currency/tax/rounding policy. |
| Petty cash | Future operational authorization, custody, receipts and liquidation evidence | SAP for cash/bank/expense/payment accounting | No dedicated module verified. Reuse existing evidence and controlled financial linkage; never treat voucher approval as cash settlement. |
| Audit, notifications, integrations | Transactional business audit, authorized recipients, reliable intent/outcome history | WICI audit of WICI actions; SAP audit of SAP postings | Existing audit/outbox recovery. Link evidence; never fabricate missing historical events or claim exactly-once external delivery without downstream support. |
| Performance / completion / reconciliation | Read models across operational and posted evidence | Derived, with explicit source authority | Existing completion/reporting and contract reconciliation. Currency-specific totals, freshness, coverage and unknowns visible. |

## Field and identity governance

Before the first master import, approve a field-level contract including local table/column, SAP object/field, direction, transformation, UOM/precision, null semantics, steward, effective date and conflict behavior. SAP-mastered identity/status/warehouse fields must reject unauthorized local edits after activation. WICI clinical enrichment and immutable document snapshots remain locally owned.

External mapping needs company database, object type, stable header key and line key where appropriate; WICI institute/warehouse entitlement; local entity/PK; source revision/hash/time; review status; and supersession evidence. B1 human document numbers are display values, not globally unique IDs. `CardCode`, `ItemCode` and `DocEntry` are examples to verify against the installed API, not an assumed schema or endpoint contract.

First assess `document_flow_links`, item foundation and stock mapping tables for reuse. Existing internal stock mappings lack SAP company/object identity. If a supporting external-key registry is necessary, it must reference current canonical business tables rather than copy them. Names, matching amounts or an EPC alone are insufficient identity evidence. Merge/rekey and SAP code changes must preserve old links and local snapshots.

## Authority epoch and transaction protocol

A reviewed authority configuration must pin scope (company, institute, warehouse/domain as needed), effective version/epoch, mode and in-flight document policy. These are proposed semantics, not environment flags that exist today. Prefer cohorts large enough to avoid one physical stock pool having two active posting authorities. If legacy and SAP cohorts share a pool, reconcile opening balances and transfer ownership explicitly before any mixed operation.

| Mode | Allowed behavior | Blocked behavior |
|---|---|---|
| Existing local canonical | Existing approved writers and controls, attributed to local authority | Claiming these records were posted to SAP without confirmed evidence |
| Read-only SAP observation | Import approved masters/documents into reviewed mappings/read models; compare discrepancies | SAP writes, changing local posted quantities to match without review, financial auto-backfill |
| Shadow command validation | Validate prospective intents and mappings without dispatch; show differences | External document creation or supplier issue triggered by shadow results |
| Approved SAP authority | WICI authorizes operational intent; SAP posts; WICI reconciles acknowledgment | Local inventory/AP/payment posting of the same operation; automatic fallback on timeout |
| Paused / reconciliation required | Read state and controlled recovery of known pending commands | New affected postings, blind replay, authority downgrade to bypass SAP outage |

An intent and mandatory audit insertion must share a local transaction. External network calls occur after commit. Claim work atomically using durable lease/retry fencing; do not rely on process memory. A stable operation key, approved payload fingerprint and authority epoch survive retries. Changed payloads need a new authorized revision, not reuse of a successful key. Inbox application and local outcome/audit/projection updates share their own transaction and reject stale revisions/duplicate effects.

Exactly-once external posting is not guaranteed by a PostgreSQL lock. SAP support for deduplication or searchable immutable references must be demonstrated. After an ambiguous timeout, reconcile company/object/reference and source lines before any retransmission. Concurrent claims, worker restarts and late acknowledgments cannot create new financial authority or overwrite a newer disposition.

## Access and segregation

- Use existing permission middleware and fresh server-side actor/object authorization, including institute, department, warehouse and source-document relationships. No hardcoded SCM IDs or implicit institute from a request body.
- Current RFx capability is `rfx.manage`; existing PO and financial capabilities include `procure-to-pay.purchase-orders.manage`, `finance.post-ledger` and `finance.payment.manage`. Review the current permission catalog before deciding which granular integration/center review permissions are required. Do not invent role-name bypasses.
- Integration credentials have narrowly approved company/object/action scope. Worker service access is not permission to authorize new purchasing decisions. Deactivated/revoked authority and changed documents require policy-defined revalidation at dispatch.
- SAP transport identity is distinct from internal user, external supplier and RFID integration-client identities. External supplier quotation access needs an invitation/account binding if ever exposed; internal procurement API access is not that boundary.
- Finance reconciliation review, posting approval, payment execution and technical sign-off retain existing separation. Reports/exports/attachments follow object scope and confidential payload rules.

## Reconciliation and exception ownership

| Exception | Responsible owner | Safe resolution |
|---|---|---|
| Unmapped or conflicting material/supplier/UOM | Master Data + SCM, with Finance for tax/terms | Quarantine mapping; review supported identity; allow operational draft where permitted, block posting. |
| Center/local overlapping source commitment | SCM + authorized approver | Freeze residual buying; reconcile center response and amend allocation explicitly. |
| SAP command outcome unknown | Integration operations + Finance/Warehouse domain owner | Search by immutable reference, verify source/lines/company; attest match or approve retry only after ambiguity resolved. |
| Stock or valuation disagreement | Warehouse + Finance | Compare like-for-like scope/time/UOM/status, pending movements and authority epoch; controlled correction in owning system. |
| Local AP/payment vs SAP duplicate candidate | Finance reviewer | Use existing evidence-based worklist patterns; never settle, reverse or classify loss automatically by matching amount. |
| Missing audit / orphan acknowledgment | Audit owner + domain owner + IT | Diagnose read-only, preserve original evidence; no fabricated historical event backfill. |
| Supplier, warehouse or institute mismatch | Security + domain owner | Fail closed and investigate; no mapping that broadens scope merely to clear a queue. |

Keep reviewed reconciliation decisions, evidence snapshots, actor and timestamps. Currency totals remain separate without an approved conversion policy. Finance must approve opening balances, in-flight liabilities/payments and historical links before target financial authority is enabled.
