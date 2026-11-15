/**
 * Arca's party model, as the acceptance test of IFC SQL Aide (commons 0006-sql-aide FR-047, FR-049, FR-050): it compiles for the three
 * dialects, what it emits is what is committed, it loads into every engine at hand, its constraints hold, and lint finds nothing.
 *
 * @module
 */
import type { Brand, Equal } from "../../../kernel/mod.ts";
import { expectType } from "../../../kernel/mod.ts";
import { assert, assertEquals, assertRejects, proves } from "../../../runtime/test.ts";
import { party, partyDocs, partyIndexes, partyModel, partyTables, partyViews, person, personDirectory } from "../../arca/mod.ts";
import {
  context,
  definitions,
  duckdb,
  fails,
  lint,
  type NewRowOf,
  pgTapScript,
  postgres,
  raw,
  render,
  type RowOf,
  rows,
  runAssertions,
  sqlite,
  structuralTests,
  tally,
  tapQuery,
} from "../../sql-aide/mod.ts";
import { fromLines } from "../../sql-aide/mod.ts";
import { docsAreCurrent } from "../../sql-aide/runtime/docs.ts";
import { eachEngine, golden, postgresEngine, postgresUrl } from "../helpers.ts";

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
    assertEquals(lint(partyTables, contexts.postgres), []);
    assert(
      await docsAreCurrent(new URL("../../arca/party.ts", import.meta.url).pathname),
      "arca/party.docs.auto.ts is what the comments of arca/party.ts make",
    );
    const personal = partyTables.flatMap((t) => t.spec.columns.filter(([, c]) => c.personal !== undefined).map(([n]) => `${t.name}.${n}`));
    assert(personal.includes("person.birth_date") && personal.includes("electronic_contact.address") && personal.length >= 12);
  },
);

proves(
  ["0006-sql-aide FR-049", "0006-sql-aide FR-017"],
  "the party model loads into every engine at hand, twice, and its constraints hold",
  async () => {
    await eachEngine(async (engine) => {
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
      await assertRejects(() => engine.exec(`INSERT INTO "person" ("party_id", "given_name", "family_name") VALUES ('nobody', 'N', 'O')`));
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
    });
  },
);

proves(["0006-sql-aide FR-049"], "where no PostgreSQL server is given, the test that needs one says so and the rest run", () => {
  if (postgresUrl() === undefined) console.log("# SKIP the PostgreSQL server tier: IFCSQL_PG_URL is not set");
  assertEquals(typeof postgresUrl(), postgresUrl() === undefined ? "undefined" : "string");
});

const SEED = [
  `INSERT INTO "party_kind" ("code", "label") VALUES ('person', 'Person')`,
  `INSERT INTO "party" ("party_id", "party_kind_code", "display_name") VALUES ('p1', 'person', 'Ada Lovelace')`,
  `INSERT INTO "party" ("party_id", "party_kind_code", "display_name", "deleted_at") VALUES ('p2', 'person', 'Gone', CURRENT_TIMESTAMP)`,
  `INSERT INTO "person" ("party_id", "given_name", "family_name") VALUES ('p1', 'Ada', 'Lovelace')`,
  `INSERT INTO "person" ("party_id", "given_name", "family_name") VALUES ('p2', 'G', 'One')`,
];
const scenario = [
  rows("the directory lists the people in use", raw(`SELECT "party_id", "family_name" FROM "person_directory"`), [["p1", "Lovelace"]]),
  rows("nobody is listed twice", raw(`SELECT "party_id" FROM "person_directory" GROUP BY "party_id" HAVING count(*) > 1`), []),
  fails(
    "a person with no party is refused",
    raw(`INSERT INTO "person" ("party_id", "given_name", "family_name") VALUES ('nobody', 'N', 'O')`),
  ),
];

proves(
  ["0006-sql-aide FR-029", "0006-sql-aide FR-030", "0006-sql-aide FR-049"],
  "the tests made from the party model, and its scenario, pass inside every engine and from TypeScript, with the same rows in each",
  async () => {
    const seen: string[] = [];
    await eachEngine(async (engine) => {
      const ctx = contexts[engine.dialect];
      await engine.exec(render(definitions(partyModel), ctx));
      for (const s of SEED) await engine.exec(s);
      const structure = structuralTests({ tables: partyTables, views: partyViews, indexes: partyIndexes }, ctx);
      assert(structure.length > 100, "a test for every table, column, key, view and index");
      // inside the database: one query gives the TAP lines
      const lines = (await engine.query(tapQuery([...structure, ...scenario], ctx))).map((r) => String(r["tap"]));
      assertEquals(
        tally(fromLines(lines)),
        { passed: structure.length + 2, failed: 0, skipped: 1 },
        `${engine.name}: ${lines.filter((l) => l.startsWith("not ok")).join("; ")}`,
      );
      // from TypeScript: the same assertions, and the statement that must fail is tried
      assertEquals(
        tally(await runAssertions([...structure, ...scenario], engine, ctx)),
        { passed: structure.length + 3, failed: 0, skipped: 0 },
        engine.name,
      );
      // a test that should not pass does not: the control
      const wrong = await runAssertions(
        [{ kind: "has-table", table: { name: "nowhere", schema: undefined } }, rows("wrong", raw(`SELECT 1`), [[2]])],
        engine,
        ctx,
      );
      assertEquals(tally(wrong), { passed: 0, failed: 2, skipped: 0 }, engine.name);
      const got = await engine.query(
        render(raw(`SELECT "party_id", "display_name", "given_name", "family_name" FROM "person_directory" ORDER BY 1`), ctx),
      );
      seen.push(JSON.stringify(got));
    });
    assertEquals(new Set(seen).size, 1, "every engine gives the same rows for the same scenario");
    expectType<Equal<RowOf<typeof personDirectory>["family_name"], string>>();
  },
);

proves(["0006-sql-aide FR-029"], "on a PostgreSQL server with pgTAP, the same tests run as pgTAP", async () => {
  const engine = await postgresEngine();
  if (engine === undefined) {
    console.log("# SKIP pgTAP: IFCSQL_PG_URL is not set");
    return;
  }
  try {
    const ctx = contexts.postgres;
    const available = await engine.query(`SELECT 1 FROM pg_available_extensions WHERE name = 'pgtap'`);
    if (available.length === 0) {
      console.log("# SKIP pgTAP: the server does not have the extension");
      return;
    }
    await engine.exec("CREATE EXTENSION IF NOT EXISTS pgtap");
    await engine.exec(render(definitions(partyModel), ctx));
    for (const s of SEED) await engine.exec(s);
    const assertions = [...structuralTests({ tables: partyTables, views: partyViews, indexes: partyIndexes }, ctx), ...scenario];
    const lines: string[] = [];
    for (const statement of pgTapScript(assertions, ctx).split("\n")) {
      for (const row of await engine.query(statement)) lines.push(...Object.values(row).map(String));
    }
    const results = fromLines(lines.filter((l) => /^(?:not )?ok\b/.test(l)));
    assertEquals(
      tally(results),
      { passed: assertions.length, failed: 0, skipped: 0 },
      lines.filter((l) => l.startsWith("not ok") || l.startsWith("#")).join("; "),
    );
  } finally {
    await engine.close();
  }
});
