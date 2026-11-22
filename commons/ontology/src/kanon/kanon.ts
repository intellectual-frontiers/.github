// Spec: 0001-ontologies FR-001
/**
 * The vocabulary of Kanon (commons 0033-kanon), the pattern of a library built in three layers: the Layer (Governance, Logical, Physical, the members of its code list, each with its rank and
 * its alignment to the Model Driven Architecture viewpoints and to the levels of data modeling), the Element a layer says, the TraceEdge that makes an element of one layer out of one of the
 * layer above, the Projection that derives a layer from the one above, the Surface that faces a caller, the Finding of the check, the Instance of a unit kind (a dialect), the Plugin that extends a host, the Family
 * of a host and its extensions, and the Matrix of requirement by instance.
 *
 * @remarks
 * It stands on PROV-O (an element is a `prov:Entity`, a projection a `prov:Activity`, a trace edge a `prov:Derivation`) and SHACL (a finding specializes `sh:ValidationResult`), and a layer is a
 * SKOS concept. The alignment to OMG's Model Driven Architecture is data of the layer, `kanon:mdaViewpoint` (`CIM`, `PIM`, `PSM`), with the relation `closeMatch` stated in the specification
 * (0033-kanon FR-008): OMG publishes no IRI for the viewpoints, so the alignment is a string and no IRI is invented. Every class has a record of its basis (0018-standards-first FR-003): the
 * audit of this ontology; none is `unaligned`, so none needs a Decision of the owner. An Instance, a Plugin and a Matrix are entities that something was made as (`prov:Entity`); a Family is a `skos:Collection`
 * of its host and its extensions.
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
  Instance: "owl:Class",
  Plugin: "owl:Class",
  Family: "owl:Class",
  Matrix: "owl:Class",
  Relation: "owl:Class",
  Bundle: "owl:Class",
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
  instanceName: "owl:DatatypeProperty",
  instanceOfUnit: "owl:DatatypeProperty",
  instanceFamily: "owl:ObjectProperty",
  elementInstance: "owl:ObjectProperty",
  pluginNoun: "owl:DatatypeProperty",
  pluginFamily: "owl:ObjectProperty",
  dependsOn: "owl:ObjectProperty",
  familyHost: "owl:DatatypeProperty",
  matrixFamily: "owl:ObjectProperty",
  matrixOutcome: "owl:DatatypeProperty",
  relationKind: "owl:DatatypeProperty",
  relationFrom: "owl:ObjectProperty",
  relationTo: "owl:ObjectProperty",
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
  OwlClass.make(kanon.Instance, {
    label: en("Instance"),
    subClassOf: [prov.Entity],
    definition: en(
      "One of several occurrences of a kind of unit in the Physical layer (a dialect), declared by its host with the unit it is an instance of; it imports only the layers it extends, through the host's public exports, and never another instance.",
    ),
  }),
  OwlClass.make(kanon.Plugin, {
    label: en("Plugin"),
    subClassOf: [prov.Entity],
    definition: en(
      "A package that extends one host through the host's public exports and the plugin contract only; the host never imports it, and it imports another plugin only by a declared dependency.",
    ),
  }),
  OwlClass.make(kanon.Family, {
    label: en("Family"),
    subClassOf: [skos.Collection],
    definition: en(
      "A host with its dialects and plugins, and the naming rule of their packages (<host>-dialect-<tool>, <host>-<noun>), as data of the host's table.",
    ),
  }),
  OwlClass.make(kanon.Matrix, {
    label: en("Matrix"),
    subClassOf: [prov.Entity],
    definition: en(
      "The table of requirement by instance: for each annotation of Governance and each instance, whether it is expressed, carried or unexpressed with its reason, or dropped.",
    ),
  }),
  OwlClass.make(kanon.Relation, {
    label: en("Relation"),
    subClassOf: [prov.Entity],
    definition: en(
      "A link between two elements of one layer, with a kind the model's vocabulary declares: it may be cyclic and is never a trace edge (0033-kanon FR-029).",
    ),
  }),
  OwlClass.make(kanon.Bundle, {
    label: en("Bundle"),
    subClassOf: [prov.Entity],
    definition: en(
      "The Logical model published as files with a manifest of every file and its SHA-256, which a loader refuses whole where any file differs (0033-kanon FR-026).",
    ),
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
      "The code of the finding: layers/unclassified, layers/relative, layers/private, layers/external, layers/above, layers/around, layers/cycle, instances/sibling, instances/undeclared, plugins/inverted, plugins/undeclared, plugins/contract, family/name or kanon/dropped.",
    ),
  }),
  ObjectProperty.make(kanon.about, {
    domain: kanon.Finding,
    range: kanon.Element,
    label: en("about"),
    definition: en("The element the finding is about, where it is about one."),
  }),
  DatatypeProperty.make(kanon.instanceName, {
    domain: kanon.Instance,
    range: xsd.string,
    label: en("instance name"),
    definition: en("The name of the instance, as ansible."),
  }),
  DatatypeProperty.make(kanon.instanceOfUnit, {
    domain: kanon.Instance,
    range: xsd.string,
    label: en("instance of unit"),
    definition: en("The folder of the unit of which this is an instance."),
  }),
  ObjectProperty.make(kanon.instanceFamily, {
    domain: kanon.Instance,
    range: kanon.Family,
    label: en("instance family"),
    definition: en("The family whose host declares the instance."),
  }),
  ObjectProperty.make(kanon.elementInstance, {
    domain: kanon.Element,
    range: kanon.Instance,
    label: en("element instance"),
    definition: en("The instance an element of a physical layer belongs to."),
  }),
  DatatypeProperty.make(kanon.pluginNoun, {
    domain: kanon.Plugin,
    range: xsd.string,
    label: en("plugin noun"),
    definition: en("The noun the plugin adds to the host's command, as server."),
  }),
  ObjectProperty.make(kanon.pluginFamily, {
    domain: kanon.Plugin,
    range: kanon.Family,
    label: en("plugin family"),
    definition: en("The family whose host declares the plugin."),
  }),
  ObjectProperty.make(kanon.dependsOn, {
    domain: kanon.Plugin,
    range: kanon.Plugin,
    label: en("depends on"),
    definition: en("A plugin this one declares a dependency on, and may import."),
  }),
  DatatypeProperty.make(kanon.familyHost, {
    domain: kanon.Family,
    range: xsd.string,
    label: en("family host"),
    definition: en("The package of the host library of the family."),
  }),
  ObjectProperty.make(kanon.matrixFamily, {
    domain: kanon.Matrix,
    range: kanon.Family,
    label: en("matrix family"),
    definition: en("The family whose instances are the columns of the matrix."),
  }),
  DatatypeProperty.make(kanon.matrixOutcome, {
    domain: kanon.Matrix,
    range: xsd.string,
    label: en("matrix outcome"),
    definition: en("How a cell of the matrix ends: expressed, carried, unexpressed or dropped."),
  }),
  DatatypeProperty.make(kanon.relationKind, {
    domain: kanon.Relation,
    range: xsd.string,
    label: en("relation kind"),
    definition: en("The kind of a relation, from the vocabulary of the model that holds it."),
  }),
  ObjectProperty.make(kanon.relationFrom, {
    domain: kanon.Relation,
    range: kanon.Element,
    label: en("relation from"),
    definition: en("The element a relation leaves."),
  }),
  ObjectProperty.make(kanon.relationTo, {
    domain: kanon.Relation,
    range: kanon.Element,
    label: en("relation to"),
    definition: en("The element a relation arrives at."),
  }),
] as const;

/** The ontology itself: its label, description and version. */
export const kanonOntology = OwlOntology.make(ontologyOf(KANON), {
  label: en("Kanon"),
  description: en(
    "The vocabulary of Kanon, the pattern of a library built in three layers: the layers, the elements they say, the projections that derive one from the other, the trace edges that keep identity, the surfaces, the findings of the check, the instances of a unit kind, the plugins, the families and the matrix of requirement by instance.",
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
  specializes("Instance", prov.Entity.iri, "0033-kanon FR-015"),
  specializes("Plugin", prov.Entity.iri, "0033-kanon FR-015"),
  specializes("Family", skos.Collection.iri, "0033-kanon FR-015"),
  specializes("Matrix", prov.Entity.iri, "0033-kanon FR-015"),
  specializes("Relation", prov.Entity.iri, "0033-kanon FR-031"),
  specializes("Bundle", prov.Entity.iri, "0033-kanon FR-031"),
] as const;

/** The file this module states: its name, its prefixes and its individuals. */
export const file: OntologyFile = {
  name: "kanon",
  prefixes: [KANON, KANONV, MZ, MZID, OWL, PROV, RDFS, SH, SKOS, XSD],
  individuals: [kanonOntology, ...classes, ...properties, ...Object.values(layers), ...terms],
};
