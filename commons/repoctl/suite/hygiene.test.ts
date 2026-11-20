/**
 * `repoctl hygiene` (commons repoctl 0007-repoctl-hygiene FR-001 to FR-005; commons 0036-distribution FR-002, FR-010 to FR-013): each finding made from facts, the lockfiles read as data, the installed tree and the imports read from a real
 * folder through the ports, the exit status and the JSON of the real command, and the status that asks for the package a library publishes.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import { fs } from "@intellectual-frontiers/system";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { CATALOGUE, type HygienePolicy, isProblemCode, verbIds, VERBS } from "@intellectual-frontiers/repoctl/governance";
import {
  countsOf,
  gatherHygieneFacts,
  hygiene,
  type HygieneFacts,
  hygieneFails,
  intoFamily,
  isExactVersion,
  isGitOfFamily,
  parseBunLock,
  parseNpmLock,
  relativeImports,
  runStatus,
  stripJsonc,
  type LibraryInfo,
  type World,
} from "@intellectual-frontiers/repoctl/logical";
import { systemFiles, systemWorld } from "@intellectual-frontiers/repoctl/physical";
import { execute, hostOf, put } from "./world.ts";

const CORE = "@intellectual-frontiers/core";

/** The policy these fixtures are written for: a family whose scope is `@intellectual-frontiers/`, whose own repository has a folder `commons`. */
const POLICY: HygienePolicy = { scope: "@intellectual-frontiers/", gitSources: ["intellectual-frontiers/.github"], pathSegment: "commons", sourceMarker: "commons/libraries/library.ts", allow: { paths: [], packages: [] } };
const WITH_POLICY = { config: { hygiene: { scope: POLICY.scope, gitSources: POLICY.gitSources, pathSegment: POLICY.pathSegment, sourceMarker: POLICY.sourceMarker } } } as const;

const none: HygieneFacts = { repository: "consumer", packages: [], locks: [], installed: new Map(), imports: [], workspaces: [] };
const pkg = (p: string, name: string | undefined, dependencies: Record<string, string>): HygieneFacts["packages"][number] => ({ path: p, name, dependencies: Object.entries(dependencies).map(([n, spec]) => ({ name: n, spec })) });

proves(["0007-repoctl-hygiene FR-001"], "the verb is declared once, public and read-only, with its examples, and each code has an explanation", () => {
  assertEquals(VERBS.hygiene.tier, "public");
  assertEquals(VERBS.hygiene.effect, "read");
  assert(verbIds().includes("hygiene"));
  for (const code of ["E-HYGIENE-GIT", "E-HYGIENE-PATH", "E-HYGIENE-IMPORT", "E-HYGIENE-VENDORED", "E-HYGIENE-DUPLICATE", "E-HYGIENE-RANGE"]) {
    assert(isProblemCode(code), code);
    assert(!(CATALOGUE[code as keyof typeof CATALOGUE].fix === ""), code);
  }
});

proves(["0007-repoctl-hygiene FR-002", "0036-distribution FR-010"], "each of the six findings is made from facts, in the order of the codes", () => {
  assertEquals(hygiene(none, POLICY), []);
  const facts: HygieneFacts = {
    repository: "consumer",
    packages: [
      pkg("package.json", "app", { [CORE]: "github:intellectual-frontiers/.github#abc123", "@intellectual-frontiers/net": "link:../commons/net", "@intellectual-frontiers/kanon": "^0.2.1", "@intellectual-frontiers/mizan": "0.1.2", left: "^1.0.0" }),
      pkg("vendor/core/package.json", CORE, {}),
      pkg("packages/own/package.json", "@intellectual-frontiers/erga-own", {}),
    ],
    locks: [],
    installed: new Map([[CORE, [{ version: "0.1.4", where: "node_modules/a/node_modules/@intellectual-frontiers/core" }, { version: "0.1.5", where: "node_modules/@intellectual-frontiers/core" }]]]),
    imports: [{ file: "src/a.ts", specifier: "../commons/core/src/mod.ts" }, { file: "src/b.ts", specifier: "./local.ts" }],
    workspaces: ["packages/*"],
  };
  const found = hygiene(facts, POLICY);
  assertEquals(found.map((f) => `${f.code} ${f.level} ${f.path}`), [
    "E-HYGIENE-GIT fail package.json",
    "E-HYGIENE-PATH fail package.json",
    "E-HYGIENE-IMPORT fail src/a.ts",
    "E-HYGIENE-VENDORED fail vendor/core/package.json",
    "E-HYGIENE-DUPLICATE fail node_modules/a/node_modules/@intellectual-frontiers/core",
    "E-HYGIENE-RANGE warn package.json",
    "E-ENVIRONMENT warn package.json",
  ]);
  assertEquals(countsOf(found), { failures: 5, warnings: 2 });
  assert(hygieneFails(found));
  assertStringIncludes(found.find((f) => f.code === "E-HYGIENE-DUPLICATE")?.message ?? "", "0.1.4");
  // a range alone is a warning and does not fail; one version under two paths is one copy
  const range = hygiene({ ...none, packages: [pkg("package.json", "app", { "@intellectual-frontiers/kanon": "latest" })], locks: [{ kind: "read", file: "bun.lock", copies: new Map() }] }, POLICY);
  assertEquals(range.map((f) => f.code), ["E-HYGIENE-RANGE"]);
  assertEquals(hygieneFails(range), false);
  const hoisted = hygiene({ ...none, installed: new Map([[CORE, [{ version: "0.1.5", where: "a" }, { version: "0.1.5", where: "b" }]]]) }, POLICY);
  assertEquals(hoisted, []);
  // the predicates
  assert(isExactVersion("0.1.5") && isExactVersion("1.0.0-rc.1") && !isExactVersion("^0.1.5") && !isExactVersion("latest"));
  assert(isGitOfFamily(POLICY, "git+https://github.com/intellectual-frontiers/.github.git#x") && isGitOfFamily(POLICY, "intellectual-frontiers/.github") && !isGitOfFamily(POLICY, "^0.1.0"));
  assert(intoFamily(POLICY, "../commons/core") && intoFamily(POLICY, "..\\commons\\core") && !intoFamily(POLICY, "../commons") && !intoFamily(POLICY, "../common/core"));
});

proves(["0007-repoctl-hygiene FR-002", "0036-distribution FR-013"], "in the repository of commons the path, import and vendored findings are not made and the others are", () => {
  const facts: HygieneFacts = {
    repository: "source",
    packages: [pkg("commons/core/package.json", CORE, { "@intellectual-frontiers/commons": "link:../ts", dep: "github:intellectual-frontiers/.github#x" })],
    locks: [{ kind: "read", file: "bun.lock", copies: new Map() }],
    installed: new Map(),
    imports: [{ file: "commons/a/src/x.ts", specifier: "../../commons/core/src/mod.ts" }],
    workspaces: [],
  };
  assertEquals(hygiene(facts, POLICY).map((f) => f.code), ["E-HYGIENE-GIT"]);
});

const BUN_LOCK = `{
  // a comment
  "lockfileVersion": 1,
  "workspaces": { "": { "name": "app", "dependencies": { "@intellectual-frontiers/core": "0.1.5", }, }, },
  "packages": {
    "@intellectual-frontiers/core": ["@intellectual-frontiers/core@0.1.5", "", {}, "sha512-x"],
    "some/@intellectual-frontiers/core": ["@intellectual-frontiers/core@0.1.4", "", {}, "sha512-y"],
    "@scope/other": ["@scope/other@1.0.0", "", {}, "sha512-z"],
  }
}
`;
const NPM_LOCK = JSON.stringify({
  lockfileVersion: 3,
  packages: {
    "": { name: "app" },
    "node_modules/@intellectual-frontiers/core": { version: "0.1.5" },
    "node_modules/some/node_modules/@intellectual-frontiers/core": { version: "0.1.4" },
    "node_modules/@scope/other": { version: "1.0.0" },
  },
});

proves(["0007-repoctl-hygiene FR-003", "0036-distribution FR-011"], "bun.lock and package-lock.json give the same duplicate, comments and trailing commas are read, and a lockfile that cannot be read is a failing finding", () => {
  assertEquals(JSON.parse(stripJsonc('{ "a": "x // not a comment", /* c */ "b": [1,], }')), { a: "x // not a comment", b: [1] });
  const bun = parseBunLock(BUN_LOCK, "bun.lock", POLICY.scope);
  const npm = parseNpmLock(NPM_LOCK, "package-lock.json", POLICY.scope);
  assert(bun.kind === "read" && npm.kind === "read");
  const dup = (l: typeof bun): readonly string[] => hygiene({ ...none, locks: [l] }, POLICY).map((f) => `${f.code} ${f.message.split(" is installed ")[0] ?? ""}`);
  assertEquals(dup(bun), [`E-HYGIENE-DUPLICATE ${CORE}`]);
  assertEquals(dup(npm), dup(bun));
  assertEquals([...bun.copies.get(CORE)?.map((c) => c.version) ?? []].sort(), ["0.1.4", "0.1.5"]);
  const broken = parseBunLock("{ nope", "bun.lock", POLICY.scope);
  assertEquals(broken.kind, "unreadable");
  const found = hygiene({ ...none, locks: [broken] }, POLICY);
  assertEquals(found.map((f) => `${f.code} ${f.level}`), ["E-ENVIRONMENT fail"]);
  const far = ["..", "..", "commons", "x"].join("/");
  assertEquals(relativeImports(`import a from "./a.ts"; export * from "../b"; const c = await import("${far}"); import d from "pkg"; require("./e.cjs");`), ["./a.ts", "../b", far, "./e.cjs"]);
});

/** A repository on disk: a consumer with every way of breaking the rule, and what it installed. */
async function broken(dir: string): Promise<void> {
  await put(dir, "package.json", JSON.stringify({ name: "app", dependencies: { [CORE]: "github:intellectual-frontiers/.github#abc", "@intellectual-frontiers/net": "link:../commons/net", "@intellectual-frontiers/kanon": "^0.2.1" } }));
  await put(dir, "vendor/core/package.json", JSON.stringify({ name: CORE, version: "0.1.5" }));
  await put(dir, "src/a.ts", 'import "../commons/core/src/mod.ts";\n');
  await put(dir, "bun.lock", BUN_LOCK);
  await put(dir, "node_modules/@intellectual-frontiers/core/package.json", JSON.stringify({ name: CORE, version: "0.1.5" }));
  await put(dir, "node_modules/other/node_modules/@intellectual-frontiers/core/package.json", JSON.stringify({ name: CORE, version: "0.1.3" }));
  await put(dir, "node_modules/other/package.json", JSON.stringify({ name: "other", version: "1.0.0" }));
}

proves(["0007-repoctl-hygiene FR-003", "0007-repoctl-hygiene FR-004", "0036-distribution FR-012"], "on a folder: the facts are gathered through the ports, the real command ends in 1 with the findings and one JSON document, and a repository in order ends in 0", async () => {
  await fs.withTempDir(async (dir) => {
    await broken(dir);
    const world = systemWorld(dir, () => undefined, { libraries: undefined });
    const facts = await gatherHygieneFacts(world, POLICY);
    assertEquals(facts.repository, "consumer");
    assertEquals([...(facts.installed.get(CORE) ?? [])].map((c) => c.version).sort(), ["0.1.3", "0.1.5"]);
    const codes = hygiene(facts, POLICY).map((f) => f.code);
    for (const c of ["E-HYGIENE-GIT", "E-HYGIENE-PATH", "E-HYGIENE-IMPORT", "E-HYGIENE-VENDORED", "E-HYGIENE-DUPLICATE", "E-HYGIENE-RANGE"]) assert(codes.includes(c as never), c);
    const out = await execute(hostOf(world, WITH_POLICY), ["hygiene"]);
    assertEquals(out.code, 1, out.err);
    assertStringIncludes(out.out + out.err, "E-HYGIENE-GIT");
    const json = await execute(hostOf(world, WITH_POLICY), ["hygiene", "--json"]);
    assertEquals(json.code, 1);
    const doc: unknown = JSON.parse(json.out);
    assert(typeof doc === "object" && doc !== null && "data" in doc && typeof doc.data === "object" && doc.data !== null);
    assert("findings" in doc.data && Array.isArray(doc.data.findings) && doc.data.findings.length >= 6 && "failures" in doc.data);
  });
  await fs.withTempDir(async (dir) => {
    await put(dir, "package.json", JSON.stringify({ name: "app", dependencies: { [CORE]: "0.1.5" } }));
    await put(dir, "bun.lock", '{ "lockfileVersion": 1, "packages": { "@intellectual-frontiers/core": ["@intellectual-frontiers/core@0.1.5", "", {}, "x"] } }');
    const world = systemWorld(dir, () => undefined, { libraries: undefined });
    const ok0 = await execute(hostOf(world, WITH_POLICY), ["hygiene", "--json"]);
    assertEquals(ok0.code, 0, ok0.err);
    // a warning alone does not fail
    await put(dir, "package.json", JSON.stringify({ name: "app", dependencies: { [CORE]: "^0.1.5" } }));
    assertEquals((await execute(hostOf(world, WITH_POLICY), ["hygiene"])).code, 0);
    // the repository of commons is told apart
    await put(dir, "commons/libraries/library.ts", "export const library = {};\n");
    assertEquals((await gatherHygieneFacts(world, POLICY)).repository, "source");
  });
});

proves(["0007-repoctl-hygiene FR-005", "0036-distribution FR-009"], "status asks npm for the package a library publishes", async () => {
  const lib: LibraryInfo = { name: "data", package: "@intellectual-frontiers/arcactl", folder: "commons/data", version: "0.9.0", level: "L1", specKit: undefined, npm: true, held: undefined, versionConstants: [] };
  const asked: string[] = [];
  const world: World = {
    repo: "/nowhere",
    process: { run: () => Promise.resolve({ code: 0, stdout: "", stderr: "" }) },
    files: systemFiles,
    registry: { view: (name) => { asked.push(name); return Promise.resolve(ok("absent")); } },
    credentials: { npmToken: () => undefined },
    libraries: { list: () => Promise.resolve(ok([lib])) },
    docs: { load: () => Promise.resolve(err("no generator")) },
  };
  const r = await runStatus(world, { offline: false });
  assert(r.kind === "ok");
  assertEquals(asked, ["@intellectual-frontiers/arcactl"]);
});
