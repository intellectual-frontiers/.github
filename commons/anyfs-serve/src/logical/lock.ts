// Spec: 0003-anyfs-serve-logical FR-006, FR-007
/**
 * The table of locks, in memory: exclusive write locks of a depth of 0 or infinity, with a token, an owner and a time at which each ends. Nothing is shared between servers, and a lock that ends is gone the next
 * time anyone asks, so no timer runs. A caller holds a lock by submitting its token; a request that changes a resource a lock covers, without the token, is refused with `423`.
 *
 * @example
 * ```ts
 * import { newLockTable } from "./lock.ts";
 * const table = newLockTable(() => 0, { maxSeconds: 3600, maxLocks: 10 });
 * const made = table.create({ path: "/a" as never, depth: "0", owner: "<D:href>me</D:href>", seconds: 60 });
 * made.kind; // "ok"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { isBelow, type PosixPath } from "@intellectual-frontiers/anyfs-posix/governance";

/** How far a lock reaches: the resource, or it and everything below. */
export type LockDepth = "0" | "infinity";

/** One lock. */
export type Lock = { readonly token: string; readonly path: PosixPath; readonly depth: LockDepth; readonly owner: string; readonly expires: number; readonly seconds: number };

/** What a lock is asked for. */
export type LockRequest = { readonly path: PosixPath; readonly depth: LockDepth; readonly owner: string; readonly seconds: number };

/** Why a lock is not made or changed. */
export type LockProblem = { readonly kind: "locked"; readonly by: Lock } | { readonly kind: "full" } | { readonly kind: "unknown-token" };

/** The table. */
export type LockTable = {
  /** Locks the resource, unless a lock covers it or a lock below it would be covered. */
  create(request: LockRequest): Result<Lock, LockProblem>;
  /** Moves the end of a lock to now plus the seconds (at most the limit). */
  refresh(token: string, seconds: number): Result<Lock, LockProblem>;
  /** Releases a lock held at a resource. */
  release(token: string, path: PosixPath): Result<void, LockProblem>;
  /** The locks that cover a resource: at it, or above it with a depth of infinity. */
  covering(path: PosixPath): readonly Lock[];
  /** The locks at or below a resource. */
  below(path: PosixPath): readonly Lock[];
  /** The first lock a change of the resource would break, given the tokens the caller submitted; with `subtree`, the locks below it count too. */
  blocking(path: PosixPath, submitted: ReadonlySet<string>, subtree: boolean): Lock | undefined;
  /** What a token is a lock of, if it is still one. */
  find(token: string): Lock | undefined;
  /** Forgets the locks at or below a resource (it was deleted or moved). */
  drop(path: PosixPath): void;
};

/** An empty table with a clock; the clock is read each time, so a test sets the time. */
export function newLockTable(now: () => number, limits: { readonly maxSeconds: number; readonly maxLocks: number }): LockTable {
  const locks = new Map<string, Lock>();
  const live = (): void => {
    const t = now();
    for (const [k, l] of locks) if (l.expires <= t) locks.delete(k);
  };
  const clamp = (seconds: number): number => Math.max(1, Math.min(limits.maxSeconds, Math.floor(seconds)));
  const covers = (l: Lock, path: PosixPath): boolean => l.path === path || (l.depth === "infinity" && isBelow(l.path, path));
  const underOrAt = (l: Lock, path: PosixPath): boolean => l.path === path || isBelow(path, l.path);
  return {
    create(request) {
      live();
      for (const l of locks.values()) {
        if (covers(l, request.path)) return err({ kind: "locked", by: l });
        if (request.depth === "infinity" && underOrAt(l, request.path)) return err({ kind: "locked", by: l });
      }
      if (locks.size >= limits.maxLocks) return err({ kind: "full" });
      const seconds = clamp(request.seconds);
      const token = `opaquelocktoken:${globalThis.crypto.randomUUID()}`;
      const lock: Lock = { token, path: request.path, depth: request.depth, owner: request.owner, expires: now() + seconds * 1000, seconds };
      locks.set(token, lock);
      return ok(lock);
    },
    refresh(token, seconds) {
      live();
      const l = locks.get(token);
      if (l === undefined) return err({ kind: "unknown-token" });
      const s = clamp(seconds);
      const next: Lock = { ...l, expires: now() + s * 1000, seconds: s };
      locks.set(token, next);
      return ok(next);
    },
    release(token, path) {
      live();
      const l = locks.get(token);
      if (l === undefined || !covers(l, path)) return err({ kind: "unknown-token" });
      locks.delete(token);
      return ok(undefined);
    },
    covering(path) {
      live();
      return [...locks.values()].filter((l) => covers(l, path));
    },
    below(path) {
      live();
      return [...locks.values()].filter((l) => underOrAt(l, path));
    },
    blocking(path, submitted, subtree) {
      live();
      for (const l of locks.values()) {
        if (submitted.has(l.token)) continue;
        if (covers(l, path) || (subtree && underOrAt(l, path))) return l;
      }
      return undefined;
    },
    find(token) {
      live();
      return locks.get(token);
    },
    drop(path) {
      for (const [k, l] of locks) if (underOrAt(l, path)) locks.delete(k);
    },
  };
}
