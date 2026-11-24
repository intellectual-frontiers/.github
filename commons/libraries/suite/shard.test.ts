/**
 * Tests of `src/shard.ts` and of the cells `plan.ts` gives a sharded library (0001-libraries FR-034): each test file is run by exactly one shard, the shards are balanced by the size of their
 * files, the same files give the same shards, and a library with `shards: N` has N cells in the plan, each with its place.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { planOf } from "../src/plan.ts";
import { doesOnce, parseShard, shardOf, type TestFile, weighted } from "../src/shard.ts";

const files = (sizes: readonly number[]): readonly TestFile[] => sizes.map((bytes, i) => ({ path: `suite/f${String(i).padStart(3, "0")}.test.ts`, bytes }));

proves(["0001-libraries FR-034"], "a shard is named k/N, with k from 1 to N, and nothing else names one", () => {
  assertEquals(parseShard("2/4"), { k: 2, n: 4 });
  for (const bad of ["", "0/4", "5/4", "a/b", "1/0", "1-4", "2/4 "]) assertEquals(parseShard(bad), undefined);
  assertEquals(parseShard(undefined), undefined);
});

proves(["0001-libraries FR-034"], "each test file is in exactly one of the N shards, for any sizes and any N, and the same files give the same shards", () => {
  for (const sizes of [[], [5], [9, 1, 1, 1, 1], [100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 5, 5, 5], Array.from({ length: 41 }, (_, i) => (i * 37) % 11)]) {
    for (const n of [1, 2, 3, 4, 7]) {
      const all = files(sizes);
      const seen: string[] = [];
      for (let k = 1; k <= n; k++) seen.push(...shardOf(all, { k, n }));
      assertEquals([...seen].sort(), all.map((f) => f.path).sort(), `${sizes.length} files in ${n} shards`);
      assertEquals(shardOf(all, { k: 1, n }), shardOf([...all].reverse(), { k: 1, n }));
    }
  }
});

proves(["0001-libraries FR-034"], "the shards are balanced: no shard holds more than the share of the others by more than the largest file", () => {
  const all = files([300, 250, 240, 120, 100, 90, 60, 40, 30, 20, 10, 10]);
  const n = 3;
  const bytes = (k: number): number => shardOf(all, { k, n }).reduce((s, p) => s + (all.find((f) => f.path === p)?.bytes ?? 0), 0);
  const loads = [1, 2, 3].map(bytes);
  assert(Math.max(...loads) - Math.min(...loads) <= 300, `loads ${loads.join(", ")}`);
});

proves(["0001-libraries FR-034"], "a library with shards: N has N cells in the plan, each with its place, the packing in the first, and a library without shards has one cell with no place", () => {
  const plan = planOf([{ name: "data", folder: "commons/data", verify: "bun run verify" }, { name: "assessment", folder: "commons/assessment", verify: "bun run verify" }], new Set(["data"]));
  const data = plan.linux.include.filter((c) => c.folder === "commons/data");
  assertEquals(data.map((c) => c.shard), ["1/4", "2/4", "3/4", "4/4"]);
  assertEquals(data.map((c) => c.pack), [true, false, false, false]);
  assertEquals(data.map((c) => c.name), ["data 1/4", "data 2/4", "data 3/4", "data 4/4"]);
  assertEquals(plan.linux.include.filter((c) => c.folder === "commons/assessment").map((c) => c.shard), [""]);
});

proves(["0001-libraries FR-034"], "what a library does once is done by its first shard, and by the cell of a library that is not split", () => {
  assertEquals(doesOnce(undefined), true);
  assertEquals(doesOnce({ k: 1, n: 4 }), true);
  assertEquals(doesOnce({ k: 2, n: 4 }), false);
});

proves(["0001-libraries FR-034"], "where a library keeps the seconds its files take, they balance the shards and not the sizes, and each file is still in exactly one", () => {
  const all: readonly TestFile[] = ["a", "b", "c", "d", "e"].map((n) => ({ path: `suite/${n}.test.ts`, bytes: 10 }));
  const w = weighted(all, "suite", { "a.test.ts": 40, "b.test.ts": 30, "c.test.ts": 30, "d.test.ts": 5 });
  assertEquals(w.map((f) => f.bytes), [40000, 30000, 30000, 5000, 2000]);
  const shards = [1, 2, 3].map((k) => shardOf(w, { k, n: 3 }));
  assertEquals(shards.flat().sort(), all.map((f) => f.path).sort());
  assertEquals(shards.find((s) => s.includes("suite/a.test.ts"))?.length, 1);
});

proves(["0001-libraries FR-035"], "a sharded cell carries its library and a slug with no space or slash, and --list prints the files of the shard", async () => {
  const plan = planOf([{ name: "data", folder: "commons/data", verify: "bun run verify" }, { name: "assessment", folder: "commons/assessment", verify: "bun run verify" }]);
  const cells = plan.linux.include.filter((c) => c.library === "data");
  assertEquals(cells.map((c) => c.slug), ["data-1-of-4", "data-2-of-4", "data-3-of-4", "data-4-of-4"]);
  for (const c of plan.linux.include) assert(!/[ /]/.test(c.slug), `slug ${c.slug}`);
  assertEquals(plan.linux.include.find((c) => c.name === "assessment")?.slug, "assessment");
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { spawnSync } = await import("node:child_process");
  const dir = mkdtempSync(join(tmpdir(), "shard-list-"));
  try {
    mkdirSync(join(dir, "suite"));
    for (const [i, size] of [30, 20, 10, 5].entries()) writeFileSync(join(dir, "suite", `f${i}.test.ts`), "x".repeat(size));
    const list = (shard: string): string[] =>
      spawnSync("bun", [join(import.meta.dirname, "..", "src", "shard.ts"), "--list", "suite"], { cwd: dir, env: { ...process.env, IFC_SHARD: shard }, encoding: "utf8" }).stdout.split("\n").filter((l) => l !== "");
    const all = list("").sort();
    assertEquals(all.length, 4);
    assertEquals([...list("1/2"), ...list("2/2")].sort(), all);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
