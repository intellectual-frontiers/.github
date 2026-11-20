// Spec: 0003-estate-logical FR-003, FR-004
/**
 * Operational truth: for an asset, what is declared of it, what is observed of it, what differs between them and how old the observation is; and the assets seen that nobody declared, and the ones
 * declared that were never seen. A discovered asset has nothing declared, so only its age is told; an asset never observed is `never-observed`, never a match.
 *
 * @example
 * ```ts
 * import { unexpectedAssets } from "./truth.ts";
 * unexpectedAssets(["olympia"], ["olympia", "printer"]); // { unexpected: ["printer"], unseen: [] }
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { Asset } from "@intellectual-frontiers/estate/governance";
import type { Json } from "@intellectual-frontiers/grc/governance";
import { drift, freshness, type Drift } from "@intellectual-frontiers/grc/logical";

/** What was observed of an asset: when, and the keyed records seen. */
export type Observation = { readonly at: string; readonly state: Readonly<Record<string, Json>> };

/** How current an observation is: as `fresh`, `due` or `stale` by grc, or `never-observed`. */
export type Currency = "fresh" | "due" | "stale" | "never-observed";

/** The operational truth of one asset. */
export type Truth = {
  readonly asset: string;
  readonly state: Asset["state"];
  readonly observedAt: string | null;
  readonly currency: Currency;
  /** What differs between what is declared and what is observed; nothing where nothing was observed or nothing is declared. */
  readonly difference: Drift | null;
  /** Whether what is declared and what is observed agree: false where they differ, and false where nothing was observed. */
  readonly agrees: boolean;
};

/** What is declared of an asset, what was observed, the instant now and how long an observation is good for (an ISO 8601 duration). */
export type TruthInput = {
  readonly asset: Asset;
  readonly declared: Readonly<Record<string, Json>>;
  readonly observed: Observation | undefined;
  readonly now: string;
  readonly within: string;
};

/** The operational truth of an asset, or why it cannot be told (a duration or an instant that is not one). */
export function operationalTruth(i: TruthInput): Result<Truth, string> {
  const fresh = freshness(i.observed?.at, i.within, i.now);
  if (fresh.kind === "err") return err(fresh.error);
  const currency: Currency = i.observed === undefined ? "never-observed" : fresh.value.state;
  const declared = i.asset.state === "discovered" ? undefined : i.declared;
  const difference = declared === undefined || i.observed === undefined ? null : drift(declared, i.observed.state);
  const same = difference !== null && difference.added.length === 0 && difference.removed.length === 0 && difference.changed.length === 0;
  return ok({ asset: i.asset.id, state: i.asset.state, observedAt: i.observed?.at ?? null, currency, difference, agrees: same });
}

/** The assets seen that no declaration expects (they are candidates to be discovered), and those declared and not seen, each in order. */
export function unexpectedAssets(declared: readonly string[], seen: readonly string[]): { readonly unexpected: readonly string[]; readonly unseen: readonly string[] } {
  const d = new Set(declared);
  const s = new Set(seen);
  return { unexpected: [...s].filter((x) => !d.has(x)).sort(), unseen: [...d].filter((x) => !s.has(x)).sort() };
}
