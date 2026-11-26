/**
 * The Zero trust ontology (commons ontology 0006-zero-trust-terms): its namespace, its classes, the three closed code lists, the audit of every class and the ontology's imports. Pure functions over the typed values; no network is used.
 *
 * @module
 */
import { validate } from "@intellectual-frontiers/rdf";
import { readDirSync, readTextFileSync } from "@intellectual-frontiers/system/fs";
import { dirname, fromFileUrl, join, resolve } from "@intellectual-frontiers/system/path";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { bases } from "@intellectual-frontiers/ontology/mizan";
import { classes, dataSources, file, pillars, properties, tenets, terms, zeroTrustOntology, zt } from "@intellectual-frontiers/ontology/zerotrust";

const keys = (list: object): string[] => Object.keys(list);
const SRC = join(resolve(dirname(fromFileUrl(import.meta.url)), ".."), "src", "zerotrust");

proves(["0006-zero-trust-terms FR-001"], "the ontology has its namespace, the version 1.0.0 with its version IRI and a description naming the architecture, the access decision and implicit trust", () => {
  assertEquals(zt.AccessDecision.iri, "https://www.intellectualfrontiers.com/ontology/zerotrust#AccessDecision");
  assertEquals(zeroTrustOntology.values.versionInfo, "1.0.0");
  assertEquals(zeroTrustOntology.values.versionIri?.iri, `${zeroTrustOntology.iri}/1.0.0`);
  const d = zeroTrustOntology.values.description?.value ?? "";
  for (const s of ["architecture", "access decision", "implicit trust"]) assert(d.includes(s), `the description says ${s}`);
});

proves(["0006-zero-trust-terms FR-002"], "the fourteen classes and the four properties are there, each with a definition, and an access decision is signed and names its policy by hash", () => {
  const names = new Set(classes.map((c) => c.iri));
  for (const n of ["ZeroTrustArchitecture", "PolicyDecisionPoint", "PolicyEngine", "PolicyAdministrator", "PolicyEnforcementPoint", "ProtectSurface", "AccessDecision", "PostureSignal", "ImplicitTrust", "Activity", "MaturityStage", "Pillar", "Tenet", "DataSource"] as const) {
    assert(names.has(zt[n].iri), `the class ${n}`);
  }
  assertEquals(classes.length, 14);
  const props = new Set(properties.map((p) => p.iri));
  for (const n of ["decidedBy", "enforcedAt", "onSurface", "policyHash"] as const) assert(props.has(zt[n].iri), `the property ${n}`);
  assertEquals(properties.length, 4);
  for (const c of classes) assert((c.values.definition?.value ?? "").length > 20, `${c.iri} has a definition`);
  const decision = classes.find((c) => c.iri === zt.AccessDecision.iri)?.values.definition?.value ?? "";
  assert(decision.includes("signed") && decision.includes("policy by hash"));
});

proves(["0006-zero-trust-terms FR-003"], "the code lists have the members the specification counts, with no stage and no activity written", () => {
  assertEquals(keys(tenets).length, 7);
  assertEquals(keys(pillars), ["Identity", "Devices", "Networks", "ApplicationsAndWorkloads", "Data", "VisibilityAndAnalytics", "AutomationAndOrchestration", "Governance"]);
  assertEquals(keys(dataSources).length, 8);
  const all = [tenets, pillars, dataSources];
  for (const list of all) for (const m of Object.values(list)) assert((m.values.definition?.value ?? "").length > 20, `${m.iri} has a definition`);
  const members = all.flatMap((l) => keys(l));
  assertEquals(new Set(members).size, members.length, "no member name is used twice");
  const text = readDirSync(SRC).map((e) => readTextFileSync(join(SRC, e.name))).join("\n");
  for (const stage of ["Traditional", "Initial", "Advanced", "Optimal"]) assertEquals(new RegExp(`\\b${stage}:\\s*\\{`).test(text), false, `${stage} is not written as a member`);
});

proves(["0006-zero-trust-terms FR-004"], "every class has a record of its basis specializing a PROV-O or SKOS term, no IRI is written that was not read, and the modules import only core, rdf and the library", () => {
  const recorded = new Set(terms.map((t) => t.values.termIri));
  for (const c of classes) assert(recorded.has(c.iri), `${c.iri} has a record`);
  for (const t of terms) {
    assertEquals(t.values.basis.iri, bases.Specializes.iri);
    const std = t.values.standardTerm ?? "";
    assert(std.startsWith("http://www.w3.org/ns/prov#") || std.startsWith("http://www.w3.org/2004/02/skos/core#"), `${t.values.termIri} rests on PROV-O or SKOS`);
  }
  assertEquals(validate(file.individuals).length, 0);
  const text = readDirSync(SRC).map((e) => readTextFileSync(join(SRC, e.name))).join("\n");
  for (const m of text.matchAll(/https?:\/\/[^\s"'`)>,]+/g)) {
    const iri = m[0];
    assert(iri.startsWith("https://www.intellectualfrontiers.com/ontology/") || iri.startsWith("http://www.w3.org/"), `${iri} is an IRI of this ontology or one that was read`);
  }
  for (const f of readDirSync(SRC).map((e) => e.name).filter((n) => n.endsWith(".ts"))) {
    const code = readTextFileSync(join(SRC, f)).replace(/\/\*\*[\s\S]*?\*\//g, "");
    const bad = [...code.matchAll(/(?:from|import)\s*\(?\s*"([^"]+)"/g)].map((m) => m[1] ?? "").filter((x) => /^(\.|@)/.test(x) && !/^(\.\.?\/|@intellectual-frontiers\/(core|rdf)(\/|$))/.test(x));
    assertEquals(bad, [], `${f} imports only core, rdf and the library`);
  }
});
