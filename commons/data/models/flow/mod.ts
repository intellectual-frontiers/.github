// Spec: 0060-flow-ledger FR-001, FR-002, FR-003, FR-004, FR-005
/**
 * The flow model (commons data 0060-flow-ledger): what it takes to say, for any message or batch that was accepted, how far it got and why it stopped. It is the stage-contract ledger of the book "Accepted Is Not Correct" (chapter 1)
 * with its load IDs, the idempotent intake of chapter 6 (a delivery is first, a duplicate or a conflict) and the reconciliation of chapter 11 (a manifest, the counts at each stage and the reason-coded losses, so that nothing is
 * unexplained). It names no domain: a message, a batch and an entity are what a pipeline moves. It requires nothing, so a project takes it alone or with others.
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
  integer,
  relationship,
  text,
  vocabularies,
} from "@intellectual-frontiers/data/governance";

const { quality, requirements, security, usage } = vocabularies;
const spec = "0060-flow-ledger";
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

/** The stages a message passes, each in its own terms of success. */
export const stage = list("stage", "A stage of a pipeline, which reports success in its own terms", {
  received: "The pipeline has the bytes",
  captured: "The original is kept, so that it can be replayed",
  parsed: "The syntax is read",
  mapped: "The meaning is mapped to the canonical form",
  validated: "The rules of the contract are met",
  forwarded: "It has been sent on",
  destVerdict: "The destination has said what it made of it",
  usable: "A consumer can use the result",
});
/** What a stage says of one thing. */
export const outcome = list("outcome", "What a stage confirmed of a message, a batch or an entity", {
  passed: "The stage did its work",
  failed: "The stage could not do its work",
  rejected: "The stage or the destination refused it",
  accepted: "The destination accepted it",
  unusable: "It was accepted and a consumer cannot use it",
});
/** How much a ledger row stands for. */
export const grain = list("grain", "What a ledger row is about", { message: "One message", batch: "One batch, with the number of entities it carried", entity: "One entity that a stage can drop or change" });
/** Why a load was made. */
export const loadType = list("loadType", "What kind of load it is", { delivery: "One delivery by a sender", backfill: "A historical load", incremental: "The increments that follow a backfill", replay: "A redelivery from the raw copy" });
/** What an intake found. */
export const disposition = list("disposition", "What the intake of a delivery found", { first: "The first time this message was seen", duplicate: "The same message with the same content again", conflict: "The same message with other content" });
/** Where a conflict is. */
export const conflictStatus = list("conflictStatus", "Where a conflict is", { open: "Nobody has decided", kept: "The original was kept", replaced: "The new content was taken as a new version" });
/** Who produces a reason code. */
export const producer = list("producer", "Who produces a reason code", { pipeline: "This pipeline", integration: "An integration library (a validation finding, an acknowledgement kind)", destination: "The destination" }, "open");

const key = (what: string) => attribute(identifier(), { definition: `What identifies ${what}` });
const req = (t: Parameters<typeof attribute>[0], definition: string) => attribute(t, { definition });
const opt = (t: Parameters<typeof attribute>[0], definition: string) => attribute(t, { definition, multiplicity: "optional" });
const one = (to: AnyConcept | (() => AnyConcept), definition: string) => relationship(to, { cardinality: "one", definition });
const maybe = (to: AnyConcept | (() => AnyConcept), definition: string) => relationship(to, { cardinality: "optional", definition });

/** A reason a stage stopped something: a code, whose meaning is data. */
export const reason: AnyConcept = concept("reason", {
  definition: "A reason code that says why a stage stopped, rejected or lost something, so that no loss is unexplained",
  attributes: { reasonId: key("the reason: its code"), meaning: req(text(), "What it means, in a sentence"), producedBy: req(codeOf(producer), "Who produces it"), stage: opt(codeOf(stage), "The stage it is of, where it is of one") },
  identifiedBy: ["reasonId"],
  relationships: {},
  annotations: [internal, keep(3650), cites("FR-002"), lookup("producedBy")],
});

/** A load: what is given an id at the first stage and carried on every later row and effect. */
export const load: AnyConcept = concept("load", {
  definition: "One load: an id given at the first stage and carried on every row and effect it makes, so that it can be traced and undone as one",
  attributes: {
    loadId: key("the load"),
    loadType: req(codeOf(loadType), "What kind of load it is"),
    tenant: opt(text(), "The tenant it is for"),
    source: req(text(), "The sender or system it came from"),
    startedAt: req(instant(), "When it began"),
    rolledBackAt: opt(instant(), "When it was undone, where it was"),
  },
  identifiedBy: ["loadId"],
  relationships: {},
  annotations: [internal, keep(3650), cites("FR-003"), lookup("tenant", "source")],
});

/** The contract of a stage: what it guarantees in and out, and how its failure is found. */
export const stageContract: AnyConcept = concept("stageContract", {
  definition: "What a stage guarantees to the stage after it, the outcome codes it may give and how its failure is detected: the stage-contract table of a pipeline",
  attributes: {
    stageContractId: key("the contract: its pipeline and stage"),
    pipeline: req(text(), "The pipeline it is of"),
    stage: req(codeOf(stage), "The stage"),
    inputGuarantee: req(text(), "What it may assume of what it is given"),
    outputGuarantee: req(text(), "What it guarantees of what it gives"),
    owner: req(text(), "Who answers for it"),
    detection: req(text(), "How a failure of it is found"),
    grain: req(codeOf(grain), "What a ledger row of it stands for"),
  },
  identifiedBy: ["stageContractId"],
  relationships: {},
  annotations: [internal, keep(3650), cites("FR-004"), unique("pipeline", "stage"), lookup("pipeline", "stage")],
});

/** A row of the ledger: what one stage confirmed of one thing. Only ever added. */
export const ledgerEntry: AnyConcept = concept("ledgerEntry", {
  definition: "What one stage confirmed of one message, batch or entity, with the load it was in: a row of the stage ledger, only ever added",
  attributes: {
    ledgerEntryId: key("the row"),
    subject: req(text(), "The message, batch or entity it is about"),
    stage: req(codeOf(stage), "The stage"),
    outcome: req(codeOf(outcome), "What it confirmed"),
    grain: req(codeOf(grain), "What the row stands for"),
    entities: opt(integer(), "The entities a batch carried at this stage"),
    at: req(instant(), "When"),
  },
  identifiedBy: ["ledgerEntryId"],
  relationships: { load: one(load, "The load it was in"), reason: maybe(reason, "Why, where it did not pass") },
  annotations: [internal, keep(3650), cites("FR-004"), annotate(quality.appendOnly, {}), lookup("subject", "stage", "outcome", "load")],
});

/** The idempotent intake of a delivery: the first time a message was seen, and how many times since. */
export const delivery: AnyConcept = concept("delivery", {
  definition: "A message as it first arrived, with the hash of its content and how many times it has been delivered: the intake that makes a redelivery safe",
  attributes: {
    deliveryId: key("the message: its tenant and the id its sender gave it"),
    tenant: req(text(), "The tenant"),
    senderMessageId: req(text(), "The id the sender gave it"),
    contentSha256: req(text(), "The SHA-256 of its content, as first delivered"),
    deliveryCount: req(integer(), "How many times the same content has been delivered"),
    firstSeen: req(instant(), "When it was first seen"),
  },
  identifiedBy: ["deliveryId"],
  relationships: { firstLoad: one(load, "The load of its first delivery") },
  annotations: [internal, keep(3650), cites("FR-005"), unique("tenant", "senderMessageId"), lookup("tenant", "firstLoad")],
});

/** A delivery with the same id and other content: never overwritten, kept to be decided. */
export const deliveryConflict: AnyConcept = concept("deliveryConflict", {
  definition: "A delivery that had the id of one already taken and other content: the original is kept and this is queued to be decided",
  attributes: {
    deliveryConflictId: key("the conflict"),
    incomingSha256: req(text(), "The SHA-256 of the content that conflicts"),
    status: req(codeOf(conflictStatus), "Where it is"),
    seenAt: req(instant(), "When it was seen"),
  },
  identifiedBy: ["deliveryConflictId"],
  relationships: { delivery: one(delivery, "The message it conflicts with"), load: one(load, "The load that brought it") },
  annotations: [internal, keep(3650), cites("FR-005"), lookup("delivery", "status")],
});

/** What a sender says it sent. */
export const manifest: AnyConcept = concept("manifest", {
  definition: "What a sender says a batch holds: the count to be accounted for, from which every stage and every loss is reconciled",
  attributes: { manifestId: key("the batch"), source: req(text(), "The sender"), period: opt(text(), "The period it covers"), manifestCount: req(integer(), "How many entities the sender says it sent") },
  identifiedBy: ["manifestId"],
  relationships: { load: one(load, "The load that carried it") },
  annotations: [internal, keep(3650), cites("FR-006"), lookup("source", "load")],
});

/** How many entities of a batch were at a stage. */
export const batchStage: AnyConcept = concept("batchStage", {
  definition: "How many entities of a batch a stage confirmed: a step of the funnel from the manifest to what was accepted",
  attributes: { batchStageId: key("the count"), stage: req(codeOf(stage), "The stage"), entities: req(integer(), "How many it confirmed") },
  identifiedBy: ["batchStageId"],
  relationships: { manifest: one(manifest, "The batch") },
  annotations: [internal, keep(3650), cites("FR-006"), unique("manifest", "stage"), lookup("manifest", "stage")],
});

/** Entities lost between two stages, with the reason. */
export const loss: AnyConcept = concept("loss", {
  definition: "Entities of a batch that did not go on, with the stage they stopped at and the reason: what makes a loss explained",
  attributes: { lossId: key("the loss"), stage: req(codeOf(stage), "The stage they stopped at"), entities: req(integer(), "How many") },
  identifiedBy: ["lossId"],
  relationships: { manifest: one(manifest, "The batch"), reason: one(reason, "Why") },
  annotations: [internal, keep(3650), cites("FR-006"), lookup("manifest", "reason")],
});

/** The flow model: loads, the stage ledger, intake and its conflicts, and the manifest with its funnel. */
export const flowModule = defineModule({
  name: "flow",
  definition: "How data moves through a pipeline, and the proof that nothing was lost on the way",
  requires: [],
  concepts: [reason, load, stageContract, ledgerEntry, delivery, deliveryConflict, manifest, batchStage, loss],
  codeLists: [stage, outcome, grain, loadType, disposition, conflictStatus, producer],
});
