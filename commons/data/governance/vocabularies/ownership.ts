// Spec: 0003-governance FR-015
/**
 * The ownership vocabulary (commons data 0003-governance FR-015): who answers for a domain, a concept or a code list, and who looks after its data day to day. Both are roles, named
 * in words; who holds a role is for whoever runs the system.
 *
 * @module
 */
import { annotationKind, annotationsOf } from "../annotation.ts";
import { elementsOf } from "../elements.ts";
import { finding, type Vocabulary } from "../vocabulary.ts";

/** The role that answers for an element. */
export const owner = annotationKind<string>("ownership.owner", ["domain", "concept", "codelist"]);
/** The role that looks after an element's data. */
export const steward = annotationKind<string>("ownership.steward", ["domain", "concept", "codelist"]);

/** The vocabulary: its kinds and its rules. */
export const vocabulary: Vocabulary = {
  id: "ownership",
  kinds: [owner, steward],
  rules: [
    {
      id: "ownership/owner-missing",
      describe: "A concept with no owner where its domain has none.",
      check: (d) => {
        const all = elementsOf(d);
        const domainOwned = all.some((e) => e.kind === "domain" && annotationsOf(e, owner).length > 0);
        return domainOwned
          ? []
          : all
              .filter((e) => e.kind === "concept" && annotationsOf(e, owner).length === 0)
              .map((e) => finding("ownership/owner-missing", e.id, `the concept ${e.name} has no owner, and its domain has none`));
      },
    },
  ],
};
