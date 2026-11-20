// Spec: 0017-sql-rewrite FR-001
/**
 * The rewrite (commons data 0017-sql-rewrite): a table made again where the engine cannot change it in place, and a change of type cast where the project says values may be. `rewrite` is the
 * fallback `plan` is given; `rewriteExtension` contributes it through the engine's point `lifecycle.fallback`.
 *
 * @example
 * ```ts
 * plan(from, schema, { dialect }, { fallback: rewrite({ casts: "allow" }) });
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { contribute, defineExtension, type Extension, extensionId, type IdError } from "@intellectual-frontiers/data/engine";
import { fallbackPoint } from "@intellectual-frontiers/data/sql/lifecycle";
import { rewrite, type RewriteSettings } from "./rewrite.ts";

export { type Rewrite, rewrite, type RewriteSettings, settingsOf } from "./rewrite.ts";

/**
 * The rewrite as an extension of the engine, `sql.lifecycle.rewrite`.
 *
 * @param given - what a project says of the rewrite
 * @param version - the extension's version
 * @returns the extension, or why its identifier is not one
 */
export function rewriteExtension(given: RewriteSettings = {}, version = "1.0.0"): Result<Extension, IdError> {
  const id = extensionId("sql.lifecycle.rewrite");
  return id.kind === "err"
    ? err(id.error)
    : ok(defineExtension({ id: id.value, version, contributes: [contribute(fallbackPoint, rewrite(given))] }));
}
