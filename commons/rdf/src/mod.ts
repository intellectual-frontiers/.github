// Spec: 0001-rdf FR-008
/**
 * RDF as algebraically typed values and the writers of its syntaxes (commons rdf 0001-rdf): IRIs branded once checked, namespaces and typed vocabularies, named nodes, literals typed by language or datatype,
 * class schemas, code lists, the checks a type cannot state, and N-Triples, N-Quads, canonical Turtle and expanded JSON-LD. The one entry of the package `@intellectual-frontiers/rdf`: every module of `src/` is
 * exported from here, so that a harness states its ontology as TypeScript with one import.
 *
 * @example
 * ```ts
 * import { classSchema, en, namespace, one, OwlClass, range, rdfs, term, triplesOf, turtle, vocabulary } from "@intellectual-frontiers/rdf";
 * const EX = namespace("ex", "https://example.org/terms#");
 * const ex = vocabulary(EX, { Tool: "owl:Class", runs: "owl:DatatypeProperty" });
 * const Tool = classSchema(ex.Tool, { label: one(rdfs.label, range.langString), runs: one(ex.runs, range.string) });
 * turtle({ prefixes: [EX], triples: triplesOf([OwlClass.make(ex.Tool, { label: en("Tool") })]) });
 * ```
 *
 * @module
 */
export * from "./rdf-term.ts";
export * from "./rdf-schema.ts";
export * from "./rdf-vocabularies.ts";
export * from "./rdf-write.ts";
export * from "./rdf.ts";
