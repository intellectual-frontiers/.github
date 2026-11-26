// Spec: 0003-zero-trust-stages FR-001, FR-002
/**
 * The thresholds by which a stage of the maturity model is computed from readings (0003-zero-trust-stages FR-001, FR-002, 0047-zero-trust FR-020, FR-022): data of the catalog, published with it. The CISA model describes the stages in words and gives no numbers, so these numbers
 * are OURS, not the model's, and say so: a stage reached by them is "reached by the thresholds of this catalog". A threshold is a share of the indicators of a pillar's function that must have a reading, and the longest age that reading may have; a later stage asks for a fresher
 * reading because it claims the control is continuous. The values are proposals for the owner to confirm (0047-zero-trust, decision 4 of the plan), and changing them is a change of the package.
 *
 * @example
 * ```ts
 * import { THRESHOLDS } from "./thresholds.ts";
 * THRESHOLDS.optimal.maxAgeDays; // 7
 * ```
 *
 * @module
 */
import type { StageId } from "./ztmm.ts";

/** What a stage asks of the readings of an indicator: the share of the indicators (0 to 1) that need a reading, and the longest age of that reading in days. */
export type Threshold = { readonly coverage: number; readonly maxAgeDays: number };

/** The thresholds of the three stages that a reading can show (the traditional stage is what a measured function is at before it reaches the initial one). */
export const THRESHOLDS: Readonly<Record<Exclude<StageId, "traditional">, Threshold>> = {
  initial: { coverage: 1, maxAgeDays: 90 },
  advanced: { coverage: 1, maxAgeDays: 30 },
  optimal: { coverage: 1, maxAgeDays: 7 },
};

/** The statement that goes with every computed stage, so that no stage is shown as the model's own judgement. */
export const COMPUTED_BY = "a stage computed from readings by the thresholds of the catalog, which are ours and not the model's";
