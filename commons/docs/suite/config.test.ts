/**
 * The configuration and the command line (commons 0011-documentation FR-003, FR-023): a configuration checked once into its resolved
 * form, every problem with it named, the command line read into a command, the configuration found from the working folder up to the
 * repository's root, and a bad one refused with exit status 2.
 *
 * @module
 */
import { fs, path } from "../../ts/runtime/mod.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "../../ts/runtime/test.ts";
import { findConfig, loadConfig, main, parseArgs } from "../cli.ts";
import { normalDir, resolveConfig, under } from "../config.ts";
import { CONFIG, ROOT } from "./helpers.ts";

proves(["0011-documentation FR-023"], "commons' configuration resolves: its root, its packages, its spec kit, its citations, its lenses and its output", () => {
  assertEquals(CONFIG.root, ROOT);
  assertEquals(CONFIG.fileFromRoot, "commons/docs.config.ts");
  assertEquals([CONFIG.name, CONFIG.subject, CONFIG.branch], ["IF Commons", "commons", "main"]);
  assertEquals(CONFIG.home, { dir: "commons", slug: "home", about: { kind: "file", file: "commons/about.ts" } });
  assertEquals(CONFIG.packages.map((p) => [p.dir, p.slug]), [["commons/ts", "ifc-typescript"], ["commons/ts/data", "data"], ["commons/docs", "docs"]]);
  // a library's spec kit is named beside commons' own, so that it is published with it and never twice (0027-commons-libraries FR-009)
  assertEquals(CONFIG.specKits, [{ layout: "commons", dir: "commons/spec-kit" }, { layout: "commons", dir: "commons/data/spec-kit" }]);
  assertEquals([CONFIG.citations.prefix, CONFIG.citations.digits], ["commons", 4]);
  assertEquals(CONFIG.lenses.map((l) => l.name), ["sql-aide", "file-aide"]);
  assertEquals(CONFIG.out, path.join(ROOT, "_site"));
});

proves(["0011-documentation FR-023", "0011-documentation FR-027"], "defaults are filled, folders made relative to the root, and an About value kept", () => {
  const r = resolveConfig(
    {
      name: "R",
      repository: "https://github.com/example/r",
      home: { dir: "./" },
      packages: [{ dir: "./pkg/", slug: "pkg", about: { title: "P", summary: "S", areas: [{ title: "A", slug: "a", entryPoints: ["mod.ts"] }] } }],
      specKits: [{ layout: "spec-kit", dir: "specs" }],
      citations: { prefix: "R", digits: 3 },
    },
    "/x/r/docs.config.ts",
  );
  assert(r.kind === "ok");
  const c = r.value;
  assertEquals([c.root, c.subject, c.branch, c.out, c.lintRules], ["/x/r", "R", "main", "/x/r/_site", undefined]);
  assertEquals(c.home.about, { kind: "file", file: "about.ts" });
  assertEquals(c.packages[0]?.dir, "pkg");
  assertEquals(c.packages[0]?.about.kind, "value");
  assertEquals(c.specKits, [{ layout: "spec-kit", dir: "specs", constitution: ".specify/memory/constitution.md" }]);
  assertEquals(c.citations, { prefix: "r", digits: 3, linked: [], text: [] });
  assertEquals([normalDir("."), normalDir("./a//b/"), under("", "x.ts"), under("a", "./x.ts")], ["", "a/b", "x.ts", "a/x.ts"]);
});

proves(["0011-documentation FR-023"], "a configuration that is not valid names every problem", () => {
  const r = resolveConfig(
    {
      name: "",
      repository: "github.com/x/",
      home: "here",
      packages: [{ dir: "a" }, { dir: "b", slug: "Not A Slug" }, { dir: "c", slug: "c", about: { title: "no summary" } }],
      specKits: [{ layout: "other", dir: "specs" }],
      citations: { prefix: "x", digits: 0, linked: [{ repo: "y", site: "http://y" , digits: 3 }], text: [1] },
      lenses: [{ name: "half" }],
    },
    "/x/docs.config.ts",
  );
  assert(r.kind === "err");
  const all = r.error.join("\n");
  for (const said of ["name must", "repository must", "home must", "packages[0].slug", "packages[1].slug", "packages[2].about", "specKits[0].layout", "citations.digits", "citations.linked[0].site", "citations.text", "lenses[0]"]) {
    assertStringIncludes(all, said);
  }
  assertEquals(resolveConfig(undefined, "/x/docs.config.ts").kind, "err");
});

proves(["0011-documentation FR-003"], "the command line: build with --out and --config, check with --config, and what is not one", () => {
  assertEquals(parseArgs(["build", "--out", "o", "--config", "c.ts"]), { kind: "ok", value: { kind: "build", out: "o", config: "c.ts" } });
  assertEquals(parseArgs(["check"]), { kind: "ok", value: { kind: "check", config: undefined } });
  assertEquals(parseArgs([]), { kind: "ok", value: { kind: "help" } });
  for (const bad of [["publish"], ["check", "--out", "o"], ["build", "--out"], ["build", "--nothing"]]) assertEquals(parseArgs(bad).kind, "err", bad.join(" "));
});

proves(["0011-documentation FR-003"], "the configuration is the first docs.config.ts from the working folder up to the repository's root", async () => {
  const dir = await fs.makeTempDir({ prefix: "ifc-docs-config-" });
  try {
    await fs.ensureDir(path.join(dir, "repo/.git"));
    await fs.ensureDir(path.join(dir, "repo/a/b"));
    await fs.writeTextFile(path.join(dir, "docs.config.ts"), "export default {};\n");
    assertEquals(findConfig(path.join(dir, "repo/a/b")), undefined, "the search stops at the repository's root");
    await fs.writeTextFile(path.join(dir, "repo/docs.config.ts"), "export default {};\n");
    assertEquals(findConfig(path.join(dir, "repo/a/b")), path.join(dir, "repo/docs.config.ts"));
    await fs.writeTextFile(path.join(dir, "repo/a/docs.config.ts"), "export default {};\n");
    assertEquals(findConfig(path.join(dir, "repo/a/b")), path.join(dir, "repo/a/docs.config.ts"));
    assertEquals(findConfig(path.join(ROOT, "commons/docs")), path.join(ROOT, "commons/docs.config.ts"), "commons' own, from commons/docs");
    const loaded = await loadConfig(path.join(dir, "repo/docs.config.ts"));
    assert(loaded.kind === "err", "an empty configuration is refused");
    assertEquals(await main(["check"], path.join(dir, "repo/a/b")), 2);
    assertEquals(await main(["check", "--config", "nothing.ts"], dir), 2);
    assertEquals(await main(["frobnicate"], dir), 2);
  } finally {
    await fs.remove(dir, { recursive: true });
  }
});
