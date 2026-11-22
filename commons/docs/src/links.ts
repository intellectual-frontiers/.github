// Spec: 0001-docs FR-001
/**
 * Where the words of documentation link to (commons 0011-documentation FR-011, FR-012, FR-025): a citation of a specification of the
 * repository (its prefix and an id, as `commons 0009-example`; a bare id of its own form, as `0009-example` in commons or
 * `096-bun-runtime` in Stolos; a number of its digits after `spec` or before a requirement, as `spec 004` or `038 FR-014`, where a
 * specification has that number; `FR-026` after any of these; or a bare `FR-045` in an area, which names a requirement of the area's
 * specification) becomes a link to the specification's page and the requirement's anchor; a citation of a repository the configuration
 * lists as linked goes to that repository's site; one of any other repository (`erga 009-machine-bootstrap`) stays text; a Markdown link
 * to a file of the repository goes to the page that shows the file, or to the file on GitHub; and `{@link name}` goes to the export it
 * names. What does not resolve is a finding.
 *
 * @module
 */
import type { Finding } from "./check.ts";
import type { LinkedRepository } from "./config.ts";
import { type InlineContext, plainContext } from "./markdown.ts";
import type { Href, Inline } from "./model.ts";

/** How specifications are cited: the repository's own prefix and digits, the repositories linked, and those shown as text. */
export interface CitationRules {
  /** The repository's own prefix, in lower case. */
  readonly prefix: string;
  /** The digits of its specifications' numbers. */
  readonly digits: number;
  /** The repositories whose citations go to their sites. */
  readonly linked: readonly LinkedRepository[];
  /** The repositories whose citations are text, in lower case. */
  readonly text: readonly string[];
}

/** What the links of a page can reach: the specifications and their requirements, the pages of source files, and the exports. */
export interface LinkIndex {
  /** Each specification of the repository, by its folder's name, with its requirements and criteria. */
  readonly specs: ReadonlyMap<string, ReadonlySet<string>>;
  /** How specifications are cited. */
  readonly citations: CitationRules;
  /** The page that shows each file of the repository, by its path from the root. */
  readonly files: ReadonlyMap<string, string>;
  /** Each export's page and anchor, by area and name. */
  readonly exports: ReadonlyMap<string, ReadonlyMap<string, { readonly path: string; readonly anchor: string }>>;
  /** The address of a file of the repository on GitHub. */
  readonly blob: (repoPath: string) => string;
  /** Told of every citation that became a link: the specification, the requirement where one is named, and the page it is on. */
  readonly cited?: (spec: string, requirement: string | undefined, page: string) => void;
}

/** Where a page's words are: the page, the file they come from, the area and the specification a bare requirement names. */
export interface LinkScope {
  /** The page the links are on. */
  readonly page: string;
  /** The file of the repository the words are in, from the root, for relative links and for findings. */
  readonly file: string;
  /** The area whose exports `{@link name}` names first. */
  readonly area?: string;
  /** The specification a bare `FR-nnn` is a requirement of. */
  readonly spec?: string;
}

/** The page of a specification. */
export const specPage = (id: string): string => `specs/${id}.html`;

// A qualifier and an id (`commons 0009-example`), a requirement (`FR-026`), or a number alone after `spec` or before a requirement
// (`spec 004`, `038 FR-014`), which names the specification with that number.
const CITE =
  /(?:(?<![\w-])([A-Za-z][\w.'-]*) )?(?<![\w-])(\d{3,}-[a-z][a-z0-9]*(?:-[a-z0-9]+)*)|(?<![\w-])((?:FR|SC)-\d{3}[a-z]?)(?![\w-])|(?<![\w-])(?:[Ss]pecs? (\d{3,})|(\d{3,})(?= (?:FR|SC)-\d{3}))(?![\w-])/g;

/** A qualifier as the configuration names repositories: lower case, with a possessive `'s` or `'` taken off. */
export const qualifierOf = (q: string): string => q.toLowerCase().replace(/'s?$/, "");

/** Whether an id has a number of so many digits. */
const hasDigits = (id: string, digits: number): boolean => new RegExp(`^\\d{${digits}}-`).test(id);

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
  const rules = index.citations;
  let current = scope.spec;
  let other = false;
  let away: { readonly site: string; readonly id: string } | undefined;
  const plainText = (t: string): void => {
    if (t === "") return;
    const prev = out[out.length - 1];
    if (prev !== undefined && prev.kind === "text") out[out.length - 1] = { kind: "text", text: prev.text + t };
    else out.push({ kind: "text", text: t });
  };
  for (const m of text.matchAll(CITE)) {
    const at = m.index;
    const [whole, qualifier, id, req, afterSpec, beforeReq] = m;
    const number = afterSpec ?? beforeReq;
    if (number !== undefined) {
      const numbered = number.length === rules.digits ? [...index.specs.keys()].find((k) => k.startsWith(`${number}-`)) : undefined;
      away = undefined;
      other = numbered === undefined;
      if (numbered === undefined) continue;
      current = numbered;
      index.cited?.(numbered, undefined, scope.page);
      plainText(text.slice(last, at));
      out.push({ kind: "link", href: { kind: "page", path: specPage(numbered) }, children: [{ kind: "text", text: whole }] });
      last = at + whole.length;
      continue;
    }
    if (id !== undefined) {
      const q = qualifier?.toLowerCase();
      const named = q === undefined ? undefined : qualifierOf(q);
      const linked = rules.linked.find((r) => r.repo === named);
      away = undefined;
      if (linked !== undefined && hasDigits(id, linked.digits)) {
        other = false;
        away = { site: linked.site, id };
        plainText(text.slice(last, at));
        out.push({ kind: "link", href: { kind: "external", url: `${linked.site}${specPage(id)}` }, children: [{ kind: "text", text: whole }] });
        last = at + whole.length;
        continue;
      }
      if ((named !== undefined && (rules.text.includes(named) || linked !== undefined)) || !hasDigits(id, rules.digits)) {
        other = true;
        continue;
      }
      other = false;
      const start = q === rules.prefix ? at : at + whole.length - id.length;
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
    if (req === undefined || other) continue;
    if (away !== undefined) {
      plainText(text.slice(last, at));
      out.push({ kind: "link", href: { kind: "external", url: `${away.site}${specPage(away.id)}#${req.toLowerCase()}` }, children: [{ kind: "text", text: req }] });
      last = at + whole.length;
      continue;
    }
    if (current === undefined) continue;
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
 * @param dest - the destination as written (`site:quality/index.html` names a page of the site that no file makes, and the check of the links finds it where it is not there)
 * @param index - what links can reach
 * @param scope - where the link is
 */
export function hrefFor(dest: string, index: LinkIndex, scope: LinkScope): Href {
  if (dest.startsWith("site:")) {
    const [sitePath = "", siteAnchor] = dest.slice("site:".length).split("#");
    return { kind: "page", path: sitePath, ...(siteAnchor === undefined ? {} : { anchor: siteAnchor }) };
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(dest)) return { kind: "external", url: dest };
  if (dest.startsWith("#")) return { kind: "page", path: scope.page, anchor: dest.slice(1) };
  const [p = "", anchor] = dest.split("#");
  const target = resolveFrom(scope.file, p);
  const page = index.files.get(target) ?? index.files.get(target.replace(/\/$/, ""));
  if (page !== undefined) return { kind: "page", path: page, ...(anchor === undefined ? {} : { anchor }) };
  return { kind: "external", url: index.blob(target) };
}

/**
 * The inlines `{@link name}` becomes: a link to the export, in the area named before `!`, or else in the scope's area, or else the one
 * export of that name in any area.
 *
 * @param name - what it names: `table`, or `data!table`
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
  const own = area === undefined ? undefined : index.exports.get(area)?.get(base);
  const elsewhere = bang >= 0 || own !== undefined ? [] : [...index.exports.values()].flatMap((m) => {
    const t = m.get(base);
    return t === undefined ? [] : [t];
  });
  const unique = new Set(elsewhere.map((t) => `${t.path}#${t.anchor}`)).size === 1 ? elsewhere[0] : undefined;
  const target = own ?? unique;
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
