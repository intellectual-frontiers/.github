// Spec: 0003-governance FR-009
/**
 * Lint (commons data 0003-governance FR-009): the findings of a domain against the vocabularies a project uses, as data. The core rules come first: an element with no definition, and an
 * annotation of a kind that no vocabulary given has. Then each vocabulary's rules, in the order given.
 *
 * @module
 */
import { elementsOf } from "./elements.ts";
import type { Domain } from "./model.ts";
import { finding, type Finding, type LintRule, type Vocabulary } from "./vocabulary.ts";

/** The core rules: they depend on the vocabularies given only for the kinds they know. */
export function coreRules(vocabularies: readonly Vocabulary[]): readonly LintRule[] {
  const known = new Set(vocabularies.flatMap((v) => v.kinds.map((k) => k.name)));
  return [
    {
      id: "core/definition-missing",
      describe: "A domain, a concept, an attribute, a relationship or a code list with no definition.",
      check: (d) =>
        elementsOf(d)
          .filter((e) => e.kind !== "code" && e.definition.trim() === "")
          .map((e) => finding("core/definition-missing", e.id, `the ${e.kind} ${e.name} has no definition`, "error")),
    },
    {
      id: "core/annotation-unknown",
      describe: "An annotation of a kind that no vocabulary given has.",
      check: (d) =>
        elementsOf(d).flatMap((e) =>
          e.annotations
            .filter((a) => !known.has(a.kind))
            .map((a) =>
              finding("core/annotation-unknown", e.id, `the annotation ${a.kind} is of a kind no vocabulary of this project has`),
            ),
        ),
    },
  ];
}

/**
 * The findings of a domain.
 *
 * @param d - the domain
 * @param vocabularies - the vocabularies the project uses, in order
 * @returns the findings of the core rules, then of each vocabulary's, in the order of the rules
 */
export function lint(d: Domain, vocabularies: readonly Vocabulary[] = []): readonly Finding[] {
  return [...coreRules(vocabularies), ...vocabularies.flatMap((v) => v.rules)].flatMap((r) => r.check(d));
}
