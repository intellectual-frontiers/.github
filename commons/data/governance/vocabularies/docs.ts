// Spec: 0003-governance FR-010
/**
 * The documentation vocabulary (commons data 0003-governance FR-010): what a definition does not say. A synonym is another name a person may look for; an example shows a value; a
 * note is anything else worth knowing.
 *
 * @module
 */
import { annotationKind } from "../annotation.ts";
import type { Vocabulary } from "../vocabulary.ts";

/** Another name for a concept, an attribute or a code list. */
export const synonym = annotationKind<string>("docs.synonym", ["concept", "attribute", "codelist"]);
/** An example of a value of a concept or an attribute. */
export const example = annotationKind<string>("docs.example", ["concept", "attribute"]);
/** A note on any element. */
export const note = annotationKind<string>("docs.note", ["domain", "concept", "attribute", "relationship", "codelist"]);

/** The vocabulary: its kinds and its rules. */
export const vocabulary: Vocabulary = { id: "docs", kinds: [synonym, example, note], rules: [] };
