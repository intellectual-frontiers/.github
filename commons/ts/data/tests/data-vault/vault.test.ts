/**
 * Data Vault, as the second acceptance test of IFC SQL Aide (commons 0006-sql-aide FR-048 to FR-050): functions that make tables whose
 * types are computed, what they emit for three dialects, and that they load into every engine at hand.
 *
 * @module
 */
import type { Brand, Equal } from "../../../kernel/mod.ts";
import { expectType } from "../../../kernel/mod.ts";
import { assert, assertEquals, assertRejects, proves } from "../../../runtime/test.ts";
import { hub, link, satellite } from "../../data-vault/mod.ts";
import {
  context,
  date,
  definitions,
  duckdb,
  lint,
  type NewRowOf,
  postgres,
  render,
  type RowOf,
  sqlite,
  table,
  text,
} from "../../sql-aide/mod.ts";
import { engines, golden } from "../helpers.ts";

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
  ["0006-sql-aide FR-048", "0006-sql-aide FR-008"],
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
  proves(["0006-sql-aide FR-049", "0006-sql-aide FR-015"], `a vault emitted for ${dialect} is what is committed`, async () => {
    await golden(new URL(`./golden/vault.${dialect}.sql`, import.meta.url), `${render(definitions(vault), ctx)}\n`);
  });
}

proves(["0006-sql-aide FR-025", "0006-sql-aide FR-027"], "what a vault's functions make is described and owned", () => {
  assertEquals(lint(vault, contexts.postgres), []);
});

proves(["0006-sql-aide FR-049", "0006-sql-aide FR-017"], "a vault loads into every engine at hand, and its keys hold", async () => {
  for (const engine of await engines()) {
    try {
      const ddl = render(definitions(vault), contexts[engine.dialect]);
      await engine.exec(ddl);
      await engine.exec(ddl);
      await engine.exec(
        `INSERT INTO "hub_customer" ("hub_customer_id", "customer_number", "record_source") VALUES ('c1', 'C-001', 'test')`,
      );
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
    } finally {
      await engine.close();
    }
  }
});
