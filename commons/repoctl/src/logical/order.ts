// Spec: 0003-repoctl-sync FR-001
/**
 * The order of the generators (commons repoctl 0003-repoctl-sync FR-001): a generator comes after every generator it declares in `after` and every generator that writes something it reads, which the globs of the table say, and where the facts do not order two of them the
 * table's own order stands. A table in which generators wait for one another is refused with the ones that do. Pure: the same table gives the same order.
 *
 * @example
 * ```ts
 * import { GENERATORS } from "@intellectual-frontiers/repoctl/governance";
 * import { orderGenerators } from "./order.ts";
 * const r = orderGenerators(GENERATORS);
 * r.kind === "ok" && r.value[0]?.id; // "libraries"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type Generator, type StepId, stepText } from "@intellectual-frontiers/repoctl/governance";
import { matches, overlap } from "./glob.ts";

/** Whether `later` comes after `earlier`: it declares it in `after`, or it reads something that `earlier` writes. */
export function reads(later: Generator, earlier: Generator): boolean {
  return later.id !== earlier.id && (later.after.includes(earlier.id) || earlier.outputs.some((o) => later.inputs.some((i) => overlap(o, i))));
}

/** The generators in the order they are run, or the ids of those that wait for one another. */
export function orderGenerators(table: readonly Generator[]): Result<readonly Generator[], readonly StepId[]> {
  const left = [...table];
  const done: Generator[] = [];
  while (left.length > 0) {
    const next = left.find((g) => !left.some((other) => reads(g, other)));
    if (next === undefined) return err(left.map((g) => g.id));
    done.push(next);
    left.splice(left.indexOf(next), 1);
  }
  return ok(done);
}

/** The generator that writes a path (from the repository's root, with `/`), the first of the table where two globs match it; none where no generator writes it. */
export function generatorOf(table: readonly Generator[], path: string): Generator | undefined {
  return table.find((g) => g.outputs.some((o) => matches(o, path)));
}

/** The command that fixes a stale generator, as a person types it. */
export function fixOf(g: Generator): string {
  return stepText(g.run);
}
