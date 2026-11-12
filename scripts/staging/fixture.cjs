"use strict";
// Synthetic empty database builder, not an installation/upgrade path. Reuses the
// snapshot normalization and sequence exercised by testBackendContractRefresh.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
async function bootstrap(db, backend, url, releaseRef, password) {
  require(
    path.join(backend, "integration/disposableDatabase"),
  ).disposableDatabaseUrl(url);
  const read = (p) => fs.readFileSync(path.join(backend, p), "utf8");
  assert.equal(
    Number(
      (
        await db.query(
          "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'",
        )
      ).rows[0].count,
    ),
    0,
    "EMPTY_SYNTHETIC_DATABASE_REQUIRED",
  );
  await db.query(
    "CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;",
  );
  const context = read("sql/View_Supabase_SQL.sql");
  const bodies = [
    ...context.matchAll(/CREATE TABLE public\.(\w+) \(([\s\S]*?)\n\);/g),
  ];
  assert.equal(bodies.length, 100);
  for (const m of context.matchAll(/nextval\('([^']+)'/g))
    await db.query(`CREATE SEQUENCE IF NOT EXISTS ${m[1]}`);
  for (const [, table, body] of bodies) {
    const normalized = body
      .replace(/\bARRAY(?=\s+NOT NULL)/g, "text[]")
      .replace(/ NOT VALI\)/g, "")
      .replace(/DEFAULT uom_name\b/g, "")
      .replace(
        /,\s*CONSTRAINT\s+\w+\s+FOREIGN KEY\s*\([^)]*\)\s+REFERENCES\s+public\.\w+\s*\([^)]*\)/gi,
        "",
      );
    await db.query(`CREATE TABLE public.${table} (${normalized})`);
    const seq = body.match(
      /\bid\s+[^\n]*DEFAULT nextval\('(?:public\.)?([a-z_][a-z0-9_]*)'::regclass\)/i,
    );
    if (seq && seq[1] === `${table}_id_seq`)
      await db.query(
        `ALTER SEQUENCE public.${seq[1]} OWNED BY public.${table}.id`,
      );
  }
  await db.query(read("sql/permissions_Table.sql"));
  await db.query(
    read("sql/UI_resource_permissions.sql").replace(
      /ARRAY\[\]/g,
      "ARRAY[]::text[]",
    ),
  );
  const sequence = [
    "059_backend_contract_refresh",
    "067_canonical_procurement_completion",
    "068_goods_receipt_acceptance_integration",
    "060_permission_catalog_refresh",
    "064_contract_authorization_scope",
    "065_canonical_contract_finance",
    "061_ui_resource_catalog_refresh",
    "066_contract_financial_reconciliation",
    "069_database_release_governance",
  ];
  for (const name of sequence) await db.query(read(`sql/manual/${name}.sql`));
  const prerequisite = require(
    path.join(backend, "integration/databaseReleasePrerequisite"),
  );
  await prerequisite(db, url);
  for (const name of [
    "070_rfid_processing_recovery",
    "071_transactional_event_reliability",
  ]) {
    await db.query(read(`sql/manual/${name}.sql`));
    await prerequisite(db, url, name.slice(0, 3));
  }
  await db.query(
    require(path.join(backend, "scripts/lib/databaseRelease/planner")).bundle({
      inventory: require(
        path.join(backend, "services/databaseReleaseService"),
      ).loadInventory(),
      contract: require(
        path.join(backend, "services/databaseReleaseService"),
      ).loadContract(),
      environment: "disposable",
      actor: "synthetic-staging-rehearsal",
      releaseRef,
    }),
  );
  // A fresh random runtime login. No ownership, DDL or governance-ledger writes.
  assert.match(password, /^[a-f0-9]{48}$/);
  await db.query(`ALTER ROLE purchase_backend LOGIN PASSWORD '${password}'`);
  await db.query(
    "REVOKE CREATE ON DATABASE " +
      '"' +
      new URL(url).pathname.slice(1) +
      '"' +
      " FROM PUBLIC",
  );
  return sequence;
}
module.exports = { bootstrap };
