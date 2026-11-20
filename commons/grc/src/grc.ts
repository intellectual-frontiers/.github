// Spec: 0001-grc-engineering FR-001
/**
 * Governance, risk and compliance as code: catalogs, controls, verdicts, findings and waivers (commons 0001-grc-engineering FR-001 to FR-005), with
 * the time values they all share (an `Instant`, an ISO 8601 `Duration`; FR-011 uses them) and the globs that waivers and change-impact
 * declarations match with (FR-005, FR-013). Pure: the kernel reads no clock, so every "now" is a value the caller gives.
 *
 * - A **catalog** is a framework's controls as a constant tuple (`defineCatalog`), so `catalog.control("XX-99")` does not compile where the
 *   catalog has no `XX-99` (FR-001). Two catalogs are related by a **crosswalk** of Set Theory Relationship Mappings (NIST IR 8477), each
 *   end typed by its catalog.
 * - A **control** (`defineControl`) checks one type of subject `S` and implements catalog controls; a **pack** (`definePack`) groups the
 *   controls of one subject type, and `runPack` runs each over each subject, a check that throws giving `error` for that subject (FR-002).
 * - A **status** is `pass | fail | warn | error | not-applicable | gap`; an **outcome** adds `accepted` (a waived `fail` or `warn`).
 *   `join` is the least upper bound in `not-applicable < pass < accepted < warn < gap < fail < error`, a join-semilattice, so a roll-up
 *   does not depend on its order (FR-003).
 * - A **finding** is one type for every harness, grouped into sections by `sections` (FR-004).
 * - A **waiver** names a control, the subjects it covers (exact ids or globs), a reason, the role that approved it, when it was granted and
 *   when it expires; `defineWaiver` refuses one without an expiry or expiring before its grant, and `applyWaivers` turns an applying
 *   waiver's `fail` or `warn` into `accepted`, never an `error` or a `gap` (FR-005).
 *
 * @example
 * ```ts
 * import { defineCatalog, defineControl, definePack, duration, instantOf, runPack, verdict } from "./grc.ts";
 * const catalog = defineCatalog("example", "1.0", [{ id: "EX-1", title: "Disks are encrypted" }] as const);
 * type Host = { readonly name: string; readonly encrypted: boolean };
 * const encrypted = defineControl({
 *   id: "disk-encryption", title: "Disk encryption", implements: [catalog.control("EX-1")], severity: "high", cadence: duration("P1D"),
 *   check: (h: Host) => verdict(h.encrypted ? "pass" : "fail"),
 * });
 * const pack = definePack({ id: "hosts", title: "Hosts", subjectKind: "host", subjectId: (h: Host) => h.name, controls: [encrypted] });
 * const at = instantOf("2026-03-01T00:00:00Z");
 * if (at !== undefined) await runPack(pack, [{ name: "a", encrypted: false }], { at }); // one finding, status "fail"
 * ```
 *
 * @module
 */
import {
  absurd,
  type Decoder,
  type DecodeError,
  array,
  literal,
  mapDecoder,
  object,
  string,
  err,
  ok,
  type Result,
} from "@intellectual-frontiers/core";
import type { Brand } from "@intellectual-frontiers/core";
import type { Sha256 } from "@intellectual-frontiers/crypto/sha256";

// ---------------------------------------------------------------------------------------------------------------------------- time

/** An instant in UTC as ISO 8601 text with milliseconds, `2026-03-01T00:00:00.000Z`: comparable as text, made only by `instantOf`. */
export type Instant = Brand<string, "Instant">;

const INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:[.,](\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/i;
const CANONICAL_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/**
 * ISO 8601 date-time text with a `Z` or a `±HH:MM` offset as an `Instant` in UTC (fractions past milliseconds dropped), or undefined where
 * it is not one: a day the month does not have, an hour past 23, a leap second, or a year outside 0000 to 9999 once in UTC.
 */
export function instantOf(text: string): Instant | undefined {
  const m = INSTANT.exec(text.trim());
  if (m === null) return undefined;
  const [y, mo, d, h, mi, s] = [m[1], m[2], m[3], m[4], m[5], m[6]].map((x) => Number(x ?? ""));
  if (y === undefined || mo === undefined || d === undefined || h === undefined || mi === undefined || s === undefined) return undefined;
  const ms = Number((m[7] ?? "").padEnd(3, "0").slice(0, 3));
  if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo) || h > 23 || mi > 59 || s > 59) return undefined;
  const zone = (m[8] ?? "Z").toUpperCase();
  let offset = 0;
  if (zone !== "Z") {
    const oh = Number(zone.slice(1, 3));
    const om = Number(zone.slice(4, 6));
    if (oh > 23 || om > 59) return undefined;
    offset = (zone.startsWith("-") ? -1 : 1) * (oh * 60 + om) * 60_000;
  }
  const date = new Date(0);
  date.setUTCFullYear(y, mo - 1, d);
  date.setUTCHours(h, mi, s, ms);
  return instantFromEpochMs(date.getTime() - offset);
}

/** Milliseconds since 1970-01-01T00:00:00Z as an `Instant`, or undefined where it is not finite or falls outside the years 0000 to 9999. */
export function instantFromEpochMs(ms: number): Instant | undefined {
  if (!Number.isFinite(ms)) return undefined;
  const date = new Date(Math.trunc(ms));
  if (Number.isNaN(date.getTime())) return undefined;
  const text = date.toISOString();
  return CANONICAL_INSTANT.test(text) ? (text as Instant) : undefined;
}

/** An instant as milliseconds since 1970-01-01T00:00:00Z. */
export function epochMs(instant: Instant): number {
  return Date.parse(instant);
}

/** Negative where `a` is before `b`, zero where they are the same instant, positive where `a` is after. */
export function compareInstants(a: Instant, b: Instant): number {
  return epochMs(a) - epochMs(b);
}

/** The latest of some instants, or undefined where there are none. */
export function latestInstant(instants: Iterable<Instant>): Instant | undefined {
  let best: Instant | undefined;
  for (const i of instants) if (best === undefined || compareInstants(i, best) > 0) best = i;
  return best;
}

function daysInMonth(year: number, month: number): number {
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return month === 2 ? (leap ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** An ISO 8601 duration (`P1D`, `P30D`, `P1Y`, `PT15M`, `P1Y2M3W4DT5H6M7.5S`), its text kept for what renders it. */
export type Duration = {
  readonly text: string;
  readonly years: number;
  readonly months: number;
  readonly weeks: number;
  readonly days: number;
  readonly hours: number;
  readonly minutes: number;
  readonly seconds: number;
};

/** Why text is not an ISO 8601 duration. */
export type DurationError = { readonly kind: "duration"; readonly text: string };

const DURATION = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:[.,]\d+)?)S)?)?$/;

/** ISO 8601 duration text as a `Duration`: whole years, months, weeks, days, hours and minutes, and seconds with an optional fraction. */
export function parseDuration(text: string): Result<Duration, DurationError> {
  const m = DURATION.exec(text);
  if (m === null || text === "P" || text.endsWith("T")) return err({ kind: "duration", text });
  const n = (i: number): number => Number((m[i] ?? "0").replace(",", "."));
  return ok({ text, years: n(1), months: n(2), weeks: n(3), days: n(4), hours: n(5), minutes: n(6), seconds: n(7) });
}

/** A duration from a literal in code, such as a control's cadence; it throws where the literal is not one (a mistake in the code, not in data). */
export function duration(text: string): Duration {
  const r = parseDuration(text);
  if (r.kind === "err") throw new Error(`not an ISO 8601 duration: ${JSON.stringify(text)}`);
  return r.value;
}

/**
 * The instant a duration after another, in UTC: years and months first (a day the month lacks becomes its last, so 31 January plus `P1M`
 * is 28 or 29 February), then weeks, days, hours, minutes and seconds; undefined past the year 9999.
 */
export function addDuration(start: Instant, d: Duration): Instant | undefined {
  const date = new Date(epochMs(start));
  const months = date.getUTCFullYear() * 12 + date.getUTCMonth() + d.years * 12 + d.months;
  const year = Math.floor(months / 12);
  const month = months - year * 12;
  if (year > 9999) return undefined;
  date.setUTCFullYear(year, month, Math.min(date.getUTCDate(), daysInMonth(year, month + 1)));
  const span = ((d.weeks * 7 + d.days) * 24 * 3600 + d.hours * 3600 + d.minutes * 60 + d.seconds) * 1000;
  return instantFromEpochMs(date.getTime() + Math.round(span));
}

// ---------------------------------------------------------------------------------------------------------------------------- roles and globs

/** A role (`security-lead`, `platform/owner`), never a person: who approves a waiver, owns a risk or gives a review. */
export type Role = Brand<string, "Role">;

const ROLE = /^[a-z][a-z0-9]*(?:[-_./][a-z0-9]+)*$/;

/** Text as a `Role` where it is one (lower-case words joined by `-`, `_`, `.` or `/`), else undefined. An e-mail address is not a role. */
export function roleOf(text: string): Role | undefined {
  return ROLE.test(text) ? (text as Role) : undefined;
}

/** A compiled glob: `**` any run of characters across `/` (`a/**` everything under `a`, `**\/b` any `b`), `*` any run within one part, `?` one character but `/`; every other character itself. */
export type Glob = { readonly pattern: string; readonly test: (text: string) => boolean };

/** A glob compiled once, to test many paths or ids. */
export function glob(pattern: string): Glob {
  let source = "";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern.charAt(i);
    if (c === "*" && pattern.charAt(i + 1) === "*") {
      if (pattern.charAt(i + 2) === "/") {
        source += "(?:.*/)?";
        i += 2;
      } else {
        source += ".*";
        i += 1;
      }
    } else if (c === "*") source += "[^/]*";
    else if (c === "?") source += "[^/]";
    else source += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  const re = new RegExp(`^${source}$`, "s");
  return { pattern, test: (text) => re.test(text) };
}

// ---------------------------------------------------------------------------------------------------------------------------- catalogs (FR-001)

/** One control of a catalog: its id and title, and whatever else the catalog's own constant gives (kept in its type). */
export type CatalogControl<I extends string = string> = {
  readonly id: I;
  readonly title: string;
  readonly description?: string;
  readonly group?: string;
};

/** A reference to one control of one catalog, typed by both: `{ catalog: "example", id: "EX-1" }`. */
export type ControlRef<C extends string = string, I extends string = string> = { readonly catalog: C; readonly id: I };

/** A framework's controls, typed: `C` is its id and `E` the union of its controls, so an id it does not hold does not compile. */
export type Catalog<C extends string, E extends CatalogControl> = {
  readonly id: C;
  readonly version: string;
  readonly controls: readonly E[];
  readonly ids: readonly E["id"][];
  /** The reference to one of the catalog's controls; an id the catalog does not hold does not compile. */
  readonly control: <I extends E["id"]>(id: I) => ControlRef<C, I>;
  /** One of the catalog's controls, with every field its constant gave. */
  readonly get: <I extends E["id"]>(id: I) => Extract<E, { readonly id: I }>;
  /** Whether text read at run time is one of the catalog's ids (a type guard). */
  readonly has: (id: string) => id is E["id"];
};

/** The ids of a catalog's controls. */
export type CatalogIds<K> = K extends Catalog<string, infer E> ? E["id"] : never;

/**
 * A catalog from its id, its version and a constant tuple of its controls (`[...] as const`, or inline). Two controls with one id are a
 * mistake in the code, and throw.
 */
export function defineCatalog<const C extends string, const T extends readonly CatalogControl[]>(
  id: C,
  version: string,
  controls: T,
): Catalog<C, T[number]> {
  const byId = new Map<string, T[number]>();
  for (const c of controls) {
    if (byId.has(c.id)) throw new Error(`catalog ${id} holds ${c.id} twice`);
    byId.set(c.id, c);
  }
  const has = (x: string): x is T[number]["id"] => byId.has(x);
  return {
    id,
    version,
    controls,
    ids: controls.map((c) => c.id),
    control: (cid) => ({ catalog: id, id: cid }),
    // The id is one of the catalog's by its type, so the entry is there and is the member of `E` with that id.
    get: <I extends T[number]["id"]>(cid: I) => byId.get(cid) as Extract<T[number], { readonly id: I }>,
    has,
  };
}

/** The relationships of NIST IR 8477's Set Theory Relationship Mapping. */
export const STRM_RELATIONSHIPS = ["equal", "subset-of", "superset-of", "intersects-with", "no-relationship"] as const;

/** How the first end of a mapping relates to the second: `subset-of` means the first's requirements lie within the second's. */
export type StrmRelationship = (typeof STRM_RELATIONSHIPS)[number];

/** How strongly two controls are related, from 1 (barely) to 10 (fully). */
export type StrmStrength = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/** Whether a number is a strength (an integer from 1 to 10), for values read at run time. */
export function isStrmStrength(n: number): n is StrmStrength {
  return Number.isInteger(n) && n >= 1 && n <= 10;
}

/** One mapping of a crosswalk, each end typed by its catalog. */
export type StrmMapping<A extends ControlRef, B extends ControlRef> = {
  readonly from: A;
  readonly to: B;
  readonly relationship: StrmRelationship;
  readonly strength: StrmStrength;
  readonly rationale?: string;
};

/** A row of a crosswalk as written: two ids, each one of its catalog's. */
export type StrmRow<IA extends string, IB extends string> = {
  readonly from: IA;
  readonly to: IB;
  readonly relationship: StrmRelationship;
  readonly strength: StrmStrength;
  readonly rationale?: string;
};

/** The mappings from one catalog (at its version) to another. */
export type Crosswalk<CA extends string, IA extends string, CB extends string, IB extends string> = {
  readonly from: { readonly catalog: CA; readonly version: string };
  readonly to: { readonly catalog: CB; readonly version: string };
  readonly mappings: readonly StrmMapping<ControlRef<CA, IA>, ControlRef<CB, IB>>[];
};

/** A crosswalk between two catalogs; an id either catalog does not hold does not compile. */
export function defineCrosswalk<CA extends string, EA extends CatalogControl, CB extends string, EB extends CatalogControl>(
  from: Catalog<CA, EA>,
  to: Catalog<CB, EB>,
  rows: readonly StrmRow<NoInfer<EA["id"]>, NoInfer<EB["id"]>>[],
): Crosswalk<CA, EA["id"], CB, EB["id"]> {
  return {
    from: { catalog: from.id, version: from.version },
    to: { catalog: to.id, version: to.version },
    mappings: rows.map((r) => ({
      from: from.control(r.from),
      to: to.control(r.to),
      relationship: r.relationship,
      strength: r.strength,
      ...(r.rationale === undefined ? {} : { rationale: r.rationale }),
    })),
  };
}

/** The relationship read the other way: `subset-of` becomes `superset-of` and back; the others are symmetric. */
export function inverseRelationship(r: StrmRelationship): StrmRelationship {
  switch (r) {
    case "subset-of":
      return "superset-of";
    case "superset-of":
      return "subset-of";
    case "equal":
    case "intersects-with":
    case "no-relationship":
      return r;
    default:
      return absurd(r);
  }
}

/** A crosswalk read from its other end. */
export function invertCrosswalk<CA extends string, IA extends string, CB extends string, IB extends string>(
  c: Crosswalk<CA, IA, CB, IB>,
): Crosswalk<CB, IB, CA, IA> {
  return {
    from: c.to,
    to: c.from,
    mappings: c.mappings.map((m) => ({ ...m, from: m.to, to: m.from, relationship: inverseRelationship(m.relationship) })),
  };
}

// ---------------------------------------------------------------------------------------------------------------------------- statuses (FR-003)

/** Every outcome, from the least to the greatest in the order `join` takes. */
export const OUTCOMES = ["not-applicable", "pass", "accepted", "warn", "gap", "fail", "error"] as const;

/** What a check says, or what it says once waivers are applied: a status, or `accepted` (a `fail` or `warn` an applying waiver accepted). */
export type Outcome = (typeof OUTCOMES)[number];

/** What a check says of one subject: `gap` where the evidence it needs does not exist, `error` where it could not judge. */
export type Status = Exclude<Outcome, "accepted">;

/** Every status. */
export const STATUSES: readonly Status[] = ["pass", "fail", "warn", "error", "not-applicable", "gap"];

const RANK: Readonly<Record<Outcome, number>> = { "not-applicable": 0, pass: 1, accepted: 2, warn: 3, gap: 4, fail: 5, error: 6 };

/** An outcome's place in the order, from 0 (`not-applicable`) to 6 (`error`). */
export function outcomeRank(o: Outcome): number {
  return RANK[o];
}

/**
 * The least upper bound of two outcomes in `not-applicable < pass < accepted < warn < gap < fail < error`: associative, commutative and
 * idempotent, with `not-applicable` its identity and `pass` the identity among the applicable. Two statuses join to a status.
 */
export function join<O extends Outcome>(a: O, b: O): O {
  return RANK[a] >= RANK[b] ? a : b;
}

/** The join of every outcome, in any order; `not-applicable` where there are none. */
export function joinAll<O extends Outcome>(outcomes: Iterable<O>): O | "not-applicable" {
  let acc: O | "not-applicable" = "not-applicable";
  for (const o of outcomes) acc = join<O | "not-applicable">(acc, o);
  return acc;
}

/** Every severity, from the least to the greatest. */
export const SEVERITIES = ["info", "low", "medium", "high", "critical"] as const;

/** How much a finding matters. */
export type Severity = (typeof SEVERITIES)[number];

/** The greater of two severities. */
export function maxSeverity(a: Severity, b: Severity): Severity {
  return SEVERITIES.indexOf(a) >= SEVERITIES.indexOf(b) ? a : b;
}

// ---------------------------------------------------------------------------------------------------------------------------- controls (FR-002)

/** What a check is judged against: `kind` says what sort of thing it is (`host`, `repository`), `id` which one. */
export type SubjectRef = { readonly kind: string; readonly id: string };

/** What every check is given beside its subject: the instant the assessment is taken at. A pack may ask for more by extending it. */
export type CheckContext = { readonly at: Instant };

/** What a check says of one subject. Fields left out come from the control (its severity, title and remediation). */
export type Verdict = {
  readonly status: Status;
  readonly severity?: Severity;
  readonly title?: string;
  readonly detail?: string;
  readonly evidence?: readonly Sha256[];
  readonly remediation?: string;
};

/** A verdict from its status and the fields to say beside it. */
export function verdict(status: Status, fields: Omit<Verdict, "status"> = {}): Verdict {
  return { status, ...fields };
}

/** What a check returns: one verdict, or several (none means the control does not apply to the subject). */
export type Checked = Verdict | readonly Verdict[];

/** A check of subjects of type `S`, implementing catalog controls. */
export type Control<S, C extends CheckContext = CheckContext> = {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly implements: readonly ControlRef[];
  readonly severity: Severity;
  readonly cadence: Duration;
  readonly remediation?: string;
  readonly check: (subject: S, context: C) => Checked | Promise<Checked>;
};

/** A control as a finding or a rendering carries it: everything but its check, with its cadence as text. */
export type ControlSummary = {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly implements: readonly ControlRef[];
  readonly severity: Severity;
  readonly cadence: string;
};

/** A control from its declaration; the subject type is what its check takes. */
export function defineControl<S, C extends CheckContext = CheckContext>(control: Control<S, C>): Control<S, C> {
  return control;
}

/** A control without its check. */
export function controlSummary<S, C extends CheckContext>(c: Control<S, C>): ControlSummary {
  return {
    id: c.id,
    title: c.title,
    ...(c.description === undefined ? {} : { description: c.description }),
    implements: c.implements,
    severity: c.severity,
    cadence: c.cadence.text,
  };
}

/** The controls over one subject type, with how to name a subject. */
export type Pack<S, C extends CheckContext = CheckContext> = {
  readonly id: string;
  readonly title: string;
  readonly subjectKind: string;
  readonly subjectId: (subject: S) => string;
  readonly controls: readonly Control<S, C>[];
};

/** A pack from its declaration. Two controls with one id are a mistake in the code, and throw. */
export function definePack<S, C extends CheckContext = CheckContext>(pack: Pack<S, C>): Pack<S, C> {
  const ids = new Set<string>();
  for (const c of pack.controls) {
    if (ids.has(c.id)) throw new Error(`pack ${pack.id} holds control ${c.id} twice`);
    ids.add(c.id);
  }
  return pack;
}

// ---------------------------------------------------------------------------------------------------------------------------- findings (FR-004)

/** A verdict on one subject under one control, with its detail, evidence and the waiver that accepted it: one type for every harness. */
export type Finding = {
  readonly control: ControlSummary;
  readonly subject: SubjectRef;
  readonly status: Status;
  readonly outcome: Outcome;
  readonly severity: Severity;
  readonly title: string;
  readonly detail: string;
  readonly evidence: readonly Sha256[];
  readonly remediation?: string;
  /** The id of the waiver that turned `status` into `accepted`. */
  readonly waiver?: string;
  readonly at: Instant;
};

/** A stable key of a finding's control and subject, for maps and for names a rendering derives identifiers from. */
export function findingKey(f: Pick<Finding, "control" | "subject">): string {
  return JSON.stringify([f.control.id, f.subject.kind, f.subject.id]);
}

/** The findings of a check's verdicts for one subject, each verdict filled in from its control. */
export function findingsOf<S, C extends CheckContext>(
  control: Control<S, C>,
  subject: SubjectRef,
  checked: Checked,
  at: Instant,
): readonly Finding[] {
  const summary = controlSummary(control);
  const verdicts: readonly Verdict[] = isVerdictList(checked) ? checked : [checked];
  const list = verdicts.length === 0 ? [verdict("not-applicable", { detail: "the check gave no verdict for this subject" })] : verdicts;
  return list.map((v) => {
    const remediation = v.remediation ?? control.remediation;
    return {
      control: summary,
      subject,
      status: v.status,
      outcome: v.status,
      severity: v.severity ?? control.severity,
      title: v.title ?? control.title,
      detail: v.detail ?? "",
      evidence: v.evidence ?? [],
      ...(remediation === undefined ? {} : { remediation }),
      at,
    };
  });
}

function isVerdictList(c: Checked): c is readonly Verdict[] {
  return Array.isArray(c);
}

function message(thrown: unknown): string {
  return thrown instanceof Error ? thrown.message : String(thrown);
}

/** One control's check of one subject, as findings; a check that throws or rejects gives one `error` finding and never a rejection. */
export async function runCheck<S, C extends CheckContext>(
  control: Control<S, C>,
  subject: S,
  ref: SubjectRef,
  context: C,
): Promise<readonly Finding[]> {
  try {
    return findingsOf(control, ref, await control.check(subject, context), context.at);
  } catch (thrown) {
    return findingsOf(control, ref, verdict("error", { detail: `the check failed: ${message(thrown)}` }), context.at);
  }
}

/** A pack run: what was assessed, when, and every finding in the order of the pack's controls and then of the subjects given. */
export type Assessment = {
  readonly pack: { readonly id: string; readonly title: string };
  readonly at: Instant;
  readonly controls: readonly ControlSummary[];
  readonly subjects: readonly SubjectRef[];
  readonly findings: readonly Finding[];
};

/** The reference of a subject in a pack; a `subjectId` that throws names it by its place, `#0`, `#1`... */
export function subjectRef<S, C extends CheckContext>(pack: Pack<S, C>, subject: S, index: number): SubjectRef {
  try {
    return { kind: pack.subjectKind, id: pack.subjectId(subject) };
  } catch {
    return { kind: pack.subjectKind, id: `#${index}` };
  }
}

/** Every control of a pack over every subject (a check that throws is `error` for that subject alone), then the waivers given applied. */
export async function runPack<S, C extends CheckContext>(
  pack: Pack<S, C>,
  subjects: readonly S[],
  context: C,
  options: { readonly waivers?: readonly Waiver[] } = {},
): Promise<Assessment> {
  const refs = subjects.map((s, i) => subjectRef(pack, s, i));
  const findings: Finding[] = [];
  for (const control of pack.controls) {
    for (const [i, subject] of subjects.entries()) {
      const ref = refs[i] ?? { kind: pack.subjectKind, id: `#${i}` };
      findings.push(...(await runCheck(control, subject, ref, context)));
    }
  }
  return {
    pack: { id: pack.id, title: pack.title },
    at: context.at,
    controls: pack.controls.map(controlSummary),
    subjects: refs,
    findings: applyWaivers(findings, options.waivers ?? [], context.at),
  };
}

/** A group of findings under one key, with the join of their outcomes and how many have each outcome. */
export type Section = {
  readonly key: string;
  readonly outcome: Outcome;
  readonly counts: Readonly<Record<Outcome, number>>;
  readonly findings: readonly Finding[];
};

/** Findings grouped by the key or keys each one has (a finding with two keys is in both sections), in the order `compare` gives the keys (text order by default). */
export function sections(
  findings: readonly Finding[],
  keyOf: (f: Finding) => string | readonly string[],
  compare: (a: string, b: string) => number = (a, b) => (a < b ? -1 : a > b ? 1 : 0),
): readonly Section[] {
  const groups = new Map<string, Finding[]>();
  for (const f of findings) {
    const k = keyOf(f);
    for (const key of typeof k === "string" ? [k] : k) {
      const g = groups.get(key);
      if (g === undefined) groups.set(key, [f]);
      else g.push(f);
    }
  }
  return [...groups.keys()].sort(compare).map((key) => {
    const group = groups.get(key) ?? [];
    return { key, outcome: joinAll(group.map((f) => f.outcome)), counts: countOutcomes(group), findings: group };
  });
}

/** How many findings have each outcome. */
export function countOutcomes(findings: readonly Finding[]): Readonly<Record<Outcome, number>> {
  const counts: Record<Outcome, number> = { "not-applicable": 0, pass: 0, accepted: 0, warn: 0, gap: 0, fail: 0, error: 0 };
  for (const f of findings) counts[f.outcome] += 1;
  return counts;
}

/** A section key: the finding's control id. */
export const byControl = (f: Finding): string => f.control.id;
/** A section key: the finding's subject, `kind:id`. */
export const bySubject = (f: Finding): string => `${f.subject.kind}:${f.subject.id}`;
/** A section key: the finding's outcome (sort with `compareOutcomeKeys` for the semilattice's order). */
export const byOutcome = (f: Finding): string => f.outcome;
/** A section key: the finding's severity. */
export const bySeverity = (f: Finding): string => f.severity;
/** Section keys: each catalog control the finding's control implements, `catalog:id`. */
export const byRequirement = (f: Finding): readonly string[] => f.control.implements.map((r) => `${r.catalog}:${r.id}`);

/** Outcome keys from the greatest to the least, for `sections(findings, byOutcome, compareOutcomeKeys)`. */
export function compareOutcomeKeys(a: string, b: string): number {
  const rank = (k: string): number => (Object.hasOwn(RANK, k) ? RANK[k as Outcome] : -1);
  return rank(b) - rank(a);
}

// ---------------------------------------------------------------------------------------------------------------------------- waivers (FR-005)

/** An approved, expiring acceptance of a control's `fail` or `warn` for some subjects. */
export type Waiver = {
  readonly id: string;
  readonly control: string;
  /** Subject ids, each exact or a glob (`web-*`). */
  readonly subjects: readonly string[];
  readonly reason: string;
  readonly approvedBy: Role;
  readonly grantedAt: Instant;
  readonly expiresAt: Instant;
};

/** A waiver as written, before `defineWaiver` checks it: its expiry may be missing. */
export type WaiverInput = Omit<Waiver, "expiresAt"> & { readonly expiresAt?: Instant };

/** Why a waiver is refused. */
export type WaiverError =
  | { readonly kind: "no-expiry"; readonly waiver: string }
  | { readonly kind: "expires-before-grant"; readonly waiver: string }
  | { readonly kind: "no-subjects"; readonly waiver: string }
  | { readonly kind: "no-reason"; readonly waiver: string };

/** A waiver error as one sentence. */
export function formatWaiverError(e: WaiverError): string {
  switch (e.kind) {
    case "no-expiry":
      return `waiver ${e.waiver} has no expiry`;
    case "expires-before-grant":
      return `waiver ${e.waiver} expires before it was granted`;
    case "no-subjects":
      return `waiver ${e.waiver} covers no subject`;
    case "no-reason":
      return `waiver ${e.waiver} gives no reason`;
    default:
      return absurd(e);
  }
}

/** A waiver, or why it is refused: it has no expiry, expires before (or when) it is granted, covers no subject or gives no reason. */
export function defineWaiver(w: WaiverInput): Result<Waiver, WaiverError> {
  if (w.expiresAt === undefined) return err({ kind: "no-expiry", waiver: w.id });
  if (compareInstants(w.expiresAt, w.grantedAt) <= 0) return err({ kind: "expires-before-grant", waiver: w.id });
  if (w.subjects.length === 0) return err({ kind: "no-subjects", waiver: w.id });
  if (w.reason.trim() === "") return err({ kind: "no-reason", waiver: w.id });
  return ok({ ...w, expiresAt: w.expiresAt });
}

/** Where a waiver stands at an instant: not yet granted, in force (from its grant, up to but not including its expiry), or expired. */
export function waiverState(w: Waiver, at: Instant): "pending" | "active" | "expired" {
  if (compareInstants(at, w.grantedAt) < 0) return "pending";
  return compareInstants(at, w.expiresAt) < 0 ? "active" : "expired";
}

/** Whether a waiver covers a finding's control and subject and is in force at the instant (whatever the finding's status). */
export function waiverCovers(w: Waiver, f: Pick<Finding, "control" | "subject">, at: Instant): boolean {
  return (
    w.control === f.control.id &&
    waiverState(w, at) === "active" &&
    w.subjects.some((p) => p === f.subject.id || glob(p).test(f.subject.id))
  );
}

/**
 * The findings with the waivers applied at an instant: a `fail` or `warn` that an active waiver covers becomes `accepted` and carries the
 * waiver's id (the first in id order where several apply); every other finding has its status as its outcome and no waiver.
 */
export function applyWaivers(findings: readonly Finding[], waivers: readonly Waiver[], at: Instant): readonly Finding[] {
  const ordered = [...waivers].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return findings.map((f) => {
    const { waiver: _old, ...rest } = f;
    const base: Finding = { ...rest, outcome: f.status };
    if (f.status !== "fail" && f.status !== "warn") return base;
    const w = ordered.find((x) => waiverCovers(x, f, at));
    return w === undefined ? base : { ...base, outcome: "accepted", waiver: w.id };
  });
}

// ---------------------------------------------------------------------------------------------------------------------------- decoders

const refined = <T>(name: string, f: (text: string) => T | undefined): Decoder<T> => {
  return (input, path = "$") => {
    if (typeof input === "string") {
      const v = f(input);
      if (v !== undefined) return ok(v);
    }
    return err({
      kind: "decode",
      path,
      expected: name,
      found: typeof input === "string" ? `the string ${JSON.stringify(input).slice(0, 60)}` : typeof input,
    });
  };
};

/** An ISO 8601 date-time with a zone, as an `Instant`. */
export const instantDecoder: Decoder<Instant> = refined("an ISO 8601 date-time with a zone", instantOf);

/** A role. */
export const roleDecoder: Decoder<Role> = refined("a role (lower-case words joined by - _ . or /)", roleOf);

/** An ISO 8601 duration. */
export const durationDecoder: Decoder<Duration> = refined("an ISO 8601 duration", (t) => {
  const r = parseDuration(t);
  return r.kind === "ok" ? r.value : undefined;
});

/** A severity. */
export const severityDecoder: Decoder<Severity> = literal(...SEVERITIES);

const waiverInput: Decoder<WaiverInput> = mapDecoder(
  object(
    { id: string, control: string, subjects: array(string), reason: string, approvedBy: roleDecoder, grantedAt: instantDecoder },
    { expiresAt: instantDecoder },
  ),
  (w): WaiverInput => w,
);

/** A waiver as a file holds it, refused as `defineWaiver` refuses (the error at its path names why). */
export const waiverDecoder: Decoder<Waiver> = (input, path = "$") => {
  const r = waiverInput(input, path);
  if (r.kind === "err") return r;
  const w = defineWaiver(r.value);
  if (w.kind === "ok") return w;
  const e: DecodeError = {
    kind: "decode",
    path,
    expected: "a waiver with a reason, a subject and an expiry after its grant",
    found: formatWaiverError(w.error),
  };
  return err(e);
};
