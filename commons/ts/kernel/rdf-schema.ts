/**
 * Class schemas and the individuals they make (commons 0012-ontology FR-003 to FR-005). A schema names a class and its fields, each a
 * property, a range and a cardinality; the type of an individual's values is derived from it, so a required field left out, a value of
 * the wrong range or a reference to an individual of another class does not compile. An individual is a named node of its class, used
 * wherever a reference to that class is asked for, and its triples are its type and then its fields in the schema's order. The schemas an
 * ontology states about itself (OWL's ontology, class and properties), code lists keyed by local name and SKOS concept schemes keyed by
 * notation are here too, and `validate` names what a type cannot state.
 *
 * @example
 * ```ts
 * import { classSchema, many, one, range } from "./rdf-schema.ts";
 * import { en, namespace, term, vocabulary } from "./rdf-term.ts";
 * import { rdfs } from "./rdf-vocabularies.ts";
 * const EX = namespace("ex", "https://example.org/terms#");
 * const ex = vocabulary(EX, { Shelf: "owl:Class", Book: "owl:Class", holds: "rdf:Property" });
 * const Book = classSchema(ex.Book, { label: one(rdfs.label, range.langString) });
 * const Shelf = classSchema(ex.Shelf, { holds: many(ex.holds, range.ref<"ex:Book">()) });
 * const iliad = Book.make(term(EX, "iliad"), { label: en("The Iliad") });
 * Shelf.make(term(EX, "top"), { holds: [iliad] }); // a Shelf given where a Book is asked for does not compile
 * ```
 *
 * @module
 */
import { absurd } from "./absurd.ts";
import {
  type Iri,
  type LangString,
  type Named,
  named,
  type NamedOf,
  type Namespace,
  nTriplesTerm,
  ontologyIri,
  RDF_TYPE,
  term,
  termOf,
  type Triple,
  type Value,
  type VocabularyTerm,
} from "./rdf-term.ts";
import { dcterms, owl, rdfs, skos } from "./rdf-vocabularies.ts";

/** What a field's values may be: a plain string, a string in a language, either, a boolean, an integer, or a reference. */
export type RangeKind = "string" | "lang" | "text" | "boolean" | "integer" | "ref";

/** A field's range, with the TypeScript type `V` of its values for the compiler. */
export type Range<V> = { readonly kind: RangeKind; readonly words?: readonly string[]; readonly "@ifc/rdf-value": V };

function rangeOf<V>(kind: RangeKind, words?: readonly string[]): Range<V> {
  return (words === undefined ? { kind } : { kind, words }) as Range<V>;
}

/** The ranges of a field. `ref<"a" | "b">()` accepts an individual of either class. */
export const range = {
  /** A plain string (`xsd:string`). */
  string: rangeOf<string>("string"),
  /** A string in a language. */
  langString: rangeOf<LangString>("lang"),
  /** A plain string or a string in a language. */
  text: rangeOf<string | LangString>("text"),
  /** A boolean (`xsd:boolean`). */
  boolean: rangeOf<boolean>("boolean"),
  /** An integer (`xsd:integer`); one that is not a safe integer is found by `validate`. */
  integer: rangeOf<number>("integer"),
  /** A reference to an individual of one of the classes `C`. */
  ref: <C extends string>(): Range<NamedOf<C>> => rangeOf<NamedOf<C>>("ref"),
  /** A plain string that is one of `words`: the union of the words is the field's type. */
  oneOf: <const W extends readonly [string, ...string[]]>(words: W): Range<W[number]> => rangeOf<W[number]>("string", words),
} as const;

/** How many values a field holds: exactly one, at most one, or any number in order. */
export type Cardinality = "one" | "optional" | "many";

/** A field of a schema: its property, its range and its cardinality. */
export type Field<V, K extends Cardinality> = { readonly property: Named; readonly range: Range<V>; readonly cardinality: K };

/** A field holding exactly one value. */
export function one<V>(property: Named, r: Range<V>): Field<V, "one"> {
  return { property, range: r, cardinality: "one" };
}

/** A field holding at most one value. */
export function optional<V>(property: Named, r: Range<V>): Field<V, "optional"> {
  return { property, range: r, cardinality: "optional" };
}

/** A field holding any number of values, in the order given. */
export function many<V>(property: Named, r: Range<V>): Field<V, "many"> {
  return { property, range: r, cardinality: "many" };
}

/** The fields of a schema, by the names its individuals' values are written with. */
export type Fields = Readonly<Record<string, Field<unknown, Cardinality>>>;

type ValueOf<F> = F extends Field<infer V, Cardinality> ? V : never;
type Keys<S extends Fields, K extends Cardinality> = { readonly [N in keyof S]: S[N] extends Field<unknown, K> ? N : never }[keyof S];

/** The values of an individual of a schema with the fields `S`: a required field's value, an optional one's, a list for `many`. */
export type ValuesOf<S extends Fields> = { readonly [N in Keys<S, "one">]: ValueOf<S[N]> } & {
  readonly [N in Keys<S, "optional">]?: ValueOf<S[N]>;
} & { readonly [N in Keys<S, "many">]?: readonly ValueOf<S[N]>[] };

/** One predicate of an individual and its values in order: what its triples are made from. */
export type Statement = { readonly predicate: Named; readonly objects: readonly Value[]; readonly words?: readonly string[] };

/** An individual: a named node of its class `C`, with the class, its values `V` and the statements they make (its type first). */
export type Individual<C extends string, V> = Named<C> & {
  readonly class: Named;
  readonly values: V;
  readonly statements: readonly Statement[];
};

/** An individual of any class, as a writer or a check takes it. */
export type AnyIndividual = Named & { readonly class: Named; readonly statements: readonly Statement[] };

/** A class schema: the class, its CURIE, its fields, and how an individual of it is made. */
export type ClassSchema<C extends string, S extends Fields> = {
  /** The class. */
  readonly class: Named;
  /** The class's CURIE, the brand of its individuals. */
  readonly curie: C;
  /** The fields, in the order their triples are made. */
  readonly fields: S;
  /** An individual of the class: the subject and its values. */
  readonly make: (subject: Named<C>, values: ValuesOf<S>) => Individual<C, ValuesOf<S>>;
};

function isValue(x: unknown): x is Value {
  return typeof x === "string" || typeof x === "number" || typeof x === "boolean" || (typeof x === "object" && x !== null && "kind" in x);
}

function valuesIn(x: unknown): readonly Value[] {
  if (x === undefined) return [];
  if (Array.isArray(x)) return x.filter(isValue);
  return isValue(x) ? [x] : [];
}

/** The schema of a class (a term of a vocabulary, whose CURIE brands the individuals) with its fields. */
export function classSchema<const C extends string, const S extends Fields>(cls: VocabularyTerm<never, C>, fields: S): ClassSchema<C, S> {
  const klass = named(cls.iri);
  return {
    class: klass,
    curie: cls.curie,
    fields,
    make: (subject, values) => {
      const own: Readonly<Record<string, unknown>> = values;
      const statements: Statement[] = [{ predicate: named(RDF_TYPE), objects: [klass] }];
      for (const [name, f] of Object.entries(fields)) {
        const objects = valuesIn(own[name]);
        if (objects.length === 0) continue;
        statements.push(
          f.range.words === undefined ? { predicate: f.property, objects } : { predicate: f.property, objects, words: f.range.words },
        );
      }
      const made: AnyIndividual & { readonly values: ValuesOf<S> } = { ...named(subject.iri), class: klass, values, statements };
      return made as Individual<C, ValuesOf<S>>;
    },
  };
}

/** A class or a datatype, as a domain, a range or a superclass names it. */
type ClassLike = "owl:Class" | "rdfs:Class" | "rdfs:Datatype";

/** The schema of an ontology's own description: `owl:Ontology` with its label, description and version. */
export const OwlOntology = classSchema(owl.Ontology, {
  label: optional(rdfs.label, range.langString),
  comment: optional(rdfs.comment, range.langString),
  description: optional(dcterms.description, range.langString),
  versionInfo: optional(owl.versionInfo, range.string),
});

/** The schema of a class: its label, comment, SKOS definition and superclasses. */
export const OwlClass = classSchema(owl.Class, {
  label: optional(rdfs.label, range.langString),
  comment: optional(rdfs.comment, range.langString),
  subClassOf: many(rdfs.subClassOf, range.ref<"owl:Class" | "rdfs:Class">()),
  definition: optional(skos.definition, range.langString),
});

const PROPERTY = {
  label: optional(rdfs.label, range.langString),
  comment: optional(rdfs.comment, range.langString),
  domain: optional(rdfs.domain, range.ref<ClassLike>()),
  range: optional(rdfs.range, range.ref<ClassLike>()),
  definition: optional(skos.definition, range.langString),
} as const;

/** The schema of an object property: its label, comment, domain, range and SKOS definition. */
export const ObjectProperty = classSchema(owl.ObjectProperty, PROPERTY);

/** The schema of a datatype property: its label, comment, domain, range and SKOS definition. */
export const DatatypeProperty = classSchema(owl.DatatypeProperty, PROPERTY);

/** The named node of the ontology a namespace's terms belong to (`https://example.org/terms` for `https://example.org/terms#`). */
export function ontologyOf(ns: Namespace): Named<"owl:Ontology"> {
  return named<"owl:Ontology">(ontologyIri(ns));
}

/** A code list: individuals of one class keyed by their local names, whose keys' union is the type code branches on. */
export type CodeList<C extends string, V, K extends string> = { readonly [N in K]: Individual<C, V> };

/** The code list of a schema's class in a namespace: each key is a local name, each value the individual's values. */
export function codes<C extends string, S extends Fields, const E extends Readonly<Record<string, ValuesOf<S>>>>(
  schema: ClassSchema<C, S>,
  ns: Namespace,
  entries: E,
): CodeList<C, ValuesOf<S>, keyof E & string> {
  const out: Record<string, Individual<C, ValuesOf<S>>> = {};
  for (const [local, values] of Object.entries(entries)) out[local] = schema.make(term<C>(ns, local), values);
  return out as CodeList<C, ValuesOf<S>, keyof E & string>;
}

/** The key of a code list that names an individual, or nothing where none does. */
export function codeOf<K extends string>(list: { readonly [N in K]: Named }, node: Named): K | undefined {
  for (const key of Object.keys(list) as K[]) if (list[key].iri === node.iri) return key;
  return undefined;
}

/** The schema of a SKOS concept scheme: its label and definition. */
export const ConceptSchemeSchema = classSchema(skos.ConceptScheme, {
  prefLabel: one(skos.prefLabel, range.langString),
  definition: optional(skos.definition, range.langString),
});

/** The schema of a SKOS concept: its scheme, notation, label and definition. */
export const ConceptSchema = classSchema(skos.Concept, {
  inScheme: one(skos.inScheme, range.ref<"skos:ConceptScheme">()),
  notation: one(skos.notation, range.string),
  prefLabel: one(skos.prefLabel, range.langString),
  definition: optional(skos.definition, range.langString),
});

/** What one concept of a scheme says beside its notation: its local name in the namespace, its label and its definition. */
export type ConceptEntry = { readonly local: string; readonly label: LangString; readonly definition?: LangString };

/** A SKOS concept scheme: the scheme, its concepts by notation, and every individual it states. */
export type ConceptScheme<N extends string> = {
  /** The scheme itself. */
  readonly scheme: Individual<"skos:ConceptScheme", ValuesOf<typeof ConceptSchemeSchema.fields>>;
  /** Its concepts, by notation. */
  readonly concepts: { readonly [K in N]: Individual<"skos:Concept", ValuesOf<typeof ConceptSchema.fields>> };
  /** The scheme and its concepts, in order. */
  readonly individuals: readonly AnyIndividual[];
};

/** A SKOS concept scheme in a namespace, its concepts keyed by their notations, whose union is the type of a notation. */
export function conceptScheme<const E extends Readonly<Record<string, ConceptEntry>>>(
  ns: Namespace,
  local: string,
  head: { readonly label: LangString; readonly definition?: LangString },
  entries: E,
): ConceptScheme<keyof E & string> {
  const scheme = ConceptSchemeSchema.make(term(ns, local), {
    prefLabel: head.label,
    ...(head.definition === undefined ? {} : { definition: head.definition }),
  });
  const concepts: Record<string, Individual<"skos:Concept", ValuesOf<typeof ConceptSchema.fields>>> = {};
  for (const [notation, c] of Object.entries(entries)) {
    concepts[notation] = ConceptSchema.make(term(ns, c.local), {
      inScheme: scheme,
      notation,
      prefLabel: c.label,
      ...(c.definition === undefined ? {} : { definition: c.definition }),
    });
  }
  const typedConcepts = concepts as ConceptScheme<keyof E & string>["concepts"];
  return { scheme, concepts: typedConcepts, individuals: [scheme, ...Object.values(concepts)] };
}

/** One file of an ontology: its name, the prefixes its Turtle may write, and the individuals it states, in order. */
export type OntologyFile = {
  readonly name: string;
  readonly prefixes: readonly Namespace[];
  readonly individuals: readonly AnyIndividual[];
};

/** The triples of individuals: each individual's statements in order, each triple once, where first stated. */
export function triplesOf(individuals: readonly AnyIndividual[]): readonly Triple[] {
  const out: Triple[] = [];
  const seen = new Set<string>();
  for (const i of individuals) {
    const subject = named(i.iri);
    for (const s of i.statements) {
      for (const v of s.objects) {
        const object = termOf(v);
        const key = `${i.iri} ${s.predicate.iri} ${nTriplesTerm(object)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ subject, predicate: named(s.predicate.iri), object });
      }
    }
  }
  return out;
}

/** What a type cannot state about individuals (or what a run without the type checker lets through): an integer that is not a safe integer, a word not of its field's list, or a subject stated twice. */
export type RdfFinding =
  | { readonly kind: "not-an-integer"; readonly subject: Iri; readonly predicate: Iri; readonly value: number }
  | {
      readonly kind: "not-one-of";
      readonly subject: Iri;
      readonly predicate: Iri;
      readonly value: string;
      readonly words: readonly string[];
    }
  | { readonly kind: "stated-twice"; readonly subject: Iri };

/** The sentence a finding is told with. */
export function formatRdfFinding(f: RdfFinding): string {
  switch (f.kind) {
    case "not-an-integer":
      return `<${f.subject}> <${f.predicate}>: ${f.value} is not an integer this code can write exactly`;
    case "not-one-of":
      return `<${f.subject}> <${f.predicate}>: ${JSON.stringify(f.value)} is not one of ${f.words.join(", ")}`;
    case "stated-twice":
      return `<${f.subject}> is stated by two individuals`;
    default:
      return absurd(f);
  }
}

/** Every finding about the individuals, in the order they are stated. */
export function validate(individuals: readonly AnyIndividual[]): readonly RdfFinding[] {
  const out: RdfFinding[] = [];
  const seen = new Set<string>();
  for (const i of individuals) {
    if (seen.has(i.iri)) out.push({ kind: "stated-twice", subject: i.iri });
    seen.add(i.iri);
    for (const s of i.statements) {
      for (const v of s.objects) {
        if (typeof v === "number" && !Number.isSafeInteger(v))
          out.push({ kind: "not-an-integer", subject: i.iri, predicate: s.predicate.iri, value: v });
        if (s.words !== undefined && typeof v === "string" && !s.words.includes(v))
          out.push({ kind: "not-one-of", subject: i.iri, predicate: s.predicate.iri, value: v, words: s.words });
      }
    }
  }
  return out;
}
