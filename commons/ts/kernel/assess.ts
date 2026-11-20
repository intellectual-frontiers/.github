/**
 * Assessment: what findings, evidence and declarations add up to (commons 0007-grc FR-010 to FR-015). Every function is pure and takes the
 * instant it judges at as a value.
 *
 * - **Coverage** rolls each catalog control (a requirement) or control up as `gap`, `untested`, `partial`, `addressed` or `covered` (FR-010).
 * - **Freshness** holds the newest evidence to a cadence (an ISO 8601 duration): `fresh`, `due` within the last tenth of the cadence, or
 *   `stale`, with the instant it falls due (FR-011).
 * - **Drift** compares a declared and an observed view of keyed records: added, removed and changed, each change with its field's path
 *   and both values, in key order (FR-012).
 * - The **change-impact gate** reads declarations of paths (globs) to controls and judges a change `allowed` or `blocked`, with every
 *   reason (FR-013).
 * - The **risk register** levels each risk by NIST SP 800-30 Rev. 1's Table I-2 and reports those past their review (FR-014).
 * - The **trace** relates each requirement to the mechanisms that enforce it and the evidence they gave, and names those with none (FR-015).
 *
 * @example
 * ```ts
 * import { riskLevel } from "./assess.ts";
 * riskLevel("moderate", "very-high"); // "high"
 * ```
 *
 * @module
 */
import { absurd, type Decoder, array, literal, object, string } from "@intellectual-frontiers/core";
import {
  type Catalog,
  type CatalogControl,
  type ControlRef,
  type Duration,
  type Finding,
  type Instant,
  type Outcome,
  type Role,
  addDuration,
  compareInstants,
  epochMs,
  glob,
  instantDecoder,
  instantFromEpochMs,
  joinAll,
  latestInstant,
  roleDecoder,
} from "./grc.ts";
import type { Json } from "./json5.ts";
import type { Sha256 } from "./sha256.ts";

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** The findings of the newest assessment of each control and subject: for each, those with the latest `at`. */
export function newestFindings(findings: readonly Finding[]): readonly Finding[] {
  const latest = new Map<string, Instant>();
  for (const f of findings) {
    const k = JSON.stringify([f.control.id, f.subject.kind, f.subject.id]);
    const seen = latest.get(k);
    if (seen === undefined || compareInstants(f.at, seen) > 0) latest.set(k, f.at);
  }
  return findings.filter((f) => latest.get(JSON.stringify([f.control.id, f.subject.kind, f.subject.id])) === f.at);
}

// ---------------------------------------------------------------------------------------------------------------------------- coverage (FR-010)

/** How well a requirement or control is met, from the worst to the best. */
export type CoverageStatus = "gap" | "untested" | "partial" | "addressed" | "covered";

/**
 * The coverage that subjects' outcomes give, `not-applicable` ones left out: `untested` where none is left, `partial` where one is
 * neither passing nor accepted, `addressed` where every one passes or is accepted and at least one is accepted, `covered` where every one
 * passes.
 */
export function coverageOf(outcomes: readonly Outcome[]): Exclude<CoverageStatus, "gap"> {
  const applicable = outcomes.filter((o) => o !== "not-applicable");
  if (applicable.length === 0) return "untested";
  if (applicable.some((o) => o !== "pass" && o !== "accepted")) return "partial";
  return applicable.includes("accepted") ? "addressed" : "covered";
}

/** A control's coverage from the newest findings of it. */
export type ControlCoverage = { readonly control: string; readonly status: Exclude<CoverageStatus, "gap">; readonly outcome: Outcome };

/** Each control's coverage, in the order given, from the newest findings of each control and subject. */
export function controlCoverage(controls: readonly { readonly id: string }[], findings: readonly Finding[]): readonly ControlCoverage[] {
  const newest = newestFindings(findings);
  return controls.map((c) => {
    const outcomes = newest.filter((f) => f.control.id === c.id).map((f) => f.outcome);
    return { control: c.id, status: coverageOf(outcomes), outcome: joinAll(outcomes) };
  });
}

/** A requirement's coverage: the catalog control, the controls that implement it, and how well they meet it. */
export type RequirementCoverage<C extends string = string, I extends string = string> = {
  readonly requirement: ControlRef<C, I>;
  readonly status: CoverageStatus;
  readonly outcome: Outcome;
  readonly controls: readonly string[];
};

/**
 * Every control of a catalog as a requirement, in the catalog's order: `gap` where no control implements it, else the coverage of the
 * newest findings of every control that does (`untested` where there are none).
 */
export function requirementCoverage<C extends string, E extends CatalogControl>(
  catalog: Catalog<C, E>,
  controls: readonly { readonly id: string; readonly implements: readonly ControlRef[] }[],
  findings: readonly Finding[],
): readonly RequirementCoverage<C, E["id"]>[] {
  const newest = newestFindings(findings);
  return catalog.ids.map((id) => {
    const implementing = controls.filter((c) => c.implements.some((r) => r.catalog === catalog.id && r.id === id)).map((c) => c.id);
    const outcomes = newest.filter((f) => implementing.includes(f.control.id)).map((f) => f.outcome);
    return {
      requirement: catalog.control(id),
      status: implementing.length === 0 ? "gap" : coverageOf(outcomes),
      outcome: joinAll(outcomes),
      controls: implementing,
    };
  });
}

// ---------------------------------------------------------------------------------------------------------------------------- freshness (FR-011)

/** Whether evidence is recent enough for its cadence. */
export type FreshnessStatus = "fresh" | "due" | "stale";

/** How fresh evidence is: its status, the newest evidence, when it falls due (`null` past the year 9999) and when the `due` window opens. */
export type Freshness = {
  readonly status: FreshnessStatus;
  readonly cadence: string;
  readonly newest: Instant | null;
  readonly dueAt: Instant | null;
  readonly dueFrom: Instant | null;
};

/**
 * The freshness at `at` of evidence observed at the given instants, held to a cadence: it falls due one cadence after the newest; it is
 * `stale` after that instant, `due` in the last tenth of the cadence up to and at it, `fresh` before. No evidence at all is `stale`, due at `at`.
 */
export function freshness(cadence: Duration, evidence: readonly Instant[], at: Instant): Freshness {
  const newest = latestInstant(evidence);
  if (newest === undefined) return { status: "stale", cadence: cadence.text, newest: null, dueAt: at, dueFrom: at };
  const dueAt = addDuration(newest, cadence);
  if (dueAt === undefined) return { status: "fresh", cadence: cadence.text, newest, dueAt: null, dueFrom: null };
  const length = epochMs(dueAt) - epochMs(newest);
  const dueFrom = instantFromEpochMs(epochMs(dueAt) - length / 10) ?? newest;
  const status: FreshnessStatus = compareInstants(at, dueAt) > 0 ? "stale" : compareInstants(at, dueFrom) >= 0 ? "due" : "fresh";
  return { status, cadence: cadence.text, newest, dueAt, dueFrom };
}

/** The freshness of each control's newest finding, held to the control's cadence, in the order given. */
export function controlFreshness(
  controls: readonly { readonly id: string; readonly cadence: Duration }[],
  findings: readonly Finding[],
  at: Instant,
): readonly { readonly control: string; readonly freshness: Freshness }[] {
  return controls.map((c) => ({
    control: c.id,
    freshness: freshness(
      c.cadence,
      findings.filter((f) => f.control.id === c.id).map((f) => f.at),
      at,
    ),
  }));
}

// ---------------------------------------------------------------------------------------------------------------------------- drift (FR-012)

/** One step of a field's path: a member name or an array index. */
export type PathStep = string | number;

/** A field that differs: its path inside the record, and its value on each side (absent where that side does not have it). */
export type FieldChange = {
  readonly path: readonly PathStep[];
  readonly field: string;
  readonly declared?: Json;
  readonly observed?: Json;
};

/** What differs between a declared and an observed view of keyed records, each list in key order. */
export type Drift = {
  readonly added: readonly { readonly key: string; readonly value: Json }[];
  readonly removed: readonly { readonly key: string; readonly value: Json }[];
  readonly changed: readonly { readonly key: string; readonly changes: readonly FieldChange[] }[];
};

/** Keyed records: a map, or an object whose members are the records. */
export type KeyedView = ReadonlyMap<string, Json> | { readonly [key: string]: Json };

/** A field's path as text, `$` for the record itself: `$.ports[0]`, `$["a b"]`. */
export function formatFieldPath(path: readonly PathStep[]): string {
  return path.reduce<string>(
    (s, p) => (typeof p === "number" ? `${s}[${p}]` : /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(p) ? `${s}.${p}` : `${s}[${JSON.stringify(p)}]`),
    "$",
  );
}

function isObject(v: Json): v is { readonly [key: string]: Json } {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isList(v: Json): v is readonly Json[] {
  return Array.isArray(v);
}

function sameJson(a: Json, b: Json): boolean {
  if (isList(a) && isList(b)) return a.length === b.length && a.every((x, i) => b[i] !== undefined && sameJson(x, b[i]));
  if (isObject(a) && isObject(b)) {
    const ka = Object.keys(a).sort();
    const kb = Object.keys(b).sort();
    return (
      ka.length === kb.length &&
      ka.every((k, i) => {
        const x = a[k];
        const y = b[k];
        return k === kb[i] && x !== undefined && y !== undefined && sameJson(x, y);
      })
    );
  }
  return a === b;
}

function change(path: readonly PathStep[], declared: Json | undefined, observed: Json | undefined): FieldChange {
  return {
    path,
    field: formatFieldPath(path),
    ...(declared === undefined ? {} : { declared }),
    ...(observed === undefined ? {} : { observed }),
  };
}

function diff(path: readonly PathStep[], a: Json | undefined, b: Json | undefined, out: FieldChange[]): void {
  if (a === undefined || b === undefined) {
    if (a !== b) out.push(change(path, a, b));
    return;
  }
  if (isObject(a) && isObject(b)) {
    for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) diff([...path, k], a[k], b[k], out);
  } else if (isList(a) && isList(b)) {
    for (let i = 0; i < Math.max(a.length, b.length); i++) diff([...path, i], a[i], b[i], out);
  } else if (!sameJson(a, b)) out.push(change(path, a, b));
}

/** The field changes between two values: objects compared member by member in key order, arrays index by index, anything else whole. */
export function fieldChanges(declared: Json, observed: Json): readonly FieldChange[] {
  const out: FieldChange[] = [];
  diff([], declared, observed, out);
  return out;
}

function entriesOf(view: KeyedView): ReadonlyMap<string, Json> {
  return view instanceof Map ? view : new Map(Object.entries(view));
}

/** The drift from what is declared to what is observed: records only observed are added, only declared removed, in both but different changed. */
export function drift(declared: KeyedView, observed: KeyedView): Drift {
  const d = entriesOf(declared);
  const o = entriesOf(observed);
  const keys = [...new Set([...d.keys(), ...o.keys()])].sort(byText);
  const added: { key: string; value: Json }[] = [];
  const removed: { key: string; value: Json }[] = [];
  const changed: { key: string; changes: readonly FieldChange[] }[] = [];
  for (const key of keys) {
    const a = d.get(key);
    const b = o.get(key);
    if (a === undefined && b !== undefined) added.push({ key, value: b });
    else if (b === undefined && a !== undefined) removed.push({ key, value: a });
    else if (a !== undefined && b !== undefined) {
      const changes = fieldChanges(a, b);
      if (changes.length > 0) changed.push({ key, changes });
    }
  }
  return { added, removed, changed };
}

// ---------------------------------------------------------------------------------------------------------------------------- change impact (FR-013)

/** Paths (globs) and the controls a change to them bears on. */
export type ImpactDeclaration = { readonly paths: readonly string[]; readonly controls: readonly string[] };

/** A change: the paths it touches, the reviews it says it needs (by role) and the reviews given. */
export type Change = { readonly paths: readonly string[]; readonly needsReview?: readonly Role[]; readonly reviewedBy?: readonly Role[] };

/** The outcomes that block a change to the paths of a control. */
export type BlockingOutcome = "fail" | "error" | "gap";

/** Why a change is blocked. */
export type GateReason =
  | { readonly kind: "control"; readonly control: string; readonly outcome: BlockingOutcome; readonly paths: readonly string[] }
  | { readonly kind: "review"; readonly role: Role };

/** A control a change bears on, and the touched paths declared for it. */
export type Touched = { readonly control: string; readonly paths: readonly string[] };

/** The gate's judgement of a change, with every control it touches; where blocked, every reason. */
export type GateDecision =
  | { readonly kind: "allowed"; readonly touched: readonly Touched[] }
  | { readonly kind: "blocked"; readonly touched: readonly Touched[]; readonly reasons: readonly [GateReason, ...GateReason[]] };

/** A gate reason as one sentence. */
export function formatGateReason(r: GateReason): string {
  switch (r.kind) {
    case "control":
      return `control ${r.control} is ${r.outcome} and the change touches ${r.paths.join(", ")}`;
    case "review":
      return `the change needs a review by ${r.role}, not given`;
    default:
      return absurd(r);
  }
}

/** Each control's newest outcome: the join of its newest findings' outcomes. */
export function newestOutcomes(findings: readonly Finding[]): ReadonlyMap<string, Outcome> {
  const groups = new Map<string, Outcome[]>();
  for (const f of newestFindings(findings)) groups.set(f.control.id, [...(groups.get(f.control.id) ?? []), f.outcome]);
  return new Map([...groups].map(([k, v]) => [k, joinAll(v)]));
}

/**
 * A change judged against the declarations and each control's newest outcome: `blocked` where a touched path is declared for a control
 * whose outcome is `fail`, `error` or `gap` (a control with no outcome does not block), or where a review the change needs was not given;
 * else `allowed`. Reasons: controls in id order, then reviews in role order.
 */
export function gate(declarations: readonly ImpactDeclaration[], change: Change, outcomes: ReadonlyMap<string, Outcome>): GateDecision {
  const compiled = declarations.map((d) => ({ globs: d.paths.map(glob), controls: d.controls }));
  const byControl = new Map<string, Set<string>>();
  for (const path of change.paths)
    for (const d of compiled)
      if (d.globs.some((g) => g.test(path)))
        for (const c of d.controls) byControl.set(c, (byControl.get(c) ?? new Set<string>()).add(path));
  const touched: Touched[] = [...byControl.keys()]
    .sort(byText)
    .map((control) => ({ control, paths: [...(byControl.get(control) ?? [])].sort(byText) }));
  const reasons: GateReason[] = [];
  for (const t of touched) {
    const outcome = outcomes.get(t.control);
    if (outcome === "fail" || outcome === "error" || outcome === "gap")
      reasons.push({ kind: "control", control: t.control, outcome, paths: t.paths });
  }
  const given = new Set<string>(change.reviewedBy ?? []);
  for (const role of [...new Set(change.needsReview ?? [])].sort(byText)) if (!given.has(role)) reasons.push({ kind: "review", role });
  const [first, ...rest] = reasons;
  return first === undefined ? { kind: "allowed", touched } : { kind: "blocked", touched, reasons: [first, ...rest] };
}

/** An impact declaration as a file holds it. */
export const impactDeclarationDecoder: Decoder<ImpactDeclaration> = object({ paths: array(string), controls: array(string) });

// ---------------------------------------------------------------------------------------------------------------------------- risk (FR-014)

/** NIST SP 800-30's five qualitative levels, from the least to the greatest. */
export const RISK_LEVELS = ["very-low", "low", "moderate", "high", "very-high"] as const;

/** A qualitative level of likelihood, impact or risk (NIST SP 800-30 Rev. 1, Appendices G to I). */
export type RiskLevel = (typeof RISK_LEVELS)[number];

/**
 * NIST SP 800-30 Rev. 1, Table I-2, "Assessment scale – level of risk (combination of likelihood and impact)": the level of risk for a
 * likelihood (the row) and an impact (the column).
 */
export const RISK_MATRIX: Readonly<Record<RiskLevel, Readonly<Record<RiskLevel, RiskLevel>>>> = {
  "very-high": { "very-low": "very-low", low: "low", moderate: "moderate", high: "high", "very-high": "very-high" },
  high: { "very-low": "very-low", low: "low", moderate: "moderate", high: "high", "very-high": "very-high" },
  moderate: { "very-low": "very-low", low: "low", moderate: "moderate", high: "moderate", "very-high": "high" },
  low: { "very-low": "very-low", low: "low", moderate: "low", high: "low", "very-high": "moderate" },
  "very-low": { "very-low": "very-low", low: "very-low", moderate: "very-low", high: "low", "very-high": "low" },
};

/** The level of risk of a likelihood and an impact, by Table I-2. */
export function riskLevel(likelihood: RiskLevel, impact: RiskLevel): RiskLevel {
  return RISK_MATRIX[likelihood][impact];
}

/** What is done about a risk. */
export type Treatment = "accept" | "mitigate" | "transfer" | "avoid";

/** A risk as it is written: the level is computed. */
export type RiskInput = {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly likelihood: RiskLevel;
  readonly impact: RiskLevel;
  readonly treatment: Treatment;
  readonly owner: Role;
  readonly reviewBy: Instant;
  readonly controls?: readonly string[];
};

/** A risk with its level. */
export type Risk = RiskInput & { readonly level: RiskLevel };

/** A risk past its review date at the instant the register was taken. */
export type OverdueReview = { readonly risk: string; readonly owner: Role; readonly reviewBy: Instant };

/** A register: its risks from the greatest level to the least (then by id), and those past their review. */
export type RiskRegister = { readonly at: Instant; readonly risks: readonly Risk[]; readonly overdue: readonly OverdueReview[] };

/** A risk with its level computed. */
export function defineRisk(r: RiskInput): Risk {
  return { ...r, level: riskLevel(r.likelihood, r.impact) };
}

/** The register of some risks at an instant: each levelled, and each whose review date is before the instant reported overdue. */
export function riskRegister(risks: readonly RiskInput[], at: Instant): RiskRegister {
  const levelled = risks.map(defineRisk).sort((a, b) => RISK_LEVELS.indexOf(b.level) - RISK_LEVELS.indexOf(a.level) || byText(a.id, b.id));
  const overdue = levelled
    .filter((r) => compareInstants(r.reviewBy, at) < 0)
    .map((r) => ({ risk: r.id, owner: r.owner, reviewBy: r.reviewBy }));
  return { at, risks: levelled, overdue };
}

const levelDecoder: Decoder<RiskLevel> = literal(...RISK_LEVELS);

/** A risk as a file holds it. */
export const riskDecoder: Decoder<RiskInput> = object(
  {
    id: string,
    title: string,
    likelihood: levelDecoder,
    impact: levelDecoder,
    treatment: literal("accept", "mitigate", "transfer", "avoid"),
    owner: roleDecoder,
    reviewBy: instantDecoder,
  },
  { description: string, controls: array(string) },
);

// ---------------------------------------------------------------------------------------------------------------------------- trace (FR-015)

/** What enforces requirements: a control, a policy, a process, named by its id. */
export type Mechanism<R extends string = string> = { readonly id: string; readonly enforces: readonly R[] };

/** A piece of evidence a mechanism gave. */
export type EvidenceLink = { readonly mechanism: string; readonly digest: Sha256 };

/** Why a requirement is unproven: no mechanism enforces it, or none that does gave evidence. */
export type Unproven = "unenforced" | "unevidenced";

/** One requirement's trace: each mechanism that enforces it with the evidence it gave (digests in order, once each). */
export type RequirementTrace<R extends string = string> = {
  readonly requirement: R;
  readonly status: "proven" | Unproven;
  readonly mechanisms: readonly { readonly id: string; readonly evidence: readonly Sha256[] }[];
};

/** Every requirement's trace in the order given, and those unproven. */
export type Trace<R extends string = string> = {
  readonly requirements: readonly RequirementTrace<R>[];
  readonly unproven: readonly { readonly requirement: R; readonly reason: Unproven }[];
};

/** The trace of requirements to mechanisms to evidence; a requirement is proven where a mechanism that enforces it gave evidence. */
export function trace<const R extends string>(
  requirements: readonly R[],
  mechanisms: readonly Mechanism<NoInfer<R>>[],
  evidence: readonly EvidenceLink[],
): Trace<R> {
  const byMechanism = new Map<string, Set<Sha256>>();
  for (const e of evidence) byMechanism.set(e.mechanism, (byMechanism.get(e.mechanism) ?? new Set<Sha256>()).add(e.digest));
  const traces = requirements.map((requirement): RequirementTrace<R> => {
    const ms = mechanisms
      .filter((m) => m.enforces.includes(requirement))
      .map((m) => ({ id: m.id, evidence: [...(byMechanism.get(m.id) ?? [])].sort(byText) }));
    const status = ms.length === 0 ? "unenforced" : ms.some((m) => m.evidence.length > 0) ? "proven" : "unevidenced";
    return { requirement, status, mechanisms: ms };
  });
  const unproven = traces.flatMap((t) => (t.status === "proven" ? [] : [{ requirement: t.requirement, reason: t.status }]));
  return { requirements: traces, unproven };
}

/** The evidence that findings carry, as links from their controls (the mechanisms) to the digests. */
export function evidenceOfFindings(findings: readonly Finding[]): readonly EvidenceLink[] {
  return findings.flatMap((f) => f.evidence.map((digest) => ({ mechanism: f.control.id, digest })));
}
