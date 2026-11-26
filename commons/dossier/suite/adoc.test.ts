/**
 * Tests of the AsciiDoc of a dossier (commons dossier 0002-dossier-core FR-006): values made safe, lines and endings, the fixed attributes, citations that resolve and anchors that are one each.
 *
 * @module
 */
import fc from "fast-check";
import type { Block, Plate } from "@intellectual-frontiers/dossier/governance";
import { ATTRIBUTES, blockAdoc, documentAdoc, evidenceAnchor, inlinesAdoc, plateOf, text } from "@intellectual-frontiers/dossier/logical";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { sources as made, WHEN } from "./fixtures.ts";

const plate = (slug: string, blocks: readonly Block[], cites: readonly string[] = []): Plate => plateOf({ lens: { id: "t", ceiling: "public" }, title: slug, slug, blocks, cites });

proves(["0002-dossier-core FR-006"], "the writer makes every value safe, ends lines with LF, sets only the listed attributes, resolves citations and refuses a repeated anchor", async () => {
  const hostile = "<script>alert(1)</script> * _x_ [[anchor]] |cell| == not a heading";
  assert(!blockAdoc({ t: "para", inlines: [text(hostile)] }).join("\n").includes("<script>") || blockAdoc({ t: "para", inlines: [text(hostile)] }).join("\n").includes("pass:c["), "the text is passed through as text");
  assertEquals(blockAdoc({ t: "para", inlines: [text("== a heading")] }).at(-1), "{empty}== a heading".replace("{empty}", "pass:c[").length > 0 ? "== a heading".startsWith("==") ? "{empty}== a heading" : "" : "");
  const all = await made();
  const run = all[0];
  assert(run !== undefined);
  const ok = documentAdoc({ title: "T [1]", asOf: WHEN, audience: "internal", inputs: "h", lenses: [{ id: "t", version: "1" }], plates: [plate("p", [{ t: "para", inlines: [{ t: "cite", source: run.id }] }], [run.id])], sources: [run] });
  assert(ok.kind === "ok");
  const doc = ok.value;
  assert(!doc.includes("\r") && doc.endsWith("\n") && !doc.endsWith("\n\n"), "LF, one final newline");
  assert(doc.split("\n").every((l) => l === l.trimEnd()), "no line ends in a space");
  const attrs = doc.split("\n").filter((l) => /^:[a-z]+:/.test(l)).map((l) => /^:([a-z]+):/.exec(l)?.[1]);
  assertEquals(attrs, [...ATTRIBUTES]);
  assert(doc.includes(`xref:${evidenceAnchor(run.id)}[`) && doc.includes(`[[${evidenceAnchor(run.id)}]]`), "a citation reaches the entry of its source");
  const stray = documentAdoc({ title: "T", asOf: WHEN, audience: "internal", inputs: "h", lenses: [], plates: [plate("p", [], ["ghost"])], sources: [] });
  assert(stray.kind === "err" && stray.error.code === "E-DOSSIER-LENS-CITE");
  const twice = documentAdoc({ title: "T", asOf: WHEN, audience: "internal", inputs: "h", lenses: [], plates: [plate("p", []), plate("p", [])], sources: [] });
  assert(twice.kind === "err" && twice.error.code === "E-DOSSIER-ANCHOR");
  fc.assert(
    fc.property(fc.string(), (t) => {
      const w = inlinesAdoc([text(t)]);
      return !w.includes("\r") || t.includes("\r");
    }),
  );
});
