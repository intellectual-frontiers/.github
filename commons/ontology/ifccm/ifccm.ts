/**
 * The vocabulary of Intellectual Frontiers Capabilities Configuration Management (IFCCM; commons 0020-ifccm): the capability as the unit of change, the change request
 * and its kinds, the change, the configuration item and the baseline, a harness's declaration of its regulated domains and of the day it declares production, the stages of
 * the trace chain, the four functions of authority and the Git hosts the check reads through one interface.
 *
 * @remarks
 * It stands on PROV-O (a change is a `prov:Activity`, a configuration item a `prov:Entity`, a baseline a `prov:Collection`) and OSLC Change Management (a change request
 * specializes `oslc_cm:ChangeRequest`), and on Mizan's own `mz:Rung`, `mz:Decision` and `mz:Authority`, which it refers to and does not copy. Every class (and every
 * code list's class) has an `mz:OntologyTerm` individual saying its basis (0018-standards-first FR-003): the audit of this ontology. The abbreviation "CCM" is never used
 * alone: it is also the Cloud Security Alliance's Cloud Controls Matrix.
 *
 * @limits
 * The properties do not yet carry a basis of their own (the baseline holds them until the schemas require it). The crosswalk to ISO 13485, ISO 9001, IEC 62304, the FDA's
 * QMSR and SOC 2 is in the specification as mapping statements, and is not a term here. No standard's own IRI for a clause exists, and none is invented.
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
  optional,
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
} from "../../ts/kernel/rdf.ts";
import { bases, cfr11, cfr820, KEPT_UNALIGNED_SENTENCE, keptUnalignedDecision, keptUnalignedDecisionId, MZ, MZID, mz, OntologyTerm } from "../mizan/mizan.ts";

/** The namespace of IFCCM's terms. */
export const IFCCM = namespace("ifccm", "https://www.intellectualfrontiers.com/ontology/ifccm#");
/** The namespace of the versions of IFCCM's ontology: `owl:versionIRI` names one of them. */
export const IFCCMV = namespace("ifccmv", "https://www.intellectualfrontiers.com/ontology/ifccm/");
/** The namespace of OSLC Change Management (`oslc_cm:`), whose `ChangeRequest` a change request specializes. */
export const OSLC_CM = namespace("oslc_cm", "http://open-services.net/ns/cm#");
/** The terms of OSLC Change Management that this ontology refers to. */
export const oslcCm = vocabulary(OSLC_CM, { ChangeRequest: "rdfs:Class" });
/** The terms of PROV-O that this ontology specializes and the kernel's `prov` does not hold. */
export const provMore = vocabulary(PROV, { Collection: "rdfs:Class" });

/** The terms of IFCCM's vocabulary: its classes and properties. */
export const ifccm = vocabulary(IFCCM, {
  Capability: "owl:Class",
  ChangeRequest: "owl:Class",
  ChangeRequestKind: "owl:Class",
  ChangeRequestState: "owl:Class",
  Change: "owl:Class",
  IssueReferenceKind: "owl:Class",
  ConfigurationItem: "owl:Class",
  Baseline: "owl:Class",
  RegulatedDomain: "owl:Class",
  HarnessDeclaration: "owl:Class",
  EnforcementPhase: "owl:Class",
  TraceStage: "owl:Class",
  AuthorityFunction: "owl:Class",
  GitManagerKind: "owl:Class",
  GitCapability: "owl:Class",
  supports: "owl:ObjectProperty",
  area: "owl:DatatypeProperty",
  parentRequest: "owl:ObjectProperty",
  touchesRung: "owl:ObjectProperty",
  requirement: "owl:DatatypeProperty",
  satisfiesControl: "owl:DatatypeProperty",
  reference: "owl:DatatypeProperty",
  requestKind: "owl:ObjectProperty",
  requestState: "owl:ObjectProperty",
  hostedOn: "owl:ObjectProperty",
  subRequestOf: "owl:ObjectProperty",
  requestsCapability: "owl:ObjectProperty",
  why: "owl:DatatypeProperty",
  today: "owl:DatatypeProperty",
  scope: "owl:DatatypeProperty",
  doneWhen: "owl:DatatypeProperty",
  checkItem: "owl:DatatypeProperty",
  revision: "owl:DatatypeProperty",
  implementsRequest: "owl:ObjectProperty",
  referenceKind: "owl:ObjectProperty",
  changesItem: "owl:ObjectProperty",
  authorizedBy: "owl:ObjectProperty",
  approvedBy: "owl:DatatypeProperty",
  itemPath: "owl:DatatypeProperty",
  includesItem: "owl:ObjectProperty",
  baselineRevision: "owl:DatatypeProperty",
  establishedBy: "owl:ObjectProperty",
  harness: "owl:DatatypeProperty",
  regulatedDomain: "owl:ObjectProperty",
  regulatedBy: "owl:ObjectProperty",
  productionDeclaredOn: "owl:DatatypeProperty",
  stageNumber: "owl:DatatypeProperty",
  anchor: "owl:DatatypeProperty",
  instrument: "owl:DatatypeProperty",
});

// ---- the code lists

const CODE = { label: one(rdfs.label, range.langString), definition: optional(skos.definition, range.langString) } as const;

/** The kinds of a change request (0020-ifccm FR-021): the key of each is a union the check branches on. */
export const changeRequestKinds = codes(classSchema(ifccm.ChangeRequestKind, CODE), IFCCM, {
  CapabilityRequest: { label: en("capability request"), definition: en("A request to add or change a capability.") },
  Problem: {
    label: en("problem"),
    definition: en("A report that something departs from what is specified or required, opened by a person or by the system from a nonconformance."),
  },
});

/** The states of a change request as a Git host keeps them (0020-ifccm FR-021). */
export const changeRequestStates = codes(classSchema(ifccm.ChangeRequestState, CODE), IFCCM, {
  Open: { label: en("open"), definition: en("The change request is not finished: a commit may name it with Refs.") },
  Closed: { label: en("closed"), definition: en("The change request is finished: the commit that Closes it has been made.") },
});

/** The two ways a commit names a change request (0020-ifccm FR-005). */
export const issueReferenceKinds = codes(classSchema(ifccm.IssueReferenceKind, CODE), IFCCM, {
  Refs: { label: en("Refs"), definition: en("The commit is work toward the change request, which stays open.") },
  Closes: { label: en("Closes"), definition: en("The commit finishes the change request, and is the only one that closes it.") },
});

/** The phases of enforcement (0020-ifccm FR-011): a warning before a harness declares production, a gate from the day it does. */
export const enforcementPhases = codes(classSchema(ifccm.EnforcementPhase, CODE), IFCCM, {
  Warn: { label: en("warn"), definition: en("A finding is a warning held by a baseline that only shrinks.") },
  Gate: { label: en("gate"), definition: en("A finding fails whatever the baseline holds.") },
});

/** The schema of a regulated domain a harness may claim (`ifccm:RegulatedDomain`), with the law it rests on where it is law. */
export const RegulatedDomain = classSchema(ifccm.RegulatedDomain, {
  ...CODE,
  regulatedBy: many(ifccm.regulatedBy, range.ref<"mz:Authority">()),
});

/** The regulated domains a harness may claim (0020-ifccm FR-010), the first domains of 0018-standards-first FR-010 and IEC 62304. */
export const regulatedDomains = codes(RegulatedDomain, IFCCM, {
  FederalSecurity: {
    label: en("federal security"),
    definition: en("The security controls of NIST SP 800-53 and the FedRAMP baselines."),
    regulatedBy: [],
  },
  DeviceQuality: {
    label: en("device quality"),
    definition: en("The quality management system of a medical-device manufacturer: 21 CFR Part 820, which incorporates ISO 13485:2016 by reference."),
    regulatedBy: [cfr820],
  },
  ElectronicRecords: {
    label: en("electronic records"),
    definition: en("Electronic records and electronic signatures: 21 CFR Part 11."),
    regulatedBy: [cfr11],
  },
  DeviceSoftware: {
    label: en("device software"),
    definition: en("The software life cycle of a medical device: IEC 62304."),
    regulatedBy: [],
  },
  TrustServices: {
    label: en("trust services"),
    definition: en("The security, availability and confidentiality of a service, assessed against SOC 2's Trust Services Criteria or ISO/IEC 27001."),
    regulatedBy: [],
  },
});

/** The schema of a stage of the trace chain (`ifccm:TraceStage`). */
export const TraceStage = classSchema(ifccm.TraceStage, {
  ...CODE,
  stageNumber: one(ifccm.stageNumber, range.integer),
  anchor: one(ifccm.anchor, range.string),
});

/** The stages of the chain from an issue to a quality run, in order (0020-ifccm FR-014); the anchor of each is the annotation that already links it. */
export const traceStages = codes(TraceStage, IFCCM, {
  StageIssue: {
    label: en("change request"),
    definition: en("The issue that plans the change."),
    stageNumber: 1,
    anchor: "Refs #N, Closes #N",
  },
  StageRequirement: {
    label: en("requirement"),
    definition: en("A numbered requirement of a specification that the change adds or changes."),
    stageNumber: 2,
    anchor: "Done when: NNNN-slug FR-nnn",
  },
  StageTerm: {
    label: en("ontology term"),
    definition: en("The term of the ontology that defines what the requirement names."),
    stageNumber: 3,
    anchor: "mz:definedBy",
  },
  StageCode: {
    label: en("code"),
    definition: en("A source file that cites the requirement."),
    stageNumber: 4,
    anchor: "// Spec: NNNN-slug FR-nnn",
  },
  StageTest: {
    label: en("test"),
    definition: en("A test that proves the requirement."),
    stageNumber: 5,
    anchor: "proves([...])",
  },
  StageRun: {
    label: en("quality run"),
    definition: en("A run of the quality system whose record shows the test passed at a revision."),
    stageNumber: 6,
    anchor: "the evidence file of the run",
  },
});

/** The schema of a function of authority (`ifccm:AuthorityFunction`). */
export const AuthorityFunction = classSchema(ifccm.AuthorityFunction, { ...CODE, instrument: one(ifccm.instrument, range.string) });

/** The four functions of authority, kept apart (0020-ifccm FR-018): a specification binds, a Decision authorizes, a check verifies, an issue only plans and traces. */
export const authorityFunctions = codes(AuthorityFunction, IFCCM, {
  Binds: { label: en("binds"), definition: en("What must be."), instrument: "specification" },
  Authorizes: {
    label: en("authorizes"),
    definition: en("A departure, a waiver, an exception, a baseline or a release, with the role that approved it."),
    instrument: "Decision",
  },
  Verifies: { label: en("verifies"), definition: en("Whether what is, is what must be."), instrument: "check" },
  Plans: { label: en("plans and traces"), definition: en("What is to be done, and where it can be followed; it authorizes nothing."), instrument: "issue" },
});

// ---- the class schemas the data is made with

/** The schema of a capability (`ifccm:Capability`). */
export const Capability = classSchema(ifccm.Capability, {
  label: one(rdfs.label, range.langString),
  area: one(ifccm.area, range.string),
  parentRequest: optional(ifccm.parentRequest, range.ref<"ifccm:ChangeRequest">()),
  touchesRung: many(ifccm.touchesRung, range.ref<"mz:Rung">()),
  requirement: many(ifccm.requirement, range.string),
  satisfiesControl: many(ifccm.satisfiesControl, range.string),
});

/** What a Git host may offer through the one interface (0020-ifccm FR-027 to FR-030): the common capabilities and the ones a host may lack. */
export const gitCapabilities = codes(classSchema(ifccm.GitCapability, CODE), IFCCM, {
  CloneUrl: { label: en("clone URL"), definition: en("The URL a repository is cloned from, for a path of the workspace and the reverse.") },
  Credentials: {
    label: en("credentials"),
    definition: en("Authentication through a Git credential helper, the host's command-line tool or a token from the environment, never a secret stored in a file."),
  },
  DefaultBranch: { label: en("default branch"), definition: en("The name of the branch the remote presents as its default.") },
  SignedCommits: { label: en("signed commits"), definition: en("Whether a commit's signature, OpenPGP or SSH, can be seen as verified.") },
  ProtectedBranches: { label: en("protected branches"), definition: en("Whether a branch can be asked about as protected: no push, no force, review required.") },
  Issues: { label: en("issues"), definition: en("Issues of the repository, behind the interface.") },
  ChangeRequests: { label: en("change requests"), definition: en("A pull request (GitHub) or a merge request (GitLab), behind the interface.") },
  NestedGroups: { label: en("nested groups"), definition: en("Groups to any depth between the host and the repository (GitLab); a host without them has one owner level.") },
});

/** The kinds of Git host, and what each supports (0020-ifccm FR-027 to FR-030): a capability a kind does not list is unsupported. */
export const gitManagerKinds = codes(classSchema(ifccm.GitManagerKind, { ...CODE, supports: many(ifccm.supports, range.ref<"ifccm:GitCapability">()) }), IFCCM, {
  Github: {
    label: en("GitHub"),
    definition: en("GitHub, public and private repositories: an owner and a repository."),
    supports: [
      gitCapabilities.CloneUrl,
      gitCapabilities.Credentials,
      gitCapabilities.DefaultBranch,
      gitCapabilities.SignedCommits,
      gitCapabilities.ProtectedBranches,
      gitCapabilities.Issues,
      gitCapabilities.ChangeRequests,
    ],
  },
  Gitlab: {
    label: en("GitLab"),
    definition: en("GitLab, public and private repositories, in groups to any depth."),
    supports: [
      gitCapabilities.CloneUrl,
      gitCapabilities.Credentials,
      gitCapabilities.DefaultBranch,
      gitCapabilities.SignedCommits,
      gitCapabilities.ProtectedBranches,
      gitCapabilities.Issues,
      gitCapabilities.ChangeRequests,
      gitCapabilities.NestedGroups,
    ],
  },
  Git: {
    label: en("plain Git"),
    definition: en("Any other Git remote: what Git itself offers and nothing a host adds."),
    supports: [gitCapabilities.CloneUrl, gitCapabilities.Credentials, gitCapabilities.DefaultBranch, gitCapabilities.SignedCommits],
  },
});

/** The schema of a change request (`ifccm:ChangeRequest`): an issue, in the words of the section headings of a capability's issue. */
export const ChangeRequest = classSchema(ifccm.ChangeRequest, {
  label: one(rdfs.label, range.langString),
  reference: one(ifccm.reference, range.string),
  requestKind: one(ifccm.requestKind, range.ref<"ifccm:ChangeRequestKind">()),
  requestState: one(ifccm.requestState, range.ref<"ifccm:ChangeRequestState">()),
  hostedOn: one(ifccm.hostedOn, range.ref<"ifccm:GitManagerKind">()),
  subRequestOf: optional(ifccm.subRequestOf, range.ref<"ifccm:ChangeRequest">()),
  requestsCapability: optional(ifccm.requestsCapability, range.ref<"ifccm:Capability">()),
  why: optional(ifccm.why, range.string),
  today: optional(ifccm.today, range.string),
  scope: optional(ifccm.scope, range.string),
  doneWhen: optional(ifccm.doneWhen, range.string),
  checkItem: many(ifccm.checkItem, range.string),
});

/** The schema of a change (`ifccm:Change`): the work done under change requests. */
export const Change = classSchema(ifccm.Change, {
  label: one(rdfs.label, range.langString),
  revision: many(ifccm.revision, range.string),
  implementsRequest: many(ifccm.implementsRequest, range.ref<"ifccm:ChangeRequest">()),
  referenceKind: optional(ifccm.referenceKind, range.ref<"ifccm:IssueReferenceKind">()),
  changesItem: many(ifccm.changesItem, range.ref<"ifccm:ConfigurationItem">()),
  authorizedBy: optional(ifccm.authorizedBy, range.ref<"mz:Decision">()),
  approvedBy: optional(ifccm.approvedBy, range.string),
});

/** The schema of a configuration item (`ifccm:ConfigurationItem`). */
export const ConfigurationItem = classSchema(ifccm.ConfigurationItem, {
  label: one(rdfs.label, range.langString),
  itemPath: one(ifccm.itemPath, range.string),
});

/** The schema of a baseline (`ifccm:Baseline`). */
export const Baseline = classSchema(ifccm.Baseline, {
  label: one(rdfs.label, range.langString),
  baselineRevision: one(ifccm.baselineRevision, range.string),
  includesItem: many(ifccm.includesItem, range.ref<"ifccm:ConfigurationItem">()),
  establishedBy: optional(ifccm.establishedBy, range.ref<"mz:Decision">()),
});

/** The schema of a harness's declaration (`ifccm:HarnessDeclaration`): its regulated domains and the day it declares production (0020-ifccm FR-010). */
export const HarnessDeclaration = classSchema(ifccm.HarnessDeclaration, {
  label: one(rdfs.label, range.langString),
  harness: one(ifccm.harness, range.string),
  regulatedDomain: many(ifccm.regulatedDomain, range.ref<"ifccm:RegulatedDomain">()),
  productionDeclaredOn: optional(ifccm.productionDeclaredOn, range.string),
});

// ---- the classes and the properties, each with its label and definition

/** The classes, each with its label and definition. */
export const classes = [
  OwlClass.make(ifccm.Capability, {
    label: en("Capability"),
    definition: en("The unit of change: one ability of a harness that can be named, specified, built, proved and released. Never a feature, an epic or a product."),
  }),
  OwlClass.make(ifccm.ChangeRequest, {
    label: en("Change request"),
    subClassOf: [oslcCm.ChangeRequest],
    definition: en("An issue on a Git host that plans a capability or reports a problem; it plans and traces and authorizes nothing."),
  }),
  OwlClass.make(ifccm.GitManagerKind, { label: en("Git manager kind"), definition: en("GitHub, GitLab or plain Git, with the capabilities each supports.") }),
  OwlClass.make(ifccm.GitCapability, { label: en("Git capability"), definition: en("One thing a Git host may offer through the interface.") }),
  OwlClass.make(ifccm.ChangeRequestKind, {
    label: en("Change request kind"),
    subClassOf: [skos.Concept],
    definition: en("capability request or problem."),
  }),
  OwlClass.make(ifccm.ChangeRequestState, {
    label: en("Change request state"),
    subClassOf: [skos.Concept],
    definition: en("open or closed, as the Git host keeps it."),
  }),
  OwlClass.make(ifccm.Change, {
    label: en("Change"),
    subClassOf: [prov.Activity],
    definition: en("The work done under one or more change requests: its commits and the pull or merge request that carries them."),
  }),
  OwlClass.make(ifccm.IssueReferenceKind, {
    label: en("Issue reference kind"),
    subClassOf: [skos.Concept],
    definition: en("Refs or Closes: how a commit names a change request."),
  }),
  OwlClass.make(ifccm.ConfigurationItem, {
    label: en("Configuration item"),
    subClassOf: [prov.Entity],
    definition: en("Anything a change may alter that is under control: a specification, an ontology file, a source file, a test, a generated file, a pin."),
  }),
  OwlClass.make(ifccm.Baseline, {
    label: en("Baseline"),
    subClassOf: [provMore.Collection],
    definition: en("The configuration items at one revision, established by a Decision."),
  }),
  OwlClass.make(ifccm.RegulatedDomain, {
    label: en("Regulated domain"),
    subClassOf: [skos.Concept],
    definition: en("A domain of regulation a harness may claim: federal security, device quality, electronic records, device software, trust services."),
  }),
  OwlClass.make(ifccm.HarnessDeclaration, {
    label: en("Harness declaration"),
    subClassOf: [prov.Entity],
    definition: en("A harness's statement of the regulated domains it claims and the day it declares production; the one source of the phase of enforcement."),
  }),
  OwlClass.make(ifccm.EnforcementPhase, {
    label: en("Enforcement phase"),
    subClassOf: [skos.Concept],
    definition: en("warn before a harness declares production, gate from the day it does."),
  }),
  OwlClass.make(ifccm.TraceStage, {
    label: en("Trace stage"),
    subClassOf: [skos.Concept],
    definition: en("One link of the chain from a change request to a quality run."),
  }),
  OwlClass.make(ifccm.AuthorityFunction, {
    label: en("Authority function"),
    subClassOf: [skos.Concept],
    definition: en("binds, authorizes, verifies or plans: the four functions of authority that are kept apart."),
  }),
] as const;

/** The properties, each with its domain, range and definition. */
export const properties = [
  DatatypeProperty.make(ifccm.area, { domain: ifccm.Capability, range: xsd.string, label: en("area"), definition: en("The area of the harness (a rung or a subject) whose parent change request the capability is a child of.") }),
  ObjectProperty.make(ifccm.parentRequest, { domain: ifccm.Capability, range: ifccm.ChangeRequest, label: en("parent request"), definition: en("The parent change request of the capability's area.") }),
  ObjectProperty.make(ifccm.touchesRung, { domain: ifccm.Capability, range: mz.Rung, label: en("touches rung"), definition: en("A rung of the ladder the capability changes: the source of the generated view of capabilities by rung.") }),
  DatatypeProperty.make(ifccm.requirement, { domain: ifccm.Capability, range: xsd.string, label: en("requirement"), definition: en("A requirement the capability adds or changes, as `NNNN-slug FR-nnn`.") }),
  DatatypeProperty.make(ifccm.satisfiesControl, { domain: ifccm.Capability, range: xsd.string, label: en("satisfies control"), definition: en("The OSCAL identifier of a NIST SP 800-53 control the capability satisfies (cm-3).") }),
  DatatypeProperty.make(ifccm.reference, { domain: ifccm.ChangeRequest, range: xsd.string, label: en("reference"), definition: en("How a commit names the change request: `#N`, or `owner/repo#N` for another repository.") }),
  ObjectProperty.make(ifccm.requestKind, { domain: ifccm.ChangeRequest, range: ifccm.ChangeRequestKind, label: en("request kind"), definition: en("capability request or problem.") }),
  ObjectProperty.make(ifccm.requestState, { domain: ifccm.ChangeRequest, range: ifccm.ChangeRequestState, label: en("request state"), definition: en("open or closed.") }),
  ObjectProperty.make(ifccm.supports, { label: en("supports"), domain: ifccm.GitManagerKind, range: ifccm.GitCapability, definition: en("A capability the kind of Git host supports; one it does not list is unsupported.") }),
  ObjectProperty.make(ifccm.hostedOn, { domain: ifccm.ChangeRequest, range: ifccm.GitManagerKind, label: en("hosted on"), definition: en("The kind of Git host that keeps the change request.") }),
  ObjectProperty.make(ifccm.subRequestOf, { domain: ifccm.ChangeRequest, range: ifccm.ChangeRequest, label: en("sub-request of"), definition: en("The parent change request of a child change request (a sub-issue).") }),
  ObjectProperty.make(ifccm.requestsCapability, { domain: ifccm.ChangeRequest, range: ifccm.Capability, label: en("requests capability"), definition: en("The capability the change request asks for.") }),
  DatatypeProperty.make(ifccm.why, { domain: ifccm.ChangeRequest, range: xsd.string, label: en("why"), definition: en("Why the capability is wanted: the first section of its issue.") }),
  DatatypeProperty.make(ifccm.today, { domain: ifccm.ChangeRequest, range: xsd.string, label: en("today"), definition: en("What is true today: the second section.") }),
  DatatypeProperty.make(ifccm.scope, { domain: ifccm.ChangeRequest, range: xsd.string, label: en("scope"), definition: en("What the capability changes and what it leaves alone: the third section.") }),
  DatatypeProperty.make(ifccm.doneWhen, { domain: ifccm.ChangeRequest, range: xsd.string, label: en("done when"), definition: en("The requirements and the checks that decide the capability is done: the fourth section.") }),
  DatatypeProperty.make(ifccm.checkItem, { domain: ifccm.ChangeRequest, range: xsd.string, label: en("check item"), definition: en("A minor task: a checkbox item in the body of the change request.") }),
  DatatypeProperty.make(ifccm.revision, { domain: ifccm.Change, range: xsd.string, label: en("revision"), definition: en("A commit of the change, by its revision identifier.") }),
  ObjectProperty.make(ifccm.implementsRequest, { domain: ifccm.Change, range: ifccm.ChangeRequest, label: en("implements request"), definition: en("A change request the change implements: the change used it as its plan.") }),
  ObjectProperty.make(ifccm.referenceKind, { domain: ifccm.Change, range: ifccm.IssueReferenceKind, label: en("reference kind"), definition: en("Refs or Closes: how the change's commit names its change request.") }),
  ObjectProperty.make(ifccm.changesItem, { domain: ifccm.Change, range: ifccm.ConfigurationItem, label: en("changes item"), definition: en("A configuration item the change alters.") }),
  ObjectProperty.make(ifccm.authorizedBy, { domain: ifccm.Change, range: mz.Decision, label: en("authorized by"), definition: en("The Decision that authorizes the change, where one is needed.") }),
  DatatypeProperty.make(ifccm.approvedBy, { domain: ifccm.Change, range: xsd.string, label: en("approved by"), definition: en("The role that approved the change; never the role that authored it where the harness is regulated.") }),
  DatatypeProperty.make(ifccm.itemPath, { domain: ifccm.ConfigurationItem, range: xsd.string, label: en("item path"), definition: en("Where the configuration item is in the repository, with `/`.") }),
  ObjectProperty.make(ifccm.includesItem, { domain: ifccm.Baseline, range: ifccm.ConfigurationItem, label: en("includes item"), definition: en("A configuration item the baseline holds.") }),
  DatatypeProperty.make(ifccm.baselineRevision, { domain: ifccm.Baseline, range: xsd.string, label: en("baseline revision"), definition: en("The revision the baseline is established at.") }),
  ObjectProperty.make(ifccm.establishedBy, { domain: ifccm.Baseline, range: mz.Decision, label: en("established by"), definition: en("The Decision that establishes the baseline.") }),
  DatatypeProperty.make(ifccm.harness, { domain: ifccm.HarnessDeclaration, range: xsd.string, label: en("harness"), definition: en("The harness the declaration is of, by its repository.") }),
  ObjectProperty.make(ifccm.regulatedDomain, { domain: ifccm.HarnessDeclaration, range: ifccm.RegulatedDomain, label: en("regulated domain"), definition: en("A regulated domain the harness claims.") }),
  ObjectProperty.make(ifccm.regulatedBy, { domain: ifccm.RegulatedDomain, range: mz.Authority, label: en("regulated by"), definition: en("The law a regulated domain rests on, where it rests on law.") }),
  DatatypeProperty.make(ifccm.productionDeclaredOn, { domain: ifccm.HarnessDeclaration, range: xsd.string, label: en("production declared on"), definition: en("The day (YYYY-MM-DD) the harness declares production: findings are warnings before it and gate from it.") }),
  DatatypeProperty.make(ifccm.stageNumber, { domain: ifccm.TraceStage, range: xsd.integer, label: en("stage number"), definition: en("The place of the stage in the chain, from 1.") }),
  DatatypeProperty.make(ifccm.anchor, { domain: ifccm.TraceStage, range: xsd.string, label: en("anchor"), definition: en("The annotation that already links the stage, so that no new one is needed.") }),
  DatatypeProperty.make(ifccm.instrument, { domain: ifccm.AuthorityFunction, range: xsd.string, label: en("instrument"), definition: en("What carries the function: a specification, a Decision, a check or an issue.") }),
] as const;

/** The ontology itself: its label, description and version. */
export const ifccmOntology = OwlOntology.make(ontologyOf(IFCCM), {
  label: en("IFCCM"),
  description: en(
    "The vocabulary of Intellectual Frontiers Capabilities Configuration Management: the capability as the unit of change, change requests, changes, configuration items, baselines, a harness's declaration and the trace chain.",
  ),
  versionInfo: "1.0.0",
  versionIri: named<"owl:Ontology">(iriIn(IFCCMV, "1.0.0")),
});

// ---- the audit: the basis of every class (0018-standards-first FR-003)

const DAY = "2026-11-17";

/** The record of a class that specializes a standard's class. */
function specializes(local: keyof typeof ifccm, standardTerm: string, definedBy: string) {
  return OntologyTerm.make(term(MZID, `term-ifccm-${local}`), {
    label: en(`ifccm:${local}`),
    termIri: ifccm[local].iri,
    basis: bases.Specializes,
    standardTerm,
    mappingRelation: "subClassOf",
    definedBy: [definedBy],
  });
}

const SKOS_CONCEPT = skos.Concept.iri;

/** The audit of IFCCM: one record for every class, and for every class of a code list. */
export const terms = [
  OntologyTerm.make(term(MZID, "term-ifccm-Capability"), {
    label: en("ifccm:Capability"),
    termIri: ifccm.Capability.iri,
    basis: bases.Unaligned,
    justification:
      `Examined: the ArchiMate and UAF 'capability' elements (an ability of an organization or system, as here) and ISO/IEC/IEEE 15288 and 12207 (system capability); none publishes an IRI, and Spec Kit's 'feature' is the term this one replaces. Candidates to examine further: a published ArchiMate or UAF vocabulary (to verify). ${KEPT_UNALIGNED_SENTENCE}`,
    decision: keptUnalignedDecisionId("ifccm", "Capability"),
    addedOn: DAY,
    definedBy: ["0020-ifccm FR-001"],
  }),
  specializes("ChangeRequest", oslcCm.ChangeRequest.iri, "0020-ifccm FR-021"),
  specializes("ChangeRequestKind", SKOS_CONCEPT, "0020-ifccm FR-021"),
  specializes("ChangeRequestState", SKOS_CONCEPT, "0020-ifccm FR-021"),
  specializes("Change", prov.Activity.iri, "0020-ifccm FR-022"),
  specializes("IssueReferenceKind", SKOS_CONCEPT, "0020-ifccm FR-005"),
  specializes("ConfigurationItem", prov.Entity.iri, "0020-ifccm FR-022"),
  specializes("Baseline", provMore.Collection.iri, "0020-ifccm FR-022"),
  specializes("RegulatedDomain", SKOS_CONCEPT, "0020-ifccm FR-010"),
  specializes("HarnessDeclaration", prov.Entity.iri, "0020-ifccm FR-010"),
  specializes("EnforcementPhase", SKOS_CONCEPT, "0020-ifccm FR-011"),
  specializes("TraceStage", SKOS_CONCEPT, "0020-ifccm FR-014"),
  specializes("AuthorityFunction", SKOS_CONCEPT, "0020-ifccm FR-018"),
  OntologyTerm.make(term(MZID, "term-ifccm-GitManagerKind"), {
    label: en("ifccm:GitManagerKind"),
    termIri: ifccm.GitManagerKind.iri,
    basis: bases.Unaligned,
    justification: `Examined: GitHub, GitLab and Git are products and projects, and no standard vocabulary lists them as a code list; SPDX 3 and DOAP name a repository's kind of version control, not the host (to verify). ${KEPT_UNALIGNED_SENTENCE}`,
    decision: keptUnalignedDecisionId("ifccm", "GitManagerKind"),
    addedOn: DAY,
    definedBy: ["0020-ifccm FR-027"],
  }),
  OntologyTerm.make(term(MZID, "term-ifccm-GitCapability"), {
    label: en("ifccm:GitCapability"),
    termIri: ifccm.GitCapability.iri,
    basis: bases.Unaligned,
    justification: `Examined: OpenAPI describes the operations of one API, not a list of capabilities that hosts support or lack; ForgeFed models forge objects, not what a client may ask (to verify). ${KEPT_UNALIGNED_SENTENCE}`,
    decision: keptUnalignedDecisionId("ifccm", "GitCapability"),
    addedOn: DAY,
    definedBy: ["0020-ifccm FR-027"],
  }),
] as const;

/** The decisions of the terms kept unaligned (the owner's decision of 2026-11-17, issue #10). */
export const decisions = [keptUnalignedDecision("ifccm", "Capability"), keptUnalignedDecision("ifccm", "GitManagerKind"), keptUnalignedDecision("ifccm", "GitCapability")] as const;

/** The file this module states: its name, its prefixes and its individuals. */
export const file: OntologyFile = {
  name: "ifccm",
  prefixes: [IFCCM, IFCCMV, MZ, MZID, OSLC_CM, OWL, PROV, RDFS, SKOS, XSD],
  individuals: [
    ifccmOntology,
    ...classes,
    ...properties,
    ...Object.values(changeRequestKinds),
    ...Object.values(changeRequestStates),
    ...Object.values(issueReferenceKinds),
    ...Object.values(enforcementPhases),
    ...Object.values(regulatedDomains),
    ...Object.values(traceStages),
    ...Object.values(authorityFunctions),
    ...Object.values(gitCapabilities),
    ...Object.values(gitManagerKinds),
    ...terms,
    ...decisions,
  ],
};
