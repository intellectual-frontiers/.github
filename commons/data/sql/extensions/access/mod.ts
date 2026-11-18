// Spec: 0009-sql-features FR-008
/**
 * The access extension (commons data 0009-sql-features): row-level security and grants made from what governance says of who may see what. `accessSource` gives the statements for `bind`;
 * `accessExtension` is the same as an extension of the engine, `sql.features.access`.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/commons/ts/kernel";
import { contribute, defineExtension, type Extension, extensionId, type IdError } from "@intellectual-frontiers/data/engine";
import { statementsPoint } from "@intellectual-frontiers/data/sql/physical";
import { accessSource, type AccessSettings } from "./access.ts";

export { accessSource, governedTables, type AccessSettings } from "./access.ts";

/**
 * Access as an extension of the engine.
 *
 * @param settings - what a project says of access
 * @param version - the extension's version
 * @returns the extension, or why its identifier is not one
 */
export function accessExtension(settings: AccessSettings = {}, version = "1.0.0"): Result<Extension, IdError> {
  const id = extensionId("sql.features.access");
  return id.kind === "err"
    ? err(id.error)
    : ok(defineExtension({ id: id.value, version, contributes: [contribute(statementsPoint, accessSource(settings))] }));
}
