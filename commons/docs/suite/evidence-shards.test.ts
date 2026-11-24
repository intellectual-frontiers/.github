/**
 * Tests of `src/shards.ts` and of the night's evidence job (docs 0001-docs FR-048, FR-049): the shards of a library put together equal what one run of the whole suite keeps, a line is found once and hit where
 * any shard reached it, a missing shard is said by the status, and the generated workflow runs the tests once, in the shards of CI, with the repository's tests in three cells.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { linesOfLcov, mergeCtrf, mergeLines, mergeStatus, parseShardFile } from "../src/shards.ts";
import { parseLcov } from "../src/coverage.ts";

const test = (file: string, name: string, status: "passed" | "failed" | "skipped") => ({ name, status, duration: 3, filePath: file, extra: { requirements: [] } });
const doc = (tests: readonly unknown[], start: number, stop: number, extra: Record<string, unknown> = {}): string => {
  const count = (s: string): number => tests.filter((t) => (t as { status: string }).status === s).length;
  return JSON.stringify({
    reportFormat: "CTRF",
    specVersion: "0.0.0",
    results: {
      tool: { name: "ifc quality" },
      summary: { tests: tests.length, passed: count("passed"), failed: count("failed"), skipped: count("skipped"), pending: 0, other: 0, start, stop },
      tests,
      environment: { osPlatform: "linux", commit: "abc" },
      extra: { notRun: 0, cancelled: 0, todo: 0, unproven: [], failures: [], ...extra },
    },
  });
};

proves(["0001-docs FR-049"], "the shards of a library put together have the tests and the counts of one run of the whole suite", () => {
  const a = [test("suite/a.test.ts", "one", "passed"), test("suite/a.test.ts", "two", "failed")];
  const b = [test("suite/b.test.ts", "three", "passed"), test("suite/c.test.ts", "four", "skipped")];
  const whole = JSON.parse(doc([...a, ...b], 100, 400)) as { results: { tests: unknown[]; summary: Record<string, number> } };
  const merged = JSON.parse(mergeCtrf([doc(b, 250, 400), doc(a, 100, 300)]).text) as typeof whole;
  const key = (x: unknown): string => `${(x as { filePath: string }).filePath} ${(x as { name: string }).name}`;
  assertEquals([...merged.results.tests].map(key), [...whole.results.tests].map(key).sort());
  assertEquals(merged.results.summary, whole.results.summary);
  assertEquals(mergeCtrf([doc(a, 1, 2), "not json", "{}"]).merged, 1);
  assertEquals(mergeCtrf([doc(a, 1, 2), "not json", "{}"]).skipped, 2);
});

proves(["0001-docs FR-049"], "a line is found once however many shards ran it, and hit where any shard reached it", () => {
  const lcov = (da: readonly (readonly [number, number])[]): string => `SF:src/x.ts\n${da.map(([l, h]) => `DA:${l},${h}`).join("\n")}\nLF:${da.length}\nLH:${da.filter(([, h]) => h > 0).length}\nend_of_record\n`;
  const first = lcov([[1, 1], [2, 0], [3, 0], [4, 2]]);
  const second = lcov([[1, 0], [2, 3], [3, 0], [4, 0]]);
  const keep = (): boolean => true;
  const merged = mergeLines([linesOfLcov(first, "commons/l", keep), linesOfLcov(second, "commons/l", keep)]);
  assertEquals(merged, [{ path: "commons/l/src/x.ts", found: 4, hit: 3 }]);
  // the unsharded run reaches the union of the lines: its LF and LH are the merged found and hit
  const whole = lcov([[1, 1], [2, 3], [3, 0], [4, 2]]);
  assertEquals(parseLcov(whole, "commons/l"), merged);
});

proves(["0001-docs FR-049"], "a status says missing for a step where a shard has none, and succeeds only where every shard did", () => {
  const cell = (shard: string, tests: string, reported = true) => ({ library: "data", install: "success", runner: "success", tests, reported, shard });
  assertEquals(mergeStatus("data", [cell("1/2", "success"), cell("2/2", "success")], 2), { library: "data", install: "success", runner: "success", tests: "success", reported: true });
  assertEquals(mergeStatus("data", [cell("1/2", "success")], 2).tests, "missing");
  assertEquals(mergeStatus("data", [cell("1/2", "success"), cell("2/2", "failure", false)], 2), { library: "data", install: "success", runner: "success", tests: "failure", reported: false });
});

proves(["0001-docs FR-049"], "a shard file is named for its library, its place and its kind, and no other name is one", () => {
  assertEquals(parseShardFile("data.shard-2-of-4.ctrf.json"), { library: "data", k: 2, n: 4, kind: "ctrf" });
  assertEquals(parseShardFile("anyfs-sql.shard-1-of-3.lcov.json"), { library: "anyfs-sql", k: 1, n: 3, kind: "lcov" });
  for (const bad of ["data.ctrf.json", "data.shard-5-of-4.ctrf.json", "data.shard-0-of-4.ctrf.json", "status-data.json", "data.shard-1-of-2.coverage.json"]) assertEquals(parseShardFile(bad), undefined);
});

proves(["0001-docs FR-048"], "the generated evidence workflow runs the tests once with the coverage, in the shards of CI, and puts the shards together", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  const text = readFileSync(join(root, ".github", "workflows", "evidence.auto.yml"), "utf8");
  assert(text.includes("IFC_SHARD: ${{ matrix.shard }}"), "the cells run their shard");
  assert(text.includes("merge-shards.ts"), "the shards are put together");
  assert(text.includes("tests (repository ${{ matrix.part }}/3)"), "the repository tests are split");
  assert(text.includes("repository-${{ matrix.part }}-of-3"), "in three cells (part 1 to 3)");
  assert(!/evidence-\$\{\{ matrix\.name \}\}/.test(text), "an artifact is named by the slug, which has no slash");
  const runs = text.split("evidence.ts --library").length - 1;
  assertEquals(runs, 2, "one run of the tool for a library's cell and one for the repository's");
});
