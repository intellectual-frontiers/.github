// Spec: 0011-sql-lifecycle FR-011
/**
 * Running a plan (commons data 0011-sql-lifecycle FR-011): the steps are applied to a driver, a way to run statements and read rows, each in a transaction with its ledger entry, so that a step
 * that fails leaves the database and the ledger as they were. A database is found among the states of the plan by the ledger, and one that is in none of them is refused: a plan only runs on the
 * database it was made for. Run again, it does nothing.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/commons/ts/kernel";
import type { Dialect } from "@intellectual-frontiers/data/sql/physical";
import { type LedgerEntry, nextEntry, verifyChain, type ChainBreak } from "./ledger.ts";
import { type RunPlan, type Repeatable, type StepStatement, type Verification, dueRepeatables } from "./plan.ts";

/** A way to run statements on a database and read rows back. */
export interface Driver {
  exec(sql: string): Promise<void>;
  query(sql: string): Promise<readonly Record<string, unknown>[]>;
}

/**
 * Runs one statement of a step, unless its guard says its work is done.
 *
 * @param driver - the database
 * @param statement - the statement
 * @returns whether it was run
 */
export async function applyStatement(driver: Driver, statement: StepStatement): Promise<boolean> {
  if (statement.guard !== undefined) {
    const rows = await driver.query(statement.guard.query);
    if (rows.length > 0 === (statement.guard.skipWhen === "rows")) return false;
  }
  await driver.exec(statement.sql);
  return true;
}

/** What a run is given besides the plan. */
export interface RunOptions {
  /** The ledger's table; `lifecycle_ledger` by default. */
  readonly ledgerTable?: string;
  /** Who applies, written in the ledger. */
  readonly by?: string;
  /** The moment, as text; the clock by default. */
  readonly now?: () => string;
  /** Statements run at the start of each transaction, such as a setting that says a migration is running (0014-sql-protected-access FR-009). */
  readonly before?: readonly string[];
  /** Try a step again when its error is of a kind the project names, such as a lock timeout (0015-sql-safety FR-002). */
  readonly retry?: {
    readonly attempts: number;
    readonly delayMs: number;
    readonly when: (message: string) => boolean;
    /** Waits; the clock by default. */
    readonly sleep?: (ms: number) => Promise<void>;
  };
  /** The hash of the empty state, for a database that has no ledger yet. */
  readonly empty: string;
}

/** What is wrong with a run. */
export type RunError =
  | { readonly kind: "ledger"; readonly broken: ChainBreak }
  | { readonly kind: "base"; readonly found: string; readonly expected: readonly string[] }
  | { readonly kind: "step"; readonly key: string; readonly name: string; readonly message: string };

/** What a run did. */
export interface Applied {
  readonly steps: readonly string[];
  readonly repeatable: readonly string[];
  readonly ledger: readonly LedgerEntry[];
}

const LEDGER = "lifecycle_ledger";

const firstValue = (rows: readonly Record<string, unknown>[]): unknown => Object.values(rows[0] ?? {})[0];
const sameValue = (a: unknown, b: unknown): boolean => String(a) === String(b);

/** The statement that makes the ledger's table where there is none. */
export function ledgerDdl(dialect: Dialect, table = LEDGER): string {
  const q = dialect.quote;
  const text = dialect.type({ kind: "text" });
  const int = dialect.type({ kind: "integer" });
  return `CREATE TABLE IF NOT EXISTS ${q(table)} (${[
    `${q("seq")} ${int} NOT NULL PRIMARY KEY`,
    ...["kind", "key", "name", "from_state", "to_state", "hash", "chain", "applied_at", "applied_by"].map(
      (c) => `${q(c)} ${text} NOT NULL`,
    ),
  ].join(", ")});`;
}

const insert = (dialect: Dialect, table: string, e: LedgerEntry): string =>
  `INSERT INTO ${dialect.quote(table)} (${["seq", "kind", "key", "name", "from_state", "to_state", "hash", "chain", "applied_at", "applied_by"].map(dialect.quote).join(", ")}) VALUES (${[
    e.seq,
    e.kind,
    e.key,
    e.name,
    e.from,
    e.to,
    e.hash,
    e.chain,
    e.appliedAt,
    e.appliedBy,
  ]
    .map((v) => dialect.literal(v))
    .join(", ")});`;

/**
 * Reads the ledger of a database.
 *
 * @param driver - the database
 * @param dialect - its dialect
 * @param table - the ledger's table
 * @returns the entries, in order
 */
export async function readLedger(driver: Driver, dialect: Dialect, table = LEDGER): Promise<readonly LedgerEntry[]> {
  const rows = await driver.query(`SELECT * FROM ${dialect.quote(table)} ORDER BY ${dialect.quote("seq")}`);
  return rows.map((r): LedgerEntry => ({
    seq: Number(r["seq"]),
    kind: String(r["kind"]) as LedgerEntry["kind"],
    key: String(r["key"]),
    name: String(r["name"]),
    from: String(r["from_state"]),
    to: String(r["to_state"]),
    hash: String(r["hash"]),
    chain: String(r["chain"]),
    appliedAt: String(r["applied_at"]),
    appliedBy: String(r["applied_by"]),
  }));
}

/**
 * Applies a plan to a database.
 *
 * @param plan - the plan
 * @param driver - the database
 * @param dialect - its dialect
 * @param options - the ledger's table, who applies, the clock and the hash of the empty state
 * @returns what was applied, or why it was not
 */
export async function execute(
  plan: RunPlan,
  driver: Driver,
  dialect: Dialect,
  options: RunOptions,
): Promise<Result<Applied, readonly RunError[]>> {
  const table = options.ledgerTable ?? LEDGER;
  const by = options.by ?? "lifecycle";
  const now = options.now ?? ((): string => new Date().toISOString());
  await driver.exec(ledgerDdl(dialect, table));
  let ledger = await readLedger(driver, dialect, table);
  const broken = verifyChain(ledger);
  if (broken !== undefined) return err([{ kind: "ledger", broken }]);

  // where the database is among the states of the plan
  const current = [...ledger].reverse().find((e) => e.kind === "step")?.to ?? options.empty;
  const states = [plan.from, ...plan.steps.map((s) => s.to)];
  // a step the ledger holds is done, whatever states it moved between; else the database is found by its state
  const done = new Set(ledger.filter((e) => e.kind === "step").map((e) => e.hash));
  let finished = -1;
  plan.steps.forEach((s, i) => {
    if (done.has(s.id)) finished = i;
  });
  const at = finished >= 0 ? finished + 1 : states.indexOf(current);
  if (at < 0 && !(plan.steps.length === 0 && current === plan.to)) return err([{ kind: "base", found: current, expected: states }]);
  const todo = plan.steps.slice(Math.max(at, 0));
  const applied: string[] = [];
  const run = async (
    statements: readonly StepStatement[],
    entry: Omit<LedgerEntry, "seq" | "chain" | "appliedAt" | "appliedBy">,
    verify?: Verification,
  ): Promise<RunError | undefined> => {
    try {
      await driver.exec("BEGIN");
      for (const sql of options.before ?? []) await driver.exec(sql);
      const captured = new Map<string, unknown>();
      for (const c of verify?.before ?? []) captured.set(c.key, firstValue(await driver.query(c.query)));
      for (const st of statements) await applyStatement(driver, st);
      for (const check of verify?.after ?? []) {
        const rows = await driver.query(check.query);
        const ok =
          check.expect === "rows"
            ? rows.length > 0
            : check.expect === "none"
              ? rows.length === 0
              : sameValue(firstValue(rows), captured.get(check.expect.sameAs));
        if (!ok) throw new Error(`verification failed: ${check.describe}`);
      }
      const e = nextEntry(ledger, { ...entry, appliedAt: now(), appliedBy: by });
      await driver.exec(insert(dialect, table, e));
      await driver.exec("COMMIT");
      ledger = [...ledger, e];
      return undefined;
    } catch (cause) {
      try {
        await driver.exec("ROLLBACK");
      } catch {
        // the engine has already ended the transaction
      }
      return { kind: "step", key: entry.key, name: entry.name, message: cause instanceof Error ? cause.message : String(cause) };
    }
  };
  // the setup comes before the steps (a schema, an extension the types need); what extensions add comes after
  const last = new Map<string, string>();
  for (const e of ledger) if (e.kind === "repeatable") last.set(e.key, e.hash);
  const touched = new Set<string>(todo.flatMap((s) => s.of));
  const due: readonly Repeatable[] = dueRepeatables(plan.repeatable, last, touched);
  const repeated: string[] = [];
  const runRepeatable = async (r: Repeatable): Promise<RunError | undefined> => {
    const failed = await run(r.statements, { kind: "repeatable", key: r.key, name: r.key, from: "", to: "", hash: r.hash });
    if (failed === undefined) repeated.push(r.key);
    return failed;
  };
  for (const r of due.filter((x) => x.statements.every((s) => s.group === "setup"))) {
    const failed = await runRepeatable(r);
    if (failed !== undefined) return err([failed]);
  }
  for (const s of todo) {
    let failed = await run(s.up, { kind: "step", key: s.id, name: s.name, from: s.from, to: s.to, hash: s.id }, s.verify);
    // a step that failed in a way the project names is tried again
    for (
      let tried = 1;
      failed !== undefined &&
      options.retry !== undefined &&
      tried < options.retry.attempts &&
      options.retry.when(failed.kind === "step" ? failed.message : "");
      tried++
    ) {
      await (options.retry.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms))))(options.retry.delayMs * tried);
      failed = await run(s.up, { kind: "step", key: s.id, name: s.name, from: s.from, to: s.to, hash: s.id }, s.verify);
    }
    if (failed !== undefined) return err([failed]);
    applied.push(s.name);
  }
  for (const r of due.filter((x) => !x.statements.every((s) => s.group === "setup"))) {
    const failed = await runRepeatable(r);
    if (failed !== undefined) return err([failed]);
  }
  return ok({ steps: applied, repeatable: repeated, ledger });
}
