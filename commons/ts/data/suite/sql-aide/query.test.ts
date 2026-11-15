/**
 * The query builder: rows inferred through joins, projections, common table expressions and set operations; joins taken from foreign
 * keys; and inserts, updates, deletes and upserts typed by the table, with `returning` (commons 0009-sql-aide FR-041).
 *
 * @module
 */
import type { Brand, Equal } from "../../../kernel/mod.ts";
import { expectType } from "../../../kernel/mod.ts";
import { assert, assertEquals, assertThrows, proves } from "../../../runtime/test.ts";
import {
  context,
  cte,
  definitions,
  deleteFrom,
  desc,
  duckdb,
  eq,
  except,
  fk,
  from,
  insertInto,
  integer,
  intersect,
  isNull,
  pk,
  postgres,
  render,
  type RowOf,
  type Sql,
  sqlite,
  table,
  text,
  union,
  unionAll,
  update,
  valueAs,
  SQL,
  withCtes,
} from "../../sql-aide/mod.ts";
import { eachEngine, golden } from "../helpers.ts";

const pg = context({ dialect: postgres() }),
  lite = context({ dialect: sqlite() }),
  duck = context({ dialect: duckdb() });
const contexts = { postgres: pg, sqlite: lite, duckdb: duck };

const kind = table("kind", { code: pk.text(), label: text() });
const party = table("party", { party_id: pk.text(), kind_code: fk(kind.c.code), name: text() });
const person = table("person", { party_id: fk(party.c.party_id).primaryKey(), given: text(), height: integer().nullable() });
const note = table("note", { note_id: pk.text(), about: fk(party.c.party_id), body: text() });
const knows = table("knows", { from_id: fk(party.c.party_id), to_id: fk(party.c.party_id) });
const loner = table("loner", { id: pk.text(), name: text() });
const model = [kind, party, person, note, knows, loner] as const;

const peopleWithParty = from(person)
  .join(party)
  .select((s) => ({ id: s.person.party_id, name: s.party.name, height: s.person.height }))
  .orderBy((s) => [s.person.party_id]);
const notesOfParties = from(party)
  .leftJoin(note)
  .select((s) => ({ name: s.party.name, body: s.note.body }))
  .orderBy((s) => [s.party.name, s.note.body]);

proves(
  ["0009-sql-aide FR-041", "0009-sql-aide FR-008"],
  "a query's rows are inferred through joins, projections and set operations",
  () => {
    expectType<
      Equal<RowOf<typeof peopleWithParty>, { readonly id: Brand<string, "party">; readonly name: string; readonly height: number | null }>
    >();
    expectType<Equal<RowOf<typeof notesOfParties>, { readonly name: string; readonly body: string | null }>>();
    expectType<Equal<RowOf<ReturnType<typeof from<"kind", typeof kind.c>>>["code"], Brand<string, "kind">>>();
    // the controls: a join on a condition of one type, and a union of one row
    const onCondition = from(person).join(loner, (s) => eq(s.loner.name, s.person.given));
    const names = union(
      from(party).select((s) => ({ name: s.party.name })),
      from(loner).select((s) => ({ name: s.loner.name })),
    );
    expectType<Equal<RowOf<typeof names>, { readonly name: string }>>();
    // @ts-expect-error no foreign key joins a person to a loner, so the join needs its condition
    const noKey = (): unknown => from(person).join(loner);
    // @ts-expect-error a party's key is not a loner's key
    const crossed = (): unknown => from(person).join(loner, (s) => eq(s.loner.id, s.person.party_id));
    // @ts-expect-error a person has no column surname
    const noColumn = (): unknown => from(person).select((s) => ({ x: s.person.surname }));
    // @ts-expect-error a party's name is text, and 1 is not
    const wrongValue = (): unknown => from(party).where((s) => eq(s.party.name, 1));
    // @ts-expect-error the person is not in the scope until it is joined
    const notJoined = (): unknown => from(party).select((s) => ({ x: s.person.given }));
    const mismatch = (): unknown =>
      union(
        from(party).select((s) => ({ name: s.party.name })),
        // @ts-expect-error a union is of queries that give the same row
        from(person).select((s) => ({ name: s.person.height })),
      );
    assertEquals(
      [noKey, crossed, noColumn, wrongValue, notJoined, mismatch].map((f) => typeof f),
      Array.from({ length: 6 }, () => "function"),
    );
    // a compound operand keeps its meaning: DuckDB refuses `a > 1 = TRUE` as a chained comparison
    assertEquals(render(eq(valueAs<boolean>()(SQL`1 > 0`), true), pg), "(1 > 0) = TRUE");
    assert(render(onCondition, pg).includes(`JOIN "loner" ON "loner"."name" = "person"."given"`));
    // two foreign keys join knows to party: the join must say which
    assertThrows(() => render(from(party).join(knows), pg), Error, "2 foreign keys");
    assertThrows(
      () =>
        union(
          from(party).select((s) => ({ a: s.party.name, b: s.party.name })),
          from(party).select((s) => ({ b: s.party.name, a: s.party.name })),
        ),
      Error,
      "columns differ",
    );
  },
);

proves(
  ["0009-sql-aide FR-041", "0009-sql-aide FR-007"],
  "inserts, updates and deletes are typed by the table, and returning by what it gives",
  () => {
    const added = insertInto(party, [{ party_id: party.key("p9"), kind_code: kind.key("person"), name: "Ada" }]).returning((c) => ({
      id: c.party_id,
      name: c.name,
    }));
    expectType<Equal<RowOf<typeof added>, { readonly id: Brand<string, "party">; readonly name: string }>>();
    const changed = update(person, { height: null, given: "Ada" })
      .where((c) => eq(c.party_id, party.key("p9")))
      .returning((c) => ({ height: c.height }));
    expectType<Equal<RowOf<typeof changed>, { readonly height: number | null }>>();
    // @ts-expect-error a party must be given its name
    const nameless = (): unknown => insertInto(party, [{ party_id: party.key("p1"), kind_code: kind.key("person") }]);
    // @ts-expect-error a person's key is a party's key, which a plain string is not
    const plainKey = (): unknown => insertInto(person, [{ party_id: "p1", given: "Ada" }]);
    // @ts-expect-error a height is a number
    const wrongSet = (): unknown => update(person, { height: "tall" });
    // @ts-expect-error an update that has not said which rows is not a statement
    const unbounded = (): unknown => render(update(person, { height: 1 }), pg);
    // @ts-expect-error a conflict is on columns of the table
    const badConflict = (): unknown => insertInto(kind, [{ code: kind.key("a"), label: "A" }]).onConflictDoNothing(["nope"]);
    assertEquals(
      [nameless, plainKey, wrongSet, unbounded, badConflict].map((f) => typeof f),
      Array.from({ length: 5 }, () => "function"),
    );
    assertEquals(render(deleteFrom(loner).everyRow(), lite), `DELETE FROM "loner"`);
  },
);

const bigPeople = cte(
  "big_people",
  from(person)
    .where((s) => eq(valueAs<boolean>()(SQL`${s.person.height} > 180`), true))
    .select((s) => ({ id: s.person.party_id })),
);
const withBig = withCtes(
  [bigPeople],
  from(bigPeople)
    .join(party, (s) => eq(s.party.party_id, s.big_people.id))
    .select((s) => ({ name: s.party.name })),
);

proves(["0009-sql-aide FR-041", "0009-sql-aide FR-015"], "what the builder renders is what is committed", async () => {
  for (const [dialect, ctx] of Object.entries(contexts)) {
    const parts = [
      render(peopleWithParty, ctx),
      render(notesOfParties, ctx),
      render(withBig, ctx),
      render(
        except(
          from(party).select((s) => ({ id: s.party.party_id })),
          from(person).select((s) => ({ id: s.person.party_id })),
        ),
        ctx,
      ),
      render(
        insertInto(kind, [
          { code: kind.key("person"), label: "Person" },
          { code: kind.key("org"), label: "Organization" },
        ]).onConflictDoUpdate(["code"]),
        ctx,
      ),
      render(
        update(person, { height: valueAs<number>()(SQL`${person.c.height.bare} + 1`) })
          .where((c) => eq(c.given, "Ada"))
          .returning((c) => ({ id: c.party_id })),
        ctx,
      ),
      render(
        deleteFrom(note)
          .where((c) => eq(c.body, ""))
          .returning((c) => ({ id: c.note_id })),
        ctx,
      ),
    ];
    await golden(new URL(`./golden/queries.${dialect}.sql`, import.meta.url), `${parts.join(";\n\n")};\n`);
  }
});

proves(
  ["0009-sql-aide FR-041", "0009-sql-aide FR-040"],
  "the builder's statements run in every engine and give the same rows",
  async () => {
    const seen: string[] = [];
    await eachEngine(async (engine) => {
      const ctx = contexts[engine.dialect];
      const q = async (
        s: Sql<"statement", unknown, "returning" | "cte" | "upsert", string>,
      ): Promise<readonly Readonly<Record<string, unknown>>[]> =>
        (await engine.query(render(s, ctx))).map((r) =>
          Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "bigint" ? Number(v) : v])),
        );
      await engine.exec(render(definitions(model), ctx));
      const kinds = insertInto(kind, [
        { code: kind.key("person"), label: "Person" },
        { code: kind.key("org"), label: "Org" },
      ]);
      await engine.exec(render(kinds, ctx));
      // an upsert: a row whose key is there is changed, run twice it is the same
      const relabel = insertInto(kind, [{ code: kind.key("org"), label: "Organization" }]).onConflictDoUpdate(["code"]);
      await engine.exec(render(relabel, ctx));
      await engine.exec(render(relabel, ctx));
      await engine.exec(render(insertInto(kind, [{ code: kind.key("org"), label: "ignored" }]).onConflictDoNothing(["code"]), ctx));
      const inserted = await q(
        insertInto(party, [
          { party_id: party.key("p1"), kind_code: kind.key("person"), name: "Ada" },
          { party_id: party.key("p2"), kind_code: kind.key("person"), name: "Alan" },
          { party_id: party.key("o1"), kind_code: kind.key("org"), name: "Engines" },
        ]).returning((c) => ({ id: c.party_id })),
      );
      await engine.exec(
        render(
          insertInto(person, [
            { party_id: party.key("p1"), given: "Ada", height: 165 },
            { party_id: party.key("p2"), given: "Alan", height: 190 },
          ]),
          ctx,
        ),
      );
      await engine.exec(
        render(
          insertInto(note, [
            { note_id: note.key("n1"), about: party.key("p1"), body: "first programmer" },
            { note_id: note.key("n2"), about: party.key("p2"), body: "scratch" },
          ]),
          ctx,
        ),
      );
      const raised = await q(
        update(person, { height: valueAs<number>()(SQL`${person.c.height.bare} + 1`) })
          .where((c) => eq(c.given, "Alan"))
          .returning((c) => ({ id: c.party_id, height: c.height })),
      );
      const removed = await q(
        deleteFrom(note)
          .where((c) => eq(c.body, "scratch"))
          .returning((c) => ({ id: c.note_id })),
      );
      const results = {
        kinds: await q(from(kind).orderBy((s) => [s.kind.code])),
        inserted: [...inserted].sort((a, b) => String(a["id"]).localeCompare(String(b["id"]))),
        raised,
        removed,
        people: await q(peopleWithParty),
        notes: await q(notesOfParties),
        big: await q(withBig),
        noNotes: await q(
          from(party)
            .leftJoin(note)
            .where((s) => isNull(s.note.note_id))
            .select((s) => ({ id: s.party.party_id }))
            .orderBy((s) => [desc(s.party.party_id)]),
        ),
        both: (
          await q(
            intersect(
              from(party).select((s) => ({ id: s.party.party_id })),
              from(person).select((s) => ({ id: s.person.party_id })),
            ),
          )
        )
          .map((r) => String(r["id"]))
          .sort(),
        all: (
          await q(
            unionAll(
              from(party).select((s) => ({ id: s.party.party_id })),
              from(person).select((s) => ({ id: s.person.party_id })),
            ),
          )
        ).length,
        limited: await q(
          from(party)
            .distinct()
            .select((s) => ({ kind: s.party.kind_code }))
            .orderBy((s) => [s.party.kind_code])
            .limit(1),
        ),
      };
      assertEquals(
        results.people,
        [
          { id: "p1", name: "Ada", height: 165 },
          { id: "p2", name: "Alan", height: 191 },
        ],
        engine.name,
      );
      assertEquals(
        results.notes,
        [
          { name: "Ada", body: "first programmer" },
          { name: "Alan", body: null },
          { name: "Engines", body: null },
        ],
        engine.name,
      );
      assertEquals(results.big, [{ name: "Alan" }], engine.name);
      assertEquals([results.removed, results.both], [[{ id: "n2" }], ["p1", "p2"]], engine.name);
      assertEquals(
        results.kinds,
        [
          { code: "org", label: "Organization" },
          { code: "person", label: "Person" },
        ],
        engine.name,
      );
      seen.push(JSON.stringify(results));
      console.log(engine.name, JSON.stringify(results));
    });
    assertEquals(new Set(seen).size, 1, "every engine gives the same rows");
  },
);
