/**
 * Tests of `node/register.mjs`, the Node hook (commons 0005-typescript-runtime FR-070): a project whose `node_modules` holds a package of
 * `.ts` and `.mts` sources is run by Node 26, which refuses it alone and runs it with `--import` of the hook; a `.ts` file outside
 * `node_modules` is left to Node; the URL's segments decide, a Windows file URL's too; the commands `ifc` and `ifc-docs` register the hook
 * before any TypeScript; and `ifc test run` gives `node --test` the hook. Every runtime's suite runs this, with the `node` on `PATH`.
 *
 * @module
 */
import { lf } from "@intellectual-frontiers/core";
import { makeTempDir, mkdir, readTextFileSync, remove, writeTextFile } from "@intellectual-frontiers/system/fs";
import { dirname, fromFileUrl, join, resolve, toFileUrl } from "@intellectual-frontiers/system/path";
import { run, which } from "@intellectual-frontiers/system/proc";
import { NODE_HOOK } from "../../runtime/test-run.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";

const FR = "0005-typescript-runtime FR-070";
const ROOT = resolve(dirname(fromFileUrl(import.meta.url)), "../..");
const HOOK = join(ROOT, "node", "register.mjs");

/** A project with a package of TypeScript in `node_modules` and a program of its own, also TypeScript, that imports it. */
async function project(): Promise<string> {
  const dir = await makeTempDir({ prefix: "ifc-hook-" });
  const pkg = join(dir, "node_modules", "typed");
  await mkdir(pkg, { recursive: true });
  await writeTextFile(join(pkg, "package.json"), JSON.stringify({ name: "typed", type: "module", exports: "./mod.ts" }));
  await writeTextFile(join(pkg, "mod.ts"), 'import { y } from "./b.mts";\nexport const x: number = y + 1;\n');
  await writeTextFile(join(pkg, "b.mts"), "export const y: number = 41;\n");
  await writeTextFile(join(dir, "package.json"), JSON.stringify({ name: "app", private: true, type: "module" }));
  await writeTextFile(join(dir, "app.ts"), 'import { x } from "typed";\nconst n: number = x;\nconsole.log(`x=${n}`);\n');
  return dir;
}

/** The `node` the test runs, which must be 26 or later. */
function node(): string {
  const exe = which("node");
  assert(exe !== undefined, "node is not on PATH");
  return exe;
}

proves(
  [FR],
  "Node refuses a .ts under node_modules alone, and runs it with the hook, saying no warning; a .ts outside is Node's own",
  async () => {
    const dir = await project();
    try {
      const alone = await run([node(), "app.ts"], { cwd: dir });
      assert(!alone.success, "Node strips a .ts under node_modules by itself now: the hook may not be needed");
      assertStringIncludes(alone.stderr, "ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING");
      const hooked = await run([node(), "--import", toFileUrl(HOOK).href, "app.ts"], { cwd: dir });
      assertEquals([hooked.code, hooked.stdout.trim(), hooked.stderr], [0, "x=42", ""]);
    } finally {
      await remove(dir, { recursive: true });
    }
  },
);

proves(
  [FR],
  "only a file: URL whose path has a node_modules segment and a .ts, .mts or .cts name is the hook's, Windows' too",
  async () => {
    const dir = await makeTempDir({ prefix: "ifc-hook-" });
    try {
      const cases: readonly (readonly [string, boolean])[] = [
        ["file:///home/a/node_modules/x/mod.ts", true],
        ["file:///C:/w/node_modules/x/mod.mts", true],
        ["file:///C:/w/node_modules/@s/x/lib/a.cts", true],
        ["file:///home/a/src/mod.ts", false],
        ["file:///home/a/my_node_modules/x/mod.ts", false],
        ["file:///home/a/node_modules/x/mod.js", false],
        ["node:fs", false],
        ["data:text/plain,/node_modules/x/mod.ts", false],
      ];
      await writeTextFile(
        join(dir, "probe.mjs"),
        `import { strippable } from ${JSON.stringify(toFileUrl(HOOK).href)};\nconsole.log(JSON.stringify(${JSON.stringify(cases.map(([u]) => u))}.map(strippable)));\n`,
      );
      const out = await run([node(), "probe.mjs"], { cwd: dir });
      assertEquals(out.code, 0, out.stderr);
      assertEquals(
        JSON.parse(out.stdout),
        cases.map(([, want]) => want),
      );
    } finally {
      await remove(dir, { recursive: true });
    }
  },
);

proves([FR], "ifc and ifc-docs register the hook before they import TypeScript, and ifc test run gives node --test the hook", () => {
  for (const [file, entry] of [
    ["node/ifc.mjs", 'import("../tools/test.ts")'],
    ["../docs/ifc-docs.mjs", 'import("./cli.ts")'],
  ] as const) {
    const text = lf(readTextFileSync(join(ROOT, file)));
    assert(text.startsWith("#!/usr/bin/env node\n"), `${file} runs from a shebang`);
    const hook = text.indexOf('register.mjs";');
    assert(hook > 0 && hook < text.indexOf(entry), `${file} registers the hook before ${entry}`);
  }
  assertEquals(NODE_HOOK, toFileUrl(HOOK).href);
  assertStringIncludes(readTextFileSync(join(ROOT, "runtime", "test-run.ts")), 'return [exe, "--import", NODE_HOOK, "--test", ...files];');
});
