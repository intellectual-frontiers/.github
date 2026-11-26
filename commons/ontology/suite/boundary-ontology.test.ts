/**
 * The Boundaries ontology (commons ontology 0005-boundary-terms): its namespace, its classes, the six closed code lists, the audit of every class and the ontology's imports. Pure functions over the typed values;
 * no network is used.
 *
 * @module
 */
import { validate } from "@intellectual-frontiers/rdf";
import { readDirSync, readTextFileSync } from "@intellectual-frontiers/system/fs";
import { dirname, fromFileUrl, join, resolve } from "@intellectual-frontiers/system/path";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { bases } from "@intellectual-frontiers/ontology/mizan";
import { bnd, boundaryKinds, boundaryOntology, classes, cmmcAssetCategories, dataClasses, dispositions, file, impacts, partyRoles, properties, terms } from "@intellectual-frontiers/ontology/boundary";

const keys = (list: object): string[] => Object.keys(list);
const SRC = join(resolve(dirname(fromFileUrl(import.meta.url)), ".."), "src", "boundary");

proves(["0005-boundary-terms FR-001"], "the ontology has its namespace, the version 1.0.0 with its version IRI and a description naming the boundary, the dispositions and the interconnections", () => {
  assertEquals(bnd.Boundary.iri, "https://www.intellectualfrontiers.com/ontology/boundary#Boundary");
  assertEquals(boundaryOntology.values.versionInfo, "1.0.0");
  assertEquals(boundaryOntology.values.versionIri?.iri, `${boundaryOntology.iri}/1.0.0`);
  const d = boundaryOntology.values.description?.value ?? "";
  for (const s of ["boundary", "dispositions", "interconnection"]) assert(d.includes(s), `the description says ${s}`);
});

proves(["0005-boundary-terms FR-002"], "the fifteen classes and the four properties are there, each with a definition, and a boundary is not a realm", () => {
  const names = new Set(classes.map((c) => c.iri));
  for (const n of ["Boundary", "Realm", "Enclave", "Interconnection", "ExternalSystem", "Inheritance", "ProcessingActivity", "Categorization", "Jurisdiction", "BoundaryKind", "Disposition", "Impact", "CmmcAssetCategory", "PartyRole", "DataClass"] as const) {
    assert(names.has(bnd[n].iri), `the class ${n}`);
  }
  assertEquals(classes.length, 15);
  const props = new Set(properties.map((p) => p.iri));
  for (const n of ["boundaryId", "boundaryKind", "categorizedAs", "residentIn"] as const) assert(props.has(bnd[n].iri), `the property ${n}`);
  assertEquals(properties.length, 4);
  for (const c of classes) assert((c.values.definition?.value ?? "").length > 20, `${c.iri} has a definition`);
  const boundary = classes.find((c) => c.iri === bnd.Boundary.iri)?.values.definition?.value ?? "";
  const realm = classes.find((c) => c.iri === bnd.Realm.iri)?.values.definition?.value ?? "";
  assert(boundary.includes("not a realm"));
  assert(realm.toLowerCase().includes("where assets are found"));
});

proves(["0005-boundary-terms FR-003"], "the code lists have the members the specification counts and no boundary kind is a realm or a disposition", () => {
  assertEquals(keys(boundaryKinds), [
    "AuthorizationBoundary",
    "CuiEnvironment",
    "EphiEnvironment",
    "CardholderDataEnvironment",
    "Soc2System",
    "Privacy",
    "Organizational",
    "NetworkZone",
    "Trust",
    "EngagementScope",
  ]);
  assertEquals(keys(dispositions), ["InScope", "Inherited", "External", "OutOfScope", "Undecided"]);
  assertEquals(keys(impacts), ["Low", "Moderate", "High"]);
  assertEquals(keys(cmmcAssetCategories), ["CuiAsset", "SecurityProtectionAsset", "ContractorRiskManagedAsset", "SpecializedAsset", "OutOfScopeAsset"]);
  assertEquals(keys(partyRoles), ["Controller", "Processor"]);
  assertEquals(keys(dataClasses).length, 12);
  const all = [boundaryKinds, dispositions, impacts, cmmcAssetCategories, partyRoles, dataClasses];
  for (const list of all) for (const m of Object.values(list)) assert((m.values.definition?.value ?? "").length > 5, `${m.iri} has a definition`);
  const members = all.flatMap((l) => keys(l));
  assertEquals(new Set(members).size, members.length, "no member name is used twice");
  assertEquals(keys(boundaryKinds).includes("Realm"), false);
});

proves(["0005-boundary-terms FR-004"], "every class has a record of its basis specializing a PROV-O or SKOS term, no IRI is written that was not read, and the modules import only core, rdf and the library", () => {
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
