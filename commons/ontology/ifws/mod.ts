/**
 * The ontology of Intellectual Frontiers Workspaces (commons 0023-if-workspaces, 0024-ifws-host, 0025-ifws), as the typed values the generator reads (commons 0012-ontology FR-008):
 * its file, what it states by kind, and the basis of each class (commons 0018-standards-first).
 *
 * @module
 */
import { DCTERMS, OWL, PROV, RDFS, SKOS, XSD, type OntologyFile } from "../../ts/kernel/rdf.ts";
import { MZ, MZID } from "../mizan/mizan.ts";
import { SCHEMA } from "../supply-chain/packaging/schema.auto.ts";
import { terms } from "./audit.ts";
import * as ifws from "./ifws.ts";

export * from "./ifws.ts";
export { AUDITED_ON, terms } from "./audit.ts";

/** The file this ontology states: its name, its prefixes, its classes, properties and code lists, and the audit record of each class. */
export const file: OntologyFile = {
  name: "ifws",
  prefixes: [DCTERMS, ifws.DCAT, ifws.IFWS, ifws.IFWSV, MZ, MZID, OWL, PROV, RDFS, SCHEMA, SKOS, XSD],
  individuals: [
    ifws.ifwsOntology,
    ...ifws.classes,
    ...ifws.properties,
    ...Object.values(ifws.gitCapabilities),
    ...Object.values(ifws.actionKinds),
    ...Object.values(ifws.severities),
    ...Object.values(ifws.repoStates),
    ...Object.values(ifws.gitManagerKinds),
    ...Object.values(ifws.moduleSources),
    ...Object.values(ifws.exitStatuses),
    ...terms,
  ],
};

/** Every file of the IFWS ontology, in the order of their names. */
export const files: readonly OntologyFile[] = [file];
