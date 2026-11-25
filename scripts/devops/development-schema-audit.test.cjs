"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const audit = require("./development-schema-audit.cjs"),
  generator = require("./development-schema-patches.cjs");
const root = path.resolve(__dirname, "../.."),
  dir = path.join(root, "docs/database/development-20261124");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
test("SQL literal parsing handles quoted commas, apostrophes, nested arrays and typed empty lists without executing SQL", () => {
  const rows = audit.insertRows(
    "INSERT INTO public.ui_resource_permissions(resource_key,label,permissions,require_all) VALUES ('feature.x','Owner''s, item',ARRAY['a.view','b.manage']::text[],false),('feature.y','{}','{}',true);",
    "ui_resource_permissions",
  );
  assert.deepEqual(rows[0].permissions, ["a.view", "b.manage"]);
  assert.equal(rows[0].label, "Owner's, item");
  assert.deepEqual(rows[1].permissions, []);
  assert.equal(rows[1].label, "{}");
  assert.throws(
    () =>
      audit.insertRows(
        "INSERT INTO public.permissions(code) VALUES ('x'); DROP TABLE users;",
        "permissions",
      ),
    /ONE_CATALOG_INSERT/,
  );
  assert.throws(() => audit.sqlValue("current_user"), /UNSUPPORTED/);
});
test("context export anomalies remain explicit and are never normalized into executable database facts", () => {
  const r = audit.schemaTables(
    "CREATE TABLE public.x (\n id integer NOT NULL,\n permissions ARRAY,\n factor numeric CHECK (factor>0) NOT VALI)\n);\n",
  );
  assert.equal(r.tables.x.parseConfidence, "CONTEXT_LINE_FALLBACK_UNVERIFIED");
  assert(r.anomalies.length >= 2);
  assert.equal(r.tables.x.columns.permissions.type, "ARRAY");
});
test("type aliases preserve precision boundaries and do not equate unknown ARRAY with text[]", () => {
  assert.equal(
    audit.normalizeType("character varying(32)"),
    audit.normalizeType("varchar(32)"),
  );
  assert.notEqual(
    audit.normalizeType("numeric(14,2)"),
    audit.normalizeType("numeric"),
  );
  assert.notEqual(
    audit.normalizeType("character"),
    audit.normalizeType("text"),
  );
  assert.notEqual(audit.normalizeType("ARRAY"), audit.normalizeType("text[]"));
});
test("static constant interpreter rejects executable calls and supports only literal mapping", () => {
  assert.throws(
    () =>
      audit.literal({
        type: "CallExpression",
        callee: { type: "Identifier", name: "require" },
        arguments: [],
      }),
    /NON_LITERAL/,
  );
  assert.throws(
    () =>
      audit.literal({
        type: "ObjectExpression",
        properties: [{ type: "ObjectMethod" }],
      }),
    /UNSUPPORTED/,
  );
});
test("dynamic and indirect SQL remain a visible worklist with portable source paths", () => {
  const r = audit.sqlReferences(
    [
      {
        source: "services\\x.js",
        line: 2,
        value: "SELECT a.id FROM requests a WHERE id=${id}",
        queryCall: true,
      },
      {
        source: "models/y.js",
        line: 3,
        value: "SELECT id FROM requests",
        queryCall: false,
      },
    ],
    new Set(["requests"]),
  );
  assert.equal(r.unresolved.length, 2);
  assert.equal(r.references[0].source, "services/x.js");
  assert.deepEqual(r.references[0].qualifiedColumns, [
    { relation: "requests", column: "id" },
  ]);
});
test("incoming observed bytes survive relocation and original locked fixture hashes remain unchanged", () => {
  const p = JSON.parse(fs.readFileSync(path.join(dir, "provenance.json")));
  for (const f of p.files) {
    assert.equal(
      sha(fs.readFileSync(path.join(root, f.observedPath))),
      f.observedSha256,
    );
    assert.equal(
      sha(fs.readFileSync(path.join(root, f.originalPath))),
      f.restoredHistoricalSha256,
    );
    assert.notEqual(f.observedSha256, f.restoredHistoricalSha256);
  }
  const inv = require("../../purchase-backend/scripts/lib/databaseRelease/inventory");
  assert.deepEqual(
    inv.verifyFiles(
      require("../../purchase-backend/database/releases/migration-inventory.json"),
    ),
    [],
  );
});
test("complete report reproduces from merged runtime bytes, retains incomplete evidence and authorization conflict", () => {
  const r = audit.build(),
    stored = JSON.parse(fs.readFileSync(path.join(dir, "reconciliation.json")));
  assert.deepEqual(r, stored);
  assert.equal(r.sourceBinding.status, "MERGED_APPLICATION_BYTES_VERIFIED");
  assert.equal(r.coverage.applicationFiles, 718);
  assert.equal(r.coverage.observedTables, 100);
  assert.equal(r.schema.absentRelations.length, 168);
  assert(
    r.schema.absentRelations.every((x) =>
      x.status.includes("NOT_PROVEN_ABSENT"),
    ),
  );
  assert.equal(r.permissions.absentPermissions.length, 0);
  assert.equal(r.ui.differences.length, 0);
  assert.equal(r.ui.releaseContractConflicts.length, 1);
  assert.equal(
    r.ui.releaseContractConflicts[0].resource_key,
    "feature.demandPlanning",
  );
  assert(
    r.permissions.authorityCallsMissingCatalog.some(
      (x) => x.code === "requests.view",
    ),
  );
  assert(
    r.permissions.authorityCallsMissingCatalog.some(
      (x) => x.code === "custody.create",
    ),
  );
  assert.equal(r.compatibility, "NOT_CERTIFIED");
  assert.equal(r.pendingPR113, "UNMERGED_PROPOSALS_NOT_APPLICATION_BASELINE");
  assert.equal(r.governance.lockedArtifacts, 105);
  assert.equal(r.safeNullableColumnCandidates.length, 0);
});
test("manual candidates reproduce, stay outside automatic inventory and fail closed without explicit local acknowledgments", () => {
  const r = JSON.parse(fs.readFileSync(path.join(dir, "reconciliation.json"))),
    patches = generator.patches(r);
  for (const [name, sql] of Object.entries(patches)) {
    assert.equal(sql, fs.readFileSync(path.join(dir, "patches", name), "utf8"));
    if (/^0[123]_/.test(name)) {
      assert.match(
        sql,
        /SET LOCAL wici\.review\.project_ref='REVIEW_REQUIRED'/,
      );
      assert.match(sql, /SET LOCAL wici\.review\.approval='REVIEW_REQUIRED'/);
      assert(
        sql.indexOf("MANUAL_DEVELOPMENT_PROJECT_AND_PATCH_REVIEW_REQUIRED") <
          sql.indexOf("LOCK TABLE") || !sql.includes("LOCK TABLE"),
      );
      assert.match(sql, /pg_try_advisory_xact_lock/);
      assert.match(sql, /COMMIT;\n$/);
      assert.doesNotMatch(
        sql,
        /\b(?:INSERT INTO|UPDATE|DELETE FROM) public\.(?:payments|payment_records|ap_payables|journal_entries|inventory_transactions)\b/i,
      );
      assert.doesNotMatch(
        sql,
        /INSERT INTO public\.(?:role_permissions|user_permissions|database_release_migrations|database_release_attestations)/i,
      );
      assert.doesNotMatch(
        sql,
        /\bGRANT\s|\bDISABLE ROW LEVEL SECURITY\b|\bTRUNCATE\s+TABLE\b/i,
      );
    } else {
      assert.match(sql, /READ ONLY/);
      assert.match(sql, /ROLLBACK;\n$/);
    }
  }
  assert.doesNotMatch(
    patches["03_conditional_contract_reviews.sql"],
    /DROP\s+(?:TABLE|TRIGGER|FUNCTION)|CREATE OR REPLACE FUNCTION/i,
  );
  assert.match(patches["03_conditional_contract_reviews.sql"], /IF fresh THEN/);
  assert.match(
    patches["03_conditional_contract_reviews.sql"],
    /UNREVIEWED_NEW_REVIEW_OBJECT_DEFAULT_GRANTS/,
  );
  assert.match(
    patches["01_widen_payload_fingerprints.sql"],
    /USING payload_fingerprint::text/,
  );
  assert.doesNotMatch(
    patches["02_optional_requests_view_catalog.sql"],
    /setval\(/,
  );
  assert.match(
    patches["02_optional_requests_view_catalog.sql"],
    /PERMISSION_SEQUENCE_BEHIND/,
  );
  assert.throws(
    () => generator.patches({ ...r, reportSha256: "0".repeat(64) }),
    /REGENERATE_CURRENT/,
  );
});
