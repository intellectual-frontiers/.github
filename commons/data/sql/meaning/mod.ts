// Spec: 0061-meaning-registers FR-006, FR-007, FR-008, FR-009, FR-010, FR-011
/**
 * The meaning registers at work (commons data 0061-meaning-registers): the code that reads the tables of the meaning model (`models/meaning`) and the checks that are made of data without one. A source value is
 * translated by the mappings that are approved and hold at a time, and the coverage of a mapping says which observed values nothing maps; a null rule is applied to say what a missing value is; the variances that have
 * expired are found; a column is profiled with counts only; and a seeded generator makes synthetic rows, with a rate of absence and of duplicates, that are the same for the same seed.
 *
 * @module
 */
import { and, asc, count, countDistinct, countOf, eq, from, max, min, type Runner, type Table } from "@intellectual-frontiers/data/sql/typed";
import { meaning } from "@intellectual-frontiers/data/sql/typed/models";

const { mapping, nullRule, variance } = meaning;

const ms = (t: string | Date | null | undefined): number | undefined => (t === null || t === undefined ? undefined : new Date(t).getTime());

/** What translating one source value found. */
export type Translation =
  | { readonly kind: "mapped"; readonly mappingId: string; readonly targetField: string; readonly targetValue: string | null; readonly relationshipType: string }
  | { readonly kind: "unmapped" }
  | { readonly kind: "ambiguous"; readonly mappingIds: readonly string[] };

/** What is asked of a translation. */
export interface Source {
  readonly system: string;
  readonly field: string;
  readonly value: string;
  /** The time it must hold at; now where not given. */
  readonly asOf?: string | Date;
}

/** The mappings of one field that are approved and hold at a time. */
async function holding(on: Runner, system: string, field: string, asOf: number, value?: string) {
  const rows = await from(mapping)
    .where((s) => and(eq(s.mapping.sourceSystem, system), eq(s.mapping.sourceField, field), eq(s.mapping.status, "approved"), ...(value === undefined ? [] : [eq(s.mapping.sourceValue, value)])))
    .select((s) => ({ id: s.mapping.mappingId, value: s.mapping.sourceValue, targetField: s.mapping.targetField, targetValue: s.mapping.targetValue, relationshipType: s.mapping.relationshipType, from: s.mapping.validFrom, to: s.mapping.validTo }))
    .orderBy((s) => [asc(s.mapping.mappingId)])
    .run(on);
  return rows.filter((r) => (ms(r.from) ?? 0) <= asOf && (ms(r.to) ?? Infinity) > asOf);
}

/**
 * Translates one source value: by the approved mapping that holds at the time. Where two hold, it is ambiguous and nothing is chosen for the caller; where none does, it is unmapped.
 */
export async function translate(on: Runner, source: Source): Promise<Translation> {
  const at = ms(source.asOf ?? new Date()) ?? Date.now();
  const found = await holding(on, source.system, source.field, at, source.value);
  if (found.length === 0) return { kind: "unmapped" };
  if (found.length > 1) return { kind: "ambiguous", mappingIds: found.map((f) => f.id) };
  const m = found[0]!;
  return { kind: "mapped", mappingId: m.id, targetField: m.targetField, targetValue: m.targetValue ?? null, relationshipType: m.relationshipType };
}

/** How much of what was observed a field's mappings cover. */
export interface Coverage {
  /** How many observations there were, with repeats. */
  readonly observed: number;
  /** How many of them a mapping covers. */
  readonly mapped: number;
  /** The share covered, 1 where nothing was observed. */
  readonly share: number;
  /** The values nothing maps, with how many times each was seen, the most seen first. */
  readonly unmapped: readonly { readonly value: string; readonly seen: number }[];
}

/** Says which of the values observed in a field a mapping does not cover, as the mapping of the book's mapping-coverage check. */
export async function coverage(on: Runner, system: string, field: string, observed: Iterable<string | null | undefined>, asOf: string | Date = new Date()): Promise<Coverage> {
  const at = ms(asOf) ?? Date.now();
  const covered = new Set((await holding(on, system, field, at)).map((r) => r.value));
  const seen = new Map<string, number>();
  let total = 0;
  let mapped = 0;
  for (const v of observed) {
    if (v === null || v === undefined) continue;
    total++;
    if (covered.has(v)) mapped++;
    else seen.set(v, (seen.get(v) ?? 0) + 1);
  }
  const unmapped = [...seen].map(([value, n]) => ({ value, seen: n })).sort((a, b) => b.seen - a.seen || a.value.localeCompare(b.value));
  return { observed: total, mapped, share: total === 0 ? 1 : mapped / total, unmapped };
}

/** What a rule says of one value. */
export type Resolved =
  | { readonly kind: "present"; readonly value: string }
  | { readonly kind: "absent"; readonly absence: string }
  | { readonly kind: "defaulted"; readonly value: string; readonly absence: string | null }
  | { readonly kind: "rejected"; readonly why: string };

/** A null rule as a row of the table gives it. */
export interface NullRuleRow {
  readonly policy: "reject" | "allow_absent" | "default_to";
  readonly absence?: string | null;
  readonly defaultValue?: string | null;
}

/** Whether a value is missing: null, undefined or only spaces. */
export const isMissing = (v: unknown): boolean => v === null || v === undefined || (typeof v === "string" && v.trim() === "");

/** Applies a null rule to a value: a value that is there is kept, and one that is not is rejected, kept as a kind of absence or replaced by the default. */
export function resolve(rule: NullRuleRow, value: unknown): Resolved {
  if (!isMissing(value)) return { kind: "present", value: String(value) };
  if (rule.policy === "reject") return { kind: "rejected", why: "a missing value is an error for this field" };
  if (rule.policy === "default_to") {
    return rule.defaultValue === null || rule.defaultValue === undefined ? { kind: "rejected", why: "the rule replaces a missing value and has no default" } : { kind: "defaulted", value: rule.defaultValue, absence: rule.absence ?? null };
  }
  return { kind: "absent", absence: rule.absence ?? "unknown" };
}

/** Reads the rule of a table and column, none where it has none. */
export async function ruleOf(on: Runner, subject: string): Promise<NullRuleRow | undefined> {
  const r = await from(nullRule).where((s) => eq(s.nullRule.subject, subject)).select((s) => ({ policy: s.nullRule.policy, absence: s.nullRule.absence, defaultValue: s.nullRule.defaultValue })).first(on);
  return r === undefined ? undefined : { policy: r.policy, absence: r.absence, defaultValue: r.defaultValue };
}

/** A variance that is still accepted past its date, or that was never decided. */
export interface DueVariance {
  readonly varianceId: string;
  readonly subject: string;
  readonly status: string;
  readonly expiresAt: string | null;
  readonly why: "expired" | "undecided";
}

/** Finds the variances that need a decision: accepted and past their date, and open ones, which nobody has decided. */
export async function dueVariances(on: Runner, asOf: string | Date = new Date()): Promise<readonly DueVariance[]> {
  const at = ms(asOf) ?? Date.now();
  const rows = await from(variance).select((s) => ({ id: s.variance.varianceId, subject: s.variance.subject, status: s.variance.status, expires: s.variance.expiresAt })).orderBy((s) => [asc(s.variance.varianceId)]).run(on);
  const out: DueVariance[] = [];
  for (const r of rows) {
    const e = ms(r.expires);
    if (r.status === "accepted" && e !== undefined && e <= at) out.push({ varianceId: r.id, subject: r.subject, status: r.status, expiresAt: new Date(e).toISOString(), why: "expired" });
    else if (r.status === "open") out.push({ varianceId: r.id, subject: r.subject, status: r.status, expiresAt: e === undefined ? null : new Date(e).toISOString(), why: "undecided" });
  }
  return out;
}

/** What profiling one column found: counts only, never the values it holds beyond the lowest and highest. */
export interface ColumnProfile {
  readonly column: string;
  readonly rows: number;
  readonly nulls: number;
  readonly distinct: number;
  readonly min: unknown;
  readonly max: unknown;
}

/** Profiles columns of a table with counts, as one query for each: how many rows, how many null, how many distinct, and the lowest and highest. */
export async function profile(on: Runner, table: Table<never, never, string>, columns: readonly string[]): Promise<readonly ColumnProfile[]> {
  const out: ColumnProfile[] = [];
  for (const column of columns) {
    const r = await from(table as never)
      .select((s: Record<string, Record<string, never>>) => {
        const c = s[Object.keys(s)[0]!]![column]!;
        return { rows: count(), filled: countOf(c), distinct: countDistinct(c), low: min(c), high: max(c) };
      })
      .first(on);
    const x = r as unknown as { rows: number; filled: number; distinct: number; low: unknown; high: unknown };
    out.push({ column, rows: Number(x.rows), nulls: Number(x.rows) - Number(x.filled), distinct: Number(x.distinct), min: x.low, max: x.high });
  }
  return out;
}

/** The seeded pseudo-random source: the same seed makes the same numbers, on every engine. */
export function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** How one synthetic column is made. */
export type Generator =
  | { readonly kind: "sequence"; readonly prefix?: string; readonly from?: number }
  | { readonly kind: "int"; readonly min: number; readonly max: number }
  | { readonly kind: "choice"; readonly of: readonly (string | number)[]; readonly weights?: readonly number[] }
  | { readonly kind: "date"; readonly from: string; readonly to: string }
  | { readonly kind: "text"; readonly pattern: string };

/** A column of synthetic rows. */
export interface SyntheticColumn {
  readonly make: Generator;
  /** The share of rows where it is missing, 0 where not given. */
  readonly absent?: number;
}

/** What is asked of the generator. */
export interface SyntheticSpec {
  readonly seed: number;
  readonly rows: number;
  readonly columns: Readonly<Record<string, SyntheticColumn>>;
  /** The share of rows that repeat an earlier row, to make duplicates on purpose. */
  readonly duplicates?: number;
}

/** Makes synthetic rows: they hold no real person's data, and the same spec makes the same rows. */
export function synthetic(spec: SyntheticSpec): Record<string, string | number | null>[] {
  const next = random(spec.seed);
  const rows: Record<string, string | number | null>[] = [];
  for (let i = 0; i < spec.rows; i++) {
    if (rows.length > 0 && next() < (spec.duplicates ?? 0)) {
      rows.push({ ...rows[Math.floor(next() * rows.length)]! });
      continue;
    }
    const row: Record<string, string | number | null> = {};
    for (const [name, c] of Object.entries(spec.columns)) {
      const hole = next() < (c.absent ?? 0);
      const g = c.make;
      let v: string | number;
      if (g.kind === "sequence") v = `${g.prefix ?? ""}${(g.from ?? 1) + i}`;
      else if (g.kind === "int") v = g.min + Math.floor(next() * (g.max - g.min + 1));
      else if (g.kind === "choice") {
        const w = g.weights ?? g.of.map(() => 1);
        let r = next() * w.reduce((a, b) => a + b, 0);
        let k = 0;
        while (k < w.length - 1 && r >= w[k]!) r -= w[k++]!;
        v = g.of[k]!;
      } else if (g.kind === "date") {
        const a = new Date(g.from).getTime();
        v = new Date(a + Math.floor(next() * (new Date(g.to).getTime() - a))).toISOString().slice(0, 10);
      } else v = g.pattern.replace(/#/g, () => String(Math.floor(next() * 10))).replace(/@/g, () => String.fromCharCode(97 + Math.floor(next() * 26)));
      row[name] = hole ? null : v;
    }
    rows.push(row);
  }
  return rows;
}
