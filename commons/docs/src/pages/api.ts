// Spec: 0001-docs FR-001, FR-024
/**
 * The API pages of each area (commons 0011-documentation FR-010): a page for each source file its exports come from, in the order its
 * entry points export them, with the file's module comment (what it is, its account, its examples, its limits) and an entry for each
 * export: its kinds, its signature, its TSDoc (summary, remarks, parameters, what it returns, examples, see also, deprecation) and the
 * members of an interface. Pages and anchors are registered first, so that every other page's `{@link}` and file links reach them.
 *
 * @module
 */
import type { Build } from "../build.ts";
import type { ApiExport, AreaApi } from "../extract/api.ts";
import type { LinkScope } from "../links.ts";
import type { Badge, Block, Inline } from "../model.ts";
import { importIndex, testsImporting } from "../exercise.ts";
import { standing } from "../evidence.ts";
import { type Area, inside } from "../sources.ts";
import { moduleComment } from "../tsdoc.ts";
import { firstSentence } from "./overview.ts";

/** A module page of an area: its page, its title and the first sentence of its module comment. */
export interface ModulePage {
  /** The page. */
  readonly page: string;
  /** The file, from the checkout's root. */
  readonly file: string;
  /** Its title: the file's path in the area, without `.ts`. */
  readonly title: string;
  /** The first sentence of its module comment. */
  readonly summary: string;
}

/** The anchor of an export on its page. */
export const anchorOf = (name: string): string => name.replace(/[^\w.-]/g, "-");

/** The title of a file in an area: its path from the area's folder (or the package's), without `.ts`. */
function titleOf(area: Area, file: string): string {
  const from = (dir: string): string => (dir === "" ? file : file.slice(dir.length + 1));
  const base = inside(area.dir, file) ? from(area.dir) : inside(area.pkg.dir, file) ? from(area.pkg.dir) : file;
  return base.replace(/\.ts$/, "");
}

/** Whether a file is the area's own, or one it re-exports from elsewhere. */
const own = (area: Area, file: string): boolean => inside(area.dir, file);

/** The page of a file of an area; what the area re-exports from elsewhere is on one page. */
const pageOf = (area: Area, file: string): string =>
  own(area, file) ? `api/${area.slug}/${titleOf(area, file).replace(/\//g, "-")}.html` : `api/${area.slug}/re-exports.html`;

/** The pages of an area's exports, in the order of their first export, each with its file (none for the re-exports). */
function pagesOf(area: Area, api: AreaApi): (readonly [string, string | undefined])[] {
  const out = new Map<string, string | undefined>();
  for (const e of api.exports) {
    const page = pageOf(area, e.file);
    if (!out.has(page)) out.set(page, own(area, e.file) ? e.file : undefined);
  }
  return [...out];
}

/**
 * The pages and anchors of every area's API, registered before any page is made.
 *
 * @param b - the build
 * @param areas - the areas
 * @param apis - their APIs
 */
export function registerApi(b: Build, areas: readonly Area[], apis: readonly AreaApi[]): Map<string, ModulePage[]> {
  const modules = new Map<string, ModulePage[]>();
  for (const area of areas) {
    const api = apis.find((a) => a.slug === area.slug);
    if (api === undefined) continue;
    const names = new Map<string, { path: string; anchor: string }>();
    const list: ModulePage[] = [];
    for (const [page, file] of pagesOf(area, api)) {
      if (file === undefined) {
        list.push({ page, file: "", title: "re-exports", summary: `What ${area.title} exports from elsewhere, so that its users need import nothing else.` });
        continue;
      }
      if (!b.files.has(file)) b.files.set(file, page);
      if (!b.apiFiles.has(file)) b.apiFiles.set(file, page);
      const doc = b.exists(file) ? moduleComment(b.read(file)) : undefined;
      list.push({ page, file, title: titleOf(area, file), summary: doc === undefined ? "" : firstSentence(doc.summary, 200) });
    }
    for (const e of api.exports) {
      const entry = { path: pageOf(area, e.file), anchor: anchorOf(e.name) };
      names.set(e.name, entry);
      const key = `${e.file}#${e.declared ?? e.name.split(".").pop() ?? e.name}`;
      if (own(area, e.file) && !b.declared.has(key)) b.declared.set(key, entry);
      const short = e.name.split(".").pop();
      if (short !== undefined && !names.has(short)) names.set(short, entry);
    }
    b.exports.set(area.slug, names);
    modules.set(area.slug, list);
  }
  return modules;
}

const textInl = (t: string): Inline => ({ kind: "text", text: t });

/** The blocks of an export's entry. */
function entryBlocks(b: Build, e: ApiExport, scope: LinkScope): Block[] {
  const d = e.doc;
  const out: Block[] = [];
  if (d.deprecated !== undefined) out.push({ kind: "callout", tone: "warn", title: "Deprecated", blocks: b.md(d.deprecated, scope) });
  out.push(...b.md(d.summary, scope));
  if (d.remarks !== undefined) out.push(...b.md(d.remarks, scope));
  if (d.params.length > 0) {
    out.push({
      kind: "table",
      head: [[textInl("Parameter")], [textInl("What it is")]],
      rows: d.params.map((p) => [[{ kind: "code", text: p.name }], b.line(p.text, scope)]),
    });
  }
  if (d.returns !== undefined) out.push({ kind: "paragraph", inlines: [{ kind: "strong", children: [textInl("Returns: ")] }, ...b.line(d.returns, scope)] });
  if (e.members.length > 0) {
    out.push({
      kind: "table",
      head: [[textInl("Member")], [textInl("Type")], [textInl("What it is")]],
      rows: e.members.map((m) => [[{ kind: "code", text: `${m.name}${m.optional ? "?" : ""}` }], [{ kind: "code", text: m.type }], b.line(m.doc, scope)]),
    });
  }
  for (const x of d.examples) out.push(...b.example(x, scope));
  if (d.limits !== undefined) out.push({ kind: "callout", tone: "limit", title: "Limits", blocks: b.md(d.limits, scope) });
  if (d.see.length > 0) {
    out.push({ kind: "paragraph", inlines: [{ kind: "strong", children: [textInl("See also: ")] }, ...d.see.flatMap((s, i) => [...(i === 0 ? [] : [textInl("; ")]), ...b.line(s, scope)])] });
  }
  return out;
}

/**
 * A page for each source file of each area's exports.
 *
 * @param b - the build
 * @param areas - the areas
 * @param apis - their APIs
 * @param modules - the module pages `registerApi` gave
 */
export function apiPages(b: Build, areas: readonly Area[], apis: readonly AreaApi[], modules: ReadonlyMap<string, readonly ModulePage[]>): void {
  const index = b.evidence.recorded ? importIndex(b) : [];
  areas.forEach((area, ai) => {
    const api = apis.find((a) => a.slug === area.slug);
    if (api === undefined) return;
    const spec = area.spec?.id ?? area.pkg.about.spec?.id;
    const prefix = area.pkg.dir === "" ? "" : `${area.pkg.dir}/`;
    const ran = index.some((x) => x.test.file.startsWith(prefix));
    (modules.get(area.slug) ?? []).forEach((m, mi) => {
      const scope: LinkScope = { page: m.page, file: m.file || (area.dir === "" ? "" : `${area.dir}/`), area: area.slug, ...(spec === undefined ? {} : { spec }) };
      const doc = m.file !== "" && b.exists(m.file) ? moduleComment(b.read(m.file)) : undefined;
      const blocks: Block[] = [];
      if (doc !== undefined) {
        blocks.push(...b.md(doc.summary, scope));
        if (doc.remarks !== undefined) blocks.push(...b.md(doc.remarks, scope));
        for (const x of doc.examples) blocks.push(...b.example(x, scope));
        if (doc.limits !== undefined) blocks.push({ kind: "callout", tone: "limit", title: "Limits", blocks: b.md(doc.limits, scope) });
      }
      if (m.file === "") blocks.push({ kind: "paragraph", inlines: [textInl(m.summary)] });
      else blocks.push({ kind: "meta", inlines: [textInl("Source: "), { kind: "link", href: { kind: "external", url: b.index.blob(m.file) }, children: [{ kind: "code", text: m.file }] }] });
      let tested = 0;
      let exercised = 0;
      const head = blocks.length;
      for (const e of api.exports.filter((x) => pageOf(area, x.file) === m.page)) {
        if (!e.documented) b.found.push({ where: `${m.file} (${area.slug})`, problem: { kind: "undocumented", name: e.name } });
        const badges: Badge[] = e.kinds.map((k) => ({ text: k, tone: "neutral" }));
        const at = b.declared.get(`${e.file}#${e.declared ?? e.name.split(".").pop() ?? e.name}`);
        const home = b.apiFiles.get(e.file) ?? b.files.get(e.file);
        const target = at ?? (home === undefined ? undefined : { path: home, anchor: anchorOf(e.name) });
        const declared: Block[] = m.file === ""
          ? [{ kind: "meta", inlines: [textInl("Declared in "), target === undefined ? { kind: "code", text: e.file } : { kind: "link", href: { kind: "page", ...target }, children: [{ kind: "code", text: e.file }] }] }]
          : [];
        const shown = b.entityPages.get(`${area.slug}!${e.name}`);
        const model: Block[] = shown === undefined
          ? []
          : [{ kind: "meta", inlines: [textInl("A table of the model: "), { kind: "link", href: { kind: "page", path: shown }, children: [textInl("columns, diagram, SQL and governance")] }] }];
        const exercising = !ran || e.kinds.includes("namespace") ? [] : testsImporting(index, area.pkg.dir, e.name);
        const found = exercising.map((x) => x.test);
        const stand = standing(found);
        if (ran && !e.kinds.includes("namespace")) {
          tested += 1;
          if (exercising.length > 0) exercised += 1;
          if (stand === "failing") badges.push({ text: "tests failing", tone: "warn" });
          else if (exercising.length === 0) badges.push({ text: "no test imports it", tone: "info" });
        }
        const tests: Block[] = exercising.length === 0
          ? []
          : [{ kind: "meta", inlines: [textInl(`Imported by ${exercising.length === 1 ? "1 test" : `${exercising.length} tests`} of the run (${found.filter((t) => t.status === "passed").length} passed, ${found.filter((t) => t.status === "failed").length} failed): `), ...found.filter((t) => t.status === "failed").slice(0, 3).flatMap((t, i): Inline[] => [textInl(`${i === 0 ? "" : "; "}${t.name.replace(/^.*?: /, "").slice(0, 80)}`)]), ...(found.some((t) => t.status === "failed") ? [textInl(". ")] : []), { kind: "link", href: { kind: "page", path: `quality/${exercising[0]?.library ?? "repository"}.html` }, children: [textInl("the library's results")] }]}];
        const body = e.kinds.includes("namespace") ? [] : [...declared, ...model, ...entryBlocks(b, e, { ...scope, file: e.file }), ...tests];
        blocks.push({ kind: "entry", id: anchorOf(e.name), name: e.name, badges, signature: e.signature, blocks: body });
      }
      if (tested > 0) blocks.splice(head, 0, { kind: "meta", inlines: [textInl(`${exercised} of ${tested} exports are imported by a test of the run. A test that imports an export may not call it or check what it returns.`)] });
      b.add({
        path: m.page,
        title: m.title,
        description: m.summary || `${area.title}: ${m.title}`,
        section: "api",
        group: area.title,
        order: 100 + ai * 100 + mi + 1,
        blocks,
      });
    });
  });
}

