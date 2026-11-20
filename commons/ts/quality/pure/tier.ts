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
import type { Declaration } from "@intellectual-frontiers/mizan/changes/declaration";
import { gradeNeeded, type Judgement, type RegisterRow, regulatedInProduction } from "./ladder.ts";
import { type Grade, gradeRank, NO_GRADE } from "./names.ts";

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
  /** Whether every requirement of the tier and of those below it is held by a mechanism and, for a regulated harness in production, proved at the grade it needs. */
  readonly claimed: boolean;
  /** The requirements of the tier and below that are held by none. */
  readonly unmet: readonly string[];
  /** Where a regulated harness is in production: the requirements held by a mechanism whose proof is below the grade needed (FR-011), with the grade they have. */
  readonly underGrade: readonly { readonly requirement: string; readonly grade: Grade; readonly needed: Grade }[];
};

/** What a regulated harness in production is also judged on: the judgements of its requirements, its declaration and the day (FR-011). */
export type TierProof = {
  readonly judgements: readonly Judgement[];
  readonly declaration: Declaration | undefined;
  readonly today: string;
};

/**
 * A claim judged against the register (FR-036): a requirement the register does not list, or lists with `none`, is not met. Where `proof` is
 * given and the harness declares a regulated domain and production (`today` is on or after its production day), a requirement held by a
 * mechanism must also be proved at the grade `gradeNeeded` asks (`E4`: FR-011), or the claim is refused and the requirement named with the
 * grade it has. Every other harness is judged by the register alone.
 */
export function judgeTier(tier: Tier, register: readonly RegisterRow[], proof?: TierProof): TierJudgement {
  const upTo = TIERS.slice(0, TIERS.indexOf(tier) + 1);
  const wanted = upTo.flatMap(tierRequirements);
  const held = (r: string): boolean => {
    const row = register.find((x) => x.requirement === r);
    return row !== undefined && row.mechanism !== "none";
  };
  const unmet = wanted.filter((r) => !held(r));
  const underGrade =
    proof === undefined || !regulatedInProduction(proof.declaration, proof.today)
      ? []
      : wanted
          .filter(held)
          .map((requirement) => {
            const j = proof.judgements.find((x) => x.requirement === requirement);
            return { requirement, grade: j?.grade ?? NO_GRADE, needed: gradeNeeded(j?.risk ?? "not-high", proof.declaration, proof.today) };
          })
          .filter((x) => gradeRank(x.grade) < gradeRank(x.needed));
  return { tier, claimed: unmet.length === 0 && underGrade.length === 0, unmet, underGrade };
}
