/**
 * The shared ontology of Mizan (commons 0016-ladder, 0018-standards-first, 0019-mizan-integrations), as the typed values the generator reads
 * (commons 0012-ontology FR-008): its file, and what it states by kind.
 *
 * @module
 */
import type { OntologyFile } from "../../rdf/src/mod.ts";
import * as mizan from "./mizan.ts";

export * from "./mizan.ts";

/** Every file of the Mizan ontology, in the order of their names. */
export const files: readonly OntologyFile[] = [mizan.file];
