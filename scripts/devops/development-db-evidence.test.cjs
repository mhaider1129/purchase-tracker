"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const e = require("./development-db-evidence.cjs");
test("classification retains every blocking finding and separates RLS, identity and evidence gaps", () => {
  const fixtures = [
    [
      { group: "relations", object: "maintenance_stock", reason: "missing" },
      "missing_database_objects",
    ],
    [
      { group: "columns", reason: "contract_drift", fields: ["type"] },
      "column_type_drift",
    ],
    [
      { group: "constraints", reason: "contract_drift", fields: ["validated"] },
      "constraint_drift",
    ],
    [{ group: "indexes", reason: "contract_drift" }, "index_drift"],
    [{ group: "functions", reason: "missing" }, "missing_database_objects"],
    [{ group: "triggers", reason: "contract_drift" }, "function_trigger_drift"],
    [
      { group: "relations", reason: "contract_drift", fields: ["rls"] },
      "rls_drift",
    ],
    [{ group: "policies", reason: "unreviewed_security_object" }, "rls_drift"],
    [
      { group: "runtime_role", reason: "persistent_ddl_or_owner_authority" },
      "runtime_privilege_drift",
    ],
    [
      { group: "ledger", reason: "APPLIED_receipt_missing" },
      "migration_evidence_gaps",
    ],
    [{ group: "attestation", reason: "missing" }, "release_attestation_gaps"],
    [{ group: "profile", reason: "unknown" }, "profile_mismatch"],
    [
      { group: "catalog_visibility", reason: "SELECT_missing" },
      "assessment_visibility",
    ],
    [
      { file: "scripts/source.js", reason: "CHECKSUM_MISMATCH" },
      "source_integrity",
    ],
  ];
  const result = e.classify(fixtures.map(([f]) => f));
  assert.equal(result.findings.length, fixtures.length);
  fixtures.forEach(([f, c], i) => {
    assert.equal(result.findings[i].category, c);
    assert.deepEqual(
      { ...result.findings[i], category: undefined },
      { ...f, category: undefined },
    );
  });
  assert.equal(
    Object.values(result.classificationCounts).reduce((a, b) => a + b, 0),
    fixtures.length,
  );
});
test("possible representation differences never remove findings or declare semantic equivalence", () => {
  const r = e.classify([
    {
      group: "constraints",
      object: "x",
      reason: "contract_drift",
      fields: ["definition"],
    },
    {
      group: "constraints",
      object: "fk",
      reason: "contract_drift",
      fields: ["validated", "definition"],
    },
    { group: "functions", object: "cash_dist", reason: "missing" },
  ]);
  assert.equal(r.findings.length, 3);
  assert.equal(r.potentialVerifierFalsePositives.length, 2);
  assert(r.potentialVerifierFalsePositives.every((x) => x.remainsBlocking));
  assert(!r.potentialVerifierFalsePositives.some((x) => x.object === "fk"));
});
test("schema counts distinguish public tables from views without inventing actual Development counts", () => {
  assert.deepEqual(
    e.catalogCounts({
      relations: [
        { kind: "r", rls: true, force_rls: false },
        { kind: "p", rls: false },
        { kind: "v", rls: false },
      ],
    }),
    { publicTables: 2, rlsEnabled: 1, rlsDisabled: 1, forcedRls: 0 },
  );
});
test("supplemental queries cannot select passwords, function bodies or business-table rows", () => {
  for (const sql of Object.values(e.queries)) {
    assert.match(sql.trim(), /^SELECT\b/);
    assert.doesNotMatch(
      sql,
      /\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE|rolpassword|pg_authid)\b/i,
    );
    assert.doesNotMatch(
      sql,
      /FROM\s+(?:public\.)?(?:payments|users|requests|requested_items|supplier_invoices)\b/i,
    );
    assert(
      !/pg_get_functiondef\(p.oid\)\s+AS\s+(?:body|definition)\b/i.test(sql),
    );
  }
  assert.match(e.queries.routines, /md5\(pg_get_functiondef/);
  assert.match(e.queries.memberships, /pg_auth_members/);
});
test("unavailable metadata is recovered within a savepoint and only a sanitized code is returned", async () => {
  const calls = [];
  const db = {
    async query(sql) {
      calls.push(sql);
      if (sql === "SELECT protected") {
        const err = Error("secret connection text must not escape");
        err.code = "42501";
        throw err;
      }
      return { rows: [] };
    },
  };
  assert.deepEqual(await e.optional(db, "SELECT protected"), {
    status: "UNAVAILABLE",
    code: "42501",
  });
  assert.deepEqual(calls, [
    "SAVEPOINT development_diagnostic_section",
    "SELECT protected",
    "ROLLBACK TO SAVEPOINT development_diagnostic_section",
    "RELEASE SAVEPOINT development_diagnostic_section",
  ]);
});
test("successful metadata reads release savepoints without committing database mutations", async () => {
  const calls = [];
  const db = {
    async query(sql) {
      calls.push(sql);
      return { rows: [{ name: "synthetic" }] };
    },
  };
  assert.equal((await e.optional(db, "SELECT roles")).status, "OBSERVED");
  assert(!calls.includes("COMMIT"));
  assert.equal(
    calls.at(-1),
    "RELEASE SAVEPOINT development_diagnostic_section",
  );
});
function fixture({ hidden = false, failed = false } = {}) {
  const db = {
    async query(sql) {
      if (sql === e.queries.roles)
        return {
          rows: [
            {
              name: "postgres",
              login: true,
              create_database: true,
              create_role: true,
              bypass_rls: true,
            },
          ],
        };
      if (failed && sql === e.queries.extensions) {
        const err = Error("private diagnostic failure");
        err.code = "42501";
        throw err;
      }
      return { rows: [] };
    },
  };
  return {
    db,
    input: {
      catalog: {
        compare(expected) {
          return expected.columns
            ? [
                {
                  group: "columns",
                  object: "scop_fulfillment_allocations.quantity",
                  reason: "contract_drift",
                  fields: ["type"],
                },
              ]
            : [];
        },
      },
      actual: {
        relations: [
          { name: "database_release_attestations", kind: "r", rls: true },
        ],
      },
      visibility: {
        complete: !hidden,
        unreadableRelations: hidden ? ["database_release_attestations"] : [],
        unobservableGroups: [],
      },
      identity: { actor: "postgres", login: "postgres" },
      options: {},
      service: {
        async existingLedgers() {
          return {};
        },
      },
      profiles: {
        canonical: { version: "synthetic", catalog: { columns: [] } },
      },
      inventory: {
        artifacts: [
          {
            id: "072",
            path: "sql/manual/072.sql",
            classification: "active_forward_migration",
            sha256: "a".repeat(64),
            depends_on: ["071"],
          },
        ],
      },
    },
  };
}
test("owner attributes are evidence, proposed role names remain absent and are not provisioned", async () => {
  const f = fixture(),
    r = await e.collect(f.db, f.input);
  assert.equal(r.roleAssessment.actualActor.attributes.create_role, true);
  assert.equal(r.roleAssessment.proposedRuntimeLogin.status, "ABSENT");
  assert.equal(r.migrationExecution, "NOT_PERFORMED");
  assert.equal(r.automaticProfileSelection, false);
  assert.equal(r.operationalFoundation.canonicalDifferenceCount, 1);
  assert.match(r.operationalFoundation.evidenceRule, /DO_NOT_PROVE/);
});
test("RLS-hidden ledgers are unobservable, never reported as empty or successfully accepted", async () => {
  const f = fixture({ hidden: true }),
    r = await e.collect(f.db, f.input);
  assert.equal(r.sections.attestations.status, "UNOBSERVABLE_RLS_OR_SELECT");
  assert.equal(r.complete, false);
  assert.equal(r.failures[0].group, "diagnostic_capture");
});
test("metadata failures preserve remaining sections and force incomplete evidence", async () => {
  const f = fixture({ failed: true }),
    r = await e.collect(f.db, f.input);
  assert.equal(r.complete, false);
  assert.equal(r.sections.extensions.code, "42501");
  assert.equal(r.sections.roles.status, "OBSERVED");
});

test("non-SQLSTATE error codes cannot leak private driver text", async () => {
  const db = {
    async query(sql) {
      if (sql === "SELECT protected") {
        const e = Error("not exported");
        e.code = "PRIVATE_DRIVER_DETAILS";
        throw e;
      }
      return { rows: [] };
    },
  };
  assert.equal(
    (await e.optional(db, "SELECT protected")).code,
    "CAPTURE_FAILED",
  );
});

test("target-role privilege evidence is explicitly hypothetical and cannot authorize restart", async () => {
  const f = fixture();
  f.input.service.runtimeAuthority = async (db, role) => ({
    target_role: role,
    assessment_mode: "TARGET_ROLE_ONLY",
    findings: [],
  });
  const r = await e.collect(f.db, f.input),
    target = r.sections.runtimeGrantPrivileges.rows[0];
  assert.equal(target.target_role, "purchase_backend");
  assert.equal(target.assessment_mode, "TARGET_ROLE_ONLY");
  assert.equal(target.restart_eligible, false);
  assert.match(target.evidenceRule, /NOT_ACTUAL_RUNTIME/);
});

test("unreadable provider history remains unknown without adding runtime privileges or inventing receipts", async () => {
  const f = fixture(),
    original = f.db.query;
  f.db.query = async (sql) =>
    sql.includes("AS readable")
      ? {
          rows: [
            {
              schema: "supabase_migrations",
              relation: "schema_migrations",
              readable: false,
              rls_active: false,
            },
          ],
        }
      : original(sql);
  f.input.service.existingLedgers = async () =>
    assert.fail("do not read inaccessible history");
  const r = await e.collect(f.db, f.input);
  assert.equal(r.sections.legacyHistory.status, "UNOBSERVABLE_RLS_OR_SELECT");
  assert.equal(r.complete, true);
  assert.equal(r.contextComplete, false);
  assert.equal(r.contextGaps[0].object, "legacyHistory");
  assert.equal(r.migrationExecution, "NOT_PERFORMED");
});
