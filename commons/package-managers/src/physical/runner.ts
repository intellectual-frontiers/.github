// Spec: 0004-package-managers-dialect FR-004
/**
 * The runner: a program asked something under a limit of time, answering with its exit status and what it printed, or nothing where it could not be run (no such program, a hang). A program that has
 * started others that keep its output open still answers at the limit and never holds the caller.
 *
 * @example
 * ```ts
 * import { runWithin } from "./runner.ts";
 * await runWithin(5000)(["dpkg-query", "-W", "git"]); // { status: 0, stdout: "..." } or undefined
 * ```
 *
 * @module
 */
import * as proc from "@intellectual-frontiers/system/proc";

/** What a program said. */
export type Said = { readonly status: number; readonly stdout: string };

/** Runs a command line and says what it said, or nothing where it could not be run. */
export type Run = (argv: readonly string[]) => Promise<Said | undefined>;

/** A `Run` that gives a program `ms` milliseconds and then stops it. */
export function runWithin(ms: number): Run {
  return async (argv) => {
    const stop = new AbortController();
    const timers: ReturnType<typeof setTimeout>[] = [setTimeout(() => stop.abort(), ms)];
    try {
      const done = proc.run(argv, { signal: stop.signal, killAfterMs: 200 }).then(
        (out): Said | undefined => (out.signal === null || out.signal === undefined ? { status: out.code, stdout: out.stdout } : undefined),
        () => undefined,
      );
      const limit = new Promise<undefined>((resolve) => timers.push(setTimeout(() => resolve(undefined), ms + 300)));
      return await Promise.race([done, limit]);
    } finally {
      for (const t of timers) clearTimeout(t);
    }
  };
}
