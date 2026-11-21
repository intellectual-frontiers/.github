/**
 * Tests of the documents and the serializers (0004-grc-documents): the canonical form and the digest, derived ids, the registry of serializers and each serializer on an assessment, with the
 * conformance suite run on every one. The formats are checked here for the members the standards require of what is written, not against the standards' own validators.
 *
 * @module
 */
import fc from "fast-check";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { crosswalk, readDocument } from "@intellectual-frontiers/grc/governance";
import { assess, assessment, canonicalize, createSerializers, digestOf, idOf, standardKinds, type Assessment } from "@intellectual-frontiers/grc/logical";
import { serializerConformance } from "@intellectual-frontiers/grc/conformance";
import { cyclonedx } from "@intellectual-frontiers/grc/serializers/cyclonedx";
import { intoto } from "@intellectual-frontiers/grc/serializers/intoto";
import { ocsf } from "@intellectual-frontiers/grc/serializers/ocsf";
import { oscal } from "@intellectual-frontiers/grc/serializers/oscal";
import { sarif } from "@intellectual-frontiers/grc/serializers/sarif";
import { memoryStore } from "@intellectual-frontiers/grc/stores/memory";
import { aCheck, aResult, AT, A1, B1, ex, must, other, OTHER1, walk, anException } from "./fixtures.ts";
import { standardSerializers } from "../src/standard.ts";

async function sample(): Promise<Assessment> {
  const store = memoryStore();
  const put = await store.put(new TextEncoder().encode("disk report"), { subject: "host-1", type: "disk-report", mediaType: "text/plain", observedAt: AT });
  if (put.kind === "err") throw new Error(put.error.message);
  return assess({
    id: "assessment-1",
    title: "Q2 posture",
    at: AT,
    frameworks: [ex, other],
    results: [
      aResult("disk-encrypted", "host-1", "fail"),
      aResult("disk-encrypted", "host-2", "pass"),
      aResult("logs", "host-1", "pass", { controls: [B1] }),
      aResult("patched", "host-1", "warn", { controls: ["urn:grc:ex:1:A-2"] }),
    ],
    evidence: [put.value],
    checks: [aCheck("disk-encrypted", [A1]), aCheck("logs", [B1])],
    exceptions: [anException()],
    risks: [],
  });
}
const EMPTY: Assessment = assess({ id: "assessment-0", title: "Empty", at: AT, frameworks: [], results: [] });

proves(["0004-grc-documents FR-001"], "a kind is defined from the decoders of its body and an assessment round-trips through the registry of kinds", async () => {
  const a = await sample();
  const back = readDocument(standardKinds(), JSON.parse(JSON.stringify(a)));
  assertEquals(back.kind, "ok");
  assertEquals(assessment.decode(a).kind, "ok");
  assertEquals(a.provenance.producer.name, "@intellectual-frontiers/grc");
  const dup = standardKinds().register(assessment);
  assertEquals(dup.kind, "err");
});

proves(["0004-grc-documents FR-002"], "a document of another schema or an unknown kind is an error value that names what was found and what was expected", async () => {
  const a = await sample();
  const r = readDocument(standardKinds(), { ...a, schema: "2" });
  assertEquals(r.kind === "err" ? r.error : undefined, { kind: "schema", documentKind: "grc.assessment", found: "2", expected: "1" });
  assertEquals(readDocument(standardKinds(), { ...a, kind: "grc.unknown" }).kind === "err" && true, true);
});

proves(["0004-grc-documents FR-003"], "the canonical form sorts members and the digest is the same for any order", async () => {
  assertEquals(canonicalize({ b: 1, a: 2.0 }), '{"a":2,"b":1}');
  assertEquals(canonicalize([3, { z: null, y: [true] }, "s"]), '[3,{"y":[true],"z":null},"s"]');
  assertEquals(canonicalize({ a: undefined, b: 1 }), '{"b":1}');
  assertEquals(await digestOf({ b: 1, a: 2 }), await digestOf({ a: 2, b: 1 }));
  assertEquals((await digestOf({ a: 1 })).length, 64);
  await fc.assert(
    fc.asyncProperty(fc.dictionary(fc.string({ maxLength: 3 }), fc.integer()), async (m) => {
      const reversed = Object.fromEntries(Object.entries(m).reverse());
      assertEquals(await digestOf(m), await digestOf(reversed));
    }),
  );
});

proves(["0004-grc-documents FR-004"], "a derived id is a version 5 UUID of a namespace and a name: the same parts give the same id", async () => {
  const a = await idOf(["assessment-1", "x"]);
  assertEquals(a, await idOf(["assessment-1", "x"]));
  assert(a !== (await idOf(["assessment-1", "y"])));
  assert(/^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(a), a);
});

proves(["0004-grc-documents FR-005"], "serializers are registered by stable id, give the same bytes for the same assessment and read no clock", async () => {
  const r = standardSerializers();
  assertEquals(r.list().map((s) => s.id), ["cyclonedx", "intoto", "ocsf", "oscal", "sarif"]);
  assertEquals(createSerializers().register(oscal).kind, "ok");
  const a = await sample();
  for (const s of r.list()) {
    const one = await s.serialize(a, { predicateType: "https://example.test/predicate/v1" });
    const two = await s.serialize(a, { predicateType: "https://example.test/predicate/v1" });
    assertEquals(one, two, s.id);
    assertEquals(one.kind, "ok", s.id);
  }
});

proves(["0004-grc-documents FR-006"], "oscal writes assessment-results with observations and a finding for each control, and stable uuids", async () => {
  const a = await sample();
  const w = await oscal.serialize(a, {});
  assertEquals(w.kind, "ok");
  const doc = JSON.parse(w.kind === "ok" ? w.value : "{}");
  const ar = doc["assessment-results"];
  assertEquals(ar.metadata["oscal-version"], "1.2.3");
  const res = ar.results[0];
  assertEquals(res.observations.length, 4);
  assertEquals(res.findings.map((f: { title: string }) => f.title), ["a-1", "a-2", "b-1"]);
  assertEquals(res.findings[0].target.status.state, "not-satisfied");
  assertEquals(res.findings[2].target.status.state, "satisfied");
  for (const u of [ar.uuid, res.uuid, res.observations[0].uuid]) assert(/^[0-9a-f-]{36}$/.test(u), u);
  const again = JSON.parse((await oscal.serialize(a, {})).kind === "ok" ? ((await oscal.serialize(a, {})) as { value: string }).value : "{}");
  assertEquals(again["assessment-results"].uuid, ar.uuid);
  const equalWalk = must(crosswalk.decode, { ...walk, mappings: [{ from: B1, to: OTHER1, relationship: "equal", strength: 9 }] });
  const mapped = await oscal.serialize(a, { crosswalks: [equalWalk], options: { framework: "other" } });
  assertStringIncludes(mapped.kind === "ok" ? mapped.value : "", '"x-1"');
  assertEquals((await oscal.serialize(a, { options: { model: "nothing" } })).kind, "err");
});

proves(["0004-grc-documents FR-007"], "oscal writes a system security plan of what is implemented and a plan of action of what is open", async () => {
  const a = await sample();
  const ssp = JSON.parse(((await oscal.serialize(a, { options: { model: "system-security-plan" } })) as { value: string }).value);
  const reqs = ssp["system-security-plan"]["control-implementation"]["implemented-requirements"];
  assertEquals(reqs.map((r: { "control-id": string }) => r["control-id"]), ["a-1", "a-2", "b-1"]);
  assertEquals(reqs.map((r: { "by-components": { "implementation-status": { state: string } }[] }) => r["by-components"][0]?.["implementation-status"].state), ["partial", "partial", "implemented"], "a control is implemented only where every result shows it");
  const poam = JSON.parse(((await oscal.serialize(a, { options: { model: "plan-of-action-and-milestones" } })) as { value: string }).value)["plan-of-action-and-milestones"];
  assertEquals(poam.risks.length, 2);
  assertEquals(poam["poam-items"][0]["related-risks"][0]["risk-uuid"], poam.risks[0].uuid);
  assertEquals(poam.risks.some((r: { status: string }) => r.status === "open"), true);
  const none = JSON.parse(((await oscal.serialize(EMPTY, { options: { model: "plan-of-action-and-milestones" } })) as { value: string }).value);
  assertEquals(none["plan-of-action-and-milestones"]["poam-items"].length, 1);
});

proves(["0004-grc-documents FR-008"], "ocsf writes each finding as a compliance finding of class 2003 with the mapped ids", async () => {
  const a = await sample();
  const w = await ocsf.serialize(a, {});
  const lines = (w.kind === "ok" ? w.value : "").trim().split("\n").map((l) => JSON.parse(l));
  assertEquals(lines.length, a.findings.length);
  const fail = lines.find((l) => l.compliance.status === "fail");
  assertEquals([fail.class_uid, fail.type_uid, fail.severity_id, fail.compliance.status_id], [2003, 200301, 4, 3]);
  assertEquals(fail.metadata.version, "1.9.0");
  assert(typeof fail.metadata.product.name === "string" && typeof fail.time === "number");
  assertEquals(lines.find((l) => l.compliance.status === "warn").compliance.status_id, 2);
});

proves(["0004-grc-documents FR-009"], "sarif writes one run with a rule for each check and a result for each finding", async () => {
  const w = await sarif.serialize(await sample(), {});
  const doc = JSON.parse(w.kind === "ok" ? w.value : "{}");
  assertEquals(doc.version, "2.1.0");
  assertEquals(doc.runs.length, 1);
  assertEquals(doc.runs[0].results.map((r: { level: string }) => r.level), ["error", "warning"]);
  assertEquals(doc.runs[0].tool.driver.rules.map((r: { id: string }) => r.id), ["disk-encrypted", "patched"]);
  assertEquals(doc.runs[0].results[0].locations[0].logicalLocations[0].name, "host-1");
});

proves(["0004-grc-documents FR-010"], "cyclonedx writes declarations and intoto a statement of the evidence digests with the predicate type the caller names", async () => {
  const a = await sample();
  const bom = JSON.parse(((await cyclonedx.serialize(a, {})) as { value: string }).value);
  assertEquals([bom.bomFormat, bom.specVersion], ["CycloneDX", "1.6"]);
  assertEquals(bom.declarations.claims.length, 3);
  assertEquals(bom.declarations.evidence.length, 1);
  assertEquals(bom.definitions.standards.map((s: { name: string }) => s.name), ["Example", "Other"]);
  assert(/^urn:uuid:/.test(bom.serialNumber));
  assertEquals((await intoto.serialize(a, {})).kind, "err");
  const st = JSON.parse(((await intoto.serialize(a, { predicateType: "https://example.test/p/v1" })) as { value: string }).value);
  assertEquals([st._type, st.predicateType], ["https://in-toto.io/Statement/v1", "https://example.test/p/v1"]);
  assertEquals(st.subject.length, 1);
  assertEquals(st.subject[0].digest.sha256, a.evidence[0]?.digest);
});

proves(["0004-grc-documents FR-011"], "the conformance suite passes every serializer of the library and fails one that is not deterministic", async () => {
  const a = await sample();
  for (const s of standardSerializers().list()) {
    assertEquals(await serializerConformance(s, a, EMPTY, { predicateType: "https://example.test/p/v1" }, (t) => (t === "" || t.startsWith("{") ? undefined : "not JSON")), [], s.id);
  }
  let n = 0;
  const flaky = { ...sarif, id: "flaky", serialize: () => Promise.resolve({ kind: "ok" as const, value: String(n++) }) };
  const failures = await serializerConformance(flaky, a, EMPTY);
  assertEquals(failures.map((f) => f.name), ["deterministic"]);
  const throws = { ...sarif, id: "throws", serialize: () => Promise.reject(new Error("boom")) };
  assertEquals((await serializerConformance(throws, a, EMPTY)).length > 0, true);
});

proves(["0004-grc-documents FR-007"], "the system security plan says what the caller says of the system and invents nothing else: its sensitivity, boundary, profile, information types, components, users and who is responsible for each control", async () => {
  const a = await sample();
  const w = await oscal.serialize(a, {
    options: {
      model: "system-security-plan",
      system: {
        description: "The lab fleet.", sensitivity: "moderate", boundary: "Every machine of the fleet and nothing else.", profile: "https://example.test/profiles/moderate.json",
        informationTypes: [{ title: "Technical data", description: "What the fleet holds." }], components: [{ name: "athens", type: "software", description: "A server." }], users: [{ title: "Administrator" }],
        responsibilities: { "a-1": "inherited", "b-1": "provider", "a-2": "customer" },
      },
    },
  });
  assert(w.kind === "ok");
  const ssp = JSON.parse(w.value)["system-security-plan"];
  assertEquals(ssp["import-profile"].href, "https://example.test/profiles/moderate.json");
  const sc = ssp["system-characteristics"];
  assertEquals([sc.description, sc["security-sensitivity-level"], sc["authorization-boundary"].description, sc["system-information"]["information-types"][0].title], ["The lab fleet.", "moderate", "Every machine of the fleet and nothing else.", "Technical data"]);
  assertEquals(ssp["system-implementation"].components.map((c: { title: string }) => c.title), ["Q2 posture", "athens"]);
  assertEquals(ssp["system-implementation"].users[0].title, "Administrator");
  const by = (id: string) => ssp["control-implementation"]["implemented-requirements"].find((r: { "control-id": string }) => r["control-id"] === id)["by-components"][0];
  assert(by("a-1").inherited.length === 1 && by("b-1").satisfied.length === 1 && by("a-2").export.responsibilities.length === 1);
  const bare = JSON.parse(((await oscal.serialize(a, { options: { model: "system-security-plan" } })) as { value: string }).value)["system-security-plan"];
  assertEquals(bare["system-characteristics"]["authorization-boundary"].description, "Not stated by the assessment.");
  assertEquals(bare["system-characteristics"]["security-sensitivity-level"], undefined, "no sensitivity is made up");
});

proves(["0004-grc-documents FR-007"], "the three OSCAL documents are valid against NIST's published schema, where the schema (OSCAL_SCHEMA, a file) and a Node with ajv (OSCAL_AJV, the folder that holds it) are at hand", async (t) => {
  const schema = process.env["OSCAL_SCHEMA"];
  const ajv = process.env["OSCAL_AJV"];
  if (schema === undefined || schema === "" || ajv === undefined || ajv === "") return t.skip("OSCAL_SCHEMA and OSCAL_AJV are not set: fetch oscal_complete_schema.json from NIST's OSCAL release and install ajv and ajv-formats in a folder");
  const a = await sample();
  const docs: string[] = [];
  for (const model of ["assessment-results", "system-security-plan", "plan-of-action-and-milestones"]) {
    const w = await oscal.serialize(a, { options: { model, system: { sensitivity: "moderate" } } });
    assert(w.kind === "ok");
    docs.push(w.value);
  }
  const { proc, fs, path } = await import("@intellectual-frontiers/system");
  await fs.withTempDir(async (dir) => {
    const script = path.join(dir, "v.mjs");
    await fs.writeTextFile(script, `import { createRequire } from "node:module";import { readFileSync } from "node:fs";const require = createRequire(${JSON.stringify(`${ajv}/`)});const Ajv = require("ajv");const add = require("ajv-formats");const a = new Ajv({ strict: false, allErrors: true });add(a);const v = a.compile(JSON.parse(readFileSync(${JSON.stringify(schema)}, "utf8")));const bad = [];for (const f of process.argv.slice(2)) { if (!v(JSON.parse(readFileSync(f, "utf8")))) bad.push(f + ": " + JSON.stringify(v.errors.slice(0, 5))); }console.log(bad.join("\\n"));process.exit(bad.length ? 1 : 0);`);
    const files: string[] = [];
    for (const [i, d] of docs.entries()) {
      const f = path.join(dir, `d${i}.json`);
      await fs.writeTextFile(f, d);
      files.push(f);
    }
    const r = await proc.run(["node", script, ...files], {});
    assert(r.success, r.stdout + r.stderr);
  });
});
