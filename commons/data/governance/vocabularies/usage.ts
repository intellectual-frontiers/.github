// Spec: 0003-governance FR-017
/**
 * The usage vocabulary (commons data 0003-governance FR-017): how data is used, which is the business's to say and the layers below choose what serves. A lookup names the attributes or
 * relationships by which the records of a concept are usually found; a layer below may make an index of it, and no layer needs to.
 *
 * @module
 */
import { annotationKind, annotationsOf } from "../annotation.ts";
import { conceptId } from "../id.ts";
import { membersOf } from "../model.ts";
import { finding, type Vocabulary } from "../vocabulary.ts";

/** The members of a concept (attributes or relationships, by name) by which its records are usually found, in the order they are given. */
export interface Lookup {
  readonly members: readonly string[];
}

/** How the records of a concept are usually found. */
export const lookup = annotationKind<Lookup>("usage.lookup", ["concept"]);

/** The vocabulary: its kinds and its rules. */
export const vocabulary: Vocabulary = {
  id: "usage",
  kinds: [lookup],
  rules: [
    {
      id: "usage/member-unknown",
      describe: "A lookup that names a member the concept does not have.",
      check: (d) =>
        d.concepts.flatMap((c) => {
          const has = new Set(membersOf(c));
          return annotationsOf(c, lookup)
            .flatMap((l) => l.members)
            .filter((m) => !has.has(m))
            .map((m) =>
              finding(
                "usage/member-unknown",
                conceptId(d.name, c.name),
                `a lookup of the concept ${c.name} names ${m}, which it does not have`,
                "error",
              ),
            );
        }),
    },
  ],
};
