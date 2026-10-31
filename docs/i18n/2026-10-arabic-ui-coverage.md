# Arabic interface translation coverage — 31 October 2026

## Delivered coverage

The supplied Arabic-mode screenshots contained hardcoded English in the All
Requests filters, request detail workspace, procurement-entry dialog, device demo
workspace, fixed-assets navigation and theme switcher. Some workflow guidance was
also generated as English strings by the backend and rendered without localization.

This change:

- Translates the request filter labels/options, placeholders, actions, summary
  counts, current-step labels, status labels and request-type display names.
- Translates request workspace actions/tabs, overview scorecards, progress and
  completion text, item/history tables, procurement fields, document group headings
  and relevant modal/confirmation/error messages.
- Translates device-demo setup, comparison, supplier registration, evaluation,
  evidence, selection controls, field captions, workflow stages and known states.
- Translates the complete fixed-assets menu, priority/organization menu entries,
  AI action and theme captions.
- Reuses established Arabic wording for matching common literals across management,
  request forms, procurement, contracts, technical reviews, surgical consignment,
  inventory, planning, fixed-assets and shared UI controls. These modules receive
  common-label improvements; this does not claim complete localization of each.
- Translates shared attachment controls and known approval-action templates,
  preserving actual approver/assignee names and unknown custom instructions.

## Implementation and compatibility

`src/i18n.js` registers an additional `interface` namespace for both existing
languages. The two flat catalogues contain **782 messages**. Message-key separators
are disabled for this namespace's helper, so punctuation and colons are literal
text, not resource paths. The existing default namespace and language selector
remain in use. Integrating master retains both the planning permission checks and
translation subscription; the planning memo remains safe before results load. `useUiTranslation` subscribes components to language changes through
`react-i18next`; interpolated sentences retain placeholders in both languages.

`workflowTranslation` interprets only an explicit vocabulary and known generated
approval-action templates. It changes display text only. API status codes,
permission names, request types, tab identifiers, supplier IDs, department IDs,
route URLs, quantities, dates and saved units of measure are unchanged. Editable
unit values such as `Piece`, entered descriptions, specification text, names,
filenames, evidence and historical journal text are not rewritten or automatically
translated. Unknown workflow values and custom instructions remain readable as
provided. No backend, schema, permission or approval-routing change is included.

## Verification

From `purchase-frontend`:

```sh
CI=true npm test -- --runInBand
CI=false npm run build
node scripts/audit-ui-translations.cjs
node scripts/audit-ui-translations.cjs --json
```

- Full frontend suite after integrating master `afba8da3`: **104 suites / 467 tests passed**.
- New tests exercise live English/Arabic switching, punctuation/count interpolation,
  known approval guidance with names preserved, catalogue/placeholder parity,
  canonical filter parameters in Arabic, procurement quantities and original UOM,
  Arabic supplier-demo registration with unchanged IDs/model/notes, and translated
  navigation with unchanged destination URLs. Existing English workflow tests pass.
- The final documentation-group display addition is also checked by the focused
  workspace/locale suites after the full run: 3 suites / 12 tests passed.
- Production frontend build passed, with the two existing unrelated source lint
  warnings and the existing bundle-size advisory.
- Full-source ESLint has two existing errors in unchanged
  `pages/fixed-assets/PhysicalInventory.test.jsx` (direct DOM access and render
  result naming), and two existing warnings in DepartmentRequestedItemsBoard
  (unused actionLoading) and PhysicalInventory (effect dependency). Changed code
  introduces no additional lint diagnostics.
- Translation scan: **zero missing literal `uiText` catalogue keys**. This is static
  verification, not a browser visual inspection or a proof of full localization.

## Remaining module coverage

The scan finds **2,584 literal JSX text candidates across 105 files**. They require
manual review: technical identifiers and deliberately English text are not always
translation defects. This count is a lower bound on review scope because captions
assembled dynamically, backend errors, default props and export templates may also
need review. Run the JSON command for exact source locations and candidate text.
Do not treat this PR as a completed whole-system bilingual conversion.

The largest remaining areas are:

| Area | Literal text candidates |
| --- | ---: |
| Surgical consignment | 170 |
| Management | 148 |
| Contracts | 147 |
| Approval policies | 126 |
| Pre-procurement technical reviews | 120 |
| Procurement evaluation detail | 107 |
| Planning workbench | 105 |
| Risk management | 84 |
| Goods receipts | 68 |
| Organization hierarchy | 61 |

Future passes should localize each module's full sentences and dynamic labels,
review English error/confirmation text, then verify Arabic workflow behavior and
RTL layout. Avoid translating clinical descriptions, uploaded evidence, names or
stored business codes as a substitute for UI localization.

## Database and release

No database migration is required. No SQL was executed and no hosted database or
storage was contacted. After review/merge, rebuild and publish the frontend using
the existing release process. No merge or deployment was performed automatically.
The existing approval engine and its disabled V2 live-routing flag are unchanged.
