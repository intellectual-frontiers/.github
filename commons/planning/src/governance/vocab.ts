// Spec: 0002-planning-core FR-001
/**
 * The closed lists of Planning, each a union of literals with one registry entry for each case (commons 0037-planning FR-002, FR-041). A registry entry names the member of the ontology `plan:` the case is
 * (`ontology`), so that the code and the ontology cannot drift apart, and carries the name another standard gives the case where the ontology has one. A value that is not in a list does not compile, and a
 * value read from outside is an error value of `parse`.
 *
 * @example
 * ```ts
 * import { SEVERITIES, severity } from "./vocab.ts";
 * severity.parse("warning"); // { kind: "ok", value: "warning" }
 * severity.parse("fatal"); // { kind: "err", error: { kind: "not-in-list", list: "severity", text: "fatal", expected: SEVERITIES } }
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";

/** A text that is not a case of a closed list. */
export type ListProblem = { readonly kind: "not-in-list"; readonly list: string; readonly text: string; readonly expected: readonly string[] };

/** A closed list: its name, its cases, a guard and a parser. */
export type ClosedList<L extends string> = {
  readonly name: string;
  readonly cases: readonly L[];
  readonly is: (value: unknown) => value is L;
  readonly parse: (value: unknown) => Result<L, ListProblem>;
};

function closedList<const C extends readonly string[]>(name: string, cases: C): ClosedList<C[number]> {
  const is = (value: unknown): value is C[number] => typeof value === "string" && cases.includes(value);
  return {
    name,
    cases,
    is,
    parse: (value) => (is(value) ? ok(value) : err({ kind: "not-in-list", list: name, text: typeof value === "string" ? value : JSON.stringify(value) ?? String(value), expected: cases })),
  };
}

/** What every registry entry says: the member of the ontology `plan:` the case is. */
export type Entry = { readonly ontology: string };

/** The four kinds of item (0037-planning FR-001). */
export const ITEM_KINDS = ["issue", "task", "todo", "finding"] as const;
/** One kind of item. */
export type ItemKind = (typeof ITEM_KINDS)[number];
/** The list of the kinds of item. */
export const itemKind = closedList("item kind", ITEM_KINDS);
/** One entry for each kind of item; a finding is the kind whose Web Annotation motivation is `assessing`. */
export const ITEM_KIND_REGISTRY: { readonly [K in ItemKind]: Entry & { readonly webAnnotationMotivation?: string } } = {
  issue: { ontology: "Issue" },
  task: { ontology: "Task" },
  todo: { ontology: "Todo" },
  finding: { ontology: "Finding", webAnnotationMotivation: "assessing" },
};

/** The five states of an item (0037-planning FR-004). */
export const STATE_KINDS = ["proposed", "open", "in-progress", "deferred", "closed"] as const;
/** One state of an item. */
export type StateKind = (typeof STATE_KINDS)[number];
/** The list of the states. */
export const stateKind = closedList("state", STATE_KINDS);
/** One entry for each state, with the iCalendar `STATUS` it is closest to where there is one (RFC 5545 section 3.8.1.11). */
export const STATE_REGISTRY: { readonly [K in StateKind]: Entry & { readonly icalStatus?: string } } = {
  proposed: { ontology: "Proposed" },
  open: { ontology: "Open", icalStatus: "NEEDS-ACTION" },
  "in-progress": { ontology: "InProgress", icalStatus: "IN-PROCESS" },
  deferred: { ontology: "Deferred" },
  closed: { ontology: "Closed" },
};

/** The three reasons an item is closed. */
export const CLOSE_REASONS = ["completed", "not-planned", "duplicate"] as const;
/** One reason an item is closed. */
export type CloseReason = (typeof CLOSE_REASONS)[number];
/** The list of the close reasons. */
export const closeReason = closedList("close reason", CLOSE_REASONS);
/** One entry for each close reason, with the `state_reason` GitHub gives it (REST API 2026-03-10, update an issue). */
export const CLOSE_REASON_REGISTRY: { readonly [K in CloseReason]: Entry & { readonly githubStateReason: string } } = {
  completed: { ontology: "Completed", githubStateReason: "completed" },
  "not-planned": { ontology: "NotPlanned", githubStateReason: "not_planned" },
  duplicate: { ontology: "Duplicate", githubStateReason: "duplicate" },
};

/** The three severities: the SARIF result levels that apply where the kind of a result is `fail` (SARIF 2.1.0 sections 3.27.9, 3.27.10). */
export const SEVERITIES = ["error", "warning", "note"] as const;
/** One severity. */
export type Severity = (typeof SEVERITIES)[number];
/** The list of the severities. */
export const severity = closedList("severity", SEVERITIES);
/** One entry for each severity, with the SARIF `level` it is. */
export const SEVERITY_REGISTRY: { readonly [K in Severity]: Entry & { readonly sarifLevel: string } } = {
  error: { ontology: "Error", sarifLevel: "error" },
  warning: { ontology: "Warning", sarifLevel: "warning" },
  note: { ontology: "Note", sarifLevel: "note" },
};

/** The four verdicts of a decided event. */
export const VERDICTS = ["accept", "minor-revision", "major-revision", "reject"] as const;
/** One verdict. */
export type Verdict = (typeof VERDICTS)[number];
/** The list of the verdicts. */
export const verdict = closedList("verdict", VERDICTS);
/** One entry for each verdict. */
export const VERDICT_REGISTRY: { readonly [K in Verdict]: Entry } = {
  accept: { ontology: "Accept" },
  "minor-revision": { ontology: "MinorRevision" },
  "major-revision": { ontology: "MajorRevision" },
  reject: { ontology: "Reject" },
};

/** The four kinds of link between two items. */
export const LINK_KINDS = ["blocks", "same-as", "relates-to", "parent-of"] as const;
/** One kind of link. */
export type LinkKind = (typeof LINK_KINDS)[number];
/** The list of the kinds of link. */
export const linkKind = closedList("link kind", LINK_KINDS);
/** One entry for each kind of link. */
export const LINK_KIND_REGISTRY: { readonly [K in LinkKind]: Entry } = {
  blocks: { ontology: "Blocks" },
  "same-as": { ontology: "SameAs" },
  "relates-to": { ontology: "RelatesTo" },
  "parent-of": { ontology: "ParentOf" },
};

/** The seven abilities of a source. */
export const CAPABILITIES = ["read", "create", "append-event", "edit", "close", "assign", "delete"] as const;
/** One ability of a source. */
export type Capability = (typeof CAPABILITIES)[number];
/** The list of the capabilities. */
export const capability = closedList("capability", CAPABILITIES);
/** One entry for each capability. */
export const CAPABILITY_REGISTRY: { readonly [K in Capability]: Entry } = {
  read: { ontology: "Read" },
  create: { ontology: "Create" },
  "append-event": { ontology: "AppendEvent" },
  edit: { ontology: "Edit" },
  close: { ontology: "Close" },
  assign: { ontology: "Assign" },
  delete: { ontology: "Delete" },
};

/** The four ways the value of a field is settled when sources disagree (0037-planning FR-012). */
export const FIELD_AUTHORITIES = ["source-wins", "store-wins", "latest-wins", "person-only"] as const;
/** One authority over a field. */
export type FieldAuthority = (typeof FIELD_AUTHORITIES)[number];
/** The list of the authorities. */
export const fieldAuthority = closedList("field authority", FIELD_AUTHORITIES);
/** One entry for each authority. */
export const FIELD_AUTHORITY_REGISTRY: { readonly [K in FieldAuthority]: Entry } = {
  "source-wins": { ontology: "SourceWins" },
  "store-wins": { ontology: "StoreWins" },
  "latest-wins": { ontology: "LatestWins" },
  "person-only": { ontology: "PersonOnly" },
};

/** The three ways an item came to be. */
export const ORIGINS = ["declared", "derived", "inferred"] as const;
/** One origin. */
export type Origin = (typeof ORIGINS)[number];
/** The list of the origins. */
export const origin = closedList("origin", ORIGINS);
/** One entry for each origin. */
export const ORIGIN_REGISTRY: { readonly [K in Origin]: Entry } = {
  declared: { ontology: "Declared" },
  derived: { ontology: "Derived" },
  inferred: { ontology: "Inferred" },
};

/** The three kinds of actor. */
export const ACTOR_KINDS = ["person", "agent", "tool"] as const;
/** One kind of actor. */
export type ActorKind = (typeof ACTOR_KINDS)[number];
/** The list of the kinds of actor. */
export const actorKind = closedList("actor kind", ACTOR_KINDS);
/** One entry for each kind of actor. */
export const ACTOR_KIND_REGISTRY: { readonly [K in ActorKind]: Entry } = {
  person: { ontology: "ByPerson" },
  agent: { ontology: "ByAgent" },
  tool: { ontology: "ByTool" },
};

/** The three ways a place is named. */
export const LOCATOR_KINDS = ["file-span", "url", "commit"] as const;
/** One way a place is named. */
export type LocatorKind = (typeof LOCATOR_KINDS)[number];
/** The list of the kinds of locator. */
export const locatorKind = closedList("locator kind", LOCATOR_KINDS);
/** One entry for each kind of locator. */
export const LOCATOR_KIND_REGISTRY: { readonly [K in LocatorKind]: Entry } = {
  "file-span": { ontology: "FileSpan" },
  url: { ontology: "Url" },
  commit: { ontology: "Commit" },
};

/** The fourteen types of event: the cases of the union an item's history is made of (0037-planning FR-003). */
export const EVENT_TYPES = ["opened", "commented", "edited", "labeled", "assigned", "severity-set", "blocker-set", "started", "deferred", "closed", "reopened", "decided", "linked", "confirmed"] as const;
/** One type of event. */
export type EventType = (typeof EVENT_TYPES)[number];
/** The list of the types of event. */
export const eventType = closedList("event type", EVENT_TYPES);
/** One entry for each type of event. */
export const EVENT_TYPE_REGISTRY: { readonly [K in EventType]: Entry } = {
  opened: { ontology: "OpenedEvent" },
  commented: { ontology: "CommentedEvent" },
  edited: { ontology: "EditedEvent" },
  labeled: { ontology: "LabeledEvent" },
  assigned: { ontology: "AssignedEvent" },
  "severity-set": { ontology: "SeveritySetEvent" },
  "blocker-set": { ontology: "BlockerSetEvent" },
  started: { ontology: "StartedEvent" },
  deferred: { ontology: "DeferredEvent" },
  closed: { ontology: "ClosedEvent" },
  reopened: { ontology: "ReopenedEvent" },
  decided: { ontology: "DecidedEvent" },
  linked: { ontology: "LinkedEvent" },
  confirmed: { ontology: "ConfirmedEvent" },
};

/** The four ways the principal of an agent is established (0037-planning FR-045). */
export const PRINCIPAL_BASES = ["session", "argument", "configuration", "commit-author"] as const;
/** One way a principal is established. */
export type PrincipalBasis = (typeof PRINCIPAL_BASES)[number];
/** The list of the bases of a principal. */
export const principalBasis = closedList("principal basis", PRINCIPAL_BASES);
/** One entry for each basis of a principal. */
export const PRINCIPAL_BASIS_REGISTRY: { readonly [K in PrincipalBasis]: Entry } = {
  session: { ontology: "Session" },
  argument: { ontology: "Argument" },
  configuration: { ontology: "Configuration" },
  "commit-author": { ontology: "CommitAuthor" },
};

/** The fields of an item whose value a field authority settles (0037-planning FR-012): the title, the body, the labels, the assignees, the severity, the blocker flag and the state. */
export const AUTHORITY_FIELDS = ["title", "body", "labels", "assignees", "severity", "blocker", "state"] as const;
/** One field that an authority settles. */
export type AuthorityField = (typeof AUTHORITY_FIELDS)[number];
/** The list of the fields an authority settles. */
export const authorityField = closedList("authority field", AUTHORITY_FIELDS);
