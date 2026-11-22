// Spec: 0001-docs FR-001
/**
 * The page model written as HTML (commons 0011-documentation FR-009, FR-017): one static file for each page, whose links are all
 * relative so that the site works under any path, with the sections that have a page in its top bar, the site's stylesheet and its one
 * script, and Mermaid only where a page has a diagram, all served by the site itself. Every case of the model is matched by a `switch`
 * that ends in `absurd`. Code is highlighted here, when the site is built.
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import { BLOCK_VARIABLES, highlightedHtml, highlightedLines } from "../highlight.ts";
import type { Badge, Block, Card, Href, Inline, Lang, Page, Section, TreeNode } from "../model.ts";
import { plain } from "../model.ts";
import type { Release } from "../published.ts";
import { icon, BUTTON, SEARCH_DIALOG, shell, type NavNode, type SectionChoice } from "./shell.ts";
import type { IconName } from "./icons.ts";
import { escape, relative } from "./util.ts";

/** What every page shares: the site's name, the navigation of each section, and the address of the repository. */
export interface Site {
  /** The site's name, at the top of every page. */
  readonly name: string;
  /** The repository's address, for the link at the top. */
  readonly repository: string;
  /** Every page, for the navigation. */
  readonly pages: readonly Page[];
  /** The sections the top bar shows, where not all four: a site leaves out a section with no page (FR-009). */
  readonly sections?: readonly Section[];
  /** The release of the package the site documents (FR-033): its version is in the heading of every page. */
  readonly release?: Release;
}

/** The names of the sections, in the order the top bar shows them, and the page each opens on. */
export const SECTIONS: readonly { readonly section: Section; readonly label: string; readonly home: string }[] = [
  { section: "start", label: "Start here", home: "start/index.html" },
  { section: "concepts", label: "Concepts", home: "concepts/index.html" },
  { section: "overview", label: "Libraries", home: "index.html" },
  { section: "howto", label: "How-to", home: "how-to/index.html" },
  { section: "specs", label: "Specifications", home: "specs/index.html" },
  { section: "api", label: "API", home: "api/index.html" },
  { section: "models", label: "Models", home: "models/index.html" },
  { section: "programs", label: "Programs", home: "programs/index.html" },
  { section: "quality", label: "Quality", home: "quality/index.html" },
  { section: "repoops", label: "Repo Ops", home: "repo-ops/index.html" },
];

export { escape, relative } from "./util.ts";

/** The address an `Href` is, seen from a page. */
export function hrefOf(h: Href, from: string): string {
  switch (h.kind) {
    case "page": {
      const target = h.path === from ? "" : relative(from, h.path);
      return `${target}${h.anchor === undefined ? "" : `#${h.anchor}`}` || "#";
    }
    case "external":
      return h.url;
    default:
      return absurd(h);
  }
}

/** The length past which inline code may wrap (in a table, shorter code stays on one line). */
const LONG_CODE = 48;

function inline(i: Inline, from: string): string {
  switch (i.kind) {
    case "text":
      return escape(i.text);
    case "code":
      return `<code${i.text.length > LONG_CODE ? ' class="long"' : ""}>${escape(i.text)}</code>`;
    case "emphasis":
      return `<em>${inlines(i.children, from)}</em>`;
    case "strong":
      return `<strong>${inlines(i.children, from)}</strong>`;
    case "link": {
      const external = i.href.kind === "external";
      return `<a href="${escape(hrefOf(i.href, from))}"${external ? ' rel="noopener"' : ""}>${inlines(i.children, from)}</a>`;
    }
    default:
      return absurd(i);
  }
}

/** Inlines without their links, for text that is itself inside a link (a card), where a link may not be. */
export function unlinked(xs: readonly Inline[]): Inline[] {
  return xs.map((i): Inline => {
    switch (i.kind) {
      case "link":
        return { kind: "emphasis", children: unlinked(i.children) };
      case "emphasis":
      case "strong":
        return { ...i, children: unlinked(i.children) };
      case "text":
      case "code":
        return i;
      default:
        return absurd(i);
    }
  });
}

/** Inlines as HTML. */
export const inlines = (xs: readonly Inline[], from: string): string => xs.map((i) => inline(i, from)).join("");

/** Code as highlighted HTML, coloured when the site is built (FR-037). */
export function highlighted(code: string, lang: Lang): string {
  return highlightedHtml(code, lang);
}

/**
 * The renderer of diagrams, loaded with `import()` (0036-distribution FR-033): `beautiful-mermaid` is an optional peer of the package, so every entry imports without it. Where it is absent a diagram stays as its source in the page, with one warning that names the package and the range to install.
 */
const renderMermaidSVG: ((source: string, options?: Record<string, string | boolean>) => string) | undefined = await (async () => {
  try {
    return (await import("beautiful-mermaid")).renderMermaidSVG;
  } catch (e) {
    console.warn(`docs: beautiful-mermaid is not installed (or cannot be loaded: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}), so diagrams stay as their source: install beautiful-mermaid at >=1.1.3 <2.0.0 beside the package to draw them`);
    return undefined;
  }
})();

/** Whether a diagram can be drawn: its source is of a type the renderer draws (flowchart, state, sequence, class, entity-relationship). Where the renderer is not installed no diagram is judged: they all stay as their source. */
export function drawable(source: string): boolean {
  if (renderMermaidSVG === undefined) return true;
  try {
    renderMermaidSVG(source);
    return true;
  } catch {
    return false;
  }
}

/** The sources of the diagrams in blocks, at any depth. */
export function diagramSources(bs: readonly Block[]): string[] {
  return bs.flatMap((b): string[] => {
    switch (b.kind) {
      case "diagram":
        return [b.source];
      case "list":
        return b.items.flatMap(diagramSources);
      case "callout":
      case "entry":
        return diagramSources(b.blocks);
      case "tabs":
        return b.tabs.flatMap((t) => diagramSources(t.blocks));
      default:
        return [];
    }
  });
}

/**
 * A diagram as SVG, drawn when the site is built (FR-037): in the colours of the page, as custom properties, so that the light and the dark scheme need no second drawing; where the diagram cannot be drawn, its source in a code block.
 */
export function diagramSvg(source: string): string {
  try {
    if (renderMermaidSVG === undefined) return `<pre class="lang-mermaid"><code>${escape(source)}</code></pre>`;
    return renderMermaidSVG(source, { bg: "var(--color-fd-card)", fg: "var(--color-fd-foreground)", line: "var(--color-fd-muted-foreground)", accent: "var(--color-fd-primary)", muted: "var(--color-fd-muted-foreground)", surface: "var(--color-fd-secondary)", border: "var(--color-fd-border)", transparent: true, font: "inherit" });
  } catch {
    return `<pre class="lang-mermaid"><code>${escape(source)}</code></pre>`;
  }
}

const TONE_DOT: Readonly<Record<Badge["tone"], string>> = { neutral: "bg-fd-muted-foreground", good: "bg-fd-success", warn: "bg-fd-warning", info: "bg-fd-info" };
const badge = (b: Badge): string =>
  `<span class="inline-flex items-center gap-1.5 rounded-md border bg-fd-secondary px-1.5 py-0.5 text-xs font-medium text-fd-secondary-foreground not-prose"><span aria-hidden="true" class="size-1.5 rounded-full ${TONE_DOT[b.tone]}"></span>${escape(b.text)}</span>`;
const badges = (bs: readonly Badge[] | undefined): string => (bs === undefined || bs.length === 0 ? "" : `<span class="inline-flex flex-wrap items-center gap-1.5 align-middle">${bs.map(badge).join("")}</span>`);

const LONG_SIGNATURE = 400;

const COPY_BUTTON = `<button type="button" class="${BUTTON} p-1 [&_svg]:size-4 hover:text-fd-accent-foreground data-checked:text-fd-accent-foreground" aria-live="polite" data-copy>${icon("clipboard")}<span class="sr-only">Copy Text</span></button>`;

/** Code as the reference's code block: a title bar with a button that copies it, or the button in the corner where there is no title. */
function codeFigure(text: string, lang: Lang, title: string | undefined, extra = ""): string {
  const head = title === undefined
    ? `<div class="empty:hidden absolute top-2 right-2 z-2 backdrop-blur-lg rounded-lg text-fd-muted-foreground">${COPY_BUTTON}</div>`
    : `<div class="flex text-fd-muted-foreground items-center gap-2 h-9.5 border-b px-4"><figcaption class="flex-1 truncate">${escape(title)}</figcaption><div class="empty:hidden -me-2">${COPY_BUTTON}</div></div>`;
  return `<figure dir="ltr" class="my-4 bg-fd-card rounded-xl shiki relative border not-prose overflow-hidden text-sm shiki shiki-themes catppuccin-latte catppuccin-mocha${extra}" style="${BLOCK_VARIABLES}" tabindex="-1">${head}<div tabindex="0" class="text-[0.8125rem] py-3.5 overflow-auto max-h-[600px] fd-scroll-container focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-fd-ring"${title === undefined ? ' style="--padding-right:calc(var(--spacing) * 8)"' : ""}><pre class="min-w-full w-max *:flex *:flex-col lang-${lang}"><code>${highlightedLines(text, lang)}</code></pre></div></figure>`;
}

const CARD = "block rounded-xl border bg-fd-card p-4 text-fd-card-foreground transition-colors @max-lg:col-span-full hover:bg-fd-accent/80";

function card(c: Card, from: string): string {
  const kids = c.children === undefined || c.children.length === 0
    ? ""
    : `<div class="col-span-full grid grid-cols-2 gap-3 ms-4 ps-4 border-s @max-lg:grid-cols-1">${c.children.map((k) => card(k, from)).join("")}</div>`;
  return `<a data-card="true" href="${escape(hrefOf(c.href, from))}" class="${CARD}"><h3 class="not-prose mb-1 text-sm font-medium">${escape(c.title)} ${badges(c.badges)}</h3><div class="text-sm text-fd-muted-foreground prose-no-margin empty:hidden">${inlines(unlinked(c.text), from)}</div></a>${kids}`;
}

/** The files and folders of the reference: a folder is a row with the folder's mark and what it holds under it, in a rule. */
function tree(nodes: readonly TreeNode[], from: string, top: boolean): string {
  const row = "flex flex-row items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-fd-accent hover:text-fd-accent-foreground [&_svg]:size-4";
  const inner = nodes
    .map((n) => {
      const label = `<code class="not-prose font-mono">${escape(n.label)}</code>${n.note === undefined ? "" : `<span class="text-fd-muted-foreground">${inlines(n.note, from)}</span>`}`;
      return n.children.length === 0
        ? `<div class="${row}">${icon("file")}${label}</div>`
        : `<div data-open=""><div class="${row}">${icon("folder-open")}${label}</div>${tree(n.children, from, false)}</div>`;
    })
    .join("");
  return top ? `<div class="not-prose rounded-md border bg-fd-card p-2">${inner}</div>` : `<div class="ms-2 flex flex-col border-l ps-2">${inner}</div>`;
}

const CALLOUT: Readonly<Record<"note" | "limit" | "warn", { readonly colour: string; readonly icon: IconName }>> = {
  note: { colour: "info", icon: "info" },
  limit: { colour: "warning", icon: "triangle-exclamation-point" },
  warn: { colour: "error", icon: "circle-x" },
};

const heading = (level: number, id: string, inner: string): string => {
  if (level <= 1) return `<h1 id="${escape(id)}" class="text-[1.75em] font-semibold">${inner}</h1>`;
  return `<h${level} id="${escape(id)}" class="group/heading flex scroll-m-28 flex-row items-center gap-1"><a data-card="" href="#${escape(id)}">${inner}</a><button type="button" aria-live="polite" data-anchor class="inline-flex items-center justify-center rounded-md text-sm font-medium duration-100 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-fd-ring hover:bg-fd-accent hover:text-fd-accent-foreground p-1 [&_svg]:size-4 not-prose shrink-0 text-fd-muted-foreground opacity-0 transition-opacity group-hover/heading:opacity-100 focus-visible:opacity-100">${icon("link")}<span class="sr-only">Copy Anchor Link</span></button></h${level}>`;
};

/** A block as HTML. */
export function block(b: Block, from: string): string {
  switch (b.kind) {
    case "heading":
      return heading(b.level, b.id, inlines(b.text, from));
    case "paragraph":
      return `<p>${inlines(b.inlines, from)}</p>`;
    case "meta":
      return `<p class="text-sm text-fd-muted-foreground">${inlines(b.inlines, from)}</p>`;
    case "list": {
      const tag = b.ordered ? "ol" : "ul";
      return `<${tag}>${b.items.map((it) => `<li>${blocks(it, from, true)}</li>`).join("")}</${tag}>`;
    }
    case "code":
      return codeFigure(b.text, b.lang, b.title);
    case "table":
      return `${
        b.filter === undefined
          ? ""
          : `<input type="search" data-table-filter class="mt-4 -mb-2 w-full max-w-sm h-9 rounded-lg border bg-fd-secondary/50 px-3 text-sm placeholder:text-fd-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-fd-ring" placeholder="${escape(b.filter)}" aria-label="${escape(b.filter)}">`
      }<div class="relative overflow-auto prose-no-margin my-6${b.compact === true ? " [&_table]:text-[0.8125rem]" : ""}" tabindex="0"><table><thead><tr>${b.head.map((h) => `<th>${inlines(h, from)}</th>`).join("")}</tr></thead><tbody>${
        b.rows.map((r) => `<tr>${r.map((c) => `<td>${inlines(c, from)}</td>`).join("")}</tr>`).join("")
      }</tbody></table></div>`;
    case "callout": {
      const c = CALLOUT[b.tone];
      return `<div class="flex gap-2 my-4 rounded-xl border bg-fd-card p-3 ps-1 text-sm text-fd-card-foreground" style="--callout-color:var(--color-fd-${c.colour}, var(--color-fd-muted))"><div role="none" class="w-0.5 bg-(--callout-color)/50 rounded-sm"></div>${
        icon(c.icon, "size-5 -me-0.5 fill-(--callout-color) text-fd-card")
      }<div class="flex flex-col gap-2 min-w-0 flex-1"><p class="font-medium my-0!">${escape(b.title)}</p><div class="text-fd-muted-foreground prose-no-margin empty:hidden">${blocks(b.blocks, from)}</div></div></div>`;
    }
    case "entry": {
      const sig = b.signature === undefined
        ? ""
        : b.signature.length > LONG_SIGNATURE
        ? `<details class="border-t"><summary class="cursor-pointer px-4 py-2 text-sm text-fd-muted-foreground hover:text-fd-accent-foreground"><code class="not-prose font-mono">${escape(b.signature.slice(0, 120))}…</code> (${b.signature.length} characters)</summary>${codeFigure(b.signature, "ts", undefined, " my-0 rounded-none border-0 border-t")}</details>`
        : codeFigure(b.signature, "ts", undefined, " my-0 rounded-none border-0 border-t");
      return `<section id="${escape(b.id)}" class="scroll-m-28 my-6 rounded-xl border bg-fd-card text-fd-card-foreground overflow-hidden"><div class="not-prose flex flex-wrap items-center gap-2 px-4 py-3"><a class="font-mono text-sm font-medium hover:text-fd-accent-foreground" href="#${escape(b.id)}">${escape(b.name)}</a>${badges(b.badges)}</div>${sig}<div class="prose-no-margin border-t px-4 py-3 text-sm empty:hidden">${blocks(b.blocks, from)}</div></section>`;
    }
    case "tabs":
      return `<div class="flex flex-col overflow-hidden rounded-xl border bg-fd-secondary my-4" data-tabs><div role="tablist" class="flex gap-3.5 text-fd-secondary-foreground overflow-x-auto px-4 not-prose">${
        b.tabs
          .map((t, i) =>
            `<button type="button" role="tab" id="${escape(`${b.id}-tab-${i}`)}" aria-controls="${escape(`${b.id}-panel-${i}`)}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}"${
              i === 0 ? ` data-active=""` : ""
            } class="inline-flex items-center gap-2 whitespace-nowrap text-fd-muted-foreground border-b border-transparent py-2 text-sm font-medium transition-colors [&_svg]:size-4 hover:text-fd-accent-foreground disabled:pointer-events-none disabled:opacity-50 data-[active]:border-fd-primary data-[active]:text-fd-primary">${escape(t.label)}</button>`
          )
          .join("")
      }</div>${
        b.tabs
          .map((t, i) =>
            `<div role="tabpanel" id="${escape(`${b.id}-panel-${i}`)}" aria-labelledby="${escape(`${b.id}-tab-${i}`)}" tabindex="0"${
              i === 0 ? "" : " hidden"
            } class="p-4 text-[0.9375rem] bg-fd-background rounded-xl outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-fd-ring prose-no-margin [&>figure:only-child]:-m-4 [&>figure:only-child]:border-none">${blocks(t.blocks, from)}</div>`
          )
          .join("")
      }</div>`;
    case "diagram":
      return `<figure class="not-prose my-4 rounded-xl border bg-fd-card text-fd-card-foreground overflow-hidden"><div class="overflow-auto p-4" data-diagram>${diagramSvg(b.source)}</div><figcaption class="border-t px-4 py-2 text-sm text-fd-muted-foreground">${
        escape(b.caption)
      }</figcaption><details class="border-t"><summary class="cursor-pointer px-4 py-2 text-sm text-fd-muted-foreground hover:text-fd-accent-foreground">Diagram source</summary>${codeFigure(b.source, "text", undefined, " my-0 rounded-none border-0 border-t")}</details></figure>`;
    case "cards":
      return `<div class="grid grid-cols-2 gap-3 @container">${b.cards.map((c) => card(c, from)).join("")}</div>`;
    case "badges":
      return `<p class="flex flex-wrap gap-1.5">${b.badges.map(badge).join("")}</p>`;
    case "stats":
      return `<ul class="not-prose grid grid-cols-2 gap-3 @2xl:grid-cols-4 @container my-4 p-0 list-none">${
        b.items
          .map((x) => {
            const inner = `<span class="block text-2xl font-semibold">${escape(x.value)}</span><span class="block text-sm text-fd-muted-foreground">${escape(x.label)}</span>`;
            return `<li class="rounded-xl border bg-fd-card text-fd-card-foreground">${
              x.href === undefined ? `<div class="p-4">${inner}</div>` : `<a class="block rounded-xl p-4 transition-colors hover:bg-fd-accent/80" href="${escape(hrefOf(x.href, from))}">${inner}</a>`
            }</li>`;
          })
          .join("")
      }</ul>`;
    case "trend":
      return trendHtml(b.label, b.values, b.unit);
    case "tree":
      return tree(b.nodes, from, true);
    default:
      return absurd(b);
  }
}

/** Blocks as HTML; a list item's single paragraph is written without its `<p>`. */
export function blocks(bs: readonly Block[], from: string, tight = false): string {
  const only = bs[0];
  if (tight && bs.length === 1 && only !== undefined && only.kind === "paragraph") return inlines(only.inlines, from);
  return bs.map((b) => block(b, from)).join("");
}

/** Whether blocks hold a diagram, anywhere in them. */
export function hasDiagram(bs: readonly Block[]): boolean {
  return bs.some((b) => {
    switch (b.kind) {
      case "diagram":
        return true;
      case "list":
        return b.items.some(hasDiagram);
      case "callout":
      case "entry":
        return hasDiagram(b.blocks);
      case "tabs":
        return b.tabs.some((t) => hasDiagram(t.blocks));
      case "heading":
      case "paragraph":
      case "meta":
      case "code":
      case "table":
      case "cards":
      case "badges":
      case "trend":
      case "stats":
      case "tree":
        return false;
      default:
        return absurd(b);
    }
  });
}

/** The values of a trend as a line of letters: the lowest is the lowest bar. */
export function sparkText(values: readonly number[]): string {
  if (values.length === 0) return "";
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  return values.map((v) => "▁▂▃▄▅▆▇█"[hi === lo ? 3 : Math.round(((v - lo) / (hi - lo)) * 7)] ?? "▁").join("");
}

/** A trend as a small line, drawn in the page (no script, no image): the label and the range are its text, for a reader that cannot see it. */
function trendHtml(label: string, values: readonly number[], unit: string | undefined): string {
  const w = 120;
  const h = 28;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const x = (i: number): number => (values.length <= 1 ? w / 2 : 2 + (i * (w - 4)) / (values.length - 1));
  const y = (v: number): number => (hi === lo ? h / 2 : h - 3 - ((v - lo) / (hi - lo)) * (h - 6));
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const range = values.length === 0 ? "no runs" : `${lo === hi ? String(lo) : `${lo} to ${hi}`}${unit === undefined ? "" : ` ${unit}`}, latest ${values[values.length - 1]}`;
  return `<figure class="not-prose my-4 flex flex-col gap-1 text-fd-primary"><svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${escape(label)}: ${escape(range)}"><polyline fill="none" stroke="currentColor" stroke-width="1.5" points="${points}"/>${values.length === 0 ? "" : `<circle cx="${x(values.length - 1).toFixed(1)}" cy="${y(values[values.length - 1] ?? 0).toFixed(1)}" r="2.2" fill="currentColor"/>`}</svg><figcaption class="text-sm text-fd-muted-foreground">${escape(label)}: ${escape(range)}</figcaption></figure>`;
}

/** The headings and entries of a page, for its table of contents. */
export function outline(bs: readonly Block[]): { readonly id: string; readonly text: string; readonly level: number }[] {
  const out: { id: string; text: string; level: number }[] = [];
  for (const b of bs) {
    if (b.kind === "heading" && b.level <= 3) out.push({ id: b.id, text: plain(b.text), level: b.level });
    else if (b.kind === "entry") out.push({ id: b.id, text: b.name, level: 3 });
  }
  return out;
}

/** The navigation of a section: its groups, in the order of their pages, and the pages of each. */
export function navigation(pages: readonly Page[], section: Section): { readonly group: string; readonly pages: readonly Page[] }[] {
  const groups = new Map<string, Page[]>();
  for (const p of pages.filter((q) => q.section === section)) groups.set(p.group, [...(groups.get(p.group) ?? []), p]);
  const firstOrder = (ps: readonly Page[]): number => Math.min(...ps.map((p) => p.order));
  return [...groups]
    .map(([group, ps]) => ({ group, pages: [...ps].sort((a, b) => a.order - b.order || (a.title < b.title ? -1 : a.title > b.title ? 1 : 0)) }))
    .sort((a, b) => firstOrder(a.pages) - firstOrder(b.pages) || (a.group < b.group ? -1 : 1));
}

/** The navigation of a section as the nodes of the side navigation (FR-037): the groups, as headings where the section has few and as folders where it has many (the folder of the page being read is open), and the pages of each, where a page lists beneath it the pages whose `parent` it is (open while it or one of them is being read). */
function navNodes(pages: readonly Page[], current: Page, from: string): NavNode[] {
  const inSection = pages.filter((q) => q.section === current.section);
  const byPath = new Map(inSection.map((p) => [p.path, p] as const));
  const childrenOf = new Map<string, Page[]>();
  for (const p of inSection) if (p.parent !== undefined && byPath.has(p.parent)) childrenOf.set(p.parent, [...(childrenOf.get(p.parent) ?? []), p]);
  const trail = new Set<string>();
  for (let at: Page | undefined = current; at !== undefined; at = at.parent === undefined ? undefined : byPath.get(at.parent)) trail.add(at.path);
  const order = (a: Page, b: Page): number => a.order - b.order || (a.title < b.title ? -1 : a.title > b.title ? 1 : 0);
  const item = (p: Page): NavNode => {
    const kids = (childrenOf.get(p.path) ?? []).sort(order);
    let kind: string | undefined;
    const children = kids.flatMap((k): NavNode[] => {
      const head: NavNode[] = k.navKind !== undefined && k.navKind !== kind ? [{ kind: "heading", title: k.navKind }] : [];
      kind = k.navKind;
      return [...head, item(k)];
    });
    return { kind: "link", title: p.navTitle ?? p.title, href: relative(from, p.path), current: p.path === from, open: trail.has(p.path), children };
  };
  const roots = navigation(inSection, current.section).map((g) => ({ group: g.group, pages: g.pages.filter((p) => p.parent === undefined || !byPath.has(p.parent)) }));
  const small = roots.length <= 4;
  return roots.flatMap((g): NavNode[] => {
    const nodes = g.pages.map(item);
    if (small) return [...(g.group === "" ? [] : [{ kind: "heading", title: g.group } as const]), ...nodes];
    const open = g.pages.some((p) => trail.has(p.path) || [...trail].some((t) => (childrenOf.get(p.path) ?? []).some((k) => k.path === t)));
    return [{ kind: "folder", title: g.group, open, children: nodes }];
  });
}

/** The previous and the next page of a page in the order of the side navigation of its section (FR-037): the groups in order and the pages of each in order. */
export function neighbours(pages: readonly Page[], current: Page): { readonly previous: Page | undefined; readonly next: Page | undefined } {
  const flat = navigation(pages, current.section).flatMap((g) => g.pages);
  const at = flat.findIndex((p) => p.path === current.path);
  return at < 0 ? { previous: undefined, next: undefined } : { previous: flat[at - 1], next: flat[at + 1] };
}

/** The tooltip of the version: where it was read. */
function versionTitle(r: Release): string {
  return r.source === "registry" ? `The newest version on the package registry${r.date === undefined ? "" : `, published ${r.date}`}` : "The version of package.json: not confirmed on the package registry";
}

/** The script of the head, which runs before the page is first drawn: the theme (the reader's choice, else the system's) as the class `dark` of the page, and the width (FR-040) from the cookie `ifc-docs-width` as the attribute `data-width`. Each part is guarded, so that a browser that blocks storage or cookies draws the page in the reference's width and the system's theme. */
export const HEAD_SCRIPT = `(function(){var d=document.documentElement;try{var t=localStorage.getItem("theme");if(t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches)){d.classList.add("dark");d.style.colorScheme="dark"}}catch(e){}try{var m=document.cookie.match(/(?:^|; )ifc-docs-width=([^;]*)/);if(m&&m[1]==="full")d.dataset.width="full"}catch(e){}})()`;

/**
 * A page as a whole HTML document.
 *
 * @param page - the page
 * @param site - what every page shares
 */
export function document(page: Page, site: Site): string {
  const from = page.path;
  const root = relative(from, "index.html").replace(/index\.html$/, "");
  const asset = (name: string): string => `${root}assets/${name}`;
  const release = site.release;
  const versioned = release === undefined ? site.name : `${site.name} v${release.version}`;
  const section = SECTIONS.find((s) => s.section === page.section);
  const choices: SectionChoice[] = SECTIONS.filter((s) => site.sections === undefined || site.sections.includes(s.section)).map((s) => ({ label: s.label, href: relative(from, s.home), current: s.section === page.section }));
  const toc = outline(page.blocks);
  const isHome = page.path === "index.html";
  const crumbs = isHome || section === undefined
    ? ""
    : `<nav class="flex flex-wrap items-center gap-1.5 text-sm text-fd-muted-foreground -mb-2" aria-label="Breadcrumb"><a class="hover:text-fd-accent-foreground" href="${escape(relative(from, section.home))}">${escape(section.label)}</a>${
      page.path === section.home || page.group === "" || page.group === section.label ? "" : `${icon("chevron-right", "size-3.5")}<span>${escape(page.group)}</span>`
    }</nav>`;
  const { previous, next } = neighbours(site.pages, page);
  const NEIGHBOUR = "group flex flex-col gap-1 rounded-2xl border p-4 text-sm transition-colors hover:bg-fd-accent/40 @max-md:col-span-full";
  const pager = previous === undefined && next === undefined
    ? ""
    : `<nav class="@container grid grid-cols-2 gap-3 mt-8" aria-label="Previous and next page">${
      previous === undefined ? "" : `<a rel="prev" href="${escape(relative(from, previous.path))}" class="${NEIGHBOUR}"><span class="inline-flex items-center gap-1.5 text-fd-muted-foreground">${icon("arrow-left", "size-3.5 transition-transform group-hover:-translate-x-0.5 rtl:rotate-180")}Previous Page</span><span class="font-medium">${escape(previous.navTitle ?? previous.title)}</span></a>`
    }${next === undefined ? "" : `<a rel="next" href="${escape(relative(from, next.path))}" class="${NEIGHBOUR} col-start-2 items-end text-end"><span class="inline-flex items-center gap-1.5 text-fd-muted-foreground">Next Page${icon("arrow-right", "size-3.5 transition-transform group-hover:translate-x-0.5 rtl:rotate-180")}</span><span class="font-medium">${escape(next.navTitle ?? next.title)}</span></a>`}</nav>`;
  const footer = `<div class="flex flex-col gap-1 text-sm text-fd-muted-foreground mt-4"><p>${
    release === undefined
      ? escape(site.name)
      : `<strong class="font-medium text-fd-foreground">${escape(versioned)}</strong>${release.source === "registry" ? (release.date === undefined ? "" : ` · published ${escape(release.date)}`) : ` · <span>version of package.json, not confirmed on the package registry</span>`}`
  }${release?.commit === undefined ? "" : ` · built from commit <code class="font-mono">${escape(release.commit)}</code>`}${
    release?.ahead === undefined ? "" : ` · ${badge({ text: `${release.ahead} commit${release.ahead === 1 ? "" : "s"} since the release`, tone: "warn" })}`
  }</p><p><a class="underline underline-offset-2 hover:text-fd-accent-foreground" href="${escape(relative(from, "repo-ops/packaging.html"))}">How the package is made</a> · <a class="underline underline-offset-2 hover:text-fd-accent-foreground" href="${escape(site.repository)}" rel="noopener">GitHub</a></p></div>`;
  const article = `<article data-full="false" id="nd-page" class="flex flex-col gap-4 w-full min-w-0 max-w-(--fd-page-width) pt-6 pb-8">${crumbs}<h1 class="text-[1.75em] font-semibold">${escape(page.title)} ${badges(page.badges)}</h1><p class="text-lg text-fd-muted-foreground mb-2">${escape(page.description)}</p><div class="flex flex-row flex-wrap gap-2 items-center border-b pb-6 mb-4"><button type="button" data-copy-link aria-live="polite" class="inline-flex items-center justify-center rounded-md p-2 font-medium transition-colors duration-100 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-fd-ring border bg-fd-secondary text-fd-secondary-foreground hover:bg-fd-accent hover:text-fd-accent-foreground px-2 py-1.5 text-xs gap-2 [&_svg]:size-3.5 [&_svg]:text-fd-muted-foreground">${icon("copy")}Copy link</button></div><div class="prose flex-1 text-fd-foreground/90">${blocks(page.blocks, from)}</div>${footer}${pager}</article>`;
  const version = release === undefined ? "" : ` <span data-version title="${escape(versionTitle(release))}"${release.source === "registry" ? "" : ' class="text-fd-muted-foreground"'}>v${escape(release.version)}</span>`;
  const body = shell({
    name: site.name,
    version,
    home: relative(from, "index.html"),
    repository: site.repository,
    sections: choices,
    nav: navNodes(site.pages, page, from),
    toc,
    article,
    pageTitle: page.title,
  });
  return `<!doctype html>
<html lang="en" data-root="${escape(root)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${escape(page.title)} · ${escape(versioned)}</title>
<meta name="description" content="${escape(page.description)}">
<script>${HEAD_SCRIPT}</script>
<link rel="preload" href="${asset("fonts/inter-latin-wght-normal.woff2")}" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${asset("fumadocs.css")}">
<link rel="stylesheet" href="${asset("site.css")}">
<script src="${asset("site.js")}" defer></script>
</head>
<body class="ui relative flex min-h-screen flex-col${isHome ? " home" : ""}">
${body}
${SEARCH_DIALOG}
</body>
</html>
`;
}
