/**
 * Ephemeral targets: a database that is a build product of the TypeScript (commons 0009-sql-aide FR-051, FR-053 to FR-055). Its
 * structure and its rows are typed TypeScript; the build writes one `.auto.sql` (a provenance header, the definitions in the order
 * their references give, then the rows as `INSERT` statements in a stable order by primary key, a fixed number to a statement), which
 * is committed and diffs in Git, and the database is made from it whenever wanted. The text is the same bytes from the same source on
 * every runtime and every run: nothing in it comes from the clock or from chance.
 *
 * @module
 */
import { sha256 } from "../../../kernel/mod.ts";
import type { SqlValue } from "../algebra/domain.ts";
import type { Table, TableSpec } from "../algebra/table.ts";
import type { Dialect, EmitContext } from "../emit/context.ts";
import { VERSION } from "../emit/coordinator.ts";
import { type DialectOf, type DxOf, type Fits, renderUnchecked, type ReqOf } from "../emit/sql.ts";
import type { Finding } from "../govern/lint.ts";
import type { LandingRow } from "../integrate/integration.ts";
import { definitions, type Entity, entityKey, ordered } from "../model/entity.ts";

/** The rows of one table an ephemeral build writes. */
export interface TableData {
  /** The table, as data. */
  readonly spec: TableSpec;
  /** Its rows, each giving the same columns. */
  readonly rows: readonly Readonly<Record<string, unknown>>[];
}

/**
 * The rows of a table for an ephemeral build, each typed as the row the table takes on insert, keys as plain values.
 *
 * @param table - the table
 * @param rows - its rows; they must all give the same columns
 */
export function dataOf<T extends Table<string, unknown, string>>(table: T, rows: readonly LandingRow<T>[]): TableData {
  const first = rows[0];
  const names = first === undefined ? [] : Object.keys(first);
  for (const r of rows)
    if (Object.keys(r).length !== names.length || Object.keys(r).some((k) => !names.includes(k)))
      throw new Error(`the rows of ${table.name} must all give the same columns (${names.join(", ")})`);
  // a row typed as the table's insert row is a record of its columns' values
  return { spec: table.spec, rows: rows as readonly Readonly<Record<string, unknown>>[] };
}

/** What an ephemeral build is made of: where it comes from, its entities and its rows. */
export interface EphemeralBuild<E extends readonly Entity[]> {
  /** The module it comes from, as a person would find it, for the header. */
  readonly module: string;
  /** The entities the database defines. */
  readonly entities: E;
  /** The rows of its tables. */
  readonly data: readonly TableData[];
  /** At most how many rows one `INSERT` writes; 500 where not said. */
  readonly chunk?: number;
}

/** Compares two values of a key in a stable order: null first, numbers by value, everything else by its text, code unit by code unit. */
function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  if ((typeof a === "number" || typeof a === "bigint") && (typeof b === "number" || typeof b === "bigint"))
    return a < b ? -1 : a > b ? 1 : 0;
  const x = a instanceof Date ? a.toISOString() : String(a);
  const y = b instanceof Date ? b.toISOString() : String(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

/** The rows of a table in the order of its primary key, or of all its columns where it has none. */
function sortedRows(d: TableData): readonly Readonly<Record<string, unknown>>[] {
  const key = d.spec.primaryKey.length > 0 ? d.spec.primaryKey : d.spec.columns.map(([n]) => n);
  return [...d.rows].sort((r, s) => {
    for (const k of key) {
      const c = compare(r[k], s[k]);
      if (c !== 0) return c;
    }
    return 0;
  });
}

/**
 * The `.auto.sql` of an ephemeral target: what the database is made from. The context must be ephemeral and fit the entities, or the
 * call does not compile; a durable database changes through ISLM instead.
 *
 * @param build - where it comes from, its entities and its rows
 * @param ctx - an ephemeral context of the target's dialect
 * @example
 * const text = await buildSql({ module: "arca/reference.ts", entities: partyTables, data: partyReferenceData }, context({ dialect: sqlite(), durability: "ephemeral" }));
 */
export async function buildSql<const E extends readonly Entity[], C extends EmitContext<Dialect, "ephemeral">>(
  build: EphemeralBuild<E>,
  ctx: C & Fits<DialectOf<C>, ReqOf<E[number]["ddl"]>, DxOf<E[number]["ddl"]>>,
): Promise<string> {
  const chunk = Math.max(1, Math.trunc(build.chunk ?? 500));
  const order = ordered(build.entities);
  if (order.kind === "err") throw new Error(`entities need each other in a circle: ${order.error.entities.join(", ")}`);
  const place = new Map(order.value.map((e, i) => [entityKey(e), i]));
  const data = [...build.data].sort(
    (a, b) => (place.get(entityKey(a.spec)) ?? Number.MAX_SAFE_INTEGER) - (place.get(entityKey(b.spec)) ?? Number.MAX_SAFE_INTEGER),
  );
  const parts = [renderUnchecked(definitions(build.entities), ctx)];
  for (const d of data) {
    const rows = sortedRows(d);
    const first = rows[0];
    if (first === undefined) continue;
    const domains = new Map(d.spec.columns);
    const names = d.spec.columns.map(([n]) => n).filter((n) => n in first);
    const table = ctx.naming
      .table(d.spec.name, d.spec.schema)
      .map((p) => ctx.dialect.quoteName(p))
      .join(".");
    const columns = names.map((n) => ctx.dialect.quoteName(ctx.naming.column(n))).join(", ");
    for (let i = 0; i < rows.length; i += chunk) {
      const values = rows
        .slice(i, i + chunk)
        // the rows were held by the compiler to the table's insert row: each value is a SqlValue of its column
        .map((r) => `(${names.map((n) => ctx.dialect.literal((r[n] ?? null) as SqlValue, domains.get(n)?.domain)).join(", ")})`);
      parts.push(`INSERT INTO ${table} (${columns}) VALUES\n${values.join(",\n")};`);
    }
  }
  const body = `${parts.join("\n\n")}\n`;
  const hash = await sha256(body);
  return [
    `-- Generated by IFC SQL Aide ${VERSION} for ${ctx.dialect.name} (ephemeral) from ${build.module}.`,
    `-- Body SHA-256 ${hash}. Do not edit this file: change the model and build it again.`,
    "",
    body,
  ].join("\n");
}

/**
 * The command a person runs to make the database from the `.auto.sql` with the engine's own client (FR-054): `sqlite3`, `duckdb` or
 * `psql`. It makes a database that is not there; run it on a new file, or on an empty PostgreSQL database.
 *
 * @param dialect - the target's dialect
 * @param sqlPath - the `.auto.sql`
 * @param database - the database file, or for PostgreSQL its address
 */
export function clientCommand(dialect: "sqlite" | "duckdb" | "postgres", sqlPath: string, database: string): readonly string[] {
  switch (dialect) {
    case "sqlite":
      return ["sqlite3", "-bail", database, `.read ${sqlPath}`];
    case "duckdb":
      return ["duckdb", "-bail", database, "-f", sqlPath];
    case "postgres":
      return ["psql", "--no-psqlrc", "--quiet", "-v", "ON_ERROR_STOP=1", "-d", database, "-f", sqlPath];
    default: {
      const never: never = dialect;
      return never;
    }
  }
}

/**
 * Says where an ephemeral build's rows pass a size: such a database is better made durable, or its rows kept outside the TypeScript
 * (FR-055).
 *
 * @param data - the rows of the build
 * @param maxRows - the most rows of one table that are not reported; 10,000 where not said
 */
export function sizeFindings(data: readonly TableData[], maxRows = 10_000): readonly Finding[] {
  return data.flatMap((d) =>
    d.rows.length > maxRows
      ? [{ rule: "ephemeral-size", table: d.spec.name, message: `has ${d.rows.length} rows written in TypeScript, more than ${maxRows}` }]
      : [],
  );
}

/**
 * A key made from a row's natural key, the same on every run: a UUID-shaped text of the SHA-256 of a namespace and the parts, so that an
 * ephemeral build needs no random identity (FR-053).
 *
 * @param namespace - what the key is a key of
 * @param parts - the natural key's values
 * @example
 * await naturalKey("party", "tax_number", "GB123"); // the same text every time
 */
export async function naturalKey(namespace: string, ...parts: readonly (string | number)[]): Promise<string> {
  const h = await sha256(JSON.stringify([namespace, ...parts]));
  // version 8 (custom) and the RFC 9562 variant, so that it reads as a UUID and says it is not a random one
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-8${h.slice(13, 16)}-${((Number.parseInt(h.slice(16, 17), 16) & 0x3) | 0x8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
