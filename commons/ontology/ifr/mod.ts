/**
 * The ontology of Intellectual Frontiers Releases (commons 0026-works-versioning), as the typed values the generator reads (commons 0012-ontology FR-008):
 * its file, what it states by kind, and the basis of each class (commons 0018-standards-first).
 *
 * @module
 */
import { DCTERMS, OWL, PROV, RDFS, SKOS, XSD, type OntologyFile } from "../../ts/kernel/rdf.ts";
import { MZ, MZID } from "../mizan/mizan.ts";
import { SCHEMA } from "../supply-chain/packaging/schema.auto.ts";
import { IFQS } from "../ifqs/ifqs.ts";
import { decisions, terms } from "./audit.ts";
import * as ifr from "./ifr.ts";

export * from "./ifr.ts";
export { AUDITED_ON, decisions, terms } from "./audit.ts";

/** The file this ontology states: its name, its prefixes, its classes, properties and code lists, and the audit record of each class. */
export const file: OntologyFile = {
  name: "ifr",
  prefixes: [DCTERMS, IFQS, ifr.IFR, ifr.IFRV, MZ, MZID, OWL, PROV, RDFS, SCHEMA, SKOS, XSD],
  individuals: [
    ifr.ifrOntology,
    ...ifr.classes,
    ...ifr.properties,
    ...Object.values(ifr.versionSchemes),
    ...Object.values(ifr.workKinds),
    ...Object.values(ifr.impacts),
    ...terms,
    ...decisions,
  ],
};

/** Every file of the IFR ontology, in the order of their names. */
export const files: readonly OntologyFile[] = [file];
