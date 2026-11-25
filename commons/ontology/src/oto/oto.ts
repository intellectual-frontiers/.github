// Spec: 0002-oto FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007
/**
 * The Operational Truth Ontology (OTO; commons ontology 0002-oto): the model the site operationaltruth.org publishes for Operational Truth(TM), a trademark of Netspective Communications LLC. Its nine domains and the entities of each,
 * its six invariants, its three pillars, five principles and four maturity levels, the measurable alignment between intent, structure, execution and evidence, and, from Operational Acceptance Testing (OAT), what an acceptance run expected and
 * observed. `oto:` names the ontology only: the framework and the discipline of OAT are terms inside it.
 *
 * @remarks
 * It is built from the published site alone, for no formal schema was available; where the site is silent the ontology is silent, and the three states of an alignment, which the site does not give, are said in their definitions to come from
 * the estate library. An acceptance run specializes `ifqs:TestRun`, and the evidence grade `ifqs:E5` is the same idea in the quality system. Every class has a record of its basis.
 *
 * @limits
 * The entities each domain lists are names, not classes: a class is stated only where a library of commons needs one. The properties do not yet carry a basis of their own.
 *
 * @module
 */
import {
  classSchema,
  codes,
  DatatypeProperty,
  en,
  iriIn,
  many,
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
import { IFQS, ifqs, IFQSV } from "../ifqs/ifqs.ts";

/** The namespace of OTO's terms. */
export const OTO = namespace("oto", "https://www.intellectualfrontiers.com/ontology/oto#");
/** The namespace of the versions of OTO's ontology: `owl:versionIRI` names one of them. */
export const OTOV = namespace("otov", "https://www.intellectualfrontiers.com/ontology/oto/");

/** The terms of OTO's vocabulary: its classes and properties. */
export const oto = vocabulary(OTO, {
  Domain: "owl:Class",
  Invariant: "owl:Class",
  Pillar: "owl:Class",
  Principle: "owl:Class",
  MaturityLevel: "owl:Class",
  Dimension: "owl:Class",
  AlignmentState: "owl:Class",
  Alignment: "owl:Class",
  AcceptanceRun: "owl:Class",
  domainNumber: "owl:DatatypeProperty",
  entity: "owl:DatatypeProperty",
  realizedBy: "owl:DatatypeProperty",
  levelNumber: "owl:DatatypeProperty",
  intent: "owl:DatatypeProperty",
  structure: "owl:DatatypeProperty",
  execution: "owl:DatatypeProperty",
  evidence: "owl:DatatypeProperty",
  alignmentState: "owl:ObjectProperty",
  expectedOutcome: "owl:DatatypeProperty",
  observedOutcome: "owl:DatatypeProperty",
  dimension: "owl:ObjectProperty",
});

// ---- the code lists

const CODE = { label: one(rdfs.label, range.langString), definition: one(skos.definition, range.langString) } as const;

/** The schema of a domain (`oto:Domain`): its number, the entities the source lists and the libraries of commons that realize it. */
export const DomainSchema = classSchema(oto.Domain, {
  ...CODE,
  domainNumber: one(oto.domainNumber, range.integer),
  entity: many(oto.entity, range.string),
  realizedBy: many(oto.realizedBy, range.string),
});

/** The nine domains of OTO (operationaltruth.org/ontology): each a part of the organization modeled as a graph of explicit relationships. */
export const domains = codes(DomainSchema, OTO, {
  OrganizationalStructure: {
    label: en("Organizational structure as code"),
    definition: en("The human and structural anatomy of the organization: structural truth is not inferred, it is declared."),
    domainNumber: 1,
    entity: ["Person", "Role", "Team", "Organizational Unit", "Reporting Line", "Delegation of Authority", "Cost Center", "Responsibility", "Accountability"],
    realizedBy: ["grc"],
  },
  PolicyAsCode: {
    label: en("Policy as code"),
    definition: en("Organizational intent as enforceable logic rather than prose: policy is not static text, it is executable intent."),
    domainNumber: 2,
    entity: ["Policy", "Policy Group", "Policy Rule", "Control Objective", "Enforcement Mode", "Exception", "Waiver", "Expiration"],
    realizedBy: ["grc"],
  },
  ProcessAndWorkflow: {
    label: en("Process and workflow as code"),
    definition: en("How work actually flows: processes are graphs, tasks are bound to roles, decisions have criteria and authority, and failure paths are first-class."),
    domainNumber: 3,
    entity: ["Process", "Workflow", "Task", "Decision Point", "Approval", "Handoff", "SLA", "Failure Mode"],
    realizedBy: [],
  },
  InfrastructureAndPlatform: {
    label: en("Infrastructure as code and platform truth"),
    definition: en("The technical substrate on which operations run: infrastructure is declarative and inspectable, and identity and access are graph-connected to roles and policies."),
    domainNumber: 4,
    entity: ["Systems", "Services", "Environments", "Assets", "Identities", "Access Controls", "Configurations", "Dependencies"],
    realizedBy: ["estate", "archon", "toolchain"],
  },
  EvidenceAndTelemetry: {
    label: en("Evidence and telemetry as truth anchors"),
    definition: en("The domain that grounds the ontology in observable reality: evidence is not documentation, it is proof, immutable, attributable, linked to what it supports and bounded in time and scope."),
    domainNumber: 5,
    entity: ["Evidence Artifact", "Observation", "Measurement", "Event", "Log", "Snapshot", "Assertion"],
    realizedBy: ["grc", "quality", "telemetry"],
  },
  ExternalObligations: {
    label: en("External obligations and normative frameworks"),
    definition: en("The world the organization operates in: external requirements never stand alone, they map to internal policies, controls and evidence, and traceability is bidirectional."),
    domainNumber: 6,
    entity: ["Regulation", "Standard", "Contract", "Obligation", "Requirement", "Jurisdiction", "Authority"],
    realizedBy: ["ontology", "grc"],
  },
  ChangeAndMemory: {
    label: en("Change, versioning and organizational memory"),
    definition: en("How the organization evolves: every change has authorship, intent and measurable impact, and rollback is possible and explicit; organizations gain memory, not just history."),
    domainNumber: 7,
    entity: ["Change Event", "Proposal", "Approval", "Version", "Diff", "Rationale"],
    realizedBy: ["ontology", "spec-kit"],
  },
  SimulationAndTesting: {
    label: en("Simulation, testing and counterfactuals"),
    definition: en("Safe experimentation: changes are modeled before execution, policies are tested before enforcement, and governance moves from reactive to predictive."),
    domainNumber: 8,
    entity: ["Scenario", "Hypothesis", "Test", "Expected Outcome", "Observed Outcome", "Risk Delta"],
    realizedBy: ["quality", "test"],
  },
  UnifyingGraph: {
    label: en("Unifying graph model"),
    definition: en("All domains resolve into a single typed graph whose nodes are declared entities and whose edges are explicit relationships with semantics, direction and constraints: the graph is the system of record."),
    domainNumber: 9,
    entity: [],
    realizedBy: ["rdf", "ontology"],
  },
});

/** The six invariants of OTO: what an ontology must satisfy to be trustworthy; their violation is a system error. */
export const invariants = codes(classSchema(oto.Invariant, CODE), OTO, {
  NoOrphanPolicies: { label: en("No orphan policies"), definition: en("Every policy has an owner and a place in the graph; a policy with none is a system error, not an audit finding.") },
  NoUnownedResponsibilities: { label: en("No unowned responsibilities"), definition: en("Every responsibility has an accountable owner; one with none is a system error, not an audit finding.") },
  NoUnenforcedCriticalControls: { label: en("No unenforced critical controls"), definition: en("Every critical control is enforced; one that is not is a system error, not an audit finding.") },
  NoEvidenceWithoutAttribution: { label: en("No evidence without attribution"), definition: en("Every piece of evidence is attributable to a source; evidence with none is a system error, not an audit finding.") },
  NoAuthorityWithoutScope: { label: en("No authority without scope"), definition: en("Every authority has a scope; authority with none is a system error, not an audit finding.") },
  NoComplianceWithoutTraceability: { label: en("No compliance without traceability"), definition: en("Every claim of compliance is traceable to the requirement, policy, control and evidence behind it; a claim with none is a system error, not an audit finding.") },
});

/** The three pillars of the framework. */
export const pillars = codes(classSchema(oto.Pillar, CODE), OTO, {
  PoliciesAsCode: { label: en("Policies as code"), definition: en("Compliance rules as executable, version-controlled, testable code, not PDF documents.") },
  DataGovernance: { label: en("Data governance"), definition: en("Evidence provenance, chain of custody and machine-attested verification for every data point.") },
  DisciplinedTooling: { label: en("Disciplined tooling"), definition: en("Unified evidence warehouses, edge agents and API-first integrations with existing systems.") },
});

/** The five principles of the framework. */
export const principles = codes(classSchema(oto.Principle, CODE), OTO, {
  QueryableEvidence: { label: en("Queryable evidence"), definition: en("Every compliance claim is backed by machine-readable, SQL-queryable proof.") },
  ContinuousVerification: { label: en("Continuous verification"), definition: en("Real-time validation replaces periodic point-in-time audits.") },
  ObservableState: { label: en("Observable state"), definition: en("Live infrastructure state, not documentation assumptions.") },
  ComplianceAsCode: { label: en("Compliance as code"), definition: en("Policies are expressed in executable, testable formats.") },
  EvidenceSupplyChain: { label: en("Evidence supply chain"), definition: en("Complete provenance from source to audit report.") },
});

/** The schema of a maturity level (`oto:MaturityLevel`): its number, 1 to 4. */
export const MaturityLevelSchema = classSchema(oto.MaturityLevel, { ...CODE, levelNumber: one(oto.levelNumber, range.integer) });

/** The four levels of the maturity model. */
export const maturityLevels = codes(MaturityLevelSchema, OTO, {
  AttestationBased: { label: en("Attestation-based"), definition: en("Traditional compliance relying on human attestations and periodic audits."), levelNumber: 1 },
  PartiallyAutomated: { label: en("Partially automated"), definition: en("Some automation in evidence collection, but still document-centric."), levelNumber: 2 },
  EvidenceFirst: { label: en("Evidence-first"), definition: en("All compliance claims are backed by machine-readable evidence."), levelNumber: 3 },
  AiNativeContinuouslyVerified: { label: en("AI-native and continuously verified"), definition: en("Full operational truth with AI systems grounded in verified evidence."), levelNumber: 4 },
});

/** What Operational Acceptance Testing tests, as four dimensions. */
export const dimensions = codes(classSchema(oto.Dimension, CODE), OTO, {
  StabilityOfOutcomes: { label: en("Stability of outcomes"), definition: en("Whether the system produces results that stay within acceptable boundaries over time.") },
  AcceptableRanges: { label: en("Acceptable ranges of behavior"), definition: en("Whether the behavior stays within the range defined as acceptable, not only correct.") },
  Trustworthiness: { label: en("Trustworthiness"), definition: en("Whether the outputs can be relied on for decisions, with the means to trace how they were produced.") },
  FailureModesAndRecovery: { label: en("Failure modes and recovery"), definition: en("How the system fails and recovers: silently or with an alert, gracefully or not.") },
});

/** The states of an alignment: the site does not give them; they come from the estate library (0003-estate-logical). */
export const alignmentStates = codes(classSchema(oto.AlignmentState, CODE), OTO, {
  Aligned: { label: en("aligned"), definition: en("What is declared and what is observed agree. Not on the source's site: from the estate library.") },
  Drifted: { label: en("drifted"), definition: en("What is declared and what is observed differ. Not on the source's site: from the estate library.") },
  NotObserved: { label: en("not observed"), definition: en("Nothing was observed yet: a waiting item, never a failure and never agreement. Not on the source's site: from the estate library.") },
});

// ---- the classes and the properties

const ALIGNMENT = classSchema(oto.Alignment, {
  label: one(rdfs.label, range.langString),
  intent: one(oto.intent, range.string),
  structure: one(oto.structure, range.string),
  execution: one(oto.execution, range.string),
  evidence: one(oto.evidence, range.string),
  alignmentState: one(oto.alignmentState, range.ref<"oto:AlignmentState">()),
});

/** The schema of an alignment (`oto:Alignment`): the four facets and the state. */
export const Alignment = ALIGNMENT;

/** The classes, each with its label and definition. */
export const classes = [
  OwlClass.make(oto.Domain, { label: en("Domain"), subClassOf: [skos.Concept], definition: en("One of the nine areas of the organization the ontology models, each with its entities.") }),
  OwlClass.make(oto.Invariant, { label: en("Invariant"), subClassOf: [skos.Concept], definition: en("A condition an ontology must satisfy to be trustworthy; its violation is a system error.") }),
  OwlClass.make(oto.Pillar, { label: en("Pillar"), subClassOf: [skos.Concept], definition: en("One of the three foundations of the framework: policies as code, data governance, disciplined tooling.") }),
  OwlClass.make(oto.Principle, { label: en("Principle"), subClassOf: [skos.Concept], definition: en("One of the five principles of the framework.") }),
  OwlClass.make(oto.MaturityLevel, { label: en("Maturity level"), subClassOf: [skos.Concept], definition: en("One of the four levels of the maturity model, numbered 1 to 4.") }),
  OwlClass.make(oto.Dimension, { label: en("Dimension"), subClassOf: [skos.Concept], definition: en("One of the four dimensions of system behavior that Operational Acceptance Testing tests.") }),
  OwlClass.make(oto.AlignmentState, { label: en("Alignment state"), subClassOf: [skos.Concept], definition: en("aligned, drifted or not observed.") }),
  OwlClass.make(oto.Alignment, {
    label: en("Alignment"),
    subClassOf: [prov.Entity],
    definition: en("The measurable alignment between intent, structure, execution and evidence, of one subject: what the source calls Operational Truth."),
  }),
  OwlClass.make(oto.AcceptanceRun, {
    label: en("Acceptance run"),
    subClassOf: [ifqs.TestRun],
    definition: en("A run of Operational Acceptance Testing: a test run that says what was expected, what was observed and which dimension it tested."),
  }),
] as const;

/** The properties, each with its domain, range and definition. */
export const properties = [
  DatatypeProperty.make(oto.domainNumber, { domain: oto.Domain, range: xsd.integer, label: en("domain number"), definition: en("The number of the domain, 1 to 9, as the source gives it.") }),
  DatatypeProperty.make(oto.entity, { domain: oto.Domain, range: xsd.string, label: en("entity"), definition: en("A name of an entity the source lists for the domain.") }),
  DatatypeProperty.make(oto.realizedBy, { domain: oto.Domain, range: xsd.string, label: en("realized by"), definition: en("A library of commons that realizes the domain today; none where none does.") }),
  DatatypeProperty.make(oto.levelNumber, { domain: oto.MaturityLevel, range: xsd.integer, label: en("level number"), definition: en("The number of the level, 1 to 4.") }),
  DatatypeProperty.make(oto.intent, { domain: oto.Alignment, range: xsd.string, label: en("intent"), definition: en("What is declared to be intended: the policy or the declaration.") }),
  DatatypeProperty.make(oto.structure, { domain: oto.Alignment, range: xsd.string, label: en("structure"), definition: en("Who or what is responsible: the roles and owners.") }),
  DatatypeProperty.make(oto.execution, { domain: oto.Alignment, range: xsd.string, label: en("execution"), definition: en("What was done: the change or the run.") }),
  DatatypeProperty.make(oto.evidence, { domain: oto.Alignment, range: xsd.string, label: en("evidence"), definition: en("What proves it: the observation.") }),
  ObjectProperty.make(oto.alignmentState, { domain: oto.Alignment, range: oto.AlignmentState, label: en("alignment state"), definition: en("aligned, drifted or not observed.") }),
  DatatypeProperty.make(oto.expectedOutcome, { domain: oto.AcceptanceRun, range: xsd.string, label: en("expected outcome"), definition: en("What the run expected, stated before it ran.") }),
  DatatypeProperty.make(oto.observedOutcome, { domain: oto.AcceptanceRun, range: xsd.string, label: en("observed outcome"), definition: en("What the run observed.") }),
  ObjectProperty.make(oto.dimension, { domain: oto.AcceptanceRun, range: oto.Dimension, label: en("dimension"), definition: en("The dimension of behavior the run tested.") }),
] as const;

/** The ontology itself: its label, description and version. */
export const otoOntology = OwlOntology.make(ontologyOf(OTO), {
  label: en("OTO"),
  description: en(
    "The Operational Truth Ontology (OTO): the nine domains, six invariants, pillars, principles and maturity levels of Operational Truth(TM), a trademark of Netspective Communications LLC, as published at operationaltruth.org, and what an Operational Acceptance Testing run expects and observes. Built from the published site alone.",
  ),
  versionInfo: "1.0.0",
  versionIri: named<"owl:Ontology">(iriIn(OTOV, "1.0.0")),
});

// ---- the audit: the basis of every class (0018-standards-first FR-003)

/** The record of a class that specializes a standard's class. */
function specializes(local: keyof typeof oto, standardTerm: string, definedBy: string) {
  return OntologyTerm.make(term(MZID, `term-oto-${local}`), {
    label: en(`oto:${local}`),
    termIri: oto[local].iri,
    basis: bases.Specializes,
    standardTerm,
    mappingRelation: "subClassOf",
    definedBy: [definedBy],
  });
}

const SKOS_CONCEPT = skos.Concept.iri;

/** The audit of OTO: one record for every class. */
export const terms = [
  specializes("Domain", SKOS_CONCEPT, "0002-oto FR-002"),
  specializes("Invariant", SKOS_CONCEPT, "0002-oto FR-003"),
  specializes("Pillar", SKOS_CONCEPT, "0002-oto FR-004"),
  specializes("Principle", SKOS_CONCEPT, "0002-oto FR-004"),
  specializes("MaturityLevel", SKOS_CONCEPT, "0002-oto FR-004"),
  specializes("Dimension", SKOS_CONCEPT, "0002-oto FR-006"),
  specializes("AlignmentState", SKOS_CONCEPT, "0002-oto FR-005"),
  specializes("Alignment", prov.Entity.iri, "0002-oto FR-005"),
  specializes("AcceptanceRun", ifqs.TestRun.iri, "0002-oto FR-006"),
] as const;

/** The file this module states: its name, its prefixes and its individuals. */
export const file: OntologyFile = {
  name: "oto",
  prefixes: [IFQS, IFQSV, MZ, MZID, OTO, OTOV, OWL, PROV, RDFS, SKOS, XSD],
  individuals: [
    otoOntology,
    ...classes,
    ...properties,
    ...Object.values(domains),
    ...Object.values(invariants),
    ...Object.values(pillars),
    ...Object.values(principles),
    ...Object.values(maturityLevels),
    ...Object.values(dimensions),
    ...Object.values(alignmentStates),
    ...terms,
  ],
};
