// Spec: 0007-actor-terms FR-001, FR-002, FR-003, FR-004
/**
 * The vocabulary of Actors (commons 0048-actors): the actor that takes part in an act, the roles it holds, the directive an act is done under, the tasking that lets an agent be used, the qualification of an agent's configuration, the
 * nonconformity of an act that broke the rules, and the signature meanings of a regulated record.
 *
 * @remarks
 * It stands on PROV-O and SKOS, whose terms the library `rdf` already holds: an actor is a `prov:Agent` (in PROV every actor of any kind is an agent; our actor kind `agent` is the AI case only), an act is a `prov:Activity`, a directive,
 * a tasking and a qualification are each a `prov:Entity`, and each code list is a SKOS concept. No standard publishes a vocabulary of these roles; theirs is written (the definitions, in our own words, and what was not
 * read, are in commons 0048-actors `definitions.md`). The signature meanings are the four that 21 CFR 11.50 names.
 *
 * @limits
 * The properties do not yet carry a basis of their own (the baseline holds them until the schemas require it). The rule that only a person can hold the roles initiator, reviewer and approver is a rule of the library of actors, in types;
 * the ontology states the roles and the kinds, not which kind may hold which role.
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

/** The namespace of Actors' terms. */
export const ACTOR = namespace("act", "https://www.intellectualfrontiers.com/ontology/actor#");
/** The namespace of the versions of Actors' ontology: `owl:versionIRI` names one of them. */
export const ACTORV = namespace("actv", "https://www.intellectualfrontiers.com/ontology/actor/");

/** The terms of Actors' vocabulary: its classes and properties. */
export const act = vocabulary(ACTOR, {
  Act: "owl:Class",
  Actor: "owl:Class",
  Directive: "owl:Class",
  Tasking: "owl:Class",
  Qualification: "owl:Class",
  ReviewCanary: "owl:Class",
  NonconformityRule: "owl:Class",
  Role: "owl:Class",
  ActorKind: "owl:Class",
  TaskingLevel: "owl:Class",
  SignatureMeaning: "owl:Class",
  initiatedBy: "owl:ObjectProperty",
  preparedBy: "owl:ObjectProperty",
  assistedBy: "owl:ObjectProperty",
  executedBy: "owl:ObjectProperty",
  reviewedBy: "owl:ObjectProperty",
  approvedBy: "owl:ObjectProperty",
  underDirective: "owl:ObjectProperty",
  brokeRule: "owl:ObjectProperty",
  directiveDigest: "owl:DatatypeProperty",
});

const CODE = { label: one(rdfs.label, range.langString), definition: one(skos.definition, range.langString) } as const;

/** The schema of a role (`act:Role`). */
export const RoleSchema = classSchema(act.Role, CODE);

/** The six roles an actor holds in an act (0048-actors FR-010), in the order a regulated act meets them. */
export const roles = codes(RoleSchema, ACTOR, {
  Initiator: { label: en("Initiator"), definition: en("The person whose request, or whose standing directive, is why the act happens; an agent is never one.") },
  Preparer: { label: en("Preparer"), definition: en("The actor that made the artifact of the act: a document, a change, a test or a plan. Any kind of actor can prepare.") },
  Assistant: { label: en("Assistant"), definition: en("An agent or a system that operated a tool during a step of the act, under a directive and a tasking.") },
  Executor: { label: en("Executor"), definition: en("The person, or the validated mechanism, that carried the step out.") },
  Reviewer: { label: en("Reviewer"), definition: en("A person who read the artifact and signed that review; for a regulated act, not the person who prepared it.") },
  Approver: { label: en("Approver"), definition: en("A person whose signature, with a key of their own, bound the plan hash of the act.") },
});

/** The schema of a kind of actor (`act:ActorKind`). */
export const ActorKindSchema = classSchema(act.ActorKind, CODE);

/** The three kinds of actor (0048-actors FR-001). */
export const actorKinds = codes(ActorKindSchema, ACTOR, {
  Person: { label: en("Person"), definition: en("A human being, who can be accountable and can sign.") },
  System: { label: en("System"), definition: en("A deterministic mechanism that a person validated: the engine, a typed verb, a pipeline.") },
  Agent: { label: en("Agent"), definition: en("An AI agent: a model run under instructions with tools. It is instructed, not accountable, and what it makes is a draft until a person or a validated mechanism clears it.") },
});

/** The schema of a tasking level (`act:TaskingLevel`). */
export const TaskingLevelSchema = classSchema(act.TaskingLevel, CODE);

/** The four levels at which an agent may be tasked (0048-actors FR-040). */
export const taskingLevels = codes(TaskingLevelSchema, ACTOR, {
  T0Suggest: { label: en("T0, suggest"), definition: en("The agent only suggests; nothing it makes enters a record.") },
  T1Prepare: { label: en("T1, prepare"), definition: en("The agent prepares drafts in a branch or a sandbox; a person reviews them before they enter a record.") },
  T2AssistExecution: { label: en("T2, assist execution"), definition: en("The agent assists a step whose plan hash a person approved for each step; the engine carries it out.") },
  T3AssistReversible: { label: en("T3, assist reversible steps"), definition: en("The agent assists reversible, low risk steps under a standing directive and a current qualification; the owner of the directive stays the initiator and the engine stays the executor.") },
});

/** The schema of a signature meaning (`act:SignatureMeaning`). */
export const SignatureMeaningSchema = classSchema(act.SignatureMeaning, CODE);

/** The meanings a signature of a regulated record carries, as 21 CFR 11.50 names them (0048-actors FR-012). */
export const signatureMeanings = codes(SignatureMeaningSchema, ACTOR, {
  Review: { label: en("Review"), definition: en("The signer read the record and found it fit for its purpose.") },
  Approval: { label: en("Approval"), definition: en("The signer approved the record or the plan it names, by its hash.") },
  Responsibility: { label: en("Responsibility"), definition: en("The signer takes responsibility for what the record states.") },
  Authorship: { label: en("Authorship"), definition: en("The signer made the record.") },
});

/** The schema of a rule whose breach is a nonconformance (`act:NonconformityRule`). */
export const NonconformityRuleSchema = classSchema(act.NonconformityRule, CODE);

/** The rules of 0048-actors whose breach an act records as a nonconformance of `ifqs:` (0048-actors FR-050). */
export const nonconformityRules = codes(NonconformityRuleSchema, ACTOR, {
  Undirected: { label: en("Undirected"), definition: en("An agent acted with no directive on record.") },
  OutsideTasking: { label: en("Outside tasking"), definition: en("An agent acted beyond the scope, level or expiry of its tasking, or after it was revoked.") },
  Unqualified: { label: en("Unqualified"), definition: en("An agent configuration with no current qualification was used where one is required.") },
  RegulatedVerbRefused: { label: en("Regulated verb refused"), definition: en("An agent asked for a verb that changes a regulated record or a system, and it was refused.") },
  ReviewSkipped: { label: en("Review skipped"), definition: en("Prepared content entered a record with no signed review and no deterministic reproduction.") },
  ReviewedByPreparer: { label: en("Reviewed by the preparer"), definition: en("A regulated act was reviewed by its preparer, or by the person who tasked the agent that prepared it.") },
  VocabularyBreach: { label: en("Vocabulary breach"), definition: en("A record named an agent as the initiator, the one who completed, approved or signed an act.") },
});

/** The classes, each with its label and definition. */
export const classes = [
  OwlClass.make(act.Act, { label: en("Act"), subClassOf: [prov.Activity], definition: en("One act of a regulated flow: a step that changes a record or a system, with the actors that held a role in it and the directive it was done under.") }),
  OwlClass.make(act.Actor, { label: en("Actor"), subClassOf: [prov.Agent], definition: en("A person, a system or an agent that takes part in an act. In PROV it is an agent; here the word agent is kept for the AI case.") }),
  OwlClass.make(act.Directive, { label: en("Directive"), subClassOf: [prov.Entity], definition: en("A controlled instruction an act is done under: a work order, a specification, a procedure or a person's request kept by its digest, with an owner who is a person and a version.") }),
  OwlClass.make(act.Tasking, { label: en("Tasking"), subClassOf: [prov.Entity], definition: en("A person's signed authority to use an agent configuration within a scope, at a level, until an expiry; the person keeps the initiative and the accountability, and the tasking can be revoked.") }),
  OwlClass.make(act.Qualification, { label: en("Qualification"), subClassOf: [prov.Entity], definition: en("The record that an agent configuration (model and version, instruction set digest, tool permissions) was shown fit for a use, with its evidence, its validity and the changes that require it to be redone.") }),
  OwlClass.make(act.ReviewCanary, { label: en("Review canary"), subClassOf: [prov.Entity], definition: en("A defect seeded into an artifact, so that whether a review catches it measures whether the review is real.") }),
  OwlClass.make(act.NonconformityRule, { label: en("Nonconformity rule"), subClassOf: [skos.Concept], definition: en("One of the rules whose breach by an act is recorded as a nonconformance of the quality ontology.") }),
  OwlClass.make(act.Role, { label: en("Role"), subClassOf: [skos.Concept], definition: en("One of the roles an actor holds in an act.") }),
  OwlClass.make(act.ActorKind, { label: en("Kind of actor"), subClassOf: [skos.Concept], definition: en("One of the three kinds of actor: a person, a system or an agent.") }),
  OwlClass.make(act.TaskingLevel, { label: en("Tasking level"), subClassOf: [skos.Concept], definition: en("One of the four levels at which an agent may be tasked.") }),
  OwlClass.make(act.SignatureMeaning, { label: en("Signature meaning"), subClassOf: [skos.Concept], definition: en("What a signature of a regulated record means: review, approval, responsibility or authorship.") }),
] as const;

/** The properties, each with its domain, range and definition. */
export const properties = [
  ObjectProperty.make(act.initiatedBy, { domain: act.Act, range: act.Actor, label: en("initiated by"), definition: en("The person whose request or standing directive is why the act happens.") }),
  ObjectProperty.make(act.preparedBy, { domain: act.Act, range: act.Actor, label: en("prepared by"), definition: en("The actor that made the artifact of the act.") }),
  ObjectProperty.make(act.assistedBy, { domain: act.Act, range: act.Actor, label: en("assisted by"), definition: en("The agent or system that operated a tool during a step of the act.") }),
  ObjectProperty.make(act.executedBy, { domain: act.Act, range: act.Actor, label: en("executed by"), definition: en("The person or validated mechanism that carried the step out.") }),
  ObjectProperty.make(act.reviewedBy, { domain: act.Act, range: act.Actor, label: en("reviewed by"), definition: en("The person who read the artifact and signed a review.") }),
  ObjectProperty.make(act.approvedBy, { domain: act.Act, range: act.Actor, label: en("approved by"), definition: en("The person whose signature bound the plan hash of the act.") }),
  ObjectProperty.make(act.underDirective, { domain: act.Act, range: act.Directive, label: en("under directive"), definition: en("The directive the act was done under.") }),
  ObjectProperty.make(act.brokeRule, { domain: act.Act, range: act.NonconformityRule, label: en("broke rule"), definition: en("The rule of the specification of actors that the act did not meet.") }),
  DatatypeProperty.make(act.directiveDigest, { domain: act.Directive, range: xsd.string, label: en("directive digest"), definition: en("The digest of the directive's text, so that the instruction an act followed can be checked.") }),
] as const;

/** The ontology itself: its label, description and version. */
export const actorOntology = OwlOntology.make(ontologyOf(ACTOR), {
  label: en("Actors"),
  description: en("The vocabulary of Actors: the act and the actor that takes part in it, the roles, the directive, the tasking, the qualification, the nonconformity and the meanings of a signature."),
  versionInfo: "1.0.0",
  versionIri: named<"owl:Ontology">(iriIn(ACTORV, "1.0.0")),
});

// ---- the audit: the basis of every class (0018-standards-first FR-003)

/** The names of the classes the audit records. */
type ClassName = "Act" | "Actor" | "Directive" | "Tasking" | "Qualification" | "NonconformityRule" | "ReviewCanary" | "Role" | "ActorKind" | "TaskingLevel" | "SignatureMeaning";

/** The record of a class that specializes a standard's class. */
function specializes(local: ClassName, standardTerm: string, definedBy: string) {
  return OntologyTerm.make(term(MZID, `term-actor-${local}`), {
    label: en(`act:${local}`),
    termIri: act[local].iri,
    basis: bases.Specializes,
    standardTerm,
    mappingRelation: "subClassOf",
    definedBy: [definedBy],
  });
}

/** The audit of Actors: one record for every class, each specializing a term of PROV-O or SKOS. */
export const terms = [
  specializes("Act", prov.Activity.iri, "0048-actors FR-010"),
  specializes("Actor", prov.Agent.iri, "0048-actors FR-001"),
  specializes("Directive", prov.Entity.iri, "0048-actors FR-020"),
  specializes("Tasking", prov.Entity.iri, "0048-actors FR-030"),
  specializes("Qualification", prov.Entity.iri, "0048-actors FR-035"),
  specializes("ReviewCanary", prov.Entity.iri, "0048-actors FR-055"),
  specializes("NonconformityRule", skos.Concept.iri, "0048-actors FR-050"),
  specializes("Role", skos.Concept.iri, "0048-actors FR-010"),
  specializes("ActorKind", skos.Concept.iri, "0048-actors FR-001"),
  specializes("TaskingLevel", skos.Concept.iri, "0048-actors FR-040"),
  specializes("SignatureMeaning", skos.Concept.iri, "0048-actors FR-012"),
] as const;

/** The file this module states: its name, its prefixes and its individuals. */
export const file: OntologyFile = {
  name: "actor",
  prefixes: [ACTOR, ACTORV, MZ, MZID, OWL, PROV, RDFS, SKOS, XSD],
  individuals: [
    actorOntology,
    ...classes,
    ...properties,
    ...Object.values(roles),
    ...Object.values(actorKinds),
    ...Object.values(taskingLevels),
    ...Object.values(signatureMeanings),
    ...Object.values(nonconformityRules),
    ...terms,
  ],
};
