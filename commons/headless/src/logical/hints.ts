// Spec: 0003-headless-output FR-009
/**
 * The cadence of hints as a pure function (commons headless 0003-headless-output FR-009): an optional feature that is merely off is a hint, not a
 * problem, and the same hint is shown at most once in seven days. Given when each hint was last shown and the time now, which are due and when
 * each is remembered to have been shown; reading and writing that memory is the surface's.
 *
 * @example
 * ```ts
 * import { hintsDue, HINT_DAYS } from "./hints.ts";
 * const day = 86_400_000;
 * hintsDue({ a: 0 }, [{ id: "a", message: "A is off" }], HINT_DAYS * day - 1).due.length; // 0
 * hintsDue({ a: 0 }, [{ id: "a", message: "A is off" }], HINT_DAYS * day).due.length; // 1
 * ```
 *
 * @module
 */
import type { Hint } from "./outcome.ts";

/** How long a hint stays quiet after it was shown. */
export const HINT_DAYS = 7;

const DAY_MS = 86_400_000;

/** When each hint was last shown, by id, in milliseconds. */
export type HintMemory = Readonly<Record<string, number>>;

/** The hints that are due, and the memory once they are shown. */
export type HintsDue = { readonly due: readonly Hint[]; readonly memory: HintMemory };

/**
 * The hints due at `now`: those never shown, or shown seven days ago or more; each hint once even if a run raised it twice. The memory is the one
 * given with the due hints set to `now`, and is the same object where none is due (so that nothing is written for nothing).
 */
export function hintsDue(memory: HintMemory, hints: readonly Hint[], now: number): HintsDue {
  const due: Hint[] = [];
  for (const h of hints) {
    if (due.some((d) => d.id === h.id)) continue;
    const last = memory[h.id];
    if (last === undefined || now - last >= HINT_DAYS * DAY_MS) due.push(h);
  }
  if (due.length === 0) return { due, memory };
  return { due, memory: { ...memory, ...Object.fromEntries(due.map((h) => [h.id, now])) } };
}

/** The hints with a repeated id once, the first of each (what verbose mode shows: every hint, every time, but not twice in one run). */
export function distinctHints(hints: readonly Hint[]): readonly Hint[] {
  return hints.filter((h, i) => hints.findIndex((x) => x.id === h.id) === i);
}
