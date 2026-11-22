/**
 * The theme of the site (commons 0011-documentation FR-034): the dark theme follows the system and can be chosen, with every colour a token; the theme is set before the page is drawn; the shortcuts and the print style are there.
 *
 * @module
 */
import { assert, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { fs, path } from "@intellectual-frontiers/system";
import { document } from "../src/emit/html.ts";
import type { Page } from "../src/model.ts";

const dir = path.join(path.dirname(path.fromFileUrl(import.meta.url)), "..", "src", "theme");

proves(["0011-documentation FR-034"], "every page sets the theme before it is drawn and has the theme button; the stylesheets have the dark tokens and a print style; the script switches the theme and has the shortcuts", async () => {
  const page: Page = { path: "index.html", title: "T", description: "D", section: "overview", group: "G", order: 0, blocks: [{ kind: "paragraph", inlines: [{ kind: "text", text: "x" }] }] };
  const html = document(page, { name: "N", repository: "r", pages: [page] });
  assert(html.indexOf("localStorage.getItem(\"theme\")") < html.indexOf("fumadocs.css"), "the theme is set before the stylesheet is read");
  assertStringIncludes(html, 'classList.add("dark")');
  assertStringIncludes(html, 'prefers-color-scheme: dark');
  assertStringIncludes(html, "data-theme-toggle");
  const css = await fs.readTextFile(path.join(dir, "fumadocs.css"));
  assertStringIncludes(css, "\n.dark {");
  assertStringIncludes(css, "--color-fd-background: #121212");
  const own = await fs.readTextFile(path.join(dir, "site.css"));
  assertStringIncludes(own, "@media print");
  const js = await fs.readTextFile(path.join(dir, "site.js"));
  for (const needed of ["toggleTheme", 'e.key === "t"', 'e.key === "["', 'e.key === "/"', "localStorage.setItem"]) assertStringIncludes(js, needed);
});
