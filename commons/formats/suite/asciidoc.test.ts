/**
 * Tests of `asciidoc.ts` (commons formats 0003-formats-asciidoc FR-001 to FR-004): text made safe for AsciiDoc, a line that begins safely, code in a line and the fence of a source block.
 *
 * @module
 */
import fc from "fast-check";
import { codeAdoc, fence, lead, textAdoc } from "../src/asciidoc.ts";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";

proves(["0003-formats-asciidoc FR-001", "0003-formats-asciidoc FR-002"], "textAdoc passes markup through as text and writes a bracket as the attribute that holds its place", () => {
  assertEquals(textAdoc("a [b]"), "a {startsb}b{endsb}");
  assertEquals(textAdoc("a * b"), "pass:c[a * b]");
  assertEquals(textAdoc("plain words"), "plain words");
  assertEquals(textAdoc(""), "");
  const opens = (x: string): number => x.split("[").length - 1;
  fc.assert(
    fc.property(fc.string(), (t) => {
      const w = textAdoc(t);
      return opens(w) === w.split("pass:c[").length - 1;
    }),
  );
});

proves(["0003-formats-asciidoc FR-003"], "lead begins a line that reads as markup with the empty attribute and leaves any other line as it is", () => {
  for (const l of ["== heading", "* item", "- item", "1. item", "// comment", ":name: value", "NOTE: x", "[source]", "<<<", "'''", ".Title"]) {
    assert(lead(l).startsWith("{empty}"), l);
  }
  assertEquals(lead("an ordinary line"), "an ordinary line");
});

proves(["0003-formats-asciidoc FR-004"], "codeAdoc keeps the text and fence is longer than any run of hyphens in it", () => {
  assertEquals(codeAdoc("x"), "`+x+`");
  assertEquals(fence("a\n------\nb"), "-------");
  fc.assert(
    fc.property(fc.array(fc.nat(12), { maxLength: 5 }), (ns) => {
      const t = ns.map((n) => "-".repeat(n)).join("\n");
      const longest = Math.max(0, ...t.split("\n").filter((x) => /^-{4,}\s*$/.test(x)).map((x) => x.trim().length));
      return fence(t).length >= 4 && fence(t).length > longest;
    }),
  );
});
