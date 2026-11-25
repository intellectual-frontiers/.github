// Spec: 0002-mirror-governance FR-003, FR-004, FR-005
/**
 * What a mirror reports: the lag of a path a secondary did not take, the drift of a secondary from the primary (the paths it lacks, the paths whose revision differs and the paths it has that the primary does not),
 * and what a reconcile did. A drift is empty exactly where the secondary holds the same objects at the same revisions as the primary.
 *
 * @example
 * ```ts
 * import { describeDrift, isInSync } from "./report.ts";
 * isInSync({ member: "b", missing: [], different: [], extra: [] }); // true
 * describeDrift({ member: "b", missing: [], different: [], extra: [] }); // "b is the same as the primary"
 * ```
 *
 * @module
 */
import type { Path } from "@intellectual-frontiers/anyfs/governance";

/** A path a secondary did not take, and why. */
export type Lag = { readonly member: string; readonly path: Path; readonly reason: string };

/** How one secondary differs from the primary: paths it lacks, paths at another revision, paths it has alone. Each list is in the order of the paths. */
export type Drift = {
  readonly member: string;
  readonly missing: readonly Path[];
  readonly different: readonly Path[];
  readonly extra: readonly Path[];
};

/** What a reconcile did for one secondary. */
export type Reconciled = {
  readonly member: string;
  readonly before: Drift;
  readonly copied: readonly Path[];
  readonly removed: readonly Path[];
  /** The paths it could not make the same, with the reason. */
  readonly failed: readonly Lag[];
};

/** How many paths differ. */
export const driftSize = (d: Drift): number => d.missing.length + d.different.length + d.extra.length;

/** Whether the secondary holds the same objects at the same revisions as the primary. */
export const isInSync = (d: Drift): boolean => driftSize(d) === 0;

/** A drift as one sentence. */
export function describeDrift(d: Drift): string {
  return isInSync(d)
    ? `${d.member} is the same as the primary`
    : `${d.member} differs from the primary: ${d.missing.length} missing, ${d.different.length} at another revision, ${d.extra.length} that the primary does not have`;
}

/** A lag as one sentence. */
export const describeLag = (l: Lag): string => `${l.member} did not take ${l.path}: ${l.reason}`;
