// Spec: 0001-system FR-015
/**
 * One run at a time (commons 0001-system FR-015): a lock file made only where none exists (`O_EXCL`, which every file system
 * and operating system gives atomically, where `flock` has no `node:` form), holding who holds it (process id, command, since when). A
 * waiting run polls until it is free, says once who it waits for, and takes over a lock whose holder's process no longer runs. A child of
 * a holder can inherit the lock through an environment variable instead of waiting for its own parent.
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
import { AlreadyExists, mapError, NotFound, RuntimeError } from "./errors.ts";
import { link, readTextFile, remove, rename, stat, writeTextFile } from "./fs.ts";
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
  /** How old a lock file that cannot be read must be before it counts as abandoned (2 s by default): a file just made by a run that has not finished writing it is not. */
  readonly unreadableGraceMs?: number;
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

/** How old a lock file that cannot be read must be before it is taken as abandoned. */
const UNREADABLE_GRACE_MS = 2000;

/** How old the guard of a takeover must be before it is taken as left by a run that died. */
const GUARD_STALE_MS = 10_000;

/** When the file at `path` was last changed, in milliseconds, or undefined where it is gone. */
async function modifiedAt(path: string): Promise<number | undefined> {
  try {
    const info = await stat(path);
    return info.mtime === null ? Date.now() : info.mtime.getTime();
  } catch (e) {
    if (e instanceof NotFound) return undefined;
    throw e;
  }
}

/** Whether a lock is abandoned: its holder's process no longer runs, or its file cannot be read and has not been written to for `grace`. */
function isAbandoned(holder: Holder | undefined, modified: number, grace: number, now: number = Date.now()): boolean {
  return holder === undefined ? now - modified >= grace : !processRuns(holder.pid);
}

/**
 * The lock file put in place whole, or not at all: the holder is written to a file of its own and given the name of the lock by a hard link, which every file
 * system that has links does atomically and refuses where the name is taken, so that no run ever reads a lock that is half written. Where links are not
 * given (some network and removable file systems), the lock file is made where none exists and written after.
 */
async function publish(path: string, holder: Holder): Promise<"made" | "taken"> {
  const text = `${JSON.stringify(holder)}\n`;
  const own = `${path}.${holder.token}.tmp`;
  await writeTextFile(own, text, { createNew: true, mode: 0o644 });
  try {
    await link(own, path);
    return "made";
  } catch (e) {
    if (e instanceof AlreadyExists) return "taken";
    if (!(e instanceof RuntimeError)) throw e;
  } finally {
    await remove(own).catch(() => undefined);
  }
  try {
    await writeTextFile(path, text, { createNew: true, mode: 0o644 });
    return "made";
  } catch (e) {
    if (e instanceof AlreadyExists) return "taken";
    throw e;
  }
}

/**
 * An abandoned lock removed by one run at a time: a run that sees one makes the guard `<lock>.takeover` where none exists, reads the lock again (a run that
 * took it in the meantime is a live holder and is left alone) and removes it only if it is still abandoned; a run that finds the guard waits for it, and takes
 * over a guard that a run which died left.
 */
async function takeOver(path: string, grace: number): Promise<"removed" | "busy"> {
  const guard = `${path}.takeover`;
  const mine = crypto.randomUUID();
  try {
    await writeTextFile(guard, `${mine}\n`, { createNew: true, mode: 0o644 });
  } catch (e) {
    if (!(e instanceof AlreadyExists)) throw e;
    const at = await modifiedAt(guard);
    if (at !== undefined && Date.now() - at >= GUARD_STALE_MS) {
      const dead = `${guard}.${mine}.dead`;
      try {
        await rename(guard, dead);
        await remove(dead).catch(() => undefined);
      } catch (r) {
        if (!(r instanceof NotFound)) throw r;
      }
    }
    return "busy";
  }
  try {
    const current = await readHolder(path);
    const modified = await modifiedAt(path);
    if (modified !== undefined && isAbandoned(current, modified, grace)) {
      await remove(path).catch((e: unknown) => {
        if (!(e instanceof NotFound)) throw e;
      });
    }
    return "removed";
  } finally {
    await remove(guard).catch(() => undefined);
  }
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
  const grace = options.unreadableGraceMs ?? UNREADABLE_GRACE_MS;
  let told = false;
  for (;;) {
    if ((await publish(path, holder)) === "made") break;
    const current = await readHolder(path);
    const modified = await modifiedAt(path);
    if (modified === undefined) continue;
    if (isAbandoned(current, modified, grace) && (await takeOver(path, grace)) === "removed") continue;
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
