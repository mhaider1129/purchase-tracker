-- REVIEW-ONLY DEVELOPMENT PATCH: empty legacy startup-contract relation only.
-- No stock quantities, ownership assignments, execution receipts or attestations created.
-- Independently confirm Development dashboard and backup; acknowledgments are NOT identity proof.
BEGIN;
SET LOCAL wici.review.project_ref='REVIEW_REQUIRED';
SET LOCAL wici.review.approval='REVIEW_REQUIRED';
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
SET LOCAL search_path=pg_catalog,public;
DO $approval$ BEGIN
 IF current_setting('wici.review.project_ref',true) IS DISTINCT FROM 'bcvfosxcyvarieiinovo'
 OR current_setting('wici.review.approval',true) IS DISTINCT FROM 'APPROVED:maintenance-foundation:20261124' THEN
  RAISE EXCEPTION 'MANUAL_DEVELOPMENT_PROJECT_AND_PATCH_REVIEW_REQUIRED'; END IF;
 IF NOT pg_try_advisory_xact_lock(hashtextextended('purchase-tracker:database-release',0)) THEN RAISE EXCEPTION 'DATABASE_RELEASE_BUSY'; END IF;
END $approval$;
DO $foundation$ DECLARE role_name text; BEGIN
 -- Existing objects need catalog review; never silently accept or replace them.
 IF to_regclass('public.maintenance_stock') IS NOT NULL OR to_regclass('public.maintenance_stock_id_seq') IS NOT NULL THEN
  RAISE EXCEPTION 'MAINTENANCE_OBJECT_ALREADY_EXISTS_REVIEW_CURRENT_CATALOG'; END IF;
 CREATE TABLE public.maintenance_stock (
  id serial PRIMARY KEY,
  item_name text NOT NULL UNIQUE,
  quantity integer NOT NULL DEFAULT 0,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
 );
 -- Canonical legacy relation is non-RLS with NO browser privileges. No existing RLS is changed.
 -- Do not repurpose this legacy table as institute-scoped inventory; canonical inventory services own stock.
 REVOKE ALL PRIVILEGES ON TABLE public.maintenance_stock FROM PUBLIC;
 REVOKE ALL PRIVILEGES ON SEQUENCE public.maintenance_stock_id_seq FROM PUBLIC;
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
   EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.maintenance_stock FROM %I',role_name);
   EXECUTE format('REVOKE ALL PRIVILEGES ON SEQUENCE public.maintenance_stock_id_seq FROM %I',role_name);
  END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a
 WHERE c.oid IN ('public.maintenance_stock'::regclass,'public.maintenance_stock_id_seq'::regclass) AND a.grantee<>c.relowner) THEN
  RAISE EXCEPTION 'UNREVIEWED_MAINTENANCE_DEFAULT_GRANTS'; END IF;
 IF EXISTS(SELECT 1 FROM public.maintenance_stock) THEN RAISE EXCEPTION 'UNEXPECTED_MAINTENANCE_ROWS'; END IF;
END $foundation$;
-- Postflight: 4 columns, 0 rows; review definitions against the canonical contract.
SELECT a.attname,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull,
 pg_get_expr(d.adbin,d.adrelid) AS default_expression
FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
WHERE a.attrelid='public.maintenance_stock'::regclass AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum;
SELECT count(*) AS new_empty_legacy_relation_rows FROM public.maintenance_stock;
-- No runtime GRANT is inferred from operator role postgres. Separate ACL review remains required.
COMMIT;
