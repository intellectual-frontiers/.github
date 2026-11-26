// Spec: 0006-zero-trust-terms FR-001
/**
 * The ontology of Zero trust (commons 0047-zero-trust), as the typed values the generator reads (commons 0012-ontology FR-008): its file, and what it states by kind.
 *
 * @module
 */
import type { OntologyFile } from "@intellectual-frontiers/rdf";
import * as zerotrust from "./zerotrust.ts";

export * from "./zerotrust.ts";

/** Every file of the Zero trust ontology, in the order of their names. */
export const files: readonly OntologyFile[] = [zerotrust.file];
