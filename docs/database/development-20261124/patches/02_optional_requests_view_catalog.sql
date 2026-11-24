-- REVIEW-ONLY MANUAL DEVELOPMENT PATCH 02. Not a registered release migration.
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
 OR current_setting('wici.review.approval',true) IS DISTINCT FROM 'APPROVED:79863025445d3a210caf8cf81456a0da7cb7a37e9596ea8b4ba1e207568e53cb:02' THEN
  RAISE EXCEPTION 'MANUAL_DEVELOPMENT_PROJECT_AND_PATCH_REVIEW_REQUIRED';
 END IF;
 IF NOT pg_try_advisory_xact_lock(hashtextextended('purchase-tracker:database-release',0)) THEN RAISE EXCEPTION 'DATABASE_RELEASE_BUSY'; END IF;
END $approval$;
-- OPTIONAL AUTHORIZATION-DESIGN REVIEW: merged server code checks requests.view
-- in procurementCompletionService.js, but neither its catalog nor CORE definitions declare it.
-- Adds a definition only. NO role/user assignment and NO automatic department visibility grant.
LOCK TABLE public.permissions IN SHARE ROW EXCLUSIVE MODE;
DO $permission$ DECLARE seq text; maximum_id bigint; last_used bigint; called boolean; BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.permissions WHERE code='requests.view') THEN
  seq:=pg_get_serial_sequence('public.permissions','id');
  IF seq IS NULL THEN RAISE EXCEPTION 'OWNED_PERMISSION_SEQUENCE_REVIEW_REQUIRED'; END IF;
  SELECT max(id) INTO maximum_id FROM public.permissions;
  EXECUTE format('SELECT last_value,is_called FROM %s',seq::regclass) INTO last_used,called;
  IF maximum_id IS NOT NULL AND (last_used<maximum_id OR (last_used=maximum_id AND NOT called)) THEN RAISE EXCEPTION 'PERMISSION_SEQUENCE_BEHIND_REVIEW_REQUIRED'; END IF;
  INSERT INTO public.permissions(code,name,description) VALUES
   ('requests.view','View own-department request completion','Allow the existing merged completion-service department branch within its institute and department checks; no cross-institute, procurement, approval or posting authority.');
 END IF;
END $permission$;
-- Existing definitions/customizations are untouched; custody.create is NOT added.
COMMIT;
