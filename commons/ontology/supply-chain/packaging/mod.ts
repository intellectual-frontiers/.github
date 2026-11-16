/**
 * The packaging ontology of the software supply chain capability (commons 0002-packaging, 0004-rules), as the typed values the
 * generator reads (commons 0012-ontology FR-008): every file of it, in the order of their names, and each kind of individual it states.
 *
 * @module
 */
import type { OntologyFile } from "../../../ts/kernel/rdf.ts";
import * as families from "./families.ts";
import * as managers from "./managers.ts";
import * as packaging from "./packaging.ts";
import * as pins from "./pins.ts";
import * as programs from "./programs.ts";
import * as record from "./record.ts";
import * as rules from "./rules.ts";

export * from "./packaging.ts";

/** Every file of the packaging ontology, in the order of their names. */
export const files: readonly OntologyFile[] = [families.file, managers.file, packaging.file, pins.file, programs.file, record.file, rules.file];

/** Every individual the packaging ontology states, by kind, as the generator reads them. */
export const ontology = {
  classes: packaging.classes,
  properties: packaging.properties,
  managers: managers.managers,
  commands: managers.commands,
  prohibitions: managers.prohibitions,
  families: families.families,
  programs: programs.programs,
  packageNames: programs.packageNames,
  platforms: pins.platforms,
  pins: pins.pins,
  checksums: pins.checksums,
  rules: rules.rules,
  recordFields: record.recordFields,
} as const;

/** The packaging ontology, as the generator reads it. */
export type Ontology = typeof ontology;

export { codeOf, formatRdfFinding, nTriples, triplesOf, turtle, validate } from "../../../ts/kernel/rdf.ts";
export type { Iri, Named, Namespace, OntologyFile, RdfFinding } from "../../../ts/kernel/rdf.ts";
export { DCTERMS, OWL, owl, RDFS, SKOS, XSD } from "../../../ts/kernel/rdf.ts";
