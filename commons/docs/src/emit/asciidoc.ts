// Spec: 0001-docs FR-008
/**
 * A page as AsciiDoc (docs 0001-docs FR-008): the writer of the book presentation. Like the HTML and the Markdown writers it matches every case of a
 * block and an inline with a `switch` that ends in `absurd`, so that a case added to the page model and left out here does not compile. What it writes
 * is the text of a chapter of a book of `erga` (`kind: book`): sections with anchors, source blocks, admonitions and tables, with no attribute, no include and no macro
 * that needs an extension, so that AsciidoctorJ makes the PDF, the EPUB and the web edition of it as it is.
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import type { Block, Card, Href, Inline, Page, TreeNode } from "../model.ts";
import { plain, slugOf } from "../model.ts";

/** What a page of a volume needs to know to write a link: which pages are in the volume, the anchors they hold, and where the rest of the site is. */
export interface AdocScope {
  /** The anchor of a page that is in the volume, by its path. */
  readonly pages: ReadonlyMap<string, string>;
  /** Every anchor the volume writes. */
  readonly anchors: ReadonlySet<string>;
  /** The address of the site, ending in `/`, where a link to a page that is not in the volume goes; none: the link is its text. */
  readonly site: string | undefined;
}

/** The anchor of a page in a volume: its path as words. */
export const pageAnchor = (volume: string, path: string): string => `${volume}-${slugOf(path.replace(/\.html$/, "").replaceAll("/", " "))}`;

/** The anchor of a part of a page: the page's anchor and the part's own (`--` between them). */
export const partAnchor = (page: string, anchor: string): string => `${page}--${slugOf(anchor)}`;

/** The anchor a part of a page is written with: its own the first time, and numbered where a page names two parts alike (an export and a type have one name), so that no anchor is in the volume twice. */
function claim(seen: Map<string, number>, page: string, anchor: string): string {
  const own = partAnchor(page, anchor);
  const n = (seen.get(own) ?? 0) + 1;
  seen.set(own, n);
  return n === 1 ? own : `${own}-${n}`;
}

/** Text that AsciiDoc would read as markup, or replace, is passed through with only its special characters made safe; any other text is as it is. */
const MARKUP = /[*_`#^~{}|+\\<>&]|--|\.\.\.|\(C\)|\(R\)|\(TM\)|\bhttps?:\/\//;

/** A square bracket as the attribute that holds its place: a bracket in text can close a macro, or (doubled) make an anchor, wherever it is written. */
const BRACKET: Readonly<Record<string, string>> = { "[": "{startsb}", "]": "{endsb}" };

/** A run of text with no bracket in it, safe for a paragraph, a list item or a cell. */
const safe = (t: string): string => (MARKUP.test(t) ? `pass:c[${t}]` : t);

/** A run of text for a paragraph, a list item or a cell. */
export function textAdoc(t: string): string {
  return /[[\]]/.test(t) ? t.split(/([[\]])/).map((x) => BRACKET[x] ?? (x === "" ? "" : safe(x))).join("") : safe(t);
}

/** What a line must not begin with, or AsciiDoc reads it as a list, a heading, a block title, a comment, an attribute or an admonition. */
const LEADS = /^\s*([-*>]\s|=+\s|\.[^\s.]|\.+\s|:[\w-]+:|\[|\d+\.\s|\/\/|(NOTE|TIP|IMPORTANT|WARNING|CAUTION):\s|<<<|'''|\+$)/;

/** A line of text that begins safely: `{empty}` holds the place of what AsciiDoc would read as markup. */
export const lead = (line: string): string => (LEADS.test(line) ? `{empty}${line}` : line);

/** Code in a line: its text is passed through as it is, brackets apart. */
function codeAdoc(t: string): string {
  const one = (x: string): string => (/[+`\\]/.test(x) ? `pass:c[${x}]` : `+${x}+`);
  return `\`${/[[\]]/.test(t) ? t.split(/([[\]])/).map((x) => BRACKET[x] ?? (x === "" ? "" : one(x))).join("") : one(t)}\``;
}

const hrefAdoc = (h: Href, scope: AdocScope, text: string): string => {
  if (h.kind === "external") return `link:${h.url.replaceAll("[", "%5B").replaceAll("]", "%5D")}[${text}]`;
  const page = scope.pages.get(h.path);
  if (page !== undefined) {
    const anchor = h.anchor === undefined ? undefined : partAnchor(page, h.anchor);
    return `xref:${anchor !== undefined && scope.anchors.has(anchor) ? anchor : page}[${text}]`;
  }
  if (scope.site === undefined) return text;
  return `link:${scope.site}${h.path}${h.anchor === undefined ? "" : `#${h.anchor}`}[${text}]`;
};

/** Inlines as AsciiDoc. */
export function inlinesAdoc(xs: readonly Inline[], scope: AdocScope): string {
  return xs
    .map((i): string => {
      switch (i.kind) {
        case "text":
          return textAdoc(i.text);
        case "code":
          return codeAdoc(i.text);
        case "emphasis":
          return `__${inlinesAdoc(i.children, scope)}__`;
        case "strong":
          return `**${inlinesAdoc(i.children, scope)}**`;
        case "link":
          return hrefAdoc(i.href, scope, inlinesAdoc(i.children, scope));
        default:
          return absurd(i);
      }
    })
    .join("");
}

const cell = (xs: readonly Inline[], scope: AdocScope): string => inlinesAdoc(xs, scope).replaceAll("|", "\\|").replaceAll("\n", " ");

const marks = (n: number, c: string): string => c.repeat(n);

/** A section marker: `==` for a chapter, never more than six `=`. */
const mark = (level: number): string => "=".repeat(Math.max(1, Math.min(6, level)));

function cardsAdoc(cs: readonly Card[], scope: AdocScope, depth: number): string[] {
  return cs.flatMap((c) => [
    `${marks(depth + 1, "*")} ${hrefAdoc(c.href, scope, textAdoc(c.title))}${c.badges === undefined || c.badges.length === 0 ? "" : ` (${c.badges.map((b) => textAdoc(b.text)).join(", ")})`}: ${inlinesAdoc(c.text, scope)}`,
    ...cardsAdoc(c.children ?? [], scope, depth + 1),
  ]);
}

const treeAdoc = (ns: readonly TreeNode[], scope: AdocScope, depth: number): string[] =>
  ns.flatMap((n) => [`${marks(depth + 1, "*")} ${codeAdoc(n.label)}${n.note === undefined ? "" : `: ${inlinesAdoc(n.note, scope)}`}`, ...treeAdoc(n.children, scope, depth + 1)]);

/** The fence of a source block: longer than any line of dashes the text holds. */
function fence(t: string): string {
  const longest = Math.max(3, ...[...t.matchAll(/^-{4,}\s*$/gm)].map((m) => m[0].trim().length));
  return "-".repeat(longest + 1);
}

/** What a page's blocks are written as: where it is (its anchor, for the parts it names) and the marker of its chapter. */
export interface AdocPage {
  /** The page's anchor. */
  readonly anchor: string;
  /** The marker's length of the page's own title: 2 (`==`) for a chapter. */
  readonly level: number;
  /** The anchors of its parts written so far, by anchor, so that none is written twice. */
  readonly seen: Map<string, number>;
}

function listAdoc(items: readonly (readonly Block[])[], ordered: boolean, scope: AdocScope, at: AdocPage, depth: number): string[] {
  const out: string[] = [];
  for (const item of items) {
    const [first, ...rest] = item;
    const mk = marks(depth + 1, ordered ? "." : "*");
    out.push(`${mk} ${first?.kind === "paragraph" ? lead(inlinesAdoc(first.inlines, scope)) : "{empty}"}`);
    const others = first?.kind === "paragraph" ? rest : item;
    for (const b of others) {
      if (b.kind === "list") out.push(...listAdoc(b.items, b.ordered, scope, at, depth + 1));
      else {
        const lines = blockAdoc(b, scope, at, depth + 1);
        if (lines.length > 0) out.push("+", ...lines.filter((l, j, a) => !(l === "" && (j === 0 || j === a.length - 1))));
      }
    }
  }
  return [...out, ""];
}

function blockAdoc(b: Block, scope: AdocScope, at: AdocPage, depth: number): string[] {
  switch (b.kind) {
    case "heading":
      return ["", `[#${claim(at.seen, at.anchor, b.id)}]`, `${mark(at.level + b.level - 1)} ${inlinesAdoc(b.text, scope)}`, ""];
    case "paragraph":
      return [lead(inlinesAdoc(b.inlines, scope)), ""];
    case "meta":
      return [`__${inlinesAdoc(b.inlines, scope)}__`, ""];
    case "list":
      return listAdoc(b.items, b.ordered, scope, at, depth);
    case "code": {
      const f = fence(b.text);
      return [...(b.title === undefined ? [] : [`.${b.title}`]), `[source${b.lang === "text" ? "" : `,${b.lang}`}]`, f, b.text, f, ""];
    }
    case "table":
      return b.head.length === 0
        ? []
        : [`[%header,cols="${b.head.length}*"]`, "|===", ...b.head.map((h) => `|${cell(h, scope)}`), "", ...b.rows.flatMap((r) => [...r.map((c) => `|${cell(c, scope)}`), ""]), "|===", ""];
    case "callout": {
      const style = b.tone === "note" ? "NOTE" : b.tone === "limit" ? "IMPORTANT" : "WARNING";
      const inner = b.blocks.flatMap((x) => blockAdoc(x, scope, at, depth));
      while (inner[inner.length - 1] === "") inner.pop();
      return [`[${style}]`, `.${b.title.replace(/^\./, "")}`, "====", ...inner, "====", ""];
    }
    case "entry":
      return [
        "",
        `[discrete#${claim(at.seen, at.anchor, b.id)}]`,
        `${mark(at.level + 2)} ${codeAdoc(b.name)}${b.badges.length === 0 ? "" : ` (${b.badges.map((x) => textAdoc(x.text)).join(", ")})`}`,
        "",
        ...(b.signature === undefined ? [] : ["[source,ts]", fence(b.signature), b.signature, fence(b.signature), ""]),
        ...b.blocks.flatMap((x) => blockAdoc(x, scope, at, depth)),
      ];
    case "tabs":
      return b.tabs.flatMap((t, i) => ["", `[discrete#${claim(at.seen, at.anchor, `${b.id}-${i}`)}]`, `${mark(at.level + 3)} ${textAdoc(t.label)}`, "", ...t.blocks.flatMap((x) => blockAdoc(x, scope, at, depth))]);
    case "diagram":
      // the Press has no drawing of Mermaid: a diagram is shown as its source, under its caption
      return [...(b.caption === "" ? [] : [`.${b.caption}`]), "[source,mermaid]", fence(b.source), b.source, fence(b.source), ""];
    case "cards":
      return [...cardsAdoc(b.cards, scope, 0), ""];
    case "badges":
      return [b.badges.map((x) => codeAdoc(x.text)).join(" "), ""];
    case "tree":
      return [...treeAdoc(b.nodes, scope, 0), ""];
    default:
      return absurd(b);
  }
}

/** Every anchor a page writes: its own, and each heading's, entry's and tab's. */
export function anchorsOf(page: Page, anchor: string): string[] {
  const out = [anchor];
  const seen = new Map<string, number>();
  const walk = (bs: readonly Block[]): void => {
    for (const b of bs) {
      if (b.kind === "heading") out.push(claim(seen, anchor, b.id));
      else if (b.kind === "entry") {
        out.push(claim(seen, anchor, b.id));
        walk(b.blocks);
      } else if (b.kind === "tabs") b.tabs.forEach((t, i) => {
        out.push(claim(seen, anchor, `${b.id}-${i}`));
        walk(t.blocks);
      });
      else if (b.kind === "callout") walk(b.blocks);
      else if (b.kind === "list") for (const i of b.items) walk(i);
    }
  };
  walk(page.blocks);
  return out;
}

/**
 * A page as the text of a chapter: its anchor, its title at a marker of `level` `=`, its description, its badges and its blocks.
 *
 * @param page - the page
 * @param scope - the volume it is in
 * @param at - its anchor and the length of its title's marker
 */
export function pageAdoc(page: Page, scope: AdocScope, at: Omit<AdocPage, "seen">): string[] {
  const mine: AdocPage = { ...at, seen: new Map() };
  const first = page.blocks[0];
  const repeated = first?.kind === "paragraph" && page.description !== "" && plain(first.inlines).trim().startsWith(page.description.trim().replace(/…$/, ""));
  const lines = [
    `[#${at.anchor}]`,
    `${mark(at.level)} ${textAdoc(page.title)}`,
    "",
    ...(page.badges === undefined || page.badges.length === 0 ? [] : [`__${page.badges.map((b) => textAdoc(b.text)).join(" · ")}__`, ""]),
    ...(page.description === "" || repeated ? [] : [lead(textAdoc(page.description)), ""]),
    ...page.blocks.flatMap((b) => blockAdoc(b, scope, mine, 0)),
  ];
  const out: string[] = [];
  for (const l of lines) if (!(l === "" && out[out.length - 1] === "")) out.push(l);
  while (out[out.length - 1] === "") out.pop();
  return out;
}
