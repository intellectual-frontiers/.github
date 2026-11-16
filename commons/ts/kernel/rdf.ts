/**
 * RDF as algebraically typed values, and the writers of its syntaxes (commons 0012-ontology): IRIs branded once checked, namespaces and
 * typed vocabularies (RDF, RDFS, OWL, XSD, SKOS, Dublin Core terms, PROV-O, SHACL), named nodes branded with their classes, literals typed
 * by language or datatype, class schemas whose individuals' types are derived from them, code lists and SKOS concept schemes, the checks a
 * type cannot state, and N-Triples, N-Quads, canonical Turtle and expanded JSON-LD. A harness states its ontology as TypeScript with these,
 * and every RDF form of it is written, never read.
 *
 * @remarks
 * Generalized from erga's ontology DSL (`erga 248-ontology-in-typescript`), whose references are branded by class and whose Turtle is
 * written in one canonical form, and from stolos' PROV export, which wrote Turtle by hand. None of their vocabularies is here: a harness
 * keeps its own, made with `vocabulary`.
 *
 * @limits
 * It reads no RDF syntax, holds no blank-node values or RDF lists in a schema's fields, makes no SHACL shapes and compares no graphs with
 * blank nodes.
 *
 * @example
 * ```ts
 * import { classSchema, en, namespace, one, OwlClass, range, rdfs, term, triplesOf, turtle, vocabulary } from "./rdf.ts";
 * const EX = namespace("ex", "https://example.org/terms#");
 * const ex = vocabulary(EX, { Tool: "owl:Class", runs: "owl:DatatypeProperty" });
 * const Tool = classSchema(ex.Tool, { label: one(rdfs.label, range.langString), runs: one(ex.runs, range.string) });
 * const git = Tool.make(term(EX, "git"), { label: en("git"), runs: "git" });
 * turtle({ prefixes: [EX], triples: triplesOf([OwlClass.make(ex.Tool, { label: en("Tool") }), git]) });
 * ```
 *
 * @module
 */
export {
  blank,
  defaultGraph,
  en,
  formatIriError,
  formatTermError,
  iriIn,
  lang,
  languageTag,
  named,
  namespace,
  nTriplesTerm,
  ontologyIri,
  parseIri,
  plain,
  quoted,
  RDF_TYPE,
  RdfFault,
  term,
  termOf,
  typed,
  vocabulary,
  XSD_BOOLEAN,
  XSD_INTEGER,
  XSD_STRING,
} from "./rdf-term.ts";
export type {
  Blank,
  Classes,
  DefaultGraph,
  Iri,
  IriError,
  LangString,
  LanguageTag,
  Literal,
  Named,
  NamedOf,
  Namespace,
  Quad,
  Subject,
  Term,
  TermError,
  Triple,
  TypedLiteral,
  Value,
  Vocabulary,
  VocabularyTerm,
} from "./rdf-term.ts";
export { DCTERMS, dcterms, OWL, owl, PROV, prov, RDF, rdf, RDFS, rdfs, SH, sh, SKOS, skos, XSD, xsd } from "./rdf-vocabularies.ts";
export {
  classSchema,
  codeOf,
  codes,
  ConceptSchema,
  conceptScheme,
  ConceptSchemeSchema,
  DatatypeProperty,
  formatRdfFinding,
  many,
  ObjectProperty,
  one,
  ontologyOf,
  optional,
  OwlClass,
  OwlOntology,
  range,
  triplesOf,
  validate,
} from "./rdf-schema.ts";
export type {
  AnyIndividual,
  Cardinality,
  ClassSchema,
  CodeList,
  ConceptEntry,
  ConceptScheme,
  Field,
  Fields,
  Individual,
  OntologyFile,
  Range,
  RangeKind,
  RdfFinding,
  Statement,
  ValuesOf,
} from "./rdf-schema.ts";
export { compareCodePoints, jsonLd, nQuads, nTriples, turtle } from "./rdf-write.ts";
export type { TurtleDocument } from "./rdf-write.ts";
