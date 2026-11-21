// Spec: 0002-objective-evidence FR-002, FR-003, FR-004, FR-006
/**
 * How objectives and requirements stand from the evidence (0002-objective-evidence FR-002 to FR-004, FR-006): a pure function of the objectives, the evidence and the instant. Within one source and method the latest record is the one that counts; an expired record is stale; any live failure
 * makes the objective not met; an objective is met only where a person has determined it from live passing evidence, or not applicable where a person has said so with a reason; evidence only from tools supports it and nothing more. There is no percentage: the roll-up of a requirement is
 * a standing and the counts beside it.
 *
 * @example
 * ```ts
 * import { standingOf } from "./determine.ts";
 * standingOf([], "2026-11-21T00:00:00Z"); // "no-evidence"
 * ```
 *
 * @module
 */
import type { Evidence, Objective, Rollup, Standing } from "@intellectual-frontiers/assessment/governance";
import { STANDINGS } from "@intellectual-frontiers/assessment/governance";

const live = (e: Evidence, now: string): boolean => e.validUntil === undefined || e.validUntil > now;

/** The latest record of each source and method: a later result replaces an earlier one of the same kind of look. */
export function latest(evidence: readonly Evidence[]): readonly Evidence[] {
  const best = new Map<string, Evidence>();
  for (const e of evidence) {
    const key = `${e.source}\u0000${e.method}`;
    const have = best.get(key);
    if (have === undefined || e.at > have.at || (e.at === have.at && e.id > have.id)) best.set(key, e);
  }
  return [...best.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** How one objective stands from the evidence recorded against it, at an instant. */
export function standingOf(evidence: readonly Evidence[], now: string): Standing {
  const current = latest(evidence);
  if (current.length === 0) return "no-evidence";
  const liveOnes = current.filter((e) => live(e, now));
  if (liveOnes.length === 0) return "stale";
  if (liveOnes.some((e) => e.result === "fail")) return "not-met";
  const person = liveOnes.filter((e) => e.by.kind === "person" && e.determines);
  if (person.some((e) => e.result === "pass")) return "met";
  if (person.some((e) => e.result === "not-applicable")) return "not-applicable";
  return liveOnes.some((e) => e.result === "pass") ? "supported" : "no-evidence";
}

/** One objective with its standing and the records that settled it. */
export type ObjectiveLine = { readonly objective: Objective; readonly standing: Standing; readonly evidence: readonly Evidence[] };
/** One requirement with its roll-up and the count of its objectives in each standing. */
export type RequirementLine = { readonly requirement: string; readonly rollup: Rollup; readonly counts: Readonly<Record<Standing, number>>; readonly objectives: readonly string[] };
/** The whole assessment of a framework. */
export type Assessment = { readonly framework: string; readonly now: string; readonly objectives: readonly ObjectiveLine[]; readonly requirements: readonly RequirementLine[]; readonly counts: Readonly<Record<Standing, number>>; readonly strays: readonly string[] };

const zero = (): Record<Standing, number> => Object.fromEntries(STANDINGS.map((s) => [s, 0])) as Record<Standing, number>;

/** The roll-up of a requirement from the standings of its objectives. */
export function rollupOf(counts: Readonly<Record<Standing, number>>): Rollup {
  const total = STANDINGS.reduce((n, s) => n + counts[s], 0);
  if (total === 0 || counts["no-evidence"] === total) return "no-evidence";
  if (counts["not-met"] > 0) return "not-met";
  if (counts["not-applicable"] === total) return "not-applicable";
  return counts.met + counts["not-applicable"] === total ? "met" : "partial";
}

/** The assessment of a framework: each objective's standing, each requirement's roll-up, the counts, and the evidence that names an objective the framework does not have (strays). */
export function assess(framework: string, objectives: readonly Objective[], evidence: readonly Evidence[], now: string): Assessment {
  const mine = evidence.filter((e) => e.framework === framework);
  const byObjective = new Map<string, Evidence[]>();
  for (const e of mine) byObjective.set(e.objective, [...(byObjective.get(e.objective) ?? []), e]);
  const known = new Set(objectives.map((o) => o.id));
  const lines: ObjectiveLine[] = objectives.map((o) => {
    const own = byObjective.get(o.id) ?? [];
    return { objective: o, standing: standingOf(own, now), evidence: latest(own) };
  });
  const byRequirement = new Map<string, ObjectiveLine[]>();
  for (const l of lines) byRequirement.set(l.objective.requirement, [...(byRequirement.get(l.objective.requirement) ?? []), l]);
  const requirements: RequirementLine[] = [...byRequirement].map(([requirement, ls]) => {
    const counts = zero();
    for (const l of ls) counts[l.standing]++;
    return { requirement, rollup: rollupOf(counts), counts, objectives: ls.map((l) => l.objective.id) };
  });
  const counts = zero();
  for (const l of lines) counts[l.standing]++;
  return { framework, now, objectives: lines, requirements, counts, strays: [...new Set(mine.map((e) => e.objective).filter((id) => !known.has(id)))].sort() };
}
