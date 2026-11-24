// Spec: 0002-anyfs-cli-governance FR-003
/**
 * The audience tiers of the `anyfs` program (commons headless 0010-audience-tiers): two, lowest first. `reader` sees what only reads (`ls`, `cat`, `find`, `check`, `places` and the rest); `writer` also sees what
 * changes a store. The tier is a fact of whoever runs the program (the variable `ANYFS_TIER`, the key of a tool server), never a word of a message; a caller who says nothing is a `writer`, the person at their own terminal.
 *
 * @example
 * ```ts
 * import { LADDER, tierOf } from "./tiers.ts";
 * LADDER.ladder.length; // 2
 * tierOf("reader") === LADDER.ladder[0]; // true
 * ```
 *
 * @module
 */
import { OPERATOR, parseTierName, PUBLIC, type TierLadder, type TierName } from "@intellectual-frontiers/headless/governance";

/** The names of the tiers, lowest first: a closed union. */
export type TierId = "reader" | "writer";

/** Every tier, lowest first. */
export const TIER_IDS: readonly TierId[] = ["reader", "writer"];

/** A tier name made from its word; the second is the tier of the default ladder it stands in for, which is never used where the word is a tier name (a test holds that). */
function named(id: TierId, standIn: TierName): TierName {
  const r = parseTierName(id);
  return r.kind === "ok" ? r.value : standIn;
}

/** The two tiers as headless' tier names. */
export const TIERS: Readonly<Record<TierId, TierName>> = { reader: named("reader", PUBLIC), writer: named("writer", OPERATOR) };

/** The ladder of the program. */
export const LADDER: TierLadder = { ladder: [TIERS.reader, TIERS.writer], default: TIERS.writer };

/** The tier named by a word, or undefined where the word is none of the two. */
export function tierOf(word: string): TierName | undefined {
  const id = TIER_IDS.find((t) => t === word);
  return id === undefined ? undefined : TIERS[id];
}
