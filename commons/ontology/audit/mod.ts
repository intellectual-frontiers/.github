/**
 * The audits of ontologies as data (commons 0018-standards-first): what each term of another ontology rests on, as the typed values the generator reads
 * (commons 0012-ontology FR-008).
 *
 * @module
 */
import type { OntologyFile } from "../../rdf/src/mod.ts";
import * as packaging from "./packaging.ts";

export { AUDITED_ON, terms as packagingTerms } from "./packaging.ts";

/** Every file of the audits, in the order of their names. */
export const files: readonly OntologyFile[] = [packaging.file];
