/**
 * Tests of `kernel/vt.ts`: the terminal emulator that snapshot tests read the console through, against what xterm shows for the same
 * bytes (commons 0001-terminal FR-005), with properties: plain text comes out wrapped at the width, and a cut line never wraps (FR-023).
 *
 * @module
 */
import fc from "fast-check";
import { createScreen, describeStyle, type Screen } from "../src/vt.ts";
import { cutToWidth, graphemes, graphemeWidth } from "../src/width.ts";
import { assertEquals, proves } from "@intellectual-frontiers/commons/ts/runtime/test";

const E = "\u001b";
const BEL = String.fromCharCode(7);

const styleAt = (s: Screen, row: number, col: number): string => {
  const c = s.cell(row, col);
  return c === undefined ? "outside" : describeStyle(c.style);
};

const runs = (s: Screen): readonly (readonly (readonly [string, string])[])[] =>
  s.styled().map((l) => l.map((r) => [r.text, describeStyle(r.style)] as const));

proves(["0001-terminal FR-005"], "carriage return, line feed, backspace and tab", () => {
  const s = createScreen({ width: 20 });
  s.write("hello\rj");
  assertEquals(s.text(), "jello");
  s.write("\nab\bX\tY");
  assertEquals(s.text(), "jello\naX      Y");
  assertEquals(s.cursor(), { row: 1, col: 9, visible: true });
  const lf = createScreen({ width: 10, newline: "lf" });
  lf.write("ab\ncd");
  assertEquals(lf.text(), "ab\n  cd", "a bare line feed only moves down");
  const crlf = createScreen({ width: 10 });
  crlf.write("ab\r\ncd\r\n");
  assertEquals(crlf.text(), "ab\ncd");
});

proves(["0001-terminal FR-005"], "cursor movement and erase in line and in display redraw a live region in place", () => {
  const s = createScreen({ width: 30 });
  s.write("done one\nrunning two 1s\nrunning three 0s\n");
  s.write(`${E}[2A${E}[2Krunning two 2s\n${E}[2K✅ three\n`);
  assertEquals(s.text(), "done one\nrunning two 2s\n✅ three");
  s.write(`${E}[3A${E}[J`);
  assertEquals(s.text(), "", "erase below from the first line clears it all");
  s.write("abcdef");
  s.write(`${E}[3D${E}[K`);
  assertEquals(s.text(), "abc");
  s.write(`${E}[1G${E}[1C${E}[1K`);
  assertEquals(s.text(), "  c", "erase to the left includes the cursor's cell");
  s.write(`${E}[5Gx${E}[2K`);
  assertEquals(s.text(), "");
  s.write(`a\nb\nc${E}[2;2H${E}[1J`);
  assertEquals(s.text(), "\n\nc", "erase above, to the cursor");
  s.write(`${E}[2J`);
  assertEquals(s.text(), "");
  assertEquals(s.cursor().row, 1, "erase in display does not move the cursor");
  s.write(`${E}[10A${E}[200Cz`);
  assertEquals(s.text(), " ".repeat(29) + "z", "movement stops at the edges");
});

proves(["0001-terminal FR-005"], "colour sequences are kept apart from the text, cell by cell", () => {
  const s = createScreen({ width: 40 });
  s.write(`${E}[1;32m✅ ok${E}[0m plain ${E}[2mdim${E}[22m ${E}[38;5;208mo${E}[38;2;1;2;3mr${E}[39m ${E}[41;97mbg${E}[m`);
  assertEquals(s.text(), "✅ ok plain dim or bg");
  assertEquals(runs(s), [
    [
      ["✅ ok", "bold fg=2"],
      [" plain ", ""],
      ["dim", "dim"],
      [" ", ""],
      ["o", "fg=208"],
      ["r", "fg=#010203"],
      [" ", ""],
      ["bg", "fg=15 bg=1"],
    ],
  ]);
  assertEquals(s.cell(0, 0)?.width, 2);
  assertEquals([s.cell(0, 1)?.text, s.cell(0, 1)?.width, styleAt(s, 0, 1)], ["", 0, "bold fg=2"], "a wide character's continuation");
  assertEquals(s.cell(0, 40), undefined);
  assertEquals(s.cell(5, 0)?.text, " ");
  const styled = createScreen({ width: 10 });
  styled.write(`${E}[7m  ${E}[0m`);
  assertEquals(runs(styled), [[["  ", "inverse"]]], "styled spaces are kept");
  assertEquals(styled.text(), "");
});

proves(["0001-terminal FR-005"], "wide characters, emoji and combining marks by display width", () => {
  const s = createScreen({ width: 6 });
  s.write("✅ 测试");
  assertEquals(s.text(), "✅ 测\n试", "a wide character that does not fit wraps whole");
  const t = createScreen({ width: 10 });
  t.write("e\u{301}\u{26a0}\u{fe0f}x👨\u{200d}👩\u{200d}👧y");
  assertEquals(t.text(), "e\u{301}\u{26a0}\u{fe0f}x👨\u{200d}👩\u{200d}👧y");
  assertEquals(t.cursor().col, 7);
  t.write(`\r${E}[1C!`);
  assertEquals(t.text(), "e\u{301}! x👨\u{200d}👩\u{200d}👧y", "half a wide character overwritten blanks the other");
  const exact = createScreen({ width: 4 });
  exact.write("abcd\nefgh");
  assertEquals(exact.text(), "abcd\nefgh", "a full line then a line feed adds no empty line");
  exact.write("i");
  assertEquals(exact.text(), "abcd\nefgh\ni");
});

proves(["0001-terminal FR-005"], "a screen of a given height scrolls", () => {
  const s = createScreen({ width: 5, height: 2 });
  s.write("one\ntwo\nthree");
  assertEquals(s.lines(), ["two", "three"]);
  assertEquals(s.cursor(), { row: 1, col: 5 - 1, visible: true });
  s.write(`${E}[9B${E}[9A`);
  assertEquals(s.cursor().row, 0);
  assertEquals(s.cell(2, 0), undefined);
});

proves(["0001-terminal FR-005"], "cursor shown and hidden; OSC, unknown and split sequences ignored safely", () => {
  const s = createScreen({ width: 20 });
  s.write(`${E}[?25l`);
  assertEquals(s.cursor().visible, false);
  s.write(`${E}]0;a title${BEL}${E}]8;;https://example.com${E}\\link${E}]8;;${E}\\ ${E}[?2004h${E}[5n${E}[>c${E}P1$r${E}\\${E}(B${E}=`);
  s.write(`${E}[3`);
  s.write(`1mred${E}[0m${BEL}${E}[?25h`);
  assertEquals(s.text(), "link red");
  assertEquals(s.cursor().visible, true);
  assertEquals(styleAt(s, 0, 5), "fg=1", "a sequence split across writes");
  const bytes = new TextEncoder().encode("测✅");
  const b = createScreen({ width: 10 });
  b.write(bytes.slice(0, 2));
  b.write(bytes.slice(2, 5));
  b.write(bytes.slice(5));
  assertEquals(b.text(), "测✅", "UTF-8 split across writes");
  const save = createScreen({ width: 10 });
  save.write(`ab${E}7cd${E}8X${E}[s\n${E}[uY`);
  assertEquals(save.text(), "abXY");
});

/** Plain text wrapped at a width, as a terminal shows it: graphemes by display width, trailing spaces dropped. */
function wrapped(text: string, width: number): string {
  const out: string[] = [];
  for (const l of text.split("\n")) {
    let cur = "";
    let used = 0;
    for (const g of graphemes(l)) {
      const w = graphemeWidth(g);
      if (used + w > width) {
        out.push(cur);
        cur = "";
        used = 0;
      }
      cur += g;
      used += w;
    }
    out.push(cur);
  }
  const lines = out.map((l) => l.replace(/ +$/, ""));
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n");
}

const plainText = fc
  .array(fc.constantFrom("a", "b", " ", "测", "✅", "é", "e\u{301}", "\u{26a0}\u{fe0f}", "\n", "xyz"), { maxLength: 40 })
  .map((ps) => ps.join(""));

proves(["0001-terminal FR-005"], "plain text written to a screen reads back wrapped at its width (property)", () => {
  fc.assert(
    fc.property(plainText, fc.integer({ min: 2, max: 12 }), (text, width) => {
      const s = createScreen({ width });
      s.write(text);
      assertEquals(s.text(), wrapped(text, width));
    }),
  );
});

proves(["0001-terminal FR-004", "0001-terminal FR-005"], "a line cut to the width never wraps, and leaves no style on (property)", () => {
  const piece = fc.oneof(
    fc.constantFrom("a", " ", "测", "✅", "e\u{301}", "\u{26a0}\u{fe0f}", "word"),
    fc.constantFrom(`${E}[31m`, `${E}[1;42m`, `${E}[0m`, `${E}[38;5;0m`),
  );
  fc.assert(
    fc.property(fc.array(piece, { maxLength: 30 }), fc.integer({ min: 1, max: 20 }), (ps, width) => {
      const text = ps.join("");
      const cut = cutToWidth(text, width, "…");
      const exact = createScreen({ width });
      exact.write(cut);
      assertEquals(exact.cursor().row, 0, "nothing wrapped");
      const wide = createScreen({ width: width + 1 });
      wide.write(cut);
      const { col } = wide.cursor();
      wide.write("Z");
      if (cut !== text) assertEquals(styleAt(wide, 0, col), "", "the style is off after the cut");
    }),
  );
});
