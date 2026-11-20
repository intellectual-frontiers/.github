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
import { highlightedHtml } from "../highlight.ts";
import { renderMermaidSVG } from "beautiful-mermaid";
import type { Badge, Block, Card, Href, Inline, Lang, Page, Section, TreeNode } from "../model.ts";
import { plain } from "../model.ts";

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
];

/** Text made safe for HTML. */
export function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * The relative address from one page of the site to another.
 *
 * @param from - the path of the page the link is on
 * @param to - the path of the page it goes to
 */
export function relative(from: string, to: string): string {
  const a = from.split("/").slice(0, -1);
  const b = to.split("/");
  let i = 0;
  while (i < a.length && i < b.length - 1 && a[i] === b[i]) i++;
  const up = a.length - i;
  return `${"../".repeat(up)}${b.slice(i).join("/")}` || "index.html";
}

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
      return `<a href="${escape(hrefOf(i.href, from))}"${external ? ' rel="noopener" class="ext"' : ""}>${inlines(i.children, from)}</a>`;
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

/** Whether a diagram can be drawn: its source is of a type the renderer draws (flowchart, state, sequence, class, entity-relationship). */
export function drawable(source: string): boolean {
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
    return renderMermaidSVG(source, { bg: "var(--page)", fg: "var(--text)", line: "var(--muted)", accent: "var(--link)", muted: "var(--faint)", surface: "var(--chrome)", border: "var(--border-strong)", transparent: true, font: "inherit" });
  } catch {
    return `<pre class="lang-mermaid"><code>${escape(source)}</code></pre>`;
  }
}

const badge = (b: Badge): string => `<span class="badge badge-${b.tone}">${escape(b.text)}</span>`;
const badges = (bs: readonly Badge[] | undefined): string => (bs === undefined || bs.length === 0 ? "" : `<span class="badges">${bs.map(badge).join("")}</span>`);

const LONG_SIGNATURE = 400;

function card(c: Card, from: string): string {
  const kids = c.children === undefined || c.children.length === 0
    ? ""
    : `<div class="card-children">${c.children.map((k) => card(k, from)).join("")}</div>`;
  return `<div class="card"><a class="card-link" href="${escape(hrefOf(c.href, from))}"><span class="card-title">${escape(c.title)}</span>${
    badges(c.badges)
  }<span class="card-text">${inlines(unlinked(c.text), from)}</span></a>${kids}</div>`;
}

function tree(nodes: readonly TreeNode[], from: string): string {
  return `<ul>${
    nodes
      .map(
        (n) =>
          `<li><span class="tree-node"><code>${escape(n.label)}</code>${n.note === undefined ? "" : `<span class="tree-note">${inlines(n.note, from)}</span>`}</span>${
            n.children.length === 0 ? "" : tree(n.children, from)
          }</li>`,
      )
      .join("")
  }</ul>`;
}

/** A block as HTML. */
export function block(b: Block, from: string): string {
  switch (b.kind) {
    case "heading":
      return `<h${b.level} id="${escape(b.id)}"><a class="anchor" href="#${escape(b.id)}" aria-hidden="true">#</a>${inlines(b.text, from)}</h${b.level}>`;
    case "paragraph":
      return `<p>${inlines(b.inlines, from)}</p>`;
    case "meta":
      return `<p class="meta">${inlines(b.inlines, from)}</p>`;
    case "list": {
      const tag = b.ordered ? "ol" : "ul";
      return `<${tag}>${b.items.map((it) => `<li>${blocks(it, from, true)}</li>`).join("")}</${tag}>`;
    }
    case "code":
      return `<figure class="code">${b.title === undefined ? "" : `<figcaption>${escape(b.title)}</figcaption>`}<pre class="lang-${b.lang}"><code>${
        highlighted(b.text, b.lang)
      }</code></pre></figure>`;
    case "table":
      return `${b.filter === undefined ? "" : `<input type="search" class="table-filter" placeholder="${escape(b.filter)}" aria-label="${escape(b.filter)}">`}<div class="table-wrap${b.compact === true ? " compact" : ""}"><table><thead><tr>${b.head.map((h) => `<th>${inlines(h, from)}</th>`).join("")}</tr></thead><tbody>${
        b.rows.map((r) => `<tr>${r.map((c) => `<td>${inlines(c, from)}</td>`).join("")}</tr>`).join("")
      }</tbody></table></div>`;
    case "callout":
      return `<aside class="callout callout-${b.tone}"><p class="callout-title">${escape(b.title)}</p>${blocks(b.blocks, from)}</aside>`;
    case "entry": {
      const sig = b.signature === undefined
        ? ""
        : b.signature.length > LONG_SIGNATURE
        ? `<details class="sig-long"><summary><code>${escape(b.signature.slice(0, 120))}…</code> <span class="muted">(${b.signature.length} characters)</span></summary><pre class="sig lang-ts"><code>${
          highlighted(b.signature, "ts")
        }</code></pre></details>`
        : `<pre class="sig lang-ts"><code>${highlighted(b.signature, "ts")}</code></pre>`;
      return `<section class="entry" id="${escape(b.id)}"><div class="entry-head"><a class="entry-name" href="#${escape(b.id)}"><code>${
        escape(b.name)
      }</code></a>${badges(b.badges)}</div>${sig}<div class="entry-body">${blocks(b.blocks, from)}</div></section>`;
    }
    case "tabs":
      return `<div class="tabs" data-tabs><div class="tab-list" role="tablist">${
        b.tabs
          .map((t, i) =>
            `<button type="button" role="tab" id="${escape(`${b.id}-tab-${i}`)}" aria-controls="${escape(`${b.id}-panel-${i}`)}" aria-selected="${
              i === 0 ? "true" : "false"
            }">${escape(t.label)}</button>`
          )
          .join("")
      }</div>${
        b.tabs
          .map((t, i) =>
            `<div class="tab-panel" role="tabpanel" id="${escape(`${b.id}-panel-${i}`)}" aria-labelledby="${escape(`${b.id}-tab-${i}`)}"${
              i === 0 ? "" : " hidden"
            }>${blocks(t.blocks, from)}</div>`
          )
          .join("")
      }</div>`;
    case "diagram":
      return `<figure class="diagram"><div class="diagram-wrap">${diagramSvg(b.source)}</div><figcaption>${
        escape(b.caption)
      }</figcaption><details class="diagram-source"><summary>Diagram source</summary><pre class="lang-text"><code>${escape(b.source)}</code></pre></details></figure>`;
    case "cards":
      return `<div class="cards">${b.cards.map((c) => card(c, from)).join("")}</div>`;
    case "badges":
      return `<p class="badge-row">${b.badges.map(badge).join("")}</p>`;
    case "tree":
      return `<div class="tree">${tree(b.nodes, from)}</div>`;
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
      case "tree":
        return false;
      default:
        return absurd(b);
    }
  });
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

/** The navigation of a section as HTML (FR-040): each group is a `details` element that is open where it holds the page being read, a page lists beneath it the pages whose `parent` it is only while it or one of them is being read, and no script is needed. */
function navHtml(pages: readonly Page[], current: Page, from: string): string {
  const inSection = pages.filter((q) => q.section === current.section);
  const byPath = new Map(inSection.map((p) => [p.path, p] as const));
  const childrenOf = new Map<string, Page[]>();
  for (const p of inSection) if (p.parent !== undefined && byPath.has(p.parent)) childrenOf.set(p.parent, [...(childrenOf.get(p.parent) ?? []), p]);
  const trail = new Set<string>();
  for (let at: Page | undefined = current; at !== undefined; at = at.parent === undefined ? undefined : byPath.get(at.parent)) trail.add(at.path);
  const order = (a: Page, b: Page): number => a.order - b.order || (a.title < b.title ? -1 : a.title > b.title ? 1 : 0);
  const item = (p: Page): string => {
    const kids = (childrenOf.get(p.path) ?? []).sort(order);
    const link = `<a href="${escape(relative(from, p.path))}"${p.path === from ? ' class="current" aria-current="page"' : ""}>${escape(p.navTitle ?? p.title)}</a>`;
    if (kids.length === 0 || !trail.has(p.path)) return `<li>${link}</li>`;
    let kind: string | undefined;
    const inner = kids.map((k) => {
      const head = k.navKind !== undefined && k.navKind !== kind ? `<li class="nav-kind">${escape(k.navKind)}</li>` : "";
      kind = k.navKind;
      return `${head}${item(k)}`;
    }).join("");
    return `<li>${link}<ul class="nav-sub">${inner}</ul></li>`;
  };
  const roots = navigation(inSection, current.section).map((g) => ({ group: g.group, pages: g.pages.filter((p) => p.parent === undefined || !byPath.has(p.parent)) }));
  const small = roots.length <= 4;
  return roots
    .map((g) => {
      const open = small || g.pages.some((p) => trail.has(p.path) || [...trail].some((t) => (childrenOf.get(p.path) ?? []).some((k) => k.path === t)));
      return `<details class="nav-group"${open ? " open" : ""}><summary><span class="nav-title">${escape(g.group)}</span><span class="nav-count">${g.pages.length}</span></summary><ul>${g.pages.map(item).join("")}</ul></details>`;
    })
    .join("");
}

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
  const top = SECTIONS.filter((s) => site.sections === undefined || site.sections.includes(s.section)).map((s) =>
    `<a class="section-link${s.section === page.section ? " current" : ""}" href="${escape(relative(from, s.home))}">${escape(s.label)}</a>`
  ).join("");
  const nav = navHtml(site.pages, page, from);
  const toc = outline(page.blocks);
  const tocHtml = toc.length < 2
    ? ""
    : `<nav class="toc" aria-label="On this page"><p class="toc-title">On this page</p><ul>${
      toc.map((t) => `<li class="toc-${t.level}"><a href="#${escape(t.id)}">${escape(t.text)}</a></li>`).join("")
    }</ul></nav>`;
  return `<!doctype html>
<html lang="en" data-root="${escape(root)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(page.title)} · ${escape(site.name)}</title>
<meta name="description" content="${escape(page.description)}">
<script>try{var t=localStorage.getItem("theme");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}</script>
<link rel="stylesheet" href="${asset("site.css")}">
<script src="${asset("site.js")}" defer></script>
</head>
<body>
<a class="skip" href="#content">Skip to the content</a>
<header class="top">
<button type="button" class="menu-button" aria-controls="sidebar" aria-expanded="false" aria-label="Menu"><span></span></button>
<a class="brand" href="${escape(relative(from, "index.html"))}">${escape(site.name)}</a>
<nav class="sections" aria-label="Sections">${top}</nav>
<button type="button" class="search-button" aria-haspopup="dialog"><span>Search</span><kbd>/</kbd></button>
<button type="button" class="theme-button" aria-label="Switch between the light and the dark theme" title="Theme (t)"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 1.5a6.5 6.5 0 0 1 0 13z" fill="currentColor"/></svg></button>
<a class="repo" href="${escape(site.repository)}" rel="noopener">GitHub</a>
</header>
<div class="layout">
<aside class="sidebar" id="sidebar"><nav aria-label="${escape(SECTIONS.find((s) => s.section === page.section)?.label ?? "")}">${nav}</nav></aside>
<main id="content" class="content">
<article>
<header class="page-head"><h1>${escape(page.title)}</h1>${badges(page.badges)}</header>
${blocks(page.blocks, from)}
</article>
</main>
${tocHtml}
</div>
<dialog class="search" aria-label="Search"><form method="dialog"><input type="search" placeholder="Search the documentation" aria-label="Search" autocomplete="off"><select class="search-kind" aria-label="Filter by kind"><option value="">Everything</option></select></form><ul class="results" role="listbox"></ul><p class="search-hint">Titles, headings, exports, tables, columns and requirements. <kbd>Esc</kbd> closes.</p></dialog>
</body>
</html>
`;
}
