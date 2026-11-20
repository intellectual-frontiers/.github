/**
 * The vocabulary of Kanon (commons 0033-kanon), the pattern of a library built in three layers: the Layer (Governance, Logical, Physical, the members of its code list, each with its rank and
 * its alignment to the Model Driven Architecture viewpoints and to the levels of data modeling), the Element a layer says, the TraceEdge that makes an element of one layer out of one of the
 * layer above, the Projection that derives a layer from the one above, the Surface that faces a caller and the Finding of the check.
 *
 * @remarks
 * It stands on PROV-O (an element is a `prov:Entity`, a projection a `prov:Activity`, a trace edge a `prov:Derivation`) and SHACL (a finding specializes `sh:ValidationResult`), and a layer is a
 * SKOS concept. The alignment to OMG's Model Driven Architecture is data of the layer, `kanon:mdaViewpoint` (`CIM`, `PIM`, `PSM`), with the relation `closeMatch` stated in the specification
 * (0033-kanon FR-008): OMG publishes no IRI for the viewpoints, so the alignment is a string and no IRI is invented. Every class has a record of its basis (0018-standards-first FR-003): the
 * audit of this ontology; none is `unaligned`, so none needs a Decision of the owner.
 *
 * @limits
 * The properties do not yet carry a basis of their own (the baseline holds them until the schemas require it). A Surface is a class with no standard to rest on but PROV-O's entity.
 *
 * @module
 */
import {
  classSchema,
  codes,
  DatatypeProperty,
  en,
  iriIn,
  namespace,
  named,
  ObjectProperty,
  one,
  type OntologyFile,
  ontologyOf,
  OWL,
  OwlClass,
  OwlOntology,
  PROV,
  prov,
  range,
  RDFS,
  rdfs,
  SH,
  SKOS,
  skos,
  optional,
  term,
  vocabulary,
  XSD,
  xsd,
} from "@intellectual-frontiers/rdf";
import { bases, MZ, MZID, OntologyTerm } from "../mizan/mizan.ts";

/** The namespace of Kanon's terms. */
export const KANON = namespace("kanon", "https://www.intellectualfrontiers.com/ontology/kanon#");
/** The namespace of the versions of Kanon's ontology: `owl:versionIRI` names one of them. */
export const KANONV = namespace("kanonv", "https://www.intellectualfrontiers.com/ontology/kanon/");
/** The terms of PROV-O that this ontology specializes and the kernel's `prov` does not hold. */
export const provMore = vocabulary(PROV, { Derivation: "rdfs:Class" });
/** The terms of SHACL that this ontology specializes and the kernel's `sh` does not hold. */
export const shMore = vocabulary(SH, { ValidationResult: "rdfs:Class" });

/** The terms of Kanon's vocabulary: its classes and properties. */
export const kanon = vocabulary(KANON, {
  Layer: "owl:Class",
  Projection: "owl:Class",
  Element: "owl:Class",
  TraceEdge: "owl:Class",
  Surface: "owl:Class",
  Finding: "owl:Class",
  layerRank: "owl:DatatypeProperty",
  mdaViewpoint: "owl:DatatypeProperty",
  dataModelingLevel: "owl:DatatypeProperty",
  inLayer: "owl:ObjectProperty",
  elementId: "owl:DatatypeProperty",
  elementKind: "owl:DatatypeProperty",
  tracesFrom: "owl:ObjectProperty",
  tracesTo: "owl:ObjectProperty",
  how: "owl:DatatypeProperty",
  projectsFrom: "owl:ObjectProperty",
  projectsTo: "owl:ObjectProperty",
  surfaceLayer: "owl:ObjectProperty",
  rule: "owl:DatatypeProperty",
  about: "owl:ObjectProperty",
});

// ---- the code list: the layers

/** The schema of a layer (`kanon:Layer`): its rank and its alignment (0033-kanon FR-008, FR-015). */
export const Layer = classSchema(kanon.Layer, {
  label: one(rdfs.label, range.langString),
  definition: optional(skos.definition, range.langString),
  layerRank: one(kanon.layerRank, range.integer),
  mdaViewpoint: one(kanon.mdaViewpoint, range.string),
  dataModelingLevel: one(kanon.dataModelingLevel, range.string),
});

/** The three layers, from the top (0033-kanon FR-001): the layers keep their plain names, and only the pattern is branded. */
export const layers = codes(Layer, KANON, {
  Governance: {
    label: en("Governance"),
    definition: en("What a thing is and what it may do, stated once, in the words of its domain."),
    layerRank: 1,
    mdaViewpoint: "CIM",
    dataModelingLevel: "conceptual",
  },
  Logical: {
    label: en("Logical"),
    definition: en("The model a program reasons with, made from Governance by code and never copied."),
    layerRank: 2,
    mdaViewpoint: "PIM",
    dataModelingLevel: "logical",
  },
  Physical: {
    label: en("Physical"),
    definition: en("What carries the logical model out in a place: a dialect, a table, a command, a tool, a route."),
    layerRank: 3,
    mdaViewpoint: "PSM",
    dataModelingLevel: "physical",
  },
});

// ---- the classes and the properties, each with its label and definition

/** The classes, each with its label and definition. */
export const classes = [
  OwlClass.make(kanon.Layer, {
    label: en("Layer"),
    subClassOf: [skos.Concept],
    definition: en(
      "One of Governance, Logical and Physical, with its rank and its alignment to the viewpoints of Model Driven Architecture.",
    ),
  }),
  OwlClass.make(kanon.Element, {
    label: en("Element"),
    subClassOf: [prov.Entity],
    definition: en(
      "One thing a layer says (a concept, an action, a table, a command), with a stable identity, a kind, a name, a definition and a source.",
    ),
  }),
  OwlClass.make(kanon.Projection, {
    label: en("Projection"),
    subClassOf: [prov.Activity],
    definition: en("The derivation, by code, of the elements of one layer from the elements of the layer above."),
  }),
  OwlClass.make(kanon.TraceEdge, {
    label: en("Trace edge"),
    subClassOf: [provMore.Derivation],
    definition: en("The record that an element of one layer was made from an element of the layer above, and how."),
  }),
  OwlClass.make(kanon.Surface, {
    label: en("Surface"),
    subClassOf: [prov.Entity],
    definition: en("A unit of the Physical layer that faces a caller: the command line, a tool server, a REST service."),
  }),
  OwlClass.make(kanon.Finding, {
    label: en("Finding"),
    subClassOf: [shMore.ValidationResult],
    definition: en("A breach of the rules of Kanon, with its code, the element or file it is about and one sentence."),
  }),
] as const;

/** The properties, each with its domain, range and definition. */
export const properties = [
  DatatypeProperty.make(kanon.layerRank, {
    domain: kanon.Layer,
    range: xsd.integer,
    label: en("layer rank"),
    definition: en("How far down the layer stands, from 1 at Governance; a higher rank imports a lower."),
  }),
  DatatypeProperty.make(kanon.mdaViewpoint, {
    domain: kanon.Layer,
    range: xsd.string,
    label: en("MDA viewpoint"),
    definition: en(
      "The viewpoint of OMG's Model Driven Architecture the layer is close to: CIM, PIM or PSM (a closeMatch, not an identity).",
    ),
  }),
  DatatypeProperty.make(kanon.dataModelingLevel, {
    domain: kanon.Layer,
    range: xsd.string,
    label: en("data modeling level"),
    definition: en("The level of data modeling the layer is close to: conceptual, logical or physical."),
  }),
  ObjectProperty.make(kanon.inLayer, {
    domain: kanon.Element,
    range: kanon.Layer,
    label: en("in layer"),
    definition: en("The layer an element is in."),
  }),
  DatatypeProperty.make(kanon.elementId, {
    domain: kanon.Element,
    range: xsd.string,
    label: en("element id"),
    definition: en("The identity of the element, stable across builds."),
  }),
  DatatypeProperty.make(kanon.elementKind, {
    domain: kanon.Element,
    range: xsd.string,
    label: en("element kind"),
    definition: en(
      "What kind of thing the element is: action, verb, option, operand, problem-code, outcome, cli-command, mcp-tool or rest-route.",
    ),
  }),
  ObjectProperty.make(kanon.tracesFrom, {
    domain: kanon.TraceEdge,
    range: kanon.Element,
    label: en("traces from"),
    definition: en("The element of the layer above that the edge starts at."),
  }),
  ObjectProperty.make(kanon.tracesTo, {
    domain: kanon.TraceEdge,
    range: kanon.Element,
    label: en("traces to"),
    definition: en("The element of the layer below that was made from it."),
  }),
  DatatypeProperty.make(kanon.how, {
    domain: kanon.TraceEdge,
    range: xsd.string,
    label: en("how"),
    definition: en("How the one was made into the other: projects to, written as, read by."),
  }),
  ObjectProperty.make(kanon.projectsFrom, {
    domain: kanon.Projection,
    range: kanon.Layer,
    label: en("projects from"),
    definition: en("The layer the projection reads."),
  }),
  ObjectProperty.make(kanon.projectsTo, {
    domain: kanon.Projection,
    range: kanon.Layer,
    label: en("projects to"),
    definition: en("The layer the projection makes."),
  }),
  ObjectProperty.make(kanon.surfaceLayer, {
    domain: kanon.Surface,
    range: kanon.Layer,
    label: en("surface layer"),
    definition: en("The layer a surface is in: Physical."),
  }),
  DatatypeProperty.make(kanon.rule, {
    domain: kanon.Finding,
    range: xsd.string,
    label: en("rule"),
    definition: en(
      "The code of the finding: layers/unclassified, layers/relative, layers/private, layers/external, layers/above, layers/around, layers/cycle or kanon/dropped.",
    ),
  }),
  ObjectProperty.make(kanon.about, {
    domain: kanon.Finding,
    range: kanon.Element,
    label: en("about"),
    definition: en("The element the finding is about, where it is about one."),
  }),
] as const;

/** The ontology itself: its label, description and version. */
export const kanonOntology = OwlOntology.make(ontologyOf(KANON), {
  label: en("Kanon"),
  description: en(
    "The vocabulary of Kanon, the pattern of a library built in three layers: the layers, the elements they say, the projections that derive one from the other, the trace edges that keep identity, the surfaces and the findings of the check.",
  ),
  versionInfo: "1.0.0",
  versionIri: named<"owl:Ontology">(iriIn(KANONV, "1.0.0")),
});

// ---- the audit: the basis of every class (0018-standards-first FR-003)

/** The record of a class that specializes a standard's class. */
function specializes(local: keyof typeof kanon, standardTerm: string, definedBy: string) {
  return OntologyTerm.make(term(MZID, `term-kanon-${local}`), {
    label: en(`kanon:${local}`),
    termIri: kanon[local].iri,
    basis: bases.Specializes,
    standardTerm,
    mappingRelation: "subClassOf",
    definedBy: [definedBy],
  });
}

/** The audit of Kanon: one record for every class. */
export const terms = [
  specializes("Layer", skos.Concept.iri, "0033-kanon FR-015"),
  specializes("Element", prov.Entity.iri, "0033-kanon FR-015"),
  specializes("Projection", prov.Activity.iri, "0033-kanon FR-015"),
  specializes("TraceEdge", provMore.Derivation.iri, "0033-kanon FR-015"),
  specializes("Surface", prov.Entity.iri, "0033-kanon FR-015"),
  specializes("Finding", shMore.ValidationResult.iri, "0033-kanon FR-015"),
] as const;

/** The file this module states: its name, its prefixes and its individuals. */
export const file: OntologyFile = {
  name: "kanon",
  prefixes: [KANON, KANONV, MZ, MZID, OWL, PROV, RDFS, SH, SKOS, XSD],
  individuals: [kanonOntology, ...classes, ...properties, ...Object.values(layers), ...terms],
};
