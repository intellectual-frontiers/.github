// Spec: 0004-estate-query-checks FR-001, FR-002, FR-003
/**
 * Policy as SQL: a check of the `grc` library whose question is a query over the estate (a check passes where its query gives no row, or whatever else it expects of the rows), run by the `sql` runner of `grc` over the estate as its connection. The connection only reads and says so, and the query is judged by the guard before it runs. A check
 * is a document of `grc` like every other, so its result is a result of `grc`, with the controls the check answers to.
 *
 * @example
 * ```ts
 * import { estateConnection } from "./checks.ts";
 * // const rows = await estateConnection(openEstateQuery(data)).query("select id from asset where state = 'managed'", []);
 * ```
 *
 * @module
 */
import { check as checkKind, type Check, type Json } from "@intellectual-frontiers/grc/governance";
import type { Result as Outcome } from "@intellectual-frontiers/grc/logical";
import { createRunners, runCheck, type Runners } from "@intellectual-frontiers/grc/physical";
import { sqlRunner, type SqlConnection } from "@intellectual-frontiers/grc/runners/sql";
import { astsql } from "@intellectual-frontiers/lang-sql/aide/relational";
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { EstateQuery } from "@intellectual-frontiers/estate-query/logical";

/** The estate as a connection that only reads: a row is an object of its columns. A question the estate refuses or fails to answer is a failure of the check, with the reason. */
export function estateConnection(q: EstateQuery): SqlConnection {
  return {
    readOnly: true,
    dialect: astsql,
    query: async (text, params) => {
      const r = q.query(text, params as never);
      if (r.kind === "err") throw new Error(r.error.kind === "refused" ? r.error.reasons.join("; ") : r.error.message);
      return r.value.rows.map((row) => Object.fromEntries(r.value.columns.map((c, i) => [c, row[i] ?? null])) as Json);
    },
  };
}

/** The runners a check over the estate needs: the `sql` runner over the estate. */
export function estateRunners(q: EstateQuery): Runners {
  const runners = createRunners();
  runners.register(sqlRunner(estateConnection(q)));
  return runners;
}

/** What a person writes of a check over the estate. */
export type SavedCheck = {
  /** The identity of the check. */
  readonly id: string;
  /** The question in words. */
  readonly ask: string;
  /** The statement: one read of the estate. */
  readonly sql: string;
  /** Values for `?`, in order. */
  readonly params?: readonly Json[];
  /** What is expected of the rows: none of them (`empty`, the default), some (`non-empty`), a count or a condition on every row. */
  readonly expect?: Json;
  /** The URNs of the controls it answers to. */
  readonly controls?: readonly string[];
  /** How long a result stays good (ISO 8601 duration; one day where none is said). */
  readonly freshness?: string;
};

/** A check of `grc` from what a person wrote, or the reason it is not one. */
export function checkOf(c: SavedCheck, now: string): Result<Check, string> {
  const made = checkKind.decode({
    kind: "grc.check",
    schema: "1",
    id: c.id,
    createdAt: now,
    provenance: { producer: { name: "estate-query", version: "1" }, inputs: [] },
    ask: c.ask,
    expect: c.expect ?? { kind: "empty" },
    platforms: ["any"],
    freshness: c.freshness ?? "P1D",
    controls: [...(c.controls ?? [])],
    runner: { kind: "sql", input: { query: c.sql, params: [...(c.params ?? [])] } },
  });
  return made.kind === "err" ? err(`the check ${c.id} is not valid: ${made.error.path}: expected ${made.error.expected}`) : ok(made.value);
}

/** The result of each check run over the estate at an instant: a check that cannot run is an `error` result with the reason, and never stops the others. */
export async function runEstateChecks(checks: readonly Check[], q: EstateQuery, now: () => string, timeoutMs = 30_000): Promise<readonly Outcome[]> {
  const runners = estateRunners(q);
  const out: Outcome[] = [];
  for (const check of checks) out.push(await runCheck(runners, check, { subject: { id: "estate", platform: "any" }, now, timeoutMs }));
  return out;
}
