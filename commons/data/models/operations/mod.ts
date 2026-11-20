// Spec: 0063-operating-model FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007
/**
 * The operations model (commons data 0063-operating-model): what it takes to run a data platform in a way that can be audited. What the work is waiting on and for whom, the decisions made and what replaced them, the limits and
 * expiries that will stop it, the copies of data that exist, the environments and what was released and promoted to them, the workloads it runs, and the signals it emits and the freshness it is held to. It names no domain
 * and requires nothing.
 *
 * @module
 */
import {
  annotate,
  type AnyConcept,
  attribute,
  codeList,
  codeOf,
  concept,
  defineModule,
  identifier,
  instant,
  boolean,
  integer,
  relationship,
  text,
  vocabularies,
} from "@intellectual-frontiers/data/governance";

const { quality, requirements, security, usage } = vocabularies;
const spec = "0063-operating-model";
const cites = (...frs: readonly string[]) => annotate(requirements.cites, frs.map((f) => `${spec} ${f}`));
const internal = annotate(security.classification, "internal");
const lookup = (...members: readonly string[]) => annotate(usage.lookup, { members });
const unique = (...members: readonly string[]) => annotate(quality.unique, { members });
const keep = (days: number) => annotate(quality.retention, { days });

const list = (name: string, definition: string, codes: Readonly<Record<string, string>>, openness: "open" | "closed" = "closed") =>
  codeList(name, {
    definition,
    codes: Object.fromEntries(Object.entries(codes).map(([code, d]) => [code, { label: code.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()), definition: d }])),
    annotations: [annotate(quality.openness, openness), cites("FR-001")],
  });

/** Where something waited on is. */
export const waitingStatus = list("waitingStatus", "Where a thing the work waits on is", { open: "Still waited on", resolved: "It came", cancelled: "No longer needed" });
/** Where a decision is. */
export const decisionStatus = list("decisionStatus", "Where a decision record is", { proposed: "Put forward and not decided", accepted: "Decided, and in force", rejected: "Decided against", superseded: "Replaced by a later decision" });
/** What runs out. */
export const limitKind = list("limitKind", "What kind of thing has a limit or an expiry", { certificate: "A certificate", credential: "A key, a token or a password", quota: "A quota or a capacity", license: "A licence or a subscription", agreement: "A contract or an agreement" });
/** What an environment is for. */
export const environmentKind = list("environmentKind", "What an environment is for, in the order a release is promoted through them", { development: "Where it is made", test: "Where it is tested", staging: "Where it is rehearsed", production: "Where it is used" });
/** What a signal is. */
export const signalKind = list("signalKind", "What kind of measurement a signal is", { counter: "A count that only goes up", gauge: "A value that goes up and down", histogram: "A distribution of values", event: "Something that happened" });

const key = (what: string) => attribute(identifier(), { definition: `What identifies ${what}` });
const req = (t: Parameters<typeof attribute>[0], definition: string) => attribute(t, { definition });
const opt = (t: Parameters<typeof attribute>[0], definition: string) => attribute(t, { definition, multiplicity: "optional" });
const one = (to: AnyConcept | (() => AnyConcept), definition: string) => relationship(to, { cardinality: "one", definition });
const maybe = (to: AnyConcept | (() => AnyConcept), definition: string) => relationship(to, { cardinality: "optional", definition });

/** Something the work waits on. */
export const waiting: AnyConcept = concept("waiting", {
  definition: "A precondition the work waits on, from whom, since when and by when it is needed: the waiting-on ledger, whose status is computed from its dates",
  attributes: {
    waitingId: key("the wait"),
    what: req(text(), "What is waited on"),
    onWhom: req(text(), "Who must give it"),
    since: req(instant(), "Since when it is waited on"),
    neededBy: opt(instant(), "By when it is needed"),
    status: req(codeOf(waitingStatus), "Where it is"),
    resolvedAt: opt(instant(), "When it came"),
  },
  identifiedBy: ["waitingId"],
  relationships: {},
  annotations: [internal, keep(1095), cites("FR-001"), lookup("onWhom", "status")],
});

/** A decision, and what it replaced. */
export const decision: AnyConcept = concept("decision", {
  definition: "A decision that shaped the platform, with its context, what was decided and what follows from it, so that a later person finds out why and not only what",
  attributes: {
    decisionId: key("the decision"),
    title: req(text(), "What was decided, in a line"),
    context: req(text(), "What made it necessary"),
    outcome: req(text(), "What was decided"),
    consequences: opt(text(), "What follows from it"),
    status: req(codeOf(decisionStatus), "Where it is"),
    decidedBy: opt(text(), "Who decided"),
    decidedAt: opt(instant(), "When"),
  },
  identifiedBy: ["decisionId"],
  relationships: { supersedes: maybe(() => decision, "The decision this one replaced") },
  annotations: [internal, keep(3650), cites("FR-002"), lookup("status")],
});

/** A limit or an expiry that will stop the work. */
export const limit: AnyConcept = concept("limit", {
  definition: "A certificate, key, quota, licence or agreement that runs out or fills, with when and who renews it: the inventory of what will stop the platform if nobody acts",
  attributes: { limitId: key("the limit"), name: req(text(), "What it is"), kind: req(codeOf(limitKind), "What kind it is"), expiresAt: opt(instant(), "When it runs out"), owner: req(text(), "Who renews it"), renewalLeadDays: req(integer(), "How many days before it runs out someone must act") },
  identifiedBy: ["limitId"],
  relationships: {},
  annotations: [internal, keep(1095), cites("FR-003"), lookup("kind", "owner", "expiresAt")],
});

/** A copy of a dataset that exists somewhere. */
export const dataCopy: AnyConcept = concept("dataCopy", {
  definition: "A copy of a dataset in a place, with why it exists, who answers for it and when it was last refreshed: what makes the copies of the data known and not only the original",
  attributes: { dataCopyId: key("the copy"), dataset: req(text(), "The dataset it is a copy of"), location: req(text(), "Where it is"), purpose: req(text(), "Why it exists"), owner: opt(text(), "Who answers for it"), classification: req(text(), "How sensitive it is"), refreshedAt: opt(instant(), "When it was last refreshed") },
  identifiedBy: ["dataCopyId"],
  relationships: {},
  annotations: [internal, keep(1095), cites("FR-004"), lookup("dataset", "owner")],
});

/** An environment. */
export const runtimeEnvironment: AnyConcept = concept("runtimeEnvironment", {
  definition: "An environment a release is promoted through, what it is for, whether it holds real data and who answers for it",
  attributes: { runtimeEnvironmentId: key("the environment"), name: req(text(), "Its name"), kind: req(codeOf(environmentKind), "What it is for"), holdsRealData: req(boolean(), "Whether it holds real data"), owner: req(text(), "Who answers for it") },
  identifiedBy: ["runtimeEnvironmentId"],
  relationships: {},
  annotations: [internal, keep(1095), cites("FR-005"), unique("name"), lookup("kind")],
});

/** One version of something that is released. */
export const release: AnyConcept = concept("release", {
  definition: "One version of an artifact (a pipeline, a model, a schema) that was cut for release, with when and what evidence it carries",
  attributes: { releaseId: key("the release"), artifact: req(text(), "What was released"), version: req(text(), "Its version"), cutAt: req(instant(), "When it was cut"), evidenceRef: opt(text(), "The test run or report that backs it") },
  identifiedBy: ["releaseId"],
  relationships: {},
  annotations: [internal, keep(3650), cites("FR-005"), unique("artifact", "version"), lookup("artifact")],
});

/** A release arriving in an environment. */
export const promotion: AnyConcept = concept("promotion", {
  definition: "A release arriving in an environment, with who promoted it, when and the evidence: the promotion log, only ever added to",
  attributes: { promotionId: key("the promotion"), promotedBy: req(text(), "Who did it"), promotedAt: req(instant(), "When"), evidenceRef: opt(text(), "The evidence for it") },
  identifiedBy: ["promotionId"],
  relationships: { release: one(release, "What was promoted"), target: one(runtimeEnvironment, "Where it went") },
  annotations: [internal, keep(3650), cites("FR-005"), annotate(quality.appendOnly, {}), lookup("release", "target")],
});

/** A workload the platform runs. */
export const workload: AnyConcept = concept("workload", {
  definition: "A job, query set or service the platform runs, with who owns it, how often it runs and how critical it is: the register that capacity, cost and recovery are planned from",
  attributes: { workloadId: key("the workload"), name: req(text(), "Its name"), owner: req(text(), "Who owns it"), schedule: req(text(), "When it runs, in words or a cron"), criticality: req(integer(), "How critical it is, 1 the most") },
  identifiedBy: ["workloadId"],
  relationships: {},
  annotations: [internal, keep(1095), cites("FR-006"), unique("name"), lookup("owner")],
});

/** A statement of a workload, with what it gave. */
export const workloadStatement: AnyConcept = concept("workloadStatement", {
  definition: "A read-only statement of a workload with the number of rows and the hash of the rows it gave when it was recorded, to be replayed and compared",
  attributes: { workloadStatementId: key("the statement"), statement: req(text(), "The statement, a single select"), baselineRows: req(integer(), "How many rows it gave"), baselineHash: req(text(), "The SHA-256 of the rows it gave") },
  identifiedBy: ["workloadStatementId"],
  relationships: { workload: one(workload, "The workload it belongs to") },
  annotations: [internal, keep(1095), cites("FR-006"), lookup("workload")],
});

/** A signal the platform emits. */
export const signal: AnyConcept = concept("signal", {
  definition: "A measurement the platform emits: its name, its kind, its unit and the attributes it carries, so that every emitter and every alert agree on what it is",
  attributes: { signalId: key("the signal: its name"), kind: req(codeOf(signalKind), "What kind of measurement"), unit: req(text(), "The unit"), attributeNames: req(text(), "The attributes it carries, separated by commas"), meaning: req(text(), "What it measures"), owner: req(text(), "Who answers for it") },
  identifiedBy: ["signalId"],
  relationships: {},
  annotations: [internal, keep(1095), cites("FR-007"), lookup("kind", "owner")],
});

/** How fresh a source must be. */
export const freshnessRule: AnyConcept = concept("freshnessRule", {
  definition: "How old the latest load of a source may be before it is stale: the expectation that source freshness is held to",
  attributes: { freshnessRuleId: key("the source"), source: req(text(), "The source, as a load names it"), maxAgeHours: req(integer(), "How many hours old its latest load may be"), owner: req(text(), "Who is told when it is stale") },
  identifiedBy: ["freshnessRuleId"],
  relationships: {},
  annotations: [internal, keep(1095), cites("FR-007"), unique("source"), lookup("source")],
});

/** The operations model. */
export const operationsModule = defineModule({
  name: "operations",
  definition: "How a data platform is run and shown to be run",
  requires: [],
  concepts: [waiting, decision, limit, dataCopy, runtimeEnvironment, release, promotion, workload, workloadStatement, signal, freshnessRule],
  codeLists: [waitingStatus, decisionStatus, limitKind, environmentKind, signalKind],
});
