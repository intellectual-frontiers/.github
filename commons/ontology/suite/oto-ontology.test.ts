/**
 * The Operational Truth Ontology (commons ontology 0002-oto): the nine domains, six invariants, three pillars, five principles and four maturity levels, the states of an alignment, the acceptance run that specializes the test run of IFQS,
 * the audit of every class, and the ontology's boundaries. Pure functions over the typed ontology; nothing runs and no network is used.
 *
 * @module
 */
import { validate } from "@intellectual-frontiers/rdf";
import { readDirSync, readTextFileSync } from "@intellectual-frontiers/system/fs";
import { dirname, fromFileUrl, join, resolve } from "@intellectual-frontiers/system/path";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { bases } from "@intellectual-frontiers/ontology/mizan";
import { ifqs } from "@intellectual-frontiers/ontology/ifqs";
import {
  alignmentStates,
  classes,
  dimensions,
  domains,
  file,
  invariants,
  maturityLevels,
  oto,
  otoOntology,
  pillars,
  principles,
  properties,
  terms,
} from "@intellectual-frontiers/ontology/oto";

const keys = (list: object): string[] => Object.keys(list);
const SRC = join(resolve(dirname(fromFileUrl(import.meta.url)), ".."), "src", "oto");

proves(["0002-oto FR-001"], "the ontology has its namespace, a version and a description naming the trademark, the source and that it was built from the site alone", () => {
  assertEquals(oto.Domain.iri, "https://www.intellectualfrontiers.com/ontology/oto#Domain");
  const d = otoOntology.values.description?.value ?? "";
  for (const s of ["Operational Truth", "Netspective Communications LLC", "operationaltruth.org", "published site alone"]) assert(d.includes(s), `the description says ${s}`);
  assertEquals(otoOntology.values.versionInfo, "1.0.0");
});

proves(["0002-oto FR-002"], "the nine domains are numbered 1 to 9 in order, with the source's entities and the libraries that realize them", () => {
  const all = Object.values(domains);
  assertEquals(all.map((d) => d.values.domainNumber), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assertEquals(domains.InfrastructureAndPlatform.values.realizedBy, ["estate", "archon", "toolchain"]);
  assert((domains.OrganizationalStructure.values.entity ?? []).includes("Delegation of Authority"));
  assertEquals(domains.ProcessAndWorkflow.values.realizedBy, [], "a domain no library realizes lists none");
});

proves(["0002-oto FR-003"], "the six invariants each say their violation is a system error and not an audit finding", () => {
  assertEquals(keys(invariants), ["NoOrphanPolicies", "NoUnownedResponsibilities", "NoUnenforcedCriticalControls", "NoEvidenceWithoutAttribution", "NoAuthorityWithoutScope", "NoComplianceWithoutTraceability"]);
  for (const i of Object.values(invariants)) assert((i.values.definition?.value ?? "").includes("system error, not an audit finding"), `${i.iri} says so`);
});

proves(["0002-oto FR-004"], "there are three pillars, five principles and four maturity levels numbered 1 to 4", () => {
  assertEquals(keys(pillars).length, 3);
  assertEquals(keys(principles).length, 5);
  assertEquals(Object.values(maturityLevels).map((l) => l.values.levelNumber), [1, 2, 3, 4]);
  for (const m of [...Object.values(pillars), ...Object.values(principles), ...Object.values(maturityLevels)]) assert((m.values.definition?.value ?? "").length > 20, `${m.iri} has the source's sentence`);
});

proves(["0002-oto FR-005"], "an alignment has the four facets and three states, and says the states are not the source's", () => {
  assertEquals(keys(alignmentStates), ["Aligned", "Drifted", "NotObserved"]);
  for (const s of Object.values(alignmentStates)) assert((s.values.definition?.value ?? "").includes("Not on the source's site"), `${s.iri} says where it is from`);
  assert(properties.some((p) => p.iri === oto.alignmentState.iri));
  for (const f of ["intent", "structure", "execution", "evidence"] as const) assert(properties.some((p) => p.iri === oto[f].iri), `the facet ${f}`);
});

proves(["0002-oto FR-006"], "an acceptance run specializes the test run of IFQS and has the four dimensions of OAT", () => {
  const run = classes.find((c) => c.iri === oto.AcceptanceRun.iri);
  assert(run !== undefined);
  assertEquals(run.values.subClassOf?.map((c) => c.iri), [ifqs.TestRun.iri]);
  assertEquals(keys(dimensions), ["StabilityOfOutcomes", "AcceptableRanges", "Trustworthiness", "FailureModesAndRecovery"]);
  for (const p of ["expectedOutcome", "observedOutcome", "dimension"] as const) assert(properties.some((x) => x.iri === oto[p].iri), `the property ${p}`);
});

proves(["0002-oto FR-007"], "every class has a record of its basis, a class no standard names is unaligned with the decision pending, and no record invents a standard IRI", () => {
  const recorded = new Set(terms.map((t) => t.values.termIri));
  for (const c of classes) assert(recorded.has(c.iri), `${c.iri} has a record`);
  for (const t of terms) {
    if (t.values.basis.iri === bases.Unaligned.iri) assert((t.values.justification ?? "").includes("Decision pending"), `${t.values.termIri} says the decision is pending`);
    else assert((t.values.standardTerm ?? "").startsWith("http"), `${t.values.termIri} names the IRI of a term`);
  }
  assertEquals(validate(file.individuals).length, 0);
});

proves(["0002-oto FR-008"], "the modules import only core, rdf and the ontologies of the library", () => {
  for (const f of readDirSync(SRC).map((e) => e.name).filter((n) => n.endsWith(".ts"))) {
    const text = readTextFileSync(join(SRC, f)).replace(/\/\*\*[\s\S]*?\*\//g, "");
    const bad = [...text.matchAll(/(?:from|import)\s*\(?\s*"([^"]+)"/g)].map((m) => m[1] ?? "").filter((x) => /^(\.|@)/.test(x) && !/^(\.\.?\/|@intellectual-frontiers\/(core|rdf)(\/|$))/.test(x));
    assertEquals(bad, [], `${f} imports only core, rdf and the library`);
  }
});
