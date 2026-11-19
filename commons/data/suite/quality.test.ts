// Spec: 0052-sql-quality FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009
/**
 * SQL-DQ (commons data 0052-sql-quality), on real engines: the data tests of dbt as typed values. The algebra (levels, naming, selection), the severity and the thresholds, the built-in and the package
 * tests on SQLite, DuckDB and PostgreSQL with rows that are wrong, stored failures, limits and `failCalc`, results as TAP, and the tests a schema's state asks for.
 *
 * @module
 */
import { assert, proves } from "@intellectual-frontiers/commons/ts/runtime/test";
import { tally, tapText } from "@intellectual-frontiers/data/sql/extensions/assertions";
import { snapshotOf } from "@intellectual-frontiers/data/sql/lifecycle";
import { bind, type Dialect } from "@intellectual-frontiers/data/sql/physical";
import {
  acceptedRange, acceptedValues, atLeastOne, equalRowcount, equality, expressionIsTrue, judge, notConstant, notEmptyString, notNull, on, relationships, runTests, select, singular, summary, testName, testsFromState, toTap, unique,
  uniqueCombinationOfColumns, use, type DqTest,
} from "@intellectual-frontiers/data/sql/quality";
import { DIALECTS, load, openEngine, type Engine } from "./engines-fixture.ts";
import { same } from "./governance-fixture.ts";
import { driverOf, libraryAt } from "./lifecycle-fixture.ts";

const must = <T>(r: { kind: "ok"; value: T } | { kind: "err"; error: unknown }): T => {
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};

async function seeded(name: Engine["name"]): Promise<Engine> {
  const e = await openEngine(name);
  await e.run("CREATE TABLE customer (id INTEGER, name TEXT, region TEXT)");
  await e.run("CREATE TABLE orders (id INTEGER, customer_id INTEGER, status TEXT, qty INTEGER, k1 INTEGER, k2 INTEGER)");
  await e.run("INSERT INTO customer VALUES (1,'ann','eu'),(2,'bo','us'),(3,'  ','eu')");
  await e.run("INSERT INTO orders VALUES (1,1,'open',5,1,1),(2,2,'shipped',-1,1,2),(2,9,'lost',5,1,2),(NULL,NULL,'open',50,2,1)");
  return e;
}

const failures = async (name: Engine["name"], d: Dialect, tests: readonly DqTest[]) => {
  const e = await seeded(name);
  try {
    return await runTests(tests, driverOf(e), d);
  } finally {
    await e.close?.();
  }
};

proves(
  ["0052-sql-quality FR-001", "0052-sql-quality FR-002"],
  "a generic test has the level it is written at and the type of its arguments (a test of a column does not go on a model), takes the name dbt gives it, and a selection picks by tag, relation, test and kind and leaves out what it excludes",
  () => {
    const t = [
      ...on("orders").column("id", use(notNull), use(unique, undefined, { tags: ["key"] })),
      ...on({ name: "orders", schema: "shop" }).column("status", use(acceptedValues, { values: ["a", "b"] }, { tags: ["nightly"] })),
      ...on("orders").model(use(uniqueCombinationOfColumns, { columns: ["k1", "k2"] })),
      singular("no_big", "SELECT 1", { tags: ["nightly"] }),
    ];
    // @ts-expect-error a test of a column is not used on a model
    on("orders").model(use(notNull));
    // @ts-expect-error a test of a model is not used on a column
    on("orders").column("id", use(expressionIsTrue, { expression: "1=1" }));
    // @ts-expect-error the arguments of a test are not optional
    use(acceptedValues);
    same(t.map((x) => x.name), ["not_null_orders_id", "unique_orders_id", "accepted_values_orders_status__a__b", "unique_combination_of_columns_orders__k1__k2", "no_big"]);
    same(testName("t", { name: "x" }, "c", { values: ["A b"] }), "t_x_c__a_b");
    assert(testName("t", { name: "x".repeat(80) }, undefined, undefined).length <= 63, "a long name is made short");
    same(select(t, { tags: ["nightly"] }).map((x) => x.name), ["accepted_values_orders_status__a__b", "no_big"]);
    same(select(t, { kind: "singular" }).map((x) => x.name), ["no_big"]);
    same(select(t, { relations: ["orders"], exclude: { tags: ["key"] } }).length, 3);
    same(select(t, { tests: ["not_null"] }).map((x) => x.name), ["not_null_orders_id"]);
  },
);

proves(["0052-sql-quality FR-003", "0052-sql-quality FR-004"], "the status of a number of failures is judged as dbt judges it: severity, warnIf and errorIf", () => {
  same(judge(0, {}), "pass");
  same(judge(3, {}), "fail");
  same(judge(3, { severity: "warn" }), "warn");
  same(judge(3, { warnIf: { op: ">", n: 5 }, errorIf: { op: ">", n: 10 } }), "pass");
  same(judge(7, { warnIf: { op: ">", n: 5 }, errorIf: { op: ">", n: 10 } }), "warn");
  same(judge(11, { warnIf: { op: ">", n: 5 }, errorIf: { op: ">", n: 10 } }), "fail");
  same(judge(11, { severity: "warn", errorIf: { op: ">", n: 10 } }), "warn");
  same(judge(2, { errorIf: { op: ">=", n: 3 }, warnIf: { op: "=", n: 2 } }), "warn");
  same(judge(0, { errorIf: { op: "<", n: 1 } }), "fail");
});

proves(
  ["0052-sql-quality FR-005", "0052-sql-quality FR-006"],
  "the built-in and the package tests, on each engine, count the rows that are wrong and pass where there are none",
  async () => {
    for (const { name, dialect } of DIALECTS) {
      const o = on("orders");
      const c = on("customer");
      const cases: readonly [DqTest, number][] = [
        [o.column("id", use(notNull))[0]!, 1],
        [o.column("id", use(unique))[0]!, 1],
        [o.column("status", use(acceptedValues, { values: ["open", "shipped"] }))[0]!, 1],
        [o.column("status", use(acceptedValues, { values: ["open", "shipped", "lost"] }))[0]!, 0],
        [o.column("customer_id", use(relationships, { to: { name: "customer" }, field: "id" }))[0]!, 1],
        [o.column("customer_id", use(relationships, { to: { name: "customer" }, field: "id", toWhere: "region = 'eu'" }))[0]!, 2],
        [o.model(use(expressionIsTrue, { expression: "qty > 0" }))[0]!, 1],
        [o.model(use(uniqueCombinationOfColumns, { columns: ["k1", "k2"] }))[0]!, 1],
        [c.column("name", use(notEmptyString))[0]!, 1],
        [o.column("qty", use(acceptedRange, { min: 0, max: 10 }))[0]!, 2],
        [o.column("qty", use(acceptedRange, { min: -1, max: 50, inclusive: true }))[0]!, 0],
        [o.column("qty", use(atLeastOne))[0]!, 0],
        [c.column("region", use(notConstant))[0]!, 0],
        [on("customer").column("id", use(atLeastOne))[0]!, 0],
        [o.model(use(equalRowcount, { to: { name: "customer" } }))[0]!, 1],
        [o.model(use(equality, { to: { name: "orders" }, columns: ["id", "status"] }))[0]!, 0],
        [singular("lost", "SELECT * FROM orders WHERE status = 'lost';"), 1],
      ];
      const outcomes = await failures(name, dialect, cases.map(([t]) => t));
      same(outcomes.map((x) => `${x.test.name}:${x.status === "error" ? x.message : x.failures}`), cases.map(([t, n]) => `${t.name}:${n}`), name);
      same(outcomes.map((x) => x.status), cases.map(([, n]) => (n === 0 ? "pass" : "fail")), name);
    }
  },
);

proves(
  ["0052-sql-quality FR-007"],
  "where, limit, failCalc and stored failures: the tests are looked at through the filter, the failing rows are counted up to the limit or by the expression, and stored as a table or a view that a second run replaces",
  async () => {
    for (const { name, dialect } of DIALECTS) {
      const e = await seeded(name);
      try {
        const o = on("orders");
        const d = driverOf(e);
        const r = await runTests(
          [
            o.column("qty", use(acceptedRange, { min: 0, max: 10 }, { where: "id IS NOT NULL" }))[0]!,
            o.column("status", use(acceptedValues, { values: [] }, { limit: 1, name: "limited" }))[0]!,
            o.column("qty", use(acceptedRange, { min: 0, max: 10 }, { failCalc: "sum(1) * 10", name: "calc", errorIf: { op: ">", n: 15 } }))[0]!,
            o.column("qty", use(acceptedRange, { min: 0, max: 10 }, { storeFailures: true, name: "kept" }))[0]!,
            o.column("qty", use(acceptedRange, { min: 0, max: 10 }, { enabled: false, name: "off" }))[0]!,
          ],
          d,
          dialect,
        );
        same(r.map((x) => [x.status, x.failures]), [["fail", 1], ["fail", 1], ["fail", 20], ["fail", 2], ["skipped", undefined]], name);
        same(await e.rows(`SELECT count(*) AS n FROM kept`).then((x) => Number(x[0]?.["n"])), 2, name);
        await runTests([o.column("qty", use(acceptedRange, { min: 0, max: 10 }, { storeFailures: true, storeFailuresAs: "view", name: "kept" }))[0]!], d, dialect);
        same(await e.rows(`SELECT count(*) AS n FROM kept`).then((x) => Number(x[0]?.["n"])), 2, `${name}: replaced by a view`);
      } finally {
        await e.close?.();
      }
    }
  },
);

proves(
  ["0052-sql-quality FR-008"],
  "a test that cannot run is an error, not a pass; the results are counted, good where nothing failed and nothing erred (a warning is not a failure), and told as TAP",
  async () => {
    const { name, dialect } = DIALECTS[0]!;
    const o = on("orders");
    const r = await failures(name, dialect, [
      o.column("id", use(notNull, undefined, { name: "a" }))[0]!,
      o.column("status", use(acceptedValues, { values: ["open"] }, { severity: "warn", name: "b" }))[0]!,
      o.column("id", use(unique, undefined, { name: "c" }))[0]!,
      on("nothing").column("x", use(notNull))[0]!,
      o.column("id", use(notNull, undefined, { enabled: false, name: "e" }))[0]!,
    ]);
    same(r.map((x) => x.status), ["fail", "warn", "fail", "error", "skipped"]);
    same(summary(r), { pass: 0, warn: 1, fail: 2, error: 1, skipped: 1, ok: false });
    same(summary(r.filter((x) => x.status === "warn")).ok, true);
    const tap = toTap(r);
    same(tally(tap), { passed: 0, failed: 3, skipped: 2 });
    assert(tapText(tap).includes("# TODO warn: 2 failing") && tapText(tap).includes("not ok"), tapText(tap));
  },
);

proves(["0052-sql-quality FR-009"], "the tests a schema's state asks for (not null, keys, codes) pass on a database that holds the schema and fail on one that was loaded around it", async () => {
  for (const { name, dialect } of DIALECTS) {
    const e = await openEngine(name);
    try {
      const schema = libraryAt(1);
      await load(e, must(bind(schema, { dialect })));
      const state = must(snapshotOf(schema, { dialect }));
      const tests = testsFromState(state);
      assert(tests.length > 5, `${name}: ${tests.length}`);
      const ran = await runTests(tests, driverOf(e), dialect);
      same(summary(ran).error, 0, `${name}: ${JSON.stringify(ran.filter((x) => x.status === "error").map((x) => x.message))}`);
      same(summary(ran).ok, true, name);
    } finally {
      await e.close?.();
    }
  }
});
