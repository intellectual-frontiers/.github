/**
 * The release of the package (commons 0011-documentation FR-021): the source manifest decoded, the manifest the tarball carries (its
 * entry points and `bin` built, its dependencies, no script), the tarball's name and tag, and what the build includes.
 *
 * @module
 */
import { fs, path } from "@intellectual-frontiers/ifc-ts/runtime";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/ifc-ts/runtime/test";
import { decodeManifest, packageManifest, tagOf, tarballName } from "../tools/manifest.ts";
import { readmeOf } from "../tools/pack.ts";
import { PAGES } from "../tools/smoke.ts";
import { ROOT } from "./helpers.ts";

const DOCS = path.join(ROOT, "commons/docs");

proves(["0011-documentation FR-021"], "the package is public, with the command ifc-docs and two entry points, and the tarball carries them built", async () => {
  const m = decodeManifest(await fs.readTextFile(path.join(DOCS, "package.json")));
  assert(m.kind === "ok", m.kind === "err" ? m.error : "");
  assertEquals(m.value.name, "@intellectual-frontiers/ifc-docs");
  assertEquals(m.value.exports, { ".": "./mod.ts", "./config": "./config.ts" });
  assertEquals(m.value.bin, { "ifc-docs": "./main.ts" });
  const packed = packageManifest(m.value);
  assertEquals(packed["exports"], { ".": { types: "./mod.d.ts", default: "./mod.js" }, "./config": { types: "./config.d.ts", default: "./config.js" } });
  assertEquals(packed["bin"], { "ifc-docs": "./main.js" });
  assertEquals(packed["dependencies"], m.value.dependencies);
  assertEquals(["scripts" in packed, "devDependencies" in packed, "private" in packed], [false, false, false]);
  assertEquals(tarballName(m.value), `intellectual-frontiers-ifc-docs-${m.value.version}.tgz`);
  assertEquals(tagOf(m.value.version), `ifc-docs-v${m.value.version}`);
  assert((await fs.readTextFile(path.join(DOCS, "main.ts"))).startsWith("#!/usr/bin/env node\n"), "the command runs from a shebang");
});

proves(["0011-documentation FR-021"], "a private package or a version that is not major.minor.patch is not packed", () => {
  const base = { name: "n", version: "1.0.0", description: "d", type: "module", exports: {}, bin: {}, dependencies: {}, devDependencies: {} };
  assertEquals(decodeManifest(JSON.stringify({ ...base, private: true })).kind, "err");
  assertEquals(decodeManifest(JSON.stringify({ ...base, version: "1.0" })).kind, "err");
  assertEquals(decodeManifest(JSON.stringify(base)).kind, "ok");
});

proves(["0011-documentation FR-021"], "the README is the about's, and the smoke test asks for every kind of page", () => {
  const r = readmeOf("IFC Docs", "What it is.", "0.1.0");
  assertStringIncludes(r, "# IFC Docs 0.1.0\n\nWhat it is.");
  assertStringIncludes(r, "ifc-docs build");
  for (const p of ["index.html", "specs/constitution.html", "api/greeting/mod.html", "assets/mermaid.min.js", "search.json"]) assert(PAGES.includes(p), p);
});
