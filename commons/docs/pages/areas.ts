/**
 * The overview of each area (commons 0011-documentation FR-009): the module comment of its first entry point (what the area is, its
 * longer account and its examples), its entry points, its phases, its examples as the compiler checks them, and the limits of every
 * module of the area, gathered from their `@limits`, each under the file it is about.
 *
 * @module
 */
import type { Build } from "../build.ts";
import type { LinkScope } from "../links.ts";
import type { Block, Inline } from "../model.ts";
import type { Area } from "../sources.ts";
import { areaFiles } from "../sources.ts";
import { moduleComment } from "../tsdoc.ts";
import type { ModulePage } from "./api.ts";
import { areaPage, firstSentence } from "./overview.ts";

/** Where a file of an area is shown: its page of the API where there is one, else its overview. */
const fileLink = (b: Build, file: string, fallback: string): Inline => ({
  kind: "link",
  href: { kind: "page", path: b.files.get(file) ?? fallback },
  children: [{ kind: "code", text: file.split("/").slice(2).join("/") }],
});

const heading = (id: string, t: string): Block => ({ kind: "heading", level: 2, id, text: [{ kind: "text", text: t }] });

/**
 * An example file as the site shows it: a heading that names it, what it shows, its module comment as prose, and its code without the
 * comment.
 *
 * @param b - the build
 * @param file - the file, from the checkout's root
 * @param shown - its name as the heading shows it
 * @param what - what it shows
 * @param scope - where the words are
 */
export function exampleBlocks(b: Build, file: string, shown: string, what: string, scope: LinkScope): Block[] {
  const text = b.exists(file) ? b.read(file) : "";
  const doc = moduleComment(text);
  const code = text.replace(/^\s*\/\*\*[\s\S]*?\*\/\s*/, "").trimEnd();
  return [
    { kind: "heading", level: 3, id: `example-${shown.replace(/\W+/g, "-")}`, text: [{ kind: "text", text: "Example: " }, { kind: "code", text: shown }] },
    { kind: "paragraph", inlines: b.line(what, scope) },
    ...(doc === undefined ? [] : b.md(doc.summary, { ...scope, file })),
    { kind: "code", lang: "ts", title: shown, text: code },
  ];
}

/**
 * The overview page of each area, after the API's pages, so that a limit links to the page of its file.
 *
 * @param b - the build
 * @param areas - the areas
 * @param modules - the module pages of each area
 */
export function areaPages(b: Build, areas: readonly Area[], modules: ReadonlyMap<string, readonly ModulePage[]>): void {
  areas.forEach((area, i) => {
    const page = areaPage(area);
    const entry = `${area.pkg.dir}/${area.entryPoints[0] ?? ""}`;
    const spec = area.spec?.id ?? area.pkg.about.spec?.id;
    const scope = { page, file: entry, area: area.slug, ...(spec === undefined ? {} : { spec }) };
    const doc = b.exists(entry) ? moduleComment(b.read(entry)) : undefined;
    const blocks: Block[] = [];
    if (doc !== undefined) {
      blocks.push(...b.md(doc.summary, scope));
      if (doc.remarks !== undefined) blocks.push(...b.md(doc.remarks, scope));
    }
    if (area.spec !== undefined) {
      blocks.push({ kind: "paragraph", inlines: [{ kind: "text", text: "Specification: " }, ...b.line(`${area.spec.repo} ${area.spec.id}`, scope)] });
    }
    blocks.push(heading("entry-points", "Entry points"), {
      kind: "list",
      ordered: false,
      items: area.entryPoints.map((e) => [{ kind: "paragraph", inlines: [fileLink(b, `${area.pkg.dir}/${e}`, page)] }]),
    });
    const mods = modules.get(area.slug) ?? [];
    if (mods.length > 0) {
      blocks.push(heading("modules", "Modules"), {
        kind: "cards",
        cards: mods.map((m) => ({ title: m.title, href: { kind: "page", path: m.page }, text: b.line(m.summary, { ...scope, file: m.file }) })),
      });
    }
    if ((doc?.examples.length ?? 0) + (area.examples?.length ?? 0) > 0) blocks.push(heading("examples", "Examples"));
    for (const x of doc?.examples ?? []) blocks.push(...b.example(x, scope));
    for (const x of area.examples ?? []) blocks.push(...exampleBlocks(b, `${area.pkg.dir}/${x.file}`, x.file, x.what, scope));
    if (area.phases !== undefined && area.phases.length > 0) {
      blocks.push(heading("phases", "Phases"), {
        kind: "table",
        head: ["Phase", "What", "State"].map((h) => [{ kind: "text", text: h }]),
        rows: area.phases.map((p) => [[{ kind: "text", text: String(p.n) }], b.line(p.what, scope), [{ kind: "text", text: p.state }]]),
      });
    }
    const limits = areaFiles(b.root, area.dir)
      .map((f) => [f, moduleComment(b.read(f))?.limits] as const)
      .filter((x): x is readonly [string, string] => x[1] !== undefined);
    if (limits.length > 0) {
      blocks.push(heading("limits", "Limits"), {
        kind: "paragraph",
        inlines: [{ kind: "text", text: "What the modules of this area do not do, or do only in part, as each module's @limits says." }],
      });
      for (const [f, text] of limits) {
        const fileScope = { ...scope, file: f };
        blocks.push({ kind: "callout", tone: "limit", title: f.split("/").slice(-2).join("/"), blocks: [{ kind: "paragraph", inlines: [fileLink(b, f, page)] }, ...b.md(text, fileScope)] });
      }
    }
    b.add({
      path: page,
      title: area.title,
      description: doc === undefined ? area.title : firstSentence(doc.summary),
      section: "api",
      group: area.title,
      order: 100 + i * 100,
      navTitle: "Overview",
      ...(spec === undefined ? {} : { badges: [{ text: spec.slice(0, 4), tone: "neutral" as const }] }),
      blocks,
    });
  });
}
