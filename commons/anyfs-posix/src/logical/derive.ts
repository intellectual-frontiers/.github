// Spec: 0003-anyfs-posix-logical FR-005
/**
 * Directories, derived: a store has objects and no directories, so a directory exists where an object lies below it, and its names are the first segments of the paths below it. A name that is an object
 * and also the first segment of other paths is shown as a file and the other paths are noticed. The marker objects of a policy that keeps empty directories keep a directory but are not names in it.
 *
 * @example
 * ```ts
 * import { childrenOf } from "./derive.ts";
 * // childrenOf(prefix, stats, policy): the names below a prefix, in order, whether the directory exists, and what was noticed
 * ```
 *
 * @module
 */
import { comparePaths, type Path, type Prefix, relativeTo } from "@intellectual-frontiers/anyfs/governance";
import type { Stat } from "@intellectual-frontiers/anyfs/logical";
import type { DirEntry, Policy } from "@intellectual-frontiers/anyfs-posix/governance";

/** What a directory holds. */
export type Children = {
  /** Whether the directory exists: an object lies below it, a marker included. */
  readonly exists: boolean;
  /** The names, in the order of their code points. */
  readonly entries: readonly DirEntry[];
  /** What was noticed. */
  readonly notes: readonly string[];
};

/** Whether a path is a marker object of the policy: an object of the marker's name, at any depth. */
export function isMarker(policy: Policy, path: Path): boolean {
  if (policy.markers.kind !== "keep") return false;
  const name = policy.markers.name as string;
  return path === name || path.endsWith(`/${name}`);
}

/** The names below a prefix, from the objects below it (all of them: a list of the prefix, in any order). */
export function childrenOf(dir: Prefix, below: readonly Stat[], policy: Policy): Children {
  type Slot = { file?: Stat; dirs: number };
  const slots = new Map<string, Slot>();
  let exists = false;
  const notes: string[] = [];
  for (const stat of below) {
    const rel = relativeTo(dir, stat.path);
    if (rel === undefined) continue;
    exists = true;
    if (isMarker(policy, stat.path) && !rel.includes("/")) continue;
    const slash = rel.indexOf("/");
    const name = slash < 0 ? rel : rel.slice(0, slash);
    const slot = slots.get(name) ?? { dirs: 0 };
    if (slash < 0) slots.set(name, { ...slot, file: stat });
    else slots.set(name, { ...slot, dirs: slot.dirs + 1 });
  }
  const entries: DirEntry[] = [];
  for (const name of [...slots.keys()].sort(comparePaths)) {
    const slot = slots.get(name);
    if (slot === undefined) continue;
    if (slot.file !== undefined) {
      if (slot.dirs > 0) notes.push(`${name} is an object and also the start of ${slot.dirs} other path(s): it is shown as a file and the others are not reachable through it`);
      entries.push({ name, type: "file", size: slot.file.size, rev: slot.file.rev, ...(slot.file.modified === undefined ? {} : { mtime: slot.file.modified }) });
    } else {
      entries.push({ name, type: "dir" });
    }
  }
  return { exists, entries, notes };
}
