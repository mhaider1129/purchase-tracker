#!/usr/bin/env node
"use strict";
// OFFLINE: parse source/evidence only. Never import app/config/db, pg or dotenv.
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const root = path.resolve(__dirname, "../..");
const backend = path.join(root, "purchase-backend");
const {
  splitStatements,
} = require("../../purchase-backend/scripts/lib/databaseRelease/sqlStatements");
const hash = (b) => crypto.createHash("sha256").update(b).digest("hex");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
function splitTop(text, delimiter = ",") {
  const out = [];
  let start = 0,
    round = 0,
    square = 0,
    quote = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === quote) {
        if (text[i + 1] === quote) i++;
        else quote = null;
      }
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      continue;
    }
    if (c === "(") round++;
    if (c === ")") round--;
    if (c === "[") square++;
    if (c === "]") square--;
    if (round < 0 || square < 0) throw Error("INVALID_SQL_NESTING");
    if (c === delimiter && !round && !square) {
      out.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  if (quote || round || square) throw Error("UNBALANCED_SQL_EXPRESSION");
  out.push(text.slice(start).trim());
  return out;
}
function sqlValue(text) {
  text = text.trim().replace(/::text\[\]$/i, "");
  if (/^NULL$/i.test(text)) return null;
  if (/^(true|false)$/i.test(text)) return text.toLowerCase() === "true";
  if (/^-?\d+$/.test(text)) return Number(text);
  if (text === "'{}'") return "{}";
  if (/^ARRAY\[/i.test(text) && text.endsWith("]"))
    return text.slice(6, -1).trim()
      ? splitTop(text.slice(6, -1)).map(sqlValue)
      : [];
  if (/^'(?:[^']|'')*'$/.test(text))
    return text.slice(1, -1).replace(/''/g, "'");
  throw Error("UNSUPPORTED_EXPORT_VALUE");
}
function insertRows(sql, table) {
  const statements = splitStatements(sql);
  if (statements.length !== 1) throw Error("ONE_CATALOG_INSERT_REQUIRED");
  const m = new RegExp(
    "^\\s*INSERT INTO public\\." +
      table +
      "\\s*\\(([^)]+)\\)\\s*VALUES\\s*([\\s\\S]*?);?\\s*$",
    "i",
  ).exec(statements[0]);
  if (!m) throw Error("EXPECTED_CATALOG_EXPORT_INSERT");
  const cols = splitTop(m[1]);
  return splitTop(m[2]).map((tuple) => {
    if (!tuple.startsWith("(") || !tuple.endsWith(")"))
      throw Error("INVALID_EXPORT_TUPLE");
    const values = splitTop(tuple.slice(1, -1)).map(sqlValue);
    if (values.length !== cols.length) throw Error("EXPORT_COLUMN_VALUE_ARITY");
    return Object.fromEntries(
      cols.map((c, i) => [
        c.trim(),
        table === "ui_resource_permissions" &&
        c.trim() === "permissions" &&
        values[i] === "{}"
          ? []
          : values[i],
      ]),
    );
  });
}
function normalizeType(type) {
  return type
    .toLowerCase()
    .replace(/\bcharacter varying\b/g, "varchar")
    .replace(/\bboolean\b/g, "bool")
    .replace(/\bint4\b/g, "integer")
    .replace(/\s+/g, " ")
    .trim();
}
function schemaTables(sql) {
  const tables = Object.create(null),
    anomalies = [];
  for (const m of sql.matchAll(
    /CREATE TABLE public\.(\w+)\s*\(([\s\S]*?)\n\);/g,
  )) {
    if (tables[m[1]]) throw Error("DUPLICATE_EXPORTED_TABLE");
    const columns = Object.create(null),
      constraints = [];
    let fields,
      parseConfidence = "STRUCTURAL_PARSE";
    try {
      fields = splitTop(m[2]);
    } catch (e) {
      parseConfidence = "CONTEXT_LINE_FALLBACK_UNVERIFIED";
      anomalies.push({ table: m[1], reason: e.message, rawDefinition: m[2] });
      fields = m[2]
        .split(/\n/)
        .map((s) => s.trim().replace(/,$/, ""))
        .filter(Boolean);
    }
    for (const field of fields) {
      const constraint = /^CONSTRAINT\s+(\w+)\s+([\s\S]*)$/i.exec(field);
      if (constraint) {
        constraints.push({ name: constraint[1], definition: constraint[2] });
        continue;
      }
      const c = /^(\w+)\s+([\s\S]*)$/.exec(field);
      if (!c) throw Error("UNSUPPORTED_EXPORTED_FIELD");
      const type = c[2]
        .split(
          /\s+(?:NOT\s+NULL|NULL\b|DEFAULT\b|CHECK\b|REFERENCES\b|UNIQUE\b|GENERATED\b|PRIMARY\s+KEY|COLLATE\b)/i,
        )[0]
        .trim();
      columns[c[1]] = {
        name: c[1],
        type,
        not_null: /\bNOT\s+NULL\b|\bPRIMARY\s+KEY\b/i.test(c[2]),
        definition: c[2],
      };
      if (type === "ARRAY" || /DEFAULT uom_name\b|NOT VALI\)/.test(field))
        anomalies.push({
          table: m[1],
          column: c[1],
          reason: "CONTEXT_EXPORT_NOT_EXECUTABLE_OR_NOT_FULLY_TYPED",
          definition: field,
        });
    }
    for (const c of constraints) {
      const p = /^PRIMARY KEY\s*\(([^)]+)\)/i.exec(c.definition);
      if (p)
        for (const name of splitTop(p[1]))
          if (columns[name]) columns[name].not_null = true;
    }
    tables[m[1]] = { columns, constraints, parseConfidence };
  }
  if (!Object.keys(tables).length) throw Error("NO_EXPORTED_TABLE_DEFINITIONS");
  return { tables, anomalies };
}
function walk(node, visit) {
  if (!node || typeof node !== "object") return;
  visit(node);
  for (const [k, v] of Object.entries(node)) {
    if (["loc", "tokens", "comments"].includes(k)) continue;
    if (Array.isArray(v)) v.forEach((x) => walk(x, visit));
    else if (v && typeof v === "object") walk(v, visit);
  }
}
function literal(node, env = {}) {
  if (!node) throw Error("NON_LITERAL_SOURCE_REQUIREMENT");
  if (["StringLiteral", "BooleanLiteral", "NumericLiteral"].includes(node.type))
    return node.value;
  if (node.type === "NullLiteral") return null;
  if (node.type === "Identifier" && Object.hasOwn(env, node.name))
    return env[node.name];
  if (node.type === "TemplateLiteral")
    return node.quasis
      .map(
        (q, i) =>
          q.value.cooked +
          (i < node.expressions.length
            ? literal(node.expressions[i], env)
            : ""),
      )
      .join("");
  if (node.type === "ArrayExpression")
    return node.elements.flatMap((n) =>
      n.type === "SpreadElement" ? literal(n.argument, env) : [literal(n, env)],
    );
  if (node.type === "ObjectExpression")
    return Object.fromEntries(
      node.properties.map((p) => {
        if (p.type !== "ObjectProperty" || p.computed)
          throw Error("UNSUPPORTED_LITERAL_OBJECT");
        return [p.key.name || p.key.value, literal(p.value, env)];
      }),
    );
  if (
    node.type === "CallExpression" &&
    node.callee.type === "MemberExpression" &&
    node.callee.property.name === "map" &&
    node.arguments.length === 1
  ) {
    const fn = node.arguments[0];
    if (
      fn.type !== "ArrowFunctionExpression" ||
      fn.params.length !== 1 ||
      fn.params[0].type !== "Identifier"
    )
      throw Error("ONLY_LITERAL_MAP_SUPPORTED");
    return literal(node.callee.object, env).map((v) =>
      literal(fn.body, { ...env, [fn.params[0].name]: v }),
    );
  }
  throw Error("NON_LITERAL_SOURCE_REQUIREMENT:" + node.type);
}
function parser() {
  return require("../../purchase-backend/node_modules/@babel/parser");
}
function constant(file, name) {
  const ast = parser().parse(read(file), { sourceType: "unambiguous" });
  let value;
  walk(ast, (n) => {
    if (n.type === "VariableDeclarator" && n.id.name === name)
      value = literal(n.init);
  });
  if (value === undefined) throw Error("SOURCE_CONSTANT_NOT_FOUND:" + name);
  return value;
}
function applicationInventory() {
  const files = [],
    permissionCandidates = [],
    permissionCalls = [],
    featureReferences = [];
  for (const base of ["purchase-backend", "purchase-frontend/src"]) {
    const scan = (dir) => {
      for (const e of fs
        .readdirSync(path.join(root, dir), { withFileTypes: true })
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
        if (
          [
            "node_modules",
            "tests",
            "__tests__",
            "integration",
            "scripts",
            "sql",
            "docs",
            ".git",
            "build",
            "coverage",
          ].includes(e.name)
        )
          continue;
        const f = dir + "/" + e.name;
        if (e.isDirectory()) scan(f);
        else if (
          /\.(?:js|jsx|cjs|mjs)$/.test(f) &&
          !/(?:\.test|\.spec)\.[^.]+$/.test(f)
        ) {
          const ast = parser().parse(read(f), {
            sourceType: "unambiguous",
            plugins: ["jsx"],
          });
          const permissionFunctions = new Set();
          walk(ast, (n) => {
            if (
              n.type === "VariableDeclarator" &&
              n.id?.type === "Identifier" &&
              n.init?.type === "CallExpression" &&
              n.init.callee?.name === "require" &&
              /permission/i.test(n.init.arguments[0]?.value || "")
            )
              permissionFunctions.add(n.id.name);
          });
          files.push({ path: f, sha256: hash(read(f)) });
          walk(ast, (n) => {
            if (
              n.type === "StringLiteral" &&
              /^[a-z][a-z0-9-]*\.[a-z][a-z0-9.-]*[a-z0-9]$/.test(n.value)
            ) {
              const row = { value: n.value, source: f, line: n.loc.start.line };
              if (n.value.startsWith("feature.")) featureReferences.push(row);
              else permissionCandidates.push(row);
            }
            if (
              n.type === "CallExpression" &&
              (/permission/i.test(
                n.callee?.name || n.callee?.property?.name || "",
              ) ||
                permissionFunctions.has(n.callee?.name))
            ) {
              for (const arg of n.arguments)
                walk(arg, (a) => {
                  if (
                    a.type === "StringLiteral" &&
                    /^[a-z][a-z0-9-]*\.[a-z]/.test(a.value)
                  )
                    permissionCalls.push({
                      code: a.value,
                      source: f,
                      line: a.loc.start.line,
                    });
                });
            }
          });
        }
      }
    };
    scan(base);
  }
  return { files, permissionCandidates, permissionCalls, featureReferences };
}
function sqlReferences(rows, known) {
  const references = [],
    unresolved = [],
    unclassifiedRelations = [];
  const reserved = new Set(
    "WHERE SET JOIN LEFT RIGHT INNER OUTER FULL CROSS ON GROUP ORDER LIMIT RETURNING VALUES FOR UNION AS USING AND OR OFFSET".split(
      " ",
    ),
  );
  for (const row of rows) {
    if (!row.queryCall)
      unresolved.push({
        source: row.source.replace(/\\/g, "/"),
        line: row.line,
        reason: "NON_DIRECT_QUERY_LITERAL_REQUIRES_CONTEXT_REVIEW",
        sql: row.value,
      });
    if (row.value.includes("${"))
      unresolved.push({
        source: row.source.replace(/\\/g, "/"),
        line: row.line,
        reason: "DYNAMIC_SQL_REQUIRES_MANUAL_REVIEW",
        sql: row.value,
      });
    const aliases = new Map(),
      tables = [];
    for (const m of row.value.matchAll(
      /\b(?:FROM|JOIN|UPDATE|INTO|ALTER\s+TABLE|CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?)\s+(?:public\.)?([a-z_][a-z0-9_]*)(?:\s+(?:AS\s+)?([a-z_][a-z0-9_]*))?/gi,
    )) {
      const name = m[1];
      if (known.has(name)) {
        tables.push(name);
        aliases.set(name, name);
        if (m[2] && !reserved.has(m[2].toUpperCase())) aliases.set(m[2], name);
      } else
        unclassifiedRelations.push({
          source: row.source.replace(/\\/g, "/"),
          line: row.line,
          name,
          reason:
            "MAY_BE_CTE_ALIAS_SYSTEM_RELATION_OR_UNRESOLVED_APPLICATION_TABLE",
        });
    }
    const columns = [];
    for (const m of row.value.matchAll(/\b([a-z_]\w*)\.([a-z_]\w*)\b/gi))
      if (aliases.has(m[1]))
        columns.push({ relation: aliases.get(m[1]), column: m[2] });
    references.push({
      source: row.source.replace(/\\/g, "/"),
      line: row.line,
      tables: [...new Set(tables)],
      qualifiedColumns: columns,
    });
  }
  return { references, unresolved, unclassifiedRelations };
}
function baselineBinding(files, baseline) {
  if (!/^[a-f0-9]{40}$/.test(baseline))
    throw Error("IMMUTABLE_BASELINE_REQUIRED");
  const cp = require("node:child_process"),
    raw = cp.execFileSync(
      "git",
      [
        "ls-tree",
        "-r",
        "-z",
        baseline,
        "--",
        "purchase-backend",
        "purchase-frontend",
      ],
      { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
    );
  const blobs = new Map(
    raw
      .split("\0")
      .filter(Boolean)
      .map((row) => [
        row.slice(row.indexOf("\t") + 1),
        row.slice(0, row.indexOf("\t")).split(" ")[2],
      ]),
  );
  for (const file of [
    ...files,
    { path: "purchase-backend/database/releases/schema-contract.json" },
  ]) {
    const bytes = fs.readFileSync(path.join(root, file.path)),
      blob = crypto
        .createHash("sha1")
        .update(Buffer.from("blob " + bytes.length + "\0"))
        .update(bytes)
        .digest("hex");
    if (blobs.get(file.path) !== blob)
      throw Error("APPLICATION_DIFFERS_FROM_MERGED_BASELINE:" + file.path);
  }
  return {
    status: "MERGED_APPLICATION_BYTES_VERIFIED",
    baseline,
    filesVerified: files.length + 1,
  };
}
function build() {
  const dir = "docs/database/development-20261124",
    provenance = JSON.parse(read(dir + "/provenance.json"));
  for (const f of provenance.files)
    if (hash(read(f.observedPath)) !== f.observedSha256)
      throw Error("OBSERVED_EXPORT_DIGEST_MISMATCH");
  const contract = JSON.parse(
    read("purchase-backend/database/releases/schema-contract.json"),
  );
  const observed = schemaTables(read(dir + "/observed/View_Supabase_SQL.sql"));
  const permissions = insertRows(
    read(dir + "/observed/permissions_Table.sql"),
    "permissions",
  );
  const ui = insertRows(
    read(dir + "/observed/UI_resource_permissions.sql"),
    "ui_resource_permissions",
  );
  const inventory = applicationInventory();
  const sourceBinding = baselineBinding(
    inventory.files,
    provenance.mergedBaseline,
  );
  const extraction =
    require("../../purchase-backend/scripts/extractBackendSqlContract").extractBackendSqlContract(
      backend,
    );
  extraction.sql.sort((a, b) =>
    a.source.replace(/\\/g, "/") < b.source.replace(/\\/g, "/")
      ? -1
      : a.source.replace(/\\/g, "/") > b.source.replace(/\\/g, "/")
        ? 1
        : a.line - b.line ||
          (a.value < b.value ? -1 : a.value > b.value ? 1 : 0),
  );
  const known = new Set([
    ...contract.catalog.relations.map((r) => r.name),
    ...Object.keys(observed.tables),
  ]);
  const runtimeSQL = sqlReferences(extraction.sql, known);
  const core = constant(
    "purchase-backend/utils/permissionService.js",
    "CORE_PERMISSION_DEFINITIONS",
  );
  const resources = constant(
    "purchase-backend/utils/uiAccessService.js",
    "defaultResources",
  );
  const capabilityMatrix = constant(
    "purchase-backend/config/capabilityMatrix.js",
    "CAPABILITY_MATRIX",
  );
  const roleDefaults = constant(
    "purchase-backend/utils/permissionService.js",
    "DEFAULT_ROLE_PERMISSIONS",
  );
  const declared = new Set([
    ...contract.catalog.permissions.map((r) => r.code),
    ...core.map((r) => r.code),
  ]);
  const absentRelations = contract.catalog.relations
    .filter((r) => !observed.tables[r.name])
    .map((r) => ({
      ...r,
      status: "NOT_IN_PROVIDED_EXPORT_NOT_PROVEN_ABSENT_IN_DATABASE",
    }));
  const absentColumns = [],
    typeDrift = [],
    nullabilityDrift = [],
    defaultCoverage = [];
  for (const c of contract.catalog.columns) {
    const t = observed.tables[c.relation];
    if (!t) continue;
    const a = t.columns[c.name];
    const uses = runtimeSQL.references
      .filter((r) => r.tables.includes(c.relation))
      .map((r) => ({ source: r.source, line: r.line }));
    if (!a)
      absentColumns.push({
        ...c,
        status: "NOT_IN_PROVIDED_TABLE_DEFINITION_LIVE_CHECK_REQUIRED",
        runtimeTableReferences: uses,
      });
    else {
      defaultCoverage.push({
        relation: c.relation,
        column: c.name,
        expected: c.default_expression,
        observedDefinition: a.definition,
        status:
          c.default_expression && !/\bDEFAULT\b/i.test(a.definition)
            ? "DEFAULT_NOT_IN_EXPORT_LIVE_CHECK_REQUIRED"
            : !c.default_expression && /\bDEFAULT\b/i.test(a.definition)
              ? "EXTRA_DEFAULT_REQUIRES_REVIEW"
              : "DEFAULT_EXPRESSION_NOT_SEMANTICALLY_CERTIFIED",
      });
      if (normalizeType(a.type) !== normalizeType(c.type))
        typeDrift.push({
          relation: c.relation,
          column: c.name,
          expected: c.type,
          observed: a.type,
          status: "REVIEW_NO_AUTOMATIC_CAST",
        });
      if (a.not_null !== c.not_null)
        nullabilityDrift.push({
          relation: c.relation,
          column: c.name,
          expected: c.not_null,
          observed: a.not_null,
          status: "NO_AUTOMATIC_NULL_BACKFILL_OR_CONSTRAINT_CHANGE",
        });
    }
  }
  const absentPermissions = [...declared]
    .filter((code) => !permissions.some((r) => r.code === code))
    .sort();
  const uiDifferences = resources.flatMap((r) => {
    const a = ui.find((a) => a.resource_key === r.resourceKey);
    if (!a)
      return [
        {
          resource_key: r.resourceKey,
          status: "MISSING_FROM_PROVIDED_CATALOG",
          expected: r,
        },
      ];
    return JSON.stringify(a.permissions) !== JSON.stringify(r.permissions) ||
      a.require_all !== r.requireAll
      ? [
          {
            resource_key: r.resourceKey,
            status: "EXISTING_CUSTOMIZATION_OR_DRIFT_REQUIRES_REVIEW",
            expected: r,
            observed: a,
          },
        ]
      : [];
  });
  const releaseContractConflicts = contract.catalog.ui_resources.flatMap(
    (e) => {
      const a = ui.find((r) => r.resource_key === e.resource_key),
        code = resources.find((r) => r.resourceKey === e.resource_key);
      return !a ||
        JSON.stringify(a.permissions) !== JSON.stringify(e.permissions) ||
        a.require_all !== e.require_all
        ? [
            {
              resource_key: e.resource_key,
              releaseExpectation: e,
              observed: a || null,
              mergedCodeDefault: code || null,
              resolution:
                "REVIEW_VERSIONED_CONTRACT_ALIGNMENT_DO_NOT_WEAKEN_OBSERVED_AUTHORIZATION",
            },
          ]
        : [];
    },
  );
  const contractConstraints = contract.catalog.constraints.map((c) => ({
    relation: c.relation,
    name: c.name,
    expectedDefinition: c.definition,
    observedDefinition:
      observed.tables[c.relation]?.constraints.find((x) => x.name === c.name)
        ?.definition || null,
    status: !observed.tables[c.relation]
      ? "RELATION_NOT_EXPORTED"
      : observed.tables[c.relation].constraints.some((x) => x.name === c.name)
        ? "NAME_PRESENT_DEFINITION_AND_VALIDATION_NOT_CERTIFIED"
        : "NOT_IN_CONTEXT_EXPORT_LIVE_CHECK_REQUIRED",
  }));
  const releaseInventory = JSON.parse(
    read("purchase-backend/database/releases/migration-inventory.json"),
  );
  const governanceFindings =
    require("../../purchase-backend/scripts/lib/databaseRelease/inventory").verifyFiles(
      releaseInventory,
    );
  if (governanceFindings.length)
    throw Error("LOCKED_RELEASE_INVENTORY_CONFLICT");
  const definitionSources = [];
  for (const artifact of releaseInventory.artifacts.filter((a) =>
    a.path.startsWith("sql/manual/"),
  )) {
    const sql = read("purchase-backend/" + artifact.path);
    for (const m of sql.matchAll(
      /\b(CREATE|ALTER)\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-z_]\w*)/gi,
    ))
      if (known.has(m[2]))
        definitionSources.push({
          relation: m[2],
          operation: m[1].toUpperCase(),
          source: "purchase-backend/" + artifact.path,
          line: sql.slice(0, m.index).split("\n").length,
          classification: artifact.classification,
        });
  }
  const report = {
    kind: "offline-development-schema-reconciliation",
    version: 1,
    baseline: provenance.mergedBaseline,
    observedCommit: provenance.observedCommit,
    auditSourceSha256: hash(fs.readFileSync(__filename)),
    patchGeneratorSha256: hash(
      fs.readFileSync(path.join(__dirname, "development-schema-patches.cjs")),
    ),
    pendingPR113: "UNMERGED_PROPOSALS_NOT_APPLICATION_BASELINE",
    liveDatabaseAccess: false,
    compatibility: "NOT_CERTIFIED",
    governance: {
      lockedArtifacts: releaseInventory.artifacts.length,
      findings: governanceFindings,
      historicalHashesChanged: false,
    },
    definitionSources,
    sourceBinding,
    sourceManifest: inventory.files,
    coverage: {
      applicationFiles: inventory.files.length,
      backendSQLLiterals: extraction.sql.length,
      backendQueryCallLiterals: extraction.sql.filter((r) => r.queryCall)
        .length,
      observedTables: Object.keys(observed.tables).length,
      canonicalRelations: contract.catalog.relations.length,
      canonicalColumns: contract.catalog.columns.length,
      observedPermissionRows: permissions.length,
      observedUIRows: ui.length,
    },
    inputLimitations: [
      "Context-only table DDL does not export functions, triggers, policy definitions, RLS flags, grants, role memberships, live sequence state or execution evidence.",
      "Missing export entries do not prove missing database objects.",
      "Static SQL alias/column discovery is conservative; dynamic SQL and CTE/name resolution need independent review.",
    ],
    inputAnomalies: observed.anomalies,
    schema: {
      absentRelations,
      absentColumns,
      typeDrift,
      nullabilityDrift,
      defaultCoverage,
      constraintCoverage: contractConstraints,
    },
    permissions: {
      coreDefinitions: core,
      roleDefaults,
      requiredCodes: [...declared].sort(),
      absentPermissions,
      authorityCallsMissingCatalog: inventory.permissionCalls.filter(
        (r) => !permissions.some((p) => p.code === r.code),
      ),
      literalCandidates: inventory.permissionCandidates,
      roleAndUserAssignments: "NOT_EXPORTED_NO_GRANTS_PROPOSED",
    },
    ui: {
      defaults: resources,
      differences: uiDifferences,
      releaseContractConflicts,
      frontendFeatureReferences: inventory.featureReferences,
    },
    capabilityMatrix,
    runtimeSQL,
    unobservedControls: {
      indexes: contract.catalog.indexes.length,
      functions: contract.catalog.functions.length,
      triggers: contract.catalog.triggers.length,
      policies: "NOT_EXPORTED",
      rls: "NOT_EXPORTED",
      browserGrants: "NOT_EXPORTED",
      runtimeRoles: "NOT_EXPORTED",
      migrationReceipts: "NOT_EXPORTED",
      attestations: "NOT_EXPORTED",
    },
    safeNullableColumnCandidates: absentColumns.filter(
      (c) =>
        observed.tables[c.relation].parseConfidence === "STRUCTURAL_PARSE" &&
        !c.not_null &&
        !c.default_expression &&
        !c.identity &&
        !c.generated &&
        /^(?:integer|bigint|smallint|numeric(?:\(\d+,\d+\))?|text|bool(?:ean)?|character varying(?:\(\d+\))?|timestamp(?:\(\d+\))? (?:with|without) time zone|date|jsonb|uuid)(?:\[\])?$/.test(
          c.type,
        ),
    ),
  };
  report.reportSha256 = hash(JSON.stringify(report));
  return report;
}
if (require.main === module) {
  try {
    const report = build(),
      dest = path.join(
        root,
        "docs/database/development-20261124/reconciliation.json",
      );
    fs.writeFileSync(dest, JSON.stringify(report, null, 2) + "\n");
    console.log(
      JSON.stringify({
        status: report.compatibility,
        ...report.coverage,
        absentRelations: report.schema.absentRelations.length,
        absentColumns: report.schema.absentColumns.length,
        typeDrift: report.schema.typeDrift.length,
        missingPermissions: report.permissions.absentPermissions.length,
        uiDifferences: report.ui.differences.length,
        nullableCandidates: report.safeNullableColumnCandidates.length,
        dynamicSQL: report.runtimeSQL.unresolved.length,
      }),
    );
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
module.exports = {
  splitTop,
  sqlValue,
  insertRows,
  normalizeType,
  schemaTables,
  literal,
  sqlReferences,
  build,
};
