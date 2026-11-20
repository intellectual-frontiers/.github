// Spec: 0058-sql-osquery FR-001, FR-004
/**
 * Osquery's machine facts (commons data 0058-sql-osquery): the published schema of a version of osquery imported through 0055 into a logical schema (never written by hand) with platform availability on its tables, classification on
 * its columns and the version stamped, and a read-only driver that runs `osqueryi --json` on demand for a SELECT. The `osquery-atc` extension (0027) goes the other way and is not changed; osqueryd and fleet TLS are out of scope.
 *
 * @example
 * ```ts
 * const schema = must(readSchema(JSON.parse(readFileSync("osquery-5.24.1.auto.json", "utf8"))));
 * const logical = must(importSchema(schema, "linux"));
 * const driver = osqueryDriver({ run: (argv) => proc.run(argv), schema, platform: "linux" });
 * const users = await driver.query("SELECT uid, username FROM users");
 * ```
 *
 * @module
 */
import { PERSONAL } from "./classify.ts";
export { classify, type Classification, PERSONAL } from "./classify.ts";
export { type MachineTarget, type OsqueryError, OsqueryFailure, type OsqueryOptions, osqueryDriver, osqueryQuery, osqueryTarget, type OsqueryRow, type Ran, type Run, selectOnly, SIDE_EFFECT_TABLES, tablesRead } from "./driver.ts";
/**
 * A redaction for a fan-out (0059): the personal columns of the schema (0058 FR-003) are hidden, so that a merged result of machines does not carry what identifies a person.
 *
 * @param mask - what a hidden value becomes
 */
export const redactPersonal = (mask = "[redacted]"): ((column: string, value: unknown) => unknown) => {
  const names = new Set(Object.values(PERSONAL).flatMap((t) => Object.keys(t.columns)));
  return (column, value) => (names.has(column) && value !== null ? mask : value);
};
export { importSchema, osquery, type OsqueryColumn, type OsquerySchema, type OsqueryTable, type OsqueryType, type Platform, PLATFORMS, readSchema, toObserved } from "./schema.ts";
