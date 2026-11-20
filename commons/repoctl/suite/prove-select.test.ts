/**
 * Tests of the selection, the cache, the smoke gate and the quarantine of `repoctl prove` (commons repoctl 0007-repoctl-prove FR-011 to FR-014): which tests a change runs and which it leaves out, a result cache that holds a pass under an exact
 * key (a real run twice over a real repository), the suites of the foundation libraries planned for a foundation change, the quarantine record with its expiry, the seeds of a failing property test, and the plan job's summary.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { ok } from "@intellectual-frontiers/core";
import { fs, path } from "@intellectual-frontiers/system";
import { FOUNDATION, type LibraryName, parseLibraryName, parseQuarantine } from "@intellectual-frontiers/repoctl/governance";
import { applyQuarantine, cacheKeyOf, planProof, provesOf, readsTheTree, seedsOf, selectSeam, selectTests, specIdsOf, specOfPath, type LibraryNode, type TestReach, type World } from "@intellectual-frontiers/repoctl/logical";
import { makePlan, runPlan, systemFiles, systemWorld } from "@intellectual-frontiers/repoctl/physical";
import { CAN_RUN, CHECKOUT, git, put } from "./world.ts";

const lib = (name: string): LibraryName => {
  const r = parseLibraryName(name);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};

const test = (name: string, depends: readonly string[], extra: Partial<TestReach> = {}): TestReach => ({
  library: lib("leaf"),
  path: `commons/leaf/suite/${name}.test.ts`,
  depends,
  environmental: false,
  proves: [],
  uses: [],
  ...extra,
});

proves(["0007-repoctl-prove FR-011"], "a test runs where what it imports changed, where a requirement it proves is named by a changed file, or where it reads the tree; the others are left out", () => {
  assertEquals(specIdsOf("// Spec: 0003-repoctl-sync FR-002, FR-003\nexport const a = 1;\n"), ["0003-repoctl-sync FR-002", "0003-repoctl-sync FR-003"]);
  assertEquals(provesOf('proves(["0003-repoctl-sync FR-002", "0003-repoctl-sync FR-004"], "x", () => {});\nproves(["0001-a FR-001"], "y", () => {});'), ["0001-a FR-001", "0003-repoctl-sync FR-002", "0003-repoctl-sync FR-004"]);
  assertEquals(specOfPath("commons/repoctl/spec-kit/specs/0007-repoctl-prove/spec.md"), "0007-repoctl-prove");
  assertEquals(readsTheTree("const x = path.join(CHECKOUT, 'a')"), true);
  assertEquals(readsTheTree("const x = 1"), false);
  const tests = [
    test("by-import", ["commons/leaf/src/a.ts", "commons/core/src/x.ts"]),
    test("by-folder", ["commons/core/"]),
    test("by-trace", ["commons/leaf/src/b.ts"], { proves: ["0001-leaf FR-003"] }),
    test("by-spec", ["commons/leaf/src/b.ts"], { proves: ["0007-repoctl-prove FR-001"] }),
    test("reads", ["commons/leaf/src/b.ts"], { environmental: true }),
    test("alone", ["commons/leaf/src/b.ts"]),
  ];
  const run = (changed: readonly { path: string; text: string }[], everything = false) => selectTests(tests, changed, everything);
  const sel = run([{ path: "commons/core/src/x.ts", text: "export const x = 1;\n// Spec: 0001-leaf FR-003\n" }]);
  assertEquals(sel.run.map((r) => `${r.test.path.split("/").pop()}:${r.by}`), ["by-import.test.ts:import", "by-folder.test.ts:import", "by-trace.test.ts:trace", "reads.test.ts:environmental"]);
  assertEquals(sel.left.map((t) => t.path.split("/").pop()), ["by-spec.test.ts", "alone.test.ts"]);
  const spec = run([{ path: "commons/repoctl/spec-kit/specs/0007-repoctl-prove/spec.md", text: "" }]);
  assert(spec.run.some((r) => r.test.path.endsWith("by-spec.test.ts") && r.by === "trace"));
  assertEquals(run([], true).run.length, tests.length);
});

proves(["0007-repoctl-prove FR-011"], "a seam runs the tests whose library files import a changed symbol of the provider, or every symbol, and the cache key is exact", () => {
  const tests = [
    test("uses-ok", [], { uses: [{ provider: lib("core"), usage: { all: false, names: ["ok"] } }] }),
    test("uses-other", [], { uses: [{ provider: lib("core"), usage: { all: false, names: ["err"] } }] }),
    test("uses-all", [], { uses: [{ provider: lib("core"), usage: { all: true, names: [] } }] }),
    test("elsewhere", [], { uses: [{ provider: lib("net"), usage: { all: true, names: [] } }] }),
  ];
  const names = (s: ReturnType<typeof selectSeam>): readonly string[] => s.run.map((r) => r.test.path.split("/").pop() ?? "");
  assertEquals(names(selectSeam(tests, lib("core"), { kind: "changed", symbols: ["ok"] })), ["uses-ok.test.ts", "uses-all.test.ts"]);
  assertEquals(names(selectSeam(tests, lib("core"), { kind: "unknown", why: "x" })), ["uses-ok.test.ts", "uses-other.test.ts", "uses-all.test.ts"]);
  const key = (hash: string, runtime = "1.4.4") => cacheKeyOf({ runtime, library: lib("leaf"), test: "t", hashes: [["b", hash], ["a", "x"]] });
  assertEquals(key("h1"), key("h1"));
  assert(key("h1") !== key("h2"));
  assert(key("h1") !== key("h1", "1.4.5"));
});

proves(["0007-repoctl-prove FR-012"], "a foundation change plans the suites of every foundation library, and a leaf change plans none of them", () => {
  const nodes: readonly LibraryNode[] = [...FOUNDATION.map((f): LibraryNode => ({ name: lib(f), folder: `commons/${f}`, foundation: true, uses: [], systems: [] })), { name: lib("leaf"), folder: "commons/leaf", foundation: false, uses: [], systems: [] }];
  const base = { base: "main", gitKnown: true, all: false, libraries: nodes, outsideReaders: [] };
  const plan = (path: string) => {
    const step = planProof({ ...base, changed: [{ path, before: "export const a = 1;", after: "export const a = 2;" }], surfaces: new Map([[lib(path.split("/")[1] ?? ""), { delta: { kind: "same" } as const, mentions: [] }]]) });
    assert(step.kind === "plan");
    return step.plan.proofs.filter((p) => p.proof.kind === "smoke").map((p) => ("library" in p.proof ? p.proof.library : ""));
  };
  assertEquals(plan("commons/core/src/a.ts"), [...FOUNDATION].sort());
  assertEquals(plan("commons/leaf/src/a.ts"), []);
});

proves(["0007-repoctl-prove FR-013"], "a quarantined test is held back with its owner and its expiry, runs again after it and warns, and the record is checked", () => {
  const parsed = parseQuarantine(JSON.stringify([{ test: "commons/leaf/suite/by-import.test.ts", owner: "ada", expires: "2026-12-01", reason: "a clock" }, { test: "commons/leaf/suite/alone.test.ts", owner: "bob", expires: "2026-01-01", reason: "a port" }]));
  assert(parsed.kind === "ok");
  const items = [test("by-import", []), test("alone", []), test("free", [])].map((t) => ({ test: t }));
  const r = applyQuarantine(items, parsed.value, "2026-11-20");
  assertEquals(r.run.map((i) => i.test.path.split("/").pop()), ["alone.test.ts", "free.test.ts"]);
  assertEquals(r.held.map((h) => `${h.item.test.path.split("/").pop()} ${h.entry.owner} ${h.entry.expires}`), ["by-import.test.ts ada 2026-12-01"]);
  assertEquals(r.expired.map((e) => e.test), ["commons/leaf/suite/alone.test.ts"]);
  assertEquals(parseQuarantine("[]").kind, "ok");
  for (const bad of ["{", "{}", '[{"test":"a"}]', '[{"test":"a","owner":"o","reason":"r","expires":"soon"}]', "[1]"]) assertEquals(parseQuarantine(bad).kind, "err", bad);
  assertEquals(seedsOf("Property failed after 3 tests\n{ seed: 1234, path: \"2:0\" }\nCounterexample: [0,-1]\nShrunk 2 time(s)"), ["seed 1234", "counterexample [0,-1]"]);
});

const TSCONFIG = JSON.stringify({ compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler", allowImportingTsExtensions: true, noEmit: true, skipLibCheck: true } });

proves(["0007-repoctl-prove FR-011", "0007-repoctl-prove FR-013"], "over a real repository a passing test is cached under its key and a second run takes it, a failure is never cached, and an expired quarantine runs again", async () => {
  if (!CAN_RUN) return;
  await fs.withTempDir(async (dir) => {
    await git(dir, "init", "-q");
    await put(dir, "commons/ts/tsconfig.json", TSCONFIG);
    await put(dir, "commons/prov/package.json", JSON.stringify({ name: "@intellectual-frontiers/prov", exports: { ".": "./src/mod.ts" } }));
    await put(dir, "commons/prov/src/mod.ts", "export const a = 1;\n");
    await put(dir, "commons/prov/src/other.ts", "export const b = 1;\n");
    await put(dir, "commons/prov/suite/a.test.ts", 'import { expect, test } from "bun:test";\nimport { a } from "../src/mod.ts";\ntest("a", () => expect(a).toBeGreaterThan(0));\n');
    await put(dir, "commons/prov/suite/b.test.ts", 'import { expect, test } from "bun:test";\nimport { b } from "../src/other.ts";\ntest("b", () => expect(b).toBeGreaterThan(0));\n');
    await fs.symlink(path.join(CHECKOUT, "node_modules"), path.join(dir, "node_modules"), { type: "junction" });
    await git(dir, "add", "-A");
    await git(dir, "commit", "-q", "-m", "base");
    await git(dir, "branch", "-M", "main");
    const world: World = {
      ...systemWorld(dir, () => undefined),
      libraries: { list: () => Promise.resolve(ok([{ name: "prov", folder: "commons/prov", version: "0.1.0", level: "L1", specKit: undefined, npm: false, versionConstants: [] }])) },
    };
    const cache = { folder: path.join(dir, "..", `cache-${path.basename(dir)}`), runtime: "test" };
    const run = async (quarantine = parseQuarantine("[]")) => {
      const made = await makePlan(world, "main", false);
      assert(made.kind === "ok" && quarantine.kind === "ok");
      return await runPlan(world, made.value, "main", { tiers: ["T1"], cache, quarantine: quarantine.value, today: "2026-11-20", width: 2 });
    };
    await put(dir, "commons/prov/src/mod.ts", "export const a = 2;\n");
    const first = await run();
    const outcome = first.reports.find((r) => r.proof.proof.kind === "suite")?.outcome;
    assert(outcome?.kind === "passed", JSON.stringify(first));
    assertStringIncludes(outcome.detail, "1 tests, 0 from the cache");
    assert(first.left.some((s) => s.reason === "tests-unaffected" && s.because.startsWith("1 of 2 tests")), "the test that imports only other.ts is left out");
    const second = await run();
    const again = second.reports.find((r) => r.proof.proof.kind === "suite")?.outcome;
    assert(again?.kind === "passed");
    assertStringIncludes(again.detail, "1 tests, 1 from the cache");
    assert(second.left.some((s) => s.reason === "cache-hit"));
    await put(dir, "commons/prov/src/mod.ts", "export const a = 0;\n");
    const failed = await run();
    assertEquals(failed.reports.find((r) => r.proof.proof.kind === "suite")?.outcome.kind, "failed");
    const held = await run(parseQuarantine(JSON.stringify([{ test: "commons/prov/suite/a.test.ts", owner: "ada", expires: "2026-12-01", reason: "held" }])));
    assertEquals(held.reports.find((r) => r.proof.proof.kind === "suite")?.outcome.kind, "passed");
    assert(held.left.some((s) => s.reason === "quarantined" && s.because.includes("ada")));
    const expired = await run(parseQuarantine(JSON.stringify([{ test: "commons/prov/suite/a.test.ts", owner: "ada", expires: "2026-11-01", reason: "held" }])));
    assertEquals(expired.reports.find((r) => r.proof.proof.kind === "suite")?.outcome.kind, "failed");
    assertEquals(expired.expired.map((e) => e.owner), ["ada"]);
    await systemFiles.removeTree(cache.folder);
  });
});

proves(["0007-repoctl-prove FR-014"], "the plan job writes the proof plan to the summary of its run, the matrices stay the planner's and the full run is scheduled", async () => {
  const yml = await systemFiles.read(path.join(CHECKOUT, ".github/workflows/ci.auto.yml"));
  assert(yml !== undefined);
  assertStringIncludes(yml, "prove --tier 6 --why $scope");
  assertStringIncludes(yml, 'bun commons/libraries/src/plan.ts $scope --github-output "$GITHUB_OUTPUT"');
  assertStringIncludes(yml, "fromJSON(needs.plan.outputs.linux)");
  assertStringIncludes(yml, "schedule:");
  assertStringIncludes(yml, '[ "$GITHUB_EVENT_NAME" = schedule ]');
});
