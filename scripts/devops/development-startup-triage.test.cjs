"use strict";
// Offline reproductions of current verifier behavior, not database acceptance.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const catalog = require("../../purchase-backend/scripts/lib/databaseRelease/catalog");
const {
  loadProfile,
} = require("../../purchase-backend/scripts/lib/databaseRelease/profiles");
const contract = require("../../purchase-backend/database/releases/schema-contract.json");
const report = require("../../docs/database/development-20261124/reconciliation.json");
const confirmed = require("../../docs/database/development-20261124/confirmed-column-plan.json");
const evidence = require("../../docs/database/development-20261124/evidence/required-objects-operator.json");
const crypto = require("node:crypto");
const evidenceDir = path.resolve(
  __dirname,
  "../../docs/database/development-20261124",
);

test("operator results supersede incomplete snapshots without claiming project or runtime identity", () => {
  assert.equal(evidence.missing_relations.length, 2);
  assert.equal(evidence.missing_columns_on_present_relations.length, 38);
  assert.equal(evidence.project_identity_verified_by_sql, false);
  assert.equal(evidence.actor, "postgres");
  assert.equal(evidence.server_version, "17.6");
  assert.equal(
    confirmed.source_evidence_sha256,
    crypto
      .createHash("sha256")
      .update(
        fs.readFileSync(
          path.join(evidenceDir, "evidence/required-objects-operator.json"),
        ),
      )
      .digest("hex"),
  );
  assert.equal(confirmed.nullable_candidates.length, 29);
  assert.equal(confirmed.blocked_for_semantic_or_historical_review.length, 9);
  for (const item of confirmed.columns) {
    assert(
      evidence.missing_columns_on_present_relations.some(
        (r) => r.relation === item.relation && r.name === item.name,
      ),
    );
    assert.deepEqual(
      item,
      contract.catalog.columns.find(
        (r) => r.relation === item.relation && r.name === item.name,
      ),
    );
  }
});

test("partial nullable patch cannot fabricate historical amounts, scopes, timestamps or permissions", () => {
  const sql = fs.readFileSync(
    path.join(evidenceDir, "confirmed-nullable-columns.sql"),
    "utf8",
  );
  assert.match(sql, /SET LOCAL wici\.review\.approval='REVIEW_REQUIRED'/);
  assert.match(sql, /pg_try_advisory_xact_lock/);
  assert.match(sql, new RegExp(confirmed.source_evidence_sha256));
  for (const row of confirmed.nullable_candidates) {
    assert.equal(row.not_null, false);
    const addition = `ALTER TABLE public.${row.relation} ADD COLUMN ${row.name} ${row.type};`;
    assert(sql.includes(addition));
    if (row.default_expression !== null) {
      assert(
        sql.indexOf(addition) <
          sql.indexOf(
            `ALTER TABLE public.${row.relation} ALTER COLUMN ${row.name} SET DEFAULT`,
          ),
      );
    }
  }
  assert.doesNotMatch(
    sql,
    /\b(?:UPDATE|INSERT INTO|DELETE FROM|GRANT|CREATE ROLE|DISABLE ROW LEVEL SECURITY)\b/,
  );
  for (const row of confirmed.blocked_for_semantic_or_historical_review) {
    assert(
      !sql.includes(
        `ALTER TABLE public.${row.relation} ADD COLUMN ${row.name} `,
      ),
    );
  }
});

test("maintenance candidate remains empty-only, refuses existing resources and never invents stock or grants", () => {
  const sql = fs.readFileSync(
    path.join(evidenceDir, "confirmed-maintenance-foundation.sql"),
    "utf8",
  );
  assert.match(sql, /SET LOCAL wici\.review\.approval='REVIEW_REQUIRED'/);
  assert.match(sql, /MAINTENANCE_OBJECT_ALREADY_EXISTS_REVIEW_CURRENT_CATALOG/);
  assert.match(sql, /UNREVIEWED_MAINTENANCE_DEFAULT_GRANTS/);
  assert.match(sql, /UNEXPECTED_MAINTENANCE_ROWS/);
  assert.doesNotMatch(
    sql.replace(/^\s*--.*$/gm, ""),
    /\b(?:INSERT INTO|UPDATE|DELETE FROM|GRANT|DISABLE ROW LEVEL SECURITY)\b/,
  );
});

test("canonical verifier rejects the observed demand policy even though it matches merged application defaults", () => {
  const conflict = report.ui.releaseContractConflicts.find(
    (r) => r.resource_key === "feature.demandPlanning",
  );
  assert(conflict);
  assert.deepEqual(
    conflict.observed.permissions,
    conflict.mergedCodeDefault.permissions,
  );
  assert.deepEqual(
    catalog.compare(
      { ui_resources: [conflict.releaseExpectation] },
      { ui_resources: [conflict.observed] },
    ),
    [
      {
        group: "ui_resources",
        object: "feature.demandPlanning",
        reason: "contract_drift",
        fields: ["permissions"],
      },
    ],
  );
});

test("existing hosted profiles preserve the stronger demand policy but do not establish Development compatibility", () => {
  const observed = report.ui.releaseContractConflicts[0].observed;
  for (const stage of ["observed", "target"]) {
    const profile = loadProfile("wici-2026-11", stage);
    const row = profile.catalog.ui_resources.find(
      (r) => r.resource_key === observed.resource_key,
    );
    assert.deepEqual(
      catalog.compare({ ui_resources: [row] }, { ui_resources: [observed] }),
      [],
    );
    assert.notEqual(profile.version, contract.version);
  }
});

test("semantically equivalent PostgreSQL type spellings are strictly reported as drift, not silently normalized", () => {
  for (const [left, right] of [
    ["integer", "int4"],
    ["timestamp with time zone", "timestamptz"],
  ]) {
    assert.equal(
      catalog.compare(
        { columns: [{ relation: "example", name: "value", type: left }] },
        { columns: [{ relation: "example", name: "value", type: right }] },
      ).length,
      1,
    );
  }
  // This proves comparator behavior, not that format_type emitted aliases in Development.
});

test("redundant CHECK parentheses are strictly reported, while validity differences remain real blockers", () => {
  const row = {
    relation: "example",
    name: "quantity_positive",
    validated: true,
    definition: "CHECK (quantity > 0)",
  };
  assert.equal(
    catalog.compare(
      { constraints: [row] },
      { constraints: [{ ...row, definition: "CHECK ((quantity > 0))" }] },
    ).length,
    1,
  );
  assert.equal(
    catalog.compare(
      { constraints: [row] },
      { constraints: [{ ...row, validated: false }] },
    ).length,
    1,
  );
});

test("security and numeric precision changes must not be dismissed as formatting", () => {
  for (const [expected, actual] of [
    [
      { relations: [{ name: "example", rls: true }] },
      { relations: [{ name: "example", rls: false }] },
    ],
    [
      {
        columns: [
          { relation: "example", name: "amount", type: "numeric(14,2)" },
        ],
      },
      {
        columns: [
          { relation: "example", name: "amount", type: "numeric(14,3)" },
        ],
      },
    ],
    [
      { functions: [] },
      {
        functions: [
          { name: "unreviewed", arguments: "", security_definer: true },
        ],
      },
    ],
  ])
    assert.equal(catalog.compare(expected, actual).length, 1);
});

test("canonical function requirements include public-snapshot extension names; a public-only collector cannot observe other schemas", () => {
  for (const name of ["cash_dist", "gbt_bit_compress"])
    assert(contract.catalog.functions.some((r) => r.name === name));
  assert.match(catalog.queries.functions, /n\.nspname='public'/);
  assert.match(catalog.queries.browser_function_grants, /n\.nspname='public'/);
  // Do not treat an extensions-schema routine as the public routine with the same name.
  assert.equal(
    catalog.compare(
      {
        functions: contract.catalog.functions.filter(
          (r) => r.name === "cash_dist",
        ),
      },
      { functions: [] },
    )[0].reason,
    "missing",
  );
});

test("stale exported version constant is distinct from the version actually used by verification and attestation", () => {
  const source = fs.readFileSync(
    path.resolve(
      __dirname,
      "../../purchase-backend/services/databaseReleaseService.js",
    ),
    "utf8",
  );
  assert.match(source, /const CONTRACT_VERSION = "hospital-erp-2026-11-7c"/);
  assert.equal(contract.version, "hospital-erp-2026-11-scop1");
  assert.match(source, /required_contract: contract\.version/);
  assert.match(source, /contract\.version,\s*contractDigest,/);
});
