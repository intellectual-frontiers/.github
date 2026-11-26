/**
 * The manifest of a library of commons (commons 0027-commons-libraries FR-011 to FR-014) and the requirements it makes: a library is a folder `commons/<name>/` that holds `library.ts`, an
 * object literal read as data and never run, and this repository knows it from that file alone. The decoder of the manifest, the check that a manifest and its folder agree, and the generator of
 * the section "The libraries" of 0027-commons-libraries and of its rows of `enforcement.tsv`.
 *
 *     bun commons/libraries/src/libraries.ts            write the section and the rows again from the manifests
 *     bun commons/libraries/src/libraries.ts --check    write nothing and exit 1 where a file is not what the manifests make, or where a manifest and its folder disagree
 *     other flags: --repo DIR (the repository, the working folder by default)
 *
 * @remarks
 * A manifest declares the library's `name` (its folder), its conformance `level` (`L1` where it declares none, 0028-conformance-levels), the path of its spec kit, its `verify` command, its
 * `version`, its `exports` (the keys of the package's `exports`) its `family` (a host and a role in a family of libraries, FR-023) and its `distribution` (the registries it is published to: `github`, the default, and `npm` as well where a decision about that package has made it so; FR-015 to FR-018). The section "The libraries" of the specification is between the markers `<!-- libraries:begin -->` and `<!-- libraries:end -->`,
 * one requirement for each library numbered from FR-101, an id kept for the life of the library; the rows of those requirements are in `enforcement.tsv`. Adding a library is adding a folder with a manifest and
 * running this command.
 *
 * @limits
 * It reads files and writes two; it runs no library's `verify` (`check.ts --all` does, 0028-conformance-levels FR-012), and it does not read inside a library but its manifest, its package and the files that name its spec kit.
 *
 * @example
 * ```ts
 * import { decodeLibrarySource } from "./libraries.ts";
 * const r = decodeLibrarySource('export const library = { name: "x", verify: "bun run verify", version: "0.1.0", exports: [] };');
 * r.kind; // "ok"
 * ```
 *
 * Spec: 0001-libraries FR-001
 *
 * @module
 */
import process from "node:process";
import {
  absurd,
  array,
  type Decoder,
  describe,
  formatDecodeError,
  literal,
  object,
  unknownValue,
  string,
  err,
  ok,
  refine,
  type Brand,
  type Result,
} from "@intellectual-frontiers/core";
import { parseSpdxId, type SpdxId } from "./license/standard.ts";
import { exportedLiteral } from "@intellectual-frontiers/formats/ts-literal";
import { decodeTable, type Table } from "@intellectual-frontiers/kanon";
import { existsSync, readDirSync, readTextFileSync, writeTextFileSync } from "@intellectual-frontiers/system/fs";
import { stdio } from "@intellectual-frontiers/system";
import { spawn } from "@intellectual-frontiers/system/proc";
import { DEFAULT_LIBRARY_LEVEL, LEVELS, type LevelKey, rankOf } from "@intellectual-frontiers/mizan/levels";
import { decodeFamily, familyFindings, type LibraryFamily, reservationFindings, ROLES } from "./family.ts";

/** The name of a library's manifest in its folder. */
export const LIBRARY_FILE = "library.ts";

/** The specification that holds the requirements of the libraries, and the first number of the requirements it generates. */
export const LIBRARIES_SPEC = "0027-commons-libraries";
/** The first requirement number of the section "The libraries", which is generated (0027-commons-libraries FR-011). */
export const FIRST_GENERATED = 101;
/** The marker that opens the generated section, and the one that closes it. */
export const BEGIN = "<!-- libraries:begin -->";
/** The marker that ends the generated section of the libraries in a document. */
export const END = "<!-- libraries:end -->";

/** Where the generated section begins and ends: the markers on lines of their own (a requirement may name them in its text). */
function bounds(spec: string): { readonly from: number; readonly to: number } | undefined {
  const from = spec.indexOf(`\n${BEGIN}\n`);
  const to = spec.indexOf(`\n${END}\n`, from);
  return from < 0 || to < 0 ? undefined : { from: from + 1, to: to + 1 };
}

/** A library's manifest. */
export type Library = {
  /** The folder's name, and the package's: `@intellectual-frontiers/<name>`. */
  readonly name: string;
  /** The folder from `commons/` where the manifest was found (`anyfs/s3`): set by {@link readLibraries}, never written in a manifest; {@link folderOf} says `name` where it is not set (0027-commons-libraries FR-026). */
  readonly dir?: string;
  /** The conformance level the library is held to (`L1` where the manifest declares none). */
  readonly level: LevelKey;
  /** The path of its spec kit from its folder; none at L0. */
  readonly specKit?: string;
  /** The command that proves it, run from its folder with no argument. */
  readonly verify: string;
  /** Its version: the package's. */
  readonly version: string;
  /** The keys of the package's `exports`. */
  readonly exports: readonly string[];
  /** What it is, in a sentence, for the requirement made of it. */
  readonly summary?: string;
  /** Where it is published: always `github` (the GitHub package registry of the organization), and `npm` as well where a decision about that package has made it so (FR-015 and FR-016). */
  readonly distribution: readonly Registry[];
  /** What the library contributes to the workbench (commons workbench 0003-workbench-contract): its tools, credentials and hosts by task, and the tests that need them, as data; the workbench validates and composes it, and a library that contributes nothing has none. */
  readonly workbench?: unknown;
  /** The table of its layers where it is built to Kanon (commons 0033-kanon FR-010); none where it is not. */
  readonly kanon?: Table;
  /** Its host and its role where it is of a family (a host, a dialect of it or a plugin of it; 0033-kanon FR-021, 0027-commons-libraries FR-023). */
  readonly family?: LibraryFamily;
  /** The named group of the documentation (`catalogs`, `linux`, `lab`) the library is listed under where it is of no family: a presentation only, which moves no folder and changes no name (0027-commons-libraries FR-027). */
  readonly group?: string;
  /** The license its `LICENSE` and its packed `package.json` carry, where it is not the default of the repository (`license/standard.ts`; commons 0035-licensing FR-003). */
  readonly license?: SpdxId;
  /** The constants of its sources that say its own version (`CORE_VERSION`), each a file from the library's folder and the name of the constant: the release rewrites them with the version, and a check finds one that disagrees. */
  readonly versionConstants?: readonly VersionConstant[];
  /** The package the library publishes where it is not `@intellectual-frontiers/<name>` (the `data` library publishes `@intellectual-frontiers/arcactl`; commons 0036-distribution FR-009). */
  readonly publishes?: PackageName;
  /** The typed reason the library is not released, where there is one: a library with none is released (0001-libraries FR-024); a held library is verified and packed like any other, and has no release record entry, no tag, no set and no registry. */
  readonly held?: Hold;
  /** The set the library is, where it is a metapackage: a folder with no code of its own whose package depends on the libraries of the set at exact versions (commons 0036-distribution FR-005). */
  readonly bundle?: BundleName;
};

/** The kinds of reason not to release a library: a closed union, and the only reasons there are (0001-libraries FR-024). */
export const HOLD_KINDS = ["tests-only", "unfinished", "owner-blocked"] as const;

/** One line of text of a hold: non-empty, trimmed, on one line, made only by {@link parseHoldText}. */
export type HoldText = Brand<string, "hold text">;
const holdTextDecoder = refine(string, "hold text", (t) => t.trim() !== "" && t.trim() === t && !t.includes("\n"));

/** A line of a hold from text, or why the text is not one. */
export function parseHoldText(text: string, where: string): Result<HoldText, string> {
  const r = holdTextDecoder(text, where);
  return r.kind === "ok" ? ok(r.value) : err(`${where} is one non-empty line, with no space around it`);
}

/**
 * The reason a library is not released (0001-libraries FR-024): a library is released unless its manifest carries one, and every one has its text. A library that is `tests-only` is a tool of tests that nothing depends on at run time;
 * an `unfinished` one names what is missing and the condition that lifts the hold; an `owner-blocked` one is held by a decision of the owner that the text states.
 */
export type Hold =
  | { readonly kind: "tests-only"; readonly reason: HoldText }
  | { readonly kind: "unfinished"; readonly reason: HoldText; readonly missing: readonly [HoldText, ...HoldText[]]; readonly liftedWhen: HoldText }
  | { readonly kind: "owner-blocked"; readonly reason: HoldText };

const holdExpected = `library.held is { kind: ${HOLD_KINDS.map((k) => `"${k}"`).join(" | ")}, reason } and, for "unfinished", missing (the parts that are not done) and liftedWhen (the condition that lifts the hold)`;

/** The hold of a manifest from its value, or why it is not one. */
export function decodeHold(input: unknown): Result<Hold, string> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return err(holdExpected);
  const o = Object.fromEntries(Object.entries(input));
  const kind = HOLD_KINDS.find((k) => k === o["kind"]);
  if (kind === undefined) return err(holdExpected);
  const allowed: readonly string[] = kind === "unfinished" ? ["kind", "reason", "missing", "liftedWhen"] : ["kind", "reason"];
  const stray = Object.keys(o).find((k) => !allowed.includes(k));
  if (stray !== undefined) return err(`library.held.${stray} is not a field of a hold of kind ${kind} (${allowed.join(", ")})`);
  const text = (field: string): Result<HoldText, string> => parseHoldText(typeof o[field] === "string" ? o[field] : "", `library.held.${field}`);
  const reason = text("reason");
  if (reason.kind === "err") return reason;
  switch (kind) {
    case "tests-only":
    case "owner-blocked":
      return ok({ kind, reason: reason.value });
    case "unfinished": {
      const liftedWhen = text("liftedWhen");
      if (liftedWhen.kind === "err") return liftedWhen;
      const list: readonly unknown[] = Array.isArray(o["missing"]) ? o["missing"] : [];
      const parts: HoldText[] = [];
      for (const [i, m] of list.entries()) {
        const p = parseHoldText(typeof m === "string" ? m : "", `library.held.missing[${i}]`);
        if (p.kind === "err") return p;
        parts.push(p.value);
      }
      const [first, ...rest] = parts;
      if (first === undefined) return err("library.held.missing names at least one part that is not done");
      return ok({ kind, reason: reason.value, missing: [first, ...rest], liftedWhen: liftedWhen.value });
    }
    default:
      return absurd(kind);
  }
}

/** The hold in one sentence, for a plan, a table and the register: its kind, its reason and, where it has them, what is missing and what lifts it. */
export function holdSentence(h: Hold): string {
  switch (h.kind) {
    case "tests-only":
      return `tests only: ${h.reason}`;
    case "owner-blocked":
      return `owner-blocked: ${h.reason}`;
    case "unfinished":
      return `unfinished (missing ${h.missing.join("; ")}): ${h.reason}; lifted when ${h.liftedWhen}`;
    default:
      return absurd(h);
  }
}

/** The scope of the packages of commons. */
export const PACKAGE_SCOPE = "@intellectual-frontiers/";

/** The sets that a metapackage is: the whole of commons, and the four roles of the libraries; a closed union, and the name of the folder and of the package of each. */
export const BUNDLES = ["commons", "foundation", "patterns", "programs", "standards"] as const;
/** The name of a set of libraries a metapackage is. */
export type BundleName = (typeof BUNDLES)[number];

/** The name of a package of commons: `@intellectual-frontiers/` and a name, made only by {@link parsePackageName}. */
export type PackageName = Brand<string, "package name">;
const packageNameDecoder = refine(string, "package name", (t) => /^@intellectual-frontiers\/[a-z][a-z0-9-]*$/.test(t));

/** A package name of commons from text, or why the text is not one. */
export function parsePackageName(text: string): Result<PackageName, string> {
  const r = packageNameDecoder(text, "package");
  return r.kind === "ok" ? ok(r.value) : err(`${JSON.stringify(text)} is not a package of commons (@intellectual-frontiers/ and a name of lower-case letters, digits and hyphens)`);
}

/** The package a library publishes: the one its manifest names in `publishes`, else `@intellectual-frontiers/<name>` (commons 0036-distribution FR-009). */
export function publishedPackage(l: Pick<Library, "name" | "publishes">): string {
  return l.publishes ?? `${PACKAGE_SCOPE}${l.name}`;
}

/** A constant of a library's sources that holds the library's version: the file (from the library's folder) and the constant's name. */
export type VersionConstant = { readonly file: string; readonly name: string };

/** The lowest conformance level that requires a library to declare `kanon`; none yet (0033-kanon FR-014, OQ-1): a level asks for it by naming itself here. */
export const KANON_REQUIRED_FROM: LevelKey | undefined = undefined;

/** The registries a library may be published to: the kinds only, never a host or a credential (0027-commons-libraries FR-018). */
export const REGISTRIES = ["github", "npm"] as const;
/** A registry a library is distributed to: github or npm. */
export type Registry = (typeof REGISTRIES)[number];
/** Where a manifest that declares no distribution is published. */
export const DEFAULT_DISTRIBUTION: readonly Registry[] = ["github"];

const nonEmpty: Decoder<string> = (input, path = "$") => {
  const r = string(input, path);
  if (r.kind === "err") return r;
  return r.value.trim() === "" ? err({ kind: "decode", path, expected: "a non-empty string", found: describe(input) }) : r;
};
const nameDecoder: Decoder<string> = (input, path = "$") => {
  const r = string(input, path);
  if (r.kind === "err") return r;
  return /^[a-z][a-z0-9-]*$/.test(r.value)
    ? r
    : err({ kind: "decode", path, expected: "a name of lower-case letters, digits and hyphens", found: describe(input) });
};
const constantName: Decoder<string> = (input, path = "$") => {
  const r = string(input, path);
  if (r.kind === "err") return r;
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(r.value)
    ? r
    : err({ kind: "decode", path, expected: "the name of a constant: letters, digits and underscores", found: describe(input) });
};
const body = object(
  { name: nameDecoder, verify: nonEmpty, version: nonEmpty, exports: array(nonEmpty) },
  { level: literal(...LEVELS), specKit: nonEmpty, summary: nonEmpty, distribution: array(literal(...REGISTRIES)), kanon: unknownValue, group: nameDecoder, family: object({ host: nonEmpty, role: literal(...ROLES) }), license: nonEmpty, versionConstants: array(object({ file: nonEmpty, name: constantName })), publishes: nonEmpty, bundle: literal(...BUNDLES), workbench: unknownValue, held: unknownValue },
);
const FIELDS = ["name", "level", "specKit", "verify", "version", "exports", "summary", "distribution", "kanon", "family", "group", "license", "versionConstants", "publishes", "bundle", "held", "workbench"] as const;

/** The manifest read from the text of its file: `export const library = { ... }` and no other export, read as data and never run (0027-commons-libraries FR-012). */
export function decodeLibrarySource(source: string): Result<Library, string> {
  const exports = source.split("\n").filter((l) => /^export\s/.test(l));
  if (exports.length !== 1) return err(`a manifest exports only library, and this file has ${exports.length} exports`);
  const lit = exportedLiteral(source, "library");
  if (lit.kind === "err") return err(`the manifest is not a literal: ${lit.error.expected}`);
  const input = lit.value;
  if (typeof input === "object" && input !== null && !Array.isArray(input)) {
    const known: readonly string[] = FIELDS;
    const bad = Object.keys(input).find((k) => !known.includes(k));
    if (bad !== undefined) return err(`library.${bad} is an unknown field (a manifest has ${FIELDS.join(", ")})`);
  }
  const r = body(input, "library");
  if (r.kind === "err") return err(formatDecodeError(r.error));
  const v = r.value;
  const distribution = v.distribution ?? DEFAULT_DISTRIBUTION;
  let held: Hold | undefined;
  if (v.held !== undefined) {
    const h = decodeHold(v.held);
    if (h.kind === "err") return h;
    held = h.value;
    if (v.publishes !== undefined || v.bundle !== undefined) return err("library.held is not given with library.publishes or library.bundle: a held library is published nowhere");
  }
  if (held === undefined && (distribution.length === 0 || new Set(distribution).size !== distribution.length))
    return err("library.distribution lists each registry once and at least one (FR-015)");
  if (held === undefined && !distribution.includes("github"))
    return err(
      "library.distribution includes github: a library is published to the GitHub package registry whatever else it is published to (FR-015, FR-016)",
    );
  let kanon: Table | undefined;
  if (v.kanon !== undefined) {
    const t = decodeTable(v.kanon);
    if (t.kind === "err") return err(`library.${t.error} (0033-kanon FR-010)`);
    kanon = t.value;
  }
  let family: LibraryFamily | undefined;
  if (v.family !== undefined) {
    const f = decodeFamily(v.family);
    if (f.kind === "err") return f;
    family = f.value;
  }
  let license: SpdxId | undefined;
  if (v.license !== undefined) {
    const l = parseSpdxId(v.license);
    if (l.kind === "err") return err(`library.license: ${l.error}`);
    license = l.value;
  }
  let publishes: PackageName | undefined;
  if (v.publishes !== undefined) {
    const p = parsePackageName(v.publishes);
    if (p.kind === "err") return err(`library.publishes: ${p.error}`);
    publishes = p.value;
  }
  if (v.bundle !== undefined && v.bundle !== v.name)
    return err(`library.bundle ${v.bundle} is the set of the metapackage of that name: the folder is named ${v.bundle}, and this one is ${v.name} (0036-distribution FR-005)`);
  if (v.bundle !== undefined && publishes !== undefined) return err("library.bundle and library.publishes are not both given: a metapackage publishes the package of its folder (0036-distribution FR-005)");
  return ok({
    name: v.name,
    level: v.level ?? DEFAULT_LIBRARY_LEVEL,
    ...(v.specKit === undefined ? {} : { specKit: v.specKit }),
    verify: v.verify,
    version: v.version,
    exports: v.exports,
    ...(v.summary === undefined ? {} : { summary: v.summary }),
    distribution,
    ...(kanon === undefined ? {} : { kanon }),
    ...(family === undefined ? {} : { family }),
    ...(v.group === undefined ? {} : { group: v.group }),
    ...(license === undefined ? {} : { license }),
    ...(v.versionConstants === undefined ? {} : { versionConstants: v.versionConstants }),
    ...(publishes === undefined ? {} : { publishes }),
    ...(v.bundle === undefined ? {} : { bundle: v.bundle }),
    ...(held === undefined ? {} : { held }),
    ...(v.workbench === undefined ? {} : { workbench: v.workbench }),
  });
}

/** A library found in the folder of commons: its folder and what its manifest says, or why it cannot be read. */
export type Found = { readonly dir: string; readonly library: Library } | { readonly dir: string; readonly problem: string };

/**
 * The hosts whose extensions the check holds to the folder FR-026 derives: a family is added here with the commit that moves it, and the set is every host of the repository when the last family is moved
 * (the folders of a host's extensions are then a rule and not a plan).
 */
export const LAYOUT_HOSTS: ReadonlySet<string> = new Set<string>(["desired-os-state", "anyfs"]);

/** The folders of `commons/` that hold no library of their own and are never searched for one. */
const NOT_LIBRARY_FOLDERS: ReadonlySet<string> = new Set(["node_modules", "dist", "generated", "spec-kit", "src", "suite", "tools"]);

/**
 * The manifests of commons, in the order of the libraries' names: every folder `commons/<name>/` that holds a `library.ts`, and every folder `commons/<host>/<extension>/` that holds one, an extension
 * of a host being inside the folder of its host (0027-commons-libraries FR-026). `dir` is the folder from `commons/`, `anyfs/s3` for the extension and `anyfs` for the host.
 */
export function readLibraries(repo: string): readonly Found[] {
  const commons = `${repo.replace(/[\\/]$/, "")}/commons`;
  if (!existsSync(commons)) return [];
  const dirs: string[] = [];
  for (const e of readDirSync(commons)) {
    if (!e.isDirectory || NOT_LIBRARY_FOLDERS.has(e.name)) continue;
    if (existsSync(`${commons}/${e.name}/${LIBRARY_FILE}`)) dirs.push(e.name);
    if (!existsSync(`${commons}/${e.name}/${LIBRARY_FILE}`)) continue;
    for (const c of readDirSync(`${commons}/${e.name}`))
      if (c.isDirectory && !NOT_LIBRARY_FOLDERS.has(c.name) && existsSync(`${commons}/${e.name}/${c.name}/${LIBRARY_FILE}`)) dirs.push(`${e.name}/${c.name}`);
  }
  const found = dirs.map((dir): Found => {
    const r = decodeLibrarySource(readTextFileSync(`${commons}/${dir}/${LIBRARY_FILE}`));
    return r.kind === "ok" ? { dir, library: { ...r.value, dir } } : { dir, problem: r.error };
  });
  const key = (f: Found): string => ("library" in f ? f.library.name : f.dir);
  return found.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
}

/**
 * The folder of a library from `commons/`, as its manifest derives it (0027-commons-libraries FR-026): `<host>/<extension>` where `family.host` names another library and the name starts with
 * `<host>-`, `<name>` for any other library. Where the family names a host that has no folder of its own, or the name does not start with the host's, the folder is `<name>`.
 */
export function derivedDir(library: Library, hosts: ReadonlySet<string>): string {
  const f = library.family;
  if (f === undefined || f.role === "host" || f.host === library.name || !hosts.has(f.host) || !library.name.startsWith(`${f.host}-`)) return library.name;
  return `${f.host}/${library.name.slice(f.host.length + 1)}`;
}

/** The folder of a library from `commons/`: where it was found, or its name. */
export const folderOf = (l: Library): string => l.dir ?? l.name;

/** The folders of the libraries from `commons/`, by name, where they are (0027-commons-libraries FR-026): the one answer to "where is the library X". */
export function libraryDirs(found: readonly Found[]): ReadonlyMap<string, string> {
  return new Map(found.flatMap((f) => ("library" in f ? [[f.library.name, f.dir] as const] : [])));
}

/** The folder of the library `name` from the repository's root (`commons/anyfs/s3`), or `commons/<name>` where no manifest of that name is found: the one resolver of the folder of a library. */
export function libraryDir(repo: string, name: string): string {
  return `commons/${libraryDirs(readLibraries(repo)).get(name) ?? name}`;
}

/** The keys of a package's `exports`, its name and version and the scripts it has, read from `package.json`. */
function packageOf(file: string): {
  readonly name?: string;
  readonly version?: string;
  readonly exports: readonly string[];
  readonly scripts: readonly string[];
} {
  const raw: unknown = JSON.parse(readTextFileSync(file));
  const o = typeof raw === "object" && raw !== null ? raw : {};
  const field = (k: string): unknown => Object.entries(o).find(([n]) => n === k)?.[1];
  const keys = (v: unknown): readonly string[] => (typeof v === "object" && v !== null ? Object.keys(v) : []);
  const name = field("name");
  const version = field("version");
  return {
    ...(typeof name === "string" ? { name } : {}),
    ...(typeof version === "string" ? { version } : {}),
    exports: keys(field("exports")),
    scripts: keys(field("scripts")),
  };
}

/** The script a verify command runs: `bun run verify` runs the script `verify`. */
function scriptOf(verify: string): string | undefined {
  return /^bun run ([A-Za-z0-9:_-]+)$/.exec(verify)?.[1];
}

/** The file of the documentation site's configuration, from `commons/`, which names the spec kit of every library that has one. */
export const DOCS_CONFIG = "docs.config.ts";

/**
 * The libraries with a spec kit that the configuration of the site does not name (0001-libraries FR-025), one sentence each with the fix: a spec kit that `commons/docs.config.ts` does not list is a section of the site and of the books that is missing,
 * which has turned the site and the tests red after a push. Read as text, never run; where the repository has no such file nothing is asked.
 */
export function docsConfigFindings(root: string, libraries: readonly Library[]): readonly string[] {
  const file = `${root}/commons/${DOCS_CONFIG}`;
  if (!existsSync(file)) return [];
  const text = readTextFileSync(file);
  return libraries.flatMap((l) => {
    if (l.specKit === undefined) return [];
    const dir = `commons/${folderOf(l)}/${l.specKit}`;
    return text.includes(`"${dir}"`)
      ? []
      : [`commons/${DOCS_CONFIG} does not list the spec kit of ${l.name}: add { layout: "commons", dir: "${dir}" } to specKits (FR-025)`];
  });
}

/**
 * What is wrong where a manifest and its folder disagree (0027-commons-libraries FR-013), one sentence each: a folder with a spec kit and no manifest, a manifest that cannot be read, that names another
 * folder, a level above L0 with no spec kit, a spec kit that is not there, a package of another name, a version that is not the package's, exports that are not the package's, and a verify that is no script of the package.
 */
export function manifestFindings(repo: string, layoutHosts: ReadonlySet<string> = LAYOUT_HOSTS): readonly string[] {
  const root = repo.replace(/[\\/]$/, "");
  const commons = `${root}/commons`;
  const found: string[] = [];
  const have = readLibraries(root);
  const hostFolders = new Set(have.flatMap((f) => ("library" in f && f.library.family?.role === "host" ? [f.library.name] : [])));
  for (const e of existsSync(commons) ? readDirSync(commons) : [])
    if (e.isDirectory && existsSync(`${commons}/${e.name}/spec-kit`) && !have.some((l) => l.dir === e.name))
      found.push(`commons/${e.name} has a spec kit and no ${LIBRARY_FILE}: a library declares itself (FR-012)`);
  for (const f of have) {
    const dir = `${commons}/${f.dir}`;
    if ("problem" in f) {
      found.push(`commons/${f.dir}/${LIBRARY_FILE}: ${f.problem} (FR-012)`);
      continue;
    }
    const l = f.library;
    const folderName = f.dir.includes("/") ? `${f.dir.split("/")[0]}-${f.dir.split("/").slice(1).join("-")}` : f.dir;
    if (l.name !== folderName) found.push(`commons/${f.dir}/${LIBRARY_FILE} is named ${l.name}, and its folder is ${f.dir} (FR-013, FR-026)`);
    const want = derivedDir(l, hostFolders);
    if (want !== f.dir && layoutHosts.has(l.family?.host ?? "")) found.push(`commons/${f.dir}: the library ${l.name} of the family ${l.family?.host ?? ""} is in ${f.dir}, and its manifest puts it in commons/${want} (FR-026)`);
    if (rankOf(l.level) >= 1 && l.specKit === undefined)
      found.push(`commons/${f.dir}/${LIBRARY_FILE} declares ${l.level} and no spec kit, which a level above L0 asks (FR-013)`);
    if (l.specKit !== undefined && !existsSync(`${dir}/${l.specKit}/registry.tsv`))
      found.push(`commons/${f.dir}: the spec kit ${l.specKit} the manifest names has no registry.tsv (FR-013)`);
    if (!existsSync(`${dir}/package.json`)) {
      found.push(`commons/${f.dir}/package.json is missing (FR-013)`);
      continue;
    }
    const pkg = packageOf(`${dir}/package.json`);
    if (pkg.name !== `@intellectual-frontiers/${l.name}`)
      found.push(`commons/${f.dir}/package.json is not named @intellectual-frontiers/${l.name} (FR-013)`);
    if (pkg.version !== l.version)
      found.push(`commons/${f.dir}: the manifest says version ${l.version} and the package says ${pkg.version ?? "none"} (FR-013)`);
    const missing = l.exports.filter((x) => !pkg.exports.includes(x));
    const extra = pkg.exports.filter((x) => !l.exports.includes(x));
    if (missing.length > 0 || extra.length > 0)
      found.push(
        `commons/${f.dir}: the manifest and the package disagree on exports (${[...missing.map((x) => `${x} is not the package's`), ...extra.map((x) => `${x} is not the manifest's`)].join("; ")}) (FR-013)`,
      );
    const script = scriptOf(l.verify);
    if (script === undefined || !pkg.scripts.includes(script))
      found.push(`commons/${f.dir}: the verify command ${JSON.stringify(l.verify)} is not a script of the package (FR-013)`);
    const verifyText = script === undefined ? "" : scriptText(`${dir}/package.json`, script);
    if (rankOf(l.level) >= 1 && rankOf(l.level) < rankOf("L3") && !verifyText.includes(`--level ${l.level}`))
      found.push(
        `commons/${f.dir}: the manifest declares ${l.level} and the verify script does not run the Mizan check with --level ${l.level} (0028-conformance-levels FR-013)`,
      );
    if (l.kanon !== undefined && !verifyText.includes("kanon/src/check.ts"))
      found.push(
        `commons/${f.dir}: the manifest declares kanon and the verify script does not run the check of the table (bun ../kanon/src/check.ts) (0033-kanon FR-014)`,
      );
    if (KANON_REQUIRED_FROM !== undefined && rankOf(l.level) >= rankOf(KANON_REQUIRED_FROM) && l.kanon === undefined)
      found.push(`commons/${f.dir}: the manifest declares ${l.level}, which requires kanon, and declares none (0033-kanon FR-014)`);
  }
  const known = have.flatMap((f) => ("library" in f ? [f.library] : []));
  found.push(...reservationFindings(known), ...familyFindings(known), ...docsConfigFindings(root, known));
  return found;
}

/** A field of a value read from JSON, `undefined` where the value is not an object or has no such field. */
function fieldOf(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null ? Object.entries(value).find(([n]) => n === key)?.[1] : undefined;
}

function scriptText(file: string, script: string): string {
  const raw: unknown = JSON.parse(readTextFileSync(file));
  const text = fieldOf(fieldOf(raw, "scripts"), script);
  return typeof text === "string" ? text : "";
}

/** The ontology's name for a level of a manifest: `mz:Registered`, `mz:Core`, `mz:Standards` or `mz:Governed`. */
const LEVEL_TERM: Readonly<Record<LevelKey, string>> = { L0: "mz:Registered", L1: "mz:Core", L2: "mz:Standards", L3: "mz:Governed" };

/** How a registry is named in the requirement of a library. */
const REGISTRY_NAME: Readonly<Record<Registry, string>> = { github: "the GitHub package registry", npm: "npm" };

const list = (items: readonly string[]): string => {
  const quoted = items.map((i) => `\`${i}\``);
  return quoted.length <= 1 ? (quoted[0] ?? "no exports") : `${quoted.slice(0, -1).join(", ")} and ${quoted[quoted.length - 1] ?? ""}`;
};

/** The requirement of a library, as the section "The libraries" holds it (FR-014): one line. */
export function requirementOf(id: string, l: Library, dir: string = l.name): string {
  const kit = l.specKit === undefined ? "" : `, its spec kit at \`commons/${dir}/${l.specKit}\``;
  const summary = l.summary === undefined ? "" : ` ${l.summary}`;
  const where = l.held === undefined ? l.distribution.map((r) => REGISTRY_NAME[r]).join(" and ") : `no registry (not released, ${holdSentence(l.held)})`;
  const own = l.publishes === undefined ? `@intellectual-frontiers/${l.name}` : l.publishes;
  const sets = l.bundle === undefined ? "" : `, a metapackage with no code of its own (the set ${l.bundle}, 0036-distribution FR-005)`;
  return `- **${id}**: \`commons/${dir}\` MUST be a library at conformance level ${l.level} (\`${LEVEL_TERM[l.level]}\`): the package \`${own}\`${sets} at version \`${l.version}\`${kit}, exporting ${list(l.exports)}, published to ${where}, proved by \`cd commons/${l.name} && ${l.verify}\`.${summary}`;
}

/** The row of `enforcement.tsv` of a library's requirement. */
export function rowOf(id: string, l: Library, dir: string = l.name): string {
  const kit = l.specKit === undefined ? "its manifest" : "its compiler, specification checker, rules and tests";
  return `${LIBRARIES_SPEC} ${id}\tcheck\t.github: cd commons/${dir} && ${l.verify}\tcommons/${dir}: the verify of the library (${kit}); the manifest ${LIBRARY_FILE} agrees with the folder and the package (commons-libraries.test.ts)`;
}

/** The ids the section already gives each library, by name, read from its text between the markers. */
export function idsIn(spec: string): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  const b = bounds(spec);
  if (b === undefined) return out;
  for (const line of spec.slice(b.from, b.to).split("\n")) {
    // the folder is `commons/<name>` or, for an extension of a host, `commons/<host>/<extension>`, whose library is named `<host>-<extension>` (0027-commons-libraries FR-026)
    const m = /^- \*\*(FR-\d+)\*\*: `commons\/([a-z][a-z0-9-]*)(?:\/([a-z][a-z0-9-]*))?`/.exec(line);
    if (m?.[1] !== undefined && m[2] !== undefined) out.set(m[3] === undefined ? m[2] : `${m[2]}-${m[3]}`, m[1]);
  }
  return out;
}

/**
 * The id each library has: the one it had, or the next number after the greatest. A number belongs to the first library that holds it in the specification: where a second one holds it (two branches each gave the next number to a
 * library, and a merge kept both), the second is given the next number after the greatest, so that the generator makes the section again with one number for each library.
 */
export function idsFor(libraries: readonly Library[], had: ReadonlyMap<string, string>): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  const first = new Map<string, string>();
  for (const [name, id] of had) if (!first.has(id)) first.set(id, name);
  let next = Math.max(FIRST_GENERATED - 1, ...[...had.values()].map((id) => Number(id.slice(3)))) + 1;
  for (const l of libraries) {
    const id = had.get(l.name);
    if (id !== undefined && first.get(id) === l.name) out.set(l.name, id);
    else out.set(l.name, `FR-${String(next++).padStart(3, "0")}`);
  }
  return out;
}

/** The text of the specification and of the register, made again from the libraries: nothing where the specification has no markers. */
export function generated(
  spec: string,
  enforcement: string,
  libraries: readonly Library[],
  dirs: ReadonlyMap<string, string> = new Map(),
): Result<{ readonly spec: string; readonly enforcement: string }, string> {
  const b = bounds(spec);
  if (b === undefined)
    return err(`${LIBRARIES_SPEC} has no ${BEGIN} and ${END}, each on a line of its own, around the section "The libraries"`);
  const ids = idsFor(libraries, idsIn(spec));
  // in the order of their numbers, which a library keeps for its life: a library added later is after those that were there, whatever its name
  const byNumber = [...libraries].sort((a, b) => Number((ids.get(a.name) ?? "").slice(3)) - Number((ids.get(b.name) ?? "").slice(3)));
  const lines = byNumber.map((l) => requirementOf(ids.get(l.name) ?? "", l, dirs.get(l.name) ?? l.name));
  const newSpec = `${spec.slice(0, b.from + BEGIN.length)}\n\n${lines.join("\n")}\n\n${spec.slice(b.to)}`;
  const rows = byNumber.map((l) => rowOf(ids.get(l.name) ?? "", l, dirs.get(l.name) ?? l.name));
  const kept = enforcement.split("\n").filter((l) => l !== "" && !new RegExp(`^${LIBRARIES_SPEC} FR-(?:[1-9]\\d{2,})\\t`).test(l));
  const last = kept.map((l, i) => (l.startsWith(`${LIBRARIES_SPEC} `) ? i : -1)).reduce((a, b) => Math.max(a, b), -1);
  const at = last < 0 ? kept.length : last + 1;
  return ok({ spec: newSpec, enforcement: `${[...kept.slice(0, at), ...rows, ...kept.slice(at)].join("\n")}\n` });
}

const SPEC_FILE = (repo: string): string => `${repo}/commons/spec-kit/specs/${LIBRARIES_SPEC}/spec.md`;
const ENFORCEMENT_FILE = (repo: string): string => `${repo}/commons/spec-kit/enforcement.tsv`;

/** The files that are not what the manifests make (relative to the repository), and what is wrong with the manifests; with `write`, the files are written. */
export function synchronize(repo: string, write: boolean): { readonly stale: readonly string[]; readonly problems: readonly string[] } {
  const root = repo.replace(/[\\/]$/, "");
  const have = readLibraries(root);
  const problems = [
    ...have.flatMap((f) => ("problem" in f ? [`commons/${f.dir}/${LIBRARY_FILE}: ${f.problem}`] : [])),
    ...manifestFindings(root),
  ];
  const libraries = have.flatMap((f) => ("library" in f ? [f.library] : []));
  const spec = readTextFileSync(SPEC_FILE(root)).replace(/\r\n/g, "\n"); // a Windows checkout may hold CRLF; the markers are found on lines of LF
  const enforcement = readTextFileSync(ENFORCEMENT_FILE(root)).replace(/\r\n/g, "\n");
  const made = generated(spec, enforcement, libraries, libraryDirs(have));
  if (made.kind === "err") return { stale: [], problems: [...problems, made.error] };
  const stale: string[] = [];
  if (made.value.spec !== spec) {
    stale.push(`commons/spec-kit/specs/${LIBRARIES_SPEC}/spec.md`);
    if (write) writeTextFileSync(SPEC_FILE(root), made.value.spec);
  }
  if (made.value.enforcement !== enforcement) {
    stale.push("commons/spec-kit/enforcement.tsv");
    if (write) writeTextFileSync(ENFORCEMENT_FILE(root), made.value.enforcement);
  }
  return { stale, problems };
}

/** The result of one library's `verify`. */
export type Verified = { readonly name: string; readonly code: number };

/** Runs the `verify` of every library a manifest declares, each from its own folder, and gives each status (0028-conformance-levels FR-012). */
export async function verifyAll(repo: string): Promise<readonly Verified[]> {
  const root = repo.replace(/[\\/]$/, "");
  const out: Verified[] = [];
  for (const f of readLibraries(root)) {
    if ("problem" in f) {
      out.push({ name: f.dir, code: 1 });
      continue;
    }
    stdio.stderr.writeSync(`verify ${f.dir}: ${f.library.verify}\n`);
    const [cmd, ...args] = f.library.verify.split(" ");
    try {
      await using child = spawn([cmd ?? "", ...args], { cwd: `${root}/commons/${f.dir}` });
      const status = await child.status;
      out.push({ name: f.dir, code: status.code });
    } catch (e) {
      stdio.stderr.writeSync(`verify ${f.dir}: ${e instanceof Error ? e.message : String(e)}\n`);
      out.push({ name: f.dir, code: 1 });
    }
  }
  return out;
}

/** The command line. Returns the exit status: 0, or 1 where a file is not what the manifests make or a manifest and its folder disagree. */
export function main(argv: readonly string[]): number {
  const at = argv.indexOf("--repo");
  const repo = at >= 0 ? (argv[at + 1] ?? ".") : ".";
  const check = argv.includes("--check");
  const r = synchronize(repo, !check);
  for (const p of r.problems) stdio.stderr.writeSync(`${p}\n`);
  for (const s of r.stale)
    stdio.stderr.writeSync(check ? `${s} is not what the manifests make; run: bun commons/libraries/src/libraries.ts\n` : `wrote ${s}\n`);
  return r.problems.length > 0 || (check && r.stale.length > 0) ? 1 : 0;
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
