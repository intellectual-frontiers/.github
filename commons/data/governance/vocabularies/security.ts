// Spec: 0003-governance FR-014
/**
 * The security vocabulary (commons data 0003-governance FR-014): how sensitive an element is (`classification`), who may read and write it (`access`), which attribute partitions a
 * concept's data so that access is filtered by it (`scope`), and how a value is hidden from those who may not see it (`mask`). It says what must be true, in terms that name no database;
 * what enforces it is for the layers below and for the extensions that realize it.
 *
 * @module
 */
import { type Annotated, annotationKind, annotationsOf } from "../annotation.ts";
import { elementsOf } from "../elements.ts";
import { personal } from "./privacy.ts";
import { finding, type Vocabulary } from "../vocabulary.ts";

/** How sensitive: public, internal, confidential or restricted, in that order. */
export type Classification = "public" | "internal" | "confidential" | "restricted";

/** How sensitive an element is. */
export const classification = annotationKind<Classification>("security.classification", [
  "domain",
  "concept",
  "attribute",
  "relationship",
  "codelist",
]);

/** The roles that may read an element and the roles that may write it. */
export interface Access {
  readonly read: readonly string[];
  readonly write: readonly string[];
}

/** Who may read and write an element. */
export const access = annotationKind<Access>("security.access", ["concept", "attribute"]);

/** The attribute partitions a concept's data (a tenant, an environment): access to a row is filtered by it. */
export const scope = annotationKind<{ readonly name: string }>("security.scope", ["attribute"]);

/** How a value is hidden: redacted, replaced by its hash, or shown in part. */
export type Mask = "redact" | "hash" | "partial";

/** How a value is hidden from those who may not see it. */
export const mask = annotationKind<Mask>("security.mask", ["attribute"]);

/** The rank of a classification, so that two can be compared. */
export const RANK: Readonly<Record<Classification, number>> = { public: 0, internal: 1, confidential: 2, restricted: 3 };

const classOf = (e: Annotated): Classification | undefined => annotationsOf(e, classification)[0];

/** The vocabulary: its kinds and its rules. */
export const vocabulary: Vocabulary = {
  id: "security",
  kinds: [classification, access, scope, mask],
  rules: [
    {
      id: "security/scope-multiple",
      describe: "A concept with more than one attribute that partitions its data.",
      check: (d) =>
        elementsOf(d)
          .filter((e) => e.kind === "concept")
          .flatMap((c) => {
            const scoped = elementsOf(d).filter((e) => e.parent === c.id && annotationsOf(e, scope).length > 0);
            return scoped.length > 1
              ? [
                  finding(
                    "security/scope-multiple",
                    c.id,
                    `the concept ${c.name} has ${scoped.length} scopes: ${scoped.map((s) => s.name).join(", ")}`,
                    "error",
                  ),
                ]
              : [];
          }),
    },
    {
      id: "security/restricted-no-access",
      describe: "Restricted data that says nobody may read or write it.",
      check: (d) => {
        const all = elementsOf(d);
        return all
          .filter((e) => classOf(e) === "restricted")
          .filter(
            (e) =>
              annotationsOf(e, access).length === 0 &&
              !(all.find((p) => p.id === e.parent) ?? { annotations: [] }).annotations.some((a) => a.kind === access.name),
          )
          .map((e) =>
            finding("security/restricted-no-access", e.id, `${e.name} is restricted and has no access rule, on itself or on its concept`),
          );
      },
    },
    {
      id: "security/personal-unprotected",
      describe: "Personal data that is not classified confidential or restricted.",
      check: (d) => {
        const all = elementsOf(d);
        return all
          .filter((e) => annotationsOf(e, personal).length > 0)
          .filter((e) => {
            const own = classOf(e) ?? classOf(all.find((p) => p.id === e.parent) ?? { annotations: [] });
            return own === undefined || RANK[own] < RANK.confidential;
          })
          .map((e) =>
            finding(
              "security/personal-unprotected",
              e.id,
              `${e.name} holds personal data and is not classified confidential or restricted`,
            ),
          );
      },
    },
  ],
};
