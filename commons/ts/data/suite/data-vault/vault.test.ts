/**
 * Data Vault, as the second acceptance test of IFC SQL Aide (commons 0009-sql-aide FR-048 to FR-050): functions that make tables whose
 * types are computed, what they emit for three dialects, and that they load into every engine at hand.
 *
 * @module
 */
import type { Brand, Equal } from "../../../kernel/mod.ts";
import { expectType } from "../../../kernel/mod.ts";
import { assert, assertEquals, assertRejects, proves } from "../../../runtime/test.ts";
import {
  exceptionDiagnostic,
  exceptionHub,
  hub,
  link,
  loadHub,
  loadLink,
  loadSatellite,
  recordException,
  satellite,
} from "../../data-vault/mod.ts";
import {
  context,
  date,
  definitions,
  duckdb,
  fails,
  from,
  apply,
  inspect,
  plan,
  type Plan,
  type LandingRow,
  lineageOf,
  lint,
  type NewRowOf,
  postgres,
  raw,
  render,
  type RowOf,
  rows,
  runAssertions,
  seed,
  sqlite,
  structuralTests,
  table,
  tally,
  text,
} from "../../sql-aide/mod.ts";
import { eachEngine, golden, pgliteEngine } from "../helpers.ts";

const customer = hub("customer", { customer_number: text().doc("The number the business knows the customer by") });
const order = hub("order", { order_number: text().doc("The number on the order") });
const customerContact = satellite(customer, "contact", { email: text().nullable().doc("Where to write").personal("EmailAddress") });
const orderState = satellite(order, "state", {
  status: text().doc("Where the order stands"),
  due: date().nullable().doc("When it is due"),
});
const customerOrder = link("customer_order", { customer, order });
const vault = [customerOrder, orderState, customerContact, order, customer] as const;

proves(
  ["0009-sql-aide FR-048", "0009-sql-aide FR-008"],
  "the tables a vault's functions make are named and typed from what they are given",
  () => {
    assertEquals(
      [customer.name, customerContact.name, customerOrder.name],
      ["hub_customer", "sat_customer_contact", "link_customer_order"],
    );
    type CustomerKey = Brand<string, "hub_customer">;
    expectType<Equal<RowOf<typeof customer>["hub_customer_id"], CustomerKey>>();
    expectType<Equal<RowOf<typeof customer>["customer_number"], string>>();
    expectType<Equal<RowOf<typeof customerContact>["hub_customer_id"], CustomerKey>>();
    expectType<Equal<RowOf<typeof customerContact>["email"], string | null>>();
    expectType<Equal<RowOf<typeof customerOrder>["hub_order_id"], Brand<string, "hub_order">>>();
    const row: NewRowOf<typeof customerOrder> = {
      link_customer_order_id: customerOrder.key("l1"),
      hub_customer_id: customer.key("c1"),
      hub_order_id: order.key("o1"),
      record_source: "test",
    };
    // @ts-expect-error an order's key is not a customer's key
    const crossed: NewRowOf<typeof customerOrder> = { ...row, hub_customer_id: order.key("o1") };
    assertEquals([row.record_source, crossed.record_source], ["test", "test"]);
    const plain = table("plain", { id: text().primaryKey() });
    // @ts-expect-error a satellite belongs to a hub, and a plain table is not one
    const notOfAHub = (): unknown => satellite(plain, "x", {});
    // @ts-expect-error a link joins hubs, and a plain table is not one
    const notHubs = (): unknown => link("x", { customer, plain });
    assertEquals([typeof notOfAHub, typeof notHubs], ["function", "function"]);
    assertEquals(
      customerContact.dependsOn().map((d) => d.name),
      ["hub_customer"],
    );
  },
);

const contexts = {
  postgres: context({ dialect: postgres() }),
  sqlite: context({ dialect: sqlite() }),
  duckdb: context({ dialect: duckdb() }),
};

for (const [dialect, ctx] of Object.entries(contexts)) {
  proves(["0009-sql-aide FR-049", "0009-sql-aide FR-015"], `a vault emitted for ${dialect} is what is committed`, async () => {
    await golden(new URL(`./golden/vault.${dialect}.sql`, import.meta.url), `${render(definitions(vault), ctx)}\n`);
  });
}

proves(["0009-sql-aide FR-025", "0009-sql-aide FR-027"], "what a vault's functions make is described and owned", () => {
  assertEquals(lint(vault, contexts.postgres), []);
});

proves(["0009-sql-aide FR-049", "0009-sql-aide FR-017"], "a vault loads into every engine at hand, and its keys hold", async () => {
  await eachEngine(async (engine) => {
    const ddl = render(definitions(vault), contexts[engine.dialect]);
    await engine.exec(ddl);
    await engine.exec(ddl);
    await engine.exec(`INSERT INTO "hub_customer" ("hub_customer_id", "customer_number", "record_source") VALUES ('c1', 'C-001', 'test')`);
    await engine.exec(`INSERT INTO "hub_order" ("hub_order_id", "order_number", "record_source") VALUES ('o1', 'O-001', 'test')`);
    await engine.exec(
      `INSERT INTO "link_customer_order" ("link_customer_order_id", "hub_customer_id", "hub_order_id", "record_source") VALUES ('l1', 'c1', 'o1', 'test')`,
    );
    await engine.exec(
      `INSERT INTO "sat_customer_contact" ("sat_customer_contact_id", "hub_customer_id", "email", "record_source") VALUES ('s1', 'c1', 'a@b.c', 'test')`,
    );
    const rows = await engine.query(`SELECT count(*) AS n FROM "link_customer_order"`);
    assertEquals(Number(rows[0]?.["n"]), 1, engine.name);
    // the business key is unique, a link's hubs are unique together, and a satellite is of a hub that exists
    await assertRejects(() =>
      engine.exec(`INSERT INTO "hub_customer" ("hub_customer_id", "customer_number", "record_source") VALUES ('c2', 'C-001', 'test')`),
    );
    await assertRejects(() =>
      engine.exec(
        `INSERT INTO "link_customer_order" ("link_customer_order_id", "hub_customer_id", "hub_order_id", "record_source") VALUES ('l2', 'c1', 'o1', 'test')`,
      ),
    );
    await assertRejects(() =>
      engine.exec(
        `INSERT INTO "sat_customer_contact" ("sat_customer_contact_id", "hub_customer_id", "record_source") VALUES ('s2', 'nobody', 'test')`,
      ),
    );
    assert(true);
  });
});

proves(
  ["0009-sql-aide FR-029", "0009-sql-aide FR-030", "0009-sql-aide FR-049"],
  "the tests made from a vault pass in every engine at hand",
  async () => {
    await eachEngine(async (engine) => {
      const ctx = contexts[engine.dialect];
      await engine.exec(render(definitions(vault), ctx));
      await engine.exec(
        `INSERT INTO "hub_customer" ("hub_customer_id", "customer_number", "record_source") VALUES ('c1', 'C-001', 'test')`,
      );
      const assertions = [
        ...structuralTests({ tables: vault }, ctx),
        rows("the hub holds the business key once", raw(`SELECT "customer_number" FROM "hub_customer"`), [["C-001"]]),
        fails(
          "a business key is not loaded twice",
          raw(`INSERT INTO "hub_customer" ("hub_customer_id", "customer_number", "record_source") VALUES ('c2', 'C-001', 't')`),
        ),
      ];
      assertEquals(tally(await runAssertions(assertions, engine, ctx)), { passed: assertions.length, failed: 0, skipped: 0 }, engine.name);
    });
  },
);

proves(
  ["0009-sql-aide FR-020", "0009-sql-aide FR-048", "0009-sql-aide FR-050"],
  "the vault records an exception in PostgreSQL: its hub row once, a diagnostic each time",
  async () => {
    const engine = await pgliteEngine();
    try {
      await engine.exec(render(definitions([recordException, exceptionDiagnostic, exceptionHub]), contexts.postgres));
      await engine.exec(render(recordException.call({ key: "bad-date", message: "month 13", source: "feed" }), contexts.postgres));
      await engine.exec(render(recordException.call({ key: "bad-date", message: "day 32", source: "feed" }), contexts.postgres));
      assertEquals(Number((await engine.query(`SELECT count(*) AS n FROM "hub_exception"`))[0]?.["n"]), 1);
      assertEquals(
        (await engine.query(`SELECT "message" FROM "sat_exception_diagnostic" ORDER BY 1`)).map((r) => r["message"]),
        ["day 32", "month 13"],
      );
    } finally {
      await engine.close();
    }
  },
);

/** What a feed from a shop gives, landed as it came. */
const feed = table("shop_feed", {
  customer_number: text(),
  email: text().nullable(),
  order_number: text(),
  status: text(),
  due: date().nullable(),
});
const feedOf = (rows: readonly LandingRow<typeof feed>[]) => seed("shop_feed_load", feed, rows, { strategy: "replace" });
const loads = [
  loadHub(customer, feed, "shop"),
  loadHub(order, feed, "shop"),
  loadSatellite(customer, customerContact, feed, "shop"),
  loadSatellite(order, orderState, feed, "shop"),
  loadLink(customerOrder, { customer, order }, feed, "shop"),
];
const first = [
  { customer_number: "C-1", email: "a@example.org", order_number: "O-1", status: "open", due: "2026-12-01" },
  { customer_number: "C-1", email: "a@example.org", order_number: "O-2", status: "open", due: null },
  { customer_number: "C-2", email: null, order_number: "O-3", status: "shipped", due: null },
];

proves(
  ["0009-sql-aide FR-048", "0009-sql-aide FR-033", "0009-sql-aide FR-050"],
  "a vault's loads only insert: run twice they change nothing, and a changed attribute adds one satellite row, the same in every engine",
  async () => {
    // @ts-expect-error a satellite of orders is not loaded as the customer's
    const crossed = (): unknown => loadSatellite(customer, orderState, feed, "x");
    const noKey = table("no_key", { email: text() });
    // @ts-expect-error a relation that does not give the customer's business key cannot load the hub
    const keyless = (): unknown => loadHub(customer, noKey, "x");
    assertEquals([typeof crossed, typeof keyless], ["function", "function"]);
    for (const [dialect, ctx] of Object.entries(contexts))
      await golden(
        new URL(`./golden/vault-loads.${dialect}.sql`, import.meta.url),
        `${loads.map((l) => render(l.sql, ctx)).join("\n\n")}\n`,
      );
    const seen: string[] = [];
    await eachEngine(async (engine) => {
      const ctx = contexts[engine.dialect];
      const counts = async (): Promise<readonly number[]> => {
        const out: number[] = [];
        for (const t of ["hub_customer", "hub_order", "sat_customer_contact", "sat_order_state", "link_customer_order"])
          out.push(Number((await engine.query(`SELECT count(*) AS n FROM "${t}"`))[0]?.["n"]));
        return out;
      };
      await engine.exec(render(definitions([...vault, feed]), ctx));
      await engine.exec(render(feedOf(first).load, ctx));
      for (const l of loads) await engine.exec(render(l.sql, ctx));
      assertEquals(await counts(), [2, 3, 2, 3, 3], engine.name);
      for (const l of loads) await engine.exec(render(l.sql, ctx));
      assertEquals(await counts(), [2, 3, 2, 3, 3], `${engine.name}: a second run changes nothing`);
      // the next feed: C-1 has a new address, O-1 is shipped, C-2 is as before
      await engine.exec(
        render(
          feedOf([
            { customer_number: "C-1", email: "b@example.org", order_number: "O-1", status: "shipped", due: "2026-12-01" },
            { customer_number: "C-2", email: null, order_number: "O-3", status: "shipped", due: null },
          ]).load,
          ctx,
        ),
      );
      for (const l of loads) await engine.exec(render(l.sql, ctx));
      for (const l of loads) await engine.exec(render(l.sql, ctx));
      assertEquals(await counts(), [2, 3, 3, 4, 3], `${engine.name}: one new state of C-1 and of O-1`);
      const states = await engine.query(
        `SELECT "sat_customer_contact_id" AS id, "hub_customer_id" AS hub, "email" FROM "sat_customer_contact" ORDER BY 1`,
      );
      seen.push(JSON.stringify(states));
    });
    assertEquals(new Set(seen).size, 1, "every engine holds the same states");
    assertEquals(
      seen[0],
      JSON.stringify([
        { id: "C-1#000000001", hub: "C-1", email: "a@example.org" },
        { id: "C-1#000000002", hub: "C-1", email: "b@example.org" },
        { id: "C-2#000000001", hub: "C-2", email: null },
      ]),
    );
    assertEquals(
      lineageOf(loads).map((e) => `${e.from} -> ${e.to}`),
      [
        ".shop_feed -> .hub_customer",
        ".shop_feed -> .hub_order",
        ".shop_feed -> .sat_customer_contact",
        ".shop_feed -> .sat_order_state",
        ".shop_feed -> .link_customer_order",
      ],
    );
  },
);

proves(
  ["0009-sql-aide FR-035", "0009-sql-aide FR-037", "0009-sql-aide FR-040", "0009-sql-aide FR-050"],
  "ISLM applies a vault from empty in every engine, finds no drift after, and a second apply changes nothing",
  async () => {
    await eachEngine(async (engine) => {
      const ctx = contexts[engine.dialect];
      const planned = async (): Promise<Plan> => {
        const catalog = await inspect(engine, ctx);
        assert(catalog.kind === "ok");
        return plan({ entities: [...vault, feed] }, catalog.value, ctx);
      };
      const first = await planned();
      assertEquals(first.changes.length, 6);
      assert((await apply(first, engine, ctx, { actor: "vault" })).kind === "ok", engine.name);
      const again = await planned();
      assertEquals([again.changes, again.unplanned], [[], []], `${engine.name}: no drift`);
      assertEquals(await apply(again, engine, ctx, { actor: "vault" }), { kind: "ok", value: { ran: [] } });
    });
  },
);

proves(
  ["0009-sql-aide FR-041", "0009-sql-aide FR-048", "0009-sql-aide FR-050"],
  "a vault is read with the query builder: a link joined to its hubs by their keys, the same in every engine",
  async () => {
    const orders = from(customerOrder)
      .join(customer)
      .join(order)
      .select((s) => ({ customer: s.hub_customer.customer_number, order: s.hub_order.order_number }))
      .orderBy((s) => [s.hub_order.order_number]);
    expectType<Equal<RowOf<typeof orders>, { readonly customer: string; readonly order: string }>>();
    const seen: string[] = [];
    await eachEngine(async (engine) => {
      const ctx = contexts[engine.dialect];
      await engine.exec(render(definitions([...vault, feed]), ctx));
      await engine.exec(render(feedOf(first).load, ctx));
      for (const l of loads) await engine.exec(render(l.sql, ctx));
      const rows = (await engine.query(render(orders, ctx))).map((r) => ({ ...r }));
      assertEquals(
        rows,
        [
          { customer: "C-1", order: "O-1" },
          { customer: "C-1", order: "O-2" },
          { customer: "C-2", order: "O-3" },
        ],
        engine.name,
      );
      seen.push(JSON.stringify(rows));
    });
    assertEquals(new Set(seen).size, 1);
  },
);
