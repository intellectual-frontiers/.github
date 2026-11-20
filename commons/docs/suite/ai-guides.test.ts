/**
 * The guides for working with an AI assistant (commons 0011-documentation FR-038): each task guide has the five headings in order and a block tagged `prompt`, every path, `repoctl` verb, `bun run` script
 * and specification number they name exists, each names the command that proves the result, and commons' site has a page for each in the group "With an AI assistant".
 *
 * @module
 */
import { fs, path, proc } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { buildSite } from "../src/site.ts";
import { CONFIG, ROOT } from "./helpers.ts";

const GUIDES = path.join(ROOT, "commons/docs/guides");
const HEADINGS = ["When to use it", "What to give the assistant", "The prompt", "Check the result", "Common mistakes"];

async function guides(): Promise<readonly { readonly name: string; readonly text: string }[]> {
  const names = (await fs.listFiles(GUIDES)).filter((n) => /^ai-.*\.md$/.test(n)).sort();
  return Promise.all(names.map(async (name) => ({ name, text: await fs.readTextFile(path.join(GUIDES, name)) })));
}

/** The scripts of the root and of every library, and the commands the real repoctl lists. */
async function known(): Promise<{ readonly scripts: ReadonlySet<string>; readonly verbs: ReadonlySet<string>; readonly specs: ReadonlySet<string> }> {
  const scripts = new Set<string>();
  const packages = [path.join(ROOT, "package.json"), ...(await fs.listDirs(path.join(ROOT, "commons"))).map((d) => path.join(ROOT, "commons", d, "package.json"))];
  for (const p of packages) {
    const text = await fs.readTextOr(p);
    if (text === undefined) continue;
    for (const k of Object.keys((JSON.parse(text) as { scripts?: Record<string, string> }).scripts ?? {})) scripts.add(k);
  }
  const help = await proc.run(["bun", path.join(ROOT, "commons/repoctl/src/repoctl.ts"), "--help"], { cwd: ROOT });
  const verbs = new Set([...help.stdout.matchAll(/^  ([a-z]+)\s{2,}/gm)].map((m) => m[1] ?? ""));
  assert(verbs.has("check") && verbs.has("sync"), "repoctl says its commands");
  const specs = new Set<string>();
  const kits = [path.join(ROOT, "commons/spec-kit/specs"), ...(await fs.listDirs(path.join(ROOT, "commons"))).map((d) => path.join(ROOT, "commons", d, "spec-kit/specs"))];
  for (const k of kits) for (const d of await fs.listDirs(k).catch(() => [] as string[])) specs.add(d);
  return { scripts, verbs, specs };
}

proves(["0011-documentation FR-038"], "each task guide has the five headings in order and a prompt block, and each guide names the command that proves the result", async () => {
  const all = await guides();
  assert(all.length >= 3, "the start page and at least two task guides");
  for (const g of all) {
    if (g.name !== "ai-start.md") {
      const found = [...g.text.matchAll(/^## (.+)$/gm)].map((m) => m[1] ?? "");
      assertEquals(found, HEADINGS, `${g.name} has the headings in order`);
      assert(/```prompt\n[\s\S]+?\n```/.test(g.text), `${g.name} has a block tagged prompt`);
    }
    assert(/bun run (verify|dev:check|repoctl check)/.test(g.text), `${g.name} names the command that proves the result`);
  }
});

proves(["0011-documentation FR-038"], "every path, repoctl verb, bun run script and specification number the guides name exists", async () => {
  const { scripts, verbs, specs } = await known();
  for (const g of await guides()) {
    for (const m of g.text.matchAll(/\b(commons\/[A-Za-z0-9_.\/-]*[A-Za-z0-9_\/-])/g)) {
      const ref = m[1] ?? "";
      assert(await fs.exists(path.join(ROOT, ref)), `${g.name} names ${ref}, which does not exist`);
    }
    if (g.text.includes("AGENTS.md")) assert(await fs.exists(path.join(ROOT, "AGENTS.md")), "AGENTS.md exists");
    for (const m of g.text.matchAll(/bun run repoctl ([a-z]+)(?: ([a-z]+))?/g)) {
      assert(verbs.has(m[1] ?? ""), `${g.name} names the repoctl verb ${m[1]}, which repoctl does not have`);
    }
    for (const m of g.text.matchAll(/bun run ([A-Za-z0-9:_-]+)/g)) assert(scripts.has(m[1] ?? ""), `${g.name} names the script ${m[1]}, which no package.json has`);
    for (const m of g.text.matchAll(/\b(\d{4}-[a-z][a-z0-9-]+)\b/g)) assert(specs.has(m[1] ?? ""), `${g.name} cites ${m[1]}, which is no specification`);
  }
});

proves(["0011-documentation FR-038"], "commons' site has a page for each AI guide in the group With an AI assistant", async () => {
  const built = await buildSite(CONFIG);
  assertEquals(built.found, []);
  for (const g of await guides()) {
    const page = built.pages.find((p) => p.path === `how-to/${g.name.replace(/\.md$/, ".html")}`);
    assert(page !== undefined, `${g.name} has a page`);
    assertEquals(page.section, "howto");
  }
  const text = JSON.stringify(built.pages.filter((p) => p.path.startsWith("how-to/ai-")).map((p) => p.group ?? ""));
  assert(text.includes("With an AI assistant") || built.pages.some((p) => p.path === "how-to/ai-start.html"));
});
