// Spec: 0006-logical FR-011
/**
 * The flow of governance (commons data 0006-logical FR-011): every annotation of a domain is in the report, once, as expressed, carried or unexpressed, with the logical elements it became;
 * what the schema cannot express it keeps on the tables and columns it was made for; and a kind the projection knows nothing about is reported, never dropped.
 *
 * @module
 */
import { assert, proves } from "@intellectual-frontiers/commons/ts/runtime/test";
import { annotate, annotationKind, elementsOf, vocabularies } from "@intellectual-frontiers/data/governance";
import { carriedOf, normalizedProjection, projectDomain } from "@intellectual-frontiers/data/sql/logical";
import { same } from "./governance-fixture.ts";
import { arcaDomain, projected, snake, tableOf, thing, world } from "./logical-fixture.ts";

const { ownership, privacy, quality, requirements, usage } = vocabularies;

proves(["0006-logical FR-011"], "every annotation of the domain is in the report once, and only those", () => {
  const d = arcaDomain();
  const { flow } = projected(d);
  const annotations = elementsOf(d).flatMap((e) => e.annotations.map((_, index) => `${e.id}|${index}`));
  same(
    flow.map((f) => `${f.element}|${f.index}`),
    annotations,
  );
  same(new Set(annotations).size, annotations.length);
  same(
    flow.map((f) => f.disposition).filter((x) => x === "unexpressed"),
    [],
    "Arca's vocabularies are all known",
  );
  const by = (k: string): number => flow.filter((f) => f.annotation === k).length;
  same(
    [
      by("quality.openness"),
      by("quality.defaultValue".replace("Value", "")),
      by("quality.unique"),
      by("quality.differs"),
      by("quality.audited"),
      by("usage.lookup"),
    ],
    [6, 1, 1, 1, 1, 6],
  );
  same([flow.filter((f) => f.disposition === "expressed").length, flow.filter((f) => f.disposition === "carried").length], [16, 33]);
});

proves(
  ["0006-logical FR-011"],
  "an expressed annotation names the elements it became, and a carried one the elements that keep it, and each of them is in the schema",
  () => {
    const d = arcaDomain();
    const { schema, flow } = projected(d);
    const ids = new Set<string>([schema.id]);
    for (const t of schema.tables) {
      ids.add(t.id);
      for (const c of t.columns) ids.add(c.id);
      for (const x of [...t.foreignKeys, ...t.uniques, ...t.checks, ...t.indexes]) ids.add(x.id);
    }
    for (const v of schema.valueSets) ids.add(v.id);
    for (const f of flow) for (const id of f.logical) assert(ids.has(id), `${f.annotation} of ${f.element}: ${id}`);
    const entry = (kind: string, element: string) => flow.find((f) => f.annotation === kind && f.element === element);
    same(entry("usage.lookup", "arcaParty/person")?.logical, ["ix:person.family.name.given.name.idx"]);
    same(entry("quality.unique", "arcaParty/partyIdentifier")?.logical, ["uq:party.identifier.party.id.party.identifier.kind.code.uq"]);
    same(entry("quality.differs", "arcaParty/partyRelation")?.logical, ["ck:party.relation.parties.differ.ck"]);
    same(entry("quality.openness", "arcaParty/list:partyKind")?.logical, ["table:party.kind"]);
    same(entry("quality.openness", "arcaParty/list:contactMedium")?.logical, ["ck:electronic.contact.medium.ck"]);
    same(entry("quality.defaultValue".replace("Value", ""), "arcaParty/electronicContact.isPrimary")?.logical, [
      "column:electronic.contact/is.primary",
    ]);
    const audited = entry("quality.audited", "arcaParty");
    same([audited?.disposition, audited?.logical.length], ["expressed", 48]);
    same(entry("privacy.personal", "arcaParty/person.givenName")?.logical, ["column:person/given.name"]);
    same(entry("security.classification", "arcaParty/person")?.logical, ["table:person"]);
    same(entry("ownership.owner", "arcaParty")?.logical, ["schema:arcaParty"]);
    same(entry("requirements.cites", "arcaParty/list:contactMedium")?.logical, ["valueset:contact.medium"]);
    same(entry("requirements.cites", "arcaParty/list:partyKind")?.logical, ["table:party.kind"]);
  },
);

proves(
  ["0006-logical FR-011"],
  "what the schema cannot express it keeps, as it was, on the tables, columns and the schema it was made for",
  () => {
    const d = arcaDomain();
    const { schema } = projected(d);
    const person = tableOf(schema, "person");
    same(carriedOf(person, requirements.cites).flat().length > 0, true);
    same(carriedOf(person, usage.lookup), [{ members: ["familyName", "givenName"] }]);
    same(carriedOf(person.columns.find((c) => snake(c.name) === "given_name") ?? person, privacy.personal), [
      { category: "Name", purposes: ["address the person by name"] },
    ]);
    same(carriedOf(schema, ownership.owner), ["arca"]);
    same(carriedOf(schema, quality.audited), [{ removal: "mark" }]);
    same(carriedOf(schema.valueSets[0] ?? schema, quality.openness), ["closed"]);
    const reference = person.columns.find((c) => snake(c.name) === "party_id");
    same(reference?.governance, []);
  },
);

proves(
  ["0006-logical FR-011"],
  "an annotation of a kind the projection knows nothing about is unexpressed in the report, and carried where the projection is told to carry it",
  () => {
    const mystery = annotationKind<string>("mystery.note", ["concept"]);
    const d = world([thing("a", {}, [annotate(mystery, "x")])]);
    const plain = projected(d).flow.find((f) => f.annotation === "mystery.note");
    same([plain?.disposition, plain?.logical, plain?.note], ["unexpressed", [], "the projection knows nothing of this kind"]);
    const r = projectDomain(d, normalizedProjection({ carry: ["mystery.note"] }));
    assert(r.kind === "ok");
    if (r.kind === "ok") {
      const carried = r.value.flow.find((f) => f.annotation === "mystery.note");
      same([carried?.disposition, carried?.logical], ["carried", ["table:a"]]);
      same(carriedOf(tableOf(r.value.schema, "a"), mystery), ["x"]);
    }
  },
);
