/**
 * The evidence ladder of each requirement (commons 0021-ifqs FR-006, FR-011, FR-021 to FR-024): what each piece of evidence of a requirement is
 * worth (`E1` a statement, `E2` a review, `E3` a run, `E4` a run kept chained and signed, `E5` a probe of the system in operation), the grade of
 * the requirement as the highest grade of its fresh evidence, whether it is counted proved at the grade its risk asks, the review debt as a
 * number, and the nonconformances the system opens itself from a failed or a stale proof (FR-007).
 *
 * - A **run** is the newest run that names the requirement: it proves it where a case passed and none failed; it is graded as the quality
 *   branch grades it (`E3`, `E4`), and an older run is superseded by it. A case that did not run proves nothing (FR-005, FR-014).
 * - A **review** made by an agent is said so in the record (`by`) and is graded no higher than `E2` (FR-024).
 * - A **count of proved requirements** is shown only with its grade and the review debt beside it (FR-006, FR-023): `showProofCount` refuses
 *   to show one that lacks either.
 *
 * @remarks
 * Pure: it reads records and judgements it is given; `host/gather.ts` finds them with real `git`. The grade a requirement needs follows its
 * risk (FR-011): `E3` and, where one of its tests is of `high` risk (0008-test-evidence FR-001), `E4`.
 *
 * @example
 * ```ts
 * import { judgeRequirement, reviewDebt } from "./ladder.ts";
 * ```
 *
 * @module
 */
import { absurd } from "../../kernel/absurd.ts";
import type { Instant } from "../../kernel/grc.ts";
import { instantFromEpochMs } from "../../kernel/grc.ts";
import { err, ok, type Result } from "../../kernel/result.ts";
import type { Risk } from "../../kernel/test-record.ts";
import { type Declaration, isRegulated, phaseOf } from "../../mizan/changes/declaration.ts";
import { type FreshnessState, type FreshnessVerdict, counts as stateCounts } from "./freshness.ts";
import { applyEvent, type Attestation, type Ledger, type LedgerEvent, openNonconformance } from "./ledger.ts";
import { type Grade, GRADES, gradeRank, higherGrade, NO_GRADE, showGrade } from "./names.ts";
import type { QualityRecord } from "./record.ts";
import { noonOf } from "./time.ts";

// ---------------------------------------------------------------------------------------------------------------------------- evidence

/** What a run showed of one requirement: it passed, failed, or proved nothing (every case that names it was skipped, cancelled, a todo or `not_run`). */
export type RunResult = "pass" | "fail" | "unproven";

/** The newest run's evidence of one requirement. */
export type RunEvidence = {
  readonly kind: "run";
  readonly requirement: string;
  readonly traceId: string;
  /** The UTC day the run ended, `YYYY-MM-DD`. */
  readonly day: string;
  readonly at: Instant;
  readonly revision?: string;
  /** The grade the quality branch gives the run (`E3`, `E4`); `E3` where it is not kept. */
  readonly grade: Grade;
  readonly result: RunResult;
  readonly risk: Risk;
  /** The files of the tests that name it. */
  readonly files: readonly string[];
  /** What failed, or why nothing ran. */
  readonly detail: string;
};

/** A person's or an agent's statement (`E1`), review (`E2`) or a probe's report (`E5`) of one requirement. */
export type AttestedEvidence = {
  readonly kind: "statement" | "review" | "probe";
  readonly requirement: string;
  readonly day: string;
  readonly at: Instant;
  /** Whether a person or an agent made it (FR-024); a probe is neither. */
  readonly by?: "person" | "agent";
  readonly who?: string;
  readonly result: "pass" | "fail";
  readonly sample?: boolean;
  readonly source?: string;
};

/** A piece of evidence of a requirement. */
export type Evidence = RunEvidence | AttestedEvidence;

/** The requirements a record's cases name, and what the run showed of each (the cases that ran or did not). */
export function evidenceOfRun(q: QualityRecord, grade: Grade): readonly RunEvidence[] {
  const ids = [...new Set(q.cases.flatMap((c) => c.requirements))].sort();
  const end = instantFromEpochMs(Number(q.run.end / 1_000_000n));
  if (end === undefined) return [];
  return ids.map((requirement): RunEvidence => {
    const mine = q.cases.filter((c) => c.requirements.includes(requirement));
    const failed = mine.filter((c) => c.outcome === "fail");
    const passed = mine.filter((c) => c.outcome === "pass");
    const result: RunResult = failed.length > 0 ? "fail" : passed.length > 0 ? "pass" : "unproven";
    const detail =
      failed.length > 0
        ? failed.map((c) => `${c.name}${c.message === undefined ? "" : `: ${c.message}`}`).join("; ")
        : result === "unproven"
          ? mine.map((c) => `${c.name} ${c.outcome}${c.reason === undefined ? "" : ` (${c.reason})`}`).join("; ")
          : `${passed.length} case${passed.length === 1 ? "" : "s"} passed`;
    return {
      kind: "run",
      requirement,
      traceId: q.traceId,
      day: end.slice(0, 10),
      at: end,
      ...(q.run.runner.revision === undefined ? {} : { revision: q.run.runner.revision }),
      grade: result === "pass" ? grade : NO_GRADE,
      result,
      risk: mine.some((c) => c.risk === "high") ? "high" : "not-high",
      files: [...new Set(mine.map((c) => c.file))].sort(),
      detail,
    };
  });
}

/** The evidence the ledger holds: its statements, reviews and probes, each at noon of its day. */
export function evidenceOfLedger(l: Ledger): readonly AttestedEvidence[] {
  const out: AttestedEvidence[] = [];
  for (const a of l.attestations) {
    const at = noonOf(a.day);
    if (at === undefined) continue;
    out.push(attested(a, at));
  }
  return out;
}

function attested(a: Attestation, at: Instant): AttestedEvidence {
  switch (a.kind) {
    case "statement":
      return { kind: "statement", requirement: a.requirement, day: a.day, at, by: a.by, who: a.who, result: "pass" };
    case "review":
      return { kind: "review", requirement: a.requirement, day: a.day, at, by: a.by, who: a.who, result: "pass", sample: a.sample };
    case "probe":
      return { kind: "probe", requirement: a.requirement, day: a.day, at, result: a.outcome, source: a.source };
    default:
      return absurd(a);
  }
}

/** What a piece of evidence is worth on its own (FR-021, FR-024): a passing run its grade, a statement `E1`, a review `E2` (an agent's no higher), a passing probe `E5`; what failed or proved nothing is `E0`. */
export function gradeOfEvidence(e: Evidence): Grade {
  switch (e.kind) {
    case "run":
      return e.result === "pass"
        ? gradeRank(e.grade) < gradeRank("E3")
          ? "E3"
          : gradeRank(e.grade) > gradeRank("E4")
            ? "E4"
            : e.grade
        : NO_GRADE;
    case "statement":
      return "E1";
    case "review":
      // a person's review is E2 and so is an agent's, and nothing an agent does is worth more (FR-024)
      return "E2";
    case "probe":
      return e.result === "pass" ? "E5" : NO_GRADE;
    default:
      return absurd(e);
  }
}

/** The grade a requirement needs to be counted proved (FR-011) by its risk alone: `E4` where one of its tests is of `high` risk, else `E3`. */
export function gradeRequired(risk: Risk): Grade {
  return risk === "high" ? "E4" : "E3";
}

/**
 * Whether a harness is regulated and in production on `today`: it declares a regulated domain (0020-ifccm FR-010) and its production day has come.
 * The declaration and the day are arguments, never read here.
 */
export function regulatedInProduction(declaration: Declaration | undefined, today: string): boolean {
  return isRegulated(declaration) && phaseOf(declaration, today) === "gate";
}

/**
 * The grade a requirement needs to be counted proved (FR-011): `E3`, `E4` where one of its tests is of `high` risk, and `E4` for every
 * requirement of a harness that declares a regulated domain and has declared production by `today`.
 */
export function gradeNeeded(risk: Risk, declaration: Declaration | undefined, today: string): Grade {
  return regulatedInProduction(declaration, today) ? "E4" : gradeRequired(risk);
}

/** What a harness has declared and the day it is judged on: the two facts the grade a requirement needs depends on besides its risk (FR-011). */
export type AssuranceContext = { readonly declaration: Declaration | undefined; readonly today: string };

// ---------------------------------------------------------------------------------------------------------------------------- judging a requirement

/** A piece of evidence and its freshness (FR-025). */
export type Judged = { readonly evidence: Evidence; readonly grade: Grade; readonly freshness: FreshnessVerdict };

/** A requirement as the ladder judges it. */
export type Judgement = {
  readonly requirement: string;
  /** The highest grade of its fresh evidence (FR-021); `E0` where it has none. */
  readonly grade: Grade;
  /** The day of the evidence that gives the grade. */
  readonly day?: string;
  /** The freshness of that evidence, or `None` where the requirement has none that counts. */
  readonly freshness: FreshnessState | "None";
  readonly risk: Risk;
  readonly required: Grade;
  /** Whether it is counted proved: its grade is at least what its risk asks (FR-011). */
  readonly proved: boolean;
  /** The newest run or probe of it that failed, which opens a nonconformance (FR-007). */
  readonly failed?: Judged;
  /** The best evidence of it that is stale where nothing fresh gives its grade: a stale proof opens a nonconformance (FR-025). */
  readonly stale?: Judged;
  /** How many of its newest run's cases did not run. */
  readonly unproven: boolean;
  /** Whether a statement or a review of an agent gives the grade (said so in the record, FR-024). */
  readonly byAgent: boolean;
};

/**
 * The newest evidence of each kind that supersedes: only the newest run of a requirement and its newest probe count; every statement and
 * review does. A correction is a new run that supersedes the first (0021-ifqs edge cases), which stays on the branch.
 */
export function superseding(evidence: readonly Evidence[]): readonly Evidence[] {
  const newest = (kind: "run" | "probe"): Evidence | undefined =>
    evidence.filter((e) => e.kind === kind).sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))[0];
  return [
    ...evidence.filter((e) => e.kind !== "run" && e.kind !== "probe"),
    ...[newest("run"), newest("probe")].filter((e) => e !== undefined),
  ];
}

/** One requirement judged from all the evidence of it, each piece with the freshness the caller found (FR-021, FR-025, FR-011). */
export function judgeRequirement(requirement: string, judged: readonly Judged[], context?: AssuranceContext): Judgement {
  const fresh = judged.filter((j) => stateCounts(j.freshness.state) && gradeRank(j.grade) > 0);
  let best: Judged | undefined;
  for (const j of fresh) {
    if (
      best === undefined ||
      gradeRank(j.grade) > gradeRank(best.grade) ||
      (gradeRank(j.grade) === gradeRank(best.grade) && j.evidence.at > best.evidence.at)
    )
      best = j;
  }
  const grade = best?.grade ?? NO_GRADE;
  const runs = judged.flatMap((j) => (j.evidence.kind === "run" ? [j.evidence] : []));
  const risk: Risk = runs.some((r) => r.risk === "high") ? "high" : "not-high";
  const failed = judged.find((j) => (j.evidence.kind === "run" || j.evidence.kind === "probe") && j.evidence.result === "fail");
  const stale = judged
    .filter((j) => j.freshness.state === "Stale" && gradeRank(j.grade) > gradeRank(grade) && j.evidence.result === "pass")
    .sort((a, b) => gradeRank(b.grade) - gradeRank(a.grade))[0];
  const required = context === undefined ? gradeRequired(risk) : gradeNeeded(risk, context.declaration, context.today);
  const newestRun = runs.sort((a, b) => (a.at < b.at ? 1 : -1))[0];
  return {
    requirement,
    grade,
    ...(best === undefined ? {} : { day: best.evidence.day }),
    freshness: best?.freshness.state ?? "None",
    risk,
    required,
    proved: gradeRank(grade) >= gradeRank(required) && gradeRank(grade) >= gradeRank("E3"),
    ...(failed === undefined ? {} : { failed }),
    ...(stale === undefined ? {} : { stale }),
    unproven: newestRun?.result === "unproven",
    byAgent: best !== undefined && best.evidence.kind !== "run" && best.evidence.kind !== "probe" && best.evidence.by === "agent",
  };
}

// ---------------------------------------------------------------------------------------------------------------------------- debt and counts

/** The review debt (`ifqs:ReviewDebt`, FR-023): how many requirements' best fresh evidence is `E1` or `E2`. */
export function reviewDebt(js: readonly Judgement[]): number {
  return js.filter((j) => j.grade === "E1" || j.grade === "E2").length;
}

/** The review debt that rests on an agent's statement or review (0021-ifqs FR-048): counted apart from a person's, because an agent's review is graded below a run. */
export function reviewDebtByAgent(js: readonly Judgement[]): number {
  return js.filter((j) => (j.grade === "E1" || j.grade === "E2") && j.byAgent).length;
}

/** The review debt that rests on a person's statement or review (0021-ifqs FR-048). */
export function reviewDebtByPerson(js: readonly Judgement[]): number {
  return js.filter((j) => (j.grade === "E1" || j.grade === "E2") && !j.byAgent).length;
}

/** The counts of a set of judgements: how many requirements are at each grade, how many are proved and at what grade, and the review debt. */
export type Summary = {
  readonly requirements: number;
  readonly byGrade: Readonly<Record<Grade, number>>;
  readonly proved: number;
  /** How many proved requirements stand at each grade. */
  readonly provedByGrade: Readonly<Record<Grade, number>>;
  /** The review debt in all: the sum of the two that follow (FR-048). */
  readonly reviewDebt: number;
  /** The part of the review debt that rests on an agent's evidence (FR-048). */
  readonly reviewDebtByAgent: number;
  /** The part of the review debt that rests on a person's evidence (FR-048). */
  readonly reviewDebtByPerson: number;
  readonly stale: number;
  /** Requirements whose newest run proved nothing. */
  readonly unproven: number;
};

const zero = (): Record<Grade, number> => ({ E0: 0, E1: 0, E2: 0, E3: 0, E4: 0, E5: 0 });

/** The summary of judgements. */
export function summarize(js: readonly Judgement[]): Summary {
  const byGrade = zero();
  const provedByGrade = zero();
  let proved = 0;
  for (const j of js) {
    byGrade[j.grade]++;
    if (j.proved) {
      proved++;
      provedByGrade[j.grade]++;
    }
  }
  return {
    requirements: js.length,
    byGrade,
    proved,
    provedByGrade,
    reviewDebt: reviewDebt(js),
    reviewDebtByAgent: reviewDebtByAgent(js),
    reviewDebtByPerson: reviewDebtByPerson(js),
    stale: js.filter((j) => j.stale !== undefined).length,
    unproven: js.filter((j) => j.unproven).length,
  };
}

/** The share of requirements at a grade or above, from 0 to 1 (1 where there are none to judge). */
export function shareAtOrAbove(s: Summary, grade: Grade): number {
  if (s.requirements === 0) return 1;
  return GRADES.filter((g) => gradeRank(g) >= gradeRank(grade)).reduce((n, g) => n + s.byGrade[g], 0) / s.requirements;
}

/** A count of proved requirements as it may be shown: with the grade it is counted at and the review debt (FR-006, FR-023). */
export type ProofCount = {
  readonly proved: number;
  readonly provedByGrade: Readonly<Record<Grade, number>>;
  readonly reviewDebt: number;
};

/**
 * A count of requirements proved as text, never without its grade and its review debt (FR-006, FR-023, SC-003): a count that lacks the grade
 * it is counted at, or the review debt, is refused. The text is `12 proved (E4 2, E3 10), review debt 3`.
 */
export function showProofCount(count: {
  readonly proved: number;
  readonly provedByGrade?: Readonly<Record<Grade, number>>;
  readonly reviewDebt?: number;
  readonly reviewDebtByAgent?: number;
  readonly reviewDebtByPerson?: number;
}): Result<string, string> {
  if (count.provedByGrade === undefined) return err("a count of proved requirements is shown with its grade: this one has none");
  if (count.reviewDebt === undefined)
    return err("a count of proved requirements is shown with the review debt beside it: this one has none");
  const grades = [...GRADES]
    .reverse()
    .filter((g) => (count.provedByGrade?.[g] ?? 0) > 0)
    .map((g) => `${g} ${count.provedByGrade?.[g]}`);
  const total = GRADES.reduce((n, g) => n + (count.provedByGrade?.[g] ?? 0), 0);
  if (total !== count.proved) return err(`${count.proved} proved but ${total} counted by grade: the grades must add up to the count`);
  const apart =
    count.reviewDebtByAgent === undefined || count.reviewDebtByPerson === undefined
      ? ""
      : ` (person ${count.reviewDebtByPerson}, agent ${count.reviewDebtByAgent})`;
  if (apart !== "" && (count.reviewDebtByAgent ?? 0) + (count.reviewDebtByPerson ?? 0) !== count.reviewDebt)
    return err(
      `review debt ${count.reviewDebt} but a person's and an agent's make ${(count.reviewDebtByAgent ?? 0) + (count.reviewDebtByPerson ?? 0)}`,
    );
  return ok(
    `${count.proved} proved (${grades.length === 0 ? "no grade, none proved" : grades.join(", ")}), review debt ${count.reviewDebt}${apart}`,
  );
}

/** The review debt judged against the revision before it (FR-023): it MUST NOT grow without a Decision. */
export type DebtJudgement = { readonly ok: boolean; readonly message: string };

/** Whether the review debt at a revision is allowed: no more than at its parent, or a Decision covers the growth. */
export function judgeDebt(previous: number | undefined, now: number, decided: boolean): DebtJudgement {
  if (previous === undefined || now <= previous)
    return { ok: true, message: `review debt ${now}${previous === undefined ? "" : ` (was ${previous})`}` };
  if (decided) return { ok: true, message: `review debt grew from ${previous} to ${now}, and a Decision covers it` };
  return { ok: false, message: `review debt grew from ${previous} to ${now} with no Decision: it does not grow without one` };
}

// ---------------------------------------------------------------------------------------------------------------------------- opening nonconformances

/** The events that open the nonconformances the judgements call for (FR-007): one for each requirement whose newest result failed, one for each whose proof is stale; none where one is already open for it. */
export function nonconformancesFrom(js: readonly Judgement[], ledger: Ledger, day: string): readonly LedgerEvent[] {
  const out: LedgerEvent[] = [];
  let l = ledger;
  const push = (e: Result<LedgerEvent, string>): void => {
    if (e.kind === "err") return;
    const next = applyEvent(l, e.value);
    if (next.kind === "err") return;
    out.push(e.value);
    l = next.value;
  };
  for (const j of js) {
    const f = j.failed;
    if (f !== undefined) {
      const e = f.evidence;
      push(
        openNonconformance(
          l,
          {
            requirement: j.requirement,
            cause: e.kind === "probe" ? "probe-failed" : "failed",
            reason: e.kind === "run" ? `the newest run failed: ${e.detail}` : `the probe ${e.source ?? ""} reported a failure`.trim(),
            evidence: e.kind === "run" ? { traceId: e.traceId, ...(e.revision === undefined ? {} : { revision: e.revision }) } : {},
          },
          day,
        ),
      );
      continue;
    }
    const s = j.stale;
    if (s !== undefined) {
      const e = s.evidence;
      push(
        openNonconformance(
          l,
          {
            requirement: j.requirement,
            cause: "stale",
            reason: `the proof at ${showGrade(s.grade)} is stale by ${s.freshness.by}: ${s.freshness.why}`,
            evidence: e.kind === "run" ? { traceId: e.traceId, ...(e.revision === undefined ? {} : { revision: e.revision }) } : {},
          },
          day,
        ),
      );
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------------- the register (FR-022)

/** A row of the proof register (`enforcement.tsv`, 0003-mizan FR-005). */
export type RegisterRow = { readonly requirement: string; readonly mechanism: string; readonly by: string; readonly note: string };

/** The rows of `enforcement.tsv`: its four columns; comment lines, blank lines and the header are not rows. */
export function parseRegister(text: string): readonly RegisterRow[] {
  const rows: RegisterRow[] = [];
  for (const line of text.replaceAll("\r\n", "\n").split("\n")) {
    if (line.trim() === "" || line.startsWith("#")) continue;
    const [requirement = "", mechanism = "", by = "", ...note] = line.split("\t");
    if (requirement === "requirement") continue;
    rows.push({ requirement: requirement.trim(), mechanism: mechanism.trim(), by: by.trim(), note: note.join("\t").trim() });
  }
  return rows;
}

/** The generated header of the register's view. */
export const REGISTER_VIEW_HEADER = [
  "# The proof register with the grade and the day of the evidence of each row (commons 0021-ifqs FR-022).",
  "# Generated by `bun commons/ts/quality/quality.ts register` from enforcement.tsv and the quality branch; never edit it by hand.",
  "requirement\tmechanism\tgrade\tday\tfreshness\tproved",
].join("\n");

/**
 * The register shown with the grade and the day of the evidence of each row, generated and never written by hand (FR-022): the rows of
 * `enforcement.tsv` in their order, each with the grade of the requirement, the day of the evidence that gives it, its freshness and whether it
 * is counted proved; the totals follow, with the review debt beside the count of proved (FR-006, FR-023).
 */
export function registerView(rows: readonly RegisterRow[], judgements: ReadonlyMap<string, Judgement>): string {
  const lines = rows.map((r) => {
    const j = judgements.get(r.requirement);
    return [
      r.requirement,
      r.mechanism,
      j?.grade ?? NO_GRADE,
      j?.day ?? "-",
      j?.freshness ?? "None",
      j?.proved === true ? "yes" : "no",
    ].join("\t");
  });
  const s = summarize(rows.map((r) => judgements.get(r.requirement)).filter((j) => j !== undefined));
  const total = showProofCount({
    proved: s.proved,
    provedByGrade: s.provedByGrade,
    reviewDebt: s.reviewDebt,
    reviewDebtByAgent: s.reviewDebtByAgent,
    reviewDebtByPerson: s.reviewDebtByPerson,
  });
  return `${REGISTER_VIEW_HEADER}\n${lines.join("\n")}${lines.length === 0 ? "" : "\n"}# ${rows.length} requirements; ${total.kind === "ok" ? total.value : total.error}\n`;
}

/** The best grade of a list, for callers that fold grades. */
export function bestGrade(gs: readonly Grade[]): Grade {
  return gs.reduce(higherGrade, NO_GRADE);
}
