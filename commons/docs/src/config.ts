// Spec: 0001-docs FR-006
/**
 * The configuration a repository gives the generator (commons 0011-documentation FR-023 to FR-027, and 0001-docs FR-006), and the one place it is checked: a
 * `docs.config.ts` exports a value of `DocsConfig` (its default export, or `config`), and `resolveConfig` checks it once into a `Config`,
 * whose paths are absolute (the root, the output) or relative to the root (everything else), with every default filled. Nothing else reads
 * the raw value. The `About` types are Core's (`@intellectual-frontiers/core/about`), re-exported here so that a
 * repository's `about.ts` and its configuration are typed by this package alone.
 *
 * @example
 * ```ts
 * import type { DocsConfig } from "@intellectual-frontiers/commons/docs";
 * export default {
 *   name: "Example",
 *   repository: "https://github.com/example/example",
 *   home: { dir: ".", about: { title: "Example", summary: "What the repository is." } },
 *   packages: [{ dir: ".", slug: "example", about: { title: "Example", summary: "Its one package.", areas: [{ title: "Core", slug: "core", entryPoints: ["src/mod.ts"] }] } }],
 *   specKits: [{ layout: "spec-kit", dir: "specs" }],
 *   citations: { prefix: "example", digits: 3 },
 * } satisfies DocsConfig;
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { path } from "@intellectual-frontiers/system";
import type { Lens } from "./lens.ts";
import { ALL_SECTIONS, type Section } from "./model.ts";

import type { About } from "@intellectual-frontiers/core/about";

export type {
  AboutSpec,
  AboutFolder,
  AboutCommand,
  AboutEnforcer,
  AboutRule,
  AboutPhaseState,
  AboutPhase,
  AboutExample,
  AboutArea,
  About,
  AboutLayer,
  AboutFact,
} from "@intellectual-frontiers/core/about";


/** A package the site shows: its folder, its name in the site's addresses, and its `About`. */
export interface PackageConfig {
  /** Its folder, from the repository's root (`.` for the root itself). */
  readonly dir: string;
  /** Its name in the site's addresses: lower-case words joined by hyphens. */
  readonly slug: string;
  /** The path of its `about.ts` from its folder (`about.ts` by default), or its `About` value itself (commons 0011-documentation FR-027). */
  readonly about?: string | About;
}

/** The home page's source: a folder and its `About`. */
export interface HomeConfig {
  /** Its folder, from the repository's root (`.` for the root itself). */
  readonly dir: string;
  /** The path of its `about.ts` from its folder (`about.ts` by default), or its `About` value itself. */
  readonly about?: string | About;
}

/**
 * A spec kit and its layout (commons 0011-documentation FR-024): commons' (`registry.tsv`, `enforcement.tsv`, `specs/NNNN-slug/spec.md` under `dir`), or the plain
 * layout of Spec Kit (`dir` holds `NNN-slug/spec.md`, each with an optional `reviewed.tsv`, and a constitution).
 */
export type SpecKitConfig =
  | {
    /** Commons' layout. */
    readonly layout: "commons";
    /** The folder that holds `registry.tsv`, from the repository's root. */
    readonly dir: string;
  }
  | {
    /** The plain layout of Spec Kit. */
    readonly layout: "spec-kit";
    /** The folder that holds the specifications' folders, from the repository's root (`specs`). */
    readonly dir: string;
    /** The constitution, from the repository's root: `.specify/memory/constitution.md` by default, `false` for none. */
    readonly constitution?: string | false;
  };

/** A repository whose specifications may be linked: a public one whose site this generator makes (commons 0011-documentation FR-025). */
export interface LinkedRepository {
  /** Its name, as a citation's qualifier (`commons`). */
  readonly repo: string;
  /** The address of its site, ending in `/`: a specification is `<site>specs/<id>.html`. */
  readonly site: string;
  /** The digits of its specifications' numbers. */
  readonly digits: number;
}

/** How the repository's specifications are cited, and which other repositories' citations are links (commons 0011-documentation FR-025). */
export interface CitationsConfig {
  /** The repository's own prefix: `commons 0011-documentation`. */
  readonly prefix: string;
  /** The digits of its specifications' numbers: 4 in commons, 3 in a plain Spec Kit. */
  readonly digits: number;
  /** The public repositories whose citations become links to their sites. */
  readonly linked?: readonly LinkedRepository[];
  /** The repositories whose citations are only shown as text. */
  readonly text?: readonly string[];
}

/** The presentations of the pages (docs 0001-docs FR-007): the static site, the Markdown twins with `llms.txt`, the JSON a lens adds, and the AsciiDoc of the volumes of a book. */
export const PRESENTATION_IDS = ["web", "markdown", "data", "book"] as const;

/** The name of a presentation. */
export type PresentationId = (typeof PRESENTATION_IDS)[number];

/** The presentations `build` writes when none is named: the site as it has always been. */
export const DEFAULT_PRESENTATIONS: readonly PresentationId[] = ["web", "markdown", "data"];

/** Which pages a part of a volume takes (docs 0001-docs FR-008): those of a section, of a group of it, under a path, and not under another. */
export interface PageSelector {
  /** The section. */
  readonly section?: Section;
  /** The group of the section's navigation. */
  readonly group?: string;
  /** A path from the site's root that the page's path begins with. */
  readonly prefix?: string;
  /** Paths from the site's root that the page's path must not begin with. */
  readonly exclude?: readonly string[];
}

/** A part of a volume: a title, a line, and the pages it takes (a page is in the first part that takes it). */
export interface BookPart {
  /** Its title. */
  readonly title: string;
  /** What it holds, in a sentence. */
  readonly about?: string;
  /** The pages, selector by selector, each in the order of the site's navigation. */
  readonly select: readonly PageSelector[];
  /** Make a part of each group of the pages it takes, titled by the group, in place of one part (the API, library by library). */
  readonly perGroup?: boolean;
}

/** A volume of a book: the slug of the book of `erga` it is a chapter source of, and its parts. */
export interface BookVolume {
  /** Its slug: the book's folder, and the name of the file it is written to. */
  readonly id: string;
  /** Its title. */
  readonly title: string;
  /** What it is, in a sentence. */
  readonly about: string;
  /** Its parts, in order. */
  readonly parts: readonly BookPart[];
}

/** What the book presentation writes (docs 0001-docs FR-008): the volumes, and where a link to a page outside the volume goes. */
export interface BooksConfig {
  /** The address of the site, ending in `/`: a link to a page that is not in the volume goes there; with none it is only its text. */
  readonly site?: string;
  /** The volumes. */
  readonly volumes: readonly BookVolume[];
}

/** The configuration a repository gives (commons 0011-documentation FR-023), as its `docs.config.ts` exports it. */
export interface DocsConfig {
  /** The site's name, at the top of every page. */
  readonly name: string;
  /** How the site's prose names the repository (`commons`); the site's name by default. */
  readonly subject?: string;
  /** The repository's root, from the configuration's folder; `.` by default. */
  readonly root?: string;
  /** The repository's address on GitHub, for the top bar and the links to files the site does not show. */
  readonly repository: string;
  /** The branch the links to files name; `main` by default. */
  readonly branch?: string;
  /** Where the home page comes from. */
  readonly home: HomeConfig;
  /** The packages, in the order the site shows them. */
  readonly packages: readonly PackageConfig[];
  /** The spec kits; none by default. */
  readonly specKits?: readonly SpecKitConfig[];
  /** How specifications are cited. */
  readonly citations: CitationsConfig;
  /** The lenses (commons 0011-documentation FR-026); none by default. */
  readonly lenses?: readonly Lens[];
  /** The folder of the lint rules an `about` may name, as `<rule>.ts`, from the root; a lint rule is not checked without it. */
  readonly lintRules?: string;
  /** Names that must not appear on any page of the site (a retired library, a product that is gone): a page that names one is a finding. */
  readonly retired?: readonly string[];
  /** Words that must not appear on the pages that people write (the sections Start here, Concepts and How-to): a page that has one is a finding. */
  readonly forbiddenInGuides?: readonly string[];
  /** Where `build` writes the site, from the root; `_site` by default. */
  readonly out?: string;
  /** The presentations `build` writes when the command line names none; the site, the Markdown and the data by default. */
  readonly presentations?: readonly PresentationId[];
  /** The volumes of the book presentation (docs 0001-docs FR-008); none by default. */
  readonly books?: BooksConfig;
}

/** A package as the build reads it: its folder from the root (`""` for the root), its name, and where its `About` is. */
export interface PackageSource {
  /** Its folder, from the root: `""` for the root itself. */
  readonly dir: string;
  /** Its name in the site's addresses. */
  readonly slug: string;
  /** Its `about.ts`, from the root, or its `About` value. */
  readonly about: { readonly kind: "file"; readonly file: string } | { readonly kind: "value"; readonly value: About };
}

/** A spec kit as the build reads it, its folders from the root. */
export type SpecKitSource =
  | { readonly layout: "commons"; readonly dir: string }
  | { readonly layout: "spec-kit"; readonly dir: string; readonly constitution: string | undefined };

/** The configuration checked (commons 0011-documentation FR-023): every path absolute or from the root, every default filled. */
export interface Config {
  /** The configuration's file, absolute. */
  readonly file: string;
  /** The configuration's file, from the root, for findings. */
  readonly fileFromRoot: string;
  /** The repository's root, absolute. */
  readonly root: string;
  /** The site's name. */
  readonly name: string;
  /** How the prose names the repository. */
  readonly subject: string;
  /** The repository's address on GitHub. */
  readonly repository: string;
  /** The branch of links to files. */
  readonly branch: string;
  /** The home page's source; its slug is unused. */
  readonly home: PackageSource;
  /** The packages. */
  readonly packages: readonly PackageSource[];
  /** The spec kits. */
  readonly specKits: readonly SpecKitSource[];
  /** How specifications are cited. */
  readonly citations: {
    readonly prefix: string;
    readonly digits: number;
    readonly linked: readonly LinkedRepository[];
    readonly text: readonly string[];
  };
  /** The lenses. */
  readonly lenses: readonly Lens[];
  /** The folder of the lint rules, from the root. */
  readonly lintRules: string | undefined;
  /** Names that must not appear on any page. */
  readonly retired: readonly string[];
  /** Words that must not appear on the pages people write. */
  readonly forbiddenInGuides: readonly string[];
  /** Where `build` writes the site, absolute. */
  readonly out: string;
  /** The presentations written by default. */
  readonly presentations: readonly PresentationId[];
  /** The volumes of the book presentation. */
  readonly books: BooksConfig;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * A folder from the root, as the build writes it: no `./`, no trailing `/`, and `""` for the root.
 *
 * @param dir - the folder as written
 */
export function normalDir(dir: string): string {
  const parts = dir.split(/[\\/]+/).filter((p) => p !== "" && p !== ".");
  return parts.join("/");
}

/**
 * A path inside a folder from the root, where the folder may be the root (`""`).
 *
 * @param dir - the folder, from the root
 * @param rel - the path inside it
 */
export function under(dir: string, rel: string): string {
  const r = normalDir(rel);
  return dir === "" ? r : r === "" ? dir : `${dir}/${r}`;
}

/** Whether a value has the fields every `About` has, and areas of the right shape where it has them. */
export function isAbout(v: unknown): v is About {
  if (!isRecord(v) || typeof v["title"] !== "string" || typeof v["summary"] !== "string") return false;
  const areas = v["areas"];
  if (areas === undefined) return true;
  return Array.isArray(areas) &&
    areas.every((a: unknown) =>
      isRecord(a) && typeof a["title"] === "string" && typeof a["slug"] === "string" && Array.isArray(a["entryPoints"]) &&
      a["entryPoints"].every((e: unknown) => typeof e === "string")
    );
}

/** Whether a value is a lens: a name and a `read` function. */
function isLens(v: unknown): v is Lens {
  return isRecord(v) && typeof v["name"] === "string" && typeof v["read"] === "function";
}

/** The books of a configuration checked (docs 0001-docs FR-008): a volume's slug, title and parts, and a selector's section. */
function booksOf(v: unknown, bad: (what: string) => void): BooksConfig {
  if (v === undefined) return { volumes: [] };
  if (!isRecord(v)) {
    bad("books must be an object: { site?, volumes }");
    return { volumes: [] };
  }
  const site = v["site"];
  if (site !== undefined && (typeof site !== "string" || !/^https:\/\/\S+\/$/.test(site))) bad("books.site must be an https address ending in /");
  const raw = v["volumes"];
  if (!Array.isArray(raw)) {
    bad("books.volumes must be an array of { id, title, about, parts }");
    return { volumes: [] };
  }
  const volumes: BookVolume[] = [];
  const text = (x: unknown, where: string): string => {
    if (typeof x === "string" && x.trim() !== "") return x;
    bad(`${where} must be a non-empty string`);
    return "";
  };
  raw.forEach((x: unknown, i) => {
    const where = `books.volumes[${i}]`;
    if (!isRecord(x)) return bad(`${where} must be an object: { id, title, about, parts }`);
    const id = text(x["id"], `${where}.id`);
    if (id !== "" && !SLUG.test(id)) bad(`${where}.id ${JSON.stringify(id)} must be lower-case words joined by hyphens`);
    if (volumes.some((o) => o.id === id)) bad(`${where}.id ${id} names two volumes`);
    const parts: BookPart[] = [];
    const rawParts = x["parts"];
    if (!Array.isArray(rawParts) || rawParts.length === 0) bad(`${where}.parts must be a non-empty array of { title, select }`);
    else {
      rawParts.forEach((p: unknown, j) => {
        const at = `${where}.parts[${j}]`;
        if (!isRecord(p)) return bad(`${at} must be an object: { title, about?, select }`);
        const select: PageSelector[] = [];
        const rawSelect = p["select"];
        if (!Array.isArray(rawSelect) || rawSelect.length === 0) bad(`${at}.select must be a non-empty array of selectors`);
        else {
          rawSelect.forEach((s: unknown, k) => {
            const sel = `${at}.select[${k}]`;
            if (!isRecord(s)) return bad(`${sel} must be an object: { section?, group?, prefix?, exclude? }`);
            const section = ALL_SECTIONS.find((a) => a === s["section"]);
            if (s["section"] !== undefined && section === undefined) bad(`${sel}.section ${JSON.stringify(s["section"])} must be one of ${ALL_SECTIONS.join(", ")}`);
            const exclude = s["exclude"] ?? [];
            if (!Array.isArray(exclude) || !exclude.every((e: unknown) => typeof e === "string")) bad(`${sel}.exclude must be an array of paths`);
            if (s["group"] !== undefined && typeof s["group"] !== "string") bad(`${sel}.group must be a string`);
            if (s["prefix"] !== undefined && typeof s["prefix"] !== "string") bad(`${sel}.prefix must be a string`);
            if (section === undefined && s["prefix"] === undefined) bad(`${sel} names neither a section nor a prefix`);
            select.push({
              ...(section === undefined ? {} : { section }),
              ...(typeof s["group"] === "string" ? { group: s["group"] } : {}),
              ...(typeof s["prefix"] === "string" ? { prefix: s["prefix"] } : {}),
              ...(Array.isArray(exclude) ? { exclude: exclude.map(String) } : {}),
            });
          });
        }
        parts.push({ title: text(p["title"], `${at}.title`), ...(typeof p["about"] === "string" ? { about: p["about"] } : {}), select, ...(p["perGroup"] === true ? { perGroup: true } : {}) });
      });
    }
    volumes.push({ id, title: text(x["title"], `${where}.title`), about: text(x["about"], `${where}.about`), parts });
  });
  return { ...(typeof site === "string" ? { site } : {}), volumes };
}

/**
 * A configuration checked into its resolved form, or every problem with it (commons 0011-documentation FR-023).
 *
 * @param value - what the configuration's module exports
 * @param file - the configuration's file, absolute
 */
export function resolveConfig(value: unknown, file: string): Result<Config, string[]> {
  const problems: string[] = [];
  const bad = (what: string): void => void problems.push(what);
  if (!isRecord(value)) return err(["the configuration is not an object: export a value of DocsConfig as default, or as config"]);
  const str = (key: string, where: string, v: unknown = value[key]): string | undefined => {
    if (typeof v === "string" && v.trim() !== "") return v;
    bad(`${where} must be a non-empty string`);
    return undefined;
  };
  const optStr = (key: string, where: string, v: unknown = value[key]): string | undefined => (v === undefined ? undefined : str(key, where, v));
  const name = str("name", "name") ?? "";
  const subject = optStr("subject", "subject") ?? name;
  const root = path.resolve(path.dirname(file), optStr("root", "root") ?? ".");
  const repository = str("repository", "repository") ?? "";
  if (repository !== "" && !/^https:\/\/\S+[^/]$/.test(repository)) bad("repository must be an https address with no trailing /");
  const branch = optStr("branch", "branch") ?? "main";
  const aboutOf = (v: unknown, dir: string, where: string): PackageSource["about"] => {
    if (v === undefined || typeof v === "string") return { kind: "file", file: under(dir, v ?? "about.ts") };
    if (isAbout(v)) return { kind: "value", value: v };
    bad(`${where}.about must be the path of an about.ts or an About value (a title, a summary, and areas with a title, a slug and entry points)`);
    return { kind: "value", value: { title: "", summary: "" } };
  };
  const home = value["home"];
  let homeSource: PackageSource = { dir: "", slug: "home", about: { kind: "value", value: { title: name, summary: "" } } };
  if (!isRecord(home)) bad("home must be an object: { dir, about? }");
  else {
    const dir = normalDir(str("dir", "home.dir", home["dir"]) ?? ".");
    homeSource = { dir, slug: "home", about: aboutOf(home["about"], dir, "home") };
  }
  const packages: PackageSource[] = [];
  const rawPackages = value["packages"];
  if (!Array.isArray(rawPackages)) bad("packages must be an array of { dir, slug, about? }");
  else {
    rawPackages.forEach((p: unknown, i) => {
      const where = `packages[${i}]`;
      if (!isRecord(p)) return bad(`${where} must be an object: { dir, slug, about? }`);
      const dir = normalDir(str("dir", `${where}.dir`, p["dir"]) ?? ".");
      const slug = str("slug", `${where}.slug`, p["slug"]);
      if (slug === undefined) return;
      if (!SLUG.test(slug)) return bad(`${where}.slug ${JSON.stringify(slug)} must be lower-case words joined by hyphens`);
      if (packages.some((q) => q.slug === slug)) return bad(`${where}.slug ${slug} names two packages`);
      packages.push({ dir, slug, about: aboutOf(p["about"], dir, where) });
    });
  }
  const specKits: SpecKitSource[] = [];
  const rawKits = value["specKits"] ?? [];
  if (!Array.isArray(rawKits)) bad("specKits must be an array");
  else {
    rawKits.forEach((k: unknown, i) => {
      const where = `specKits[${i}]`;
      if (!isRecord(k)) return bad(`${where} must be an object: { layout, dir }`);
      const dir = normalDir(str("dir", `${where}.dir`, k["dir"]) ?? "");
      const layout = k["layout"];
      if (layout === "commons") specKits.push({ layout, dir });
      else if (layout === "spec-kit") {
        const c = k["constitution"];
        if (c !== undefined && c !== false && typeof c !== "string") return bad(`${where}.constitution must be a path or false`);
        specKits.push({ layout, dir, constitution: c === false ? undefined : normalDir(c ?? ".specify/memory/constitution.md") });
      } else bad(`${where}.layout must be "commons" or "spec-kit"`);
    });
  }
  const c = value["citations"];
  const digitsOf = (v: unknown, where: string): number => {
    if (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 9) return v;
    bad(`${where} must be a whole number from 1 to 9`);
    return 4;
  };
  let citations: Config["citations"] = { prefix: "", digits: 4, linked: [], text: [] };
  if (!isRecord(c)) bad("citations must be an object: { prefix, digits, linked?, text? }");
  else {
    const prefix = (str("prefix", "citations.prefix", c["prefix"]) ?? "").toLowerCase();
    const digits = digitsOf(c["digits"], "citations.digits");
    const linked: LinkedRepository[] = [];
    const rawLinked = c["linked"] ?? [];
    if (!Array.isArray(rawLinked)) bad("citations.linked must be an array");
    else {
      rawLinked.forEach((l: unknown, i) => {
        const where = `citations.linked[${i}]`;
        if (!isRecord(l)) return bad(`${where} must be an object: { repo, site, digits }`);
        const repo = str("repo", `${where}.repo`, l["repo"]);
        const site = str("site", `${where}.site`, l["site"]);
        const d = digitsOf(l["digits"], `${where}.digits`);
        if (site !== undefined && !/^https:\/\/\S+\/$/.test(site)) return bad(`${where}.site must be an https address ending in /`);
        if (repo !== undefined && site !== undefined) linked.push({ repo: repo.toLowerCase(), site, digits: d });
      });
    }
    const rawText = c["text"] ?? [];
    const text: string[] = [];
    if (!Array.isArray(rawText) || !rawText.every((t: unknown) => typeof t === "string")) bad("citations.text must be an array of names");
    else for (const t of rawText) text.push(String(t).toLowerCase());
    for (const r of linked) if (r.repo === prefix || text.includes(r.repo)) bad(`citations: ${r.repo} is named twice`);
    citations = { prefix, digits, linked, text };
  }
  const rawLenses = value["lenses"] ?? [];
  const lenses: Lens[] = [];
  if (!Array.isArray(rawLenses)) bad("lenses must be an array of Lens values");
  else rawLenses.forEach((l: unknown, i) => (isLens(l) ? void lenses.push(l) : bad(`lenses[${i}] is not a Lens: { name, read }`)));
  const names = (key: string): string[] => {
    const v = value[key];
    if (v === undefined) return [];
    if (!Array.isArray(v) || !v.every((x: unknown) => typeof x === "string" && x !== "")) {
      bad(`${key} must be an array of non-empty strings`);
      return [];
    }
    return v.map(String);
  };
  const retired = names("retired");
  const forbiddenInGuides = names("forbiddenInGuides");
  const lint = optStr("lintRules", "lintRules");
  const out = path.resolve(root, optStr("out", "out") ?? "_site");
  const presentations: PresentationId[] = [];
  const rawPresentations = value["presentations"];
  if (rawPresentations === undefined) presentations.push(...DEFAULT_PRESENTATIONS);
  else if (!Array.isArray(rawPresentations) || rawPresentations.length === 0) bad(`presentations must be a non-empty array of ${PRESENTATION_IDS.join(", ")}`);
  else {
    for (const p of rawPresentations) {
      const id = PRESENTATION_IDS.find((x) => x === p);
      if (id === undefined) bad(`presentations names ${JSON.stringify(p)}: one of ${PRESENTATION_IDS.join(", ")}`);
      else if (!presentations.includes(id)) presentations.push(id);
    }
  }
  const books = booksOf(value["books"], bad);
  if (presentations.includes("book") && books.volumes.length === 0) bad("presentations names book, and books names no volume");
  if (problems.length > 0) return err(problems);
  return ok({
    file,
    fileFromRoot: path.relative(root, file).split(path.sep).join("/"),
    root,
    name,
    subject,
    repository,
    branch,
    home: homeSource,
    packages,
    specKits,
    citations,
    lenses,
    lintRules: lint === undefined ? undefined : normalDir(lint),
    retired,
    forbiddenInGuides,
    out,
    presentations,
    books,
  });
}
