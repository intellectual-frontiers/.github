/**
 * The exporters of RDF/XML, OWL and DCAT (commons 0019-mizan-integrations FR-016 to FR-018): each is a pure function over data that writes the same text for the same data, and
 * names what its form cannot say. That the files they write for Mizan's ontology are current is the root test `commons-mizan-ontology.test.ts`, which also has rdflib parse the
 * RDF/XML and the catalog. No OWL functional-syntax reader is a pinned dependency of the suite, so the OWL text is compared here with the text it should be.
 *
 * @module
 */
import { blank, en, lang, named, namespace, parseIri, plain, RDF_TYPE, typed, type Triple } from "@intellectual-frontiers/rdf";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { type DcatCatalogInput, type DcatDatasetInput, exportDcat, exportOwl, exportRdfXml, readTurtle } from "../src/integrations/mod.ts";

const EX = namespace("ex", "https://example.org/vocab#");
const iri = (text: string) => {
  const r = parseIri(text);
  assert(r.kind === "ok", text);
  return named(r.value);
};
const t = (s: string, p: string, o: Triple["object"]): Triple => ({ subject: iri(s), predicate: iri(p), object: o });
const LABEL = "http://www.w3.org/2000/01/rdf-schema#label";
const XSD_INTEGER = "http://www.w3.org/2001/XMLSchema#integer";

const sample = (): Triple[] => {
  const b = blank("b1");
  assert(b.kind === "ok");
  const ja = lang("Ein Ding", "de");
  assert(ja.kind === "ok");
  return [
    t("https://example.org/vocab#Thing", RDF_TYPE, iri("http://www.w3.org/2002/07/owl#Class")),
    t("https://example.org/vocab#Thing", LABEL, en("Thing")),
    t("https://example.org/vocab#Thing", LABEL, ja.value),
    t("https://example.org/vocab#Thing", "https://example.org/vocab#size", typed("3", iri(XSD_INTEGER))),
    t("https://example.org/vocab#Thing", "https://example.org/vocab#note", plain('a < b & "c"\r\nnext')),
    t("https://example.org/vocab#Thing", "https://elsewhere.org/ns#other", b.value),
    { subject: b.value, predicate: iri("https://elsewhere.org/ns#kind"), object: iri("https://example.org/vocab#Thing") },
  ];
};

proves(
  ["0019-mizan-integrations FR-016"],
  "triples are written as canonical RDF/XML: the order they were stated in does not matter, and each kind of object is written as RDF/XML says",
  () => {
    const doc = { comments: ["made by a test"], prefixes: [EX], triples: sample() };
    const a = exportRdfXml(doc);
    const b = exportRdfXml({ ...doc, triples: [...doc.triples].reverse().concat(doc.triples.slice(0, 2)) });
    assert(a.kind === "ok" && b.kind === "ok");
    assertEquals(a.value, b.value);
    assertStringIncludes(
      a.value,
      '<rdf:Description rdf:about="https://example.org/vocab#Thing">\n    <rdf:type rdf:resource="http://www.w3.org/2002/07/owl#Class"/>',
    );
    assertStringIncludes(a.value, '<ex:size rdf:datatype="http://www.w3.org/2001/XMLSchema#integer">3</ex:size>');
    assertStringIncludes(a.value, '<ex:note>a &lt; b &amp; "c"&#13;\nnext</ex:note>');
    assertStringIncludes(a.value, '<ns1:label xml:lang="de">Ein Ding</ns1:label>');
    assertStringIncludes(a.value, '<ns2:other rdf:nodeID="b1"/>');
    assertStringIncludes(a.value, '<rdf:Description rdf:nodeID="b1">');
    assertStringIncludes(a.value, "<!-- made by a test -->");
    assertEquals(a.value.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n'), true);
  },
);

proves(
  ["0019-mizan-integrations FR-016"],
  "a namespace no declared prefix names gets ns1, ns2 in the order of its IRI, and a declared prefix is used where it fits",
  () => {
    const a = exportRdfXml({
      prefixes: [EX],
      triples: [
        t("https://example.org/vocab#a", "https://zzz.example/n#p", plain("1")),
        t("https://example.org/vocab#a", "https://aaa.example/n#q", plain("2")),
      ],
    });
    assert(a.kind === "ok");
    assertStringIncludes(a.value, 'xmlns:ns1="https://aaa.example/n#"');
    assertStringIncludes(a.value, 'xmlns:ns2="https://zzz.example/n#"');
    assertStringIncludes(a.value, "<ns1:q>2</ns1:q>");
    assertStringIncludes(a.value, "<ns2:p>1</ns2:p>");
    assertEquals(a.value.includes("xmlns:ex="), true);
  },
);

proves(
  ["0019-mizan-integrations FR-016"],
  "what XML cannot say is named, and never changed: a predicate with no XML name, a control character, a prefix XML forbids",
  () => {
    const noName = exportRdfXml({ prefixes: [], triples: [t("https://x.org/a", "https://x.org/ns/1", plain("v"))] });
    assert(noName.kind === "err");
    assertStringIncludes(noName.error.join(" "), "has no XML name at its end");
    const control = exportRdfXml({ prefixes: [EX], triples: [t("https://x.org/a", "https://example.org/vocab#p", plain("a\u0001b"))] });
    assert(control.kind === "err");
    assertStringIncludes(control.error.join(" "), "control character");
    const prefix = exportRdfXml({ prefixes: [namespace("xmlfoo", "https://x.org/ns#")], triples: [] });
    assert(prefix.kind === "err");
    assertStringIncludes(prefix.error.join(" "), "is not one an XML namespace may have");
  },
);

const OWL_INPUT = {
  iri: "https://example.org/vocab",
  versionIri: "https://example.org/vocab/1",
  label: { value: "Vocab", language: "en" },
  description: { value: 'A "vocabulary"', language: "en" },
  versionInfo: "1",
  prefixes: [{ prefix: "ex", iri: "https://example.org/vocab#" }],
  classes: [
    {
      iri: "https://example.org/vocab#Widget",
      label: { value: "Widget", language: "en" },
      subClassOf: ["http://purl.org/dc/terms/Standard"],
    },
    {
      iri: "https://example.org/vocab#Gadget",
      definition: { value: "A gadget", language: "en" },
      comment: { value: "c", language: "en" },
      subClassOf: [],
    },
  ],
  properties: [
    {
      iri: "https://example.org/vocab#part",
      kind: "object" as const,
      domain: "https://example.org/vocab#Widget",
      range: "https://example.org/vocab#Gadget",
    },
    {
      iri: "https://example.org/vocab#size",
      kind: "datatype" as const,
      domain: "https://example.org/vocab#Widget",
      range: "http://www.w3.org/2001/XMLSchema#integer",
      definition: { value: "The size", language: "en" },
    },
    { iri: "https://example.org/vocab#when", kind: "datatype" as const, range: "http://www.w3.org/2001/XMLSchema#date" },
  ],
};

proves(
  ["0019-mizan-integrations FR-017"],
  "classes and properties are written as OWL functional syntax, with their declarations, axioms and annotations",
  () => {
    const r = exportOwl(OWL_INPUT);
    assert(r.kind === "ok");
    assertEquals(
      r.value,
      `Prefix(dcterms:=<http://purl.org/dc/terms/>)
Prefix(ex:=<https://example.org/vocab#>)
Prefix(owl:=<http://www.w3.org/2002/07/owl#>)
Prefix(rdf:=<http://www.w3.org/1999/02/22-rdf-syntax-ns#>)
Prefix(rdfs:=<http://www.w3.org/2000/01/rdf-schema#>)
Prefix(skos:=<http://www.w3.org/2004/02/skos/core#>)
Prefix(xsd:=<http://www.w3.org/2001/XMLSchema#>)

Ontology(<https://example.org/vocab> <https://example.org/vocab/1>

Annotation(rdfs:label "Vocab"@en)
Annotation(dcterms:description "A \\"vocabulary\\""@en)
Annotation(owl:versionInfo "1")
Declaration(Class(dcterms:Standard))
Declaration(Class(ex:Gadget))
Declaration(Class(ex:Widget))
Declaration(Datatype(xsd:date))
Declaration(ObjectProperty(ex:part))
Declaration(DataProperty(ex:size))
Declaration(DataProperty(ex:when))
Declaration(AnnotationProperty(dcterms:description))
Declaration(AnnotationProperty(skos:definition))
AnnotationAssertion(rdfs:comment ex:Gadget "c"@en)
AnnotationAssertion(skos:definition ex:Gadget "A gadget"@en)
AnnotationAssertion(rdfs:label ex:Widget "Widget"@en)
SubClassOf(ex:Widget dcterms:Standard)
ObjectPropertyDomain(ex:part ex:Widget)
ObjectPropertyRange(ex:part ex:Gadget)
AnnotationAssertion(skos:definition ex:size "The size"@en)
DataPropertyDomain(ex:size ex:Widget)
DataPropertyRange(ex:size xsd:integer)
DataPropertyRange(ex:when xsd:date)

)
`,
    );
  },
);

proves(
  ["0019-mizan-integrations FR-017"],
  "the same ontology gives the same OWL whatever the order of its classes and properties, and an IRI no prefix shortens is written whole",
  () => {
    const a = exportOwl(OWL_INPUT);
    const b = exportOwl({ ...OWL_INPUT, classes: [...OWL_INPUT.classes].reverse(), properties: [...OWL_INPUT.properties].reverse() });
    assert(a.kind === "ok" && b.kind === "ok");
    assertEquals(a.value, b.value);
    const whole = exportOwl({
      iri: "https://x.org/o",
      prefixes: [],
      classes: [{ iri: "https://x.org/o#1st", subClassOf: [] }],
      properties: [],
    });
    assert(whole.kind === "ok");
    assertStringIncludes(whole.value, "Declaration(Class(<https://x.org/o#1st>))");
    assertStringIncludes(whole.value, "Ontology(<https://x.org/o>\n");
    // the built-in prefixes cannot be taken for another IRI
    const taken = exportOwl({ ...OWL_INPUT, prefixes: [{ prefix: "owl", iri: "https://elsewhere.org/owl#" }] });
    assert(taken.kind === "ok");
    assertStringIncludes(taken.value, "Prefix(owl:=<http://www.w3.org/2002/07/owl#>)");
  },
);

proves(
  ["0019-mizan-integrations FR-017"],
  "a datatype property with a class for a range, an object property with a datatype for a range and a name that is both are named",
  () => {
    const a = exportOwl({
      ...OWL_INPUT,
      properties: [
        { iri: "https://example.org/vocab#bad1", kind: "datatype", range: "https://example.org/vocab#Widget" },
        { iri: "https://example.org/vocab#bad2", kind: "object", range: "http://www.w3.org/2001/XMLSchema#string" },
      ],
    });
    assert(a.kind === "err");
    assertEquals(a.error, [
      "https://example.org/vocab#bad1 is a datatype property whose range https://example.org/vocab#Widget is a class",
      "https://example.org/vocab#bad2 is an object property whose range http://www.w3.org/2001/XMLSchema#string is a datatype",
    ]);
    const both = exportOwl({
      iri: "https://x.org/o",
      prefixes: [],
      classes: [{ iri: "https://x.org/o#A", subClassOf: ["https://x.org/o#T"] }],
      properties: [{ iri: "https://x.org/o#p", kind: "datatype", range: "https://x.org/o#T" }],
    });
    assert(both.kind === "err");
    assertStringIncludes(both.error.join(" "), "both as a class and as a datatype");
  },
);

const VOCAB: DcatDatasetInput = {
  id: "vocab",
  ontologyIri: "https://example.org/vocab",
  versionInfo: "1",
  title: "Vocab",
  distributions: [
    { file: "generated/vocab.ttl", title: "Vocab, Turtle", mediaType: "text/turtle" },
    {
      file: "generated/vocab.rdf",
      title: "Vocab, RDF/XML",
      mediaType: "application/rdf+xml",
      conformsTo: "https://www.w3.org/TR/rdf-syntax-grammar/",
    },
  ],
};

const CATALOG: DcatCatalogInput = {
  iri: "https://example.org/catalog",
  title: "A catalog",
  description: "What is published",
  license: "https://creativecommons.org/publicdomain/zero/1.0/",
  publisher: { iri: "https://example.org/", name: "Example" },
  downloadBase: "https://example.org/files/",
  comments: ["made by a test"],
  datasets: [VOCAB],
};

proves(
  ["0019-mizan-integrations FR-018"],
  "the catalog is written as DCAT 3 Turtle: a catalog, a dataset for each ontology, a distribution for each file with its media type, URL and license",
  () => {
    const a = exportDcat(CATALOG);
    assert(a.kind === "ok");
    assertStringIncludes(a.value, "<https://example.org/catalog> a dcat:Catalog ;");
    assertStringIncludes(a.value, "dcat:dataset <https://example.org/catalog#dataset-vocab>");
    assertStringIncludes(a.value, "<https://example.org/catalog#dataset-vocab> a dcat:Dataset ;");
    assertStringIncludes(a.value, 'dcterms:identifier "https://example.org/vocab"');
    assertStringIncludes(a.value, 'dcat:version "1"');
    assertStringIncludes(a.value, "<https://example.org/catalog#distribution-vocab-vocab.rdf> a dcat:Distribution ;");
    assertStringIncludes(a.value, "dcat:mediaType <https://www.iana.org/assignments/media-types/application/rdf+xml>");
    assertStringIncludes(a.value, "dcterms:format <https://www.iana.org/assignments/media-types/text/turtle>");
    assertStringIncludes(a.value, "dcat:downloadURL <https://example.org/files/generated/vocab.ttl>");
    assertStringIncludes(a.value, "dcterms:conformsTo <https://www.w3.org/TR/rdf-syntax-grammar/>");
    assertStringIncludes(a.value, "dcterms:license <https://creativecommons.org/publicdomain/zero/1.0/>");
    assertStringIncludes(a.value, 'dcterms:title "A catalog"@en');
    assertEquals(a.value.split("a dcat:Distribution").length - 1, 2);
    const back = readTurtle(a.value);
    assert(back.kind === "ok");
    // the module's own reader reads the Turtle back: the catalog's 6 statements, the publisher's 2, the dataset's 8 and the distributions' 7 and 8
    assertEquals(back.value.triples.length, 31);
  },
);

proves(
  ["0019-mizan-integrations FR-018"],
  "the same catalog gives the same text whatever the order of its datasets, and a bad IRI or a bad media type is named",
  () => {
    const two = {
      ...CATALOG,
      datasets: [...CATALOG.datasets, { ...VOCAB, id: "another", ontologyIri: "https://example.org/another" }],
    };
    const a = exportDcat(two);
    const b = exportDcat({ ...two, datasets: [...two.datasets].reverse() });
    assert(a.kind === "ok" && b.kind === "ok");
    assertEquals(a.value, b.value);
    const bad = exportDcat({
      ...CATALOG,
      license: "not an iri",
      datasets: [{ ...VOCAB, distributions: [{ file: "a.txt", title: "A", mediaType: "text" }] }],
    });
    assert(bad.kind === "err");
    assertStringIncludes(bad.error.join(" "), "is not an IRI");
    assertStringIncludes(bad.error.join(" "), '"text" is not a media type');
  },
);
