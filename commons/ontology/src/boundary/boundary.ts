// Spec: 0005-boundary-terms FR-001, FR-002, FR-003, FR-004
/**
 * The vocabulary of Boundaries (commons 0045-boundaries): a boundary, the accountability scope of one kind that a regime defines; the kinds of boundary; the disposition of an asset in a boundary; the interconnections that cross a boundary;
 * the external systems and the inheritance a boundary relies on; and the categories, roles and data classes the regimes name. A boundary is never a realm: a realm is where assets are found (commons 0044-asset-connections).
 *
 * @remarks
 * It stands on PROV-O and SKOS, whose terms the library `rdf` already holds: a boundary is a `prov:Entity` and each code list is a SKOS concept. The regimes (FISMA, CMMC, HIPAA, PCI DSS, SOC 2, the privacy laws) publish
 * no machine-readable vocabulary of these terms that was read, so no IRI of theirs is written (the definitions, in our own words, and what was not read, are in commons 0045-boundaries `definitions.md`); the audit of this
 * ontology records each class as specializing a term of PROV-O or SKOS, and none is `unaligned`, so none needs a Decision of the owner.
 *
 * @limits
 * The properties do not yet carry a basis of their own (the baseline holds them until the schemas require it). A mapping of the privacy roles to the Data Privacy Vocabulary is not written, because its IRIs were not read.
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

/** The namespace of Boundaries' terms. */
export const BOUNDARY = namespace("bnd", "https://www.intellectualfrontiers.com/ontology/boundary#");
/** The namespace of the versions of Boundaries' ontology: `owl:versionIRI` names one of them. */
export const BOUNDARYV = namespace("bndv", "https://www.intellectualfrontiers.com/ontology/boundary/");

/** The terms of Boundaries' vocabulary: its classes and properties. */
export const bnd = vocabulary(BOUNDARY, {
  Boundary: "owl:Class",
  Realm: "owl:Class",
  Enclave: "owl:Class",
  Interconnection: "owl:Class",
  ExternalSystem: "owl:Class",
  Inheritance: "owl:Class",
  ProcessingActivity: "owl:Class",
  Categorization: "owl:Class",
  Jurisdiction: "owl:Class",
  BoundaryKind: "owl:Class",
  Disposition: "owl:Class",
  Impact: "owl:Class",
  CmmcAssetCategory: "owl:Class",
  PartyRole: "owl:Class",
  DataClass: "owl:Class",
  boundaryId: "owl:DatatypeProperty",
  boundaryKind: "owl:ObjectProperty",
  categorizedAs: "owl:ObjectProperty",
  residentIn: "owl:ObjectProperty",
});

const CODE = { label: one(rdfs.label, range.langString), definition: one(skos.definition, range.langString) } as const;

/** The schema of a kind of boundary (`bnd:BoundaryKind`). */
export const BoundaryKindSchema = classSchema(bnd.BoundaryKind, CODE);

/** The kinds of boundary (0045-boundaries FR-002): each an accountability scope that a regime defines, with the people and the rules that regime names. */
export const boundaryKinds = codes(BoundaryKindSchema, BOUNDARY, {
  AuthorizationBoundary: { label: en("Authorization boundary"), definition: en("All the components of an information system that one authorizing official authorizes to operate; separately authorized systems it is connected to are outside it.") },
  CuiEnvironment: { label: en("CUI environment"), definition: en("The assessment scope of an organization that handles controlled unclassified information: the assets that process, store or transmit it, the ones that protect them and the ones the organization's own practice keeps from it.") },
  EphiEnvironment: { label: en("ePHI environment"), definition: en("The systems, people and services through which a covered entity or a business associate creates, receives, maintains or transmits electronic protected health information.") },
  CardholderDataEnvironment: { label: en("Cardholder data environment"), definition: en("The system components, people and processes that store, process or transmit cardholder data or sensitive authentication data, and the components that are connected to them without restriction.") },
  Soc2System: { label: en("SOC 2 system"), definition: en("The system a service organization's report describes: its services, components, controls and the boundaries of what the description covers, with its subservice organizations.") },
  Privacy: { label: en("Privacy boundary"), definition: en("The personal data and the processing activities that one controller or business answers for under one privacy regime.") },
  Organizational: { label: en("Organizational boundary"), definition: en("What one company, legal entity, tenant or client of a provider of managed services owns or answers for, or a part of it.") },
  NetworkZone: { label: en("Network zone"), definition: en("A set of resources inside one common perimeter, joined to other zones only through managed interfaces: an enclave, a segment or a zone.") },
  Trust: { label: en("Trust boundary"), definition: en("A line of a threat model across which data or control passes between parts that are trusted differently.") },
  EngagementScope: { label: en("Engagement scope"), definition: en("The targets, actions and window that a signed engagement allows, and the targets that are off limits.") },
});

/** The schema of a disposition (`bnd:Disposition`). */
export const DispositionSchema = classSchema(bnd.Disposition, CODE);

/** The dispositions of an asset in a boundary (0045-boundaries FR-023): the decision about one asset in one boundary. */
export const dispositions = codes(DispositionSchema, BOUNDARY, {
  InScope: { label: en("In scope"), definition: en("The asset is inside the boundary in a role the kind of the boundary names.") },
  Inherited: { label: en("Inherited"), definition: en("The asset's requirements are met by what another party provides, under an inheritance that names the controls.") },
  External: { label: en("External"), definition: en("The asset stands for a system outside the fleet that the boundary relies on or exchanges information with.") },
  OutOfScope: { label: en("Out of scope"), definition: en("The asset is outside the boundary by a person's decision, with a justification, evidence and an expiry.") },
  Undecided: { label: en("Undecided"), definition: en("No one has decided; every asset has this disposition in a boundary until a person decides, and it is a finding.") },
});

/** The schema of an impact (`bnd:Impact`). */
export const ImpactSchema = classSchema(bnd.Impact, CODE);

/** The impacts of a security objective (FIPS 199), ordered from low to high (0045-boundaries FR-006). */
export const impacts = codes(ImpactSchema, BOUNDARY, {
  Low: { label: en("Low"), definition: en("The loss of the objective would have a limited adverse effect on operations, assets or people.") },
  Moderate: { label: en("Moderate"), definition: en("The loss of the objective would have a serious adverse effect on operations, assets or people.") },
  High: { label: en("High"), definition: en("The loss of the objective would have a severe or catastrophic adverse effect on operations, assets or people.") },
});

/** The schema of a category of asset of the CMMC rule (`bnd:CmmcAssetCategory`). */
export const CmmcAssetCategorySchema = classSchema(bnd.CmmcAssetCategory, CODE);

/** The categories of asset of the Level 2 assessment scope (0045-boundaries FR-024): four in scope and one out of scope. */
export const cmmcAssetCategories = codes(CmmcAssetCategorySchema, BOUNDARY, {
  CuiAsset: { label: en("CUI asset"), definition: en("An asset that processes, stores or transmits controlled unclassified information.") },
  SecurityProtectionAsset: { label: en("Security protection asset"), definition: en("An asset that provides security functions or capabilities to the assessment scope.") },
  ContractorRiskManagedAsset: { label: en("Contractor risk managed asset"), definition: en("An asset that can, but is not meant to, handle controlled unclassified information because of the organization's policy, procedures and practice.") },
  SpecializedAsset: { label: en("Specialized asset"), definition: en("An asset that can handle controlled unclassified information but cannot be fully secured: an internet-of-things or operational technology device, government furnished equipment, a restricted system or test equipment.") },
  OutOfScopeAsset: { label: en("Out-of-scope asset"), definition: en("An asset that cannot handle controlled unclassified information and does not protect the assets that do; the organization is prepared to justify that.") },
});

/** The schema of a role of a party in the processing of personal data (`bnd:PartyRole`). */
export const PartyRoleSchema = classSchema(bnd.PartyRole, CODE);

/** The roles that the privacy regimes name in their own words (0045-boundaries FR-003): the one that decides and the one that processes for it. */
export const partyRoles = codes(PartyRoleSchema, BOUNDARY, {
  Controller: { label: en("Controller"), definition: en("The party that decides the purposes and means of processing personal data, alone or with others; a business, a Data Fiduciary or an organization in the words of other regimes.") },
  Processor: { label: en("Processor"), definition: en("The party that processes personal data on behalf of a controller; a service provider, a contractor, an operador, a data intermediary or a Data Processor in the words of other regimes.") },
});

/** The schema of a class of data (`bnd:DataClass`). */
export const DataClassSchema = classSchema(bnd.DataClass, CODE);

/** The classes of data a boundary holds (0045-boundaries FR-007). */
export const dataClasses = codes(DataClassSchema, BOUNDARY, {
  Fci: { label: en("Federal contract information"), definition: en("Information provided by or generated for the Government under a contract that is not meant for public release.") },
  Cui: { label: en("Controlled unclassified information"), definition: en("Information the Government creates or holds, or an entity holds for it, that a law, regulation or Government-wide policy says is handled with safeguarding or dissemination controls.") },
  Phi: { label: en("Protected health information"), definition: en("Individually identifiable health information, in any form or medium, with the exclusions the rule lists.") },
  Ephi: { label: en("Electronic protected health information"), definition: en("The part of protected health information that is transmitted or maintained in electronic media.") },
  PersonalData: { label: en("Personal data"), definition: en("Information about an identified or identifiable natural person, in the words of the privacy regime that governs it.") },
  SpecialCategoryData: { label: en("Special category data"), definition: en("Personal data of the kinds a regime sets apart for stronger protection, such as health, biometric or beliefs.") },
  CardholderData: { label: en("Cardholder data"), definition: en("The data of a payment card that the card brands' standard requires to be protected.") },
  SensitiveAuthenticationData: { label: en("Sensitive authentication data"), definition: en("The data used to authenticate a cardholder or authorize a card transaction, which must not be kept after authorization.") },
  SecurityProtectionData: { label: en("Security protection data"), definition: en("Data about the protections of an environment: its configuration, logs and credentials.") },
  Confidential: { label: en("Confidential"), definition: en("Information whose disclosure the organization restricts to those who need it.") },
  Internal: { label: en("Internal"), definition: en("Information for the organization's own use that carries no further restriction.") },
  Public: { label: en("Public"), definition: en("Information that may be disclosed without restriction.") },
});

/** The classes, each with its label and definition. */
export const classes = [
  OwlClass.make(bnd.Boundary, {
    label: en("Boundary"),
    subClassOf: [prov.Entity],
    definition: en("The line a body of authority draws around the things it answers for, of a kind that a regime defines: typed, versioned and approved by a person. It is not a realm, which is where assets are found."),
  }),
  OwlClass.make(bnd.Realm, { label: en("Realm"), subClassOf: [prov.Entity], definition: en("Where assets are found and what a connection may read: an account, a tenant, a cluster, a site or a LAN. It says nothing about who answers for the assets.") }),
  OwlClass.make(bnd.Enclave, { label: en("Enclave"), subClassOf: [bnd.Boundary, prov.Entity], definition: en("A set of resources that work in one security domain and share the protection of one common, continuous perimeter; a network zone with a single policy and authority.") }),
  OwlClass.make(bnd.Interconnection, { label: en("Interconnection"), subClassOf: [prov.Entity], definition: en("An approved, agreed and reviewed crossing of a boundary: its two ends, the direction, the data classes, the agreement and the managed interface.") }),
  OwlClass.make(bnd.ExternalSystem, { label: en("External system"), subClassOf: [prov.Entity], definition: en("A system outside the fleet that a boundary relies on or exchanges information with, with what its party holds to show it may be relied on.") }),
  OwlClass.make(bnd.Inheritance, { label: en("Inheritance"), subClassOf: [prov.Entity], definition: en("What a provider's authorization, report or certificate supplies to a boundary: the controls it covers, who answers for each and the evidence with its dates.") }),
  OwlClass.make(bnd.ProcessingActivity, { label: en("Processing activity"), subClassOf: [prov.Entity], definition: en("A purpose of processing personal data with its legal basis, the people and data it concerns, the systems, the recipients, the transfers and the retention.") }),
  OwlClass.make(bnd.Categorization, { label: en("Categorization"), subClassOf: [prov.Entity], definition: en("The impact of each of the three security objectives (confidentiality, integrity, availability) of a boundary, as the highest impact among the information types it holds.") }),
  OwlClass.make(bnd.Jurisdiction, { label: en("Jurisdiction"), subClassOf: [prov.Entity], definition: en("A country or region whose law governs the data held there; the location of data decides which laws apply to it and what a transfer out of it needs.") }),
  OwlClass.make(bnd.BoundaryKind, { label: en("Boundary kind"), subClassOf: [skos.Concept], definition: en("One of the kinds of boundary: the authority, the roles of people, the roles of assets and the agreements a regime defines.") }),
  OwlClass.make(bnd.Disposition, { label: en("Disposition"), subClassOf: [skos.Concept], definition: en("One of the decisions about an asset in a boundary: in scope in a role, inherited, external, out of scope or undecided.") }),
  OwlClass.make(bnd.Impact, { label: en("Impact"), subClassOf: [skos.Concept], definition: en("One of the ordered levels of potential harm from the loss of a security objective: low, moderate or high.") }),
  OwlClass.make(bnd.CmmcAssetCategory, { label: en("CMMC asset category"), subClassOf: [skos.Concept], definition: en("One of the categories into which the assets of a CUI environment fall for assessment.") }),
  OwlClass.make(bnd.PartyRole, { label: en("Party role"), subClassOf: [skos.Concept], definition: en("One of the two roles that privacy regimes give the parties to the processing of personal data: the one that decides and the one that processes for it.") }),
  OwlClass.make(bnd.DataClass, { label: en("Data class"), subClassOf: [skos.Concept], definition: en("One of the classes of data that a boundary holds and that a regime defines.") }),
] as const;

/** The properties, each with its domain, range and definition. */
export const properties = [
  DatatypeProperty.make(bnd.boundaryId, { domain: bnd.Boundary, range: xsd.string, label: en("boundary id"), definition: en("The id of the boundary: lower case words joined by hyphens.") }),
  ObjectProperty.make(bnd.boundaryKind, { domain: bnd.Boundary, range: bnd.BoundaryKind, label: en("boundary kind"), definition: en("The kind of the boundary, which decides its authority, roles and agreements.") }),
  ObjectProperty.make(bnd.categorizedAs, { domain: bnd.Boundary, range: bnd.Categorization, label: en("categorized as"), definition: en("The categorization of the boundary: the impact of each security objective.") }),
  ObjectProperty.make(bnd.residentIn, { domain: bnd.Boundary, range: bnd.Jurisdiction, label: en("resident in"), definition: en("The jurisdiction in which the data of the boundary is held; the data residency the boundary is constrained to.") }),
] as const;

/** The ontology itself: its label, description and version. */
export const boundaryOntology = OwlOntology.make(ontologyOf(BOUNDARY), {
  label: en("Boundary"),
  description: en("The vocabulary of Boundaries: a boundary as the accountability scope of a kind that a regime defines, the dispositions of assets in it, the interconnections that cross it and what it inherits."),
  versionInfo: "1.0.0",
  versionIri: named<"owl:Ontology">(iriIn(BOUNDARYV, "1.0.0")),
});

// ---- the audit: the basis of every class (0018-standards-first FR-003)

/** The names of the classes the audit records. */
type ClassName = "Boundary" | "Realm" | "Enclave" | "Interconnection" | "ExternalSystem" | "Inheritance" | "ProcessingActivity" | "Categorization" | "Jurisdiction" | "BoundaryKind" | "Disposition" | "Impact" | "CmmcAssetCategory" | "PartyRole" | "DataClass";

/** The record of a class that specializes a standard's class. */
function specializes(local: ClassName, standardTerm: string, definedBy: string) {
  return OntologyTerm.make(term(MZID, `term-boundary-${local}`), {
    label: en(`bnd:${local}`),
    termIri: bnd[local].iri,
    basis: bases.Specializes,
    standardTerm,
    mappingRelation: "subClassOf",
    definedBy: [definedBy],
  });
}

/** The audit of Boundaries: one record for every class, each specializing a term of PROV-O or SKOS. */
export const terms = [
  specializes("Boundary", prov.Entity.iri, "0045-boundaries FR-001"),
  specializes("Realm", prov.Entity.iri, "0044-asset-connections FR-003"),
  specializes("Enclave", prov.Entity.iri, "0045-boundaries FR-002"),
  specializes("Interconnection", prov.Entity.iri, "0045-boundaries FR-040"),
  specializes("ExternalSystem", prov.Entity.iri, "0045-boundaries FR-031"),
  specializes("Inheritance", prov.Entity.iri, "0045-boundaries FR-050"),
  specializes("ProcessingActivity", prov.Entity.iri, "0045-boundaries FR-032"),
  specializes("Categorization", prov.Entity.iri, "0045-boundaries FR-006"),
  specializes("Jurisdiction", prov.Entity.iri, "0045-boundaries FR-047"),
  specializes("BoundaryKind", skos.Concept.iri, "0045-boundaries FR-002"),
  specializes("Disposition", skos.Concept.iri, "0045-boundaries FR-023"),
  specializes("Impact", skos.Concept.iri, "0045-boundaries FR-006"),
  specializes("CmmcAssetCategory", skos.Concept.iri, "0045-boundaries FR-024"),
  specializes("PartyRole", skos.Concept.iri, "0045-boundaries FR-003"),
  specializes("DataClass", skos.Concept.iri, "0045-boundaries FR-007"),
] as const;

/** The file this module states: its name, its prefixes and its individuals. */
export const file: OntologyFile = {
  name: "boundary",
  prefixes: [BOUNDARY, BOUNDARYV, MZ, MZID, OWL, PROV, RDFS, SKOS, XSD],
  individuals: [
    boundaryOntology,
    ...classes,
    ...properties,
    ...Object.values(boundaryKinds),
    ...Object.values(dispositions),
    ...Object.values(impacts),
    ...Object.values(cmmcAssetCategories),
    ...Object.values(partyRoles),
    ...Object.values(dataClasses),
    ...terms,
  ],
};
