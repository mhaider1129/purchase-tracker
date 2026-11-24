-- REVIEW-ONLY MANUAL DEVELOPMENT PATCH 03. Not a registered release migration.
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
 OR current_setting('wici.review.approval',true) IS DISTINCT FROM 'APPROVED:79863025445d3a210caf8cf81456a0da7cb7a37e9596ea8b4ba1e207568e53cb:03' THEN
  RAISE EXCEPTION 'MANUAL_DEVELOPMENT_PROJECT_AND_PATCH_REVIEW_REQUIRED';
 END IF;
 IF NOT pg_try_advisory_xact_lock(hashtextextended('purchase-tracker:database-release',0)) THEN RAISE EXCEPTION 'DATABASE_RELEASE_BUSY'; END IF;
END $approval$;
-- Conditional empty review-history foundation from merged 066 definitions.
-- Not replay of 066, not enrollment/reconciliation/backfill, no payments or AP posting.
-- Existing objects are never replaced, their RLS/ACLs never rewritten by this patch.
DO $reviews$ DECLARE browser text; fresh boolean:=to_regclass('public.contract_financial_reviews') IS NULL;
 expected jsonb; actual jsonb; BEGIN
 IF to_regprocedure('public.guard_canonical_invoice_contract_source()') IS NULL THEN RAISE EXCEPTION 'CANONICAL_CONTRACT_FINANCE_PREREQUISITE_REQUIRED'; END IF;
 IF to_regprocedure('public.preserve_contract_financial_reviews()') IS NOT NULL AND
 md5(pg_get_functiondef(to_regprocedure('public.preserve_contract_financial_reviews()')))<>'e4dd6607bb77b6c0c7b64109778ce9e7' THEN RAISE EXCEPTION 'EXISTING_REVIEW_ROUTINE_REQUIRES_INDEPENDENT_REVIEW'; END IF;
 IF fresh THEN
  IF to_regclass('public.contract_financial_reviews_id_seq') IS NOT NULL THEN RAISE EXCEPTION 'UNATTACHED_REVIEW_SEQUENCE_REQUIRES_REVIEW'; END IF;
  EXECUTE $review_ddl$CREATE TABLE public.contract_financial_reviews (
 id BIGSERIAL PRIMARY KEY,
 institute_id INTEGER NOT NULL REFERENCES public.institutes(id),
 contract_id INTEGER NOT NULL REFERENCES public.contracts(id),
 record_type TEXT NOT NULL CHECK(record_type IN ('legacy_invoice','legacy_payment')),
 source_id BIGINT NOT NULL CHECK(source_id>0),
 revision INTEGER NOT NULL CHECK(revision>0),
 decision TEXT NOT NULL CHECK(decision IN ('CONFIRMED_MATCH','REJECTED_PROPOSAL','CONFLICTING','NEEDS_INVESTIGATION')),
 canonical_ids BIGINT[] NOT NULL DEFAULT '{}',
 source_fingerprint TEXT NOT NULL CHECK(source_fingerprint ~ '^[a-f0-9]{64}$'),
 evidence_snapshot JSONB NOT NULL,
 supporting_evidence TEXT NOT NULL CHECK(length(trim(supporting_evidence)) BETWEEN 1 AND 8000),
 notes TEXT NOT NULL CHECK(length(trim(notes)) BETWEEN 1 AND 4000),
 reviewer_id INTEGER NOT NULL REFERENCES public.users(id),
 reviewed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 command_key TEXT NOT NULL CHECK(length(command_key) BETWEEN 8 AND 200),
 command_fingerprint TEXT NOT NULL CHECK(command_fingerprint ~ '^[a-f0-9]{64}$'),
 UNIQUE(institute_id,record_type,source_id,revision),
 UNIQUE(institute_id,command_key)
);$review_ddl$;
  EXECUTE $review_ddl$CREATE INDEX contract_financial_reviews_worklist_idx ON public.contract_financial_reviews(institute_id,contract_id,record_type,source_id,revision DESC);$review_ddl$;
  IF to_regprocedure('public.preserve_contract_financial_reviews()') IS NULL THEN
   EXECUTE $review_ddl$CREATE FUNCTION public.preserve_contract_financial_reviews() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN RAISE EXCEPTION 'Financial reconciliation reviews are append-only; record a new revision' USING ERRCODE='23514'; END $$;$review_ddl$;
   REVOKE ALL ON FUNCTION public.preserve_contract_financial_reviews() FROM PUBLIC;
   FOR browser IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.preserve_contract_financial_reviews() FROM %I',browser);
   END LOOP;
  END IF;
  EXECUTE $review_ddl$CREATE TRIGGER contract_financial_reviews_append_only BEFORE UPDATE OR DELETE ON public.contract_financial_reviews FOR EACH ROW EXECUTE FUNCTION public.preserve_contract_financial_reviews();$review_ddl$;
  EXECUTE $review_ddl$CREATE TRIGGER contract_financial_reviews_no_truncate BEFORE TRUNCATE ON public.contract_financial_reviews FOR EACH STATEMENT EXECUTE FUNCTION public.preserve_contract_financial_reviews();$review_ddl$;
  ALTER TABLE public.contract_financial_reviews ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON public.contract_financial_reviews FROM PUBLIC;
  REVOKE ALL ON SEQUENCE public.contract_financial_reviews_id_seq FROM PUBLIC;
  FOR browser IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role') LOOP
   EXECUTE format('REVOKE ALL ON public.contract_financial_reviews FROM %I',browser);
   EXECUTE format('REVOKE ALL ON SEQUENCE public.contract_financial_reviews_id_seq FROM %I',browser);
  END LOOP;
  IF EXISTS(SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl,acldefault(CASE WHEN c.relkind='S' THEN 's'::"char" ELSE 'r'::"char" END,c.relowner))) a WHERE c.oid IN ('public.contract_financial_reviews'::regclass,'public.contract_financial_reviews_id_seq'::regclass) AND a.grantee<>c.relowner) THEN RAISE EXCEPTION 'UNREVIEWED_NEW_REVIEW_OBJECT_DEFAULT_GRANTS'; END IF;
 END IF;
 expected:='[{"name":"canonical_ids","type":"bigint[]","not_null":true},{"name":"command_fingerprint","type":"text","not_null":true},{"name":"command_key","type":"text","not_null":true},{"name":"contract_id","type":"integer","not_null":true},{"name":"decision","type":"text","not_null":true},{"name":"evidence_snapshot","type":"jsonb","not_null":true},{"name":"id","type":"bigint","not_null":true},{"name":"institute_id","type":"integer","not_null":true},{"name":"notes","type":"text","not_null":true},{"name":"record_type","type":"text","not_null":true},{"name":"reviewed_at","type":"timestamp with time zone","not_null":true},{"name":"reviewer_id","type":"integer","not_null":true},{"name":"revision","type":"integer","not_null":true},{"name":"source_fingerprint","type":"text","not_null":true},{"name":"source_id","type":"bigint","not_null":true},{"name":"supporting_evidence","type":"text","not_null":true}]'::jsonb;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull)),'[]'::jsonb) INTO actual
 FROM pg_attribute a WHERE a.attrelid='public.contract_financial_reviews'::regclass AND a.attnum>0 AND NOT a.attisdropped;
 IF NOT(actual @> expected AND actual <@ expected) THEN RAISE EXCEPTION 'REVIEW_COLUMN_POSTFLIGHT_REQUIRES_REVIEW'; END IF;
 expected:='[{"name":"contract_financial_reviews_command_fingerprint_check","definition":"CHECK (command_fingerprint ~ ''^[a-f0-9]{64}$''::text)","validated":true},{"name":"contract_financial_reviews_command_key_check","definition":"CHECK (length(command_key) >= 8 AND length(command_key) <= 200)","validated":true},{"name":"contract_financial_reviews_contract_id_fkey","definition":"FOREIGN KEY (contract_id) REFERENCES contracts(id)","validated":true},{"name":"contract_financial_reviews_decision_check","definition":"CHECK (decision = ANY (ARRAY[''CONFIRMED_MATCH''::text, ''REJECTED_PROPOSAL''::text, ''CONFLICTING''::text, ''NEEDS_INVESTIGATION''::text]))","validated":true},{"name":"contract_financial_reviews_institute_id_command_key_key","definition":"UNIQUE (institute_id, command_key)","validated":true},{"name":"contract_financial_reviews_institute_id_fkey","definition":"FOREIGN KEY (institute_id) REFERENCES institutes(id)","validated":true},{"name":"contract_financial_reviews_institute_id_record_type_source__key","definition":"UNIQUE (institute_id, record_type, source_id, revision)","validated":true},{"name":"contract_financial_reviews_notes_check","definition":"CHECK (length(TRIM(BOTH FROM notes)) >= 1 AND length(TRIM(BOTH FROM notes)) <= 4000)","validated":true},{"name":"contract_financial_reviews_pkey","definition":"PRIMARY KEY (id)","validated":true},{"name":"contract_financial_reviews_record_type_check","definition":"CHECK (record_type = ANY (ARRAY[''legacy_invoice''::text, ''legacy_payment''::text]))","validated":true},{"name":"contract_financial_reviews_reviewer_id_fkey","definition":"FOREIGN KEY (reviewer_id) REFERENCES users(id)","validated":true},{"name":"contract_financial_reviews_revision_check","definition":"CHECK (revision > 0)","validated":true},{"name":"contract_financial_reviews_source_fingerprint_check","definition":"CHECK (source_fingerprint ~ ''^[a-f0-9]{64}$''::text)","validated":true},{"name":"contract_financial_reviews_source_id_check","definition":"CHECK (source_id > 0)","validated":true},{"name":"contract_financial_reviews_supporting_evidence_check","definition":"CHECK (length(TRIM(BOTH FROM supporting_evidence)) >= 1 AND length(TRIM(BOTH FROM supporting_evidence)) <= 8000)","validated":true}]'::jsonb;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('name',k.conname,'definition',pg_get_constraintdef(k.oid,true),'validated',k.convalidated)),'[]'::jsonb) INTO actual
 FROM pg_constraint k WHERE k.conrelid='public.contract_financial_reviews'::regclass;
 IF NOT(actual @> expected AND actual <@ expected) THEN RAISE EXCEPTION 'REVIEW_CONSTRAINT_POSTFLIGHT_REQUIRES_REVIEW'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_index i JOIN pg_class idx ON idx.oid=i.indexrelid WHERE i.indrelid='public.contract_financial_reviews'::regclass AND idx.relname='contract_financial_reviews_worklist_idx' AND i.indisvalid AND i.indisready AND pg_get_indexdef(i.indexrelid,0,true)='CREATE INDEX contract_financial_reviews_worklist_idx ON contract_financial_reviews USING btree (institute_id, contract_id, record_type, source_id, revision DESC)') THEN RAISE EXCEPTION 'REVIEW_INDEX_POSTFLIGHT_REQUIRES_REVIEW'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.contract_financial_reviews'::regclass AND relrowsecurity AND NOT relforcerowsecurity) THEN RAISE EXCEPTION 'REVIEW_RLS_POSTFLIGHT_REQUIRES_REVIEW'; END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.preserve_contract_financial_reviews()')))<>'e4dd6607bb77b6c0c7b64109778ce9e7' THEN RAISE EXCEPTION 'REVIEW_ROUTINE_POSTFLIGHT_REQUIRES_REVIEW'; END IF;
 IF (SELECT count(*) FROM pg_trigger WHERE tgrelid='public.contract_financial_reviews'::regclass AND tgenabled='O'
 AND tgfoid=to_regprocedure('public.preserve_contract_financial_reviews()') AND ((tgname='contract_financial_reviews_append_only' AND tgtype=27) OR (tgname='contract_financial_reviews_no_truncate' AND tgtype=34)))<>2 THEN RAISE EXCEPTION 'REVIEW_HISTORY_TRIGGER_POSTFLIGHT_REQUIRES_REVIEW'; END IF;
END $reviews$;
-- Runtime permissions require separate review of actual role ownership/membership/ACLs.
-- No roles, memberships, BYPASSRLS, runtime grants or execution receipts are created here.
COMMIT;
