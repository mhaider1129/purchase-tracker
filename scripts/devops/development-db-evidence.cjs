"use strict";
// Supplemental catalog/evidence SELECTs only; the canonical verifier remains authoritative.
const queries = {
  roles: `SELECT rolname AS name,rolcanlogin AS login,rolsuper AS superuser,rolbypassrls AS bypass_rls,
    rolcreatedb AS create_database,rolcreaterole AS create_role,rolinherit AS inherit,rolreplication AS replication
    FROM pg_roles ORDER BY rolname`,
  memberships: `SELECT r.rolname AS role,m.rolname AS member,a.admin_option,
    to_jsonb(a)->'inherit_option' AS inherit_option,to_jsonb(a)->'set_option' AS set_option
    FROM pg_auth_members a JOIN pg_roles r ON r.oid=a.roleid JOIN pg_roles m ON m.oid=a.member ORDER BY 1,2`,
  extensions: `SELECT e.extname AS name,e.extversion AS version,n.nspname AS schema
    FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace ORDER BY 1`,
  routines: `SELECT n.nspname AS schema,p.proname AS name,pg_get_function_identity_arguments(p.oid) AS arguments,
    pg_get_function_result(p.oid) AS result,p.prosecdef AS security_definer,e.extname AS extension,
    md5(pg_get_functiondef(p.oid)) AS definition_md5
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    LEFT JOIN pg_depend d ON d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e'
    LEFT JOIN pg_extension e ON e.oid=d.refobjid
    WHERE p.prokind IN ('f','p') AND n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema'
      AND (n.nspname IN ('public','extensions') OR e.oid IS NOT NULL) ORDER BY 1,2,3`,
  routine_browser_grants: `SELECT n.nspname AS schema,p.proname AS name,pg_get_function_identity_arguments(p.oid) AS arguments,
    r.rolname AS role,has_schema_privilege(r.oid,n.oid,'USAGE') AS schema_usage,has_function_privilege(r.oid,p.oid,'EXECUTE') AS can_execute
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN pg_roles r
    WHERE p.prokind='f' AND n.nspname IN ('public','extensions') AND r.rolname IN ('anon','authenticated') ORDER BY 1,2,3,4`,
  attestations: `SELECT contract_version,contract_sha256,application_manifest_sha256,observed_schema_sha256,
    execution_environment,application_release_ref,evidence_kind,verified_at
    FROM public.database_release_attestations ORDER BY verified_at,contract_version,application_release_ref`,
};
const categories = [
  "missing_database_objects",
  "column_type_drift",
  "constraint_drift",
  "index_drift",
  "function_trigger_drift",
  "rls_drift",
  "runtime_privilege_drift",
  "migration_evidence_gaps",
  "release_attestation_gaps",
  "profile_mismatch",
  "assessment_visibility",
  "source_integrity",
  "other",
];
function category(f) {
  if (f.file || /CHECKSUM|MANIFEST|ARTIFACT/.test(f.reason || ""))
    return "source_integrity";
  if (["catalog_visibility", "diagnostic_capture"].includes(f.group))
    return "assessment_visibility";
  if (f.group === "ledger") return "migration_evidence_gaps";
  if (["attestation", "release"].includes(f.group))
    return "release_attestation_gaps";
  if (f.group === "profile") return "profile_mismatch";
  if (
    ["runtime_role", "runtime_privilege", "connection_principal"].includes(
      f.group,
    )
  )
    return "runtime_privilege_drift";
  if (
    f.group === "relations" &&
    f.fields?.some((k) => ["rls", "force_rls"].includes(k))
  )
    return "rls_drift";
  if (f.group === "policies") return "rls_drift";
  if (
    f.reason === "missing" &&
    [
      "relations",
      "columns",
      "constraints",
      "indexes",
      "functions",
      "triggers",
    ].includes(f.group)
  )
    return "missing_database_objects";
  return (
    {
      columns: "column_type_drift",
      constraints: "constraint_drift",
      indexes: "index_drift",
      functions: "function_trigger_drift",
      triggers: "function_trigger_drift",
      browser_table_grants: "runtime_privilege_drift",
      browser_function_grants: "runtime_privilege_drift",
    }[f.group] || "other"
  );
}
function classify(findings) {
  const counts = Object.fromEntries(categories.map((k) => [k, 0]));
  const rows = findings.map((f) => {
    const c = category(f);
    counts[c]++;
    return { ...f, category: c };
  });
  const potentialVerifierFalsePositives = rows
    .filter(
      (f) =>
        (["constraints", "indexes"].includes(f.group) &&
          JSON.stringify(f.fields) === '["definition"]') ||
        (f.group === "functions" &&
          ["missing", "contract_drift"].includes(f.reason)),
    )
    .map((f) => ({
      group: f.group,
      object: f.object,
      reason: f.reason,
      disposition:
        "UNPROVEN_REPRESENTATION_OR_EXTENSION_DIFFERENCE_REQUIRES_SEMANTIC_REVIEW",
      remainsBlocking: true,
    }));
  return {
    findings: rows,
    classificationCounts: counts,
    potentialVerifierFalsePositives,
  };
}
async function optional(db, sql, values = []) {
  await db.query("SAVEPOINT development_diagnostic_section");
  try {
    return {
      status: "OBSERVED",
      rows: (await (typeof sql === "function" ? sql() : db.query(sql, values)))
        .rows,
    };
  } catch (e) {
    await db.query("ROLLBACK TO SAVEPOINT development_diagnostic_section");
    return {
      status: "UNAVAILABLE",
      code: /^[A-Z0-9]{5}$/.test(e.code || "") ? e.code : "CAPTURE_FAILED",
    };
  } finally {
    await db.query("RELEASE SAVEPOINT development_diagnostic_section");
  }
}
function catalogCounts(actual) {
  const tables = (actual.relations || []).filter((r) =>
    ["r", "p"].includes(r.kind),
  );
  return {
    publicTables: tables.length,
    rlsEnabled: tables.filter((r) => r.rls).length,
    rlsDisabled: tables.filter((r) => !r.rls).length,
    forcedRls: tables.filter((r) => r.force_rls).length,
  };
}
function profileComparison(catalog, actual, visibility, profile, label) {
  const expected = Object.fromEntries(
    Object.entries(profile.catalog).filter(
      ([g]) => !visibility.unobservableGroups?.includes(g),
    ),
  );
  const findings = catalog.compare(expected, actual);
  return {
    label,
    version: profile.version,
    disposition: "REFERENCE_COMPARISON_NOT_EXECUTION_OR_PROFILE_APPROVAL",
    completeVisibility: visibility.complete,
    findingCount: findings.length,
    findings,
  };
}
async function collect(
  db,
  {
    catalog,
    service,
    actual,
    visibility,
    identity,
    options,
    profiles,
    inventory,
  },
) {
  const sections = {};
  for (const name of [
    "roles",
    "memberships",
    "extensions",
    "routines",
    "routine_browser_grants",
  ])
    sections[name] = await optional(db, queries[name]);
  const present = new Set((actual.relations || []).map((r) => r.name));
  sections.attestations = !present.has("database_release_attestations")
    ? { status: "ABSENT" }
    : visibility.unreadableRelations?.includes("database_release_attestations")
      ? { status: "UNOBSERVABLE_RLS_OR_SELECT" }
      : await optional(db, queries.attestations);
  // Legacy execution metadata is evidence, never converted to canonical receipts.
  sections.legacyLedgers = await optional(
    db,
    `SELECT n.nspname AS schema,c.relname AS relation,has_schema_privilege(current_user,n.oid,'USAGE') AND has_table_privilege(current_user,c.oid,'SELECT') AS readable,
      row_security_active(c.oid) AS rls_active FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE (n.nspname='public' AND c.relname='pgmigrations') OR (n.nspname='supabase_migrations' AND c.relname='schema_migrations') ORDER BY 1,2`,
  );
  if (
    sections.legacyLedgers.status !== "OBSERVED" ||
    sections.legacyLedgers.rows.some((r) => !r.readable || r.rls_active)
  ) {
    sections.legacyHistory = { status: "UNOBSERVABLE_RLS_OR_SELECT" };
  } else if (service.existingLedgers) {
    sections.legacyHistory = await optional(db, async () => ({
      rows: [await service.existingLedgers(db)],
    }));
  } else {
    sections.legacyHistory = {
      status: "UNAVAILABLE",
      code: "LEGACY_READER_UNAVAILABLE",
    };
  }
  const roleNames = {
    actualConnectionLogin: identity.login,
    actualActor: identity.actor,
    expectedRuntimeGrantRole: "purchase_backend",
    proposedRuntimeLogin:
      options["runtime-login"] || "wici_development_runtime",
    proposedVerificationLogin:
      options["verification-login"] || "wici_development_reader",
  };
  const roleAssessment = Object.fromEntries(
    Object.entries(roleNames).map(([kind, name]) => [
      kind,
      {
        name,
        status:
          sections.roles.status === "OBSERVED"
            ? sections.roles.rows.some((r) => r.name === name)
              ? "OBSERVED"
              : "ABSENT"
            : "UNVERIFIED",
        attributes: sections.roles.rows?.find((r) => r.name === name) || null,
      },
    ]),
  );
  if (service.runtimeAuthority) {
    sections.runtimeGrantPrivileges = await optional(db, async () => ({
      rows: [
        {
          ...(await service.runtimeAuthority(db, "purchase_backend")),
          restart_eligible: false,
          evidenceRule:
            "TARGET_ROLE_ASSESSMENT_IS_NOT_ACTUAL_RUNTIME_ACCEPTANCE",
        },
      ],
    }));
  }
  const comparisons = [];
  for (const [label, profile] of Object.entries(profiles))
    comparisons.push(
      profileComparison(catalog, actual, visibility, profile, label),
    );
  const canonicalFoundationFindings =
    comparisons
      .find((c) => c.label === "canonical")
      ?.findings.filter((f) =>
        /^(?:scop_|canonical_supply_line_quantity\(|scop\.)/.test(
          f.object || "",
        ),
      ) || [];
  const operationalFoundation = {
    evidenceRule:
      "NAMES_AND_ZERO_RECEIPTS_DO_NOT_PROVE_SQL072_COMPLETION_OR_EXECUTION",
    canonicalDifferences: canonicalFoundationFindings,
    canonicalDifferenceCount: canonicalFoundationFindings.length,
    completeness: "REQUIRES_FULL_CONTRACT_AND_GENUINE_RELEASE_EVIDENCE",
  };
  const migrationPrerequisites = inventory.artifacts
    .filter((a) => a.id && Number(a.id) >= 69)
    .map((a) => ({
      id: a.id,
      file: a.path,
      classification: a.classification,
      sourceSha256: a.sha256,
      dependsOn: a.depends_on || [],
      preflightContract: a.preflight_contract || null,
      observedProfileRequired: a.profile || null,
      historicalExecution: "UNVERIFIED_UNLESS_INDEPENDENTLY_EVIDENCED",
    }));
  const unavailable = Object.entries(sections)
    .filter(([, s]) =>
      ["UNAVAILABLE", "UNOBSERVABLE_RLS_OR_SELECT"].includes(s.status),
    )
    .map(([name]) => ({
      group: "diagnostic_capture",
      object: name,
      reason: "supplemental_evidence_unavailable",
    }));
  // Provider legacy history is contextual, as in existingLedgers(), not a new
  // requirement to grant the runtime access to provider administration schemas.
  const contextGaps = unavailable.filter((f) => f.object === "legacyHistory");
  const failures = unavailable.filter((f) => f.object !== "legacyHistory");
  return {
    complete: failures.length === 0,
    contextComplete: unavailable.length === 0,
    contextGaps,
    failures,
    sections,
    roleAssessment,
    schemaCounts: catalogCounts(actual),
    profileComparisons: comparisons,
    operationalFoundation,
    migrationPrerequisites,
    automaticProfileSelection: false,
    migrationExecution: "NOT_PERFORMED",
    recoveryBundle: "BLOCKED_PENDING_ACTUAL_SCHEMA_REVIEW",
    functionScope:
      "PUBLIC_EXTENSIONS_AND_NON_SYSTEM_EXTENSION_OWNED_METADATA_NO_BODIES_NO_AUTOMATIC_EQUIVALENCE",
  };
}
module.exports = {
  queries,
  category,
  classify,
  optional,
  catalogCounts,
  profileComparison,
  collect,
};
