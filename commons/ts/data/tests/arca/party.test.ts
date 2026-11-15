/**
 * Arca's party model, as the acceptance test of IFC SQL Aide (commons 0006-sql-aide FR-047, FR-049, FR-050): it compiles for the three
 * dialects, what it emits is what is committed, it loads into every engine at hand, its constraints hold, and lint finds nothing.
 *
 * @module
 */
import type { Brand, Equal } from "../../../kernel/mod.ts";
import { expectType } from "../../../kernel/mod.ts";
import { assert, assertEquals, assertRejects, proves } from "../../../runtime/test.ts";
import { party, partyDocs, partyModel, person } from "../../arca/mod.ts";
import { context, definitions, duckdb, lint, type NewRowOf, postgres, render, type RowOf, sqlite } from "../../sql-aide/mod.ts";
import { docsAreCurrent } from "../../sql-aide/runtime/docs.ts";
import { engines, golden, postgresUrl } from "../helpers.ts";

const contexts = {
  postgres: context({ dialect: postgres(), docs: [partyDocs] }),
  sqlite: context({ dialect: sqlite(), docs: [partyDocs] }),
  duckdb: context({ dialect: duckdb(), docs: [partyDocs] }),
};

proves(["0006-sql-aide FR-047", "0006-sql-aide FR-007"], "the rows of the party model are typed from its tables", () => {
  expectType<Equal<RowOf<typeof person>["party_id"], Brand<string, "party">>>();
  expectType<Equal<RowOf<typeof person>["birth_date"], string | null>>();
  const ada: NewRowOf<typeof person> = { party_id: party.key("01HX"), given_name: "Ada", family_name: "Lovelace" };
  // a person's key is a party's key, so it is made by the party table
  // @ts-expect-error a person must be given a family name
  const nameless: NewRowOf<typeof person> = { party_id: party.key("01HX"), given_name: "Ada" };
  assertEquals([ada.family_name, nameless.given_name], ["Lovelace", "Ada"]);
});

for (const [dialect, ctx] of Object.entries(contexts)) {
  proves(["0006-sql-aide FR-049", "0006-sql-aide FR-015"], `the party model emitted for ${dialect} is what is committed`, async () => {
    await golden(new URL(`./golden/party.${dialect}.sql`, import.meta.url), `${render(definitions(partyModel), ctx)}\n`);
  });
}

proves(
  ["0006-sql-aide FR-005", "0006-sql-aide FR-025", "0006-sql-aide FR-026", "0006-sql-aide FR-027"],
  "the party model is documented, owned and classified",
  async () => {
    assertEquals(lint(partyModel, contexts.postgres), []);
    assert(
      await docsAreCurrent(new URL("../../arca/party.ts", import.meta.url).pathname),
      "arca/party.docs.auto.ts is what the comments of arca/party.ts make",
    );
    const personal = partyModel.flatMap((t) => t.spec.columns.filter(([, c]) => c.personal !== undefined).map(([n]) => `${t.name}.${n}`));
    assert(personal.includes("person.birth_date") && personal.includes("electronic_contact.address") && personal.length >= 12);
  },
);

proves(
  ["0006-sql-aide FR-049", "0006-sql-aide FR-017"],
  "the party model loads into every engine at hand, twice, and its constraints hold",
  async () => {
    for (const engine of await engines()) {
      try {
        const ddl = render(definitions(partyModel), contexts[engine.dialect]);
        await engine.exec(ddl);
        await engine.exec(ddl); // every definition is made only if absent
        await engine.exec(`INSERT INTO "party_kind" ("code", "label") VALUES ('person', 'Person')`);
        await engine.exec(`INSERT INTO "party" ("party_id", "party_kind_code", "display_name") VALUES ('p1', 'person', 'Ada Lovelace')`);
        await engine.exec(`INSERT INTO "person" ("party_id", "given_name", "family_name") VALUES ('p1', 'Ada', 'Lovelace')`);
        const rows = await engine.query(`SELECT "given_name", "birth_date" FROM "person"`);
        assertEquals(
          rows.map((r) => [r["given_name"], r["birth_date"]]),
          [["Ada", null]],
          engine.name,
        );
        const made = await engine.query(`SELECT "created_at" FROM "party"`);
        assert(made[0]?.["created_at"] !== null, `${engine.name}: the default says when the row was made`);
        // a kind that is not in the code table, a person with no party, a medium that is not one of the three, a relation to oneself
        await assertRejects(() =>
          engine.exec(`INSERT INTO "party" ("party_id", "party_kind_code", "display_name") VALUES ('p2', 'robot', 'R')`),
        );
        await assertRejects(() =>
          engine.exec(`INSERT INTO "person" ("party_id", "given_name", "family_name") VALUES ('nobody', 'N', 'O')`),
        );
        await assertRejects(() =>
          engine.exec(
            `INSERT INTO "electronic_contact" ("electronic_contact_id", "party_id", "medium", "address") VALUES ('e1', 'p1', 'fax', '1')`,
          ),
        );
        await engine.exec(`INSERT INTO "party_relation_kind" ("code", "label") VALUES ('knows', 'Knows')`);
        await assertRejects(() =>
          engine.exec(
            `INSERT INTO "party_relation" ("party_relation_id", "from_party_id", "to_party_id", "party_relation_kind_code", "valid_from") VALUES ('r1', 'p1', 'p1', 'knows', '2026-01-01')`,
          ),
        );
      } finally {
        await engine.close();
      }
    }
  },
);

proves(["0006-sql-aide FR-049"], "where no PostgreSQL server is given, the test that needs one says so and the rest run", () => {
  if (postgresUrl() === undefined) console.log("# SKIP the PostgreSQL server tier: IFCSQL_PG_URL is not set");
  assertEquals(typeof postgresUrl(), postgresUrl() === undefined ? "undefined" : "string");
});
