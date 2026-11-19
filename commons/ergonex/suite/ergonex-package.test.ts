/**
 * The package that is published (commons ergonex 0004-onboarding FR-001): the one file that `tools/pack.ts` bundles runs as it is, from an empty folder with nothing installed beside it, on Bun and on Node 26; its
 * `package.json` has no dependency, the version of the library, the one file as its `bin` and the right to be public; and the `package.json` of this folder stays private.
 *
 * @module
 */
import { makeTempDir, readFile, readTextFile, remove } from "../src/platform/r-fs.ts";
import { dirname, fromFileUrl, join, resolve } from "../src/platform/r-path.ts";
import { run, which } from "../src/platform/r-proc.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/commons/ts/runtime/test";
import { publishedManifest, stage } from "../tools/pack.ts";

const ROOT = resolve(dirname(fromFileUrl(import.meta.url)), "..");
const bun = which("bun");
const node = which("node");
const needsBun = bun === undefined ? { skip: "bun is not installed" } : {};

proves(
  ["0004-onboarding FR-001"],
  "the package that is published has no dependency, the version of the library, one file as its bin, a public access and a repository with its folder, and the package.json of this folder is private",
  async () => {
    const own = JSON.parse(await readTextFile(join(ROOT, "package.json"))) as Record<string, unknown>;
    assertEquals(own["private"], true, "nothing is published from this folder by hand");
    const m = publishedManifest(own);
    assertEquals([m["name"], m["version"]], ["@intellectual-frontiers/ergonex", own["version"]]);
    assertEquals(m["bin"], { ergonex: "./ergonex.mjs" });
    assert(!("dependencies" in m) && !("devDependencies" in m) && !("private" in m) && !("scripts" in m), "nothing to install beside it");
    assertEquals(m["publishConfig"], { access: "public" });
    assertEquals((m["repository"] as { directory: string }).directory, "commons/ergonex");
    const release = await readTextFile(join(ROOT, "release.ts"));
    assertStringIncludes(release, `version: "${String(own["version"])}"`);
    assertStringIncludes(release, 'slug: "ergonex"');
  },
);

proves(
  ["0004-onboarding FR-001"],
  "the bundled file runs from an empty folder on Bun and on Node 26 with nothing installed beside it: with no command it says what to do next, and init makes the workspace",
  async () => {
    const dir = await makeTempDir();
    try {
      const staged = await stage();
      const file = join(staged, "ergonex.mjs");
      const text = new TextDecoder().decode((await readFile(file)).slice(0, 20));
      assert(text.startsWith("#!/usr/bin/env node\n"), "the file starts from a shebang");
      const runtimes = [
        { name: "bun", program: bun },
        { name: "node", program: node },
      ].flatMap((r) => (r.program === undefined ? [] : [{ ...r, program: r.program }]));
      for (const r of runtimes) {
        if (r.name === "node") {
          const v = await run([r.program, "--version"]);
          if (Number(/^v(\d+)/.exec(v.stdout)?.[1] ?? "0") < 26) continue; // Node 26 is the backup runtime; an older one cannot run it
        }
        const home = join(dir, `${r.name} home`);
        const env = {
          HOME: dir,
          USERPROFILE: dir,
          PATH: dirname(r.program),
          ERGONEX_HOME: home,
        };
        const none = await run([r.program, file], {
          env,
          clearEnv: true,
          cwd: dir,
        });
        assertEquals(none.code, 0, `${r.name}: ${none.stderr}`);
        assertStringIncludes(none.stdout, "ergonex init");
        const init = await run([r.program, file, "init", "--no-install"], {
          env,
          clearEnv: true,
          cwd: dir,
        });
        assertEquals(init.code, 0, `${r.name}: ${init.stderr}`);
        assertStringIncludes(init.stdout, "made");
      }
    } finally {
      await remove(dir, { recursive: true }).catch(() => {});
    }
  },
  needsBun,
);
