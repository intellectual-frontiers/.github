/**
 * The standard vocabularies a commons ontology states its terms with (commons 0012-ontology FR-002): RDF, RDFS, OWL, XSD, SKOS, Dublin
 * Core terms, PROV-O and SHACL, each its namespace and only the terms some user of commons states, so a term not listed here does not
 * compile. Each term is a named node of its class: a property of `rdf:Property`, a class of `rdfs:Class`, a datatype of `rdfs:Datatype`.
 *
 * @example
 * ```ts
 * import { rdfs, skos } from "./rdf-vocabularies.ts";
 * rdfs.label.iri; // "http://www.w3.org/2000/01/rdf-schema#label"
 * skos.definition.curie; // "skos:definition"
 * ```
 *
 * @module
 */
import { namespace, vocabulary } from "./rdf-term.ts";

/** The namespace of RDF itself. */
export const RDF = namespace("rdf", "http://www.w3.org/1999/02/22-rdf-syntax-ns#");
/** The terms of `rdf:` that commons states. */
export const rdf = vocabulary(RDF, {
  type: "rdf:Property",
  first: "rdf:Property",
  rest: "rdf:Property",
  value: "rdf:Property",
  Property: "rdfs:Class",
  List: "rdfs:Class",
  nil: "rdf:List",
  langString: "rdfs:Datatype",
});

/** The namespace of RDF Schema. */
export const RDFS = namespace("rdfs", "http://www.w3.org/2000/01/rdf-schema#");
/** The terms of `rdfs:` that commons states. */
export const rdfs = vocabulary(RDFS, {
  Resource: "rdfs:Class",
  Class: "rdfs:Class",
  Datatype: "rdfs:Class",
  Literal: "rdfs:Class",
  label: "rdf:Property",
  comment: "rdf:Property",
  domain: "rdf:Property",
  range: "rdf:Property",
  subClassOf: "rdf:Property",
  subPropertyOf: "rdf:Property",
  seeAlso: "rdf:Property",
  isDefinedBy: "rdf:Property",
});

/** The namespace of OWL 2. */
export const OWL = namespace("owl", "http://www.w3.org/2002/07/owl#");
/** The terms of `owl:` that commons states. */
export const owl = vocabulary(OWL, {
  Ontology: "rdfs:Class",
  Class: "rdfs:Class",
  ObjectProperty: "rdfs:Class",
  DatatypeProperty: "rdfs:Class",
  AnnotationProperty: "rdfs:Class",
  NamedIndividual: "rdfs:Class",
  Thing: "rdfs:Class",
  versionInfo: "rdf:Property",
  versionIRI: "rdf:Property",
  imports: "rdf:Property",
  sameAs: "rdf:Property",
  equivalentClass: "rdf:Property",
});

/** The namespace of the XML Schema datatypes. */
export const XSD = namespace("xsd", "http://www.w3.org/2001/XMLSchema#");
/** The datatypes of `xsd:` that commons states. */
export const xsd = vocabulary(XSD, {
  string: "rdfs:Datatype",
  boolean: "rdfs:Datatype",
  integer: "rdfs:Datatype",
  nonNegativeInteger: "rdfs:Datatype",
  positiveInteger: "rdfs:Datatype",
  decimal: "rdfs:Datatype",
  double: "rdfs:Datatype",
  date: "rdfs:Datatype",
  dateTime: "rdfs:Datatype",
  duration: "rdfs:Datatype",
  anyURI: "rdfs:Datatype",
  language: "rdfs:Datatype",
});

/** The namespace of SKOS. */
export const SKOS = namespace("skos", "http://www.w3.org/2004/02/skos/core#");
/** The terms of `skos:` that commons states. */
export const skos = vocabulary(SKOS, {
  Concept: "rdfs:Class",
  ConceptScheme: "rdfs:Class",
  Collection: "rdfs:Class",
  inScheme: "rdf:Property",
  hasTopConcept: "rdf:Property",
  topConceptOf: "rdf:Property",
  prefLabel: "rdf:Property",
  altLabel: "rdf:Property",
  definition: "rdf:Property",
  notation: "rdf:Property",
  broader: "rdf:Property",
  narrower: "rdf:Property",
  related: "rdf:Property",
  note: "rdf:Property",
  scopeNote: "rdf:Property",
  example: "rdf:Property",
});

/** The namespace of the Dublin Core terms. */
export const DCTERMS = namespace("dcterms", "http://purl.org/dc/terms/");
/** The terms of `dcterms:` that commons states. */
export const dcterms = vocabulary(DCTERMS, {
  identifier: "rdf:Property",
  title: "rdf:Property",
  description: "rdf:Property",
  source: "rdf:Property",
  license: "rdf:Property",
  created: "rdf:Property",
  modified: "rdf:Property",
  date: "rdf:Property",
  creator: "rdf:Property",
  publisher: "rdf:Property",
  isPartOf: "rdf:Property",
  hasPart: "rdf:Property",
  references: "rdf:Property",
  conformsTo: "rdf:Property",
  Standard: "rdfs:Class",
});

/** The namespace of PROV-O. */
export const PROV = namespace("prov", "http://www.w3.org/ns/prov#");
/** The terms of `prov:` that commons states: PROV-O's starting point, and where an activity ran. */
export const prov = vocabulary(PROV, {
  Entity: "rdfs:Class",
  Activity: "rdfs:Class",
  Agent: "rdfs:Class",
  Person: "rdfs:Class",
  Organization: "rdfs:Class",
  SoftwareAgent: "rdfs:Class",
  wasGeneratedBy: "rdf:Property",
  wasDerivedFrom: "rdf:Property",
  wasAttributedTo: "rdf:Property",
  wasAssociatedWith: "rdf:Property",
  wasInformedBy: "rdf:Property",
  actedOnBehalfOf: "rdf:Property",
  used: "rdf:Property",
  startedAtTime: "rdf:Property",
  endedAtTime: "rdf:Property",
  generatedAtTime: "rdf:Property",
  atLocation: "rdf:Property",
  value: "rdf:Property",
});

/** The namespace of SHACL. */
export const SH = namespace("sh", "http://www.w3.org/ns/shacl#");
/** The terms of `sh:` that commons states. */
export const sh = vocabulary(SH, {
  NodeShape: "rdfs:Class",
  PropertyShape: "rdfs:Class",
  targetClass: "rdf:Property",
  property: "rdf:Property",
  path: "rdf:Property",
  datatype: "rdf:Property",
  class: "rdf:Property",
  node: "rdf:Property",
  minCount: "rdf:Property",
  maxCount: "rdf:Property",
  pattern: "rdf:Property",
  in: "rdf:Property",
  order: "rdf:Property",
  name: "rdf:Property",
  description: "rdf:Property",
});
