# Phase 5A Item Master UI map

| Surface | Identity interaction | Arbitrary entry / governance finding |
|---|---|---|
| `ItemMasterPage` + `ItemHierarchyWorkspace` | Lists/creates Generic, Products and Supplier Catalog; reference selectors; lifecycle/duplicate/pending/legacy mapping actions. | Correct normalized workspace, while the page also exposes legacy `item_master_items` APIs and thus parallel creation. |
| `StockItemMappingWorkspace` / Stock approvals | Selects Generic and optional Product for existing Stock Item; reviewers approve/supersede mappings. | Governed mapping; legacy stock creation remains elsewhere. |
| `GenericItemSelector` | Selects Generic and optional product for request forms. | Correct reusable selector; adoption is incomplete across forms. |
| Medication, Medical Device, Non-stock, Stock and Warehouse request forms | Capture item name/specification/brand/UOM; some use Generic selector and modes, older paths submit typed lines. | Ordinary free text may reach legacy/default request paths; backend permission is reliable only where `procurementItemIdentityService` is invoked. |
| RFx Portal / request workspaces | Displays request description and quotation lines. | No explicit awarded Product/Supplier Catalog selector. |
| Contract form/pages | Enters contract `item_name`, generic/brand text, unit and contracted price. | No verified canonical Generic/Product/Catalog selector; creates disconnected contract identity. |
| Warehouse Inventory | Selects Stock Items and tracking data. | Correct warehouse key, but cannot consistently expose exact Product because upstream mapping/receipt propagation is incomplete. |
| Supplier Catalog pane | Enters supplier code, purchasing UOM/conversion and unit price. | Uses Product parent; UOM remains text and price meaning is unlabeled. |
| Pending Item queue in Item Hierarchy workspace | Steward maps existing Generic/Product, creates draft, grants exception or rejects. | Backend supports final request-line re-link for resolved mappings; ensure UI shows unresolved/new-draft state. |

Reference data can be selected but no dedicated governed frontend creation flow for manufacturer, category or UOM was found. Do not add ad-hoc creation inside transaction forms; future stewardship screens should use existing permissions and canonical APIs.