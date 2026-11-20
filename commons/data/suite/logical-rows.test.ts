// Spec: 0006-logical FR-012
/**
 * The types of rows (commons data 0006-logical FR-012): computed from a concept, and held by the compiler, which checks this file; the lines marked `@ts-expect-error` are the ones that must
 * not compile. A value is typed by its attribute's datatype, a code by the names of its list, and what is optional or many by null or a list.
 *
 * @module
 */
import { assert, proves } from "@intellectual-frontiers/test";
import {
  attribute,
  binary,
  boolean,
  codeList,
  codeOf,
  concept,
  date,
  decimal,
  identifier,
  instant,
  integer,
  relationship,
  structured,
  text,
} from "@intellectual-frontiers/data/governance";
import { electronicContact, party, partyRelation, partyRole, person, postalAddress } from "@intellectual-frontiers/data/models/arca";
import type { InsertOf, KeyOf, RowOf, ValueOf } from "@intellectual-frontiers/data/sql/logical";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

const kinds = codeList("kinds", { definition: "k", codes: { alpha: { label: "A" }, beta: { label: "B" } } });
const shapes = concept("shapes", {
  definition: "every shape of attribute",
  attributes: {
    shapeId: attribute(identifier(), { definition: "i" }),
    name: attribute(text(), { definition: "n" }),
    count: attribute(integer(), { definition: "c" }),
    price: attribute(decimal({ precision: 9, scale: 2 }), { definition: "p" }),
    live: attribute(boolean(), { definition: "l" }),
    since: attribute(date(), { definition: "s", multiplicity: "optional" }),
    seen: attribute(instant(), { definition: "s" }),
    extra: attribute(structured(), { definition: "e" }),
    bytes: attribute(binary(), { definition: "b" }),
    kind: attribute(codeOf(kinds), { definition: "k" }),
    tags: attribute(text(), { definition: "t", multiplicity: "many" }),
  },
  identifiedBy: ["shapeId"],
});
const link = concept("link", {
  definition: "relationships of every cardinality",
  attributes: { linkId: attribute(identifier(), { definition: "i" }) },
  identifiedBy: ["linkId"],
  relationships: {
    one: relationship(shapes, { cardinality: "one", definition: "o" }),
    maybe: relationship(shapes, { cardinality: "optional", definition: "m" }),
    lots: relationship(() => shapes, { cardinality: "many", definition: "l" }),
  },
});
const pair = concept("pair", {
  definition: "a key of two",
  attributes: { left: attribute(identifier(), { definition: "l" }), right: attribute(integer(), { definition: "r" }) },
  identifiedBy: ["left", "right"],
});

proves(
  ["0006-logical FR-012"],
  "the value of an attribute is typed by its datatype, a code by the names of its list, an optional one by null and a many one by a list",
  () => {
    const row: RowOf<typeof shapes> = {
      shapeId: "s1",
      name: "n",
      count: 1,
      price: "9.99",
      live: true,
      since: null,
      seen: "2026-11-18T10:00:00Z",
      extra: { any: 1 },
      bytes: new Uint8Array([1]),
      kind: "alpha",
      tags: ["a", "b"],
    };
    const exact: boolean[] = [
      true satisfies Equal<RowOf<typeof shapes>["count"], number>,
      true satisfies Equal<RowOf<typeof shapes>["since"], string | null>,
      true satisfies Equal<RowOf<typeof shapes>["kind"], "alpha" | "beta">,
      true satisfies Equal<RowOf<typeof shapes>["tags"], readonly string[]>,
      true satisfies Equal<RowOf<typeof shapes>["bytes"], Uint8Array>,
      true satisfies Equal<ValueOf<ReturnType<typeof decimal>>, string>,
    ];
    assert(exact.every(Boolean) && row.kind === "alpha");
    // @ts-expect-error a count is a number
    const wrong: RowOf<typeof shapes> = { ...row, count: "1" };
    // @ts-expect-error a code is one of the names of its list
    const wrong2: RowOf<typeof shapes> = { ...row, kind: "gamma" };
    // @ts-expect-error an optional attribute is null, not undefined
    const wrong3: RowOf<typeof shapes> = { ...row, since: undefined };
    // @ts-expect-error a required attribute is not null
    const wrong4: RowOf<typeof shapes> = { ...row, name: null };
    assert([wrong, wrong2, wrong3, wrong4].length === 4);
  },
);

proves(
  ["0006-logical FR-012"],
  "a relationship holds the key of what it points to, null where it is optional and a list where it is many",
  () => {
    const row: RowOf<typeof link> = { linkId: "l", one: "s1", maybe: null, lots: ["s1", "s2"] };
    assert(row.lots.length === 2);
    // @ts-expect-error a relationship of cardinality one is its target's key
    const wrong: RowOf<typeof link> = { ...row, one: null };
    // @ts-expect-error a relationship of cardinality many is a list
    const wrong2: RowOf<typeof link> = { ...row, lots: "s1" };
    assert([wrong, wrong2].length === 2);
  },
);

proves(
  ["0006-logical FR-012"],
  "the key of a concept is its identifying member's value, a record where there are several, and a specialization's is its party's",
  () => {
    const keys: boolean[] = [
      true satisfies Equal<KeyOf<typeof shapes>, string>,
      true satisfies Equal<KeyOf<typeof person>, string>,
      true satisfies Equal<KeyOf<typeof party>, string>,
      true satisfies Equal<KeyOf<typeof partyRole>, string>,
      true satisfies Equal<KeyOf<typeof pair>, { readonly left: string; readonly right: number }>,
    ];
    assert(keys.every(Boolean));
    const k: KeyOf<typeof pair> = { left: "l", right: 1 };
    // @ts-expect-error a key of two members is a record of both
    const wrong: KeyOf<typeof pair> = "l";
    assert(k.right === 1 && typeof wrong === "string");
  },
);

proves(["0006-logical FR-012"], "Arca's rows are typed by what the model says: its codes, its optional attributes and its party", () => {
  const person1: RowOf<typeof person> = { givenName: "Ada", familyName: "Lovelace", birthDate: null, party: "01J" };
  const contact: RowOf<typeof electronicContact> = {
    electronicContactId: "e",
    medium: "email",
    address: "a@b.c",
    isPrimary: false,
    party: "01J",
  };
  const role: RowOf<typeof partyRole> = { partyRoleId: "r", kind: "customer", validFrom: "2026-01-01", validTo: null, party: "01J" };
  const relation: RowOf<typeof partyRelation> = {
    partyRelationId: "x",
    kind: "employedBy",
    validFrom: "2026-01-01",
    validTo: null,
    from: "01J",
    to: "02K",
  };
  const address: RowOf<typeof postalAddress> = {
    postalAddressId: "a",
    purpose: "home",
    line1: "1 Main",
    line2: null,
    locality: "Town",
    region: null,
    postalCode: null,
    countryCode: "GB",
    party: "01J",
  };
  assert([person1, contact, role, relation, address].length === 5);
  // @ts-expect-error fax is not a medium of Arca
  const fax: RowOf<typeof electronicContact> = { ...contact, medium: "fax" };
  // @ts-expect-error a relation has a first and a second party, not a party
  const odd: RowOf<typeof partyRelation> = { ...relation, party: "01J" };
  assert([fax, odd].length === 2);
});

proves(["0006-logical FR-012"], "a row to insert may leave out what is optional or many, and nothing else", () => {
  const ins: InsertOf<typeof person> = { givenName: "Ada", familyName: "Lovelace", party: "01J" };
  const full: InsertOf<typeof person> = { ...ins, birthDate: "1815-12-10" };
  const link1: InsertOf<typeof link> = { linkId: "l", one: "s1" };
  assert(full.birthDate === "1815-12-10" && link1.one === "s1");
  // @ts-expect-error a required attribute may not be left out
  const missing: InsertOf<typeof person> = { givenName: "Ada", party: "01J" };
  // @ts-expect-error a relationship of cardinality one may not be left out
  const missing2: InsertOf<typeof link> = { linkId: "l" };
  assert([missing, missing2].length === 2);
});
