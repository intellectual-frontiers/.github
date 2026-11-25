// Spec: 0005-workbench-resolution FR-001, FR-002, FR-003
/**
 * Composition: what a task needs is the base and the contributions of the units that task is about, and nothing else. A unit that is not selected contributes nothing; a requirement that only some tests need is included
 * only where such a test is selected. This is the one rule that keeps an agent or a person from installing every tool for every use: the answer is a function of the task, the units and the files, never of the repository.
 *
 * @example
 * ```ts
 * import { compose } from "./compose.ts";
 * // compose(contract, "test", { units: ["anyfs-sql"], files: ["suite/sqlite.test.ts"] }): the base, and what only that test needs
 * ```
 *
 * @module
 */
import type { Contract, Requirement, Task } from "@intellectual-frontiers/workbench/governance";

/** What a task is about: some units, or all of them (the cold start of CI only), and the test files that are selected where the task is `test`. */
export type Selection = { readonly units: readonly string[] | "all"; readonly files?: readonly string[] };

const regexOf = (glob: string): RegExp => new RegExp(`^${glob.split("**").map((part) => part.split("*").map((p) => p.replace(/[.+?^${}()|[\]\\]/gu, "\\$&")).join("[^/]*")).join(".*")}$`, "u");

/** Whether a path matches a glob: `*` is the characters of one segment and `**` any number of segments. */
export const globMatches = (glob: string, path: string): boolean => regexOf(glob).test(path);

const applies = (r: Requirement, task: Task): boolean => r.task === "any" || r.task === task;

/** The requirements of a task, once each, in the order of their ids. */
export function compose(contract: Contract, task: Task, selection: Selection = { units: [] }): readonly Requirement[] {
  const out = new Map<string, Requirement>();
  for (const r of contract.base) if (applies(r, task)) out.set(r.id, r);
  for (const c of contract.contributions) {
    if (selection.units !== "all" && !selection.units.includes(c.unit)) continue;
    const testNeeded = new Set((c.tests ?? []).flatMap((t) => t.needs));
    for (const r of c.requirements) if (applies(r, task) && !testNeeded.has(r.id)) out.set(r.id, r);
    if (task === "test") {
      for (const t of c.tests ?? []) {
        const selected = selection.files === undefined || selection.files.some((f) => globMatches(t.glob, f));
        if (!selected) continue;
        for (const id of t.needs) {
          const r = c.requirements.find((x) => x.id === id) ?? contract.base.find((x) => x.id === id);
          if (r !== undefined) out.set(r.id, r);
        }
      }
    }
  }
  return [...out.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
