/**
 * Mutation runs and the strength of a proof (commons 0021-ifqs FR-040): a run that mutates the code a test proves and records whether the
 * test failed. The run is made by a tool the record names (this system does not run one); here is the typed record, its ingestion from the
 * report the tool's wrapper writes, the strength of each requirement's proof as a number, and what it does to the grade.
 *
 * - The **strength** of a requirement is the share of its mutants that its tests detected: `(killed + timeout) / (mutants - equivalent)`, in
 *   a thousandth (`permille`), rounded down. A requirement whose mutants are all equivalent has none.
 * - The **grade** is shown beside it. A strength below the floor the harness states (60 % where it states none, 80 % where it declares a
 *   regulated domain and production: `mutationFloor`) lowers the grade of a
 *   proof that is a run, `E4` to `E3` and `E3` to `E2`: tests that do not notice a change to the code they prove do not attest it. A grade
 *   that is not a run's (`E1`, `E2`, `E5`) and a requirement that no mutation run measured keep their grade, and say which.
 *
 * @remarks
 * The report is `ifqs-mutation-report/1`, a small JSON file: the tool's name and version, the revision it mutated and one row of counts for each
 * requirement. A tool whose own report has another form (Stryker's, for one) is wrapped to write this one: a mapping from a mutant to the
 * requirement its killing test proves is the harness's, since a mutation report does not know requirements.
 *
 * @module
 */
import { array, type Decoded, formatDecodeError, json, literal, object, string, err, ok, type Result } from "@intellectual-frontiers/core";
import type { Declaration } from "../../mizan/changes/declaration.ts";
import { regulatedInProduction } from "../pure/ladder.ts";
import type { LedgerEvent } from "../pure/ledger.ts";
import { type Grade, gradeRank, GRADES } from "../pure/names.ts";
import { dayOfText } from "../pure/time.ts";
import { type MutationRow, mutationRowDecoder } from "../pure/tier2-events.ts";
import { type Assurance, formatAssuranceError, foldAssurance, nextId, type RecordedMutationRun } from "./rules.ts";

/** The floor of strength, in a thousandth, below which a proof's grade is lowered where the harness states no other. */
export const DEFAULT_FLOOR_PERMILLE = 600;

/** The floor of a harness that declares a regulated domain and has declared production (FR-046), in a thousandth. */
export const REGULATED_FLOOR_PERMILLE = 800;

/**
 * The floor of strength a harness is held to on `today` (0021-ifqs FR-046): 600 where it states none, 800 where it declares a regulated domain and
 * has declared production (`today` is on or after its production day), and where it states a floor of its own, that floor, never below the
 * regulated one for a regulated harness in production. The declaration and the day are arguments: nothing is read here.
 */
export function mutationFloor(declaration: Declaration | undefined, today: string, stated?: number): number {
  const base = stated ?? DEFAULT_FLOOR_PERMILLE;
  return regulatedInProduction(declaration, today) ? Math.max(base, REGULATED_FLOOR_PERMILLE) : base;
}

/** The strength of a row (FR-040): the share of the mutants that were not equivalent that the tests detected, in a thousandth, rounded down; none where all were equivalent. */
export function strengthPermille(r: MutationRow): number | undefined {
  const valid = r.mutants - (r.equivalent ?? 0);
  if (valid < 1) return undefined;
  return Math.floor((1000 * (r.killed + (r.timeout ?? 0))) / valid);
}

/** A strength as it is shown: `83.3%`. */
export function showStrength(permille: number): string {
  return `${Math.floor(permille / 10)}.${permille % 10}%`;
}

/** The strength of a requirement as the newest run that measured it gives it. */
export type Strength = {
  readonly requirement: string;
  readonly permille: number;
  readonly run: string;
  readonly tool: string;
  readonly day: string;
  readonly revision: string;
  readonly mutants: number;
  readonly survived: number;
};

/** The strength of each requirement some run measured, by the newest run (the later record replaces an earlier one). */
export function strengths(runs: readonly RecordedMutationRun[]): ReadonlyMap<string, Strength> {
  const out = new Map<string, Strength>();
  for (const run of [...runs].sort((a, b) => a.seq - b.seq)) {
    for (const row of run.rows) {
      const permille = strengthPermille(row);
      if (permille === undefined) continue;
      out.set(row.requirement, {
        requirement: row.requirement,
        permille,
        run: run.id,
        tool: run.tool.version === undefined ? run.tool.name : `${run.tool.name} ${run.tool.version}`,
        day: run.day,
        revision: run.revision,
        mutants: row.mutants,
        survived: row.survived,
      });
    }
  }
  return out;
}

/** What a strength does to a grade, and why. */
export type MutationEffect = {
  readonly grade: Grade;
  readonly effect: "unmeasured" | "kept" | "lowered" | "not-a-run";
  readonly why: string;
};

/** The grade a proof keeps given the strength of its tests (FR-040): see the module's account. `isRun` is whether the grade is a run's. */
export function gradeAfterMutation(
  grade: Grade,
  isRun: boolean,
  strength: Strength | undefined,
  floorPermille: number = DEFAULT_FLOOR_PERMILLE,
): MutationEffect {
  if (!isRun) return { grade, effect: "not-a-run", why: "the grade is not a run's, so no mutation run bears on it" };
  if (strength === undefined) return { grade, effect: "unmeasured", why: "no mutation run measured this proof" };
  if (strength.permille >= floorPermille)
    return {
      grade,
      effect: "kept",
      why: `its tests detect ${showStrength(strength.permille)} of the mutants, at or above ${showStrength(floorPermille)}`,
    };
  const lowered = GRADES[Math.max(0, gradeRank(grade) - 1)] ?? grade;
  return {
    grade: lowered,
    effect: "lowered",
    why: `its tests detect ${showStrength(strength.permille)} of the mutants, below ${showStrength(floorPermille)}: ${strength.survived} survived (${strength.run})`,
  };
}

const reportDecoder = object({
  schema: literal("ifqs-mutation-report/1"),
  tool: object({ name: string }, { version: string }),
  revision: string,
  results: array(mutationRowDecoder),
});

/** A mutation report as the tool's wrapper writes it. */
export type MutationReport = Decoded<typeof reportDecoder>;

/** A report read from its text, or why it is not one. */
export function readMutationReport(text: string): Result<MutationReport, string> {
  const r = json(text, reportDecoder);
  return r.kind === "ok" ? ok(r.value) : err(formatDecodeError(r.error));
}

/** The event that records a report (FR-040), with the next identifier; refused where its rows do not account for their mutants. */
export function mutationEvent(events: readonly LedgerEvent[], report: MutationReport, day: string): Result<LedgerEvent, string> {
  const d = dayOfText(day);
  if (d.kind === "err") return d;
  const before = foldAssurance(events);
  if (before.kind === "err") return err(formatAssuranceError(before.error));
  const event: LedgerEvent = {
    kind: "mutation-run",
    id: nextId("MUT", before.value.mutations.length),
    tool: report.tool,
    revision: report.revision,
    results: report.results,
    day: d.value,
  };
  const after = foldAssurance([...events, event]);
  return after.kind === "ok" ? ok(event) : err(formatAssuranceError(after.error));
}

/** The mutation runs of an assurance, newest first, for a listing. */
export function listRuns(a: Assurance): readonly RecordedMutationRun[] {
  return [...a.mutations].sort((x, y) => y.seq - x.seq);
}
