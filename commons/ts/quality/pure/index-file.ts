/**
 * The index of the quality branch (commons 0021-ifqs FR-019, FR-031): one deterministic JSON file derived from the branch alone and rebuilt
 * from it alone, for search, trends and the public page. It lists the runs, each requirement with its grade, day and freshness, the review debt
 * beside the count of proved requirements, every nonconformance and CAPA from the moment it is opened, closed ones kept, and the objectives with
 * their budgets. It is never a source of evidence: nothing in it is read back as evidence, and `--check` says whether the file on disk is what the
 * branch gives.
 *
 * @remarks
 * Pure: it is given what was read from the branch. The text has sorted keys and no clock: `asOf` is the day of the newest thing on the branch.
 *
 * @module
 */
import { err, ok, type Result } from "../../kernel/result.ts";
import { type Judgement, showProofCount, summarize } from "./ladder.ts";
import { type Ledger } from "./ledger.ts";
import { type Evaluation, objectiveProblem } from "./objectives.ts";

/** One run kept on the branch, as the index lists it. */
export type IndexRun = {
  readonly traceId: string;
  readonly path: string;
  readonly day: string;
  readonly revision?: string;
  /** What the branch gives the run's evidence (`E3`, `E4`). */
  readonly grade: string;
  readonly tests: number;
  readonly passed: number;
  readonly failed: number;
  readonly notRun: number;
};

/** What the index is built from. */
export type IndexInput = {
  /** The tip of the `quality` branch, or none where there is none. */
  readonly tip?: string;
  /** The SHA-256 of the last evidence file, the head of the chain. */
  readonly head?: string;
  readonly asOf: string;
  readonly runs: readonly IndexRun[];
  readonly judgements: readonly Judgement[];
  readonly ledger: Ledger;
  readonly objectives: readonly Evaluation[];
};

/** The file's name in a repository. */
export const INDEX_FILE = "quality.index.auto.json";

/** The command that writes it. */
export const INDEX_COMMAND = "bun commons/ts/quality/quality.ts index --out quality.index.auto.json";

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, sorted(v)]),
    );
  return value;
}

/** The index as text (FR-019): JSON with sorted keys, two spaces and a final newline, so that the same branch gives the same bytes. */
export function buildIndex(input: IndexInput): Result<string, string> {
  for (const e of input.objectives) {
    const problem = objectiveProblem(e.objective);
    if (problem !== undefined) return err(problem);
  }
  const s = summarize(input.judgements);
  const count = showProofCount({
    proved: s.proved,
    provedByGrade: s.provedByGrade,
    reviewDebt: s.reviewDebt,
    reviewDebtByAgent: s.reviewDebtByAgent,
    reviewDebtByPerson: s.reviewDebtByPerson,
  });
  if (count.kind === "err") return err(count.error);
  const body = {
    schema: "ifqs-index/1",
    generated: `derived from the quality branch by \`${INDEX_COMMAND}\`; never edited by hand, never a source of evidence`,
    asOf: input.asOf,
    branch: { tip: input.tip ?? null, head: input.head ?? null, runs: input.runs.length },
    runs: [...input.runs].sort((a, b) => (a.day + a.traceId < b.day + b.traceId ? -1 : 1)),
    proof: {
      count: count.value,
      proved: s.proved,
      provedByGrade: s.provedByGrade,
      reviewDebt: s.reviewDebt,
      reviewDebtByAgent: s.reviewDebtByAgent,
      reviewDebtByPerson: s.reviewDebtByPerson,
      requirements: s.requirements,
      byGrade: s.byGrade,
      stale: s.stale,
    },
    requirements: input.judgements.map((j) => ({
      requirement: j.requirement,
      grade: j.grade,
      day: j.day ?? null,
      freshness: j.freshness,
      proved: j.proved,
      risk: j.risk,
      required: j.required,
      byAgent: j.byAgent,
    })),
    nonconformances: input.ledger.nonconformances.map((n) => ({
      id: n.id,
      requirement: n.requirement,
      cause: n.cause,
      reason: n.reason,
      state: n.state,
      openedOn: n.openedOn,
      openedBy: n.openedBy,
      problem: n.problem ?? null,
      closedOn: n.closedOn ?? null,
      capas: n.capas,
      evidence: n.evidence,
    })),
    capas: input.ledger.capas.map((c) => ({
      id: c.id,
      nonconformance: c.nonconformance,
      action: c.action,
      test: c.test,
      correctiveRevision: c.correctiveRevision,
      state: c.state,
      openedOn: c.openedOn,
      verified: c.verified ?? null,
      closed: c.closed === undefined ? null : { decision: c.closed.decision.id, person: c.closed.decision.person, day: c.closed.day },
    })),
    objectives: input.objectives.map((e) => ({
      id: e.objective.id,
      metric: e.objective.metric,
      criterion: e.objective.criterion ?? null,
      comparator: e.objective.comparator,
      target: e.objective.target,
      unit: e.objective.unit,
      value: e.value,
      state: e.state,
      budget: e.objective.budget,
      windowDays: e.objective.windowDays,
      remaining: e.remaining,
    })),
  };
  return ok(`${JSON.stringify(sorted(body), null, 2)}\n`);
}

/** Whether the file on disk is what the branch gives (line endings compared as LF, as `.gitattributes` makes generated files). */
export function indexIsCurrent(onDisk: string, built: string): boolean {
  return onDisk.replaceAll("\r\n", "\n") === built;
}
