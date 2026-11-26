// Spec: 0007-actor-terms FR-001
/**
 * The ontology of Actors (commons 0048-actors), as the typed values the generator reads (commons 0012-ontology FR-008): its file, and what it states by kind.
 *
 * @module
 */
import type { OntologyFile } from "@intellectual-frontiers/rdf";
import * as actor from "./actor.ts";

export * from "./actor.ts";

/** Every file of the Actors ontology, in the order of their names. */
export const files: readonly OntologyFile[] = [actor.file];
