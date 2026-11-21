// Spec: 0001-docs FR-001
/**
 * One build of the site (commons 0011-documentation FR-003, FR-009, FR-017, FR-018, FR-023, FR-026): the configuration's packages and
 * spec kits read, every page made (the lenses the configuration passes make theirs), the pages that cite each specification added, every
 * link and anchor held to the pages, and the site written as files: a page for each page, the stylesheet, the script, Mermaid and the
 * search index. The same sources give the same bytes.
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import { fs } from "@intellectual-frontiers/system";
import { Build } from "./build.ts";
import type { Finding } from "./check.ts";
import { type Config, type PresentationId, under } from "./config.ts";
import { diagramSources, drawable } from "./emit/html.ts";
import { markdownOf } from "./emit/markdown.ts";
import { readEvidence } from "./evidence.ts";
import { presentationFiles, writeFiles } from "./presentation.ts";
import { decorate, fillFindings, qualityData, qualityPages } from "./pages/quality.ts";
import { readApi } from "./extract/api.ts";
import { readSpecKits } from "./extract/specs.ts";
import type { LensPages, SiteFile } from "./lens.ts";
import { type Block, type Card, type Href, type Inline, type Page, possessive, type TreeNode } from "./model.ts";
import { apiPages, registerApi } from "./pages/api.ts";
import { areaPages } from "./pages/areas.ts";
import { areaPage, overviewPages, packagePage } from "./pages/overview.ts";
import { citedBy, specPages } from "./pages/specs.ts";
import { areasOf, checkAbout, type Package, readPackage } from "./sources.ts";

/** A built site: its pages, its search index and what was found while it was built. */
export interface Built {
  /** The pages, in the order they were made. */
  readonly pages: readonly Page[];
  /** What was found. */
  readonly found: readonly Finding[];
  /** The files the lenses added beside the pages (the JSON of a model). */
  readonly files: readonly SiteFile[];
}

/** The section home pages for the API and the models, which list the areas and the models. */
function homes(b: Build, packages: readonly Package[]): void {
  const areas = areasOf(packages);
  b.add({
    path: "api/index.html",
    title: "API",
    description: `The API of every area of ${b.config.subject}, read from its TypeScript.`,
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
  if (b.config.lenses.length > 0 && !b.pages.some((p) => p.section === "models")) {
    b.add({
      path: "models/index.html",
      title: "Models",
      description: `The schemas and layouts ${possessive(b.config.subject)} libraries define.`,
      section: "models",
      group: "Models",
      order: 0,
      blocks: [{ kind: "paragraph", inlines: [{ kind: "text", text: "No model has been read yet." }] }],
    });
  }
}

/** The pages that name a retired name, and the pages people write that have a word they do not use. */
export function wordFindings(pages: readonly Page[], retired: readonly string[], forbidden: readonly string[]): Finding[] {
  const found: Finding[] = [];
  const escape = (w: string): string => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const has = (text: string, w: string): boolean => new RegExp(`(^|[^A-Za-z0-9])${escape(w)}($|[^A-Za-z0-9])`, "i").test(text);
  for (const p of pages) {
    const text = markdownOf(p);
    for (const name of retired) if (has(text, name)) found.push({ where: p.path, problem: { kind: "retired-name", name } });
    if (p.section === "start" || p.section === "concepts" || p.section === "howto") {
      for (const word of forbidden) if (has(text, word)) found.push({ where: p.path, problem: { kind: "forbidden-word", word } });
    }
  }
  return found;
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
        case "trend":
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
 * The site of a repository, built in memory from its configuration.
 *
 * @param config - the configuration, checked
 */
export async function buildSite(config: Config): Promise<Built> {
  const root = config.root;
  const found: Finding[] = [];
  const b = new Build(config, readSpecKits(root, config.specKits, found));
  b.found.push(...found);
  b.evidence = readEvidence(root, config.evidence, b.found, (lib) => (lib === "repository" ? "" : (config.packages.find((p) => p.slug === lib)?.dir ?? `commons/${lib}`)));
  const top = await readPackage(root, config.home, config.fileFromRoot, b.found);
  const packages: Package[] = [];
  for (const src of config.packages) {
    const p = await readPackage(root, src, config.fileFromRoot, b.found);
    if (p === undefined) continue;
    packages.push(p);
    b.packageTitles.set(p.slug, p.about.title);
    b.found.push(...checkAbout(root, p, config.lintRules));
  }
  if (top !== undefined) b.found.push(...checkAbout(root, top, config.lintRules));
  const areas = areasOf(packages);
  for (const a of areas) for (const e of a.entryPoints) b.files.set(under(a.pkg.dir, e), areaPage(a));
  const apis = areas.length === 0
    ? []
    : await readApi(root, areas.map((a) => ({ slug: a.slug, entryPoints: a.entryPoints.map((e) => under(a.pkg.dir, e)) })), packages.map((p) => p.dir));
  const modules = registerApi(b, areas, apis);
  const lenses: LensPages[] = [];
  for (const p of config.problems) b.found.push({ where: p.where, problem: { kind: "import-failed", error: p.error } });
  // a lens that fails is a finding, and the site is made without it
  for (const lens of config.lenses) {
    try {
      lenses.push(await lens.read(b, areas, apis));
    } catch (thrown) {
      b.found.push({ where: `lens ${lens.name}`, problem: { kind: "import-failed", error: thrown instanceof Error ? thrown.message : String(thrown) } });
    }
  }
  specPages(b);
  // a test that names a requirement that no specification of the kits has is stale: a requirement renumbered or removed
  if (b.evidence.recorded) {
    const known = new Set(b.kit.specs.flatMap((sp) => sp.requirements.map((r) => `${sp.id} ${r.id}`)));
    const seen = new Set<string>();
    for (const lib of [...b.evidence.results.values()]) {
      for (const t of lib.tests) {
        for (const r of t.requirements) {
          const key = `${r}\u0000${t.file}`;
          if (known.has(r) || seen.has(key) || !b.kit.specs.some((sp) => r.startsWith(`${sp.id} `))) continue;
          seen.add(key);
          b.found.push({ where: t.file === "" ? lib.library : t.file, problem: { kind: "test-requirement-unknown", requirement: r, test: t.name.replace(/^.*?: /, "").slice(0, 80) } });
        }
      }
    }
  }
  if (top !== undefined) overviewPages(b, top, packages, areas);
  apiPages(b, areas, apis, modules);
  areaPages(b, areas, modules);
  let after = 100;
  for (const make of lenses) {
    try {
      after = make(b, after);
    } catch (thrown) {
      b.found.push({ where: "a lens's pages", problem: { kind: "import-failed", error: thrown instanceof Error ? thrown.message : String(thrown) } });
    }
  }
  homes(b, packages);
  qualityPages(b);
  decorate(b, areas);
  citedBy(b);
  b.found.push(...brokenLinks(b.pages));
  for (const p of b.pages) for (const src of diagramSources(p.blocks)) if (!drawable(src)) b.found.push({ where: p.path, problem: { kind: "diagram-undrawable", first: src.split("\n")[0] ?? "" } });
  b.found.push(...wordFindings(b.pages, config.retired, config.forbiddenInGuides));
  fillFindings(b, b.found);
  const lensFiles = config.lenses.flatMap((l) => {
    try {
      return l.files?.(b) ?? [];
    } catch (thrown) {
      b.found.push({ where: `lens ${l.name}`, problem: { kind: "import-failed", error: thrown instanceof Error ? thrown.message : String(thrown) } });
      return [];
    }
  });
  const files = [...lensFiles, ...qualityData(b)];
  return { pages: b.pages, found: b.found, files };
}

/**
 * A built site written into a folder, which is emptied first where the presentations include the site (the web), and not otherwise (a book's files are written into the
 * folder of the books of a repository that holds other things).
 *
 * @param config - the configuration
 * @param built - the site
 * @param out - the folder
 * @param presentations - what is written; the configuration's by default
 * @returns what was found while the presentations were made (a part of a book that takes no page)
 */
export async function writeSite(config: Config, built: Built, out: string, presentations: readonly PresentationId[] = config.presentations): Promise<readonly Finding[]> {
  const made = presentationFiles(config, built, presentations);
  if (presentations.includes("web")) await fs.remove(out, { recursive: true }).catch(() => {});
  await fs.ensureDir(out);
  await writeFiles(out, made.files);
  return made.found;
}
