// Spec: 0004-findings-lifecycle FR-001, FR-002, FR-003, FR-004
/**
 * The life of a finding, worked out from a log of events and never stored as a state: a finding is `open` when first read; a person triages it (`confirmed`, `false-positive` or `duplicate`, with a reason); accepts the risk of it until a day (`accepted`, and `open` again once the day has passed); says it is fixed
 * (`fixed`, which is a claim); and a retest settles the claim: a retest that still finds it `reopens` it, one that does not `verified`. A person may reopen a finding that was closed. Every event says who, when and why, so that the log, kept in Git and signed, is the record that an auditor reads.
 *
 * @example
 * ```ts
 * import { stateOf } from "./lifecycle.ts";
 * stateOf("a1", [], "2026-12-01T00:00:00Z").status; // "open"
 * ```
 *
 * @module
 */

/** The states a finding can be in. */
export const STATUSES = ["open", "confirmed", "false-positive", "duplicate", "accepted", "fixed", "verified", "reopened"] as const;
/** A state. */
export type Status = (typeof STATUSES)[number];

type Base = { readonly finding: string; readonly at: string; readonly by: string };
/** An event of the log. */
export type Event =
  | (Base & { readonly kind: "triage"; readonly as: "confirmed" | "false-positive" | "duplicate"; readonly reason: string; readonly duplicateOf?: string })
  | (Base & { readonly kind: "accept"; readonly reason: string; readonly until: string })
  | (Base & { readonly kind: "fix"; readonly ref?: string; readonly note?: string })
  | (Base & { readonly kind: "retest"; readonly result: "still-present" | "not-found"; readonly source: string })
  | (Base & { readonly kind: "reopen"; readonly reason: string });

/** The states in which a finding still counts against the system. */
export const OPEN_STATUSES: readonly Status[] = ["open", "confirmed", "reopened", "fixed"];

/** The state of a finding. */
export type State = { readonly id: string; readonly status: Status; readonly reason?: string; readonly until?: string; readonly lapsed: boolean; readonly history: readonly Event[]; readonly ignored: readonly Event[] };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const day = (instant: string): string => new Date(Date.parse(instant)).toISOString().slice(0, 10);

/** Where an event may take a finding from: the states it is allowed in, and the one it gives. */
function step(status: Status, e: Event): { readonly status: Status; readonly reason?: string; readonly until?: string } | undefined {
  switch (e.kind) {
    case "triage":
      return ["open", "reopened", "confirmed"].includes(status) ? { status: e.as, reason: e.reason } : undefined;
    case "accept":
      return ["open", "reopened", "confirmed"].includes(status) ? { status: "accepted", reason: e.reason, until: e.until } : undefined;
    case "fix":
      return ["open", "reopened", "confirmed", "accepted"].includes(status) ? { status: "fixed", ...(e.note === undefined ? {} : { reason: e.note }) } : undefined;
    case "retest":
      return status === "fixed" ? { status: e.result === "still-present" ? "reopened" : "verified" } : undefined;
    case "reopen":
      return ["verified", "false-positive", "duplicate", "accepted", "fixed"].includes(status) ? { status: "reopened", reason: e.reason } : undefined;
  }
}

/** The state of a finding from its events (in the order of the log) at the instant `now`: an acceptance whose day has passed is `open` again. */
export function stateOf(id: string, events: readonly Event[], now: string): State {
  let status: Status = "open";
  let reason: string | undefined;
  let until: string | undefined;
  const history: Event[] = [];
  const ignored: Event[] = [];
  for (const e of events.filter((x) => x.finding === id)) {
    const next = step(status, e);
    if (next === undefined) {
      ignored.push(e);
      continue;
    }
    history.push(e);
    status = next.status;
    reason = next.reason;
    until = next.until;
  }
  const lapsed = status === "accepted" && until !== undefined && day(now) > until;
  return { id, status: lapsed ? "open" : status, ...(reason === undefined ? {} : { reason }), ...(until === undefined ? {} : { until }), lapsed, history, ignored };
}

/** Why an event may not be added to the log, given the finding's state now: every reason, or none. */
export function problemsOf(e: Event, state: State | undefined, now: string): readonly string[] {
  const problems: string[] = [];
  const text = (v: unknown): boolean => typeof v === "string" && v.trim() !== "";
  if (state === undefined) return [`there is no finding ${e.finding}`];
  if (!text(e.by)) problems.push("an event says who");
  if (Number.isNaN(Date.parse(e.at))) problems.push("an event says when, as an instant");
  else if (Date.parse(e.at) > Date.parse(now) + 60_000) problems.push("an event is not from the future");
  if ((e.kind === "triage" || e.kind === "accept" || e.kind === "reopen") && !text(e.reason)) problems.push(`${e.kind} says why`);
  if (e.kind === "accept") {
    if (!DAY.test(e.until)) problems.push("accept says until which day (YYYY-MM-DD)");
    else if (e.until <= day(e.at)) problems.push("an acceptance ends after the day it is made");
    else if (Date.parse(`${e.until}T00:00:00Z`) - Date.parse(`${day(e.at)}T00:00:00Z`) > 366 * 86_400_000) problems.push("an acceptance lasts at most a year: it is reviewed, then made again");
  }
  if (e.kind === "triage" && e.as === "duplicate" && !text(e.duplicateOf)) problems.push("a duplicate says of which finding");
  if (step(state.status, e) === undefined) problems.push(`a ${e.kind} cannot follow ${state.status}${state.status === "open" && state.lapsed ? " (the acceptance lapsed)" : ""}`);
  return problems;
}

/** The retest events a new report gives: for each finding claimed fixed, `still-present` where the report has it and `not-found` where it does not. The report must be a retest: an import is not a complete picture, and a finding absent from it is not thereby fixed. */
export function retestEvents(states: readonly State[], incoming: ReadonlySet<string>, by: string, at: string, source: string): readonly Event[] {
  return states.filter((s) => s.status === "fixed").map((s): Event => ({ kind: "retest", finding: s.id, at, by, result: incoming.has(s.id) ? "still-present" : "not-found", source }));
}
