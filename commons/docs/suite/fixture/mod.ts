/**
 * A fixture area for the generator's tests: one export of each kind the API reader knows, and a namespace (commons 0011-documentation
 * FR-010).
 *
 * @remarks
 * Its documentation cites commons 0011-documentation FR-010, a bare FR-011, and erga 009-machine-bootstrap, which stays text.
 *
 * @limits
 * It does nothing; it is read.
 *
 * @module
 */
export * as shapes from "./shapes.ts";

/** A greeting: what `greet` returns. */
export interface Greeting {
  /** Who is greeted. */
  readonly who: string;
  /** How warmly, from 0 to 1. */
  readonly warmth?: number;
}

/** A mood: calm or loud. */
export type Mood = { readonly kind: "calm" } | { readonly kind: "loud"; readonly volume: number };

/** The greeting everyone gets first. */
export const FIRST: Greeting = { who: "world" };

/**
 * A greeting for someone, made warmer by a mood. See {@link Greeting}.
 *
 * @param who - who to greet
 * @param mood - how
 * @returns the greeting
 * @example
 * ```ts
 * greet("Ada", { kind: "calm" }); // { who: "Ada", warmth: 0.5 }
 * ```
 */
export function greet(who: string, mood: Mood): Greeting {
  return { who, warmth: mood.kind === "calm" ? 0.5 : Math.min(1, mood.volume / 10) };
}
