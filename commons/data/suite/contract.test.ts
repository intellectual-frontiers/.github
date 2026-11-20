// Spec: 0062-contracts-time-control FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010, FR-011, FR-012, FR-013, FR-014, FR-015
/**
 * Contracts, time and control (commons data 0062-contracts-time-control), on SQLite, DuckDB and PostgreSQL, with synthetic healthcare fixtures: two versions of a patient-extract contract compared by the matrix, an
 * effective-dated "as of" read, a month closed and a late claim placed in the next open one, a control matrix that computes overdue and failing, consent as a test, a canary token that leaked and labels that must not fall.
 *
 * @module
 */
import { assert, proves } from "@intellectual-frontiers/test";
import { allModules, defineArca, schemaOf } from "@intellectual-frontiers/data/sql/cli";
import { closePeriod, compatibility, fieldsOf, holdsAt, labelViolations, layerReport, matrix, permits, place, plant, propagate, recordRun, reopenPeriod, scanCanaries, unconsented } from "@intellectual-frontiers/data/sql/contract";
import { drift } from "@intellectual-frontiers/data/sql/lifecycle";
import { bind } from "@intellectual-frontiers/data/sql/physical";
import { from, insertInto, type Runner, asc } from "@intellectual-frontiers/data/sql/typed";
import { contract } from "@intellectual-frontiers/data/sql/typed/models";
import { DIALECTS, load, openEngine, type Engine } from "./engines-fixture.ts";
import { same } from "./governance-fixture.ts";
import { driverOf } from "./lifecycle-fixture.ts";

const must = <T, E>(r: { kind: "ok"; value: T } | { kind: "err"; error: E }): T => {
  if (r.kind === "err") throw new Error(JSON.stringify(r.error).slice(0, 400));
  return r.value;
};
async function world(name: Engine["name"]): Promise<{ e: Engine; on: Runner }> {
  const e = await openEngine(name);
  const dialect = DIALECTS.find((x) => x.name === name)!.dialect;
  const schema = must(schemaOf(defineArca({ models: ["contract"] } as never) as never)).schema;
  await load(e, must(bind(schema, { dialect })), ["setup", "table", "data"]);
  return { e, on: { driver: driverOf(e), dialect } };
}
const each = async (f: (w: { e: Engine; on: Runner }, name: string) => Promise<void>): Promise<void> => {
  for (const { name } of DIALECTS) {
    const w = await world(name);
    try {
      await f(w, name);
    } finally {
      await w.e.close();
    }
  }
};
const v = (n: number, extra: Record<string, unknown> = {}) => ({ dataContractId: `c${n}`, dataset: "patient_extract", version: `${n}.0.0`, status: "active", owner: "data-office", validFrom: "2025-01-01T00:00:00Z", validTo: null, ...extra });
const f = (c: number, name: string, datatype: string, nullable: boolean, classification: string | null) => ({ contractFieldId: `c${c}.${name}`, fieldName: name, datatype, nullable, classification, contractDataContractId: `c${c}` });

proves(["0062-contracts-time-control FR-001", "0062-contracts-time-control FR-002", "0062-contracts-time-control FR-003", "0062-contracts-time-control FR-004", "0062-contracts-time-control FR-005", "0062-contracts-time-control FR-006", "0062-contracts-time-control FR-007"], "the contract model has contracts with their fields, periods, controls with their runs (only added to), consents and canary tokens; the contracts, periods and consents are annotated effective-dated with members that exist; every concept is defined", () => {
  const m = allModules().find((x) => x.name === "contract");
  assert(m !== undefined, "the contract module is one of the models");
  same(m.concepts.map((c) => c.name), ["dataContract", "contractField", "period", "control", "controlRun", "consent", "canaryToken"]);
  same(m.codeLists.map((l) => l.name), ["contractStatus", "periodStatus", "controlResult", "consentStatus"]);
  for (const name of ["dataContract", "period", "consent"]) assert(m.concepts.find((c) => c.name === name)!.annotations.some((a) => a.kind === "quality.temporal"), `${name} is effective-dated`);
  assert(m.concepts.find((c) => c.name === "controlRun")!.annotations.some((a) => a.kind === "quality.appendOnly"), "runs are only added to");
  assert(m.concepts.every((c) => c.definition.length > 30), "every concept is defined");
});

proves(["0062-contracts-time-control FR-008"], "the compatibility matrix tells a breaking change to readers from one to writers: a removed field, a retyped one, one that became nullable or a label raised break readers; a required field added breaks writers; an optional field added breaks nobody", async () => {
  await each(async ({ on }) => {
    await insertInto(contract.dataContract).values([v(1), v(2, { validFrom: "2025-07-01T00:00:00Z" })] as never).run(on);
    await insertInto(contract.contractField).values([
      f(1, "mrn", "text", false, "restricted"), f(1, "birthDate", "date", false, "confidential"), f(1, "zip", "text", true, "internal"), f(1, "legacyFlag", "text", true, null),
      f(2, "mrn", "text", false, "restricted"), f(2, "birthDate", "text", true, "confidential"), f(2, "zip", "text", true, "confidential"), f(2, "language", "text", true, "internal"), f(2, "payer", "text", false, "internal"),
    ] as never).run(on);
    const c = compatibility(await fieldsOf(on, "patient_extract", "1.0.0"), await fieldsOf(on, "patient_extract", "2.0.0"));
    same(c.changes.map((x) => `${x.field}:${x.kind}`).sort(), ["birthDate:became-nullable", "birthDate:type-changed", "language:field-added-optional", "legacyFlag:field-removed", "payer:field-added-required", "zip:label-raised"]);
    same([c.readersBreak, c.writersBreak], [true, true]);
    const harmless = compatibility([{ name: "a", datatype: "text", nullable: false }], [{ name: "a", datatype: "text", nullable: false }, { name: "b", datatype: "text", nullable: true }]);
    same([harmless.readersBreak, harmless.writersBreak], [false, false]);
  });
});

proves(["0062-contracts-time-control FR-009"], "holdsAt reads a record as of an instant on every engine: it began at or before it and has no end or ends after it, and the end is not included", async () => {
  await each(async ({ on }) => {
    await insertInto(contract.dataContract).values([v(1, { validTo: "2025-07-01T00:00:00.000Z" }), v(2, { validFrom: "2025-07-01T00:00:00.000Z" })] as never).run(on);
    const at = async (t: string) => (await from(contract.dataContract).where((s) => holdsAt(s.dataContract.validFrom as never, s.dataContract.validTo as never, new Date(t))).select((s) => ({ id: s.dataContract.dataContractId })).orderBy((s) => [asc(s.dataContract.dataContractId)]).run(on)).map((r) => r.id);
    same(await at("2025-03-01T00:00:00.000Z"), ["c1"]);
    same(await at("2025-07-01T00:00:00.000Z"), ["c2"]);
    same(await at("2024-01-01T00:00:00.000Z"), []);
  });
});

proves(["0062-contracts-time-control FR-010"], "a closed period takes no change: a change dated in it is placed as an adjustment of the next open period, one in an open period stays in it, one in no period is placed nowhere, and reopening needs a reason", async () => {
  await each(async ({ on }) => {
    const p = (id: string, from: string, to: string) => ({ periodId: id, scope: "ledger", startsOn: from, endsOn: to, status: "open", closedBy: null, closedAt: null, reason: null });
    await insertInto(contract.period).values([p("2025-01", "2025-01-01T00:00:00Z", "2025-02-01T00:00:00Z"), p("2025-02", "2025-02-01T00:00:00Z", "2025-03-01T00:00:00Z"), p("2025-03", "2025-03-01T00:00:00Z", "2025-04-01T00:00:00Z")] as never).run(on);
    same(await place(on, "ledger", "2025-01-15T00:00:00Z"), { kind: "open", periodId: "2025-01" });
    await closePeriod(on, "2025-01", "controller", "2025-02-05T00:00:00Z");
    await closePeriod(on, "2025-02", "controller", "2025-03-05T00:00:00Z");
    same(await place(on, "ledger", "2025-01-15T00:00:00Z"), { kind: "adjustment", belongsTo: "2025-01", periodId: "2025-03" });
    same(await place(on, "ledger", "2025-03-10T00:00:00Z"), { kind: "open", periodId: "2025-03" });
    same(await place(on, "ledger", "2024-12-31T00:00:00Z"), { kind: "none" });
    let refused = false;
    try {
      await reopenPeriod(on, "2025-01", " ");
    } catch {
      refused = true;
    }
    assert(refused, "reopening without a reason is refused");
    await reopenPeriod(on, "2025-01", "a payer corrected a claim");
    same(await place(on, "ledger", "2025-01-15T00:00:00Z"), { kind: "open", periodId: "2025-01" });
  });
});

proves(["0062-contracts-time-control FR-011"], "the control matrix computes passing, failing, waived, overdue and never-run from the latest run and the frequency of each control", async () => {
  await each(async ({ on }) => {
    const c = (id: string, days: string) => ({ controlId: id, objective: `${id} holds`, owner: "data-office", frequency: days, evidenceRef: `suite/${id}.test.ts`, framework: null });
    await insertInto(contract.control).values([c("recon", "7"), c("consent", "30"), c("restore", "90"), c("labels", "7"), c("canary", "30")] as never).run(on);
    await recordRun(on, { controlRunId: "r1", controlId: "recon", result: "pass", ranAt: "2025-03-01T00:00:00Z" });
    await recordRun(on, { controlRunId: "r2", controlId: "recon", result: "fail", ranAt: "2025-03-08T00:00:00Z" });
    await recordRun(on, { controlRunId: "r3", controlId: "consent", result: "pass", ranAt: "2025-02-01T00:00:00Z" });
    await recordRun(on, { controlRunId: "r4", controlId: "restore", result: "waived", ranAt: "2025-03-01T00:00:00Z" });
    await recordRun(on, { controlRunId: "r5", controlId: "labels", result: "pass", ranAt: "2025-03-09T00:00:00Z" });
    same((await matrix(on, "2025-03-10T00:00:00Z")).map((x) => [x.controlId, x.status]), [["canary", "never-run"], ["consent", "overdue"], ["labels", "passing"], ["recon", "failing"], ["restore", "waived"]]);
  });
});

proves(["0062-contracts-time-control FR-012"], "consent is a test: a use with a consent in force for its purpose passes, and one outside its dates, for another purpose, withdrawn or with none is returned", async () => {
  await each(async ({ on }) => {
    await insertInto(contract.consent).values([
      { consentId: "k1", subject: "s1", purpose: "research", status: "granted", validFrom: "2025-01-01T00:00:00Z", validTo: null },
      { consentId: "k2", subject: "s2", purpose: "research", status: "granted", validFrom: "2025-01-01T00:00:00Z", validTo: "2025-06-01T00:00:00Z" },
      { consentId: "k3", subject: "s3", purpose: "research", status: "withdrawn", validFrom: "2025-01-01T00:00:00Z", validTo: null },
    ] as never).run(on);
    assert(await permits(on, "s1", "research", "2025-05-01T00:00:00Z"), "in force");
    const bad = await unconsented(on, [
      { subject: "s1", purpose: "research", at: "2025-05-01T00:00:00Z" }, { subject: "s1", purpose: "marketing", at: "2025-05-01T00:00:00Z" },
      { subject: "s2", purpose: "research", at: "2025-07-01T00:00:00Z" }, { subject: "s3", purpose: "research", at: "2025-05-01T00:00:00Z" }, { subject: "s4", purpose: "research", at: "2025-05-01T00:00:00Z" },
    ]);
    same(bad.map((u) => `${u.subject}/${u.purpose}`), ["s1/marketing", "s2/research", "s3/research", "s4/research"]);
  });
});

proves(["0062-contracts-time-control FR-013"], "a planted canary token is found in text outside the place that holds it and not in that place", async () => {
  await each(async ({ on }) => {
    await plant(on, "ZXQ-7731-canary", "patients_extract.notes", "its appearance in a log means the extract leaked");
    const hits = await scanCanaries(on, [{ where: "patients_extract.notes", text: "visit ZXQ-7731-canary" }, { where: "app.log", text: "saw ZXQ-7731-canary in a query" }, { where: "app.log", text: "nothing" }]);
    same(hits, [{ token: "ZXQ-7731-canary", where: "app.log", plantedIn: "patients_extract.notes" }]);
  });
});

proves(["0062-contracts-time-control FR-014"], "a label is the highest of what a dataset is made from, however far back, and a derived dataset labelled lower is a violation that names what makes it so", () => {
  same(propagate(["internal", "restricted", "public"]), "restricted");
  const edges = [{ from: "raw_patients", to: "stg_patients" }, { from: "stg_patients", to: "mart_cohort" }, { from: "ref_codes", to: "mart_cohort" }, { from: "ref_codes", to: "mart_codes" }];
  const v = labelViolations(edges, { raw_patients: "restricted", stg_patients: "restricted", ref_codes: "public", mart_cohort: "internal", mart_codes: "public" });
  same(v, [{ dataset: "mart_cohort", declared: "internal", required: "restricted", because: ["raw_patients", "stg_patients"] }]);
});

proves(["0062-contracts-time-control FR-015"], "the layer report says by table where the physical layer disagrees with the logical, in words, and says nothing where they agree", () => {
  const empty = { schema: undefined, tables: [] } as never;
  same(layerReport([]), []);
  const r = layerReport([{ kind: "missing-column", table: "patient", column: "zip" }, { kind: "type", table: "patient", column: "dob", expected: "date", found: "text" }, { kind: "stray-table", table: "scratch" }]);
  same(r.map((x) => [x.table, x.lines]), [["patient", ["the column zip is not in the database", "the column dob is text and the model says date"]], ["scratch", ["the table is in the database and not in the model"]]]);
  assert(empty !== undefined && typeof drift === "function", "drift is what it reports on");
});
