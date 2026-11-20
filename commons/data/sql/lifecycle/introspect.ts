// Spec: 0055-sql-introspect FR-001, FR-002, FR-003
/**
 * Reading a live database (commons data 0055-sql-introspect): what a database holds, read from its own catalog as a plain value (`Observed`): the tables, their columns with the type the engine reports, whether
 * each may be null and its default, the primary key, the unique constraints, the foreign keys and the indexes. It is read through a driver and changes nothing. `expectedOf` writes the same value from a logical
 * schema, and `drift` compares the two, so that what a database has and what a model says are told apart: a table or column that is missing or stray, a type of another family, a nullability that differs, a key,
 * a foreign key, a unique or an index that is missing.
 *
 * @module
 */
import type { LogicalSchema, LogicalType, Table } from "@intellectual-frontiers/data/sql/logical";
import { type Dialect, naming as defaultNaming, type Naming, writeNames } from "@intellectual-frontiers/data/sql/physical";
import type { Driver } from "./run.ts";

/** A column as a database holds it. */
export interface ObservedColumn {
  readonly name: string;
  /** The type as the engine says it, in lower case (`integer`, `numeric(10,2)`, `timestamp with time zone`, `vector(3)`). */
  readonly type: string;
  readonly nullable: boolean;
  readonly default?: string;
}

/** A table as a database holds it. */
export interface ObservedTable {
  readonly name: string;
  readonly columns: readonly ObservedColumn[];
  readonly primaryKey: readonly string[];
  readonly uniques: readonly { readonly columns: readonly string[] }[];
  readonly foreignKeys: readonly { readonly columns: readonly string[]; readonly references: { readonly table: string; readonly columns: readonly string[] } }[];
  readonly indexes: readonly { readonly name: string; readonly columns: readonly string[]; readonly unique: boolean }[];
}

/** What a database holds. */
export interface Observed {
  readonly dialect: string;
  readonly schema?: string;
  readonly tables: readonly ObservedTable[];
}

/** What reading is told. */
export interface IntrospectOptions {
  /** The schema to read; the connection's own (`current_schema()`, `main`) where not given. */
  readonly schema?: string;
  /** Tables to leave out (the ledger of the library's own, for one). */
  readonly exclude?: (table: string) => boolean;
}

const q = (s: string): string => `'${s.replaceAll("'", "''")}'`;
const SEP = "\u001f";
const split = (v: unknown): string[] => (v === null || v === undefined || String(v) === "" ? [] : String(v).split(SEP));
const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));
const yes = (v: unknown): boolean => v === true || v === 1 || v === "1" || v === "t" || v === "true" || v === "YES" || v === "yes";


async function sqlite(driver: Driver): Promise<readonly ObservedTable[]> {
  const names = (await driver.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")).map((r) => str(r["name"]));
  const out: ObservedTable[] = [];
  for (const t of names) {
    const cols = await driver.query(`SELECT name, type, "notnull" AS nn, dflt_value AS d, pk FROM pragma_table_info(${q(t)}) ORDER BY cid`);
    const pk = [...cols].filter((c) => Number(c["pk"]) > 0).sort((a, b) => Number(a["pk"]) - Number(b["pk"])).map((c) => str(c["name"]));
    const fks = new Map<number, { table: string; from: string[]; to: string[] }>();
    for (const f of await driver.query(`SELECT id, "table" AS ref, "from" AS f, "to" AS t FROM pragma_foreign_key_list(${q(t)}) ORDER BY id, seq`)) {
      const id = Number(f["id"]);
      const e = fks.get(id) ?? { table: str(f["ref"]), from: [], to: [] };
      e.from.push(str(f["f"]));
      e.to.push(str(f["t"]));
      fks.set(id, e);
    }
    const uniques: { columns: string[] }[] = [];
    const indexes: { name: string; columns: string[]; unique: boolean }[] = [];
    for (const ix of await driver.query(`SELECT name, "unique" AS u, origin FROM pragma_index_list(${q(t)})`)) {
      const columns = (await driver.query(`SELECT name FROM pragma_index_info(${q(str(ix["name"]))}) ORDER BY seqno`)).map((c) => str(c["name"]));
      if (str(ix["origin"]) === "u") uniques.push({ columns });
      else if (str(ix["origin"]) === "c") indexes.push({ name: str(ix["name"]), columns, unique: yes(ix["u"]) });
    }
    out.push({
      name: t,
      columns: cols.map((c) => ({ name: str(c["name"]), type: str(c["type"]).toLowerCase(), nullable: !(yes(c["nn"]) || Number(c["pk"]) > 0), ...(c["d"] === null || c["d"] === undefined ? {} : { default: str(c["d"]) }) })),
      primaryKey: pk,
      uniques,
      foreignKeys: [...fks.values()].map((f) => ({ columns: f.from, references: { table: f.table, columns: f.to } })),
      indexes,
    });
  }
  return out;
}

async function duckdb(driver: Driver, schema: string | undefined): Promise<readonly ObservedTable[]> {
  const s = schema === undefined ? "current_schema()" : q(schema);
  const names = (await driver.query(`SELECT table_name AS t FROM information_schema.tables WHERE table_schema = ${s} AND table_type = 'BASE TABLE' ORDER BY table_name`)).map((r) => str(r["t"]));
  const cons = await driver.query(
    `SELECT table_name AS t, constraint_type AS k, array_to_string(constraint_column_names, chr(31)) AS cols, referenced_table AS rt, array_to_string(referenced_column_names, chr(31)) AS rcols FROM duckdb_constraints() WHERE schema_name = ${s}`,
  );
  const idx = await driver.query(`SELECT table_name AS t, index_name AS n, is_unique AS u, expressions AS e FROM duckdb_indexes() WHERE schema_name = ${s}`);
  const out: ObservedTable[] = [];
  for (const t of names) {
    const cols = await driver.query(`SELECT column_name AS n, data_type AS type, is_nullable AS nl, column_default AS d FROM information_schema.columns WHERE table_schema = ${s} AND table_name = ${q(t)} ORDER BY ordinal_position`);
    const mine = cons.filter((c) => str(c["t"]) === t);
    const pk = mine.find((c) => str(c["k"]) === "PRIMARY KEY");
    out.push({
      name: t,
      columns: cols.map((c) => ({ name: str(c["n"]), type: str(c["type"]).toLowerCase(), nullable: yes(c["nl"]), ...(c["d"] === null || c["d"] === undefined ? {} : { default: str(c["d"]) }) })),
      primaryKey: pk === undefined ? [] : split(pk["cols"]),
      uniques: mine.filter((c) => str(c["k"]) === "UNIQUE").map((c) => ({ columns: split(c["cols"]) })),
      foreignKeys: mine.filter((c) => str(c["k"]) === "FOREIGN KEY").map((c) => ({ columns: split(c["cols"]), references: { table: str(c["rt"]), columns: split(c["rcols"]) } })),
      indexes: idx
        .filter((i) => str(i["t"]) === t)
        .map((i) => ({ name: str(i["n"]), columns: str(i["e"]).replace(/^\[|\]$/g, "").split(",").map((x) => x.trim().replace(/^['"]|['"]$/g, "")).filter((x) => x !== ""), unique: yes(i["u"]) })),
    });
  }
  return out;
}

async function postgres(driver: Driver, schema: string | undefined): Promise<readonly ObservedTable[]> {
  const s = schema === undefined ? "current_schema()" : q(schema);
  const cols = await driver.query(
    `SELECT c.relname AS t, a.attname AS n, format_type(a.atttypid, a.atttypmod) AS type, NOT a.attnotnull AS nl, pg_get_expr(d.adbin, d.adrelid) AS d FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace ns ON ns.oid = c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum WHERE a.attnum > 0 AND NOT a.attisdropped AND c.relkind IN ('r', 'p') AND ns.nspname = ${s} ORDER BY c.relname, a.attnum`,
  );
  const cons = await driver.query(
    `SELECT t.relname AS t, c.contype AS k, array_to_string(ARRAY(SELECT a.attname FROM unnest(c.conkey) WITH ORDINALITY u(n, o) JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = u.n ORDER BY u.o), chr(31)) AS cols, rt.relname AS rt, array_to_string(ARRAY(SELECT a.attname FROM unnest(c.confkey) WITH ORDINALITY u(n, o) JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = u.n ORDER BY u.o), chr(31)) AS rcols FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace ns ON ns.oid = t.relnamespace LEFT JOIN pg_class rt ON rt.oid = c.confrelid WHERE ns.nspname = ${s} AND c.contype IN ('p', 'u', 'f')`,
  );
  const idx = await driver.query(
    `SELECT t.relname AS t, i.relname AS n, ix.indisunique AS u, array_to_string(ARRAY(SELECT a.attname FROM unnest(ix.indkey) WITH ORDINALITY k(n, o) JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.n ORDER BY k.o), chr(31)) AS cols FROM pg_index ix JOIN pg_class t ON t.oid = ix.indrelid JOIN pg_class i ON i.oid = ix.indexrelid JOIN pg_namespace ns ON ns.oid = t.relnamespace WHERE ns.nspname = ${s} AND NOT ix.indisprimary AND NOT EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conindid = ix.indexrelid AND k.contype IN ('u', 'p'))`,
  );
  const tables = [...new Set(cols.map((c) => str(c["t"])))];
  return tables.map((t) => {
    const mine = cons.filter((c) => str(c["t"]) === t);
    const pk = mine.find((c) => str(c["k"]) === "p");
    return {
      name: t,
      columns: cols.filter((c) => str(c["t"]) === t).map((c) => ({ name: str(c["n"]), type: str(c["type"]).toLowerCase(), nullable: yes(c["nl"]), ...(c["d"] === null || c["d"] === undefined ? {} : { default: str(c["d"]) }) })),
      primaryKey: pk === undefined ? [] : split(pk["cols"]),
      uniques: mine.filter((c) => str(c["k"]) === "u").map((c) => ({ columns: split(c["cols"]) })),
      foreignKeys: mine.filter((c) => str(c["k"]) === "f").map((c) => ({ columns: split(c["cols"]), references: { table: str(c["rt"]), columns: split(c["rcols"]) } })),
      indexes: idx.filter((i) => str(i["t"]) === t).map((i) => ({ name: str(i["n"]), columns: split(i["cols"]), unique: yes(i["u"]) })),
    };
  });
}

/**
 * Reads what a database holds.
 *
 * @param driver - the database
 * @param dialect - its dialect (`postgres`, `sqlite` or `duckdb`)
 * @param options - the schema to read and the tables to leave out
 * @returns the tables, in the order of their names
 */
export async function introspect(driver: Driver, dialect: Dialect, options: IntrospectOptions = {}): Promise<Observed> {
  const read = dialect.name === "sqlite" ? await sqlite(driver) : dialect.name === "duckdb" ? await duckdb(driver, options.schema) : await postgres(driver, options.schema);
  const tables = read.filter((t) => options.exclude?.(t.name) !== true).toSorted((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return { dialect: dialect.name, ...(options.schema === undefined ? {} : { schema: options.schema }), tables };
}

/** The logical type that an engine's type text is of, or none where it is of no family the library knows. */
export function logicalOf(typeText: string): LogicalType | undefined {
  const t = typeText.trim().toLowerCase();
  const vec = /^vector\((\d+)\)$/.exec(t);
  if (vec !== null) return { kind: "vector", dimensions: Number(vec[1]) };
  if (/^(bool|boolean)$/.test(t)) return { kind: "boolean" };
  if (/^((tiny|small|big|huge|u)?int(eger)?\d*|serial\d*|bigserial|smallserial|int[248])$/.test(t)) return { kind: "integer" };
  if (/^timestamp(\(\d+\))?( with(out)? time zone)?$|^timestamptz$|^datetime$/.test(t)) return { kind: "timestamp", zone: /with time zone|tz/.test(t) && !/without/.test(t) };
  if (/^date$/.test(t)) return { kind: "date" };
  if (/^(json|jsonb)$/.test(t)) return { kind: "json" };
  if (/^(bytea|blob|binary|varbinary)/.test(t)) return { kind: "bytes" };
  if (/^(numeric|decimal|real|double|double precision|float\d*|money)(\(.*\))?$/.test(t)) return { kind: "decimal" };
  if (/^(text|string|clob|uuid|citext|name|char|varchar|character|nvarchar|nchar)/.test(t)) return { kind: "text" };
  return undefined;
}

const sameFamily = (a: LogicalType | undefined, b: LogicalType | undefined): boolean =>
  a !== undefined && b !== undefined && a.kind === b.kind && (a.kind !== "vector" || (b.kind === "vector" && a.dimensions === b.dimensions)) && (a.kind !== "timestamp" || (b.kind === "timestamp" && a.zone === b.zone));

/** What a logical schema says a database holds, written as `introspect` reads it: the names as the naming writes them and the types as the dialect writes them. */
export function expectedOf(schema: LogicalSchema, dialect: Dialect, options: { readonly naming?: Naming; readonly schema?: string } = {}): Observed {
  const naming = options.naming ?? defaultNaming();
  const errors: never[] = [];
  const names = writeNames(schema, dialect, naming, errors, options.schema);
  const w = (x: readonly string[]): string => naming.names.write(x);
  const tableName = (t: Table): string => names.tables.get(t.id) ?? w(t.name);
  const bare = (n: string): string => n.replace(/^.*\./, "").replaceAll('"', "");
  const refName = (words: readonly string[]): string => {
    const t = schema.tables.find((x) => x.name.join(".") === words.join("."));
    return bare(t === undefined ? w(words) : tableName(t));
  };
  return {
    dialect: dialect.name,
    ...(options.schema === undefined ? {} : { schema: options.schema }),
    tables: schema.tables.map((t) => ({
      name: bare(tableName(t)),
      columns: t.columns.map((c) => ({ name: names.columns.get(c.id) ?? w(c.name), type: dialect.type(c.type).toLowerCase(), nullable: c.nullable && !t.primaryKey.some((k) => k.join(".") === c.name.join(".")) })),
      primaryKey: t.primaryKey.map((k) => names.columns.get(t.columns.find((c) => c.name.join(".") === k.join("."))?.id ?? ("" as never)) ?? w(k)),
      uniques: t.uniques.map((u) => ({ columns: u.columns.map(w) })),
      foreignKeys: t.foreignKeys.map((f) => ({ columns: f.columns.map(w), references: { table: refName(f.references.table), columns: f.references.columns.map(w) } })),
      indexes: t.indexes.map((i) => ({ name: "", columns: i.columns.map(w), unique: false })),
    })),
  };
}

/** One way a database differs from what is expected of it. */
export type Drift =
  | { readonly kind: "missing-table"; readonly table: string }
  | { readonly kind: "stray-table"; readonly table: string }
  | { readonly kind: "missing-column"; readonly table: string; readonly column: string }
  | { readonly kind: "stray-column"; readonly table: string; readonly column: string }
  | { readonly kind: "type"; readonly table: string; readonly column: string; readonly expected: string; readonly found: string }
  | { readonly kind: "nullability"; readonly table: string; readonly column: string; readonly expected: boolean; readonly found: boolean }
  | { readonly kind: "primary-key"; readonly table: string; readonly expected: readonly string[]; readonly found: readonly string[] }
  | { readonly kind: "missing-foreign-key"; readonly table: string; readonly columns: readonly string[] }
  | { readonly kind: "missing-unique"; readonly table: string; readonly columns: readonly string[] }
  | { readonly kind: "missing-index"; readonly table: string; readonly columns: readonly string[] };

const same = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * Compares what a database holds with what is expected of it, table by table. A type is of the same family where both are the same logical type (`BIGINT` and `integer`); an index is held to exist where a
 * unique constraint or the key covers the same columns, as engines make the one with the other.
 *
 * @param expected - what the model says (`expectedOf`, or a state read earlier)
 * @param found - what the database holds (`introspect`)
 * @returns every difference, in the order of the tables
 */
export function drift(expected: Observed, found: Observed): readonly Drift[] {
  const out: Drift[] = [];
  const have = new Map(found.tables.map((t) => [t.name, t]));
  const want = new Set(expected.tables.map((t) => t.name));
  for (const e of expected.tables) {
    const f = have.get(e.name);
    if (f === undefined) {
      out.push({ kind: "missing-table", table: e.name });
      continue;
    }
    const cols = new Map(f.columns.map((c) => [c.name, c]));
    for (const c of e.columns) {
      const g = cols.get(c.name);
      if (g === undefined) {
        out.push({ kind: "missing-column", table: e.name, column: c.name });
        continue;
      }
      if (!sameFamily(logicalOf(c.type), logicalOf(g.type))) out.push({ kind: "type", table: e.name, column: c.name, expected: c.type, found: g.type });
      if (c.nullable !== g.nullable) out.push({ kind: "nullability", table: e.name, column: c.name, expected: c.nullable, found: g.nullable });
    }
    for (const g of f.columns) if (!e.columns.some((c) => c.name === g.name)) out.push({ kind: "stray-column", table: e.name, column: g.name });
    if (!same(e.primaryKey, f.primaryKey)) out.push({ kind: "primary-key", table: e.name, expected: e.primaryKey, found: f.primaryKey });
    for (const k of e.foreignKeys) if (!f.foreignKeys.some((x) => same(x.columns, k.columns) && x.references.table === k.references.table && same(x.references.columns, k.references.columns))) out.push({ kind: "missing-foreign-key", table: e.name, columns: k.columns });
    for (const u of e.uniques) if (!f.uniques.some((x) => same(x.columns, u.columns)) && !f.indexes.some((x) => x.unique && same(x.columns, u.columns)) && !same(f.primaryKey, u.columns)) out.push({ kind: "missing-unique", table: e.name, columns: u.columns });
    for (const i of e.indexes) if (!f.indexes.some((x) => same(x.columns, i.columns)) && !f.uniques.some((x) => same(x.columns, i.columns)) && !same(f.primaryKey, i.columns)) out.push({ kind: "missing-index", table: e.name, columns: i.columns });
  }
  for (const t of found.tables) if (!want.has(t.name)) out.push({ kind: "stray-table", table: t.name });
  return out;
}
