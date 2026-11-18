// Spec: 0015-sql-safety FR-011
/**
 * The safety features (commons data 0015-sql-safety): quarantine instead of drop, lock discipline and verification, each on by default and each a transform of the lifecycle. `safety` gives
 * what a project passes on: the transforms, in the order that makes them agree, and the retry for `execute`; `safetyExtension` contributes the transforms through the engine; `purge` is the
 * step a person asks for to destroy a quarantine table.
 *
 * @example
 * ```ts
 * const s = safety();
 * plan(from, schema, { dialect }, { transforms: s.transforms });
 * execute(plan, driver, dialect, { empty, retry: s.retry(dialect) });
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/commons/ts/kernel";
import { contribute, defineExtension, type Extension, extensionId, type IdError } from "@intellectual-frontiers/data/engine";
import { type RunOptions, type StepTransform, transformPoint } from "@intellectual-frontiers/data/sql/lifecycle";
import type { Dialect } from "@intellectual-frontiers/data/sql/physical";
import { lockRetry, lockTimeouts, validateLater } from "./locks.ts";
import { purge, type PurgeOptions, quarantine } from "./quarantine.ts";
import { type Safety, type SafetySettings, settingsOf } from "./settings.ts";
import { verification } from "./verify.ts";

export { lockRetry, lockTimeouts, validateLater } from "./locks.ts";
export { purge, type PurgeOptions, quarantine, quarantineName } from "./quarantine.ts";
export { type Safety, type SafetySettings, settingsOf } from "./settings.ts";
export { verification } from "./verify.ts";

/** What a project passes on for a set of settings. */
export interface SafetyKit {
  readonly settings: Safety;
  /** The transforms, in the order they are given to `plan`: quarantine, locks, validation, verification. */
  readonly transforms: readonly StepTransform[];
  /** What `execute` is given to try a step again on a lock timeout. */
  retry(dialect: Dialect): RunOptions["retry"];
  /** A plan of one step that drops quarantine tables. */
  purge(options: Omit<PurgeOptions, "settings">): ReturnType<typeof purge>;
}

/**
 * The safety features for a set of settings.
 *
 * @param given - what a project says of safety
 * @returns what a project passes on
 */
export function safety(given: SafetySettings = {}): SafetyKit {
  const settings = settingsOf(given);
  return {
    settings,
    transforms: [quarantine(settings), lockTimeouts(settings), validateLater(settings), verification(settings)],
    retry: (dialect) => lockRetry(dialect, settings),
    purge: (options) => purge({ ...options, settings }),
  };
}

/**
 * The transforms as an extension of the engine, `sql.lifecycle.safety`.
 *
 * @param given - what a project says of safety
 * @param version - the extension's version
 * @returns the extension, or why its identifier is not one
 */
export function safetyExtension(given: SafetySettings = {}, version = "1.0.0"): Result<Extension, IdError> {
  const id = extensionId("sql.lifecycle.safety");
  return id.kind === "err"
    ? err(id.error)
    : ok(defineExtension({ id: id.value, version, contributes: safety(given).transforms.map((t) => contribute(transformPoint, t)) }));
}
