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
export const GATES = ["release", "branch-protection", "maintenance", "pages"] as const;
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

/** The checks a repository runs before a release, closed (0002-libraries-ci-findings FR-010): what a person or a pipeline runs is one of these, whatever program runs it. */
export const CHECKS = ["syntax", "types", "pack", "secret-scan", "tests", "lint", "format", "layers", "surface-thin", "agentless", "ladder", "register", "trace", "citations", "specifiers", "versions", "names", "mizan", "changes", "capabilities", "kanon", "hygiene", "generated-files", "docs"] as const;
/** A check. */
export type Check = (typeof CHECKS)[number];

/** What a failed check does to a release: `blocking` stops it; `finding` is recorded, printed and stops nothing. */
export type ReleaseClass = "blocking" | "finding";

/**
 * The class of each check for a release (0002-libraries-ci-findings FR-010), the one table that Repoctl, Agora and the generated workflows read. Only what makes the thing released unbuildable or unsafe to run blocks: a file the parser refuses,
 * a type error (the type surface of the exports included), a package that does not pack or cannot be imported once installed, and a credential in what is published. Everything else (size, style, coverage of requirements, the shape of the
 * repository, a failing test) is a finding: it runs, it is recorded and it is printed, and the release goes on. A failing test also gates the acceptance of a product, which is a different stage. A hold decided by the owner (`RELEASE_POLICY`)
 * and the approvals of a person are stages of a workflow and not checks, so they are not in this table.
 */
export const CHECK_CLASS: Readonly<Record<Check, { readonly class: ReleaseClass; readonly why: string }>> = {
  syntax: { class: "blocking", why: "a file the parser refuses cannot be built, packed or run" },
  types: { class: "blocking", why: "a type error is a crack in the type safety that every consumer relies on, the exported surface included" },
  pack: { class: "blocking", why: "a package that does not pack, install or import is not a release at all (how big it is does not decide that: a size budget is an advisory)" },
  "secret-scan": { class: "blocking", why: "a credential in a published package cannot be taken back, so this is a safety rule and not a style rule (kept blocking until the owner decides otherwise)" },
  tests: { class: "finding", why: "a failing test is said loudly in the release summary and holds acceptance, and the release is not a claim of acceptance" },
  lint: { class: "finding", why: "style and the findings of the linter are recorded and fixed, and a release does not wait for them" },
  format: { class: "finding", why: "the format of a file does not change what runs" },
  layers: { class: "finding", why: "the layers of a ladder are architecture and are held by review of the finding" },
  "surface-thin": { class: "finding", why: "the imports a renderer may make are architecture and are held by review of the finding" },
  agentless: { class: "finding", why: "a requirement that an asset must run software of ours is a finding of the requirement: every asset is complete without it, and the software is an optional accelerator" },
  ladder: { class: "finding", why: "the generated blocks of the ladder are made again by the generator" },
  register: { class: "finding", why: "the proof register of the requirements is made again by the generator" },
  trace: { class: "finding", why: "a requirement without a proof is a finding of the requirement" },
  citations: { class: "finding", why: "a citation that names no requirement is a finding of the text" },
  specifiers: { class: "finding", why: "the way a library is named is a finding of the import" },
  versions: { class: "finding", why: "a version that is not the one expected is a finding the release itself corrects" },
  names: { class: "finding", why: "the names of things are held by review of the finding" },
  mizan: { class: "finding", why: "the coverage of the specifications is a finding of each specification" },
  changes: { class: "finding", why: "a change without its record is a finding of the change" },
  capabilities: { class: "finding", why: "the trace of a capability by rung is a finding of the capability" },
  kanon: { class: "finding", why: "the pattern of a library is a finding of the library" },
  hygiene: { class: "finding", why: "the state of the installed packages is advice about a checkout" },
  "generated-files": { class: "finding", why: "a generated file that is out of date is made again by the generator" },
  docs: { class: "finding", why: "the documentation is a finding of the text" },
};

/** Whether a failed check stops a release. */
export const blocksRelease = (check: Check): boolean => CHECK_CLASS[check].class === "blocking";

/** The check named by a word of a declaration, or undefined where the word names none. */
export const checkOf = (word: string): Check | undefined => CHECKS.find((c) => c === word);
