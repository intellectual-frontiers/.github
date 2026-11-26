// Spec: 0010-audience-tiers FR-001, FR-002, FR-003, FR-004
/**
 * The tier of an action, as governance (commons headless 0010-audience-tiers): who among the callers of a program may see and run it. A tier is a name on a ladder that
 * the program declares as data (lowest first), an action declares the tier it needs, a caller holds one, and `tierGate` is the one pure function that says whether the caller
 * may see the action. Every surface asks it, so a command line, a tool server and a REST route expose the same verbs to the same caller.
 *
 * @remarks
 * A tier is not the action's `audience` (who the action is for: a person, a program or both) and not its `effect`: the audience says what kind of caller, the tier says how
 * much that caller is trusted with; a surface applies both. A name that is not on the ladder is never visible: a typo in an action's tier hides the action, it does not
 * expose it. The names are made only by `parseTierName` (parse, don't validate), and a ladder only by `defineLadder`.
 *
 * @example
 * ```ts
 * import { DEFAULT_LADDER, OPERATOR, tierGate } from "./tier.ts";
 * tierGate(DEFAULT_LADDER, OPERATOR, DEFAULT_LADDER.default).kind; // "hidden"
 * ```
 *
 * @module
 */
import { absurd, err, ok, refine, string, type Brand, type Result } from "@intellectual-frontiers/core";

/** The name of a tier: lower-case words joined by hyphens, made only by `parseTierName`. */
export type TierName = Brand<string, "tier name">;

const tierDecoder = refine(string, "tier name", (t) => /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(t));

/** A tier name from text, or why the text is not one: the one way a `TierName` is made. */
export function parseTierName(text: string): Result<TierName, string> {
  const r = tierDecoder(text, "tier");
  return r.kind === "ok" ? ok(r.value) : err(`${JSON.stringify(text)} is not a tier name: lower-case words joined by hyphens`);
}

/** A tier name that is a literal of this library, known to be well formed. */
function literalTier(text: string): TierName {
  const r = parseTierName(text);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
}

/** The lowest tier of the default ladder: what every caller may see. */
export const PUBLIC: TierName = literalTier("public");
/** The middle tier of the default ladder. */
export const OPERATOR: TierName = literalTier("operator");
/** The highest tier of the default ladder. */
export const ADMINISTRATOR: TierName = literalTier("administrator");

/** The tiers a program declares, lowest first, and the tier of a caller who says nothing. Data: a program may declare its own. */
export type TierLadder = {
  readonly ladder: readonly TierName[];
  /** The tier held by a caller whose surface does not say; one of `ladder`. */
  readonly default: TierName;
};

/** The ladder of a program that declares none: public, operator, administrator; the caller who says nothing is public. */
export const DEFAULT_LADDER: TierLadder = { ladder: [PUBLIC, OPERATOR, ADMINISTRATOR], default: PUBLIC };

/** What is wrong with a ladder. */
export type LadderProblem =
  | { readonly rule: "tier/name"; readonly name: string; readonly message: string }
  | { readonly rule: "tier/empty" }
  | { readonly rule: "tier/duplicate"; readonly name: string }
  | { readonly rule: "tier/default-unknown"; readonly name: string };

/** A ladder from names, lowest first, and the default (the lowest where none is given), or everything wrong with it. */
export function defineLadder(names: readonly string[], defaultName?: string): Result<TierLadder, readonly LadderProblem[]> {
  const problems: LadderProblem[] = [];
  const tiers: TierName[] = [];
  for (const n of names) {
    const t = parseTierName(n);
    if (t.kind === "err") problems.push({ rule: "tier/name", name: n, message: t.error });
    else if (tiers.includes(t.value)) problems.push({ rule: "tier/duplicate", name: n });
    else tiers.push(t.value);
  }
  const first = tiers[0];
  if (names.length === 0 || first === undefined) {
    if (names.length === 0) problems.push({ rule: "tier/empty" });
    return err(problems);
  }
  const wanted = defaultName ?? first;
  const chosen = tiers.find((t) => t === wanted);
  if (chosen === undefined) problems.push({ rule: "tier/default-unknown", name: wanted });
  return problems.length > 0 || chosen === undefined ? err(problems) : ok({ ladder: tiers, default: chosen });
}

/** Why an action is not visible to a caller. */
export type TierRefusal = "tier-too-low" | "tier-unknown";

/** Whether an action is visible to a caller of a tier, and where it is not, why. */
export type TierDecision =
  | { readonly kind: "visible" }
  | { readonly kind: "hidden"; readonly reason: "tier-too-low"; readonly required: TierName; readonly held: TierName }
  | { readonly kind: "hidden"; readonly reason: "tier-unknown"; readonly unknown: TierName; readonly required: TierName; readonly held: TierName };

/**
 * The gate: whether a caller who holds `held` may see an action that needs `required`, on a ladder. A caller sees an action whose tier is at or below its own; a tier that is not on
 * the ladder (the action's or the caller's) hides the action, and says which. Pure: the same three values always give the same answer.
 */
export function tierGate(ladder: TierLadder, required: TierName, held: TierName): TierDecision {
  const need = ladder.ladder.indexOf(required);
  const have = ladder.ladder.indexOf(held);
  if (need < 0) return { kind: "hidden", reason: "tier-unknown", unknown: required, required, held };
  if (have < 0) return { kind: "hidden", reason: "tier-unknown", unknown: held, required, held };
  return have >= need ? { kind: "visible" } : { kind: "hidden", reason: "tier-too-low", required, held };
}

/** Whether the gate lets the caller see it. */
export function isVisible(d: TierDecision): boolean {
  switch (d.kind) {
    case "visible":
      return true;
    case "hidden":
      return false;
    default:
      return absurd(d);
  }
}

/** One sentence for a refusal, for a surface that tells the caller why. */
export function tierMessage(actionId: string, d: Extract<TierDecision, { kind: "hidden" }>): string {
  switch (d.reason) {
    case "tier-too-low":
      return `${actionId} is for the tier ${d.required}; this caller holds ${d.held}`;
    case "tier-unknown":
      return `${actionId} cannot be shown: the tier ${d.unknown} is not on the ladder of this program`;
    default:
      return absurd(d);
  }
}
