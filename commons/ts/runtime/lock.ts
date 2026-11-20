/**
 * One run at a time (commons 0005-typescript-runtime FR-039): a lock file made only where none exists (`O_EXCL`, which every file system
 * and operating system gives atomically, where `flock` has no `node:` form), holding who holds it (process id, command, since when). A
 * waiting run polls until it is free, says once who it waits for, and takes over a lock whose holder's process no longer runs. A child of
 * a holder can inherit the lock through an environment variable instead of waiting for its own parent. Taken from Stolos's
 * `src/archon/core/lock.ts`, which locked through the runtime's own file lock.
 *
 * @example
 * ```ts
 * import { acquireLock } from "./lock.ts";
 * const held = await acquireLock("/run/app.lock", { wait: true, command: "update", onWait: (h) => console.log(`waiting for ${h?.command}`) });
 * try {
 *   // the work
 * } finally {
 *   held?.release();
 * }
 * ```
 *
 * @module
 */
import * as nfs from "node:fs";
import process from "node:process";
import { type Decoder, integer, json, object, string } from "@intellectual-frontiers/core";
import { AlreadyExists, mapError, NotFound } from "./errors.ts";
import { readTextFile, remove, writeTextFile } from "./fs.ts";
import { sleep } from "./proc.ts";

/** Who holds a lock. */
export type Holder = { readonly pid: number; readonly command: string; readonly since: string; readonly token: string };

const holderDecoder: Decoder<Holder> = object({ pid: integer, command: string, since: string, token: string });

/** How to take a lock. */
export type LockOptions = {
  /** Wait until it is free (polling), or give up at once. */
  readonly wait: boolean;
  /** What the holder runs, said to whoever waits. */
  readonly command?: string;
  /** Called once, with the holder where it can be read, when the lock is not free. */
  readonly onWait?: (holder: Holder | undefined) => void;
  /** How often a waiting run looks again (250 ms by default). */
  readonly pollMs?: number;
  /** The variable that says a parent already holds the lock (no variable by default); it is set while the lock is held. */
  readonly inheritEnv?: string;
  /** How long a waiting run waits before it gives up and returns nothing (no limit by default). */
  readonly timeoutMs?: number;
};

/** A lock taken. */
export type Held = {
  /** Who holds it: this process. */
  readonly holder: Holder;
  /** The lock given back (the file removed where it is still this holder's); safe to call twice. */
  release(): void;
};

/** Whether a process runs: a signal of 0 checks without sending one. A process of another account counts as running. */
export function processRuns(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e instanceof Error && "code" in e && e.code === "EPERM";
  }
}

/** Who holds the lock at `path`, where its file can be read; whether that process still runs is not checked here. */
export async function readHolder(path: string): Promise<Holder | undefined> {
  try {
    const r = json(await readTextFile(path), holderDecoder);
    return r.kind === "ok" ? r.value : undefined;
  } catch {
    return undefined;
  }
}

/** A holder as a person reads it: `update (pid 4242, for 3m 12s)`. */
export function describeHolder(h: Holder, now: number = Date.now()): string {
  const secs = Math.max(0, Math.round((now - Date.parse(h.since)) / 1000));
  const age = secs >= 60 ? `${Math.floor(secs / 60)}m ${secs % 60}s` : `${secs}s`;
  return `${h.command} (pid ${h.pid}, for ${age})`;
}

/**
 * The lock at `path` taken, or undefined where it is held by a running process and `wait` is false (or `timeoutMs` passed). A lock whose
 * holder no longer runs, or whose file cannot be read, is taken over. Where `inheritEnv` is set in the environment, a parent holds it,
 * and it is given at once (its release does nothing).
 */
export async function acquireLock(path: string, options: LockOptions): Promise<Held | undefined> {
  const holder: Holder = {
    pid: process.pid,
    command:
      options.command ??
      (process.argv
        .slice(2)
        .filter((a) => !a.startsWith("-"))
        .slice(0, 3)
        .join(" ") ||
        "a run"),
    since: new Date().toISOString(),
    token: crypto.randomUUID(),
  };
  const inherit = options.inheritEnv;
  if (inherit !== undefined && process.env[inherit] === "1") return { holder, release: () => {} };
  const started = Date.now();
  let told = false;
  for (;;) {
    try {
      await writeTextFile(path, `${JSON.stringify(holder)}\n`, { createNew: true, mode: 0o644 });
      break;
    } catch (e) {
      if (!(e instanceof AlreadyExists)) throw e;
    }
    const current = await readHolder(path);
    if (current === undefined || !processRuns(current.pid)) {
      const again = await readHolder(path);
      if (again?.token === current?.token)
        await remove(path).catch((e: unknown) => {
          if (!(e instanceof NotFound)) throw e;
        });
      continue;
    }
    if (!options.wait) return undefined;
    if (options.timeoutMs !== undefined && Date.now() - started >= options.timeoutMs) return undefined;
    if (!told) {
      options.onWait?.(current);
      told = true;
    }
    await sleep(options.pollMs ?? 250);
  }
  if (inherit !== undefined) process.env[inherit] = "1";
  let released = false;
  const release = (): void => {
    if (released) return;
    released = true;
    if (inherit !== undefined) Reflect.deleteProperty(process.env, inherit);
    process.off("exit", release);
    try {
      const text = nfs.readFileSync(path, "utf8");
      if (text.includes(holder.token)) nfs.unlinkSync(path);
    } catch (e) {
      const mapped = mapError(e, path);
      if (!(mapped instanceof NotFound)) throw mapped;
    }
  };
  process.on("exit", release);
  return { holder, release };
}
