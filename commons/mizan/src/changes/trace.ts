/**
 * The chain from a change request to the run that proved it (commons 0020-ifccm FR-014, FR-015): for each requirement a `Done when` names, the stages issue, requirement, ontology term, code,
 * test and quality run, each linked by the annotation it already has (`Done when`, the specification's `FR-nnn`, `mz:definedBy`, `// Spec:`, `proves`, a run's case), and the first stage with no link.
 *
 * @remarks
 * Pure: the specifications, the ontology's citations, the source and test files and the cases of a run are arguments. It reuses the readers of `kernel/trace.ts` for the specifications, the
 * `// Spec:` lines and the `proves` calls, so that no stage needs an annotation of its own. A citation of a whole specification (no requirement named) does not link a requirement to a term; for
 * code and tests it does not either: a stage links a requirement only by naming it, alone or in a range.
 *
 * @limits
 * It reads text, not syntax (as `kernel/trace.ts` does), and judges the cases it is given: which run, at which revision, is the caller's.
 *
 * @example
 * ```ts
 * import { firstBreak, traceOf } from "./trace.ts";
 * const t = traceOf("0020-ifccm FR-005", { specs: [], terms: [], sources: [], tests: [], cases: [] });
 * firstBreak(t); // "StageRequirement": the specification has no such requirement
 * ```
 *
 * @module
 */
import { type Cited, type OntologyCitation, parseSpec, proofsOf, type SourceFile, specLines } from "../trace.ts";

/** The stages of the chain, in order (`ifccm:TraceStage`; a test holds the names equal to the ontology's). */
export const STAGES = ["StageIssue", "StageRequirement", "StageTerm", "StageCode", "StageTest", "StageRun"] as const;

/** One stage of the chain. */
export type Stage = (typeof STAGES)[number];

/** A specification as the chain reads it: its folder's name and the text of its `spec.md`. */
export type SpecSource = { readonly slug: string; readonly spec: string };

/** The case of a run that the last stage reads: the requirements it names and its outcome. */
export type RunCase = { readonly requirements: readonly string[]; readonly outcome: "pass" | "fail" | "skip" | "todo" | "cancelled" };

/** What the chain reads. */
export type TraceInput = {
  readonly specs: readonly SpecSource[];
  /** The ontology's citations: each term and the requirements it cites (`mz:definedBy`). */
  readonly terms: readonly OntologyCitation[];
  /** The source files, read for their `// Spec:` lines. */
  readonly sources: readonly SourceFile[];
  /** The test files, read for their `proves` calls. */
  readonly tests: readonly SourceFile[];
  /** The cases of the quality run at the revision. */
  readonly cases: readonly RunCase[];
};

/** One stage's result: whether it is linked, and what links it. */
export type StageResult = { readonly stage: Stage; readonly linked: boolean; readonly by: readonly string[] };

/** The chain of one requirement. */
export type Trace = { readonly requirement: string; readonly stages: readonly StageResult[] };

function numberOf(id: string): number {
  return Number(/(\d+)/.exec(id)?.[1] ?? Number.NaN);
}

/** Whether a citation of a spec names a requirement: alone, or inside a range `FR-003 to FR-005` of the same width. */
function names(cited: readonly Cited[], fr: string): boolean {
  return cited.some((c) => (c.kind === "one" ? c.id === fr : numberOf(c.from) <= numberOf(fr) && numberOf(fr) <= numberOf(c.to)));
}

/** The chain of one requirement `NNNN-slug FR-nnn`: every stage, linked or not, so that a report ends where the chain breaks. The first stage, the change request, is linked by the caller's naming it. */
export function traceOf(requirement: string, input: TraceInput): Trace {
  const [slug = "", fr = ""] = requirement.split(" ");
  const spec = input.specs.find((s) => s.slug === slug);
  const stages: StageResult[] = [{ stage: "StageIssue", linked: true, by: ["Done when"] }];
  const declared = spec !== undefined && parseSpec(slug, spec.spec).requirements.some((r) => r.id === fr);
  stages.push({ stage: "StageRequirement", linked: declared, by: declared ? [`specs/${slug}/spec.md`] : [] });
  const terms = input.terms.filter((t) => t.cites.includes(requirement)).map((t) => t.term);
  stages.push({ stage: "StageTerm", linked: terms.length > 0, by: terms });
  const code = input.sources.filter((s) => specLines(s.text).some((c) => c.spec === slug && names(c.requirements, fr))).map((s) => s.path);
  stages.push({ stage: "StageCode", linked: code.length > 0, by: code });
  const tests = input.tests.filter((t) => proofsOf(t.text).some((p) => p.spec === slug && names([p.requirement], fr))).map((t) => t.path);
  stages.push({ stage: "StageTest", linked: tests.length > 0, by: tests });
  const mine = input.cases.filter((c) => c.requirements.includes(requirement));
  const passing =
    mine.length > 0 &&
    mine.every((c) => c.outcome === "pass" || c.outcome === "skip" || c.outcome === "todo") &&
    mine.some((c) => c.outcome === "pass");
  stages.push({
    stage: "StageRun",
    linked: passing,
    by: passing ? [`${mine.filter((c) => c.outcome === "pass").length} passing case(s)`] : [],
  });
  return { requirement, stages };
}

/** The first stage with no link, or undefined where the chain is whole (0020-ifccm FR-015). */
export function firstBreak(t: Trace): Stage | undefined {
  return t.stages.find((s) => !s.linked)?.stage;
}

/** A chain as lines for a report: one line a requirement, ending where the chain breaks. */
export function traceLines(traces: readonly Trace[]): readonly string[] {
  return traces.map((t) => {
    const broken = firstBreak(t);
    // the report ends where the chain breaks: a later stage that happens to be linked is not a link of this chain
    const linked = t.stages.slice(0, broken === undefined ? t.stages.length : STAGES.indexOf(broken)).map((s) => s.stage);
    return broken === undefined
      ? `${t.requirement}: whole (${linked.join(" > ")})`
      : `${t.requirement}: ends at ${broken} (${linked.join(" > ") || "no stage linked"})`;
  });
}
