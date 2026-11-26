/**
 * The plan of CI (commons 0001-libraries FR-012): the cells of the matrix on Linux and on the other systems for the libraries a change affects, the outputs a step writes for the workflow, the command on this repository's own
 * libraries, and the one workflow `ci` that reads them.
 *
 * @module
 */
import { exportsLine, main, outputsOf, packsFor, planOf } from "../src/plan.ts";
import { LIBRARY_CI } from "../src/workflows/definitions.ts";
import { mkdirSync, readTextFileSync, withTempDir, writeTextFileSync } from "@intellectual-frontiers/system/fs";
import { proc } from "@intellectual-frontiers/system";
import { fromFileUrl, join, resolve } from "@intellectual-frontiers/system/path";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";

const SPEC = "0001-libraries";
const ROOT = resolve(fromFileUrl(new URL("../../..", import.meta.url)));

const lib = (name: string): { readonly name: string; readonly folder: string; readonly verify: string } => ({
  name,
  folder: `commons/${name}`,
  verify: "bun run verify",
});

proves(
  [`${SPEC} FR-012`],
  "every affected library has a cell on Linux, and one on each system its record of CI names; a library with no record has the one cell; a plan with no cell says so",
  () => {
    const p = planOf([lib("core"), lib("system"), lib("nobody-has-this-record")]);
    assertEquals(
      p.linux.include.map((c) => c.name),
      ["core", "system", "nobody-has-this-record"],
    );
    assertEquals(
      p.systems.include.map((c) => `${c.name} ${c.os}`),
      ["system windows-latest", "system macos-latest"],
      "core runs on Linux only: it has no code of its own for another system",
    );
    assertEquals(p.linux.include[0]?.node, 'node --test "suite/**/*.test.ts"');
    assertEquals(p.linux.include[2]?.node, "", "a library with no record has verify alone");
    assertEquals(p.linux.include[2]?.os, undefined);
    assertEquals(planOf([lib("data")]).linux.include[0]?.after, "bun tools/generate-dpv.ts --check");
    const none = outputsOf(planOf([]));
    assertStringIncludes(none, "has-linux=false");
    assertStringIncludes(none, "has-systems=false");
    assertStringIncludes(none, 'linux={"include":[]}');
    const some = outputsOf(p).split("\n");
    assertEquals(some.length, 4, "one line for each output: a matrix is one line of JSON");
    assertEquals(some[0], "has-linux=true");
    assertEquals(some[2], "has-systems=true");
    return Promise.resolve();
  },
);

proves(
  [`${SPEC} FR-012`],
  "the command plans this repository: the libraries a file affects with the reach of verify, as JSON or as the outputs of a step, every library with --all, and a usage error is 2",
  async () => {
    await withTempDir(async (dir) => {
      const out = join(dir, "output");
      assertEquals(await main(["--repo", ROOT, "--files", "commons/system/src/fs.ts", "--github-output", out]), 0);
      const text = readTextFileSync(out);
      assertStringIncludes(text, "has-linux=true");
      assertStringIncludes(text, '"name":"system"');
      assertStringIncludes(text, '"os":"windows-latest"');
      assertEquals(await main(["--repo", ROOT, "--files", "README.md", "--github-output", out]), 0);
      assertStringIncludes(readTextFileSync(out), "has-linux=false", "appended: a step's file is appended to");
      assertEquals(await main(["--repo", ROOT, "--all", "--github-output", out]), 0);
      assertEquals(await main(["--repo", ROOT]), 2);
      assertEquals(await main(["--nonsense"]), 2);
    });
  },
);

proves(
  [`${SPEC} FR-012`],
  "the one workflow ci plans, runs the matrices the plan writes and gives one result, and no library has a workflow of its own; only a library with code of its own for another system asks for one",
  () => {
    const ci = readTextFileSync(join(ROOT, ".github", "workflows", "ci.auto.yml"));
    assertStringIncludes(ci, "bun commons/libraries/src/plan.ts");
    assertStringIncludes(ci, "matrix: ${{ fromJSON(needs.plan.outputs.linux) }}");
    assertStringIncludes(ci, "matrix: ${{ fromJSON(needs.plan.outputs.systems) }}");
    assertStringIncludes(ci, "needs: [seen, plan, verify, systems]");
    assertStringIncludes(ci, "fetch-depth: 0");
    for (const [name, c] of Object.entries(LIBRARY_CI)) {
      for (const os of c.systems ?? []) assert(os === "windows-latest" || os === "macos-latest", `${name} asks for ${os}`);
    }
    return Promise.resolve();
  },
);

proves(
  [`${SPEC} FR-012`],
  "the packing is checked in the cells of the libraries that changed their exports or where the packer changed, and in none of the others: the exports are compared as data, in any order, against the merge base",
  async () => {
    assertEquals(exportsLine('{"exports":{"./b":"./b.ts",".":"./a.ts"}}'), exportsLine('{"name":"x","exports":{".":"./a.ts","./b":"./b.ts"}}'));
    assert(exportsLine('{"exports":{".":"./a.ts"}}') !== exportsLine('{"exports":{".":"./c.ts"}}'));
    assertEquals(exportsLine("not json"), "unreadable");
    const p = planOf([lib("core"), lib("net")], new Set(["net"]));
    assertEquals(
      p.linux.include.map((c) => `${c.name} ${c.pack}`),
      ["core false", "net true"],
    );
    assert(
      p.systems.include.every((c) => c.name === "net" && c.pack),
      "the cells of the other systems carry it too",
    );
    const git = proc.which("git");
    if (git === undefined) return;
    await withTempDir(async (dir) => {
      const g = (...a: string[]) => proc.run([git, "-C", dir, "-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...a]);
      const put = (f: string, t: string): void => {
        mkdirSync(join(dir, f, ".."), { recursive: true });
        writeTextFileSync(join(dir, f), t);
      };
      const pkg = (e: Record<string, string>): string => JSON.stringify({ name: "x", exports: e });
      put("commons/a/package.json", pkg({ ".": "./a.ts" }));
      put("commons/b/package.json", pkg({ ".": "./b.ts" }));
      await g("init", "-q", "-b", "main");
      await g("add", ".");
      await g("commit", "-q", "-m", "base");
      await g("checkout", "-q", "-b", "work");
      put("commons/a/package.json", pkg({ ".": "./a.ts", "./more": "./more.ts" }));
      put("commons/b/other.ts", "export {};\n");
      put("commons/c/package.json", pkg({ ".": "./c.ts" }));
      await g("add", ".");
      await g("commit", "-q", "-m", "work");
      const libs = ["a", "b", "c"].map(lib);
      assertEquals([...(await packsFor(dir, "main", libs, false))].sort(), ["a", "c"], "a changed its exports and c is new; b did not");
      put("commons/libraries/src/pack-library.ts", "export {};\n");
      await g("add", ".");
      await g("commit", "-q", "-m", "packer");
      assertEquals([...(await packsFor(dir, "main", libs, false))].sort(), ["a", "b", "c"], "the packer changed: every library");
      assertEquals((await packsFor(dir, "no-such-base", libs, false)).size, 3, "Git cannot say: every library");
      // the one package is packed once, in the cell of `commons`, and in no library's own cell (0001-libraries FR-012, 0036-distribution FR-021)
      const all = ["a", "b", "c", "commons"].map(lib);
      assertEquals([...(await packsFor(dir, "no-such-base", all, true))], ["commons"], "Git cannot say: the package alone");
      assertEquals([...(await packsFor(dir, "main", all, true))], ["commons"], "the packer changed: the package alone, not each library");
      await g("checkout", "-q", "-b", "quiet", "main");
      assertEquals((await packsFor(dir, "main", libs.slice(0, 2), true)).size, 0, "nothing changed its exports and the packer is the same: no packing");
    });
  },
);
