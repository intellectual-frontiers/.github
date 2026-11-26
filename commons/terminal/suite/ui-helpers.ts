/**
 * Helpers of the tests of the guide (commons terminal 0002-ui): input scripted in chunks, an output that records what was written, a clock
 * that does not wait, and a machine that gives steps one at a time. Synthetic names only.
 *
 * @module
 */
import { atMost, type UiCaps, type UiClock, type UiIn, type UiLevel, type UiOut, lineReader } from "../src/ui.ts";

/** The capabilities of a level at a size, with emoji off. */
export function capsOf(level: UiLevel, columns = 60, rows = 24): UiCaps {
  return atMost({ level: "full", colourDepth: "16", colour: true, emoji: false, columns, rows }, level);
}

/** An input that gives `chunks` as they are (a line end may be split between two) and then ends. */
export function scriptedIn(chunks: readonly string[], isTTY = true): UiIn {
  async function* gen(): AsyncGenerator<string> {
    for (const c of chunks) yield c;
  }
  return lineReader(gen(), isTTY);
}

/** An input that gives nothing and never ends, until its signal aborts: a person who has not typed yet. */
export function silentIn(isTTY = true): UiIn {
  return lineReader(
    {
      [Symbol.asyncIterator]: () => ({ next: () => new Promise<IteratorResult<string>>(() => undefined) }),
    },
    isTTY,
  );
}

export type Recorder = UiOut & {
  columns: number;
  rows: number;
  readonly writes: string[];
  text(): string;
  resize(columns: number, rows: number): void;
};

/** An output that records every write, with a size that can change. */
export function recorder(columns = 60, rows = 24): Recorder {
  const listeners = new Set<() => void>();
  const r: Recorder = {
    columns,
    rows,
    writes: [],
    write(text: string) {
      r.writes.push(text);
    },
    text: () => r.writes.join(""),
    onResize(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    resize(c: number, rw: number) {
      r.columns = c;
      r.rows = rw;
      for (const l of listeners) l();
    },
  };
  return r;
}

/** A clock that does not wait: a sleep moves the time forward at once, and is recorded. */
export function fakeClock(): UiClock & { readonly sleeps: number[]; time(): number } {
  let t = 1_000_000;
  const sleeps: number[] = [];
  return {
    sleeps,
    time: () => t,
    now: () => t,
    sleep(ms: number, signal?: AbortSignal): Promise<void> {
      if (signal?.aborted !== true) {
        sleeps.push(ms);
        t += ms;
      }
      return Promise.resolve();
    },
  };
}

/** A machine that gives each of `steps` in turn, and the last one again after that. */
export function machine(steps: readonly unknown[]): { next(): Promise<unknown>; readonly taken: () => number } {
  let i = 0;
  return {
    next: () => Promise.resolve(steps[Math.min(i++, steps.length - 1)]),
    taken: () => i,
  };
}

/** Removes colour sequences, to compare what a person reads. */
export const bare = (s: string): string => s.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, "");
