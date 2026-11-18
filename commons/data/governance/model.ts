// Spec: 0003-governance FR-001, FR-003, FR-004
/**
 * The model of governance (commons data 0003-governance FR-001, FR-003, FR-004): concepts with attributes, identifying attributes and relationships, code lists, and the domain
 * that holds them. The constructors are total, they never fail; `domain` checks the whole and returns the domain or every error, as data. The names of a concept's attributes and
 * relationships are literal types, so an identifying attribute the concept does not have does not compile.
 *
 * @example
 * ```ts
 * const party = concept("party", {
 *   definition: "A person or an organization we deal with",
 *   attributes: { party_id: attribute(identifier(), { definition: "Its identifier" }), name: attribute(text(), { definition: "What it is called" }) },
 *   identifiedBy: ["party_id"],
 * });
 * const arca = domain("arca", { definition: "Parties", concepts: [party] });
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/commons/ts/kernel";
import type { Annotation } from "./annotation.ts";
import type { AnyCodeList } from "./codelist.ts";
import type { Datatype } from "./datatype.ts";
import { attributeId, codeId, codeListId, conceptId, domainId, type ElementId, type ElementKind, NAME, relationshipId } from "./id.ts";

/** Whether an attribute is held once and always, at most once, or any number of times. */
export type Multiplicity = "required" | "optional" | "many";

/** An attribute of a concept. */
export interface Attribute<T extends Datatype = Datatype> {
  readonly kind: "attribute";
  readonly type: T;
  readonly multiplicity: Multiplicity;
  readonly definition: string;
  readonly annotations: readonly Annotation[];
}

/** What `attribute` is given besides the datatype. */
export interface AttributeOptions {
  readonly definition?: string;
  readonly multiplicity?: Multiplicity;
  readonly annotations?: readonly Annotation[];
}

/**
 * Makes an attribute; total. It is required unless it says otherwise.
 *
 * @param type - what kind of fact it holds
 * @param options - its definition, multiplicity and annotations
 * @returns the attribute, frozen
 */
export function attribute<T extends Datatype>(type: T, options: AttributeOptions = {}): Attribute<T> {
  return Object.freeze({
    kind: "attribute",
    type,
    multiplicity: options.multiplicity ?? "required",
    definition: options.definition ?? "",
    annotations: Object.freeze([...(options.annotations ?? [])]),
  });
}

/** How many of the target a concept relates to: exactly one, at most one, or any number. */
export type Cardinality = "one" | "optional" | "many";

/** The concept a relationship points to: the concept, or a function that gives it, so that two concepts may refer to each other. */
export type Target = AnyConcept | (() => AnyConcept);

/** A relationship from a concept to another. */
export interface Relationship {
  readonly kind: "relationship";
  readonly to: Target;
  readonly cardinality: Cardinality;
  readonly definition: string;
  readonly annotations: readonly Annotation[];
}

/** What `relationship` is given besides the target. */
export interface RelationshipOptions {
  readonly cardinality: Cardinality;
  readonly definition?: string;
  readonly annotations?: readonly Annotation[];
}

/**
 * Makes a relationship; total.
 *
 * @param to - the concept it points to, or a function that gives it
 * @param options - its cardinality, definition and annotations
 * @returns the relationship, frozen
 */
export function relationship(to: Target, options: RelationshipOptions): Relationship {
  return Object.freeze({
    kind: "relationship",
    to,
    cardinality: options.cardinality,
    definition: options.definition ?? "",
    annotations: Object.freeze([...(options.annotations ?? [])]),
  });
}

/** The attributes of a concept, by name. */
export type Attrs = Readonly<Record<string, Attribute>>;
/** The relationships of a concept, by name. */
export type Rels = Readonly<Record<string, Relationship>>;

/** A concept: a thing the business talks about. */
export interface Concept<N extends string = string, A extends Attrs = Attrs, R extends Rels = Rels> {
  readonly kind: "concept";
  readonly name: N;
  readonly definition: string;
  readonly attributes: A;
  readonly relationships: R;
  /** The names of the attributes that identify it; `concept` checked them against its attributes, as literal types, when it was made. */
  readonly identifiedBy: readonly string[];
  readonly annotations: readonly Annotation[];
}

/** A concept of any name, attributes and relationships. */
export type AnyConcept = Concept<string, Attrs, Rels>;

/** What `concept` is given. */
export interface ConceptSpec<A extends Attrs, R extends Rels> {
  readonly definition?: string;
  readonly attributes: A;
  /**
   * What identifies it: names of its own attributes, or of its own relationships of cardinality one, which make it a specialization of what they point to, or it does not
   * compile.
   */
  readonly identifiedBy: readonly ((keyof NoInfer<A> | keyof NoInfer<R>) & string)[];
  readonly relationships?: R;
  readonly annotations?: readonly Annotation[];
}

/**
 * Makes a concept; total. Its attribute names, relationship names and identifying attributes are literal types.
 *
 * @param name - its name
 * @param spec - its definition, attributes, identifying attributes, relationships and annotations
 * @returns the concept, frozen
 */
export function concept<const N extends string, const A extends Attrs, const R extends Rels = Record<never, Relationship>>(
  name: N,
  spec: ConceptSpec<A, R>,
): Concept<N, A, R> {
  return Object.freeze({
    kind: "concept",
    name,
    definition: spec.definition ?? "",
    attributes: spec.attributes,
    // when `relationships` is left out, R is its default, which has no key
    relationships: spec.relationships ?? ({} as R),
    identifiedBy: Object.freeze([...spec.identifiedBy]),
    annotations: Object.freeze([...(spec.annotations ?? [])]),
  });
}

/** The names of the members of a concept: its attributes, then its relationships. */
export const membersOf = (c: AnyConcept): readonly string[] => [...Object.keys(c.attributes), ...Object.keys(c.relationships)];

/** The concept a target gives. */
export function resolve(target: Target): AnyConcept {
  return typeof target === "function" ? target() : target;
}

/** A domain: a part of the business, with its concepts and code lists. */
export interface Domain {
  readonly kind: "domain";
  readonly name: string;
  readonly definition: string;
  readonly concepts: readonly AnyConcept[];
  readonly codeLists: readonly AnyCodeList[];
  readonly annotations: readonly Annotation[];
}

/** What `domain` is given. */
export interface DomainSpec {
  readonly definition?: string;
  readonly concepts: readonly AnyConcept[];
  readonly codeLists?: readonly AnyCodeList[];
  readonly annotations?: readonly Annotation[];
}

/** What is wrong with a domain; `domain` returns all of it together. */
export type DomainError =
  | { readonly kind: "name"; readonly element: ElementId; readonly name: string }
  | { readonly kind: "duplicate"; readonly element: ElementId }
  | { readonly kind: "unresolved"; readonly from: ElementId; readonly to: string; readonly what: "concept" | "codelist" }
  | {
      readonly kind: "identifier";
      readonly concept: ElementId;
      readonly attribute?: string;
      readonly why: "missing" | "unknown" | "not-required";
    }
  | { readonly kind: "annotation"; readonly element: ElementId; readonly annotation: string; readonly about: readonly ElementKind[] };

/**
 * Makes a domain, or says everything that is wrong with it.
 *
 * @param name - its name
 * @param spec - its definition, concepts, code lists and annotations
 * @returns the domain, or every error
 */
export function domain(name: string, spec: DomainSpec): Result<Domain, readonly DomainError[]> {
  const errors: DomainError[] = [];
  const concepts = spec.concepts;
  const codeLists = spec.codeLists ?? [];
  const checkName = (element: ElementId, text: string): void => {
    if (!NAME.test(text)) errors.push({ kind: "name", element, name: text });
  };
  const checkAnnotations = (element: ElementId, kind: ElementKind, annotations: readonly Annotation[]): void => {
    for (const a of annotations)
      if (!a.about.includes(kind)) errors.push({ kind: "annotation", element, annotation: a.kind, about: a.about });
  };
  checkName(domainId(name), name);
  checkAnnotations(domainId(name), "domain", spec.annotations ?? []);
  const seenConcepts = new Set<string>();
  for (const c of concepts) {
    const cid = conceptId(name, c.name);
    checkName(cid, c.name);
    if (seenConcepts.has(c.name)) errors.push({ kind: "duplicate", element: cid });
    seenConcepts.add(c.name);
    checkAnnotations(cid, "concept", c.annotations);
    for (const [key, a] of Object.entries(c.attributes)) {
      const aid = attributeId(name, c.name, key);
      checkName(aid, key);
      checkAnnotations(aid, "attribute", a.annotations);
      if (a.type.kind === "code" && !codeLists.includes(a.type.list))
        errors.push({ kind: "unresolved", from: aid, to: a.type.list.name, what: "codelist" });
    }
    for (const [key, r] of Object.entries(c.relationships)) {
      const rid = relationshipId(name, c.name, key);
      checkName(rid, key);
      checkAnnotations(rid, "relationship", r.annotations);
      if (key in c.attributes) errors.push({ kind: "duplicate", element: rid });
      const target = resolve(r.to);
      if (!concepts.includes(target)) errors.push({ kind: "unresolved", from: rid, to: target.name, what: "concept" });
    }
    if (c.identifiedBy.length === 0) errors.push({ kind: "identifier", concept: cid, why: "missing" });
    for (const key of c.identifiedBy) {
      const a = c.attributes[key];
      const r = c.relationships[key];
      if (a !== undefined) {
        if (a.multiplicity !== "required") errors.push({ kind: "identifier", concept: cid, attribute: key, why: "not-required" });
      } else if (r !== undefined) {
        if (r.cardinality !== "one") errors.push({ kind: "identifier", concept: cid, attribute: key, why: "not-required" });
      } else errors.push({ kind: "identifier", concept: cid, attribute: key, why: "unknown" });
    }
  }
  const seenLists = new Set<string>();
  for (const l of codeLists) {
    const lid = codeListId(name, l.name);
    checkName(lid, l.name);
    if (seenLists.has(l.name)) errors.push({ kind: "duplicate", element: lid });
    seenLists.add(l.name);
    checkAnnotations(lid, "codelist", l.annotations);
    for (const code of Object.keys(l.codes)) checkName(codeId(name, l.name, code), code);
  }
  if (errors.length > 0) return err(errors);
  return ok(
    Object.freeze({
      kind: "domain",
      name,
      definition: spec.definition ?? "",
      concepts,
      codeLists,
      annotations: Object.freeze([...(spec.annotations ?? [])]),
    }),
  );
}
