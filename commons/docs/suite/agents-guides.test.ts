/**
 * The explanation of `AGENTS.md` and of why MEMORY.md is not used are two pages of the Getting Started section (commons 0001-docs FR-052): both are in the start section in order, every link between the
 * pages resolves in the site build, each has a diagram and at least fifteen hundred words, every quoted block of code is equal to the lines of the file it names, every block of output names its command and its
 * day, every entry of a Sources section has a date or says that it is undated, and no page has a long or a medium dash.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { fs, path } from "@intellectual-frontiers/system";

import { ROOT, siteOnce } from "./helpers.ts";

const PAGES = ["agents-md", "why-not-memory-md"] as const;
const GUIDES = path.join(ROOT, "commons", "docs", "guides");

/** The Markdown of each page, by file name. */
async function sources(): Promise<ReadonlyMap<string, string>> {
  const out = new Map<string, string>();
  for (const name of PAGES) out.set(name, await fs.readTextFile(path.join(GUIDES, `${name}.md`)));
  return out;
}

proves(["0001-docs FR-052"], "both pages are in the start section after the pages that were there, with no broken link and a diagram on each", async () => {
  const built = await siteOnce();
  assertEquals(built.found, []);
  const start = built.pages.filter((p) => p.section === "start" && p.group === "Start here");
  const paths = start.map((p) => p.path);
  assert(paths.includes("start/agents-md.html") && paths.includes("start/why-not-memory-md.html"), "both pages are in Start here");
  assert(paths.indexOf("start/agents-md.html") < paths.indexOf("start/why-not-memory-md.html"), "the page on AGENTS.md comes before the page on MEMORY.md");
  for (const slug of ["agents-md", "why-not-memory-md"]) {
    const page = start.find((p) => p.path === `start/${slug}.html`);
    assert(page !== undefined, slug);
    assert((JSON.stringify(page.blocks).match(/"kind":"diagram"/g) ?? []).length >= 1, `${slug} has a diagram`);
  }
});

proves(["0001-docs FR-052"], "a quoted block equals the lines of the file it names, and a block of output names its command and its day", async () => {
  let quoted = 0;
  let outputs = 0;
  for (const [name, text] of await sources()) {
    for (const m of text.matchAll(/^```(\w+) source=(\S+)#L(\d+)-L(\d+)\n([\s\S]*?)\n```$/gm)) {
      const [, , file, from, to, body] = m;
      assert(file !== undefined && from !== undefined && to !== undefined && body !== undefined);
      const lines = (await fs.readTextFile(path.join(ROOT, file))).split("\n").slice(Number(from) - 1, Number(to));
      assertEquals(body, lines.join("\n"), `${name}: the block of ${file} lines ${from} to ${to} is not what the file holds`);
      quoted += 1;
    }
    for (const m of text.matchAll(/^```text output="([^"]*)"$/gm)) {
      const info = m[1] ?? "";
      assert(/;\s*\d{4}-\d{2}-\d{2}$/.test(info) && (info.split(";")[0] ?? "").trim().length > 0, `${name}: the output block "${info}" names no command and no day`);
      outputs += 1;
    }
  }
  assert(quoted >= 3, `${quoted} quoted blocks`);
  assert(outputs >= 3, `${outputs} blocks of output`);
});

proves(["0001-docs FR-052"], "each page is at least fifteen hundred words and has no long or medium dash, and each entry of a Sources section has a date or says that it is undated", async () => {
  for (const [name, text] of await sources()) {
    assert(!/[–—]/.test(text), `${name} holds a long or a medium dash`);
    assert(text.split(/\s+/).filter((w) => w.length > 0).length >= 1500, `${name} has fewer than 1,500 words`);
    const sources = text.split(/^## Sources$/m)[1];
    assert(sources !== undefined, `${name} has no Sources section`);
    const entries = sources.split("\n").filter((l) => l.startsWith("- "));
    assert(entries.length >= 5, `${name} has ${entries.length} source entries`);
    for (const e of entries) assert(/\b\d{4}\b/.test(e) || /undated|not read|not captured/i.test(e), `${name}: the source entry "${e.slice(0, 60)}" has no date and does not say that it is undated`);
  }
});
