// Spec: 0027-sql-osquery-atc FR-001
/**
 * osquery ATC (commons data 0027-sql-osquery-atc): the `auto_table_construction` configuration that makes tables of osquery from tables of a local SQLite database, made from a logical schema.
 *
 * @example
 * ```ts
 * const c = must(atc(schema, [{ name: "managed_settings", table: "setting", columns: ["key", "value"], path: "/var/osquery/managed.sqlite.db", platform: "posix" }], { dialect: sqlite }));
 * writeFileSync("catalog.auto.json", c.json);
 * ```
 *
 * @module
 */
export { atc, type Atc, type AtcConfigEntry, type AtcEntry, type AtcError, type AtcOptions, type Platform, PLATFORMS, POSIX_PATH, WINDOWS_PATH } from "./atc.ts";
