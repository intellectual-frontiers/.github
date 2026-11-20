// Spec: 0064-recovery-proof-identity FR-001, FR-002, FR-003, FR-004, FR-005, FR-006
/**
 * The proof model (commons data 0064-recovery-proof-identity): what it takes to show that a platform can be put right and that its figures are right. A drill of replay, rollback or restore with how long it took and what it
 * found, a calculation run with the hash of its inputs and of its outputs, a reference case with the value a calculation must give, a lineage edge from one dataset to another, and a link between records of different
 * sources that are the same entity. It names no domain and requires nothing.
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
  text,
  vocabularies,
} from "@intellectual-frontiers/data/governance";

const { quality, requirements, security, usage } = vocabularies;
const spec = "0064-recovery-proof-identity";
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

/** What a drill tests. */
export const drillKind = list("drillKind", "What a recovery drill tests", { replay: "Replaying a load from the raw copy", rollback: "Undoing a load by its id", restore: "Restoring from a backup" });
/** What a drill found. */
export const drillOutcome = list("drillOutcome", "What a drill found", { passed: "What came back is what was there", failed: "What came back is not what was there", abandoned: "It was not finished" });
/** How a link was made. */
export const linkRule = list("linkRule", "How two records were found to be the same entity", { exact: "A key they share, as it is", normalized: "A key they share once it is written in one way", similar: "A similarity above a threshold, for a person to confirm", confirmed: "A person confirmed it" });

const key = (what: string) => attribute(identifier(), { definition: `What identifies ${what}` });
const req = (t: Parameters<typeof attribute>[0], definition: string) => attribute(t, { definition });
const opt = (t: Parameters<typeof attribute>[0], definition: string) => attribute(t, { definition, multiplicity: "optional" });

/** A recovery drill. */
export const drill: AnyConcept = concept("drill", {
  definition: "One drill of a recovery: what was tested (a replay, a rollback or a restore), against which load or scope, how long it took, what it found and the evidence, so that a recovery is shown and not assumed",
  attributes: {
    drillId: key("the drill"),
    kind: req(codeOf(drillKind), "What it tested"),
    scope: req(text(), "What it was done to: a load id, a table or a store"),
    startedAt: req(instant(), "When it began"),
    seconds: req(integer(), "How long it took, in whole seconds"),
    outcome: req(codeOf(drillOutcome), "What it found"),
    beforeHash: opt(text(), "The hash of what was there before"),
    afterHash: opt(text(), "The hash of what was there after"),
    evidence: opt(text(), "Where the evidence is kept"),
  },
  identifiedBy: ["drillId"],
  relationships: {},
  annotations: [internal, keep(3650), cites("FR-001"), annotate(quality.appendOnly, {}), lookup("kind", "scope", "outcome")],
});

/** One run of a calculation. */
export const calculationRun: AnyConcept = concept("calculationRun", {
  definition: "One run of a calculation: its name and version, the parameters it ran with, the hash of its inputs and of its outputs and how many rows it gave, so that a figure can be reproduced and a change of one shown",
  attributes: {
    calculationRunId: key("the run"),
    calculation: req(text(), "The calculation"),
    version: req(text(), "Its version"),
    parameters: opt(text(), "The parameters it ran with, as JSON"),
    inputHash: req(text(), "The SHA-256 of its inputs"),
    outputHash: req(text(), "The SHA-256 of its outputs"),
    rows: req(integer(), "How many rows it gave"),
    ranAt: req(instant(), "When"),
    loadId: opt(text(), "The load it was run for, where it was"),
  },
  identifiedBy: ["calculationRunId"],
  relationships: {},
  annotations: [internal, keep(3650), cites("FR-002"), annotate(quality.appendOnly, {}), lookup("calculation", "loadId")],
});

/** A value a calculation must give. */
export const referenceCase: AnyConcept = concept("referenceCase", {
  definition: "A case with inputs and the value a calculation must give for them, found by hand or from a source that is trusted, with how close it must be: what a calculation is held to",
  attributes: {
    referenceCaseId: key("the case"),
    calculation: req(text(), "The calculation it is for"),
    description: req(text(), "What the case shows"),
    inputs: req(text(), "The inputs, as JSON"),
    expected: req(text(), "The value it must give, as a number"),
    tolerance: req(text(), "How far it may be from the value, as a number: 0 for exact"),
    source: req(text(), "Where the value comes from"),
  },
  identifiedBy: ["referenceCaseId"],
  relationships: {},
  annotations: [internal, keep(3650), cites("FR-003"), lookup("calculation")],
});

/** One step of lineage. */
export const lineageEdge: AnyConcept = concept("lineageEdge", {
  definition: "A dataset that another is made from, by which transform, so that what a change reaches and what a figure came from can both be found",
  attributes: { lineageEdgeId: key("the edge"), fromDataset: req(text(), "The dataset it is made from"), toDataset: req(text(), "The dataset that is made"), via: req(text(), "The transform or workload that makes it") },
  identifiedBy: ["lineageEdgeId"],
  relationships: {},
  annotations: [internal, keep(3650), cites("FR-004"), unique("fromDataset", "toDataset", "via"), lookup("fromDataset", "toDataset")],
});

/** A record of a source linked to an entity. */
export const entityLink: AnyConcept = concept("entityLink", {
  definition: "A record of one source linked to an entity that other sources also hold, with the rule that found it and the score, so that who is the same person or thing is a fact with a reason and not a guess",
  attributes: {
    entityLinkId: key("the link: the source and the key of its record"),
    entityId: req(text(), "The entity it is linked to"),
    source: req(text(), "The source"),
    sourceKey: req(text(), "The key of the record in the source"),
    rule: req(codeOf(linkRule), "How it was found"),
    score: req(text(), "How sure, as a number from 0 to 1"),
  },
  identifiedBy: ["entityLinkId"],
  relationships: {},
  annotations: [internal, keep(3650), cites("FR-005"), unique("source", "sourceKey"), lookup("entityId", "source")],
});

/** The proof model. */
export const proofModule = defineModule({
  name: "proof",
  definition: "The proof that a platform can be put right and that its figures are right",
  requires: [],
  concepts: [drill, calculationRun, referenceCase, lineageEdge, entityLink],
  codeLists: [drillKind, drillOutcome, linkRule],
});
