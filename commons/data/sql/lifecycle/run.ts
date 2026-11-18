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
import { type Plan, type Repeatable, type StepStatement, dueRepeatables } from "./plan.ts";

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
  plan: Plan,
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
  const at = states.lastIndexOf(current);
  if (at < 0 && !(plan.steps.length === 0 && current === plan.to)) return err([{ kind: "base", found: current, expected: states }]);
  const todo = plan.steps.slice(Math.max(at, 0));
  const applied: string[] = [];
  const run = async (
    statements: readonly StepStatement[],
    entry: Omit<LedgerEntry, "seq" | "chain" | "appliedAt" | "appliedBy">,
  ): Promise<RunError | undefined> => {
    try {
      await driver.exec("BEGIN");
      for (const st of statements) await applyStatement(driver, st);
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
  for (const s of todo) {
    const failed = await run(s.up, { kind: "step", key: s.id, name: s.name, from: s.from, to: s.to, hash: s.id });
    if (failed !== undefined) return err([failed]);
    applied.push(s.name);
  }
  const last = new Map<string, string>();
  for (const e of ledger) if (e.kind === "repeatable") last.set(e.key, e.hash);
  const due: readonly Repeatable[] = dueRepeatables(plan.repeatable, last);
  const repeated: string[] = [];
  for (const r of due) {
    const failed = await run(r.statements, { kind: "repeatable", key: r.key, name: r.key, from: "", to: "", hash: r.hash });
    if (failed !== undefined) return err([failed]);
    repeated.push(r.key);
  }
  return ok({ steps: applied, repeatable: repeated, ledger });
}
