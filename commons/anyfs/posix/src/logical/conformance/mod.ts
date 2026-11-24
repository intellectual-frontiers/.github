// Spec: 0005-anyfs-posix-conformance FR-001, FR-002
/**
 * The conformance suite of AnyFS POSIX: the cases every view of a store passes, each needing and lacking named capabilities, and the functions that choose and run them. A test calls `runPosixConformance`
 * with a function that makes a new world over an empty store, and the suite runs every case whose capabilities the store has and says which failed and how.
 *
 * @example
 * ```ts
 * import { runPosixConformance } from "./mod.ts";
 * // const report = await runPosixConformance(async () => ({ posix: posix(memoryStore()) }))
 * // report.filter((r) => r.failure !== undefined) // the cases that failed
 * ```
 *
 * @module
 */
import type { Capability } from "@intellectual-frontiers/anyfs/governance";
import { CASES } from "./cases.ts";
import { type Case, ConformanceFailure, type Make } from "./kit.ts";
import { modelCase } from "./random-model.ts";

export { type Case, ConformanceFailure, type Make, type World } from "./kit.ts";
export { generator, modelCase } from "./random-model.ts";
export { PosixModel, type Answer, type ModelEntry, type ModelOptions } from "./model.ts";
export { CASES } from "./cases.ts";

/** The seeds of the model cases the suite runs. */
export const MODEL_SEEDS = [1, 2, 3, 4, 5] as const;
/** The operations of each model case. */
export const MODEL_STEPS = 250;

/** Every case of the suite, the model cases included. */
export const ALL_CASES: readonly Case[] = [...CASES, ...MODEL_SEEDS.map((seed) => modelCase(seed, MODEL_STEPS))];

/** The cases a store with these capabilities is held to: those whose needs it has and whose lacks it does not, and those that need a trace only where it records one. */
export function casesFor(capabilities: Iterable<Capability>, traced = false): readonly Case[] {
  const has = new Set<Capability>(capabilities);
  return ALL_CASES.filter((c) => c.needs.every((n) => has.has(n)) && c.lacks.every((l) => !has.has(l)) && (!c.traced || traced));
}

/** What one case did. */
export type CaseReport = { readonly id: string; readonly title: string; readonly failure?: string };

/** Runs one case against worlds made by `make`: its report, with the failure as a sentence. */
export async function runCase(c: Case, make: Make): Promise<CaseReport> {
  try {
    await c.run(make);
    return { id: c.id, title: c.title };
  } catch (thrown) {
    const message = thrown instanceof ConformanceFailure ? thrown.message : thrown instanceof Error ? `${thrown.name}: ${thrown.message}` : String(thrown);
    return { id: c.id, title: c.title, failure: message };
  }
}

/** Runs every case a view is held to: the capabilities and the trace are read from a first world. */
export async function runPosixConformance(make: Make): Promise<readonly CaseReport[]> {
  const first = await make();
  const cases = casesFor(first.posix.capabilities, first.trace !== undefined);
  const out: CaseReport[] = [];
  for (const c of cases) out.push(await runCase(c, make));
  return out;
}
