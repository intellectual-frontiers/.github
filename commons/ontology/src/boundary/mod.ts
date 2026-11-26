// Spec: 0005-boundary-terms FR-001
/**
 * The ontology of Boundaries (commons 0045-boundaries), as the typed values the generator reads (commons 0012-ontology FR-008): its file, and what it states by kind.
 *
 * @module
 */
import type { OntologyFile } from "@intellectual-frontiers/rdf";
import * as boundary from "./boundary.ts";

export * from "./boundary.ts";

/** Every file of the Boundaries ontology, in the order of their names. */
export const files: readonly OntologyFile[] = [boundary.file];
