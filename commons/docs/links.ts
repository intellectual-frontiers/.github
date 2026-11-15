/**
 * Where the words of documentation link to (commons 0011-documentation FR-011, FR-012): a citation of a specification of commons
 * (`commons 0009-sql-aide`, a bare `0009-sql-aide`, `FR-026` after either, or a bare `FR-045` in an area, which names a requirement of the
 * area's specification) becomes a link to the specification's page and the requirement's anchor; a specification of another repository
 * (`erga 009-machine-bootstrap`) stays text, since this repository is public; a Markdown link to a file of the checkout goes to the page
 * that shows the file, or to the file on GitHub; and `{@link name}` goes to the export it names. What does not resolve is a finding.
 *
 * @module
 */
import type { Finding } from "./check.ts";
import { type InlineContext, plainContext } from "./markdown.ts";
import type { Href, Inline } from "./model.ts";

/** The repositories whose specifications are cited by name and never linked. */
const OTHERS: ReadonlySet<string> = new Set(["erga", "erga's", "archon", "archon's", "stolos", "stolos'", "thyra"]);

/** What the links of a page can reach: the specifications and their requirements, the pages of source files, and the exports. */
export interface LinkIndex {
  /** Each specification of commons, by its folder's name, with its requirements and criteria. */
  readonly specs: ReadonlyMap<string, ReadonlySet<string>>;
  /** The page that shows each file of the checkout, by its path from the checkout's root. */
  readonly files: ReadonlyMap<string, string>;
  /** Each export's page and anchor, by area and name. */
  readonly exports: ReadonlyMap<string, ReadonlyMap<string, { readonly path: string; readonly anchor: string }>>;
  /** The address of a file of the checkout on GitHub. */
  readonly blob: (repoPath: string) => string;
  /** Told of every citation that became a link: the specification, the requirement where one is named, and the page it is on. */
  readonly cited?: (spec: string, requirement: string | undefined, page: string) => void;
}

/** Where a page's words are: the page, the file they come from, the area and the specification a bare requirement names. */
export interface LinkScope {
  /** The page the links are on. */
  readonly page: string;
  /** The file of the checkout the words are in, from the checkout's root, for relative links and for findings. */
  readonly file: string;
  /** The area whose exports `{@link name}` names first. */
  readonly area?: string;
  /** The specification a bare `FR-nnn` is a requirement of. */
  readonly spec?: string;
}

/** The page of a specification. */
export const specPage = (id: string): string => `specs/${id}.html`;

const CITE = /(?:(?<![\w-])([A-Za-z][\w.'-]*) )?(?<![\w-])(\d{3,}-[a-z][a-z0-9]*(?:-[a-z0-9]+)*)|(?<![\w-])((?:FR|SC)-\d{3})(?![\w-])/g;

/**
 * The citations of a run of text, made links.
 *
 * @param text - the run
 * @param index - what links can reach
 * @param scope - where the run is
 * @param found - where findings go
 */
export function cite(text: string, index: LinkIndex, scope: LinkScope, found: Finding[]): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  let current = scope.spec;
  let other = false;
  const plainText = (t: string): void => {
    if (t === "") return;
    const prev = out[out.length - 1];
    if (prev !== undefined && prev.kind === "text") out[out.length - 1] = { kind: "text", text: prev.text + t };
    else out.push({ kind: "text", text: t });
  };
  for (const m of text.matchAll(CITE)) {
    const at = m.index;
    const [whole, qualifier, id, req] = m;
    if (id !== undefined) {
      const q = qualifier?.toLowerCase();
      if ((q !== undefined && OTHERS.has(q)) || !/^\d{4,}-/.test(id)) {
        other = true;
        continue;
      }
      other = false;
      const start = q === "commons" ? at : at + whole.length - id.length;
      plainText(text.slice(last, start));
      if (index.specs.has(id)) {
        current = id;
        index.cited?.(id, undefined, scope.page);
        out.push({ kind: "link", href: { kind: "page", path: specPage(id) }, children: [{ kind: "text", text: text.slice(start, at + whole.length) }] });
      } else {
        found.push({ where: scope.file, problem: { kind: "unknown-spec", cite: id } });
        plainText(text.slice(start, at + whole.length));
      }
      last = at + whole.length;
      continue;
    }
    if (req === undefined || other || current === undefined) continue;
    plainText(text.slice(last, at));
    const has = index.specs.get(current)?.has(req) ?? false;
    if (has) index.cited?.(current, req, scope.page);
    if (has) out.push({ kind: "link", href: { kind: "page", path: specPage(current), anchor: req.toLowerCase() }, children: [{ kind: "text", text: req }] });
    else {
      found.push({ where: scope.file, problem: { kind: "unknown-requirement", cite: `${current} ${req}` } });
      plainText(req);
    }
    last = at + whole.length;
  }
  plainText(text.slice(last));
  return out;
}

/** A path of the checkout, from a link's destination written in a file. */
function resolveFrom(file: string, dest: string): string {
  const parts = file.split("/").slice(0, -1);
  for (const seg of dest.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg !== "." && seg !== "") parts.push(seg);
  }
  return parts.join("/");
}

/**
 * Where a Markdown link's destination goes, from the file it is written in.
 *
 * @param dest - the destination as written
 * @param index - what links can reach
 * @param scope - where the link is
 */
export function hrefFor(dest: string, index: LinkIndex, scope: LinkScope): Href {
  if (/^[a-z][a-z0-9+.-]*:/i.test(dest)) return { kind: "external", url: dest };
  if (dest.startsWith("#")) return { kind: "page", path: scope.page, anchor: dest.slice(1) };
  const [p = "", anchor] = dest.split("#");
  const target = resolveFrom(scope.file, p);
  const spec = /^commons\/spec-kit\/specs\/([^/]+)\/spec\.md$/.exec(target)?.[1];
  if (spec !== undefined && index.specs.has(spec)) return { kind: "page", path: specPage(spec), ...(anchor === undefined ? {} : { anchor }) };
  const page = index.files.get(target) ?? index.files.get(target.replace(/\/$/, ""));
  if (page !== undefined) return { kind: "page", path: page, ...(anchor === undefined ? {} : { anchor }) };
  return { kind: "external", url: index.blob(target) };
}

/**
 * The inlines `{@link name}` becomes: a link to the export, in the scope's area or in the area named before `!`.
 *
 * @param name - what it names: `table`, or `sql-aide!table`
 * @param label - the text to show, where one is given
 * @param index - what links can reach
 * @param scope - where the link is
 * @param found - where findings go
 */
export function linkFor(name: string, label: string | undefined, index: LinkIndex, scope: LinkScope, found: Finding[]): Inline[] {
  const bang = name.indexOf("!");
  const area = bang < 0 ? scope.area : name.slice(0, bang);
  const sym = bang < 0 ? name : name.slice(bang + 1);
  const base = sym.split(".")[0] ?? "";
  const target = area === undefined ? undefined : index.exports.get(area)?.get(base);
  const shown: Inline = { kind: "code", text: label ?? sym };
  if (target === undefined) {
    found.push({ where: scope.file, problem: { kind: "unknown-link", name } });
    return [shown];
  }
  return [{ kind: "link", href: { kind: "page", path: target.path, anchor: target.anchor }, children: [shown] }];
}

/**
 * The context `markdown.ts` reads a page's words with: citations, file links and `{@link}` resolved through the index.
 *
 * @param index - what links can reach
 * @param scope - where the words are
 * @param found - where findings go
 */
export function contextFor(index: LinkIndex, scope: LinkScope, found: Finding[]): InlineContext {
  return {
    ...plainContext,
    href: (dest) => hrefFor(dest, index, scope),
    link: (name, label) => linkFor(name, label, index, scope, found),
    cite: (t) => cite(t, index, scope, found),
  };
}
