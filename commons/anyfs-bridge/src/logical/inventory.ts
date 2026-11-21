// Spec: 0003-bridge-transfer FR-001
/**
 * What an endpoint holds: every object below its prefix, listed page by page, kept or left out by the filter, named relative to the prefix and, at a source, rewritten to the path it will have at the
 * destination. The inventory is in the order of the paths, so that a plan made from two of them is the same plan wherever it is made.
 *
 * @example
 * ```ts
 * import { identity } from "./inventory.ts";
 * // const r = await inventory(store, prefix, { keep: () => true, rewrite: identity });
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { comparePaths, type Cursor, type Path, type Prefix, type Problem, relativeTo } from "@intellectual-frontiers/anyfs/governance";
import type { Stat, Store } from "@intellectual-frontiers/anyfs/logical";
import { type Glob, anyGlobMatches, type Rails } from "@intellectual-frontiers/anyfs-bridge/governance";

/** One object of an inventory: its path relative to the endpoint, the path it will have at the other side, and what the store says of it. */
export type Entry = { readonly rel: Path; readonly target: Path; readonly stat: Stat };

/** A rule that maps the path of a file at the source to its path at the destination, or says why it cannot. */
export type Rewrite = (rel: Path) => Result<Path, string>;

/** The rewrite that keeps every path. */
export const identity: Rewrite = (rel) => ok(rel);

/** Why an inventory could not be made. */
export type InventoryProblem = { readonly kind: "store"; readonly problem: Problem } | { readonly kind: "rewrite"; readonly rel: Path; readonly detail: string };

/** How an inventory is made: which files it keeps, how it names them, and how many it asks of the store at once. */
export type InventoryOptions = { readonly keep: (rel: Path) => boolean; readonly rewrite: Rewrite; readonly pageSize: number };

/** The filter of a set of rails as a function: a file is kept where it matches an include, or there is none, and no exclude. */
export function keepOf(rails: Pick<Rails, "include" | "exclude">): (rel: Path) => boolean {
  const include: readonly Glob[] = rails.include ?? [];
  const exclude: readonly Glob[] = rails.exclude ?? [];
  return (rel) => (include.length === 0 || anyGlobMatches(include, rel)) && !anyGlobMatches(exclude, rel);
}

/** Every object below `prefix`, in the order of their paths. */
export async function inventory(store: Store<"list">, prefix: Prefix, options: InventoryOptions): Promise<Result<readonly Entry[], InventoryProblem>> {
  const entries: Entry[] = [];
  let after: Cursor | undefined;
  for (;;) {
    const page = await store.list(prefix, after === undefined ? { limit: options.pageSize } : { limit: options.pageSize, after });
    if (page.kind === "err") return err({ kind: "store", problem: page.error });
    for (const stat of page.value.entries) {
      const rel = relativeTo(prefix, stat.path);
      if (rel === undefined || !options.keep(rel)) continue;
      const target = options.rewrite(rel);
      if (target.kind === "err") return err({ kind: "rewrite", rel, detail: target.error });
      entries.push({ rel, target: target.value, stat });
    }
    if (page.value.next === undefined) break;
    after = page.value.next;
  }
  entries.sort((a, b) => comparePaths(a.target, b.target));
  return ok(entries);
}
