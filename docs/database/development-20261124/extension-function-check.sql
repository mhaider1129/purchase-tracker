-- Read-only companion evidence for a possible hosted extension/schema mismatch.
-- Independently confirm Development project bcvfosxcyvarieiinovo first.
-- No function relocation, grants, wrappers, extension creation or SQL execution evidence.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='60s';
SET LOCAL search_path=pg_catalog;
SELECT n.nspname AS schema_name,p.proname AS function_name,
 pg_catalog.pg_get_function_identity_arguments(p.oid) AS arguments,
 pg_catalog.pg_get_function_result(p.oid) AS result_type,
 pg_catalog.pg_get_userbyid(p.proowner) AS owner,
 p.prosecdef AS security_definer,p.proconfig AS settings,
 md5(pg_catalog.pg_get_functiondef(p.oid)) AS definition_md5,
 e.extname AS extension_name,e.extversion AS extension_version,
 r.rolname AS browser_role,pg_catalog.has_function_privilege(r.oid,p.oid,'EXECUTE') AS browser_can_execute
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
LEFT JOIN pg_catalog.pg_depend d ON d.classid='pg_catalog.pg_proc'::regclass AND d.objid=p.oid AND d.objsubid=0
 AND d.refclassid='pg_catalog.pg_extension'::regclass AND d.deptype='e'
LEFT JOIN pg_catalog.pg_extension e ON e.oid=d.refobjid
LEFT JOIN pg_catalog.pg_roles r ON r.rolname IN ('anon','authenticated')
WHERE p.prokind IN ('f','p') AND n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema'
ORDER BY n.nspname,p.proname,arguments,r.rolname;
ROLLBACK;
