/**
 * Tests of the FHIR plugin (commons integrations-fhir 0001-integrations-fhir-plugin FR-001 to FR-007): the entries and their licence, the codec for JSON and NDJSON round-tripped
 * over made-up resources, the conformance suite of Integrations, the loader over definitions supplied in the test and refused from an embedded source, validation by a loaded
 * StructureDefinition and terminology, and OperationOutcome. Every value is made up; no real person or record is anywhere.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { embeddingFindings, register, sourceAllowed, type StandardsRegistry } from "@intellectual-frontiers/integrations/governance";
import { conformPlugin, detect, findingsHoldNoValue, loadFrom, registerPlugin, statusOf, transactionsOf, validate, valuesOf, type Terminologies } from "@intellectual-frontiers/integrations/logical";
import { EMBEDDED, FHIR_JSON, FHIR_NDJSON, FHIR_R4, STANDARDS, US_CORE, fhirNdjsonPlugin, fhirPlugin, jsonCodec, ndjsonCodec, repeatingPaths } from "../src/mod.ts";

const PATIENT = '{"resourceType":"Patient","id":"pt-1","active":true,"name":[{"family":"Zyxwvut","given":["Qwertyuiop","Asdfghjkl"]}],"gender":"female","birthDate":"1970-01-02","multipleBirthInteger":2}';
const NDJSON = `${PATIENT}\n{"resourceType":"Patient","id":"pt-2","gender":"male"}\n`;

const SD = JSON.stringify({
  resourceType: "StructureDefinition",
  name: "TestPatient",
  version: "1.0.0",
  type: "Patient",
  derivation: "constraint",
  snapshot: {
    element: [
      { path: "Patient", min: 0, max: "*" },
      { path: "Patient.id", min: 1, max: "1" },
      { path: "Patient.name", min: 1, max: "*" },
      { path: "Patient.name.family", min: 1, max: "1" },
      { path: "Patient.name.given", min: 0, max: "*" },
      { path: "Patient.gender", min: 0, max: "1", binding: { strength: "required", valueSet: "http://example.test/ValueSet/test-gender|1" } },
      { path: "Patient.birthDate", min: 0, max: "1" },
      { path: "Patient.active", min: 0, max: "1" },
      { path: "Patient.multipleBirth[x]", min: 0, max: "1" },
    ],
  },
});
const VS = JSON.stringify({ resourceType: "ValueSet", url: "http://example.test/ValueSet/test-gender", version: "1", compose: { include: [{ concept: [{ code: "male" }, { code: "female" }] }] } });

proves(["0001-integrations-fhir-plugin FR-001"], "the entries carry a licence as data, and nothing is embedded", () => {
  assertEquals(STANDARDS.map((s) => s.urn), [FHIR_JSON, FHIR_NDJSON, FHIR_R4, US_CORE]);
  assertEquals(STANDARDS.map((s) => s.level), ["syntax", "syntax", "schema", "profile"]);
  for (const s of STANDARDS) {
    assert(s.license.terms.includes("hl7.org/fhir/license"));
    assert(!sourceAllowed(s.license, "embedded-in-package"));
  }
  assertEquals(EMBEDDED, []);
  const reg: StandardsRegistry = STANDARDS.reduce<StandardsRegistry>((r, s) => {
    const x = register(r, s);
    return x.kind === "ok" ? x.value : r;
  }, new Map());
  assertEquals(reg.size, 4);
  assertEquals(embeddingFindings(reg, EMBEDDED), []);
});

proves(["0001-integrations-fhir-plugin FR-002", "0001-integrations-fhir-plugin FR-003"], "the codec round-trips JSON and NDJSON, and the plugins pass the conformance suite", () => {
  assertEquals(conformPlugin(fhirPlugin(), { valid: [PATIENT], garbage: ["not json at all", "", '{"noResourceType":true}'] }), []);
  assertEquals(conformPlugin(fhirNdjsonPlugin(), { valid: [NDJSON], garbage: ["", "nonsense"] }), []);
  const c = jsonCodec(new Set(["Patient.name", "Patient.name.given"]));
  const parsed = c.parse(PATIENT);
  assert(parsed.kind === "ok");
  assertEquals(JSON.parse((c.serialize(parsed.value) as { value: string }).value), JSON.parse(PATIENT));
  const single = c.parse('{"resourceType":"Patient","name":[{"family":"Aaaa"}]}');
  assert(single.kind === "ok");
  const written = c.serialize(single.value);
  assert(written.kind === "ok" && Array.isArray(JSON.parse(written.value).name), "a repeating path is written as an array though one occurs");
  const nd = ndjsonCodec().parse(NDJSON);
  assert(nd.kind === "ok");
  assertEquals(transactionsOf(nd.value).map((t) => t.control), ["pt-1", "pt-2"]);
  const first = registerPlugin(new Map(), fhirPlugin());
  assert(first.kind === "ok");
  const reg = registerPlugin(first.value, fhirNdjsonPlugin());
  assertEquals(reg.kind, "ok");
  const found = reg.kind === "ok" ? detect(reg.value, NDJSON) : undefined;
  assert(found?.kind === "ok");
});

proves(["0001-integrations-fhir-plugin FR-004"], "a syntax failure holds none of the text", () => {
  const r = jsonCodec().parse("SECRETVALUE {");
  assert(r.kind === "err");
  assert(!JSON.stringify(r).includes("SECRETVALUE"));
  assertEquals(jsonCodec().parse("").kind, "err");
});

proves(["0001-integrations-fhir-plugin FR-005"], "definitions are loaded from supplied data only, and a StructureDefinition validates a resource", () => {
  const plugin = fhirPlugin();
  assertEquals(loadFrom(plugin, { origin: "embedded-in-package", standard: FHIR_R4, text: SD }).kind, "err");
  const defs = loadFrom(plugin, { origin: "user-supplied", standard: FHIR_R4, text: SD });
  assert(defs.kind === "ok");
  const vs = loadFrom(plugin, { origin: "user-supplied", standard: FHIR_R4, text: VS });
  assert(vs.kind === "ok");
  assertEquals(defs.value.profiles.length, 1);
  const schema = defs.value.schemas[0];
  assert(schema !== undefined);
  assertEquals(schema.transaction, "Patient");
  assert(!schema.paths.some((p) => p.includes("[x]")), "choice types are skipped");
  const terminologies: Terminologies = new Map(vs.value.terminologies.map((t) => [t.id.urn, t] as const));
  assertEquals([...(vs.value.terminologies[0]?.codes ?? [])].sort(), ["female", "male"]);
  const codec = jsonCodec(repeatingPaths(defs.value.schemas));
  const ok1 = codec.parse(PATIENT.replace(",\"multipleBirthInteger\":2", ""));
  assert(ok1.kind === "ok");
  const t = transactionsOf(ok1.value)[0];
  assert(t !== undefined);
  assertEquals(validate(t, schema, { terminologies }).filter((f) => f.severity === "error"), []);
  const wrong = codec.parse('{"resourceType":"Patient","gender":"zzz","name":[{"given":["Qwertyuiop"]}],"surprise":"Mnbvcxz"}');
  assert(wrong.kind === "ok");
  const wt = transactionsOf(wrong.value)[0];
  assert(wt !== undefined);
  const fs = validate(wt, schema, { terminologies });
  assertEquals(fs.map((f) => f.code).sort(), ["cardinality-min", "cardinality-min", "code-not-in-terminology", "unknown-path"]);
  assert(findingsHoldNoValue(fs, wrong.value));
  for (const v of valuesOf(wrong.value)) assert(v.length < 4 || fs.every((f) => !f.message.includes(v)), v);
  assertEquals(loadFrom(plugin, { origin: "user-supplied", standard: FHIR_R4, text: "not json" }).kind, "err");
  assertEquals(loadFrom(plugin, { origin: "user-supplied", standard: FHIR_R4, text: '{"resourceType":"Patient"}' }).kind, "err");
});

proves(["0001-integrations-fhir-plugin FR-006"], "an OperationOutcome is made from a status and read back into findings with no value", () => {
  const acks = fhirPlugin().acks;
  assert(acks !== undefined);
  const parsed = jsonCodec().parse(PATIENT);
  assert(parsed.kind === "ok");
  for (const [status, want] of [["accepted", "accepted"], ["accepted-with-errors", "accepted-with-errors"], ["rejected", "rejected"]] as const) {
    const o = acks.acknowledge(parsed.value, status);
    assert(o.kind === "ok");
    const read = acks.read(o.value);
    assert(read.kind === "ok");
    const first = read.value[0];
    assert(first !== undefined);
    assertEquals(statusOf(first), want);
    assert(!JSON.stringify(read).includes("Zyxwvut"));
  }
  const outcome = acks.acknowledge(parsed.value, "rejected");
  assert(outcome.kind === "ok");
  const text = jsonCodec().serialize(outcome.value);
  assert(text.kind === "ok" && text.value.includes('"resourceType":"OperationOutcome"') && text.value.includes('"issue":[{'));
});

proves(["0001-integrations-fhir-plugin FR-007"], "the plugin keeps to Integrations' ports and names no code of another standard", () => {
  const plugin = fhirPlugin();
  assertEquals(plugin.codec.syntax.urn, FHIR_JSON);
  assertEquals(plugin.loaders.map((l) => l.standard), [FHIR_R4]);
  assertEquals(fhirNdjsonPlugin().codec.syntax.urn, FHIR_NDJSON);
});
