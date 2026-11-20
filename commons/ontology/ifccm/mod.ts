/**
 * The ontology of Intellectual Frontiers Capabilities Configuration Management (commons 0020-ifccm), as the typed values the generator reads
 * (commons 0012-ontology FR-008): its file, and what it states by kind.
 *
 * @module
 */
import type { OntologyFile } from "../../rdf/src/mod.ts";
import * as ifccm from "./ifccm.ts";

export * from "./ifccm.ts";

/** Every file of the IFCCM ontology, in the order of their names. */
export const files: readonly OntologyFile[] = [ifccm.file];
