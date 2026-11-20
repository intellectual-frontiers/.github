// Spec: 0027-sql-osquery-atc FR-001, FR-002, FR-003, FR-004
/**
 * osquery Automatic Table Construction (commons data 0027-sql-osquery-atc): the configuration that makes tables of osquery from tables of a local SQLite database, made from a logical schema, with
 * what osquery refuses refused first.
 *
 * What osquery does, as read in its documentation of Automatic Table Construction (`auto_table_construction` in the configuration): `query` and `path` are required and `columns` is a list; every
 * column is text to osquery; a column named `path` in any case is refused, because osquery adds a `path` column of its own; the platforms it names are `darwin`, `linux`, `posix`, `windows`, `any`
 * and `all`; and a path may hold `%` for any one directory. The configuration made here was checked against that and by running each entry's query on a database built from the same source; it was
 * not run in osquery.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { words } from "@intellectual-frontiers/data/governance";
import type { LogicalSchema } from "@intellectual-frontiers/data/sql/logical";
import { type Dialect, type Naming, naming as defaultNaming, writeNames } from "@intellectual-frontiers/data/sql/physical";

export const PLATFORMS = ["darwin", "linux", "posix", "windows", "any", "all"] as const;
export type Platform = (typeof PLATFORMS)[number];

/** An osquery table made from a table of the database. */
export interface AtcEntry {
  /** The name of the table in osquery. */
  readonly name: string;
  /** The table of the database, by the words of its name. */
  readonly table: string;
  /** The columns, by the words of their names, in the order the query gives them. */
  readonly columns: readonly string[];
  /** The path of the database on the host, `%` standing for any one directory. */
  readonly path: string;
  readonly platform?: Platform;
}

/** An entry as osquery reads it. */
export interface AtcConfigEntry {
  readonly query: string;
  readonly path: string;
  readonly columns: readonly string[];
  readonly platform?: Platform;
}

/** The configuration. */
export interface Atc {
  readonly config: { readonly auto_table_construction: Readonly<Record<string, AtcConfigEntry>> };
  /** The configuration as JSON, the same bytes every time. */
  readonly json: string;
}

export type AtcError =
  | { readonly kind: "unsupported"; readonly why: string }
  | { readonly kind: "unknown-table"; readonly entry: string; readonly table: string }
  | { readonly kind: "unknown-column"; readonly entry: string; readonly column: string }
  | { readonly kind: "name"; readonly entry: string }
  | { readonly kind: "duplicate"; readonly entry: string }
  | { readonly kind: "path-column"; readonly entry: string; readonly column: string }
  | { readonly kind: "no-columns"; readonly entry: string }
  | { readonly kind: "platform"; readonly entry: string; readonly platform: string }
  | { readonly kind: "path"; readonly entry: string; readonly path: string; readonly platform: Platform };

/** What a configuration is made with. */
export interface AtcOptions {
  readonly dialect: Dialect;
  readonly naming?: Naming;
  /** The schema the tables are in, as the database was built with it. */
  readonly schema?: string;
}

/** A path on POSIX, and one on Windows (a drive or a share). */
export const POSIX_PATH = /^\/\S/;
export const WINDOWS_PATH = /^(?:[A-Za-z]:[\\/]|\\\\)\S/;

/**
 * The configuration of a set of entries.
 *
 * @param schema - the logical schema of the database
 * @param entries - the entries
 * @param options - the dialect (SQLite's), naming and schema
 * @returns the configuration, or why not
 */
export function atc(schema: LogicalSchema, entries: readonly AtcEntry[], options: AtcOptions): Result<Atc, readonly AtcError[]> {
  const { dialect } = options;
  if (dialect.name !== "sqlite") return err([{ kind: "unsupported", why: "osquery reads a SQLite database, and this is the dialect of " + dialect.name }]);
  const nm = options.naming ?? defaultNaming();
  const names = writeNames(schema, dialect, nm, [], options.schema);
  const errors: AtcError[] = [];
  const out: Record<string, AtcConfigEntry> = {};
  for (const e of entries) {
    if (!/^[a-z][a-z0-9_]*$/.test(e.name)) errors.push({ kind: "name", entry: e.name });
    if (e.name in out) errors.push({ kind: "duplicate", entry: e.name });
    const platform = e.platform ?? "all";
    if (!(PLATFORMS as readonly string[]).includes(platform)) errors.push({ kind: "platform", entry: e.name, platform });
    else {
      const ok1 = platform === "windows" ? WINDOWS_PATH.test(e.path) : platform === "any" || platform === "all" ? POSIX_PATH.test(e.path) || WINDOWS_PATH.test(e.path) : POSIX_PATH.test(e.path);
      if (!ok1) errors.push({ kind: "path", entry: e.name, path: e.path, platform });
    }
    if (e.columns.length === 0) errors.push({ kind: "no-columns", entry: e.name });
    const t = schema.tables.find((x) => x.name.join(".") === words(e.table).join("."));
    if (t === undefined) {
      errors.push({ kind: "unknown-table", entry: e.name, table: e.table });
      continue;
    }
    const written: string[] = [];
    for (const c of e.columns) {
      const col = t.columns.find((x) => x.name.join(".") === words(c).join("."));
      if (col === undefined) {
        errors.push({ kind: "unknown-column", entry: e.name, column: c });
        continue;
      }
      const w = names.column(col.id) ?? "";
      if (w.toLowerCase() === "path") errors.push({ kind: "path-column", entry: e.name, column: w });
      written.push(w);
    }
    out[e.name] = {
      query: `SELECT ${written.map((w) => dialect.quote(w)).join(", ")} FROM ${names.ref(t.id)}`,
      path: e.path,
      columns: written,
      ...(e.platform === undefined ? {} : { platform: e.platform }),
    };
  }
  if (errors.length > 0) return err(errors);
  const sorted = Object.fromEntries(Object.keys(out).sort().map((k) => [k, out[k] as AtcConfigEntry]));
  const config = { auto_table_construction: sorted };
  return ok({ config, json: `${JSON.stringify(config, null, 2)}\n` });
}
