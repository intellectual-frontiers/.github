/**
 * What the compiler holds: row types computed from columns, names as literal types, keys branded by their table, and what does not
 * compile (commons 0006-sql-aide FR-006 to FR-008, FR-010, FR-011, FR-013). Each kind of check has a control that does compile.
 *
 * @module
 */
import type { Brand, Equal } from "../../../kernel/mod.ts";
import { expectType } from "../../../kernel/mod.ts";
import { assertEquals, assertThrows, proves } from "../../../runtime/test.ts";
import {
  arrayOf,
  bind,
  boolean,
  context,
  date,
  duckdb,
  eq,
  fk,
  integer,
  json,
  type NewRowOf,
  now,
  oneOf,
  type PatchOf,
  pk,
  postgres,
  render,
  type RowOf,
  self,
  SQL,
  sqlite,
  table,
  text,
  timestamptz,
} from "../../sql-aide/mod.ts";

const party = table("party", {
  party_id: pk.ulid(),
  kind: oneOf(["person", "organization"]),
  parent_id: self("party_id").nullable(),
  created_at: timestamptz().default(now),
  note: text().nullable(),
  seq: integer().generatedAs(SQL`1`),
});
const person = table("person", {
  party_id: fk(party.c.party_id).primaryKey(),
  last_name: text(),
  born: date().nullable(),
  active: boolean().default(true),
  extra: json<{ readonly nick: string }>().nullable(),
});
type PartyId = Brand<string, "party">;

proves(
  ["0006-sql-aide FR-006", "0006-sql-aide FR-007", "0006-sql-aide FR-008"],
  "the rows of a table are computed from its columns",
  () => {
    expectType<
      Equal<
        RowOf<typeof party>,
        {
          readonly party_id: PartyId;
          readonly kind: "person" | "organization";
          readonly parent_id: PartyId | null;
          readonly created_at: Date;
          readonly note: string | null;
          readonly seq: number;
        }
      >
    >();
    // on insert: the key and the kind must be given; what has a default or may be null may be; a generated column is not there
    const minimal: NewRowOf<typeof party> = { party_id: party.key("01H"), kind: "person" };
    const full: NewRowOf<typeof party> = {
      party_id: party.key("01H"),
      kind: "organization",
      parent_id: null,
      created_at: new Date(0),
      note: "n",
    };
    // @ts-expect-error the kind is required on insert and is missing here
    const missing: NewRowOf<typeof party> = { party_id: party.key("01H") };
    // @ts-expect-error a generated column is not in the row inserted
    const generated: NewRowOf<typeof party> = { party_id: party.key("01H"), kind: "person", seq: 1 };
    // @ts-expect-error the kind is one of two words, and this is neither
    const wrongWord: NewRowOf<typeof party> = { party_id: party.key("01H"), kind: "company" };
    const patch: PatchOf<typeof party> = { note: null };
    assertEquals(
      [minimal.kind, full.kind, missing.party_id, generated.kind, wrongWord.party_id, patch.note],
      ["person", "organization", "01H", "person", "01H", null],
    );
    expectType<Equal<RowOf<typeof person>["extra"], { readonly nick: string } | null>>();
  },
);

proves(
  ["0006-sql-aide FR-008"],
  "a key is branded by its table, a foreign key has the type of what it points to, and names are checked",
  () => {
    // a person's key is a party's key: it is not branded a second time
    expectType<Equal<RowOf<typeof person>["party_id"], PartyId>>();
    const id: PartyId = party.key("01H");
    // @ts-expect-error a plain string is not a party's key
    const plain: PartyId = "01H";
    assertEquals([id, plain], ["01H", "01H"]);
    assertEquals(person.c.party_id.table, "person");
    // @ts-expect-error party has no column named nope, so nothing can point to it
    const noColumn = (): unknown => fk(party.c.nope);
    assertThrows(noColumn);
    // @ts-expect-error a self-reference names a column the table does not have
    assertThrows(() => table("t", { id: pk.ulid(), parent: self("nope") }));
    const ok = table("t", { id: pk.ulid(), parent: self("id") });
    assertEquals(
      ok.spec.columns.map(([n]) => n),
      ["id", "parent"],
    );
  },
);

proves(["0006-sql-aide FR-013"], "a plain string is not an interpolation, and expressions compare only values of one type", () => {
  const typed = "it's";
  // @ts-expect-error a string a person typed must be bound or marked raw, never interpolated
  const bad = (): unknown => SQL`select ${typed}`;
  assertEquals(render(SQL`select ${bind(typed)}`, context({ dialect: postgres() })), "select 'it''s'");
  assertEquals(typeof bad, "function");
  const sameType = eq(person.c.last_name, "Lovelace");
  // @ts-expect-error a date column is text in TypeScript and is not compared with a number
  const wrongType = (): unknown => eq(person.c.born, 5);
  // @ts-expect-error a key is compared with a key of its table, not with a plain string
  const unbranded = (): unknown => eq(person.c.party_id, "01H");
  const branded = eq(person.c.party_id, party.c.party_id);
  assertEquals(
    [sameType.sqlKind, branded.sqlKind, typeof wrongType, typeof unbranded],
    ["expression", "expression", "function", "function"],
  );
});

proves(["0006-sql-aide FR-010"], "what a dialect lacks is a compile error where the model is rendered for it", () => {
  const tagged = table("tagged", { id: pk.ulid(), tags: arrayOf(text()) });
  const child = table("child", { id: pk.ulid(), party_id: fk(party.c.party_id).on("delete", "cascade") });
  const pg = context({ dialect: postgres() }),
    lite = context({ dialect: sqlite() }),
    duck = context({ dialect: duckdb() });
  assertEquals(render(tagged.ddl, pg).includes(`"tags" TEXT[] NOT NULL`), true);
  assertEquals(render(tagged.ddl, duck).includes(`"tags" VARCHAR[] NOT NULL`), true);
  // @ts-expect-error sqlite has no arrays, so a table with an array column does not render for it
  render(tagged.ddl, lite);
  assertEquals(render(child.ddl, lite).includes("ON DELETE CASCADE"), true);
  // @ts-expect-error duckdb has no foreign-key actions, so this table does not render for it
  render(child.ddl, duck);
  // the control: a table that needs nothing renders for all three, and for a context that may be any of them
  for (const ctx of [pg, lite, duck]) assertEquals(render(person.ddl, ctx).startsWith("CREATE TABLE"), true);
});
