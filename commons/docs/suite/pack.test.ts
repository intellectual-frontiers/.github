/**
 * The package that is published (commons 0001-docs FR-003, FR-004): it is built, inspected and packed by the packer of commons, with compiled modules and their declarations beside the sources, the theme files beside the modules that read them,
 * the command `ifc-docs` as a launcher of the compiled `cli`, a `LICENSE`, and dependencies that are all packages of npm.
 *
 * @module
 */
import { fs, path } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { packedDocs } from "./packed.ts";

proves(["0001-docs FR-004", "0001-docs FR-003"], "the package is packed with compiled modules, declarations, theme files, a launcher for ifc-docs, a LICENSE and no dependency that is a link", async () => {
  const p = await packedDocs();
  assertEquals(p.findings, []);
  assert(p.tarball !== undefined, "a tarball");
  const m = p.manifest as { name: string; license: string; bin: Record<string, string>; exports: Record<string, { types: string; default: string }>; dependencies: Record<string, string>; files: string[] };
  assertEquals([m.name, m.license], ["@intellectual-frontiers/docs", "PolyForm-Noncommercial-1.0.0"]);
  assertEquals(m.bin, { "ifc-docs": "./ifc-docs.mjs" });
  assertEquals(Object.keys(m.exports), [".", "./lens/layered", "./lens/program", "./lens/guides", "./lens/releases", "./lens/repo-ops"]);
  for (const dep of ["typescript", "shiki", "beautiful-mermaid", "@intellectual-frontiers/core", "@intellectual-frontiers/system"]) assert(dep in m.dependencies, `${dep} is a dependency`);
  assertEquals(m.dependencies["typescript"], "7.1.0-beta");
  assert(Object.values(m.dependencies).every((v) => !v.startsWith("link:") && !v.startsWith("file:")), "every dependency is a version of npm");
  for (const f of ["dist/mod.js", "dist/mod.d.ts", "dist/cli.js", "dist/theme/site.css", "dist/theme/fumadocs.css", "dist/theme/site.js", "src/theme/site.css", "src/theme/fumadocs.css", "ifc-docs.mjs", "LICENSE", "README.md"]) assert(fs.existsSync(path.join(p.stage, f)), `${f} is in the package`);
  const launcher = await fs.readTextFile(path.join(p.stage, "ifc-docs.mjs"));
  assert(launcher.startsWith("#!/usr/bin/env node\n") && launcher.includes('"./dist/cli.js"'), "the launcher runs the compiled cli");
}, { timeout: 240_000 });
