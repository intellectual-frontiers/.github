/**
 * Arca's party model, as the acceptance test of IFC SQL Aide (commons 0009-sql-aide FR-047, FR-049, FR-050): it compiles for the three
 * dialects, what it emits is what is committed, it loads into every engine at hand, its constraints hold, and lint finds nothing.
 *
 * @module
 */
import type { Brand, Equal, Result } from "../../../kernel/mod.ts";
import { expectType } from "../../../kernel/mod.ts";
import { assert, assertEquals, assertRejects, proves } from "@intellectual-frontiers/test";
import {
  electronicContact,
  party,
  partyCodeTables,
  partyKind,
  partyRoleKind,
  partyDocs,
  partyIndexes,
  partyModel,
  partyReference,
  partyReferenceData,
  partyRoutines,
  partyTables,
  partyViews,
  peopleBornSince,
  person,
  personDirectory,
  retireParty,
} from "../../arca/mod.ts";
import {
  acceptedValues,
  buildSql,
  context,
  definitions,
  type Driver,
  type DriverError,
  duckdbDriver,
  duckdb,
  fails,
  findingsTable,
  from,
  insertInto,
  isNull,
  apply,
  inspect,
  plan,
  type Plan,
  lint,
  model,
  notNull,
  type NewRowOf,
  pgliteDriver,
  pgTapScript,
  postgres,
  raw,
  recordFindings,
  relationship,
  render,
  shadow,
  reportFindings,
  type RowOf,
  rows,
  runAssertions,
  SQL,
  sqlite,
  type Sqlite,
  sqliteDriver,
  structuralTests,
  tally,
  tapQuery,
  tapText,
  unique,
} from "../../sql-aide/mod.ts";
import { fromLines } from "../../sql-aide/mod.ts";
import { materialize } from "../../sql-aide/runtime/build.ts";
import { docsAreCurrent } from "../../sql-aide/runtime/docs.ts";
import { fs, path } from "../../../runtime/mod.ts";
import { anotherLike, eachEngine, golden, postgresEngine, postgresUrl } from "../helpers.ts";

const contexts = {
  postgres: context({ dialect: postgres(), docs: [partyDocs] }),
  sqlite: context({ dialect: sqlite(), docs: [partyDocs] }),
  duckdb: context({ dialect: duckdb(), docs: [partyDocs] }),
};

proves(["0009-sql-aide FR-047", "0009-sql-aide FR-007"], "the rows of the party model are typed from its tables", () => {
  expectType<Equal<RowOf<typeof person>["party_id"], Brand<string, "party">>>();
  expectType<Equal<RowOf<typeof person>["birth_date"], string | null>>();
  const ada: NewRowOf<typeof person> = { party_id: party.key("01HX"), given_name: "Ada", family_name: "Lovelace" };
  // a person's key is a party's key, so it is made by the party table
  // @ts-expect-error a person must be given a family name
  const nameless: NewRowOf<typeof person> = { party_id: party.key("01HX"), given_name: "Ada" };
  assertEquals([ada.family_name, nameless.given_name], ["Lovelace", "Ada"]);
});

for (const [dialect, ctx] of Object.entries(contexts)) {
  proves(["0009-sql-aide FR-049", "0009-sql-aide FR-015"], `the party model emitted for ${dialect} is what is committed`, async () => {
    await golden(new URL(`./golden/party.${dialect}.sql`, import.meta.url), `${render(definitions(partyModel), ctx)}\n`);
  });
}

proves(
  ["0009-sql-aide FR-005", "0009-sql-aide FR-025", "0009-sql-aide FR-026", "0009-sql-aide FR-027"],
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
  ["0009-sql-aide FR-049", "0009-sql-aide FR-017"],
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

proves(["0009-sql-aide FR-049"], "where no PostgreSQL server is given, the test that needs one says so and the rest run", () => {
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
  ["0009-sql-aide FR-029", "0009-sql-aide FR-030", "0009-sql-aide FR-049"],
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

proves(["0009-sql-aide FR-029"], "on a PostgreSQL server with pgTAP, the same tests run as pgTAP", async () => {
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

proves(
  ["0009-sql-aide FR-020", "0009-sql-aide FR-021", "0009-sql-aide FR-050"],
  "the party model's routines run in PostgreSQL, and its function gives the same people in DuckDB and SQLite",
  async () => {
    const seen: string[] = [];
    await eachEngine(async (engine) => {
      const ctx = contexts[engine.dialect];
      await engine.exec(render(definitions(partyModel), ctx));
      for (const s of SEED) await engine.exec(s);
      await engine.exec(`UPDATE "person" SET "birth_date" = '1815-12-10' WHERE "party_id" = 'p1'`);
      if (engine.dialect === "postgres") await engine.exec(render(definitions(partyRoutines), contexts.postgres));
      if (engine.dialect === "duckdb") await engine.exec(render(peopleBornSince.ddl, contexts.duckdb));
      const born = SQL`SELECT "party_id" FROM ${peopleBornSince.call({ since: "1800-01-01" })} AS born`;
      const text0 =
        engine.dialect === "sqlite"
          ? render(born, contexts.sqlite)
          : engine.dialect === "duckdb"
            ? render(born, contexts.duckdb)
            : render(born, contexts.postgres);
      seen.push(JSON.stringify((await engine.query(text0)).map((r) => r["party_id"])));
      if (engine.dialect !== "postgres") return;
      await engine.exec(render(retireParty.call({ id: "p1", by: "the test" }), contexts.postgres));
      assertEquals((await engine.query(`SELECT "deleted_by" FROM "party" WHERE "party_id" = 'p1'`))[0]?.["deleted_by"], "the test");
      await assertRejects(
        () => engine.exec(render(retireParty.call({ id: "p1", by: "again" }), contexts.postgres)),
        Error,
        "already removed",
      );
    });
    assertEquals([...new Set(seen)], [`["p1"]`]);
  },
);

proves(
  ["0009-sql-aide FR-032", "0009-sql-aide FR-033", "0009-sql-aide FR-047", "0009-sql-aide FR-050"],
  "the party model's reference data is rows written in TypeScript, loaded twice into every engine to the same rows, and committed",
  async () => {
    for (const [dialect, ctx] of Object.entries(contexts))
      await golden(
        new URL(`./golden/party-reference.${dialect}.sql`, import.meta.url),
        `${partyReference.map((r) => render(r.load, ctx)).join("\n\n")}\n`,
      );
    const seen: string[] = [];
    await eachEngine(async (engine) => {
      const ctx = contexts[engine.dialect];
      await engine.exec(render(definitions(partyModel), ctx));
      for (const r of partyReference) await engine.exec(render(r.load, ctx));
      const count = async (): Promise<string> => {
        const n = await engine.query(
          `SELECT (SELECT count(*) FROM "party_kind") AS a, (SELECT count(*) FROM "party_role_kind") AS b, (SELECT count(*) FROM "party_relation_kind") AS c, (SELECT count(*) FROM "party_identifier_kind") AS d`,
        );
        return JSON.stringify(Object.values(n[0] ?? {}).map(Number));
      };
      const once = await count();
      for (const r of partyReference) await engine.exec(render(r.load, ctx));
      assertEquals(await count(), once, `${engine.name}: loading reference data again adds no row`);
      // the codes are what the model's foreign keys point to
      await engine.exec(
        `INSERT INTO "party" ("party_id", "party_kind_code", "display_name") VALUES ('o1', 'organization', 'Analytical Engines')`,
      );
      const labels = await engine.query(`SELECT "code", "label" FROM "party_role_kind" ORDER BY 1`);
      seen.push(JSON.stringify([once, labels]));
    });
    assertEquals(new Set(seen).size, 1, "every engine holds the same reference data");
    assertEquals(seen[0]?.startsWith(`["[2,4,3,3]"`), true);
  },
);

proves(
  ["0009-sql-aide FR-035", "0009-sql-aide FR-037", "0009-sql-aide FR-040", "0009-sql-aide FR-050"],
  "ISLM applies the party model from empty in every engine, finds no drift after, and a second apply changes nothing",
  async () => {
    await eachEngine(async (engine) => {
      const ctx = contexts[engine.dialect];
      const planned = async (): Promise<Plan> => {
        const catalog = await inspect(engine, ctx);
        assert(catalog.kind === "ok", catalog.kind === "err" ? catalog.error.message : "");
        if (engine.dialect === "postgres") return plan({ entities: [...partyModel, ...partyRoutines] }, catalog.value, contexts.postgres);
        if (engine.dialect === "duckdb") return plan({ entities: [...partyModel, peopleBornSince] }, catalog.value, contexts.duckdb);
        return plan({ entities: partyModel }, catalog.value, contexts.sqlite);
      };
      const first = await planned();
      assertEquals(
        first.changes.filter((c) => c.classification === "non-idempotent"),
        [],
        engine.name,
      );
      const applied = await apply(first, engine, ctx, { actor: "arca" });
      assert(applied.kind === "ok", `${engine.name}: ${JSON.stringify(applied)}`);
      const again = await planned();
      assertEquals([again.changes.map((c) => c.step), again.unplanned], [[], []], `${engine.name}: no drift`);
      assertEquals(await apply(again, engine, ctx, { actor: "arca" }), { kind: "ok", value: { ran: [] } });
      assertEquals(
        Number((await engine.query(`SELECT count(*) AS n FROM "ifcsql_ledger"`))[0]?.["n"]),
        first.changes.length,
        `${engine.name}: one entry for each change of the first apply, none for the second`,
      );
      // what ISLM made is what the model's generated tests hold it to be
      const structure = structuralTests({ tables: partyTables, views: partyViews, indexes: partyIndexes }, ctx);
      assertEquals(tally(await runAssertions(structure, engine, ctx)).failed, 0, engine.name);
    });
  },
);

proves(
  ["0009-sql-aide FR-041", "0009-sql-aide FR-047", "0009-sql-aide FR-050"],
  "the party model is written and read with the query builder, joined by its foreign keys, with the same rows in every engine",
  async () => {
    const directory = from(person)
      .join(party)
      .leftJoin(electronicContact)
      .where((s) => isNull(s.party.deleted_at))
      .select((s) => ({ id: s.person.party_id, name: s.party.display_name, email: s.electronic_contact.address }))
      .orderBy((s) => [s.person.party_id]);
    expectType<
      Equal<RowOf<typeof directory>, { readonly id: Brand<string, "party">; readonly name: string; readonly email: string | null }>
    >();
    // @ts-expect-error no foreign key joins a person to a kind of role: the join must say how
    const unrelated = (): unknown => from(person).join(partyRoleKind);
    assertEquals(typeof unrelated, "function");
    const seen: string[] = [];
    await eachEngine(async (engine) => {
      const ctx = contexts[engine.dialect];
      await engine.exec(render(definitions(partyModel), ctx));
      for (const r of partyReference) await engine.exec(render(r.load, ctx));
      const p1 = party.key("p1"),
        p2 = party.key("p2");
      await engine.exec(
        render(
          insertInto(party, [
            { party_id: p1, party_kind_code: partyKind.key("person"), display_name: "Ada Lovelace" },
            { party_id: p2, party_kind_code: partyKind.key("person"), display_name: "Alan Turing" },
          ]),
          ctx,
        ),
      );
      await engine.exec(
        render(
          insertInto(person, [
            { party_id: p1, given_name: "Ada", family_name: "Lovelace" },
            { party_id: p2, given_name: "Alan", family_name: "Turing" },
          ]),
          ctx,
        ),
      );
      await engine.exec(
        render(
          insertInto(electronicContact, [
            { electronic_contact_id: electronicContact.key("e1"), party_id: p1, medium: "email", address: "ada@example.org" },
          ]),
          ctx,
        ),
      );
      const rows = (await engine.query(render(directory, ctx))).map((r) => ({ ...r }));
      assertEquals(
        rows,
        [
          { id: "p1", name: "Ada Lovelace", email: "ada@example.org" },
          { id: "p2", name: "Alan Turing", email: null },
        ],
        engine.name,
      );
      seen.push(JSON.stringify(rows));
    });
    assertEquals(new Set(seen).size, 1);
  },
);

proves(
  ["0009-sql-aide FR-043", "0009-sql-aide FR-044", "0009-sql-aide FR-050"],
  "a transform of the party model builds in every engine, and its tests record no finding until a row is wrong",
  async () => {
    /** Each person in use with how they are reached first by email, where they are. */
    const reachable = model(
      "person_reachable",
      from(person)
        .join(party)
        .leftJoin(electronicContact)
        .where((s) => isNull(s.party.deleted_at))
        .select((s) => ({ party_id: s.person.party_id, display_name: s.party.display_name, medium: s.electronic_contact.medium })),
      { materialized: "table" },
    );
    const checks = [
      unique(reachable, ["party_id"]),
      notNull(reachable, "display_name"),
      acceptedValues(reachable, "medium", ["email", "telephone"]),
      relationship(reachable, "party_id", party, "party_id"),
    ];
    const seen: string[] = [];
    await eachEngine(async (engine) => {
      const ctx = contexts[engine.dialect];
      await engine.exec(render(definitions([...partyModel, findingsTable]), ctx));
      for (const s of SEED) await engine.exec(s);
      await engine.exec(
        `INSERT INTO "electronic_contact" ("electronic_contact_id", "party_id", "medium", "address") VALUES ('e1', 'p1', 'email', 'ada@example.org')`,
      );
      await engine.exec(render(reachable.ddl, ctx));
      await engine.exec(render(recordFindings(checks, "first"), ctx));
      assertEquals(tally(await reportFindings(checks, "first", engine, ctx)), { passed: 4, failed: 0, skipped: 0 }, engine.name);
      // a second way to reach Ada makes her appear twice, and on the web, which is not accepted here
      await engine.exec(
        `INSERT INTO "electronic_contact" ("electronic_contact_id", "party_id", "medium", "address") VALUES ('e2', 'p1', 'web', 'https://example.org')`,
      );
      await engine.exec(render(reachable.ddl, ctx));
      await engine.exec(render(recordFindings(checks, "second"), ctx));
      const second = await reportFindings(checks, "second", engine, ctx);
      seen.push(tapText(second));
      assertEquals(tally(second), { passed: 2, failed: 2, skipped: 0 }, engine.name);
    });
    assertEquals(new Set(seen).size, 1);
  },
);

proves(
  ["0009-sql-aide FR-042", "0009-sql-aide FR-050"],
  "the party model is written and read through a driver of each in-process engine, typed and decoded the same",
  async () => {
    const { DatabaseSync } = await import("node:sqlite");
    const { PGlite } = await import("@electric-sql/pglite");
    const { DuckDBInstance } = await import("@duckdb/node-api");
    const seen: string[] = [];
    const scenario = async (d: Driver<Sqlite>): Promise<void> => {
      const must = <T>(r: Result<T, DriverError>): T => {
        if (r.kind === "err") throw new Error(`${d.ctx.dialect.name}: ${r.error.message}`);
        return r.value;
      };
      must(await d.run(definitions(partyModel)));
      for (const r of partyReference) must(await d.run(r.load));
      must(await d.run(insertInto(party, [{ party_id: party.key("p1"), party_kind_code: partyKind.key("person"), display_name: "Ada" }])));
      must(
        await d.run(
          insertInto(person, [{ party_id: party.key("p1"), given_name: "Ada", family_name: "Lovelace", birth_date: "1815-12-10" }]),
        ),
      );
      const people = must(
        await d.rows(
          from(person)
            .join(party)
            .select((s) => ({ born: s.person.birth_date, made: s.party.created_at })),
        ),
      );
      expectType<Equal<(typeof people)[number], { readonly born: string | null; readonly made: Date }>>();
      assert(people[0]?.made instanceof Date, d.ctx.dialect.name);
      seen.push(JSON.stringify(people.map((p) => p.born)));
      // a person with no party is refused, as a value
      const orphan = await d.run(insertInto(person, [{ party_id: party.key("nobody"), given_name: "N", family_name: "O" }]));
      assertEquals(orphan.kind, "err", d.ctx.dialect.name);
    };
    const db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys = ON");
    try {
      await scenario(sqliteDriver(db, contexts.sqlite));
    } finally {
      db.close();
    }
    const pglite = new PGlite();
    try {
      // the scenario uses only what all three dialects have
      await scenario(pgliteDriver(pglite, contexts.postgres) as unknown as Driver<Sqlite>);
    } finally {
      await pglite.close();
    }
    const instance = await DuckDBInstance.create(":memory:");
    const connection = await instance.connect();
    try {
      await scenario(duckdbDriver(connection, contexts.duckdb) as unknown as Driver<Sqlite>);
    } finally {
      connection.closeSync();
      instance.closeSync();
    }
    assertEquals(seen, [`["1815-12-10"]`, `["1815-12-10"]`, `["1815-12-10"]`]);
  },
);

proves(
  ["0009-sql-aide FR-053", "0009-sql-aide FR-054", "0009-sql-aide FR-050"],
  "the party model's code tables are an ephemeral SQLite target: committed SQL, the same bytes twice, and a database made through a driver",
  async () => {
    const ephemeral = context({ dialect: sqlite(), durability: "ephemeral", docs: [partyDocs] });
    const build = { module: "arca/reference.ts", entities: partyCodeTables, data: partyReferenceData } as const;
    const text0 = await buildSql(build, ephemeral);
    assertEquals(await buildSql(build, ephemeral), text0);
    await golden(new URL("./golden/party-reference.auto.sql", import.meta.url), text0);
    const { DatabaseSync } = await import("node:sqlite");
    const dir = await fs.makeTempDir({ prefix: "ifcsql-arca-" });
    try {
      const database = path.join(dir, "party-reference.auto.sqlite.db");
      const made = await materialize(text0, database, (p) => {
        const db = new DatabaseSync(p);
        const d = sqliteDriver(db, ephemeral);
        return Promise.resolve({ exec: d.runner.exec, close: () => Promise.resolve(db.close()) });
      });
      assertEquals(made.kind, "ok");
      const db = new DatabaseSync(database, { readOnly: true });
      const kinds = db
        .prepare(`SELECT "code" FROM "party_kind" ORDER BY 1`)
        .all()
        .map((r) => r["code"]);
      db.close();
      assertEquals(kinds, ["organization", "person"]);
    } finally {
      await fs.remove(dir, { recursive: true });
    }
  },
);

proves(
  ["0009-sql-aide FR-035", "0009-sql-aide FR-050"],
  "applied by ISLM, the party model plans nothing when every object its catalog shows is compared with a shadow",
  async () => {
    await eachEngine(async (engine) => {
      const ctx = contexts[engine.dialect];
      const entities =
        engine.dialect === "postgres"
          ? [...partyModel, ...partyRoutines]
          : engine.dialect === "duckdb"
            ? [...partyModel, peopleBornSince]
            : partyModel;
      const empty = await anotherLike(engine);
      if (empty === undefined) return;
      try {
        // the entities are the dialect's own: the list the compiler sees is the union of three
        const sh = await shadow(entities, empty, ctx as never);
        const first = await inspect(engine, ctx);
        assert(first.kind === "ok");
        const applied = await apply(await plan({ entities }, first.value, ctx as never, { shadow: sh }), engine, ctx, { actor: "arca" });
        assert(applied.kind === "ok", JSON.stringify(applied));
        const again = await inspect(engine, ctx);
        assert(again.kind === "ok");
        const p = await plan({ entities }, again.value, ctx as never, { shadow: sh });
        assertEquals([p.changes.map((c) => c.step), p.unplanned], [[], []], engine.name);
        assert((again.value.objects?.size ?? 0) > 100, `${engine.name}: the catalog was read deeply`);
      } finally {
        await empty.close();
      }
    });
  },
  { timeout: 300_000 },
);
