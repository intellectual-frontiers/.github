// Spec: 0005-estate-query-live FR-002, FR-003
/**
 * Asking the machines of a fleet at once, read only: for each machine and each table a question names, the SELECT made from the list of tables is sent through the way of reaching a machine that the host gives, a few at a time, each within a time, and what comes back is the relation of the table with the asset and the
 * instant in front. A machine that does not answer is said in `live_status` and never read as a machine with no rows. A value that looks like a secret is replaced. Nothing here reaches a machine itself: the host gives the way.
 *
 * @example
 * ```ts
 * import { gatherLive } from "./live.ts";
 * // const { tables, status } = await gatherLive({ assets: ["synthetic-server-02"], tables: ["processes"], fetch, now: () => new Date().toISOString() });
 * ```
 *
 * @module
 */
import { findSecretLike } from "@intellectual-frontiers/desired-os-state/governance";
import { OSQUERY_TABLES, osqueryRelation, osquerySelect } from "@intellectual-frontiers/estate-query/governance";
import type { Table, Value } from "@intellectual-frontiers/lang-sql/aide/relational";
import { err, ok, type Result } from "@intellectual-frontiers/core";

/** The way of reaching a machine: send the SELECT and give the rows as osquery prints them (every value as text), or why not. */
export type Fetch = (asset: string, select: string, signal: AbortSignal) => Promise<Result<readonly Readonly<Record<string, string>>[], string>>;

/** What `gatherLive` is given. */
export type GatherOptions = {
  readonly assets: readonly string[];
  /** The tables of osquery (without the prefix), each on the list. */
  readonly tables: readonly string[];
  readonly fetch: Fetch;
  readonly now: () => string;
  /** The most machines asked at once (4 by default). */
  readonly concurrency?: number;
  /** How long a machine has to answer, in milliseconds (15,000 by default). */
  readonly timeoutMs?: number;
  /** The most rows of a table from a machine (5,000 by default). */
  readonly rowLimit?: number;
};

/** What was gathered: the relations by name, and the status of each machine and table. */
export type Gathered = { readonly tables: Readonly<Record<string, Table>>; readonly status: Table };

const REDACTED = "[redacted: looks like a secret]";

/** The value of a column as the type says, or null where the text is not one of it. */
function typed(type: string, text: string | undefined): Value {
  if (text === undefined) return null;
  if (type === "int") return /^-?\d+$/.test(text) ? Number(text) : null;
  if (type === "bool") return text === "1" || text === "true" ? true : text === "0" || text === "false" ? false : null;
  return findSecretLike(text, "$", "").length > 0 ? REDACTED : text;
}

/** The relations of the tables asked, from every machine, and the status of each machine and table. */
export async function gatherLive(o: GatherOptions): Promise<Result<Gathered, string>> {
  const limit = o.rowLimit ?? 5_000;
  const jobs: { asset: string; table: string; select: string }[] = [];
  for (const table of o.tables) {
    const select = osquerySelect(table, limit);
    if (select === undefined) return err(`${table} is not a table that may be read (${OSQUERY_TABLES.map((x) => x.table).join(", ")})`);
    for (const asset of o.assets) jobs.push({ asset, table, select });
  }
  const rowsOf = new Map<string, Value[][]>(o.tables.map((t) => [t, []]));
  const status: Value[][] = [];
  let next = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const job = jobs[next++];
      if (job === undefined) return;
      const at = o.now();
      const control = new AbortController();
      const timer = setTimeout(() => control.abort(), o.timeoutMs ?? 15_000);
      let answer: Result<readonly Readonly<Record<string, string>>[], string>;
      try {
        answer = await o.fetch(job.asset, job.select, control.signal);
      } catch (e) {
        answer = err(e instanceof Error ? e.message : String(e));
      } finally {
        clearTimeout(timer);
      }
      if (answer.kind === "err") {
        status.push([job.asset, job.table, false, 0, control.signal.aborted ? `it did not answer within ${o.timeoutMs ?? 15_000} ms` : answer.error, at]);
        continue;
      }
      const columns = osqueryRelation(job.table)?.columns.slice(2) ?? [];
      const target = rowsOf.get(job.table);
      for (const row of answer.value) target?.push([job.asset, at, ...columns.map((c) => typed(c.type, row[c.name]))]);
      status.push([job.asset, job.table, true, answer.value.length, "", at]);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(o.concurrency ?? 4, jobs.length || 1)) }, () => worker()));
  const tables = Object.fromEntries(o.tables.map((t) => [`osquery_${t}`, { columns: (osqueryRelation(t)?.columns ?? []).map((c) => c.name), rows: rowsOf.get(t) ?? [] } as Table]));
  status.sort((a, b) => `${String(a[1])}/${String(a[0])}`.localeCompare(`${String(b[1])}/${String(b[0])}`));
  return ok({ tables, status: { columns: ["asset", "tbl", "answered", "row_count", "message", "at"], rows: status } });
}
