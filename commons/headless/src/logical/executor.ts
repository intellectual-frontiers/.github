// Spec: 0005-reach-and-targets FR-004, FR-009
/**
 * Where a command runs, as a port (commons headless 0005-reach-and-targets FR-004): an `Executor` takes an argument vector and options and gives how the program
 * ended, in the shapes of the system's `proc` (`RunOptions` and `Output`, the same fields, so that the system's own functions are executors without a
 * wrapper). The command is defined once; `local` runs it here and `ssh` on a target, and what is told about it is the same either way. Also here, the bounded
 * fan-out over several targets: a cap on how many run at once, a time for each, and a partial failure that is neither a success nor a crash.
 *
 * @example
 * ```ts
 * import { fanOut } from "./executor.ts";
 * const rows = await fanOut(["a", "b"], async (id) => id.toUpperCase(), { concurrency: 1, perHostTimeoutMs: 1000 });
 * rows.map((r) => r.kind); // ["done", "done"]
 * ```
 *
 * @module
 */

/** Where a program's output goes: kept, shared with this process, or thrown away (the system's `Stdio`). */
export type ExecStdio = "piped" | "inherit" | "null";

/** What a program is run with: the same fields as the system's `RunOptions`. */
export type RunOptions = {
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly clearEnv?: boolean;
  readonly input?: string | Uint8Array;
  readonly stdin?: "inherit" | "null";
  readonly stdout?: ExecStdio;
  readonly stderr?: ExecStdio;
  readonly onLine?: (stream: "stdout" | "stderr", line: string) => void;
  readonly signal?: AbortSignal;
  readonly killAfterMs?: number;
};

/** How a program ended: the same fields as the system's `Output`. */
export type Output = {
  readonly code: number;
  readonly success: boolean;
  readonly signal: string | null;
  readonly stdout: Uint8Array;
  readonly stderr: Uint8Array;
};

/** Runs a program, here or elsewhere: `exec(argv, opts) -> Output`. */
export type Executor = { exec(argv: readonly string[], opts?: RunOptions): Promise<Output> };

/** The executor for a target by its id, where there is one. */
export type ExecutorFor = (targetId: string) => Executor | undefined;

/** The text of an output stream. */
export function textOf(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/** What fan-out gives for one item: its value, a time out, or what it threw. */
export type Fanned<T> =
  | { readonly kind: "done"; readonly id: string; readonly value: T }
  | { readonly kind: "timeout"; readonly id: string }
  | { readonly kind: "failed"; readonly id: string; readonly message: string };

/** How a fan-out is bounded. */
export type FanOutLimits = {
  /** The most that run at once; at least 1. */
  readonly concurrency: number;
  /** How long each may take; it is given an aborted signal at the end of it. */
  readonly perHostTimeoutMs: number;
};

/**
 * Runs `work` for each id with at most `concurrency` at once and at most `perHostTimeoutMs` each, and gives one row for each id in the order of the ids: its value,
 * that it timed out, or that it threw. The rows are never fewer than the ids, so that one host that hangs or fails does not take the others with it.
 */
export async function fanOut<T>(
  ids: readonly string[],
  work: (id: string, signal: AbortSignal) => Promise<T>,
  limits: FanOutLimits,
): Promise<readonly Fanned<T>[]> {
  const rows: Fanned<T>[] = new Array<Fanned<T>>(ids.length);
  let next = 0;
  const one = async (): Promise<void> => {
    for (;;) {
      const i = next;
      next += 1;
      const id = ids[i];
      if (id === undefined) return;
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const late = new Promise<"timeout">((resolve) => {
        timer = setTimeout(() => {
          controller.abort(new Error(`${id} took longer than ${limits.perHostTimeoutMs} ms`));
          resolve("timeout");
        }, limits.perHostTimeoutMs);
      });
      try {
        const r = await Promise.race([work(id, controller.signal).then((value) => ({ value })), late]);
        rows[i] = r === "timeout" ? { kind: "timeout", id } : { kind: "done", id, value: r.value };
      } catch (e) {
        rows[i] = { kind: "failed", id, message: e instanceof Error ? e.message : String(e) };
      } finally {
        if (timer !== undefined) clearTimeout(timer);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(Math.floor(limits.concurrency), ids.length || 1)) }, () => one()));
  return rows;
}
