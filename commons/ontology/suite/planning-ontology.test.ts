/**
 * The Planning ontology (commons ontology 0003-planning-terms): its namespace, its classes, the thirteen closed code lists, the names that other standards give (as names, never as IRIs), the audit of
 * every class and the ontology's boundaries. Pure functions over the typed ontology; nothing runs and no network is used.
 *
 * @module
 */
import { validate } from "@intellectual-frontiers/rdf";
import { readDirSync, readTextFileSync } from "@intellectual-frontiers/system/fs";
import { dirname, fromFileUrl, join, resolve } from "@intellectual-frontiers/system/path";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { bases } from "@intellectual-frontiers/ontology/mizan";
import {
  actorKinds,
  capabilities,
  classes,
  closeReasons,
  eventTypes,
  fieldAuthorities,
  file,
  itemKinds,
  linkKinds,
  locatorKinds,
  origins,
  plan,
  planningOntology,
  principalBases,
  properties,
  severities,
  states,
  terms,
  verdicts,
} from "@intellectual-frontiers/ontology/planning";

const keys = (list: object): string[] => Object.keys(list);
const SRC = join(resolve(dirname(fromFileUrl(import.meta.url)), ".."), "src", "planning");

proves(["0003-planning-terms FR-001"], "the ontology has its namespace, the version 1.0.0 with its version IRI and a description naming the model", () => {
  assertEquals(plan.Item.iri, "https://www.intellectualfrontiers.com/ontology/planning#Item");
  assertEquals(planningOntology.values.versionInfo, "1.0.0");
  const d = planningOntology.values.description?.value ?? "";
  for (const s of ["four kinds", "events", "observations", "patches"]) assert(d.includes(s), `the description says ${s}`);
});

proves(["0003-planning-terms FR-002"], "the ten classes of the model and the thirteen of the code lists are there, each with a definition", () => {
  const names = new Set(classes.map((c) => c.iri));
  for (const n of ["Item", "Event", "Actor", "Observation", "Locator", "Trace", "Link", "Patch", "Preview", "Source"] as const) assert(names.has(plan[n].iri), `the class ${n}`);
  for (const n of ["ItemKind", "State", "CloseReason", "Severity", "Verdict", "LinkKind", "Capability", "FieldAuthority", "Origin", "ActorKind", "LocatorKind", "EventType", "PrincipalBasis"] as const) assert(names.has(plan[n].iri), `the class ${n}`);
  assertEquals(classes.length, 23);
  const props = new Set(properties.map((p) => p.iri));
  for (const n of ["principalBasis", "externalSource", "externalValue", "deferredUntil", "itemMotivation", "itemBlocker", "itemTarget", "itemSource", "itemPriority", "itemSize", "itemGoals", "itemEngines", "itemCites", "itemEvidence", "sourceSeverity"] as const)
    assert(props.has(plan[n].iri), `the property ${n}`);
  for (const c of classes) assert((c.values.definition?.value ?? "").length > 20, `${c.iri} has a definition`);
});

proves(["0003-planning-terms FR-003"], "the thirteen code lists have the members the specification counts", () => {
  assertEquals(keys(itemKinds), ["Issue", "Task", "Todo", "Finding"]);
  assertEquals(keys(states), ["Proposed", "Open", "InProgress", "Deferred", "Closed"]);
  assertEquals(keys(closeReasons), ["Completed", "NotPlanned", "Duplicate"]);
  assertEquals(keys(severities), ["Error", "Warning", "Note"]);
  assertEquals(keys(verdicts), ["Accept", "MinorRevision", "MajorRevision", "Reject"]);
  assertEquals(keys(linkKinds), ["Blocks", "SameAs", "RelatesTo", "ParentOf"]);
  assertEquals(keys(capabilities).length, 7);
  assertEquals(keys(fieldAuthorities), ["SourceWins", "StoreWins", "LatestWins", "PersonOnly"]);
  assertEquals(keys(origins), ["Declared", "Derived", "Inferred"]);
  assertEquals(keys(actorKinds), ["ByPerson", "ByAgent", "ByTool"]);
  assertEquals(keys(locatorKinds), ["FileSpan", "Url", "Commit"]);
  assertEquals(keys(eventTypes), [
    "OpenedEvent",
    "CommentedEvent",
    "EditedEvent",
    "LabeledEvent",
    "AssignedEvent",
    "SeveritySetEvent",
    "BlockerSetEvent",
    "StartedEvent",
    "DeferredEvent",
    "ClosedEvent",
    "ReopenedEvent",
    "DecidedEvent",
    "LinkedEvent",
    "ConfirmedEvent",
  ]);
  assertEquals(keys(principalBases), ["Session", "Argument", "Configuration", "CommitAuthor"]);
  for (const list of [itemKinds, states, closeReasons, severities, verdicts, linkKinds, capabilities, fieldAuthorities, origins, actorKinds, locatorKinds, eventTypes, principalBases])
    for (const m of Object.values(list)) assert((m.values.definition?.value ?? "").length > 5, `${m.iri} has a definition`);
});

proves(["0003-planning-terms FR-004"], "a name from another standard is a name in a property that says whose it is, read in the standard's text and cited by section, and no IRI is written but one that was read", () => {
  assertEquals(severities.Error.values.sarifLevel, "error");
  assertEquals(severities.Warning.values.sarifLevel, "warning");
  assertEquals(severities.Note.values.sarifLevel, "note");
  assertEquals(states.Open.values.icalStatus, "NEEDS-ACTION");
  assertEquals(states.InProgress.values.icalStatus, "IN-PROCESS");
  assertEquals(itemKinds.Finding.values.webAnnotationMotivation, "assessing");
  assertEquals(closeReasons.Completed.values.githubStateReason, "completed");
  assertEquals(closeReasons.NotPlanned.values.githubStateReason, "not_planned");
  assertEquals(closeReasons.Duplicate.values.githubStateReason, "duplicate");
  for (const p of ["sarifLevel", "icalStatus", "webAnnotationMotivation", "githubStateReason"] as const) {
    const prop = properties.find((x) => x.iri === plan[p].iri);
    const d = prop?.values.definition?.value ?? "";
    assert(prop !== undefined && !d.includes("to verify") && /section|REST API/.test(d), `${p} cites its section and no longer says to verify`);
  }
  const text = readDirSync(SRC).map((e) => readTextFileSync(join(SRC, e.name))).join("\n");
  assert(!text.includes("(to verify"), "no name is left to verify");
  for (const host of ["oasis-open.org", "rfc-editor.org", "datatracker.ietf.org", "github.github.com", "open-services.net"]) assert(!text.includes(host), `no IRI at ${host}`);
  for (const m of text.matchAll(/https?:\/\/[^\s"'`)>,]+/g)) {
    const iri = m[0];
    assert(iri.startsWith("https://www.intellectualfrontiers.com/ontology/") || iri.startsWith("http://www.w3.org/"), `${iri} is an IRI of this ontology or one that was read`);
  }
});

proves(["0003-planning-terms FR-005"], "every class has a record of its basis, specializing a PROV-O or SKOS term, and none is unaligned", () => {
  const recorded = new Set(terms.map((t) => t.values.termIri));
  for (const c of classes) assert(recorded.has(c.iri), `${c.iri} has a record`);
  for (const t of terms) {
    assertEquals(t.values.basis.iri, bases.Specializes.iri);
    const std = t.values.standardTerm ?? "";
    assert(std.startsWith("http://www.w3.org/ns/prov#") || std.startsWith("http://www.w3.org/2004/02/skos/core#"), `${t.values.termIri} rests on PROV-O or SKOS`);
  }
  assertEquals(validate(file.individuals).length, 0);
});

proves(["0003-planning-terms FR-006"], "the modules import only core, rdf and the ontologies of the library", () => {
  for (const f of readDirSync(SRC).map((e) => e.name).filter((n) => n.endsWith(".ts"))) {
    const text = readTextFileSync(join(SRC, f)).replace(/\/\*\*[\s\S]*?\*\//g, "");
    const bad = [...text.matchAll(/(?:from|import)\s*\(?\s*"([^"]+)"/g)].map((m) => m[1] ?? "").filter((x) => /^(\.|@)/.test(x) && !/^(\.\.?\/|@intellectual-frontiers\/(core|rdf)(\/|$))/.test(x));
    assertEquals(bad, [], `${f} imports only core, rdf and the library`);
  }
});
