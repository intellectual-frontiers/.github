/**
 * The configuration a repository gives the generator (commons 0011-documentation FR-023 to FR-027), and the one place it is checked: a
 * `docs.config.ts` exports a value of `DocsConfig` (its default export, or `config`), and `resolveConfig` checks it once into a `Config`,
 * whose paths are absolute (the root, the output) or relative to the root (everything else), with every default filled. Nothing else reads
 * the raw value. The `About` types are the ones the kernel of IFC TypeScript has (`kernel/documentation.ts`), kept here so that a
 * repository's `about.ts` and its configuration are typed by `@intellectual-frontiers/commons/docs` alone.
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

/** A specification, by its repository and its folder's name (`commons`, `0009-sql-aide`). Only the repository's own become links. */
export interface AboutSpec {
  /** The repository whose spec kit holds it. */
  readonly repo: string;
  /** The specification's folder: its number and its slug. */
  readonly id: string;
}

/** A folder of the part, with what it is and what its files may import. */
export interface AboutFolder {
  /** The folder (or file), relative to the `about.ts` that names it, as `kernel/` or `runtime/test.ts`. */
  readonly path: string;
  /** What it holds, in a sentence of Markdown. */
  readonly what: string;
  /** What its files may import, each in a few words (`kernel/ only`, `node: builtins`). */
  readonly mayImport: readonly string[];
}

/** A command that works on the part, run from the folder of its `about.ts`. */
export interface AboutCommand {
  /** The command line, as a person types it. */
  readonly run: string;
  /** What it does, in a sentence. */
  readonly does: string;
}

/** What enforces a rule: a test file, a rule of the lint plugin, an option of the compiler, or a person's review. */
export type AboutEnforcer =
  | { readonly kind: "test"; readonly file: string }
  | { readonly kind: "lint"; readonly rule: string }
  | { readonly kind: "compiler"; readonly option: string }
  | { readonly kind: "review" };

/** A rule the part keeps, and what enforces it. */
export interface AboutRule {
  /** The rule, in a sentence of Markdown. */
  readonly rule: string;
  /** What enforces it. */
  readonly enforcedBy: readonly AboutEnforcer[];
}

/** Whether a phase of the work is done. */
export type AboutPhaseState = "here" | "not yet";

/** A phase of a library that is built a phase at a time. */
export interface AboutPhase {
  /** Its number. */
  readonly n: number;
  /** What it brings, in a line. */
  readonly what: string;
  /** Whether it is done. */
  readonly state: AboutPhaseState;
}

/** An example: a file the compiler checks and a suite runs, and the committed outputs it makes. */
export interface AboutExample {
  /** The file, relative to the `about.ts` that names it. */
  readonly file: string;
  /** What it shows, in a sentence. */
  readonly what: string;
  /** The committed files it makes, relative to the same folder, shown beside it. */
  readonly outputs?: readonly string[];
}

/** An area of a package: a part with an entry point, whose exports are its API and whose entry point's module comment is its overview. */
export interface AboutArea {
  /** Its name, as a title. */
  readonly title: string;
  /** Its name in the site's addresses: lower-case words joined by hyphens. */
  readonly slug: string;
  /** Its entry points, relative to `about.ts`; the first one's module comment is the area's overview. */
  readonly entryPoints: readonly string[];
  /** The folder, relative to `about.ts`, that holds the files of the area; where it is not given, the folder of the first entry point. */
  readonly folder?: string;
  /** The specification it implements, where it has its own. */
  readonly spec?: AboutSpec;
  /** Its phases, where it is built a phase at a time. */
  readonly phases?: readonly AboutPhase[];
  /** Its examples. */
  readonly examples?: readonly AboutExample[];
}

/** The typed facts of a package, or of a repository as a whole. */
export interface About {
  /** Its name, as a title. */
  readonly title: string;
  /** What it is, in a paragraph of Markdown: the first thing a reader sees. */
  readonly summary: string;
  /** The specification it implements, where one does. */
  readonly spec?: AboutSpec;
  /** Its folders and what each may import. */
  readonly folders?: readonly AboutFolder[];
  /** The commands that work on it, run from the folder of its `about.ts`. */
  readonly commands?: readonly AboutCommand[];
  /** The rules it keeps. */
  readonly rules?: readonly AboutRule[];
  /** Its areas. */
  readonly areas?: readonly AboutArea[];
  /** Its examples that belong to no one area. */
  readonly examples?: readonly AboutExample[];
  /** Facts its page shows in a small table beside the summary: a label and its value, as a version or a conformance level. */
  readonly facts?: readonly AboutFact[];
  /** The folders of a library built in layers, each with the layer it is in and what it may import of the others: its page shows them as bands. */
  readonly layers?: readonly AboutLayer[];
}

/** A folder of a library built in layers. */
export interface AboutLayer {
  /** The folder, relative to the library. */
  readonly folder: string;
  /** The layer it is in: `governance`, `logical` or `physical`. */
  readonly layer: string;
  /** The folders of the library that its files may import, where it names them. */
  readonly mayImport?: readonly string[];
}

/** One fact of a package: a label and its value. */
export interface AboutFact {
  /** What it is: `Version`. */
  readonly label: string;
  /** Its value, in Markdown: `0.9.0`. */
  readonly value: string;
}

/** A package the site shows: its folder, its name in the site's addresses, and its `About`. */
export interface PackageConfig {
  /** Its folder, from the repository's root (`.` for the root itself). */
  readonly dir: string;
  /** Its name in the site's addresses: lower-case words joined by hyphens. */
  readonly slug: string;
  /** The path of its `about.ts` from its folder (`about.ts` by default), or its `About` value itself (FR-027). */
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
 * A spec kit and its layout (FR-024): commons' (`registry.tsv`, `enforcement.tsv`, `specs/NNNN-slug/spec.md` under `dir`), or the plain
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

/** A repository whose specifications may be linked: a public one whose site this generator makes (FR-025). */
export interface LinkedRepository {
  /** Its name, as a citation's qualifier (`commons`). */
  readonly repo: string;
  /** The address of its site, ending in `/`: a specification is `<site>specs/<id>.html`. */
  readonly site: string;
  /** The digits of its specifications' numbers. */
  readonly digits: number;
}

/** How the repository's specifications are cited, and which other repositories' citations are links (FR-025). */
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

/** The configuration a repository gives (FR-023), as its `docs.config.ts` exports it. */
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
  /** The lenses (FR-026); none by default. */
  readonly lenses?: readonly Lens[];
  /** The folder of the lint rules an `about` may name, as `<rule>.ts`, from the root; a lint rule is not checked without it. */
  readonly lintRules?: string;
  /** Where `build` writes the site, from the root; `_site` by default. */
  readonly out?: string;
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

/** The configuration checked (FR-023): every path absolute or from the root, every default filled. */
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
  /** Where `build` writes the site, absolute. */
  readonly out: string;
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

/**
 * A configuration checked into its resolved form, or every problem with it (FR-023).
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
  const lint = optStr("lintRules", "lintRules");
  const out = path.resolve(root, optStr("out", "out") ?? "_site");
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
    out,
  });
}
