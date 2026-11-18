// Spec: 0011-sql-lifecycle FR-014
/**
 * The lifecycle vocabulary (commons data 0011-sql-lifecycle FR-014): what the layers below cannot know of an element's past. `renamedFrom` is the name a concept or an attribute had, so that a
 * change of name is a rename of what is in a database and not a drop and an add that loses its data; `since` is the release that made the element.
 *
 * @module
 */
import { annotationKind, annotationsOf } from "../annotation.ts";
import { elementsOf } from "../elements.ts";
import { NAME } from "../names.ts";
import { finding, type Vocabulary } from "../vocabulary.ts";

/** The name an element had, in governance's way of writing names. */
export const renamedFrom = annotationKind<string>("lifecycle.renamedFrom", ["concept", "attribute"]);
/** The release that made an element, as the project names its releases. */
export const since = annotationKind<string>("lifecycle.since", ["concept", "attribute", "relationship", "codelist"]);

/** The vocabulary: its kinds and its rules. */
export const vocabulary: Vocabulary = {
  id: "lifecycle",
  kinds: [renamedFrom, since],
  rules: [
    {
      id: "lifecycle/renamed-from-name",
      describe: "A `renamedFrom` that is not a name, or is the element's own.",
      check: (d) =>
        elementsOf(d).flatMap((e) =>
          annotationsOf(e, renamedFrom).flatMap((old) =>
            !NAME.test(old)
              ? [
                  finding(
                    "lifecycle/renamed-from-name",
                    e.id,
                    `${e.name} was renamed from ${JSON.stringify(old)}, which is not a name`,
                    "error",
                  ),
                ]
              : old === e.name
                ? [finding("lifecycle/renamed-from-name", e.id, `${e.name} was renamed from itself`, "error")]
                : [],
          ),
        ),
    },
  ],
};
