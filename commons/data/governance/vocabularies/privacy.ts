// Spec: 0003-governance FR-012, FR-013
/**
 * The privacy vocabulary (commons data 0003-governance FR-012): an element that holds personal data says so, may name the category of personal data in the W3C Data Privacy Vocabulary
 * (the Personal Data extension, DPV-PD) by its term, and says what it is held for. The terms are the vocabulary's own, generated from its CSV (`dpv.auto.ts`); `dpvClassOf` gives the class
 * DPV puts a category in, and `dpvIri` its IRI.
 *
 * @module
 */
import { annotationKind, annotationsOf } from "../annotation.ts";
import { elementsOf } from "../elements.ts";
import { type DpvClass, PD_NAMESPACE, pd, type PdTerm } from "./dpv.auto.ts";
import { finding, type Vocabulary } from "../vocabulary.ts";

export { type DpvClass, pd, type PdTerm } from "./dpv.auto.ts";

/** Personal data: of which category, held for which purposes. */
export interface Personal {
  /** A term of DPV-PD, such as `EmailAddress`. */
  readonly category?: PdTerm;
  /** What it is held for, in words. */
  readonly purposes?: readonly string[];
}

/** The element holds personal data. */
export const personal = annotationKind<Personal>("privacy.personal", ["concept", "attribute"]);

/** The class DPV puts a category in: personal data, sensitive personal data or a special category. */
export const dpvClassOf = (term: PdTerm): DpvClass => pd[term].kind;

/** The IRI of a category of DPV-PD. */
export const dpvIri = (term: PdTerm): string => `${PD_NAMESPACE}${term}`;

/** The vocabulary: its kinds and its rules. */
export const vocabulary: Vocabulary = {
  id: "privacy",
  kinds: [personal],
  rules: [
    {
      id: "privacy/category-missing",
      describe: "Personal data that names no category of DPV-PD.",
      check: (d) =>
        elementsOf(d)
          .filter((e) => annotationsOf(e, personal).some((p) => p.category === undefined))
          .map((e) => finding("privacy/category-missing", e.id, `${e.name} holds personal data and names no category of DPV-PD`)),
    },
    {
      id: "privacy/purpose-missing",
      describe: "Personal data held for no stated purpose.",
      check: (d) =>
        elementsOf(d)
          .filter((e) => annotationsOf(e, personal).some((p) => (p.purposes ?? []).length === 0))
          .map((e) => finding("privacy/purpose-missing", e.id, `${e.name} holds personal data and states no purpose for it`)),
    },
  ],
};
