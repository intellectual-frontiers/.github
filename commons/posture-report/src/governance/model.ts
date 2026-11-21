// Spec: 0002-report-site FR-001
/**
 * The input of a report (0002-report-site FR-001): what the assessment, the grades and the matrix of responsibility say of one framework for one tenant at one instant, with the titles a reader needs. The report holds no logic of its own about standing or grade: it shows what it is given.
 *
 * @example
 * ```ts
 * import type { ReportInput } from "./model.ts";
 * const input: ReportInput | undefined = undefined;
 * ```
 *
 * @module
 */
import type { Assessment, ObjectiveGrade } from "@intellectual-frontiers/assessment/logical";
import type { Matrix } from "@intellectual-frontiers/tenancy/logical";

/** What a report is made from. */
export type ReportInput = {
  /** The name of the report and of the tenant it is about. */
  readonly title: string;
  /** The instant the posture is of. */
  readonly generatedAt: string;
  readonly framework: { readonly id: string; readonly title: string };
  readonly assessment: Assessment;
  readonly grades: readonly ObjectiveGrade[];
  readonly responsibilities?: Matrix;
  /** The name of each requirement, by its identifier, where the framework has them. */
  readonly requirementTitles?: Readonly<Record<string, string>>;
};

/** The files of a site, by path. */
export type Site = ReadonlyMap<string, string>;
