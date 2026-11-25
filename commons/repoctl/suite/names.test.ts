/**
 * Tests of `repoctl names` (commons repoctl 0015-repoctl-names FR-001 to FR-007): the pure search of files for the names a caller gives, the scope and the allowances, and the verb that loads the names files and ends 1
 * where a name is found. The names in these tests are made up.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import { fs, path } from "@intellectual-frontiers/system";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { VERBS, verbIds } from "@intellectual-frontiers/repoctl/governance";
import { DEFAULT_SCOPE, describeName, findNames, nameExpression, type World } from "@intellectual-frontiers/repoctl/logical";
import { execute, hostOf } from "./world.ts";

const NAME = "Example Holdings";

proves(["0015-repoctl-names FR-002"], "a name is found with its file and line, in the order of the files and the lines", () => {
  const files = [
    { path: "specs/b/spec.md", text: `one\ntwo\nsee ${NAME} here\n${NAME}` },
    { path: "specs/a/spec.md", text: `${NAME}` },
  ];
  assertEquals(findNames(files, [NAME], [], ["specs/**"]), [
    { path: "specs/a/spec.md", line: 1, name: NAME },
    { path: "specs/b/spec.md", line: 3, name: NAME },
    { path: "specs/b/spec.md", line: 4, name: NAME },
  ]);
  assertEquals(describeName({ path: "a", line: 2, name: NAME }), `a:2 holds "${NAME}", which must not be in it`);
});

proves(["0015-repoctl-names FR-003"], "a name is a whole phrase in any case, spaces stand for any white space, and an empty name finds nothing", () => {
  const one = (text: string): number => findNames([{ path: "specs/x.md", text }], [NAME], [], ["specs/**"]).length;
  assertEquals(one("example   holdings"), 1);
  assertEquals(one("EXAMPLE HOLDINGS."), 1);
  assertEquals(one("Example HoldingsX"), 0);
  assertEquals(one("xExample Holdings"), 0);
  assertEquals(one("Example Holdings2"), 0);
  assertEquals(findNames([{ path: "specs/x.md", text: "anything" }], ["", "  "], [], ["specs/**"]), []);
  assertEquals(nameExpression("a.b").test("axb"), false, "a dot in a name is a dot");
});

proves(["0015-repoctl-names FR-004"], "only the files in the scope are read, by default the specifications, the ontology, the tests and what is generated", () => {
  const text = NAME;
  const found = (p: string): number => findNames([{ path: p, text }], [NAME], []).length;
  for (const p of ["commons/anyfs/spec-kit/specs/0001/spec.md", "specs/172-x/spec.md", "ontology/vocabulary/a.ts", "services/x/suite/a.ts", "a/b.test.ts", "commons/generated/x.auto.ttl"]) assertEquals(found(p), 1, p);
  for (const p of ["works/book/chapter.md", "profile/README.md", "src/a.ts"]) assertEquals(found(p), 0, p);
  assertEquals(findNames([{ path: "works/book/chapter.md", text }], [NAME], [], ["works/**"]).length, 1, "the caller's scope");
  assert(DEFAULT_SCOPE.length > 5);
});

proves(["0015-repoctl-names FR-005"], "an allowance by name, by path or by both leaves out only what it covers, and one with neither covers nothing", () => {
  const files = [{ path: "profile/a.md", text: NAME }, { path: "specs/a.md", text: NAME }, { path: "specs/b.md", text: "Other Co" }];
  const scope = ["**"];
  assertEquals(findNames(files, [NAME], [{ name: NAME, path: "profile/**" }], scope).map((f) => f.path), ["specs/a.md"]);
  assertEquals(findNames(files, [NAME], [{ path: "profile/**" }], scope).map((f) => f.path), ["specs/a.md"]);
  assertEquals(findNames(files, [NAME, "Other Co"], [{ name: "example holdings" }], scope).map((f) => f.path), ["specs/b.md"]);
  assertEquals(findNames(files, [NAME], [{}], scope).length, 2);
  assertEquals(findNames(files, [NAME], [{ name: "Other Co", path: "specs/**" }], scope).length, 2);
});

const tree = new Map<string, string>([
  ["/repo/specs/a/spec.md", `# A\n\n${NAME} is a tenant.\n`],
  ["/repo/specs/b/spec.md", "# B\n"],
  ["/repo/works/c.md", NAME],
]);
const world = (files: ReadonlyMap<string, string>): World => ({
  repo: "/repo",
  process: { run: () => Promise.resolve({ code: 0, stdout: "", stderr: "" }) },
  files: {
    read: (p) => Promise.resolve(files.get(p)),
    write: () => Promise.resolve(),
    remove: () => Promise.resolve(),
    exists: (p) => Promise.resolve(files.has(p) || [...files.keys()].some((k) => k.startsWith(`${p}/`))),
    list: (dir) => Promise.resolve([...new Set([...files.keys()].filter((p) => p.startsWith(`${dir}/`)).map((p) => p.slice(dir.length + 1).split("/")[0] ?? ""))].sort()),
    walk: (dir) => Promise.resolve([...files.keys()].filter((p) => p.startsWith(`${dir}/`)).map((p) => p.slice(dir.length + 1)).sort()),
    makeTemp: () => Promise.resolve("/tmp/x"),
    removeTree: () => Promise.resolve(),
  },
  registry: { view: () => Promise.resolve(ok("absent")) },
  credentials: { npmToken: () => undefined },
  libraries: { list: () => Promise.resolve(err("no libraries")) },
  docs: { load: () => Promise.resolve(err("no docs")) },
});

async function withNamesFile<T>(source: string, use: (file: string) => Promise<T>): Promise<T> {
  const dir = await fs.makeTempDir({ prefix: "repoctl-names-" });
  try {
    const file = path.join(dir, "names.ts");
    await fs.writeTextFile(file, source);
    return await use(file);
  } finally {
    await fs.remove(dir, { recursive: true }).catch(() => undefined);
  }
}

proves(["0015-repoctl-names FR-001", "0015-repoctl-names FR-006", "0015-repoctl-names FR-007"], "the verb is declared once, public and read-only, loads the names files, ends 1 where a name is found and 0 where none is, and hides the name where asked", async () => {
  assert(verbIds().includes("names") && VERBS["names"].effect === "read" && VERBS["names"].tier === "public");
  const host = hostOf(world(tree), { config: { capabilities: { query: false }, libraries: { folder: "commons" } } });
  await withNamesFile(`export const names = ${JSON.stringify([NAME, "Unused Name"])};\n`, async (file) => {
    const found = await execute(host, ["names", "--names", file]);
    assertEquals(found.code, 1, found.err + found.out);
    assertStringIncludes(found.out, `/repo: specs/a/spec.md:3 holds "${NAME}"`);
    assert(!found.out.includes("works/c.md"), "a file outside the scope is not read");
    const hidden = await execute(host, ["names", "--names", file, "--hide", "--json"]);
    assertEquals(hidden.code, 1);
    assert(!hidden.out.includes(NAME), "the name is not in the report");
    assertStringIncludes(hidden.out, "specs/a/spec.md");
    const wider = await execute(host, ["names", "--names", file, "--scope", "works/**"]);
    assertStringIncludes(wider.out, "works/c.md:1");
  });
  await withNamesFile(`export const names = ${JSON.stringify([NAME])};\nexport const allowances = [{ name: ${JSON.stringify(NAME)}, path: "specs/**" }];\n`, async (file) => {
    const none = await execute(host, ["names", "--names", file]);
    assertEquals(none.code, 0, none.err + none.out);
    assertStringIncludes(none.out, "no name of 1 is in the");
  });
});

proves(["0015-repoctl-names FR-006"], "a names file that is missing, that does not load or that exports something else ends with the environment status and says why", async () => {
  const host = hostOf(world(tree), { config: { capabilities: { query: false }, libraries: { folder: "commons" } } });
  const missing = await execute(host, ["names", "--names", "/nonexistent/names.ts"]);
  assertEquals(missing.code, 3);
  assertStringIncludes(missing.out + missing.err, "cannot be loaded");
  await withNamesFile("export const names = 7;\n", async (file) => {
    const wrong = await execute(host, ["names", "--names", file]);
    assertEquals(wrong.code, 3);
    assertStringIncludes(wrong.out + wrong.err, "does not export `names` as a list of texts");
  });
  await withNamesFile(`export const names = ["x"];\nexport const allowances = [{ name: 1 }];\n`, async (file) => {
    assertEquals((await execute(host, ["names", "--names", file])).code, 3);
  });
});
