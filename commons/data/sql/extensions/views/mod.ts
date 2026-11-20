// Spec: 0009-sql-features FR-005
/**
 * The views extension (commons data 0009-sql-features): `viewsSource` gives the statements of views for `bind`; `viewsExtension` is the same as an extension of the engine, `sql.features.views`.
 *
 * @example
 * ```ts
 * bind(schema, { dialect, sources: [viewsSource([{ name: "personDirectory", description: "The people in use", from: "party", columns: [{ table: "party", column: "partyId" }] }])] });
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { contribute, defineExtension, type Extension, extensionId, type IdError } from "@intellectual-frontiers/data/engine";
import { statementsPoint } from "@intellectual-frontiers/data/sql/physical";
import { type ViewDefinition, viewsSource } from "./view.ts";

export { viewsSource, type ColumnRef, type Condition, type Join, type ViewColumn, type ViewDefinition } from "./view.ts";

/**
 * The views as an extension of the engine.
 *
 * @param definitions - the views
 * @param version - the extension's version
 * @returns the extension, or why its identifier is not one
 */
export function viewsExtension(definitions: readonly ViewDefinition[], version = "1.0.0"): Result<Extension, IdError> {
  const id = extensionId("sql.features.views");
  return id.kind === "err"
    ? err(id.error)
    : ok(defineExtension({ id: id.value, version, contributes: [contribute(statementsPoint, viewsSource(definitions))] }));
}
