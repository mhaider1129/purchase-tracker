-- REVIEW-ONLY DEVELOPMENT PATCH. No execution receipts or attestation.
-- Source: evidence/required-objects-operator.json SHA256 8e674e088f91f44e5c6e2b57df95295c49001c7a788f579da8f0e7f9b44f3cc4
-- Default BLOCKED. These are review acknowledgments, NOT server identity proof.
-- Independently confirm dashboard project and backup before any approval.
BEGIN;
SET LOCAL wici.review.project_ref='REVIEW_REQUIRED';
SET LOCAL wici.review.approval='REVIEW_REQUIRED';
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
SET LOCAL search_path=pg_catalog,public;
DO $approval$ BEGIN
 IF current_setting('wici.review.project_ref',true) IS DISTINCT FROM 'bcvfosxcyvarieiinovo'
 OR current_setting('wici.review.approval',true) IS DISTINCT FROM 'APPROVED:8e674e088f91f44e5c6e2b57df95295c49001c7a788f579da8f0e7f9b44f3cc4:nullable-columns' THEN
  RAISE EXCEPTION 'MANUAL_DEVELOPMENT_PROJECT_AND_PATCH_REVIEW_REQUIRED'; END IF;
 IF NOT pg_try_advisory_xact_lock(hashtextextended('purchase-tracker:database-release',0)) THEN RAISE EXCEPTION 'DATABASE_RELEASE_BUSY'; END IF;
END $approval$;
-- Existing rows receive NULL for each new nullable field, not fabricated values.
-- Existing columns, defaults, constraints, ACLs and RLS are never overwritten.
DO $column$ DECLARE actual_type text; BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND c.relname='ap_vouchers' AND c.relkind='r') THEN RAISE EXCEPTION 'ORDINARY_PARENT_TABLE_REQUIRED: ap_vouchers'; END IF;
 LOCK TABLE public.ap_vouchers IN ACCESS EXCLUSIVE MODE;
 SELECT format_type(a.atttypid,a.atttypmod) INTO actual_type FROM pg_attribute a WHERE a.attrelid='public.ap_vouchers'::regclass AND a.attname='contract_id' AND NOT a.attisdropped;
 IF actual_type IS NULL THEN
  ALTER TABLE public.ap_vouchers ADD COLUMN contract_id integer;
 ELSIF actual_type<>'integer' THEN RAISE EXCEPTION 'EXISTING_COLUMN_TYPE_REVIEW_REQUIRED: ap_vouchers.contract_id'; END IF;
END $column$;
DO $column$ DECLARE actual_type text; BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND c.relname='approval_route_rules' AND c.relkind='r') THEN RAISE EXCEPTION 'ORDINARY_PARENT_TABLE_REQUIRED: approval_route_rules'; END IF;
 LOCK TABLE public.approval_route_rules IN ACCESS EXCLUSIVE MODE;
 SELECT format_type(a.atttypid,a.atttypmod) INTO actual_type FROM pg_attribute a WHERE a.attrelid='public.approval_route_rules'::regclass AND a.attname='approver_id' AND NOT a.attisdropped;
 IF actual_type IS NULL THEN
  ALTER TABLE public.approval_route_rules ADD COLUMN approver_id integer;
 ELSIF actual_type<>'integer' THEN RAISE EXCEPTION 'EXISTING_COLUMN_TYPE_REVIEW_REQUIRED: approval_route_rules.approver_id'; END IF;
END $column$;
DO $column$ DECLARE actual_type text; BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND c.relname='commitment_ledger' AND c.relkind='r') THEN RAISE EXCEPTION 'ORDINARY_PARENT_TABLE_REQUIRED: commitment_ledger'; END IF;
 LOCK TABLE public.commitment_ledger IN ACCESS EXCLUSIVE MODE;
 SELECT format_type(a.atttypid,a.atttypmod) INTO actual_type FROM pg_attribute a WHERE a.attrelid='public.commitment_ledger'::regclass AND a.attname='journal_entry_id' AND NOT a.attisdropped;
 IF actual_type IS NULL THEN
  ALTER TABLE public.commitment_ledger ADD COLUMN journal_entry_id bigint;
 ELSIF actual_type<>'bigint' THEN RAISE EXCEPTION 'EXISTING_COLUMN_TYPE_REVIEW_REQUIRED: commitment_ledger.journal_entry_id'; END IF;
END $column$;
DO $column$ DECLARE actual_type text; BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND c.relname='contract_evaluations' AND c.relkind='r') THEN RAISE EXCEPTION 'ORDINARY_PARENT_TABLE_REQUIRED: contract_evaluations'; END IF;
 LOCK TABLE public.contract_evaluations IN ACCESS EXCLUSIVE MODE;
 SELECT format_type(a.atttypid,a.atttypmod) INTO actual_type FROM pg_attribute a WHERE a.attrelid='public.contract_evaluations'::regclass AND a.attname='total_score' AND NOT a.attisdropped;
 IF actual_type IS NULL THEN
  ALTER TABLE public.contract_evaluations ADD COLUMN total_score numeric;
 ELSIF actual_type<>'numeric' THEN RAISE EXCEPTION 'EXISTING_COLUMN_TYPE_REVIEW_REQUIRED: contract_evaluations.total_score'; END IF;
END $column$;
DO $column$ DECLARE actual_type text; BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND c.relname='generic_items' AND c.relkind='r') THEN RAISE EXCEPTION 'ORDINARY_PARENT_TABLE_REQUIRED: generic_items'; END IF;
 LOCK TABLE public.generic_items IN ACCESS EXCLUSIVE MODE;
 SELECT format_type(a.atttypid,a.atttypmod) INTO actual_type FROM pg_attribute a WHERE a.attrelid='public.generic_items'::regclass AND a.attname='institute_id' AND NOT a.attisdropped;
 IF actual_type IS NULL THEN
  ALTER TABLE public.generic_items ADD COLUMN institute_id integer;
 ELSIF actual_type<>'integer' THEN RAISE EXCEPTION 'EXISTING_COLUMN_TYPE_REVIEW_REQUIRED: generic_items.institute_id'; END IF;
END $column$;
DO $column$ DECLARE actual_type text; BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND c.relname='gl_postings' AND c.relkind='r') THEN RAISE EXCEPTION 'ORDINARY_PARENT_TABLE_REQUIRED: gl_postings'; END IF;
 LOCK TABLE public.gl_postings IN ACCESS EXCLUSIVE MODE;
 SELECT format_type(a.atttypid,a.atttypmod) INTO actual_type FROM pg_attribute a WHERE a.attrelid='public.gl_postings'::regclass AND a.attname='journal_entry_id' AND NOT a.attisdropped;
 IF actual_type IS NULL THEN
  ALTER TABLE public.gl_postings ADD COLUMN journal_entry_id bigint;
 ELSIF actual_type<>'bigint' THEN RAISE EXCEPTION 'EXISTING_COLUMN_TYPE_REVIEW_REQUIRED: gl_postings.journal_entry_id'; END IF;
END $column$;
DO $column$ DECLARE actual_type text; BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND c.relname='journal_entries' AND c.relkind='r') THEN RAISE EXCEPTION 'ORDINARY_PARENT_TABLE_REQUIRED: journal_entries'; END IF;
 LOCK TABLE public.journal_entries IN ACCESS EXCLUSIVE MODE;
 SELECT format_type(a.atttypid,a.atttypmod) INTO actual_type FROM pg_attribute a WHERE a.attrelid='public.journal_entries'::regclass AND a.attname='posted_by' AND NOT a.attisdropped;
 IF actual_type IS NULL THEN
  ALTER TABLE public.journal_entries ADD COLUMN posted_by integer;
 ELSIF actual_type<>'integer' THEN RAISE EXCEPTION 'EXISTING_COLUMN_TYPE_REVIEW_REQUIRED: journal_entries.posted_by'; END IF;
END $column$;
DO $column$ DECLARE actual_type text; BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND c.relname='journal_entry_lines' AND c.relkind='r') THEN RAISE EXCEPTION 'ORDINARY_PARENT_TABLE_REQUIRED: journal_entry_lines'; END IF;
 LOCK TABLE public.journal_entry_lines IN ACCESS EXCLUSIVE MODE;
 SELECT format_type(a.atttypid,a.atttypmod) INTO actual_type FROM pg_attribute a WHERE a.attrelid='public.journal_entry_lines'::regclass AND a.attname='cost_center_id' AND NOT a.attisdropped;
 IF actual_type IS NULL THEN
  ALTER TABLE public.journal_entry_lines ADD COLUMN cost_center_id integer;
 ELSIF actual_type<>'integer' THEN RAISE EXCEPTION 'EXISTING_COLUMN_TYPE_REVIEW_REQUIRED: journal_entry_lines.cost_center_id'; END IF;
END $column$;
DO $column$ DECLARE actual_type text; BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND c.relname='procurement_evaluation_offer_test_costs' AND c.relkind='r') THEN RAISE EXCEPTION 'ORDINARY_PARENT_TABLE_REQUIRED: procurement_evaluation_offer_test_costs'; END IF;
 LOCK TABLE public.procurement_evaluation_offer_test_costs IN ACCESS EXCLUSIVE MODE;
 SELECT format_type(a.atttypid,a.atttypmod) INTO actual_type FROM pg_attribute a WHERE a.attrelid='public.procurement_evaluation_offer_test_costs'::regclass AND a.attname='alternative_group' AND NOT a.attisdropped;
 IF actual_type IS NULL THEN
  ALTER TABLE public.procurement_evaluation_offer_test_costs ADD COLUMN alternative_group text;
 ELSIF actual_type<>'text' THEN RAISE EXCEPTION 'EXISTING_COLUMN_TYPE_REVIEW_REQUIRED: procurement_evaluation_offer_test_costs.alternative_group'; END IF;
END $column$;
DO $column$ DECLARE actual_type text; BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND c.relname='procurement_evaluation_offer_test_costs' AND c.relkind='r') THEN RAISE EXCEPTION 'ORDINARY_PARENT_TABLE_REQUIRED: procurement_evaluation_offer_test_costs'; END IF;
 LOCK TABLE public.procurement_evaluation_offer_test_costs IN ACCESS EXCLUSIVE MODE;
 SELECT format_type(a.atttypid,a.atttypmod) INTO actual_type FROM pg_attribute a WHERE a.attrelid='public.procurement_evaluation_offer_test_costs'::regclass AND a.attname='annual_quantity' AND NOT a.attisdropped;
 IF actual_type IS NULL THEN
  ALTER TABLE public.procurement_evaluation_offer_test_costs ADD COLUMN annual_quantity numeric(20,6);
  ALTER TABLE public.procurement_evaluation_offer_test_costs ALTER COLUMN annual_quantity SET DEFAULT 0; -- FUTURE INSERTS ONLY
 ELSIF actual_type<>'numeric(20,6)' THEN RAISE EXCEPTION 'EXISTING_COLUMN_TYPE_REVIEW_REQUIRED: procurement_evaluation_offer_test_costs.annual_quantity'; END IF;
END $column$;
DO $column$ DECLARE actual_type text; BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND c.relname='procurement_evaluation_offer_test_costs' AND c.relkind='r') THEN RAISE EXCEPTION 'ORDINARY_PARENT_TABLE_REQUIRED: procurement_evaluation_offer_test_costs'; END IF;
 LOCK TABLE public.procurement_evaluation_offer_test_costs IN ACCESS EXCLUSIVE MODE;
 SELECT format_type(a.atttypid,a.atttypmod) INTO actual_type FROM pg_attribute a WHERE a.attrelid='public.procurement_evaluation_offer_test_costs'::regclass AND a.attname='dependency_group' AND NOT a.attisdropped;
 IF actual_type IS NULL THEN
  ALTER TABLE public.procurement_evaluation_offer_test_costs ADD COLUMN dependency_group text;
 ELSIF actual_type<>'text' THEN RAISE EXCEPTION 'EXISTING_COLUMN_TYPE_REVIEW_REQUIRED: procurement_evaluation_offer_test_costs.dependency_group'; END IF;
END $column$;
DO $column$ DECLARE actual_type text; BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND c.relname='procurement_evaluation_offer_test_costs' AND c.relkind='r') THEN RAISE EXCEPTION 'ORDINARY_PARENT_TABLE_REQUIRED: procurement_evaluation_offer_test_costs'; END IF;
 LOCK TABLE public.procurement_evaluation_offer_test_costs IN ACCESS EXCLUSIVE MODE;
 SELECT format_type(a.atttypid,a.atttypmod) INTO actual_type FROM pg_attribute a WHERE a.attrelid='public.procurement_evaluation_offer_test_costs'::regclass AND a.attname='element_type' AND NOT a.attisdropped;
 IF actual_type IS NULL THEN
  ALTER TABLE public.procurement_evaluation_offer_test_costs ADD COLUMN element_type text;
 ELSIF actual_type<>'text' THEN RAISE EXCEPTION 'EXISTING_COLUMN_TYPE_REVIEW_REQUIRED: procurement_evaluation_offer_test_costs.element_type'; END IF;
END $column$;
DO $column$ DECLARE actual_type text; BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND c.relname='procurement_evaluation_offer_test_costs' AND c.relkind='r') THEN RAISE EXCEPTION 'ORDINARY_PARENT_TABLE_REQUIRED: procurement_evaluation_offer_test_costs'; END IF;
 LOCK TABLE public.procurement_evaluation_offer_test_costs IN ACCESS EXCLUSIVE MODE;
 SELECT format_type(a.atttypid,a.atttypmod) INTO actual_type FROM pg_attribute a WHERE a.attrelid='public.procurement_evaluation_offer_test_costs'::regclass AND a.attname='onboard_stability_days' AND NOT a.attisdropped;
 IF actual_type IS NULL THEN
  ALTER TABLE public.procurement_evaluation_offer_test_costs ADD COLUMN onboard_stability_days numeric(20,6);
  ALTER TABLE public.procurement_evaluation_offer_test_costs ALTER COLUMN onboard_stability_days SET DEFAULT 0; -- FUTURE INSERTS ONLY
 ELSIF actual_type<>'numeric(20,6)' THEN RAISE EXCEPTION 'EXISTING_COLUMN_TYPE_REVIEW_REQUIRED: procurement_evaluation_offer_test_costs.onboard_stability_days'; END IF;
END $column$;
DO $column$ DECLARE actual_type text; BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND c.relname='procurement_evaluation_offer_test_costs' AND c.relkind='r') THEN RAISE EXCEPTION 'ORDINARY_PARENT_TABLE_REQUIRED: procurement_evaluation_offer_test_costs'; END IF;
 LOCK TABLE public.procurement_evaluation_offer_test_costs IN ACCESS EXCLUSIVE MODE;
 SELECT format_type(a.atttypid,a.atttypmod) INTO actual_type FROM pg_attribute a WHERE a.attrelid='public.procurement_evaluation_offer_test_costs'::regclass AND a.attname='quantity' AND NOT a.attisdropped;
 IF actual_type IS NULL THEN
  ALTER TABLE public.procurement_evaluation_offer_test_costs ADD COLUMN quantity numeric(20,6);
  ALTER TABLE public.procurement_evaluation_offer_test_costs ALTER COLUMN quantity SET DEFAULT 0; -- FUTURE INSERTS ONLY
 ELSIF actual_type<>'numeric(20,6)' THEN RAISE EXCEPTION 'EXISTING_COLUMN_TYPE_REVIEW_REQUIRED: procurement_evaluation_offer_test_costs.quantity'; END IF;
END $column$;
DO $column$ DECLARE actual_type text; BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND c.relname='procurement_evaluation_offers' AND c.relkind='r') THEN RAISE EXCEPTION 'ORDINARY_PARENT_TABLE_REQUIRED: procurement_evaluation_offers'; END IF;
 LOCK TABLE public.procurement_evaluation_offers IN ACCESS EXCLUSIVE MODE;
 SELECT format_type(a.atttypid,a.atttypmod) INTO actual_type FROM pg_attribute a WHERE a.attrelid='public.procurement_evaluation_offers'::regclass AND a.attname='contract_model' AND NOT a.attisdropped;
 IF actual_type IS NULL THEN
  ALTER TABLE public.procurement_evaluation_offers ADD COLUMN contract_model jsonb;
  ALTER TABLE public.procurement_evaluation_offers ALTER COLUMN contract_model SET DEFAULT '{}'::jsonb; -- FUTURE INSERTS ONLY
 ELSIF actual_type<>'jsonb' THEN RAISE EXCEPTION 'EXISTING_COLUMN_TYPE_REVIEW_REQUIRED: procurement_evaluation_offers.contract_model'; END IF;
END $column$;
DO $column$ DECLARE actual_type text; BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND c.relname='procurement_evaluation_offers' AND c.relkind='r') THEN RAISE EXCEPTION 'ORDINARY_PARENT_TABLE_REQUIRED: procurement_evaluation_offers'; END IF;
 LOCK TABLE public.procurement_evaluation_offers IN ACCESS EXCLUSIVE MODE;
 SELECT format_type(a.atttypid,a.atttypmod) INTO actual_type FROM pg_attribute a WHERE a.attrelid='public.procurement_evaluation_offers'::regclass AND a.attname='package_model' AND NOT a.attisdropped;
 IF actual_type IS NULL THEN
  ALTER TABLE public.procurement_evaluation_offers ADD COLUMN package_model jsonb;
  ALTER TABLE public.procurement_evaluation_offers ALTER COLUMN package_model SET DEFAULT '{}'::jsonb; -- FUTURE INSERTS ONLY
 ELSIF actual_type<>'jsonb' THEN RAISE EXCEPTION 'EXISTING_COLUMN_TYPE_REVIEW_REQUIRED: procurement_evaluation_offers.package_model'; END IF;
END $column$;
DO $column$ DECLARE actual_type text; BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND c.relname='procurement_evaluation_offers' AND c.relkind='r') THEN RAISE EXCEPTION 'ORDINARY_PARENT_TABLE_REQUIRED: procurement_evaluation_offers'; END IF;
 LOCK TABLE public.procurement_evaluation_offers IN ACCESS EXCLUSIVE MODE;
 SELECT format_type(a.atttypid,a.atttypmod) INTO actual_type FROM pg_attribute a WHERE a.attrelid='public.procurement_evaluation_offers'::regclass AND a.attname='risk_model' AND NOT a.attisdropped;
 IF actual_type IS NULL THEN
  ALTER TABLE public.procurement_evaluation_offers ADD COLUMN risk_model jsonb;
  ALTER TABLE public.procurement_evaluation_offers ALTER COLUMN risk_model SET DEFAULT '{}'::jsonb; -- FUTURE INSERTS ONLY
 ELSIF actual_type<>'jsonb' THEN RAISE EXCEPTION 'EXISTING_COLUMN_TYPE_REVIEW_REQUIRED: procurement_evaluation_offers.risk_model'; END IF;
END $column$;
DO $column$ DECLARE actual_type text; BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND c.relname='procurement_evaluation_offers' AND c.relkind='r') THEN RAISE EXCEPTION 'ORDINARY_PARENT_TABLE_REQUIRED: procurement_evaluation_offers'; END IF;
 LOCK TABLE public.procurement_evaluation_offers IN ACCESS EXCLUSIVE MODE;
 SELECT format_type(a.atttypid,a.atttypmod) INTO actual_type FROM pg_attribute a WHERE a.attrelid='public.procurement_evaluation_offers'::regclass AND a.attname='scenario_metadata' AND NOT a.attisdropped;
 IF actual_type IS NULL THEN
  ALTER TABLE public.procurement_evaluation_offers ADD COLUMN scenario_metadata jsonb;
  ALTER TABLE public.procurement_evaluation_offers ALTER COLUMN scenario_metadata SET DEFAULT '{}'::jsonb; -- FUTURE INSERTS ONLY
 ELSIF actual_type<>'jsonb' THEN RAISE EXCEPTION 'EXISTING_COLUMN_TYPE_REVIEW_REQUIRED: procurement_evaluation_offers.scenario_metadata'; END IF;
END $column$;
DO $column$ DECLARE actual_type text; BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND c.relname='procurement_evaluation_offers' AND c.relkind='r') THEN RAISE EXCEPTION 'ORDINARY_PARENT_TABLE_REQUIRED: procurement_evaluation_offers'; END IF;
 LOCK TABLE public.procurement_evaluation_offers IN ACCESS EXCLUSIVE MODE;
 SELECT format_type(a.atttypid,a.atttypmod) INTO actual_type FROM pg_attribute a WHERE a.attrelid='public.procurement_evaluation_offers'::regclass AND a.attname='service_model' AND NOT a.attisdropped;
 IF actual_type IS NULL THEN
  ALTER TABLE public.procurement_evaluation_offers ADD COLUMN service_model jsonb;
  ALTER TABLE public.procurement_evaluation_offers ALTER COLUMN service_model SET DEFAULT '{}'::jsonb; -- FUTURE INSERTS ONLY
 ELSIF actual_type<>'jsonb' THEN RAISE EXCEPTION 'EXISTING_COLUMN_TYPE_REVIEW_REQUIRED: procurement_evaluation_offers.service_model'; END IF;
END $column$;
DO $column$ DECLARE actual_type text; BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND c.relname='procurement_evaluation_offers' AND c.relkind='r') THEN RAISE EXCEPTION 'ORDINARY_PARENT_TABLE_REQUIRED: procurement_evaluation_offers'; END IF;
 LOCK TABLE public.procurement_evaluation_offers IN ACCESS EXCLUSIVE MODE;
 SELECT format_type(a.atttypid,a.atttypmod) INTO actual_type FROM pg_attribute a WHERE a.attrelid='public.procurement_evaluation_offers'::regclass AND a.attname='technical_model' AND NOT a.attisdropped;
 IF actual_type IS NULL THEN
  ALTER TABLE public.procurement_evaluation_offers ADD COLUMN technical_model jsonb;
  ALTER TABLE public.procurement_evaluation_offers ALTER COLUMN technical_model SET DEFAULT '{}'::jsonb; -- FUTURE INSERTS ONLY
 ELSIF actual_type<>'jsonb' THEN RAISE EXCEPTION 'EXISTING_COLUMN_TYPE_REVIEW_REQUIRED: procurement_evaluation_offers.technical_model'; END IF;
END $column$;
DO $column$ DECLARE actual_type text; BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND c.relname='procurement_evaluation_results' AND c.relkind='r') THEN RAISE EXCEPTION 'ORDINARY_PARENT_TABLE_REQUIRED: procurement_evaluation_results'; END IF;
 LOCK TABLE public.procurement_evaluation_results IN ACCESS EXCLUSIVE MODE;
 SELECT format_type(a.atttypid,a.atttypmod) INTO actual_type FROM pg_attribute a WHERE a.attrelid='public.procurement_evaluation_results'::regclass AND a.attname='created_at' AND NOT a.attisdropped;
 IF actual_type IS NULL THEN
  ALTER TABLE public.procurement_evaluation_results ADD COLUMN created_at timestamp with time zone;
  ALTER TABLE public.procurement_evaluation_results ALTER COLUMN created_at SET DEFAULT now(); -- FUTURE INSERTS ONLY
 ELSIF actual_type<>'timestamp with time zone' THEN RAISE EXCEPTION 'EXISTING_COLUMN_TYPE_REVIEW_REQUIRED: procurement_evaluation_results.created_at'; END IF;
END $column$;
DO $column$ DECLARE actual_type text; BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND c.relname='procurement_evaluation_results' AND c.relkind='r') THEN RAISE EXCEPTION 'ORDINARY_PARENT_TABLE_REQUIRED: procurement_evaluation_results'; END IF;
 LOCK TABLE public.procurement_evaluation_results IN ACCESS EXCLUSIVE MODE;
 SELECT format_type(a.atttypid,a.atttypmod) INTO actual_type FROM pg_attribute a WHERE a.attrelid='public.procurement_evaluation_results'::regclass AND a.attname='updated_at' AND NOT a.attisdropped;
 IF actual_type IS NULL THEN
  ALTER TABLE public.procurement_evaluation_results ADD COLUMN updated_at timestamp with time zone;
  ALTER TABLE public.procurement_evaluation_results ALTER COLUMN updated_at SET DEFAULT now(); -- FUTURE INSERTS ONLY
 ELSIF actual_type<>'timestamp with time zone' THEN RAISE EXCEPTION 'EXISTING_COLUMN_TYPE_REVIEW_REQUIRED: procurement_evaluation_results.updated_at'; END IF;
END $column$;
DO $column$ DECLARE actual_type text; BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND c.relname='procurement_evaluation_tests' AND c.relkind='r') THEN RAISE EXCEPTION 'ORDINARY_PARENT_TABLE_REQUIRED: procurement_evaluation_tests'; END IF;
 LOCK TABLE public.procurement_evaluation_tests IN ACCESS EXCLUSIVE MODE;
 SELECT format_type(a.atttypid,a.atttypmod) INTO actual_type FROM pg_attribute a WHERE a.attrelid='public.procurement_evaluation_tests'::regclass AND a.attname='dependency_risk' AND NOT a.attisdropped;
 IF actual_type IS NULL THEN
  ALTER TABLE public.procurement_evaluation_tests ADD COLUMN dependency_risk text;
 ELSIF actual_type<>'text' THEN RAISE EXCEPTION 'EXISTING_COLUMN_TYPE_REVIEW_REQUIRED: procurement_evaluation_tests.dependency_risk'; END IF;
END $column$;
DO $column$ DECLARE actual_type text; BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND c.relname='procurement_evaluation_tests' AND c.relkind='r') THEN RAISE EXCEPTION 'ORDINARY_PARENT_TABLE_REQUIRED: procurement_evaluation_tests'; END IF;
 LOCK TABLE public.procurement_evaluation_tests IN ACCESS EXCLUSIVE MODE;
 SELECT format_type(a.atttypid,a.atttypmod) INTO actual_type FROM pg_attribute a WHERE a.attrelid='public.procurement_evaluation_tests'::regclass AND a.attname='is_alternative' AND NOT a.attisdropped;
 IF actual_type IS NULL THEN
  ALTER TABLE public.procurement_evaluation_tests ADD COLUMN is_alternative boolean;
  ALTER TABLE public.procurement_evaluation_tests ALTER COLUMN is_alternative SET DEFAULT false; -- FUTURE INSERTS ONLY
 ELSIF actual_type<>'boolean' THEN RAISE EXCEPTION 'EXISTING_COLUMN_TYPE_REVIEW_REQUIRED: procurement_evaluation_tests.is_alternative'; END IF;
END $column$;
DO $column$ DECLARE actual_type text; BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND c.relname='procurement_evaluation_tests' AND c.relkind='r') THEN RAISE EXCEPTION 'ORDINARY_PARENT_TABLE_REQUIRED: procurement_evaluation_tests'; END IF;
 LOCK TABLE public.procurement_evaluation_tests IN ACCESS EXCLUSIVE MODE;
 SELECT format_type(a.atttypid,a.atttypmod) INTO actual_type FROM pg_attribute a WHERE a.attrelid='public.procurement_evaluation_tests'::regclass AND a.attname='unit' AND NOT a.attisdropped;
 IF actual_type IS NULL THEN
  ALTER TABLE public.procurement_evaluation_tests ADD COLUMN unit text;
 ELSIF actual_type<>'text' THEN RAISE EXCEPTION 'EXISTING_COLUMN_TYPE_REVIEW_REQUIRED: procurement_evaluation_tests.unit'; END IF;
END $column$;
DO $column$ DECLARE actual_type text; BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND c.relname='stock_items' AND c.relkind='r') THEN RAISE EXCEPTION 'ORDINARY_PARENT_TABLE_REQUIRED: stock_items'; END IF;
 LOCK TABLE public.stock_items IN ACCESS EXCLUSIVE MODE;
 SELECT format_type(a.atttypid,a.atttypmod) INTO actual_type FROM pg_attribute a WHERE a.attrelid='public.stock_items'::regclass AND a.attname='category_id' AND NOT a.attisdropped;
 IF actual_type IS NULL THEN
  ALTER TABLE public.stock_items ADD COLUMN category_id bigint;
 ELSIF actual_type<>'bigint' THEN RAISE EXCEPTION 'EXISTING_COLUMN_TYPE_REVIEW_REQUIRED: stock_items.category_id'; END IF;
END $column$;
DO $column$ DECLARE actual_type text; BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND c.relname='stock_items' AND c.relkind='r') THEN RAISE EXCEPTION 'ORDINARY_PARENT_TABLE_REQUIRED: stock_items'; END IF;
 LOCK TABLE public.stock_items IN ACCESS EXCLUSIVE MODE;
 SELECT format_type(a.atttypid,a.atttypmod) INTO actual_type FROM pg_attribute a WHERE a.attrelid='public.stock_items'::regclass AND a.attname='institute_id' AND NOT a.attisdropped;
 IF actual_type IS NULL THEN
  ALTER TABLE public.stock_items ADD COLUMN institute_id integer;
 ELSIF actual_type<>'integer' THEN RAISE EXCEPTION 'EXISTING_COLUMN_TYPE_REVIEW_REQUIRED: stock_items.institute_id'; END IF;
END $column$;
DO $column$ DECLARE actual_type text; BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND c.relname='stock_items' AND c.relkind='r') THEN RAISE EXCEPTION 'ORDINARY_PARENT_TABLE_REQUIRED: stock_items'; END IF;
 LOCK TABLE public.stock_items IN ACCESS EXCLUSIVE MODE;
 SELECT format_type(a.atttypid,a.atttypmod) INTO actual_type FROM pg_attribute a WHERE a.attrelid='public.stock_items'::regclass AND a.attname='manufacturer_id' AND NOT a.attisdropped;
 IF actual_type IS NULL THEN
  ALTER TABLE public.stock_items ADD COLUMN manufacturer_id bigint;
 ELSIF actual_type<>'bigint' THEN RAISE EXCEPTION 'EXISTING_COLUMN_TYPE_REVIEW_REQUIRED: stock_items.manufacturer_id'; END IF;
END $column$;
DO $column$ DECLARE actual_type text; BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND c.relname='users' AND c.relkind='r') THEN RAISE EXCEPTION 'ORDINARY_PARENT_TABLE_REQUIRED: users'; END IF;
 LOCK TABLE public.users IN ACCESS EXCLUSIVE MODE;
 SELECT format_type(a.atttypid,a.atttypmod) INTO actual_type FROM pg_attribute a WHERE a.attrelid='public.users'::regclass AND a.attname='updated_at' AND NOT a.attisdropped;
 IF actual_type IS NULL THEN
  ALTER TABLE public.users ADD COLUMN updated_at timestamp with time zone;
 ELSIF actual_type<>'timestamp with time zone' THEN RAISE EXCEPTION 'EXISTING_COLUMN_TYPE_REVIEW_REQUIRED: users.updated_at'; END IF;
END $column$;
-- Verification query also usable independently after approved execution.
SELECT e.relation,e.name,e.type AS expected_type,format_type(a.atttypid,a.atttypmod) AS actual_type,a.attnotnull,a.attgenerated
FROM jsonb_to_recordset($expected$[{"relation":"ap_vouchers","name":"contract_id","type":"integer"},{"relation":"approval_route_rules","name":"approver_id","type":"integer"},{"relation":"commitment_ledger","name":"journal_entry_id","type":"bigint"},{"relation":"contract_evaluations","name":"total_score","type":"numeric"},{"relation":"generic_items","name":"institute_id","type":"integer"},{"relation":"gl_postings","name":"journal_entry_id","type":"bigint"},{"relation":"journal_entries","name":"posted_by","type":"integer"},{"relation":"journal_entry_lines","name":"cost_center_id","type":"integer"},{"relation":"procurement_evaluation_offer_test_costs","name":"alternative_group","type":"text"},{"relation":"procurement_evaluation_offer_test_costs","name":"annual_quantity","type":"numeric(20,6)"},{"relation":"procurement_evaluation_offer_test_costs","name":"dependency_group","type":"text"},{"relation":"procurement_evaluation_offer_test_costs","name":"element_type","type":"text"},{"relation":"procurement_evaluation_offer_test_costs","name":"onboard_stability_days","type":"numeric(20,6)"},{"relation":"procurement_evaluation_offer_test_costs","name":"quantity","type":"numeric(20,6)"},{"relation":"procurement_evaluation_offers","name":"contract_model","type":"jsonb"},{"relation":"procurement_evaluation_offers","name":"package_model","type":"jsonb"},{"relation":"procurement_evaluation_offers","name":"risk_model","type":"jsonb"},{"relation":"procurement_evaluation_offers","name":"scenario_metadata","type":"jsonb"},{"relation":"procurement_evaluation_offers","name":"service_model","type":"jsonb"},{"relation":"procurement_evaluation_offers","name":"technical_model","type":"jsonb"},{"relation":"procurement_evaluation_results","name":"created_at","type":"timestamp with time zone"},{"relation":"procurement_evaluation_results","name":"updated_at","type":"timestamp with time zone"},{"relation":"procurement_evaluation_tests","name":"dependency_risk","type":"text"},{"relation":"procurement_evaluation_tests","name":"is_alternative","type":"boolean"},{"relation":"procurement_evaluation_tests","name":"unit","type":"text"},{"relation":"stock_items","name":"category_id","type":"bigint"},{"relation":"stock_items","name":"institute_id","type":"integer"},{"relation":"stock_items","name":"manufacturer_id","type":"bigint"},{"relation":"users","name":"updated_at","type":"timestamp with time zone"}]$expected$::jsonb) AS e(relation text,name text,type text)
LEFT JOIN pg_namespace n ON n.nspname='public' LEFT JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=e.relation
LEFT JOIN pg_attribute a ON a.attrelid=c.oid AND a.attname=e.name AND a.attnum>0 AND NOT a.attisdropped
ORDER BY e.relation,e.name;
-- Partial prerequisite patch only: missing FKs/indexes/triggers/permissions need full catalog review.
-- Historical institute assignments, financial values and timestamps remain unknown/NULL.
COMMIT;
