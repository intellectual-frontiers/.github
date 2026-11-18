// Spec: 0009-sql-features FR-011
/**
 * The routines extension (commons data 0009-sql-features): functions and procedures made from typed definitions. `routinesSource` gives the statements for `bind`; `routinesExtension` is the
 * same as an extension of the engine, `sql.features.routines`.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/commons/ts/kernel";
import { contribute, defineExtension, type Extension, extensionId, type IdError } from "@intellectual-frontiers/data/engine";
import { statementsPoint } from "@intellectual-frontiers/data/sql/physical";
import { type RoutineDefinition, routinesSource } from "./routine.ts";

export { column, columnName, param, routinesSource, table, type Param, type Ref, type Returns, type RoutineDefinition } from "./routine.ts";

/**
 * The routines as an extension of the engine.
 *
 * @param definitions - the routines
 * @param version - the extension's version
 * @returns the extension, or why its identifier is not one
 */
export function routinesExtension(definitions: readonly RoutineDefinition[], version = "1.0.0"): Result<Extension, IdError> {
  const id = extensionId("sql.features.routines");
  return id.kind === "err"
    ? err(id.error)
    : ok(defineExtension({ id: id.value, version, contributes: [contribute(statementsPoint, routinesSource(definitions))] }));
}
