// Spec: 0054-sql-loads FR-004, FR-005, FR-006, FR-007, FR-008
/**
 * Loads (commons data 0054-sql-loads): a source into a typed table, in batches, in one transaction, and recorded. `append`, `skip-existing` and `upsert` say what happens where a key is there; `replace` empties the
 * table first. With a gate, a load is ELT: the rows go to a staging table that has the target's columns and none of its constraints, SQL-DQ tests run on the staging table, and only a load that passes is merged
 * into the target; one that does not leaves the target as it was and reports the failures. Every run is a row of the ledger of loads, with its counts and its high-water mark, so that the next run can read only
 * what is new.
 *
 * @module
 */
import { type DqTest, runTests, type Outcome, summary } from "@intellectual-frontiers/data/sql/quality";
import { and, defineTable, deleteFrom, desc, eq, excluded, type Expr, from, insertInto, or, type Runner, type Table } from "@intellectual-frontiers/data/sql/typed";
import type { Dialect } from "@intellectual-frontiers/data/sql/physical";
import type { Rejected, Source } from "./source.ts";

interface RunRow {
  readonly runId: string;
  readonly load: string;
  readonly status: string;
  readonly startedAt: string;
  readonly finishedAt: string | null;
  readonly readCount: number;
  readonly writtenCount: number;
  readonly rejectedCount: number;
  readonly watermark: string | null;
  readonly message: string | null;
}
/** The ledger of loads: one row for each run. */
export const loadRun = defineTable<RunRow, RunRow, "loadRun">({
  alias: "loadRun",
  name: "load_run",
  columns: { runId: "run_id", load: "load_name", status: "status", startedAt: "started_at", finishedAt: "finished_at", readCount: "read_count", writtenCount: "written_count", rejectedCount: "rejected_count", watermark: "watermark", message: "message" },
  primaryKey: ["runId"],
});

/** Makes the ledger of loads if it is not there. */
export async function ensureLedger(on: Runner): Promise<void> {
  const q = on.dialect.quote;
  await on.driver.exec(
    `CREATE TABLE IF NOT EXISTS ${q("load_run")} (${q("run_id")} TEXT PRIMARY KEY, ${q("load_name")} TEXT NOT NULL, ${q("status")} TEXT NOT NULL, ${q("started_at")} TEXT NOT NULL, ${q("finished_at")} TEXT, ${q("read_count")} INTEGER NOT NULL, ${q("written_count")} INTEGER NOT NULL, ${q("rejected_count")} INTEGER NOT NULL, ${q("watermark")} TEXT, ${q("message")} TEXT)`,
  );
}

/** The high-water mark of the last load of a name that was loaded, or none: what the next run reads from. */
export async function watermarkOf(on: Runner, load: string): Promise<string | undefined> {
  await ensureLedger(on);
  const rows = await from(loadRun)
    .where((s) => and(eq(s.loadRun.load, load), eq(s.loadRun.status, "loaded")))
    .select((s) => ({ w: s.loadRun.watermark, at: s.loadRun.startedAt }))
    .orderBy((_, o) => [desc(o.at)])
    .limit(20)
    .run(on);
  return rows.find((r) => r.w !== null)?.w ?? undefined;
}

/** What a load does where a row's key is already in the table. */
export type LoadMode = "append" | "skip-existing" | "upsert" | "replace";

/** What a load is told. */
export interface LoadSpec<R, I, N extends string> {
  /** The name of the load, by which its runs are known. */
  readonly name: string;
  readonly source: Source<I>;
  readonly target: Table<R, I, N>;
  /** `append` fails on a key that is there; the default. */
  readonly mode?: LoadMode;
  /** The columns that a row is known by, for `skip-existing` and `upsert`: the primary key of the table where not given. */
  readonly keys?: readonly (keyof R & string)[];
  /** The rows in a batch, 500 where not given. */
  readonly batchSize?: number;
  /** The tests of the rows that are staged; where there are any, the load goes through a staging table and only a load that passes is merged. */
  readonly gate?: (staging: { readonly name: string; readonly schema?: string }) => readonly DqTest[];
  /** A column whose greatest value in the rows loaded is kept as the high-water mark. */
  readonly watermark?: keyof R & string;
  /** Fail the load, and take nothing, where more than this share of the lines were rejected (none where not given). */
  readonly maxRejected?: number;
  /** Keep the staging table, to look at what was gated. */
  readonly keepStaging?: boolean;
  /** A column of the table that is given the run's id on every row this load writes, so that what a load wrote can be found and undone by it. */
  readonly loadIdColumn?: keyof R & string;
  /**
   * In `append` mode, a row whose key is already there is not a failure: where its content is the same it is absorbed (counted, not written again), and where it differs it is diverted to the table `<table>__conflict`
   * (the existing row and the incoming one, as JSON), and the original is left as it is. Without a gate.
   */
  readonly divertConflicts?: boolean;
}

/** What a load did. */
export interface LoadReport {
  readonly runId: string;
  readonly load: string;
  /** `loaded`; `gated` where the tests of the gate did not pass; `rejected` where too many lines were rejected; `failed` where the database refused. */
  readonly status: "loaded" | "gated" | "rejected" | "failed";
  readonly read: number;
  readonly written: number;
  readonly rejected: readonly Rejected[];
  readonly quality: readonly Outcome[];
  readonly watermark?: string;
  readonly message?: string;
  /** Rows whose key was there with the same content (`divertConflicts`). */
  readonly absorbed?: number;
  /** Rows whose key was there with other content, sent to the conflict table. */
  readonly diverted?: number;
}

let counter = 0;
const newId = (): string => `${Date.now().toString(36)}-${(counter++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Runs a load.
 *
 * @param spec - what to load, from where, into what
 * @param on - the database and its dialect
 * @returns what it did; a refusal by the database is a report with status `failed`, not a throw
 */
export async function runLoad<R, I, N extends string>(spec: LoadSpec<R, I, N>, on: Runner): Promise<LoadReport> {
  await ensureLedger(on);
  const runId = newId();
  const started = new Date().toISOString();
  const size = Math.max(1, spec.batchSize ?? 500);
  const mode = spec.mode ?? "append";
  const keys = spec.keys ?? spec.target.primaryKey;
  if ((mode === "upsert" || mode === "skip-existing") && keys.length === 0) return await record(on, { runId, load: spec.name, status: "failed", read: 0, written: 0, rejected: [], quality: [], message: `${spec.name}: ${mode} needs keys and the table has no primary key` }, started);
  const staged = spec.gate !== undefined;
  const staging = staged ? defineTable<R, I, string>({ alias: "staging", name: `${spec.target.source.kind === "table" ? spec.target.source.name : spec.name}__stg`, columns: spec.target.sqlNames, primaryKey: [] }).inSchema(spec.target.source.kind === "table" ? spec.target.source.schema : undefined) : undefined;
  const into = (staging ?? spec.target) as Table<R, I, string>;
  const rejected: Rejected[] = [];
  let read = 0;
  let written = 0;
  let mark: string | undefined;
  let absorbed = 0;
  let diverted = 0;
  const seen = new Map<string, Record<string, unknown>>();
  let quality: readonly Outcome[] = [];
  const q = on.dialect.quote;
  const stagingName = staging === undefined ? "" : `${staging.source.kind === "table" && staging.source.schema !== undefined ? `${q(staging.source.schema)}.` : ""}${q(staging.source.kind === "table" ? staging.source.name : "")}`;
  await on.driver.exec("BEGIN");
  try {
    if (staging !== undefined) {
      await on.driver.exec(`DROP TABLE IF EXISTS ${stagingName}`);
      await on.driver.exec(`CREATE TABLE ${stagingName} AS SELECT * FROM ${qualifiedTarget(spec.target, on.dialect)} WHERE 1 = 0`);
    } else if (mode === "replace") await deleteFrom(spec.target).all().run(on);
    for await (const batch of spec.source.batches(size)) {
      rejected.push(...batch.rejected);
      read += batch.rows.length;
      if (batch.rows.length === 0) continue;
      if (spec.watermark !== undefined)
        for (const row of batch.rows) {
          const v = (row as Record<string, unknown>)[spec.watermark];
          if (v !== null && v !== undefined && (mark === undefined || String(v) > mark)) mark = String(v);
        }
      let incoming = batch.rows as readonly I[];
      if (spec.loadIdColumn !== undefined) incoming = incoming.map((r) => ({ ...r, [spec.loadIdColumn as string]: runId }));
      if (spec.divertConflicts === true && staging === undefined) {
        if (mode !== "append") throw new TypeError("divertConflicts is for the mode append");
        const split = await divide(spec.target, keys, incoming, seen, spec.loadIdColumn, on);
        absorbed += split.same;
        if (split.clashes.length > 0) {
          diverted += split.clashes.length;
          await keepConflicts(spec.target, split.clashes, runId, on);
        }
        incoming = split.fresh;
        if (incoming.length === 0) continue;
      }
      const rows = incoming as readonly [I, ...I[]];
      let ins = insertInto(into).values(rows);
      if (staging === undefined) ins = conflictOf(ins, mode, keys, spec.target, rows[0] as Record<string, unknown>);
      await ins.run(on);
      written += incoming.length;
    }
    const total = read + rejected.length;
    if (spec.maxRejected !== undefined && total > 0 && rejected.length / total > spec.maxRejected) {
      await on.driver.exec("ROLLBACK");
      if (staging !== undefined && spec.keepStaging !== true) await on.driver.exec(`DROP TABLE IF EXISTS ${stagingName}`).catch(() => undefined);
      return await record(on, { runId, load: spec.name, status: "rejected", read, written: 0, rejected, quality, message: `${rejected.length} of ${total} lines were rejected, more than ${spec.maxRejected}` }, started);
    }
    if (staging !== undefined && spec.gate !== undefined) {
      quality = await runTests(spec.gate({ name: staging.source.kind === "table" ? staging.source.name : "", ...(staging.source.kind === "table" && staging.source.schema !== undefined ? { schema: staging.source.schema } : {}) }), on.driver, on.dialect);
      if (!summary(quality).ok) {
        await on.driver.exec("ROLLBACK");
        if (spec.keepStaging !== true) await on.driver.exec(`DROP TABLE IF EXISTS ${stagingName}`).catch(() => undefined);
        return await record(on, { runId, load: spec.name, status: "gated", read, written: 0, rejected, quality, message: "the tests of the gate did not pass" }, started);
      }
      if (mode === "replace") await deleteFrom(spec.target).all().run(on);
      const cols = Object.keys(spec.target.sqlNames) as (keyof R & string)[];
      const sel = from(staging).where(() => and()).select((s) => Object.fromEntries(cols.map((c) => [c, (s["staging"] as Record<string, Expr<unknown>>)[c]!])) as never);
      let merge = insertInto(spec.target).select(cols as unknown as readonly [keyof R & string, ...(keyof R & string)[]], sel as never);
      merge = conflictOf(merge, mode, keys, spec.target, Object.fromEntries(cols.map((c) => [c, 1])));
      await merge.run(on);
      if (spec.keepStaging !== true) await on.driver.exec(`DROP TABLE IF EXISTS ${stagingName}`);
    }
    await on.driver.exec("COMMIT");
    return await record(on, { runId, load: spec.name, status: "loaded", read, written, rejected, quality, ...(mark === undefined ? {} : { watermark: mark }), ...(spec.divertConflicts === true ? { absorbed, diverted } : {}) }, started);
  } catch (thrown) {
    await on.driver.exec("ROLLBACK").catch(() => undefined);
    if (staging !== undefined && spec.keepStaging !== true) await on.driver.exec(`DROP TABLE IF EXISTS ${stagingName}`).catch(() => undefined);
    return await record(on, { runId, load: spec.name, status: "failed", read, written: 0, rejected, quality, message: thrown instanceof Error ? thrown.message : String(thrown) }, started);
  }
}

const same = (a: unknown, b: unknown): boolean => String(a ?? null) === String(b ?? null);

/** The rows of a batch by what is known of their keys: new ones, ones that are there with the same content, and ones that are there with other content. */
async function divide<R, I, N extends string>(
  target: Table<R, I, N>,
  keys: readonly (keyof R & string)[],
  rows: readonly I[],
  seen: Map<string, Record<string, unknown>>,
  idColumn: string | undefined,
  on: Runner,
): Promise<{ readonly fresh: I[]; readonly same: number; readonly clashes: { readonly key: string; readonly existing: Record<string, unknown> | undefined; readonly incoming: Record<string, unknown> }[] }> {
  const cols = Object.keys(target.sqlNames) as (keyof R & string)[];
  const keyOf = (r: Record<string, unknown>): string => JSON.stringify(keys.map((k) => r[k] ?? null));
  const known = new Map<string, Record<string, unknown>>();
  const hasKey = (r: Record<string, unknown>): boolean => keys.every((k) => r[k] !== null && r[k] !== undefined);
  const lookups = rows.map((r) => r as Record<string, unknown>).filter(hasKey);
  if (lookups.length > 0) {
    const cond = or(...lookups.map((r) => and(...keys.map((k) => eq((target.c as unknown as Record<string, Expr<unknown>>)[k] as Expr<never>, r[k] as never)))));
    const found = await from(target)
      .where(() => cond)
      .select((s) => Object.fromEntries(cols.map((c) => [c, (s[target.alias] as unknown as Record<string, Expr<unknown>>)[c] as Expr<unknown>])) as never)
      .run(on);
    for (const e of found as readonly Record<string, unknown>[]) known.set(keyOf(e), e);
  }
  const fresh: I[] = [];
  const clashes: { key: string; existing: Record<string, unknown> | undefined; incoming: Record<string, unknown> }[] = [];
  let sameCount = 0;
  for (const row of rows) {
    const r = row as Record<string, unknown>;
    if (!hasKey(r)) {
      fresh.push(row);
      continue;
    }
    const k = keyOf(r);
    const there = known.get(k) ?? seen.get(k);
    if (there === undefined) {
      fresh.push(row);
      seen.set(k, r);
    } else if (cols.filter((c) => c !== idColumn).every((c) => same(there[c], r[c]))) sameCount++;
    else clashes.push({ key: k, existing: known.get(k), incoming: r });
  }
  return { fresh, same: sameCount, clashes };
}

/** Writes the rows that were diverted into the conflict table of the target, which is made if it is not there. */
async function keepConflicts<R, I, N extends string>(target: Table<R, I, N>, clashes: readonly { readonly key: string; readonly existing: Record<string, unknown> | undefined; readonly incoming: Record<string, unknown> }[], runId: string, on: Runner): Promise<void> {
  const q = on.dialect.quote;
  const name = `${target.source.kind === "table" ? target.source.name : "target"}__conflict`;
  await on.driver.exec(`CREATE TABLE IF NOT EXISTS ${q(name)} (${q("run_id")} TEXT NOT NULL, ${q("at")} TEXT NOT NULL, ${q("key")} TEXT NOT NULL, ${q("existing")} TEXT, ${q("incoming")} TEXT NOT NULL)`);
  const at = new Date().toISOString();
  for (const c of clashes)
    await on.driver.exec(`INSERT INTO ${q(name)} VALUES (${[runId, at, c.key, c.existing === undefined ? null : JSON.stringify(c.existing), JSON.stringify(c.incoming)].map((v) => on.dialect.literal(v)).join(", ")})`);
}

function qualifiedTarget<R, I, N extends string>(t: Table<R, I, N>, d: Dialect): string {
  return t.source.kind === "table" ? `${t.source.schema === undefined ? "" : `${d.quote(t.source.schema)}.`}${d.quote(t.source.name)}` : "";
}

function conflictOf<R, I, N extends string, Row>(ins: ReturnType<typeof insertInto<R, I, N>>["values"] extends (...a: never[]) => infer T ? T : never, mode: LoadMode, keys: readonly (keyof R & string)[], target: Table<R, I, N>, sample: Record<string, unknown>): typeof ins {
  void (null as unknown as Row);
  if (mode === "skip-existing") return ins.onConflictDoNothing(...keys);
  if (mode === "upsert") {
    const set: Record<string, unknown> = {};
    for (const k of Object.keys(sample)) if (!keys.includes(k as never)) set[k] = excluded((target.c as unknown as Record<string, never>)[k]!);
    if (Object.keys(set).length === 0) return ins.onConflictDoNothing(...keys);
    return ins.onConflictDoUpdate(keys as never, set as never);
  }
  return ins;
}

/** The ledger row of a run, written when a run is over; the report is returned as it is. */
async function record(on: Runner, r: Omit<LoadReport, "watermark"> & { readonly watermark?: string }, started: string): Promise<LoadReport> {
  await insertInto(loadRun)
    .values({ runId: r.runId, load: r.load, status: r.status, startedAt: started, finishedAt: new Date().toISOString(), readCount: r.read, writtenCount: r.written, rejectedCount: r.rejected.length, watermark: r.watermark ?? null, message: r.message ?? null })
    .run(on);
  return r;
}

