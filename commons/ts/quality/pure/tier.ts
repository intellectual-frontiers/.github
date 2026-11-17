/**
 * The tier a harness claims (commons 0021-ifqs FR-036): `Tier0` (evidence exists: FR-013 to FR-020), `Tier1` (the system reports itself:
 * FR-021 to FR-034) or `Tier2` (people see and prove: FR-037 to FR-041). A claim is judged against the requirements of the tier and of the tiers
 * below it, each held by a mechanism of the proof register (anything but `none`): where one is not, the claim is refused and the requirement named.
 *
 * @example
 * ```ts
 * import { judgeTier } from "./tier.ts";
 * // judgeTier("Tier1", parseRegister(text)).claimed === false
 * ```
 *
 * @module
 */
import type { RegisterRow } from "./ladder.ts";

/** The tiers a harness may claim (`ifqs:QualityTier`). */
export type Tier = "Tier0" | "Tier1" | "Tier2";

/** The tiers in order. */
export const TIERS: readonly Tier[] = ["Tier0", "Tier1", "Tier2"];

/** Whether a text is a tier. */
export function isTier(text: string): text is Tier {
  return text === "Tier0" || text === "Tier1" || text === "Tier2";
}

/** The specification the tiers are requirements of. */
export const TIER_SPEC = "0021-ifqs";

const RANGES: Readonly<Record<Tier, readonly [number, number]>> = { Tier0: [13, 20], Tier1: [21, 34], Tier2: [37, 41] };

/** The requirements a tier itself states (without those of the tiers below it). */
export function tierRequirements(tier: Tier): readonly string[] {
  const [from, to] = RANGES[tier];
  return Array.from({ length: to - from + 1 }, (_, i) => `${TIER_SPEC} FR-${String(from + i).padStart(3, "0")}`);
}

/** What a claim of a tier comes to. */
export type TierJudgement = {
  readonly tier: Tier;
  /** Whether every requirement of the tier and of those below it is held by a mechanism. */
  readonly claimed: boolean;
  /** The requirements of the tier and below that are held by none. */
  readonly unmet: readonly string[];
};

/** A claim judged against the register (FR-036): a requirement the register does not list, or lists with `none`, is not met. */
export function judgeTier(tier: Tier, register: readonly RegisterRow[]): TierJudgement {
  const upTo = TIERS.slice(0, TIERS.indexOf(tier) + 1);
  const unmet = upTo.flatMap(tierRequirements).filter((r) => {
    const row = register.find((x) => x.requirement === r);
    return row === undefined || row.mechanism === "none";
  });
  return { tier, claimed: unmet.length === 0, unmet };
}
