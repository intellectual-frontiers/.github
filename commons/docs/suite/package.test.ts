/**
 * The generator as part of the root package (commons 0011-documentation FR-021): the root `package.json` exports `./docs` and has the
 * command `ifc-docs`, a JavaScript file that registers IFC TypeScript's Node hook before it imports `cli.ts`, so that Node 26 runs it
 * from `node_modules`; and the smoke test of the Git dependency asks for every kind of page.
 *
 * @module
 */
import { lf } from "@intellectual-frontiers/core";
import { fs, path } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { PAGES } from "../tools/smoke.ts";
import { ROOT } from "./helpers.ts";

/** A field of a value read from JSON. */
const fieldOf = (v: unknown, key: string): unknown => (typeof v === "object" && v !== null ? Object.entries(v).find(([k]) => k === key)?.[1] : undefined);

proves(["0011-documentation FR-021"], "the root package exports ./docs and has ifc-docs, which registers the hook before cli.ts", async () => {
  const root: unknown = JSON.parse(await fs.readTextFile(path.join(ROOT, "package.json")));
  assertEquals(fieldOf(root, "name"), "@intellectual-frontiers/commons");
  assertEquals(fieldOf(fieldOf(root, "exports"), "./docs"), "./commons/docs/mod.ts");
  assertEquals(fieldOf(fieldOf(root, "bin"), "ifc-docs"), "./commons/docs/ifc-docs.mjs");
  const bin = lf(await fs.readTextFile(path.join(ROOT, "commons/docs/ifc-docs.mjs")));
  assert(bin.startsWith("#!/usr/bin/env node\n"), "the command runs from a shebang");
  const hook = bin.indexOf('import "../ts/node/register.mjs";');
  assert(hook > 0 && hook < bin.indexOf('import("./cli.ts")'), "the hook is registered before any TypeScript is imported");
  for (const gone of ["commons/docs/tools/pack.ts", "commons/docs/tsconfig.build.json", ".github/workflows/ifc-docs-release.yml"]) {
    assert(!fs.existsSync(path.join(ROOT, gone)), `${gone} is gone: the generator is not released`);
  }
});

proves(["0011-documentation FR-021"], "the smoke test asks for every kind of page", () => {
  for (const p of ["index.html", "specs/constitution.html", "api/greeting/mod.html", "search.json"]) assert(PAGES.includes(p), p);
});
