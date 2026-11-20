/**
 * Stored routines defined in TypeScript: signatures from columns and relations, bodies the compiler checks, and one definition for three
 * dialects (commons 0009-sql-aide FR-020, FR-021).
 *
 * @module
 */
import type { Equal } from "../../../kernel/mod.ts";
import { expectType } from "../../../kernel/mod.ts";
import { assert, assertEquals, assertRejects, assertStringIncludes, assertThrows, proves } from "@intellectual-frontiers/test";
import {
  context,
  date,
  definitions,
  duckdb,
  eq,
  fn,
  gte,
  integer,
  pk,
  postgres,
  proc,
  raw,
  render,
  rowsAs,
  rowsOf,
  scalar,
  select,
  setOf,
  SQL,
  sqlite,
  table,
  text,
  trigger,
  valueAs,
} from "../../sql-aide/mod.ts";
import { eachEngine, golden, pgliteEngine, sqliteEngine } from "../helpers.ts";

const pg = context({ dialect: postgres() }),
  lite = context({ dialect: sqlite() }),
  duck = context({ dialect: duckdb() });
const contexts = { postgres: pg, sqlite: lite, duckdb: duck };

const person = table("person", {
  person_id: pk.text(),
  given_name: text(),
  family_name: text(),
  born: date().nullable(),
  retired_by: text().nullable(),
});
const audit = table("audit", { what: text(), who: text() });

/** The initials of a name, in capitals. */
const initials = fn("initials", {
  args: { given: text(), family: text() },
  returns: scalar(text()),
  volatility: "immutable",
  body: ({ given, family }) => valueAs<string>()(SQL`upper(substr(${given}, 1, 1) || substr(${family}, 1, 1))`),
});

/** The people born on or after a day. */
const bornSince = fn("born_since", {
  args: { since: date() },
  returns: setOf(person),
  volatility: "stable",
  body: ({ since }) => select(person).where(gte(person.c.born, since)),
});

/** How many people share a family name; it says so when there are none. */
const familySize = fn("family_size", {
  args: { family: text() },
  returns: scalar(integer()),
  uses: [person],
  body: ({ family }, pl) => {
    const n = pl.declare("n", integer(), 0);
    return pl.block(
      pl.run(SQL`SELECT count(*) INTO ${n} FROM ${person} WHERE ${eq(person.c.family_name, family)}`),
      pl.when(eq(n, 0), [pl.notice("nobody is called %", family)]),
      pl.ret(n),
    );
  },
});

/** Marks a person as retired, and refuses a person who is not there. */
const retire = proc("retire_person", {
  args: { id: text(), by: text() },
  uses: [person],
  body: ({ id, by }, pl) =>
    pl.block(
      pl.run(SQL`UPDATE ${person} SET "retired_by" = ${by} WHERE ${person.c.person_id.bare} = ${id}`),
      pl.when(pl.notFound, [pl.raise("no person %", id)]),
    ),
});

/** Each family name with how many people have it. */
const families = fn("families", {
  args: {},
  returns: rowsOf({ family_name: text(), people: integer() }),
  body: () =>
    rowsAs<{ readonly family_name: string; readonly people: number }>()(SQL`SELECT "family_name", count(*)::int FROM ${person} GROUP BY 1`),
});

proves(["0009-sql-aide FR-020"], "a routine's body must give what the routine returns, and a call is typed by its arguments", () => {
  expectType<
    Equal<Parameters<typeof initials.call>[0]["given"] extends string | { readonly sqlKind: "expression" } ? true : false, true>
  >();
  // @ts-expect-error a function declared to return people cannot return the rows of another table
  const wrongRows = (): unknown => fn("f", { args: {}, returns: setOf(person), body: () => select(audit) });
  // @ts-expect-error a function declared to return text cannot return a number
  const wrongValue = (): unknown => fn("f", { args: {}, returns: scalar(text()), body: () => valueAs<number>()(SQL`1`) });
  // @ts-expect-error a block's ret is held to what the function returns
  const wrongRet = (): unknown => fn("f", { args: {}, returns: scalar(integer()), body: (_, pl) => pl.block(pl.ret("text")) });
  const wrongSet = (): unknown =>
    // @ts-expect-error a variable is assigned a value of its own type
    fn("f", { args: {}, returns: scalar(integer()), body: (_, pl) => pl.block(pl.set(pl.declare("n", integer()), "text"), pl.ret(1)) });
  // @ts-expect-error since is a date, which is text in TypeScript, and a number is not one
  const wrongArg = (): unknown => bornSince.call({ since: 1800 });
  // @ts-expect-error a call names every argument
  const missingArg = (): unknown => initials.call({ given: "a" });
  assertEquals(
    [wrongRows, wrongValue, wrongRet, wrongSet, wrongArg, missingArg].map((f) => typeof f),
    Array.from({ length: 6 }, () => "function"),
  );
  assertThrows(
    () => fn("no_end", { args: {}, returns: scalar(integer()), body: (_, pl) => pl.block(pl.when(pl.found, [pl.ret(1)])) }),
    Error,
    "does not end by returning or raising on every path",
  );
});

proves(
  ["0009-sql-aide FR-021", "0009-sql-aide FR-010"],
  "a definition renders for the dialects that can hold it, and a call for those that can run it",
  () => {
    assertStringIncludes(
      render(initials.ddl, duck),
      `CREATE OR REPLACE MACRO "initials"("given", "family") AS (upper(substr("given", 1, 1) || substr("family", 1, 1)));`,
    );
    assertStringIncludes(
      render(bornSince.ddl, duck),
      `CREATE OR REPLACE MACRO "born_since"("since") AS TABLE SELECT * FROM "person" WHERE "person"."born" >= "since";`,
    );
    // @ts-expect-error sqlite stores no functions: the definition has no case for it
    assertThrows(() => render(initials.ddl, lite));
    // @ts-expect-error a block is PL/pgSQL, so the function is PostgreSQL's alone
    assertThrows(() => render(familySize.ddl, duck));
    // @ts-expect-error and a call of it has no case for sqlite
    assertThrows(() => render(familySize.call({ family: "x" }), lite));
    // @ts-expect-error a procedure is PostgreSQL's alone
    assertThrows(() => render(retire.ddl, duck));
    // a function whose body is a query is written in where it is called, for sqlite
    assertEquals(
      render(initials.call({ given: "ada", family: "lovelace" }), lite),
      `(upper(substr('ada', 1, 1) || substr('lovelace', 1, 1)))`,
    );
    assertEquals(render(initials.call({ given: person.c.given_name, family: "x" }), pg), `"initials"("person"."given_name", 'x')`);
    assertEquals(render(retire.call({ id: "p1", by: "me" }), pg), `CALL "retire_person"('p1', 'me')`);
  },
);

proves(["0009-sql-aide FR-020", "0009-sql-aide FR-015"], "the routines emitted for PostgreSQL are what is committed", async () => {
  await golden(
    new URL("./golden/routines.postgres.sql", import.meta.url),
    `${render(definitions([retire, families, familySize, bornSince, initials, person]), pg)}\n`,
  );
});

proves(
  ["0009-sql-aide FR-020", "0009-sql-aide FR-021"],
  "one definition gives the same answers in PostgreSQL, DuckDB and SQLite",
  async () => {
    const seen: string[] = [];
    await eachEngine(async (engine) => {
      const ctx = contexts[engine.dialect];
      await engine.exec(render(person.ddl, ctx));
      if (engine.dialect === "postgres") await engine.exec(render(definitions([bornSince, initials]), pg));
      if (engine.dialect === "duckdb") await engine.exec(render(definitions([bornSince, initials]), duck));
      await engine.exec(
        `INSERT INTO "person" ("person_id", "given_name", "family_name", "born") VALUES ('p1', 'ada', 'lovelace', '1815-12-10'), ('p2', 'alan', 'turing', '1912-06-23')`,
      );
      const call = SQL`SELECT ${initials.call({ given: "ada", family: "lovelace" })} AS v`;
      const rowsQuery = SQL`SELECT "person_id" FROM ${bornSince.call({ since: "1900-01-01" })} AS born ORDER BY 1`;
      const expression =
        engine.dialect === "sqlite" ? render(call, lite) : engine.dialect === "duckdb" ? render(call, duck) : render(call, pg);
      const relation =
        engine.dialect === "sqlite"
          ? render(rowsQuery, lite)
          : engine.dialect === "duckdb"
            ? render(rowsQuery, duck)
            : render(rowsQuery, pg);
      seen.push(JSON.stringify([(await engine.query(expression))[0]?.["v"], (await engine.query(relation)).map((r) => r["person_id"])]));
    });
    assertEquals([...new Set(seen)], [JSON.stringify(["AL", ["p2"]])]);
  },
);

proves(["0009-sql-aide FR-020"], "blocks, procedures and row-returning functions run in PostgreSQL as written", async () => {
  const engine = await pgliteEngine();
  try {
    const ddl = render(definitions([retire, families, familySize, bornSince, initials, person]), pg);
    await engine.exec(ddl);
    await engine.exec(ddl); // defining a routine again replaces it
    await engine.exec(
      `INSERT INTO "person" ("person_id", "given_name", "family_name") VALUES ('p1', 'ada', 'lovelace'), ('p2', 'anne', 'lovelace')`,
    );
    assertEquals((await engine.query(render(SQL`SELECT ${familySize.call({ family: "lovelace" })} AS n`, pg)))[0]?.["n"], 2);
    assertEquals((await engine.query(render(SQL`SELECT ${familySize.call({ family: "nobody" })} AS n`, pg)))[0]?.["n"], 0);
    assertEquals(await engine.query(render(select(families.call({})), pg)), [{ family_name: "lovelace", people: 2 }]);
    await engine.exec(render(retire.call({ id: "p1", by: "the test" }), pg));
    assertEquals((await engine.query(`SELECT "retired_by" FROM "person" WHERE "person_id" = 'p1'`))[0]?.["retired_by"], "the test");
    await assertRejects(() => engine.exec(render(retire.call({ id: "nobody", by: "x" }), pg)), Error, "no person nobody");
  } finally {
    await engine.close();
  }
});

proves(["0009-sql-aide FR-021"], "a trigger of statements runs in PostgreSQL and in SQLite", async () => {
  const log = trigger("person_audit", person, { timing: "after", events: ["insert", "update"] }, (row) => [
    SQL`INSERT INTO ${audit} ("what", "who") VALUES (${row.new.person_id}, ${row.new.family_name})`,
  ]);
  // @ts-expect-error duckdb has no triggers
  assertThrows(() => render(log.ddl, duck));
  for (const [engine, ctx] of [
    [await pgliteEngine(), pg],
    [await sqliteEngine(), lite],
  ] as const) {
    try {
      const ddl =
        engine.dialect === "postgres" ? render(definitions([log, audit, person]), pg) : render(definitions([log, audit, person]), lite);
      await engine.exec(ddl);
      await engine.exec(ddl);
      await engine.exec(`INSERT INTO "person" ("person_id", "given_name", "family_name") VALUES ('p1', 'ada', 'lovelace')`);
      await engine.exec(`UPDATE "person" SET "family_name" = 'king' WHERE "person_id" = 'p1'`);
      assertEquals(
        (await engine.query(`SELECT "who" FROM "audit" ORDER BY 1`)).map((r) => r["who"]),
        ["king", "lovelace"],
        ctx.dialect.name,
      );
    } finally {
      await engine.close();
    }
  }
  assert(render(log.ddl, lite).includes(`CREATE TRIGGER "person_audit_insert" AFTER INSERT ON "person" FOR EACH ROW BEGIN`));
  assert(raw("x").sqlKind === "fragment");
});
