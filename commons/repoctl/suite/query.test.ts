/**
 * `repoctl query` (commons repoctl 0012-repoctl-query): the relations made from the manifests and the tables of the spec kits, the question that is one read and the ones that are refused, and the verb as the command line runs it.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { VERBS, verbIds } from "@intellectual-frontiers/repoctl/governance";
import { askRepository, repositoryRelations, type LibraryInfo, type RepositorySource, type World } from "@intellectual-frontiers/repoctl/logical";
import { execute, hostOf } from "./world.ts";

const lib = (name: string, specKit: string | undefined = "spec-kit"): LibraryInfo => ({ name, package: `@scope/${name}`, folder: `commons/${name}`, version: "1.2.3", level: "L1", specKit, npm: true, held: undefined, versionConstants: [] });
const registry = "number\tslug\tstate\n0001\tlayers\tin force\n0002\tparser\tdraft\n";
const enforcement = "0001-layers FR-001\tcheck\t.github: cd x && bun run verify\tsuite/a.test.ts\n0001-layers FR-002\tnone\t-\tnot yet\n0002-parser FR-001\tcheck\t.github: cd x && bun run verify\tsuite/b.test.ts\nnot a row\n";
const sources: readonly RepositorySource[] = [{ library: lib("alpha"), registry, enforcement }, { library: lib("beta", undefined), registry: undefined, enforcement: undefined }];

const rows = (sql: string, params: readonly (string | number)[] = []) => {
  const r = askRepository(sources, sql, { params });
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};

proves(["0012-repoctl-query FR-001"], "the libraries, specifications and requirements are relations: a library with no kit has no spec, a line that is not a row is left out, and an id is split into the spec and the requirement", () => {
  const t = repositoryRelations(sources);
  assertEquals(t["libraries"]?.rows.length, 2);
  assertEquals(t["specs"]?.rows, [["alpha", "0001", "layers", "in force"], ["alpha", "0002", "parser", "draft"]]);
  assertEquals(t["requirements"]?.rows.length, 3);
  assertEquals(t["requirements"]?.rows[1], ["alpha", "0001-layers", "FR-002", "none", "-", "not yet"]);
});

proves(["0012-repoctl-query FR-002", "0012-repoctl-query FR-003"], "a question is one line of SQL (the requirements nothing verifies, the specs of a state), the answer is cut at the limit, and a write, two statements and an unknown column are refused as values with the place", () => {
  assertEquals(rows("SELECT spec, fr FROM requirements WHERE mechanism = 'none'").rows, [["0001-layers", "FR-002"]]);
  assertEquals(rows("SELECT l.name, count(*) AS n FROM libraries l JOIN specs s ON s.library = l.name GROUP BY l.name").rows, [["alpha", 2]]);
  assertEquals(rows("SELECT slug FROM specs WHERE state = ?", ["draft"]).rows, [["parser"]]);
  const cut = askRepository(sources, "SELECT name FROM libraries ORDER BY name", { limit: 1 });
  assert(cut.kind === "ok" && cut.value.rows.length === 1 && cut.value.truncated, "cut");
  for (const bad of ["DELETE FROM specs", "SELECT 1; SELECT 2", "SELECT nope FROM libraries", "SELECT * FROM nowhere"]) assert(askRepository(sources, bad).kind === "err", bad);
  const unknown = askRepository(sources, "SELECT versoin FROM libraries");
  assert(unknown.kind === "err" && unknown.error.includes("version"), unknown.kind === "err" ? unknown.error : "ok");
});

const files = new Map<string, string>([["/repo/commons/alpha/spec-kit/registry.tsv", registry], ["/repo/commons/alpha/spec-kit/enforcement.tsv", enforcement]]);
const world = (libraries: () => ReturnType<World["libraries"]["list"]>): World => ({
  repo: "/repo",
  process: { run: () => Promise.resolve({ code: 0, stdout: "", stderr: "" }) },
  files: {
    read: (p) => Promise.resolve(files.get(p)),
    write: () => Promise.resolve(),
    remove: () => Promise.resolve(),
    exists: (p) => Promise.resolve(files.has(p)),
    list: () => Promise.resolve([]),
    walk: () => Promise.resolve([]),
    makeTemp: () => Promise.resolve("/tmp/x"),
    removeTree: () => Promise.resolve(),
  },
  registry: { view: () => Promise.resolve(ok("absent")) },
  credentials: { npmToken: () => undefined },
  libraries: { list: libraries },
  docs: { load: () => Promise.resolve(err("no docs")) },
});
const config = { capabilities: { query: true }, libraries: { folder: "commons" } } as const;

proves(["0012-repoctl-query FR-004", "0012-repoctl-query FR-005"], "the verb is declared once, public and read-only, comes only where the configuration turns it on, answers as a table and as JSON, and refuses what is not one read with a status that is not 0", async () => {
  assert(verbIds().includes("query") && VERBS["query"].effect === "read" && VERBS["query"].tier === "public");
  const host = hostOf(world(() => Promise.resolve(ok([lib("alpha")]))), { config });
  const table = await execute(host, ["query", "SELECT spec, fr FROM requirements WHERE mechanism = 'check' ORDER BY spec, fr"]);
  assertEquals(table.code, 0);
  assertStringIncludes(table.out, "0001-layers  FR-001");
  const json = await execute(host, ["query", "--json", "SELECT name FROM libraries"]);
  assertStringIncludes(json.out, '"rows"');
  assertStringIncludes(json.out, "alpha");
  const refused = await execute(host, ["query", "DELETE FROM specs"]);
  assert(refused.code !== 0, "a write is refused");
  const off = await execute(hostOf(world(() => Promise.resolve(ok([]))), { config: { capabilities: { release: false, newLibrary: false, status: false, prove: false, query: false }, libraries: { folder: "commons" } } }), ["query", "SELECT 1"]);
  assert(off.code !== 0, "the verb is not there without the capability");
});
