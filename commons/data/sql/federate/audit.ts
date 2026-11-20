// Spec: 0059-sql-federate FR-008
/**
 * Audit of a fan-out (commons data 0059-sql-federate FR-008): optional, and the caller's to place. A fan-out is recorded as a value (who asked what of which targets, and what each answered, without the rows); the caller
 * passes the record to its own sink, or to `auditTable`, which keeps it in a table of a database the caller gives.
 *
 * @module
 */
import { sha256Hex } from "@intellectual-frontiers/data/sql/lifecycle";
import type { Runner } from "@intellectual-frontiers/data/sql/typed";
import type { FanOut } from "./fanout.ts";

/** One line of what a target answered. */
export interface AuditTarget {
  readonly target: string;
  readonly status: "ok" | "error";
  readonly rows: number;
  readonly error?: string;
  readonly durationMs: number;
}

/** The record of a fan-out: no rows, no values. */
export interface AuditRecord {
  readonly runId: string;
  readonly at: string;
  /** Who asked, as the caller says. */
  readonly by: string;
  readonly sql: string;
  readonly targets: readonly AuditTarget[];
  readonly quorum: number;
  readonly quorumMet: boolean;
}

/** Where a record goes: the caller's. */
export type AuditSink = (record: AuditRecord) => void | Promise<void>;

/**
 * The record of a fan-out.
 *
 * @param result - the fan-out
 * @param by - who asked
 */
export function auditOf(result: FanOut, by: string): AuditRecord {
  return {
    runId: sha256Hex(`${result.startedAt}\n${by}\n${result.sql}\n${result.outcomes.map((o) => o.target).join(",")}`).slice(0, 16),
    at: result.startedAt,
    by,
    sql: result.sql,
    quorum: result.quorum,
    quorumMet: result.quorumMet,
    targets: result.outcomes.map((o): AuditTarget => ({ target: o.target, status: o.status, rows: o.status === "ok" ? o.rows.length : 0, durationMs: o.durationMs, ...(o.status === "error" ? { error: o.error.kind } : {}) })),
  };
}

/**
 * A sink that keeps records in the table `fleet_audit` of a database (made if it is not there): one row for each target of each run.
 *
 * @param on - the database and its dialect
 */
export function auditTable(on: Runner): AuditSink {
  const q = (s: string): string => on.dialect.quote(s);
  let made = false;
  return async (r) => {
    if (!made) {
      await on.driver.exec(
        `CREATE TABLE IF NOT EXISTS ${q("fleet_audit")} (${q("run_id")} TEXT NOT NULL, ${q("at")} TEXT NOT NULL, ${q("by")} TEXT NOT NULL, ${q("sql")} TEXT NOT NULL, ${q("target")} TEXT NOT NULL, ${q("status")} TEXT NOT NULL, ${q("rows")} BIGINT NOT NULL, ${q("error")} TEXT, ${q("duration_ms")} BIGINT NOT NULL, ${q("quorum_met")} BOOLEAN NOT NULL)`,
      );
      made = true;
    }
    for (const t of r.targets)
      await on.driver.exec(
        `INSERT INTO ${q("fleet_audit")} VALUES (${[r.runId, r.at, r.by, r.sql, t.target, t.status].map((v) => on.dialect.literal(v)).join(", ")}, ${t.rows}, ${t.error === undefined ? "NULL" : on.dialect.literal(t.error)}, ${t.durationMs}, ${on.dialect.literal(r.quorumMet)})`,
      );
  };
}
