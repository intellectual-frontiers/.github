// Spec: 0003-planning-terms FR-001, FR-002, FR-003, FR-004, FR-005, FR-006
/**
 * The vocabulary of Planning (commons 0037-planning): the planning content a person or a program keeps about work to be done (an issue, a task, a to-do, a roadmap item, a question, a decision, a finding),
 * the append-only events that make its history, the actors who wrote them, the observations of what a source saw and where (with a locator and a content hash), the trace that ties an item to every place
 * it was seen, the patch that writes a change back, the preview of that patch, the source that reads and writes one place, and the closed code lists the model branches on.
 *
 * @remarks
 * It stands on PROV-O and SKOS, whose terms the library `rdf` and the Kanon ontology already hold: an item, an observation, a locator, a link, a patch and a preview are `prov:Entity`, an event is a
 * `prov:Activity`, an actor a `prov:Agent`, a source a `prov:SoftwareAgent`, a trace a `prov:Derivation`, and every code list is a SKOS concept. Where another standard names a value (the SARIF `level`
 * of a severity, the iCalendar `STATUS` of a state, the Web Annotation motivation of a kind, the GitHub reason a work item was closed) the value is data of the member as a plain name, in a property that
 * says whose it is, and never as an IRI: those documents were not read when this ontology was written (0037-planning, Standards considered), so each name is `(to verify)` and no IRI of them is invented,
 * as `kanon:mdaViewpoint` does.
 *
 * @limits
 * The properties do not yet carry a basis of their own (the baseline holds them until the schemas require it). A time is a string of ISO 8601 in UTC to the second, as the datatype list of the kernel has no date-time.
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
} from "@intellectual-frontiers/rdf";
import { bases, MZ, MZID, OntologyTerm } from "../mizan/mizan.ts";
import { provMore } from "../kanon/kanon.ts";

/** The namespace of Planning's terms. */
export const PLANNING = namespace("plan", "https://www.intellectualfrontiers.com/ontology/planning#");
/** The namespace of the versions of Planning's ontology: `owl:versionIRI` names one of them. */
export const PLANNINGV = namespace("planv", "https://www.intellectualfrontiers.com/ontology/planning/");

/** The terms of Planning's vocabulary: its classes and properties. */
export const plan = vocabulary(PLANNING, {
  Item: "owl:Class",
  Event: "owl:Class",
  Actor: "owl:Class",
  Observation: "owl:Class",
  Locator: "owl:Class",
  Trace: "owl:Class",
  Link: "owl:Class",
  Patch: "owl:Class",
  Preview: "owl:Class",
  Source: "owl:Class",
  ItemKind: "owl:Class",
  State: "owl:Class",
  CloseReason: "owl:Class",
  Severity: "owl:Class",
  Verdict: "owl:Class",
  LinkKind: "owl:Class",
  Capability: "owl:Class",
  FieldAuthority: "owl:Class",
  Origin: "owl:Class",
  ActorKind: "owl:Class",
  LocatorKind: "owl:Class",
  EventType: "owl:Class",
  itemId: "owl:DatatypeProperty",
  itemKind: "owl:ObjectProperty",
  itemState: "owl:ObjectProperty",
  itemSeverity: "owl:ObjectProperty",
  itemCloseReason: "owl:ObjectProperty",
  itemOrigin: "owl:ObjectProperty",
  seenIn: "owl:ObjectProperty",
  eventOf: "owl:ObjectProperty",
  eventType: "owl:ObjectProperty",
  eventActor: "owl:ObjectProperty",
  eventAt: "owl:DatatypeProperty",
  actorKind: "owl:ObjectProperty",
  actorId: "owl:DatatypeProperty",
  actorName: "owl:DatatypeProperty",
  observedBy: "owl:ObjectProperty",
  observedAt: "owl:DatatypeProperty",
  observationLocator: "owl:ObjectProperty",
  contentHash: "owl:DatatypeProperty",
  fingerprint: "owl:DatatypeProperty",
  locatorKind: "owl:ObjectProperty",
  locatorValue: "owl:DatatypeProperty",
  traceItem: "owl:ObjectProperty",
  traceObservation: "owl:ObjectProperty",
  linkKind: "owl:ObjectProperty",
  linkFrom: "owl:ObjectProperty",
  linkTo: "owl:ObjectProperty",
  patchTarget: "owl:ObjectProperty",
  patchOp: "owl:DatatypeProperty",
  previewOf: "owl:ObjectProperty",
  previewHash: "owl:DatatypeProperty",
  sourceName: "owl:DatatypeProperty",
  sourceCapability: "owl:ObjectProperty",
  fieldAuthority: "owl:ObjectProperty",
  sarifLevel: "owl:DatatypeProperty",
  icalStatus: "owl:DatatypeProperty",
  webAnnotationMotivation: "owl:DatatypeProperty",
  githubStateReason: "owl:DatatypeProperty",
});

// ---- the code lists

const CODE = { label: one(rdfs.label, range.langString), definition: one(skos.definition, range.langString) } as const;

/** The schema of a kind of item (`plan:ItemKind`): the Web Annotation motivation the kind is closest to, as a name, where one is. */
export const ItemKindSchema = classSchema(plan.ItemKind, { ...CODE, webAnnotationMotivation: optional(plan.webAnnotationMotivation, range.string) });

/** The seven kinds of item (0037-planning FR-001): the sum of the model, over one shared core. */
export const itemKinds = codes(ItemKindSchema, PLANNING, {
  Issue: { label: en("Issue"), definition: en("A problem or a request that someone is to look at, with a title and a body.") },
  Task: { label: en("Task"), definition: en("A unit of work to be done, possibly with sub-items.") },
  Todo: { label: en("Todo"), definition: en("A note left in a place to do something there: a comment in a source file, a line of a list.") },
  RoadmapItem: { label: en("Roadmap item"), definition: en("A planned outcome with an intended time horizon (now, next or later), not yet a task.") },
  Question: {
    label: en("Question"),
    definition: en("Something that needs an answer before work can go on."),
    webAnnotationMotivation: "questioning",
  },
  Decision: { label: en("Decision"), definition: en("A choice to be made or that was made, with its verdict and its reason.") },
  Finding: {
    label: en("Finding"),
    definition: en("What an audit, a scan or a review found, with a severity and where it was seen."),
    webAnnotationMotivation: "assessing",
  },
});

/** The schema of a state (`plan:State`): the iCalendar `STATUS` the state is closest to, as a name, where one is. */
export const StateSchema = classSchema(plan.State, { ...CODE, icalStatus: optional(plan.icalStatus, range.string) });

/** The four states of an item (0037-planning FR-004): a fold of its events, never stored. */
export const states = codes(StateSchema, PLANNING, {
  Proposed: { label: en("Proposed"), definition: en("Found or inferred by a program or an agent, not yet confirmed by a person; it is counted in no plan until it is.") },
  Open: { label: en("Open"), definition: en("Confirmed and not started."), icalStatus: "NEEDS-ACTION" },
  InProgress: { label: en("In progress"), definition: en("Being worked on."), icalStatus: "IN-PROCESS" },
  Closed: { label: en("Closed"), definition: en("Finished or set aside, with a reason; it may be reopened.") },
});

/** The schema of a close reason (`plan:CloseReason`): the reason a Git host gives, as a name. */
export const CloseReasonSchema = classSchema(plan.CloseReason, { ...CODE, githubStateReason: optional(plan.githubStateReason, range.string) });

/** The three reasons an item is closed. */
export const closeReasons = codes(CloseReasonSchema, PLANNING, {
  Completed: { label: en("Completed"), definition: en("The work was done."), githubStateReason: "completed" },
  NotPlanned: { label: en("Not planned"), definition: en("The work will not be done."), githubStateReason: "not_planned" },
  Duplicate: { label: en("Duplicate"), definition: en("Another item says the same; it is the one that is kept."), githubStateReason: "duplicate" },
});

/** The schema of a severity (`plan:Severity`): the SARIF `level` it is, as a name. */
export const SeveritySchema = classSchema(plan.Severity, { ...CODE, sarifLevel: one(plan.sarifLevel, range.string) });

/** The three severities of an item (0037-planning FR-005). */
export const severities = codes(SeveritySchema, PLANNING, {
  Error: { label: en("Error"), definition: en("A serious problem."), sarifLevel: "error" },
  Warning: { label: en("Warning"), definition: en("A problem."), sarifLevel: "warning" },
  Note: { label: en("Note"), definition: en("A minor problem or a chance to improve."), sarifLevel: "note" },
});

/** The four verdicts of a decision. */
export const verdicts = codes(classSchema(plan.Verdict, CODE), PLANNING, {
  Accept: { label: en("Accept"), definition: en("The proposal is accepted as it stands.") },
  MinorRevision: { label: en("Minor revision"), definition: en("The proposal is accepted after small changes.") },
  MajorRevision: { label: en("Major revision"), definition: en("The proposal is to be reworked and decided again.") },
  Reject: { label: en("Reject"), definition: en("The proposal is refused.") },
});

/** The kinds of link between two items (0037-planning FR-009). */
export const linkKinds = codes(classSchema(plan.LinkKind, CODE), PLANNING, {
  Blocks: { label: en("Blocks"), definition: en("The first item must be done before the second can be; the links of this kind make a graph with no cycle.") },
  SameAs: { label: en("Same as"), definition: en("The two items say one thing; a person confirms the link.") },
  RelatesTo: { label: en("Relates to"), definition: en("The two items are about the same matter, with no order between them.") },
  ParentOf: { label: en("Parent of"), definition: en("The first item contains the second as a sub-item.") },
  DerivedFrom: { label: en("Derived from"), definition: en("The first item was made out of the second, as a finding makes a task.") },
});

/** The abilities of a source (0037-planning FR-014): what it can be asked to write. */
export const capabilities = codes(classSchema(plan.Capability, CODE), PLANNING, {
  Read: { label: en("Read"), definition: en("The source can be read.") },
  Create: { label: en("Create"), definition: en("The source can take a new item.") },
  AppendEvent: { label: en("Append event"), definition: en("The source can take a new event of an item.") },
  Edit: { label: en("Edit"), definition: en("The source can change the title, the body or the labels of an item.") },
  Close: { label: en("Close"), definition: en("The source can close and reopen an item.") },
  Assign: { label: en("Assign"), definition: en("The source can set the assignees of an item.") },
  Delete: { label: en("Delete"), definition: en("The source can remove an item; the model itself never does.") },
});

/** The ways the value of a field is settled when sources disagree (0037-planning FR-012). */
export const fieldAuthorities = codes(classSchema(plan.FieldAuthority, CODE), PLANNING, {
  SourceWins: { label: en("Source"), definition: en("The place the item was seen in says what the field is, and the store follows it.") },
  StoreWins: { label: en("Store"), definition: en("The store says what the field is, and the place follows it where it can be written.") },
  LatestWins: { label: en("Latest"), definition: en("The change made last, by the time of its event, says what the field is.") },
  PersonOnly: { label: en("Person"), definition: en("Only an event by a person changes the field; a change by an agent or a tool waits as a proposal.") },
});

/** How an item came to be (0037-planning FR-006): what a person wrote, what a program read, or what a program guessed. */
export const origins = codes(classSchema(plan.Origin, CODE), PLANNING, {
  Declared: { label: en("Declared"), definition: en("Written as an item by a person or by a tool whose output is a statement of it.") },
  Derived: { label: en("Derived"), definition: en("Read from a place by a rule that is exact, as a comment marked TODO or a task line of a list.") },
  Inferred: { label: en("Inferred"), definition: en("Guessed by a heuristic or an agent; it is proposed until a person confirms it.") },
});

/** The three kinds of actor, as in the events of the issues the first dataset holds. */
export const actorKinds = codes(classSchema(plan.ActorKind, CODE), PLANNING, {
  ByPerson: { label: en("Person"), definition: en("A human being, named by who they are and never by a program acting for them.") },
  ByAgent: { label: en("Agent"), definition: en("An AI agent; an item or an event it wrote says so and is never signed as a person.") },
  ByTool: { label: en("Tool"), definition: en("A program with no judgement of its own: a scanner, a linter, a synchronizer.") },
});

/** The kinds of locator, the ways a place is named (0037-planning FR-008). */
export const locatorKinds = codes(classSchema(plan.LocatorKind, CODE), PLANNING, {
  FileSpan: { label: en("File span"), definition: en("A file of a store, with a line or a range and the symbol that encloses it where there is one.") },
  Url: { label: en("URL"), definition: en("A web address, as of an issue on a Git host.") },
  Row: { label: en("Row"), definition: en("A row of a table, named by the table and its key.") },
  Commit: { label: en("Commit"), definition: en("A commit of a repository, named by its hash, as of a trailer.") },
});

/** The kinds of event, the cases of the union an item's history is made of (0037-planning FR-003). */
export const eventTypes = codes(classSchema(plan.EventType, CODE), PLANNING, {
  OpenedEvent: { label: en("Opened"), definition: en("The item came to be, with its kind, title and body.") },
  CommentedEvent: { label: en("Commented"), definition: en("Someone added a remark.") },
  EditedEvent: { label: en("Edited"), definition: en("The title or the body changed.") },
  LabeledEvent: { label: en("Labeled"), definition: en("Labels were added or taken away.") },
  AssignedEvent: { label: en("Assigned"), definition: en("Assignees were added or taken away.") },
  SeveritySetEvent: { label: en("Severity set"), definition: en("The severity changed.") },
  BlockerSetEvent: { label: en("Blocker set"), definition: en("The item was marked as blocking, or not.") },
  StartedEvent: { label: en("Started"), definition: en("Work began on the item.") },
  ClosedEvent: { label: en("Closed"), definition: en("The item was closed, with a reason.") },
  ReopenedEvent: { label: en("Reopened"), definition: en("A closed item was opened again.") },
  DecidedEvent: { label: en("Decided"), definition: en("A verdict was given on the item, with a note.") },
  LinkedEvent: { label: en("Linked"), definition: en("A link to another item was added or taken away.") },
  ConfirmedEvent: { label: en("Confirmed"), definition: en("A person confirmed a proposed item.") },
  SeenEvent: { label: en("Seen"), definition: en("A source saw the item again, or no longer saw it; it records the observation and no human change.") },
});

// ---- the classes and the properties, each with its label and definition

/** The classes, each with its label and definition. */
export const classes = [
  OwlClass.make(plan.Item, {
    label: en("Item"),
    subClassOf: [prov.Entity],
    definition: en("A piece of planning content of one of seven kinds, with a stable id and a history of events from which its state is folded."),
  }),
  OwlClass.make(plan.Event, {
    label: en("Event"),
    subClassOf: [prov.Activity],
    definition: en("One thing that happened to an item, appended to its history and never changed, with its time and its actor."),
  }),
  OwlClass.make(plan.Actor, {
    label: en("Actor"),
    subClassOf: [prov.Agent],
    definition: en("The one who wrote an event or an item: a person, an agent or a tool, with an id and a name."),
  }),
  OwlClass.make(plan.Observation, {
    label: en("Observation"),
    subClassOf: [prov.Entity],
    definition: en("What one source saw in one place at one time: the content, a locator, a hash of what was read and a fingerprint of its identity."),
  }),
  OwlClass.make(plan.Locator, {
    label: en("Locator"),
    subClassOf: [prov.Entity],
    definition: en("A way of naming a place: a file with a line, a web address, a row or a commit."),
  }),
  OwlClass.make(plan.Trace, {
    label: en("Trace"),
    subClassOf: [provMore.Derivation],
    definition: en("The record that an item was derived from what a source observed, so that every place an item was seen can be found from it."),
  }),
  OwlClass.make(plan.Link, {
    label: en("Link"),
    subClassOf: [prov.Entity],
    definition: en("A typed relation between two items."),
  }),
  OwlClass.make(plan.Patch, {
    label: en("Patch"),
    subClassOf: [prov.Entity],
    definition: en("A change to write back to one source: add an item, change a state, add an event; a value, and nothing happens until it is applied."),
  }),
  OwlClass.make(plan.Preview, {
    label: en("Preview"),
    subClassOf: [prov.Entity],
    definition: en("What applying a patch would do, with a hash of that account, so that applying is held to what was previewed."),
  }),
  OwlClass.make(plan.Source, {
    label: en("Source"),
    subClassOf: [prov.SoftwareAgent],
    definition: en("A program that reads observations from one kind of place and writes patches back to it, with the capabilities it declares."),
  }),
  OwlClass.make(plan.ItemKind, { label: en("Item kind"), subClassOf: [skos.Concept], definition: en("One of the seven kinds of item.") }),
  OwlClass.make(plan.State, { label: en("State"), subClassOf: [skos.Concept], definition: en("One of the four states an item is in, as folded from its events.") }),
  OwlClass.make(plan.CloseReason, { label: en("Close reason"), subClassOf: [skos.Concept], definition: en("One of the reasons an item is closed.") }),
  OwlClass.make(plan.Severity, { label: en("Severity"), subClassOf: [skos.Concept], definition: en("One of the three severities of an item.") }),
  OwlClass.make(plan.Verdict, { label: en("Verdict"), subClassOf: [skos.Concept], definition: en("One of the four verdicts a decision gives.") }),
  OwlClass.make(plan.LinkKind, { label: en("Link kind"), subClassOf: [skos.Concept], definition: en("One of the kinds of link between two items.") }),
  OwlClass.make(plan.Capability, { label: en("Capability"), subClassOf: [skos.Concept], definition: en("One of the things a source can be asked to do.") }),
  OwlClass.make(plan.FieldAuthority, { label: en("Field authority"), subClassOf: [skos.Concept], definition: en("One of the ways the value of a field is settled when sources disagree.") }),
  OwlClass.make(plan.Origin, { label: en("Origin"), subClassOf: [skos.Concept], definition: en("How an item came to be: declared, derived or inferred.") }),
  OwlClass.make(plan.ActorKind, { label: en("Actor kind"), subClassOf: [skos.Concept], definition: en("One of the kinds of actor: person, agent or tool.") }),
  OwlClass.make(plan.LocatorKind, { label: en("Locator kind"), subClassOf: [skos.Concept], definition: en("One of the ways a place is named.") }),
  OwlClass.make(plan.EventType, { label: en("Event type"), subClassOf: [skos.Concept], definition: en("One of the cases of the union an item's history is made of.") }),
] as const;

/** The properties, each with its domain, range and definition. */
export const properties = [
  DatatypeProperty.make(plan.itemId, { domain: plan.Item, range: xsd.string, label: en("item id"), definition: en("The stable id of the item; it does not change when the item moves between places.") }),
  ObjectProperty.make(plan.itemKind, { domain: plan.Item, range: plan.ItemKind, label: en("item kind"), definition: en("The kind of the item.") }),
  ObjectProperty.make(plan.itemState, { domain: plan.Item, range: plan.State, label: en("item state"), definition: en("The state of the item, folded from its events.") }),
  ObjectProperty.make(plan.itemSeverity, { domain: plan.Item, range: plan.Severity, label: en("item severity"), definition: en("The severity of the item.") }),
  ObjectProperty.make(plan.itemCloseReason, { domain: plan.Item, range: plan.CloseReason, label: en("item close reason"), definition: en("Why the item is closed, where it is.") }),
  ObjectProperty.make(plan.itemOrigin, { domain: plan.Item, range: plan.Origin, label: en("item origin"), definition: en("How the item came to be.") }),
  ObjectProperty.make(plan.seenIn, { domain: plan.Item, range: plan.Observation, label: en("seen in"), definition: en("An observation of the item, in one place; an item has one for every place it was seen.") }),
  ObjectProperty.make(plan.eventOf, { domain: plan.Event, range: plan.Item, label: en("event of"), definition: en("The item the event happened to.") }),
  ObjectProperty.make(plan.eventType, { domain: plan.Event, range: plan.EventType, label: en("event type"), definition: en("The case of the union the event is.") }),
  ObjectProperty.make(plan.eventActor, { domain: plan.Event, range: plan.Actor, label: en("event actor"), definition: en("Who wrote the event.") }),
  DatatypeProperty.make(plan.eventAt, { domain: plan.Event, range: xsd.string, label: en("event at"), definition: en("When the event happened: ISO 8601 in UTC to the second.") }),
  ObjectProperty.make(plan.actorKind, { domain: plan.Actor, range: plan.ActorKind, label: en("actor kind"), definition: en("Whether the actor is a person, an agent or a tool.") }),
  DatatypeProperty.make(plan.actorId, { domain: plan.Actor, range: xsd.string, label: en("actor id"), definition: en("The id of the actor.") }),
  DatatypeProperty.make(plan.actorName, { domain: plan.Actor, range: xsd.string, label: en("actor name"), definition: en("The name of the actor.") }),
  ObjectProperty.make(plan.observedBy, { domain: plan.Observation, range: plan.Source, label: en("observed by"), definition: en("The source that read the observation.") }),
  DatatypeProperty.make(plan.observedAt, { domain: plan.Observation, range: xsd.string, label: en("observed at"), definition: en("When the source read it: ISO 8601 in UTC to the second.") }),
  ObjectProperty.make(plan.observationLocator, { domain: plan.Observation, range: plan.Locator, label: en("observation locator"), definition: en("Where the source read it.") }),
  DatatypeProperty.make(plan.contentHash, { domain: plan.Observation, range: xsd.string, label: en("content hash"), definition: en("The SHA-256 of the bytes the observation was read from, so that a change of the place is told from a change of the item.") }),
  DatatypeProperty.make(plan.fingerprint, { domain: plan.Observation, range: xsd.string, label: en("fingerprint"), definition: en("A hash of what identifies the item in its place apart from where in the place it is, so that the identity survives a move.") }),
  ObjectProperty.make(plan.locatorKind, { domain: plan.Locator, range: plan.LocatorKind, label: en("locator kind"), definition: en("The way the place is named.") }),
  DatatypeProperty.make(plan.locatorValue, { domain: plan.Locator, range: xsd.string, label: en("locator value"), definition: en("The name of the place, in the form of its kind.") }),
  ObjectProperty.make(plan.traceItem, { domain: plan.Trace, range: plan.Item, label: en("trace item"), definition: en("The item that was derived.") }),
  ObjectProperty.make(plan.traceObservation, { domain: plan.Trace, range: plan.Observation, label: en("trace observation"), definition: en("The observation it was derived from.") }),
  ObjectProperty.make(plan.linkKind, { domain: plan.Link, range: plan.LinkKind, label: en("link kind"), definition: en("The kind of the link.") }),
  ObjectProperty.make(plan.linkFrom, { domain: plan.Link, range: plan.Item, label: en("link from"), definition: en("The item the link starts at.") }),
  ObjectProperty.make(plan.linkTo, { domain: plan.Link, range: plan.Item, label: en("link to"), definition: en("The item the link ends at.") }),
  ObjectProperty.make(plan.patchTarget, { domain: plan.Patch, range: plan.Source, label: en("patch target"), definition: en("The source the patch is to be written to; a write has an explicit target.") }),
  DatatypeProperty.make(plan.patchOp, { domain: plan.Patch, range: xsd.string, label: en("patch operation"), definition: en("The operation: add-item, change-state, add-event, link or confirm.") }),
  ObjectProperty.make(plan.previewOf, { domain: plan.Preview, range: plan.Patch, label: en("preview of"), definition: en("The patch the preview is about.") }),
  DatatypeProperty.make(plan.previewHash, { domain: plan.Preview, range: xsd.string, label: en("preview hash"), definition: en("The SHA-256 of the preview, which a headless check mode compares with the plan it is told to apply.") }),
  DatatypeProperty.make(plan.sourceName, { domain: plan.Source, range: xsd.string, label: en("source name"), definition: en("The name of the source, as the package that holds it is named.") }),
  ObjectProperty.make(plan.sourceCapability, { domain: plan.Source, range: plan.Capability, label: en("source capability"), definition: en("An ability the source declares.") }),
  ObjectProperty.make(plan.fieldAuthority, { domain: plan.Source, range: plan.FieldAuthority, label: en("field authority"), definition: en("How the source's value of a field is weighed against the store's.") }),
  DatatypeProperty.make(plan.sarifLevel, { domain: plan.Severity, range: xsd.string, label: en("SARIF level"), definition: en("The name of the SARIF result level the severity is: error, warning or note (to verify against the OASIS text); a name and no IRI.") }),
  DatatypeProperty.make(plan.icalStatus, { domain: plan.State, range: xsd.string, label: en("iCalendar status"), definition: en("The name of the iCalendar to-do STATUS the state is closest to (to verify against RFC 5545); a name and no IRI.") }),
  DatatypeProperty.make(plan.webAnnotationMotivation, { domain: plan.ItemKind, range: xsd.string, label: en("Web Annotation motivation"), definition: en("The name of the Web Annotation motivation the kind is closest to (to verify against the W3C text); a name and no IRI.") }),
  DatatypeProperty.make(plan.githubStateReason, { domain: plan.CloseReason, range: xsd.string, label: en("GitHub state reason"), definition: en("The name of the reason GitHub gives for closing an issue, as its interface writes it (to verify against its documentation); a name and no IRI.") }),
] as const;

/** The ontology itself: its label, description and version. */
export const planningOntology = OwlOntology.make(ontologyOf(PLANNING), {
  label: en("Planning"),
  description: en(
    "The vocabulary of Planning: the seven kinds of planning item, the events that make their history and the states folded from them, the actors, the observations of what a source saw and where, the traces and links between items, the patches that write a change back and their previews, the sources that read and write, and the closed code lists the model branches on.",
  ),
  versionInfo: "1.0.0",
  versionIri: named<"owl:Ontology">(iriIn(PLANNINGV, "1.0.0")),
});

// ---- the audit: the basis of every class (0018-standards-first FR-003)

/** The record of a class that specializes a standard's class. */
function specializes(local: keyof typeof plan, standardTerm: string, definedBy: string) {
  return OntologyTerm.make(term(MZID, `term-planning-${local}`), {
    label: en(`plan:${local}`),
    termIri: plan[local].iri,
    basis: bases.Specializes,
    standardTerm,
    mappingRelation: "subClassOf",
    definedBy: [definedBy],
  });
}

const CONCEPT = skos.Concept.iri;

/** The audit of Planning: one record for every class; none is `unaligned`. */
export const terms = [
  specializes("Item", prov.Entity.iri, "0037-planning FR-001"),
  specializes("Event", prov.Activity.iri, "0037-planning FR-003"),
  specializes("Actor", prov.Agent.iri, "0037-planning FR-005"),
  specializes("Observation", prov.Entity.iri, "0037-planning FR-008"),
  specializes("Locator", prov.Entity.iri, "0037-planning FR-008"),
  specializes("Trace", provMore.Derivation.iri, "0037-planning FR-009"),
  specializes("Link", prov.Entity.iri, "0037-planning FR-009"),
  specializes("Patch", prov.Entity.iri, "0037-planning FR-010"),
  specializes("Preview", prov.Entity.iri, "0037-planning FR-011"),
  specializes("Source", prov.SoftwareAgent.iri, "0037-planning FR-013"),
  specializes("ItemKind", CONCEPT, "0037-planning FR-001"),
  specializes("State", CONCEPT, "0037-planning FR-004"),
  specializes("CloseReason", CONCEPT, "0037-planning FR-004"),
  specializes("Severity", CONCEPT, "0037-planning FR-002"),
  specializes("Verdict", CONCEPT, "0037-planning FR-002"),
  specializes("LinkKind", CONCEPT, "0037-planning FR-009"),
  specializes("Capability", CONCEPT, "0037-planning FR-014"),
  specializes("FieldAuthority", CONCEPT, "0037-planning FR-012"),
  specializes("Origin", CONCEPT, "0037-planning FR-006"),
  specializes("ActorKind", CONCEPT, "0037-planning FR-005"),
  specializes("LocatorKind", CONCEPT, "0037-planning FR-008"),
  specializes("EventType", CONCEPT, "0037-planning FR-003"),
] as const;

/** The file this module states: its name, its prefixes and its individuals. */
export const file: OntologyFile = {
  name: "planning",
  prefixes: [PLANNING, PLANNINGV, MZ, MZID, OWL, PROV, RDFS, SKOS, XSD],
  individuals: [
    planningOntology,
    ...classes,
    ...properties,
    ...Object.values(itemKinds),
    ...Object.values(states),
    ...Object.values(closeReasons),
    ...Object.values(severities),
    ...Object.values(verdicts),
    ...Object.values(linkKinds),
    ...Object.values(capabilities),
    ...Object.values(fieldAuthorities),
    ...Object.values(origins),
    ...Object.values(actorKinds),
    ...Object.values(locatorKinds),
    ...Object.values(eventTypes),
    ...terms,
  ],
};
