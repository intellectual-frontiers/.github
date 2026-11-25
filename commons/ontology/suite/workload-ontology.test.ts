/**
 * The Workload ontology (commons ontology 0004-workload-terms): its namespace, its classes, the two closed code lists, the audit of every class and the ontology's boundaries. Pure functions over the typed ontology; nothing
 * runs and no network is used.
 *
 * @module
 */
import { validate } from "@intellectual-frontiers/rdf";
import { readDirSync, readTextFileSync } from "@intellectual-frontiers/system/fs";
import { dirname, fromFileUrl, join, resolve } from "@intellectual-frontiers/system/path";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { bases } from "@intellectual-frontiers/ontology/mizan";
import { classes, file, forms, properties, terms, triggers, wl, workloadOntology } from "@intellectual-frontiers/ontology/workload";

const keys = (list: object): string[] => Object.keys(list);
const SRC = join(resolve(dirname(fromFileUrl(import.meta.url)), ".."), "src", "workload");

proves(["0004-workload-terms FR-001"], "the ontology has its namespace, the version 1.0.0 with its version IRI and a description naming the workload, the forms and the triggers", () => {
  assertEquals(wl.Workload.iri, "https://www.intellectualfrontiers.com/ontology/workload#Workload");
  assertEquals(workloadOntology.values.versionInfo, "1.0.0");
  assertEquals(workloadOntology.values.versionIri?.iri, `${workloadOntology.iri}/1.0.0`);
  const d = workloadOntology.values.description?.value ?? "";
  for (const s of ["workload", "forms", "triggers"]) assert(d.includes(s), `the description says ${s}`);
});

proves(["0004-workload-terms FR-002"], "the three classes and the four properties are there, each with a definition, and a workload is a unit of operated work and not running software", () => {
  const names = new Set(classes.map((c) => c.iri));
  for (const n of ["Workload", "Form", "Trigger"] as const) assert(names.has(wl[n].iri), `the class ${n}`);
  const props = new Set(properties.map((p) => p.iri));
  for (const n of ["workloadId", "workloadForm", "workloadTrigger", "formStatus"] as const) assert(props.has(wl[n].iri), `the property ${n}`);
  assertEquals(classes.length, 3);
  for (const c of classes) assert((c.values.definition?.value ?? "").length > 20, `${c.iri} has a definition`);
  const def = classes.find((c) => c.iri === wl.Workload.iri)?.values.definition?.value ?? "";
  assert(def.includes("unit of operated work, not running software"));
});

proves(["0004-workload-terms FR-003"], "the code lists have the members the specification counts, two forms are built and two reserved, and no dialect or trigger is a form", () => {
  assertEquals(keys(forms), ["Runbook", "Reconcile", "Graph", "Campaign"]);
  assertEquals(keys(triggers), ["Manual", "Schedule", "Event", "Alert"]);
  assertEquals(Object.values(forms).map((m) => m.values.formStatus), ["built", "built", "reserved", "reserved"]);
  for (const list of [forms, triggers]) for (const m of Object.values(list)) assert((m.values.definition?.value ?? "").length > 5, `${m.iri} has a definition`);
  for (const name of ["Dialect", "Claude", "Codex", "Human", "Manual", "Schedule", "Event", "Alert"]) assertEquals(keys(forms).includes(name), false, name);
});

proves(["0004-workload-terms FR-004"], "every class has a record of its basis specializing a PROV-O or SKOS term, no IRI is written that was not read, and the modules import only core, rdf and the library", () => {
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
