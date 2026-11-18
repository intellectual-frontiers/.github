// Spec: 0009-sql-features FR-014
/**
 * The partitions extension (commons data 0009-sql-features): tables divided by a key. `partitions` gives the clause and the source for `bind`; `partitionsExtension` is the same as an extension of
 * the engine, `sql.features.partitions`, which contributes both.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/commons/ts/kernel";
import { contribute, defineExtension, type Extension, extensionId, type IdError } from "@intellectual-frontiers/data/engine";
import { statementsPoint, tableClausesPoint } from "@intellectual-frontiers/data/sql/physical";
import { type Division, partitions } from "./partition.ts";

export { partitions, type Division } from "./partition.ts";

/**
 * Partitions as an extension of the engine.
 *
 * @param divisions - how tables are divided
 * @param version - the extension's version
 * @returns the extension, or why its identifier is not one
 */
export function partitionsExtension(divisions: readonly Division[], version = "1.0.0"): Result<Extension, IdError> {
  const id = extensionId("sql.features.partitions");
  if (id.kind === "err") return err(id.error);
  const { clause, source } = partitions(divisions);
  return ok(
    defineExtension({ id: id.value, version, contributes: [contribute(tableClausesPoint, clause), contribute(statementsPoint, source)] }),
  );
}
