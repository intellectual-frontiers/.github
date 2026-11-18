// Spec: 0018-sql-history FR-001
/**
 * The history strategy (commons data 0018-sql-history): a plan frozen into files that never change, replayed identically in every environment, and delivered through the pipeline, as a release
 * package for a DBA, or as a procedure inside the database. `freeze` gives the new files; `replay` runs the files; `releasePackage` and `installer` are the other deliveries.
 *
 * @example
 * ```ts
 * const files = freeze(existing, plan, { folder: "migrations", state });
 * await replay([...existing, ...files.value], driver, dialect, { empty });
 * ```
 *
 * @module
 */
export { freeze, type Freezable, type FreezeError, type FreezeOptions, renderRepeatable } from "./freeze.ts";
export { frozenOf, type FrozenStep, parseStep, pathOf, renderStep, slug } from "./format.ts";
export { installer, type InstallerError } from "./indb.ts";
export { checkHistory, chainOf, GENESIS, type Manifest, type ManifestEntry, type Problem, renderManifest } from "./manifest.ts";
export { type PackageError, type PackageOptions, releasePackage, type Releasable } from "./package.ts";
export { historyPlan, replay, type ReplayError } from "./replay.ts";
export { type Delivery, type History, type HistorySettings, settingsOf } from "./settings.ts";
