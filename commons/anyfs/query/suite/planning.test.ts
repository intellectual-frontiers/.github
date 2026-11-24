/**
 * Tests of the plan of a query (commons anyfs-query 0003-query-planning FR-001 to FR-007): a filter is divided into what a listing answers and what a read answers, the paths it names say where to list, only what the
 * listing leaves is read, the result is the one of the plan run over everything, a limit ends the run early, the explanation says what would be done, and the versions of a path are asked of one path.
 *
 * @module
 */
import fc from "fast-check";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { analyze, boundOf, classify, explainQuery, query, reachOf } from "../src/mod.ts";
import { parsePrefix, type Prefix } from "@intellectual-frontiers/anyfs/governance";
import { counting, contextOf, FILES, reference, seed, timed } from "./kit.ts";

const prefix = (t: string): Prefix => {
  const r = parsePrefix(t);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};

const classified = (where: string) => {
  const a = analyze(`SELECT path FROM content('fleet:/') WHERE ${where}`);
  if (a.kind === "err") throw new Error(JSON.stringify(a.error));
  return classify(a.value.predicate);
};

proves(["0003-query-planning FR-001"], "each conjunct of a filter is of the listing or of the content", () => {
  const c = classified("ext = 'json' AND size > 10 AND contains(text, 'alpha') AND is_text AND path GLOB 'machines/*'");
  assertEquals(c.listing.length, 3);
  assertEquals(c.content.length, 2);
  assertEquals(classified("1 = 1").content.length, 0);
  assertEquals(classified("contains(text, 'a') OR ext = 'json'").content.length, 1);
  assertEquals(classified("contains(text, 'a') OR ext = 'json'").listing.length, 0);
});

proves(["0003-query-planning FR-002"], "the paths a filter names say where to list: one path, a prefix, or nowhere", () => {
  const b = (where: string) => classified(where).bound;
  assertEquals(b("path = 'machines/alpha.json'").kind, "exact");
  assertEquals(b("path GLOB 'machines/alpha.json'").kind, "exact");
  const below = b("path GLOB 'machines/archive/*.json'");
  assert(below.kind === "below" && below.prefix === "machines/archive");
  const mid = b("path GLOB 'machines/al*'");
  assert(mid.kind === "below" && mid.prefix === "machines", "a prefix ends at a whole segment");
  const u = b("under(path, 'docs')");
  assert(u.kind === "below" && u.prefix === "docs");
  const both = b("under(path, 'machines') AND path GLOB 'machines/archive/*'");
  assert(both.kind === "below" && both.prefix === "machines/archive", "the deepest prefix");
  assertEquals(b("under(path, 'machines') AND under(path, 'docs')").kind, "nowhere");
  assertEquals(b("path = 'a' AND path = 'b'").kind, "nowhere");
  assertEquals(b("path = 'docs/readme.md' AND under(path, 'machines')").kind, "nowhere");
  assertEquals(b("path LIKE 'machines/%'").kind, "anywhere", "LIKE ignores case, and a prefix does not");
  assertEquals(b("path GLOB '*.json'").kind, "below", "a glob with no literal start is the whole store");
  assertEquals(b("path GLOB '*.json' OR ext = 'md'").kind, "anywhere");
  assertEquals(b("size > 1").kind, "anywhere");
  assertEquals(boundOf([]).kind, "anywhere");
  assertEquals(reachOf(prefix("machines"), { kind: "below", prefix: prefix("docs"), rules: [] }).kind, "nothing");
  const deeper = reachOf(prefix("machines"), { kind: "below", prefix: prefix("machines/archive"), rules: [] });
  assert(deeper.kind === "below" && deeper.prefix === "machines/archive");
  const shallower = reachOf(prefix("machines/archive"), { kind: "below", prefix: prefix("machines"), rules: [] });
  assert(shallower.kind === "below" && shallower.prefix === "machines/archive", "the place's own prefix is kept");
});

proves(["0003-query-planning FR-002"], "the operations a query makes follow its bound: a prefix lists below it, one path is a stat, nowhere asks nothing", async () => {
  const store = timed();
  await seed(store);
  const c = counting(store);
  const ctx = contextOf(c.store);
  const run = async (q: string): Promise<readonly string[]> => {
    const r = await query(ctx, q);
    if (r.kind === "err") throw new Error(JSON.stringify(r.error));
    return r.value.rows.map((x) => String(x["path"]));
  };
  assertEquals(await run("SELECT path FROM files('fleet:/') WHERE path GLOB 'machines/archive/*'"), ["machines/archive/2024.json"]);
  assertEquals(c.ops.map((o) => (o.op === "list" ? `list:${o.prefix}` : o.op)), ["list:machines/archive"]);
  c.ops.length = 0;
  assertEquals(await run("SELECT path FROM files('fleet:/') WHERE path = 'docs/readme.md'"), ["docs/readme.md"]);
  assertEquals(c.ops.map((o) => (o.op === "stat" ? `stat:${o.path}` : o.op)), ["stat:docs/readme.md"]);
  c.ops.length = 0;
  assertEquals(await run("SELECT path FROM files('fleet:/') WHERE under(path, 'a') AND under(path, 'b')"), []);
  assertEquals(c.ops.length, 0);
  assertEquals(await run("SELECT path FROM files('fleet:/machines') WHERE under(path, 'docs')"), []);
  assertEquals(c.ops.length, 0, "a place and a prefix that do not meet list nothing");
  assertEquals((await run("SELECT path FROM files('fleet:/machines') WHERE ext = 'json'")).length, 4);
  assertEquals(c.ops.map((o) => (o.op === "list" ? `list:${o.prefix}` : o.op)), ["list:machines"]);
});

proves(["0003-query-planning FR-003"], "an object is read only when the listing has left it", async () => {
  const store = timed();
  await seed(store);
  const c = counting(store);
  const ctx = contextOf(c.store);
  const r = await query(ctx, "SELECT path FROM content('fleet:/') WHERE ext = 'json' AND size < 60 AND contains(text, 'alpha')");
  assert(r.kind === "ok");
  const candidates = Object.entries(FILES).filter(([k, v]) => k.endsWith(".json") && (typeof v === "string" ? v.length : v.length) < 60).length;
  assertEquals(c.count("read"), candidates);
  assertEquals(r.value.stats.read, candidates);
  assert(c.count("read") < Object.keys(FILES).length);
  assertEquals(r.value.rows.map((x) => x["path"]), ["machines/alpha.json"]);
});

const CONJUNCTS = [
  "ext = 'json'",
  "ext <> 'json'",
  "size > 30",
  "size <= 3000",
  "path GLOB 'machines/*'",
  "path GLOB 'docs/*'",
  "under(path, 'machines')",
  "NOT under(path, 'docs')",
  "name GLOB '*a*'",
  "contains(text, 'alpha')",
  "contains(text, 'x')",
  "is_text",
  "json_get(text, '$.cpu') > 1",
  "length(text) < 100",
  "depth = 1",
  "depth >= 2",
] as const;

proves(["0003-query-planning FR-004"], "a query gives the rows of its plan run over every object, whatever is pushed down", async () => {
  const store = timed();
  await seed(store);
  const ctx = contextOf(store);
  await fc.assert(
    fc.asyncProperty(fc.uniqueArray(fc.constantFrom(...CONJUNCTS), { minLength: 1, maxLength: 4 }), fc.constantFrom("", " ORDER BY path", " ORDER BY size DESC, path", " ORDER BY path LIMIT 3", " ORDER BY path LIMIT 2 OFFSET 1"), async (parts, tail) => {
      const text = `SELECT path, size FROM content('fleet:/') WHERE ${parts.join(" AND ")}${tail}`;
      const got = await query(ctx, text);
      assert(got.kind === "ok", text);
      assertEquals(got.value.rows, await reference(store, text), text);
    }),
    { numRuns: 120 },
  );
  await fc.assert(
    fc.asyncProperty(fc.uniqueArray(fc.constantFrom(...CONJUNCTS.filter((c) => !c.includes("text") && c !== "is_text")), { minLength: 1, maxLength: 3 }), async (parts) => {
      const text = `SELECT path FROM files('fleet:/') WHERE ${parts.join(" AND ")} ORDER BY path`;
      const got = await query(ctx, text);
      assert(got.kind === "ok", text);
      assertEquals(got.value.rows, await reference(store, text), text);
    }),
    { numRuns: 60 },
  );
});

proves(["0003-query-planning FR-005"], "a limit with no sort ends the run as soon as it has its rows, and a sort reads everything", async () => {
  const store = timed();
  await seed(store);
  const first = counting(store);
  const r1 = await query(contextOf(first.store), "SELECT path FROM content('fleet:/') WHERE contains(text, 'alpha') LIMIT 1");
  assert(r1.kind === "ok");
  assertEquals(r1.value.rows.length, 1);
  assertEquals(first.count("read") < Object.keys(FILES).length, true);
  const second = counting(store);
  const r2 = await query(contextOf(second.store), "SELECT path FROM content('fleet:/') WHERE contains(text, 'alpha') ORDER BY path LIMIT 1");
  assert(r2.kind === "ok");
  assertEquals(second.count("read"), Object.keys(FILES).length);
  const r3 = await query(contextOf(store), "SELECT path FROM files('fleet:/') LIMIT 2 OFFSET 1");
  assert(r3.kind === "ok");
  assertEquals(r3.value.rows.length, 2);
  assertEquals(r3.value.stats.listed, 3);
});

proves(["0003-query-planning FR-006"], "the explanation says the plan, the place, what is listed, the filters of each kind, the consent and the budget, and calls no store", async () => {
  const store = timed();
  await seed(store);
  const c = counting(store);
  const e = explainQuery(contextOf(c.store, "content", { budget: { maxRead: 5 } }), "SELECT path FROM content('fleet:/machines') WHERE path GLOB 'machines/*.json' AND contains(text, 'alpha') AND size < 1 KB ORDER BY path LIMIT 3");
  assert(e.kind === "ok");
  assertEquals(
    e.value,
    [
      "limit 3",
      "  project path",
      "    sort path",
      "      filter path GLOB 'machines/*.json' AND contains(text, 'alpha') AND size < 1024",
      "        scan content",
      "source: content('fleet:/machines') at fleet:/machines",
      "lists: below machines",
      "pushed: path GLOB 'machines/*.json'",
      "listing filters: path GLOB 'machines/*.json' AND size < 1024",
      "content filters: contains(text, 'alpha') (only for objects the listing filters leave)",
      "consent: needs content",
      "budget: 100000 listed, 5 read, 67108864 bytes, 10000 rows, 30000 ms",
    ].join("\n"),
  );
  assertEquals(c.ops.length, 0);
  const none = explainQuery(contextOf(c.store), "SELECT path FROM files('fleet:/') WHERE path = 'docs/readme.md'");
  assert(none.kind === "ok" && none.value.includes("stats: docs/readme.md"));
  const never = explainQuery(contextOf(c.store), "SELECT path FROM files('fleet:/') WHERE under(path, 'a') AND under(path, 'b')");
  assert(never.kind === "ok" && never.value.includes("lists: nothing ("));
});

proves(["0003-query-planning FR-007"], "the versions of a path are asked of one path and of a store that has history, and places lists the places of the context", async () => {
  const store = timed();
  await seed(store);
  const ctx = contextOf(store);
  const w = async (body: string) => (await store.write(FILES_PATH, new TextEncoder().encode(body), { kind: "any" } as never));
  await w("one");
  await w("two");
  const r = await query(ctx, "SELECT rev, size FROM revisions('fleet:/') WHERE path = 'root.txt' ORDER BY size");
  assert(r.kind === "ok");
  assert(r.value.rows.length >= 2);
  const any = await query(ctx, "SELECT rev FROM revisions('fleet:/')");
  assert(any.kind === "err" && any.error.kind === "path-needed");
  const places = await query(ctx, "SELECT uri, kind, consistency FROM places");
  assert(places.kind === "ok");
  assertEquals(places.value.rows, [{ uri: "fleet:", kind: "memory", consistency: "strong" }]);
  const noPlace = await query({ ...ctx, defaultPlace: undefined as never }, "SELECT path FROM files");
  assert(noPlace.kind === "err" && noPlace.error.kind === "place");
  const unknown = await query(ctx, "SELECT path FROM files('nowhere:/')");
  assert(unknown.kind === "err" && unknown.error.kind === "place");
});

import { p } from "./kit.ts";
const FILES_PATH = p("root.txt");
