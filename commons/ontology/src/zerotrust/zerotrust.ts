// Spec: 0006-zero-trust-terms FR-001, FR-002, FR-003, FR-004
/**
 * The vocabulary of Zero trust (commons 0047-zero-trust): the architecture, the parts that decide and enforce access, the access decision with the posture signals it used, the protect surface it protects, the places of implicit trust it replaces, and the tenets, pillars
 * and sources of input that the primary sources name.
 *
 * @remarks
 * It stands on PROV-O and SKOS, whose terms the library `rdf` already holds: each class is a `prov:Entity` and each code list is a SKOS concept. NIST, CISA and the Department of Defense publish no machine-readable vocabulary of these terms that was read, so no IRI of
 * theirs is written (the definitions, in our own words, and what was not read, are in commons 0047-zero-trust `definitions.md`). The maturity stages and the activities of the maturity models are classes without members: the names of the stages are in the catalog `catalog-zero-trust`, and the activities are written when their source is read.
 *
 * @limits
 * The properties do not yet carry a basis of their own (the baseline holds them until the schemas require it). The pillars are the five areas and three themes of the federal strategy as it cites the maturity model of the Cybersecurity and Infrastructure Security Agency; the seven pillars of the Department of Defense were not read.
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

/** The namespace of Zero trust's terms. */
export const ZEROTRUST = namespace("zt", "https://www.intellectualfrontiers.com/ontology/zerotrust#");
/** The namespace of the versions of Zero trust's ontology: `owl:versionIRI` names one of them. */
export const ZEROTRUSTV = namespace("ztv", "https://www.intellectualfrontiers.com/ontology/zerotrust/");

/** The terms of Zero trust's vocabulary: its classes and properties. */
export const zt = vocabulary(ZEROTRUST, {
  ZeroTrustArchitecture: "owl:Class",
  PolicyDecisionPoint: "owl:Class",
  PolicyEngine: "owl:Class",
  PolicyAdministrator: "owl:Class",
  PolicyEnforcementPoint: "owl:Class",
  ProtectSurface: "owl:Class",
  AccessDecision: "owl:Class",
  PostureSignal: "owl:Class",
  ImplicitTrust: "owl:Class",
  Activity: "owl:Class",
  MaturityStage: "owl:Class",
  Pillar: "owl:Class",
  Tenet: "owl:Class",
  DataSource: "owl:Class",
  decidedBy: "owl:ObjectProperty",
  enforcedAt: "owl:ObjectProperty",
  onSurface: "owl:ObjectProperty",
  policyHash: "owl:DatatypeProperty",
});

const CODE = { label: one(rdfs.label, range.langString), definition: one(skos.definition, range.langString) } as const;

/** The schema of a tenet (`zt:Tenet`). */
export const TenetSchema = classSchema(zt.Tenet, CODE);

/** The seven tenets of zero trust (0047-zero-trust FR-003), in the order the source gives them. */
export const tenets = codes(TenetSchema, ZEROTRUST, {
  EverythingIsAResource: { label: en("Everything is a resource"), definition: en("Every data source and computing service is a resource, whatever its size, including the devices an organization lets reach its resources.") },
  CommunicationIsSecuredAnywhere: { label: en("Communication is secured anywhere"), definition: en("Every communication is protected for confidentiality, integrity and the authentication of its source, and a network location alone grants no trust.") },
  AccessIsPerSession: { label: en("Access is per session"), definition: en("Access to one resource is granted for one session with the least privilege the task needs, after the requester is evaluated; a grant for one resource carries to no other.") },
  PolicyIsDynamic: { label: en("Policy is dynamic"), definition: en("Access is decided by rules over the observable state of the identity, the application and the requesting asset, and over behavior and the environment, stricter as the resource is more sensitive.") },
  PostureIsMonitored: { label: en("Posture is monitored"), definition: en("The organization measures the integrity and security posture of every asset it owns or is associated with, and trusts no asset for what it is.") },
  EnforcementIsDynamic: { label: en("Authentication and authorization are dynamic and enforced"), definition: en("Authentication and authorization are repeated on the events the policy names and strictly enforced before access, as a constant cycle of access, assessment and adaptation.") },
  StateIsCollected: { label: en("State is collected"), definition: en("The organization collects as much as it can about the state of its assets, network and communications and uses it to improve the policy and its enforcement.") },
});

/** The schema of a pillar (`zt:Pillar`). */
export const PillarSchema = classSchema(zt.Pillar, CODE);

/** The five areas of effort and the three themes across them, as the federal strategy names them from the maturity model of the Cybersecurity and Infrastructure Security Agency (0047-zero-trust FR-004). */
export const pillars = codes(PillarSchema, ZEROTRUST, {
  Identity: { label: en("Identity"), definition: en("Who or what asks for access: enterprise-managed identities, strong authentication that resists phishing, and the identity systems that hold them.") },
  Devices: { label: en("Devices"), definition: en("What the request comes from: the inventory of every device in use, its state, and the ability to prevent, detect and respond to incidents on it.") },
  Networks: { label: en("Networks"), definition: en("How the request travels: encrypted traffic and names, and perimeters broken into isolated environments.") },
  ApplicationsAndWorkloads: { label: en("Applications and workloads"), definition: en("What the request reaches: applications treated as reachable from the internet, tested rigorously and open to outside reports of weaknesses.") },
  Data: { label: en("Data"), definition: en("What is protected: data that is categorized, protected by what its category needs, and whose access is monitored and logged.") },
  VisibilityAndAnalytics: { label: en("Visibility and analytics"), definition: en("A theme across the areas: the collection and analysis of what happens, which feeds the decisions.") },
  AutomationAndOrchestration: { label: en("Automation and orchestration"), definition: en("A theme across the areas: the decisions and responses that machines carry out by policy.") },
  Governance: { label: en("Governance"), definition: en("A theme across the areas: the policies, roles and accountability that decide how the areas are run.") },
});

/** The schema of a source of input (`zt:DataSource`). */
export const DataSourceSchema = classSchema(zt.DataSource, CODE);

/** The eight sources of input to the policy engine that the architecture standard names (0047-zero-trust FR-005). */
export const dataSources = codes(DataSourceSchema, ZEROTRUST, {
  Diagnostics: { label: en("Continuous diagnostics and mitigation"), definition: en("The system that gathers the current state of assets and applies updates to their configuration and software, and so tells the engine what a requesting asset runs and whether it is vulnerable.") },
  ComplianceSystem: { label: en("Compliance system"), definition: en("The system that holds the rules of the regime the organization falls under, so that the policy follows them.") },
  ThreatIntelligence: { label: en("Threat intelligence"), definition: en("Feeds, internal or external, about newly found attacks, weaknesses and malware that the engine weighs.") },
  ActivityLogs: { label: en("Network and system activity logs"), definition: en("The aggregate of asset logs, traffic and access actions that gives near real time feedback on posture.") },
  AccessPolicies: { label: en("Data access policies"), definition: en("The attributes, rules and policies about access to resources, the starting point for authorizing it.") },
  PublicKeyInfrastructure: { label: en("Public key infrastructure"), definition: en("The system that issues and logs the certificates of resources, subjects, services and applications.") },
  IdentityManagement: { label: en("Identity management"), definition: en("The system that creates, stores and manages the accounts and identity records, with the role and attributes of each.") },
  EventManagement: { label: en("Security information and event management"), definition: en("The system that collects security information for analysis, to refine policy and warn of attacks.") },
});

/** The classes, each with its label and definition. */
export const classes = [
  OwlClass.make(zt.ZeroTrustArchitecture, {
    label: en("Zero trust architecture"),
    subClassOf: [prov.Entity],
    definition: en("An organization's plan for deciding every access to a resource on its own, with the least privilege the request needs, in a network seen as compromised: the components, their relations, the workflows and the access policies."),
  }),
  OwlClass.make(zt.PolicyDecisionPoint, { label: en("Policy decision point"), subClassOf: [prov.Entity], definition: en("The part that decides whether a subject may reach a resource: a policy engine that decides and a policy administrator that carries the decision out.") }),
  OwlClass.make(zt.PolicyEngine, { label: en("Policy engine"), subClassOf: [prov.Entity], definition: en("The part of the decision point that grants, denies or revokes access from the policy and the outside inputs, and logs the decision.") }),
  OwlClass.make(zt.PolicyAdministrator, { label: en("Policy administrator"), subClassOf: [prov.Entity], definition: en("The part of the decision point that opens or shuts the path between a subject and a resource on the engine's decision and makes any credential of the session.") }),
  OwlClass.make(zt.PolicyEnforcementPoint, { label: en("Policy enforcement point"), subClassOf: [prov.Entity], definition: en("The part that enables, watches and ends the connection between a subject and a resource on the administrator's instruction.") }),
  OwlClass.make(zt.ProtectSurface, { label: en("Protect surface"), subClassOf: [prov.Entity], definition: en("The smallest part of an estate that one access policy names and protects: an asset, a population or a store of data; it is a boundary of the kind trust, and every path into it needs an access decision.") }),
  OwlClass.make(zt.AccessDecision, { label: en("Access decision"), subClassOf: [prov.Entity], definition: en("The signed record of one decision about one request: the subject, the posture signals of its device, the context, the resource, the policy by hash, the outcome, the reasons and the evidence.") }),
  OwlClass.make(zt.PostureSignal, { label: en("Posture signal"), subClassOf: [prov.Entity], definition: en("A reading about a subject or a device that an access decision used, with its source and its age.") }),
  OwlClass.make(zt.ImplicitTrust, { label: en("Implicit trust"), subClassOf: [prov.Entity], definition: en("A place where access is allowed because of where the request comes from, whose it is or how long ago it was granted, and not because of a decision.") }),
  OwlClass.make(zt.Activity, { label: en("Zero trust activity"), subClassOf: [prov.Entity], definition: en("One thing a maturity model asks an organization to do, in one area, at one stage; the names are written from the model when it is read.") }),
  OwlClass.make(zt.MaturityStage, { label: en("Maturity stage"), subClassOf: [skos.Concept], definition: en("One of the ordered stages a maturity model gives for how far an area has gone; the members are written from the model when it is read.") }),
  OwlClass.make(zt.Pillar, { label: en("Pillar"), subClassOf: [skos.Concept], definition: en("One of the areas of effort of zero trust, or one of the themes across them.") }),
  OwlClass.make(zt.Tenet, { label: en("Tenet"), subClassOf: [skos.Concept], definition: en("One of the basic principles the architecture standard gives for a zero trust architecture.") }),
  OwlClass.make(zt.DataSource, { label: en("Source of input"), subClassOf: [skos.Concept], definition: en("One of the sources that give the policy engine the input and the rules it decides with.") }),
] as const;

/** The properties, each with its domain, range and definition. */
export const properties = [
  ObjectProperty.make(zt.decidedBy, { domain: zt.AccessDecision, range: zt.PolicyDecisionPoint, label: en("decided by"), definition: en("The decision point that made the access decision.") }),
  ObjectProperty.make(zt.enforcedAt, { domain: zt.AccessDecision, range: zt.PolicyEnforcementPoint, label: en("enforced at"), definition: en("The enforcement point that carried out the access decision.") }),
  ObjectProperty.make(zt.onSurface, { domain: zt.AccessDecision, range: zt.ProtectSurface, label: en("on surface"), definition: en("The protect surface the access decision was about.") }),
  DatatypeProperty.make(zt.policyHash, { domain: zt.AccessDecision, range: xsd.string, label: en("policy hash"), definition: en("The hash of the access policy the decision applied, so that the decision can be replayed against the same rules.") }),
] as const;

/** The ontology itself: its label, description and version. */
export const zeroTrustOntology = OwlOntology.make(ontologyOf(ZEROTRUST), {
  label: en("Zero trust"),
  description: en("The vocabulary of Zero trust: the architecture, the points that decide and enforce, the access decision, the protect surface, implicit trust, and the tenets, pillars and sources of input of the primary sources."),
  versionInfo: "1.0.0",
  versionIri: named<"owl:Ontology">(iriIn(ZEROTRUSTV, "1.0.0")),
});

// ---- the audit: the basis of every class (0018-standards-first FR-003)

/** The names of the classes the audit records. */
type ClassName = "ZeroTrustArchitecture" | "PolicyDecisionPoint" | "PolicyEngine" | "PolicyAdministrator" | "PolicyEnforcementPoint" | "ProtectSurface" | "AccessDecision" | "PostureSignal" | "ImplicitTrust" | "Activity" | "MaturityStage" | "Pillar" | "Tenet" | "DataSource";

/** The record of a class that specializes a standard's class. */
function specializes(local: ClassName, standardTerm: string, definedBy: string) {
  return OntologyTerm.make(term(MZID, `term-zerotrust-${local}`), {
    label: en(`zt:${local}`),
    termIri: zt[local].iri,
    basis: bases.Specializes,
    standardTerm,
    mappingRelation: "subClassOf",
    definedBy: [definedBy],
  });
}

/** The audit of Zero trust: one record for every class, each specializing a term of PROV-O or SKOS. */
export const terms = [
  specializes("ZeroTrustArchitecture", prov.Entity.iri, "0047-zero-trust FR-001"),
  specializes("PolicyDecisionPoint", prov.Entity.iri, "0047-zero-trust FR-002"),
  specializes("PolicyEngine", prov.Entity.iri, "0047-zero-trust FR-002"),
  specializes("PolicyAdministrator", prov.Entity.iri, "0047-zero-trust FR-002"),
  specializes("PolicyEnforcementPoint", prov.Entity.iri, "0047-zero-trust FR-002"),
  specializes("ProtectSurface", prov.Entity.iri, "0047-zero-trust FR-030"),
  specializes("AccessDecision", prov.Entity.iri, "0047-zero-trust FR-010"),
  specializes("PostureSignal", prov.Entity.iri, "0047-zero-trust FR-011"),
  specializes("ImplicitTrust", prov.Entity.iri, "0047-zero-trust FR-040"),
  specializes("Activity", prov.Entity.iri, "0047-zero-trust FR-021"),
  specializes("MaturityStage", skos.Concept.iri, "0047-zero-trust FR-022"),
  specializes("Pillar", skos.Concept.iri, "0047-zero-trust FR-004"),
  specializes("Tenet", skos.Concept.iri, "0047-zero-trust FR-003"),
  specializes("DataSource", skos.Concept.iri, "0047-zero-trust FR-005"),
] as const;

/** The file this module states: its name, its prefixes and its individuals. */
export const file: OntologyFile = {
  name: "zerotrust",
  prefixes: [ZEROTRUST, ZEROTRUSTV, MZ, MZID, OWL, PROV, RDFS, SKOS, XSD],
  individuals: [
    zeroTrustOntology,
    ...classes,
    ...properties,
    ...Object.values(tenets),
    ...Object.values(pillars),
    ...Object.values(dataSources),
    ...terms,
  ],
};
