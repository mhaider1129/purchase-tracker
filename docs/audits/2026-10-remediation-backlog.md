# October 2026 — prioritized remediation backlog

Reviewed baseline `f254a6da68ae8268a8afc0149dd903ed10f42de5` on 30 October 2026 (Asia/Baghdad). Documentation-only audit. See [system audit](2026-10-system-audit.md) for finding definitions, complete evidence and test limitations.

## Priority policy

Ordering follows the requested criteria: (1) patient safety/clinical continuity, (2) financial integrity, (3) data integrity, (4) authorization/auditability, (5) operational continuity, (6) UX, (7) enhancement value. A lower severity item can be a dependency in an earlier batch. No production patch, migration execution or broad refactor is authorized by this documentation-only PR. CRITICAL is not assigned without evidence.

| Order | Finding | Severity / evidence         | Reason for priority                                         | Owner / batch          |
| ----- | ------- | --------------------------- | ----------------------------------------------------------- | ---------------------- |
| 1     | AUD-003 | HIGH / CONFIRMED            | Clinical confidentiality and evidence integrity             | Security/API           |
| 2     | AUD-006 | HIGH / CONFIRMED            | Clinical stock-planning authority                           | Security/API           |
| 3     | AUD-008 | HIGH / CONFIRMED            | Active clinical demand must not disappear prematurely       | Module owner + QA      |
| 4     | AUD-009 | HIGH / CONFIRMED            | Technically approved sourcing must reach valid PO issue     | Module owner + QA      |
| 5     | AUD-001 | HIGH / CONFIRMED            | Financial liability/settlement and duplicate writer control | Supply chain + finance |
| 6     | AUD-002 | HIGH / CONFIRMED            | Authorization and cross-institute data integrity            | Security/API           |
| 7     | AUD-005 | HIGH / CONFIRMED            | Authorization and cross-institute data integrity            | Security/API           |
| 8     | AUD-004 | HIGH / CONFIRMED            | Authorization and cross-institute data integrity            | Security/API           |
| 9     | AUD-007 | HIGH / CONFIRMED            | Authorization and cross-institute data integrity            | Security/API           |
| 10    | AUD-018 | MEDIUM / CONFIRMED          | Accurate operational completion/reporting                   | Module owner + QA      |
| 11    | AUD-011 | MEDIUM / CONFIRMED          | Accurate operational completion/reporting                   | Module owner + QA      |
| 12    | AUD-010 | MEDIUM / CONFIRMED          | Database/audit/recovery/release confidence                  | Module owner + QA      |
| 13    | AUD-014 | MEDIUM / CONFIRMED          | Database/audit/recovery/release confidence                  | Module owner + QA      |
| 14    | AUD-012 | MEDIUM / CONFIRMED          | Database/audit/recovery/release confidence                  | Module owner + QA      |
| 15    | AUD-013 | MEDIUM / CONFIRMED          | Database/audit/recovery/release confidence                  | Module owner + QA      |
| 16    | AUD-015 | MEDIUM / CONFIRMED          | Database/audit/recovery/release confidence                  | Security/API           |
| 17    | AUD-017 | MEDIUM / CONFIRMED          | Database/audit/recovery/release confidence                  | Module owner + QA      |
| 18    | AUD-019 | MEDIUM / PARTIALLY VERIFIED | Policy/deployment evidence before expanding assurance       | Module owner + QA      |
| 19    | AUD-020 | MEDIUM / NOT VERIFIED       | Policy/deployment evidence before expanding assurance       | Module owner + QA      |
| 20    | AUD-016 | LOW / CONFIRMED             | Usability after integrity controls                          | Module owner + QA      |

## Implementation sequence and exit criteria

### Batch 1 — attachment authorization and legacy API closure (recommended next PR)

Scope AUD-003 + AUD-015 only: one request/contract-aware file access policy, canonical download/upload/delete handling, remove/gate the public local mount and redirect/deprecate legacy files routes without alias-only repair. Preserve technical evidence FK retention and local/remote behavior. Exit: anonymous/unrelated/foreign requests denied; assigned reviewer permitted; retained object never deleted; all existing legitimate download clients verified. This should not include a full application redesign or schema migration unless a concrete policy dependency requires it.

### Batch 2 — clinical lifecycle and technical quote blocker

Separate small PRs for AUD-008 and AUD-009. Historical inspection must not complete/reopen arbitrary requests. Quote content must stay authoritative while normal submitted→awarded transitions do not invalidate unchanged technical clearance. Exit: rejected/unfinished requests remain active/terminal as policy requires; complete attestation→RFx award→approved PO issue test succeeds; changed content still blocks.

### Batch 3 — isolate operational and commercial roots

AUD-006/007 planning and autoassignment boundaries, then AUD-002/004/005 P2P/RFx/contracts. Define current institute/shared/cross-scope policy explicitly; carry full actor context; add negative two-institute tests before refactoring. Exit: every root and child read/write/export route has object authorization, including idempotent retry returns. Any ownership migration must preserve known scopes and stop for ambiguous legacy rows.

### Batch 4 — single financial authority for contracts

AUD-001 requires finance-approved source mapping, historic duplicate/open-balance reconciliation and controlled read-only legacy history. Define contract invoices with/without PO, retainage/tax, independent finance review, credits/refunds/cancellation and canonical paid allocations. Introduce forward migrations only after a concrete design review; do not replay historic settlement blindly. Exit: no active alternate paid-state writer, concurrent overpayment fails, mismatches/held acceptance block settlement, retries are atomic and both financial views reconcile.

### Batch 5 — completion and reporting integration

AUD-011/018: publish idempotent disposition-acceptance events and expose distinct shared completion dimensions. Reuse current active-request/stock-fulfillment and approval-hold semantics, avoiding a new duplicated status engine. Exit: held→partial→final acceptance updates PO, stock, case delivery, queues and reports consistently after consumer retry; financial open obligations remain visible separately.

### Batch 6 — schema, delivery and worker governance

AUD-010/014/012: owner-provided deployment inventory; read-only schema preflights, forward migrations rather than runtime DDL; external notification outbox and business audit cutover; RFID stale-claim recovery and operator replay. AUD-017 baseline checks should be cleaned early as a verification prerequisite, not deferred until all features finish. Exit: DDL-denied application role operates with installed schema, incomplete modules fail read-only, crash/retry recovery tested, strict CI green.

### Batch 7 — approval pilot evidence, policy assurance and UX

AUD-013/019/020 establish representative V2 matching thresholds, required supplier clinical qualification and deployed configuration evidence. Keep V2 live disabled until a separate approved pilot/cutover milestone. Then AUD-016 simplify role-specific task flows, reconcile navigation labels and validate Arabic/keyboard/mobile workflows. Do not assign a schedule or claim milestone completion without owner acceptance evidence.

## Detailed implementation tickets

### AUD-003 — Attachments / clinical confidentiality

**Severity / evidence:** HIGH / CONFIRMED.

**Correction:** Use one request/contract-aware attachment authorization service for every read/write/delete and signed/download URL. Remove or gate the public local mount. Retain evidence deletion protection and safe path handling.

**Dependencies:** Clinical case visibility, contract file visibility, local/Supabase storage adapters, AUD-015 legacy file route.

**Acceptance / regression tests:** Anonymous local download; unrelated same-institute user; foreign-institute user; assigned reviewer allowed; upload to foreign request; retained evidence delete; URL expiry; path traversal and local fallback.

### AUD-006 — Procurement plans / replenishment

**Severity / evidence:** HIGH / CONFIRMED.

**Correction:** Introduce explicit planning view/manage capabilities and department/warehouse scope, validate linked request/stock/movement ownership, and audit configuration/version changes. Keep forecasts advisory until controlled release.

**Dependencies:** Permission catalog/UI policy; inventory identity; canonical movement consumption linkage; departmental planning ownership.

**Acceptance / regression tests:** Requester denied policy writes; foreign warehouse/plan/item links; planner permitted in assigned scope; duplicate link retry; immutable version history; forecast cannot issue a PO or inventory movement.

### AUD-008 — Legacy technical inspection / request completion

**Severity / evidence:** HIGH / CONFIRMED.

**Correction:** Make historical forms evidence-only or require a canonical lifecycle transition with current eligibility, completion facts and terminal-state guards. Preserve new receipt acceptance as separate authority.

**Dependencies:** AUD-011 shared completion semantics; historical compatibility policy; request priority exclusions.

**Acceptance / regression tests:** Accepted inspection on Submitted/Rejected/Cancelled/partially ordered requests cannot complete; pending inspection cannot reopen terminal; held required GR remains blocked; rollback of inspection and derived status/audit is atomic.

### AUD-009 — Technical review → RFx award → PO issue

**Severity / evidence:** HIGH / CONFIRMED.

**Correction:** Fingerprint immutable technical/commercial source content separately from expected workflow status. Preserve review invalidation for real supplier/product/specification/quantity/price changes. Do not remove the PO issue gate.

**Dependencies:** Canonical quote schema, audit snapshot versioning, RFx status semantics.

**Acceptance / regression tests:** Prepare→opinions→SCM sign-off→RFx award→PO approval→issue succeeds unchanged; changed content still fails; old fingerprints handled explicitly; retries after award do not bypass source checks.

### AUD-001 — Contracts / AP / Payments

**Severity / evidence:** HIGH / CONFIRMED.

**Correction:** Design a canonical contract-liability source adapter, then route contract payments through the posted-payable payment service. Preserve historic records, reconcile them explicitly, and disable legacy settlement mutations after cutover. Use exact decimal arithmetic, immutable allocations and independent finance authority.

**Dependencies:** Contract-to-canonical invoice mapping; legacy balance reconciliation; AUD-002/AUD-005 institute policy. Do not simply hide contract payment UI.

**Acceptance / regression tests:** Concurrent 60+60 against 100; retry/different-payload key; mismatch/held receipts; edits of paid records; currency mismatch; contract without PO; separate finance authority; rollback of audit/outbox.

### AUD-002 — P2P commercial and finance isolation

**Severity / evidence:** HIGH / CONFIRMED.

**Correction:** Carry immutable actor scope through repository construction or explicitly authorize each root request/document, then bind all dependent reads/writes to it. Require explicit cross-institute authority rather than assuming a global finance role.

**Dependencies:** Institution-wide finance policy, global/shared supplier policy, approval/delegation rules; audit event institute metadata.

**Acceptance / regression tests:** Two institutes using identical roles: PO/read/invoice/match/voucher/payment foreign IDs; mismatched route IDs; authorized explicit cross-institute actor; idempotency key cannot disclose a foreign retry.

### AUD-005 — Contracts and obligations institute isolation

**Severity / evidence:** HIGH / CONFIRMED.

**Correction:** Define contract ownership (including an explicit policy for genuinely shared contracts); authorize root contract once transactionally and enforce it on every child, file, renewal and approval command.

**Dependencies:** Legacy ownership reconciliation without guessing institute IDs; AUD-001 liability cutover; equipment coverage references.

**Acceptance / regression tests:** Foreign root and mixed-parent child IDs; shared contract explicit policy; assigned obligation owner; approvals; attachments; renewal status transitions; finance history remains immutable.

### AUD-004 — RFx / supplier selection

**Severity / evidence:** HIGH / CONFIRMED.

**Correction:** Scope RFx events/responses through their root request and pass the complete authenticated context. Separate public supplier submission from internal management, with verified supplier identity/invitations where required.

**Dependencies:** AUD-002 commercial scopes; supplier identity policy; public portal business requirements.

**Acceptance / regression tests:** Foreign event/response/request permutations; disabled user; anonymous internal award denied; supplier cannot impersonate another supplier; normalized quote and legacy aggregate paths preserve provenance.

### AUD-007 — Automatic procurement assignment

**Severity / evidence:** HIGH / CONFIRMED.

**Correction:** Give rules a defined institute scope, validate assignee/warehouse within it and resolve using request institute. Reconcile duplicates before adding uniqueness; preserve original decisions in audit history.

**Dependencies:** Organization ownership, requests/roles scope, migration for rule ownership only after explicit reconciliation; AUD-014 notifications.

**Acceptance / regression tests:** Two non-stock rules in different institutes; foreign assignee/warehouse rejected; missing/ambiguous current assignee; deterministic retry; approval transaction rollback has no outbound email.

### AUD-018 — Inspection → procurement reporting integration

**Severity / evidence:** MEDIUM / CONFIRMED.

**Correction:** Publish an idempotent accepted-receipt/disposition event transactionally and extend the existing performance consumer; use authorization/application ID rather than replaying the original receipt event key.

**Dependencies:** Existing case projection monotonicity, receipt completion aggregation, reporting coverage semantics.

**Acceptance / regression tests:** Held GR→partial release→final release→consumer produces one completed delivery; duplicate consumer/retry; rejection+replacement; immutable timeline and failure rollback.

### AUD-011 — Completion / operational status

**Severity / evidence:** MEDIUM / CONFIRMED.

**Correction:** Expose separate procurement, receipt/requester acknowledgment and financial completion dimensions in a shared read model; use operationally agreed terminal rules for priority/worklists. Remove competing writable projections only after compatibility planning.

**Dependencies:** AUD-008 legacy inspection behavior; stock-fulfilled rules; partial/cancelled obligations and request-level aggregation policy.

**Acceptance / regression tests:** Mixed stocked/procured/partially cancelled items; receipts complete but invoices open; paid invoice with unresolved commitment; inspection holds; requester issue/reopen; all dashboards use the same dimensions.

### AUD-010 — Database governance / runtime schema

**Severity / evidence:** MEDIUM / CONFIRMED.

**Correction:** Introduce read-only module contract preflights and an applied-version/checksum ledger under manual governance; replace runtime DDL incrementally with new forward patches. Never edit frozen migrations or blindly execute all numbered files.

**Dependencies:** Owner-provided migration history, baseline contract review, role privileges and compatible populated-data plan.

**Acceptance / regression tests:** Application startup/read/write with DDL denied; complete/absent/partial module; repeated forward patch; two-worker startup; transaction rollback; migration checksum mismatch.

### AUD-014 — Notifications / transactional audit

**Severity / evidence:** MEDIUM / CONFIRMED.

**Correction:** Move external delivery to deterministic outbox events and require transactional business audit for material legacy commands. Keep generic request audit as supplementary telemetry with explicit failure monitoring.

**Dependencies:** Existing email action-token semantics; outbox delivery adapters and retry/terminal operations; audit privacy/retention policy.

**Acceptance / regression tests:** Injected failure after queued event vs after external send; no email before commit; retry once; audit insert failure rolls back material mutation; dead-letter replay and redaction.

### AUD-012 — RFID processing recovery

**Severity / evidence:** MEDIUM / CONFIRMED.

**Correction:** Add bounded processing leases/claim timestamps and safe stale-claim recovery with idempotent business-event aggregation and operator visibility.

**Dependencies:** RFID scheduler/worker ownership, current aggregation keys, event retention and replay policy.

**Acceptance / regression tests:** Kill after committed claim; restart reclaims once; concurrent worker fencing; retry exhaustion visible; duplicate reads do not create duplicate movement exceptions.

### AUD-013 — Approval Engine V2 readiness

**Severity / evidence:** MEDIUM / CONFIRMED.

**Correction:** Define explicit representative coverage, unresolved/ambiguous/mismatch thresholds and reviewed waivers, with diagnostics linked to each readiness decision.

**Dependencies:** Owner-approved pilot acceptance criteria, canonical legacy route snapshots and delegation coverage.

**Acceptance / regression tests:** 20 mismatches/unresolved never imply pilot readiness; sufficient representative matches; intentional semantic differences require documented waiver; shadow never writes live approvals.

### AUD-015 — Legacy files API

**Severity / evidence:** MEDIUM / CONFIRMED.

**Correction:** Deprecate this duplicate API or delegate fully to the authorized canonical attachment service, with database retention checks before storage effects. Inventory actual frontend consumers before removal.

**Dependencies:** AUD-003 unified attachment access; legacy URL/client compatibility; SQL 054 evidence references.

**Acceptance / regression tests:** Actual storage export contract; existing and missing attachment; local and remote; unrelated/foreign actor; retained evidence cannot lose object; consistent 404/409 responses.

### AUD-017 — Release verification / static baseline

**Severity / evidence:** MEDIUM / CONFIRMED.

**Correction:** Reconcile SQL assertion expectations deliberately, separate test-fixture writes from production writer-boundary scanning without weakening it, fix test lint and application warnings, and retain strict CI.

**Dependencies:** Review intent of each SQL shape assertion; maintain boundary allowlist policy; no suppression-only fix.

**Acceptance / regression tests:** Full backend/frontend suites, lint, strict production build; deliberate foreign-writer mutation must still fail boundary test.

### AUD-019 — Supplier / clinical qualification completeness

**Severity / evidence:** MEDIUM / PARTIALLY VERIFIED.

**Correction:** Obtain approved qualification requirements, inventory existing SRM artifacts and model mandatory category-specific expiry/waiver controls only where policy requires them.

**Dependencies:** Clinical governance and jurisdiction-specific supplier policy; product regulatory identifiers; SRM owner.

**Acceptance / regression tests:** If required: expired license, category mismatch, shared supplier, documented emergency waiver, recheck before PO issue; existing compliance blockers remain effective.

### AUD-020 — Deployed database and external operations

**Severity / evidence:** MEDIUM / NOT VERIFIED.

**Correction:** Owner supplies migration ledger/checksums, read-only schema/privilege exports and deployment/worker/backup evidence through the governed process. Do not run audit SQL against hosted environments during this task.

**Dependencies:** Database owner and deployment operator; distinction between development and production.

**Acceptance / regression tests:** Later approved isolated restore compatibility test, worker crash/recovery drill and backup restore verification; never destructive hosted tests.

### AUD-016 — Technical-review UX / workspace complexity

**Severity / evidence:** LOW / CONFIRMED.

**Correction:** After integrity fixes, separate role-specific proposal, opinion and sign-off panels; prefill authoritative transaction fields and reveal optional details progressively. Validate with SCM/requester/inspector walkthroughs before broad visual redesign.

**Dependencies:** Clinical sample/data-sheet workflow, configured responsibilities, Arabic/English labels; AUD-009 source lifecycle.

**Acceptance / regression tests:** Keyboard and Arabic RTL flow; role-specific visibility; required evidence guidance; preserved draft on errors; simple/complex device cases and revised proposal round.

## Decisions the repository cannot make alone

- Which shared supplier/product/contract records are intentionally global, and which require institute ownership reconciliation?
- Does operational completion require physical acceptance only, requester acknowledgment, or settlement? Keep dimensions separate regardless.
- Is anonymous supplier-name RFx response an intentional open portal, or should identity/invitation attestation be mandatory?
- Which clinical/regulatory supplier qualifications are binding by category, and what approved emergency waiver process exists?
- What V2 route equivalence/mismatch/coverage thresholds and responsibility model authorize a live pilot?
- Which migrations, RLS/roles, workers/storage controls and backup restore evidence actually exist in each deployment?

These are follow-up policy/evidence requests, not blockers to publishing this audit and not permission to access hosted environments.
