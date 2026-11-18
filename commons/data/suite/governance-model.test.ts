// Spec: 0003-governance FR-001, FR-002, FR-003, FR-004
/**
 * The model of governance (commons data 0003-governance FR-001 to FR-004): the constructors are total, a datatype is a union matched exhaustively, the names of a concept are literal
 * types, and `domain` returns the domain or every error together, as data.
 *
 * @module
 */
import { assert, proves } from "@intellectual-frontiers/commons/ts/runtime/test";
import {
  type AnyConcept,
  annotate,
  attribute,
  binary,
  boolean,
  codeList,
  codeOf,
  concept,
  type Datatype,
  date,
  decimal,
  describeDatatype,
  domain,
  identifier,
  instant,
  integer,
  relationship,
  resolve,
  structured,
  text,
  vocabularies,
} from "@intellectual-frontiers/data/governance";
import { arca, partyKind, party, person, same } from "./governance-fixture.ts";

const errorsOf = (r: ReturnType<typeof domain>): readonly { readonly kind: string }[] => (r.kind === "err" ? r.error : []);

proves(["0003-governance FR-001"], "the constructors are total and the pieces are frozen data with their defaults", () => {
  const a = attribute(text());
  same([a.kind, a.multiplicity, a.definition, a.annotations], ["attribute", "required", "", []]);
  const c = concept("thing", { attributes: { id: attribute(identifier()) }, identifiedBy: ["id"] });
  same([c.kind, c.name, c.definition, c.relationships, c.identifiedBy], ["concept", "thing", "", {}, ["id"]]);
  assert(Object.isFrozen(a) && Object.isFrozen(c) && Object.isFrozen(c.identifiedBy));
  const r = relationship(c, { cardinality: "many" });
  same([r.kind, r.cardinality, r.definition], ["relationship", "many", ""]);
  const list = codeList("kinds", { codes: { a: { label: "A" } } });
  same([list.kind, list.definition, Object.keys(list.codes)], ["codelist", "", ["a"]]);
  assert(arca().concepts.length === 2);
});

proves(["0003-governance FR-001"], "a domain is the domain, with its definition, concepts and code lists, when nothing is wrong", () => {
  const r = domain("arca", { definition: "Parties", concepts: [party, person], codeLists: [partyKind] });
  assert(r.kind === "ok");
  if (r.kind === "ok")
    same(
      [r.value.kind, r.value.name, r.value.definition, r.value.concepts.length, r.value.codeLists.length],
      ["domain", "arca", "Parties", 2, 1],
    );
  const bare = domain("empty", { concepts: [] });
  assert(bare.kind === "ok");
});

proves(["0003-governance FR-002"], "a datatype names no database, and every case is described", () => {
  const all: readonly Datatype[] = [
    text(),
    text({ max: 3 }),
    integer(),
    decimal(),
    decimal({ precision: 9, scale: 2 }),
    boolean(),
    date(),
    instant(),
    identifier(),
    codeOf(partyKind),
    structured(),
    binary(),
  ];
  same(
    all.map((d) => d.kind),
    ["text", "text", "integer", "decimal", "decimal", "boolean", "date", "instant", "identifier", "code", "structured", "binary"],
  );
  same(all.map(describeDatatype), [
    "text",
    "text of at most 3",
    "a whole number",
    "a decimal number",
    "a decimal number of 9 digits, 2 after the point",
    "true or false",
    "a calendar day",
    "a moment in time",
    "an identifier",
    "a code of partyKind",
    "a structured document",
    "bytes",
  ]);
});

proves(
  ["0003-governance FR-003"],
  "the names of a concept are literal types, and an identifying attribute it lacks does not compile",
  () => {
    const c = concept("thing", { attributes: { id: attribute(identifier()), label: attribute(text()) }, identifiedBy: ["id"] });
    const names: readonly ("id" | "label")[] = Object.keys(c.attributes) as ("id" | "label")[];
    same(names, ["id", "label"]);
    const only: "thing" = c.name;
    same(only, "thing");
    // @ts-expect-error the concept has no attribute `nope`
    const bad = concept("bad", { attributes: { id: attribute(identifier()) }, identifiedBy: ["nope"] });
    same(bad.identifiedBy, ["nope"]);
    const key: "id" = c.identifiedBy[0] as "id";
    same(key, "id");
  },
);

proves(
  ["0003-governance FR-004"],
  "a name that is not lower camel case, a duplicate and an annotation out of place are returned together",
  () => {
    const bad = concept("Bad Name", { attributes: { OK: attribute(identifier()) }, identifiedBy: ["OK"] });
    const twin = concept("twin", { attributes: { id: attribute(identifier()) }, identifiedBy: ["id"] });
    const r = domain("arca", {
      concepts: [bad, twin, twin],
      codeLists: [codeList("Kinds", { codes: { "A-1": { label: "A" } } }), codeList("dup", { codes: {} }), codeList("dup", { codes: {} })],
      annotations: [annotate(vocabularies.security.scope, { name: "tenant" })],
    });
    assert(r.kind === "err");
    const text = JSON.stringify(errorsOf(r));
    for (const piece of [
      '"element":"arca/Bad Name"',
      '"element":"arca/Bad Name.OK"',
      '"kind":"duplicate","element":"arca/twin"',
      '"element":"arca/list:Kinds"',
      '"element":"arca/list:Kinds.A-1"',
      '"kind":"duplicate","element":"arca/list:dup"',
      '"annotation":"security.scope"',
    ]) {
      assert(text.includes(piece), `no error with ${piece}: ${text}`);
    }
  },
);

proves(
  ["0003-governance FR-004"],
  "a relationship to a concept outside the domain, a code of a list outside it, and an attribute and a relationship with one name are unresolved or duplicate",
  () => {
    const stray = concept("stray", { attributes: { id: attribute(identifier()) }, identifiedBy: ["id"] });
    const otherList = codeList("other", { codes: { x: { label: "X" } } });
    const c = concept("holder", {
      attributes: { id: attribute(identifier()), kind: attribute(codeOf(otherList)) },
      identifiedBy: ["id"],
      relationships: { kind: relationship(stray, { cardinality: "one" }), friend: relationship(stray, { cardinality: "many" }) },
    });
    const r = domain("d", { concepts: [c] });
    const text = JSON.stringify(errorsOf(r));
    assert(text.includes('{"kind":"unresolved","from":"d/holder.kind","to":"other","what":"codelist"}'), text);
    assert(text.includes('{"kind":"unresolved","from":"d/holder>friend","to":"stray","what":"concept"}'), text);
    assert(text.includes('{"kind":"duplicate","element":"d/holder>kind"}'), text);
  },
);

proves(
  ["0003-governance FR-001", "0003-governance FR-004"],
  "a relationship given as a function lets two concepts refer to each other",
  () => {
    const a: ReturnType<typeof concept> = concept("a", {
      attributes: { id: attribute(identifier()) },
      identifiedBy: ["id"],
      relationships: { b: relationship(() => b, { cardinality: "optional" }) },
    });
    const b: ReturnType<typeof concept> = concept("b", {
      attributes: { id: attribute(identifier()) },
      identifiedBy: ["id"],
      relationships: { a: relationship(() => a, { cardinality: "many" }) },
    });
    assert(domain("cycle", { concepts: [a, b] }).kind === "ok");
    assert(resolve(a.relationships["b"]?.to ?? a) === b);
  },
);

proves(
  ["0003-governance FR-004"],
  "a concept with no identifying attribute, one identified by an optional attribute, and one by an attribute it lacks are returned",
  () => {
    const none = concept("none", { attributes: { id: attribute(identifier()) }, identifiedBy: [] });
    const optional = concept("optional", {
      attributes: { id: attribute(identifier(), { multiplicity: "optional" }) },
      identifiedBy: ["id"],
    });
    const lacks = concept("lacks", { attributes: { id: attribute(identifier()) }, identifiedBy: ["id"] });
    const forged: AnyConcept = { ...lacks, name: "forged", identifiedBy: ["ghost"] };
    const text = JSON.stringify(errorsOf(domain("d", { concepts: [none, optional, forged] })));
    assert(text.includes('{"kind":"identifier","concept":"d/none","why":"missing"}'), text);
    assert(text.includes('{"kind":"identifier","concept":"d/optional","attribute":"id","why":"not-required"}'), text);
    assert(text.includes('{"kind":"identifier","concept":"d/forged","attribute":"ghost","why":"unknown"}'), text);
  },
);

proves(
  ["0003-governance FR-001", "0003-governance FR-003", "0003-governance FR-004"],
  "a concept may be identified by a relationship of cardinality one, which makes it a specialization, and by no other",
  () => {
    const base = concept("base", { attributes: { id: attribute(identifier()) }, identifiedBy: ["id"] });
    const special = concept("special", {
      attributes: {},
      identifiedBy: ["base"],
      relationships: { base: relationship(base, { cardinality: "one" }) },
    });
    assert(domain("d", { concepts: [base, special] }).kind === "ok");
    same(special.identifiedBy, ["base"]);
    const many = concept("many", {
      attributes: {},
      identifiedBy: ["base"],
      relationships: { base: relationship(base, { cardinality: "many" }) },
    });
    const optional = concept("optional", {
      attributes: {},
      identifiedBy: ["base"],
      relationships: { base: relationship(base, { cardinality: "optional" }) },
    });
    const text = JSON.stringify(errorsOf(domain("d", { concepts: [base, many, optional] })));
    assert(text.includes('{"kind":"identifier","concept":"d/many","attribute":"base","why":"not-required"}'), text);
    assert(text.includes('{"kind":"identifier","concept":"d/optional","attribute":"base","why":"not-required"}'), text);
    const bad = concept("bad", {
      attributes: {},
      // @ts-expect-error neither an attribute nor a relationship of the concept is called ghost
      identifiedBy: ["ghost"],
      relationships: { base: relationship(base, { cardinality: "one" }) },
    });
    same(bad.identifiedBy, ["ghost"]);
    // @ts-expect-error a concept with no relationships has none to identify it by
    const bare = concept("bare", { attributes: { id: attribute(identifier()) }, identifiedBy: ["base"] });
    same(bare.identifiedBy, ["base"]);
  },
);
