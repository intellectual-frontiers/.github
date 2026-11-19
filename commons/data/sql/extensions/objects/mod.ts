// Spec: 0048-sql-objects FR-001
/**
 * Schemas, sequences, enumerated types, domains and extensions (commons data 0048-sql-objects): `objectsSource` gives the statements for `bind`; `objectsExtension` is the same as an extension of the
 * engine, `sql.features.objects`.
 *
 * @example
 * ```ts
 * bind(schema, { dialect, sources: [objectsSource([sequence("invoice_number", { start: 1000 }), enumType("mood", ["happy", "sad"])])] });
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/commons/ts/kernel";
import { contribute, defineExtension, type Extension, extensionId, type IdError } from "@intellectual-frontiers/data/engine";
import { statementsPoint } from "@intellectual-frontiers/data/sql/physical";
import { type DbObject, objectsSource, type ObjectsSettings } from "./objects.ts";

export { canHave, type DbObject, enumOf, enumType, extension, objectsSource, type ObjectsSettings, pgDomain, schema, sequence, statementOf } from "./objects.ts";

/** The objects as an extension of the engine. */
export function objectsExtension(objects: readonly DbObject[], settings: ObjectsSettings = {}, version = "1.0.0"): Result<Extension, IdError> {
  const id = extensionId("sql.features.objects");
  return id.kind === "err" ? err(id.error) : ok(defineExtension({ id: id.value, version, contributes: [contribute(statementsPoint, objectsSource(objects, settings))] }));
}
