// Spec: 0054-sql-loads FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008
/**
 * Loads and extracts (commons data 0054-sql-loads), on real engines: sources (CSV with typed cells and rejected lines, lines of JSON, rows, a select), extracts that read back to the same rows, loads in each mode,
 * ELT through a staging table gated by SQL-DQ tests, the share of rejected lines, the high-water mark of an incremental load, the ledger of runs, and a copy from one database to another.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import { assert, proves } from "@intellectual-frontiers/test";
import {
  bool, csvRecords, date, decimal, ensureLedger, extractCsv, extractJsonLines, fromCsv, fromJsonLines, fromQuery, fromRows, integer, oneOf, optional, runLoad, text, watermarkOf,
} from "@intellectual-frontiers/data/sql/loads";
import { acceptedRange, notNull, on as onRelation, unique, use } from "@intellectual-frontiers/data/sql/quality";
import { asc, count, defineTable, from, gt, type Runner } from "@intellectual-frontiers/data/sql/typed";
import { DIALECTS, openEngine, type Engine } from "./engines-fixture.ts";
import { same } from "./governance-fixture.ts";
import { driverOf } from "./lifecycle-fixture.ts";

interface Item { readonly id: number; readonly name: string; readonly qty: number; readonly note: string | null; readonly updated: string }
interface ItemInsert { readonly id: number; readonly name: string; readonly qty: number; readonly note?: string | null; readonly updated: string }
const item = defineTable<Item, ItemInsert, "item">({ alias: "item", name: "item", columns: { id: "id", name: "name", qty: "qty", note: "note", updated: "updated" }, primaryKey: ["id"] });
const DDL = "CREATE TABLE item (id INTEGER PRIMARY KEY, name TEXT NOT NULL, qty INTEGER NOT NULL, note TEXT, updated TEXT NOT NULL)";
const columns = { id: integer, name: text, qty: integer, note: optional(text), updated: text } as const;

async function world(name: Engine["name"]): Promise<{ e: Engine; on: Runner }> {
  const e = await openEngine(name);
  await e.run(DDL);
  return { e, on: { driver: driverOf(e), dialect: DIALECTS.find((x) => x.name === name)!.dialect } };
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
const all = (on: Runner): Promise<readonly Item[]> => from(item).select((s) => ({ id: s.item.id, name: s.item.name, qty: s.item.qty, note: s.item.note, updated: s.item.updated })).orderBy((_, o) => [asc(o.id)]).run(on);

const CSV = 'id,name,qty,note,updated\r\n1,Ann,5,,2026-01-01\r\n2,"Bo, Jr.",7,"a ""quoted""\nnote",2026-01-02\r\n3,Cy,9,x,2026-01-03\r\n';

proves(
  ["0054-sql-loads FR-001", "0054-sql-loads FR-002"],
  "sources give rows in batches: CSV with quoted cells, doubled quotes, line breaks inside quotes, a byte order mark and typed cells; a line that does not read is rejected with its line and why; lines of JSON; rows; and a select",
  async () => {
    same(csvRecords('a,"b,c",d\n"x\ny",2,\n').map((r) => [r.line, r.cells]), [[1, ["a", "b,c", "d"]], [2, ["x\ny", "2", ""]]]);
    same(csvRecords("﻿a,b\r\n1,2").length, 2);
    const batches = async <R>(s: { batches(n: number): AsyncIterable<{ rows: readonly R[]; rejected: readonly unknown[] }> }, n = 100): Promise<{ rows: R[]; rejected: unknown[] }> => {
      const out = { rows: [] as R[], rejected: [] as unknown[] };
      for await (const b of s.batches(n)) {
        out.rows.push(...b.rows);
        out.rejected.push(...b.rejected);
      }
      return out;
    };
    const good = await batches(fromCsv<ItemInsert>(CSV, columns));
    same(good.rejected, []);
    same(good.rows.map((r) => [r.id, r.name, r.note]), [[1, "Ann", null], [2, "Bo, Jr.", 'a "quoted"\nnote'], [3, "Cy", "x"]]);
    const bad = await batches(fromCsv<ItemInsert>("id,name,qty,note,updated\n1,A,x,,d\n2,B\n3,C,4,,d\n", columns));
    same(bad.rows.length, 1);
    same(bad.rejected, [{ at: 2, reason: 'qty: "x" is not an integer', raw: "1,A,x,,d" }, { at: 3, reason: "2 cells where the header has 5", raw: "2,B" }]);
    same((await batches(fromCsv<ItemInsert>("id,name\n1,A\n", columns))).rejected.map((r) => (r as { reason: string }).reason), ["the header has no column qty, note, updated"]);
    same((await batches(fromCsv<{ readonly n: number }>("Number\n7\n", { n: { parse: integer, column: "Number" } }))).rows, [{ n: 7 }]);
    const cells = [bool("YES"), bool("0"), date("2026-02-30"), decimal("1.50"), decimal("1e3"), oneOf("a", "b")("c")].map((r) => r.kind);
    same(cells, ["ok", "ok", "err", "ok", "err", "err"]);
    const lines = await batches(fromJsonLines<{ readonly a: number }>('{"a":1}\n\nnope\n{"a":"x"}\n{"a":3}\n', (v) => (typeof v === "object" && v !== null && typeof (v as { a?: unknown }).a === "number" ? ok(v as { a: number }) : err("not a row")))); 
    same(lines.rows, [{ a: 1 }, { a: 3 }]);
    same(lines.rejected, [{ at: 3, reason: "not JSON", raw: "nope" }, { at: 4, reason: "not a row", raw: '{"a":"x"}' }]);
    const sizes: number[] = [];
    for await (const b of fromRows([1, 2, 3, 4, 5]).batches(2)) sizes.push(b.rows.length);
    same(sizes, [2, 2, 1]);
    await each(async ({ e, on }) => {
      await e.run("INSERT INTO item VALUES (1,'a',1,NULL,'d'),(2,'b',2,NULL,'d')");
      same((await batches(fromQuery(from(item).select((s) => ({ id: s.item.id })).orderBy((_, o) => [asc(o.id)]), on))).rows, [{ id: 1 }, { id: 2 }]);
    });
  },
);

proves(["0054-sql-loads FR-003"], "an extract is CSV with a header and quoted cells where they need it, or lines of JSON, and a CSV that is extracted is read again to the same rows", async () => {
  await each(async ({ on }, name) => {
    const r = await runLoad({ name: "items", source: fromCsv<ItemInsert>(CSV, columns), target: item }, on);
    same(r.status, "loaded", name);
    const sel = from(item).select((s) => ({ id: s.item.id, name: s.item.name, qty: s.item.qty, note: s.item.note, updated: s.item.updated })).orderBy((_, o) => [asc(o.id)]);
    const out = await extractCsv(sel, on);
    assert(out.startsWith("id,name,qty,note,updated\r\n1,Ann,5,,2026-01-01\r\n2,\"Bo, Jr.\",7,\"a \"\"quoted\"\"\nnote\""), `${name}: ${out}`);
    const again: ItemInsert[] = [];
    for await (const b of fromCsv<ItemInsert>(out, columns).batches(10)) again.push(...b.rows);
    same(again, await all(on), name);
    const lines = (await extractJsonLines(sel, on)).trim().split("\n").map((l) => JSON.parse(l) as Item);
    same(lines, await all(on), name);
    same(await extractCsv(from(item).where((s) => gt(s.item.id, 99)).select((s) => ({ id: s.item.id })), on), "\r\n", name);
    same(await extractJsonLines(from(item).where((s) => gt(s.item.id, 99)).select((s) => ({ id: s.item.id })), on), "", name);
  });
});

proves(
  ["0054-sql-loads FR-004"],
  "a load in each mode: append fails on a key that is there and leaves the table as it was, skip-existing keeps the rows that are there, upsert changes them, replace empties the table first; batches, one transaction, and a row of the ledger for each run",
  async () => {
    await each(async ({ on }, name) => {
      const rows = (extra: readonly ItemInsert[] = []): ItemInsert[] => [{ id: 1, name: "one", qty: 1, updated: "d1" }, { id: 2, name: "two", qty: 2, updated: "d1" }, { id: 3, name: "three", qty: 3, updated: "d1" }, ...extra];
      const first = await runLoad({ name: "items", source: fromRows(rows()), target: item, batchSize: 2 }, on);
      same([first.status, first.read, first.written], ["loaded", 3, 3], name);
      const again = await runLoad({ name: "items", source: fromRows(rows()), target: item }, on);
      same(again.status, "failed", name);
      assert(again.message !== undefined && again.message.length > 0, name);
      same((await all(on)).length, 3, `${name}: the failed load took nothing`);
      const dupMid = await runLoad({ name: "items", source: fromRows([{ id: 7, name: "new", qty: 7, updated: "d2" }, { id: 1, name: "dup", qty: 0, updated: "d2" }]), target: item, batchSize: 1 }, on);
      same([dupMid.status, (await all(on)).length], ["failed", 3], `${name}: a batch before the failure was not kept`);
      const skip = await runLoad({ name: "items", source: fromRows([{ id: 1, name: "ONE", qty: 9, updated: "d2" }, { id: 4, name: "four", qty: 4, updated: "d2" }]), target: item, mode: "skip-existing" }, on);
      same(skip.status, "loaded", name);
      same((await all(on)).map((r) => `${r.id}:${r.name}`), ["1:one", "2:two", "3:three", "4:four"], name);
      const up = await runLoad({ name: "items", source: fromRows([{ id: 1, name: "ONE", qty: 9, updated: "d3" }, { id: 5, name: "five", qty: 5, updated: "d3" }]), target: item, mode: "upsert" }, on);
      same(up.status, "loaded", name);
      same((await all(on)).map((r) => `${r.id}:${r.name}:${r.qty}`), ["1:ONE:9", "2:two:2", "3:three:3", "4:four:4", "5:five:5"], name);
      const rep = await runLoad({ name: "items", source: fromRows([{ id: 9, name: "nine", qty: 9, updated: "d4" }]), target: item, mode: "replace" }, on);
      same([rep.status, (await all(on)).map((r) => r.id)], ["loaded", [9]], name);
      const runs = await on.driver.query('SELECT status, read_count AS r, written_count AS w FROM "load_run" ORDER BY started_at, run_id');
      same(runs.map((r) => r["status"]).sort(), ["failed", "failed", "loaded", "loaded", "loaded", "loaded"], name);
      same(Number(runs.find((r) => Number(r["r"]) === 3)?.["w"]), 3, name);
      const keyless = await runLoad({ name: "k", source: fromRows([]), target: defineTable<Item, ItemInsert, "k">({ alias: "k", name: "item", columns: item.sqlNames }), mode: "upsert" }, on);
      same(keyless.status, "failed", name);
    });
  },
);

proves(
  ["0054-sql-loads FR-005"],
  "ELT: the rows go to a staging table, SQL-DQ tests run on it, and only a load that passes is merged; one that does not leaves the target as it was, reports the failures, and drops the staging table unless it is asked to keep it",
  async () => {
    await each(async ({ e, on }, name) => {
      const gate = (s: { name: string; schema?: string }) => [...onRelation(s).column("id", use(unique)), ...onRelation(s).column("qty", use(acceptedRange, { min: 0, max: 100 })), ...onRelation(s).column("name", use(notNull))];
      const ok1 = await runLoad({ name: "gated", source: fromRows<ItemInsert>([{ id: 1, name: "a", qty: 1, updated: "d" }, { id: 2, name: "b", qty: 2, updated: "d" }]), target: item, gate }, on);
      same([ok1.status, ok1.quality.length, (await all(on)).length], ["loaded", 3, 2], name);
      const bad = await runLoad({ name: "gated", source: fromRows<ItemInsert>([{ id: 3, name: "c", qty: 3, updated: "d" }, { id: 3, name: "dup", qty: 500, updated: "d" }]), target: item, gate, keepStaging: true }, on);
      same(bad.status, "gated", name);
      same(bad.quality.filter((o) => o.status === "fail").map((o) => o.test.name), ["unique_item_stg_id", "accepted_range_item_stg_qty__0__100"], name);
      same((await all(on)).map((r) => r.id), [1, 2], `${name}: the target is as it was`);
      same(await e.rows('SELECT count(*) AS n FROM "item__stg"').then((r) => Number(r[0]?.["n"]), () => -1), -1, `${name}: the transaction took the staging table with it`);
      const upsert = await runLoad({ name: "gated", source: fromRows<ItemInsert>([{ id: 2, name: "B", qty: 20, updated: "e" }, { id: 4, name: "d", qty: 4, updated: "e" }]), target: item, gate, mode: "upsert" }, on);
      same(upsert.status, "loaded", name);
      same((await all(on)).map((r) => `${r.id}:${r.name}`), ["1:a", "2:B", "4:d"], name);
      const replaced = await runLoad({ name: "gated", source: fromRows<ItemInsert>([{ id: 8, name: "h", qty: 8, updated: "f" }]), target: item, gate, mode: "replace" }, on);
      same([replaced.status, (await all(on)).map((r) => r.id)], ["loaded", [8]], name);
      same(await e.rows('SELECT count(*) AS n FROM "item__stg"').then(() => "there", () => "gone"), "gone", `${name}: the staging table is dropped`);
    });
  },
);

proves(
  ["0054-sql-loads FR-006"],
  "the lines that are rejected are reported by line, a load is refused and takes nothing where more than the share that is allowed was rejected, and a load with some rejected lines takes the rest",
  async () => {
    await each(async ({ on }, name) => {
      const src = (): ReturnType<typeof fromCsv<ItemInsert>> => fromCsv<ItemInsert>("id,name,qty,note,updated\n1,A,1,,d\n2,B,x,,d\n3,C,3,,d\n4,D,y,,d\n", columns);
      const strict = await runLoad({ name: "csv", source: src(), target: item, maxRejected: 0.25 }, on);
      same([strict.status, strict.rejected.map((r) => r.at), (await all(on)).length], ["rejected", [3, 5], 0], name);
      const lax = await runLoad({ name: "csv", source: src(), target: item }, on);
      same([lax.status, lax.read, lax.written, lax.rejected.length, (await all(on)).length], ["loaded", 2, 2, 2, 2], name);
    });
  },
);

proves(
  ["0054-sql-loads FR-007"],
  "a load keeps the greatest value of a column as its high-water mark, the next run reads from it, and a load that did not load does not move it",
  async () => {
    await each(async ({ on }, name) => {
      same(await watermarkOf(on, "inc"), undefined, name);
      const first = await runLoad({ name: "inc", source: fromRows<ItemInsert>([{ id: 1, name: "a", qty: 1, updated: "2026-01-01" }, { id: 2, name: "b", qty: 1, updated: "2026-01-03" }]), target: item, watermark: "updated" }, on);
      same([first.status, first.watermark], ["loaded", "2026-01-03"], name);
      same(await watermarkOf(on, "inc"), "2026-01-03", name);
      const failed = await runLoad({ name: "inc", source: fromRows<ItemInsert>([{ id: 1, name: "dup", qty: 1, updated: "2026-02-01" }]), target: item, watermark: "updated" }, on);
      same(failed.status, "failed", name);
      same(await watermarkOf(on, "inc"), "2026-01-03", name);
      const upstream = [{ id: 2, name: "b", qty: 1, updated: "2026-01-03" }, { id: 3, name: "c", qty: 1, updated: "2026-01-05" }, { id: 4, name: "d", qty: 1, updated: "2026-01-09" }];
      const since = (await watermarkOf(on, "inc"))!;
      const second = await runLoad({ name: "inc", source: fromRows<ItemInsert>(upstream.filter((r) => r.updated > since)), target: item, watermark: "updated" }, on);
      same([second.status, second.read, second.watermark, (await all(on)).length], ["loaded", 2, "2026-01-09", 4], name);
      same(await watermarkOf(on, "other"), undefined, name);
      await ensureLedger(on);
      same(Number((await on.driver.query('SELECT count(*) AS n FROM "load_run"'))[0]?.["n"]), 3, name);
    });
  },
);

proves(
  ["0054-sql-loads FR-008"],
  "a select of one database is loaded into a table of another, through a gate, on every pair of engines: rows are copied, counted and recorded in the target's ledger",
  async () => {
    for (const a of DIALECTS) {
      for (const b of DIALECTS) {
        const src = await world(a.name);
        const dst = await world(b.name);
        try {
          await src.e.run("INSERT INTO item VALUES (1,'a',1,NULL,'d'),(2,'b',2,'n','d'),(3,'c',3,NULL,'d')");
          const copy = fromQuery(from(item).select((s) => ({ id: s.item.id, name: s.item.name, qty: s.item.qty, note: s.item.note, updated: s.item.updated })), src.on);
          const r = await runLoad({ name: `copy-${a.name}`, source: copy, target: item, gate: (s) => onRelation(s).column("id", use(unique)) }, dst.on);
          same([r.status, r.written], ["loaded", 3], `${a.name} to ${b.name}`);
          same(await all(dst.on), await all(src.on), `${a.name} to ${b.name}`);
          same(Number((await from(item).select(() => ({ n: count() })).run(dst.on))[0]?.n), 3);
        } finally {
          await src.e.close();
          await dst.e.close();
        }
      }
    }
  },
);
