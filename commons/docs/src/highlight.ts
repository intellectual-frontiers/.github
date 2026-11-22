// Spec: 0001-docs FR-001
/**
 * Code highlighted when the site is built (commons 0011-documentation FR-017, FR-037), so that a page needs no script to colour it: Shiki, with the grammars of the languages the site shows (TypeScript, SQL, shell, TOML, JSON,
 * Turtle and YAML) and one theme for the light scheme and one for the dark (the two of the Fumadocs theme's default, Catppuccin Latte and Mocha), on the Oniguruma engine (WebAssembly, so the same on Bun and Node, with no native part). Each coloured run is a span whose two colours
 * are custom properties (`--l`, `--d`), which the stylesheet picks between by the same rule as the rest of the site's colours; a run in the theme's own foreground is plain text. Text and diagrams are not coloured.
 *
 * @example
 * ```ts
 * import { highlightedHtml } from "./highlight.ts";
 * highlightedHtml("const a = 1;", "ts");
 * // '<span class="t" style="--l:#8839EF;--d:#CBA6F7">const</span> a <span ...'
 * ```
 *
 * @module
 */
import type { HighlighterCore } from "shiki/core";
import { highlight as sqlSpans, type SpanKind } from "@intellectual-frontiers/lang-sql/aide/text";
import { dialect as postgres } from "@intellectual-frontiers/lang-sql/dialects/postgres";
import type { Lang } from "./model.ts";

/** The themes of the two schemes. */
export const THEMES = { light: "catppuccin-latte", dark: "catppuccin-mocha" } as const;

/** The grammar each language of the site is read with; those not here are left plain. */
const GRAMMAR: Readonly<Partial<Record<Lang, string>>> = { ts: "typescript", sql: "sql", sh: "shellscript", toml: "toml", json: "json", turtle: "turtle", yaml: "yaml" };

/** Shiki, with the Oniguruma engine (WebAssembly, the same on Bun and Node) and the themes it is read with, loaded once when the module is read; reading code with it is then synchronous. */
type Loaded = { readonly highlighter: HighlighterCore; readonly foreground: { readonly light: string; readonly dark: string } };

/**
 * Loads Shiki with `import()` (0036-distribution FR-033): it is an optional peer of the package, so a consumer that builds no site installs none of it, and every entry of the package imports without it. Where it is absent the code of a page is shown plain, with one warning that
 * names the package and the range to install; a site is still made.
 */
async function load(): Promise<Loaded | undefined> {
  try {
    const [core, engine, json, shellscript, sql, toml, turtle, typescript, yaml, catppuccinMocha, catppuccinLatte] = await Promise.all([
      import("shiki/core"),
      import("shiki/engine/oniguruma"),
      import("shiki/langs/json.mjs"),
      import("shiki/langs/shellscript.mjs"),
      import("shiki/langs/sql.mjs"),
      import("shiki/langs/toml.mjs"),
      import("shiki/langs/turtle.mjs"),
      import("shiki/langs/typescript.mjs"),
      import("shiki/langs/yaml.mjs"),
      import("shiki/themes/catppuccin-mocha.mjs"),
      import("shiki/themes/catppuccin-latte.mjs"),
    ]);
    const highlighter = await core.createHighlighterCore({
      themes: [catppuccinLatte.default, catppuccinMocha.default],
      langs: [typescript.default, sql.default, shellscript.default, toml.default, json.default, turtle.default, yaml.default],
      engine: engine.createOnigurumaEngine(import("shiki/wasm")),
    });
    return {
      highlighter,
      foreground: { light: catppuccinLatte.default.colors?.["editor.foreground"]?.toLowerCase() ?? "#4c4f69", dark: catppuccinMocha.default.colors?.["editor.foreground"]?.toLowerCase() ?? "#cdd6f4" },
    };
  } catch (e) {
    console.warn(`docs: shiki is not installed (or cannot be loaded: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}), so the code of the site is shown plain: install shiki at >=4.5.0 <5.0.0 beside the package to colour it`);
    return undefined;
  }
}

const loaded = await load();

/** Code longer than this many characters is shown plain: a computed type of thousands of characters costs more to colour than it helps a reader, and the page folds it. */
export const LONGEST_COLOURED = 6000;

// The first reading of a grammar by the engine can give runs that are not cut at its tokens (a comment left in the text before it). A reading of each grammar here, whose result is not used, makes the readings that are
// used the same whatever came first; the test of the highlighter holds this.
for (const [lang, sample] of loaded === undefined ? [] : [["typescript", 'const a = f("x"); // c'], ["sql", "SELECT 1 -- c"], ["shellscript", 'echo "$A" # c'], ["toml", '[a]\nb = "x" # c'], ["json", '{"a": [1, true, null]}'], ["turtle", 'a:b a c:D ; d:e "f"@en .'], ["yaml", "a: 1\nb: [x] # c"]] as const) {
  for (const theme of [THEMES.light, THEMES.dark]) loaded?.highlighter.codeToTokensBase(sample, { lang, theme });
}

const escapeHtml = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The colours that are the themes' own text, which are left as plain text. */
const FOREGROUND = loaded?.foreground ?? { light: "#4c4f69", dark: "#cdd6f4" };

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

/** The colours of the kinds of SQL token, those of the Catppuccin themes' own for the same kinds in the other languages (a name, a quoted name, an operator and a mark of punctuation are the themes' own text). */
const SQL_COLOURS: Readonly<Partial<Record<SpanKind, { readonly light: string; readonly dark: string; readonly italic?: true }>>> = {
  keyword: { light: "#8839EF", dark: "#CBA6F7" },
  function: { light: "#1E66F5", dark: "#89B4FA" },
  number: { light: "#FE640B", dark: "#FAB387" },
  string: { light: "#40A02B", dark: "#A6E3A1" },
  param: { light: "#E64553", dark: "#EBA0AC" },
  comment: { light: "#7C7F93", dark: "#9399B2" },
};

/**
 * SQL read by the lexer of the SQL language library (0001-docs FR-024), in the PostgreSQL dialect (dollar quotes, `::` casts and `$1` parameters, and the keywords of the one most used), so that a word is a keyword where the dialect says so and a word in a string or a
 * comment is none; or `undefined` where the lexer cannot read the text (a stray character, a string that is not closed), which Shiki then colours as it always did.
 */
function sqlRuns(code: string): readonly (readonly Run[])[] | undefined {
  const spans = sqlSpans(code, postgres);
  if (spans.some((s) => s.kind === "error")) return undefined;
  const lines: Run[][] = [[]];
  const put = (text: string, kind: SpanKind | undefined): void => {
    const colour = kind === undefined ? undefined : SQL_COLOURS[kind];
    for (const [i, part] of text.split("\n").entries()) {
      if (i > 0) lines.push([]);
      if (part === "") continue;
      const line = lines[lines.length - 1];
      const run: Run = colour === undefined ? { text: part, italic: false, bold: false } : { text: part, light: colour.light, dark: colour.dark, italic: false, bold: false };
      const last = line?.[line.length - 1];
      if (line !== undefined && last !== undefined && last.light === run.light && last.dark === run.dark) line[line.length - 1] = { ...last, text: last.text + run.text };
      else line?.push(run);
    }
  };
  let at = 0;
  for (const s of spans) {
    if (s.start > at) put(code.slice(at, s.start), undefined);
    put(code.slice(s.start, s.end), s.kind);
    at = s.end;
  }
  if (at < code.length) put(code.slice(at), undefined);
  return lines;
}

/** The runs of the lines of code, by line, in the language given; one plain run for a language that is not coloured. */
export function runs(code: string, lang: Lang): readonly (readonly Run[])[] {
  const grammar = GRAMMAR[lang];
  if (grammar === undefined || loaded === undefined || code.length > LONGEST_COLOURED) return code.split("\n").map((line) => [{ text: line, italic: false, bold: false }]);
  if (lang === "sql") {
    const read = sqlRuns(code);
    if (read !== undefined) return read;
  }
  const lines = loaded.highlighter.codeToTokensWithThemes(code, { lang: grammar, themes: THEMES });
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

/** The two themes' own text colours and backgrounds, for the variables of a code block (the dark first, as Shiki writes them). */
export const BLOCK_VARIABLES = "--shiki-dark:#cdd6f4;--shiki-light:#4c4f69;--shiki-dark-bg:#1e1e2e;--shiki-light-bg:#eff1f5";

/**
 * Code as the lines of a code block of the Fumadocs theme (FR-038): each line is a `span.line`, and each coloured run a span whose two colours are the variables `--shiki-light` and `--shiki-dark` (and their font styles), which the stylesheet picks
 * between by the theme of the page, so that one drawing serves both themes. A run in the themes' own text is plain text.
 */
export function highlightedLines(code: string, lang: Lang): string {
  return runs(code, lang)
    .map((line) =>
      `<span class="line">${
        line
          .map((r) => {
            if (r.light === undefined && r.dark === undefined && !r.italic && !r.bold) return escapeHtml(r.text);
            const style = `--shiki-dark:${r.dark ?? FOREGROUND.dark};--shiki-light:${r.light ?? FOREGROUND.light}${
              r.italic ? ";--shiki-light-font-style:italic;--shiki-dark-font-style:italic" : ""
            }${r.bold ? ";font-weight:bold" : ""}`;
            return `<span style="${style}">${escapeHtml(r.text)}</span>`;
          })
          .join("")
      }</span>`
    )
    .join("\n");
}
