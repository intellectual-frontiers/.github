// Spec: 0002-repoctl-governance FR-003
/**
 * The audience tiers of Repoctl (commons repoctl 0002-repoctl-governance FR-003; commons headless 0010-audience-tiers): three, lowest first. `public` sees what only reads (the checks, the status, the plan of a
 * release); `contributor` also sees what changes a checkout (the generated files, the merge, the commit, a new library, the making of a release); `releaser` also sees the publication. The tier is a fact of the host that
 * runs the program (the variable `REPOCTL_TIER`, the key of a tool server), never a word of a message.
 *
 * @example
 * ```ts
 * import { LADDER, tierOf } from "./tiers.ts";
 * LADDER.ladder.length; // 3
 * tierOf("releaser");
 * ```
 *
 * @module
 */
import { ADMINISTRATOR, OPERATOR, PUBLIC, parseTierName, type TierLadder, type TierName } from "@intellectual-frontiers/headless/governance";

/** The names of the tiers, lowest first: a closed union. */
export type TierId = "public" | "contributor" | "releaser";

/** Every tier, lowest first. */
export const TIER_IDS: readonly TierId[] = ["public", "contributor", "releaser"];

/** A tier name made from its word; the second is the tier of the default ladder it stands in for, which is never used where the word is a tier name (a test holds that). */
function named(id: TierId, standIn: TierName): TierName {
  const r = parseTierName(id);
  return r.kind === "ok" ? r.value : standIn;
}

/** The three tiers as headless' tier names. */
export const TIERS: Readonly<Record<TierId, TierName>> = {
  public: PUBLIC,
  contributor: named("contributor", OPERATOR),
  releaser: named("releaser", ADMINISTRATOR),
};

/** The ladder of the program: the tier of a caller who says nothing is `contributor`, the person at their own checkout. */
export const LADDER: TierLadder = { ladder: [TIERS.public, TIERS.contributor, TIERS.releaser], default: TIERS.contributor };

/** The tier named by a word, or undefined where the word is none of the three. */
export function tierOf(word: string): TierName | undefined {
  const id = TIER_IDS.find((t) => t === word);
  return id === undefined ? undefined : TIERS[id];
}
