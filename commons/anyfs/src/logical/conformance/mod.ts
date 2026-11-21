// Spec: 0005-anyfs-conformance FR-001, FR-002
/**
 * The conformance suite of AnyFS: the cases every backend passes, each needing named capabilities, and the functions that choose and run them. A backend's tests call `runConformance` with a function that makes a
 * new, empty store, and the suite runs every case whose needs the store has and says which failed and how.
 *
 * @example
 * ```ts
 * import { runConformance } from "./mod.ts";
 * // const report = await runConformance(async () => memoryStore())
 * // report.filter((r) => r.failure !== undefined) // the cases that failed
 * ```
 *
 * @module
 */
import type { Capability, CoreCapability } from "@intellectual-frontiers/anyfs/governance";
import { CASES } from "./cases.ts";
import { type Case, ConformanceFailure, type Make } from "./kit.ts";
import { modelCase } from "./model.ts";
import type { Store } from "../store.ts";

export { type Case, ConformanceFailure, type Make } from "./kit.ts";
export { generator, modelCase } from "./model.ts";
export { CASES } from "./cases.ts";

/** The seeds of the model cases the suite runs. */
export const MODEL_SEEDS = [1, 2, 3] as const;
/** The operations of each model case. */
export const MODEL_STEPS = 300;

/** Every case of the suite, the model cases included. */
export const ALL_CASES: readonly Case[] = [...CASES, ...MODEL_SEEDS.map((seed) => modelCase(seed, MODEL_STEPS))];

/** The cases a store with these capabilities is held to: those whose needs it has. */
export function casesFor(capabilities: Iterable<Capability>): readonly Case[] {
  const has = new Set<Capability>(capabilities);
  return ALL_CASES.filter((c) => c.needs.every((n) => has.has(n)));
}

/** What one case did. */
export type CaseReport = { readonly id: string; readonly title: string; readonly failure?: string };

/** Runs one case against stores made by `make`: its report, with the failure as a sentence. */
export async function runCase(c: Case, make: Make): Promise<CaseReport> {
  try {
    await c.run(make);
    return { id: c.id, title: c.title };
  } catch (thrown) {
    const message = thrown instanceof ConformanceFailure ? thrown.message : thrown instanceof Error ? `${thrown.name}: ${thrown.message}` : String(thrown);
    return { id: c.id, title: c.title, failure: message };
  }
}

/** Runs every case the stores made by `make` are held to, and reports each. */
export async function runConformance(make: () => Promise<Store<CoreCapability>>): Promise<readonly CaseReport[]> {
  const sample = await make();
  const reports: CaseReport[] = [];
  for (const c of casesFor(sample.capabilities)) reports.push(await runCase(c, make));
  return reports;
}
export { type MakeReplicas, type MergeCase, type MergeCaseReport, type MergeFace, MERGE_CASES, runMergeCase, runMergeConformance } from "./merge.ts";
export { runSigningConformance, type MakeSigned, type SigningReport } from "./signing.ts";
