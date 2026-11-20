// Spec: 0062-contracts-time-control FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007
/**
 * The contract model (commons data 0062-contracts-time-control): the promises a dataset makes and the proof that they are kept. A data contract (its fields, owner and version) whose versions can be compared, a period that is open
 * or closed so that what is late can be told from what is on time, a control and its runs (the control matrix), a consent that holds for a purpose between two dates, and canary tokens planted to find what leaks. Contracts, periods
 * and consents are effective-dated: they say between which instants they hold. It names no domain and requires nothing.
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
  relationship,
  text,
  vocabularies,
} from "@intellectual-frontiers/data/governance";

const { quality, requirements, security, usage } = vocabularies;
const spec = "0062-contracts-time-control";
const cites = (...frs: readonly string[]) => annotate(requirements.cites, frs.map((f) => `${spec} ${f}`));
const temporal = (validFrom: string, validTo?: string) => annotate(quality.temporal, validTo === undefined ? { validFrom } : { validFrom, validTo });
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

/** Where a contract is. */
export const contractStatus = list("contractStatus", "Where a data contract is in its life", { draft: "Proposed, and nobody may rely on it", active: "In force", deprecated: "In force, and to be replaced", retired: "No longer in force" });
/** Where a period is. */
export const periodStatus = list("periodStatus", "Whether a period still takes changes", { open: "It takes changes", closed: "It is closed: a change is an adjustment of the next open period", reopened: "It was closed and was opened again, with a reason" });
/** What a control run found. */
export const controlResult = list("controlResult", "What a run of a control found", { pass: "The control held", fail: "The control did not hold", waived: "The control was set aside by someone who answers for it", notRun: "The control was due and was not run" });
/** Whether a consent holds. */
export const consentStatus = list("consentStatus", "Whether a consent is in force", { granted: "Given", withdrawn: "Taken back" });

const key = (what: string) => attribute(identifier(), { definition: `What identifies ${what}` });
const req = (t: Parameters<typeof attribute>[0], definition: string) => attribute(t, { definition });
const opt = (t: Parameters<typeof attribute>[0], definition: string) => attribute(t, { definition, multiplicity: "optional" });
const one = (to: AnyConcept | (() => AnyConcept), definition: string) => relationship(to, { cardinality: "one", definition });

/** The promise a dataset makes, in one version. */
export const dataContract: AnyConcept = concept("dataContract", {
  definition: "What a dataset promises to those who read it, in one version: its owner, its status and the dates between which the version holds; its fields are the fields of the contract",
  attributes: {
    dataContractId: key("the contract: its dataset and version"),
    dataset: req(text(), "The dataset it is of"),
    version: req(text(), "The version of the contract, as major.minor.patch"),
    status: req(codeOf(contractStatus), "Where it is"),
    owner: req(text(), "Who answers for it"),
    validFrom: req(instant(), "From when it holds"),
    validTo: opt(instant(), "Until when it holds, where it ends"),
  },
  identifiedBy: ["dataContractId"],
  relationships: {},
  annotations: [internal, keep(3650), cites("FR-001"), unique("dataset", "version"), temporal("validFrom", "validTo"), lookup("dataset", "status")],
});

/** One field a contract promises. */
export const contractField: AnyConcept = concept("contractField", {
  definition: "One field a data contract promises: its name, its datatype, whether it may be missing and how it is classified",
  attributes: {
    contractFieldId: key("the field: its contract and name"),
    fieldName: req(text(), "The name of the field"),
    datatype: req(text(), "The datatype, as the contract names it"),
    nullable: req(boolean(), "Whether it may be missing"),
    classification: opt(text(), "How sensitive it is: public, internal, confidential or restricted"),
  },
  identifiedBy: ["contractFieldId"],
  relationships: { contract: one(dataContract, "The contract it is a field of") },
  annotations: [internal, keep(3650), cites("FR-001"), unique("contract", "fieldName"), lookup("contract")],
});

/** A period that is open or closed. */
export const period: AnyConcept = concept("period", {
  definition: "A span of time of one scope (a month of a ledger, a reporting quarter) that takes changes while it is open and is closed when its figures are final",
  attributes: {
    periodId: key("the period: its scope and span"),
    scope: req(text(), "What it is a period of"),
    startsOn: req(instant(), "Where it starts"),
    endsOn: req(instant(), "Where it ends, not included"),
    status: req(codeOf(periodStatus), "Whether it takes changes"),
    closedBy: opt(text(), "Who closed it"),
    closedAt: opt(instant(), "When it was closed"),
    reason: opt(text(), "Why it was opened again, where it was"),
  },
  identifiedBy: ["periodId"],
  relationships: {},
  annotations: [internal, keep(3650), cites("FR-002"), unique("scope", "startsOn"), temporal("startsOn", "endsOn"), lookup("scope", "status")],
});

/** A control: what is promised to be true, and who checks. */
export const control: AnyConcept = concept("control", {
  definition: "A control: what must hold, who answers for it, how often it is checked and the test or evidence that checks it, one row of the control matrix",
  attributes: {
    controlId: key("the control"),
    objective: req(text(), "What must hold"),
    owner: req(text(), "Who answers for it"),
    frequency: req(text(), "How often it is checked, as a number of days"),
    evidenceRef: req(text(), "The test, spec or report that checks it"),
    framework: opt(text(), "The framework or rule it answers to, where one"),
  },
  identifiedBy: ["controlId"],
  relationships: {},
  annotations: [internal, keep(3650), cites("FR-003"), lookup("owner", "framework")],
});

/** What one run of a control found. */
export const controlRun: AnyConcept = concept("controlRun", {
  definition: "What one run of a control found and when, with the evidence of it: a row of the history of a control, only added to",
  attributes: { controlRunId: key("the run"), result: req(codeOf(controlResult), "What it found"), ranAt: req(instant(), "When"), evidence: opt(text(), "Where the evidence is kept") },
  identifiedBy: ["controlRunId"],
  relationships: { control: one(control, "The control that was run") },
  annotations: [internal, keep(3650), cites("FR-003"), annotate(quality.appendOnly, {}), lookup("control", "result")],
});

/** A consent to use data for a purpose between two dates. */
export const consent: AnyConcept = concept("consent", {
  definition: "A subject's consent to a purpose between two dates, and whether it was taken back: what makes a use of their data allowed or not",
  attributes: {
    consentId: key("the consent"),
    subject: req(text(), "Whose it is, as a pseudonymous key"),
    purpose: req(text(), "What the data may be used for"),
    status: req(codeOf(consentStatus), "Whether it is in force"),
    validFrom: req(instant(), "From when it holds"),
    validTo: opt(instant(), "Until when it holds, where it ends"),
  },
  identifiedBy: ["consentId"],
  relationships: {},
  annotations: [internal, keep(3650), cites("FR-004"), temporal("validFrom", "validTo"), lookup("subject", "purpose")],
});

/** A token planted in data to find where it goes. */
export const canaryToken: AnyConcept = concept("canaryToken", {
  definition: "A made-up value planted in a dataset or an environment that no honest process has a use for, so that its appearance elsewhere shows a leak",
  attributes: { canaryTokenId: key("the token: the value itself"), plantedIn: req(text(), "Where it was planted"), plantedAt: req(instant(), "When"), purpose: req(text(), "What its appearance would mean") },
  identifiedBy: ["canaryTokenId"],
  relationships: {},
  annotations: [internal, keep(3650), cites("FR-005"), lookup("plantedIn")],
});

/** The contract model: contracts, periods, controls, consents and canaries. */
export const contractModule = defineModule({
  name: "contract",
  definition: "What a dataset promises, when the promises hold, and the proof that they are kept",
  requires: [],
  concepts: [dataContract, contractField, period, control, controlRun, consent, canaryToken],
  codeLists: [contractStatus, periodStatus, controlResult, consentStatus],
});
