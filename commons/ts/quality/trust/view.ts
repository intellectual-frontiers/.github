/**
 * The Trust page's content (commons 0022-trust FR-001 to FR-005, FR-007 to FR-009): everything the page and its JSON say, as one typed value
 * made from the evidence, redacted for one audience, with the count of what was redacted. The HTML (`html.ts`) and the JSON are two renderings
 * of this value, so that they cannot say two things.
 *
 * - **Failures first.** Each failed case, each case that did not run, each open nonconformance with its age and each open CAPA is kept, sorted
 *   and never dropped to improve a figure (FR-003); a nonconformance closed yesterday is still shown, as closed with its CAPA.
 * - **Evidence, never a verdict.** The harness's own words (its name, its scope note, what the page does not cover) are refused where they
 *   state that a harness conforms to, is certified to or complies with a standard, a regulation or a control (FR-004).
 * - **Stale is said.** Where the newest evidence is older than the harness's cadence for a run, the page says that it is stale and by how
 *   long (FR-005).
 * - **Redaction counts.** What an audience may not see is replaced or withheld and counted, so that a redaction is never silent (FR-008).
 *
 * @remarks
 * Pure: no clock (`generated` is a day the caller gives, the day of the newest evidence), no file, no Git. A figure of the page is
 * `figures` (`assessor/verify-pack.ts` computes it from the files), the grade, freshness and objectives come from the ladder and the index, and none of
 * them passes through redaction.
 *
 * @module
 */
import { err, ok, type Result } from "../../kernel/result.ts";
import type { Figures } from "../assessor/verify-pack.ts";
import type { Grade } from "../pure/names.ts";
import type { Nonconformance } from "../pure/ledger.ts";
import { type Audience, redactFor, type RedactionRules, showsMessages } from "./audience.ts";
import { NO_REQUIREMENT_TEXT, type RequirementText } from "./requirement-text.ts";

/** A requirement as the page shows it (FR-002). */
export type TrustRequirement = {
  readonly id: string;
  readonly grade: Grade;
  /** `Fresh`, `Due`, `Stale` or `None` where nothing proves it. */
  readonly freshness: string;
  readonly required: Grade;
  readonly proved: boolean;
  readonly day?: string;
  readonly run?: string;
  /** The strength of its proof in a thousandth, where a mutation run measured it (0021-ifqs FR-040), and the grade it leaves the proof. */
  readonly strengthPermille?: number;
  readonly gradeAfterStrength?: Grade;
};

/** A case that failed or did not run, as the page lists it (FR-003). */
export type TrustFailure = {
  readonly run: string;
  readonly day: string;
  readonly requirements: readonly string[];
  readonly name: string;
  readonly outcome: "fail" | "not_run";
  /** Why: for a case that did not run its reason; for a failed one, that it failed. */
  readonly reason: string;
  /** What the failure said, and where: not for the public (FR-008). */
  readonly message?: string;
  readonly file?: string;
};

/** A nonconformance and where it stands, with its age in days (FR-003). */
export type TrustNonconformance = {
  readonly id: string;
  /** The requirement's identifier (`NNNN-slug FR-nnn`): a name, never its text on the public page (FR-018). */
  readonly requirement: string;
  /** What the requirement says at the tested revision: for the Assessor and Internal audiences only (FR-018). */
  readonly requirementText?: string;
  /** A code from a closed list (`failed`, `stale`, `probe-failed`, `budget-spent`), never text (FR-018). */
  readonly cause: Nonconformance["cause"];
  readonly state: "NonconformanceOpen" | "NonconformanceClosed";
  readonly openedOn: string;
  readonly closedOn?: string;
  /** Days open: from the day it was opened to the day it closed, or to `generated`. */
  readonly ageDays: number;
  /** Why it was opened, in words: for the Assessor and Internal audiences only; the Public page names the nonconformance by its identifier (FR-018). */
  readonly reason?: string;
  readonly capas: readonly string[];
};

/** A CAPA and where it stands (FR-003). */
export type TrustCapa = {
  readonly id: string;
  readonly nonconformance: string;
  readonly state: "CapaOpen" | "CapaVerified" | "CapaClosed";
  readonly openedOn: string;
  readonly action: string;
  readonly test: string;
  readonly verifiedOn?: string;
  readonly closedOn?: string;
};

/** A quality objective with its target and what remains of its error budget (FR-002). */
export type TrustObjective = {
  readonly id: string;
  readonly metric: string;
  readonly comparator: string;
  readonly target: number;
  readonly unit: string;
  readonly value: number | null;
  readonly state: string;
  readonly budget: number;
  readonly remaining: number | null;
  readonly windowDays: number;
};

/** What the people and plans of Tier 2 have recorded (0021-ifqs FR-038 to FR-041), as counts. */
export type TrustPeople = {
  readonly plans: number;
  readonly samplesDrawn: number;
  readonly samplesAttested: number;
  readonly mutationRuns: number;
  readonly agentReviews: number;
  readonly agentReviewsSampled: number;
};

/** What the page is made from: the evidence of a harness at a revision, before redaction. */
export type TrustInput = {
  readonly harness: string;
  readonly revision: string;
  /** The day the page is made as of: the day of the newest evidence (no clock). */
  readonly generated: string;
  /** The span of evidence it covers, the first and last day of a run kept; none where there is none. */
  readonly span?: { readonly from: string; readonly to: string };
  /** The digest of the last evidence file, the head of the chain, where there is one. */
  readonly head?: string;
  /** What the harness says its scope is, and what the page does not cover (FR-004). */
  readonly scopeNote?: string;
  readonly notCovered: readonly string[];
  readonly figures: Figures;
  /** The count of proved requirements, shown only with its grade and the review debt beside it (0021-ifqs FR-006). */
  readonly proof: {
    readonly count: string;
    readonly proved: number;
    readonly requirements: number;
    readonly reviewDebt: number;
    /** The review debt apart: what rests on an agent and what on a person (0021-ifqs FR-048). */
    readonly reviewDebtByAgent: number;
    readonly reviewDebtByPerson: number;
    readonly byGrade: Readonly<Record<string, number>>;
  };
  readonly requirements: readonly TrustRequirement[];
  readonly failures: readonly TrustFailure[];
  readonly nonconformances: readonly TrustNonconformance[];
  readonly capas: readonly TrustCapa[];
  readonly objectives: readonly TrustObjective[];
  /** The days the newest run is old and the cadence it is held to, where the evidence is older than the cadence (FR-005). */
  readonly stale?: { readonly newest: string; readonly cadenceDays: number; readonly overdueDays: number };
  readonly people: TrustPeople;
};

/** The page's content for one audience. */
export type TrustView = Omit<TrustInput, "scopeNote"> & {
  readonly schema: "ifqs-trust/1";
  readonly audience: Audience;
  readonly scope: string;
  /** How many values were redacted or withheld to make this rendering (FR-008). */
  readonly redactions: number;
  /** Open failures first (FR-003): the counts the page opens with. */
  readonly open: { readonly failedCases: number; readonly notRunCases: number; readonly nonconformances: number; readonly capas: number };
};

const CLAIM =
  /\b(?:conform(?:s|ed|ing|ant|ance|ity)?|compl(?:y|ies|ied|ying|iant|iance)|certif(?:y|ies|ied|ication)|accredit(?:ed|ation)|attests? (?:to )?compliance|meets? the requirements of)\b/i;

/** The first phrase of a text that states conformity, certification or compliance, or none (FR-004): `nonconformance` and `non-conformance` are the quality system's own words and are not one. */
export function conformityClaim(text: string): string | undefined {
  const m = CLAIM.exec(text.replace(/\bnon-?conform\w*/gi, " "));
  return m?.[0];
}

/** The scope the page states where the harness gives none: the page's own words, which state no conformity. */
export const DEFAULT_SCOPE =
  "This page states the evidence the quality system holds for this harness at one revision: what was run, with what outcome, at what grade, " +
  "and how fresh it is. It does not state that the harness conforms to, is certified to or complies with any standard, regulation or control: " +
  "that is an assessor's finding, made from the assessor pack.";

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const sortBy = <T>(xs: readonly T[], key: (x: T) => string): readonly T[] => [...xs].sort((a, b) => byText(key(a), key(b)));

/**
 * The content of the page for an audience (FR-001 to FR-005, FR-007 to FR-009), or why the page is refused: a statement of conformity in what the
 * harness wrote (FR-004). The same input, audience and rules give the same view.
 */
export function trustViewOf(
  input: TrustInput,
  audience: Audience,
  rules: RedactionRules,
  requirementText: RequirementText = NO_REQUIREMENT_TEXT,
): Result<TrustView, string> {
  for (const [what, text] of [
    ["the harness name", input.harness],
    ["the scope", input.scopeNote ?? ""],
    ...input.notCovered.map((t): readonly [string, string] => ["a statement of what is not covered", t]),
  ] as const) {
    const claim = conformityClaim(text);
    if (claim !== undefined)
      return err(
        `${what} says "${claim}": the Trust page states evidence and never that a harness conforms to, is certified to or complies with anything (0022-trust FR-004)`,
      );
  }
  let redactions = 0;
  const r = (text: string): string => {
    const x = redactFor(audience, rules, text);
    redactions += x.count;
    return x.text;
  };
  const withheld = (): void => {
    redactions += 1;
  };
  const messages = showsMessages(audience);
  const failures = sortBy(input.failures, (f) => `${f.day} ${f.run} ${f.name}`).map((f): TrustFailure => {
    const out: TrustFailure = {
      run: f.run,
      day: f.day,
      requirements: f.requirements.map(r),
      name: r(f.name),
      outcome: f.outcome,
      reason: r(f.reason),
      ...(messages && f.message !== undefined ? { message: r(f.message) } : {}),
      ...(messages && f.file !== undefined ? { file: r(f.file) } : {}),
    };
    if (!messages) {
      if (f.message !== undefined) withheld();
      if (f.file !== undefined) withheld();
    }
    return out;
  });
  // the Public page names a nonconformance by its identifier, its requirement's identifier and a code (FR-018): no reason, no requirement text
  const nonconformances = sortBy(input.nonconformances, (n) => n.id).map((n): TrustNonconformance => {
    const { reason, ...named } = n;
    if (messages) {
      const text = requirementText(n.requirement);
      return {
        ...named,
        requirement: r(n.requirement),
        ...(text === undefined ? {} : { requirementText: r(text) }),
        ...(reason === undefined ? {} : { reason: r(reason) }),
      };
    }
    if (reason !== undefined) withheld();
    if (requirementText(n.requirement) !== undefined) withheld();
    return { ...named, requirement: r(n.requirement) };
  });
  const capas = sortBy(input.capas, (c) => c.id).map((c): TrustCapa => ({ ...c, action: r(c.action), test: r(c.test) }));
  const requirements = sortBy(input.requirements, (q) => q.id).map((q): TrustRequirement => ({ ...q, id: r(q.id) }));
  const objectives = sortBy(input.objectives, (o) => o.id);
  return ok({
    schema: "ifqs-trust/1",
    audience,
    harness: input.harness,
    revision: input.revision,
    generated: input.generated,
    ...(input.span === undefined ? {} : { span: input.span }),
    ...(input.head === undefined ? {} : { head: input.head }),
    scope: r(input.scopeNote ?? DEFAULT_SCOPE),
    notCovered: input.notCovered.map(r),
    figures: input.figures,
    proof: input.proof,
    requirements,
    failures,
    nonconformances,
    capas,
    objectives,
    ...(input.stale === undefined ? {} : { stale: input.stale }),
    people: input.people,
    redactions,
    open: {
      failedCases: failures.filter((f) => f.outcome === "fail").length,
      notRunCases: failures.filter((f) => f.outcome === "not_run").length,
      nonconformances: nonconformances.filter((n) => n.state === "NonconformanceOpen").length,
      capas: capas.filter((c) => c.state !== "CapaClosed").length,
    },
  });
}

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => byText(a, b))
        .map(([k, v]) => [k, sorted(v)]),
    );
  return value;
}

/** The view as JSON: sorted keys, two spaces and a final newline, so that the same evidence gives the same bytes (FR-009). */
export function trustJson(view: TrustView): string {
  return `${JSON.stringify(sorted(view), null, 2)}\n`;
}
