/**
 * Tests of what a query may do and what it may cost (commons anyfs-query 0004-query-safety FR-001 to FR-007): the consent of a place, the five limits of a budget and the way a run reports it reached one, objects that
 * are never read, the operations a run is made of, the store that cannot answer, an index of listings, and text that is not text.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { ROOT } from "@intellectual-frontiers/anyfs/governance";
import { only, type OpCapability, type Store } from "@intellectual-frontiers/anyfs/logical";
import { DEFAULT_BUDGET, covers, describeQueryProblem, parseBudget } from "../src/governance/mod.ts";
import { query } from "../src/mod.ts";
import { counting, contextOf, FILES, seed, timed, p } from "./kit.ts";

async function stores() {
  const store = timed();
  await seed(store);
  return store;
}

const run = async (ctx: ReturnType<typeof contextOf>, q: string) => {
  const r = await query(ctx, q);
  if (r.kind === "err") throw new Error(describeQueryProblem(q, r.error));
  return r.value;
};

proves(["0004-query-safety FR-001"], "a place is open to nothing, to what a listing says, or to the objects too, and a query needing more than it is given is refused before anything is listed", async () => {
  const c = counting(await stores());
  for (const [consent, files, content] of [["none", false, false], ["metadata", true, false], ["content", true, true]] as const) {
    const ctx = contextOf(c.store, consent);
    const f = await query(ctx, "SELECT path FROM files('fleet:/')");
    const t = await query(ctx, "SELECT path FROM content('fleet:/')");
    assertEquals(f.kind === "ok", files, consent);
    assertEquals(t.kind === "ok", content, consent);
    if (t.kind === "err") assertEquals(t.error, { kind: "consent", place: "fleet:", needed: "content", granted: consent });
  }
  assertEquals([covers("none", "metadata"), covers("metadata", "metadata"), covers("content", "metadata"), covers("metadata", "content")], [false, true, true, false]);
  const refused = counting(await stores());
  await query(contextOf(refused.store, "none"), "SELECT path FROM content('fleet:/')");
  assertEquals(refused.ops.length, 0);
  assertEquals((await query(contextOf(c.store, "none"), "SELECT uri FROM places")).kind, "ok", "the places of a context are not a place");
});

proves(["0004-query-safety FR-002"], "each limit of the budget stops a run and is named in its result with the rows the run had", async () => {
  const store = await stores();
  const total = Object.keys(FILES).length;
  const listed = await run(contextOf(store, "content", { budget: { maxListed: 4 } }), "SELECT path FROM files('fleet:/')");
  assertEquals([listed.truncated, listed.rows.length, listed.stats.listed], ["listed", 4, 4]);
  const read = await run(contextOf(store, "content", { budget: { maxRead: 2 } }), "SELECT path FROM content('fleet:/')");
  assertEquals([read.truncated, read.rows.length, read.stats.read], ["read", 2, 2]);
  const bytes = await run(contextOf(store, "content", { budget: { maxBytes: 100 } }), "SELECT path FROM content('fleet:/')");
  assertEquals(bytes.truncated, "bytes");
  assert(bytes.stats.bytes <= 100);
  const rows = await run(contextOf(store, "content", { budget: { maxRows: 3 } }), "SELECT path FROM files('fleet:/') ORDER BY path");
  assertEquals([rows.truncated, rows.rows.length], ["rows", 3]);
  const late = await run(contextOf(store, "content", { budget: { deadlineMs: 5_000 } }, 1_000), "SELECT path FROM files('fleet:/')");
  assertEquals(late.truncated, "deadline");
  assert(late.rows.length < total);
  const whole = await run(contextOf(store), "SELECT path FROM files('fleet:/')");
  assertEquals([whole.truncated, whole.rows.length], [undefined, total]);
  assertEquals(parseBudget({}).kind, "ok");
  for (const bad of [{ maxRows: 0 }, { maxRead: -1 }, { maxBytes: 1.5 }, { deadlineMs: Number.NaN }]) assertEquals(parseBudget(bad).kind, "err");
  const refused = await query(contextOf(store, "content", { budget: { maxRows: 0 } }), "SELECT path FROM files('fleet:/')");
  assert(refused.kind === "err" && refused.error.kind === "budget");
  assertEquals(DEFAULT_BUDGET.maxRead, 1000);
});

proves(["0004-query-safety FR-003"], "an object marked redacted is never read, and its text is not known", async () => {
  const c = counting(await stores());
  const ctx = contextOf(c.store, "content", { redacted: (_place, path) => path.startsWith("machines/") });
  const r = await run(ctx, "SELECT path, text, is_text, redacted FROM content('fleet:/') WHERE ext = 'json' ORDER BY path");
  assertEquals(r.rows.length, 4);
  for (const row of r.rows) assertEquals([row["text"], row["is_text"], row["redacted"]], [null, false, true]);
  assertEquals(c.ops.filter((o) => o.op === "read").length, 0);
  const hit = await run(ctx, "SELECT path FROM content('fleet:/') WHERE contains(text, 'alpha')");
  assertEquals(hit.rows.map((x) => x["path"]), ["docs/readme.md"], "a redacted object does not match on text it was not read for");
  assertEquals(c.ops.filter((o) => o.op === "read" && o.path.startsWith("machines/")).length, 0);
});

proves(["0004-query-safety FR-004"], "a run asks a store for list, stat, history and read and for nothing else, and the store is as it was", async () => {
  const store = await stores();
  const before = JSON.stringify(await Promise.all(Object.keys(FILES).map(async (k) => (await store.read(p(k))).kind === "ok")));
  const c = counting(store);
  const ctx = contextOf(c.store);
  for (const q of [
    "SELECT * FROM files('fleet:/')",
    "SELECT path FROM content('fleet:/') WHERE contains(text, 'alpha')",
    "SELECT path FROM files('fleet:/') WHERE path = 'root.txt'",
    "SELECT rev FROM revisions('fleet:/') WHERE path = 'root.txt'",
    "SELECT uri FROM places",
    "DELETE FROM files",
    "SELECT path FROM files('fleet:/') WHERE path = 'x'; DELETE FROM files",
  ]) await query(ctx, q);
  assert(c.ops.length > 0);
  for (const o of c.ops) assert(["list", "stat", "history", "read"].includes(o.op), o.op);
  assertEquals(JSON.stringify(await Promise.all(Object.keys(FILES).map(async (k) => (await store.read(p(k))).kind === "ok"))), before);
  const listing = await store.list(ROOT);
  assert(listing.kind === "ok" && listing.value.entries.length === Object.keys(FILES).length);
});

proves(["0004-query-safety FR-005"], "a store that cannot answer a table is a problem that names the capability", async () => {
  const store = await stores();
  const noList = only(store, ["read", "stat"] as const) as unknown as Store<OpCapability>;
  const noRead = only(store, ["list", "stat"] as const) as unknown as Store<OpCapability>;
  const noHistory = only(store, ["list", "read", "stat"] as const) as unknown as Store<OpCapability>;
  const l = await query(contextOf(noList), "SELECT path FROM files('fleet:/')");
  assert(l.kind === "err" && l.error.kind === "capability" && l.error.needed === "list");
  const r = await query(contextOf(noRead), "SELECT path FROM content('fleet:/')");
  assert(r.kind === "err" && r.error.kind === "capability" && r.error.needed === "read");
  const h = await query(contextOf(noHistory), "SELECT rev FROM revisions('fleet:/') WHERE path = 'root.txt'");
  assert(h.kind === "err" && h.error.kind === "capability" && h.error.needed === "history");
  assert(describeQueryProblem("", h.error).includes("history"));
  const ok = await query(contextOf(noRead), "SELECT path FROM files('fleet:/')");
  assertEquals(ok.kind, "ok");
});

proves(["0004-query-safety FR-006"], "an index of listings answers a listing without the store, a miss falls back to the store, and a read is always of the store", async () => {
  const store = await stores();
  const c = counting(store);
  const entries = await store.list(ROOT);
  assert(entries.kind === "ok");
  const asked: string[] = [];
  const index = {
    async list(place: string, prefix: string) {
      asked.push(`${place}${prefix}`);
      return prefix === "" || prefix === "machines" ? entries.value.entries.filter((e) => prefix === "" || e.path.startsWith("machines/")) : undefined;
    },
  };
  const ctx = contextOf(c.store, "content", { index: index as never });
  const a = await run(ctx, "SELECT path FROM files('fleet:/machines') ORDER BY path");
  assertEquals(a.rows.length, 5);
  assertEquals(c.count("list"), 0);
  assertEquals(a.stats.listCalls, 0);
  const miss = await run(ctx, "SELECT path FROM files('fleet:/docs') ORDER BY path");
  assertEquals(miss.rows.length, 3);
  assertEquals(c.count("list"), 1);
  const text = await run(ctx, "SELECT path FROM content('fleet:/machines') WHERE contains(text, 'alpha')");
  assertEquals(text.rows.length, 2);
  assertEquals(c.count("list"), 1, "the index answered the listing again");
  assertEquals(c.count("read"), 5, "the objects were read from the store");
  assert(asked.length >= 3);
});

proves(["0004-query-safety FR-007"], "bytes that are not UTF-8 have no text, and the row says so", async () => {
  const store = await stores();
  const r = await run(contextOf(store), "SELECT path, text, is_text FROM content('fleet:/docs') ORDER BY path");
  const img = r.rows.find((x) => x["path"] === "docs/img.bin");
  assertEquals([img?.["text"], img?.["is_text"]], [null, false]);
  const readme = r.rows.find((x) => x["path"] === "docs/readme.md");
  assertEquals(readme?.["is_text"], true);
  const texts = await run(contextOf(store), "SELECT path FROM content('fleet:/') WHERE is_text ORDER BY path");
  assertEquals(texts.rows.length, Object.keys(FILES).length - 1);
});
