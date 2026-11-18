// Spec: 0003-governance FR-005, FR-006
/**
 * Identity and the trace graph (commons data 0003-governance FR-005, FR-006): every element has an identity made of its names, listed in a fixed order, and the graph says what holds what,
 * what identifies a concept and what refers to what.
 *
 * @module
 */
import { assert, proves } from "@intellectual-frontiers/commons/ts/runtime/test";
import {
  attribute,
  attributeId,
  codeId,
  codeListId,
  concept,
  conceptId,
  domain,
  domainId,
  elementsOf,
  identifier,
  relationship,
  relationshipId,
  traceGraph,
} from "@intellectual-frontiers/data/governance";
import { arca, same } from "./governance-fixture.ts";

proves(["0003-governance FR-005"], "an identity is made of names: d, d/c, d/c.a, d/c>r, d/list:l and d/list:l.k", () => {
  same(
    [
      domainId("d"),
      conceptId("d", "c"),
      attributeId("d", "c", "a"),
      relationshipId("d", "c", "r"),
      codeListId("d", "l"),
      codeId("d", "l", "k"),
    ],
    ["d", "d/c", "d/c.a", "d/c>r", "d/list:l", "d/list:l.k"],
  );
});

proves(["0003-governance FR-005"], "every element is listed in a fixed order with its identity, kind, name, definition and parent", () => {
  const els = elementsOf(arca());
  same(
    els.map((e) => `${e.kind} ${e.id}`),
    [
      "domain arca",
      "concept arca/party",
      "attribute arca/party.party_id",
      "attribute arca/party.kind",
      "attribute arca/party.display_name",
      "concept arca/person",
      "attribute arca/person.person_id",
      "attribute arca/person.born",
      "relationship arca/person>party",
      "codelist arca/list:party_kind",
      "code arca/list:party_kind.person",
      "code arca/list:party_kind.organization",
    ],
  );
  same(
    els.map((e) => e.parent),
    [
      undefined,
      "arca",
      "arca/party",
      "arca/party",
      "arca/party",
      "arca",
      "arca/person",
      "arca/person",
      "arca/person",
      "arca",
      "arca/list:party_kind",
      "arca/list:party_kind",
    ],
  );
  const born = els.find((e) => e.id === "arca/person.born");
  same([born?.name, born?.definition], ["born", "The day it was born"]);
  const organization = els.find((e) => e.id === "arca/list:party_kind.organization");
  same(organization?.definition, "A body of people acting together");
  const personCode = els.find((e) => e.id === "arca/list:party_kind.person");
  same(personCode?.definition, "Person");
  assert(!("parent" in (els[0] ?? { parent: 1 })), "the domain has no parent");
  same(
    elementsOf(arca()).map((e) => e.id),
    els.map((e) => e.id),
  );
});

proves(["0003-governance FR-006"], "the trace graph has the elements as nodes and contains, identifies and references as edges", () => {
  const g = traceGraph(arca());
  same(g.nodes.length, 12);
  const edge = (kind: string): string[] => g.edges.filter((e) => e.kind === kind).map((e) => `${e.from} -> ${e.to}`);
  same(edge("identifies"), ["arca/party -> arca/party.party_id", "arca/person -> arca/person.person_id"]);
  // by concept in the domain's order: its relationships, then its attributes of a code list
  same(edge("references"), ["arca/party.kind -> arca/list:party_kind", "arca/person>party -> arca/party"]);
  same(edge("contains").length, 11);
  assert(
    edge("contains").includes("arca -> arca/party") && edge("contains").includes("arca/list:party_kind -> arca/list:party_kind.person"),
  );
  assert(
    g.edges.every((e) => g.nodes.some((n) => n.id === e.from) && g.nodes.some((n) => n.id === e.to)),
    "every edge joins two nodes",
  );
});

proves(["0003-governance FR-006"], "a concept identified by a relationship has an identifies edge to the relationship", () => {
  const base = concept("base", { definition: "b", attributes: { id: attribute(identifier(), { definition: "i" }) }, identifiedBy: ["id"] });
  const special = concept("special", {
    definition: "s",
    attributes: {},
    identifiedBy: ["base"],
    relationships: { base: relationship(base, { cardinality: "one", definition: "r" }) },
  });
  const r = domain("d", { definition: "d", concepts: [base, special] });
  assert(r.kind === "ok");
  if (r.kind !== "ok") return;
  const g = traceGraph(r.value);
  same(
    g.edges.filter((e) => e.kind === "identifies").map((e) => `${e.from} -> ${e.to}`),
    ["d/base -> d/base.id", "d/special -> d/special>base"],
  );
});
