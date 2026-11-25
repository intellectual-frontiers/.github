// Spec: 0004-workload-terms FR-001, FR-002, FR-003, FR-004
/**
 * The vocabulary of Workload (commons 0040-workload-pattern): a workload, a unit of operated work and not running software; the form that says what kind of work it is and how it executes (a runbook, a reconcile, and the
 * reserved graph and campaign); and the trigger that says what starts it (manual, a schedule, an event or an alert).
 *
 * @remarks
 * It stands on PROV-O and SKOS, whose terms the library `rdf` already holds: a workload is a `prov:Entity` and each code list is a SKOS concept. A form is never a dialect and a trigger is never a form. A dialect is a
 * harness projection of a workload, and the Kanon ontology already has the class that says what a dialect is (`kanon:Instance`, an instance of a unit kind of a host), so this ontology adds no class for it. Each class has a record of its basis
 * (0018-standards-first FR-003): the audit of this ontology; none is `unaligned`, so none needs a Decision of the owner.
 *
 * @limits
 * The properties do not yet carry a basis of their own (the baseline holds them until the schemas require it).
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
  SKOS,
  skos,
  term,
  vocabulary,
  XSD,
  xsd,
} from "@intellectual-frontiers/rdf";
import { bases, MZ, MZID, OntologyTerm } from "../mizan/mizan.ts";

/** The namespace of Workload's terms. */
export const WORKLOAD = namespace("wl", "https://www.intellectualfrontiers.com/ontology/workload#");
/** The namespace of the versions of Workload's ontology: `owl:versionIRI` names one of them. */
export const WORKLOADV = namespace("wlv", "https://www.intellectualfrontiers.com/ontology/workload/");

/** The terms of Workload's vocabulary: its classes and properties. */
export const wl = vocabulary(WORKLOAD, {
  Workload: "owl:Class",
  Form: "owl:Class",
  Trigger: "owl:Class",
  workloadId: "owl:DatatypeProperty",
  workloadForm: "owl:ObjectProperty",
  workloadTrigger: "owl:ObjectProperty",
  formStatus: "owl:DatatypeProperty",
});

const CODE = { label: one(rdfs.label, range.langString), definition: one(skos.definition, range.langString) } as const;

/** The schema of a form (`wl:Form`): whether it has code or is a reserved slot. */
export const FormSchema = classSchema(wl.Form, { ...CODE, formStatus: one(wl.formStatus, range.string) });

/** The forms of a workload (0003-workload-forms FR-004): two have code and two are reserved. */
export const forms = codes(FormSchema, WORKLOAD, {
  Runbook: { label: en("Runbook"), definition: en("The form of a procedure: an ordered algebra of steps that a person or an agent orchestrates, each effect a verb."), formStatus: "built" },
  Reconcile: { label: en("Reconcile"), definition: en("The form of a loop toward a desired state: observe, diff, plan, approve the plan by its hash, apply and verify, level-triggered."), formStatus: "built" },
  Graph: { label: en("Graph"), definition: en("The form of a graph of jobs with freshness, which an external executor runs; reserved until a second concrete user needs it."), formStatus: "reserved" },
  Campaign: { label: en("Campaign"), definition: en("The form of a collection over a period with sampling; reserved until a second concrete user needs it."), formStatus: "reserved" },
});

/** The schema of a trigger (`wl:Trigger`). */
export const TriggerSchema = classSchema(wl.Trigger, CODE);

/** The four triggers of a workload (0003-workload-forms FR-005): a field of a workload and never a form. */
export const triggers = codes(TriggerSchema, WORKLOAD, {
  Manual: { label: en("Manual"), definition: en("A person or an agent starts the workload by hand.") },
  Schedule: { label: en("Schedule"), definition: en("The workload starts on a cadence: daily, weekly, monthly, quarterly or yearly.") },
  Event: { label: en("Event"), definition: en("The workload starts when a named event happens.") },
  Alert: { label: en("Alert"), definition: en("The workload starts when a named alert fires.") },
});

/** The classes, each with its label and definition. */
export const classes = [
  OwlClass.make(wl.Workload, {
    label: en("Workload"),
    subClassOf: [prov.Entity],
    definition: en("A unit of operated work, not running software: typed data of one form, with a trigger, whose every effect is a verb and whose autonomy is derived from its effects."),
  }),
  OwlClass.make(wl.Form, { label: en("Form"), subClassOf: [skos.Concept], definition: en("One of the forms a workload may have: what kind of work it is and how it executes. A form is never a dialect.") }),
  OwlClass.make(wl.Trigger, { label: en("Trigger"), subClassOf: [skos.Concept], definition: en("One of the ways a workload is started. A trigger is a field of a workload and never a form.") }),
] as const;

/** The properties, each with its domain, range and definition. */
export const properties = [
  DatatypeProperty.make(wl.workloadId, { domain: wl.Workload, range: xsd.string, label: en("workload id"), definition: en("The id of the workload: lower case words joined by hyphens, which is also the name of its skill.") }),
  ObjectProperty.make(wl.workloadForm, { domain: wl.Workload, range: wl.Form, label: en("workload form"), definition: en("The form of the workload.") }),
  ObjectProperty.make(wl.workloadTrigger, { domain: wl.Workload, range: wl.Trigger, label: en("workload trigger"), definition: en("What starts the workload.") }),
  DatatypeProperty.make(wl.formStatus, { domain: wl.Form, range: xsd.string, label: en("form status"), definition: en("Whether the form has code (built) or is a named slot with no code (reserved).") }),
] as const;

/** The ontology itself: its label, description and version. */
export const workloadOntology = OwlOntology.make(ontologyOf(WORKLOAD), {
  label: en("Workload"),
  description: en("The vocabulary of Workload: a workload as a unit of operated work, the forms it may have and the triggers that start it."),
  versionInfo: "1.0.0",
  versionIri: named<"owl:Ontology">(iriIn(WORKLOADV, "1.0.0")),
});

// ---- the audit: the basis of every class (0018-standards-first FR-003)

/** The record of a class that specializes a standard's class. */
function specializes(local: "Workload" | "Form" | "Trigger", standardTerm: string, definedBy: string) {
  return OntologyTerm.make(term(MZID, `term-workload-${local}`), {
    label: en(`wl:${local}`),
    termIri: wl[local].iri,
    basis: bases.Specializes,
    standardTerm,
    mappingRelation: "subClassOf",
    definedBy: [definedBy],
  });
}

/** The audit of Workload: one record for every class, each specializing a term of PROV-O or SKOS. */
export const terms = [
  specializes("Workload", prov.Entity.iri, "0040-workload-pattern FR-001"),
  specializes("Form", skos.Concept.iri, "0003-workload-forms FR-004"),
  specializes("Trigger", skos.Concept.iri, "0003-workload-forms FR-005"),
] as const;

/** The file this module states: its name, its prefixes and its individuals. */
export const file: OntologyFile = {
  name: "workload",
  prefixes: [WORKLOAD, WORKLOADV, MZ, MZID, OWL, PROV, RDFS, SKOS, XSD],
  individuals: [workloadOntology, ...classes, ...properties, ...Object.values(forms), ...Object.values(triggers), ...terms],
};
