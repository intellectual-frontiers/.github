/**
 * The look of the site (docs 0001-docs FR-035 to FR-038): the stylesheet and the script ask for nothing of another host, the typefaces are files of the site with their licenses beside them, NOTICE credits the design, the reading area is white, every pair of tokens that carries text has a contrast of 4.5 to 1 in both themes (computed from the stylesheet), and a page has the trail, the outline, the previous and the next page and the foot.
 * Not tested here: how the pages look on a screen. The screenshots of the pages are made by hand with a browser and judged by a person.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { fs, path } from "@intellectual-frontiers/system";
import { document, neighbours } from "../src/emit/html.ts";
import type { Page } from "../src/model.ts";
import { ROOT } from "./helpers.ts";

const theme = path.join(ROOT, "commons/docs/src/theme");
const css = await fs.readTextFile(path.join(theme, "site.css"));
const js = await fs.readTextFile(path.join(theme, "site.js"));

/** The tokens of a block of the stylesheet, as `--name: value`. */
function tokens(block: string): Map<string, string> {
  return new Map([...block.matchAll(/(--[a-z-]+):\s*([^;]+);/g)].map((m) => [m[1] ?? "", (m[2] ?? "").trim()] as const));
}
const light = tokens(css.slice(css.indexOf(":root {"), css.indexOf(':root[data-theme="dark"]')));
const darkStart = css.indexOf(':root[data-theme="dark"]');
const dark = new Map([...light, ...tokens(css.slice(darkStart, css.indexOf("@media (prefers-color-scheme: dark)")))]);
const systemDark = new Map([...light, ...tokens(css.slice(css.indexOf("@media (prefers-color-scheme: dark)"), css.indexOf("*, *::before")))]);

function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (ch[0] ?? 0) + 0.7152 * (ch[1] ?? 0) + 0.0722 * (ch[2] ?? 0);
}
const contrast = (a: string, b: string): number => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return ((x ?? 0) + 0.05) / ((y ?? 0) + 0.05);
};

/** The pairs that carry text: the text token, and the token it is drawn on. */
const PAIRS: readonly (readonly [string, string])[] = [
  ["--text", "--page"], ["--muted", "--page"], ["--faint", "--page"], ["--link", "--page"],
  ["--text", "--chrome"], ["--muted", "--chrome"], ["--faint", "--chrome"], ["--link", "--chrome"],
  ["--code-text", "--code-bg"], ["--link", "--code-bg"], ["--faint", "--code-bg"],
  ["--text", "--current"], ["--text", "--hover"], ["--muted", "--hover"],
  ["--good-text", "--good-bg"], ["--warn-text", "--warn-bg"], ["--info-text", "--info-bg"], ["--bad-text", "--bad-bg"],
  ["--muted", "--stripe"], ["--text", "--row-hover"],
];

proves(["0001-docs FR-036"], "the reading area is white in the light theme and every pair of tokens that carries text has a contrast of at least 4.5 to 1 in both themes and in the system's dark", () => {
  assertEquals(light.get("--page"), "#ffffff");
  for (const [name, theme_] of [["light", light], ["dark", dark], ["system dark", systemDark]] as const) {
    for (const [fg, bg] of PAIRS) {
      const a = theme_.get(fg);
      const b = theme_.get(bg);
      assert(a !== undefined && /^#[0-9a-f]{6}$/i.test(a) && b !== undefined && /^#[0-9a-f]{6}$/i.test(b), `${name}: ${fg} and ${bg} are six-digit hex tokens`);
      const c = contrast(a ?? "#000000", b ?? "#ffffff");
      assert(c >= 4.5, `${name}: ${fg} ${a} on ${bg} ${b} has a contrast of ${c.toFixed(2)}, under 4.5`);
    }
  }
  assertEquals([...dark].filter(([k, v]) => k.startsWith("--") && systemDark.get(k) !== v && /^#/.test(v) && k !== "--top-bg").map(([k]) => k), [], "the dark theme chosen and the system's dark are the same");
});

proves(["0001-docs FR-035"], "the stylesheet and the script ask for nothing of another host; the typefaces are files of the site with their licenses beside them; NOTICE credits the design and the notices list the fonts", async () => {
  for (const [name, text] of [["site.css", css], ["site.js", js]] as const) {
    assert(!/https?:\/\//.test(text.replace(/\/\*[\s\S]*?\*\//g, "")), `${name} names another host`);
    assert(!/@import|googleapis|gstatic|cdn\./.test(text), `${name} imports something`);
  }
  assertStringIncludes(css, 'url("fonts/inter-latin-wght-normal.woff2")');
  assertStringIncludes(css, 'url("fonts/jetbrains-mono-latin-wght-normal.woff2")');
  for (const f of ["inter-latin-wght-normal.woff2", "jetbrains-mono-latin-wght-normal.woff2"]) assert((await fs.stat(path.join(theme, "fonts", f))).size > 10_000, f);
  for (const f of ["Inter-OFL.txt", "JetBrainsMono-OFL.txt"]) assertStringIncludes(await fs.readTextFile(path.join(theme, "fonts", f)), "SIL OPEN FONT LICENSE Version 1.1");
  assertStringIncludes(await fs.readTextFile(path.join(ROOT, "NOTICE")), "Fumadocs");
  const notices = await fs.readTextFile(path.join(ROOT, "THIRD_PARTY_NOTICES.md"));
  assertStringIncludes(notices, "inter-latin-wght-normal.woff2");
  assertStringIncludes(notices, "jetbrains-mono-latin-wght-normal.woff2");
});

const pages: Page[] = ["a", "b", "c"].map((n, i) => ({ path: `s/${n}.html`, title: n.toUpperCase(), description: n, section: "specs", group: "Group", order: i, blocks: [{ kind: "heading", level: 2, id: "one", text: [{ kind: "text", text: "One" }] }, { kind: "heading", level: 2, id: "two", text: [{ kind: "text", text: "Two" }] }] }));

proves(["0001-docs FR-037"], "a page has the trail above its title, the outline in a column and as a disclosure, and the previous and the next page below it, in the order of the side navigation", () => {
  const html = document(pages[1] as Page, { name: "N", repository: "r", pages });
  assertStringIncludes(html, '<nav class="crumbs" aria-label="Breadcrumb"><a href="../specs/index.html">Specifications</a><span aria-hidden="true">/</span><span>Group</span></nav>');
  assertStringIncludes(html, '<nav class="toc" aria-label="On this page">');
  assertStringIncludes(html, '<details class="toc-mobile">');
  assertStringIncludes(html, 'rel="prev" href="a.html"');
  assertStringIncludes(html, 'rel="next" href="c.html"');
  assertEquals(neighbours(pages, pages[0] as Page).previous, undefined);
  assertEquals(neighbours(pages, pages[2] as Page).next, undefined);
  assertStringIncludes(css, "grid-template-columns: var(--side) minmax(0, 1fr) var(--toc)");
  assertStringIncludes(css, "--layout: 1400px");
  assertStringIncludes(css, "@media (max-width: 1099px)");
  assertStringIncludes(css, ".nav-group[open] > summary::before");
});

proves(["0001-docs FR-038"], "the components and the habits of the reader are in the stylesheet: callouts of three tones, tables whose header stays, tiles, reduced motion, a visible focus and a print style that leaves out the chrome", () => {
  for (const s of [".callout-note", ".callout-limit", ".callout-warn", ".stats", ".stat-value", ".card-link", ".tab-list", ".copy", "position: sticky", "max-height: min(72vh", "prefers-reduced-motion", ":focus-visible", "@media print", ".pager"]) assertStringIncludes(css, s);
  const print = css.slice(css.indexOf("@media print"));
  for (const hidden of [".top", ".sidebar", ".toc", ".toc-mobile", ".pager"]) assertStringIncludes(print, hidden);
});
