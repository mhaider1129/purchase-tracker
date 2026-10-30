# AUD-009 remediation — technical approval content identity

Revalidated on 31 October 2026 (Asia/Baghdad) against `origin/master` at
`85f31e20`, including merged AUD-008 PR 76. Read the October system audit,
remediation backlog and integration matrix. The finding remained confirmed.

## Root cause and current-HEAD reproduction

`technicalProposalSnapshot.prepare` hashed the complete quotation query result,
including `rfx_responses.status AS response_status`. The RFx award controller
created canonical awards and a PO, then changed the winning response from
`submitted` to `awarded`. The PO issue service correctly rechecked technical
clearance, but `assertCurrent` compared the original submitted hash with the
awarded row and raised `TECHNICAL_PROPOSAL_CHANGED` despite identical content.

A controlled probe loaded the **unchanged master implementation** using a local
Node module and an in-memory query stub. Only `response_status` changed from
submitted to awarded; the original function returned
`TECHNICAL_PROPOSAL_CHANGED`. No database, filesystem evidence or storage service
was accessed by the probe.

## Design and fingerprint rules

New quotation-bound review packets contain `quotation_fingerprint_version: 2`,
a server-generated `quotation_snapshot`, and its SHA-256 hash. Existing JSONB
packet storage supports these keys; no schema change is required. Clients cannot
supply authoritative hashes: existing evidence normalization strips those fields
and preparation derives them from persisted quotation/catalog/attachment rows.

Version 2 uses stable recursive JSON object-key ordering, preserves array order,
and hashes the following:

| Content | Source and precise rule |
| --- | --- |
| Quotation identity/version | Persisted `rfx_response_items.id`, `rfx_response_id`, `requested_item_id`; a replacement response/line cannot reuse the old approval. No absent quotation version field is invented. |
| Supplier | Joined `rfx_responses.supplier_id`; source linkage to the parent request is included through `response_request_id`. Existing eligible-supplier checks remain. |
| Quotation line content | All selected `q.*` fields, including `quoted_quantity`, `free_quantity`, `unit_price`, `currency`, `brand`, `offered_specs`, `notes`, `approved_product_id`, `supplier_catalog_item_id`; exclude only line `created_at`/`updated_at` bookkeeping. |
| Response content | `response_notes`, full `response_data` and `response_bid_amount`. Manufacturer/model/alternatives/specifications/attachment revisions supplied in response JSON remain material; no arbitrary nested keys are discarded. |
| Purchasing UOM authority | Catalog `id`, `supplier_id`, `approved_product_id`, `purchasing_uom_id`, `conversion_factor`. Canonical PO conversion still uses the approved product package quantity and inventory UOM rules. |
| Selected technical attachments | De-duplicated selected attachment IDs, sorted before hashing, and their persisted metadata from `to_jsonb(attachments)`, restricted to the quoted request. Replaced file references, revised metadata or missing files invalidate clearance. No new storage byte-digest guarantee is claimed. |
| Workflow exclusions | Only top-level `response_status`, `created_at`, `updated_at` are excluded from the quotation snapshot. RFx event, PO and request workflow state are not technical proposal identity. |

The existing **separate** requested-item fingerprint remains authoritative for
`id`, `request_id`, `item_name`, `quantity`, `specs`, `brand`, `unit_of_measure`,
`generic_item_id`, `preferred_product_id`, `mandatory_product_id`. The existing
approved-product snapshot/hash still covers persisted product/manufacturer
identity, model/part number, specifications and package information (excluding
`updated_at`/`updated_by`). Preparation binds the actual quoted product and
rejects a conflicting manually selected product.

Commercial command context also checks that award/PO unit price and currency
match the reviewed quotation, that its catalog offer was not substituted, and
that a partial allocation does not exceed the reviewed payable quantity.
Existing locked cumulative award/PO quantity limits remain; splitting an approved
quantity into valid partial orders does not itself require technical reapproval.

Normal submitted → evaluated → awarded → PO-created transitions do not affect
version-2 hashes. Eligibility is a **separate** check: withdrawn, cancelled,
closed/losing, superseded, rejected or unknown response states do not become
usable merely because their content is unchanged. Supported normal states are
case-insensitive `submitted`, `evaluated`, `awarded`, `po_created` (spaces also
normalize to underscores). Actual RFx award persists `awarded`.

## Canonical services, provenance and transactions

- Existing RFx, technical review, award, PO, supplier eligibility, budget and audit
  services remain the command owners. No duplicate review or alternate PO issuer
  was introduced; the issue-time technical clearance gate remains enabled.
- The gate returns the actual approved review ID, signed row version, signer,
  decision time, item fingerprint and quotation identity/hash/version.
- Award and PO creation record `TECHNICAL_REVIEW` document-flow links using the
  existing table, and their canonical audit events retain the exact clearance
  facts. Existing request→award, response→award, award→PO and line source links
  remain. Approved review records cannot be revised by the application; a new
  round has a new review record/ID. The PO therefore retains the signed round
  used at creation rather than silently adopting a later approved review.
- Issuance of a version-2 quotation-bound PO verifies the signed review link as
  well as current content and request snapshot. Missing/replaced provenance or absent signer/decision timestamp
  produces an explicit re-review-required error, before any budget commitment.
- The RFx controller passes the complete authenticated actor into canonical
  services. When the technical gate is installed, missing/foreign actor institute
  is rejected against the actual parent request. Existing endpoint permissions,
  active reviewer assignment checks and independent SCM sign-off remain intact.
  This is **not** a general AUD-002/AUD-004 commercial authorization remediation.
- Existing transaction boundaries contain awards, lines, document links, audits,
  outbox and commitment writes. Row/advisory locks, retry behavior and idempotency
  are reused. Quotation line/catalog/attachment snapshots use shared locks. We do
  not introduce an RFx header lock after the technical advisory lock: award takes
  that header first, and response status is intentionally outside content identity.
  Application quotation submission creates new immutable source rows; out-of-band
  database edits/concurrency remain outside the tested API boundary.

## Historical compatibility and recovery

No approved packet, signed timestamp, source reference or historical hash is
rewritten or backfilled. Unversioned/version-1 hashes retain **exact original**
whole-row comparison, including original status and JSON serialization. If they
still match, their original validation remains valid. A mismatch (including an
old submitted approval now pointing to an awarded response), missing hash or
unknown version returns HTTP 409 `TECHNICAL_PROPOSAL_REVIEW_REQUIRED` with an
explicit message directing the user to review the current proposal. We never
remove status from an old hash and treat it as a new approval.

Use the existing SCM new-review action to create a new round against the current
quotation/evidence, obtain the departmental opinion and independent SCM sign-off,
then retry creation where no PO exists. For an existing unissued PO whose signed
source cannot be verified, use the governed cancellation and PO-from-active-awards
creation workflow after re-review (where existing receipt/commitment controls
permit); repeating the idempotent RFx award action alone does not replace an old
PO. Completed historical records remain preserved.
Version-2 POs also require their recorded review provenance: do not manually attach
a new review to an old PO. If a later review supersedes that signed source, resolve
it through the existing governed PO cancellation/recreation workflow (subject to
receipt/commitment controls), not a silent link rewrite.

Frontend actions and API payloads were reviewed: existing error handling displays
the server's explicit message, the technical workspace supports a new round, and
PO actions use the existing services. No frontend code or UI redesign was needed.

## Exact files changed

- `purchase-backend/services/technicalProposalSnapshot.js`
- `purchase-backend/services/preprocurementTechnicalReviewGate.js`
- `purchase-backend/services/procurementIdentityPolicyService.js`
- `purchase-backend/services/procurementAwardService.js`
- `purchase-backend/services/purchaseOrderService.js`
- `purchase-backend/controllers/rfxPortalController.js`
- `purchase-backend/tests/technicalProposalSnapshot.test.js`
- `purchase-backend/tests/preprocurementTechnicalReviewGate.test.js`
- `purchase-backend/tests/technicalProposalContentIdentity.test.js`
- `purchase-backend/tests/technicalAwardWorkflow.test.js`
- `purchase-backend/tests/helpers/technicalAwardFixture.js`
- `docs/audits/2026-10-aud009-remediation.md` (this report)

## Automated validation

The workflow test runs the real quotation persistence/normalization, technical
review creation, reviewer opinion, SCM sign-off, permission-gated RFx award
controller, canonical award/PO creation, PO approval controller and PO issue
controller/service. An in-memory SQL/repository adapter supplies persistence and
simulates transaction/row-lock serialization. Optional profile/schema/retention
infrastructure is stubbed; clearance, approval, supplier eligibility, pricing,
budget calculations, audit and outbox services are not replaced. Both a governed
Product/Catalog device proposal and an approved non-stock exception complete the
flow. **This is a controller/service end-to-end regression, not a browser or real
PostgreSQL/RLS integration test.** No hosted SQL or disposable migration harness
was executed.

Additional scenarios cover supplier/product/model/manufacturer/specification,
quantity/free quantity, request and purchasing UOM/conversion, price, currency,
alternatives, quote attachment revision and selected evidence replacement/deletion;
normal status transitions and JSONB key order; stale request/unknown/legacy
approval; catalog substitution; authorized partial PO quantities; concurrent award
retries; duplicate issuance; unauthorized actors; foreign institute; independent
reviewer selection; rollback after PO creation audit and after issuance/budget
commitment. All new tests must pass before release.

From `purchase-backend`:

```sh
npm test -- --runInBand tests/technicalAwardWorkflow.test.js tests/technicalProposalContentIdentity.test.js tests/technicalProposalSnapshot.test.js tests/preprocurementTechnicalReviewGate.test.js tests/rfxIdentityCorrection.test.js tests/rfxAwardPricing.test.js tests/phase4PurchaseOrderCutover.test.js
npm test -- --runInBand
```

From `purchase-frontend`:

```sh
CI=true npm test -- --runInBand src/pages/PreprocurementTechnicalReviewsPage.test.jsx
```

Final execution results:

- Focused backend regression command above: **7 suites / 82 tests passed**.
- Full backend Jest: **214 suites passed / 3 failed; 1,728 tests passed / 3 failed**.
  The three failures were independently reproduced in an isolated unchanged
  `85f31e20` checkout: `fetchRequestsController.domain.test.js` and
  `procurementHistoryController.test.js` existing SQL-shape expectations, and
  `phase5aCanonicalItemWriterBoundary.test.js` existing schema-fixture DML scan.
  No new remediation regression failed.
- Existing technical-review frontend: **1 suite / 11 tests passed**. Existing
  React Router warnings remain. No frontend code changed; no frontend build was
  needed for this backend-only patch.
- Node syntax checks on all changed/new JavaScript and `git diff --check`: passed.

No dependency, lockfile, frozen migration, live approval engine or frontend source
was changed. No migration-installing SQL harness was executed.

## Database, rollout and remaining risks

**No database migration required.** New fields are in existing review JSONB and
canonical audit metadata; document-flow links use existing schema. Nothing was
merged or deployed automatically. After manual review/merge, deploy/restart the
backend normally; no frontend rebuild is required by this PR. On a local fixture,
complete the eight steps, check the PO's review/award/source links and repeat issue;
then revise a source specification/evidence reference and verify issuance blocks.
Use only a disposable local database for any manual test writes.

Hosted schema/RLS/trigger behavior and real PostgreSQL lock interleavings remain
unverified. The existing runtime initializers (AUD-010) are unchanged. General
commercial/finance/RFx institute authorization findings AUD-002/AUD-004 remain
separate; this PR covers the technically gated path and preserves prior endpoint
capabilities. Original approval-engine activation is untouched.

File metadata/reference hashing cannot detect someone replacing bytes at the
same storage key outside the controlled application/storage workflow; keep
objects immutable/versioned. Product and requested-item fingerprints retain
existing behavior; independent numeric/text normalization or master-data lifecycle
changes are not silently redefined here. Legacy approvals may require one explicit
new round, and version-2 POs missing the exact review link fail closed. Requests or
POs already historically issued are not rewritten or retroactively reissued.

LIVE_ROUTING_ENABLED remains FALSE.
The existing approval engine remains authoritative.
No SQL was executed against Development Supabase.
No SQL was executed against Production Supabase.
