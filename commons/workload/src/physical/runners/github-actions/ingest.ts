// Spec: 0014-runner-github-actions FR-007, FR-008
/**
 * The ingest of a run of GitHub Actions into the receipt of the core, a pure function: the caller fetches the result of a finished run (its address, its conclusion, the conclusion of each job, the digest of its log, the approvals that
 * people gave to its environments) and this turns it into one `receipt` event, matched to the `handoff` by the plan hash. There is no network here. The exit status is 0 only where the run and every job concluded with success
 * (skipped and neutral jobs do not fail a run); a run that is not finished, an address that is not the address of a run, a digest that is not one and a plan other than the one the workflow carries are refused with
 * `E-WL-RUNNER-RECEIPT-INVALID`. An approval of an environment counts only where a person gave it (the account is a user, not an app) and a person records the receipt: an approval by an app, or in a receipt that an agent or a tool
 * records, is dropped from the receipt and refused with `E-WL-RUNNER-APPROVAL-NOT-PERSON`, so that an agent never approves.
 *
 * @example
 * ```ts
 * import { receiptFromRun } from "./ingest.ts";
 * // receiptFromRun(run, { recordedBy: "person" }).kind: "ok" with the receipt event
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type Finding, finding, isDigest, type RunnerEvent } from "@intellectual-frontiers/workload/governance";

/** The conclusion of a run or of a job, as GitHub names it; `null` while it has none. */
export type RunConclusion = "success" | "failure" | "cancelled" | "timed_out" | "skipped" | "neutral" | "action_required" | "stale" | "startup_failure";

/** The approval of a gate on GitHub: the environment (the id of the gate), who gave it and whether it was an approval. */
export type RunApproval = { readonly gate: string; readonly by: { readonly login: string; readonly kind: "user" | "app" }; readonly state: "approved" | "rejected" };

/** What the caller pulled of a finished run. */
export type GithubRun = {
  /** The address of the run: `https://<host>/<owner>/<repo>/actions/runs/<id>`, with `/attempts/<n>` for an attempt. */
  readonly url: string;
  /** The hash of the plan the workflow of the run carries (its `# plan:` line, or `WORKLOAD_PLAN`). */
  readonly plan: string;
  readonly conclusion: RunConclusion | null;
  /** The conclusion of each job, by job id. */
  readonly jobs: Readonly<Record<string, RunConclusion | null>>;
  /** The SHA-256 of the text of the log of the run, 64 lower case hexadecimal digits. */
  readonly logDigest: string;
  readonly approvals?: readonly RunApproval[];
};

/** The receipt of a run: the event, and what was refused. */
export type RunReceipt = { readonly event: Extract<RunnerEvent, { readonly kind: "receipt" }>; readonly refused: readonly Finding[] };

const URL_OF_RUN = /^https:\/\/[a-z0-9.-]+\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+\/actions\/runs\/[0-9]+(?:\/attempts\/[0-9]+)?$/u;

/** The plan hash a workflow's text carries on the line `# plan: <hash>`, or nothing. */
export const planOfWorkflow = (text: string): string | undefined => /^# plan: ([0-9a-f]{64})$/mu.exec(text)?.[1];

const invalid = (why: string): Finding => finding("E-WL-RUNNER-RECEIPT-INVALID", "", why);

/** The exit status of a conclusion: 0 for success, skipped and neutral; 124 for a time out; 130 for a cancel; 1 for every other. */
function statusOf(c: RunConclusion): number {
  switch (c) {
    case "success":
    case "skipped":
    case "neutral":
      return 0;
    case "timed_out":
      return 124;
    case "cancelled":
      return 130;
    case "failure":
    case "action_required":
    case "stale":
    case "startup_failure":
      return 1;
    default:
      return c satisfies never;
  }
}

/** The receipt of a finished run, or why it is none. `recordedBy` says who records the receipt: only a person's record carries the approvals of the environments. */
export function receiptFromRun(run: GithubRun, who: { readonly recordedBy: "person" | "agent" | "tool" }): Result<RunReceipt, readonly Finding[]> {
  const bad: Finding[] = [];
  if (!URL_OF_RUN.test(run.url) || run.url.length > 200) bad.push(invalid(`${JSON.stringify(run.url.slice(0, 60))} is not the address of a run`));
  if (!isDigest(run.plan)) bad.push(invalid("the plan hash of the run is not 64 lower case hexadecimal digits"));
  if (!isDigest(run.logDigest)) bad.push(invalid("the digest of the log is not 64 lower case hexadecimal digits"));
  if (run.conclusion === null) bad.push(invalid("the run is not finished: it has no conclusion"));
  const unfinished = Object.entries(run.jobs).filter(([, c]) => c === null).map(([id]) => id);
  if (run.conclusion !== null && unfinished.length > 0) bad.push(invalid(`the run is finished and the jobs ${unfinished.join(", ")} have no conclusion`));
  if (bad.length > 0 || run.conclusion === null) return err(bad);
  const worst = [run.conclusion, ...Object.values(run.jobs)].flatMap((c) => (c === null ? [] : [statusOf(c)])).reduce((a, b) => (a === 0 ? b : a), 0);
  const refused: Finding[] = [];
  const given = (run.approvals ?? []).filter((a) => a.state === "approved");
  const people = given.filter((a) => a.by.kind === "user");
  for (const a of given) if (a.by.kind !== "user") refused.push(finding("E-WL-RUNNER-APPROVAL-NOT-PERSON", a.gate, `the approval of ${a.gate} was given by the app ${a.by.login}: only a person approves`));
  const counted = who.recordedBy === "person" ? [...new Set(people.map((a) => a.gate))].sort() : [];
  if (who.recordedBy !== "person" && people.length > 0) refused.push(finding("E-WL-RUNNER-APPROVAL-NOT-PERSON", people.map((a) => a.gate).join(", "), `the approval of ${[...new Set(people.map((a) => a.gate))].join(", ")} is recorded by ${who.recordedBy}, not by a person: it is left out of the receipt`));
  return ok({ event: { kind: "receipt", plan: run.plan, ref: run.url, status: worst, log: run.logDigest, ...(counted.length === 0 ? {} : { approvals: counted }) }, refused });
}
