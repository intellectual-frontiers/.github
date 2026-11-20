// Spec: 0062-contracts-time-control FR-008, FR-009, FR-010, FR-011, FR-012, FR-013, FR-014, FR-015
/**
 * Contracts, time and control at work (commons data 0062-contracts-time-control): the code that works on the tables of the contract model (`models/contract`) and the checks that need none. Two versions of a contract are
 * compared by a matrix that says which change breaks a reader and which a writer; "as of" is asked of an effective-dated table with one predicate; a period is closed and reopened, and a change dated in a closed one is
 * placed in the next open one; a control matrix computes from the runs whether each control is passing, failing, waived, overdue or never run; a consent is a test (which uses had none); canary tokens are found where they
 * should not be; a label is propagated to what is derived from it and a derived table that is labelled lower than its sources is a violation; and the differences between the layers are reported by table.
 *
 * @module
 */
import type { Drift } from "@intellectual-frontiers/data/sql/lifecycle";
import { and, asc, desc, eq, from, gt, insertInto, isNull, lte, or, type Expr, type Runner, update } from "@intellectual-frontiers/data/sql/typed";
import { contract } from "@intellectual-frontiers/data/sql/typed/models";

const { canaryToken, consent, control, controlRun, contractField, dataContract, period } = contract;

/** A field of a contract, as the comparison sees it. */
export interface FieldSpec {
  readonly name: string;
  readonly datatype: string;
  readonly nullable: boolean;
  readonly classification?: string;
}

/** The labels of sensitivity, the lowest first. */
export const LABELS = ["public", "internal", "confidential", "restricted"] as const;
/** A label of sensitivity. */
export type Label = (typeof LABELS)[number];
const rank = (l: string | undefined): number => (l === undefined ? -1 : LABELS.indexOf(l as Label));

/** What a change of a contract does to those who read the data and to those who write it. */
export interface Effect {
  readonly readers: "compatible" | "breaking";
  readonly writers: "compatible" | "breaking";
}

/**
 * The compatibility matrix: for each kind of change, whether a reader and a writer written for the old version still work. Dropping or retyping a field, or letting a field become missing, breaks readers; adding a
 * field that must be given breaks writers; raising a label breaks readers who are not cleared for it.
 */
export const MATRIX = {
  "field-added-optional": { readers: "compatible", writers: "compatible" },
  "field-added-required": { readers: "compatible", writers: "breaking" },
  "field-removed": { readers: "breaking", writers: "compatible" },
  "type-changed": { readers: "breaking", writers: "breaking" },
  "became-nullable": { readers: "breaking", writers: "compatible" },
  "became-required": { readers: "compatible", writers: "breaking" },
  "label-raised": { readers: "breaking", writers: "compatible" },
  "label-lowered": { readers: "compatible", writers: "compatible" },
} as const satisfies Record<string, Effect>;
/** A kind of change of a contract. */
export type ChangeKind = keyof typeof MATRIX;

/** One change between two versions of a contract. */
export interface FieldChange {
  readonly field: string;
  readonly kind: ChangeKind;
  readonly effect: Effect;
}

/** What comparing two versions found. */
export interface Compatibility {
  readonly changes: readonly FieldChange[];
  readonly readersBreak: boolean;
  readonly writersBreak: boolean;
}

/** Compares the fields of two versions of a contract with the matrix. */
export function compatibility(before: readonly FieldSpec[], after: readonly FieldSpec[]): Compatibility {
  const old = new Map(before.map((f) => [f.name, f]));
  const now = new Map(after.map((f) => [f.name, f]));
  const changes: FieldChange[] = [];
  const add = (field: string, kind: ChangeKind): void => void changes.push({ field, kind, effect: MATRIX[kind] });
  for (const [name, o] of old) {
    const n = now.get(name);
    if (n === undefined) {
      add(name, "field-removed");
      continue;
    }
    if (o.datatype !== n.datatype) add(name, "type-changed");
    if (!o.nullable && n.nullable) add(name, "became-nullable");
    if (o.nullable && !n.nullable) add(name, "became-required");
    if (rank(n.classification) > rank(o.classification)) add(name, "label-raised");
    else if (rank(n.classification) < rank(o.classification)) add(name, "label-lowered");
  }
  for (const [name, n] of now) if (!old.has(name)) add(name, n.nullable ? "field-added-optional" : "field-added-required");
  return { changes, readersBreak: changes.some((c) => c.effect.readers === "breaking"), writersBreak: changes.some((c) => c.effect.writers === "breaking") };
}

/** Reads the fields of one version of a contract. */
export async function fieldsOf(on: Runner, dataset: string, version: string): Promise<readonly FieldSpec[]> {
  const rows = await from(contractField)
    .innerJoin(dataContract, (s) => eq(s.contractField.contractDataContractId, s.dataContract.dataContractId))
    .where((s) => and(eq(s.dataContract.dataset, dataset), eq(s.dataContract.version, version)))
    .select((s) => ({ name: s.contractField.fieldName, datatype: s.contractField.datatype, nullable: s.contractField.nullable, classification: s.contractField.classification }))
    .orderBy((s) => [asc(s.contractField.fieldName)])
    .run(on);
  return rows.map((r) => ({ name: r.name, datatype: r.datatype, nullable: r.nullable === true || (r.nullable as unknown) === 1, ...(r.classification === null ? {} : { classification: r.classification }) }));
}

/** The predicate that says a record holds at an instant: it began at or before it, and has no end or ends after it. */
export function holdsAt(validFrom: Expr<string | Date>, validTo: Expr<string | Date | null>, at: string | Date): Expr<boolean> {
  return and(lte(validFrom as never, at as never), or(isNull(validTo as never), gt(validTo as never, at as never)));
}

/** Where a change dated at an instant is placed. */
export type Placement =
  | { readonly kind: "open"; readonly periodId: string }
  | { readonly kind: "adjustment"; readonly belongsTo: string; readonly periodId: string }
  | { readonly kind: "none" };

const time = (t: string | Date): number => new Date(t).getTime();

/** Reads the periods of a scope, in order. */
async function periodsOf(on: Runner, scope: string) {
  const rows = await from(period).where((s) => eq(s.period.scope, scope)).select((s) => ({ id: s.period.periodId, from: s.period.startsOn, to: s.period.endsOn, status: s.period.status })).orderBy((s) => [asc(s.period.startsOn)]).run(on);
  return rows.map((r) => ({ id: r.id, from: time(r.from), to: time(r.to), status: r.status }));
}

/** Closes a period: it takes no changes from now on, and who closed it and when are kept. */
export async function closePeriod(on: Runner, periodId: string, by: string, at: string | Date = new Date()): Promise<void> {
  await update(period).set(() => ({ status: "closed", closedBy: by, closedAt: new Date(at).toISOString() })).where((c) => eq(c.periodId, periodId)).run(on);
}

/** Opens a closed period again, with the reason, which is not optional. */
export async function reopenPeriod(on: Runner, periodId: string, reason: string): Promise<void> {
  if (reason.trim() === "") throw new TypeError("a period is reopened with a reason");
  await update(period).set(() => ({ status: "reopened", reason })).where((c) => eq(c.periodId, periodId)).run(on);
}

/**
 * Places a change dated at an instant: in its own period where that takes changes, as an adjustment of the next open period where its own is closed, and nowhere where no period holds it.
 */
export async function place(on: Runner, scope: string, dated: string | Date): Promise<Placement> {
  const ps = await periodsOf(on, scope);
  const at = time(dated);
  const own = ps.find((p) => p.from <= at && at < p.to);
  if (own === undefined) return { kind: "none" };
  if (own.status !== "closed") return { kind: "open", periodId: own.id };
  const next = ps.find((p) => p.from >= own.to && p.status !== "closed");
  return next === undefined ? { kind: "none" } : { kind: "adjustment", belongsTo: own.id, periodId: next.id };
}

/** Adds a run of a control to its history. */
export async function recordRun(on: Runner, run: { readonly controlRunId: string; readonly controlId: string; readonly result: "pass" | "fail" | "waived" | "not_run"; readonly ranAt: string | Date; readonly evidence?: string }): Promise<void> {
  await insertInto(controlRun).values({ controlRunId: run.controlRunId, controlId: run.controlId, result: run.result, ranAt: new Date(run.ranAt).toISOString(), evidence: run.evidence ?? null } as never).run(on);
}

/** What the matrix says of one control now. */
export interface ControlStatus {
  readonly controlId: string;
  readonly owner: string;
  readonly framework: string | null;
  readonly status: "passing" | "failing" | "waived" | "overdue" | "never-run";
  readonly lastRun: string | null;
}

/**
 * The control matrix: each control with the status that follows from its runs. The latest run decides: a failure is failing, a waiver is waived, a pass is passing unless it is older than the control's frequency (in days),
 * which makes it overdue; a control that was never run says so.
 */
export async function matrix(on: Runner, asOf: string | Date = new Date()): Promise<readonly ControlStatus[]> {
  const controls = await from(control).select((s) => ({ id: s.control.controlId, owner: s.control.owner, framework: s.control.framework, days: s.control.frequency })).orderBy((s) => [asc(s.control.controlId)]).run(on);
  const runs = await from(controlRun).select((s) => ({ id: s.controlRun.controlId, result: s.controlRun.result, at: s.controlRun.ranAt })).orderBy((s) => [desc(s.controlRun.ranAt)]).run(on);
  const now = time(asOf);
  return controls.map((c) => {
    const last = runs.find((r) => r.id === c.id && time(r.at) <= now);
    const base = { controlId: c.id, owner: c.owner, framework: c.framework ?? null, lastRun: last === undefined ? null : new Date(last.at).toISOString() };
    if (last === undefined) return { ...base, status: "never-run" as const };
    if (last.result === "fail" || last.result === "not_run") return { ...base, status: "failing" as const };
    if (last.result === "waived") return { ...base, status: "waived" as const };
    return { ...base, status: (now - time(last.at)) / 86_400_000 > Number(c.days) ? ("overdue" as const) : ("passing" as const) };
  });
}

/** A use of a subject's data. */
export interface Use {
  readonly subject: string;
  readonly purpose: string;
  readonly at: string | Date;
}

/** Whether a consent in force covers a purpose at an instant, and has not been withdrawn. */
export async function permits(on: Runner, subject: string, purpose: string, at: string | Date): Promise<boolean> {
  const rows = await from(consent).where((s) => and(eq(s.consent.subject, subject), eq(s.consent.purpose, purpose))).select((s) => ({ status: s.consent.status, from: s.consent.validFrom, to: s.consent.validTo })).run(on);
  const t = time(at);
  return rows.some((r) => r.status === "granted" && time(r.from) <= t && (r.to === null || time(r.to) > t));
}

/** The uses that no consent covers: the failures of a policy that is a test. */
export async function unconsented(on: Runner, uses: Iterable<Use>): Promise<readonly Use[]> {
  const out: Use[] = [];
  for (const u of uses) if (!(await permits(on, u.subject, u.purpose, u.at))) out.push(u);
  return out;
}

/** A canary where it should not be. */
export interface CanaryHit {
  readonly token: string;
  readonly where: string;
  readonly plantedIn: string;
}

/** Plants a token. */
export async function plant(on: Runner, token: string, plantedIn: string, purpose: string, at: string | Date = new Date()): Promise<void> {
  await insertInto(canaryToken).values({ canaryTokenId: token, plantedIn, plantedAt: new Date(at).toISOString(), purpose } as never).run(on);
}

/** Looks in text for the planted tokens, where they are not the place that holds them, and says where each was found. */
export async function scanCanaries(on: Runner, texts: Iterable<{ readonly where: string; readonly text: string }>): Promise<readonly CanaryHit[]> {
  const tokens = await from(canaryToken).select((s) => ({ id: s.canaryToken.canaryTokenId, in: s.canaryToken.plantedIn })).run(on);
  const hits: CanaryHit[] = [];
  for (const t of texts) for (const k of tokens) if (t.where !== k.in && t.text.includes(k.id)) hits.push({ token: k.id, where: t.where, plantedIn: k.in });
  return hits;
}

/** The label of what is made from sources: the highest of theirs. */
export function propagate(labels: readonly string[]): Label {
  const top = labels.reduce((a, l) => Math.max(a, rank(l)), 0);
  return LABELS[top]!;
}

/** A derived dataset that is labelled lower than what it is made from. */
export interface LabelViolation {
  readonly dataset: string;
  readonly declared: string;
  readonly required: Label;
  readonly because: readonly string[];
}

/** Checks labels along the lineage: each dataset must be labelled at least as high as the highest of the datasets it is made from, however far back. */
export function labelViolations(edges: readonly { readonly from: string; readonly to: string }[], declared: Readonly<Record<string, string>>): readonly LabelViolation[] {
  const into = new Map<string, string[]>();
  for (const e of edges) into.set(e.to, [...(into.get(e.to) ?? []), e.from]);
  const need = (d: string, seen: Set<string>): string[] => {
    if (seen.has(d)) return [];
    seen.add(d);
    return (into.get(d) ?? []).flatMap((s) => [s, ...need(s, seen)]);
  };
  const out: LabelViolation[] = [];
  for (const d of [...into.keys()].sort()) {
    const sources = [...new Set(need(d, new Set()))];
    const required = propagate(sources.map((s) => declared[s] ?? "public"));
    if (rank(declared[d] ?? "public") < rank(required)) out.push({ dataset: d, declared: declared[d] ?? "public", required, because: sources.filter((s) => rank(declared[s]) === rank(required)).sort() });
  }
  return out;
}

/** The differences between the layers of one table. */
export interface LayerDisagreement {
  readonly table: string;
  readonly between: "logical and physical";
  readonly lines: readonly string[];
}

/** Says where the physical layer disagrees with the logical one, table by table, in words a person can act on. */
export function layerReport(found: readonly Drift[]): readonly LayerDisagreement[] {
  const by = new Map<string, string[]>();
  const say = (d: Drift): string => {
    switch (d.kind) {
      case "missing-table": return "the table is not in the database";
      case "stray-table": return "the table is in the database and not in the model";
      case "missing-column": return `the column ${d.column} is not in the database`;
      case "stray-column": return `the column ${d.column} is in the database and not in the model`;
      case "type": return `the column ${d.column} is ${d.found} and the model says ${d.expected}`;
      case "nullability": return `the column ${d.column} ${d.found ? "may" : "may not"} be null and the model says it ${d.expected ? "may" : "may not"}`;
      case "primary-key": return `the key is (${d.found.join(", ")}) and the model says (${d.expected.join(", ")})`;
      case "missing-foreign-key": return `no foreign key on (${d.columns.join(", ")})`;
      case "missing-unique": return `no unique on (${d.columns.join(", ")})`;
      case "missing-index": return `no index on (${d.columns.join(", ")})`;
    }
  };
  for (const d of found) by.set(d.table, [...(by.get(d.table) ?? []), say(d)]);
  return [...by].sort(([a], [b]) => a.localeCompare(b)).map(([table, lines]) => ({ table, between: "logical and physical" as const, lines }));
}
