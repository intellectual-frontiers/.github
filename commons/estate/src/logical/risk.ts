// Spec: 0003-estate-logical FR-005, FR-006
/**
 * Accepted risk and the status of a policy (Stolos 067-adopt FR-013, 117-adopted-in-status): a person accepts a failing policy of a machine with a reason and a date at most a year away, the policy then shows as
 * accepted and never as passing, and after the date it fails again, saying so. A machine never observed, and a policy that could not tell, are waiting: never a failure and never a warning.
 *
 * @example
 * ```ts
 * import { acceptRisk, judgePolicy } from "./risk.ts";
 * const risk = acceptRisk({ policy: "disk-encryption", reason: "holds only open-source code", by: "an owner", until: "2027-03-01" }, "2026-12-01");
 * risk.kind; // "ok"
 * judgePolicy({ result: { id: "disk-encryption", status: "fail", controls: ["SC-28"] }, observed: true, accepted: risk.kind === "ok" ? [risk.value] : [], now: "2026-12-02" }).status; // "accepted"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";

/** What a policy found on a machine: pass, fail, warn (not required, but worth doing) or unknown (cannot tell). */
export type PolicyFinding = "pass" | "fail" | "warn" | "unknown";

/** What a policy found, by its id, with the controls it gives evidence for (identifiers of a framework's controls, such as NIST SP 800-53 Rev 5's). */
export type PolicyOutcome = { readonly id: string; readonly status: PolicyFinding; readonly controls: readonly string[] };

/** The status shown for a policy: `accepted` is a failing policy a person accepted until a date; `waiting` is a policy nothing was observed for or that could not tell. */
export type PolicyStatus = "pass" | "fail" | "warn" | "accepted" | "waiting";

/** A risk a person accepted: the policy, why, who and until when (a day, `YYYY-MM-DD`). */
export type AcceptedRisk = { readonly policy: string; readonly reason: string; readonly by: string; readonly until: string };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

/** The day of an instant or a day (`YYYY-MM-DD`), or nothing where it is neither. */
function dayOf(text: string): string | undefined {
  const ms = Date.parse(text);
  return Number.isNaN(ms) ? undefined : new Date(ms).toISOString().slice(0, 10);
}

/** An accepted risk, or every reason it is refused: the date is a day after today and within a year (366 days), and the reason is at least ten characters, in words an auditor reads. */
export function acceptRisk(input: AcceptedRisk, now: string): Result<AcceptedRisk, readonly string[]> {
  const problems: string[] = [];
  const today = dayOf(now);
  if (today === undefined) return err([`${JSON.stringify(now)} is not an instant`]);
  const limit = new Date(Date.parse(today) + 366 * DAY_MS).toISOString().slice(0, 10);
  if (input.policy.trim() === "") problems.push("a policy is named");
  if (input.by.trim() === "") problems.push("who accepts it is named");
  if (!DAY.test(input.until) || input.until <= today || input.until > limit) problems.push(`${JSON.stringify(input.until)}: the date is a day after today and within a year`);
  if (input.reason.trim().length < 10) problems.push("the reason is said in words an auditor reads, at least ten characters");
  return problems.length > 0 ? err(problems) : ok({ policy: input.policy, reason: input.reason.trim(), by: input.by, until: input.until });
}

/** The status of a policy and why. */
export type JudgedPolicy = { readonly id: string; readonly status: PolicyStatus; readonly controls: readonly string[]; readonly detail: string };

/** What `judgePolicy` takes: what the policy found, whether the machine was observed at all, the risks accepted and the instant now. */
export type JudgeInput = { readonly result: PolicyOutcome; readonly observed: boolean; readonly accepted: readonly AcceptedRisk[]; readonly now: string };

/**
 * The status of one policy. A machine never observed, and a policy that is unknown, are `waiting`; a pass stays a pass; a failing or warning policy a person accepted is `accepted` until the day after its date, and after that
 * it is what it was, with the end of the acceptance said.
 */
export function judgePolicy(i: JudgeInput): JudgedPolicy {
  const base = { id: i.result.id, controls: i.result.controls };
  if (!i.observed) return { ...base, status: "waiting", detail: "not observed yet" };
  if (i.result.status === "unknown") return { ...base, status: "waiting", detail: "it could not be told" };
  if (i.result.status === "pass") return { ...base, status: "pass", detail: "passing" };
  const today = dayOf(i.now) ?? "";
  const risk = i.accepted.find((x) => x.policy === i.result.id);
  if (risk === undefined) return { ...base, status: i.result.status, detail: i.result.status === "fail" ? "failing" : "not required, but worth doing" };
  if (risk.until < today) return { ...base, status: i.result.status, detail: `the accepted risk ended ${risk.until}` };
  return { ...base, status: "accepted", detail: `accepted by ${risk.by} until ${risk.until}: ${risk.reason}` };
}
