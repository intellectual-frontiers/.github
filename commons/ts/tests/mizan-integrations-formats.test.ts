/**
 * The readers of JSON-LD and RDF/XML and the importer of a JSON Schema (commons 0019-mizan-integrations FR-020 to FR-027), and the command that runs them from a manifest, as a
 * program on the runtime this test runs on. The graphs they read are checked against rdflib, and the code lists and field names against `jsonschema`, in the root tests
 * (`tests/commons-mizan-importers.test.ts`), which skip where Python is not installed.
 *
 * @module
 */
import { sha256 } from "../kernel/sha256.ts";
import { makeTempDirSync, readTextFileSync, removeSync, writeTextFileSync } from "../runtime/fs.ts";
import { pathToFileURL } from "node:url";
import { dirname, fromFileUrl, resolve } from "../runtime/path.ts";
import { execPath, run } from "../runtime/proc.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "../runtime/test.ts";
import {
  describeFinding,
  importJsonSchema,
  importVocabulary,
  readJsonLd,
  readRdfXml,
  resolveIri,
  type RdfTriple,
  type StandardRecord,
  tripleKey,
} from "../mizan/integrations/mod.ts";

const HERE = dirname(fromFileUrl(import.meta.url));
const IMPORT = resolve(HERE, "..", "mizan", "integrations", "host", "import.ts");
// a file URL, not a path: it is written into a generated module as an import specifier, and a Windows path is not one
const KERNEL_RDF = pathToFileURL(resolve(HERE, "..", "kernel", "rdf.ts")).href;

const keys = (ts: readonly RdfTriple[]): string[] => ts.map(tripleKey).sort();
const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const XSD = "http://www.w3.org/2001/XMLSchema#";

async function standard(text: string, over: Partial<StandardRecord> = {}): Promise<StandardRecord> {
  return {
    id: "example",
    issuer: "Example Org",
    name: "Example",
    version: "1.0",
    location: "https://example.org/vocab",
    license: "CC0-1.0",
    redistributable: true,
    sha256: await sha256(text),
    ...over,
  };
}

const COMPACT = `{
  "@context": {
    "@vocab": "https://example.org/v#",
    "@base": "https://example.org/data/",
    "ex": "https://example.org/v#",
    "label": { "@id": "http://www.w3.org/2000/01/rdf-schema#label", "@language": "en" },
    "seeAlso": { "@id": "http://www.w3.org/2000/01/rdf-schema#seeAlso", "@type": "@id" },
    "count": { "@id": "ex:count", "@type": "http://www.w3.org/2001/XMLSchema#integer" },
    "id": "@id",
    "type": "@type"
  },
  "@graph": [
    { "id": "a", "type": ["Thing", "ex:Other"], "label": "A thing", "seeAlso": "b", "count": "3", "ratio": 1.5, "n": 7, "ok": true, "big": 1e3 },
    { "id": "b", "parts": { "@list": ["x", { "@id": "c" }] }, "tags": { "@set": [] }, "note": { "@value": "chat", "@language": "fr" }, "when": { "@value": "2026-01-01", "@type": "http://www.w3.org/2001/XMLSchema#date" } },
    { "id": "c", "@reverse": { "contains": { "@id": "a" } } },
    { "id": "d", "child": { "name": "inner" } }
  ]
}`;

proves(
  ["0019-mizan-integrations FR-020"],
  "compacted JSON-LD with an inline context is read: vocab, base, aliases, coerced and typed values, a list, a reverse, a nested node and the text of a number",
  () => {
    const r = readJsonLd(COMPACT);
    assert(r.kind === "ok");
    assertEquals(r.value.findings, []);
    const k = keys(r.value.triples).join("\n");
    const A = "<https://example.org/data/a>";
    assertStringIncludes(k, `${A} <${RDF}type> <https://example.org/v#Thing> .`);
    assertStringIncludes(k, `${A} <${RDF}type> <https://example.org/v#Other> .`);
    assertStringIncludes(k, `${A} <http://www.w3.org/2000/01/rdf-schema#label> "A thing"@en .`);
    assertStringIncludes(k, `${A} <http://www.w3.org/2000/01/rdf-schema#seeAlso> <https://example.org/data/b> .`);
    assertStringIncludes(k, `${A} <https://example.org/v#count> "3"^^<${XSD}integer> .`);
    assertStringIncludes(k, `${A} <https://example.org/v#ratio> "1.5E0"^^<${XSD}double> .`);
    assertStringIncludes(k, `${A} <https://example.org/v#n> "7"^^<${XSD}integer> .`);
    assertStringIncludes(k, `${A} <https://example.org/v#ok> "true"^^<${XSD}boolean> .`);
    assertStringIncludes(k, `${A} <https://example.org/v#big> "1.0E3"^^<${XSD}double> .`);
    assertStringIncludes(k, `<https://example.org/data/b> <https://example.org/v#note> "chat"@fr .`);
    assertStringIncludes(k, `<${XSD}date>`);
    assertStringIncludes(k, `${A} <https://example.org/v#contains> <https://example.org/data/c> .`);
    const lists = r.value.triples.filter((t) => t.predicate === `${RDF}first`);
    assertEquals(lists.length, 2);
    const inner = r.value.triples.find((t) => t.predicate === "https://example.org/v#name");
    assert(inner?.subject.kind === "blank", "a nested node with no @id is a blank node");
    assertEquals(r.value.triples.filter((t) => t.predicate === "https://example.org/v#tags").length, 0, "an empty @set states nothing");
  },
);

proves(["0019-mizan-integrations FR-020"], "expanded JSON-LD, a top-level array and a language map are read", () => {
  const r = readJsonLd(`[
    { "@id": "https://example.org/a", "@type": ["https://example.org/T"], "https://example.org/p": [{ "@value": "v" }, { "@id": "https://example.org/b" }] },
    { "@context": { "name": { "@id": "https://example.org/name", "@container": "@language" } }, "@id": "https://example.org/b", "name": { "en": "Bee", "fr": ["Abeille"] } }
  ]`);
  assert(r.kind === "ok");
  assertEquals(r.value.findings, []);
  assertEquals(keys(r.value.triples), [
    `<https://example.org/a> <${RDF}type> <https://example.org/T> .`,
    '<https://example.org/a> <https://example.org/p> "v" .',
    "<https://example.org/a> <https://example.org/p> <https://example.org/b> .",
    '<https://example.org/b> <https://example.org/name> "Abeille"@fr .',
    '<https://example.org/b> <https://example.org/name> "Bee"@en .',
  ]);
});

proves(
  ["0019-mizan-integrations FR-021"],
  "what JSON-LD cannot hold is named with its line (a remote context, a named graph, a scoped context, a nest, a key with no IRI, a JSON literal), and the rest is read",
  () => {
    const r = readJsonLd(`{
  "@context": [
    "https://example.org/remote.jsonld",
    { "@vocab": "https://example.org/v#", "scoped": { "@id": "https://example.org/scoped", "@context": { "x": "https://example.org/x" } }, "j": { "@id": "https://example.org/j", "@type": "@json" } }
  ],
  "@graph": [
    { "@id": "https://example.org/g", "@graph": [{ "@id": "https://example.org/in", "p": 1 }] },
    { "@id": "https://example.org/a", "p": 1, "@nest": { "q": 2 }, "j": { "k": 1 } }
  ]
}`);
    assert(r.kind === "ok");
    const sentences = r.value.findings.map(describeFinding);
    assertEquals(sentences.length, 5);
    assertStringIncludes(sentences.join("\n"), "a remote context");
    assertStringIncludes(sentences.join("\n"), "a scoped context on a term");
    assertStringIncludes(sentences.join("\n"), "a named graph");
    assertStringIncludes(sentences.join("\n"), "a @nest");
    assertStringIncludes(sentences.join("\n"), "a JSON literal");
    assertEquals(keys(r.value.triples), ['<https://example.org/a> <https://example.org/v#p> "1"^^<' + XSD + "integer> ."]);
    const bad = readJsonLd('{\n  "@id": "x",\n  "p": [1,\n}');
    assert(bad.kind === "err");
    assertEquals(bad.error[0]?.kind, "syntax");
    assertStringIncludes(describeFinding(bad.error[0] ?? { kind: "slice-empty" }), "line 4");
    assert(readJsonLd("{} x").kind === "err");
    assert(readJsonLd('{"@context": 5}').kind === "err");
  },
);

const XML = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE rdf:RDF [
  <!ENTITY rdf "${RDF}">
  <!ENTITY ex "https://example.org/v#">
]>
<rdf:RDF xmlns:rdf="&rdf;" xmlns:ex="&ex;" xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#" xml:base="https://example.org/doc">
  <!-- a comment -->
  <ex:Thing rdf:ID="a" ex:size="3">
    <rdfs:label xml:lang="en-GB">A &amp; B &#233;</rdfs:label>
    <rdfs:label><![CDATA[<raw>]]></rdfs:label>
    <ex:n rdf:datatype="&ex;Int">5</ex:n>
    <ex:part rdf:parseType="Resource"><ex:q>1</ex:q></ex:part>
    <ex:items rdf:parseType="Collection"><rdf:Description rdf:about="x/y"/><ex:Thing rdf:nodeID="nn"/></ex:items>
    <ex:nested><ex:Other rdf:about="../up"><ex:k/></ex:Other></ex:nested>
    <ex:seen rdf:ID="stmt" rdf:resource="https://example.org/z"/>
    <ex:seen ex:flag="yes"/>
    <rdf:li>one</rdf:li><rdf:li>two</rdf:li>
  </ex:Thing>
  <rdf:Description rdf:about="#frag" rdf:type="https://example.org/v#Typed"/>
</rdf:RDF>`;

proves(
  ["0019-mizan-integrations FR-024"],
  "RDF/XML is read: entities, base and relative IRIs, rdf:ID, language and datatype, parseType Resource and Collection, property attributes, rdf:li, CDATA and reification",
  () => {
    const r = readRdfXml(XML);
    assert(r.kind === "ok");
    assertEquals(r.value.findings, []);
    const k = keys(r.value.triples).join("\n");
    const A = "<https://example.org/doc#a>";
    assertStringIncludes(k, `${A} <${RDF}type> <https://example.org/v#Thing> .`);
    assertStringIncludes(k, `${A} <https://example.org/v#size> "3" .`);
    assertStringIncludes(k, `${A} <http://www.w3.org/2000/01/rdf-schema#label> "A & B é"@en-gb .`);
    assertStringIncludes(k, `${A} <http://www.w3.org/2000/01/rdf-schema#label> "<raw>" .`);
    assertStringIncludes(k, `${A} <https://example.org/v#n> "5"^^<https://example.org/v#Int> .`);
    assertStringIncludes(k, `${A} <${RDF}_1> "one" .`);
    assertStringIncludes(k, `${A} <${RDF}_2> "two" .`);
    assertStringIncludes(k, `<https://example.org/up> <https://example.org/v#k> "" .`);
    assertStringIncludes(k, `<https://example.org/doc#frag> <${RDF}type> <https://example.org/v#Typed> .`);
    assertStringIncludes(k, `<https://example.org/doc#stmt> <${RDF}subject> ${A} .`);
    assertStringIncludes(k, `<${RDF}first> <https://example.org/x/y> .`);
    const firsts = r.value.triples.filter((t) => t.predicate === `${RDF}first`);
    assertEquals(firsts.length, 2);
    assert(r.value.triples.some((t) => t.object.kind === "iri" && t.object.value === `${RDF}nil`));
    assert(r.value.triples.some((t) => t.subject.kind === "blank" && t.subject.label === "nn"));
    const flag = r.value.triples.find((t) => t.predicate === "https://example.org/v#flag");
    assert(flag?.subject.kind === "blank", "a property attribute on an empty property element makes a blank node");
  },
);

proves(
  ["0019-mizan-integrations FR-024", "0019-mizan-integrations FR-025"],
  "RDF/XML that is not well formed ends with its line, and an XML literal and an external entity are named while the rest is read",
  () => {
    const open = readRdfXml('<rdf:RDF xmlns:rdf="' + RDF + '">\n<rdf:Description>\n</rdf:RDF>');
    assert(open.kind === "err");
    assertEquals(open.error[0]?.kind, "syntax");
    assertStringIncludes(describeFinding(open.error[0] ?? { kind: "slice-empty" }), "line 3");
    const undeclared = readRdfXml(`<rdf:RDF xmlns:rdf="${RDF}"><rdf:Description rdf:about="&nope;"/></rdf:RDF>`);
    assert(undeclared.kind === "err");
    const r = readRdfXml(`<?xml version="1.0"?>
<!DOCTYPE rdf:RDF [ <!ENTITY ext SYSTEM "file:///etc/hostname"> ]>
<rdf:RDF xmlns:rdf="${RDF}" xmlns:ex="https://example.org/v#">
  <rdf:Description rdf:about="https://example.org/a">
    <ex:xml rdf:parseType="Literal"><b>bold</b></ex:xml>
    <ex:plain>kept</ex:plain>
  </rdf:Description>
</rdf:RDF>`);
    assert(r.kind === "ok");
    assertEquals(
      r.value.findings.map((f) => f.kind === "unsupported" && f.what),
      ["an external or parameter entity", 'an XML literal (rdf:parseType="Literal")'],
    );
    assertEquals(keys(r.value.triples), ['<https://example.org/a> <https://example.org/v#plain> "kept" .']);
  },
);

proves(["0019-mizan-integrations FR-024"], "relative IRIs resolve as RFC 3986 says", () => {
  const base = "http://a/b/c/d;p?q";
  const cases: readonly (readonly [string, string])[] = [
    ["g", "http://a/b/c/g"],
    ["./g", "http://a/b/c/g"],
    ["g/", "http://a/b/c/g/"],
    ["/g", "http://a/g"],
    ["//g", "http://g"],
    ["?y", "http://a/b/c/d;p?y"],
    ["g?y#s", "http://a/b/c/g?y#s"],
    ["#s", "http://a/b/c/d;p?q#s"],
    ["", "http://a/b/c/d;p?q"],
    ["..", "http://a/b/"],
    ["../g", "http://a/b/g"],
    ["../../g", "http://a/g"],
    ["../../../g", "http://a/g"],
    ["g:h", "g:h"],
  ];
  for (const [ref, want] of cases) assertEquals(resolveIri(base, ref), want, ref);
});

const SOURCE_RDFXML = `<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="${RDF}" xmlns:owl="http://www.w3.org/2002/07/owl#" xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#" xml:base="https://example.org/vocab#">
  <owl:Class rdf:about="https://example.org/vocab#Widget"><rdfs:subClassOf rdf:resource="https://example.org/vocab#Thing"/></owl:Class>
  <rdfs:Class rdf:ID="Thing"/>
  <owl:ObjectProperty rdf:ID="madeBy"/>
  <owl:Class rdf:ID="Odd"><rdfs:subClassOf><owl:Restriction/></rdfs:subClassOf></owl:Class>
</rdf:RDF>`;
const SOURCE_JSONLD = `{
  "@context": { "owl": "http://www.w3.org/2002/07/owl#", "rdfs": "http://www.w3.org/2000/01/rdf-schema#", "@base": "https://example.org/vocab" },
  "@graph": [
    { "@id": "#Widget", "@type": "owl:Class", "rdfs:subClassOf": { "@id": "#Thing" } },
    { "@id": "#Thing", "@type": "rdfs:Class" },
    { "@id": "#madeBy", "@type": "owl:ObjectProperty" },
    { "@id": "#Odd", "@type": "owl:Class", "rdfs:subClassOf": { "@type": "owl:Restriction" } }
  ]
}`;
const NS = { prefix: "ex", iri: "https://example.org/vocab#" } as const;

proves(
  ["0019-mizan-integrations FR-026"],
  "a slice is imported as the same typed vocabulary from Turtle, JSON-LD and RDF/XML, a blank-node value is named, and a pin mismatch is refused",
  async () => {
    const results: string[] = [];
    for (const [format, sourceText] of [
      ["rdf-xml", SOURCE_RDFXML],
      ["json-ld", SOURCE_JSONLD],
    ] as const) {
      const made = await importVocabulary({
        standard: await standard(sourceText),
        sourceText,
        format,
        namespace: NS,
        slice: ["Widget", "Thing", "madeBy", "Odd"],
        rdfImport: "../kernel/rdf.ts",
      });
      assert(made.kind === "ok", format);
      assertEquals(
        made.value.terms.map((t) => `${t.iri.split("#")[1]} ${t.kind}`),
        ["Odd owl:Class", "Thing rdfs:Class", "Widget owl:Class", "madeBy owl:ObjectProperty"],
        format,
      );
      assertEquals(
        made.value.findings.map((f) => f.kind),
        ["loss"],
        format,
      );
      results.push(
        made.value.module
          .split("\n")
          .filter((l) => /^ {2}\w+: "/.test(l))
          .join("\n"),
      );
    }
    assertEquals(results[0], results[1]);
    const pinned = await importVocabulary({
      standard: await standard(SOURCE_JSONLD, { sha256: "0".repeat(64) }),
      sourceText: SOURCE_JSONLD,
      format: "json-ld",
      namespace: NS,
      slice: ["Thing"],
      rdfImport: "../kernel/rdf.ts",
    });
    assert(pinned.kind === "err" && pinned.error[0]?.kind === "pin-mismatch");
    const broken = await importVocabulary({
      standard: await standard("<a>"),
      sourceText: "<a>",
      format: "rdf-xml",
      namespace: NS,
      slice: ["Thing"],
      rdfImport: "../kernel/rdf.ts",
    });
    assert(broken.kind === "err" && broken.error[0]?.kind === "syntax");
  },
);

const SCHEMA = JSON.stringify({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://example.org/schemas/event.json",
  title: "Event schema",
  $defs: {
    Severity: { enum: ["low", "high", 3, null], description: "how bad" },
    Kind: { oneOf: [{ const: "alert", title: "Alert" }, { const: "note" }] },
    Base: {
      type: "object",
      properties: { id: { type: "string" }, "created-at": { type: "string", format: "date-time" } },
      required: ["id"],
    },
    Event: {
      allOf: [
        { $ref: "#/$defs/Base" },
        {
          type: "object",
          properties: {
            severity: { $ref: "#/$defs/Severity" },
            status: { enum: ["open", "closed"] },
            tags: { type: "array", items: { enum: ["a", "b"] } },
            origin: { type: "object", properties: { host: { type: "string" } }, required: ["host"] },
            kind: { oneOf: [{ $ref: "#/$defs/Kind" }] },
            other: { $ref: "https://example.org/other.json" },
          },
          required: ["severity"],
        },
      ],
      additionalProperties: { type: "string" },
    },
    Plain: { type: "string" },
    Choice: { anyOf: [{ type: "string" }, { type: "number" }], properties: { x: { type: "integer", minimum: 1 } } },
  },
});

proves(
  ["0019-mizan-integrations FR-022", "0019-mizan-integrations FR-006"],
  "a slice of $defs is imported as typed code lists and field-name unions, allOf and $ref followed, enums lifted, deterministically, with the header naming the schema and the slice",
  async () => {
    const input = { standard: await standard(SCHEMA), sourceText: SCHEMA, slice: ["Event", "Severity", "Kind"] } as const;
    const a = await importJsonSchema(input);
    assert(a.kind === "ok");
    const m = a.value.module;
    assertStringIncludes(m, "// AUTO-GENERATED by commons/ts/mizan/integrations/pure/import-json-schema.ts");
    assertStringIncludes(
      m,
      "// schema: Event schema, https://example.org/schemas/event.json, https://json-schema.org/draft/2020-12/schema",
    );
    assertStringIncludes(m, "// slice: Event, Kind, Severity");
    assertStringIncludes(m, "// license: CC0-1.0");
    assertStringIncludes(m, 'export const Severity = ["low", "high", 3, null] as const;');
    assertStringIncludes(m, "export type Severity = (typeof Severity)[number];");
    assertStringIncludes(m, 'export const Kind = ["alert", "note"] as const;');
    assertStringIncludes(m, 'export const EventStatus = ["open", "closed"] as const;');
    assertStringIncludes(m, 'export const EventTagsItem = ["a", "b"] as const;');
    assertStringIncludes(m, 'export const EventOriginFields = {\n  host: { type: "string", required: true },\n} as const;');
    assertStringIncludes(m, "export const EventFields = {");
    assertStringIncludes(m, '  id: { type: "string", required: true },');
    assertStringIncludes(m, '  "created-at": { type: "string", required: false },');
    assertStringIncludes(m, '  severity: { ref: "Severity", required: true },');
    assertStringIncludes(m, '  status: { enum: "EventStatus", required: false },');
    assertStringIncludes(m, '  tags: { type: "array", items: { enum: "EventTagsItem", required: false }, required: false },');
    assertStringIncludes(m, '  origin: { type: "object", fields: "EventOriginFields", required: false },');
    assertStringIncludes(m, '  kind: { ref: "Kind", required: false },');
    assertStringIncludes(m, "export type EventField = keyof typeof EventFields;");
    assert(!m.includes("Plain"), "only the slice is taken");
    const named = a.value.findings.map(describeFinding).join("\n");
    assertStringIncludes(named, "#/$defs/Event has additionalProperties as a schema");
    assertStringIncludes(named, "a $ref outside the schema's $defs (https://example.org/other.json)");
    assertStringIncludes(named, "value constraints (format)");
    assertEquals(
      a.value.terms.map((t) => `${t.iri} ${t.kind}`),
      ["#/$defs/Event field-names", "#/$defs/Kind code-list", "#/$defs/Severity code-list"],
    );
    const b = await importJsonSchema(input);
    assert(b.kind === "ok");
    assertEquals(b.value.module, a.value.module);
  },
);

proves(
  ["0019-mizan-integrations FR-022", "0019-mizan-integrations FR-023", "0019-mizan-integrations FR-006"],
  "a missing definition, one with nothing to hold, an empty slice, a pin mismatch, no license and no right to copy are refused, and a composition it cannot hold is named",
  async () => {
    const base = { standard: await standard(SCHEMA), sourceText: SCHEMA } as const;
    const missing = await importJsonSchema({ ...base, slice: ["Severity", "Nope", "Plain"] });
    assert(missing.kind === "err");
    assertEquals(
      missing.error.map((f) => f.kind),
      ["term-missing", "unsupported"],
    );
    assertStringIncludes(
      describeFinding(missing.error[0] ?? { kind: "slice-empty" }),
      "#/$defs/Nope is in the slice and not in the source",
    );
    const choice = await importJsonSchema({ ...base, slice: ["Choice"] });
    assert(choice.kind === "ok");
    assertEquals(choice.value.terms[0]?.kind, "field-names");
    const named = choice.value.findings.map(describeFinding).join("\n");
    assertStringIncludes(named, "anyOf, a composition of schemas");
    assertStringIncludes(named, "value constraints (minimum)");
    const empty = await importJsonSchema({ ...base, slice: [] });
    assert(empty.kind === "err" && empty.error[0]?.kind === "slice-empty");
    const pin = await importJsonSchema({ ...base, standard: await standard(SCHEMA, { sha256: "0".repeat(64) }), slice: ["Severity"] });
    assert(pin.kind === "err" && pin.error[0]?.kind === "pin-mismatch");
    const none = await importJsonSchema({ ...base, standard: await standard(SCHEMA, { license: "" }), slice: ["Severity"] });
    assert(none.kind === "err" && none.error[0]?.kind === "no-license");
    const closed = await importJsonSchema({ ...base, standard: await standard(SCHEMA, { redistributable: false }), slice: ["Severity"] });
    assert(closed.kind === "err" && closed.error[0]?.kind === "not-redistributable");
    const notJson = await importJsonSchema({ standard: await standard("{"), sourceText: "{", slice: ["A"] });
    assert(notJson.kind === "err" && notJson.error[0]?.kind === "syntax");
    const noDefs = await importJsonSchema({ standard: await standard("{}"), sourceText: "{}", slice: ["A"] });
    assert(noDefs.kind === "err" && noDefs.error[0]?.kind === "syntax");
    const old = JSON.stringify({ $schema: "http://json-schema.org/draft-07/schema#", definitions: { Level: { enum: ["a"] } } });
    const draft7 = await importJsonSchema({ standard: await standard(old), sourceText: old, slice: ["Level"] });
    assert(draft7.kind === "ok");
    assertEquals(draft7.value.findings.length, 2);
    const clash = JSON.stringify({ $defs: { "a-b": { enum: ["x"] }, a_b: { enum: ["y"] } } });
    const same = await importJsonSchema({ standard: await standard(clash), sourceText: clash, slice: ["a-b", "a_b"] });
    assert(same.kind === "err");
    assertStringIncludes(same.error.map(describeFinding).join("\n"), "the same identifier AB");
  },
);

async function exec(...args: string[]): Promise<{ code: number; stderr: string; stdout: string }> {
  const o = await run([execPath(), IMPORT, ...args]);
  return { code: o.code, stderr: o.stderr, stdout: o.stdout };
}

proves(
  ["0019-mizan-integrations FR-026", "0019-mizan-integrations FR-027"],
  "the command imports from a JSON-LD, an RDF/XML and a JSON Schema manifest, checks each module, names a slice that drifted from its header, and the modules load",
  async () => {
    const dir = makeTempDirSync({ prefix: "mizan-formats-" });
    try {
      writeTextFileSync(`${dir}/vocab.jsonld`, SOURCE_JSONLD);
      writeTextFileSync(`${dir}/vocab.rdf`, SOURCE_RDFXML);
      writeTextFileSync(`${dir}/schema.json`, SCHEMA);
      const manifests: readonly (readonly [string, string, string, readonly string[]])[] = [
        ["jsonld", "vocab.jsonld", "json-ld", ["Thing", "Widget", "madeBy"]],
        ["rdfxml", "vocab.rdf", "rdf-xml", ["Thing", "Widget", "madeBy"]],
        ["schema", "schema.json", "json-schema", ["Event", "Severity"]],
      ];
      for (const [name, source, format, slice] of manifests) {
        const text = readTextFileSync(`${dir}/${source}`);
        const rdf = format !== "json-schema";
        writeTextFileSync(
          `${dir}/${name}.ts`,
          `export const manifest = ${JSON.stringify({
            standard: await standard(text, { id: `example-${name}` }),
            source,
            format,
            ...(rdf ? { namespace: NS, rdfImport: KERNEL_RDF } : {}),
            slice,
            out: `${name}.auto.ts`,
          })};\n`,
        );
        assertEquals((await exec(`${dir}/${name}.ts`, "--check")).code, 1, name);
        const wrote = await exec(`${dir}/${name}.ts`);
        assertEquals([wrote.code, wrote.stdout], [0, `wrote ${name}.auto.ts: ${slice.length} terms\n`], name);
        assertEquals((await exec(`${dir}/${name}.ts`, "--check")).code, 0, name);
        assertStringIncludes(readTextFileSync(`${dir}/${name}.auto.prov.ttl`), `urn:ifc:mizan:module:example-${name}`);
      }
      const jsonld: unknown = await import(pathToFileURL(`${dir}/jsonld.auto.ts`).href);
      assert(typeof jsonld === "object" && jsonld !== null && "ex" in jsonld);
      assertEquals(Object.keys(jsonld.ex as object).sort(), ["Thing", "Widget", "madeBy"]);
      const schema: unknown = await import(pathToFileURL(`${dir}/schema.auto.ts`).href);
      assert(typeof schema === "object" && schema !== null && "Severity" in schema && "EventFields" in schema);
      assertEquals(schema.Severity, ["low", "high", 3, null]);
      assertEquals(Object.keys(schema.EventFields as object), [
        "id",
        "created-at",
        "severity",
        "status",
        "tags",
        "origin",
        "kind",
        "other",
      ]);
      const text = readTextFileSync(`${dir}/schema.ts`);
      writeTextFileSync(`${dir}/schema.ts`, text.replace('"Event","Severity"', '"Event","Severity","Kind"'));
      const drift = await exec(`${dir}/schema.ts`, "--check");
      assertEquals(drift.code, 1);
      assertStringIncludes(drift.stderr, "is not what the import makes");
      writeTextFileSync(
        `${dir}/bad.ts`,
        `export const manifest = ${JSON.stringify({ standard: await standard("x"), source: "x", format: "xsd", slice: ["a"], out: "o.ts" })};\n`,
      );
      const bad = await exec(`${dir}/bad.ts`);
      assertEquals(bad.code, 2);
      assertStringIncludes(bad.stderr, "format must be turtle, n-triples, json-ld, rdf-xml, oscal-catalog, json-schema");
    } finally {
      removeSync(dir, { recursive: true });
    }
  },
);
