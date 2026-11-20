// Spec: 0001-docs FR-001
/**
 * Code highlighted when the site is built (commons 0011-documentation FR-017, FR-037), so that a page needs no script to colour it: Shiki, with the grammars of the languages the site shows (TypeScript, SQL, shell, TOML, JSON,
 * Turtle and YAML) and one theme for the light scheme and one for the dark, on the Oniguruma engine (WebAssembly, so the same on Bun and Node, with no native part). Each coloured run is a span whose two colours
 * are custom properties (`--l`, `--d`), which the stylesheet picks between by the same rule as the rest of the site's colours; a run in the theme's own foreground is plain text. Text and diagrams are not coloured.
 *
 * @example
 * ```ts
 * import { highlightedHtml } from "./highlight.ts";
 * highlightedHtml("const a = 1;", "ts");
 * // '<span class="t" style="--l:#D73A49;--d:#F97583">const</span> a <span ...'
 * ```
 *
 * @module
 */
import { createHighlighterCore } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";
import json from "shiki/langs/json.mjs";
import shellscript from "shiki/langs/shellscript.mjs";
import sql from "shiki/langs/sql.mjs";
import toml from "shiki/langs/toml.mjs";
import turtle from "shiki/langs/turtle.mjs";
import typescript from "shiki/langs/typescript.mjs";
import yaml from "shiki/langs/yaml.mjs";
import githubDark from "shiki/themes/github-dark.mjs";
import githubLight from "shiki/themes/github-light.mjs";
import type { Lang } from "./model.ts";

/** The themes of the two schemes. */
export const THEMES = { light: "github-light", dark: "github-dark" } as const;

/** The grammar each language of the site is read with; those not here are left plain. */
const GRAMMAR: Readonly<Partial<Record<Lang, string>>> = { ts: "typescript", sql: "sql", sh: "shellscript", toml: "toml", json: "json", turtle: "turtle", yaml: "yaml" };

/** Shiki, with the Oniguruma engine (WebAssembly, the same on Bun and Node) made once when the module is read; reading code with it is then synchronous. */
const highlighter = await createHighlighterCore({ themes: [githubLight, githubDark], langs: [typescript, sql, shellscript, toml, json, turtle, yaml], engine: createOnigurumaEngine(import("shiki/wasm")) });

/** Code longer than this many characters is shown plain: a computed type of thousands of characters costs more to colour than it helps a reader, and the page folds it. */
export const LONGEST_COLOURED = 6000;

// The first reading of a grammar by the engine can give runs that are not cut at its tokens (a comment left in the text before it). A reading of each grammar here, whose result is not used, makes the readings that are
// used the same whatever came first; the test of the highlighter holds this.
for (const [lang, sample] of [["typescript", 'const a = f("x"); // c'], ["sql", "SELECT 1 -- c"], ["shellscript", 'echo "$A" # c'], ["toml", '[a]\nb = "x" # c'], ["json", '{"a": [1, true, null]}'], ["turtle", 'a:b a c:D ; d:e "f"@en .'], ["yaml", "a: 1\nb: [x] # c"]] as const) {
  for (const theme of [THEMES.light, THEMES.dark]) highlighter.codeToTokensBase(sample, { lang, theme });
}

const escapeHtml = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The colours that are the themes' own text, which are left as plain text. */
const FOREGROUND = { light: githubLight.colors?.["editor.foreground"]?.toLowerCase() ?? "#24292e", dark: githubDark.colors?.["editor.foreground"]?.toLowerCase() ?? "#e1e4e8" };

/** One coloured run of code. */
export interface Run {
  readonly text: string;
  /** Its colour in the light scheme and in the dark, or none where it is the theme's own text. */
  readonly light?: string;
  readonly dark?: string;
  /** Italic, bold. */
  readonly italic: boolean;
  readonly bold: boolean;
}

/** The runs of the lines of code, by line, in the language given; one plain run for a language that is not coloured. */
export function runs(code: string, lang: Lang): readonly (readonly Run[])[] {
  const grammar = GRAMMAR[lang];
  if (grammar === undefined || code.length > LONGEST_COLOURED) return code.split("\n").map((line) => [{ text: line, italic: false, bold: false }]);
  const lines = highlighter.codeToTokensWithThemes(code, { lang: grammar, themes: THEMES });
  return lines.map((line) => {
    const out: Run[] = [];
    for (const t of line) {
      const l = t.variants["light"];
      const d = t.variants["dark"];
      const plain = (l?.color ?? "").toLowerCase() === FOREGROUND.light && (d?.color ?? "").toLowerCase() === FOREGROUND.dark && ((l?.fontStyle ?? 0) | (d?.fontStyle ?? 0)) === 0;
      const run: Run = plain
        ? { text: t.content, italic: false, bold: false }
        : { text: t.content, ...(l?.color === undefined ? {} : { light: l.color }), ...(d?.color === undefined ? {} : { dark: d.color }), italic: (((l?.fontStyle ?? 0) | (d?.fontStyle ?? 0)) & 1) !== 0, bold: (((l?.fontStyle ?? 0) | (d?.fontStyle ?? 0)) & 2) !== 0 };
      const last = out[out.length - 1];
      if (last !== undefined && last.light === run.light && last.dark === run.dark && last.italic === run.italic && last.bold === run.bold) out[out.length - 1] = { ...last, text: last.text + run.text };
      else out.push(run);
    }
    return out;
  });
}

/** Code as HTML: coloured runs as spans with their two colours, the rest as escaped text. */
export function highlightedHtml(code: string, lang: Lang): string {
  return runs(code, lang)
    .map((line) =>
      line
        .map((r) =>
          r.light === undefined && r.dark === undefined
            ? escapeHtml(r.text)
            : `<span class="t${r.italic ? " i" : ""}${r.bold ? " b" : ""}" style="--l:${r.light ?? "inherit"};--d:${r.dark ?? "inherit"}">${escapeHtml(r.text)}</span>`
        )
        .join("")
    )
    .join("\n");
}
