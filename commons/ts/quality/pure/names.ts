/**
 * The words of the quality system's record (commons 0021-ifqs): the outcome of a case (the five of 0008-test-evidence FR-001 and `not_run`,
 * FR-014), the grade of evidence `E0` to `E5` (FR-021) with its rank, the names of the attributes this specification adds to the record,
 * the layout of the `quality` branch and its notes (FR-016 to FR-018), and the names ISO/IEC 25010 and ISO/IEC/IEEE 29119-3 give
 * (FR-012). Pure: nothing here reads a host.
 *
 * @remarks
 * The outcome and grade words are the `outcomeWord` and the keys of the code lists in `commons/ontology/ifqs/ifqs.ts` (`ifqs:TestOutcome`,
 * `ifqs:EvidenceGrade`); a test (`quality-record.test.ts`) asserts that they are equal, so that the two cannot drift apart.
 *
 * @example
 * ```ts
 * import { gradeRank, isGrade } from "./names.ts";
 * isGrade("E4") && gradeRank("E4") > gradeRank("E3"); // true
 * ```
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import { OUTCOMES, type Outcome } from "../../kernel/test-record.ts";

/** What became of a case: 0008-test-evidence's five outcomes and `not_run`, a planned case that never started, with its reason (0021-ifqs FR-014). */
export type QualityOutcome = Outcome | "not_run";

/** Every outcome of a case, in the order reports list them. */
export const QUALITY_OUTCOMES: readonly QualityOutcome[] = [...OUTCOMES, "not_run"];

/** Whether a text is an outcome of a case, `not_run` included. */
export function isQualityOutcome(text: string): text is QualityOutcome {
  return (QUALITY_OUTCOMES as readonly string[]).includes(text);
}

/** The grade of a piece of evidence (0021-ifqs FR-021): none, stated, reviewed, tested, attested, observed. */
export type Grade = "E0" | "E1" | "E2" | "E3" | "E4" | "E5";

/** Every grade, lowest first. */
export const GRADES: readonly Grade[] = ["E0", "E1", "E2", "E3", "E4", "E5"];

/** Whether a text is a grade. */
export function isGrade(text: string): text is Grade {
  return (GRADES as readonly string[]).includes(text);
}

/** The rank of a grade, 0 to 5 (`ifqs:gradeRank`). */
export function gradeRank(g: Grade): number {
  return GRADES.indexOf(g);
}

/** The higher of two grades. */
export function higherGrade(a: Grade, b: Grade): Grade {
  return gradeRank(a) >= gradeRank(b) ? a : b;
}

/** What each grade says, as a few words that are shown beside it. */
export function gradeWords(g: Grade): string {
  switch (g) {
    case "E0":
      return "none";
    case "E1":
      return "stated";
    case "E2":
      return "reviewed";
    case "E3":
      return "tested";
    case "E4":
      return "attested";
    case "E5":
      return "observed";
    default:
      return absurd(g);
  }
}

/** A grade as it is shown: `E3 tested`. */
export function showGrade(g: Grade): string {
  return `${g} ${gradeWords(g)}`;
}

/** The attributes this specification adds to the record (0021-ifqs Assumptions: names of this specification, not of OpenTelemetry). */
export const ATTR = {
  /** The grade of a case or of a run, as the producer of the record claims it. */
  grade: "ifc.quality.grade",
  /** The SHA-256 of the evidence file before this one on the branch, on every resource of the file (FR-017). */
  previous: "ifc.quality.previous.sha256",
  /** The quality characteristic of ISO/IEC 25010 a test proves (FR-012). */
  characteristic: "ifc.test.characteristic",
  /** The count of cases that did not run, on the run's span (FR-005). */
  notRun: "ifc.quality.not_run",
  /** The id of the rule of a check that a case reports (FR-015). */
  rule: "ifc.check.rule",
  /** The line of a finding's file (OpenTelemetry's code attribute). */
  line: "code.line.number",
} as const;

/** The name of the orphan branch the evidence is kept on (FR-016). */
export const QUALITY_BRANCH = "quality";

/** The notes reference that links a tested commit to its evidence (FR-018). */
export const NOTES_REF = "refs/notes/quality";

/** The folder of the evidence files on the branch (FR-016). */
export const EVIDENCE_ROOT = "quality/evidence";

/** The event name of a case's log record (0008-test-evidence). */
export const CASE_EVENT = "ifc.test.case";

/** The grade a case that ran to a result carries: a run proved it, and the record exists (FR-021). */
export const RUN_GRADE: Grade = "E3";

/** The grade of what never proved anything: a case that did not run, or did not end (FR-021). */
export const NO_GRADE: Grade = "E0";

/**
 * The quality characteristics of ISO/IEC 25010:2023, the words `ifc.test.characteristic` takes (FR-012). The standard's text is not copied;
 * these are its names for the characteristics.
 */
export const CHARACTERISTICS: readonly string[] = [
  "functional suitability",
  "performance efficiency",
  "compatibility",
  "interaction capability",
  "reliability",
  "security",
  "maintainability",
  "flexibility",
  "safety",
];

/** Whether a text is the name of a characteristic. */
export function isCharacteristic(text: string): boolean {
  return CHARACTERISTICS.includes(text);
}

/** The document names of ISO/IEC/IEEE 29119-3 that a report of a run bears (FR-012). */
export const DOCUMENTS = {
  completion: "Test Completion Report",
  status: "Test Status Report",
  incident: "Test Incident Report",
} as const;
