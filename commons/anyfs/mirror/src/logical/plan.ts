// Spec: 0003-mirror-logical FR-001, FR-002, FR-003, FR-004, FR-005
/**
 * The pure part of a mirror: which paths an operation changes, how two listings differ, what makes them the same, and what the mirror's own traits are. Nothing here reads a store: a listing is the entries a store
 * gave, so that the same inputs give the same answer in every backend.
 *
 * @example
 * ```ts
 * import { driftOf } from "./plan.ts";
 * // driftOf("replica", primaryEntries, secondaryEntries).missing: the paths the secondary lacks
 * ```
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import { comparePaths, type Path, type Revision, type Traits } from "@intellectual-frontiers/anyfs/governance";
import type { Op } from "@intellectual-frontiers/anyfs/logical";
import type { Drift } from "@intellectual-frontiers/anyfs-mirror/governance";

/** An object as a listing gives it: its path and its revision. */
export type Entry = { readonly path: Path; readonly rev: Revision };

/** One step that makes a secondary the same as the primary. */
export type Step = { readonly kind: "copy"; readonly path: Path } | { readonly kind: "remove"; readonly path: Path };

/** Whether an operation changes the store. */
export function isMutation(op: Op): boolean {
  switch (op.op) {
    case "write":
    case "delete":
    case "batch":
    case "rename":
    case "append":
      return true;
    case "read":
    case "stat":
    case "list":
    case "history":
    case "rangeRead":
    case "search":
    case "merge":
      return false;
    default:
      return absurd(op);
  }
}

/** The paths an operation changes, once each, in the order of the paths: none for an operation that reads. */
export function affectedPaths(op: Op): readonly Path[] {
  switch (op.op) {
    case "write":
    case "delete":
    case "append":
      return [op.path];
    case "rename":
      return [op.from, op.to].sort(comparePaths);
    case "batch":
      return [...new Set(op.changes.map((c) => c.path))].sort(comparePaths);
    case "read":
    case "stat":
    case "list":
    case "history":
    case "rangeRead":
    case "search":
    case "merge":
      return [];
    default:
      return absurd(op);
  }
}

const byPath = (list: readonly Entry[]): ReadonlyMap<string, Revision> => new Map(list.map((e) => [e.path as string, e.rev]));

/** How a secondary's listing differs from the primary's: what it lacks, what it holds at another revision and what it holds alone. */
export function driftOf(member: string, primary: readonly Entry[], secondary: readonly Entry[]): Drift {
  const mine = byPath(primary);
  const theirs = byPath(secondary);
  const missing: Path[] = [];
  const different: Path[] = [];
  const extra: Path[] = [];
  for (const e of primary) {
    const rev = theirs.get(e.path);
    if (rev === undefined) missing.push(e.path);
    else if (rev !== e.rev) different.push(e.path);
  }
  for (const e of secondary) if (!mine.has(e.path)) extra.push(e.path);
  return { member, missing: missing.sort(comparePaths), different: different.sort(comparePaths), extra: extra.sort(comparePaths) };
}

/** The steps that make a secondary the same as the primary: copy what it lacks or holds at another revision, remove what it holds alone; copies first, then removals, each in the order of the paths. */
export function stepsOf(drift: Drift): readonly Step[] {
  const copies = [...drift.missing, ...drift.different].sort(comparePaths).map((path): Step => ({ kind: "copy", path }));
  const removals = [...drift.extra].sort(comparePaths).map((path): Step => ({ kind: "remove", path }));
  return [...copies, ...removals];
}

/** The traits of a mirror: it tells paths apart by case only where every store does, and holds no object that any store would refuse. */
export function mirrorTraits(members: readonly Traits[]): Traits {
  const limits = members.flatMap((t) => (t.maxObject === undefined ? [] : [t.maxObject]));
  const caseSensitive = members.every((t) => t.caseSensitive);
  return limits.length === 0 ? { caseSensitive } : { caseSensitive, maxObject: Math.min(...limits) };
}

/** Why a secondary cannot follow the primary by its traits, or nothing: a secondary that does not tell paths apart by case would fold two paths of a primary that does into one object. */
export function traitsProblem(primary: Traits, secondary: Traits): string | undefined {
  return primary.caseSensitive && !secondary.caseSensitive ? "it does not tell paths apart by case and the primary does, so two paths of the primary would become one object" : undefined;
}

/** The size of the largest object an operation would write, where it writes bytes. */
export function largestWrite(op: Op): number {
  switch (op.op) {
    case "write":
    case "append":
      return op.bytes.length;
    case "batch":
      return Math.max(0, ...op.changes.map((c) => (c.kind === "put" ? c.bytes.length : 0)));
    case "read":
    case "stat":
    case "list":
    case "delete":
    case "rename":
    case "history":
    case "rangeRead":
    case "search":
    case "merge":
      return 0;
    default:
      return absurd(op);
  }
}
