/**
 * IFC Mizan Integrations (commons 0019-mizan-integrations FR-002 to FR-009): the registry, the reader of Turtle and N-Triples (against the Turtle the kernel writes, which
 * it must read back to the same graph), the importer of a slice of a vocabulary and what stops it, and the command that runs it from a manifest, as a program on the runtime
 * this test runs on. An independent parser read the generated Turtle of Mizan's ontology while this was written, but none is a dependency of the suite.
 *
 * @module
 */
import { files } from "../../ontology/mizan/mod.ts";
import { nTriples, triplesOf } from "../kernel/rdf.ts";
import { sha256 } from "../kernel/sha256.ts";
import { makeTempDirSync, readTextFileSync, removeSync, writeTextFileSync } from "../runtime/fs.ts";
import { dirname, fromFileUrl, resolve } from "../runtime/path.ts";
import { execPath, run } from "../runtime/proc.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "../runtime/test.ts";
import {
  describeFinding,
  emptyRegistry,
  exportJsonSchema,
  exportShacl,
  exportSkos,
  exportSqlCodeList,
  type AnySchema,
  importVocabulary,
  lookup,
  readNTriples,
  readTurtle,
  register,
  type RdfTriple,
  type StandardRecord,
  tripleKey,
  type AnyIntegration,
} from "../mizan/integrations/mod.ts";

const HERE = dirname(fromFileUrl(import.meta.url));
const IMPORT = resolve(HERE, "..", "mizan", "integrations", "host", "import.ts");
const KERNEL_RDF = resolve(HERE, "..", "kernel", "rdf.ts");
const TURTLE = resolve(HERE, "..", "..", "generated", "mizan.auto.ttl");

const keys = (ts: readonly RdfTriple[]): string[] => [...new Set(ts.map(tripleKey))].sort();

proves(
  ["0019-mizan-integrations FR-004"],
  "the reader reads the Turtle the kernel writes back to the graph the kernel's N-Triples say",
  () => {
    const triples = readTurtle(readTextFileSync(TURTLE));
    assert(triples.kind === "ok");
    const written = readNTriples(nTriples(triplesOf(files.flatMap((f) => f.individuals))));
    assert(written.kind === "ok");
    assertEquals(triples.value.findings, []);
    assertEquals(keys(triples.value.triples), keys(written.value.triples));
    assert(triples.value.triples.length > 400);
  },
);

proves(["0019-mizan-integrations FR-004"], "prefixes, a, lists, literals of every kind, long strings and comments are read", () => {
  const r = readTurtle(`# a comment
@prefix ex: <https://example.org/> .
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
ex:a a ex:B , ex:C ;
  ex:name "Name"@en-GB, "plain", "typed"^^xsd:token ;
  ex:n 3, -4.5, 1.0e3 ;
  ex:ok true ;
  ex:long """two
lines with a "quote" and \\u00e9""" .
<https://example.org/b> ex:p ex:a .
`);
  assert(r.kind === "ok");
  assertEquals(r.value.triples.length, 11);
  assertStringIncludes(keys(r.value.triples).join("\n"), '<https://example.org/a> <https://example.org/name> "Name"@en-gb .');
  assertStringIncludes(keys(r.value.triples).join("\n"), '"two\\nlines with a \\"quote\\" and é"');
  assertStringIncludes(keys(r.value.triples).join("\n"), "<http://www.w3.org/2001/XMLSchema#double>");
});

proves(
  ["0019-mizan-integrations FR-007"],
  "a blank node value and a collection are named as losses, and the rest is still read; bad syntax stops with its line",
  () => {
    const r = readTurtle(`@prefix ex: <https://example.org/> .
ex:a ex:p [ ex:q 1 ] ;
  ex:r ( ex:x ex:y ) ;
  ex:s ex:z .
`);
    assert(r.kind === "ok");
    assertEquals(
      r.value.findings.map((f) => f.kind === "loss" && f.what),
      ["blank-node", "collection"],
    );
    assertEquals(
      r.value.triples.map((t) => t.predicate),
      ["https://example.org/s"],
    );
    assertStringIncludes(describeFinding(r.value.findings[0] ?? { kind: "slice-empty" }), "the typed form cannot hold");
    const bad = readTurtle("@prefix ex: <https://example.org/> .\nex:a ex:p ex:b\n");
    assert(bad.kind === "err");
    assertEquals(bad.error[0]?.kind, "syntax");
    const undeclared = readTurtle("nope:a nope:b nope:c .");
    assert(undeclared.kind === "err");
  },
);

const SOURCE = `@prefix ex: <https://example.org/vocab#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
ex:Thing a rdfs:Class .
ex:Widget a owl:Class ; rdfs:subClassOf ex:Thing .
ex:madeBy a owl:ObjectProperty .
ex:size a rdf:Property .
ex:Odd a owl:Class ; rdfs:subClassOf [ a owl:Restriction ] .
ex:plain rdfs:label "no type" .
`;

async function standard(over: Partial<StandardRecord> = {}): Promise<StandardRecord> {
  return {
    id: "example-vocab",
    issuer: "Example Org",
    name: "Example vocabulary",
    version: "1.0",
    location: "https://example.org/vocab",
    license: "CC0-1.0",
    redistributable: true,
    sha256: await sha256(SOURCE),
    ...over,
  };
}
const NS = { prefix: "ex", iri: "https://example.org/vocab#" } as const;

proves(
  ["0019-mizan-integrations FR-005", "0019-mizan-integrations FR-006"],
  "a slice is imported as a typed vocabulary module whose header names its source, and the same input gives the same text",
  async () => {
    const input = {
      standard: await standard(),
      sourceText: SOURCE,
      format: "turtle",
      namespace: NS,
      slice: ["Widget", "Thing", "madeBy", "size"],
      rdfImport: "../kernel/rdf.ts",
    } as const;
    const a = await importVocabulary(input);
    assert(a.kind === "ok");
    assertEquals(
      a.value.terms.map((t) => `${t.iri.split("#")[1]} ${t.kind}`),
      ["Thing rdfs:Class", "Widget owl:Class", "madeBy owl:ObjectProperty", "size rdf:Property"],
    );
    assertStringIncludes(a.value.module, "// AUTO-GENERATED by commons/ts/mizan/integrations");
    assertStringIncludes(a.value.module, "// license: CC0-1.0");
    assertStringIncludes(a.value.module, `// source_sha256=${input.standard.sha256}`);
    assertStringIncludes(a.value.module, '  Widget: "owl:Class",');
    assert(!a.value.module.includes("Odd"), "only the slice is taken");
    const b = await importVocabulary(input);
    assert(b.kind === "ok");
    assertEquals(b.value.module, a.value.module);
  },
);

proves(
  ["0019-mizan-integrations FR-006"],
  "a source whose SHA-256 differs, a standard with no license and one that may not be copied are refused",
  async () => {
    const base = { sourceText: SOURCE, format: "turtle", namespace: NS, slice: ["Thing"], rdfImport: "../kernel/rdf.ts" } as const;
    const pin = await importVocabulary({ ...base, standard: await standard({ sha256: "0".repeat(64) }) });
    assert(pin.kind === "err");
    assertEquals(pin.error[0]?.kind, "pin-mismatch");
    assertStringIncludes(describeFinding(pin.error[0] ?? { kind: "slice-empty" }), "not the pinned");
    const none = await importVocabulary({ ...base, standard: await standard({ license: "" }) });
    assert(none.kind === "err" && none.error[0]?.kind === "no-license");
    const closed = await importVocabulary({ ...base, standard: await standard({ redistributable: false }) });
    assert(closed.kind === "err" && closed.error[0]?.kind === "not-redistributable");
  },
);

proves(
  ["0019-mizan-integrations FR-005", "0019-mizan-integrations FR-007"],
  "a term the source lacks or does not type is named, an empty slice is refused, and a loss in a taken term is named",
  async () => {
    const base = {
      standard: await standard(),
      sourceText: SOURCE,
      format: "turtle",
      namespace: NS,
      rdfImport: "../kernel/rdf.ts",
    } as const;
    const missing = await importVocabulary({ ...base, slice: ["Nothing", "plain"] });
    assert(missing.kind === "err");
    assertEquals(
      missing.error.map((f) => f.kind),
      ["term-missing", "term-untyped"],
    );
    const empty = await importVocabulary({ ...base, slice: [] });
    assert(empty.kind === "err" && empty.error[0]?.kind === "slice-empty");
    const lossy = await importVocabulary({ ...base, slice: ["Odd"] });
    assert(lossy.kind === "ok");
    assertEquals(
      lossy.value.findings.map((f) => f.kind),
      ["loss"],
    );
  },
);

proves(
  ["0019-mizan-integrations FR-002"],
  "the registry looks integrations up by their formats and refuses an identifier or a pair already there",
  () => {
    const mk = (id: string, from: AnyIntegration["from"], to: AnyIntegration["to"], standard: string): AnyIntegration => ({
      id,
      direction: "import",
      from,
      to,
      standard,
      run: () => Promise.reject(new Error("not run")),
    });
    const a = register(emptyRegistry, mk("turtle-vocab", "turtle", "ts-vocabulary", "any"));
    assert(a.kind === "ok");
    const b = register(a.value, mk("turtle-vocab", "n-triples", "ts-vocabulary", "any"));
    assert(b.kind === "err" && b.error.kind === "id-taken");
    const c = register(a.value, mk("other", "turtle", "ts-vocabulary", "any"));
    assert(c.kind === "err" && c.error.kind === "pair-taken");
    assertEquals(
      lookup(a.value, { direction: "import", from: "turtle", to: "ts-vocabulary" }).map((i) => i.id),
      ["turtle-vocab"],
    );
    assertEquals(lookup(a.value, { direction: "export", from: "turtle", to: "ts-vocabulary" }), []);
  },
);

async function exec(...args: string[]): Promise<{ code: number; stderr: string; stdout: string }> {
  const o = await run([execPath(), IMPORT, ...args]);
  return { code: o.code, stderr: o.stderr, stdout: o.stdout };
}

proves(
  ["0019-mizan-integrations FR-006", "0019-mizan-integrations FR-008"],
  "the command imports from a manifest, checks the module is current, and the module it writes loads with the terms of the slice",
  async () => {
    const dir = makeTempDirSync({ prefix: "mizan-import-" });
    try {
      const std = await standard();
      writeTextFileSync(`${dir}/vocab.ttl`, SOURCE);
      writeTextFileSync(
        `${dir}/manifest.ts`,
        `export const manifest = ${JSON.stringify({ standard: std, source: "vocab.ttl", format: "turtle", namespace: NS, slice: ["Thing", "Widget", "madeBy"], out: "vocab.auto.ts", rdfImport: KERNEL_RDF })};\n`,
      );
      assertEquals((await exec(`${dir}/manifest.ts`, "--check")).code, 1);
      const wrote = await exec(`${dir}/manifest.ts`);
      assertEquals([wrote.code, wrote.stdout], [0, "wrote vocab.auto.ts: 3 terms\n"]);
      assertEquals((await exec(`${dir}/manifest.ts`, "--check")).code, 0);
      const loaded: unknown = await import(`${dir}/vocab.auto.ts`);
      assert(typeof loaded === "object" && loaded !== null && "ex" in loaded);
      const ex = loaded.ex as Record<string, { iri: string }>;
      assertEquals(Object.keys(ex).sort(), ["Thing", "Widget", "madeBy"]);
      assertEquals(ex["Widget"]?.iri, "https://example.org/vocab#Widget");
      writeTextFileSync(`${dir}/vocab.auto.ts`, `${readTextFileSync(`${dir}/vocab.auto.ts`)}// edited by hand\n`);
      const stale = await exec(`${dir}/manifest.ts`, "--check");
      assertEquals(stale.code, 1);
      assertStringIncludes(stale.stderr, "is not what the import makes");
      writeTextFileSync(`${dir}/vocab.ttl`, `${SOURCE}ex:Added a owl:Class .\n`);
      const drift = await exec(`${dir}/manifest.ts`);
      assertEquals(drift.code, 2);
      assertStringIncludes(drift.stderr, "not the pinned");
    } finally {
      removeSync(dir, { recursive: true });
    }
  },
);

proves(["0019-mizan-integrations FR-002"], "a manifest with a field missing or of the wrong type is named once, with exit 2", async () => {
  const dir = makeTempDirSync({ prefix: "mizan-import-" });
  try {
    writeTextFileSync(`${dir}/manifest.ts`, `export const manifest = { standard: { id: "x" } };\n`);
    const r = await exec(`${dir}/manifest.ts`);
    assertEquals(r.code, 2);
    assertStringIncludes(r.stderr, "standard.issuer must be a non-empty string");
    assertEquals((await exec()).code, 2);
  } finally {
    removeSync(dir, { recursive: true });
  }
});

proves(
  ["0019-mizan-integrations FR-010"],
  "a code list is written as a SQL table with its quotes escaped, and a table name that is not one is refused",
  () => {
    const ok = exportSqlCodeList("basis", [
      { code: "Adopts", label: "adopts", definition: "The standard's own." },
      { code: "Maps", label: "maps" },
    ]);
    assert(ok.kind === "ok");
    assertEquals(
      ok.value,
      [
        "CREATE TABLE basis (",
        "  code text PRIMARY KEY,",
        "  label text NOT NULL,",
        "  definition text",
        ");",
        "INSERT INTO basis (code, label, definition) VALUES ('Adopts', 'adopts', 'The standard''s own.');",
        "INSERT INTO basis (code, label, definition) VALUES ('Maps', 'maps', NULL);",
        "",
      ].join("\n"),
    );
    const bad = exportSqlCodeList("Basis; DROP TABLE x", []);
    assert(bad.kind === "err" && bad.error[0]?.kind === "bad-name");
    assertStringIncludes(describeFinding(bad.error[0] ?? { kind: "slice-empty" }), "not a name an SQL table may have");
  },
);

proves(
  ["0019-mizan-integrations FR-010"],
  "a code list is written as a SKOS concept scheme that the reader reads back, one concept each with its notation and label",
  () => {
    const text = exportSkos({
      schemeIri: "https://example.org/Scheme",
      label: "Basis",
      conceptBase: "https://example.org/",
      members: [
        { code: "Adopts", label: "adopts", definition: 'A "quoted" one.' },
        { code: "Maps", label: "maps" },
      ],
    });
    const r = readTurtle(text);
    assert(r.kind === "ok");
    assertEquals(r.value.findings, []);
    const k = keys(r.value.triples).join("\n");
    assertStringIncludes(k, '<https://example.org/Adopts> <http://www.w3.org/2004/02/skos/core#notation> "Adopts" .');
    assertStringIncludes(k, '"A \\"quoted\\" one."@en');
    assertEquals(r.value.triples.filter((t) => t.predicate.endsWith("#inScheme")).length, 2);
  },
);

proves(
  ["0019-mizan-integrations FR-010"],
  "a class schema is written as a JSON Schema (the one fields required, many an array, words an enumeration) and as SHACL shapes the reader reads back",
  () => {
    const schema = {
      class: { kind: "named", iri: "https://example.org/Thing", curie: "ex:Thing" },
      curie: "ex:Thing",
      fields: {
        label: {
          property: { kind: "named", iri: "http://www.w3.org/2000/01/rdf-schema#label", curie: "rdfs:label" },
          range: { kind: "lang" },
          cardinality: "one",
        },
        size: {
          property: { kind: "named", iri: "https://example.org/size", curie: "ex:size" },
          range: { kind: "integer" },
          cardinality: "optional",
        },
        tags: {
          property: { kind: "named", iri: "https://example.org/tag", curie: "ex:tag" },
          range: { kind: "string" },
          cardinality: "many",
        },
        status: {
          property: { kind: "named", iri: "https://example.org/status", curie: "ex:status" },
          range: { kind: "string", words: ["Draft", "Active"] },
          cardinality: "one",
        },
        made: {
          property: { kind: "named", iri: "https://example.org/made", curie: "ex:made" },
          range: { kind: "ref" },
          cardinality: "one",
        },
      },
    } as unknown as AnySchema;
    const parsed: unknown = JSON.parse(exportJsonSchema(schema, "https://example.org/thing.json"));
    assertEquals(parsed, {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://example.org/thing.json",
      title: "ex:Thing",
      type: "object",
      properties: {
        label: {
          type: "object",
          required: ["value", "language"],
          properties: { value: { type: "string" }, language: { type: "string" } },
          additionalProperties: false,
        },
        size: { type: "integer" },
        tags: { type: "array", items: { type: "string" } },
        status: { enum: ["Draft", "Active"] },
        made: { type: "string", format: "iri" },
      },
      required: ["label", "status", "made"],
      additionalProperties: false,
    });
    const shapes = exportShacl([schema], { prefix: "sh1", iri: "https://example.org/shapes#" });
    const r = readTurtle(shapes);
    assert(r.kind === "ok");
    const k = keys(r.value.triples).join("\n");
    assertStringIncludes(k, "<http://www.w3.org/ns/shacl#targetClass> <https://example.org/Thing>");
    assertEquals(r.value.triples.filter((t) => t.predicate === "http://www.w3.org/ns/shacl#minCount").length, 3);
    assertEquals(r.value.triples.filter((t) => t.predicate === "http://www.w3.org/ns/shacl#maxCount").length, 4);
    assertStringIncludes(shapes, 'sh:in ( "Draft" "Active" )');
  },
);
