# October 2026 — database migration audit

Reviewed baseline `f254a6da68ae8268a8afc0149dd903ed10f42de5` on 30 October 2026 (Asia/Baghdad). Documentation-only audit. See [system audit](2026-10-system-audit.md) for finding definitions, complete evidence and test limitations.

## Governance conclusion

**No database migration is required for this documentation-only PR. No SQL was executed against Development Supabase or Production Supabase. No migrations were applied.** Existing application patches are inventoried, not instructions to execute everything in order. Frozen migrations are unchanged.

There are multiple repository schema authorities: numbered manual SQL, dated foundation SQL/migration files, runtime ensure helpers and node-pg-migrate package scripts. No audited automatic deployment ledger proves they describe the same installed database. `View_Supabase_SQL.sql` is a checked-in snapshot; permission/UI INSERT snapshots are catalogs, not deployed-policy proof. A merged PR is not a migration receipt.

`docs/architecture/manual-migration-governance.md` still explicitly calls its old 001–006 deployment boundary an operational assumption. Current repository extends through 055. Do not infer either that old boundary is current or that all later scripts ran. Owner-provided applied versions/checksums and read-only exports are required for deployed assurance (AUD-020).

## Material dependency groups

| Group                                                                              | Current source contract / required predecessors                                            | Main risk                                                                                                               |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| 003 identity/reclassification, 008/009 master/UOM, original Item Master foundation | Controlled Generic/Product/Catalog/UOM and original request tables                         | Runtime legacy creates may omit later scope/UOM fields; NULL shared vs explicit institute ownership must be intentional |
| 004/005 inventory                                                                  | Warehouses, stock identities and complete movement/allocation/balance contract             | Populated balance identity and nonnegative/available serial constraints must be reconciled, never reset                 |
| 006/031 connected P2P                                                              | Canonical award/PO/receipt/invoice/voucher/payable, commitment and document links          | Existing legacy tables are not necessarily a complete connected schema; alternate contract settlement still active      |
| 010/012/047 performance and priority                                               | Approved item cases plus whole-request ranks/HOD evidence                                  | Item case grain differs from request priority grain; no invented scores/evidence                                        |
| 014–016/032/045/048 hierarchy/approval/timing                                      | Current organization/positions, policy diagnostics, route history and hold intervals       | V2 live remains disabled; timestamps/history must be preserved                                                          |
| 013/017–030 maintenance/assets                                                     | Equipment, assets, scope, RFID, movement/valuation/physical inventory                      | Hardware/service configuration and actual backfills cannot be certified from SQL text                                   |
| 035 plus compatibility 038–043                                                     | Backend schema reconciliation across partially populated modules                           | Fail-closed reconciliation requirements; compatibility patches must reflect data, not invented business facts           |
| 036/037 catalogs                                                                   | Existing permission/UI policy reconciliation                                               | Catalog presence does not guarantee enforcement or correct role assignment                                              |
| 044 reference starter lists                                                        | Existing categories/UOM/manufacturers tables                                               | Optional starter data and inactive/name conflicts are data decisions, not arbitrary business backfill                   |
| 049/050/051–053 clinical workflows                                                 | Pre-procurement reviews, demos, consignment + supplier scope + configured surgical routing | Existing responsibility/department/supplier authority and evidence prerequisites                                        |
| 054 technical workflow                                                             | SQL049 plus canonical GR, organization, inventory and attachments                          | Required new tasks affect new receipts only; evidence FKs/immutable rounds do not authorize generic file access         |
| 055 proposal scope                                                                 | Existing institutes/suppliers/approved_products                                            | Adds missing nullable scope columns while preserving shared legacy rows; patch presence does not prove deployment       |

No full rerun order is recommended here. Read each script's preflight/README and review populated data under the owner's change process. Diagnose drift before selecting a forward repair. Never edit an executed migration to fit a later installation.

## Runtime schema writers

The following files contain literal schema DDL. Counts are text occurrences, not executed statement totals or proof of exploitability. Material active examples were traced: ensureProcureToPayTables and ensureFinanceCoreTables issue all their statements when called; contracts runEnsureDdl swallows 42501/duplicate errors; request submission-key helper drops/recreates an index; ensureRequestedItemReceivedColumns also normalizes existing values. Audit middleware can create its table after a response.

| File                                                               | DDL text occurrences | First line |
| ------------------------------------------------------------------ | -------------------- | ---------- |
| purchase-backend/controllers/auditRegistryController.js            | 3                    | 14         |
| purchase-backend/controllers/contractEvaluationsController.js      | 2                    | 368        |
| purchase-backend/controllers/contractGovernanceController.js       | 10                   | 24         |
| purchase-backend/controllers/contractsController.js                | 92                   | 565        |
| purchase-backend/controllers/demandPlanningController.js           | 2                    | 240        |
| purchase-backend/controllers/requests/assignRequestController.js   | 3                    | 11         |
| purchase-backend/controllers/requests/createRequestController.js   | 3                    | 66         |
| purchase-backend/controllers/rfxPortalController.js                | 17                   | 30         |
| purchase-backend/controllers/supplierEvaluationsController.js      | 13                   | 96         |
| purchase-backend/controllers/supplierSrmController.js              | 3                    | 19         |
| purchase-backend/controllers/suppliersController.js                | 39                   | 65         |
| purchase-backend/controllers/utils/approvalRouteVersioning.js      | 4                    | 12         |
| purchase-backend/controllers/warehouseSupplyTemplatesController.js | 1                    | 23         |
| purchase-backend/services/procurementEvaluationService.js          | 3                    | 39         |
| purchase-backend/utils/attachmentsColumnSupport.js                 | 2                    | 75         |
| purchase-backend/utils/capabilityPolicyService.js                  | 1                    | 6          |
| purchase-backend/utils/ensureApprovalReminderColumn.js             | 1                    | 11         |
| purchase-backend/utils/ensureDepartmentItemFollowUpNotesTable.js   | 4                    | 9          |
| purchase-backend/utils/ensureFinanceCoreTables.js                  | 16                   | 6          |
| purchase-backend/utils/ensureHistoricalRequestSchema.js            | 13                   | 27         |
| purchase-backend/utils/ensureItemMasterTables.js                   | 14                   | 9          |
| purchase-backend/utils/ensureItemRecallsTable.js                   | 16                   | 18         |
| purchase-backend/utils/ensureMaintenanceRequestSchema.js           | 6                    | 22         |
| purchase-backend/utils/ensureMonthlyDispensingTables.js            | 4                    | 5          |
| purchase-backend/utils/ensureProcureToPayTables.js                 | 56                   | 7          |
| purchase-backend/utils/ensureProcurementPlanTables.js              | 6                    | 13         |
| purchase-backend/utils/ensureProjectsTable.js                      | 8                    | 23         |
| purchase-backend/utils/ensureRequestAutoAssignmentRulesTable.js    | 2                    | 11         |
| purchase-backend/utils/ensureRequestClientSubmissionKey.js         | 3                    | 11         |
| purchase-backend/utils/ensureRequestEditApprovalsTable.js          | 3                    | 5          |
| purchase-backend/utils/ensureRequestSchedulingColumns.js           | 2                    | 10         |
| purchase-backend/utils/ensureRequestedItemApprovalColumns.js       | 7                    | 11         |
| purchase-backend/utils/ensureRequestedItemFinancialsTable.js       | 7                    | 15         |
| purchase-backend/utils/ensureRequestedItemPoIssuanceColumn.js      | 1                    | 11         |
| purchase-backend/utils/ensureRequestedItemReceivedColumns.js       | 13                   | 11         |
| purchase-backend/utils/ensureRequestedItemUnitOfMeasureColumn.js   | 1                    | 5          |
| purchase-backend/utils/ensureRiskRegisterTable.js                  | 4                    | 5          |
| purchase-backend/utils/ensureTechnicalInspectionsTable.js          | 7                    | 18         |
| purchase-backend/utils/ensureWarehouseSupplyTables.js              | 19                   | 12         |
| purchase-backend/utils/ensureWarehouseTransferTables.js            | 6                    | 11         |
| purchase-backend/utils/evaluationCriteriaSeeder.js                 | 4                    | 71         |
| purchase-backend/utils/notificationService.js                      | 2                    | 9          |
| purchase-backend/utils/permissionService.js                        | 6                    | 271        |
| purchase-backend/utils/uiAccessService.js                          | 1                    | 211        |
| purchase-backend/middleware/writeAuditTrail.js                     | 1                    | 11         |

This is broader than only the last migration. A disciplined target is read-only startup/module contract verification with explicit 503 module-not-ready errors and forward manual patches. It is not necessary or safe to rewrite every module at once. Some newer services already follow preflight/fail-closed patterns; preserve them.

## Manual SQL inventory

| File under purchase-backend/sql/manual                    | Role                            | Deployment evidence           |
| --------------------------------------------------------- | ------------------------------- | ----------------------------- |
| 003_request_reclassification_and_uom.sql                  | Manual forward SQL / foundation | Installed status NOT VERIFIED |
| 004_inventory_transaction_engine.sql                      | Manual forward SQL / foundation | Installed status NOT VERIFIED |
| 005_inventory_operations.sql                              | Manual forward SQL / foundation | Installed status NOT VERIFIED |
| 006_connected_procure_to_pay.sql                          | Manual forward SQL / foundation | Installed status NOT VERIFIED |
| 007_phase5a_item_master_diagnostics.sql                   | Diagnostics / verification      | Installed status NOT VERIFIED |
| 008_phase5a1_reference_master_baseline.sql                | Manual forward SQL / foundation | Installed status NOT VERIFIED |
| 009_phase5a2_uom_authority.sql                            | Manual forward SQL / foundation | Installed status NOT VERIFIED |
| 010_supply_chain_performance_foundation.sql               | Manual forward SQL / foundation | Installed status NOT VERIFIED |
| 011_central_supply_tracking.sql                           | Manual forward SQL / foundation | Installed status NOT VERIFIED |
| 012_procurement_priority_foundation.sql                   | Manual forward SQL / foundation | Installed status NOT VERIFIED |
| 013_approved_spare_parts_foundation.sql                   | Manual forward SQL / foundation | Installed status NOT VERIFIED |
| 014_organization_hierarchy.sql                            | Manual forward SQL / foundation | Installed status NOT VERIFIED |
| 015_approval_policy_engine_foundation.sql                 | Manual forward SQL / foundation | Installed status NOT VERIFIED |
| 016_organization_hierarchy_cutover_readiness.sql          | Diagnostics / verification      | Installed status NOT VERIFIED |
| 017_fixed_assets_rfid_core.sql                            | Manual forward SQL / foundation | Installed status NOT VERIFIED |
| 018_fixed_assets_rfid_post_deployment_hardening.sql       | Manual forward SQL / foundation | Installed status NOT VERIFIED |
| 019_asset_equipment_integration.sql                       | Manual forward SQL / foundation | Installed status NOT VERIFIED |
| 020_asset_equipment_canonical_identity.sql                | Manual forward SQL / foundation | Installed status NOT VERIFIED |
| 021_contract_equipment_coverage.sql                       | Manual forward SQL / foundation | Installed status NOT VERIFIED |
| 022_contract_item_master_identity.sql                     | Manual forward SQL / foundation | Installed status NOT VERIFIED |
| 023_spare_part_stock_item_integration.sql                 | Manual forward SQL / foundation | Installed status NOT VERIFIED |
| 024_maintenance_work_orders.sql                           | Manual forward SQL / foundation | Installed status NOT VERIFIED |
| 025_maintenance_inventory_execution.sql                   | Manual forward SQL / foundation | Installed status NOT VERIFIED |
| 026_rfid_portal_enable_scope_index.sql                    | Manual forward SQL / foundation | Installed status NOT VERIFIED |
| 027_rfid_configuration_mutation_guards.sql                | Manual forward SQL / foundation | Installed status NOT VERIFIED |
| 028_asset_movement_operational_hardening.sql              | Manual forward SQL / foundation | Installed status NOT VERIFIED |
| 029_fixed_asset_deployment_valuation.sql                  | Manual forward SQL / foundation | Installed status NOT VERIFIED |
| 030_fixed_asset_physical_inventory.sql                    | Manual forward SQL / foundation | Installed status NOT VERIFIED |
| 031_p2p_batch1_authority_hardening.sql                    | Manual forward SQL / foundation | Installed status NOT VERIFIED |
| 032_approval_engine_operationalization_phase1.sql         | Manual forward SQL / foundation | Installed status NOT VERIFIED |
| 033_ai_intelligence_foundation.sql                        | Manual forward SQL / foundation | Installed status NOT VERIFIED |
| 034_ai_provider_audit_metadata.sql                        | Manual forward SQL / foundation | Installed status NOT VERIFIED |
| 035_backend_schema_reconciliation.sql                     | Manual forward SQL / foundation | Installed status NOT VERIFIED |
| 035_backend_schema_reconciliation_verify.sql              | Diagnostics / verification      | Installed status NOT VERIFIED |
| 036_permission_catalog_reconciliation.sql                 | Manual forward SQL / foundation | Installed status NOT VERIFIED |
| 037_ui_resource_reconciliation.sql                        | Manual forward SQL / foundation | Installed status NOT VERIFIED |
| 038_evaluation_result_timestamp_compatibility.sql         | Manual forward SQL / foundation | Installed status NOT VERIFIED |
| 039_evaluation_offer_model_compatibility.sql              | Manual forward SQL / foundation | Installed status NOT VERIFIED |
| 040_evaluation_cost_quantity_compatibility.sql            | Manual forward SQL / foundation | Installed status NOT VERIFIED |
| 041_evaluation_criteria_timestamp_compatibility.sql       | Manual forward SQL / foundation | Installed status NOT VERIFIED |
| 042_evaluation_stability_metadata_compatibility.sql       | Manual forward SQL / foundation | Installed status NOT VERIFIED |
| 043_evaluation_alternative_metadata_compatibility.sql     | Manual forward SQL / foundation | Installed status NOT VERIFIED |
| 044_item_master_reference_starter_data.sql                | Manual forward SQL / foundation | Installed status NOT VERIFIED |
| 045_approval_activation_timestamps.sql                    | Manual forward SQL / foundation | Installed status NOT VERIFIED |
| 046_maintenance_approval_reporting_policy.sql             | Manual forward SQL / foundation | Installed status NOT VERIFIED |
| 047_whole_request_priorities.sql                          | Manual forward SQL / foundation | Installed status NOT VERIFIED |
| 048_approval_hold_adjusted_timing.sql                     | Manual forward SQL / foundation | Installed status NOT VERIFIED |
| 049_preprocurement_technical_reviews.sql                  | Manual forward SQL / foundation | Installed status NOT VERIFIED |
| 050_device_demo_workspaces.sql                            | Manual forward SQL / foundation | Installed status NOT VERIFIED |
| 051_surgical_consignment.sql                              | Manual forward SQL / foundation | Installed status NOT VERIFIED |
| 052_surgical_consignment_supplier_scope_compatibility.sql | Manual forward SQL / foundation | Installed status NOT VERIFIED |
| 053_surgical_consignment_department_routing.sql           | Manual forward SQL / foundation | Installed status NOT VERIFIED |
| 054_technical_review_and_delivery_workflow.sql            | Manual forward SQL / foundation | Installed status NOT VERIFIED |
| 055_technical_proposal_scope_compatibility.sql            | Manual forward SQL / foundation | Installed status NOT VERIFIED |

## Static checks and what they do not prove

All 54 manual `.sql` files passed `node purchase-backend/scripts/validateManualSql.js <file>`. That script only rejects Git patch metadata. It is **not a SQL parser**, PostgreSQL execution, constraint verification, data reconciliation, permission check or migration compatibility proof.

302 backend JS files passed Node syntax checks. Existing mocked/unit suites include migration-text assertions. No disposable PostgreSQL harness was executed during this audit because those scripts install migrations. Earlier task results are historical evidence only and are not substituted for this audit's execution record.

One historical risk was explicitly checked rather than re-reported: nullable-project budget uniqueness is addressed by SQL035's `budget_envelope_contract_uq ... NULLS NOT DISTINCT`. The original runtime table declaration alone is insufficient to call duplicate budget envelopes a confirmed current schema defect. Whether that index exists hosted is AUD-020.

## Required owner evidence before deployment certification

Applied version list with immutable file hashes for each environment; read-only table/column/type/default/constraint/index exports; backend role grants and RLS bypass/policies; population counts for partial modules; pending reconciliation decisions; backup/restore evidence; process/worker versions and object-storage policies. No clinical rows or secrets are needed for the first reconciliation pass. Request explicit authorization for any future hosted read separately; this audit grants none.
