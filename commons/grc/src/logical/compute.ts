// Spec: 0003-grc-logical FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010
/**
 * The pure computations of the logical layer (0003-grc-logical): freshness, drift, change impact, coverage, roll-up scoring, the application of exceptions and the level of a risk. The time is
 * always a parameter, and every result is the same for any order of its inputs.
 *
 * @example
 * ```ts
 * import { freshness } from "./compute.ts";
 * freshness("2026-01-01T00:00:00Z", "P30D", "2026-02-05T00:00:00Z"); // stale
 * ```
 *
 * @module
 */
import { err, ok, type Result as Outcome } from "@intellectual-frontiers/core";
import {
  type Check,
  type Crosswalk,
  type Exception,
  exceptionApplies,
  type Framework,
  globMatches,
  instantMs,
  type Json,
  type Level,
  LEVELS,
  mappedControls,
  parseDuration,
  type Severity,
  controlUrns,
} from "@intellectual-frontiers/grc/governance";
import { canonicalize } from "./canonical.ts";
import { joinAll } from "./evaluate.ts";
import type { Result, Risk, Status } from "./kinds.ts";

/** The three states of freshness. */
export type FreshnessState = "fresh" | "due" | "stale";
/** How fresh something is. */
export type Freshness = { readonly state: FreshnessState; readonly dueAt: string | undefined };

/** The freshness of the newest observation at `now`: `due` within a tenth of the duration of its end, `stale` past it, and `stale` for none. */
export function freshness(newest: string | undefined, duration: string, now: string): Outcome<Freshness, string> {
  const d = parseDuration(duration);
  if (d.kind === "err") return d;
  const t = instantMs(now);
  if (t === undefined) return err(`${now} is not an ISO 8601 instant`);
  if (newest === undefined) return ok({ state: "stale", dueAt: undefined });
  const n = instantMs(newest);
  if (n === undefined) return err(`${newest} is not an ISO 8601 instant`);
  const due = n + d.value;
  const state = t >= due ? "stale" : t >= due - d.value / 10 ? "due" : "fresh";
  return ok({ state, dueAt: new Date(due).toISOString() });
}

/** What changed between two views of keyed records. */
export type Drift = {
  readonly added: readonly string[];
  readonly removed: readonly string[];
  readonly changed: readonly { readonly key: string; readonly path: string; readonly declared: Json | undefined; readonly observed: Json | undefined }[];
};

function paths(value: Json | undefined, at = ""): readonly (readonly [string, Json | undefined])[] {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const entries = Object.entries(value as { readonly [k: string]: Json }).sort(([a], [b]) => (a < b ? -1 : 1));
    return entries.length === 0 ? [[at, value]] : entries.flatMap(([k, v]) => paths(v, at === "" ? k : `${at}.${k}`));
  }
  return [[at, value]];
}

/** What was added, removed and changed from what is declared to what is observed, in key order; a change names the path of the field and both values. */
export function drift(declared: Readonly<Record<string, Json>>, observed: Readonly<Record<string, Json>>): Drift {
  const keys = [...new Set([...Object.keys(declared), ...Object.keys(observed)])].sort();
  const added: string[] = [];
  const removed: string[] = [];
  const changed: { key: string; path: string; declared: Json | undefined; observed: Json | undefined }[] = [];
  for (const key of keys) {
    const d = declared[key];
    const o = observed[key];
    if (d === undefined) added.push(key);
    else if (o === undefined) removed.push(key);
    else {
      const left = new Map(paths(d));
      const right = new Map(paths(o));
      for (const p of [...new Set([...left.keys(), ...right.keys()])].sort()) {
        const a = left.get(p);
        const b = right.get(p);
        if (canonicalize(a) !== canonicalize(b)) changed.push({ key, path: p, declared: a, observed: b });
      }
    }
  }
  return { added, removed, changed };
}

/** The newest result for each check and subject (by time, then by id). */
export function newestResults(results: readonly Result[]): readonly Result[] {
  const by = new Map<string, Result>();
  for (const r of results) {
    const k = `${r.check}\n${r.subject}`;
    const old = by.get(k);
    if (old === undefined || r.observedAt > old.observedAt || (r.observedAt === old.observedAt && r.id > old.id)) by.set(k, r);
  }
  return [...by.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([, r]) => r);
}

/** Results with the exceptions that apply at `at` applied: `fail` and `warn` become `accepted` (the exception's id kept, the old status in `was`); `error`, `gap` and `pending` do not. */
export function applyExceptions(results: readonly Result[], exceptions: readonly Exception[], at: string): readonly Result[] {
  return results.map((r) => {
    if (r.status !== "fail" && r.status !== "warn") return r;
    const e = exceptions.find((x) => {
      const { type, ref } = x.excuses;
      const covers = type === "control" ? r.controls.includes(ref) : type === "check" ? r.check === ref : r.policy === ref;
      return covers && exceptionApplies(x, r.subject, at);
    });
    return e === undefined ? r : { ...r, status: "accepted", exception: e.id, was: r.status };
  });
}

/** A declaration that a change to some paths bears on controls. */
export type ImpactDeclaration = { readonly paths: readonly string[]; readonly controls: readonly string[] };
/** Why a change is blocked, or what let it pass. */
export type ImpactReason = { readonly control: string; readonly path: string; readonly status: Status; readonly resolvedBy?: "exception" | "approval"; readonly exception?: string };
/** The judgement of a change. */
export type Impact = { readonly verdict: "allowed" | "blocked"; readonly reasons: readonly ImpactReason[] };

/** A change (the paths it touches) judged against declarations: blocked where a touched path is declared for a control whose newest status is `fail`, `error` or `gap`, unless an exception that applies or an approval the caller gives covers the control. */
export function changeImpact(
  declarations: readonly ImpactDeclaration[],
  touched: readonly string[],
  newest: Readonly<Record<string, Status>>,
  options: { readonly exceptions?: readonly Exception[]; readonly approvals?: readonly string[]; readonly at: string },
): Impact {
  const reasons: ImpactReason[] = [];
  for (const path of [...touched].sort()) {
    for (const d of declarations) {
      if (!d.paths.some((g) => globMatches(g, path))) continue;
      for (const control of [...d.controls].sort()) {
        const status = newest[control] ?? "gap";
        if (status !== "fail" && status !== "error" && status !== "gap") continue;
        const ex = (options.exceptions ?? []).find((e) => e.excuses.type === "control" && e.excuses.ref === control && exceptionApplies(e, path, options.at));
        if (ex !== undefined) reasons.push({ control, path, status, resolvedBy: "exception", exception: ex.id });
        else if ((options.approvals ?? []).includes(control)) reasons.push({ control, path, status, resolvedBy: "approval" });
        else reasons.push({ control, path, status });
      }
    }
  }
  return { verdict: reasons.some((r) => r.resolvedBy === undefined) ? "blocked" : "allowed", reasons };
}

/** Every coverage state. */
export const COVERAGE_STATES = ["gap", "untested", "failing", "stale", "partial", "accepted", "covered"] as const;
/** How well a control is covered. */
export type CoverageState = (typeof COVERAGE_STATES)[number];
/** The coverage of one control. */
export type Coverage = { readonly urn: string; readonly state: CoverageState; readonly checks: readonly string[]; readonly via: readonly string[] };

/** Whether a crosswalk relationship lets a check of the other control show this one: `equal`, or this control a subset of the other, at a strength of 5 or more. */
function counts(relationship: string, strength: number): boolean {
  return (relationship === "equal" || relationship === "subset-of") && strength >= 5;
}

/** The coverage of every control of the frameworks, in the order of their URNs. */
export function coverage(
  frameworks: readonly Framework[],
  crosswalks: readonly Crosswalk[],
  checks: readonly Check[],
  results: readonly Result[],
  now: string,
): readonly Coverage[] {
  const newest = newestResults(results);
  return [...controlUrns(frameworks)].sort().map((urn) => {
    const direct = checks.filter((c) => c.controls.includes(urn));
    const mapped = mappedControls(crosswalks, urn).filter((m) => counts(m.relationship, m.strength));
    const throughMap = checks.filter((c) => !direct.includes(c) && mapped.some((m) => c.controls.includes(m.urn)));
    const shown = [...direct, ...throughMap];
    const via = [...new Set(mapped.filter((m) => throughMap.some((c) => c.controls.includes(m.urn))).map((m) => m.via))].sort();
    const ids = shown.map((c) => c.id).sort();
    if (shown.length === 0) return { urn, state: "gap", checks: ids, via: [] };
    const latest = newest.filter((r) => ids.includes(r.check) && r.status !== "not-applicable");
    if (latest.length === 0) return { urn, state: "untested", checks: ids, via };
    const bad = latest.filter((r) => r.status === "fail" || r.status === "error" || r.status === "gap");
    const good = latest.filter((r) => r.status === "pass" || r.status === "accepted");
    let state: CoverageState;
    if (bad.length === latest.length) state = "failing";
    else if (bad.length > 0 || good.length < latest.length) state = "partial";
    else if (latest.some((r) => shown.some((c) => c.id === r.check && freshness(r.observedAt, c.freshness, now).kind === "ok" && (freshness(r.observedAt, c.freshness, now) as { value: Freshness }).value.state === "stale"))) state = "stale";
    else state = latest.some((r) => r.status === "accepted") ? "accepted" : "covered";
    return { urn, state, checks: ids, via };
  });
}

/** The controls with no passing check: every one that is not `covered` or `accepted`. */
export function uncovered(c: readonly Coverage[]): readonly string[] {
  return c.filter((x) => x.state !== "covered" && x.state !== "accepted").map((x) => x.urn);
}

/** The weight of each severity in a roll-up. */
export const DEFAULT_WEIGHTS: Readonly<Record<Severity, number>> = { info: 1, low: 2, medium: 4, high: 8, critical: 16 };

/** A roll-up. */
export type Rollup = {
  readonly counts: Readonly<Record<Status, number>>;
  readonly worst: Status;
  readonly weightApplicable: number;
  readonly weightPassing: number;
  readonly weightAccepted: number;
  /** The weighted share of applicable results that pass or are accepted; `undefined` where none is applicable. */
  readonly share: number | undefined;
};

/** The roll-up of results: the same for any order of them. */
export function rollup(results: readonly Result[], weights: Readonly<Record<Severity, number>> = DEFAULT_WEIGHTS): Rollup {
  const counts: Record<Status, number> = { "not-applicable": 0, pass: 0, accepted: 0, pending: 0, warn: 0, gap: 0, fail: 0, error: 0 };
  let applicable = 0;
  let passing = 0;
  let accepted = 0;
  for (const r of results) {
    counts[r.status]++;
    if (r.status === "not-applicable") continue;
    const w = weights[r.severity];
    applicable += w;
    if (r.status === "pass") passing += w;
    if (r.status === "accepted") accepted += w;
  }
  return {
    counts,
    worst: joinAll(results.map((r) => r.status)),
    weightApplicable: applicable,
    weightPassing: passing,
    weightAccepted: accepted,
    share: applicable === 0 ? undefined : (passing + accepted) / applicable,
  };
}

/** The level of a risk by NIST SP 800-30's Table I-2 (likelihood by impact). */
const MATRIX: Readonly<Record<Level, Readonly<Record<Level, Level>>>> = {
  "very-high": { "very-low": "very-low", low: "low", moderate: "moderate", high: "high", "very-high": "very-high" },
  high: { "very-low": "very-low", low: "low", moderate: "moderate", high: "high", "very-high": "very-high" },
  moderate: { "very-low": "very-low", low: "low", moderate: "moderate", high: "moderate", "very-high": "high" },
  low: { "very-low": "very-low", low: "low", moderate: "low", high: "low", "very-high": "moderate" },
  "very-low": { "very-low": "very-low", low: "very-low", moderate: "very-low", high: "low", "very-high": "low" },
};

/** The level of risk of a likelihood and an impact. */
export function riskLevel(likelihood: Level, impact: Level): Level {
  return MATRIX[likelihood][impact];
}

/** The risks whose review date has come at `now`, the highest level first. */
export function risksDue(risks: readonly Risk[], now: string): readonly Risk[] {
  const t = instantMs(now);
  if (t === undefined) return [];
  return risks
    .filter((r) => (instantMs(r.reviewBy) ?? Number.POSITIVE_INFINITY) <= t)
    .sort((a, b) => LEVELS.indexOf(b.level) - LEVELS.indexOf(a.level) || (a.id < b.id ? -1 : 1));
}
