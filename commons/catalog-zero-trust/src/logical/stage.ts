// Spec: 0003-zero-trust-stages FR-003, FR-004
/**
 * The stage of a function computed from readings (0003-zero-trust-stages FR-003, FR-004, 0047-zero-trust FR-020, FR-022): a pure function with no clock, which takes the age of each reading as an argument. An indicator is a thing the property set of a pillar names for a stage
 * of a function (0047-zero-trust FR-025); the function is at the highest stage for which every stage up to it has enough fresh readings by the thresholds. A function with no reading at all is `unmeasured`, never `traditional`: the traditional stage is what a measured function is at
 * before it reaches the initial one, and no evidence is not a stage. A computed stage is a value of the catalog's thresholds and never the model's own judgement.
 *
 * @example
 * ```ts
 * import { stageOf } from "./stage.ts";
 * stageOf([{ stage: "initial", ageDays: 3 }], { initial: { coverage: 1, maxAgeDays: 90 }, advanced: { coverage: 1, maxAgeDays: 30 }, optimal: { coverage: 1, maxAgeDays: 7 } }); // "initial"
 * ```
 *
 * @module
 */

/** A stage of the model. */
export type Stage = "traditional" | "initial" | "advanced" | "optimal";
/** What a stage asks of the readings. */
export type Limit = { readonly coverage: number; readonly maxAgeDays: number };
/** The limits of the three stages that a reading can show. */
export type Limits = Readonly<Record<"initial" | "advanced" | "optimal", Limit>>;
/** One indicator of a function: the stage it gives evidence for, and the age in days of its latest reading (`undefined` when it has none). */
export type Indicator = { readonly stage: "initial" | "advanced" | "optimal"; readonly ageDays: number | undefined };

/** The stages that a reading can show, in order. */
export const RISING = ["initial", "advanced", "optimal"] as const;

/** The stage of a function from its indicators: `unmeasured` when none has a reading, else the highest stage whose limits hold for it and every stage below it. */
export function stageOf(indicators: readonly Indicator[], limits: Limits): Stage | "unmeasured" {
  if (!indicators.some((i) => i.ageDays !== undefined)) return "unmeasured";
  let reached: Stage = "traditional";
  for (const stage of RISING) {
    const limit = limits[stage];
    const upTo = indicators.filter((i) => RISING.indexOf(i.stage) <= RISING.indexOf(stage));
    const own = indicators.filter((i) => i.stage === stage);
    if (own.length === 0 || upTo.length === 0) break;
    const fresh = upTo.filter((i) => i.ageDays !== undefined && i.ageDays >= 0 && i.ageDays <= limit.maxAgeDays).length;
    if (fresh / upTo.length < limit.coverage) break;
    reached = stage;
  }
  return reached;
}
