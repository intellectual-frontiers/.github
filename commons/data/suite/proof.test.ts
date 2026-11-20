// Spec: 0064-recovery-proof-identity FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010, FR-011, FR-012, FR-013
/**
 * Recovery, proof and identity (commons data 0064-recovery-proof-identity), on SQLite, DuckDB and PostgreSQL, with synthetic healthcare fixtures and a batch extract for analytics: a rollback of one load among five drilled
 * and kept, a replay that leaves a table as it was and a restore that does not, a calculation reproduced and then changed, reference cases with a tolerance, lineage with a cycle, and patient records of three sources
 * linked by rules that are written down.
 *
 * @module
 */
import { assert, proves } from "@intellectual-frontiers/test";
import { allModules, defineArca, schemaOf } from "@intellectual-frontiers/data/sql/cli";
import { labelViolations } from "@intellectual-frontiers/data/sql/contract";
import { written } from "@intellectual-frontiers/data/sql/flow";
import { edgesOf, fingerprint, hashRows, linkRecords, lineage, normalize, recordCalculation, reproduce, rollbackDrill, runReferenceCases, saveLinks, similarity, stateDrill } from "@intellectual-frontiers/data/sql/proof";
import { bind } from "@intellectual-frontiers/data/sql/physical";
import { asc, deleteFrom, from, insertInto, isNotNull, type Runner } from "@intellectual-frontiers/data/sql/typed";
import { flow, proof } from "@intellectual-frontiers/data/sql/typed/models";
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
  const schema = must(schemaOf(defineArca({ models: ["proof", "flow"] } as never) as never)).schema;
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
const seed = async (on: Runner): Promise<void> => {
  const t = "2025-03-01T00:00:00.000Z";
  await insertInto(flow.load).values([1, 2, 3, 4, 5].map((n) => ({ loadId: `L${n}`, loadType: "delivery", source: "claims", startedAt: t, tenant: null, rolledBackAt: null })) as never).run(on);
  await insertInto(flow.manifest).values([1, 2, 3, 4, 5].flatMap((n) => [1, 2, 3, 4].map((k) => ({ manifestId: `L${n}-m${k}`, source: "claims", period: null, manifestCount: 100 * n + k, loadId: `L${n}` }))) as never).run(on);
};
const look = { columns: ["manifestId", "source", "manifestCount"], orderBy: ["manifestId"] } as const;

proves(["0064-recovery-proof-identity FR-001", "0064-recovery-proof-identity FR-002", "0064-recovery-proof-identity FR-003", "0064-recovery-proof-identity FR-004", "0064-recovery-proof-identity FR-005", "0064-recovery-proof-identity FR-006"], "the proof model has drills (kept, only added to), calculation runs with the hash of their inputs and outputs, reference cases, lineage edges and entity links, with closed code lists and every concept defined", () => {
  const m = allModules().find((x) => x.name === "proof");
  assert(m !== undefined, "the proof module is one of the models");
  same(m.concepts.map((c) => c.name), ["drill", "calculationRun", "referenceCase", "lineageEdge", "entityLink"]);
  same(m.codeLists.map((l) => l.name), ["drillKind", "drillOutcome", "linkRule"]);
  for (const n of ["drill", "calculationRun"]) assert(m.concepts.find((c) => c.name === n)!.annotations.some((a) => a.kind === "quality.appendOnly"), `${n} is only added to`);
  assert(m.concepts.every((c) => c.definition.length > 30), "every concept is defined");
});

proves(["0064-recovery-proof-identity FR-007"], "a rollback drill counts what a load wrote, undoes it by its id, shows that what was removed is what was written, that none of its rows remain and that the rows of the four other loads are as they were, and keeps the drill", async () => {
  await each(async ({ on }) => {
    await seed(on);
    const d = await rollbackDrill(on, { drillId: "d1", loadId: "L3", tables: [written(flow.manifest, "loadId")], looks: { manifest: look } });
    same([d.outcome, d.problems, d.before.rows, d.after.rows], ["passed", [], 16, 16]);
    same(d.before.hash, d.after.hash);
    same((await from(flow.manifest).select((s) => ({ n: s.manifest.manifestId })).run(on)).length, 16);
    const kept = await from(proof.drill).select((s) => ({ kind: s.drill.kind, scope: s.drill.scope, outcome: s.drill.outcome })).run(on);
    same(kept, [{ kind: "rollback", scope: "L3", outcome: "passed" }]);
    same((await from(flow.load).select((s) => ({ id: s.load.loadId, undone: s.load.rolledBackAt })).orderBy((s) => [asc(s.load.loadId)]).run(on)).filter((l) => l.undone !== null).map((l) => l.id), ["L3"]);
  });
});

proves(["0064-recovery-proof-identity FR-008"], "a replay that is idempotent and a restore leave a table as it was and pass, one that changes it fails and says so, and each drill is kept with how long it took", async () => {
  await each(async ({ on }) => {
    await seed(on);
    const table = flow.manifest as never;
    const l = { table, ...look } as never;
    const rows = await from(flow.manifest).select((s) => ({ manifestId: s.manifest.manifestId, source: s.manifest.source, period: s.manifest.period, manifestCount: s.manifest.manifestCount, loadId: s.manifest.loadId })).run(on);
    const replay = await stateDrill(on, { drillId: "r1", kind: "replay", scope: "L2", look: l, steps: async () => {} });
    same([replay.outcome, replay.problems], ["passed", []]);
    const restore = await stateDrill(on, {
      drillId: "r2", kind: "restore", scope: "manifest", look: l,
      steps: async () => {
        await deleteFrom(flow.manifest).where((c) => isNotNull(c.manifestId)).run(on);
        await insertInto(flow.manifest).values(rows as never).run(on);
      },
    });
    same(restore.outcome, "passed");
    const broken = await stateDrill(on, { drillId: "r3", kind: "restore", scope: "manifest", look: l, steps: async () => void (await insertInto(flow.manifest).values({ manifestId: "stray", source: "x", period: null, manifestCount: 1, loadId: "L1" } as never).run(on)) });
    same([broken.outcome, broken.problems.length, broken.before.rows, broken.after.rows], ["failed", 1, 20, 21]);
    same((await from(proof.drill).select((s) => ({ id: s.drill.drillId, outcome: s.drill.outcome, kind: s.drill.kind })).orderBy((s) => [asc(s.drill.drillId)]).run(on)).map((d) => `${d.id}:${d.kind}:${d.outcome}`), ["r1:replay:passed", "r2:restore:passed", "r3:restore:failed"]);
    const f = await fingerprint(on, { table, columns: ["manifestId"], orderBy: ["manifestId"] });
    assert(f.rows === 21 && f.hash.length === 64, "a fingerprint is a count and a SHA-256");
  });
});

proves(["0064-recovery-proof-identity FR-009"], "a calculation is recorded with the hash of its inputs and outputs and reproduced from them: reproduced with the same inputs and version, and different-outputs after a change of rounding, different-inputs with other inputs, unknown for a run not recorded", async () => {
  await each(async ({ on }) => {
    const inputs = [{ admits: 120, readmits: 17 }, { admits: 80, readmits: 9 }];
    const v1 = (rows: readonly { admits: number; readmits: number }[]) => rows.map((r) => ({ rate: Math.round((r.readmits / r.admits) * 1000) / 10 }));
    const v2 = (rows: readonly { admits: number; readmits: number }[]) => rows.map((r) => ({ rate: Math.round(r.readmits / r.admits * 100) }));
    const rec = await recordCalculation(on, { calculationRunId: "c1", calculation: "readmission-rate", version: "1.0.0", parameters: { window: 30 }, inputs, run: v1, loadId: "L1", at: new Date("2025-03-01T00:00:00Z") });
    same(rec.outputs, [{ rate: 14.2 }, { rate: 11.3 }]);
    same(await reproduce(on, "c1", inputs, v1), { kind: "reproduced" });
    same((await reproduce(on, "c1", inputs, v2)).kind, "different-outputs");
    same(await reproduce(on, "c1", [{ admits: 1, readmits: 0 }], v1), { kind: "different-inputs" });
    same(await reproduce(on, "nope", inputs, v1), { kind: "unknown-run" });
    same((await from(proof.calculationRun).select((s) => ({ rows: s.calculationRun.rows, load: s.calculationRun.loadId, p: s.calculationRun.parameters })).run(on)), [{ rows: 2, load: "L1", p: "{\"window\":30}" }]);
    same(hashRows([1]), hashRows([1]));
  });
});

proves(["0064-recovery-proof-identity FR-010"], "reference cases hold a calculation to the value expected within the tolerance: a case within passes, one outside fails with the difference", async () => {
  await each(async ({ on }) => {
    const c = (id: string, inputs: object, expected: number, tolerance: number) => ({ referenceCaseId: id, calculation: "readmission-rate", description: id, inputs: JSON.stringify(inputs), expected: String(expected), tolerance: String(tolerance), source: "worked by hand" });
    await insertInto(proof.referenceCase).values([c("a", { admits: 100, readmits: 10 }, 10, 0), c("b", { admits: 120, readmits: 17 }, 14.2, 0.05), c("c", { admits: 80, readmits: 9 }, 11, 0.05)] as never).run(on);
    const r = await runReferenceCases(on, "readmission-rate", (i) => { const x = i as { admits: number; readmits: number }; return Math.round((x.readmits / x.admits) * 1000) / 10; });
    same(r.map((x) => [x.referenceCaseId, x.within]), [["a", true], ["b", true], ["c", false]]);
    same(Math.round(r[2]!.difference * 10) / 10, 0.3);
  });
});

proves(["0064-recovery-proof-identity FR-011"], "lineage is walked upstream and downstream, nearest first, each dataset once and without looping on a cycle, and its edges feed the label check of the contract model", async () => {
  await each(async ({ on }) => {
    const e = (a: string, b: string, via: string) => ({ lineageEdgeId: `${a}>${b}`, fromDataset: a, toDataset: b, via });
    await insertInto(proof.lineageEdge).values([e("raw", "stg", "clean"), e("stg", "mart", "model"), e("ref", "mart", "model"), e("mart", "report", "publish"), e("report", "stg", "feedback")] as never).run(on);
    same((await lineage(on, "raw", "downstream")).map((r) => `${r.depth}:${r.dataset}`), ["1:stg", "2:mart", "3:report"]);
    same((await lineage(on, "report", "upstream")).map((r) => `${r.depth}:${r.dataset}`), ["1:mart", "2:ref", "2:stg", "3:raw"]);
    same(await lineage(on, "report", "downstream"), [{ dataset: "stg", depth: 1, via: "feedback" }, { dataset: "mart", depth: 2, via: "model" }]);
    same((await edgesOf(on)).length, 5);
    same(labelViolations((await edgesOf(on)).filter((x) => x.to !== "stg" || x.from === "raw"), { raw: "restricted", stg: "restricted", ref: "public", mart: "public", report: "public" }).map((v) => v.dataset), ["mart", "report"]);
  });
});

proves(["0064-recovery-proof-identity FR-012", "0064-recovery-proof-identity FR-013"], "records of three sources are linked by rules tried in order (a key as it is, a key written one way, a similarity), each with the rule and score that joined it and a stable entity id, a record nothing links stays alone, and the links are kept", async () => {
  const r = (source: string, key: string, mrn: string | null, name: string, dob: string | null) => ({ source, key, fields: { mrn, name, dob } });
  const records = [
    r("ehr", "1", "A100", "Renée O'Neil", "1980-02-03"), r("lab", "9", "A100", "Renee ONeil", "1980-02-03"),
    r("ehr", "2", "B200", "Sam Park", "1991-07-07"), r("pharmacy", "5", null, "SAM  PARK", "1991-07-07"),
    r("ehr", "3", "C300", "Jonathan Smythe", "1975-05-05"), r("pharmacy", "6", null, "Jonathon Smyth", "1975-05-05"),
    r("lab", "7", "D400", "Ana Lima", "2001-01-01"),
  ];
  const links = linkRecords(records, [{ rule: "exact", fields: ["mrn"] }, { rule: "normalized", fields: ["name", "dob"] }, { rule: "similar", fields: ["name"], threshold: 0.8 }]);
  const of = (s: string, k: string) => links.find((l) => l.source === s && l.sourceKey === k)!;
  same(of("ehr", "1").entityId, of("lab", "9").entityId);
  same([of("lab", "9").rule, of("lab", "9").score], ["exact", 1]);
  same([of("ehr", "2").entityId === of("pharmacy", "5").entityId, of("pharmacy", "5").rule], [true, "normalized"]);
  same(of("ehr", "3").entityId === of("pharmacy", "6").entityId, true);
  same(of("pharmacy", "6").rule, "similar");
  assert(of("pharmacy", "6").score >= 0.8 && of("pharmacy", "6").score < 1, "a similarity is a score under 1");
  same(of("lab", "7").rule, "singleton");
  same(new Set(links.map((l) => l.entityId)).size, 4);
  same(linkRecords([...records].reverse(), [{ rule: "exact", fields: ["mrn"] }, { rule: "normalized", fields: ["name", "dob"] }, { rule: "similar", fields: ["name"], threshold: 0.8 }]), links);
  same([normalize("Renée O'Neil"), similarity("night", "nacht") > 0.2, similarity("a", "")], ["reneeoneil", true, 0]);
  await each(async ({ on }) => {
    await saveLinks(on, links);
    same((await from(proof.entityLink).select((s) => ({ id: s.entityLink.entityLinkId })).run(on)).length, 7);
  });
});
