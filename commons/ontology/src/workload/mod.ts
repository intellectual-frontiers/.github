// Spec: 0004-workload-terms FR-001
/**
 * The ontology of Workload (commons 0040-workload-pattern), as the typed values the generator reads (commons 0012-ontology FR-008): its file, and what it states by kind.
 *
 * @module
 */
import type { OntologyFile } from "@intellectual-frontiers/rdf";
import * as workload from "./workload.ts";

export * from "./workload.ts";

/** Every file of the Workload ontology, in the order of their names. */
export const files: readonly OntologyFile[] = [workload.file];
