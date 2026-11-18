// Spec: 0003-governance FR-011
/**
 * The requirements vocabulary (commons data 0003-governance FR-011): an element says which requirements it serves, as citations in the form `NNNN-slug FR-nnn`, so that a requirement
 * can be followed to what implements it and an element to why it exists. `requirementsOf` gives, for each citation, the elements that cite it.
 *
 * @module
 */
import { annotationsOf, annotationKind } from "../annotation.ts";
import { elementsOf } from "../elements.ts";
import type { ElementId } from "../id.ts";
import type { Domain } from "../model.ts";
import { finding, type Vocabulary } from "../vocabulary.ts";

/** The requirements an element serves, as citations. */
export const cites = annotationKind<readonly string[]>("requirements.cites", [
  "domain",
  "concept",
  "attribute",
  "relationship",
  "codelist",
]);

/** A citation: a specification (`NNNN-slug`) and a requirement (`FR-nnn`). */
export const CITATION = /^\d{4}-[a-z][a-z0-9]*(?:-[a-z0-9]+)* FR-\d{3}$/;

/**
 * Each citation of a domain and the elements that cite it.
 *
 * @param d - the domain
 * @returns the citations, each with its elements in the order of the domain
 */
export function requirementsOf(d: Domain): ReadonlyMap<string, readonly ElementId[]> {
  const out = new Map<string, ElementId[]>();
  for (const e of elementsOf(d)) {
    for (const list of annotationsOf(e, cites)) for (const c of list) out.set(c, [...(out.get(c) ?? []), e.id]);
  }
  return out;
}

/** The vocabulary: its kinds and its rules. */
export const vocabulary: Vocabulary = {
  id: "requirements",
  kinds: [cites],
  rules: [
    {
      id: "requirements/uncited",
      describe: "A concept that cites no requirement.",
      check: (d) =>
        elementsOf(d)
          .filter((e) => e.kind === "concept" && annotationsOf(e, cites).flat().length === 0)
          .map((e) => finding("requirements/uncited", e.id, `the concept ${e.name} cites no requirement`)),
    },
    {
      id: "requirements/malformed",
      describe: "A citation that is not of the form NNNN-slug FR-nnn.",
      check: (d) =>
        elementsOf(d).flatMap((e) =>
          annotationsOf(e, cites)
            .flat()
            .filter((c) => !CITATION.test(c))
            .map((c) => finding("requirements/malformed", e.id, `"${c}" is not of the form NNNN-slug FR-nnn`, "error")),
        ),
    },
  ],
};
