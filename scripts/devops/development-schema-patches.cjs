#!/usr/bin/env node
"use strict";
// Generates review-only SQL text offline. No driver, credentials or executor.
const fs = require("node:fs"),
  path = require("node:path");
const {
  splitStatements,
} = require("../../purchase-backend/scripts/lib/databaseRelease/sqlStatements");
const {
  literal,
} = require("../../purchase-backend/scripts/lib/databaseRelease/planner");
const root = path.resolve(__dirname, "../.."),
  dir = path.join(root, "docs/database/development-20261124");
const contract = require("../../purchase-backend/database/releases/schema-contract.json");
function guard(report, step) {
  if (!/^[a-f0-9]{64}$/.test(report.reportSha256))
    throw Error("BOUND_RECONCILIATION_REPORT_REQUIRED");
  return `-- REVIEW-ONLY MANUAL DEVELOPMENT PATCH ${step}. Not a registered release migration.\n-- No execution, receipt or release attestation is implied by generation.\n-- Default is BLOCKED. Approval GUCs are operator acknowledgments, NOT server identity proof.\n-- Independently confirm the Development dashboard/project, backup and exact SQL before setting them.\n-- Reviewed report: ${report.reportSha256}\nBEGIN;\n-- After independent review, replace these two transaction-local acknowledgments.\nSET LOCAL wici.review.project_ref='REVIEW_REQUIRED';\nSET LOCAL wici.review.approval='REVIEW_REQUIRED';\nSET LOCAL lock_timeout='3s';\nSET LOCAL statement_timeout='60s';\nSET LOCAL search_path=pg_catalog,public;\nDO $approval$ BEGIN\n IF current_setting('wici.review.project_ref',true) IS DISTINCT FROM 'bcvfosxcyvarieiinovo'\n OR current_setting('wici.review.approval',true) IS DISTINCT FROM 'APPROVED:${report.reportSha256}:${step}' THEN\n  RAISE EXCEPTION 'MANUAL_DEVELOPMENT_PROJECT_AND_PATCH_REVIEW_REQUIRED';\n END IF;\n IF NOT pg_try_advisory_xact_lock(hashtextextended('purchase-tracker:database-release',0)) THEN RAISE EXCEPTION 'DATABASE_RELEASE_BUSY'; END IF;\nEND $approval$;\n`;
}
function fingerprint(report) {
  return (
    guard(report, "01") +
    `-- Widen storage only. Existing short/unknown fingerprints are NOT reconstructed.\n-- Paid amounts, postings, allocations and settlement records are not changed.\nLOCK TABLE public.ap_vouchers,public.goods_receipts,public.payment_records,public.supplier_invoices IN ACCESS EXCLUSIVE MODE;\nDO $fingerprints$ DECLARE target text; kind oid; generated text; old_default text; BEGIN\n FOREACH target IN ARRAY ARRAY['ap_vouchers','goods_receipts','payment_records','supplier_invoices'] LOOP\n  SELECT a.atttypid,a.attgenerated::text,pg_get_expr(d.adbin,d.adrelid) INTO kind,generated,old_default\n  FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum\n  WHERE a.attrelid=to_regclass('public.'||target) AND a.attname='payload_fingerprint' AND NOT a.attisdropped;\n  IF kind IS NULL OR generated<>'' OR old_default IS NOT NULL OR kind NOT IN ('text'::regtype,'bpchar'::regtype,'varchar'::regtype) THEN RAISE EXCEPTION 'UNEXPECTED_FINGERPRINT_SHAPE: %',target; END IF;\n  IF kind<>'text'::regtype THEN\n   EXECUTE format('ALTER TABLE public.%I ALTER COLUMN payload_fingerprint TYPE text USING payload_fingerprint::text',target);\n  END IF;\n END LOOP;\nEND $fingerprints$;\n-- Postflight certifies these four types only, not global compatibility or old hash integrity.\nDO $postflight$ BEGIN\n IF (SELECT count(*) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace\n WHERE n.nspname='public' AND c.relname=ANY(ARRAY['ap_vouchers','goods_receipts','payment_records','supplier_invoices'])\n AND a.attname='payload_fingerprint' AND NOT a.attisdropped AND a.atttypid='text'::regtype)<>4 THEN RAISE EXCEPTION 'FINGERPRINT_TYPE_POSTFLIGHT_FAILED'; END IF;\nEND $postflight$;\nCOMMIT;\n`
  );
}
function permission(report) {
  return (
    guard(report, "02") +
    `-- OPTIONAL AUTHORIZATION-DESIGN REVIEW: merged server code checks requests.view\n-- in procurementCompletionService.js, but neither its catalog nor CORE definitions declare it.\n-- Adds a definition only. NO role/user assignment and NO automatic department visibility grant.\nLOCK TABLE public.permissions IN SHARE ROW EXCLUSIVE MODE;\nDO $permission$ DECLARE seq text; maximum_id bigint; last_used bigint; called boolean; BEGIN\n IF NOT EXISTS(SELECT 1 FROM public.permissions WHERE code='requests.view') THEN\n  seq:=pg_get_serial_sequence('public.permissions','id');\n  IF seq IS NULL THEN RAISE EXCEPTION 'OWNED_PERMISSION_SEQUENCE_REVIEW_REQUIRED'; END IF;\n  SELECT max(id) INTO maximum_id FROM public.permissions;\n  EXECUTE format('SELECT last_value,is_called FROM %s',seq::regclass) INTO last_used,called;\n  IF maximum_id IS NOT NULL AND (last_used<maximum_id OR (last_used=maximum_id AND NOT called)) THEN RAISE EXCEPTION 'PERMISSION_SEQUENCE_BEHIND_REVIEW_REQUIRED'; END IF;\n  INSERT INTO public.permissions(code,name,description) VALUES\n   ('requests.view','View own-department request completion','Allow the existing merged completion-service department branch within its institute and department checks; no cross-institute, procurement, approval or posting authority.');\n END IF;\nEND $permission$;\n-- Existing definitions/customizations are untouched; custody.create is NOT added.\nCOMMIT;\n`
  );
}
function reviews(report) {
  const source = fs.readFileSync(
    path.join(
      root,
      "purchase-backend/sql/manual/066_contract_financial_reconciliation.sql",
    ),
    "utf8",
  );
  const parts = splitStatements(source).map((s) => s.trim());
  const create = parts.find((s) =>
    /^CREATE TABLE IF NOT EXISTS public.contract_financial_reviews\b/.test(s),
  );
  const index = parts.find((s) =>
    /^CREATE INDEX IF NOT EXISTS contract_financial_reviews_worklist_idx\b/.test(
      s,
    ),
  );
  const fn = parts.find((s) =>
    /^CREATE OR REPLACE FUNCTION public.preserve_contract_financial_reviews\(/.test(
      s,
    ),
  );
  const triggers = parts.filter((s) =>
    /^CREATE TRIGGER contract_financial_reviews_/.test(s),
  );
  if (!create || !index || !fn || triggers.length !== 2)
    throw Error("MERGED_REVIEW_DEFINITION_CHANGED_REVIEW_REQUIRED");
  const statement = (s) => {
    if (s.includes("$review_ddl$")) throw Error("DELIMITER_COLLISION");
    return `EXECUTE $review_ddl$${s}$review_ddl$;`;
  };
  const expectedColumns = contract.catalog.columns
    .filter((c) => c.relation === "contract_financial_reviews")
    .map(({ name, type, not_null }) => ({ name, type, not_null }));
  const expectedConstraints = contract.catalog.constraints
    .filter((c) => c.relation === "contract_financial_reviews")
    .map(({ name, definition, validated }) => ({
      name,
      definition,
      validated,
    }));
  const expectedIndex = contract.catalog.indexes.find(
    (i) => i.name === "contract_financial_reviews_worklist_idx",
  ).definition;
  const md5 = contract.catalog.functions.find(
    (f) => f.name === "preserve_contract_financial_reviews",
  ).definition_md5;
  return (
    guard(report, "03") +
    `-- Conditional empty review-history foundation from merged 066 definitions.\n-- Not replay of 066, not enrollment/reconciliation/backfill, no payments or AP posting.\n-- Existing objects are never replaced, their RLS/ACLs never rewritten by this patch.\nDO $reviews$ DECLARE browser text; fresh boolean:=to_regclass('public.contract_financial_reviews') IS NULL;\n expected jsonb; actual jsonb; BEGIN\n IF to_regprocedure('public.guard_canonical_invoice_contract_source()') IS NULL THEN RAISE EXCEPTION 'CANONICAL_CONTRACT_FINANCE_PREREQUISITE_REQUIRED'; END IF;\n IF to_regprocedure('public.preserve_contract_financial_reviews()') IS NOT NULL AND\n md5(pg_get_functiondef(to_regprocedure('public.preserve_contract_financial_reviews()')))<>${literal(md5)} THEN RAISE EXCEPTION 'EXISTING_REVIEW_ROUTINE_REQUIRES_INDEPENDENT_REVIEW'; END IF;\n IF fresh THEN\n  IF to_regclass('public.contract_financial_reviews_id_seq') IS NOT NULL THEN RAISE EXCEPTION 'UNATTACHED_REVIEW_SEQUENCE_REQUIRES_REVIEW'; END IF;\n  ${statement(create.replace("IF NOT EXISTS ", ""))}\n  ${statement(index.replace("IF NOT EXISTS ", ""))}\n  IF to_regprocedure('public.preserve_contract_financial_reviews()') IS NULL THEN\n   ${statement(fn.replace("CREATE OR REPLACE FUNCTION", "CREATE FUNCTION"))}\n   REVOKE ALL ON FUNCTION public.preserve_contract_financial_reviews() FROM PUBLIC;\n   FOR browser IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role') LOOP\n    EXECUTE format('REVOKE ALL ON FUNCTION public.preserve_contract_financial_reviews() FROM %I',browser);\n   END LOOP;\n  END IF;\n  ${triggers.map(statement).join("\n  ")}\n  ALTER TABLE public.contract_financial_reviews ENABLE ROW LEVEL SECURITY;\n  REVOKE ALL ON public.contract_financial_reviews FROM PUBLIC;\n  REVOKE ALL ON SEQUENCE public.contract_financial_reviews_id_seq FROM PUBLIC;\n  FOR browser IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role') LOOP\n   EXECUTE format('REVOKE ALL ON public.contract_financial_reviews FROM %I',browser);\n   EXECUTE format('REVOKE ALL ON SEQUENCE public.contract_financial_reviews_id_seq FROM %I',browser);\n  END LOOP;\n  IF EXISTS(SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl,acldefault(CASE WHEN c.relkind='S' THEN 's'::\"char\" ELSE 'r'::\"char\" END,c.relowner))) a WHERE c.oid IN ('public.contract_financial_reviews'::regclass,'public.contract_financial_reviews_id_seq'::regclass) AND a.grantee<>c.relowner) THEN RAISE EXCEPTION 'UNREVIEWED_NEW_REVIEW_OBJECT_DEFAULT_GRANTS'; END IF;\n END IF;\n expected:=${literal(JSON.stringify(expectedColumns))}::jsonb;\n SELECT COALESCE(jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull)),'[]'::jsonb) INTO actual\n FROM pg_attribute a WHERE a.attrelid='public.contract_financial_reviews'::regclass AND a.attnum>0 AND NOT a.attisdropped;\n IF NOT(actual @> expected AND actual <@ expected) THEN RAISE EXCEPTION 'REVIEW_COLUMN_POSTFLIGHT_REQUIRES_REVIEW'; END IF;\n expected:=${literal(JSON.stringify(expectedConstraints))}::jsonb;\n SELECT COALESCE(jsonb_agg(jsonb_build_object('name',k.conname,'definition',pg_get_constraintdef(k.oid,true),'validated',k.convalidated)),'[]'::jsonb) INTO actual\n FROM pg_constraint k WHERE k.conrelid='public.contract_financial_reviews'::regclass;\n IF NOT(actual @> expected AND actual <@ expected) THEN RAISE EXCEPTION 'REVIEW_CONSTRAINT_POSTFLIGHT_REQUIRES_REVIEW'; END IF;\n IF NOT EXISTS(SELECT 1 FROM pg_index i JOIN pg_class idx ON idx.oid=i.indexrelid WHERE i.indrelid='public.contract_financial_reviews'::regclass AND idx.relname='contract_financial_reviews_worklist_idx' AND i.indisvalid AND i.indisready AND pg_get_indexdef(i.indexrelid,0,true)=${literal(expectedIndex)}) THEN RAISE EXCEPTION 'REVIEW_INDEX_POSTFLIGHT_REQUIRES_REVIEW'; END IF;\n IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.contract_financial_reviews'::regclass AND relrowsecurity AND NOT relforcerowsecurity) THEN RAISE EXCEPTION 'REVIEW_RLS_POSTFLIGHT_REQUIRES_REVIEW'; END IF;\n IF md5(pg_get_functiondef(to_regprocedure('public.preserve_contract_financial_reviews()')))<>${literal(md5)} THEN RAISE EXCEPTION 'REVIEW_ROUTINE_POSTFLIGHT_REQUIRES_REVIEW'; END IF;\n IF (SELECT count(*) FROM pg_trigger WHERE tgrelid='public.contract_financial_reviews'::regclass AND tgenabled='O'\n AND tgfoid=to_regprocedure('public.preserve_contract_financial_reviews()') AND ((tgname='contract_financial_reviews_append_only' AND tgtype=27) OR (tgname='contract_financial_reviews_no_truncate' AND tgtype=34)))<>2 THEN RAISE EXCEPTION 'REVIEW_HISTORY_TRIGGER_POSTFLIGHT_REQUIRES_REVIEW'; END IF;\nEND $reviews$;\n-- Runtime permissions require separate review of actual role ownership/membership/ACLs.\n-- No roles, memberships, BYPASSRLS, runtime grants or execution receipts are created here.\nCOMMIT;\n`
  );
}
function preflight() {
  const {
    queries,
  } = require("../../purchase-backend/scripts/lib/databaseRelease/catalog");
  const pairs = Object.entries(queries).flatMap(([k, q]) => [
    literal(k),
    `(SELECT COALESCE(jsonb_agg(to_jsonb(r)),'[]'::jsonb) FROM (${q}) r)`,
  ]);
  return `-- READ ONLY. Run manually only in the independently confirmed Development SQL Editor.\n-- This SQL cannot independently authenticate a Supabase project; verify its dashboard/ref first.\n-- No business/patient rows, password catalogs or raw function bodies are selected.\nBEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;\nSET LOCAL statement_timeout='60s';\nSET LOCAL search_path=public,extensions,pg_catalog;\nSELECT jsonb_build_object('server_version',current_setting('server_version'),'database',current_database(),\n 'actor',current_user,'session_user',session_user,'read_only',current_setting('transaction_read_only'),\n 'expected_project_for_operator_confirmation','bcvfosxcyvarieiinovo','project_identity_independently_verified_by_sql',false,\n 'catalog',jsonb_build_object(${pairs.join(",\n")}),\n 'roles',(SELECT COALESCE(jsonb_agg(jsonb_build_object('name',rolname,'login',rolcanlogin,'superuser',rolsuper,'bypass_rls',rolbypassrls,'create_database',rolcreatedb,'create_role',rolcreaterole)),'[]'::jsonb) FROM pg_roles),\n 'role_memberships',(SELECT COALESCE(jsonb_agg(jsonb_build_object('role',r.rolname,'member',m.rolname,'admin',a.admin_option)),'[]'::jsonb) FROM pg_auth_members a JOIN pg_roles r ON r.oid=a.roleid JOIN pg_roles m ON m.oid=a.member),\n 'object_acl',(SELECT COALESCE(jsonb_agg(jsonb_build_object('name',c.relname,'kind',c.relkind,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl)),'[]'::jsonb) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S')),\n 'extensions',(SELECT COALESCE(jsonb_agg(jsonb_build_object('name',e.extname,'version',e.extversion,'schema',n.nspname)),'[]'::jsonb) FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace),\n 'sequences',(SELECT COALESCE(jsonb_agg(to_jsonb(s)),'[]'::jsonb) FROM pg_sequences s WHERE schemaname='public'),\n 'release_tables',(SELECT COALESCE(jsonb_agg(jsonb_build_object('name',c.relname,'select_allowed',has_table_privilege(current_user,c.oid,'SELECT'),'rls_active',row_security_active(c.oid))),'[]'::jsonb) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('database_release_migrations','database_release_attestations'))) AS private_development_catalog;\nROLLBACK;\n`;
}
function releaseEvidence() {
  return `-- READ ONLY release evidence. Run only after 00 confirms these tables exist.
-- RLS-hidden rows are not evidence of an empty ledger. No receipts/attestations are fabricated.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='60s';
DO $visibility$ DECLARE relation regclass; BEGIN
 FOREACH relation IN ARRAY ARRAY[to_regclass('public.database_release_migrations'),to_regclass('public.database_release_attestations')] LOOP
  IF relation IS NULL OR NOT has_table_privilege(current_user,relation,'SELECT') OR row_security_active(relation) THEN RAISE EXCEPTION 'RELEASE_EVIDENCE_ABSENT_OR_UNOBSERVABLE'; END IF;
 END LOOP;
END $visibility$;
SELECT jsonb_build_object(
 'migrations',(SELECT COALESCE(jsonb_agg(jsonb_build_object('migration_id',migration_id,'filename',filename,'content_sha256',content_sha256,'environment',execution_environment,'status',execution_status,'application_release_ref',application_release_ref,'evidence',evidence)),'[]'::jsonb) FROM public.database_release_migrations),
 'attestations',(SELECT COALESCE(jsonb_agg(jsonb_build_object('contract_version',contract_version,'contract_sha256',contract_sha256,'application_manifest_sha256',application_manifest_sha256,'observed_schema_sha256',observed_schema_sha256,'execution_environment',execution_environment,'application_release_ref',application_release_ref,'verified_at',verified_at)),'[]'::jsonb) FROM public.database_release_attestations)) AS private_release_evidence;
ROLLBACK;
`;
}
function patches(report) {
  const current = require("./development-schema-audit.cjs").build();
  if (current.reportSha256 !== report.reportSha256)
    throw Error("REGENERATE_CURRENT_SOURCE_BOUND_REPORT_BEFORE_PATCHES");
  return {
    "00_readonly_catalog.sql": preflight(),
    "01_widen_payload_fingerprints.sql": fingerprint(report),
    "02_optional_requests_view_catalog.sql": permission(report),
    "03_conditional_contract_reviews.sql": reviews(report),
    "04_readonly_release_evidence.sql": releaseEvidence(),
  };
}
if (require.main === module) {
  try {
    const report = JSON.parse(
        fs.readFileSync(path.join(dir, "reconciliation.json"), "utf8"),
      ),
      out = path.join(dir, "patches");
    fs.mkdirSync(out, { recursive: true });
    for (const [name, text] of Object.entries(patches(report)))
      fs.writeFileSync(path.join(out, name), text);
    console.log(
      "REVIEW_ONLY_SQL_GENERATED_OFFLINE_NOT_EXECUTED_NOT_RELEASE_ATTESTATION",
    );
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
module.exports = {
  guard,
  fingerprint,
  permission,
  reviews,
  preflight,
  patches,
};
