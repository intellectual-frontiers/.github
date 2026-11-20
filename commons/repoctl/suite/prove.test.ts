/**
 * Tests of `repoctl prove` (commons repoctl 0008-repoctl-prove FR-001 to FR-009): the classes of changed files and the proofs of each, the tiers, the planner that never skips a change to itself, the fingerprint of a public surface and the
 * reach of a changed symbol, and a plan over a real Git repository with real libraries, whose declarations the real compiler emits at the base and now.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { ok } from "@intellectual-frontiers/core";
import { fs, path } from "@intellectual-frontiers/system";
import {
  CHANGE_CLASSES,
  CLASS_RULES,
  parseLibraryName,
  parseProofTier,
  type LibraryName,
  type Proof,
  PROOF_TIER_IDS,
  PROOF_TIERS,
  proofKey,
  SKIP_REASONS,
  tierOfProof,
} from "@intellectual-frontiers/repoctl/governance";
import {
  classifyFile,
  codeOf,
  declarationsOf,
  fingerprintOf,
  importsOf,
  type LibraryNode,
  type LibrarySurface,
  libraryOfPath,
  planProof,
  type ProofInput,
  type ProofPlan,
  surfaceDelta,
  usagesOf,
  type World,
} from "@intellectual-frontiers/repoctl/logical";
import { makePlan, systemFiles, systemWorld } from "@intellectual-frontiers/repoctl/physical";
import { CAN_RUN, execute, git, hostOf, put, LIBRARIES, TOOLS_MODULES } from "./world.ts";

const lib = (name: string): LibraryName => {
  const r = parseLibraryName(name);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};

const node = (name: string, uses: readonly [string, readonly string[]][] = [], foundation = false, systems: LibraryNode["systems"] = []): LibraryNode => ({
  name: lib(name),
  package: `@intellectual-frontiers/${name}`,
  folder: `commons/${name}`,
  foundation,
  uses: uses.map(([p, names]) => ({ provider: lib(p), usage: { all: false, names } })),
  systems,
});

const NODES: readonly LibraryNode[] = [node("core", [], true), node("leaf", [["core", ["ok", "Result"]]]), node("other", [["core", ["absurd"]]]), node("top", [["leaf", ["run"]]]), node("net", [], false, ["windows"])];

const input = (changed: readonly { path: string; before?: string; after?: string }[], surfaces: ReadonlyMap<LibraryName, LibrarySurface> = new Map(), extra: Partial<ProofInput> = {}): ProofInput => ({
  base: "origin/main",
  gitKnown: true,
  all: false,
  changed: changed.map((c) => ({ path: c.path, before: c.before, after: c.after })),
  libraries: NODES,
  surfaces,
  outsideReaders: [],
  ...extra,
});

const planOf = (i: ProofInput): ProofPlan => {
  const step = planProof(i);
  assert(step.kind === "plan", `the planner asked for ${step.kind === "needs" ? step.libraries.join(",") : ""}`);
  return step.plan;
};

const kinds = (p: ProofPlan): readonly string[] => p.proofs.map((x) => proofKey(x.proof));

proves(["0008-repoctl-prove FR-002"], "the tiers are a closed set with a budget and each proof belongs to exactly one tier", () => {
  assertEquals(PROOF_TIER_IDS, ["T0", "T1", "T2", "T3", "T4", "T5", "T6"]);
  for (const t of PROOF_TIER_IDS) assert(PROOF_TIERS[t].budgetSeconds > 0 && PROOF_TIERS[t].runsOn.length > 0, t);
  assertEquals(parseProofTier("3"), parseProofTier("T3"));
  assertEquals(parseProofTier("7").kind, "err");
  assertEquals(parseProofTier("T").kind, "err");
  const sample: readonly Proof[] = [
    { kind: "docs-check" },
    { kind: "types", library: lib("core") },
    { kind: "suite", library: lib("core") },
    { kind: "seam", provider: lib("core"), consumer: lib("leaf") },
    { kind: "pack", library: lib("core") },
    { kind: "end-to-end" },
    { kind: "platform", library: lib("net"), system: "windows" },
    { kind: "release-gate" },
  ];
  assertEquals(sample.map(tierOfProof), ["T0", "T0", "T1", "T2", "T3", "T4", "T5", "T6"]);
  assertEquals(new Set(sample.map(proofKey)).size, sample.length);
});

proves(["0008-repoctl-prove FR-003"], "a changed file is classified by its path and its content at the base and now", () => {
  const of = (path: string, before: string | undefined, after: string | undefined) => classifyFile({ path, before, after }, libraryOfPath(NODES)).class;
  assertEquals(of("commons/core/src/text.ts", "// c\nexport const a = 1;\n", "// d\nexport const a = 1;\n"), "prose");
  assertEquals(of("commons/core/src/text.ts", "/** a { */\nexport const a = '//';\n", "/** b } */\nexport const a = '//';\n"), "prose");
  assertEquals(of("commons/core/src/text.ts", "// Spec: 0001-core FR-001\nexport const a = 1;\n", "// Spec: 0001-core FR-002\nexport const a = 1;\n"), "spec");
  assertEquals(of("commons/core/src/text.ts", "export const a = 1;\n", "export const a = 2;\n"), "source");
  assertEquals(of("commons/core/suite/text.test.ts", "a", "b"), "test");
  assertEquals(of("README.md", "a", "b"), "prose");
  assertEquals(of("commons/core/spec-kit/specs/0001-core/spec.md", "- **FR-001**: a", "- **FR-001**: b"), "spec");
  assertEquals(of("commons/core/spec-kit/specs/0001-core/spec.md", "- **FR-001**: a", "- **FR-001**: a\n- **FR-002**: b"), "spec-requirements");
  assertEquals(of("commons/generated/mizan.auto.ttl", "a", "b"), "generated");
  assertEquals(of(".github/workflows/ci.auto.yml", "a", "b"), "generated");
  assertEquals(of("commons/core/package.json", '{"version":"1.0.0","exports":{".":"./a.ts"}}', '{"version":"1.1.0","exports":{".":"./a.ts"}}'), "version");
  assertEquals(of("commons/core/package.json", '{"version":"1.0.0","exports":{".":"./a.ts"}}', '{"version":"1.0.0","exports":{".":"./b.ts"}}'), "packaging");
  assertEquals(of("commons/core/library.ts", 'version: "0.1.0",', 'version: "0.2.0",'), "version");
  assertEquals(of("commons/libraries/src/pack-library.ts", "a", "b"), "packaging");
  assertEquals(of("commons/repoctl/src/logical/prove.ts", "a", "b"), "planner");
  assertEquals(of("commons/repoctl/src/governance/generators.ts", "a", "b"), "planner");
  assertEquals(of("bin/agora-install.sh", "a", "b"), "outside");
  assertEquals(of("tests/x.test.ts", "a", "b"), "outside");
  assertEquals(new Set(CHANGE_CLASSES).size, CHANGE_CLASSES.length);
  for (const c of CHANGE_CLASSES) assertEquals(CLASS_RULES[c].class, c);
});

proves(["0008-repoctl-prove FR-004"], "each class plans the proofs its row says, and only those", () => {
  const change = (path: string, before: string, after: string): ProofPlan => planOf(input([{ path, before, after }]));
  assertEquals(kinds(change("commons/core/src/text.ts", "// a\nconst x = 1;", "// b\nconst x = 1;")), ["docs-check"]);
  assertEquals(kinds(change("commons/core/spec-kit/specs/0001-core/spec.md", "- **FR-001**: a", "- **FR-001**: b")), ["spec-check:core", "trace-check:core"]);
  assertEquals(kinds(change("commons/generated/a.auto.json", "a", "b")), ["sync-check"]);
  assertEquals(kinds(change("commons/core/package.json", '{"version":"1.0.0"}', '{"version":"1.0.1"}')), ["versions-check"]);
  assertEquals(kinds(change("commons/leaf/suite/a.test.ts", "a", "b")), ["trace-check:leaf", "types:leaf", "suite:leaf"]);
  assertEquals(kinds(change("commons/leaf/package.json", '{"exports":{".":"./a.ts"}}', '{"exports":{".":"./b.ts"}}')), ["pack:leaf"]);
  const outside = planOf(input([{ path: "tests/x.test.ts", before: "a", after: "b" }], new Map(), { outsideReaders: [lib("core")] }));
  assertEquals(kinds(outside), ["spec-check:repository", "types:core", "suite:core", "end-to-end"]);
});

proves(["0008-repoctl-prove FR-005"], "a change to the planner, to the generators or to what Git cannot say plans every proof of every tier", () => {
  const everything = planOf(input([{ path: "commons/repoctl/src/logical/prove.ts", before: "a", after: "b" }]));
  for (const t of PROOF_TIER_IDS) assert(everything.proofs.some((p) => p.tier === t), `${t} is planned`);
  assert(everything.proofs.some((p) => p.proof.kind === "release-gate"));
  assertEquals(planOf(input([], new Map(), { gitKnown: false })).proofs.some((p) => p.tier === "T6"), true);
  assertEquals(planOf(input([], new Map(), { all: true })).proofs.some((p) => p.tier === "T6"), true);
  assertEquals(planOf(input([{ path: "commons/repoctl/src/governance/generators.ts", before: "a", after: "b" }])).proofs.some((p) => p.tier === "T6"), true);
});

proves(["0008-repoctl-prove FR-010"], "--all plans every tier, and a change to the planner plans exactly that", () => {
  const all = planOf(input([], new Map(), { all: true }));
  const planner = planOf(input([{ path: "commons/repoctl/src/logical/prove.ts", before: "a", after: "b" }]));
  assertEquals(planner.proofs.map((p) => proofKey(p.proof)), all.proofs.map((p) => proofKey(p.proof)));
  for (const t of PROOF_TIER_IDS) assert(all.proofs.some((p) => p.tier === t), t);
});

proves(["0008-repoctl-prove FR-006"], "a source change with the same surface proves its library alone and skips its importers with the reason", () => {
  const surfaces = new Map<LibraryName, LibrarySurface>([[lib("leaf"), { delta: { kind: "same" }, mentions: [] }]]);
  const plan = planOf(input([{ path: "commons/leaf/src/a.ts", before: "export const a = 1;", after: "export const a = 2;" }], surfaces));
  assertEquals(kinds(plan), ["trace-check:leaf", "types:leaf", "suite:leaf"]);
  assert(plan.skipped.some((s) => s.reason === "surface-unchanged" && s.subject === "seam leaf to top"));
  const foundation = new Map<LibraryName, LibrarySurface>([[lib("core"), { delta: { kind: "same" }, mentions: [] }]]);
  const f = planOf(input([{ path: "commons/core/src/a.ts", before: "export const a = 1;", after: "export const a = 2;" }], foundation));
  assert(kinds(f).includes("smoke:core"));
  assertEquals(planProof(input([{ path: "commons/leaf/src/a.ts", before: "a", after: "b" }])), { kind: "needs", libraries: [lib("leaf")] });
});

proves(["0008-repoctl-prove FR-007"], "the fingerprint of a surface ignores comments and bodies and names the declarations that changed", () => {
  const hash = (t: string): string => `h${t.length}:${t.split("").reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 1000003, 7)}`;
  const dts = (text: string) => fingerprintOf(declarationsOf("a.d.ts", text), hash);
  const base = dts("export declare function f(x: number): string;\nexport interface A {\n  a: { b: 1 };\n}\nexport type B = { x: 1 } & A;\ndeclare const local: unique symbol;\nexport {};\n");
  assertEquals([...base.keys()], ["A", "B", "f"]);
  assertEquals(surfaceDelta(base, dts("export declare function f(x: number): string;\nexport interface A { a: { b: 1 }; }\nexport type B = { x: 1 } & A;\ndeclare const local: unique symbol;\nexport {};\n")), { kind: "same" });
  const changed = surfaceDelta(base, dts("export declare function f(x: number, y?: number): string;\nexport interface A {\n  a: { b: 1 };\n}\nexport type B = { x: 1 } & A;\ndeclare const local: unique symbol;\nexport {};\n"));
  assertEquals(changed, { kind: "changed", symbols: ["f"] });
  const added = surfaceDelta(base, dts("export declare function f(x: number): string;\nexport declare const g: 1;\nexport interface A {\n  a: { b: 1 };\n}\nexport type B = { x: 1 } & A;\ndeclare const local: unique symbol;\nexport {};\n"));
  assertEquals(added, { kind: "changed", symbols: ["g"] });
  assertEquals(codeOf("// a\nconst s = '//'; /* b */ const r = /\\/\\//;"), "const s = '//'; const r = /\\/\\//;");
  const reexports = declarationsOf("m.d.ts", 'export * from "./x.js";\nexport { a, type B as C } from "./y.js";\nexport * as ns from "./z.js";\n').map((d) => d.name);
  assertEquals(reexports, ["*", "a", "C", "ns"]);
});

proves(["0008-repoctl-prove FR-008"], "a changed symbol reaches the libraries that import it by name, a namespace or a re-export, through the surfaces that mention it", () => {
  assertEquals(importsOf('import { ok, type Result as R } from "@x/core/sub";\nimport * as c from "@x/core";\nimport d from "@x/other";', "@x/core"), { all: true, names: ["Result", "ok"] });
  assertEquals(importsOf('export { a } from "@x/core";\n// import { z } from "@x/core"\n', "@x/core"), { all: false, names: ["a"] });
  assertEquals(importsOf('const m = await import("@x/core/y");', "@x/core").all, true);
  assertEquals([...usagesOf('import { a } from "@x/p/q";\nimport { b } from "./b.ts";\nimport fs from "node:fs";').keys()], ["@x/p"]);
  const surfaces = new Map<LibraryName, LibrarySurface>([
    [lib("core"), { delta: { kind: "changed", symbols: ["ok"] }, mentions: [] }],
    [lib("leaf"), { delta: { kind: "same" }, mentions: [{ name: "run", mentions: ["ok", "run"] }] }],
    [lib("other"), { delta: { kind: "same" }, mentions: [] }],
    [lib("top"), { delta: { kind: "same" }, mentions: [] }],
  ]);
  const plan = planOf(input([{ path: "commons/core/src/a.ts", before: "export const ok = 1;", after: "export const ok = 2;" }], surfaces));
  assertEquals(kinds(plan).filter((k) => k.startsWith("types:") || k.startsWith("seam:")), ["types:core", "types:leaf", "types:top", "seam:core>leaf", "seam:leaf>top"]);
  assert(plan.skipped.some((s) => s.reason === "symbols-unused" && s.subject === "seam core to other"));
  assertEquals(plan.proofs.some((p) => p.proof.kind === "suite" && p.proof.library === lib("other")), false);
  const unknown = planOf(input([{ path: "commons/core/src/a.ts", before: "a", after: "b" }], new Map([...surfaces, [lib("core"), { delta: { kind: "unknown", why: "no declaration" } as const, mentions: [] }]])));
  assert(kinds(unknown).includes("seam:core>other"), "a surface that cannot be compared reaches every importer");
});

proves(["0008-repoctl-prove FR-009"], "every skipped proof carries a reason of the closed union and a sentence, and the plan is the same twice", () => {
  const i = input([{ path: "commons/core/src/text.ts", before: "// a\nconst x = 1;", after: "// b\nconst x = 1;" }]);
  const a = planOf(i);
  assertEquals(JSON.stringify(a), JSON.stringify(planOf(i)));
  assert(a.skipped.length > 0);
  for (const s of a.skipped) {
    assert(SKIP_REASONS.includes(s.reason), s.reason);
    assert(s.because.length > 10, s.subject);
  }
  assertEquals(new Set(a.skipped.map((s) => s.tier)), new Set(["T1", "T2", "T3", "T4", "T5", "T6"]));
});

const TSCONFIG = JSON.stringify({ compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler", allowImportingTsExtensions: true, noEmit: true, skipLibCheck: true } });

async function withLibraries<T>(use: (dir: string, world: World) => Promise<T>): Promise<T> {
  return await fs.withTempDir(async (dir) => {
    await git(dir, "init", "-q");
    await put(dir, "commons/ts/tsconfig.json", TSCONFIG);
    for (const [name, files] of [
      ["prov", { "src/mod.ts": 'export function used(x: number): string {\n  return String(x);\n}\nexport function spare(): number {\n  return 1;\n}\n' }],
      ["user", { "src/mod.ts": 'import { used } from "@intellectual-frontiers/prov";\nexport const u: string = used(1);\n' }],
      ["idle", { "src/mod.ts": 'import { spare } from "@intellectual-frontiers/prov";\nexport const s: number = spare();\n' }],
    ] as const) {
      await put(dir, `commons/${name}/package.json`, JSON.stringify({ name: `@intellectual-frontiers/${name}`, exports: { ".": "./src/mod.ts" } }));
      await put(dir, `commons/${name}/tsconfig.json`, JSON.stringify({ extends: "../ts/tsconfig.json", include: ["src/**/*.ts"] }));
      for (const [f, text] of Object.entries(files)) await put(dir, `commons/${name}/${f}`, text);
    }
    await fs.symlink(TOOLS_MODULES, path.join(dir, "node_modules"), { type: "junction" });
    await git(dir, "add", "-A");
    await git(dir, "commit", "-q", "-m", "base");
    await git(dir, "branch", "-M", "main");
    const real = systemWorld(dir, () => undefined, LIBRARIES);
    const names = ["prov", "user", "idle"];
    const world: World = {
      ...real,
      libraries: { list: () => Promise.resolve(ok(names.map((n) => ({ name: n, folder: `commons/${n}`, version: "0.1.0", level: "L1", specKit: undefined, npm: false, held: undefined, versionConstants: [], package: `@intellectual-frontiers/${n}` })))) },
    };
    return await use(dir, world);
  });
}

proves(["0008-repoctl-prove FR-006", "0008-repoctl-prove FR-007", "0008-repoctl-prove FR-008"], "over a real repository the compiler's declarations decide who is proved again", async () => {
  if (!CAN_RUN) return;
  await withLibraries(async (dir, world) => {
    const plan = async (): Promise<ProofPlan> => {
      const made = await makePlan(world, "main", false);
      assert(made.kind === "ok", made.kind === "err" ? made.error : "");
      return made.value.plan;
    };
    await put(dir, "commons/prov/src/mod.ts", 'export function used(x: number): string {\n  return `${x}`;\n}\nexport function spare(): number {\n  return 1;\n}\n');
    const body = await plan();
    assertEquals(body.classes, ["source"]);
    assertEquals(body.proofs.map((p) => proofKey(p.proof)).filter((k) => !k.startsWith("trace")), ["types:prov", "suite:prov"]);
    assert(body.skipped.some((s) => s.reason === "surface-unchanged" && s.subject === "seam prov to idle, user"));
    await put(dir, "commons/prov/src/mod.ts", 'export function used(x: number, y = 1): string {\n  return String(x + y);\n}\nexport function spare(): number {\n  return 1;\n}\n');
    const signature = await plan();
    const ks = signature.proofs.map((p) => proofKey(p.proof));
    assert(ks.includes("seam:prov>user") && ks.includes("types:user"), ks.join(","));
    assert(!ks.includes("seam:prov>idle"));
    assert(signature.skipped.some((s) => s.reason === "symbols-unused" && s.subject === "seam prov to idle"));
    await put(dir, "commons/prov/src/mod.ts", 'export function used(x: number): string {\n  return String(x);\n}\nexport function spare(): number {\n  return 1;\n}\n// a comment\n');
    assertEquals((await plan()).proofs.map((p) => proofKey(p.proof)), ["docs-check"]);
  });
});

proves(["0008-repoctl-prove FR-001"], "the verb prints the plan as JSON, refuses a tier that is none and ends with 2, and ends with 0 where every proof passed", async () => {
  if (!CAN_RUN) return;
  await withLibraries(async (dir, world) => {
    const host = hostOf(world);
    const bad = await execute(host, ["prove", "--tier", "9"]);
    assertEquals(bad.code, 2);
    await put(dir, "commons/prov/src/mod.ts", 'export function used(x: number): string {\n  return String(x);\n}\nexport function spare(): number {\n  return 1;\n}\nexport const more = 1;\n');
    const planned = await execute(host, ["prove", "--plan", "--base", "main"]);
    assertEquals(planned.code, 0);
    const parsed: unknown = JSON.parse(planned.out);
    assert(typeof parsed === "object" && parsed !== null && "proofs" in parsed && "skipped" in parsed);
    const why = await execute(host, ["prove", "--tier", "0", "--why", "--base", "main"]);
    assertStringIncludes(why.out, "types of prov");
    assertStringIncludes(why.out, "symbols-unused");
    assertEquals(why.code, 0, `${why.out}\n${why.err}`);
    await systemFiles.write(path.join(dir, "commons/prov/src/mod.ts"), "export const broken: number = 'x';\n");
    const failed = await execute(host, ["prove", "--tier", "0", "--base", "main"]);
    assertEquals(failed.code, 1);
    assertStringIncludes(failed.out, "types of prov");
  });
});
