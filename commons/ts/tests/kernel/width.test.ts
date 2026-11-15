/**
 * Tests of `kernel/width.ts`: display widths of wide characters, emoji and escape sequences, and texts cut to a width without splitting a
 * grapheme or an escape sequence, with properties over arbitrary text (commons 0006-signals FR-023).
 *
 * @module
 */
import fc from "fast-check";
import { plain } from "../../kernel/text.ts";
import { cutToWidth, displayWidth, graphemes, graphemeWidth, RESET, sgrParams, splitAtWidth, tokens } from "../../kernel/width.ts";
import { assert, assertEquals, proves } from "../../runtime/test.ts";

const E = "\u001b";

proves(["0006-signals FR-023"], "wide characters and emoji take two columns, marks and escape sequences none", () => {
  for (const two of [
    "✅",
    "❌",
    "\u{23ed}\u{fe0f}",
    "\u{23f9}\u{fe0f}",
    "\u{26a0}\u{fe0f}",
    "👉",
    "测",
    "Ａ",
    "한",
    "1\u{fe0f}\u{20e3}",
    "🇫🇷",
  ]) {
    assertEquals(displayWidth(two), 2, two);
  }
  assertEquals(displayWidth("👨\u{200d}👩\u{200d}👧"), 2, "a zero-width-joiner sequence is one glyph");
  assertEquals(displayWidth("👍🏽"), 2, "an emoji with a skin tone");
  assertEquals(displayWidth("\u{26a0}"), 1, "⚠ without the emoji selector is text");
  assertEquals(displayWidth("\u{231a}\u{fe0e}"), 1, "the text selector");
  assertEquals(displayWidth("e\u{301}"), 1, "a combining mark");
  assertEquals(displayWidth("\u{301}"), 0);
  assertEquals(displayWidth("ｱ"), 1, "halfwidth katakana");
  assertEquals(displayWidth("abc"), 3);
  assertEquals(displayWidth(`${E}[1;31mred${E}[0m`), 3);
  assertEquals(displayWidth(`${E}]8;;https://example.com${String.fromCharCode(7)}link${E}]8;;${E}\\`), 4, "an OSC hyperlink");
  assertEquals(displayWidth(`${E}[?25l${E}[2K${E}[1A`), 0);
  assertEquals(displayWidth(`a${String.fromCharCode(7)}b`), 2, "a control character");
  assertEquals(graphemes("e\u{301}x"), ["e\u{301}", "x"]);
  assertEquals(graphemeWidth(""), 0);
});

proves(["0006-signals FR-023"], "a line holding ✅ 测试 at a width of 6 is cut after 测", () => {
  assertEquals(displayWidth("✅ 测试"), 7);
  assertEquals(cutToWidth("✅ 测试", 6), "✅ 测");
  assertEquals(cutToWidth("✅ 测试", 7), "✅ 测试", "a text that fits is kept");
  assertEquals(cutToWidth("✅ 测试", 4), "✅ ", "a wide character never crosses the edge");
  assertEquals(cutToWidth("abcdef", 4, "…"), "abc…");
  assertEquals(cutToWidth("abcdef", 0, "…"), "", "an ellipsis that does not fit is left out");
  assertEquals(cutToWidth("abcdef", 3, "..."), "...");
});

proves(["0006-signals FR-023"], "escape sequences are kept whole, and a style open at the cut is reset", () => {
  assertEquals(cutToWidth(`${E}[31mfailed badly${E}[0m`, 7, "…"), `${E}[31mfailed…${RESET}`);
  assertEquals(cutToWidth(`${E}[1mab${E}[0mcdef`, 3), `${E}[1mab${E}[0mc`, "no reset where none is open");
  assertEquals(cutToWidth(`${E}[38;5;0mabcdef`, 2), `${E}[38;5;0mab${RESET}`, "a colour whose last parameter is 0 is still a colour");
  assertEquals(
    cutToWidth(`ab${E}]8;;https://example.com${String.fromCharCode(7)}cd`, 3),
    `ab${E}]8;;https://example.com${String.fromCharCode(7)}c`,
  );
  assertEquals(splitAtWidth(`ab${E}[31m`, 2), { head: `ab${E}[31m`, tail: "" });
  assertEquals(
    tokens(`a${E}[31mb`).map((t) => t.kind),
    ["text", "escape", "text"],
  );
  assertEquals(sgrParams(`${E}[1;38;2;1;2;3m`), [1, 38, 2, 1, 2, 3]);
  assertEquals(sgrParams(`${E}[m`), [0]);
  assertEquals(sgrParams(`${E}[2K`), undefined);
});

/** Text with graphemes of every width, and SGR, OSC and cursor sequences. */
const piece = fc.oneof(
  fc.string({ unit: "grapheme", maxLength: 4 }),
  fc.constantFrom("测", "✅", "\u{26a0}\u{fe0f}", "e\u{301}", "👨\u{200d}👩\u{200d}👧", " ", "ab"),
  fc.constantFrom(`${E}[31m`, `${E}[0m`, `${E}[1;32m`, `${E}[38;5;200m`, `${E}[2K`, `${E}]0;title${String.fromCharCode(7)}`),
);
const line = fc.array(piece, { maxLength: 12 }).map((ps) => ps.join(""));

proves(["0006-signals FR-023"], "a text cut fits its width, and its head and tail make the text and its width again (property)", () => {
  fc.assert(
    fc.property(line, fc.nat(30), (text, width) => {
      const cut = cutToWidth(text, width);
      assert(displayWidth(cut) <= width, `${JSON.stringify(cut)} is wider than ${width}`);
      assert(displayWidth(cutToWidth(text, width, "…")) <= width);
      const { head, tail } = splitAtWidth(text, width);
      assertEquals(head + tail, text);
      assertEquals(displayWidth(head) + displayWidth(tail), displayWidth(text));
      assert(displayWidth(head) <= width);
      const first = tokens(tail)[0];
      if (first !== undefined) {
        assertEquals(first.kind, "text", "the escape sequences before the cut stay in the head");
        assert(displayWidth(head) + graphemeWidth(graphemes(first.text)[0] ?? "") > width, "the head is the longest that fits");
      }
      assertEquals(
        tokens(text)
          .map((t) => t.text)
          .join(""),
        text,
      );
      assert(plain(text).startsWith(plain(cut).replace(/…$/, "")));
    }),
  );
});
