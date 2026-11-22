/**
 * The look of the site (docs 0001-docs FR-035 to FR-042): the stylesheet and the script ask for nothing of another host, the typefaces are files of the site with their licenses beside them, NOTICE credits Fumadocs and carries its license, the stylesheet is the one Tailwind CSS made of the classes the pages use (every class a page uses has its rule, and the record says which versions and which pages it was made from), the reading area is white and every pair of tokens that carries text has a contrast of 4.5 to 1 in both themes (computed from the stylesheet), the page has the layout of the reference, the components have its markup, and the width of the layout is the reader's choice, kept in a cookie.
 * Not tested here: how the pages look on a screen, or the measurements against the live reference. The first is judged by a person from screenshots; the second is made by hand with a browser, and this suite holds that the record of it is whole and that every difference in it is explained (FR-042).
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { fs, path } from "@intellectual-frontiers/system";
import { document, neighbours } from "../src/emit/html.ts";
import type { Page } from "../src/model.ts";
import { ROOT } from "./helpers.ts";

const theme = path.join(ROOT, "commons/docs/src/theme");
const fumadocs = await fs.readTextFile(path.join(theme, "fumadocs.css"));
const own = await fs.readTextFile(path.join(theme, "site.css"));
const js = await fs.readTextFile(path.join(theme, "site.js"));
const provenance = JSON.parse(await fs.readTextFile(path.join(theme, "fumadocs.provenance.json"))) as Record<string, unknown>;

/** The text of the block of the stylesheet that starts at the first match of the pattern, up to its closing brace. */
function block(css: string, start: RegExp): string {
  const at = css.search(start);
  assert(at >= 0, `${start} is in the stylesheet`);
  const open = css.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return css.slice(open + 1, i);
  }
  throw new Error(`${start} is not closed`);
}

/** The colour tokens of a block, `--color-fd-name: value`. */
const tokens = (text: string): Map<string, string> => new Map([...text.matchAll(/--color-fd-([a-z-]+):\s*([^;]+);/g)].map((m) => [m[1] ?? "", (m[2] ?? "").trim()] as const));
const light0 = tokens(block(fumadocs, /:root, :host \{/));
const dark0 = new Map([...light0, ...tokens(block(fumadocs, /^\.dark \{/m))]);
const white = tokens(block(own, /:root:not\(\.dark\) \{/));
const light = new Map([...light0, ...white]);
const dark = dark0;

/** A `#rrggbb` or `#rrggbbaa` colour as red, green, blue and alpha. */
function rgba(hex: string): [number, number, number, number] {
  assert(/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(hex), `${hex} is a hexadecimal colour`);
  const n = (i: number): number => Number.parseInt(hex.slice(i, i + 2), 16);
  return [n(1), n(3), n(5), hex.length === 9 ? n(7) / 255 : 1];
}
/** A colour drawn over another: the first, where it has an alpha, mixed with the second. */
function over(top: string, under: string): [number, number, number] {
  const [r, g, b, a] = rgba(top);
  const u = rgba(under);
  return [r * a + u[0] * (1 - a), g * a + u[1] * (1 - a), b * a + u[2] * (1 - a)];
}
const luminance = (c: readonly number[]): number => {
  const ch = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (ch[0] ?? 0) + 0.7152 * (ch[1] ?? 0) + 0.0722 * (ch[2] ?? 0);
};
const contrast = (a: readonly number[], b: readonly number[]): number => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return ((x ?? 0) + 0.05) / ((y ?? 0) + 0.05);
};

/** The pairs that carry text: the text token and the token it is drawn on (the page's background under both, for a token with an alpha). */
const PAIRS: readonly (readonly [string, string])[] = [
  ["foreground", "background"], ["muted-foreground", "background"], ["primary", "background"],
  ["foreground", "card"], ["muted-foreground", "card"], ["card-foreground", "card"], ["primary", "card"],
  ["muted-foreground", "muted"], ["foreground", "muted"],
  ["popover-foreground", "popover"], ["muted-foreground", "popover"],
  ["secondary-foreground", "secondary"], ["muted-foreground", "secondary"],
  ["primary-foreground", "primary"],
  ["accent-foreground", "accent"], ["muted-foreground", "accent"],
];

proves(["0001-docs FR-036"], "the reading area is white in the light theme and the reference's in the dark, and every pair of tokens that carries text has a contrast of at least 4.5 to 1 in both themes", () => {
  assertEquals(light.get("background"), "#ffffff");
  assertEquals(light0.get("background"), "#f5f5f5", "the reference's reading area is the departure");
  assertEquals(dark.get("background"), "#121212");
  for (const [name, set] of [["light", light], ["dark", dark]] as const) {
    const page = set.get("background") ?? "#ffffff";
    for (const [fg, bg] of PAIRS) {
      const a = set.get(fg);
      const b = set.get(bg);
      assert(a !== undefined && b !== undefined, `${name}: ${fg} and ${bg} are tokens`);
      const under = [...over(b ?? page, page)];
      const text = over(a ?? page, `#${under.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`);
      const c = contrast(text, under);
      assert(c >= 4.5, `${name}: ${fg} ${a} on ${bg} ${b} has a contrast of ${c.toFixed(2)}, under 4.5`);
    }
  }
});

import { FIXTURE_PAGES as pages, FIXTURE_SITE as site } from "../tools/fumadocs-fixture.ts";
const html = document(pages[1] as Page, site);

/** The classes the pages and the script use. */
const used = new Set<string>();
for (const m of html.replace(/<svg[\s\S]*?<\/svg>/g, (svg) => (svg.includes("lucide") ? svg : "")).matchAll(/ class="([^"]*)"/g)) for (const t of (m[1] ?? "").split(/\s+/)) if (t !== "") used.add(t);
for (const m of js.matchAll(/(?:class="([^"]*)"|className\s*=\s*"([^"]*)"|const (?:OPTION|SELECTED) = "([^"]*)")/g)) for (const t of (m[1] ?? m[2] ?? m[3] ?? "").replace(/\$\{[^}]*\}/g, " ").split(/\s+/)) if (t !== "") used.add(t);
for (const m of js.matchAll(/classList\.(?:toggle|add|remove)\("([^"]+)"/g)) used.add(m[1] ?? "");
/** Classes that are marks and have no rule: Lucide's, the reference's `group`, `not-prose`, `shiki` and its themes, `line`, the home page's. */
const MARKS = /^(lucide.*|group|group\/heading|not-prose|shiki|shiki-themes|catppuccin-latte|catppuccin-mocha|line|ui|home|long|expanded|dark|lang-.*)$/;
const escaped = (token: string): string => token.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);

proves(["0001-docs FR-036"], "every class a page and the script use has its rule in the stylesheet, and the stylesheet is the one the tool made: its digest and the versions it was made with are in the provenance file", async () => {
  const missing = [...used].filter((t) => !MARKS.test(t) && !fumadocs.includes(`.${escaped(t)}`) && !own.includes(`.${escaped(t)}`));
  assertEquals(missing, [], "a class of a page has no rule: run tools/fumadocs-css.mjs after a change of the markup");
  assertEquals((provenance["stylesheetSha256"] as string), [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(fumadocs)))].map((b) => b.toString(16).padStart(2, "0")).join(""), "the stylesheet is not the one the tool made: do not edit it, run the tool");
  const packages = provenance["packages"] as Record<string, string>;
  assertEquals(packages["fumadocs-ui"], "16.19.7");
  assert(/^\d+\.\d+\.\d+$/.test(packages["tailwindcss"] ?? ""), "the version of Tailwind CSS is recorded");
  assertStringIncludes(fumadocs, `tailwindcss v${packages["tailwindcss"]} | MIT License`);
  assertStringIncludes(fumadocs, "fumadocs-ui 16.19.7");
});

proves(["0001-docs FR-035"], "the stylesheets and the script ask for nothing of another host; the typefaces are files of the site with their licenses beside them; NOTICE credits Fumadocs with its license and the notices list the fonts, the theme and the icons", async () => {
  for (const [name, text] of [["fumadocs.css", fumadocs], ["site.css", own], ["site.js", js]] as const) {
    assert(!/https?:\/\//.test(text.replace(/\/\*[\s\S]*?\*\//g, "")), `${name} names another host`);
    assert(!/@import|googleapis|gstatic|cdn\./.test(text.replace(/\/\*[\s\S]*?\*\//g, "")), `${name} imports something`);
  }
  assertStringIncludes(own, 'url("fonts/inter-latin-wght-normal.woff2")');
  assertStringIncludes(own, 'url("fonts/jetbrains-mono-latin-wght-normal.woff2")');
  for (const f of ["inter-latin-wght-normal.woff2", "jetbrains-mono-latin-wght-normal.woff2"]) assert((await fs.stat(path.join(theme, "fonts", f))).size > 10_000, f);
  for (const f of ["Inter-OFL.txt", "JetBrainsMono-OFL.txt"]) assertStringIncludes(await fs.readTextFile(path.join(theme, "fonts", f)), "SIL OPEN FONT LICENSE Version 1.1");
  const notice = await fs.readTextFile(path.join(ROOT, "NOTICE"));
  for (const s of ["Fumadocs", "Copyright (c) 2023 Fuma", "Permission is hereby granted, free of charge", "fumadocs-ui 16.19.7", "Tailwind CSS", "Lucide", "Catppuccin"]) assertStringIncludes(notice, s);
  const notices = await fs.readTextFile(path.join(ROOT, "THIRD_PARTY_NOTICES.md"));
  for (const s of ["inter-latin-wght-normal.woff2", "jetbrains-mono-latin-wght-normal.woff2", "commons/docs/src/theme/fumadocs.css", "commons/docs/src/emit/shell.ts", "commons/docs/src/emit/icons.ts"]) assertStringIncludes(notices, s);
  for (const dep of ["tailwindcss", "fumadocs-ui", "@tailwindcss/cli", "fumadocs-core"]) {
    for (const manifest of ["commons/docs/package.json", "commons/docs/library.ts"]) assert(!(await fs.readTextFile(path.join(ROOT, manifest))).includes(`"${dep}"`), `${manifest} depends on ${dep}`);
  }
});

proves(["0001-docs FR-037"], "a page has the layout of the reference: the grid, the side navigation with the name and version and the selector of sections, the panel with its header, the article of the reference's width beside the outline, the trail, and the previous and the next page, with no width of its own", () => {
  for (const s of ['id="fd-spacious-layout"', 'id="nd-sidebar"', 'id="nd-page-panel"', 'id="nd-page"', 'id="nd-toc"', 'id="nd-subnav"', "[--fd-page-width:760px]", "md:layout:[--fd-sidebar-width:268px]", "layout:[--fd-toc-width:--spacing(76)]", "max-w-(--fd-page-width)", "md:px-[max(--spacing(6),calc((100%-var(--fd-page-width)-var(--fd-toc-width))/2))]", "data-sections", "data-search-full", "data-drawer-open", "On this page", 'aria-label="Breadcrumb"']) assertStringIncludes(html, s);
  assertStringIncludes(html, 'data-version title="The newest version on the package registry, published 2026-11-10">v1.2.3</span>');
  assertStringIncludes(html, 'rel="prev" href="a.html"');
  assertStringIncludes(html, 'rel="next" href="c.html"');
  assertStringIncludes(html, 'href="../specs/index.html"');
  assertEquals(neighbours(pages, pages[0] as Page).previous, undefined);
  assertEquals(neighbours(pages, pages[2] as Page).next, undefined);
  assert(!/1400/.test(html + own + js), "no width of the layout other than the reference's");
  for (const s of ["max-md:hidden", "md:hidden", "@max-5xl:invisible", "min-h-(--fd-layout-height)"]) assertStringIncludes(fumadocs, `.${escaped(s)}`);
  assertStringIncludes(fumadocs, "268px");
  assertStringIncludes(js, "nd-sidebar-mobile");
  assertStringIncludes(js, "toggleFolder");
});

proves(["0001-docs FR-038"], "the components are the reference's, with its markup: callouts of the reference's three colours, tabs, cards, code with a title bar or a corner button, a table in its wrapper, a file tree, and motion, focus and print are held", () => {
  for (const s of ["--callout-color:var(--color-fd-info", "--callout-color:var(--color-fd-warning", "--callout-color:var(--color-fd-error", 'role="tablist"', 'role="tabpanel"', 'data-card="true"', 'class="grid grid-cols-2 gap-3 @container"', "shiki-themes catppuccin-latte catppuccin-mocha", "--shiki-light-bg:#eff1f5", '<figcaption class="flex-1 truncate">a.ts</figcaption>', "absolute top-2 right-2 z-2", "data-copy", 'class="relative overflow-auto prose-no-margin my-6', 'data-table-filter', "rounded-md border bg-fd-card p-2", "Copy Anchor Link", "text-[1.75em] font-semibold"]) assertStringIncludes(html, s);
  assertStringIncludes(html, '<span class="line"><span style="--shiki-dark:');
  assertStringIncludes(own, "prefers-reduced-motion");
  for (const s of ["focus-visible:ring-2", "motion-reduce:transition-none", "print:h-auto"]) assertStringIncludes(fumadocs, `.${escaped(s)}`);
  const print = own.slice(own.indexOf("@media print"));
  for (const hidden of ["#nd-sidebar", "#nd-subnav", "#nd-toc", "[data-toc-popover]", "nav[aria-label=\"Previous and next page\"]"]) assertStringIncludes(print, hidden);
  assertStringIncludes(print, "#fd-spacious-layout { display: block; height: auto; overflow: visible");
});

proves(["0001-docs FR-040"], "the width of the layout is the reader's choice: a button drawn like the theme's with an accessible name and its state, a cookie of the site kept for a year and read by the head's script before the page is drawn, and a page that works where cookies are blocked", () => {
  assertStringIncludes(html, 'data-width-toggle=""');
  assertStringIncludes(html, 'aria-label="Full width" aria-pressed="false"');
  assertStringIncludes(html, 'data-theme-toggle=""');
  // the head's script reads the cookie before the stylesheet is requested, and each part is guarded
  const head = html.slice(0, html.indexOf("fumadocs.css"));
  assertStringIncludes(head, "ifc-docs-width");
  assertStringIncludes(head, 'dataset.width="full"');
  assertEquals((head.match(/catch\(e\)/g) ?? []).length, 2, "the theme and the width are each guarded");
  for (const s of ["ifc-docs-width=${full ? \"full\" : \"default\"}", "Path=${base()}", "Max-Age=31536000", "SameSite=Lax", 'location.protocol === "https:" ? "; Secure" : ""', "document.cookie", "catch {"]) assertStringIncludes(js, s);
  assertStringIncludes(js, 'e.key === "w"');
  assertStringIncludes(own, 'html[data-width="full"] #fd-spacious-layout { --fd-page-width: 100vw; }');
  assertStringIncludes(own, 'html[data-width="full"] #nd-page { max-width: none; }');
  assertStringIncludes(fumadocs, `.${escaped("in-data-[width=full]:bg-fd-accent")}`);
});

proves(["0001-docs FR-041"], "the provenance file records the packages and the live pages the stylesheet was made from, the departures and the blocks the reference has no component for", () => {
  const reference = provenance["reference"] as { package: string; live: { site: string; read: string; pages: string[] } };
  assertStringIncludes(reference.package, "fumadocs-ui 16.19.7");
  assert(reference.live.pages.length >= 5 && /^\d{4}-\d{2}-\d{2}$/.test(reference.live.read), "the live pages and the day they were read");
  const departures = provenance["departures"] as string[];
  assert(departures.some((d) => d.includes("white")) && departures.some((d) => d.includes("grayscale")), "the white reading area and the neutral accent are listed");
  const none = provenance["noEquivalent"] as string[];
  for (const kind of ["badges", "tiles", "entries", "diagrams", "trend"]) assert(none.some((n) => n.includes(kind)), `${kind} has no component in the reference and is listed`);
  assertStringIncludes(JSON.stringify(provenance["additions"]), "layout");
});

proves(["0001-docs FR-042"], "the record of the measurements against the reference is whole: the regions, the widths and the themes it covers, and an explanation for every difference it holds", async () => {
  const record = JSON.parse(await fs.readTextFile(path.join(theme, "fumadocs.measurements.json"))) as { widths: number[]; schemes: string[]; regions: string[]; equal: number; differences: { region: string; property: string; reference: string; ours: string; explanation: string }[] };
  assertEquals(record.widths, [1440, 1920]);
  assertEquals(record.schemes, ["light", "dark"]);
  for (const region of ["sidebar", "header", "article", "toc", "searchButton", "navLink", "h1", "codeFigure", "callout", "th", "td", "pagerLink", "searchDialog"]) assert(record.regions.includes(region), `${region} is measured`);
  assert(record.equal > 200, "most of what is measured is equal to the reference's");
  for (const d of record.differences) assert(d.explanation.trim().length > 20, `${d.region} ${d.property} differs and says why`);
});
