/**
 * Tests of `repoctl sync` (commons repoctl 0003-repoctl-sync FR-001 to FR-004): the globs and the order of the generators, and a run over real generators (real Bun scripts in a real folder): only the stale ones are run, each is checked
 * again, a failure of one does not stop the others, `--check` writes nothing and names the generator and its command, a second run changes no file, and the real repository's `sync --check` ends with 0.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { fs, path } from "@intellectual-frontiers/system";
import { GENERATORS, type Generator } from "@intellectual-frontiers/repoctl/governance";
import { classify, findingsOfSync, generatorOf, matches, orderGenerators, overlap, reads, runSync, tailLines } from "@intellectual-frontiers/repoctl/logical";
import { main } from "@intellectual-frontiers/repoctl";
import { CAN_RUN, CHECKOUT, generator, withRepo } from "./world.ts";

const g = (id: Generator["id"], inputs: readonly string[], outputs: readonly string[]): Generator => ({ id, summary: id, command: [`${id}.ts`], inputs, outputs });

proves(["0003-repoctl-sync FR-001"], "a glob matches a path by segments, and two globs overlap where one path could match both", () => {
  assertEquals(matches("README.md", "README.md"), true);
  assertEquals(matches("commons/*/LICENSE", "commons/core/LICENSE"), true);
  assertEquals(matches("commons/*/LICENSE", "commons/core/src/LICENSE"), false);
  assertEquals(matches("commons/**/suite/**", "commons/a/b/suite/x/y.test.ts"), true);
  assertEquals(matches("commons/generated/*.auto.ttl", "commons/generated/mizan.auto.ttl"), true);
  assertEquals(matches("commons/generated/*.auto.ttl", "commons/generated/mizan.auto.ofn"), false);
  assertEquals(overlap("commons/*/library.ts", "commons/core/library.ts"), true);
  assertEquals(overlap("commons/generated/*.auto.ttl", "commons/generated/packaging.auto.*"), true);
  assertEquals(overlap("commons/*/LICENSE", "commons/*/library.ts"), false);
  assertEquals(overlap("README.md", "commons/**"), false);
});

proves(["0003-repoctl-sync FR-001"], "the order puts a reader after its writer, keeps the table's order where the globs do not order two, and refuses generators that wait for each other", () => {
  const writer = g("libraries", ["a/*.txt"], ["gen/out.txt"]);
  const reader = g("register", ["gen/*.txt"], ["gen/report.json"]);
  const free = g("readme", ["z.txt"], ["README.md"]);
  const ordered = orderGenerators([reader, free, writer]);
  assert(ordered.kind === "ok");
  assertEquals(ordered.value.map((x) => x.id), ["readme", "libraries", "register"]);
  assertEquals(reads(reader, writer), true);
  assertEquals(reads(writer, reader), false);
  assertEquals(reads(writer, writer), false, "a generator that reads its own output does not wait for itself");
  const a = g("libraries", ["b/*"], ["a/out"]);
  const b = g("register", ["a/*"], ["b/out"]);
  const cycle = orderGenerators([a, b]);
  assertEquals(cycle.kind === "err" ? [...cycle.error].sort() : [], ["libraries", "register"]);
  const real = orderGenerators(GENERATORS);
  assert(real.kind === "ok", "the repository's own table is an order");
  const at = (id: string): number => real.value.findIndex((x) => x.id === id);
  assert(at("libraries") < at("register") && at("packaging") < at("workflows"), "the register follows the libraries and the workflows follow the packaging");
  assertEquals(generatorOf(GENERATORS, "README.md")?.id, "readme");
  assertEquals(generatorOf(GENERATORS, "commons/core/LICENSE")?.id, "license");
  assertEquals(generatorOf(GENERATORS, "commons/generated/packaging.auto.ttl")?.id, "packaging");
  assertEquals(generatorOf(GENERATORS, "commons/core/src/mod.ts"), undefined);
});

proves(["0003-repoctl-sync FR-002"], "a generator's status is read as it ends: 0 fresh, 1 stale, anything else failed", () => {
  assertEquals([0, 1, 2, 127].map((code) => classify({ code, stdout: "", stderr: "" })), ["fresh", "stale", "failed", "failed"]);
  assertEquals(tailLines("a\n\n  b  \nc\n", 2), ["b", "c"]);
});

const TABLE = [
  { id: "libraries", out: "one.txt", from: ["a.txt"] },
  { id: "readme", out: "two.txt", from: ["b.txt"] },
  { id: "license", out: "three.txt", from: ["c.txt"] },
] as const;

proves(["0003-repoctl-sync FR-002", "0003-repoctl-sync FR-003", "0003-repoctl-sync FR-004"], "over real generators only the stale one is run and checked again, --check writes nothing and names the command, and a second run changes nothing", async () => {
  if (!CAN_RUN) return;
  await withRepo(TABLE, async (dir, world, generators) => {
    const write = (f: string, t: string) => fs.writeTextFile(path.join(dir, f), t);
    for (const f of ["a.txt", "b.txt", "c.txt"]) await write(f, "1\n");
    const ordered = orderGenerators(generators);
    assert(ordered.kind === "ok");
    const first = await runSync(world, "write", ordered.value);
    assertEquals(first.outcomes.map((o) => `${o.id} ${o.kind}`), ["libraries regenerated", "readme regenerated", "license regenerated"]);
    assertEquals(await fs.readTextFile(path.join(dir, "one.txt")), "a=1\n");
    const again = await runSync(world, "write", ordered.value);
    assertEquals(again.outcomes.map((o) => o.kind), ["fresh", "fresh", "fresh"], "a second run makes nothing");
    assertEquals(await fs.readTextFile(path.join(dir, "two.txt")), "b=1\n");
    // a source changes: only its generator is stale, --check says so and writes nothing
    await write("b.txt", "2\n");
    const checked = await runSync(world, "check", ordered.value);
    assertEquals(checked.outcomes.map((o) => `${o.id} ${o.kind}`), ["libraries fresh", "readme stale", "license fresh"]);
    assertEquals(await fs.readTextFile(path.join(dir, "two.txt")), "b=1\n", "--check writes nothing");
    const found = findingsOfSync(checked);
    assertEquals(found.map((f) => `${f.code} ${f.level} ${f.fix}`), ["E-STALE-GENERATED fail bun gen-readme.mjs"]);
    assertStringIncludes(found[0]?.message ?? "", "readme");
    // --only runs only what it names
    const some = await runSync(world, "write", ordered.value, ["license"]);
    assertEquals(some.outcomes.map((o) => o.id), ["license"]);
    assertEquals(await fs.readTextFile(path.join(dir, "two.txt")), "b=1\n");
    const rest = await runSync(world, "write", ordered.value);
    assertEquals(rest.outcomes.map((o) => o.kind), ["fresh", "regenerated", "fresh"]);
  });
});

proves(["0003-repoctl-sync FR-002"], "a generator that cannot be made is a failure of that generator and the others are still tried", async () => {
  if (!CAN_RUN) return;
  await withRepo(TABLE, async (dir, world, generators) => {
    await fs.writeTextFile(path.join(dir, "gen-readme.mjs"), "process.exit(2);\n");
    await fs.writeTextFile(path.join(dir, "gen-license.mjs"), `import { writeFileSync } from "node:fs"; if (process.argv.includes("--check")) process.exit(1); writeFileSync("three.txt", "x"); process.exit(0);\n`);
    const ordered = orderGenerators(generators);
    assert(ordered.kind === "ok");
    const r = await runSync(world, "write", ordered.value);
    assertEquals(r.outcomes.map((o) => `${o.id} ${o.kind}`), ["libraries regenerated", "readme failed", "license failed"], "a generator still stale after it ran is failed too");
    assertEquals(findingsOfSync(r).map((f) => f.code), ["E-GENERATOR-FAILED", "E-GENERATOR-FAILED"]);
    assertEquals(generator("readme", "x", "y", ["z"]).command, ["x"]);
  });
});

proves(["0003-repoctl-sync FR-003", "0003-repoctl-sync FR-004"], "the real repository is in step: sync --check ends with 0, --dry-run says what it would do, and an id that is no generator is a usage error", async () => {
  if (!CAN_RUN) return;
  const out: string[] = [];
  const err: string[] = [];
  const io = { cwd: CHECKOUT, out: (t: string) => void out.push(t), err: (t: string) => void err.push(t) };
  assertEquals(await main(["sync", "--check"], io), 0, `${out.join("")}${err.join("")}`);
  out.length = 0;
  assertEquals(await main(["sync", "--dry-run", "--only", "readme"], io), 0);
  assertStringIncludes(out.join(""), "readme");
  err.length = 0;
  assertEquals(await main(["sync", "--only", "nope"], io), 2);
  assertStringIncludes(err.join(""), "nope is not a generator");
});
