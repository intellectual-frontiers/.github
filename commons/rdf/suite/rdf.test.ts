/**
 * Tests of `kernel/rdf.ts` (commons 0001-rdf FR-001 to FR-007): IRIs checked or refused, namespaces and vocabularies, literals and
 * their tags, class schemas whose individuals' types and triples come from them (with type-level tests of what must not compile), the
 * OWL schemas, code lists and SKOS schemes, the checks a type cannot state, and the writers, whose bytes do not depend on the order
 * statements are given in (property-tested).
 *
 * @module
 */
import fc from "fast-check";
import * as rdfModule from "../src/mod.ts";
import {
  blank,
  classSchema,
  codeOf,
  codes,
  conceptScheme,
  DatatypeProperty,
  dcterms,
  defaultGraph,
  en,
  formatIriError,
  formatRdfFinding,
  type Individual,
  jsonLd,
  lang,
  many,
  type Named,
  named,
  namespace,
  nQuads,
  nTriples,
  ObjectProperty,
  one,
  ontologyOf,
  optional,
  owl,
  OwlClass,
  OwlOntology,
  parseIri,
  plain,
  prov,
  range,
  rdf,
  RdfFault,
  RDFS,
  rdfs,
  sh,
  SKOS,
  skos,
  term,
  type Triple,
  triplesOf,
  turtle,
  typed,
  validate,
  vocabulary,
  xsd,
} from "../src/mod.ts";
import { type Equal, expectType, type Extends, type Not } from "@intellectual-frontiers/core";
import { assert, assertEquals, assertThrows, proves } from "@intellectual-frontiers/commons/ts/runtime/test";

const EX = namespace("ex", "https://example.org/terms#");
const ID = namespace("id", "https://example.org/id/");
const ex = vocabulary(EX, {
  Tool: "owl:Class",
  Shelf: "owl:Class",
  runs: "owl:DatatypeProperty",
  size: "owl:DatatypeProperty",
  free: "owl:DatatypeProperty",
  holds: "owl:ObjectProperty",
  tier: "owl:ObjectProperty",
  Tier: "owl:Class",
});
const Tier = classSchema(ex.Tier, { label: one(rdfs.label, range.langString) });
const tiers = codes(Tier, EX, { Required: { label: en("required") }, Comfort: { label: en("comfort") } });
const Tool = classSchema(ex.Tool, {
  label: one(rdfs.label, range.langString),
  runs: one(ex.runs, range.string),
  size: optional(ex.size, range.integer),
  free: optional(ex.free, range.boolean),
  note: optional(skos.note, range.text),
  tier: one(ex.tier, range.ref<"ex:Tier">()),
});
const Shelf = classSchema(ex.Shelf, { holds: many(ex.holds, range.ref<"ex:Tool">()) });
const git = Tool.make(term(ID, "tool-git"), {
  label: en("git"),
  runs: "git",
  size: 3,
  free: true,
  note: 'a "quoted"\nnote',
  tier: tiers.Required,
});
const top = Shelf.make(term(ID, "shelf-top"), { holds: [git] });

proves(["0001-rdf FR-001"], "an IRI is checked: absolute, with no character N-Triples cannot write; a namespace makes its terms", () => {
  assertEquals<unknown>(parseIri("https://example.org/a#b"), { kind: "ok", value: "https://example.org/a#b" });
  assertEquals(parseIri("urn:x:y").kind, "ok");
  const relative = parseIri("relative/path");
  assert(relative.kind === "err");
  assertEquals(formatIriError(relative.error), '"relative/path" is not an absolute IRI: it has no scheme');
  for (const bad of [
    "https://e.org/a b",
    "https://e.org/<a>",
    'https://e.org/"',
    "https://e.org/{x}",
    "https://e.org/a\\b",
    "https://e.org/\u0001",
  ]) {
    const r = parseIri(bad);
    assert(r.kind === "err" && r.error.kind === "forbidden-character", bad);
  }
  assertEquals(ex.Tool.iri, "https://example.org/terms#Tool");
  assertEquals(ex.Tool.curie, "ex:Tool");
  assertEquals(term(ID, "x").iri, "https://example.org/id/x");
  assertEquals(ontologyOf(EX).iri, "https://example.org/terms");
});

proves(["0001-rdf FR-001"], "literals are typed by their language or their datatype; blank nodes, triples and quads", () => {
  assertEquals<unknown>(en("install"), { kind: "lang", value: "install", language: "en" });
  assertEquals<unknown>(lang("x", "en-GB"), { kind: "ok", value: { kind: "lang", value: "x", language: "en-gb" } });
  assertEquals(lang("x", "not a tag").kind, "err");
  assertEquals(plain("x"), { kind: "typed", value: "x", datatype: "http://www.w3.org/2001/XMLSchema#string" });
  assertEquals(typed("2026-11-16", xsd.date).datatype, "http://www.w3.org/2001/XMLSchema#date");
  assertEquals(blank("b0"), { kind: "ok", value: { kind: "blank", label: "b0" } });
  assertEquals(blank("bad label").kind, "err");
  const b = blank("b0");
  assert(b.kind === "ok");
  const q = nQuads([
    { subject: b.value, predicate: rdfs.label, object: en("a"), graph: defaultGraph },
    { subject: git, predicate: rdfs.label, object: plain("g"), graph: named(ID.iri) },
  ]);
  assertEquals(
    q,
    '<https://example.org/id/tool-git> <http://www.w3.org/2000/01/rdf-schema#label> "g" <https://example.org/id/> .\n_:b0 <http://www.w3.org/2000/01/rdf-schema#label> "a"@en .\n',
  );
});

proves(
  ["0001-rdf FR-001", "0001-rdf FR-003"],
  "the compiler refuses an individual of another class, a missing field and a wrong range",
  () => {
    // what compiles, and what does not, is the test; tsc runs it
    expectType<Extends<typeof git, Named<"ex:Tool">>>();
    expectType<Not<Extends<typeof top, Named<"ex:Tool">>>>();
    expectType<Not<Extends<Named, Named<"ex:Tool">>>>();
    expectType<Extends<Named<"a" | "b">, Named<"a">>>();
    expectType<Equal<typeof git.values.runs, string>>();
    expectType<Equal<typeof git.values.size, number | undefined>>();
    expectType<Equal<typeof top.values.holds, readonly Named<"ex:Tool">[] | undefined>>();
    // @ts-expect-error a shelf is not a tool, so it may not be held as one
    Shelf.make(term(ID, "shelf-2"), { holds: [top] });
    // @ts-expect-error runs is required, and left out
    Tool.make(term(ID, "tool-x"), { label: en("x"), tier: tiers.Comfort });
    // @ts-expect-error a label is a string in a language, not a plain string
    Tool.make(term(ID, "tool-y"), { label: "y", runs: "y", tier: tiers.Comfort });
    // @ts-expect-error a vocabulary has only the terms it lists
    void rdfs.notATerm;
    assert(true);
  },
);

proves(["0001-rdf FR-002"], "the eight vocabularies give the IRIs of their specifications", () => {
  assertEquals(
    [rdf.type, rdfs.label, owl.Class, xsd.integer, skos.definition, dcterms.identifier, prov.wasGeneratedBy, sh.NodeShape].map(
      (t) => t.iri,
    ),
    [
      "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
      "http://www.w3.org/2000/01/rdf-schema#label",
      "http://www.w3.org/2002/07/owl#Class",
      "http://www.w3.org/2001/XMLSchema#integer",
      "http://www.w3.org/2004/02/skos/core#definition",
      "http://purl.org/dc/terms/identifier",
      "http://www.w3.org/ns/prov#wasGeneratedBy",
      "http://www.w3.org/ns/shacl#NodeShape",
    ],
  );
  assertEquals(Object.keys(ex).sort(), ["Shelf", "Tier", "Tool", "free", "holds", "runs", "size", "tier"]);
});

proves(
  ["0001-rdf FR-003"],
  "an individual's triples are its type, then its fields in the schema's order, values in the order given",
  () => {
    const two = Tool.make(term(ID, "tool-two"), { label: en("two"), runs: "two", tier: tiers.Comfort });
    const shelf = Shelf.make(term(ID, "shelf-two"), { holds: [two, git] });
    const t = (i: Individual<string, unknown>) =>
      triplesOf([i]).map(
        (x) =>
          `${x.predicate.iri.replace(/.*[#/]/, "")} ${x.object.kind === "named" ? x.object.iri.replace(/.*[#/]/, "") : x.object.kind === "lang" || x.object.kind === "typed" ? x.object.value : ""}`,
      );
    assertEquals(t(git), ["type Tool", "label git", "runs git", "size 3", "free true", 'note a "quoted"\nnote', "tier Required"]);
    assertEquals(t(shelf), ["type Shelf", "holds tool-two", "holds tool-git"]);
    assertEquals(
      shelf.values.holds?.map((h) => h.iri),
      [two.iri, git.iri],
      "a reference is a named node of the class",
    );
    assertEquals(triplesOf([git, git]).length, 7, "a triple is there once");
  },
);

proves(["0001-rdf FR-004"], "the OWL schemas, a code list and its union, a SKOS scheme and its notations", () => {
  const cls = OwlClass.make(ex.Tool, { label: en("Tool"), subClassOf: [owl.Thing], definition: en("A program.") });
  const p = DatatypeProperty.make(ex.runs, { domain: cls, range: xsd.string, definition: en("What is run.") });
  const o = ObjectProperty.make(ex.holds, { domain: ex.Shelf, range: ex.Tool });
  const head = OwlOntology.make(ontologyOf(EX), { label: en("Example"), versionInfo: "1" });
  assertEquals(triplesOf([cls, p, o, head]).length, 4 + 4 + 3 + 3);
  type TierKey = keyof typeof tiers;
  expectType<Equal<TierKey, "Required" | "Comfort">>();
  assertEquals(codeOf(tiers, git.values.tier), "Required");
  assertEquals(codeOf(tiers, git), undefined);
  const levels = conceptScheme(
    EX,
    "levels",
    { label: en("Levels") },
    { low: { local: "level-low", label: en("low") }, high: { local: "level-high", label: en("high"), definition: en("the most") } },
  );
  expectType<Equal<keyof typeof levels.concepts, "low" | "high">>();
  assertEquals(levels.concepts.high.values.notation, "high");
  assertEquals(levels.individuals.length, 3);
  assertEquals(triplesOf(levels.individuals).filter((x) => x.predicate.iri === skos.inScheme.iri).length, 2);
});

proves(["0001-rdf FR-005"], "a non-integer, a word not of its list, a subject stated twice and a bad namespace are named", () => {
  const odd = Tool.make(term(ID, "tool-odd"), { label: en("odd"), runs: "odd", size: 1.5, tier: tiers.Comfort });
  const findings = validate([git, odd, git]);
  assertEquals(
    findings.map((f) => f.kind),
    ["not-an-integer", "stated-twice"],
  );
  assertEquals(findings.map(formatRdfFinding), [
    "<https://example.org/id/tool-odd> <https://example.org/terms#size>: 1.5 is not an integer this code can write exactly",
    "<https://example.org/id/tool-git> is stated by two individuals",
  ]);
  assertEquals(validate([git, top]), []);
  const Kind = classSchema(ex.Tier, { word: one(ex.runs, range.oneOf(["a", "b"])) });
  expectType<Equal<(typeof Kind.make extends (s: never, v: infer V) => unknown ? V : never)["word"], "a" | "b">>();
  // @ts-expect-error a word not of the field's list does not compile; validate names it where no checker ran
  const wrong = Kind.make(term(ID, "kind-c"), { word: "c" });
  assertEquals(validate([wrong, Kind.make(term(ID, "kind-a"), { word: "a" })]).map(formatRdfFinding), [
    '<https://example.org/id/kind-c> <https://example.org/terms#runs>: "c" is not one of a, b',
  ]);
  assertEquals(wrong.class.iri, ex.Tier.iri, "an individual knows its class");
  assertThrows(() => namespace("ex", "no scheme"), RdfFault);
  assertThrows(() => namespace("not a prefix", "https://example.org/"), RdfFault);
  assertThrows(() => term(EX, "a b"), RdfFault);
});

const EXPECTED_TURTLE = `# AUTO-GENERATED by a test.
#

@prefix ex: <https://example.org/terms#> .
@prefix id: <https://example.org/id/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .

id:shelf-top a ex:Shelf ;
    ex:holds id:tool-git .

id:tool-git a ex:Tool ;
    rdfs:label "git"@en ;
    skos:note "a \\"quoted\\"\\nnote" ;
    ex:free true ;
    ex:runs "git" ;
    ex:size 3 ;
    ex:tier ex:Required .

ex:Comfort a ex:Tier ;
    rdfs:label "comfort"@en .

ex:Required a ex:Tier ;
    rdfs:label "required"@en .
`;

proves(["0001-rdf FR-006"], "Turtle, N-Triples and JSON-LD of known statements, with their escapes", () => {
  const all = [top, git, tiers.Required, tiers.Comfort];
  const doc = { comments: ["AUTO-GENERATED by a test.", ""], prefixes: [SKOS, EX, ID, RDFS], triples: triplesOf(all) };
  assertEquals(turtle(doc), EXPECTED_TURTLE);
  const nt = nTriples(triplesOf([git]));
  assertEquals(
    nt.split("\n")[0],
    "<https://example.org/id/tool-git> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://example.org/terms#Tool> .",
  );
  assert(nt.includes('<https://example.org/terms#size> "3"^^<http://www.w3.org/2001/XMLSchema#integer> .'));
  assert(nt.includes('<http://www.w3.org/2004/02/skos/core#note> "a \\"quoted\\"\\nnote" .'));
  assertEquals(
    nTriples([{ subject: git, predicate: rdfs.label, object: plain("\t\u0001\u007f\\") }]),
    '<https://example.org/id/tool-git> <http://www.w3.org/2000/01/rdf-schema#label> "\\t\\u0001\\u007F\\\\" .\n',
  );
  const ld: unknown = JSON.parse(jsonLd(triplesOf([top])));
  assertEquals(ld, [
    {
      "@id": "https://example.org/id/shelf-top",
      "@type": ["https://example.org/terms#Shelf"],
      "https://example.org/terms#holds": [{ "@id": "https://example.org/id/tool-git" }],
    },
  ]);
  assertEquals<unknown>(JSON.parse(jsonLd(triplesOf([git]))), [
    {
      "@id": "https://example.org/id/tool-git",
      "@type": ["https://example.org/terms#Tool"],
      "http://www.w3.org/2000/01/rdf-schema#label": [{ "@value": "git", "@language": "en" }],
      "http://www.w3.org/2004/02/skos/core#note": [{ "@value": 'a "quoted"\nnote' }],
      "https://example.org/terms#free": [{ "@value": "true", "@type": "http://www.w3.org/2001/XMLSchema#boolean" }],
      "https://example.org/terms#runs": [{ "@value": "git" }],
      "https://example.org/terms#size": [{ "@value": "3", "@type": "http://www.w3.org/2001/XMLSchema#integer" }],
      "https://example.org/terms#tier": [{ "@id": "https://example.org/terms#Required" }],
    },
  ]);
  assertEquals(
    turtle({ prefixes: [], triples: [{ subject: git, predicate: rdfs.label, object: typed("x", xsd.date) }] }),
    '<https://example.org/id/tool-git> <http://www.w3.org/2000/01/rdf-schema#label> "x"^^<http://www.w3.org/2001/XMLSchema#date> .\n',
  );
});

proves(["0001-rdf FR-006"], "the same statements in any order give the same bytes in every syntax", () => {
  const triples: readonly Triple[] = triplesOf([top, git, tiers.Required, tiers.Comfort]);
  const once = [nTriples(triples), turtle({ prefixes: [EX, ID], triples }), jsonLd(triples)];
  fc.assert(
    fc.property(fc.shuffledSubarray([...triples], { minLength: triples.length, maxLength: triples.length }), (shuffled) => {
      const doubled = [...shuffled, ...shuffled.slice(0, 3)];
      assertEquals([nTriples(doubled), turtle({ prefixes: [ID, EX], triples: doubled }), jsonLd(doubled)], once);
    }),
  );
});

proves(["0001-rdf FR-007"], "RDF writes and reads nothing else: it exports no reader", () => {
  const names = Object.keys(rdfModule);
  assertEquals(
    names.filter((n) => /^(parse|read)(?!Iri$)/i.test(n)),
    [],
  );
  assert(names.includes("turtle") && names.includes("nTriples") && names.includes("jsonLd") && names.includes("nQuads"));
});
