// Spec: 0002-anyfs-posix-governance FR-005
/**
 * What a program decides about the view before it opens it: whether an empty directory is kept (and as which marker object), who the objects belong to and with which mode, whether the ancestors of a
 * new object are checked, how much a read cache may hold and how many times an append tries again. The policy is a value, made by smart constructors and held by the view, so that two views of one
 * store can differ and nothing is read from the process.
 *
 * @example
 * ```ts
 * import { defaultPolicy, keepMarkers } from "./policy.ts";
 * defaultPolicy().markers.kind; // "none": an empty directory is not kept
 * const m = keepMarkers(".keep");
 * m.kind === "ok" && m.value.kind; // "keep"
 * ```
 *
 * @module
 */
import { type Brand, err, ok, type Result } from "@intellectual-frontiers/core";
import { parsePath } from "@intellectual-frontiers/anyfs/governance";

/** The name of the marker object that keeps a directory: one segment of a path. Made only by `parseMarkerName`. */
export type MarkerName = Brand<string, "anyfs posix marker name">;

/** The name of a marker, or why the text is not one: one segment, which a path can hold. */
export function parseMarkerName(text: string): Result<MarkerName, string> {
  if (text.includes("/")) return err(`${JSON.stringify(text)} is not one name: a marker is one segment`);
  const p = parsePath(text);
  return p.kind === "ok" ? ok(p.value as string as MarkerName) : err(p.error);
}

/** Whether an empty directory is kept: not at all, or as an empty object of this name below it. */
export type Markers = { readonly kind: "none" } | { readonly kind: "keep"; readonly name: MarkerName };

/** Keeping empty directories as marker objects of a name. */
export function keepMarkers(name: string): Result<Markers, string> {
  const n = parseMarkerName(name);
  return n.kind === "ok" ? ok({ kind: "keep", name: n.value }) : n;
}

/** Whom an object belongs to and with which mode, for a view that has no such thing in its store: a number each. */
export type Ownership = { readonly uid: number; readonly gid: number; readonly fileMode: number; readonly dirMode: number };

/** The owner of everything, root, and the modes of a file system's usual defaults. */
export const DEFAULT_OWNERSHIP: Ownership = { uid: 0, gid: 0, fileMode: 0o644, dirMode: 0o755 };

/** An ownership from numbers, or why they are not one: whole numbers from 0, and modes of at most four octal digits. */
export function parseOwnership(uid: number, gid: number, fileMode: number, dirMode: number): Result<Ownership, string> {
  const whole = (n: number, max: number): boolean => Number.isInteger(n) && n >= 0 && n <= max;
  if (!whole(uid, 0xffffffff) || !whole(gid, 0xffffffff)) return err("an owner and a group are whole numbers from 0");
  if (!whole(fileMode, 0o7777) || !whole(dirMode, 0o7777)) return err("a mode is a whole number of at most four octal digits");
  return ok({ uid, gid, fileMode, dirMode });
}

/** Whether the directories above a new object are checked to be directories (`check`: a stat for each), or trusted (`trust`: none). */
export type AncestorChecks = "check" | "trust";

/** What the view is told. */
export type Policy = {
  readonly markers: Markers;
  readonly ownership: Ownership;
  readonly ancestors: AncestorChecks;
  /** The most bytes the read cache holds; 0 holds none. */
  readonly readCacheBytes: number;
  /** How many entries a list is asked for at a time. */
  readonly listPage: number;
  /** How many times an append reads and writes again after another writer changed the object. */
  readonly appendAttempts: number;
};

/** The default policy: no markers, the default ownership, the ancestors checked, 8 MiB of cache, pages of 1000 and 5 attempts. */
export function defaultPolicy(): Policy {
  return { markers: { kind: "none" }, ownership: DEFAULT_OWNERSHIP, ancestors: "check", readCacheBytes: 8 * 1024 * 1024, listPage: 1000, appendAttempts: 5 };
}

/** A policy with changes, or why they make none: the sizes are whole numbers, the page at least 1 and the attempts at least 1. */
export function withPolicy(base: Policy, changes: Partial<Policy>): Result<Policy, string> {
  const next = { ...base, ...changes };
  if (!Number.isInteger(next.readCacheBytes) || next.readCacheBytes < 0) return err("the read cache holds a whole number of bytes, 0 or more");
  if (!Number.isInteger(next.listPage) || next.listPage < 1) return err("a list page is a whole number, 1 or more");
  if (!Number.isInteger(next.appendAttempts) || next.appendAttempts < 1) return err("an append tries a whole number of times, 1 or more");
  return ok(next);
}
