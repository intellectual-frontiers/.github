/**
 * The File Aide lens (commons 0011-documentation FR-014): an area whose entry point exports entries of a layout (recognised by the type
 * the checker gives each export: `Entry<...>`) is a layout of files, and is shown as one. Its module is imported, and each entry's own
 * values make the page: a tree of the layout's paths, and for each entry its path pattern, its segments with their kind, role and
 * witnesses, the paths its witnesses make, its codec, its owner and its description.
 *
 * @module
 */
import type { AnySegment, Codec, Entry } from "../../ts/data/file-aide/mod.ts";
import { absurd } from "../../ts/kernel/mod.ts";
import { type Area, type AreaApi, areaPage, type Block, type Build, firstSentence, type Inline, type Lens, moduleComment, slugOf, type TreeNode, under } from "../mod.ts";

/** An entry of a layout, by its export name. */
type AnyEntry = Entry<string, object, unknown>;

/** A layout: an area's entries. */
export interface LayoutModel {
  /** The area. */
  readonly area: Area;
  /** Its page. */
  readonly page: string;
  /** Its entries, by export name. */
  readonly entries: readonly { readonly name: string; readonly value: AnyEntry }[];
}

/** Whether a value is an entry of File Aide. */
function isEntry(v: unknown): v is AnyEntry {
  return typeof v === "object" && v !== null && "name" in v && typeof v.name === "string" && "pattern" in v && typeof v.pattern === "object" &&
    v.pattern !== null && "text" in v.pattern && "segments" in v.pattern && "codec" in v;
}

const ENTRY_TYPE = /^const [\w$]+: Entry</;

/**
 * The layouts of the areas: for each area whose API exports entries, its module imported and those values read.
 *
 * @param b - the build
 * @param areas - the areas
 * @param apis - their APIs
 */
export async function readLayouts(b: Build, areas: readonly Area[], apis: readonly AreaApi[]): Promise<LayoutModel[]> {
  const out: LayoutModel[] = [];
  for (const area of areas) {
    const api = apis.find((a) => a.slug === area.slug);
    const names = api?.exports.filter((e) => e.kinds.includes("const") && ENTRY_TYPE.test(e.signature)).map((e) => e.name) ?? [];
    if (names.length === 0) continue;
    const entry = under(area.pkg.dir, area.entryPoints[0] ?? "");
    try {
      const imported: unknown = await import(b.abs(entry));
      const mod: Record<string, unknown> = typeof imported === "object" && imported !== null ? Object.fromEntries(Object.entries(imported)) : {};
      const entries = names.flatMap((n) => {
        const v = mod[n];
        return isEntry(v) ? [{ name: n, value: v }] : [];
      });
      const page = `models/${area.slug}/index.html`;
      for (const e of entries) b.entityPages.set(`${area.slug}!${e.name}`, page);
      out.push({ area, page, entries });
    } catch (e) {
      b.found.push({ where: entry, problem: { kind: "import-failed", error: e instanceof Error ? e.message : String(e) } });
    }
  }
  return out;
}

const t = (s: string): Inline => ({ kind: "text", text: s });
const c = (s: string): Inline => ({ kind: "code", text: s });

/** The tree of a layout: each element of each entry's pattern a node, the entry named at its last. */
export function layoutTree(entries: readonly { readonly name: string; readonly value: AnyEntry }[]): TreeNode[] {
  type Mutable = { label: string; note?: Inline[]; children: Mutable[] };
  const root: Mutable[] = [];
  for (const { value } of entries) {
    const parts = value.pattern.text.split("/");
    let level = root;
    parts.forEach((p, i) => {
      let node = level.find((n) => n.label === p);
      if (node === undefined) {
        node = { label: p, children: [] };
        level.push(node);
      }
      if (i === parts.length - 1) node.note = [t(`${value.name}: `), ...[t(value.description)]];
      level = node.children;
    });
  }
  const freeze = (ns: readonly Mutable[]): TreeNode[] => ns.map((n) => ({ label: n.label, ...(n.note === undefined ? {} : { note: n.note }), children: freeze(n.children) }));
  return freeze(root);
}

/** What a segment does beyond reading and writing its text. */
function roleOf(s: AnySegment): string {
  switch (s.role.kind) {
    case "plain":
      return "";
    case "fanout":
      return `first ${s.role.chars} characters of ${s.role.of}`;
    case "rest":
      return s.role.except.length === 0 ? "the rest of the path" : `the rest of the path, but not ${s.role.except.join(", ")}`;
    default:
      return absurd(s.role);
  }
}

const codecOf = (codec: Codec<unknown>): string => codec.kind;

/**
 * The page of each layout.
 *
 * @param b - the build
 * @param layouts - the layouts
 * @param after - the order the first of them takes in the section
 */
export function layoutPages(b: Build, layouts: readonly LayoutModel[], after: number): void {
  layouts.forEach((l, li) => {
    const file = under(l.area.pkg.dir, l.area.entryPoints[0] ?? "");
    const scope = { page: l.page, file, area: l.area.slug };
    const doc = b.exists(file) ? moduleComment(b.read(file)) : undefined;
    const blocks: Block[] = [];
    if (doc !== undefined) blocks.push(...b.md(firstSentence(doc.summary, 400), scope));
    blocks.push({ kind: "meta", inlines: [t("The API of this layout: "), { kind: "link", href: { kind: "page", path: areaPage(l.area) }, children: [t(l.area.title)] }] });
    blocks.push({ kind: "heading", level: 2, id: "tree", text: [t("Tree")] }, { kind: "tree", nodes: layoutTree(l.entries) });
    blocks.push({ kind: "heading", level: 2, id: "entries", text: [t("Entries")] });
    for (const { name, value } of l.entries) {
      const segs = value.pattern.segments;
      const body: Block[] = [
        ...b.md(value.description, scope),
        { kind: "code", lang: "text", text: value.pattern.text, title: "Path pattern" },
      ];
      if (segs.length > 0) {
        body.push({
          kind: "table",
          head: [[t("Segment")], [t("Kind")], [t("Role")], [t("Witnesses")]],
          rows: segs.map((s) => [[c(s.name)], [t(s.kind)], [t(roleOf(s))], s.witnesses.map((w) => String(w)).flatMap((w, i) => [...(i === 0 ? [] : [t(", ")]), c(w)])]),
        });
      }
      const paths = value.pattern.witnesses();
      if (paths.length > 0) body.push({ kind: "meta", inlines: [t("Paths its witnesses make: "), ...paths.flatMap((p, i) => [...(i === 0 ? [] : [t(", ")]), c(p)])] });
      blocks.push({ kind: "entry", id: slugOf(name), name: value.name, badges: [{ text: `codec: ${codecOf(value.codec)}`, tone: "neutral" }, { text: `owner: ${value.owner}`, tone: "neutral" }], blocks: body });
    }
    b.add({ path: l.page, title: `${l.area.title} layout`, description: `The layout of files ${l.area.title} defines.`, section: "models", group: l.area.title, order: after + li * 100, navTitle: "Layout", blocks });
  });
}

/** The File Aide lens (FR-014, FR-026): the layouts of the areas whose exports are entries, and their pages. */
export const fileAide: Lens = {
  name: "file-aide",
  read: async (b, areas, apis) => {
    const layouts = await readLayouts(b, areas, apis);
    return (bb, after) => {
      layoutPages(bb, layouts, after);
      return after + layouts.length * 100;
    };
  },
};
