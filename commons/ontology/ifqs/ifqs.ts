/**
 * The vocabulary of the Intellectual Frontiers Quality System (IFQS; commons 0021-ifqs, 0022-trust): a test run and its cases, the outcome of a case (including `not_run`),
 * evidence and the grade it carries (E0 to E5), the file of a run as kept on the `quality` branch, the freshness of a proof, a nonconformance and its CAPA, a quality
 * objective, review debt, the tiers a harness may claim, and the audiences and the assessor pack of the Trust page.
 *
 * @remarks
 * It stands on PROV-O (a run and a case are `prov:Activity`; evidence, an evidence file and a nonconformance are `prov:Entity`; a CAPA is a `prov:Plan`), DCAT (an assessor
 * pack is a `dcat:Dataset`) and SKOS (the code lists), and it extends, and does not restate, the test record of `0008-test-evidence`: the outcome words are 0008's with
 * `not_run` added. OpenTelemetry's test attributes, CTRF, SARIF and OSCAL assessment results are the forms a record is written or rendered in and have no RDF terms, so
 * they are named in definitions and in the specification and not mapped here. Every class (and every code list's class) has an `mz:OntologyTerm` individual saying its
 * basis (0018-standards-first FR-003).
 *
 * @limits
 * The properties do not yet carry a basis of their own (the baseline holds them until the schemas require it). A standard that publishes no IRI for a term is named in the
 * term's justification and never given an invented IRI.
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
import { bases, MZ, MZID, OntologyTerm } from "../mizan/mizan.ts";

/** The namespace of IFQS's terms. */
export const IFQS = namespace("ifqs", "https://www.intellectualfrontiers.com/ontology/ifqs#");
/** The namespace of the versions of IFQS's ontology: `owl:versionIRI` names one of them. */
export const IFQSV = namespace("ifqsv", "https://www.intellectualfrontiers.com/ontology/ifqs/");
/** The namespace of DCAT, whose `Dataset` an assessor pack specializes. */
export const DCAT = namespace("dcat", "http://www.w3.org/ns/dcat#");
/** The terms of DCAT that this ontology refers to. */
export const dcat = vocabulary(DCAT, { Dataset: "rdfs:Class" });
/** The terms of PROV-O that this ontology specializes and the kernel's `prov` does not hold. */
export const provMore = vocabulary(PROV, { Plan: "rdfs:Class" });

/** The terms of IFQS's vocabulary: its classes and properties. */
export const ifqs = vocabulary(IFQS, {
  TestRun: "owl:Class",
  TestCase: "owl:Class",
  TestOutcome: "owl:Class",
  Evidence: "owl:Class",
  EvidenceGrade: "owl:Class",
  EvidenceFile: "owl:Class",
  FreshnessState: "owl:Class",
  Nonconformance: "owl:Class",
  NonconformanceState: "owl:Class",
  Capa: "owl:Class",
  CapaState: "owl:Class",
  QualityObjective: "owl:Class",
  ReviewDebt: "owl:Class",
  QualityTier: "owl:Class",
  Audience: "owl:Class",
  AssessorPack: "owl:Class",
  testedRevision: "owl:DatatypeProperty",
  traceId: "owl:DatatypeProperty",
  inRun: "owl:ObjectProperty",
  outcome: "owl:ObjectProperty",
  reason: "owl:DatatypeProperty",
  proves: "owl:DatatypeProperty",
  forRequirement: "owl:DatatypeProperty",
  grade: "owl:ObjectProperty",
  producedByRun: "owl:ObjectProperty",
  provedAt: "owl:DatatypeProperty",
  freshness: "owl:ObjectProperty",
  storedIn: "owl:ObjectProperty",
  reviewedByRole: "owl:DatatypeProperty",
  ofRun: "owl:ObjectProperty",
  evidencePath: "owl:DatatypeProperty",
  evidenceSha256: "owl:DatatypeProperty",
  previousSha256: "owl:DatatypeProperty",
  arisesFrom: "owl:ObjectProperty",
  openedBy: "owl:DatatypeProperty",
  statement: "owl:DatatypeProperty",
  nonconformanceState: "owl:ObjectProperty",
  correctsNonconformance: "owl:ObjectProperty",
  correctiveAction: "owl:DatatypeProperty",
  verifiedByTest: "owl:DatatypeProperty",
  capaState: "owl:ObjectProperty",
  approvedBy: "owl:DatatypeProperty",
  approvedOn: "owl:DatatypeProperty",
  metricName: "owl:DatatypeProperty",
  targetValue: "owl:DatatypeProperty",
  targetUnit: "owl:DatatypeProperty",
  errorBudget: "owl:DatatypeProperty",
  budgetWindow: "owl:DatatypeProperty",
  debtValue: "owl:DatatypeProperty",
  measuredAtRevision: "owl:DatatypeProperty",
  belowGrade: "owl:ObjectProperty",
  tierNumber: "owl:DatatypeProperty",
  gradeRank: "owl:DatatypeProperty",
  outcomeWord: "owl:DatatypeProperty",
  packAudience: "owl:ObjectProperty",
  packRevision: "owl:DatatypeProperty",
  packSha256: "owl:DatatypeProperty",
});

// ---- the code lists

const CODE = { label: one(rdfs.label, range.langString), definition: optional(skos.definition, range.langString) } as const;

/** The schema of a grade of evidence (`ifqs:EvidenceGrade`): its rank, 0 to 5. */
export const EvidenceGrade = classSchema(ifqs.EvidenceGrade, { ...CODE, gradeRank: one(ifqs.gradeRank, range.integer) });

/** The evidence ladder, E0 to E5 (0021-ifqs FR-021): what a piece of evidence is worth, shown wherever evidence or a count of proof is shown. */
export const evidenceGrades = codes(EvidenceGrade, IFQS, {
  E0: { label: en("E0 none"), definition: en("No evidence: a requirement with no record of any kind."), gradeRank: 0 },
  E1: { label: en("E1 stated"), definition: en("A person or an agent says the requirement is met; nothing ran."), gradeRank: 1 },
  E2: { label: en("E2 reviewed"), definition: en("A review is recorded against the requirement, by a person or by an agent (said to be an agent's)."), gradeRank: 2 },
  E3: { label: en("E3 tested"), definition: en("An automated run proved the requirement and its record exists."), gradeRank: 3 },
  E4: {
    label: en("E4 attested"),
    definition: en("The run is kept on the quality branch, chained, signed and linked to its commit, so that a third party can verify it."),
    gradeRank: 4,
  },
  E5: { label: en("E5 observed"), definition: en("A probe of the system in operation reports the requirement met: operational truth."), gradeRank: 5 },
});

/** The schema of an outcome (`ifqs:TestOutcome`): the word it is written with in the record. */
export const TestOutcomeSchema = classSchema(ifqs.TestOutcome, { ...CODE, outcomeWord: one(ifqs.outcomeWord, range.string) });

/** What became of a case (0008-test-evidence FR-001, with `not_run` of 0021-ifqs FR-005 and FR-014): the word is the value of `ifc.test.outcome`. */
export const testOutcomes = codes(TestOutcomeSchema, IFQS, {
  Pass: { label: en("pass"), definition: en("The case ran and its assertions held."), outcomeWord: "pass" },
  Fail: { label: en("fail"), definition: en("The case ran and an assertion did not hold."), outcomeWord: "fail" },
  Skip: { label: en("skip"), definition: en("A runner skipped the case on purpose, with its reason."), outcomeWord: "skip" },
  Todo: { label: en("todo"), definition: en("The case is declared and not yet written, with its reason."), outcomeWord: "todo" },
  Cancelled: { label: en("cancelled"), definition: en("The case started and did not end before its process did."), outcomeWord: "cancelled" },
  NotRun: {
    label: en("not run"),
    definition: en("A planned case, check or requirement that never started, with the reason: it is never counted as passed."),
    outcomeWord: "not_run",
  },
});

/** The freshness of a proof (0021-ifqs FR-025), in the words of 0007-grc FR-011. */
export const freshnessStates = codes(classSchema(ifqs.FreshnessState, CODE), IFQS, {
  Fresh: { label: en("fresh"), definition: en("The proof is within its cadence and nothing in its chain changed after its run.") },
  Due: { label: en("due"), definition: en("The proof is within a tenth of its cadence of its end.") },
  Stale: { label: en("stale"), definition: en("The proof is past its cadence or a file of its chain changed after its run: it opens a nonconformance and does not count at its grade.") },
});

/** The states of a nonconformance (0021-ifqs FR-026). */
export const nonconformanceStates = codes(classSchema(ifqs.NonconformanceState, CODE), IFQS, {
  NonconformanceOpen: { label: en("open"), definition: en("The system opened it and no CAPA of it is closed.") },
  NonconformanceClosed: { label: en("closed"), definition: en("Its CAPA is closed: verified by a named test and approved by a named person.") },
});

/** The states of a CAPA, in order (0021-ifqs FR-028 to FR-030). */
export const capaStates = codes(classSchema(ifqs.CapaState, CODE), IFQS, {
  CapaOpen: { label: en("open"), definition: en("The corrective action is stated and its named test has not passed after the corrective change.") },
  CapaVerified: { label: en("verified"), definition: en("The named test passed in a run after the corrective change; a person has not yet approved the closure.") },
  CapaClosed: { label: en("closed"), definition: en("A named person approved the closure of a verified CAPA, recorded as a Decision.") },
});

/** The schema of a tier (`ifqs:QualityTier`). */
export const QualityTierSchema = classSchema(ifqs.QualityTier, { ...CODE, tierNumber: one(ifqs.tierNumber, range.integer) });

/** The tiers a harness may claim (0021-ifqs FR-036). */
export const qualityTiers = codes(QualityTierSchema, IFQS, {
  Tier0: { label: en("Tier 0"), definition: en("Evidence exists: one canonical record per run, kept immutable and chained on the quality branch."), tierNumber: 0 },
  Tier1: { label: en("Tier 1"), definition: en("The system reports itself: grades, review debt, freshness, nonconformance, CAPA and objectives."), tierNumber: 1 },
  Tier2: { label: en("Tier 2"), definition: en("People see and prove: the console, attested samples, pre-registered plans, mutation runs, the public page and the assessor pack."), tierNumber: 2 },
});

/** Who a rendering of evidence is for, and so what is redacted from it (0022-trust FR-007). */
export const audiences = codes(classSchema(ifqs.Audience, CODE), IFQS, {
  Public: { label: en("public"), definition: en("Anyone: figures, grades and failures with their requirement and reason, and nothing that names a person, customer, host or private repository.") },
  Assessor: { label: en("assessor"), definition: en("A person who verifies the evidence: the full records, with secrets and personal data redacted only.") },
  Internal: { label: en("internal"), definition: en("The harness's own people, through its own console.") },
});

// ---- the class schemas the data is made with

/** The schema of a test run (`ifqs:TestRun`). */
export const TestRun = classSchema(ifqs.TestRun, {
  label: one(rdfs.label, range.langString),
  traceId: one(ifqs.traceId, range.string),
  testedRevision: one(ifqs.testedRevision, range.string),
});

/** The schema of a test case of a run (`ifqs:TestCase`). */
export const TestCase = classSchema(ifqs.TestCase, {
  label: one(rdfs.label, range.langString),
  inRun: one(ifqs.inRun, range.ref<"ifqs:TestRun">()),
  outcome: one(ifqs.outcome, range.ref<"ifqs:TestOutcome">()),
  reason: optional(ifqs.reason, range.string),
  proves: many(ifqs.proves, range.string),
});

/** The schema of a piece of evidence (`ifqs:Evidence`). */
export const Evidence = classSchema(ifqs.Evidence, {
  label: one(rdfs.label, range.langString),
  forRequirement: one(ifqs.forRequirement, range.string),
  grade: one(ifqs.grade, range.ref<"ifqs:EvidenceGrade">()),
  freshness: one(ifqs.freshness, range.ref<"ifqs:FreshnessState">()),
  producedByRun: optional(ifqs.producedByRun, range.ref<"ifqs:TestRun">()),
  provedAt: optional(ifqs.provedAt, range.string),
  storedIn: optional(ifqs.storedIn, range.ref<"ifqs:EvidenceFile">()),
  reviewedByRole: optional(ifqs.reviewedByRole, range.string),
});

/** The schema of the file of a run as kept on the `quality` branch (`ifqs:EvidenceFile`). */
export const EvidenceFile = classSchema(ifqs.EvidenceFile, {
  label: one(rdfs.label, range.langString),
  ofRun: one(ifqs.ofRun, range.ref<"ifqs:TestRun">()),
  evidencePath: one(ifqs.evidencePath, range.string),
  evidenceSha256: one(ifqs.evidenceSha256, range.string),
  previousSha256: one(ifqs.previousSha256, range.string),
});

/** The schema of a nonconformance (`ifqs:Nonconformance`). */
export const Nonconformance = classSchema(ifqs.Nonconformance, {
  label: one(rdfs.label, range.langString),
  forRequirement: one(ifqs.forRequirement, range.string),
  arisesFrom: one(ifqs.arisesFrom, range.ref<"ifqs:Evidence">()),
  statement: one(ifqs.statement, range.string),
  openedBy: one(ifqs.openedBy, range.string),
  nonconformanceState: one(ifqs.nonconformanceState, range.ref<"ifqs:NonconformanceState">()),
});

/** The schema of a corrective and preventive action (`ifqs:Capa`). */
export const Capa = classSchema(ifqs.Capa, {
  label: one(rdfs.label, range.langString),
  correctsNonconformance: one(ifqs.correctsNonconformance, range.ref<"ifqs:Nonconformance">()),
  correctiveAction: one(ifqs.correctiveAction, range.string),
  verifiedByTest: one(ifqs.verifiedByTest, range.string),
  capaState: one(ifqs.capaState, range.ref<"ifqs:CapaState">()),
  approvedBy: optional(ifqs.approvedBy, range.string),
  approvedOn: optional(ifqs.approvedOn, range.string),
});

/** The schema of a quality objective (`ifqs:QualityObjective`). */
export const QualityObjective = classSchema(ifqs.QualityObjective, {
  label: one(rdfs.label, range.langString),
  metricName: one(ifqs.metricName, range.string),
  targetValue: one(ifqs.targetValue, range.string),
  targetUnit: one(ifqs.targetUnit, range.string),
  errorBudget: one(ifqs.errorBudget, range.string),
  budgetWindow: one(ifqs.budgetWindow, range.string),
});

/** The schema of review debt (`ifqs:ReviewDebt`): the count of requirements whose best fresh evidence is E1 or E2. */
export const ReviewDebt = classSchema(ifqs.ReviewDebt, {
  label: one(rdfs.label, range.langString),
  debtValue: one(ifqs.debtValue, range.integer),
  measuredAtRevision: one(ifqs.measuredAtRevision, range.string),
  belowGrade: one(ifqs.belowGrade, range.ref<"ifqs:EvidenceGrade">()),
});

/** The schema of an assessor pack (`ifqs:AssessorPack`). */
export const AssessorPack = classSchema(ifqs.AssessorPack, {
  label: one(rdfs.label, range.langString),
  packAudience: one(ifqs.packAudience, range.ref<"ifqs:Audience">()),
  packRevision: one(ifqs.packRevision, range.string),
  packSha256: one(ifqs.packSha256, range.string),
});

// ---- the classes and the properties, each with its label and definition

/** The classes, each with its label and definition. */
export const classes = [
  OwlClass.make(ifqs.TestRun, {
    label: en("Test run"),
    subClassOf: [prov.Activity],
    definition: en("One run of a suite: its trace, the revision it tested and its cases; kept as one file of the record of 0008-test-evidence."),
  }),
  OwlClass.make(ifqs.TestCase, {
    label: en("Test case"),
    subClassOf: [prov.Activity],
    definition: en("One case of a run, with its outcome, its reason where it has one and the requirements it proves."),
  }),
  OwlClass.make(ifqs.TestOutcome, {
    label: en("Test outcome"),
    subClassOf: [skos.Concept],
    definition: en("pass, fail, skip, todo, cancelled or not run."),
  }),
  OwlClass.make(ifqs.Evidence, {
    label: en("Evidence"),
    subClassOf: [prov.Entity],
    definition: en("What a run, a review or a probe shows of one requirement, with the grade it carries and its freshness."),
  }),
  OwlClass.make(ifqs.EvidenceGrade, {
    label: en("Evidence grade"),
    subClassOf: [skos.Concept],
    definition: en("E0 to E5: how much a piece of evidence is worth."),
  }),
  OwlClass.make(ifqs.EvidenceFile, {
    label: en("Evidence file"),
    subClassOf: [prov.Entity],
    definition: en("The immutable file of one run on the quality branch, with its digest and the digest of the file before it."),
  }),
  OwlClass.make(ifqs.FreshnessState, {
    label: en("Freshness state"),
    subClassOf: [skos.Concept],
    definition: en("fresh, due or stale."),
  }),
  OwlClass.make(ifqs.Nonconformance, {
    label: en("Nonconformance"),
    subClassOf: [prov.Entity],
    definition: en("A failure of a requirement to be met, or a stale proof of it, opened by the system itself (ISO 9001 clause 10.2's nonconformity)."),
  }),
  OwlClass.make(ifqs.NonconformanceState, {
    label: en("Nonconformance state"),
    subClassOf: [skos.Concept],
    definition: en("open or closed."),
  }),
  OwlClass.make(ifqs.Capa, {
    label: en("CAPA"),
    subClassOf: [provMore.Plan],
    definition: en("A corrective and preventive action: the plan that corrects a nonconformance, names the test that verifies it and is closed by a named person."),
  }),
  OwlClass.make(ifqs.CapaState, {
    label: en("CAPA state"),
    subClassOf: [skos.Concept],
    definition: en("open, verified or closed, in that order."),
  }),
  OwlClass.make(ifqs.QualityObjective, {
    label: en("Quality objective"),
    definition: en("A success criterion as a metric, with a target, a unit, an error budget and the window it is spent in."),
  }),
  OwlClass.make(ifqs.ReviewDebt, {
    label: en("Review debt"),
    definition: en("The number of requirements whose best fresh evidence is E1 or E2, counted at a revision."),
  }),
  OwlClass.make(ifqs.QualityTier, {
    label: en("Quality tier"),
    subClassOf: [skos.Concept],
    definition: en("Tier 0 (evidence exists), Tier 1 (the system reports itself) or Tier 2 (people see and prove)."),
  }),
  OwlClass.make(ifqs.Audience, {
    label: en("Audience"),
    subClassOf: [skos.Concept],
    definition: en("public, assessor or internal: who a rendering of evidence is for."),
  }),
  OwlClass.make(ifqs.AssessorPack, {
    label: en("Assessor pack"),
    subClassOf: [dcat.Dataset],
    definition: en("The self-contained, offline-verifiable bundle of the evidence of one revision and span, for a person who has to check it."),
  }),
] as const;

/** The properties, each with its domain, range and definition. */
export const properties = [
  DatatypeProperty.make(ifqs.traceId, { domain: ifqs.TestRun, range: xsd.string, label: en("trace id"), definition: en("The OpenTelemetry trace id of the run, in 32 lower-case hexadecimal digits: the name of its file.") }),
  DatatypeProperty.make(ifqs.testedRevision, { domain: ifqs.TestRun, range: xsd.string, label: en("tested revision"), definition: en("The commit the run tested (the resource attribute vcs.ref.head.revision).") }),
  ObjectProperty.make(ifqs.inRun, { domain: ifqs.TestCase, range: ifqs.TestRun, label: en("in run"), definition: en("The run the case is of.") }),
  ObjectProperty.make(ifqs.outcome, { domain: ifqs.TestCase, range: ifqs.TestOutcome, label: en("outcome"), definition: en("What became of the case: the value of ifc.test.outcome.") }),
  DatatypeProperty.make(ifqs.reason, { domain: ifqs.TestCase, range: xsd.string, label: en("reason"), definition: en("Why the case was skipped, not run or left to do (ifc.test.reason).") }),
  DatatypeProperty.make(ifqs.proves, { domain: ifqs.TestCase, range: xsd.string, label: en("proves"), definition: en("A requirement the case proves, as `NNNN-slug FR-nnn`.") }),
  DatatypeProperty.make(ifqs.forRequirement, { domain: ifqs.Evidence, range: xsd.string, label: en("for requirement"), definition: en("The requirement the evidence is of, as `NNNN-slug FR-nnn`.") }),
  ObjectProperty.make(ifqs.grade, { domain: ifqs.Evidence, range: ifqs.EvidenceGrade, label: en("grade"), definition: en("The grade the evidence carries, E0 to E5.") }),
  ObjectProperty.make(ifqs.producedByRun, { domain: ifqs.Evidence, range: ifqs.TestRun, label: en("produced by run"), definition: en("The run that produced the evidence, where a run did.") }),
  DatatypeProperty.make(ifqs.provedAt, { domain: ifqs.Evidence, range: xsd.string, label: en("proved at"), definition: en("The day or time (ISO 8601) of the proof.") }),
  ObjectProperty.make(ifqs.freshness, { domain: ifqs.Evidence, range: ifqs.FreshnessState, label: en("freshness"), definition: en("fresh, due or stale.") }),
  ObjectProperty.make(ifqs.storedIn, { domain: ifqs.Evidence, range: ifqs.EvidenceFile, label: en("stored in"), definition: en("The evidence file that keeps the run.") }),
  DatatypeProperty.make(ifqs.reviewedByRole, { domain: ifqs.Evidence, range: xsd.string, label: en("reviewed by role"), definition: en("The role that reviewed, for evidence of grade E2; `agent` where an agent did.") }),
  ObjectProperty.make(ifqs.ofRun, { domain: ifqs.EvidenceFile, range: ifqs.TestRun, label: en("of run"), definition: en("The run the file keeps.") }),
  DatatypeProperty.make(ifqs.evidencePath, { domain: ifqs.EvidenceFile, range: xsd.string, label: en("evidence path"), definition: en("The path on the quality branch: quality/evidence/YYYY/MM/DD/<trace id>.otlp.json.") }),
  DatatypeProperty.make(ifqs.evidenceSha256, { domain: ifqs.EvidenceFile, range: xsd.string, label: en("evidence SHA-256"), definition: en("The SHA-256 of the file's bytes, in lower-case hexadecimal.") }),
  DatatypeProperty.make(ifqs.previousSha256, { domain: ifqs.EvidenceFile, range: xsd.string, label: en("previous SHA-256"), definition: en("The SHA-256 of the file before it on the branch (64 zeros for the first): the in-file chain.") }),
  ObjectProperty.make(ifqs.arisesFrom, { domain: ifqs.Nonconformance, range: ifqs.Evidence, label: en("arises from"), definition: en("The evidence whose failure or staleness opened the nonconformance.") }),
  DatatypeProperty.make(ifqs.openedBy, { domain: ifqs.Nonconformance, range: xsd.string, label: en("opened by"), definition: en("`system`, or the role of the person who opened it.") }),
  DatatypeProperty.make(ifqs.statement, { domain: ifqs.Nonconformance, range: xsd.string, label: en("statement"), definition: en("What was not met, in one sentence.") }),
  ObjectProperty.make(ifqs.nonconformanceState, { domain: ifqs.Nonconformance, range: ifqs.NonconformanceState, label: en("nonconformance state"), definition: en("open or closed.") }),
  ObjectProperty.make(ifqs.correctsNonconformance, { domain: ifqs.Capa, range: ifqs.Nonconformance, label: en("corrects nonconformance"), definition: en("The nonconformance the CAPA corrects.") }),
  DatatypeProperty.make(ifqs.correctiveAction, { domain: ifqs.Capa, range: xsd.string, label: en("corrective action"), definition: en("What is done to correct the nonconformance and stop it recurring.") }),
  DatatypeProperty.make(ifqs.verifiedByTest, { domain: ifqs.Capa, range: xsd.string, label: en("verified by test"), definition: en("The test whose passing, after the corrective change, verifies the CAPA: its file and name.") }),
  ObjectProperty.make(ifqs.capaState, { domain: ifqs.Capa, range: ifqs.CapaState, label: en("has CAPA state"), definition: en("open, verified or closed.") }),
  DatatypeProperty.make(ifqs.approvedBy, { domain: ifqs.Capa, range: xsd.string, label: en("approved by"), definition: en("The named person who approved the closure.") }),
  DatatypeProperty.make(ifqs.approvedOn, { domain: ifqs.Capa, range: xsd.string, label: en("approved on"), definition: en("The day (YYYY-MM-DD) of the approval.") }),
  DatatypeProperty.make(ifqs.metricName, { domain: ifqs.QualityObjective, range: xsd.string, label: en("metric name"), definition: en("The OpenTelemetry metric the objective is measured by.") }),
  DatatypeProperty.make(ifqs.targetValue, { domain: ifqs.QualityObjective, range: xsd.string, label: en("target value"), definition: en("The target, as a decimal number written as text.") }),
  DatatypeProperty.make(ifqs.targetUnit, { domain: ifqs.QualityObjective, range: xsd.string, label: en("target unit"), definition: en("The unit of the target, in the Unified Code for Units of Measure where one exists.") }),
  DatatypeProperty.make(ifqs.errorBudget, { domain: ifqs.QualityObjective, range: xsd.string, label: en("error budget"), definition: en("How much the measure may miss its target within the window, as a decimal number written as text.") }),
  DatatypeProperty.make(ifqs.budgetWindow, { domain: ifqs.QualityObjective, range: xsd.string, label: en("budget window"), definition: en("The window the error budget is spent in, as an ISO 8601 duration.") }),
  DatatypeProperty.make(ifqs.debtValue, { domain: ifqs.ReviewDebt, range: xsd.integer, label: en("debt value"), definition: en("The count of requirements whose best fresh evidence is below the grade.") }),
  DatatypeProperty.make(ifqs.measuredAtRevision, { domain: ifqs.ReviewDebt, range: xsd.string, label: en("measured at revision"), definition: en("The revision at which the debt was counted.") }),
  ObjectProperty.make(ifqs.belowGrade, { domain: ifqs.ReviewDebt, range: ifqs.EvidenceGrade, label: en("below grade"), definition: en("The grade a requirement's best evidence must reach to be out of debt: E3.") }),
  DatatypeProperty.make(ifqs.tierNumber, { domain: ifqs.QualityTier, range: xsd.integer, label: en("tier number"), definition: en("0, 1 or 2.") }),
  DatatypeProperty.make(ifqs.gradeRank, { domain: ifqs.EvidenceGrade, range: xsd.integer, label: en("grade rank"), definition: en("The grade's number, 0 to 5, by which grades are compared.") }),
  DatatypeProperty.make(ifqs.outcomeWord, { domain: ifqs.TestOutcome, range: xsd.string, label: en("outcome word"), definition: en("The word the outcome is written with in the record: pass, fail, skip, todo, cancelled or not_run.") }),
  ObjectProperty.make(ifqs.packAudience, { domain: ifqs.AssessorPack, range: ifqs.Audience, label: en("pack audience"), definition: en("Who the pack is for, and so what is redacted from it.") }),
  DatatypeProperty.make(ifqs.packRevision, { domain: ifqs.AssessorPack, range: xsd.string, label: en("pack revision"), definition: en("The revision the pack was made at.") }),
  DatatypeProperty.make(ifqs.packSha256, { domain: ifqs.AssessorPack, range: xsd.string, label: en("pack SHA-256"), definition: en("The SHA-256 of the pack, in lower-case hexadecimal.") }),
] as const;

/** The ontology itself: its label, description and version. */
export const ifqsOntology = OwlOntology.make(ontologyOf(IFQS), {
  label: en("IFQS"),
  description: en(
    "The vocabulary of the Intellectual Frontiers Quality System: test runs and cases, evidence and its grades, nonconformance and CAPA, quality objectives, review debt, tiers, audiences and the assessor pack.",
  ),
  versionInfo: "1",
  versionIri: named<"owl:Ontology">(iriIn(IFQSV, "1")),
});

// ---- the audit: the basis of every class (0018-standards-first FR-003)

const DAY = "2026-11-17";

/** The record of a class that specializes a standard's class. */
function specializes(local: keyof typeof ifqs, standardTerm: string, definedBy: string) {
  return OntologyTerm.make(term(MZID, `term-ifqs-${local}`), {
    label: en(`ifqs:${local}`),
    termIri: ifqs[local].iri,
    basis: bases.Specializes,
    standardTerm,
    mappingRelation: "subClassOf",
    definedBy: [definedBy],
  });
}

/** The record of a class no standard names: unaligned, with what was examined. */
function unaligned(local: keyof typeof ifqs, justification: string, definedBy: string) {
  return OntologyTerm.make(term(MZID, `term-ifqs-${local}`), {
    label: en(`ifqs:${local}`),
    termIri: ifqs[local].iri,
    basis: bases.Unaligned,
    justification: `${justification} Decision pending (0018-standards-first FR-005).`,
    addedOn: DAY,
    definedBy: [definedBy],
  });
}

const SKOS_CONCEPT = skos.Concept.iri;

/** The audit of IFQS: one record for every class, and for every class of a code list. */
export const terms = [
  specializes("TestRun", prov.Activity.iri, "0021-ifqs FR-013"),
  specializes("TestCase", prov.Activity.iri, "0021-ifqs FR-013"),
  specializes("TestOutcome", SKOS_CONCEPT, "0021-ifqs FR-014"),
  specializes("Evidence", prov.Entity.iri, "0021-ifqs FR-006"),
  specializes("EvidenceGrade", SKOS_CONCEPT, "0021-ifqs FR-021"),
  specializes("EvidenceFile", prov.Entity.iri, "0021-ifqs FR-016"),
  specializes("FreshnessState", SKOS_CONCEPT, "0021-ifqs FR-025"),
  specializes("Nonconformance", prov.Entity.iri, "0021-ifqs FR-026"),
  specializes("NonconformanceState", SKOS_CONCEPT, "0021-ifqs FR-026"),
  specializes("Capa", provMore.Plan.iri, "0021-ifqs FR-028"),
  specializes("CapaState", SKOS_CONCEPT, "0021-ifqs FR-028"),
  unaligned(
    "QualityObjective",
    "Examined: ISO 9001 clause 6.2 (quality objectives) and OpenTelemetry's metric data model (a measure, no target); neither publishes an IRI for an objective with a target and an error budget. OpenSLO is a community specification and not a consensus standard (to verify).",
    "0021-ifqs FR-032",
  ),
  unaligned(
    "ReviewDebt",
    "Examined: ISO/IEC 25010 (quality characteristics of a product, not of the evidence for them); no standard names a count of requirements held below a proof grade.",
    "0021-ifqs FR-023",
  ),
  specializes("QualityTier", SKOS_CONCEPT, "0021-ifqs FR-036"),
  specializes("Audience", SKOS_CONCEPT, "0022-trust FR-007"),
  specializes("AssessorPack", dcat.Dataset.iri, "0022-trust FR-010"),
] as const;

/** The file this module states: its name, its prefixes and its individuals. */
export const file: OntologyFile = {
  name: "ifqs",
  prefixes: [DCAT, IFQS, IFQSV, MZ, MZID, OWL, PROV, RDFS, SKOS, XSD],
  individuals: [
    ifqsOntology,
    ...classes,
    ...properties,
    ...Object.values(evidenceGrades),
    ...Object.values(testOutcomes),
    ...Object.values(freshnessStates),
    ...Object.values(nonconformanceStates),
    ...Object.values(capaStates),
    ...Object.values(qualityTiers),
    ...Object.values(audiences),
    ...terms,
  ],
};
