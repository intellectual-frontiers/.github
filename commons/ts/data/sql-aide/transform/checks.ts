/**
 * The tests of transforms: that columns are unique together, not null, one of the values accepted, or point at rows of another relation,
 * or a query of one's own that gives the rows that are wrong. Each is SQL that records what it finds in a table, by run, and the findings
 * are reported as TAP (commons 0009-sql-aide FR-044, FR-031).
 *
 * @module
 */
import { absurd } from "../../../kernel/mod.ts";
import { integer, text, timestamptz } from "../algebra/column.ts";
import type { SqlValue } from "../algebra/domain.ts";
import { type RowOf, table } from "../algebra/table.ts";
import type { EmitContext } from "../emit/context.ts";
import { now } from "../emit/expr.ts";
import { type AnySql, bind, type Chunk, chunkOf, chunkText, join, sql, type Sql, SQL } from "../emit/sql.ts";
import type { EntityName } from "../model/entity.ts";
import type { Runner } from "../test/assert.ts";
import { failed, pass, type TapNode } from "../test/tap.ts";

/** A relation a test reads: a table, a view or a model. */
export type Tested = Sql<"relation", unknown, string, string> & EntityName;

/** A test of a transform, as data. */
export type Check =
  | { readonly kind: "unique"; readonly name: string; readonly relation: Tested; readonly columns: readonly string[] }
  | { readonly kind: "not-null"; readonly name: string; readonly relation: Tested; readonly column: string }
  | {
      readonly kind: "accepted-values";
      readonly name: string;
      readonly relation: Tested;
      readonly column: string;
      readonly values: readonly SqlValue[];
    }
  | {
      readonly kind: "relationship";
      readonly name: string;
      readonly relation: Tested;
      readonly column: string;
      readonly to: Tested;
      readonly toColumn: string;
    }
  | { readonly kind: "custom"; readonly name: string; readonly relation: Tested | undefined; readonly failing: AnySql };

type Col<R> = keyof RowOf<R> & string;

/** The columns are unique together: no two rows have the same values of them. */
export const unique = <R extends Tested>(relation: R, columns: readonly Col<R>[], name?: string): Check => ({
  kind: "unique",
  name: name ?? `${relation.name} (${columns.join(", ")}) is unique`,
  relation,
  columns,
});

/** The column is never null. */
export const notNull = <R extends Tested>(relation: R, column: Col<R>, name?: string): Check => ({
  kind: "not-null",
  name: name ?? `${relation.name}.${column} is not null`,
  relation,
  column,
});

/** The column holds only the values accepted, or null. */
export const acceptedValues = <R extends Tested, K extends Col<R>>(
  relation: R,
  column: K,
  values: readonly Extract<NonNullable<RowOf<R>[K]>, SqlValue>[],
  name?: string,
): Check => ({
  kind: "accepted-values",
  name: name ?? `${relation.name}.${column} is one of ${values.join(", ")}`,
  relation,
  column,
  values,
});

/** The column points at a row of another relation: each value that is not null is a value of the other's column, of the same type. */
export const relationship = <R extends Tested, K extends Col<R>, To extends Tested>(
  relation: R,
  column: K,
  to: To,
  toColumn: { [K2 in Col<To>]: NonNullable<RowOf<R>[K]> extends RowOf<To>[K2] ? K2 : never }[Col<To>],
  name?: string,
): Check => ({
  kind: "relationship",
  name: name ?? `${relation.name}.${column} is a ${to.name}.${toColumn}`,
  relation,
  column,
  to,
  toColumn,
});

/** A test of one's own: a query that gives the rows that are wrong; none is a pass. */
export const custom = (name: string, failing: AnySql, relation?: Tested): Check => ({ kind: "custom", name, relation, failing });

const col = (ctx: EmitContext, r: EntityName, c: string): Chunk => ({
  kind: "name",
  parts: [...ctx.naming.table(r.name, r.schema), ctx.naming.column(c)],
});
const bare = (ctx: EmitContext, c: string): Chunk => ({ kind: "name", parts: [ctx.naming.column(c)] });

/** The query that gives the rows a test finds wrong. */
export function failingRows(check: Check): AnySql {
  return sql("statement", (ctx) => {
    switch (check.kind) {
      case "unique": {
        const cols = check.columns.flatMap((c, i): Chunk[] => [...(i === 0 ? [] : [chunkText(", ")]), bare(ctx, c)]);
        return [
          chunkText("SELECT "),
          ...cols,
          chunkText(" FROM "),
          chunkOf(check.relation),
          chunkText(" GROUP BY "),
          ...cols,
          chunkText(" HAVING count(*) > 1"),
        ];
      }
      case "not-null":
        return [
          chunkText("SELECT "),
          bare(ctx, check.column),
          chunkText(" FROM "),
          chunkOf(check.relation),
          chunkText(" WHERE "),
          bare(ctx, check.column),
          chunkText(" IS NULL"),
        ];
      case "accepted-values":
        return [
          chunkText("SELECT "),
          bare(ctx, check.column),
          chunkText(" FROM "),
          chunkOf(check.relation),
          chunkText(" WHERE "),
          bare(ctx, check.column),
          chunkText(" IS NOT NULL AND "),
          bare(ctx, check.column),
          chunkText(" NOT IN ("),
          chunkOf(join(check.values.map((v) => bind(v)))),
          chunkText(")"),
        ];
      case "relationship":
        return [
          chunkText("SELECT "),
          col(ctx, check.relation, check.column),
          chunkText(" FROM "),
          chunkOf(check.relation),
          chunkText(" WHERE "),
          col(ctx, check.relation, check.column),
          chunkText(" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "),
          chunkOf(check.to),
          chunkText(" WHERE "),
          col(ctx, check.to, check.toColumn),
          chunkText(" = "),
          col(ctx, check.relation, check.column),
          chunkText(")"),
        ];
      case "custom":
        return [chunkOf(check.failing)];
      default:
        return absurd(check);
    }
  });
}

/** Where the tests of transforms record what they find: one row for each test of a run. */
export const findingsTable = table(
  "ifcsql_findings",
  {
    run_id: text().doc("The run the test was part of"),
    test: text().doc("The test's name"),
    relation: text().nullable().doc("The relation it tested"),
    failures: integer().doc("How many rows it found wrong"),
    recorded_at: timestamptz().default(now).doc("When it was recorded"),
  },
  { primaryKey: ["run_id", "test"], owner: "ifc-sql-aide", doc: "What the tests of transforms found, by run" },
);

/**
 * The SQL that runs tests and records what each finds, as a row of {@link findingsTable} for the run.
 *
 * @param checks - the tests
 * @param runId - the run's name
 */
export function recordFindings(checks: readonly Check[], runId: string): Sql<"fragment"> {
  const lines = checks.map(
    (c) =>
      SQL`INSERT INTO ${findingsTable} ("run_id", "test", "relation", "failures") SELECT ${bind(runId)}, ${bind(c.name)}, ${bind(c.relation?.name ?? null)}, count(*) FROM (${failingRows(c)}) AS f;`,
  );
  return sql("fragment", () => lines.flatMap((l, i): Chunk[] => [...(i === 0 ? [] : [chunkText("\n")]), chunkOf(l)]));
}

/**
 * Reads what a run recorded and reports it as TAP nodes, one for each test in the order given: a pass where it found no wrong row, a
 * failure that says how many it found otherwise, and a failure where the run recorded nothing of the test.
 *
 * @param checks - the tests
 * @param runId - the run's name
 * @param runner - what reads the database
 * @param ctx - the context of its dialect
 */
export async function reportFindings(
  checks: readonly Check[],
  runId: string,
  runner: Runner,
  ctx: EmitContext,
): Promise<readonly TapNode[]> {
  const t = ctx.naming
    .table(findingsTable.name, undefined)
    .map((p) => ctx.dialect.quoteName(p))
    .join(".");
  const rows = await runner.query(`SELECT "test", "failures" FROM ${t} WHERE "run_id" = ${ctx.dialect.literal(runId)}`);
  const found = new Map(rows.map((r) => [String(r["test"]), Number(r["failures"])]));
  return checks.map((c) => {
    const n = found.get(c.name);
    if (n === undefined) return failed(c.name, { found: "the run recorded nothing of this test" });
    return n === 0 ? pass(c.name) : failed(c.name, { failures: n });
  });
}
