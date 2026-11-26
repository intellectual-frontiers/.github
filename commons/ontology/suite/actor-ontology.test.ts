/**
 * The Actors ontology (commons ontology 0007-actor-terms): its namespace, its classes, the four closed code lists, the audit of every class and the ontology's imports. Pure functions over typed values, with no network.
 *
 * @module
 */
import { validate } from "@intellectual-frontiers/rdf";
import { readDirSync, readTextFileSync } from "@intellectual-frontiers/system/fs";
import { dirname, fromFileUrl, join, resolve } from "@intellectual-frontiers/system/path";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { bases } from "@intellectual-frontiers/ontology/mizan";
import { act, actorKinds, actorOntology, classes, file, nonconformityRules, properties, roles, signatureMeanings, taskingLevels, terms } from "@intellectual-frontiers/ontology/actor";

const keys = (list: object): string[] => Object.keys(list);
const SRC = join(resolve(dirname(fromFileUrl(import.meta.url)), ".."), "src", "actor");

proves(["0007-actor-terms FR-001"], "the ontology has its namespace, the version 1.0.0 with its version IRI and a description naming the act, the actor, the directive and the signature meanings", () => {
  assertEquals(act.Actor.iri, "https://www.intellectualfrontiers.com/ontology/actor#Actor");
  assertEquals(actorOntology.values.versionInfo, "1.0.0");
  assertEquals(actorOntology.values.versionIri?.iri, `${actorOntology.iri}/1.0.0`);
  const d = actorOntology.values.description?.value ?? "";
  for (const s of ["act", "actor", "directive", "signature"]) assert(d.includes(s), `the description says ${s}`);
});

proves(["0007-actor-terms FR-002"], "the eleven classes and the nine properties are there, each with a definition, and the role properties run from an act to an actor", () => {
  const names = new Set(classes.map((c) => c.iri));
  for (const n of ["Act", "Actor", "Directive", "Tasking", "Qualification", "NonconformityRule", "ReviewCanary", "Role", "ActorKind", "TaskingLevel", "SignatureMeaning"] as const) {
    assert(names.has(act[n].iri), `the class ${n}`);
  }
  assertEquals(classes.length, 11);
  const props = new Set(properties.map((p) => p.iri));
  for (const n of ["initiatedBy", "preparedBy", "assistedBy", "executedBy", "reviewedBy", "approvedBy", "underDirective", "brokeRule", "directiveDigest"] as const) assert(props.has(act[n].iri), `the property ${n}`);
  assertEquals(properties.length, 9);
  for (const c of classes) assert((c.values.definition?.value ?? "").length > 20, `${c.iri} has a definition`);
  for (const n of ["initiatedBy", "preparedBy", "assistedBy", "executedBy", "reviewedBy", "approvedBy"] as const) {
    const p = properties.find((x) => x.iri === act[n].iri);
    assertEquals(p?.values.domain?.iri, act.Act.iri, `${n} starts at an act`);
    assertEquals(p?.values.range?.iri, act.Actor.iri, `${n} ends at an actor`);
  }
});

proves(["0007-actor-terms FR-003"], "the code lists have the members the specification counts, with no member name used twice", () => {
  assertEquals(keys(roles), ["Initiator", "Preparer", "Assistant", "Executor", "Reviewer", "Approver"]);
  assertEquals(keys(actorKinds), ["Person", "System", "Agent"]);
  assertEquals(keys(taskingLevels).length, 4);
  assertEquals(keys(signatureMeanings), ["Review", "Approval", "Responsibility", "Authorship"]);
  assertEquals(keys(nonconformityRules).length, 7);
  const all = [roles, actorKinds, taskingLevels, signatureMeanings, nonconformityRules];
  for (const list of all) for (const m of Object.values(list)) assert((m.values.definition?.value ?? "").length > 20, `${m.iri} has a definition`);
  const members = all.flatMap((l) => keys(l));
  assertEquals(new Set(members).size, members.length, "no member name is used twice");
});

proves(["0007-actor-terms FR-004"], "every class has a record of its basis specializing a PROV-O or SKOS term, an actor rests on prov:Agent, no IRI is written that was not read, and the modules import only core, rdf and the library", () => {
  const recorded = new Set(terms.map((t) => t.values.termIri));
  for (const c of classes) assert(recorded.has(c.iri), `${c.iri} has a record`);
  for (const t of terms) {
    assertEquals(t.values.basis.iri, bases.Specializes.iri);
    const std = t.values.standardTerm ?? "";
    assert(std.startsWith("http://www.w3.org/ns/prov#") || std.startsWith("http://www.w3.org/2004/02/skos/core#"), `${t.values.termIri} rests on PROV-O or SKOS`);
  }
  assertEquals(terms.find((t) => t.values.termIri === act.Actor.iri)?.values.standardTerm, "http://www.w3.org/ns/prov#Agent");
  assertEquals(terms.find((t) => t.values.termIri === act.Act.iri)?.values.standardTerm, "http://www.w3.org/ns/prov#Activity");
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
