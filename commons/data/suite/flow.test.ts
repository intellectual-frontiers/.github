// Spec: 0060-flow-ledger FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010, FR-011
/**
 * The flow ledger (commons data 0060-flow-ledger), on SQLite, DuckDB and PostgreSQL, with the worked examples of the book "Accepted Is Not Correct" reproduced exactly: chapter 1's twenty messages through eight stages (the
 * message that vanished is the one the gap query returns, `unexplained = 0`), chapter 6's thousand deliveries with fifty redeliveries and ten conflicts (one effect each, the conflicts queued, the originals intact), chapter 11's
 * funnel (a seeded silent drop is found and attributed to the boundary it happened at) and chapter 13's rollback of one load of forty by its id.
 *
 * @module
 */
import { assert, proves } from "@intellectual-frontiers/test";
import { allModules } from "@intellectual-frontiers/data/sql/cli";
import { confirm, funnel, gaps, intake, lastConfirmed, loads, openLoad, rollbackLoad, STAGES, type Confirmation, written } from "@intellectual-frontiers/data/sql/flow";
import { fromRows, runLoad } from "@intellectual-frontiers/data/sql/loads";
import { bind } from "@intellectual-frontiers/data/sql/physical";
import { schemaOf, defineArca } from "@intellectual-frontiers/data/sql/cli";
import { count, defineTable, eq, from, insertInto, type Runner } from "@intellectual-frontiers/data/sql/typed";
import { flow } from "@intellectual-frontiers/data/sql/typed/models";
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
  const schema = must(schemaOf(defineArca({ models: ["flow"] } as never) as never)).schema;
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
const reasons = async (on: Runner, codes: readonly string[]): Promise<void> => {
  await insertInto(flow.reason).values(codes.map((c) => ({ reasonId: c, meaning: c.replaceAll("-", " "), producerCode: "pipeline" })) as never).run(on);
};

proves(
  ["0060-flow-ledger FR-001", "0060-flow-ledger FR-002", "0060-flow-ledger FR-003", "0060-flow-ledger FR-004", "0060-flow-ledger FR-005", "0060-flow-ledger FR-006"],
  "the flow model has the eight stages in order, a closed code list for each thing that is said of one, reasons as data, loads, the contract of a stage, a ledger that is only added to, the idempotent intake with its conflicts, and the manifest with its funnel; every concept says what it means",
  () => {
    const m = allModules().find((x) => x.name === "flow");
    assert(m !== undefined, "the flow module is one of the models");
    same(Object.keys(m.codeLists.find((l) => l.name === "stage")?.codes ?? {}), ["received", "captured", "parsed", "mapped", "validated", "forwarded", "destVerdict", "usable"]);
    same(m.concepts.map((c) => c.name), ["reason", "load", "stageContract", "ledgerEntry", "delivery", "deliveryConflict", "manifest", "batchStage", "loss"]);
    assert(m.concepts.every((c) => c.definition.length > 30), "every concept is defined");
    assert(m.codeLists.every((l) => l.annotations.some((a) => a.kind === "quality.openness")), "every code list says if it is open");
    assert(m.concepts.find((c) => c.name === "ledgerEntry")?.annotations.some((a) => a.kind === "quality.appendOnly") === true, "the ledger is only added to");
    same([...STAGES], ["received", "captured", "parsed", "mapped", "validated", "forwarded", "dest_verdict", "usable"]);
  },
);

proves(
  ["0060-flow-ledger FR-007", "0060-flow-ledger FR-008"],
  "chapter 1: twenty messages through eight stages, each confirmation a row of the ledger with its load id; the last stage that confirmed each message, the parse failure, the destination's rejection, the message that vanished (the gap query returns exactly it), the one that was accepted and is not usable, and 1 + 1 + 1 + 1 + 16 = 20",
  async () => {
    await each(async ({ on }, name) => {
      await reasons(on, ["parse-error", "missing-birth-date", "stale-empty-result"]);
      const id = await openLoad(on, { loadType: "delivery", source: "sender-a" });
      const rows: Confirmation[] = [];
      const at = (s: string) => ({ loadId: id, subject: s });
      for (let n = 1; n <= 20; n++) {
        const s = `m${n}`;
        const through = (last: (typeof STAGES)[number]): void => void STAGES.slice(0, STAGES.indexOf(last) + 1).forEach((st) => rows.push({ ...at(s), stage: st, outcome: st === "dest_verdict" ? "accepted" : "passed" }));
        if (n === 1) {
          // the parse failure
          through("captured");
          rows.push({ ...at(s), stage: "parsed", outcome: "failed", reason: "parse-error" });
        } else if (n === 2) {
          // the destination's rejection
          through("forwarded");
          rows.push({ ...at(s), stage: "dest_verdict", outcome: "rejected", reason: "missing-birth-date" });
        } else if (n === 3) through("captured"); // it vanishes: nothing after CAPTURED
        else if (n === 4) {
          // accepted by the destination and not usable: a stale empty answer was cached
          through("dest_verdict");
          rows.push({ ...at(s), stage: "usable", outcome: "unusable", reason: "stale-empty-result" });
        } else through("usable");
      }
      await confirm(on, rows);
      assert((await from(flow.ledgerEntry).select(() => ({ n: count() })).run(on))[0]?.n === rows.length, name);
      const last = new Map((await lastConfirmed(on, id)).map((l) => [l.subject, `${l.stage}:${l.outcome}`]));
      same([last.get("m1"), last.get("m2"), last.get("m3"), last.get("m4"), last.get("m5")], ["parsed:failed", "dest_verdict:rejected", "captured:passed", "usable:unusable", "usable:passed"], name);
      same(await gaps(on, "captured", id), ["m3"], `${name}: the gap query returns exactly the message that vanished`);
      const usable = [...last.values()].filter((v) => v === "usable:passed").length;
      same([usable, last.size, 1 + 1 + 1 + 1 + usable], [16, 20, 20], `${name}: unexplained = 0`);
      same((await from(flow.ledgerEntry).select((s) => ({ l: s.ledgerEntry.loadId })).distinct().run(on)).map((r) => r.l), [id], `${name}: every row carries the load id`);
      let again: unknown;
      await confirm(on, [{ ...at("m5"), stage: "usable", outcome: "passed" }]).catch((x: unknown) => (again = x));
      assert(again !== undefined, `${name}: the same confirmation twice is refused by the database`);
      same((await loads(on)).map((l) => [l.loadId, l.loadType]), [[id, "delivery"]], name);
    });
  },
);

proves(
  ["0060-flow-ledger FR-009"],
  "chapter 6: a thousand unique deliveries, fifty redeliveries and ten with the same id and other content give a thousand effects, delivery counts that total 1,050, a conflict queue of exactly ten with the originals intact, and effects by load id that sum to a thousand; two workers racing give one first",
  async () => {
    const effect = defineTable<{ readonly id: string; readonly loadId: string }, { readonly id: string; readonly loadId: string }, "effect">({ alias: "effect", name: "effect", columns: { id: "id", loadId: "load_id" }, primaryKey: ["id"] });
    await each(async ({ e, on }, name) => {
      await e.run("CREATE TABLE effect (id TEXT PRIMARY KEY, load_id TEXT NOT NULL)");
      const id = await openLoad(on, { loadType: "delivery", source: "sender-a", tenant: "t1" });
      const results: string[] = [];
      const deliver = async (msg: string, content: string): Promise<void> => {
        const r = await intake(on, { loadId: id, tenant: "t1", senderMessageId: msg, content });
        results.push(r.disposition);
        if (r.disposition === "first") await insertInto(effect).values({ id: msg, loadId: id }).run(on);
      };
      for (let n = 0; n < 1000; n++) await deliver(`m${n}`, `body ${n}`);
      for (let n = 0; n < 50; n++) await deliver(`m${n}`, `body ${n}`);
      for (let n = 100; n < 110; n++) await deliver(`m${n}`, `CHANGED ${n}`);
      same([results.filter((r) => r === "first").length, results.filter((r) => r === "duplicate").length, results.filter((r) => r === "conflict").length], [1000, 50, 10], name);
      same((await from(effect).select(() => ({ n: count() })).run(on))[0]?.n, 1000, `${name}: a thousand effects`);
      same((await e.rows("SELECT sum(delivery_count) AS n FROM delivery")).map((r) => Number(r["n"])), [1050], `${name}: delivery counts total 1,050`);
      same((await e.rows("SELECT count(*) AS n FROM delivery_conflict")).map((r) => Number(r["n"])), [10], `${name}: the conflict queue holds exactly ten`);
      const original = await e.rows("SELECT content_sha_256 AS h FROM delivery WHERE sender_message_id = 'm105'");
      const conflict = await e.rows("SELECT incoming_sha_256 AS h, status FROM delivery_conflict WHERE delivery_id = 't1/m105'");
      assert(original[0]?.["h"] !== conflict[0]?.["h"] && conflict[0]?.["status"] === "open", `${name}: the original is intact and the conflict is open`);
      same((await e.rows("SELECT load_id AS l, count(*) AS n FROM effect GROUP BY load_id")).map((r) => [r["l"], Number(r["n"])]), [[id, 1000]], `${name}: effects by load id sum to a thousand`);
      // the same conflicting content again is queued once
      await intake(on, { loadId: id, tenant: "t1", senderMessageId: "m100", content: "CHANGED 100" });
      same((await e.rows("SELECT count(*) AS n FROM delivery_conflict")).map((r) => Number(r["n"])), [10], `${name}: the same conflict twice is one`);
      // two workers racing for one message: one first and one duplicate, every time
      for (let n = 0; n < 20; n++) {
        const both = await Promise.all([intake(on, { loadId: id, tenant: "t1", senderMessageId: `race${n}`, content: "x" }), intake(on, { loadId: id, tenant: "t1", senderMessageId: `race${n}`, content: "x" })]);
        same(both.map((b) => b.disposition).sort(), ["duplicate", "first"], `${name}: race ${n}`);
      }
    });
  },
);

proves(
  ["0060-flow-ledger FR-010"],
  "chapter 11: a manifest of 1,000 goes to 975 accepted with 6 parse failures, 13 contract failures and 6 destination rejections and nothing is unexplained; a run with 4 messages silently dropped between two stages has 4 unexplained, attributed to the boundary they went missing at; a batch whose duplicates are reason-coded reconciles at both grains",
  async () => {
    await each(async ({ on }, name) => {
      await reasons(on, ["parse-error", "contract-failure", "dest-rejected", "duplicate-key", "unclassifiable"]);
      const id = await openLoad(on, { loadType: "delivery", source: "sender-a" });
      const batch = async (m: string, count: number, stages: Record<string, number>, losses: readonly (readonly [string, number, string])[]): Promise<void> => {
        await insertInto(flow.manifest).values({ manifestId: m, source: "sender-a", manifestCount: count, loadId: id }).run(on);
        for (const [stage, n] of Object.entries(stages)) await insertInto(flow.batchStage).values({ batchStageId: `${m}/${stage}`, manifestId: m, stage: stage as never, entities: n }).run(on);
        let i = 0;
        for (const [stage, n, reason] of losses) await insertInto(flow.loss).values({ lossId: `${m}/loss${i++}`, manifestId: m, stage: stage as never, entities: n, reasonId: reason }).run(on);
      };
      const funnel1 = { received: 1000, parsed: 994, validated: 981, forwarded: 981, dest_verdict: 975 };
      await batch("run1", 1000, funnel1, [["parsed", 6, "parse-error"], ["validated", 13, "contract-failure"], ["dest_verdict", 6, "dest-rejected"]]);
      await batch("run2", 1000, { ...funnel1, dest_verdict: 971 }, [["parsed", 6, "parse-error"], ["validated", 13, "contract-failure"], ["dest_verdict", 6, "dest-rejected"]]);
      // dataset 2: the source says 500 orders and extraction delivered 507 rows: 7 duplicate rows have a reason; 500 become 497 published and 3 rejected at normalization
      await batch("rows", 507, { received: 507, validated: 500, dest_verdict: 497 }, [["validated", 7, "duplicate-key"], ["dest_verdict", 3, "unclassifiable"]]);
      await batch("orders", 500, { received: 500, dest_verdict: 497 }, [["dest_verdict", 3, "unclassifiable"]]);
      const f = await funnel(on);
      const by = new Map(f.map((x) => [x.manifestId, x]));
      same([by.get("run1")?.accepted, by.get("run1")?.lost, by.get("run1")?.unexplained, by.get("run1")?.boundaries], [975, 25, 0, []], `${name}: run 1`);
      same([by.get("run2")?.unexplained, by.get("run2")?.boundaries], [4, [{ before: "forwarded", after: "dest_verdict", missing: 4 }]], `${name}: run 2: four, at the boundary they went missing`);
      same([by.get("rows")?.unexplained, by.get("orders")?.unexplained], [0, 0], `${name}: both grains reconcile`);
      same((await funnel(on, ["run2"])).map((x) => x.manifestId), ["run2"], name);
    });
  },
);

proves(
  ["0060-flow-ledger FR-011"],
  "chapter 13: 5,000 bundles in 40 loads of 125, and a load undone by its id removes exactly its 125 rows from the table that carries its id and leaves the other 39 loads byte-identical by hash; the load is marked as undone and the ledger keeps what it confirmed",
  async () => {
    const bundle = defineTable<{ readonly id: string; readonly body: string; readonly loadId: string }, { readonly id: string; readonly body: string; readonly loadId: string }, "bundle">({ alias: "bundle", name: "bundle", columns: { id: "id", body: "body", loadId: "load_id" }, primaryKey: ["id"] });
    await each(async ({ e, on }, name) => {
      await e.run("CREATE TABLE bundle (id TEXT PRIMARY KEY, body TEXT NOT NULL, load_id TEXT NOT NULL)");
      const ids: string[] = [];
      for (let l = 1; l <= 40; l++) {
        const id = await openLoad(on, { loadType: "delivery", source: "sender-a", loadId: `load-${l}` });
        ids.push(id);
        const r = await runLoad({ name: "bundles", source: fromRows(Array.from({ length: 125 }, (_, i) => ({ id: `b${l}-${i}`, body: `body ${l} ${i}`, loadId: id }))), target: bundle, batchSize: 125 }, on);
        assert(r.status === "loaded", `${name}: ${r.message}`);
        await confirm(on, [{ loadId: id, subject: `batch${l}`, stage: "forwarded", outcome: "passed", grain: "batch", entities: 125 }]);
      }
      const hash = async (excluding: string): Promise<string> => JSON.stringify((await e.rows(`SELECT id, body FROM bundle WHERE load_id <> '${excluding}' ORDER BY id`)).map((r) => [r["id"], r["body"]]));
      const before = await hash("load-17");
      same((await from(bundle).select(() => ({ n: count() })).run(on))[0]?.n, 5000, name);
      const done = await rollbackLoad(on, "load-17", [written(bundle, "loadId")]);
      same(done, { loadId: "load-17", removed: { bundle: 125 } }, name);
      same((await from(bundle).select(() => ({ n: count() })).run(on))[0]?.n, 4875, `${name}: 4,875 left`);
      assert((await hash("load-17")) === before, `${name}: the other 39 loads are byte-identical`);
      same((await loads(on)).filter((l) => l.rolledBackAt !== null).map((l) => l.loadId), ["load-17"], name);
      same((await from(flow.ledgerEntry).where((s) => eq(s.ledgerEntry.loadId, "load-17")).select(() => ({ n: count() })).run(on))[0]?.n, 1, `${name}: the ledger keeps what the load confirmed`);
    });
  },
);
