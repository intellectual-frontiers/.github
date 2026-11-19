// Spec: 0032-identity-principals FR-001
/**
 * The helpers that the models of identity are written with (commons data 0032-identity-principals): short ways to say a required, an optional or a many-valued attribute, a key, a relationship, and
 * the annotations every concept carries. They are public so that the modules of identity that are written in other folders say things the same way.
 *
 * @module
 */
import { type AnyConcept, annotate, attribute, codeList, identifier, relationship, vocabularies } from "@intellectual-frontiers/data/governance";

const { quality, requirements, security, usage, privacy } = vocabularies;
/** The requirements of a specification that a concept serves. */
export const citing =
  (spec: string) =>
  (...frs: readonly string[]) =>
    annotate(
      requirements.cites,
      frs.map((fr) => `${spec} ${fr}`),
    );
export const cites = citing("0030-identity");
export const restricted = annotate(security.classification, "restricted");
export const confidential = annotate(security.classification, "confidential");
export const internal = annotate(security.classification, "internal");
export const keep = (days: number) => annotate(quality.retention, { days });
export const held = (category: vocabularies.privacy.PdTerm, ...purposes: readonly string[]) => annotate(privacy.personal, { category, purposes });
export const unique = (...members: readonly string[]) => annotate(quality.unique, { members });
export const lookup = (...members: readonly string[]) => annotate(usage.lookup, { members });

export type Attr = ReturnType<typeof attribute>;
export const req = (type: Parameters<typeof attribute>[0], definition: string, ...annotations: readonly ReturnType<typeof annotate>[]): Attr => attribute(type, { definition, annotations });
export const opt = (type: Parameters<typeof attribute>[0], definition: string, ...annotations: readonly ReturnType<typeof annotate>[]): Attr =>
  attribute(type, { definition, multiplicity: "optional", annotations });
export const many = (type: Parameters<typeof attribute>[0], definition: string, ...annotations: readonly ReturnType<typeof annotate>[]): Attr =>
  attribute(type, { definition, multiplicity: "many", annotations });
export const key = (what: string): Attr => attribute(identifier(), { definition: `What identifies ${what}, made by the application` });
export const one = (to: AnyConcept | (() => AnyConcept), definition: string) => relationship(to, { cardinality: "one", definition });
export const maybe = (to: AnyConcept | (() => AnyConcept), definition: string) => relationship(to, { cardinality: "optional", definition });


/** A code list from its codes and their definitions; the label of a code is its words, capitalised. */
export const list = (name: string, definition: string, codes: Readonly<Record<string, string>>, open = false) =>
  codeList(name, {
    definition,
    codes: Object.fromEntries(
      Object.entries(codes).map(([code, d]) => [
        code,
        { label: code.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()), definition: d },
      ]),
    ),
    annotations: [annotate(quality.openness, open ? "open" : "closed"), annotate(requirements.cites, ["0032-identity-principals FR-003"])],
  });

