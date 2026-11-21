// Spec: 0005-grc-runners FR-004
/**
 * The `sql` runner (0005-grc-runners FR-004): the input is `{ query, params? }` and the value is the rows. It runs the query on a connection the host gives, of the shape
 * `{ readOnly, query(text, params) }`; the drivers of `data` (and the osquery driver that is coming) satisfy it by shape, and this unit imports no database library. It refuses a connection
 * that is not read-only, and a query that the guard of the SQL language library does not judge to be a single read in the dialect of the connection (more than one statement, a write, a `SELECT ... INTO`, a `PRAGMA` that sets).
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { ansi, type Dialect } from "@intellectual-frontiers/lang-sql";
import { refusal as guardRefusal } from "@intellectual-frontiers/lang-sql/aide/guard";
import { type Check, type Json, objectOf } from "@intellectual-frontiers/grc/governance";
import type { Observation, RunContext, Runner, RunnerProblem } from "@intellectual-frontiers/grc/physical";

/** What the host gives: a connection that answers queries and says it only reads. */
export type SqlConnection = {
  readonly readOnly: boolean;
  /** The dialect of the connection's queries (ANSI where none is given). */
  readonly dialect?: Dialect;
  query(text: string, params: readonly Json[]): Promise<readonly Json[]>;
};

/** Why a query is not a single read in the dialect (ANSI where none is given), or `undefined` where it is one: the tree of the SQL language library is judged, so a word in a string or a comment is not code (a `PRAGMA` that reads is let through). */
export function refusal(query: string, dialect: Dialect = ansi): string | undefined {
  if (query.trim() === "") return "the query is empty";
  return guardRefusal(query, dialect, { allowPragma: true });
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
      const why = refusal(input.value.query, connection.dialect);
      if (why !== undefined) return err({ kind: "refused", message: why });
      const t0 = Date.now();
      const rows = await connection.query(input.value.query, input.value.params);
      return ok({ value: [...rows], observedAt: ctx.now(), via: "sql", tookMs: Date.now() - t0 });
    },
  };
}
