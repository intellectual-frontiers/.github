/**
 * ISLM's deep comparison (commons 0009-sql-aide FR-035): everything each dialect's catalog lets ISLM read reliably, read as objects with
 * definitions, from the live database and from a shadow database that the same engine made from the model. Both sides are written by
 * the same engine, so a default, a check, an index's predicate, a view's body or a routine's body that the engine rewrites is rewritten
 * the same way on both, and can be compared; a model is never compared with an engine's text directly.
 *
 * What is read, by dialect:
 *
 * - PostgreSQL: columns (type as `format_type` gives it, default, generated expression, identity), constraints (primary key, unique,
 *   check, foreign key with its actions, exclusion, each as `pg_get_constraintdef` gives it), indexes not backing a constraint (as
 *   `pg_get_indexdef` gives it: columns and their order, uniqueness, method, predicate, included columns, expressions), views and
 *   materialized views (their columns and types, and `pg_get_viewdef`'s text), routines (identity arguments, result, kind, language,
 *   volatility and an MD5 of the body), triggers (`pg_get_triggerdef`), sequences (type, start, increment, bounds, cycle), enumerated
 *   types (their labels in order), domains (base type, not null, default, constraints), row-level security (on, forced), policies
 *   (command, permissive, roles, `USING` and `WITH CHECK` as the engine gives them back), partitioned tables (`pg_get_partkeydef`) and
 *   partitions (parent and bounds), comments on tables, views, columns and routines, extensions and schemas. Objects an extension owns
 *   are left out, and so are the library's own (`ifcsql_` names).
 * - DuckDB: columns (type, default or generation expression, as `duckdb_columns` gives them), constraints (primary key, unique, check,
 *   foreign key, as `duckdb_constraints` writes them), indexes (their SQL as DuckDB keeps it), views (columns and SQL), macros (their
 *   definition and parameters), sequences, enumerated types (labels), comments on tables, views and columns, and schemas.
 * - SQLite: columns (declared type, default as written, generated expression read from the table's SQL), the primary key (columns in
 *   order), unique constraints (columns), foreign keys (columns, table and columns referenced, actions), checks (read from the table's
 *   SQL), indexes made by `CREATE INDEX` (their SQL), views (columns and SQL) and triggers (their SQL).
 *
 * What is not compared, and why: the order of columns (adding a column puts it last in every engine); grants, owners and roles;
 * statistics, storage options and tablespaces; the current value of a sequence; data. DuckDB's catalog does not say a foreign key's
 * actions, and does not keep a routine other than a macro; SQLite keeps no comments, and its catalog writes a check only in the table's
 * SQL. Where a dialect cannot change a difference in place (a column's type, which may lose data; a constraint of DuckDB or SQLite, which
 * needs the table made again), the plan says so and asks for a step written by hand.
 *
 * @module
 */
import type { Dialect, EmitContext } from "../emit/context.ts";
import type { Runner } from "../test/assert.ts";

/** The kinds of object the deep comparison reads. */
export type ObjectKind =
  | "column"
  | "constraint"
  | "index"
  | "view"
  | "routine"
  | "trigger"
  | "sequence"
  | "enum"
  | "domain"
  | "rls"
  | "policy"
  | "partitioned"
  | "partition"
  | "comment"
  | "extension"
  | "schema";

/** An object of a catalog: its kind, its key, the table it is of where it is of one, and its definition, field by field. */
export interface CatalogObject {
  /** What it is. */
  readonly kind: ObjectKind;
  /** Its key: kind, then its qualified name, and for a constraint of a dialect that names none, its text. */
  readonly key: string;
  /** The qualified name (`schema.table`) of the table or view it is of, where it is of one. */
  readonly table?: string;
  /** Its definition, as the engine gives it back, field by field. */
  readonly def: Readonly<Record<string, string>>;
}

const s = (v: unknown): string => (v === null || v === undefined ? "" : Array.isArray(v) ? v.map(s).join(",") : String(v));
const lib = (name: string): boolean => name.startsWith("ifcsql_") || name.endsWith("_landing") || name.startsWith("sqlite_");

/** The text inside the parentheses that open at `at`, and where it ends; quotes and nested parentheses are kept. */
function balanced(text: string, at: number): { readonly inner: string; readonly end: number } | undefined {
  let depth = 0;
  let quote: string | undefined;
  for (let i = at; i < text.length; i++) {
    const ch = text[i] ?? "";
    if (quote !== undefined) {
      if (ch === quote) quote = text[i + 1] === quote ? (i++, quote) : undefined;
      continue;
    }
    if (ch === "'" || ch === '"') quote = ch;
    else if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return { inner: text.slice(at + 1, i), end: i };
    }
  }
  return undefined;
}

/** The parts of a table's SQL between its outer parentheses, split at commas that are not inside parentheses or quotes. */
function tableParts(sqlText: string): readonly string[] {
  const open = sqlText.indexOf("(");
  const body = open < 0 ? undefined : balanced(sqlText, open);
  if (body === undefined) return [];
  const out: string[] = [];
  let depth = 0;
  let quote: string | undefined;
  let start = 0;
  const t = body.inner;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i] ?? "";
    if (quote !== undefined) {
      if (ch === quote) quote = t[i + 1] === quote ? (i++, quote) : undefined;
      continue;
    }
    if (ch === "'" || ch === '"') quote = ch;
    else if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) {
      out.push(t.slice(start, i).trim());
      start = i + 1;
    }
  }
  out.push(t.slice(start).trim());
  return out.filter((p) => p !== "");
}

/** Every `CHECK (...)` of a table's SQL, and the generation expression of each column, by its name as written. */
function sqliteTableSql(sqlText: string): { readonly checks: readonly string[]; readonly generated: ReadonlyMap<string, string> } {
  const checks: string[] = [];
  const generated = new Map<string, string>();
  for (const part of tableParts(sqlText)) {
    const upper = part.toUpperCase();
    let i = upper.indexOf("CHECK");
    while (i >= 0) {
      const open = part.indexOf("(", i);
      const b = open < 0 ? undefined : balanced(part, open);
      if (b === undefined) break;
      checks.push(b.inner.trim());
      i = upper.indexOf("CHECK", b.end);
    }
    const g = upper.indexOf("GENERATED ALWAYS AS");
    if (g >= 0 && !/^(CONSTRAINT|PRIMARY|UNIQUE|CHECK|FOREIGN)\b/i.test(part)) {
      const open = part.indexOf("(", g);
      const b = open < 0 ? undefined : balanced(part, open);
      const nameMatch = /^("(?:[^"]|"")*"|\S+)/.exec(part);
      if (b !== undefined && nameMatch !== null)
        generated.set((nameMatch[1] ?? "").replace(/^"|"$/g, "").replaceAll('""', '"'), b.inner.trim());
    }
  }
  return { checks: [...checks].sort(), generated };
}

async function sqliteObjects(runner: Runner): Promise<readonly CatalogObject[]> {
  const out: CatalogObject[] = [];
  const master = await runner.query(`SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name`);
  for (const m of master) {
    const name = s(m["name"]);
    const type = s(m["type"]);
    const sqlText = s(m["sql"]);
    const table = `main.${s(m["tbl_name"])}`;
    if (lib(name) || lib(s(m["tbl_name"]))) continue;
    if (type === "index" && sqlText !== "") out.push({ kind: "index", key: `index main.${name}`, table, def: { sql: sqlText } });
    if (type === "trigger") out.push({ kind: "trigger", key: `trigger main.${name}`, table, def: { sql: sqlText } });
    if (type === "view") {
      out.push({ kind: "view", key: `view main.${name}`, table: `main.${name}`, def: { sql: sqlText } });
      for (const c of await runner.query(`SELECT name, type FROM pragma_table_info(${q(name)})`))
        out.push({ kind: "column", key: `column main.${name}.${s(c["name"])}`, table: `main.${name}`, def: { type: s(c["type"]) } });
    }
    if (type !== "table") continue;
    const parsed = sqliteTableSql(sqlText);
    const info = await runner.query(`SELECT name, type, dflt_value, pk, hidden FROM pragma_table_xinfo(${q(name)})`);
    for (const c of info) {
      const col = s(c["name"]);
      out.push({
        kind: "column",
        key: `column ${table}.${col}`,
        table,
        def: { type: s(c["type"]), default: s(c["dflt_value"]), generated: parsed.generated.get(col) ?? "" },
      });
    }
    const pk = info
      .filter((c) => Number(c["pk"]) > 0)
      .sort((a, b) => Number(a["pk"]) - Number(b["pk"]))
      .map((c) => s(c["name"]));
    if (pk.length > 0) out.push(constraint(table, `primary key (${pk.join(", ")})`));
    for (const ch of parsed.checks) out.push(constraint(table, `check (${ch})`));
    const fks = await runner.query(
      `SELECT id, seq, "table" AS target, "from" AS f, "to" AS t, on_update, on_delete FROM pragma_foreign_key_list(${q(name)}) ORDER BY id, seq`,
    );
    const byId = new Map<string, Readonly<Record<string, unknown>>[]>();
    for (const f of fks) byId.set(s(f["id"]), [...(byId.get(s(f["id"])) ?? []), f]);
    for (const parts of byId.values()) {
      const first = parts[0];
      if (first === undefined) continue;
      out.push(
        constraint(
          table,
          `foreign key (${parts.map((p) => s(p["f"])).join(", ")}) references ${s(first["target"])} (${parts.map((p) => s(p["t"])).join(", ")}) on delete ${s(first["on_delete"]).toLowerCase()} on update ${s(first["on_update"]).toLowerCase()}`,
        ),
      );
    }
    for (const ix of await runner.query(`SELECT name, origin FROM pragma_index_list(${q(name)}) WHERE origin = 'u'`)) {
      const cols = await runner.query(`SELECT name FROM pragma_index_info(${q(s(ix["name"]))}) ORDER BY seqno`);
      out.push(constraint(table, `unique (${cols.map((c) => s(c["name"])).join(", ")})`));
    }
  }
  return out;
}

const constraint = (table: string, text: string): CatalogObject => ({
  kind: "constraint",
  key: `constraint ${table}: ${text}`,
  table,
  def: { text },
});
const q = (t: string): string => `'${t.replaceAll("'", "''")}'`;

async function duckdbObjects(runner: Runner): Promise<readonly CatalogObject[]> {
  const out: CatalogObject[] = [];
  const db = "database_name = current_database()";
  const views = new Set<string>();
  for (const v of await runner.query(
    `SELECT schema_name AS sc, view_name AS v, sql, comment FROM duckdb_views() WHERE ${db} AND NOT internal`,
  )) {
    if (lib(s(v["v"]))) continue;
    const key = `${s(v["sc"])}.${s(v["v"])}`;
    views.add(key);
    out.push({ kind: "view", key: `view ${key}`, table: key, def: { sql: s(v["sql"]) } });
    if (s(v["comment"]) !== "") out.push({ kind: "comment", key: `comment view ${key}`, table: key, def: { text: s(v["comment"]) } });
  }
  for (const t of await runner.query(`SELECT schema_name AS sc, table_name AS t, comment FROM duckdb_tables() WHERE ${db}`))
    if (!lib(s(t["t"])) && s(t["comment"]) !== "")
      out.push({
        kind: "comment",
        key: `comment table ${s(t["sc"])}.${s(t["t"])}`,
        table: `${s(t["sc"])}.${s(t["t"])}`,
        def: { text: s(t["comment"]) },
      });
  for (const c of await runner.query(
    `SELECT schema_name AS sc, table_name AS t, column_name AS c, data_type AS ty, column_default AS d, comment FROM duckdb_columns() WHERE ${db} AND NOT internal`,
  )) {
    if (lib(s(c["t"]))) continue;
    const table = `${s(c["sc"])}.${s(c["t"])}`;
    const key = `${table}.${s(c["c"])}`;
    out.push({
      kind: "column",
      key: `column ${key}`,
      table,
      def: views.has(table) ? { type: s(c["ty"]) } : { type: s(c["ty"]), default: s(c["d"]) },
    });
    if (s(c["comment"]) !== "") out.push({ kind: "comment", key: `comment column ${key}`, table, def: { text: s(c["comment"]) } });
  }
  for (const k of await runner.query(
    `SELECT schema_name AS sc, table_name AS t, constraint_text AS x FROM duckdb_constraints() WHERE ${db} AND constraint_type <> 'NOT NULL'`,
  ))
    if (!lib(s(k["t"]))) out.push(constraint(`${s(k["sc"])}.${s(k["t"])}`, s(k["x"])));
  for (const i of await runner.query(`SELECT schema_name AS sc, table_name AS t, index_name AS i, sql FROM duckdb_indexes() WHERE ${db}`))
    if (!lib(s(i["t"])) && !lib(s(i["i"])))
      out.push({ kind: "index", key: `index ${s(i["sc"])}.${s(i["i"])}`, table: `${s(i["sc"])}.${s(i["t"])}`, def: { sql: s(i["sql"]) } });
  for (const f of await runner.query(
    `SELECT schema_name AS sc, function_name AS f, function_type AS ty, macro_definition AS m, parameters AS p FROM duckdb_functions() WHERE ${db} AND NOT internal AND function_type IN ('macro', 'table_macro')`,
  ))
    if (!lib(s(f["f"])))
      out.push({ kind: "routine", key: `routine ${s(f["sc"])}.${s(f["f"])}`, def: { kind: s(f["ty"]), body: s(f["m"]), args: s(f["p"]) } });
  for (const q0 of await runner.query(
    `SELECT schema_name AS sc, sequence_name AS n, start_value AS st, increment_by AS inc, min_value AS mi, max_value AS ma, cycle AS cy FROM duckdb_sequences() WHERE ${db}`,
  ))
    if (!lib(s(q0["n"])))
      out.push({
        kind: "sequence",
        key: `sequence ${s(q0["sc"])}.${s(q0["n"])}`,
        def: { start: s(q0["st"]), increment: s(q0["inc"]), min: s(q0["mi"]), max: s(q0["ma"]), cycle: s(q0["cy"]) },
      });
  for (const t of await runner.query(
    `SELECT schema_name AS sc, type_name AS n, labels FROM duckdb_types() WHERE ${db} AND NOT internal AND logical_type = 'ENUM'`,
  ))
    out.push({ kind: "enum", key: `enum ${s(t["sc"])}.${s(t["n"])}`, def: { labels: s(t["labels"]) } });
  for (const sc of await runner.query(`SELECT schema_name AS sc FROM duckdb_schemas() WHERE ${db} AND NOT internal`))
    out.push({ kind: "schema", key: `schema ${s(sc["sc"])}`, def: {} });
  return out;
}

async function postgresObjects(runner: Runner): Promise<readonly CatalogObject[]> {
  const out: CatalogObject[] = [];
  const user = (alias: string): string =>
    `${alias}.nspname NOT IN ('pg_catalog', 'information_schema') AND ${alias}.nspname NOT LIKE 'pg_toast%' AND ${alias}.nspname NOT LIKE 'pg_temp%'`;
  const own = (oid: string): string => `NOT EXISTS (SELECT 1 FROM pg_depend dep WHERE dep.objid = ${oid} AND dep.deptype = 'e')`;
  for (const r of await runner.query(
    `SELECT n.nspname AS sc, c.relname AS t, c.relkind AS k, a.attname AS c, format_type(a.atttypid, a.atttypmod) AS ty, pg_get_expr(d.adbin, d.adrelid) AS d, a.attidentity AS id, a.attgenerated AS g
       FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
       LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attnum > 0 AND NOT a.attisdropped AND c.relkind IN ('r', 'p', 'v', 'm') AND ${user("n")} AND ${own("c.oid")}`,
  )) {
    if (lib(s(r["t"]))) continue;
    const table = `${s(r["sc"])}.${s(r["t"])}`;
    const generated = s(r["g"]) !== "";
    const def: Record<string, string> =
      s(r["k"]) === "v" || s(r["k"]) === "m"
        ? { type: s(r["ty"]) }
        : { type: s(r["ty"]), default: generated ? "" : s(r["d"]), generated: generated ? s(r["d"]) : "", identity: s(r["id"]) };
    out.push({ kind: "column", key: `column ${table}.${s(r["c"])}`, table, def });
  }
  for (const r of await runner.query(
    `SELECT n.nspname AS sc, c.relname AS t, k.conname AS n, pg_get_constraintdef(k.oid) AS x
       FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE k.contype IN ('p', 'u', 'c', 'f', 'x') AND ${user("n")} AND ${own("c.oid")}`,
  ))
    if (!lib(s(r["t"])))
      out.push({
        kind: "constraint",
        key: `constraint ${s(r["sc"])}.${s(r["t"])}.${s(r["n"])}`,
        table: `${s(r["sc"])}.${s(r["t"])}`,
        def: { text: s(r["x"]) },
      });
  for (const r of await runner.query(
    `SELECT n.nspname AS sc, t.relname AS t, i.relname AS i, pg_get_indexdef(i.oid) AS x
       FROM pg_index x JOIN pg_class i ON i.oid = x.indexrelid JOIN pg_class t ON t.oid = x.indrelid JOIN pg_namespace n ON n.oid = i.relnamespace
      WHERE NOT EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conindid = x.indexrelid) AND ${user("n")} AND ${own("t.oid")}`,
  ))
    if (!lib(s(r["t"])) && !lib(s(r["i"])))
      out.push({ kind: "index", key: `index ${s(r["sc"])}.${s(r["i"])}`, table: `${s(r["sc"])}.${s(r["t"])}`, def: { sql: s(r["x"]) } });
  for (const r of await runner.query(
    `SELECT n.nspname AS sc, c.relname AS v, c.relkind AS k, pg_get_viewdef(c.oid) AS x FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind IN ('v', 'm') AND ${user("n")} AND ${own("c.oid")}`,
  ))
    if (!lib(s(r["v"])))
      out.push({
        kind: "view",
        key: `view ${s(r["sc"])}.${s(r["v"])}`,
        table: `${s(r["sc"])}.${s(r["v"])}`,
        def: { materialized: s(r["k"]) === "m" ? "yes" : "no", sql: s(r["x"]) },
      });
  for (const r of await runner.query(
    `SELECT n.nspname AS sc, p.proname AS f, pg_get_function_identity_arguments(p.oid) AS a, pg_get_function_result(p.oid) AS r, p.prokind AS k, l.lanname AS l, p.provolatile AS v, md5(p.prosrc) AS b
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace JOIN pg_language l ON l.oid = p.prolang WHERE ${user("n")} AND ${own("p.oid")}`,
  ))
    if (!lib(s(r["f"])))
      out.push({
        kind: "routine",
        key: `routine ${s(r["sc"])}.${s(r["f"])}(${s(r["a"])})`,
        def: { result: s(r["r"]), kind: s(r["k"]), language: s(r["l"]), volatility: s(r["v"]), body: s(r["b"]) },
      });
  for (const r of await runner.query(
    `SELECT n.nspname AS sc, c.relname AS t, g.tgname AS n, pg_get_triggerdef(g.oid) AS x FROM pg_trigger g JOIN pg_class c ON c.oid = g.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE NOT g.tgisinternal AND ${user("n")}`,
  ))
    if (!lib(s(r["t"])) && !lib(s(r["n"])))
      out.push({
        kind: "trigger",
        key: `trigger ${s(r["sc"])}.${s(r["t"])}.${s(r["n"])}`,
        table: `${s(r["sc"])}.${s(r["t"])}`,
        def: { sql: s(r["x"]) },
      });
  for (const r of await runner.query(
    `SELECT schemaname AS sc, sequencename AS n, data_type AS ty, start_value AS st, increment_by AS i, min_value AS mi, max_value AS ma, cycle AS cy FROM pg_sequences WHERE schemaname NOT IN ('pg_catalog', 'information_schema')`,
  ))
    if (!lib(s(r["n"])))
      out.push({
        kind: "sequence",
        key: `sequence ${s(r["sc"])}.${s(r["n"])}`,
        def: { type: s(r["ty"]), start: s(r["st"]), increment: s(r["i"]), min: s(r["mi"]), max: s(r["ma"]), cycle: s(r["cy"]) },
      });
  for (const r of await runner.query(
    `SELECT n.nspname AS sc, t.typname AS n, string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder) AS l FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid JOIN pg_namespace n ON n.oid = t.typnamespace WHERE ${user("n")} AND ${own("t.oid")} GROUP BY 1, 2`,
  ))
    out.push({ kind: "enum", key: `enum ${s(r["sc"])}.${s(r["n"])}`, def: { labels: s(r["l"]) } });
  for (const r of await runner.query(
    `SELECT n.nspname AS sc, t.typname AS n, format_type(t.typbasetype, t.typtypmod) AS b, t.typnotnull AS nn, t.typdefault AS d,
            (SELECT string_agg(pg_get_constraintdef(k.oid), ' AND ' ORDER BY k.conname) FROM pg_constraint k WHERE k.contypid = t.oid) AS c
       FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typtype = 'd' AND ${user("n")} AND ${own("t.oid")}`,
  ))
    out.push({
      kind: "domain",
      key: `domain ${s(r["sc"])}.${s(r["n"])}`,
      def: { base: s(r["b"]), notNull: s(r["nn"]), default: s(r["d"]), checks: s(r["c"]) },
    });
  for (const r of await runner.query(
    `SELECT n.nspname AS sc, c.relname AS t, c.relforcerowsecurity AS f FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relrowsecurity AND ${user("n")}`,
  ))
    out.push({ kind: "rls", key: `rls ${s(r["sc"])}.${s(r["t"])}`, table: `${s(r["sc"])}.${s(r["t"])}`, def: { forced: s(r["f"]) } });
  for (const r of await runner.query(
    `SELECT schemaname AS sc, tablename AS t, policyname AS n, permissive AS p, array_to_string(roles, ',') AS r, cmd AS c, qual AS u, with_check AS w FROM pg_policies`,
  ))
    out.push({
      kind: "policy",
      key: `policy ${s(r["sc"])}.${s(r["t"])}.${s(r["n"])}`,
      table: `${s(r["sc"])}.${s(r["t"])}`,
      def: { permissive: s(r["p"]), roles: s(r["r"]), command: s(r["c"]), using: s(r["u"]), check: s(r["w"]) },
    });
  for (const r of await runner.query(
    `SELECT n.nspname AS sc, c.relname AS t, pg_get_partkeydef(c.oid) AS k FROM pg_partitioned_table p JOIN pg_class c ON c.oid = p.partrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE ${user("n")}`,
  ))
    out.push({
      kind: "partitioned",
      key: `partitioned ${s(r["sc"])}.${s(r["t"])}`,
      table: `${s(r["sc"])}.${s(r["t"])}`,
      def: { key: s(r["k"]) },
    });
  for (const r of await runner.query(
    `SELECT n.nspname AS sc, c.relname AS t, pc.relname AS p, pg_get_expr(c.relpartbound, c.oid) AS b FROM pg_inherits i JOIN pg_class c ON c.oid = i.inhrelid JOIN pg_class pc ON pc.oid = i.inhparent JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relispartition AND ${user("n")}`,
  ))
    out.push({
      kind: "partition",
      key: `partition ${s(r["sc"])}.${s(r["t"])}`,
      table: `${s(r["sc"])}.${s(r["t"])}`,
      def: { parent: s(r["p"]), bounds: s(r["b"]) },
    });
  for (const r of await runner.query(
    `SELECT n.nspname AS sc, c.relname AS t, d.objsubid AS a, at.attname AS c, d.description AS x
       FROM pg_description d JOIN pg_class c ON c.oid = d.objoid AND d.classoid = 'pg_class'::regclass JOIN pg_namespace n ON n.oid = c.relnamespace
       LEFT JOIN pg_attribute at ON at.attrelid = c.oid AND at.attnum = d.objsubid WHERE ${user("n")} AND ${own("c.oid")}`,
  )) {
    if (lib(s(r["t"]))) continue;
    const table = `${s(r["sc"])}.${s(r["t"])}`;
    out.push(
      Number(r["a"]) === 0
        ? { kind: "comment", key: `comment table ${table}`, table, def: { text: s(r["x"]) } }
        : { kind: "comment", key: `comment column ${table}.${s(r["c"])}`, table, def: { text: s(r["x"]) } },
    );
  }
  for (const r of await runner.query(
    `SELECT n.nspname AS sc, p.proname AS f, pg_get_function_identity_arguments(p.oid) AS a, d.description AS x FROM pg_description d JOIN pg_proc p ON p.oid = d.objoid AND d.classoid = 'pg_proc'::regclass JOIN pg_namespace n ON n.oid = p.pronamespace WHERE ${user("n")} AND ${own("p.oid")}`,
  ))
    if (!lib(s(r["f"])))
      out.push({ kind: "comment", key: `comment routine ${s(r["sc"])}.${s(r["f"])}(${s(r["a"])})`, def: { text: s(r["x"]) } });
  for (const r of await runner.query(`SELECT extname AS n FROM pg_extension WHERE extname <> 'plpgsql'`))
    out.push({ kind: "extension", key: `extension ${s(r["n"])}`, def: {} });
  for (const r of await runner.query(`SELECT nspname AS n FROM pg_namespace n WHERE ${user("n")} AND ${own("n.oid")}`))
    out.push({ kind: "schema", key: `schema ${s(r["n"])}`, def: {} });
  return out;
}

/**
 * Reads every object of a database's catalog the deep comparison compares, for its dialect.
 *
 * @param runner - what runs a query in the database
 * @param ctx - the context of its dialect
 */
export async function readObjects(runner: Runner, ctx: EmitContext<Dialect>): Promise<ReadonlyMap<string, CatalogObject>> {
  const list =
    ctx.dialect.name === "sqlite"
      ? await sqliteObjects(runner)
      : ctx.dialect.name === "duckdb"
        ? await duckdbObjects(runner)
        : await postgresObjects(runner);
  return new Map(list.map((o) => [o.key, o]));
}

/** The fields of two definitions that differ, each `field: live → model`. */
export function differences(live: CatalogObject, wanted: CatalogObject): readonly string[] {
  const fields = [...new Set([...Object.keys(live.def), ...Object.keys(wanted.def)])].sort();
  return fields
    .filter((f) => (live.def[f] ?? "") !== (wanted.def[f] ?? ""))
    .map((f) => `${f}: ${JSON.stringify(live.def[f] ?? "")} → ${JSON.stringify(wanted.def[f] ?? "")}`);
}
