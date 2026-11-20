// Spec: 0004-headless-cli FR-009
/**
 * A run stopped by the person or the system (commons headless 0004-headless-cli FR-009): SIGINT ends it with 130 and SIGTERM with 143, the statuses a
 * shell already reads as "killed by a signal"; the command is told to stop through an `AbortSignal`, the run's cleanup runs once, and the run
 * ends with the stop mark and the word Stopped instead of with a failure. The signals come through a port, so a test sends them.
 *
 * @example
 * ```ts
 * import { guarded } from "./signals.ts";
 * const r = await guarded(undefined, new AbortController(), Promise.resolve(7));
 * r; // { kind: "done", value: 7 }
 * ```
 *
 * @module
 */
import { exitOfSignal } from "@intellectual-frontiers/headless/governance";
import type { SignalPort, StopSignal } from "./io.ts";

/** How guarded work ended: it finished, or a signal came first. */
export type Guarded<T> = { readonly kind: "done"; readonly value: T } | { readonly kind: "stopped"; readonly signal: StopSignal; readonly code: number };

const SIGNALS: readonly StopSignal[] = ["SIGINT", "SIGTERM"];

/**
 * Races the work against the signals: the first signal aborts `controller` (so that the work can stop itself) and ends the race with its status; where
 * the work ends first, the listeners are removed. The work is left to finish on its own after a signal; the caller does not wait for it.
 */
export async function guarded<T>(port: SignalPort | undefined, controller: AbortController, work: Promise<T>): Promise<Guarded<T>> {
  if (port === undefined) return { kind: "done", value: await work };
  const off: (() => void)[] = [];
  const stop = new Promise<Guarded<T>>((resolve) => {
    for (const s of SIGNALS) {
      off.push(
        port.on(s, () => {
          controller.abort(new Error(`stopped by ${s}`));
          resolve({ kind: "stopped", signal: s, code: exitOfSignal(s) });
        }),
      );
    }
  });
  try {
    return await Promise.race([work.then((value): Guarded<T> => ({ kind: "done", value })), stop]);
  } finally {
    for (const f of off) f();
  }
}
