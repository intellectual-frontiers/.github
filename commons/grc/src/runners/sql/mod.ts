// Spec: 0005-grc-runners FR-004
/**
 * The `sql` runner (0005-grc-runners FR-004): the input is `{ query, params? }` and the value is the rows. It runs the query on a connection the host gives, of the shape
 * `{ readOnly, query(text, params) }`; the drivers of `data` (and the osquery driver that is coming) satisfy it by shape, and this unit imports no database library. It refuses a connection
 * that is not read-only, a query of more than one statement, and a query that is not a `SELECT`, `WITH`, `VALUES` or `PRAGMA` that reads.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type Check, type Json, objectOf } from "@intellectual-frontiers/grc/governance";
import type { Observation, RunContext, Runner, RunnerProblem } from "@intellectual-frontiers/grc/physical";

/** What the host gives: a connection that answers queries and says it only reads. */
export type SqlConnection = {
  readonly readOnly: boolean;
  query(text: string, params: readonly Json[]): Promise<readonly Json[]>;
};

const WRITES = /\b(insert|update|delete|drop|alter|create|truncate|attach|detach|replace|grant|revoke|vacuum|reindex)\b/i;

/** The query with strings and comments blanked, so that what is left is the statement's own words. */
function bare(text: string): string {
  return text
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/"(?:[^"]|"")*"/g, '""');
}

/** Why a query is not a single read, or `undefined` where it is one. */
export function refusal(query: string): string | undefined {
  const b = bare(query).trim().replace(/;\s*$/, "");
  if (b === "") return "the query is empty";
  if (b.includes(";")) return "the query has more than one statement";
  const first = /^[A-Za-z]+/.exec(b)?.[0]?.toLowerCase();
  if (first === undefined || !["select", "with", "values", "pragma"].includes(first)) return "the query is not a SELECT, WITH, VALUES or PRAGMA";
  if (first === "pragma" && b.includes("=")) return "a PRAGMA that sets is not a read";
  if (WRITES.test(b)) return "the query has a word of a write";
  return undefined;
}

function inputOf(check: Check): Result<{ readonly query: string; readonly params: readonly Json[] }, RunnerProblem> {
  const i = objectOf(check.runner.input);
  if (i === undefined || typeof i["query"] !== "string") return err({ kind: "refused", message: "the input of an sql check is { query, params? }" });
  const params = i["params"];
  return ok({ query: i["query"], params: Array.isArray(params) ? params : [] });
}

/** The `sql` runner over a connection. */
export function sqlRunner(connection: SqlConnection): Runner {
  return {
    id: "sql",
    async run(check: Check, ctx: RunContext): Promise<Result<Observation, RunnerProblem>> {
      if (!connection.readOnly) return err({ kind: "refused", message: "the connection is not read-only" });
      const input = inputOf(check);
      if (input.kind === "err") return input;
      const why = refusal(input.value.query);
      if (why !== undefined) return err({ kind: "refused", message: why });
      const t0 = Date.now();
      const rows = await connection.query(input.value.query, input.value.params);
      return ok({ value: [...rows], observedAt: ctx.now(), via: "sql", tookMs: Date.now() - t0 });
    },
  };
}
