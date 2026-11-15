/**
 * osquery's Automatic Table Construction, typed (commons 0009-sql-aide FR-056). osquery exposes a local SQLite database as a table
 * when its configuration has an `auto_table_construction` entry naming the table and giving the `query` to run against the database,
 * the `path` of the database, the `columns` the query gives and, optionally, the `platform`. This module models such an entry as an
 * IFC SQL Aide table and what ATC needs, checks the columns against the table's, and writes the configuration as JSON for osquery to
 * read; the SQLite database behind it is an ephemeral target built from the same TypeScript.
 *
 * What osquery does, as read on 2026-11-15 in its documentation (https://osquery.readthedocs.io/en/stable/deployment/configuration/,
 * "Automatic Table Construction") and its source (osquery/osquery, plugins/config/parsers/auto_constructed_tables.cpp):
 * `query` and `path` are required and `columns` must be an array; every column is TEXT to osquery; a column named `path` (in any case)
 * is refused, because osquery adds a `path` column of its own; the platforms the documentation names are `darwin`, `linux`, `posix`,
 * `windows`, `any` and `all`, and an entry with none applies to all; a path may hold `%` for any one directory (the documentation's
 * per-user example). The configuration this module writes was checked against that format and was not run in osquery here.
 *
 * @module
 */
import { type Entity, type RowOf, type TableSpec } from "../sql-aide/mod.ts";

/** A platform an osquery entry applies to, as osquery's documentation names them. */
export type Platform = "darwin" | "linux" | "posix" | "windows" | "any" | "all";

/** The columns of a table an ATC entry may name: every column but one called `path`, in any case, which osquery adds itself. */
export type AtcColumn<T> = { [K in keyof RowOf<T> & string]: Lowercase<K> extends "path" ? never : K }[keyof RowOf<T> & string];

/** An ATC entry: an osquery table made from a table of a local SQLite database. */
export interface AtcTable<N extends string = string> {
  /** The name of the table in osquery. */
  readonly name: N;
  /** The table of the SQLite database it reads. */
  readonly table: Entity & { readonly spec: TableSpec };
  /** The path of the database on the host, `%` standing for any one directory. */
  readonly path: string;
  /** The columns, in the order the query gives them. */
  readonly columns: readonly string[];
  /** The platform it applies to; all where not said. */
  readonly platform?: Platform;
  /** The query osquery runs against the database, as SQLite writes it. */
  readonly query: string;
}

const quote = (n: string): string => `"${n.replaceAll('"', '""')}"`;

/**
 * Makes an ATC entry for a table: its query selects the columns named, in order, from the table.
 *
 * @param name - the name of the table in osquery: lower-case letters, digits and underscores
 * @param table - the table of the SQLite database
 * @param options - the path of the database on the host, the columns (of the table, never `path`) and the platform
 * @example
 * const settings = atcTable("managed_settings", policySetting, { path: "/var/osquery/atc/managed.sqlite.db", columns: ["setting_key", "value"], platform: "posix" });
 */
export function atcTable<
  const N extends string,
  T extends Entity & { readonly spec: TableSpec },
  const Cols extends readonly AtcColumn<T>[],
>(name: N, table: T, options: { readonly path: string; readonly columns: Cols; readonly platform?: Platform }): AtcTable<N> {
  if (!/^[a-z_][a-z0-9_]*$/.test(name))
    throw new Error(`${name} is not a name osquery gives a table: lower-case letters, digits and underscores`);
  if (options.path === "") throw new Error(`the ATC table ${name} needs the path of its database`);
  if (options.columns.length === 0) throw new Error(`the ATC table ${name} names no column`);
  const query = `SELECT ${options.columns.map(quote).join(", ")} FROM ${quote(table.spec.name)}`;
  return {
    name,
    table,
    path: options.path,
    columns: options.columns,
    ...(options.platform === undefined ? {} : { platform: options.platform }),
    query,
  };
}

/** The configuration osquery reads: `auto_table_construction`, each entry by its table's name. */
export interface AtcConfig {
  /** The entries. */
  readonly auto_table_construction: {
    readonly [table: string]: {
      readonly query: string;
      readonly path: string;
      readonly columns: readonly string[];
      readonly platform?: Platform;
    };
  };
}

/**
 * The configuration of ATC entries, in the order of their names.
 *
 * @param tables - the entries; two of one name are refused
 */
export function atcConfig(tables: readonly AtcTable[]): AtcConfig {
  const names = tables.map((t) => t.name);
  const twice = names.filter((n, i) => names.indexOf(n) !== i);
  if (twice.length > 0) throw new Error(`ATC tables named twice: ${[...new Set(twice)].join(", ")}`);
  const entries = [...tables]
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .map(
      (t) =>
        [
          t.name,
          { query: t.query, path: t.path, columns: t.columns, ...(t.platform === undefined ? {} : { platform: t.platform }) },
        ] as const,
    );
  return { auto_table_construction: Object.fromEntries(entries) };
}

/**
 * The configuration as the text of an `.auto.json`: two spaces of indentation, a list of columns on one line, a newline at the end, the
 * same bytes from the same entries.
 *
 * @param tables - the entries
 */
export function atcJson(tables: readonly AtcTable[]): string {
  const config = atcConfig(tables);
  const lines = ["{", '  "auto_table_construction": {'];
  const entries = Object.entries(config.auto_table_construction);
  entries.forEach(([name, e], i) => {
    const fields = [
      `      "query": ${JSON.stringify(e.query)}`,
      `      "path": ${JSON.stringify(e.path)}`,
      `      "columns": [${e.columns.map((c) => JSON.stringify(c)).join(", ")}]`,
      ...(e.platform === undefined ? [] : [`      "platform": ${JSON.stringify(e.platform)}`]),
    ];
    lines.push(`    ${JSON.stringify(name)}: {`, fields.join(",\n"), `    }${i === entries.length - 1 ? "" : ","}`);
  });
  lines.push("  }", "}");
  return `${lines.join("\n")}\n`;
}
