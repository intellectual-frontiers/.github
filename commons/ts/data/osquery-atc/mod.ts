/**
 * osquery ATC for IFC SQL Aide: Automatic Table Construction entries as typed values, the configuration osquery reads written from
 * them, and the SQLite database behind them built as an ephemeral target (commons 0009-sql-aide FR-056, FR-057).
 *
 * @example
 * ```ts
 * import { buildSql, context, sqlite } from "../sql-aide/mod.ts";
 * import { atcJson, catalogAtc, catalogData, catalogTables } from "./mod.ts";
 * const json = atcJson(catalogAtc); // what osquery reads
 * const sql = await buildSql({ module: "osquery-atc/catalog.ts", entities: catalogTables, data: catalogData }, context({ dialect: sqlite(), durability: "ephemeral" }));
 * ```
 *
 * @module
 */
import { type Docs, docsOf } from "../sql-aide/mod.ts";
import * as catalogModule from "./catalog.ts";
import { docs } from "./catalog.docs.auto.ts";

export { atcConfig, atcJson, atcTable } from "./atc.ts";
export type { AtcColumn, AtcConfig, AtcTable, Platform } from "./atc.ts";
export {
  allowedApplication,
  allowedApplications,
  catalogAtc,
  catalogData,
  catalogTables,
  managedApplications,
  managedSettings,
  policySetting,
  policySettings,
  POSIX_PATH,
  WINDOWS_PATH,
} from "./catalog.ts";

/** The documentation of the example model, from its TSDoc comments. */
export const catalogDocs: Docs = docsOf(catalogModule, docs);
