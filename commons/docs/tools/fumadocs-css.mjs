// The development tool that makes `src/theme/fumadocs.css` (docs 0001-docs FR-036, FR-041). It is not a dependency of the library, of its package or of its build: it installs Tailwind CSS and the
// Fumadocs UI package into a scratch directory, once, reads the classes the pages of a built site use, and writes the plain CSS Tailwind makes of them, with the tokens, the base and the
// typography of the reference. Run it by hand after the markup (`src/emit/shell.ts`, `src/emit/html.ts`, `src/theme/site.js`) changes:
//
//   bun src/main.ts build --out /tmp/site        # the pages whose classes are read
//   bun tools/fumadocs-fixture.ts /tmp/sample    # a page of every kind of block, whose classes are read too
//   node tools/fumadocs-css.mjs /tmp/site /tmp/sample   # writes src/theme/fumadocs.css and fumadocs.provenance.json
//
// `bun run verify` finds that the classes of the pages and the stylesheet agree (suite/theme.test.ts), without Tailwind.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PIN = { "fumadocs-ui": "16.19.7", tailwindcss: "4.3.5", "@tailwindcss/cli": "4.3.5" };
const sources = process.argv.slice(2).map((d) => path.resolve(d));
if (sources.length === 0 || !sources.every((d) => fs.existsSync(d))) throw new Error("usage: node tools/fumadocs-css.mjs SITE_DIRECTORY [SAMPLE_DIRECTORY...]");
const here = path.dirname(new URL(import.meta.url).pathname);
const theme = path.join(here, "..", "src", "theme");
const work = process.env.FUMADOCS_CSS_WORK ?? fs.mkdtempSync(path.join(os.tmpdir(), "fumadocs-css-"));
fs.mkdirSync(work, { recursive: true });
if (!fs.existsSync(path.join(work, "node_modules", "tailwindcss"))) {
  fs.writeFileSync(path.join(work, "package.json"), JSON.stringify({ name: "scratch", private: true }));
  execFileSync("npm", ["install", "--no-audit", "--no-fund", "--ignore-scripts", "--legacy-peer-deps", ...Object.entries(PIN).map(([n, v]) => `${n}@${v}`)], { cwd: work, stdio: "inherit" });
}

// the classes: every token of every class attribute of every page, and every quoted string of the script
const tokens = new Set();
const take = (text) => text.split(/\s+/).filter((t) => t !== "").forEach((t) => tokens.add(t));
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
for (const file of sources.flatMap(walk).filter((f) => f.endsWith(".html"))) for (const m of fs.readFileSync(file, "utf8").matchAll(/ class="([^"]*)"/g)) take(m[1]);
take(fs.readFileSync(path.join(theme, "site.js"), "utf8").replace(/["'`]/g, " "));
fs.writeFileSync(path.join(work, "classes.html"), `<div class="${[...tokens].sort().join(" ").replaceAll('"', "")}"></div>\n`);

// the input: the reference's tokens, base, shiki rules and typography, with the one variant its released layouts lack (the spacious layout's)
const pkg = path.join(work, "node_modules", "fumadocs-ui", "css");
let base = fs.readFileSync(path.join(pkg, "lib", "base.css"), "utf8");
const variant = /#nd-docs-layout:has\(> &\),\s*#nd-notebook-layout:has\(> &\),\s*#nd-home-layout:has\(> &\),\s*#nd-flux-layout:has\(> &\),\s*#fd-glass-layout:has\(> &\)/;
if (!variant.test(base)) throw new Error("the layout variant of fumadocs-ui's base.css is not as this tool expects");
base = base.replace(variant, "#fd-spacious-layout:has(> &, > * > &, > * > * > &)");
fs.writeFileSync(path.join(work, "base.css"), base.replaceAll("@utility fd-steps", "@utility fd-steps"));
const tones = "background foreground muted muted-foreground popover popover-foreground card card-foreground border primary primary-foreground secondary secondary-foreground accent accent-foreground ring overlay info warning error success idea".split(" ");
fs.writeFileSync(
  path.join(work, "input.css"),
  `@import "tailwindcss";
@import "./node_modules/fumadocs-ui/css/neutral.css";
@import "./base.css";
@import "./node_modules/fumadocs-ui/css/lib/shiki.css";
@plugin "./node_modules/fumadocs-ui/dist/tailwind/typography.js";
@source "./classes.html";
@source inline("text-fd-{${tones.join(",")}}");
@theme {
  --font-sans: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
  --animate-fd-roll-in: fd-roll-in 0.32s cubic-bezier(0.22, 1, 0.36, 1);
  @keyframes fd-roll-in { 0% { opacity: 0; translate: 0 calc(var(--fd-roll, 1) * 0.6em); filter: blur(2px); } }
}
`,
);
const out = path.join(work, "out.css");
execFileSync(path.join(work, "node_modules", ".bin", "tailwindcss"), ["-i", path.join(work, "input.css"), "-o", out], { cwd: work, stdio: "inherit" });
// the reference's own stylesheet is minified by Lightning CSS, which writes the colours of its tokens as hexadecimal numbers (rounded to a byte); this tool writes them the same way, so that a token is the same byte
const hex = (h, s, l, a) => {
  const k = (n) => (n + h / 30) % 12;
  const f = (n) => l - (s * Math.min(l, 1 - l)) * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const b = (x) => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${b(f(0))}${b(f(8))}${b(f(4))}${a >= 1 ? "" : b(a)}`;
};
const asHex = (css) =>
  css.replace(/(--color-fd-[a-z-]+:\s*)hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*([\d.]+)(%?)\s*)?\)/g, (_, name, h, s, l, a, pct) =>
    `${name}${hex(+h, +s / 100, +l / 100, a === undefined ? 1 : pct === "%" ? +a / 100 : +a)}`);
const css = asHex(fs.readFileSync(out, "utf8"));
const header = `/*
 * The stylesheet of the Fumadocs documentation theme (MIT, Copyright (c) 2023 Fuma), made by \`tools/fumadocs-css.mjs\` with Tailwind CSS ${PIN.tailwindcss} from the classes the pages use,
 * the tokens, base, code and typography of fumadocs-ui ${PIN["fumadocs-ui"]}, and the variant and the animation that the live documentation shows and that package lacks (see
 * \`fumadocs.provenance.json\`). It is generated: change the pages' classes and run the tool, never this file.
 */
`;
fs.writeFileSync(path.join(theme, "fumadocs.css"), header + css);
const provenancePath = path.join(theme, "fumadocs.provenance.json");
const prior = fs.existsSync(provenancePath) ? JSON.parse(fs.readFileSync(provenancePath, "utf8")) : {};
fs.writeFileSync(
  provenancePath,
  `${JSON.stringify({ ...prior, packages: { "fumadocs-ui": PIN["fumadocs-ui"], tailwindcss: PIN.tailwindcss }, classes: tokens.size, stylesheetSha256: createHash("sha256").update(header + css).digest("hex") }, null, 2)}\n`,
);
console.log(`fumadocs.css: ${(header + css).length} bytes from ${tokens.size} classes`);
