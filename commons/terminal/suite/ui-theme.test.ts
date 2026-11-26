/**
 * Tests of colour depth, emoji, the icons and the theme (commons terminal 0002-ui FR-025), and of the purity of the library (FR-024).
 *
 * @module
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { capabilitiesOf, drawScreen, frameOf, ICONS, iconCell, iconOf, lineMarkOf, renderSelect, selectStart, tint, type IconName, type ScreenState } from "../src/ui.ts";
import { createScreen } from "../src/vt.ts";
import { displayWidth } from "../src/width.ts";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { bare } from "./ui-helpers.ts";

const tty = { isTTY: true, columns: 100, rows: 30 };

proves(["0002-ui FR-025"], "the colour depth from the environment, with no flag", () => {
  const depth = (env: Record<string, string>, stream = tty) => capabilitiesOf(env, stream).colourDepth;
  assertEquals(depth({ COLORTERM: "truecolor" }), "truecolor");
  assertEquals(depth({ COLORTERM: "24bit" }), "truecolor");
  assertEquals(depth({ WT_SESSION: "x" }), "truecolor");
  assertEquals(depth({ TERM: "xterm-256color" }), "256");
  assertEquals(depth({ TERM: "xterm" }), "16");
  assertEquals(depth({ TERM: "xterm", FORCE_COLOR: "3" }), "truecolor");
  assertEquals(depth({ TERM: "xterm", FORCE_COLOR: "2" }), "256");
  assertEquals(depth({ COLORTERM: "truecolor", FORCE_COLOR: "0" }), "none");
  assertEquals(depth({ COLORTERM: "truecolor", NO_COLOR: "1" }), "none");
  assertEquals(depth({ COLORTERM: "truecolor", TERM: "dumb" }), "none");
  assertEquals(depth({ COLORTERM: "truecolor", CI: "true" }), "none");
  assertEquals(depth({ COLORTERM: "truecolor" }, { isTTY: false, columns: 100, rows: 30 }), "none");
  const c = capabilitiesOf({ FORCE_COLOR: "0" }, tty);
  assertEquals([c.colour, c.colourDepth], [false, "none"]);
});

proves(["0002-ui FR-025"], "emoji from a UTF-8 locale or a known terminal, never on linux, dumb, CI or a pipe", () => {
  const emoji = (env: Record<string, string>, stream = tty) => capabilitiesOf(env, stream).emoji;
  assertEquals(emoji({ LANG: "en_US.UTF-8" }), true);
  assertEquals(emoji({ WT_SESSION: "x" }), true);
  assertEquals(emoji({ TERM_PROGRAM: "vscode" }), true);
  assertEquals(emoji({ TERM: "xterm-kitty" }), true);
  assertEquals(emoji({ TERM: "alacritty" }), true);
  assertEquals(emoji({ TERM: "linux", LANG: "en_US.UTF-8" }), false);
  assertEquals(emoji({ TERM: "dumb", LANG: "en_US.UTF-8" }), false);
  assertEquals(emoji({ CI: "1", LANG: "en_US.UTF-8" }), false);
  assertEquals(emoji({ LANG: "en_US.UTF-8" }, { isTTY: false, columns: 100, rows: 30 }), false);
});

proves(["0002-ui FR-025"], "one table of icons: every emoji two columns, every ASCII three, every cell three", () => {
  for (const [name, icon] of Object.entries(ICONS)) {
    assertEquals(displayWidth(icon.emoji), 2, `${name} emoji`);
    assertEquals(displayWidth(icon.ascii), 3, `${name} ascii`);
    assertEquals(displayWidth(iconCell(name as IconName, { emoji: true })), 3);
    assertEquals(displayWidth(iconCell(name as IconName, { emoji: false })), 3);
  }
  assertEquals(iconOf("done", { emoji: false }), "[x]");
  assertEquals(ICONS.done.emoji, "✅");
});

proves(["0002-ui FR-025"], "the theme is dressed at the depth, and not at all without colour", () => {
  assertEquals(tint("error", "x", { colour: false }), "x");
  assert(tint("selection", "x", { colour: true, colourDepth: "truecolor" }).includes("48;2;"));
  assert(tint("selection", "x", { colour: true, colourDepth: "256" }).includes("48;5;"));
  assert(tint("selection", "x", { colour: true, colourDepth: "16" }).includes("44;"));
  assertEquals(bare(tint("accent", "x", { colour: true, colourDepth: "256" })), "x");
});

const plan = ["Check the host", "Compare the fingerprint", "Install the key", "Probe the host", "Record the result", "Finish"].map((title, i) => ({ id: `p${i}`, title }));
const state: ScreenState = { title: "Enroll", plan, done: new Set(["p0"]), skipped: new Set(["p2"]), failed: new Set(["p3"]), current: "p1", pane: ["[you] x"], status: "s", keys: "k", typing: false };

proves(["0002-ui FR-025"], "emoji marks on the emulator keep the columns aligned: the bar of the left column is at one column on every row", () => {
  for (const emoji of [false, true]) {
    const drawn = drawScreen(state, { columns: 60, rows: 12 }, { colour: true, colourDepth: "truecolor", emoji });
    for (const l of drawn.lines) assertEquals(displayWidth(l), 60);
    const s = createScreen({ width: 60, height: 12 });
    s.write(frameOf(drawn));
    const bar = (row: number): number => {
      for (let c = 0; c < 60; c++) if (s.cell(row, c)?.text === "|") return c;
      return -1;
    };
    for (let r = 2; r <= 6; r++) assertEquals(bar(r), bar(1), `row ${r} emoji ${emoji}`);
    assert(bar(1) > 0);
    const text = s.lines().join("\n");
    assertEquals(emoji ? text.includes("✅") && text.includes("❌") && text.includes("⏭") : text.includes("[x]") && text.includes("[!]"), true);
  }
});

proves(["0002-ui FR-025"], "a select item with an icon aligns at both modes, and the chosen row has the selection background in colour", () => {
  const items = ["one", "two"].map((label, i) => ({ id: `synthetic-item-${i}`, label, icon: "host" as const }));
  for (const emoji of [false, true]) {
    const d = renderSelect(selectStart(items, 1), { columns: 30, rows: 3 }, { colour: true, colourDepth: "truecolor", emoji });
    for (const l of d.lines) assertEquals(displayWidth(l), 30);
    assert(d.lines[1]?.includes("48;2;") === true && d.lines[0]?.includes("48;2;") === false);
    const plain = d.lines.map(bare);
    assertEquals(plain[0]?.indexOf("one"), plain[1]?.indexOf("two"));
  }
});

proves(["0002-ui FR-024"], "the sources of the ui import only core, the palette, the width and its own files, and name no domain", () => {
  const dir = fileURLToPath(new URL("../src/", import.meta.url));
  const files = readdirSync(dir).filter((f) => /^ui.*\.ts$/.test(f));
  assert(files.length >= 10);
  const allowed = (spec: string): boolean => spec === "@intellectual-frontiers/core" || spec === "./palette.ts" || spec === "./width.ts" || /^\.\/ui[a-z-]*\.ts$/.test(spec);
  for (const f of files) {
    const text = readFileSync(`${dir}${f}`, "utf8");
    const specs = [...text.matchAll(/(?:^|\n)\s*(?:import|export)\b[^;]*?\bfrom\s+"([^"]+)"/g)].map((m) => m[1] ?? "");
    for (const s of specs) assert(allowed(s), `${f} imports ${s}`);
    assert(!/opsfolio|erga/i.test(text.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")), `${f} names a domain`);
  }
});

proves(["0002-ui FR-026"], "the line mark is the emoji, else the icon's ASCII tag, else its three-column ASCII", () => {
  const tags = { done: "[ok]", failed: "[x]", warn: "[!]", skipped: "[skip]", action: "[you]", hint: "->", stop: "[stop]", working: "[todo]" } as const;
  for (const [name, tag] of Object.entries(tags)) {
    assertEquals(lineMarkOf(name as IconName, { emoji: false }), tag);
    assertEquals(lineMarkOf(name as IconName, { emoji: true }), ICONS[name as IconName].emoji);
  }
  assertEquals(lineMarkOf("host", { emoji: false }), "[#]");
  for (const name of Object.keys(ICONS)) assertEquals(displayWidth(lineMarkOf(name as IconName, { emoji: true })), 2, name);
});
