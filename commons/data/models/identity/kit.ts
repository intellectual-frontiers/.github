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
/** Marks an element as written to requirement of the identity specification, 0030-identity. */
export const cites = citing("0030-identity");
/** The classification of what only named people may read: restricted. */
export const restricted = annotate(security.classification, "restricted");
/** The classification of a concept or attribute whose disclosure would harm: confidential. */
export const confidential = annotate(security.classification, "confidential");
/** The classification of what is for the organization only: internal. */
export const internal = annotate(security.classification, "internal");
/** Says how many days a concept is kept before it is removed. */
export const keep = (days: number) => annotate(quality.retention, { days });
/** Says that an attribute holds personal data of a category, and for which purposes it is held. */
export const held = (category: vocabularies.privacy.PdTerm, ...purposes: readonly string[]) => annotate(privacy.personal, { category, purposes });
/** Says that the members named are together unique across the records of a concept. */
export const unique = (...members: readonly string[]) => annotate(quality.unique, { members });
/** Says which members of a concept are looked up by, so that each is indexed. */
export const lookup = (...members: readonly string[]) => annotate(usage.lookup, { members });

/** An attribute of a concept, as the identity models write it. */
export type Attr = ReturnType<typeof attribute>;
/** An attribute that every record must have. */
export const req = (type: Parameters<typeof attribute>[0], definition: string, ...annotations: readonly ReturnType<typeof annotate>[]): Attr => attribute(type, { definition, annotations });
/** An attribute that a record may leave out. */
export const opt = (type: Parameters<typeof attribute>[0], definition: string, ...annotations: readonly ReturnType<typeof annotate>[]): Attr =>
  attribute(type, { definition, multiplicity: "optional", annotations });
/** An attribute that may be given more than once. */
export const many = (type: Parameters<typeof attribute>[0], definition: string, ...annotations: readonly ReturnType<typeof annotate>[]): Attr =>
  attribute(type, { definition, multiplicity: "many", annotations });
/** An attribute that identifies a concept, made by the application. */
export const key = (what: string): Attr => attribute(identifier(), { definition: `What identifies ${what}, made by the application` });
/** A relationship to one other concept that a record must have. */
export const one = (to: AnyConcept | (() => AnyConcept), definition: string) => relationship(to, { cardinality: "one", definition });
/** A relationship to another concept that a record may not have. */
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

