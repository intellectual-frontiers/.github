// Spec: 0012-sql-idempotency FR-006
/**
 * The idempotency extension (commons data 0012-sql-idempotency): a feature of the lifecycle, on by default, that makes every generated step safe to repeat. `idempotency` is the transform;
 * `idempotencyExtension` contributes it through the engine's point `lifecycle.transform`; `defaultIdempotency` is the default composition, which the strategies include; `planOptions` gives
 * what `plan` is given for the settings.
 *
 * @example
 * ```ts
 * import { plan } from "@intellectual-frontiers/data/sql/lifecycle";
 * import { idempotency } from "@intellectual-frontiers/data/sql/extensions/idempotency";
 * plan(from, schema, { dialect }, { transforms: [idempotency()] });
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { contribute, defineExtension, type Extension, extensionId, type IdError } from "@intellectual-frontiers/data/engine";
import { type PlanOptions, transformPoint } from "@intellectual-frontiers/data/sql/lifecycle";
import { idempotency, type IdempotencySettings } from "./transform.ts";

export { guardInline, type Inline } from "./inline.ts";
export { idempotency, type IdempotencySettings } from "./transform.ts";

/**
 * The idempotency transform as an extension of the engine, `sql.lifecycle.idempotency`.
 *
 * @param settings - what the project says of idempotency
 * @param version - the extension's version
 * @returns the extension, or why its identifier is not one
 */
export function idempotencyExtension(settings: IdempotencySettings = {}, version = "1.0.0"): Result<Extension, IdError> {
  const id = extensionId("sql.lifecycle.idempotency");
  return id.kind === "err"
    ? err(id.error)
    : ok(defineExtension({ id: id.value, version, contributes: [contribute(transformPoint, idempotency(settings))] }));
}

/**
 * The default composition of idempotency: the extension, on.
 *
 * @param settings - what the project says of idempotency
 * @returns the extensions, or why an identifier is not one
 */
export function defaultIdempotency(settings: IdempotencySettings = {}): Result<readonly Extension[], IdError> {
  const e = idempotencyExtension(settings);
  return e.kind === "err" ? err(e.error) : ok([e.value]);
}

/**
 * What `plan` is given for the settings: the transform and whether a step that only the ledger keeps from running twice is refused.
 *
 * @param settings - what the project says of idempotency
 * @returns the part of the options of `plan`
 */
export const planOptions = (settings: IdempotencySettings = {}): Pick<PlanOptions, "transforms" | "requireIdempotent"> => ({
  transforms: [idempotency(settings)],
  requireIdempotent: settings.unguardable === "refuse",
});
