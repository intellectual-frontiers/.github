/**
 * The ontology of the Intellectual Frontiers Quality System (commons 0021-ifqs, 0022-trust), as the typed values the generator reads
 * (commons 0012-ontology FR-008): its file, and what it states by kind.
 *
 * @module
 */
import type { OntologyFile } from "@intellectual-frontiers/rdf";
import * as ifqs from "./ifqs.ts";

export * from "./ifqs.ts";

/** Every file of the IFQS ontology, in the order of their names. */
export const files: readonly OntologyFile[] = [ifqs.file];
