-- READ ONLY release evidence. Run only after 00 confirms these tables exist.
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
