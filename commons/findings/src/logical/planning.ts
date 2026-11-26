// Spec: 0004-findings-lifecycle FR-001, FR-002, FR-003, FR-004
/**
 * A finding is an item of Planning (commons planning 0037-planning), of its item kind `finding`: its life is the events of that item and its state is the fold of them, which is Planning's and not ours. What this file says is only how a finding and what is done with it are put in Planning's words,
 * and how the state of an item is read back in the words of a security review. A finding is opened with origin `derived` (read from a report, so open at once); a person triages it (a label and the reason as a comment; a false positive or a duplicate is closed `not-planned` or `duplicate`); accepts the risk until a day (the item is
 * deferred until that day, and open again once it has passed); claims it fixed (a label and a comment, which counts until a retest settles it); and a retest closes it `completed` or reopens it. No kind of item, event or term is added to Planning's: everything here is labels, comments and the events Planning has.
 *
 * Every event Planning makes has an actor, and an agent has the person it acts for: the importer is a tool, run by the person who ran it where one is said, and a person's triage is the person's own.
 *
 * @example
 * ```ts
 * import { openedOf } from "./planning.ts";
 * openedOf({ id: "a1", rule: "r", title: "t", severity: "high", asset: "portal", description: "d", cwe: [], cve: [], source: { tool: "zap", file: "z.json" } }).kind; // "finding"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { EventData, Item, OpenedData, Severity as PlanSeverity } from "@intellectual-frontiers/planning/governance";
import { parseDay } from "@intellectual-frontiers/planning/governance";
import type { Finding, Severity } from "@intellectual-frontiers/findings/governance";

/** The states of a finding in the words of a security review. */
export const STATUSES = ["open", "confirmed", "false-positive", "duplicate", "accepted", "fixed", "verified", "reopened"] as const;
/** A state. */
export type Status = (typeof STATUSES)[number];

/** The states in which a finding still counts against the system. */
export const OPEN_STATUSES: readonly Status[] = ["open", "confirmed", "reopened", "fixed"];

/** The default source name of the external id a finding carries: its fingerprint. A product that files findings in a tracker of its own gives its own name where it writes the external id (IF Commons names no product). */
export const FINGERPRINT_SOURCE = "ifc-findings";

/** The labels the lifecycle uses. */
export const LABEL = { confirmed: "triage:confirmed", falsePositive: "triage:false-positive", accepted: "risk-accepted", fixClaimed: "fix-claimed", reopened: "reopened" } as const;

const SEVERITY: Readonly<Record<Severity, PlanSeverity>> = { critical: "error", high: "error", medium: "warning", low: "note", info: "note" };

/** The opening of the item of a finding: kind `finding`, origin `derived`, the report's severity kept as the source wrote it, and the facts that make it the same finding in the next report as the labels and the source. */
export function openedOf(f: Finding): OpenedData {
  const body = [f.description, f.solution === undefined ? "" : `Solution: ${f.solution}`].filter((x) => x !== "").join("\n\n");
  const labels = [`tool:${f.source.tool}`, `rule:${f.rule}`, `severity:${f.severity}`, `asset:${f.asset}`, ...f.cwe.map((c) => `cwe:${c}`), ...f.cve.map((c) => `cve:${c}`)];
  return {
    type: "opened",
    kind: "finding",
    title: f.title,
    body,
    labels: [...new Set(labels)].sort(),
    assignees: [],
    origin: "derived",
    severity: SEVERITY[f.severity],
    sourceSeverity: f.severity,
    source: { tool: f.source.tool, rule: f.rule, asset: f.asset, fingerprint: f.id, file: f.source.file, ...(f.source.version === undefined ? {} : { version: f.source.version }), ...(f.location === undefined ? {} : { location: f.location }) },
    ...(f.location === undefined ? {} : { target: { file: f.location } }),
    ...(f.evidence === undefined ? {} : { evidence: [f.evidence] }),
  };
}

/** A finding as read back from its item. */
export type View = {
  readonly id: string;
  readonly fingerprint: string;
  readonly title: string;
  readonly severity: Severity;
  readonly asset: string;
  readonly location?: string;
  readonly tool: string;
  readonly rule: string;
  readonly cwe: readonly string[];
  readonly cve: readonly string[];
  readonly status: Status;
  readonly reason?: string;
  readonly until?: string;
  readonly lapsed: boolean;
};

const SEVERITIES: readonly string[] = ["critical", "high", "medium", "low", "info"];
const day = (instant: string): string => new Date(Date.parse(instant)).toISOString().slice(0, 10);
const withLabel = (item: Item, prefix: string): readonly string[] => item.labels.filter((l) => l.startsWith(prefix)).map((l) => l.slice(prefix.length));

/** The state of a finding in the words of a security review, from its item at an instant: closed `completed` is verified, `not-planned` a false positive, `duplicate` a duplicate; deferred with the label of an accepted risk is accepted until its day and open again after; otherwise a claimed fix is fixed, a reopening reopened, a triage confirmed, and else open. */
export function statusOf(item: Item, now: string): { readonly status: Status; readonly lapsed: boolean; readonly until?: string; readonly reason?: string } {
  const s = item.state;
  const has = (l: string): boolean => item.labels.includes(l);
  const lastComment = item.comments.at(-1)?.body;
  if (s.kind === "closed") return { status: s.reason === "completed" ? "verified" : s.reason === "duplicate" ? "duplicate" : "false-positive", lapsed: false, ...(lastComment === undefined ? {} : { reason: lastComment }) };
  if (s.kind === "deferred" && has(LABEL.accepted)) {
    // a deferral keeps its day optional (0037-planning OQ-12): an acceptance with no end day is not an acceptance (0004-findings-lifecycle FR-002)
    if (s.until === undefined) return { status: "open", lapsed: true };
    const lapsed = day(now) > s.until;
    return lapsed ? { status: "open", lapsed: true, until: s.until } : { status: "accepted", lapsed: false, until: s.until, ...(lastComment === undefined ? {} : { reason: lastComment }) };
  }
  const status: Status = has(LABEL.fixClaimed) ? "fixed" : has(LABEL.reopened) ? "reopened" : has(LABEL.confirmed) ? "confirmed" : "open";
  return { status, lapsed: false };
}

/** The finding an item is, in the words of a security review. */
export function viewOf(item: Item, now: string): View {
  const src = item.source ?? {};
  const text = (k: string): string => (typeof src[k] === "string" ? (src[k] as string) : "");
  const sev = item.sourceSeverity !== undefined && SEVERITIES.includes(item.sourceSeverity) ? (item.sourceSeverity as Severity) : item.severity === "error" ? "high" : item.severity === "warning" ? "medium" : "low";
  const st = statusOf(item, now);
  return { id: item.id, fingerprint: text("fingerprint"), title: item.title, severity: sev, asset: text("asset"), ...(text("location") === "" ? {} : { location: text("location") }), tool: text("tool"), rule: text("rule"), cwe: withLabel(item, "cwe:"), cve: withLabel(item, "cve:"), status: st.status, ...(st.reason === undefined ? {} : { reason: st.reason }), ...(st.until === undefined ? {} : { until: st.until }), lapsed: st.lapsed };
}

/** What a person (or the tool run for one) does to a finding. */
export type Action =
  | { readonly kind: "triage"; readonly as: "confirmed" | "false-positive" | "duplicate"; readonly reason: string; readonly duplicateOf?: string }
  | { readonly kind: "accept"; readonly reason: string; readonly until: string }
  | { readonly kind: "fix"; readonly ref?: string }
  | { readonly kind: "retest"; readonly result: "still-present" | "not-found"; readonly source: string }
  | { readonly kind: "reopen"; readonly reason: string };

const labels = (add: readonly string[], remove: readonly string[]): EventData => ({ type: "labeled", add, remove });

/** The events of Planning an action is: comments for the reasons, labels for the review's states, and the closing, deferring and reopening Planning has. The caller adds a `same-as` link to the finding a duplicate repeats. */
export function eventsOf(a: Action): Result<readonly EventData[], string> {
  switch (a.kind) {
    case "triage":
      if (a.as === "confirmed") return ok([{ type: "commented", body: `Confirmed: ${a.reason}` }, labels([LABEL.confirmed], [LABEL.reopened])]);
      if (a.as === "false-positive") return ok([{ type: "commented", body: `False positive: ${a.reason}` }, labels([LABEL.falsePositive], []), { type: "closed", reason: "not-planned" }]);
      return a.duplicateOf === undefined ? err("a duplicate says of which finding") : ok([{ type: "commented", body: `Duplicate: ${a.reason}` }, { type: "closed", reason: "duplicate" }]);
    case "accept": {
      const until = parseDay(a.until);
      return until.kind === "err" ? err("accept says until which day (YYYY-MM-DD)") : ok([{ type: "commented", body: `Risk accepted until ${a.until}: ${a.reason}` }, labels([LABEL.accepted], [LABEL.reopened]), { type: "deferred", until: until.value, reason: a.reason }]);
    }
    case "fix":
      return ok([{ type: "commented", body: `Fix claimed${a.ref === undefined ? "" : ` (${a.ref})`}: it counts until a retest settles it` }, labels([LABEL.fixClaimed], [LABEL.reopened])]);
    case "retest":
      return a.result === "still-present"
        ? ok([{ type: "commented", body: `Retest (${a.source}): still present` }, labels([LABEL.reopened], [LABEL.fixClaimed])])
        : ok([{ type: "commented", body: `Retest (${a.source}): not found` }, labels([], [LABEL.fixClaimed]), { type: "closed", reason: "completed" }]);
    case "reopen":
      return ok([{ type: "commented", body: `Reopened: ${a.reason}` }, labels([LABEL.reopened], [LABEL.accepted, LABEL.fixClaimed, LABEL.falsePositive]), { type: "reopened" }]);
  }
}

/** Where an action may take a finding from. */
const FROM: Readonly<Record<Action["kind"], readonly Status[]>> = {
  triage: ["open", "reopened", "confirmed"],
  accept: ["open", "reopened", "confirmed"],
  fix: ["open", "reopened", "confirmed", "accepted"],
  retest: ["fixed"],
  reopen: ["verified", "false-positive", "duplicate", "accepted", "fixed"],
};

/** Why an action may not be done to a finding in the state it is in, every reason, or none. `by` is who does it. */
export function problemsOf(a: Action, view: View | undefined, by: string, at: string, now: string): readonly string[] {
  if (view === undefined) return ["there is no such finding"];
  const problems: string[] = [];
  const text = (v: string | undefined): boolean => v !== undefined && v.trim() !== "";
  if (!text(by)) problems.push("an event says who");
  if (Number.isNaN(Date.parse(at))) problems.push("an event says when, as an instant");
  else if (Date.parse(at) > Date.parse(now) + 60_000) problems.push("an event is not from the future");
  if ((a.kind === "triage" || a.kind === "accept" || a.kind === "reopen") && !text(a.reason)) problems.push(`${a.kind} says why`);
  if (a.kind === "accept") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.until)) problems.push("accept says until which day (YYYY-MM-DD)");
    else if (a.until <= day(at)) problems.push("an acceptance ends after the day it is made");
    else if (Date.parse(`${a.until}T00:00:00Z`) - Date.parse(`${day(at)}T00:00:00Z`) > 366 * 86_400_000) problems.push("an acceptance lasts at most a year: it is reviewed, then made again");
  }
  if (a.kind === "triage" && a.as === "duplicate" && !text(a.duplicateOf)) problems.push("a duplicate says of which finding");
  if (!FROM[a.kind].includes(view.status)) problems.push(`a ${a.kind} cannot follow ${view.status}${view.status === "open" && view.lapsed ? " (the acceptance lapsed)" : ""}`);
  return problems;
}

/** The retests a new report gives: for each finding claimed fixed, `still-present` where the report has its fingerprint and `not-found` where it does not, and for no other: a report is not a complete picture, and a finding absent from it is not thereby fixed. */
export function retestsOf(views: readonly View[], incoming: ReadonlySet<string>, source: string): readonly { readonly view: View; readonly action: Action }[] {
  return views.filter((v) => v.status === "fixed").map((view) => ({ view, action: { kind: "retest" as const, result: incoming.has(view.fingerprint) ? ("still-present" as const) : ("not-found" as const), source } }));
}
