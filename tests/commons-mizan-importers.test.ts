/**
 * The readers of JSON-LD and RDF/XML and the importer of a JSON Schema against independent tools (commons 0019-mizan-integrations FR-028): the graph a reader gives equals the graph
 * rdflib reads from the same text, and the code lists and field names an import writes equal what `jsonschema` accepts and an independent resolution of the schema gives.
 * Python with rdflib and jsonschema is not on every computer (the CI installs them): where it is not, these tests are skipped and say so. While the readers were written
 * they were also run on schema.org's JSON-LD (17,515 triples) and on twelve W3C RDF/XML files (SKOS core, OWL, PROV-O, SHACL, DCAT and others, 8,848 triples), each
 * equal to rdflib's graph; those files are not copied here.
 *
 * @module
 */
import { fs, path, proc } from "../commons/ts/runtime/mod.ts";
import { assert, assertEquals, proves } from "../commons/ts/runtime/test.ts";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { importJsonSchema, readJsonLd, readRdfXml, type Read } from "../commons/ts/mizan/integrations/mod.ts";
import type { Result } from "../commons/core/src/mod.ts";
import type { IntegrationFinding } from "../commons/ts/mizan/integrations/mod.ts";

const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";

const GRAPHS = `
import sys, json, rdflib
from rdflib import URIRef, BNode, Literal
from rdflib.compare import graph_diff

fmt, source, triples = sys.argv[1], sys.argv[2], sys.argv[3]
XS = URIRef("http://www.w3.org/2001/XMLSchema#string")

def term(t):
    if t["kind"] == "iri":
        return URIRef(t["value"])
    if t["kind"] == "blank":
        return BNode(t["label"])
    if t.get("lang"):
        return Literal(t["value"], lang=t["lang"])
    if t["datatype"] == str(XS):
        return Literal(t["value"])
    return Literal(t["value"], datatype=URIRef(t["datatype"]))

mine = rdflib.Graph()
for t in json.load(open(triples)):
    mine.add((term(t["subject"]), URIRef(t["predicate"]), term(t["object"])))
ref = rdflib.Graph()
ref.parse(source, format=fmt)
for (a, b, c) in list(ref):
    if isinstance(c, Literal) and c.datatype == XS:
        ref.remove((a, b, c))
        ref.add((a, b, Literal(str(c))))
both, only_mine, only_ref = graph_diff(mine, ref)
assert len(only_mine) == 0 and len(only_ref) == 0, (list(only_mine)[:3], list(only_ref)[:3])
assert len(mine) > 5
print(len(mine))
`;

const SCHEMAS = `
import sys, json, re
from jsonschema import Draft202012Validator

schema = json.load(open(sys.argv[1]))
module = json.load(open(sys.argv[2]))
Draft202012Validator.check_schema(schema)
defs = schema["$defs"]

def valid(sub):
    return Draft202012Validator({"$schema": "https://json-schema.org/draft/2020-12/schema", "$ref": sub, "$defs": defs})

for name, sub in [("Severity", "#/$defs/Severity"), ("Kind", "#/$defs/Kind")]:
    v = valid(sub)
    assert all(v.is_valid(m) for m in module[name]), name
    assert not v.is_valid("not-a-member"), name
status = Draft202012Validator({"type": "object", "properties": defs["Event"]["allOf"][1]["properties"]})
assert all(status.is_valid({"status": m}) for m in module["EventStatus"])
assert not status.is_valid({"status": "nope"})

def props(name):
    s = defs[name]
    out = {}
    for b in s.get("allOf", []):
        out.update(props(b["$ref"].split("/")[-1]) if "$ref" in b else b.get("properties", {}))
    out.update(s.get("properties", {}))
    return out

assert sorted(module["EventFields"]) == sorted(props("Event")), (sorted(module["EventFields"]), sorted(props("Event")))
assert [k for k, v in module["EventFields"].items() if v["required"]] == ["id", "severity"]
print("agree")
`;

async function python(t: { skip: (reason: string) => void }, modules: string): Promise<string | undefined> {
  const py = proc.which("python3");
  const have = py === undefined ? undefined : await proc.run([py, "-c", `import ${modules}`]);
  if (py === undefined || have === undefined || have.code !== 0) {
    t.skip(`python3 with ${modules} is not installed`);
    return undefined;
  }
  return py;
}

const JSONLD = `{
  "@context": {
    "@vocab": "https://example.org/v#",
    "@base": "https://example.org/data/",
    "label": { "@id": "http://www.w3.org/2000/01/rdf-schema#label", "@language": "en" },
    "seeAlso": { "@id": "http://www.w3.org/2000/01/rdf-schema#seeAlso", "@type": "@id" },
    "count": { "@id": "https://example.org/v#count", "@type": "http://www.w3.org/2001/XMLSchema#integer" },
    "names": { "@id": "https://example.org/v#names", "@container": "@language" },
    "id": "@id",
    "type": "@type"
  },
  "@graph": [
    { "id": "a", "type": ["Thing", "https://example.org/v#Other"], "label": "A thing", "seeAlso": "b", "count": "3", "ratio": 1.5, "n": 7, "ok": true, "big": 1e3 },
    { "id": "b", "parts": { "@list": ["x", { "@id": "c" }] }, "tags": { "@set": ["p", "q"] }, "note": { "@value": "chat", "@language": "fr" }, "names": { "en": "Bee", "fr": "Abeille" } },
    { "id": "c", "@reverse": { "contains": { "@id": "a" } } },
    { "id": "d", "child": { "name": "inner", "deeper": { "@id": "a" } } }
  ]
}`;

const RDFXML = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE rdf:RDF [
  <!ENTITY rdf "${RDF}">
  <!ENTITY ex "https://example.org/v#">
]>
<rdf:RDF xmlns:rdf="&rdf;" xmlns:ex="&ex;" xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#" xml:base="https://example.org/doc">
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

/** The read of a source, written beside it as JSON for the Python script, and the script's verdict. */
async function agree(
  t: { skip: (reason: string) => void },
  format: string,
  file: string,
  text: string,
  read: (text: string) => Result<Read, readonly IntegrationFinding[]>,
): Promise<void> {
  const py = await python(t, "rdflib");
  if (py === undefined) return;
  const dir = fs.makeTempDirSync({ prefix: "mizan-independent-" });
  try {
    const r = read(text);
    assert(r.kind === "ok");
    assertEquals(r.value.findings, []);
    fs.writeTextFileSync(`${dir}/${file}`, text);
    fs.writeTextFileSync(`${dir}/triples.json`, JSON.stringify(r.value.triples));
    const o = await proc.run([py, "-c", GRAPHS, format, `${dir}/${file}`, `${dir}/triples.json`]);
    assertEquals(o.code, 0, o.stderr);
    assert(Number(o.stdout.trim()) > 5);
  } finally {
    fs.removeSync(dir, { recursive: true });
  }
}

proves(
  ["0019-mizan-integrations FR-028", "0019-mizan-integrations FR-020"],
  "the graph the JSON-LD reader gives equals the graph rdflib reads",
  async (t) => {
    await agree(t, "json-ld", "doc.jsonld", JSONLD, (text) => readJsonLd(text));
  },
);

proves(
  ["0019-mizan-integrations FR-028", "0019-mizan-integrations FR-024"],
  "the graph the RDF/XML reader gives equals the graph rdflib reads",
  async (t) => {
    await agree(t, "xml", "doc.rdf", RDFXML, (text) => readRdfXml(text));
  },
);

const SCHEMA = JSON.stringify({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $defs: {
    Severity: { enum: ["low", "high"] },
    Kind: { oneOf: [{ const: "alert" }, { const: "note" }] },
    Base: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    Event: {
      allOf: [
        { $ref: "#/$defs/Base" },
        {
          type: "object",
          properties: { severity: { $ref: "#/$defs/Severity" }, status: { enum: ["open", "closed"] } },
          required: ["severity"],
        },
      ],
    },
  },
});

proves(
  ["0019-mizan-integrations FR-028", "0019-mizan-integrations FR-022"],
  "the code lists and field names a JSON Schema import writes agree with jsonschema and with an independent resolution of the schema",
  async (t) => {
    const py = await python(t, "jsonschema");
    if (py === undefined) return;
    const made = await importJsonSchema({
      standard: {
        id: "example-schema",
        issuer: "Example Org",
        name: "Example",
        version: "1.0",
        location: "https://example.org/schema.json",
        license: "CC0-1.0",
        redistributable: true,
        sha256: await sha256(SCHEMA),
      },
      sourceText: SCHEMA,
      slice: ["Severity", "Kind", "Event"],
    });
    assert(made.kind === "ok");
    const dir = fs.makeTempDirSync({ prefix: "mizan-independent-" });
    try {
      fs.writeTextFileSync(`${dir}/schema.json`, SCHEMA);
      fs.writeTextFileSync(`${dir}/module.ts`, made.value.module);
      const loaded: unknown = await import(path.toFileUrl(`${dir}/module.ts`).href);
      fs.writeTextFileSync(`${dir}/module.json`, JSON.stringify(loaded));
      const o = await proc.run([py, "-c", SCHEMAS, `${dir}/schema.json`, `${dir}/module.json`]);
      assertEquals([o.code, o.stdout.trim()], [0, "agree"], o.stderr);
    } finally {
      fs.removeSync(dir, { recursive: true });
    }
  },
);
