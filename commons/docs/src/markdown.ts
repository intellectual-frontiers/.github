// Spec: 0001-docs FR-001
/**
 * The Markdown of TSDoc and of specifications, read into the page model (commons 0011-documentation FR-016): paragraphs, headings, lists
 * (nested by indentation), emphasis, code, fenced code with its language, links, autolinks and tables, and TSDoc's `{@link name}`.
 * Anything else is kept as its text. Where a link goes, what `{@link}` names and which words are a citation of a specification are the
 * caller's to say, through an `InlineContext`, so that this module knows nothing of the site.
 *
 * @example
 * ```ts
 * import { markdown, plainContext } from "./markdown.ts";
 * markdown("Some `code` and a [link](https://example.com).", plainContext);
 * // [{ kind: "paragraph", inlines: [text "Some ", code "code", text " and a ", link, text "."] }]
 * ```
 *
 * @module
 */
import type { Block, Href, Inline, Lang } from "./model.ts";
import { plain, slugOf } from "./model.ts";

/** What the reader asks of its caller: where a link goes, what `{@link}` names, and the citations in a run of text. */
export interface InlineContext {
  /** Where a Markdown link's destination goes. */
  readonly href: (raw: string) => Href;
  /** The inlines `{@link name}` (or `{@link name | label}`) becomes. */
  readonly link: (name: string, label: string | undefined) => readonly Inline[];
  /** A run of text with its citations made links. */
  readonly cite: (text: string) => readonly Inline[];
}

/** A context that links nothing it does not have to: destinations as given, `{@link}` as code, no citations. */
export const plainContext: InlineContext = {
  href: (raw) => ({ kind: "external", url: raw }),
  link: (name, label) => [{ kind: "code", text: label ?? name }],
  cite: (t) => [{ kind: "text", text: t }],
};

/** The language a fence names, as the highlighter knows it. */
export function langOf(info: string): Lang {
  switch (info.trim().split(/\s+/)[0]?.toLowerCase() ?? "") {
    case "ts":
    case "typescript":
    case "js":
    case "javascript":
    case "tsx":
      return "ts";
    case "sql":
      return "sql";
    case "sh":
    case "bash":
    case "shell":
    case "console":
      return "sh";
    case "toml":
      return "toml";
    case "json":
    case "json5":
    case "jsonc":
      return "json";
    case "ttl":
    case "turtle":
      return "turtle";
    case "yaml":
    case "yml":
      return "yaml";
    case "mermaid":
      return "mermaid";
    default:
      return "text";
  }
}

const FENCE = /^(\s*)(`{3,}|~{3,})(.*)$/;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const BULLET = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const TABLE_RULE = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;

/** The cells of a table's row. */
function cells(line: string): string[] {
  const t = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const out: string[] = [];
  let cur = "";
  let tick = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i] ?? "";
    if (c === "\\" && t[i + 1] === "|") {
      cur += "|";
      i++;
    } else if (c === "`") {
      tick = !tick;
      cur += c;
    } else if (c === "|" && !tick) {
      out.push(cur.trim());
      cur = "";
    } else cur += c;
  }
  out.push(cur.trim());
  return out;
}

/**
 * The blocks of a Markdown text.
 *
 * @param source - the text
 * @param ctx - where links go and what is a citation
 */
export function markdown(source: string, ctx: InlineContext): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  const used = new Map<string, number>();
  const anchor = (t: string): string => {
    const base = slugOf(t) || "section";
    const n = used.get(base) ?? 0;
    used.set(base, n + 1);
    return n === 0 ? base : `${base}-${n}`;
  };
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (line.trim() === "") {
      i++;
      continue;
    }
    const fence = FENCE.exec(line);
    if (fence !== null) {
      const marker = fence[2] ?? "```";
      const indent = (fence[1] ?? "").length;
      const body: string[] = [];
      i++;
      while (i < lines.length && !(lines[i] ?? "").trim().startsWith(marker)) {
        const l = lines[i] ?? "";
        body.push(l.slice(Math.min(indent, l.length - l.trimStart().length)));
        i++;
      }
      i++;
      const lang = langOf(fence[3] ?? "");
      // a Mermaid fence is a diagram, drawn when the site is built (commons 0011-documentation FR-037); its source stays on the page
      blocks.push(lang === "mermaid" ? { kind: "diagram", source: body.join("\n"), caption: "" } : { kind: "code", lang, text: body.join("\n") });
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading !== null) {
      const depth = (heading[1] ?? "#").length;
      const inl = inlines(heading[2] ?? "", ctx);
      const level = depth <= 2 ? 2 : depth === 3 ? 3 : 4;
      blocks.push({ kind: "heading", level, id: anchor(plain(inl)), text: inl });
      i++;
      continue;
    }
    if (line.trimStart().startsWith("|") && TABLE_RULE.test(lines[i + 1] ?? "")) {
      const head = cells(line).map((c) => inlines(c, ctx));
      i += 2;
      const rows: Inline[][][] = [];
      while (i < lines.length && (lines[i] ?? "").trimStart().startsWith("|")) {
        rows.push(cells(lines[i] ?? "").map((c) => inlines(c, ctx)));
        i++;
      }
      blocks.push({ kind: "table", head, rows });
      continue;
    }
    const bullet = BULLET.exec(line);
    if (bullet !== null) {
      const base = (bullet[1] ?? "").length;
      const ordered = /\d/.test(bullet[2] ?? "");
      const items: Block[][] = [];
      while (i < lines.length) {
        const b = BULLET.exec(lines[i] ?? "");
        if (b === null || (b[1] ?? "").length !== base) break;
        const body = [b[3] ?? ""];
        i++;
        while (i < lines.length) {
          const l = lines[i] ?? "";
          if (l.trim() === "") {
            const next = lines[i + 1] ?? "";
            if (next.length - next.trimStart().length > base && next.trim() !== "") {
              body.push("");
              i++;
              continue;
            }
            break;
          }
          const ind = l.length - l.trimStart().length;
          if (ind <= base && (BULLET.test(l) || FENCE.test(l) || HEADING.test(l))) break;
          if (ind <= base && !BULLET.test(l)) {
            body.push(l.trim());
            i++;
            continue;
          }
          body.push(l.slice(Math.min(ind, base + 2)));
          i++;
        }
        items.push(markdown(body.join("\n"), ctx));
      }
      blocks.push({ kind: "list", ordered, items });
      continue;
    }
    const para: string[] = [];
    while (i < lines.length) {
      const l = lines[i] ?? "";
      if (l.trim() === "" || FENCE.test(l) || HEADING.test(l) || BULLET.test(l)) break;
      if (l.trimStart().startsWith("|") && TABLE_RULE.test(lines[i + 1] ?? "")) break;
      para.push(l.trim());
      i++;
    }
    blocks.push({ kind: "paragraph", inlines: inlines(para.join(" "), ctx) });
  }
  return blocks;
}

/**
 * The inlines of a run of Markdown: code spans, strong and emphasis, links, autolinks, `{@link}`, and escapes.
 *
 * @param source - the run
 * @param ctx - where links go and what is a citation
 */
export function inlines(source: string, ctx: InlineContext): Inline[] {
  const out: Inline[] = [];
  let buf = "";
  const flush = (): void => {
    if (buf !== "") out.push(...ctx.cite(buf));
    buf = "";
  };
  let i = 0;
  while (i < source.length) {
    const c = source[i] ?? "";
    const rest = source.slice(i);
    if (c === "\\" && i + 1 < source.length && /[\\`*_{}[\]()#+\-.!|<>~]/.test(source[i + 1] ?? "")) {
      buf += source[i + 1] ?? "";
      i += 2;
      continue;
    }
    if (c === "`") {
      const ticks = /^`+/.exec(rest)?.[0] ?? "`";
      const end = source.indexOf(ticks, i + ticks.length);
      if (end > 0) {
        flush();
        let code = source.slice(i + ticks.length, end);
        if (code.startsWith(" ") && code.endsWith(" ") && code.trim() !== "") code = code.slice(1, -1);
        out.push({ kind: "code", text: code });
        i = end + ticks.length;
        continue;
      }
    }
    const tsdoc = /^\{@link(?:code|plain)?\s+([^}|\s]+)\s*(?:\|\s*([^}]*))?\}/.exec(rest);
    if (tsdoc !== null) {
      flush();
      out.push(...ctx.link(tsdoc[1] ?? "", tsdoc[2]?.trim() || undefined));
      i += tsdoc[0].length;
      continue;
    }
    const auto = /^<(https?:\/\/[^\s>]+)>/.exec(rest);
    if (auto !== null) {
      flush();
      const url = auto[1] ?? "";
      out.push({ kind: "link", href: { kind: "external", url }, children: [{ kind: "text", text: url }] });
      i += auto[0].length;
      continue;
    }
    if (c === "[") {
      const close = matching(source, i);
      if (close > 0 && source[close + 1] === "(") {
        const end = source.indexOf(")", close + 2);
        if (end > 0) {
          flush();
          const dest = source.slice(close + 2, end).trim().split(/\s+/)[0] ?? "";
          out.push({ kind: "link", href: ctx.href(dest), children: inlines(source.slice(i + 1, close), { ...ctx, cite: plainContext.cite }) });
          i = end + 1;
          continue;
        }
      }
    }
    if (rest.startsWith("**") || rest.startsWith("__")) {
      const mark = rest.slice(0, 2);
      const end = source.indexOf(mark, i + 2);
      if (end > i + 2) {
        flush();
        out.push({ kind: "strong", children: inlines(source.slice(i + 2, end), ctx) });
        i = end + 2;
        continue;
      }
    }
    if ((c === "*" || c === "_") && /\S/.test(source[i + 1] ?? "") && !/[\p{L}\p{N}]/u.test(source[i - 1] ?? "")) {
      let end = i + 1;
      while (end < source.length) {
        end = source.indexOf(c, end);
        if (end < 0) break;
        if (/\S/.test(source[end - 1] ?? "") && !/[\p{L}\p{N}]/u.test(source[end + 1] ?? "")) break;
        end++;
      }
      if (end > i + 1) {
        flush();
        out.push({ kind: "emphasis", children: inlines(source.slice(i + 1, end), ctx) });
        i = end + 1;
        continue;
      }
    }
    buf += c;
    i++;
  }
  flush();
  return out;
}

/** Where the bracket that closes the one at `at` is, or -1. */
function matching(s: string, at: number): number {
  let depth = 0;
  for (let i = at; i < s.length; i++) {
    const c = s[i];
    if (c === "`") {
      const end = s.indexOf("`", i + 1);
      if (end > 0) i = end;
      continue;
    }
    if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}
