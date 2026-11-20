/**
 * Transforms: models that are typed queries read by other models, built in the order their queries' references give, in five
 * materializations; their tests as SQL that records findings, reported as TAP; and lineage across integrations and transforms
 * (commons 0009-sql-aide FR-028, FR-031, FR-043, FR-044).
 *
 * @module
 */
import type { Brand, Equal } from "../../../kernel/mod.ts";
import { expectType } from "../../../kernel/mod.ts";
import { assert, assertEquals, assertStringIncludes, assertThrows, proves } from "@intellectual-frontiers/test";
import {
  acceptedValues,
  context,
  custom,
  definitions,
  duckdb,
  eq,
  findingsTable,
  fk,
  from,
  gt,
  integer,
  lineageOf,
  lineageTable,
  model,
  notNull,
  oneOf,
  ordered,
  pk,
  postgres,
  raw,
  recordFindings,
  recordLineage,
  relationship,
  render,
  reportFindings,
  type RowOf,
  seed,
  sqlite,
  table,
  tally,
  tapText,
  text,
  unique,
  upstream,
} from "../../sql-aide/mod.ts";
import { eachEngine, golden, pgliteEngine } from "../helpers.ts";

const pg = context({ dialect: postgres() }),
  lite = context({ dialect: sqlite() }),
  duck = context({ dialect: duckdb() });
const contexts = { postgres: pg, sqlite: lite, duckdb: duck };

const customer = table("customer", { id: pk.text(), name: text(), region: oneOf(["north", "south", "west"]) });
const sale = table("sale", { sale_id: pk.text(), customer_id: fk(customer.c.id), amount: integer() });

/** Each customer's region: written in where it is read. */
const regions = model(
  "regions",
  from(customer).select((s) => ({ id: s.customer.id, region: s.customer.region })),
  { materialized: "ephemeral" },
);
/** Every sale with its customer's name. */
const customerSales = model(
  "customer_sales",
  from(sale)
    .join(customer)
    .select((s) => ({ sale_id: s.sale.sale_id, customer_id: s.customer.id, name: s.customer.name, amount: s.sale.amount })),
);
/** The sales over 100, kept as a table made again on each build. */
const bigSales = model(
  "big_sales",
  from(customerSales)
    .where((s) => gt(s.customer_sales.amount, 100))
    .select((s) => ({ sale_id: s.customer_sales.sale_id, customer_id: s.customer_sales.customer_id, amount: s.customer_sales.amount })),
  { materialized: "table" },
);
/** Every sale with its customer's region, read from a model that is ephemeral. */
const salesByRegion = model(
  "sales_by_region",
  from(customerSales)
    .join(regions, (s) => eq(s.regions.id, s.customer_sales.customer_id))
    .select((s) => ({ sale_id: s.customer_sales.sale_id, region: s.regions.region })),
);
/** A log of sales, to which each build adds those it has not seen. */
const saleLog = model(
  "sale_log",
  from(sale).select((s) => ({ sale_id: s.sale.sale_id, amount: s.sale.amount })),
  { materialized: "incremental", key: ["sale_id"] },
);
/** The total of sales, kept by PostgreSQL. */
const salesTotal = model(
  "sales_total",
  from(sale).select((s) => ({ sale_id: s.sale.sale_id, amount: s.sale.amount })),
  { materialized: "materialized-view" },
);
const portable = [salesByRegion, bigSales, saleLog, customerSales, regions, sale, customer] as const;

proves(
  ["0009-sql-aide FR-043", "0009-sql-aide FR-010"],
  "a model is a typed query another model reads, and builds in the order its references give",
  () => {
    expectType<
      Equal<
        RowOf<typeof bigSales>,
        { readonly sale_id: Brand<string, "sale">; readonly customer_id: Brand<string, "customer">; readonly amount: number }
      >
    >();
    expectType<Equal<RowOf<typeof salesByRegion>["region"], "north" | "south" | "west">>();
    const order = ordered(portable);
    assert(order.kind === "ok");
    const names: readonly string[] = order.value.map((e) => e.name);
    const before = (a: string, b: string): boolean => names.indexOf(a) < names.indexOf(b);
    assert(
      before("customer", "customer_sales") && before("sale", "customer_sales") && before("customer_sales", "big_sales"),
      names.join(", "),
    );
    assert(
      before("regions", "sales_by_region") && before("customer_sales", "sales_by_region") && before("sale", "sale_log"),
      names.join(", "),
    );
    assertEquals(
      bigSales.dependsOn().map((d) => d.name),
      ["customer_sales"],
    );
    // @ts-expect-error SQLite keeps no materialized views
    const liteView = (): unknown => render(salesTotal.ddl, lite);
    const badKey = (): unknown =>
      model(
        "x",
        from(sale).select((s) => ({ id: s.sale.sale_id })),
        {
          materialized: "incremental",
          // @ts-expect-error an incremental model's key is one of its columns
          key: ["amount"],
        },
      );
    assertEquals([typeof liteView, typeof badKey], ["function", "function"]);
    assertThrows(
      () =>
        model(
          "x",
          from(sale).select((s) => ({ id: s.sale.sale_id })),
          { materialized: "incremental" },
        ),
      Error,
      "has no key",
    );
    // an ephemeral model has no definition of its own: it is written in where it is read
    assertStringIncludes(
      render(salesByRegion.ddl, pg),
      `JOIN (SELECT "customer"."id" AS "id", "customer"."region" AS "region" FROM "customer") AS "regions"`,
    );
  },
);

proves(["0009-sql-aide FR-043", "0009-sql-aide FR-015"], "what a build of models renders is what is committed", async () => {
  for (const [dialect, ctx] of Object.entries(contexts)) {
    const text0 = dialect === "postgres" ? render(definitions([...portable, salesTotal]), pg) : render(definitions(portable), ctx);
    await golden(new URL(`./golden/transforms.${dialect}.sql`, import.meta.url), `${text0}\n`);
  }
});

const SEED = [
  `INSERT INTO "customer" ("id", "name", "region") VALUES ('c1', 'Ada', 'north'), ('c2', 'Alan', 'south')`,
  `INSERT INTO "sale" ("sale_id", "customer_id", "amount") VALUES ('s1', 'c1', 50), ('s2', 'c1', 150), ('s3', 'c2', 300)`,
];

proves(
  ["0009-sql-aide FR-043"],
  "each materialization builds in every engine, and a second build after new rows is as each says",
  async () => {
    const seen: string[] = [];
    await eachEngine(async (engine) => {
      const ctx = contexts[engine.dialect];
      const build = (): string =>
        engine.dialect === "postgres" ? render(definitions([...portable, salesTotal]), pg) : render(definitions(portable), ctx);
      const rows = async (t: string): Promise<string> =>
        JSON.stringify(
          (await engine.query(`SELECT * FROM "${t}" ORDER BY 1`)).map((r) =>
            Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Number(v) || v])),
          ),
        );
      await engine.exec(render(definitions([customer, sale]), ctx));
      for (const s of SEED) await engine.exec(s);
      await engine.exec(build());
      assertEquals(
        await rows("big_sales"),
        `[{"sale_id":"s2","customer_id":"c1","amount":150},{"sale_id":"s3","customer_id":"c2","amount":300}]`,
        engine.name,
      );
      assertEquals(
        await rows("sales_by_region"),
        `[{"sale_id":"s1","region":"north"},{"sale_id":"s2","region":"north"},{"sale_id":"s3","region":"south"}]`,
      );
      assertEquals(await rows("sale_log"), `[{"sale_id":"s1","amount":50},{"sale_id":"s2","amount":150},{"sale_id":"s3","amount":300}]`);
      await engine.exec(`INSERT INTO "sale" ("sale_id", "customer_id", "amount") VALUES ('s4', 'c2', 500)`);
      await engine.exec(`UPDATE "sale" SET "amount" = 51 WHERE "sale_id" = 's1'`);
      await engine.exec(build());
      // a table is made again; an incremental model adds the new key and leaves the row it holds as it was
      assertEquals(JSON.parse(await rows("big_sales")).length, 3, engine.name);
      assertEquals(
        await rows("sale_log"),
        `[{"sale_id":"s1","amount":50},{"sale_id":"s2","amount":150},{"sale_id":"s3","amount":300},{"sale_id":"s4","amount":500}]`,
      );
      assertEquals(JSON.parse(await rows("customer_sales")).length, 4, `${engine.name}: a view reads through`);
      if (engine.dialect === "postgres") assertEquals(JSON.parse(await rows("sales_total")).length, 4, `${engine.name}: refreshed`);
      seen.push(JSON.stringify([await rows("big_sales"), await rows("sale_log"), await rows("sales_by_region")]));
    });
    assertEquals(new Set(seen).size, 1, "every engine builds the same rows");
  },
);

const checks = [
  unique(customerSales, ["sale_id"]),
  notNull(bigSales, "customer_id"),
  acceptedValues(customer, "region", ["north", "south"]),
  relationship(bigSales, "customer_id", customer, "id"),
  relationship(salesByRegion, "sale_id", sale, "sale_id"),
  custom("no sale is negative", raw(`SELECT * FROM "sale" WHERE "amount" < 0`), sale),
];

proves(
  ["0009-sql-aide FR-044", "0009-sql-aide FR-031"],
  "the tests of transforms are SQL that records what it finds, reported as TAP, and a test that should fail does",
  async () => {
    // @ts-expect-error a region is a word, so a number is not an accepted value of it
    const wrongValue = (): unknown => acceptedValues(customer, "region", [1]);
    // @ts-expect-error an amount is not a customer's key
    const wrongType = (): unknown => relationship(sale, "amount", customer, "id");
    // @ts-expect-error a sale has no column total
    const noColumn = (): unknown => notNull(sale, "total");
    assertEquals([typeof wrongValue, typeof wrongType, typeof noColumn], ["function", "function", "function"]);
    const seen: string[] = [];
    await eachEngine(async (engine) => {
      const ctx = contexts[engine.dialect];
      await engine.exec(render(definitions([...portable, findingsTable]), ctx));
      for (const s of SEED) await engine.exec(s);
      await engine.exec(render(definitions(portable), ctx));
      await engine.exec(render(recordFindings(checks, "run-1"), ctx));
      const first = await reportFindings(checks, "run-1", engine, ctx);
      assertEquals(tally(first), { passed: checks.length, failed: 0, skipped: 0 }, `${engine.name}: ${tapText(first)}`);
      // the control: a customer of a region not accepted, and a negative sale, are found and counted
      await engine.exec(`INSERT INTO "customer" ("id", "name", "region") VALUES ('c3', 'Grace', 'west')`);
      await engine.exec(`INSERT INTO "sale" ("sale_id", "customer_id", "amount") VALUES ('s9', 'c3', -1)`);
      await engine.exec(render(recordFindings(checks, "run-2"), ctx));
      const second = await reportFindings(checks, "run-2", engine, ctx);
      assertEquals(tally(second), { passed: checks.length - 2, failed: 2, skipped: 0 }, engine.name);
      const tap = tapText(second);
      assertStringIncludes(tap, "not ok 3 - customer.region is one of north, south\n  ---\n  failures: 1\n  ...");
      assertStringIncludes(tap, "not ok 6 - no sale is negative");
      const recorded = await engine.query(`SELECT count(*) AS n FROM "ifcsql_findings"`);
      assertEquals(Number(recorded[0]?.["n"]), checks.length * 2, `${engine.name}: each run's findings are kept`);
      assertEquals(tally(await reportFindings(checks, "never-run", engine, ctx)).failed, checks.length);
      seen.push(tap);
    });
    assertEquals(new Set(seen).size, 1, "every engine reports the same");
  },
);

proves(
  ["0009-sql-aide FR-028"],
  "lineage runs from a source through an integration and transforms, and is kept beside the ledger",
  async () => {
    const customers = seed("customers", customer, [{ id: "c1", name: "Ada", region: "north" }]);
    const edges = lineageOf([customers, ...portable.filter((e) => e.entity === "transform").map((m) => m as typeof customerSales)]);
    assertEquals(
      edges.filter((e) => e.kind === "transform").map((e) => `${e.from} -> ${e.to}`),
      [
        ".customer_sales -> .sales_by_region",
        ".regions -> .sales_by_region",
        ".customer_sales -> .big_sales",
        ".sale -> .sale_log",
        ".sale -> .customer_sales",
        ".customer -> .customer_sales",
        ".customer -> .regions",
      ],
    );
    const up = upstream(edges, ".big_sales");
    for (const n of [".customer_sales", ".sale", ".customer", ".customers_landing", "rows:typescript"])
      assert(up.includes(n), `${n} is upstream: ${up.join(", ")}`);
    const engine = await pgliteEngine();
    try {
      await engine.exec(render(lineageTable.ddl, pg));
      await engine.exec(render(recordLineage(edges).load, pg));
      assertEquals(Number((await engine.query(`SELECT count(*) AS n FROM "ifcsql_lineage" WHERE "kind" = 'transform'`))[0]?.["n"]), 7);
    } finally {
      await engine.close();
    }
  },
);
