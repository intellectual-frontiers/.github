// Spec: 0064-recovery-proof-identity FR-007, FR-008, FR-009, FR-010, FR-011, FR-012, FR-013
/**
 * Recovery, proof and identity at work (commons data 0064-recovery-proof-identity): the code that works on the tables of the proof model (`models/proof`). A drill puts a recovery to the test and keeps what it found: a
 * rollback of a load by its id is first counted and then done, and what other loads wrote must be what it was; a replay that is idempotent leaves a table as it was; a restore brings back what was destroyed. A calculation
 * is run with the hash of its inputs and outputs so that it can be reproduced; a reference case holds it to a value; lineage says what a dataset is made from and what a change reaches; and records of different sources are
 * linked to one entity by rules that are written down.
 *
 * @module
 */
import { sha256Hex } from "@intellectual-frontiers/data/sql/lifecycle";
import { rollbackLoad, type Written } from "@intellectual-frontiers/data/sql/flow";
import { and, asc, count, eq, from, insertInto, ne, type Runner, type Table } from "@intellectual-frontiers/data/sql/typed";
import { proof } from "@intellectual-frontiers/data/sql/typed/models";

const { calculationRun, drill, entityLink, lineageEdge, referenceCase } = proof;

const plain = (_k: string, v: unknown): unknown => (typeof v === "bigint" ? Number(v) : v instanceof Date ? v.toISOString() : v);

/** The SHA-256 of rows, in the order given: the same rows in the same order always give the same hash. */
export const hashRows = (rows: readonly unknown[]): string => sha256Hex(JSON.stringify(rows, plain));

/** What a table held, as a count and a hash. */
export interface Fingerprint {
  readonly rows: number;
  readonly hash: string;
}

/** What to read of a table to know it is as it was: the columns, and the ones that put the rows in a fixed order. */
export interface Look {
  readonly table: Table<never, never, string>;
  readonly columns: readonly string[];
  readonly orderBy: readonly string[];
  /** Rows whose column is not this value only: the rows that a load did not write. */
  readonly except?: { readonly column: string; readonly value: string };
}

/** A fingerprint of a table: the count and the hash of the columns asked for, in the order asked for. */
export async function fingerprint(on: Runner, look: Look): Promise<Fingerprint> {
  const t = look.table as never;
  const rows = await from(t)
    .where((s: Record<string, Record<string, never>>) => (look.except === undefined ? and() : ne(s[Object.keys(s)[0]!]![look.except.column]!, look.except.value as never)))
    .select((s: Record<string, Record<string, never>>) => Object.fromEntries(look.columns.map((c) => [c, s[Object.keys(s)[0]!]![c]!])) as never)
    .orderBy((s: Record<string, Record<string, never>>) => look.orderBy.map((c) => asc(s[Object.keys(s)[0]!]![c]!)))
    .run(on);
  return { rows: rows.length, hash: await hashRows(rows) };
}

/** What a drill found. */
export interface Drilled {
  readonly drillId: string;
  readonly outcome: "passed" | "failed";
  readonly seconds: number;
  readonly before: Fingerprint;
  readonly after: Fingerprint;
  /** Where a drill failed, what did not hold. */
  readonly problems: readonly string[];
}

async function keep(on: Runner, d: { drillId: string; kind: "replay" | "rollback" | "restore"; scope: string; startedAt: Date; seconds: number; outcome: "passed" | "failed"; before: Fingerprint; after: Fingerprint; evidence?: string }): Promise<void> {
  await insertInto(drill).values({ drillId: d.drillId, kind: d.kind, scope: d.scope, startedAt: d.startedAt.toISOString(), seconds: d.seconds, outcome: d.outcome, beforeHash: d.before.hash, afterHash: d.after.hash, evidence: d.evidence ?? null } as never).run(on);
}

const since = (t0: number): number => Math.max(0, Math.round((performance.now() - t0) / 1000));

/** What a rollback drill is told. */
export interface RollbackDrill {
  readonly drillId: string;
  readonly loadId: string;
  readonly tables: readonly Written[];
  /** What to read of each table that is not the load's, which must be as it was: by the table's name. */
  readonly looks: Readonly<Record<string, Omit<Look, "except" | "table">>>;
}

/**
 * Drills the rollback of a load by its id: counts what it wrote, does the rollback, and shows that the count of what it removed is the count it wrote, that none of its rows remain, and that the rows of other loads in
 * each table are what they were. The drill is kept, whatever it found.
 */
export async function rollbackDrill(on: Runner, d: RollbackDrill): Promise<Drilled> {
  const t0 = performance.now();
  const startedAt = new Date();
  const problems: string[] = [];
  const planned: Record<string, number> = {};
  const others: { name: string; look: Look; before: Fingerprint }[] = [];
  for (const w of d.tables) {
    const t = w.table as unknown as Table<Record<string, unknown>, never, string>;
    const name = t.source.kind === "table" ? t.source.name : t.alias;
    const n = await from(w.table as never).where((s: Record<string, Record<string, never>>) => eq(s[Object.keys(s)[0]!]![w.column]!, d.loadId as never)).select(() => ({ n: count() })).first(on);
    planned[name] = Number((n as { n: number }).n);
    const shape = d.looks[name];
    if (shape !== undefined) {
      const look: Look = { table: w.table, ...shape, except: { column: w.column, value: d.loadId } };
      others.push({ name, look, before: await fingerprint(on, look) });
    }
  }
  const done = await rollbackLoad(on, d.loadId, d.tables);
  for (const [name, n] of Object.entries(planned)) if (done.removed[name] !== n) problems.push(`${name}: ${n} rows were written and ${done.removed[name]} were removed`);
  for (const w of d.tables) {
    const left = await from(w.table as never).where((s: Record<string, Record<string, never>>) => eq(s[Object.keys(s)[0]!]![w.column]!, d.loadId as never)).select(() => ({ n: count() })).first(on);
    if (Number((left as { n: number }).n) !== 0) problems.push("rows of the load remain");
  }
  const rest = { rows: 0, hash: "" };
  const was = { rows: 0, hash: "" };
  const parts: string[] = [];
  const partsBefore: string[] = [];
  for (const o of others) {
    const after = await fingerprint(on, o.look);
    if (after.hash !== o.before.hash) problems.push(`${o.name}: rows of other loads changed`);
    rest.rows += after.rows;
    was.rows += o.before.rows;
    parts.push(after.hash);
    partsBefore.push(o.before.hash);
  }
  const before = { rows: was.rows, hash: await hashRows(partsBefore) };
  const after = { rows: rest.rows, hash: await hashRows(parts) };
  const outcome = problems.length === 0 ? "passed" : "failed";
  const seconds = since(t0);
  await keep(on, { drillId: d.drillId, kind: "rollback", scope: d.loadId, startedAt, seconds, outcome, before, after, evidence: problems.join("; ") || undefined } as never);
  return { drillId: d.drillId, outcome, seconds, before, after, problems };
}

/** What a replay or a restore drill is told. */
export interface StateDrill {
  readonly drillId: string;
  readonly kind: "replay" | "restore";
  readonly scope: string;
  /** What to read of the table whose state must come back. */
  readonly look: Look;
  /** What is done: a replay of a load from the raw copy, or a backup, a loss and a restore. */
  readonly steps: () => Promise<void>;
  /** Whether the state must be what it was (a replay that is idempotent, a restore), or may change (a replay of a corrected load): the default is that it is the same. */
  readonly expect?: "same" | "different";
}

/** Drills a replay or a restore: reads the table, does the steps, reads it again, and says whether it is as it was. The drill is kept, whatever it found. */
export async function stateDrill(on: Runner, d: StateDrill): Promise<Drilled> {
  const t0 = performance.now();
  const startedAt = new Date();
  const before = await fingerprint(on, d.look);
  await d.steps();
  const after = await fingerprint(on, d.look);
  const same = before.hash === after.hash;
  const wanted = (d.expect ?? "same") === "same";
  const problems = same === wanted ? [] : [wanted ? `${d.scope} is not as it was: ${before.rows} rows before and ${after.rows} after` : `${d.scope} did not change`];
  const outcome = problems.length === 0 ? "passed" : "failed";
  const seconds = since(t0);
  await keep(on, { drillId: d.drillId, kind: d.kind, scope: d.scope, startedAt, seconds, outcome, before, after, evidence: problems.join("; ") || undefined } as never);
  return { drillId: d.drillId, outcome, seconds, before, after, problems };
}

/** A calculation to run and record. */
export interface Calculation<I, O> {
  readonly calculationRunId: string;
  readonly calculation: string;
  readonly version: string;
  readonly parameters?: unknown;
  readonly inputs: readonly I[];
  readonly run: (inputs: readonly I[]) => readonly O[];
  readonly loadId?: string;
  readonly at?: Date;
}

/** Runs a calculation and records the hash of its inputs and outputs, the parameters and the version. */
export async function recordCalculation<I, O>(on: Runner, c: Calculation<I, O>): Promise<{ readonly outputs: readonly O[]; readonly inputHash: string; readonly outputHash: string }> {
  const outputs = c.run(c.inputs);
  const inputHash = await hashRows(c.inputs);
  const outputHash = await hashRows(outputs);
  await insertInto(calculationRun).values({ calculationRunId: c.calculationRunId, calculation: c.calculation, version: c.version, parameters: c.parameters === undefined ? null : JSON.stringify(c.parameters), inputHash, outputHash, rows: outputs.length, ranAt: (c.at ?? new Date()).toISOString(), loadId: c.loadId ?? null } as never).run(on);
  return { outputs, inputHash, outputHash };
}

/** What reproducing a run found. */
export type Reproduced = { readonly kind: "reproduced" } | { readonly kind: "different-inputs" } | { readonly kind: "different-outputs"; readonly recorded: string; readonly now: string } | { readonly kind: "unknown-run" };

/** Runs a calculation again on the inputs given and says whether its outputs are what the recorded run gave: the inputs must be the recorded ones, or it says they are not. */
export async function reproduce<I, O>(on: Runner, calculationRunId: string, inputs: readonly I[], run: (inputs: readonly I[]) => readonly O[]): Promise<Reproduced> {
  const r = await from(calculationRun).where((s) => eq(s.calculationRun.calculationRunId, calculationRunId)).select((s) => ({ i: s.calculationRun.inputHash, o: s.calculationRun.outputHash })).first(on);
  if (r === undefined) return { kind: "unknown-run" };
  if ((await hashRows(inputs)) !== r.i) return { kind: "different-inputs" };
  const now = await hashRows(run(inputs));
  return now === r.o ? { kind: "reproduced" } : { kind: "different-outputs", recorded: r.o, now };
}

/** What running a reference case found. */
export interface CaseResult {
  readonly referenceCaseId: string;
  readonly expected: number;
  readonly got: number;
  readonly difference: number;
  readonly within: boolean;
}

/** Runs each reference case of a calculation (its inputs are the JSON the case holds) and says whether the value is within the tolerance of the one expected. */
export async function runReferenceCases(on: Runner, calculation: string, calc: (inputs: unknown) => number): Promise<readonly CaseResult[]> {
  const cases = await from(referenceCase).where((s) => eq(s.referenceCase.calculation, calculation)).select((s) => ({ id: s.referenceCase.referenceCaseId, inputs: s.referenceCase.inputs, expected: s.referenceCase.expected, tolerance: s.referenceCase.tolerance })).orderBy((s) => [asc(s.referenceCase.referenceCaseId)]).run(on);
  return cases.map((c) => {
    const got = calc(JSON.parse(c.inputs));
    const difference = Math.abs(got - Number(c.expected));
    return { referenceCaseId: c.id, expected: Number(c.expected), got, difference, within: difference <= Number(c.tolerance) };
  });
}

/** A dataset a lineage walk reached. */
export interface Reached {
  readonly dataset: string;
  readonly depth: number;
  readonly via: string;
}

/** Walks the lineage from a dataset upstream (what it is made from) or downstream (what a change to it reaches), nearest first, each dataset once, and where there is a cycle, without looping. */
export async function lineage(on: Runner, dataset: string, direction: "upstream" | "downstream"): Promise<readonly Reached[]> {
  const edges = await from(lineageEdge).select((s) => ({ f: s.lineageEdge.fromDataset, t: s.lineageEdge.toDataset, v: s.lineageEdge.via })).orderBy((s) => [asc(s.lineageEdge.fromDataset), asc(s.lineageEdge.toDataset)]).run(on);
  const seen = new Set<string>([dataset]);
  const out: Reached[] = [];
  let frontier = [dataset];
  for (let depth = 1; frontier.length > 0; depth++) {
    const next: string[] = [];
    for (const d of frontier)
      for (const e of edges) {
        const [here, there] = direction === "downstream" ? [e.f, e.t] : [e.t, e.f];
        if (here === d && !seen.has(there)) {
          seen.add(there);
          out.push({ dataset: there, depth, via: e.v });
          next.push(there);
        }
      }
    frontier = next;
  }
  return out;
}

/** The edges of the lineage as `labelViolations` of the contract model reads them. */
export async function edgesOf(on: Runner): Promise<readonly { readonly from: string; readonly to: string }[]> {
  return (await from(lineageEdge).select((s) => ({ f: s.lineageEdge.fromDataset, t: s.lineageEdge.toDataset })).orderBy((s) => [asc(s.lineageEdge.fromDataset), asc(s.lineageEdge.toDataset)]).run(on)).map((e) => ({ from: e.f, to: e.t }));
}

/** A record of a source, to be linked. */
export interface Record_ {
  readonly source: string;
  readonly key: string;
  readonly fields: Readonly<Record<string, string | null | undefined>>;
}

/** A rule to link records by, tried in order. */
export type LinkRule =
  | { readonly rule: "exact"; readonly fields: readonly string[] }
  | { readonly rule: "normalized"; readonly fields: readonly string[] }
  | { readonly rule: "similar"; readonly fields: readonly string[]; readonly threshold: number };

/** One record linked to an entity. */
export interface Link {
  readonly entityId: string;
  readonly source: string;
  readonly sourceKey: string;
  readonly rule: "exact" | "normalized" | "similar" | "singleton";
  readonly score: number;
}

/** A value written in one way: accents removed, lower case, only letters and digits. */
export const normalize = (v: string): string => v.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

const bigrams = (s: string): string[] => (s.length < 2 ? [s] : Array.from({ length: s.length - 1 }, (_, i) => s.slice(i, i + 2)));

/** The Sørensen–Dice similarity of two values by their bigrams, from 0 to 1. */
export function similarity(a: string, b: string): number {
  const x = bigrams(normalize(a));
  const y = bigrams(normalize(b));
  if (x.length === 0 || y.length === 0) return 0;
  const pool = new Map<string, number>();
  for (const g of y) pool.set(g, (pool.get(g) ?? 0) + 1);
  let hit = 0;
  for (const g of x) if ((pool.get(g) ?? 0) > 0) (hit++, pool.set(g, pool.get(g)! - 1));
  return (2 * hit) / (x.length + y.length);
}

/**
 * Links records of different sources to entities, by rules tried in order: a key they share as it is, a key they share once it is written in one way, and a similarity above a threshold. A record joins an entity by the
 * first rule that links it, and the weakest rule that joined it to the group is kept with it; a record nothing links is its own entity. The entity's id is that of the first of its records, so it does not change when
 * the records come in another order. Records of the same source are not linked by `similar`, which is for crossing sources.
 */
export function linkRecords(records: readonly Record_[], rules: readonly LinkRule[]): readonly Link[] {
  const id = (r: Record_): string => `${r.source}:${r.key}`;
  const parent = new Map(records.map((r) => [id(r), id(r)]));
  const how = new Map<string, { rule: Link["rule"]; score: number }>();
  const find = (x: string): string => (parent.get(x) === x ? x : (parent.set(x, find(parent.get(x)!)), parent.get(x)!));
  const union = (a: string, b: string, rule: Link["rule"], score: number): void => {
    const [ra, rb] = [find(a), find(b)];
    if (ra === rb) return;
    const [lo, hi] = ra < rb ? [ra, rb] : [rb, ra];
    parent.set(hi, lo);
    for (const m of [a, b]) {
      const was = how.get(m);
      if (was === undefined || was.score > score) how.set(m, { rule, score });
    }
  };
  const valueOf = (r: Record_, fields: readonly string[], f: (v: string) => string): string | undefined => {
    const parts = fields.map((x) => r.fields[x]);
    return parts.some((p) => p === null || p === undefined || p === "") ? undefined : parts.map((p) => f(p as string)).join("|");
  };
  for (const rule of rules) {
    if (rule.rule === "similar") {
      for (let i = 0; i < records.length; i++)
        for (let j = i + 1; j < records.length; j++) {
          const a = records[i]!, b = records[j]!;
          if (a.source === b.source) continue;
          const [x, y] = [valueOf(a, rule.fields, (v) => v), valueOf(b, rule.fields, (v) => v)];
          if (x === undefined || y === undefined) continue;
          const s = similarity(x, y);
          if (s >= rule.threshold) union(id(a), id(b), "similar", Math.round(s * 1000) / 1000);
        }
      continue;
    }
    const by = new Map<string, string>();
    for (const r of records) {
      const v = valueOf(r, rule.fields, rule.rule === "exact" ? (s) => s : normalize);
      if (v === undefined) continue;
      const first = by.get(v);
      if (first === undefined) by.set(v, id(r));
      else union(first, id(r), rule.rule, 1);
    }
  }
  return records.map((r) => ({ entityId: `E-${find(id(r))}`, source: r.source, sourceKey: r.key, ...(how.get(id(r)) ?? { rule: "singleton" as const, score: 1 }) })).sort((a, b) => a.entityId.localeCompare(b.entityId) || a.source.localeCompare(b.source) || a.sourceKey.localeCompare(b.sourceKey));
}

/** Keeps links in the table of the proof model; a singleton, which no rule linked, is kept as an exact link to itself. */
export async function saveLinks(on: Runner, links: readonly Link[]): Promise<void> {
  if (links.length === 0) return;
  await insertInto(entityLink).values(links.map((l) => ({ entityLinkId: `${l.source}:${l.sourceKey}`, entityId: l.entityId, source: l.source, sourceKey: l.sourceKey, rule: l.rule === "singleton" ? "exact" : l.rule, score: String(l.score) })) as never).run(on);
}
