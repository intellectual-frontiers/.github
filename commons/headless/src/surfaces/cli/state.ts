// Spec: 0004-headless-cli FR-007, FR-008, FR-014
/**
 * What a program remembers between runs, in its folder of state (commons headless 0004-headless-cli FR-007, FR-008, FR-014): the run log of every run,
 * pruned after thirty days, and when each hint was last shown. The folder is `<XDG_STATE_HOME>/<program>` as the system's `dirsOf` says (and
 * the folders of Windows' known folders there); where no home folder can be found there is none, and a run keeps no log and shows every hint, never a
 * guess. The files are reached through a port (`StateStore`), so that everything here is proved without a disk; the host binds it to the file system.
 *
 * @example
 * ```ts
 * import { logName, stateDirOf } from "./state.ts";
 * stateDirOf("tool", (n) => ({ HOME: "/home/a" })[n], "linux"); // "/home/a/.local/state/tool"
 * logName(Date.UTC(2026, 10, 20, 10, 56, 11), 42); // "20261120T105611-42.log"
 * ```
 *
 * @module
 */
import { dirs, path } from "@intellectual-frontiers/system";
import { distinctHints, hintsDue, HINT_DAYS, type Hint, type HintMemory } from "@intellectual-frontiers/headless/logical";

/** A file of a folder: its name and when it was last changed (milliseconds), where the system keeps it. */
export type StoredFile = { readonly name: string; readonly mtimeMs: number | undefined };

/** The files the program keeps, reached through a port: each operation is best effort and never throws (a hint shown twice is harmless; a lost log line is not a failure). */
export type StateStore = {
  readText(file: string): string | undefined;
  /** Writes the file, making its folders. */
  writeText(file: string, text: string): void;
  /** Adds to the end of the file, making it and its folders. */
  appendText(file: string, text: string): void;
  /** The files (not the folders) of a folder; none where it does not exist. */
  list(dir: string): readonly StoredFile[];
  remove(file: string): void;
};

/** How long a run log is kept. */
export const RUN_LOG_DAYS = 30;

const DAY_MS = 86_400_000;

/** The folder a program keeps its state in, or `undefined` where no home folder can be found. */
export function stateDirOf(app: string, env: (name: string) => string | undefined, os: dirs.Os): string | undefined {
  return dirs.dirsOf(app, env, os).state;
}

const joinFor = (os: dirs.Os, ...parts: readonly string[]): string => (os === "windows" ? path.win32 : path.posix).join(...parts);

/** The folder of the run logs. */
export function logDirOf(stateDir: string, os: dirs.Os): string {
  return joinFor(os, stateDir, "log");
}

/** The file that remembers when each hint was shown. */
export function hintsFileOf(stateDir: string, os: dirs.Os): string {
  return joinFor(os, stateDir, "hints.json");
}

/** The name of a run's log: its time to the second, and the process: `20261120T105611-42.log`. */
export function logName(now: number, pid: number): string {
  return `${new Date(now).toISOString().replace(/[:.-]/g, "").slice(0, 15)}-${pid}.log`;
}

/** Removes the run logs (`*.log`) of `dir` last changed more than `days` ago; gives the names removed. */
export function pruneLogs(store: StateStore, dir: string, os: dirs.Os, now: number, days = RUN_LOG_DAYS): readonly string[] {
  const gone: string[] = [];
  for (const f of store.list(dir)) {
    if (!f.name.endsWith(".log") || f.mtimeMs === undefined) continue;
    if (now - f.mtimeMs > days * DAY_MS) {
      store.remove(joinFor(os, dir, f.name));
      gone.push(f.name);
    }
  }
  return gone;
}

/** The newest run log of a folder, or `undefined`. */
export function lastLog(store: StateStore, dir: string, os: dirs.Os): string | undefined {
  let best: { readonly name: string; readonly at: number } | undefined;
  for (const f of store.list(dir)) {
    if (!f.name.endsWith(".log")) continue;
    const at = f.mtimeMs ?? 0;
    if (best === undefined || at >= best.at) best = { name: f.name, at };
  }
  return best === undefined ? undefined : joinFor(os, dir, best.name);
}

/** The hints' times, by id; empty where there is no file or it is not what it should be. */
export function readHints(store: StateStore, file: string): HintMemory {
  const text = store.readText(file);
  if (text === undefined) return {};
  try {
    const d: unknown = JSON.parse(text);
    const out: Record<string, number> = {};
    if (typeof d === "object" && d !== null && !Array.isArray(d)) {
      for (const [k, v] of Object.entries(d)) if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

/** Remembers the hints' times. */
export function writeHints(store: StateStore, file: string, memory: HintMemory): void {
  store.writeText(file, JSON.stringify(memory));
}

/**
 * The hints to show at the end of a run, by what the surface remembers (FR-008): every hint where there is no state (there is nothing to remember
 * it by), else those not shown in the last seven days, with their time written once they are shown. Quiet runs and verbose runs do not come here.
 */
export function dueHints(store: StateStore | undefined, file: string | undefined, hints: readonly Hint[], now: number): readonly Hint[] {
  if (store === undefined || file === undefined) return distinctHints(hints);
  const { due, memory } = hintsDue(readHints(store, file), hints, now);
  if (due.length > 0) writeHints(store, file, memory);
  return due;
}

/** A run's log: lines appended to one file, each with the time and a kind; it gives the number of the line it wrote, so that a problem can name its line. */
export class RunLog {
  readonly path: string;
  readonly #store: StateStore;
  readonly #now: () => number;
  #lines = 0;

  constructor(store: StateStore, path: string, now: () => number) {
    this.#store = store;
    this.path = path;
    this.#now = now;
  }

  /** Writes a line; the number of the line, from 1. */
  write(kind: string, text: string): number {
    this.#lines += 1;
    this.#store.appendText(this.path, `${new Date(this.#now()).toISOString()} ${kind.padEnd(8)} ${text.replace(/\r?\n/g, "\\n")}\n`);
    return this.#lines;
  }
}

export { HINT_DAYS };
