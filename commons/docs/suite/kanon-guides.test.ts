/**
 * The explanation of Kanon is pages of the documentation (commons 0001-docs FR-046): the group Kanon of the Concepts section holds the overview and twelve pages in order, every link between them resolved
 * by the site build, at least nine diagrams, every quoted block of code equal to the lines of the file it names, every block of output with its command and its day, and no long dash in the words.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { fs, path } from "@intellectual-frontiers/system";

import { ROOT, siteOnce } from "./helpers.ts";

const PAGES = [
  "kanon-why",
  "kanon-one-page",
  "kanon-worked-example",
  "kanon-trace-and-dropped",
  "kanon-imports",
  "kanon-families",
  "kanon-content",
  "kanon-adopting",
  "kanon-gains",
  "kanon-weaknesses",
  "kanon-decision-guide",
  "kanon-glossary",
] as const;

const GUIDES = path.join(ROOT, "commons", "docs", "guides");

/** The Markdown of the overview and of each page of the group, by file name. */
async function sources(): Promise<ReadonlyMap<string, string>> {
  const out = new Map<string, string>();
  for (const name of ["concept-kanon", ...PAGES]) out.set(name, await fs.readTextFile(path.join(GUIDES, `${name}.md`)));
  return out;
}

proves(["0001-docs FR-046"], "the group Kanon holds the overview and twelve pages in order, with no broken link and at least nine diagrams", async () => {
  const built = await siteOnce();
  assertEquals(built.found, []);
  const group = built.pages.filter((p) => p.section === "concepts" && p.group === "Kanon");
  assertEquals(group.map((p) => p.path), ["concepts/kanon.html", ...PAGES.map((p) => `concepts/${p}.html`)]);
  const diagrams = group.flatMap((p) => JSON.stringify(p.blocks).match(/"kind":"diagram"/g) ?? []);
  assert(diagrams.length >= 9, `the group has ${diagrams.length} diagrams`);
});

proves(["0001-docs FR-046"], "a quoted block equals the lines of the file it names, and a block of output names its command and its day", async () => {
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
      assert(/;\s*\d{4}-\d{2}-\d{2}$/.test(info) && info.split(";")[0]!.trim().length > 0, `${name}: the output block "${info}" names no command and no day`);
      outputs += 1;
    }
  }
  assert(quoted >= 20, `${quoted} quoted blocks`);
  assert(outputs >= 8, `${outputs} blocks of output`);
});

proves(["0001-docs FR-046"], "the group is at least eleven thousand words, and no page holds a long or a medium dash", async () => {
  let words = 0;
  for (const [name, text] of await sources()) {
    assert(!/[–—]/.test(text), `${name} holds a long or a medium dash`);
    words += text.split(/\s+/).filter((w) => w.length > 0).length;
  }
  assert(words >= 11000, `the group holds ${words} words`);
});
