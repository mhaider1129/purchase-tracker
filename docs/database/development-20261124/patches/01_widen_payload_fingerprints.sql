-- REVIEW-ONLY MANUAL DEVELOPMENT PATCH 01. Not a registered release migration.
-- No execution, receipt or release attestation is implied by generation.
-- Default is BLOCKED. Approval GUCs are operator acknowledgments, NOT server identity proof.
-- Independently confirm the Development dashboard/project, backup and exact SQL before setting them.
-- Reviewed report: 79863025445d3a210caf8cf81456a0da7cb7a37e9596ea8b4ba1e207568e53cb
BEGIN;
-- After independent review, replace these two transaction-local acknowledgments.
SET LOCAL wici.review.project_ref='REVIEW_REQUIRED';
SET LOCAL wici.review.approval='REVIEW_REQUIRED';
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
SET LOCAL search_path=pg_catalog,public;
DO $approval$ BEGIN
 IF current_setting('wici.review.project_ref',true) IS DISTINCT FROM 'bcvfosxcyvarieiinovo'
 OR current_setting('wici.review.approval',true) IS DISTINCT FROM 'APPROVED:79863025445d3a210caf8cf81456a0da7cb7a37e9596ea8b4ba1e207568e53cb:01' THEN
  RAISE EXCEPTION 'MANUAL_DEVELOPMENT_PROJECT_AND_PATCH_REVIEW_REQUIRED';
 END IF;
 IF NOT pg_try_advisory_xact_lock(hashtextextended('purchase-tracker:database-release',0)) THEN RAISE EXCEPTION 'DATABASE_RELEASE_BUSY'; END IF;
END $approval$;
-- Widen storage only. Existing short/unknown fingerprints are NOT reconstructed.
-- Paid amounts, postings, allocations and settlement records are not changed.
LOCK TABLE public.ap_vouchers,public.goods_receipts,public.payment_records,public.supplier_invoices IN ACCESS EXCLUSIVE MODE;
DO $fingerprints$ DECLARE target text; kind oid; generated text; old_default text; BEGIN
 FOREACH target IN ARRAY ARRAY['ap_vouchers','goods_receipts','payment_records','supplier_invoices'] LOOP
  SELECT a.atttypid,a.attgenerated::text,pg_get_expr(d.adbin,d.adrelid) INTO kind,generated,old_default
  FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
  WHERE a.attrelid=to_regclass('public.'||target) AND a.attname='payload_fingerprint' AND NOT a.attisdropped;
  IF kind IS NULL OR generated<>'' OR old_default IS NOT NULL OR kind NOT IN ('text'::regtype,'bpchar'::regtype,'varchar'::regtype) THEN RAISE EXCEPTION 'UNEXPECTED_FINGERPRINT_SHAPE: %',target; END IF;
  IF kind<>'text'::regtype THEN
   EXECUTE format('ALTER TABLE public.%I ALTER COLUMN payload_fingerprint TYPE text USING payload_fingerprint::text',target);
  END IF;
 END LOOP;
END $fingerprints$;
-- Postflight certifies these four types only, not global compatibility or old hash integrity.
DO $postflight$ BEGIN
 IF (SELECT count(*) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname=ANY(ARRAY['ap_vouchers','goods_receipts','payment_records','supplier_invoices'])
 AND a.attname='payload_fingerprint' AND NOT a.attisdropped AND a.atttypid='text'::regtype)<>4 THEN RAISE EXCEPTION 'FINGERPRINT_TYPE_POSTFLIGHT_FAILED'; END IF;
END $postflight$;
COMMIT;
