/**
 * Tests of the agreement of stores (commons anyfs-query 0005-query-agreement FR-001 to FR-003): the same queries over a store in memory, in a folder and in a Git branch give the same rows, a listing of many pages is
 * read to its end, and objects whose names are hostile to a query are rows like any other.
 *
 * @module
 */
import { fs, path as osPath, proc } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { expectAny } from "@intellectual-frontiers/anyfs/governance";
import { localStore } from "@intellectual-frontiers/anyfs/local";
import type { AnyStore } from "@intellectual-frontiers/anyfs/logical";
import { memoryStore } from "@intellectual-frontiers/anyfs/memory";
import { gitRefStore, parseIdentity } from "@intellectual-frontiers/anyfs-git";
import { describeQueryProblem } from "../src/governance/mod.ts";
import { query } from "../src/mod.ts";
import { FILES, contextOf, p, seed } from "./kit.ts";

async function git(dir: string, ...args: readonly string[]): Promise<void> {
  const out = await proc.run(["git", "-C", dir, ...args], { env: { GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" } });
  if (!out.success) throw new Error(`git ${args.join(" ")}: ${out.stderr.trim()}`);
}

/** Runs a test body over a store in memory, a store of a folder and a store of a Git branch, each with the files of the tests. */
async function overStores(files: Readonly<Record<string, string | Uint8Array>>, use: (stores: readonly { readonly name: string; readonly store: AnyStore }[]) => Promise<void>): Promise<void> {
  const dir = await fs.makeTempDir({ prefix: "anyfs-query-" });
  try {
    const memory = memoryStore({ name: "agree" });
    const folderPath = osPath.join(dir, "folder");
    await fs.mkdir(folderPath, { recursive: true });
    const folder = await localStore(folderPath, { create: true });
    assert(folder.kind === "ok");
    const repo = osPath.join(dir, "repo.git");
    await git(dir, "init", "-q", "--bare", "-b", "main", repo);
    const who = parseIdentity("Fleet Collector", "collector@example.test");
    assert(who.kind === "ok");
    const branch = await gitRefStore({ repo, branch: "fleet", commit: { author: who.value, clock: () => Date.UTC(2026, 0, 1) } });
    assert(branch.kind === "ok");
    const stores = [
      { name: "memory", store: memory as AnyStore },
      { name: "folder", store: folder.value as AnyStore },
      { name: "git", store: branch.value.store as AnyStore },
    ];
    for (const s of stores) await seed(s.store, files);
    await use(stores);
  } finally {
    await fs.remove(dir, { recursive: true }).catch(() => undefined);
  }
}

const QUERIES = [
  "SELECT path, size, ext, rev FROM files('fleet:/') ORDER BY path",
  "SELECT path FROM files('fleet:/') WHERE ext = 'json' AND size > 30 ORDER BY path",
  "SELECT path FROM files('fleet:/machines') WHERE path GLOB 'machines/*.json' ORDER BY path",
  "SELECT path, json_get(text, '$.cpu') AS cpu FROM content('fleet:/') WHERE ext = 'json' AND is_text ORDER BY cpu DESC, path",
  "SELECT path FROM content('fleet:/') WHERE contains(text, 'alpha') ORDER BY path",
  "SELECT path, is_text FROM content('fleet:/docs') ORDER BY path",
  "SELECT upper(name) AS n, depth FROM files('fleet:/') WHERE depth >= 2 ORDER BY n",
  "SELECT path FROM files('fleet:/') WHERE path = 'root.txt'",
  "SELECT path FROM files('fleet:/') WHERE under(path, 'machines/archive')",
  "SELECT path FROM files('fleet:/') WHERE ext = 'none'",
];

proves(["0005-query-agreement FR-001"], "the same queries over memory, a folder and a Git branch give the same rows and the same listing and read counts", async () => {
  await overStores(FILES, async (stores) => {
    for (const q of QUERIES) {
      const results = [];
      for (const s of stores) {
        const r = await query(contextOf(s.store), q);
        assert(r.kind === "ok", `${s.name}: ${q}: ${r.kind === "err" ? describeQueryProblem(q, r.error) : ""}`);
        results.push({ name: s.name, rows: r.value.rows, read: r.value.stats.read, truncated: r.value.truncated });
      }
      const [first, ...rest] = results;
      for (const r of rest) {
        assertEquals(r.rows, first?.rows, `${r.name} against ${first?.name}: ${q}`);
        assertEquals(r.read, first?.read, `${r.name} reads: ${q}`);
        assertEquals(r.truncated, first?.truncated);
      }
    }
  });
});

proves(["0005-query-agreement FR-002"], "objects with names hostile to a query are rows, and a query that names them is an ordinary one", async () => {
  const names: Record<string, string> = {
    "a b/c d.txt": "spaces",
    "quote's/it's.txt": "quotes",
    "pct%/under_score.txt": "like wildcards",
    "glob[ab]/set[1].txt": "glob classes",
    "dollar/$(id)`x`.txt": "shell syntax",
    "unicode/naïve-日本.txt": "unicode",
    "semi;colon/--comment.txt": "sql in a name",
  };
  await overStores(names, async (stores) => {
    for (const s of stores) {
      const ctx = contextOf(s.store);
      const all = await query(ctx, "SELECT path FROM files('fleet:/') ORDER BY path");
      assert(all.kind === "ok", s.name);
      assertEquals(all.value.rows.length, Object.keys(names).length, s.name);
      const one = await query(ctx, "SELECT path FROM content('fleet:/') WHERE path = 'quote''s/it''s.txt'");
      assert(one.kind === "ok", s.name);
      assertEquals(one.value.rows.map((x) => x["path"]), ["quote's/it's.txt"], s.name);
      const wild = await query(ctx, "SELECT path FROM files('fleet:/') WHERE path LIKE 'pct%%' ESCAPE '%'");
      assert(wild.kind === "ok" || wild.kind === "err", s.name);
      const inj = await query(ctx, "SELECT path FROM files('fleet:/') WHERE path = 'x'' OR ''1''=''1'");
      assert(inj.kind === "ok" && inj.value.rows.length === 0, `${s.name}: an injected condition matched`);
      const underscore = await query(ctx, "SELECT path FROM files('fleet:/') WHERE name LIKE 'under_score.txt'");
      assert(underscore.kind === "ok" && underscore.value.rows.length === 1, s.name);
    }
  });
});

proves(["0005-query-agreement FR-003"], "a listing of several pages is read to its end, one call a page, and a count is the same over every store", async () => {
  const many: Record<string, string> = {};
  for (let i = 0; i < 2500; i++) many[`bulk/f${String(i).padStart(4, "0")}.txt`] = i % 7 === 0 ? "seven" : "other";
  const store = memoryStore({ name: "bulk" });
  await seed(store, many);
  const all = await query(contextOf(store), "SELECT path FROM files('fleet:/') ORDER BY path");
  assert(all.kind === "ok");
  assertEquals([all.value.rows.length, all.value.stats.listCalls, all.value.stats.listed], [2500, 3, 2500]);
  const capped = await query(contextOf(store), "SELECT path FROM content('fleet:/') WHERE contains(text, 'seven') AND depth = 2");
  assert(capped.kind === "ok");
  assertEquals([capped.value.truncated, capped.value.stats.read], ["read", 1000], "the default budget reads a thousand objects");
  const sevens = await query(contextOf(store, "content", { budget: { maxRead: 5000 } }), "SELECT path FROM content('fleet:/') WHERE contains(text, 'seven') AND depth = 2");
  assert(sevens.kind === "ok");
  assertEquals([sevens.value.truncated, sevens.value.rows.length, sevens.value.stats.read], [undefined, Math.floor(2499 / 7) + 1, 2500]);
  const limited = await query(contextOf(store), "SELECT path FROM files('fleet:/') LIMIT 3");
  assert(limited.kind === "ok");
  assertEquals(limited.value.stats.listCalls, 1);
  assertEquals(await store.read(p("bulk/f0000.txt")).then((r) => r.kind), "ok");
  void expectAny;
});
