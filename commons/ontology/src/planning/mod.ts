// Spec: 0003-planning-terms FR-001
/**
 * The ontology of Planning (commons 0037-planning), as the typed values the generator reads (commons 0012-ontology FR-008): its file, and what it states by kind.
 *
 * @module
 */
import type { OntologyFile } from "@intellectual-frontiers/rdf";
import * as planning from "./planning.ts";

export * from "./planning.ts";

/** Every file of the Planning ontology, in the order of their names. */
export const files: readonly OntologyFile[] = [planning.file];
