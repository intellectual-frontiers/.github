// Spec: 0003-governance FR-016
/**
 * The quality and lifecycle vocabulary (commons data 0003-governance FR-016): what a value must look like (`pattern`, `range`), how long data is kept (`retention`), and that an element is
 * on its way out (`deprecated`), with what replaces it. A code list is the way to say which values are allowed; these are for the rest.
 *
 * @module
 */
import { annotationKind, annotationsOf } from "../annotation.ts";
import { elementsOf } from "../elements.ts";
import { finding, type Vocabulary } from "../vocabulary.ts";

/** A regular expression a text value must match. */
export const pattern = annotationKind<string>("quality.pattern", ["attribute"]);

/** The least and the greatest a number may be. */
export interface Range {
  readonly min?: number;
  readonly max?: number;
}

/** The range of a number. */
export const range = annotationKind<Range>("quality.range", ["attribute"]);

/** How long data is kept, in days. */
export interface Retention {
  readonly days: number;
}

/** How long a concept's or an attribute's data is kept. */
export const retention = annotationKind<Retention>("quality.retention", ["concept", "attribute"]);

/** An element that is on its way out: since when, and what replaces it, by its identity as text. */
export interface Deprecated {
  readonly since: string;
  readonly replacedBy?: string;
}

/** The element is deprecated. */
export const deprecated = annotationKind<Deprecated>("quality.deprecated", ["concept", "attribute", "relationship", "codelist"]);

const valid = (source: string): boolean => {
  try {
    new RegExp(source);
    return true;
  } catch {
    return false;
  }
};

/** The vocabulary: its kinds and its rules. */
export const vocabulary: Vocabulary = {
  id: "quality",
  kinds: [pattern, range, retention, deprecated],
  rules: [
    {
      id: "quality/pattern-invalid",
      describe: "A pattern that is not a regular expression.",
      check: (d) =>
        elementsOf(d).flatMap((e) =>
          annotationsOf(e, pattern)
            .filter((p) => !valid(p))
            .map((p) => finding("quality/pattern-invalid", e.id, `"${p}" is not a regular expression`, "error")),
        ),
    },
    {
      id: "quality/range-inverted",
      describe: "A range whose minimum is above its maximum.",
      check: (d) =>
        elementsOf(d).flatMap((e) =>
          annotationsOf(e, range)
            .filter((r) => r.min !== undefined && r.max !== undefined && r.min > r.max)
            .map((r) => finding("quality/range-inverted", e.id, `the minimum ${r.min} is above the maximum ${r.max}`, "error")),
        ),
    },
    {
      id: "quality/retention-invalid",
      describe: "A retention that is not a positive whole number of days.",
      check: (d) =>
        elementsOf(d).flatMap((e) =>
          annotationsOf(e, retention)
            .filter((r) => !Number.isInteger(r.days) || r.days <= 0)
            .map((r) => finding("quality/retention-invalid", e.id, `${r.days} is not a positive whole number of days`, "error")),
        ),
    },
    {
      id: "quality/deprecated-no-replacement",
      describe: "An element deprecated with nothing to replace it.",
      check: (d) =>
        elementsOf(d)
          .filter((e) => annotationsOf(e, deprecated).some((x) => x.replacedBy === undefined))
          .map((e) => finding("quality/deprecated-no-replacement", e.id, `${e.name} is deprecated and names no replacement`)),
    },
  ],
};
