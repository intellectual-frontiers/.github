/**
 * One build of the site (commons 0011-documentation FR-003, FR-009, FR-017, FR-018): the packages and the spec kit read, every page made,
 * the pages that cite each specification added, every link and anchor held to the pages, and the site written as files: a page for each
 * page, the stylesheet, the script, Mermaid and the search index. The same checkout gives the same bytes.
 *
 * @module
 */
import { absurd } from "../ts/kernel/mod.ts";
import { fs, path } from "../ts/runtime/mod.ts";
import { Build, REPOSITORY } from "./build.ts";
import type { Finding } from "./check.ts";
import { document } from "./emit/html.ts";
import { searchIndex } from "./emit/search.ts";
import { readApi } from "./extract/api.ts";
import { readSpecKit } from "./extract/specs.ts";
import type { Block, Card, Href, Inline, Page, TreeNode } from "./model.ts";
import { apiPages, registerApi } from "./pages/api.ts";
import { areaPages } from "./pages/areas.ts";
import { areaPage, overviewPages, packagePage } from "./pages/overview.ts";
import { citedBy, specPages } from "./pages/specs.ts";
import { layoutPages, readLayouts } from "./lens/file-aide.ts";
import { modelPages, readModels } from "./lens/sql-aide.ts";
import { areasOf, checkAbout, COMMONS, type Package, PACKAGES, readPackage } from "./sources.ts";

/** The site's name, at the top of every page. */
export const SITE_NAME = "IF Commons";

/** A built site: its pages, its search index and what was found while it was built. */
export interface Built {
  /** The pages, in the order they were made. */
  readonly pages: readonly Page[];
  /** What was found. */
  readonly found: readonly Finding[];
}

/** The section home pages for the API and the models, which list the areas and the models. */
function homes(b: Build, packages: readonly Package[]): void {
  const areas = areasOf(packages);
  b.add({
    path: "api/index.html",
    title: "API",
    description: "The API of every area of commons, read from its TypeScript.",
    section: "api",
    group: "API",
    order: 0,
    blocks: packages
      .filter((p) => (p.about.areas ?? []).length > 0)
      .flatMap((p): Block[] => [
        { kind: "heading", level: 2, id: p.slug, text: [{ kind: "text", text: p.about.title }] },
        {
          kind: "cards",
          cards: areas
            .filter((a) => a.pkg.slug === p.slug)
            .map((a): Card => ({
              title: a.title,
              href: { kind: "page", path: areaPage(a) },
              text: [{ kind: "code", text: a.entryPoints.join(", ") }],
            })),
        },
        {
          kind: "paragraph",
          inlines: [{ kind: "link", href: { kind: "page", path: packagePage(p) }, children: [{ kind: "text", text: `About ${p.about.title}` }] }],
        },
      ]),
  });
  if (!b.pages.some((p) => p.section === "models")) {
    b.add({
      path: "models/index.html",
      title: "Models",
      description: "The schemas and layouts commons' libraries define.",
      section: "models",
      group: "Models",
      order: 0,
      blocks: [{ kind: "paragraph", inlines: [{ kind: "text", text: "No model has been read yet." }] }],
    });
  }
}

/** Every link of a page: the hrefs of its inlines and cards. */
function hrefsOf(bs: readonly Block[]): Href[] {
  const out: Href[] = [];
  const inl = (xs: readonly Inline[]): void => {
    for (const i of xs) {
      switch (i.kind) {
        case "link":
          out.push(i.href);
          inl(i.children);
          break;
        case "emphasis":
        case "strong":
          inl(i.children);
          break;
        case "text":
        case "code":
          break;
        default:
          absurd(i);
      }
    }
  };
  const card = (c: Card): void => {
    out.push(c.href);
    inl(c.text);
    for (const k of c.children ?? []) card(k);
  };
  const walk = (xs: readonly Block[]): void => {
    for (const b of xs) {
      switch (b.kind) {
        case "heading":
          inl(b.text);
          break;
        case "paragraph":
        case "meta":
          inl(b.inlines);
          break;
        case "list":
          b.items.forEach(walk);
          break;
        case "table":
          b.head.forEach(inl);
          b.rows.forEach((r) => r.forEach(inl));
          break;
        case "callout":
        case "entry":
          walk(b.blocks);
          break;
        case "tabs":
          b.tabs.forEach((t) => walk(t.blocks));
          break;
        case "cards":
          b.cards.forEach(card);
          break;
        case "tree": {
          const visit = (ns: readonly TreeNode[]): void => {
            for (const n of ns) {
              if (n.note !== undefined) inl(n.note);
              visit(n.children);
            }
          };
          visit(b.nodes);
          break;
        }
        case "code":
        case "diagram":
        case "badges":
          break;
        default:
          absurd(b);
      }
    }
  };
  walk(bs);
  return out;
}

/** The anchors of a page: its headings and entries, at any depth. */
function anchorsOf(bs: readonly Block[], out: Set<string> = new Set()): Set<string> {
  for (const b of bs) {
    if (b.kind === "heading") out.add(b.id);
    else if (b.kind === "entry") {
      out.add(b.id);
      anchorsOf(b.blocks, out);
    } else if (b.kind === "tabs") for (const t of b.tabs) anchorsOf(t.blocks, out);
    else if (b.kind === "callout") anchorsOf(b.blocks, out);
  }
  return out;
}

/** The links of every page that lead to no page, or to no anchor of their page. */
export function brokenLinks(pages: readonly Page[]): Finding[] {
  const anchors = new Map(pages.map((p) => [p.path, anchorsOf(p.blocks)]));
  const found: Finding[] = [];
  for (const p of pages) {
    for (const h of hrefsOf(p.blocks)) {
      if (h.kind !== "page") continue;
      const target = anchors.get(h.path);
      const shown = `${h.path}${h.anchor === undefined ? "" : `#${h.anchor}`}`;
      if (target === undefined || (h.anchor !== undefined && !target.has(h.anchor))) found.push({ where: p.path, problem: { kind: "broken-link", href: shown } });
    }
  }
  return found;
}

/**
 * The site of a checkout, built in memory.
 *
 * @param root - the checkout's root
 */
export async function buildSite(root: string): Promise<Built> {
  const b = new Build(root, readSpecKit(path.join(root, "commons/spec-kit")));
  const commons = await readPackage(root, COMMONS, b.found);
  const packages: Package[] = [];
  for (const src of PACKAGES) {
    const p = await readPackage(root, src, b.found);
    if (p === undefined) continue;
    packages.push(p);
    b.found.push(...checkAbout(root, p));
  }
  if (commons !== undefined) b.found.push(...checkAbout(root, commons));
  const areas = areasOf(packages);
  for (const a of areas) for (const e of a.entryPoints) b.files.set(`${a.pkg.dir}/${e}`, areaPage(a));
  const apis = await readApi(root, areas.map((a) => ({ slug: a.slug, entryPoints: a.entryPoints.map((e) => `${a.pkg.dir}/${e}`) })));
  const modules = registerApi(b, areas, apis);
  const models = await readModels(b, areas, apis);
  const layouts = await readLayouts(b, areas, apis);
  specPages(b);
  if (commons !== undefined) overviewPages(b, commons, packages, areas);
  apiPages(b, areas, apis, modules);
  areaPages(b, areas, modules);
  modelPages(b, models);
  layoutPages(b, layouts, 100 + models.length * 100);
  homes(b, packages);
  citedBy(b);
  b.found.push(...brokenLinks(b.pages));
  return { pages: b.pages, found: b.found };
}

/** The files of the theme and of Mermaid, from where they are to where the site serves them. */
function assets(root: string): readonly (readonly [string, string])[] {
  const docs = path.join(root, "commons/docs");
  return [
    [path.join(docs, "theme/site.css"), "assets/site.css"],
    [path.join(docs, "theme/site.js"), "assets/site.js"],
    [path.join(docs, "node_modules/mermaid/dist/mermaid.min.js"), "assets/mermaid.min.js"],
  ];
}

/**
 * A built site written into a folder, which is emptied first.
 *
 * @param root - the checkout's root
 * @param built - the site
 * @param out - the folder
 */
export async function writeSite(root: string, built: Built, out: string): Promise<void> {
  await fs.remove(out, { recursive: true }).catch(() => {});
  await fs.ensureDir(out);
  const site = { name: SITE_NAME, repository: REPOSITORY, pages: built.pages };
  for (const p of [...built.pages].sort((a, b) => (a.path < b.path ? -1 : 1))) {
    const file = path.join(out, p.path);
    await fs.ensureDir(path.dirname(file));
    await fs.writeTextFile(file, document(p, site));
  }
  for (const [from, to] of assets(root)) {
    const file = path.join(out, to);
    await fs.ensureDir(path.dirname(file));
    await fs.copyFile(from, file);
  }
  await fs.writeTextFile(path.join(out, "search.json"), `${JSON.stringify(searchIndex(built.pages))}\n`);
  await fs.writeTextFile(path.join(out, ".nojekyll"), "");
}
