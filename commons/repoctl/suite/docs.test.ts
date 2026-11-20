/**
 * `repoctl docs build|serve|check` (commons repoctl 0011-repoctl-docs FR-001 to FR-004) against a fixture repository whose `node_modules` holds a generator of its own that records the arguments it is given: the verbs exist only with
 * docs settings, the generator is loaded where it is installed and its absence is a typed problem, a failing status is a typed problem, and the site is served on loopback only.
 *
 * @module
 */
import { fs, path } from "@intellectual-frontiers/system";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { main } from "@intellectual-frontiers/repoctl";
import { CATALOGUE } from "@intellectual-frontiers/repoctl/governance";
import { serveFolder } from "@intellectual-frontiers/repoctl/physical";
import { CAN_RUN, CHECKOUT, git, put } from "./world.ts";

const GOVERNANCE = path.join(CHECKOUT, "commons/repoctl/src/governance/mod.ts");

const CONFIG = `import { defineConfig } from ${JSON.stringify(GOVERNANCE)};
export default defineConfig({ repo: "acme/site", commit: { identity: { name: "Fix Ture", email: "fix@example.test" } }, docs: { config: "docs.config.ts", out: "_site" } });
`;

const GENERATOR = `import { mkdirSync, readFileSync, existsSync, writeFileSync } from "node:fs";
export async function main(argv) {
  const here = new URL(".", import.meta.url).pathname;
  writeFileSync(here + "record.json", JSON.stringify(argv));
  const at = argv.indexOf("--out");
  if (at >= 0) { mkdirSync(argv[at + 1], { recursive: true }); writeFileSync(argv[at + 1] + "/index.html", "<h1>the site</h1>"); }
  return existsSync(here + "status.txt") ? Number(readFileSync(here + "status.txt", "utf8")) : 0;
}
`;

type Out = { readonly code: number; readonly out: string; readonly err: string };
async function run(cwd: string, argv: readonly string[]): Promise<Out> {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(argv, { cwd, env: {}, out: (t) => void out.push(t), err: (t) => void err.push(t) });
  return { code, out: out.join(""), err: err.join("") };
}

async function withSite<T>(use: (dir: string, generator: string) => Promise<T>, installed = true): Promise<T> {
  return await fs.withTempDir(async (dir) => {
    await git(dir, "init", "-q");
    await put(dir, "repoctl.config.ts", CONFIG);
    await put(dir, "docs.config.ts", "export default {};\n");
    const generator = path.join(dir, "node_modules/@intellectual-frontiers/docs");
    if (installed) {
      await put(dir, "node_modules/@intellectual-frontiers/docs/package.json", JSON.stringify({ name: "@intellectual-frontiers/docs", version: "0.1.0", type: "module", exports: { ".": "./index.mjs" } }));
      await put(dir, "node_modules/@intellectual-frontiers/docs/index.mjs", GENERATOR);
    }
    return await use(dir, generator);
  });
}

proves(["0011-repoctl-docs FR-001"], "the docs verbs are in the help with docs settings and not without, and build previews with --dry-run", async () => {
  if (!CAN_RUN) return;
  await withSite(async (dir) => {
    const help = (await run(dir, ["docs", "--help"])).out;
    for (const verb of ["build", "serve", "check"]) assert(new RegExp(`^\\s+${verb}\\b`, "m").test(help), verb);
    const preview = await run(dir, ["docs", "build", "--dry-run"]);
    assertEquals(preview.code, 0, preview.err);
    assertStringIncludes(preview.out, "build --out");
    assert(!(await fs.exists(path.join(dir, "_site"))), "a preview builds nothing");
  });
  await fs.withTempDir(async (dir) => {
    await put(dir, "repoctl.config.ts", CONFIG.replace(', docs: { config: "docs.config.ts", out: "_site" }', ""));
    assertEquals((await run(dir, ["docs", "check"])).code, 2);
  });
});

proves(["0011-repoctl-docs FR-002"], "the generator is loaded from the repository's own dependencies and is asked for build and check with absolute paths; where it is not installed the problem says how to install it", async () => {
  if (!CAN_RUN) return;
  await withSite(async (dir, generator) => {
    const built = await run(dir, ["docs", "build"]);
    assertEquals(built.code, 0, built.err);
    assertEquals(await fs.readTextFile(path.join(dir, "_site/index.html")), "<h1>the site</h1>");
    assertEquals(JSON.parse(await fs.readTextFile(path.join(generator, "record.json"))), ["build", "--out", path.join(dir, "_site"), "--config", path.join(dir, "docs.config.ts")]);
    const checked = await run(dir, ["docs", "check"]);
    assertEquals(checked.code, 0, checked.err);
    assertEquals(JSON.parse(await fs.readTextFile(path.join(generator, "record.json"))), ["check", "--config", path.join(dir, "docs.config.ts")]);
    const elsewhere = await run(dir, ["docs", "build", "--out", "public"]);
    assertEquals(elsewhere.code, 0, elsewhere.err);
    assert(await fs.exists(path.join(dir, "public/index.html")));
  });
  await withSite(
    async (dir) => {
      const missing = await run(dir, ["docs", "check"]);
      assertEquals(missing.code, 1);
      assertStringIncludes(missing.err, "E-DOCS-GENERATOR-MISSING");
      assertStringIncludes(CATALOGUE["E-DOCS-GENERATOR-MISSING"].fix, "@intellectual-frontiers/docs");
      assertStringIncludes(CATALOGUE["E-DOCS-GENERATOR-MISSING"].fix, "add --dev");
    },
    false,
  );
});

proves(["0011-repoctl-docs FR-003"], "a generator that ends with a status other than 0 is E-DOCS-FAILED", async () => {
  if (!CAN_RUN) return;
  await withSite(async (dir, generator) => {
    await fs.writeTextFile(path.join(generator, "status.txt"), "3");
    const failed = await run(dir, ["docs", "check"]);
    assertEquals(failed.code, 1);
    assertStringIncludes(failed.err, "E-DOCS-FAILED");
    assertStringIncludes(failed.err, "ended with 3");
    assertEquals((await run(dir, ["docs", "build"])).code, 1);
  });
});

proves(["0011-repoctl-docs FR-004"], "serve builds the site and serves it on a loopback port: the index, a 404 for a missing path, and a port that is no port is a usage error", async () => {
  if (!CAN_RUN) return;
  await withSite(async (dir) => {
    const served = await run(dir, ["docs", "serve", "--port", "0", "--for", "0"]);
    assertEquals(served.code, 0, served.err);
    assertStringIncludes(served.out, "http://127.0.0.1:");
    assertEquals((await run(dir, ["docs", "serve", "--port", "99999"])).code, 2);
    const site = path.join(dir, "folder");
    await put(dir, "folder/index.html", "<h1>hello</h1>");
    await put(dir, "folder/a/page.css", "body{}");
    const server = await serveFolder(site, 0);
    try {
      assert(server.url.startsWith("http://127.0.0.1:"), server.url);
      const index = await fetch(server.url);
      assertEquals([index.status, await index.text()], [200, "<h1>hello</h1>"]);
      assertEquals((await fetch(`${server.url}a/page.css`)).headers.get("content-type"), "text/css; charset=utf-8");
      assertEquals((await fetch(`${server.url}nothing.html`)).status, 404);
      assertEquals((await fetch(`${server.url}../secret`)).status, 404);
    } finally {
      await server.close();
    }
  });
});
