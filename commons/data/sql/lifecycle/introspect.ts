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
import { type Dialect, naming as defaultNaming, type Naming, type Observed, writeNames } from "@intellectual-frontiers/data/sql/physical";
import type { Driver } from "./run.ts";

/** What reading is told. */
export interface IntrospectOptions {
  /** The schema to read; the connection's own (`current_schema()`, `main`) where not given. */
  readonly schema?: string;
  /** Tables to leave out (the ledger of the library's own, for one). */
  readonly exclude?: (table: string) => boolean;
}

/**
 * Reads what a database holds.
 *
 * @param driver - the database
 * @param dialect - its dialect 
 * @param options - the schema to read and the tables to leave out
 * @returns the tables, in the order of their names
 */
export async function introspect(driver: Driver, dialect: Dialect, options: IntrospectOptions = {}): Promise<Observed> {
  if (dialect.observe === undefined) throw new TypeError(`the ${dialect.name} dialect cannot observe a database: it has no \`observe\``);
  const read = await dialect.observe((sql) => driver.query(sql), options.schema);
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
