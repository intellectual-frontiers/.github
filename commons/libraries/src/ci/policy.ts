// Spec: 0002-libraries-ci-findings FR-001
/**
 * The build policy of this repository (commons 0038-build-policy): a run is red only for a cause of the closed list `RED_CAUSES`, everything a module says is a finding, and the decisions that depend on findings (the release) are
 * explicit values and never the exit status of a step. This file is the one place the policy is written; the workflows, the step wrapper, the checks and the documentation read it.
 *
 * @remarks
 * Pure and dependency free (no package, only values and functions of this file), so that the step wrapper that imports it runs in a cell of the matrix before any package is installed: a wrapper that needs a package of the cell it is to
 * observe could itself be the thing that fails.
 *
 * @example
 * ```ts
 * import { RED_CAUSES, releaseDecision } from "./policy.ts";
 * RED_CAUSES.length; // 4
 * releaseDecision("2027-02-01").proceed; // false
 * ```
 *
 * @module
 */

/** What may turn a run red (0038-build-policy FR-002): the pipeline's own scripting and configuration, and nothing that a module says. */
export const RED_CAUSES = ["workflow-invalid", "wrapper-misused", "plan-unavailable", "reports-not-produced"] as const;
/** A red cause. */
export type RedCause = (typeof RED_CAUSES)[number];

/** Why each red cause is one: the sentence that justifies it. */
export const RED_CAUSE_WHY: Readonly<Record<RedCause, string>> = {
  "workflow-invalid": "a workflow or action file that is not what the model makes, or that GitHub's schema refuses, is the pipeline's own configuration: no module wrote it and no module can fix it",
  "wrapper-misused": "the step wrapper called with an unknown step, no command or an unreadable policy is the pipeline's own scripting: it can say nothing about a module",
  "plan-unavailable": "when the job that plans the matrix cannot make it, no cell can run and no report can be made: the pipeline cannot start",
  "reports-not-produced": "when a cell ran and left no findings file, the pipeline has lost what it exists to keep, and nothing it says afterwards could be trusted",
};

/** The tools whose output becomes findings (0038-build-policy FR-013): a closed table. `verify` is a library's `verify` script (the parsers of `tsc`, `bun-test` and `kanon-check` over its output) and `checks` a script of the repository's checks (`generated-files`, `repoctl-check`, `kanon-check` and `mizan-check`); `policy` is the policy's own (the review of the release); `install` and `exit-status` read a step that has no parser of its own. */
export const TOOLS = ["tsc", "bun-test", "lint", "format", "repoctl-check", "mizan-check", "kanon-check", "generated-files", "verify", "checks", "exit-status", "install", "policy"] as const;
/** A tool. */
export type Tool = (typeof TOOLS)[number];

/** The gates there are: the decisions that depend on findings, each written as data of this file. */
export const GATES = ["release", "branch-protection", "pages"] as const;
/** A gate. */
export type Gate = (typeof GATES)[number];

/**
 * The policy of one step of a workflow (0038-build-policy FR-003): a red cause the step may be, a step whose output is read into findings by the parser of a tool, a gate, or plumbing (a step that moves or keeps what the
 * other steps made and says nothing about a module).
 */
export type StepPolicy =
  | { readonly kind: "red-cause"; readonly cause: RedCause }
  | { readonly kind: "finding"; readonly tool: Tool; readonly timeoutMinutes: number; readonly module: string; readonly errexit: boolean; readonly perFile: boolean }
  | { readonly kind: "gate"; readonly gate: Gate }
  | { readonly kind: "plumbing" };

/** The policy of a step that is a red cause. */
export const redCause = (cause: RedCause): StepPolicy => ({ kind: "red-cause", cause });
/**
 * The policy of a step whose output is read into findings: the tool, the minutes after which the wrapper stops its command, the module its findings are of (the text of a matrix expression such as `${{ matrix.name }}` where the step is
 * in a library's cell, `repository` otherwise), whether the findings are of one module for each test file the output names (`perFile`, for the tests of the repository's root: 0038-build-policy FR-014) and whether the script stops at its first failing command (`errexit`; a script of several independent checks does not, so that each one runs and says its findings).
 */
export const finding = (tool: Tool, timeoutMinutes: number, o: { readonly module?: string; readonly errexit?: boolean; readonly perFile?: boolean } = {}): StepPolicy => ({ kind: "finding", tool, timeoutMinutes, module: o.module ?? "repository", errexit: o.errexit ?? true, perFile: o.perFile ?? false });
/** The policy of a step that is a gate. */
export const gate = (g: Gate): StepPolicy => ({ kind: "gate", gate: g });
/** The policy of a step that is plumbing. */
export const plumbing: StepPolicy = { kind: "plumbing" };

/** The people who may approve an accepted risk (0038-build-policy FR-008): by their login. An agent is never one. */
export const APPROVERS: readonly string[] = ["shah"];

/** The longest an acceptance may last, in days (0038-build-policy FR-008). */
export const ACCEPTANCE_MAX_DAYS = 366;

/** A hold the owner recorded (0038-build-policy FR-010): `by` is a login of `APPROVERS`, `on` the first day it holds, `mode` what it holds by. Only the owner decides a hold; an agent never records one. */
export type RecordedDecision = { readonly by: string; readonly on: string; readonly mode: "hold-critical" };

/** The decision the release is under (0038-build-policy FR-010): publish whatever is open, on every day, unless the owner recorded a hold; `until` is the day after which the finding `owner-review-due` asks the owner again, and `reviewedOn` the day the owner reviewed the policy. */
export type ReleasePolicy = {
  readonly mode: "publish-regardless";
  readonly until: string;
  readonly reviewedOn?: string;
  readonly decision?: RecordedDecision;
};

/** The release policy (decided by the owner on 2026-11-22): publish whatever is open; a hold, of a library or of the package, is a serious decision and only ever the owner's; until 2027-01-31 the owner holds nothing by default, and from 2027-02-01 the finding `owner-review-due` asks again. No decision is recorded. */
export const RELEASE_POLICY: ReleasePolicy = { mode: "publish-regardless", until: "2027-01-31" };

/** The finding the owner must see where the policy has run out and has not been reviewed. */
export type OwnerReview = { readonly tool: "policy"; readonly code: "owner-review-due"; readonly severity: "error"; readonly module: "repository"; readonly message: string };

/** What the release may do on a day: always proceed from the gate's side; by one of two modes (the second only by a decision of the owner), with the finding the owner must see where the policy has run out and has not been reviewed, and the refusal of a decision that is not the owner's. */
export type ReleaseDecision =
  | { readonly proceed: true; readonly mode: "publish-regardless"; readonly reportOpenFindings: true; readonly until: string; readonly ownerReview: OwnerReview | undefined; readonly refused: string | undefined }
  | { readonly proceed: true; readonly mode: "hold-critical"; readonly from: string; readonly by: string; readonly ownerReview: undefined; readonly refused: undefined };

/** The decision of the release on a day (`YYYY-MM-DD`) (0038-build-policy FR-010): never a hold of its own; a hold only from the day of a recorded decision whose `by` is an approver. */
export function releaseDecision(day: string, policy: ReleasePolicy = RELEASE_POLICY): ReleaseDecision {
  const d = policy.decision;
  if (d !== undefined && APPROVERS.includes(d.by) && day >= d.on) return { proceed: true, mode: "hold-critical", from: d.on, by: d.by, ownerReview: undefined, refused: undefined };
  const refused = d !== undefined && !APPROVERS.includes(d.by) ? `the decision to hold recorded by ${JSON.stringify(d.by)} is refused: only the owner (${APPROVERS.join(", ")}) decides a hold; nothing is held` : undefined;
  const due = day > policy.until && policy.reviewedOn === undefined && d === undefined;
  const ownerReview: OwnerReview | undefined = due
    ? { tool: "policy", code: "owner-review-due", severity: "error", module: "repository", message: `the release policy "${policy.mode}" ran until ${policy.until}: the owner decides again whether to hold; the gate holds nothing by itself and the release goes on` }
    : undefined;
  return { proceed: true, mode: "publish-regardless", reportOpenFindings: true, until: policy.until, ownerReview, refused };
}

/** The libraries a finding holds under `hold-critical`: those that have an open finding of severity `error` (an accepted one is not open); a finding of the module `repository` holds no library. */
export function heldLibraries(open: readonly { readonly module: string; readonly severity: string }[]): readonly string[] {
  return [...new Set(open.filter((f) => f.severity === "error" && f.module !== "repository").map((f) => f.module))].sort();
}
