/**
 * Docs as a library (commons 0001-docs FR-001, FR-002): the folder, the manifest, the package and the spec kit agree, and the package exports by name what a configuration imports: the entry of the generator and the factories
 * of the lenses.
 *
 * @module
 */
import { fs, path } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { library } from "../library.ts";
import { DOCS } from "./packed.ts";

const pkg = JSON.parse(await fs.readTextFile(path.join(DOCS, "package.json"))) as { name: string; version: string; private: boolean; exports: Record<string, string>; bin: Record<string, string>; dependencies: Record<string, string> };

proves(["0001-docs FR-001"], "the manifest, the package and the folder agree: the name, the version, the exports, the spec kit and the sources in src/", async () => {
  assertEquals([library.name, pkg.name], ["docs", "@intellectual-frontiers/docs"]);
  assertEquals(library.version, pkg.version);
  assertEquals(pkg.private, true, "nothing is published from the folder by hand");
  assertEquals([...library.exports], Object.keys(pkg.exports));
  assert(fs.existsSync(path.join(DOCS, library.specKit, "registry.tsv")) && fs.existsSync(path.join(DOCS, "about.ts")) && fs.existsSync(path.join(DOCS, "src/mod.ts")));
});

proves(["0001-docs FR-002"], "a configuration can import by name the entry, which exports the configuration's types and the functions, and the four lens factories", async () => {
  assertEquals(Object.keys(pkg.exports), [".", "./lens/layered", "./lens/program", "./lens/guides", "./lens/releases"]);
  for (const target of Object.values(pkg.exports)) assert(fs.existsSync(path.join(DOCS, target)), `${target} is a file`);
  const entry = await import("../src/mod.ts");
  for (const name of ["buildSite", "writeSite", "report", "resolveConfig", "loadConfig", "main"]) assert(typeof (entry as Record<string, unknown>)[name] === "function", `the entry exports ${name}`);
  assert(typeof (await import("../src/lens/layered.ts")).layeredLens === "function");
  assert(typeof (await import("../src/lens/program.ts")).programLens === "function");
  assert(typeof (await import("../src/lens/guides.ts")).guidesLens === "function");
  assert(typeof (await import("../src/lens/releases.ts")).releasesLens === "function");
});
