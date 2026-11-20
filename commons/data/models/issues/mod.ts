// Spec: 0045-issues-model FR-001, FR-002
/**
 * The issues model (commons data 0045-issues-model): the issues that a repository keeps as typed code (0044-issues), as records in a database, so that they can be queried, joined to
 * other data and reported on. The code in git is the source of truth; the records are a copy kept in step by `syncIssues`. It requires nothing, so a project takes it alone or with others.
 *
 * @module
 */
import {
  annotate,
  type AnyConcept,
  attribute,
  boolean,
  codeList,
  codeOf,
  concept,
  defineModule,
  identifier,
  instant,
  integer,
  relationship,
  text,
  vocabularies,
} from "@intellectual-frontiers/data/governance";

const { quality, requirements, security, usage } = vocabularies;
const spec = "0045-issues-model";
const cites = (...frs: readonly string[]) => annotate(requirements.cites, frs.map((f) => `${spec} ${f}`));
const internal = annotate(security.classification, "internal");
const lookup = (...members: readonly string[]) => annotate(usage.lookup, { members });
const unique = (...members: readonly string[]) => annotate(quality.unique, { members });
const keep = (days: number) => annotate(quality.retention, { days });

const list = (name: string, definition: string, codes: Readonly<Record<string, string>>) =>
  codeList(name, {
    definition,
    codes: Object.fromEntries(
      Object.entries(codes).map(([code, d]) => [code, { label: code.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()), definition: d }]),
    ),
    annotations: [annotate(quality.openness, "closed"), cites("FR-001")],
  });

/** How bad an issue is. */
export const severity = list("issueSeverity", "How bad an issue is", { critical: "Breaks a promise", high: "Weakens a promise", medium: "Costs something", low: "Minor" });
/** When it is to be done. */
export const priority = list("issuePriority", "When it is to be done", { p1: "Before the next release", p2: "The release after", p3: "When convenient" });
/** How much work the fix is. */
export const size = list("issueSize", "How much work the fix is", { xs: "Hours", s: "A day", m: "A few days", l: "A week or more", xl: "A project" });
/** Where an issue is. */
export const statusKind = list("issueStatusKind", "Where an issue is", {
  open: "To be done",
  inProgress: "Being done",
  fixed: "Done, with a proof",
  wontFix: "Will not be done, with a reason",
  notADefect: "Not a defect, with a reason",
  duplicate: "Another issue says the same",
  deferred: "Later, with a reason",
});
/** Whether the code still has the issue. */
export const presence = list("issuePresence", "Whether the code still has the issue", { present: "It is in the code", withdrawn: "It is no longer in the code" });
/** What kind of evidence. */
export const evidenceKind = list("issueEvidenceKind", "What kind of evidence", { commit: "A commit", test: "A test", spec: "A specification", file: "A place in a file", review: "A review" });
/** How two issues are related. */
export const linkKind = list("issueLinkKind", "How two issues are related", { blocks: "One must be done first", relates: "They touch the same thing", causedBy: "One is the cause of the other" });
/** What the library is meant to be. */
export const goal = list("issueGoal", "What the library is meant to be", { g1: "Reliable", g2: "Secure", g3: "Type safe", g4: "Portable", g5: "Verifiable", g6: "Usable", g7: "Evolvable", g8: "Operable" });
/** One known weakness of a library or a module, as the code of the repository says it. */
export const syncOutcome = list("issueSyncOutcome", "What a synchronisation did", { synced: "Records were changed", unchanged: "The records already matched" });

const key = (what: string) => attribute(identifier(), { definition: `What identifies ${what}` });
const req = (t: Parameters<typeof attribute>[0], definition: string) => attribute(t, { definition });
const opt = (t: Parameters<typeof attribute>[0], definition: string) => attribute(t, { definition, multiplicity: "optional" });
const one = (to: AnyConcept | (() => AnyConcept), definition: string) => relationship(to, { cardinality: "one", definition });

/** An issue: one known weakness of a library or a module. */
export const issue: AnyConcept = concept("issue", {
  definition: "One known weakness of a library or a module, as the code of the repository says it",
  attributes: {
    issueId: key("the issue: its scope and number"),
    scope: req(text(), "The library or module it is of, by its path"),
    number: req(integer(), "Its number within the scope"),
    slug: req(text(), "Its name in words joined by hyphens"),
    title: req(text(), "What it is, in a line"),
    summary: req(text(), "What is wrong and why it matters"),
    severity: req(codeOf(severity), "How bad it is"),
    priority: req(codeOf(priority), "When it is to be done"),
    size: req(codeOf(size), "How much work the fix is"),
    statusKind: req(codeOf(statusKind), "Where it is"),
    statusReason: opt(text(), "Why, for a status that needs a reason"),
    statusProof: opt(text(), "What shows it is done, for one that is fixed"),
    duplicateOf: opt(integer(), "The number of the issue it duplicates"),
    appliesToAll: req(boolean(), "Whether it is about every engine; where not, the engines are listed"),
    raised: req(text(), "The day it was raised"),
    contentHash: req(text(), "A hash of what the code says of it, so that a change is seen"),
    presence: req(codeOf(presence), "Whether the code still has it"),
    syncedAt: req(instant(), "When a synchronisation last wrote it"),
  },
  identifiedBy: ["issueId"],
  relationships: {},
  annotations: [internal, keep(3650), cites("FR-002"), unique("scope", "number"), lookup("scope", "statusKind", "priority")],
});

const child = (name: string, definition: string, attributes: Record<string, ReturnType<typeof attribute>>, ...more: ReturnType<typeof annotate>[]): AnyConcept =>
  concept(name, {
    definition,
    attributes: { [`${name}Id`]: key(`the ${definition.toLowerCase()}`), ...attributes },
    identifiedBy: [`${name}Id`],
    relationships: { issue: one(issue, "The issue it is of") },
    annotations: [internal, keep(3650), cites("FR-002"), lookup("issue"), ...more],
  });

/** How an issue is related to another of its scope. */
export const issueGoal: AnyConcept = child("issueGoal", "A goal an issue is held against", { goal: req(codeOf(goal), "The goal") }, unique("issue", "goal"));
/** How an issue is related to another of its scope. */
export const issueEngine: AnyConcept = child("issueEngine", "An engine an issue is about", { engine: req(text(), "The engine, as a dialect is named") }, unique("issue", "engine"));
/** How an issue is related to another of its scope. */
export const issueEvidence: AnyConcept = child("issueEvidence", "A piece of evidence of an issue", {
  position: req(integer(), "Its place among the evidence"),
  kind: req(codeOf(evidenceKind), "What kind"),
  reference: req(text(), "A sha, a test's file and title, a specification, a place in a file or a review"),
});
/** How an issue is related to another of its scope. */
export const issueLink: AnyConcept = concept("issueLink", {
  definition: "How an issue is related to another of its scope",
  attributes: { issueLinkId: key("the link"), kind: req(codeOf(linkKind), "How they are related") },
  identifiedBy: ["issueLinkId"],
  relationships: { issue: one(issue, "The issue"), target: one(issue, "The issue it is related to") },
  annotations: [internal, keep(3650), cites("FR-002"), lookup("issue", "target")],
});
/** One synchronisation of the records with the code, kept as a ledger. */
export const issueSync: AnyConcept = concept("issueSync", {
  definition: "One synchronisation of the records with the code, kept as a ledger",
  attributes: {
    issueSyncId: key("the synchronisation"),
    scope: req(text(), "The scope synchronised"),
    sourceHash: req(text(), "A hash of the issues of the code at the time"),
    ranAt: req(instant(), "When it ran"),
    outcome: req(codeOf(syncOutcome), "What it did"),
    inserted: req(integer(), "How many records it added"),
    updated: req(integer(), "How many it changed"),
    withdrawn: req(integer(), "How many it marked as no longer in the code"),
    reopened: req(integer(), "How many that were withdrawn it brought back"),
  },
  identifiedBy: ["issueSyncId"],
  relationships: {},
  annotations: [internal, keep(3650), cites("FR-003"), lookup("scope")],
});

/** The issues model: issues, their goals, engines, evidence and links, and a ledger of synchronisations. */
export const issuesModule = defineModule({
  name: "issues",
  definition: "The issues a repository keeps as code, as records",
  requires: [],
  concepts: [issue, issueGoal, issueEngine, issueEvidence, issueLink, issueSync],
  codeLists: [severity, priority, size, statusKind, presence, evidenceKind, linkKind, goal, syncOutcome],
});
