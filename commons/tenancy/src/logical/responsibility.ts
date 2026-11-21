// Spec: 0002-tenancy FR-005, FR-006
/**
 * The matrix of responsibility (0002-tenancy FR-005, FR-006): for each requirement of a framework, who answers, with the requirements nobody has been asked to answer for listed apart, and the rules a statement must keep (an inherited requirement names its provider, a shared one says
 * what each side does, no requirement is stated twice or is not one of the framework's). The standing a client may claim for a requirement follows from whose it is: its own evidence for a client's, the operator's for an operator's, both for a shared one, and the provider's for an inherited one.
 *
 * @example
 * ```ts
 * import { matrix } from "./responsibility.ts";
 * matrix("f", ["1"], []).unassigned; // ["1"]
 * ```
 *
 * @module
 */
import type { Rollup } from "@intellectual-frontiers/assessment/governance";
import { WHO, type Responsibility } from "@intellectual-frontiers/tenancy/governance";

/** The matrix of a framework: each statement, the requirements with none, and what is wrong with the statements. */
export type Matrix = { readonly framework: string; readonly lines: readonly Responsibility[]; readonly unassigned: readonly string[]; readonly problems: readonly string[] };

/** The matrix of a framework's requirements from the statements of responsibility. */
export function matrix(framework: string, requirements: readonly string[], statements: readonly Responsibility[]): Matrix {
  const mine = statements.filter((s) => s.framework === framework);
  const known = new Set(requirements);
  const seen = new Set<string>();
  const problems: string[] = [];
  for (const s of mine) {
    if (!known.has(s.requirement)) problems.push(`${s.requirement} is not a requirement of ${framework}`);
    if (seen.has(s.requirement)) problems.push(`${s.requirement} is stated twice`);
    seen.add(s.requirement);
    if (!WHO.includes(s.who)) problems.push(`${s.requirement}: ${String(s.who)} is not one of ${WHO.join(", ")}`);
    if (s.who === "inherited" && (s.provider ?? "") === "") problems.push(`${s.requirement} is inherited and names no provider`);
    if (s.who === "shared" && (s.note ?? "").trim() === "") problems.push(`${s.requirement} is shared and says nothing of what each side does`);
  }
  const lines = [...mine].sort((a, b) => (a.requirement < b.requirement ? -1 : 1));
  return { framework, lines, unassigned: requirements.filter((r) => !seen.has(r)), problems };
}

/** The standings that bear on one requirement, from each side that may give evidence. */
export type Standings = { readonly client?: Rollup; readonly operator?: Rollup; readonly provider?: Rollup };

const worst = (xs: readonly Rollup[]): Rollup => {
  if (xs.length === 0 || xs.every((x) => x === "no-evidence")) return "no-evidence";
  if (xs.includes("not-met")) return "not-met";
  if (xs.every((x) => x === "not-applicable")) return "not-applicable";
  return xs.every((x) => x === "met" || x === "not-applicable") ? "met" : "partial";
};

/** The standing a client may claim for a requirement, from whose it is: a side that has given no evidence counts as having none. */
export function standingFor(line: Pick<Responsibility, "who">, s: Standings): Rollup {
  const none: Rollup = "no-evidence";
  switch (line.who) {
    case "client": return s.client ?? none;
    case "operator": return s.operator ?? none;
    case "inherited": return s.provider ?? none;
    case "shared": return worst([s.client ?? none, s.operator ?? none]);
  }
}
