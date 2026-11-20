/**
 * The ontology of Kanon (commons 0033-kanon), as the typed values the generator reads (commons 0012-ontology FR-008): its file, and what it states by kind.
 *
 * @module
 */
import type { OntologyFile } from "@intellectual-frontiers/rdf";
import * as kanon from "./kanon.ts";

export * from "./kanon.ts";

/** Every file of the Kanon ontology, in the order of their names. */
export const files: readonly OntologyFile[] = [kanon.file];
