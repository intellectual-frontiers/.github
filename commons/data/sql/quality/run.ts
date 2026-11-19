// Spec: 0052-sql-quality FR-006, FR-007, FR-008
/**
 * Running data tests (commons data 0052-sql-quality): each test is one query that counts the rows that are wrong (or the number `failCalc` gives), the count is judged by the thresholds, the failures are
 * stored where the test asks for it, and the results are a sum that is told as TAP. A test that cannot run (the SQL is wrong, a table is missing) is an `error`, not a pass.
 *
 * @module
 */
import { failed, pass, skipped, type TapNode } from "@intellectual-frontiers/data/sql/extensions/assertions";
import type { Driver } from "@intellectual-frontiers/data/sql/lifecycle";
import type { Dialect } from "@intellectual-frontiers/data/sql/physical";
import { qualified } from "@intellectual-frontiers/data/sql/physical";
import { type DqTest, judge, type Status } from "./test.ts";

/** What a run found of one test. */
export interface Outcome {
  readonly test: DqTest;
  readonly status: Status;
  /** What `failCalc` gave (the number of failing rows where it is not said); none where the test did not run. */
  readonly failures?: number;
  /** Where the failing rows were stored. */
  readonly stored?: string;
  readonly message?: string;
}

/** The query that gives the number of a test, for a dialect. */
export function countQuery(test: DqTest, d: Dialect): string {
  const failing = test.failing(d);
  const limited = test.config.limit === undefined ? failing : `SELECT * FROM (${failing}) AS dq_all LIMIT ${Math.max(0, Math.trunc(test.config.limit))}`;
  return `SELECT ${test.config.failCalc ?? "count(*)"} AS failures FROM (${limited}) AS dq_test`;
}

/** Where a test's failures are stored. */
export const storedAs = (test: DqTest, d: Dialect): string => qualified(d, test.config.schema, test.config.alias ?? test.name);

/** Runs the tests, one after another, and tells what each found. A disabled test is `skipped` and is not run. */
export async function runTests(tests: readonly DqTest[], driver: Driver, d: Dialect): Promise<readonly Outcome[]> {
  const out: Outcome[] = [];
  for (const test of tests) {
    if (test.config.enabled === false) {
      out.push({ test, status: "skipped", message: "disabled" });
      continue;
    }
    try {
      const rows = await driver.query(countQuery(test, d));
      const n = Number(rows[0]?.["failures"] ?? 0);
      if (!Number.isFinite(n)) throw new Error(`the count is ${String(rows[0]?.["failures"])}, which is not a number`);
      const status = judge(n, test.config);
      let stored: string | undefined;
      if (test.config.storeFailures === true && n !== 0) {
        stored = storedAs(test, d);
        const kind = test.config.storeFailuresAs ?? "table";
        // what was stored before, whichever of a table and a view it was
        for (const what of ["VIEW", "TABLE"]) await driver.exec(`DROP ${what} IF EXISTS ${stored}`).catch(() => undefined);
        const failing = test.failing(d);
        await driver.exec(`CREATE ${kind === "table" ? "TABLE" : "VIEW"} ${stored} AS ${test.config.limit === undefined ? failing : `SELECT * FROM (${failing}) AS dq_all LIMIT ${Math.max(0, Math.trunc(test.config.limit))}`}`);
      }
      out.push({ test, status, failures: n, ...(stored === undefined ? {} : { stored }) });
    } catch (thrown) {
      out.push({ test, status: "error", message: thrown instanceof Error ? thrown.message : String(thrown) });
    }
  }
  return out;
}

/** The counts of a run, and whether it is good: it is where nothing failed and nothing was an error (a warning is not a failure). */
export function summary(outcomes: readonly Outcome[]): { readonly pass: number; readonly warn: number; readonly fail: number; readonly error: number; readonly skipped: number; readonly ok: boolean } {
  const n = (s: Status): number => outcomes.filter((o) => o.status === s).length;
  return { pass: n("pass"), warn: n("warn"), fail: n("fail"), error: n("error"), skipped: n("skipped"), ok: n("fail") === 0 && n("error") === 0 };
}

/** The results as TAP: a pass is a test that is ok; a warning is ok with a `todo` directive that says it; a failure and an error are not ok and carry what was found; a skipped test is skipped. */
export function toTap(outcomes: readonly Outcome[]): readonly TapNode[] {
  return outcomes.map((o): TapNode => {
    const name = o.test.name;
    switch (o.status) {
      case "pass":
        return pass(name);
      case "warn":
        return { kind: "test", ok: true, description: name, directive: { kind: "todo", reason: `warn: ${o.failures} failing` }, diagnostics: { failures: o.failures ?? 0 } };
      case "fail":
        return failed(name, { failures: o.failures ?? 0, ...(o.stored === undefined ? {} : { stored: o.stored }) });
      case "error":
        return failed(name, { error: o.message ?? "" });
      case "skipped":
        return skipped(name, o.message ?? "skipped");
    }
  });
}
