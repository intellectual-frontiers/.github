// Spec: 0002-oto FR-001
/**
 * The Operational Truth Ontology (commons ontology 0002-oto), as the typed values the generator reads (commons 0012-ontology FR-008): its file, and what it states by kind.
 *
 * @module
 */
import type { OntologyFile } from "@intellectual-frontiers/rdf";
import * as oto from "./oto.ts";

export * from "./oto.ts";

/** Every file of the OTO ontology, in the order of their names. */
export const files: readonly OntologyFile[] = [oto.file];
