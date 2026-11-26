/**
 * The one package of commons (commons 0036-distribution FR-019 to FR-027): in `single` distribution mode every library of commons is packed into `@intellectual-frontiers/commons`, with one `exports` map, one set of dependencies, one `bin` map,
 * one version, and the compiled files and the sources of each library under the folder of its name. The same inspection that the packer makes before it packs is {@link inspectCommons}, which a test runs again on the tarball it unpacks.
 *
 *     bun commons/commons/tools/pack.ts            (in commons/commons) pack `dist/intellectual-frontiers-commons-<version>.tgz`
 *     bun commons/commons/tools/pack.ts --check    the same, and print what was found; exit 1 where anything was
 *     bun commons/commons/tools/pack.ts --size    the same, and print what was packed by kind and by library (also `dist/package-report.json`, which the site shows)
 *     bun commons/libraries/src/pack-commons.ts --report    the facts of the package without compiling: the libraries, the keys of `exports`, the commands and the dependencies
 *     bun commons/libraries/src/pack-commons.ts --tools [--check]    the packages that compiling needs, in `commons/commons/package.json` and `bun.lock` (pack-tools.ts, FR-029)
 *
 * @remarks
 * A library is a folder of commons with a manifest that is not a metapackage ({@link packableLibraries}); `single` mode leaves none out unless `SINGLE_EXCLUDED` names it. The package maps a library to
 * `./<library>` (its `.` entry) and `./<library>/<subpath>` (each other key), because the subpaths of two libraries collide (`./governance` is a key of ten of them). Each entry names its declarations (`types`), its source for Bun (`bun`) and its compiled file
 * (`default`); a library's declarations are under `<library>/dist/` at the same paths as its sources are in its folder, its compiled files are beside their sources, and its sources at those paths, so that a library keeps the shape it has in this repository. The compiler builds each library by itself
 * (the same configuration as the packer of a library: the base of commons, `preserveSymlinks`, so that a declaration names another library by its package and not by a path), and every specifier that names a library, `@intellectual-frontiers/<library>[/<subpath>]`,
 * is written as `@intellectual-frontiers/commons/<library>[/<subpath>]` in the compiled files, the declarations and the sources the package carries (the package names itself, which Node, Bun and TypeScript resolve). The sources of this repository keep the name of
 * the library (Kanon, 0033-kanon FR-010). The dependencies are the union of the runtime dependencies of the libraries, each at an exact version, except the packages `SINGLE_PEERS` names (the database drivers the libraries take as ports, what only Docs loads and the TypeScript compiler), which are optional peer dependencies the consumer installs; the commands are those the libraries declare,
 * each a launcher in `bin/` that imports the compiled module; the files of the package that do something when they are loaded (a module that installs a port, a command) are named in `sideEffects`, and every other is free of effects, which the inspection proves by
 * reading the compiled files. A folder of a library other than its entries' folders and those of {@link NOT_RUNTIME} (the data of a catalog, the guides of Docs) is shipped once, beside the sources, and the compiled file of each source is beside it, so that a module reads it at the
 * same relative path from its source (Bun) and from its compiled file (Node), and no file is in the package twice (`dist/` holds declarations only). The libraries are resolved by name and the third-party packages from `commons/commons` alone (they are linked under `commons/node_modules`, which is not committed), so that a fresh clone in which only
 * that folder was installed packs the package; the folder's `package.json` and `bun.lock` hold what that takes (`pack-tools.ts`), which the packer checks before it compiles.
 *
 * @limits
 * It builds from the sources of a checkout and does not publish; the release runs it (`bun tools/pack.ts` in `commons/commons`) and the workflow publishes the tarball. It needs the TypeScript compiler of `commons/commons` (or of the repository's root) installed.
 * A specifier it cannot rewrite or that names no library is a finding, never left as it is.
 *
 * @example
 * ```ts
 * import { rewriteSpecifiers } from "./pack-commons.ts";
 * rewriteSpecifiers('import { ok } from "@intellectual-frontiers/core";', new Set(["core"])).text; // 'import { ok } from "@intellectual-frontiers/commons/core";'
 * ```
 *
 * Spec: 0001-libraries FR-029
 *
 * @module
 */
import { createHash } from "node:crypto";
import process from "node:process";
import { chmod } from "@intellectual-frontiers/system/fs";
import { existsSync, mkdirSync, readDirSync, readFileSync, readTextFileSync, removeSync, statSync, writeTextFileSync } from "@intellectual-frontiers/system/fs";
import { dirname, join, resolve, toPosix } from "@intellectual-frontiers/system/path";
import { env, run, which } from "@intellectual-frontiers/system/proc";
import { activeMode, GITHUB_REGISTRY, MODE_VARIABLE, optionalPeersAsPeerDependencies, SINGLE, SINGLE_BUDGET, SINGLE_EXCLUDED, SINGLE_PEERS, SINGLE_TARGETS } from "./distribution.ts";
import { folderOf, type Library, maturitySentence, readLibraries } from "./libraries.ts";
import { licenseOf } from "./license.ts";
import { linkAll } from "./link.ts";
import { devDependenciesOf, importedPackages, linkTools, sourcesOf, syncTools, toolFindings, toolsOf, type Tools } from "./pack-tools.ts";
import { importSpecifiers, scanSource, specifierRanges } from "./scan.ts";
import { filesUnder, isObject, namesNodeTypes, noDot, packageOf, rewriteDeclarationSpecifiers, SCOPE, tarballName, targetsOf } from "./pack-library.ts";

/** What is wrong with the package, one sentence each. */
export type Findings = readonly string[];

type Json = Readonly<Record<string, unknown>>;
const text = (v: unknown): string => (typeof v === "string" ? v : "");
const objectOf = (v: unknown): Json => (isObject(v) ? v : {});
const byName = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** The package of commons that every specifier of a library is rewritten into. */
export const SELF = SINGLE.package;

// ---------------------------------------------------------------------------------------------------------------------
// the facts of the libraries
// ---------------------------------------------------------------------------------------------------------------------

/** A command of a library: its name, the library, and the module (from the library's folder) that its launcher imports; `main` is a module whose `main(argv)` gives the exit status, `script` one that runs when it is loaded. */
export type Command = { readonly name: string; readonly library: string; readonly module: string; readonly form: "main" | "script" };

/** A library as the package reads it. */
export type Facts = {
  readonly name: string;
  /** The library's folder from `commons/` (`anyfs/s3`): its name where it is a folder of its own (0027-commons-libraries FR-026). */
  readonly dir: string;
  readonly version: string;
  readonly summary: string;
  /** How far the library is built and proved, in a sentence: `stable`, `preview`, or `experimental` with what is not done. */
  readonly maturity: string;
  /** Each key of the library's `exports` and the source file it names, from the library's folder (`./src/mod.ts`). */
  readonly exports: Readonly<Record<string, string>>;
  /** The folders of the library's folder that its entries and commands are in (`src`; `engine`, `sql`, ... for `data`). */
  readonly roots: readonly string[];
  /** The other folders of the library's folder that the package ships beside them: what the library reads at run time (`data`, `guides`, `install`); see {@link NOT_RUNTIME}. */
  readonly folders: readonly string[];
  /** The commands the library declares in `bin`. */
  readonly bin: Readonly<Record<string, string>>;
  /** Its runtime dependencies on packages that are not of commons, each with the version the library names. */
  readonly dependencies: Readonly<Record<string, string>>;
  /** What it names of the packages of {@link SINGLE_PEERS} in its `dependencies` or `devDependencies`, with the version it names: the package asks the consumer for them, and compiling needs them. */
  readonly peers: Readonly<Record<string, string>>;
  /** Its `devDependencies` that are not of commons: what the compiler needs of it besides its runtime dependencies. */
  readonly devDependencies: Readonly<Record<string, string>>;
};

/** The key an entry of a library has in the package: `.` of `core` is `./core`, `./sha256` of it is `./core/sha256`. */
export function exportKey(library: string, key: string): string {
  return key === "." ? `./${library}` : `./${library}/${key.replace(/^\.\//, "")}`;
}

/** The libraries that the one package holds: every folder with a manifest that is not a metapackage and that `SINGLE_EXCLUDED` does not name, in the order of their names. */
export function packableLibraries(repo: string): { readonly libraries: readonly Library[]; readonly problems: Findings } {
  const out: Library[] = [];
  const problems: string[] = [];
  for (const f of readLibraries(repo)) {
    if ("problem" in f) {
      problems.push(`commons/${f.dir}/library.ts: ${f.problem}`);
      continue;
    }
    if (f.library.bundle !== undefined || SINGLE_EXCLUDED.has(f.library.name)) continue;
    out.push(f.library);
  }
  return { libraries: out, problems };
}

/**
 * The folders of a library's folder that are not shipped: what develops, proves and documents the library and is never read by its code at run time (its tests, its specifications, its tools and its acceptance kits, 0027-commons-libraries FR-025), what
 * the packer makes itself (the launchers of `bin`) and what a build or an install leaves. Every other folder of a library's folder is shipped beside its sources and its compiled files, so that a folder a library reads at run time (the data of a catalog, the guides of
 * Docs) is in the package without a list that someone keeps.
 */
export const NOT_RUNTIME: ReadonlySet<string> = new Set(["suite", "spec-kit", "tools", "acceptance", "oat", "uat", "aat", "bin", "dist", "node_modules"]);

/** The first folder of a path from a library's folder: `./src/mod.ts` is `src`. */
const rootOf = (target: string): string => noDot(target).split("/")[0] ?? "";

/** The facts of a library from its manifest and its package; the problems where they do not agree. */
export function factsOf(repo: string, l: Library): { readonly facts: Facts; readonly problems: Findings } {
  const problems: string[] = [];
  const file = join(repo, "commons", folderOf(l), "package.json");
  const pkg = existsSync(file) ? objectOf(JSON.parse(readTextFileSync(file)) as unknown) : {};
  if (!existsSync(file)) problems.push(`commons/${folderOf(l)}/package.json is missing`);
  const exportsOut: Record<string, string> = {};
  for (const [k, v] of Object.entries(objectOf(pkg["exports"]))) {
    const target = typeof v === "string" ? v : text(targetsOf(v)["default"]);
    if (!target.endsWith(".ts")) problems.push(`commons/${folderOf(l)}: the export ${k} names ${target === "" ? "no file" : target}, which is not a TypeScript source`);
    else exportsOut[k] = target;
  }
  const manifestKeys = [...l.exports].sort(byName).join(",");
  const packageKeys = Object.keys(exportsOut).sort(byName).join(",");
  if (manifestKeys !== packageKeys) problems.push(`commons/${folderOf(l)}: the exports of library.ts (${manifestKeys}) are not those of package.json (${packageKeys})`);
  const bin = Object.fromEntries(Object.entries(objectOf(pkg["bin"])).flatMap(([k, v]) => (typeof v === "string" ? [[k, v] as const] : [])));
  const roots = [...new Set([...Object.values(exportsOut), ...Object.values(bin).filter((b) => b.endsWith(".ts"))].map(rootOf))].filter((r) => r !== "").sort(byName);
  const dir = join(repo, "commons", folderOf(l));
  const folders = (existsSync(dir) ? readDirSync(dir) : []).filter((e) => e.isDirectory && !e.name.startsWith(".") && !NOT_RUNTIME.has(e.name) && !roots.includes(e.name) && !existsSync(join(dir, e.name, "library.ts"))).map((e) => e.name).sort(byName);
  const strings = (v: unknown): Record<string, string> => Object.fromEntries(Object.entries(objectOf(v)).flatMap(([k, x]) => (typeof x === "string" ? [[k, x] as const] : [])));
  const declared = Object.fromEntries(Object.entries(strings(pkg["dependencies"])).filter(([k]) => !k.startsWith(`${SCOPE}/`)));
  const dev = strings(pkg["devDependencies"]);
  // what the package asks of the consumer is not installed by it: it is a peer (0036-distribution FR-023)
  const dependencies = Object.fromEntries(Object.entries(declared).filter(([k]) => !SINGLE_PEERS.has(k)));
  const peers = Object.fromEntries([...SINGLE_PEERS].flatMap(([d, rule]) => {
    const version = (rule.pinnedBy === "dependencies" ? declared : dev)[d];
    return version === undefined ? [] : [[d, version] as const];
  }));
  return {
    facts: {
      name: l.name,
      dir: folderOf(l),
      version: l.version,
      summary: l.summary ?? text(pkg["description"]),
      maturity: maturitySentence(l),
      exports: exportsOut,
      roots,
      folders,
      bin,
      dependencies,
      peers,
      devDependencies: Object.fromEntries(Object.entries(dev).filter(([k]) => !k.startsWith(`${SCOPE}/`))),
    },
    problems,
  };
}

/** The commands whose launchers are not the library's own bin file: the file is made by the packer of the library (`ifc-docs`) or the command is the module itself (`arcactl`). */
export const LAUNCHED: ReadonlyMap<string, { readonly module: string; readonly form: "main" | "script" }> = new Map([
  ["docs:ifc-docs", { module: "src/cli.ts", form: "main" }],
  ["data:arcactl", { module: "sql/cli/arcactl.ts", form: "script" }],
]);

/** The module a command's launcher imports, read from the library's own bin file (`import { main } from "../src/x.ts"`) or from `LAUNCHED`. */
export function commandOf(repo: string, library: string, name: string, target: string, dir: string = library): { readonly command: Command | undefined; readonly problem: string | undefined } {
  const known = LAUNCHED.get(`${library}:${name}`);
  if (known !== undefined) return { command: { name, library, module: known.module, form: known.form }, problem: undefined };
  const file = join(repo, "commons", dir, noDot(target));
  if (!existsSync(file)) return { command: undefined, problem: `commons/${dir}: the command ${name} names ${target}, which is not there, and no launcher is known for it` };
  const m = /import\s*\{\s*main\s*\}\s*from\s*["'](\.[^"']+\.ts)["']/.exec(readTextFileSync(file));
  if (m?.[1] === undefined) return { command: undefined, problem: `commons/${dir}: the command ${name} (${target}) does not import \`main\` from a module of the library` };
  return { command: { name, library, module: noDot(toPosix(join(dirname(noDot(target)), m[1]))), form: "main" }, problem: undefined };
}

/** The commands of the libraries, and the problems: two libraries that declare one name are a collision. */
export function commandsOf(repo: string, facts: readonly Facts[]): { readonly commands: readonly Command[]; readonly problems: Findings } {
  const commands: Command[] = [];
  const problems: string[] = [];
  const seen = new Map<string, string>();
  for (const f of facts) {
    for (const [name, target] of Object.entries(f.bin)) {
      const first = seen.get(name);
      if (first !== undefined) {
        problems.push(`the command ${name} is declared by ${first} and by ${f.name}: a command has one name in the package`);
        continue;
      }
      seen.set(name, f.name);
      const c = commandOf(repo, f.name, name, target, f.dir);
      if (c.problem !== undefined) problems.push(c.problem);
      if (c.command !== undefined) commands.push(c.command);
    }
  }
  return { commands, problems };
}

/** The union of the runtime dependencies of the libraries that the package installs, and the problems: two versions of one package are a conflict, and a version that is not exact is refused. The packages the package asks of the consumer are not among them (`peersOf`). */
export function unionDependencies(facts: readonly Facts[]): { readonly dependencies: Readonly<Record<string, string>>; readonly problems: Findings } {
  const out = new Map<string, { readonly version: string; readonly by: string }>();
  const problems: string[] = [];
  for (const f of facts) {
    for (const [name, version] of Object.entries(f.dependencies)) {
      const had = out.get(name);
      if (had === undefined) out.set(name, { version, by: f.name });
      else if (had.version !== version) problems.push(`${name} is ${had.version} in ${had.by} and ${version} in ${f.name}: the package has one version of it`);
    }
  }
  for (const [name, { version, by }] of out) if (!EXACT.test(version)) problems.push(`${name} is ${version} in ${by}, which is not an exact version`);
  return { dependencies: Object.fromEntries([...out].sort(([a], [b]) => byName(a, b)).map(([k, v]) => [k, v.version])), problems };
}

/** An exact version of npm: three numbers and, optionally, a prerelease. */
export const EXACT = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/** What the package asks of the consumer (0036-distribution FR-023): the `peerDependencies` with their ranges and the `peerDependenciesMeta` that marks each optional one, from `SINGLE_PEERS` for the packages the libraries name; two libraries that name two versions of one of them are a finding. `@types/node` is added by the packer where a declaration names a type of Node, and is not optional. */
export function peersOf(facts: readonly Facts[]): { readonly peerDependencies: Readonly<Record<string, string>>; readonly peerDependenciesMeta: Readonly<Record<string, { readonly optional: true }>>; readonly problems: Findings } {
  const seen = new Map<string, { readonly version: string; readonly by: string }>();
  const problems: string[] = [];
  for (const f of facts) {
    for (const [name, version] of Object.entries(f.peers)) {
      const had = seen.get(name);
      if (had === undefined) seen.set(name, { version, by: f.name });
      else if (had.version !== version) problems.push(`${name} is ${had.version} in ${had.by} and ${version} in ${f.name}: the libraries are written against one version of it`);
    }
  }
  const names = [...seen.keys()].sort(byName);
  const rules = names.flatMap((n) => {
    const r = SINGLE_PEERS.get(n);
    return r === undefined ? [] : [[n, r] as const];
  });
  return {
    peerDependencies: Object.fromEntries(rules.map(([n, r]) => [n, r.range])),
    peerDependenciesMeta: Object.fromEntries(rules.filter(([, r]) => r.optional).map(([n]) => [n, { optional: true as const }])),
    problems,
  };
}

/** The `exports` of the package for these libraries: each entry names the declarations, the source for Bun and the compiled file of the library's entry, under the folder of the library. */
export function exportsMap(facts: readonly Facts[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of [...facts].sort((a, b) => byName(a.name, b.name))) {
    for (const [key, target] of Object.entries(f.exports).sort(([a], [b]) => byName(a, b))) {
      const rel = noDot(target).replace(/\.ts$/, "");
      // the declarations are in `dist/`; the compiled file is beside its source, so that what a module reads is at one path for Bun and for Node (0036-distribution FR-030)
      out[exportKey(f.name, key)] = { types: `./${f.name}/dist/${rel}.d.ts`, bun: `./${f.name}/${noDot(target)}`, default: `./${f.name}/${rel}.js` };
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// the specifiers
// ---------------------------------------------------------------------------------------------------------------------

/** A specifier that names a library of commons by its own package: `@intellectual-frontiers/<library>` and a subpath. */
const NAMED = /@intellectual-frontiers\/([^"'/\s]+)(\/[^"'\s]*)?/g;

/**
 * The text with every specifier of a library of commons written as the specifier of the package, and the libraries it names that are no library of the package. A specifier is rewritten where it is imported and where a comment shows it
 * in an example (the example of a documentation block is what a reader copies); the text of a string that is no specifier is left as it is.
 */
export function rewriteSpecifiers(source: string, libraries: ReadonlySet<string>): { readonly text: string; readonly unknown: readonly string[] } {
  const unknown = new Set<string>();
  const edits: { start: number; end: number; to: string }[] = [];
  for (const r of specifierRanges(source)) {
    const spec = r.specifier;
    const m = /^@intellectual-frontiers\/([^/]+)(\/.*)?$/.exec(spec);
    if (m?.[1] === undefined) continue;
    if (libraries.has(m[1])) edits.push({ ...r, to: `${SELF}/${m[1]}${m[2] ?? ""}` });
    else if (m[1] !== "commons" || m[2] === undefined) unknown.add(spec);
  }
  for (const c of scanSource(source).comments) {
    const body = source.slice(c.start, c.end);
    for (const m of body.matchAll(new RegExp(`(?:from\\s+|import\\s+|import\\(\\s*)["']${NAMED.source}(?=["'])`, "g"))) {
      const name = m[1] ?? "";
      if (!libraries.has(name)) continue;
      const at = c.start + (m.index ?? 0) + m[0].indexOf("@intellectual-frontiers/");
      edits.push({ start: at, end: at + `@intellectual-frontiers/${name}${m[2] ?? ""}`.length, to: `${SELF}/${name}${m[2] ?? ""}` });
    }
  }
  let text = source;
  for (const e of edits.sort((a, b) => b.start - a.start)) text = text.slice(0, e.start) + e.to + text.slice(e.end);
  return { text, unknown: [...unknown].sort(byName) };
}

/** The specifiers of a file that still name a library by its own package: none in a package. */
export function oldSpecifiers(source: string): readonly string[] {
  return importSpecifiers(source).filter((s) => s.startsWith(`${SCOPE}/`) && s !== SELF && !s.startsWith(`${SELF}/`));
}

// ---------------------------------------------------------------------------------------------------------------------
// what runs when a file is loaded
// ---------------------------------------------------------------------------------------------------------------------

const DECLARATION_START = /^(?:export|import|const|let|var|function|class|enum|abstract|declare|type|interface|namespace|else|catch|finally|return|case|default)\b|^async\s+function\b|^(?:[}\])]|;|$)/;

/** Whether a compiled file does something when it is loaded: a statement at the top level that is not a declaration, an import or an export (a call, an assignment, a condition, a loop), other than the block that runs only where the file is the program (`if (import.meta.main)`). */
export function runsWhenLoaded(compiled: string): boolean {
  const lines = scanSource(compiled).code.split("\n");
  // a statement starts where the one before it ended (`;` or `}`); any other line at the left margin goes on with the statement before it (an argument or an operand on a line of its own, the end of a template literal)
  let ended = true;
  for (let k = 0; k < lines.length; k++) {
    const line = lines[k] ?? "";
    if (line.trim() === "") continue;
    const start = ended && !/^\s/.test(line);
    const tail = line.trimEnd().slice(-1);
    ended = tail === ";" || tail === "}";
    if (!start || DECLARATION_START.test(line)) continue;
    if (/^if\s*\(\s*import\.meta\.main\s*\)/.test(line)) {
      // the guard: a block to its closing brace at the left margin, or the rest of the statement
      if (/\{\s*$/.test(line)) {
        while (k + 1 < lines.length && !/^\}/.test(lines[k + 1] ?? "")) k++;
        k++;
      }
      ended = true;
      continue;
    }
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------------------------------------------------
// the content policy, the budget and the report
// ---------------------------------------------------------------------------------------------------------------------

/** The specifiers a source imports statically: those after `from` and after a bare `import`, never `import(` and never a statement of types only (`import type`, `export type`), which leaves no import at run time. */
export function staticSpecifiers(source: string): readonly string[] {
  return specifierRanges(source)
    .filter((r) => r.kind !== "dynamic" && r.kind !== "type")
    .map((r) => r.specifier);
}

/** What only commons needs internally and never ships (0036-distribution FR-031): the folders of a library that develop, prove and document it, the tests, the source maps, the lockfiles, the baselines of the checks and the manifest of the library. */
export const INTERNAL_PATHS: readonly RegExp[] = [/^[^/]+\/(?:suite|spec-kit|tools|acceptance|oat|uat|aat|node_modules)\//, /\.test\.(?:ts|js|d\.ts)$/, /\.map$/, /(?:^|\/)bun\.lock$/, /\.baseline\.txt$/, /^[^/]+\/(?:library|release|about)\.ts$/];

/** The kinds of file the report counts. */
export const KINDS = ["compiled", "source", "declaration", "data", "documentation", "package"] as const;
/** A kind of file. */
export type Kind = (typeof KINDS)[number];

/** The kind of a file of the staged package: the declarations are the `.d.ts` of `dist/`, a source is a `.ts`, a compiled file is a `.js` beside a source of the same name, documentation is Markdown, and what else a library carries is data. */
export function kindOf(rel: string, files: ReadonlySet<string>): Kind {
  if (!rel.includes("/") || rel.startsWith("bin/")) return "package";
  if (rel.endsWith(".d.ts")) return "declaration";
  if (rel.endsWith(".ts")) return "source";
  if (/\.m?js$/.test(rel) && files.has(rel.replace(/\.m?js$/, ".ts"))) return "compiled";
  return rel.endsWith(".md") ? "documentation" : "data";
}

/** The bytes and the files of one set of files, by kind. */
export type Sizes = { readonly files: number; readonly bytes: number; readonly byKind: Readonly<Record<Kind, { readonly files: number; readonly bytes: number }>> };

/** What was packed, for the page of the site and for the budget (0036-distribution FR-032). */
export type PackageReport = {
  readonly name: string;
  readonly version: string;
  readonly total: Sizes;
  readonly tarballBytes: number | undefined;
  readonly libraries: readonly (Sizes & { readonly name: string })[];
  readonly dependencies: Readonly<Record<string, string>>;
  readonly peerDependencies: Readonly<Record<string, string>>;
  readonly optionalPeers: readonly string[];
  readonly budget: typeof SINGLE_BUDGET;
};

const emptyKinds = (): Record<Kind, { files: number; bytes: number }> => Object.fromEntries(KINDS.map((k) => [k, { files: 0, bytes: 0 }])) as Record<Kind, { files: number; bytes: number }>;

/** The report of a staged package: its sizes in all, by library and by kind, and what it depends on and asks of the consumer. */
export function reportOfStage(stage: string, tarballBytes?: number): PackageReport {
  const manifest = objectOf(JSON.parse(readTextFileSync(join(stage, "package.json"))) as unknown);
  const files = filesUnder(stage);
  const set = new Set(files);
  const tally = (): { files: number; bytes: number; byKind: Record<Kind, { files: number; bytes: number }> } => ({ files: 0, bytes: 0, byKind: emptyKinds() });
  const total = tally();
  const by = new Map<string, ReturnType<typeof tally>>();
  for (const rel of files) {
    const bytes = readFileBytes(join(stage, rel));
    const kind = kindOf(rel, set);
    const lib = rel.includes("/") && !rel.startsWith("bin/") ? (rel.split("/")[0] ?? "") : "";
    const t = lib === "" ? undefined : (by.get(lib) ?? tally());
    for (const x of t === undefined ? [total] : [total, t]) {
      x.files += 1;
      x.bytes += bytes;
      x.byKind[kind].files += 1;
      x.byKind[kind].bytes += bytes;
    }
    if (t !== undefined) by.set(lib, t);
  }
  const meta = objectOf(manifest["peerDependenciesMeta"]);
  const hidden = objectOf(manifest["ifcOptionalPeers"]);
  return {
    name: text(manifest["name"]),
    version: text(manifest["version"]),
    total,
    tarballBytes,
    libraries: [...by].sort(([a], [b]) => byName(a, b)).map(([name, t]) => ({ name, ...t })),
    dependencies: Object.fromEntries(Object.entries(objectOf(manifest["dependencies"])).map(([k, v]) => [k, text(v)])),
    peerDependencies: Object.fromEntries(Object.entries({ ...objectOf(manifest["peerDependencies"]), ...hidden }).map(([k, v]) => [k, text(v)])),
    optionalPeers: [...new Set([...Object.keys(meta), ...Object.keys(hidden)])].sort(byName),
    budget: SINGLE_BUDGET,
  };
}

const readFileBytes = (file: string): number => statSync(file).size;

/** The text of the table `--size` prints: the package, its kinds, its libraries by size, and its dependencies. */
export function sizeTable(r: PackageReport): string {
  const mb = (b: number): string => `${(b / 1_048_576).toFixed(2)} MB`;
  const rows = [`${r.name}@${r.version}: ${r.total.files} files, ${mb(r.total.bytes)} apparent${r.tarballBytes === undefined ? "" : `, ${mb(r.tarballBytes)} tarball`} (budget ${SINGLE_BUDGET.files} files, ${mb(SINGLE_BUDGET.apparentBytes)}, ${mb(SINGLE_BUDGET.tarballBytes)} tarball)`, ""];
  rows.push("by kind:");
  for (const k of KINDS) rows.push(`  ${k.padEnd(14)} ${String(r.total.byKind[k].files).padStart(5)} files ${mb(r.total.byKind[k].bytes).padStart(10)}`);
  rows.push("", "by library (largest first):");
  for (const l of [...r.libraries].sort((a, b) => b.bytes - a.bytes)) rows.push(`  ${l.name.padEnd(30)} ${String(l.files).padStart(5)} files ${mb(l.bytes).padStart(10)}`);
  rows.push("", `dependencies: ${Object.keys(r.dependencies).length === 0 ? "none" : Object.entries(r.dependencies).map(([k, v]) => `${k}@${v}`).join(", ")}`);
  rows.push(`peer dependencies: ${Object.entries(r.peerDependencies).map(([k, v]) => `${k} ${v}${r.optionalPeers.includes(k) ? " (optional)" : ""}`).join(", ") || "none"}`);
  return `${rows.join("\n")}\n`;
}

// ---------------------------------------------------------------------------------------------------------------------
// the inspection
// ---------------------------------------------------------------------------------------------------------------------

const BUILTIN = /^(?:node|bun|data):/;
const COMPILED = /\.(?:js|mjs)$/;

/** What is wrong with the package staged in a folder (the files of the tarball, `package/` unpacked), for the libraries it is to hold: see the remarks of this module. */
export function inspectCommons(stage: string, libraries: readonly string[]): Findings {
  const found: string[] = [];
  const manifestFile = join(stage, "package.json");
  if (!existsSync(manifestFile)) return ["package.json is not in the package"];
  const manifest = objectOf(JSON.parse(readTextFileSync(manifestFile)) as unknown);
  if (manifest["name"] !== SELF) found.push(`the package is named ${text(manifest["name"])}, not ${SELF}`);
  if (manifest["private"] === true) found.push("the package is private");
  if (!/^\d+\.\d+\.\d+/.test(text(manifest["version"]))) found.push(`the version ${text(manifest["version"])} is not a version`);
  if (text(manifest["license"]) === "") found.push("the package names no license");
  for (const f of ["README.md", "LICENSE"]) if (!existsSync(join(stage, f))) found.push(`${f} is not in the package`);
  const files = new Set(filesUnder(stage));
  const exportsMap = objectOf(manifest["exports"]);
  const deps = objectOf(manifest["dependencies"]);
  const declared = new Set<string>([...Object.keys(deps), ...Object.keys(objectOf(manifest["peerDependencies"])), ...Object.keys(objectOf(manifest["optionalDependencies"])), ...Object.keys(objectOf(manifest["ifcOptionalPeers"]))]);
  for (const [name, version] of Object.entries(deps)) if (typeof version !== "string" || !EXACT.test(version)) found.push(`${name} is ${String(version)}, which is not an exact version`);
  // every library has entries
  for (const lib of libraries) {
    const own = `./${lib}`;
    if (!Object.keys(exportsMap).some((k) => k === own || k.startsWith(`${own}/`))) found.push(`the library ${lib} has no entry in the exports`);
  }
  // every entry names its declarations, its source and its compiled file
  for (const [key, entry] of Object.entries(exportsMap)) {
    if (!key.startsWith("./")) found.push(`the export ${key} is not a subpath`);
    const t = targetsOf(entry);
    for (const cond of ["types", "bun", "default"]) {
      const target = t[cond];
      if (target === undefined) found.push(`the export ${key} names no \`${cond}\` file`);
      else if (!files.has(noDot(target))) found.push(`the export ${key} (${cond}) names ${target}, which is not in the package`);
    }
  }
  // a command names a file of the package
  const bin = objectOf(manifest["bin"]);
  for (const [cmd, target] of Object.entries(bin)) if (typeof target !== "string" || !files.has(noDot(target))) found.push(`the command ${cmd} names ${String(target)}, which is not in the package`);
  // the files of the libraries: what they import
  const effects = new Set<string>();
  const sideEffects = manifest["sideEffects"];
  const covered = (file: string): boolean => sideEffects === true || (Array.isArray(sideEffects) && sideEffects.some((s) => typeof s === "string" && noDot(s) === file));
  for (const f of files) {
    if (f === "package.json" || f === "README.md" || f === "LICENSE" || f.startsWith("bin/")) continue;
    const isDecl = f.endsWith(".d.ts");
    const isCode = COMPILED.test(f) || (f.endsWith(".ts") && !isDecl);
    if (!isDecl && !isCode) continue;
    const source = readTextFileSync(join(stage, f));
    for (const s of oldSpecifiers(source)) found.push(`${f} imports ${s}, which names a library by its own package: it is a specifier of the package ${SELF}`);
    if (isDecl && /(?:from\s+|import\(\s*)["']\.[^"']*\.ts["']/.test(source)) found.push(`${f} imports a \`.ts\` path, which a consumer's compiler cannot read`);
    for (const s of importSpecifiers(source)) {
      if (s.startsWith(".")) {
        const base = toPosix(join(dirname(f), s));
        const wanted = isDecl ? [base.replace(/\.(?:js|ts|mjs)$/, "") + ".d.ts"] : COMPILED.test(f) ? [base] : [base, `${base}.ts`, `${base}/mod.ts`];
        if (!wanted.some((w) => files.has(w))) found.push(`${f} imports ${s}, which is not in the package`);
        continue;
      }
      if (BUILTIN.test(s)) continue;
      const pkg = packageOf(s);
      if (pkg === undefined) continue;
      if (pkg === SELF) {
        if (s === SELF) found.push(`${f} imports ${s}, which is no entry: the package has an entry for each library`);
        else if (!(`.${s.slice(SELF.length)}` in exportsMap)) found.push(`${f} imports ${s}, which is no key of the exports`);
      } else if (!declared.has(pkg)) found.push(`${f} imports ${pkg}, which is not a dependency of ${SELF}`);
    }
    if (COMPILED.test(f) && runsWhenLoaded(source)) effects.add(f);
  }
  // a file that does something when it is loaded is named in `sideEffects`; the package never says otherwise
  if (sideEffects !== true) {
    if (sideEffects !== false && !Array.isArray(sideEffects)) found.push("sideEffects is neither a list of files nor a boolean");
    for (const f of effects) if (!covered(f)) found.push(`${f} does something when it is loaded, and sideEffects does not name it`);
  }
  // the declarations that name the types of Node need them where the package is type-checked
  if (namesNodeTypes(stage) && declared.has("@types/node") === false) found.push("a declaration names a type of Node and @types/node is not a dependency or a peer dependency");
  // the peers (0036-distribution FR-023, FR-033): asked for with a range, never installed, and an optional one is never imported statically. Where the registry drops peerDependenciesMeta an optional peer is in ifcOptionalPeers and not in peerDependencies
  const peerDeps = objectOf(manifest["peerDependencies"]);
  const peerMeta = objectOf(manifest["peerDependenciesMeta"]);
  const hidden = objectOf(manifest["ifcOptionalPeers"]);
  const metaKept = optionalPeersAsPeerDependencies();
  const optional = new Set<string>();
  for (const [name, rule] of SINGLE_PEERS) {
    if (rule.optional && !metaKept && peerDeps[name] !== undefined) found.push(`${name} is an optional peer listed in peerDependencies: the registry drops peerDependenciesMeta, so a package manager would install it (FR-023)`);
    const asked = rule.optional && !metaKept ? hidden[name] : peerDeps[name];
    if (asked === undefined) continue;
    if (name in deps) found.push(`${name} is a dependency and a peer dependency of the package: the consumer installs it`);
    if (asked !== rule.range) found.push(`${name} is asked for as ${text(asked)}, and SINGLE_PEERS says ${rule.range}`);
    if (rule.optional && metaKept && !isObject(peerMeta[name])) found.push(`${name} is an optional peer and peerDependenciesMeta does not say so`);
    if (rule.optional) optional.add(name);
  }
  for (const name of Object.keys(deps)) if (SINGLE_PEERS.has(name)) found.push(`${name} is installed by the package: it is a peer (SINGLE_PEERS)`);
  for (const f of files) {
    if (f.endsWith(".d.ts") || !/\.(?:ts|js|mjs)$/.test(f)) continue;
    for (const s of staticSpecifiers(readTextFileSync(join(stage, f)))) {
      const pkg = packageOf(s);
      if (pkg !== undefined && optional.has(pkg)) found.push(`${f} imports the optional peer ${pkg} statically: it is loaded with import() where it is used, and the missing package is said (0036-distribution FR-033)`);
    }
  }
  // the content policy (FR-030, FR-031): dist/ holds declarations and nothing else, nothing internal ships, and no file is shipped twice
  const sizes = new Map<string, string[]>();
  for (const f of files) {
    if (/^[^/]+\/dist\//.test(f) && !f.endsWith(".d.ts")) found.push(`${f} is in dist/, which holds declarations only: a file a module reads is shipped once, beside its source`);
    if (INTERNAL_PATHS.some((re) => re.test(f))) found.push(`${f} is internal to commons (a test, a specification, a tool, a map, a lockfile or a baseline) and is not shipped`);
    if (!/\.(?:ts|js|mjs)$/.test(f) && f.includes("/") && !f.startsWith("bin/")) {
      const key = `${f.split("/")[0]}\u0000${createHash("sha256").update(readFileSync(join(stage, f))).digest("hex")}`;
      sizes.set(key, [...(sizes.get(key) ?? []), f]);
    }
  }
  for (const group of sizes.values()) if (group.length > 1) found.push(`${group.join(" and ")} are the same file shipped twice`);
  return found;
}

/** What the size of the package staged in a folder says against its budget (0036-distribution FR-032): an advisory, a growth that is said and that never stops a release, since how big a package is does not make it unbuildable or unsafe. */
export function budgetAdvisories(stage: string, budget: { readonly apparentBytes: number; readonly files: number } = SINGLE_BUDGET): Findings {
  const files = filesUnder(stage);
  const apparent = files.reduce((n, f) => n + readFileBytes(join(stage, f)), 0);
  const found: string[] = [];
  if (files.length > budget.files) found.push(`the package has ${files.length} files, and the budget is ${budget.files}`);
  if (apparent > budget.apparentBytes) found.push(`the package is ${apparent} bytes apparent, and the budget is ${budget.apparentBytes}`);
  return found;
}

// ---------------------------------------------------------------------------------------------------------------------
// the package
// ---------------------------------------------------------------------------------------------------------------------

/** What the packer is given besides the repository: the TypeScript compiler to run, how many libraries to build at once. */
export type PackCommonsOptions = {
  /** The compiler's entry (`node_modules/typescript/bin/tsc`); where it is not given, the one of `commons/commons` or of the root of the repository. */
  readonly tsc?: string;
  /** The folder whose `node_modules` holds `@types/node` and the third-party packages the libraries import; the folder of the package (`commons/commons`) where it is not given. */
  readonly toolsFolder?: string;
  readonly parallel?: number;
};

/** What packing made: the stage, the tarball where nothing was wrong, the findings that stop the packing, the advisories that do not (the size budget: 0036-distribution FR-032), the manifest and the counts. */
export type PackedCommons = {
  readonly stage: string;
  readonly tarball: string | undefined;
  readonly findings: Findings;
  readonly advisories: Findings;
  readonly manifest: Json;
  readonly counts: { readonly libraries: number; readonly files: number; readonly exports: number; readonly commands: number; readonly sideEffects: number };
};

const EMPTY_COUNTS = { libraries: 0, files: 0, exports: 0, commands: 0, sideEffects: 0 } as const;

async function pool<T, R>(items: readonly T[], limit: number, f: (item: T) => Promise<R>): Promise<readonly R[]> {
  const out: R[] = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    for (let at = next++; at < items.length; at = next++) out[at] = await f(items[at] as T);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/** The compiler of the repository, or undefined where none is installed. */
function compilerOf(repo: string, folder: string, given: string | undefined): string | undefined {
  if (given !== undefined) return given;
  for (const c of [join(folder, "node_modules", "typescript", "bin", "tsc"), join(repo, "node_modules", "typescript", "bin", "tsc")]) if (existsSync(c)) return c;
  return undefined;
}

/** Builds one library: the compiler's output under `<work>/<library>/out/<library>/`, or the reason it could not. */
async function compileLibrary(repo: string, f: Facts, work: string, bun: string, tsc: string, tools: string): Promise<Findings> {
  const dir = join(work, f.name);
  mkdirSync(dir, { recursive: true });
  const commons = join(repo, "commons");
  writeTextFileSync(
    join(dir, "tsconfig.json"),
    JSON.stringify(
      {
        extends: toPosix(join(commons, "tsconfig.base.json")),
        compilerOptions: {
          noEmit: false,
          declaration: true,
          rewriteRelativeImportExtensions: true,
          rootDir: toPosix(commons),
          outDir: "out",
          types: ["node"],
          typeRoots: [toPosix(join(tools, "node_modules", "@types"))],
          skipLibCheck: true,
          preserveSymlinks: true,
        },
        include: f.roots.map((r) => `${toPosix(join(commons, f.dir, r))}/**/*.ts`),
      },
      null,
      2,
    ),
  );
  const built = await run([bun, tsc, "-p", join(dir, "tsconfig.json")], { cwd: dir });
  return built.code === 0 ? [] : [`${f.name}: the compiler stopped: ${`${built.stdout}${built.stderr}`.trim().split("\n").slice(0, 12).join("\n")}`];
}

/** The launcher of a command: the line Node runs, which imports the compiled module. */
export function launcherOf(c: Command): string {
  const rel = c.module.replace(/\.ts$/, "");
  const target = `../${c.library}/${rel}.js`;
  return c.form === "main"
    ? `#!/usr/bin/env node\nimport { main } from "${target}";\n\nprocess.exit(await main(process.argv.slice(2)));\n`
    : `#!/usr/bin/env node\nimport "${target}";\n`;
}

/** The README of the package: what it is, how it is installed, how a library is imported, and the table of the libraries. */
export function readmeOf(version: string, facts: readonly Facts[], commands: readonly Command[]): string {
  const rows = [...facts].sort((a, b) => byName(a.name, b.name)).map((f) => `| \`${SELF}/${f.name}\` | ${f.maturity.replace(/\|/g, "\\|")} | ${f.summary.replace(/\|/g, "\\|").split(/(?<=\.)\s/)[0] ?? ""} |`);
  return [
    `# ${SELF}`,
    "",
    "Intellectual Frontiers Commons as one package: every library of commons, at one version. The table says how far each library is built and proved: `experimental` (parts are missing, or it is proved only against fakes), `preview` (complete and verified, its interface may still change) or `stable`.",
    "",
    "```sh",
    `bun add ${SELF}@${version}     # or: npm install --save-exact ${SELF}@${version}`,
    "```",
    "",
    "A library is imported by its name under the package, and each of its subpaths under that:",
    "",
    "```ts",
    `import { ok, err } from "${SELF}/core";`,
    `import { sha256 } from "${SELF}/crypto/sha256";`,
    "```",
    "",
    `The package runs on Node 26 and Bun from its compiled files (Bun reads the sources by the \`bun\` condition) and carries the declarations of every entry. Pin it at an exact version.${commands.length === 0 ? "" : ` Its commands are ${commands.map((c) => `\`${c.name}\``).join(", ")}.`}`,
    "",
    "| Import | Maturity | What it is |",
    "| --- | --- | --- |",
    ...rows,
    "",
    `License: PolyForm-Noncommercial-1.0.0. Sources and specifications: https://github.com/intellectual-frontiers/.github/tree/main/commons`,
    "",
  ].join("\n");
}

/** Copies a file of the library into the package, rewriting the specifiers of a source or a declaration; the libraries it names that are no library of the package are returned. */
function place(from: string, to: string, libraries: ReadonlySet<string>, unknown: Set<string>, where: string): void {
  const source = readTextFileSync(from);
  mkdirSync(dirname(to), { recursive: true });
  if (/\.(?:js|mjs|ts)$/.test(from)) {
    const r = rewriteSpecifiers(from.endsWith(".d.ts") ? rewriteDeclarationSpecifiers(source) : source, libraries);
    for (const u of r.unknown) unknown.add(`${where} imports ${u}, which is no library of the package`);
    writeTextFileSync(to, r.text);
  } else writeTextFileSync(to, source);
}

/** Builds, stages, inspects and packs the one package of the repository at `repo`. */
export async function packCommons(repo: string, options: PackCommonsOptions = {}): Promise<PackedCommons> {
  const root = resolve(repo);
  const folder = join(root, SINGLE.folder);
  const dist = join(folder, "dist");
  const stage = join(dist, "package");
  const fail = (findings: Findings, manifest: Json = {}): PackedCommons => ({ stage, tarball: undefined, findings, advisories: [], manifest, counts: EMPTY_COUNTS });
  const own = existsSync(join(folder, "package.json")) ? objectOf(JSON.parse(readTextFileSync(join(folder, "package.json"))) as unknown) : undefined;
  const manifestOfFolder = readLibraries(root).find((f) => "library" in f && f.dir === SINGLE.slug);
  if (own === undefined || manifestOfFolder === undefined || !("library" in manifestOfFolder)) return fail([`${SINGLE.folder} has no package.json and no library.ts`]);
  const version = text(own["version"]);
  const listed = packableLibraries(root);
  const found: string[] = [...listed.problems];
  const facts: Facts[] = [];
  for (const l of listed.libraries) {
    const r = factsOf(root, l);
    found.push(...r.problems);
    facts.push(r.facts);
  }
  const cmds = commandsOf(root, facts);
  found.push(...cmds.problems);
  const union = unionDependencies(facts);
  found.push(...union.problems);
  if (found.length > 0) return fail(found);
  const tools = options.toolsFolder ?? folder;
  // what compiling needs is what the folder installs by itself: the manifest and the lockfile of the folder carry it (FR-029); a given tools folder (a test's) is its own
  if (options.toolsFolder === undefined) {
    const needed = toolsOfLibraries(root, facts, union.dependencies);
    found.push(...needed.problems, ...toolsFindingsOf(root, needed.tools));
    if (found.length > 0) return fail(found);
  }
  const tsc = compilerOf(root, folder, options.tsc);
  if (tsc === undefined) return fail([`the TypeScript compiler is not installed: run bun install in ${SINGLE.folder} (or at the root)`]);
  const bun = which("bun") ?? "bun";
  // the libraries by their names, and the third-party packages of the folder, where the sources of a library are resolved from (a fresh clone has installed only the folder of the package)
  const linked = linkAll(root);
  if ("problem" in linked) return fail([linked.problem]);
  const linkedTools = linkTools(root, tools);
  if ("problem" in linkedTools) return fail([linkedTools.problem]);
  if (existsSync(dist)) removeSync(dist, { recursive: true });
  mkdirSync(stage, { recursive: true });
  const work = join(dist, "work");
  const names = new Set(facts.map((f) => f.name));
  const compiled = await pool(facts, options.parallel ?? 4, (f) => compileLibrary(root, f, work, bun, tsc, tools));
  found.push(...compiled.flat());
  if (found.length > 0) return fail(found);
  // the files of each library: its compiled files and declarations, its sources and the files beside them
  const unknown = new Set<string>();
  for (const f of facts) {
    const out = join(work, f.name, "out");
    if (existsSync(join(out, f.dir)))
      for (const rel of filesUnder(join(out, f.dir))) {
        if (rel.endsWith(".d.ts")) place(join(out, f.dir, rel), join(stage, f.name, "dist", rel), names, unknown, `${f.name}/dist/${rel}`);
        else if (rel.endsWith(".js")) place(join(out, f.dir, rel), join(stage, f.name, rel), names, unknown, `${f.name}/${rel}`);
      }
    for (const other of existsSync(out) ? filesUnder(out).map((p) => p.split("/")[0] ?? "") : []) if (other !== (f.dir.split("/")[0] ?? "") && other !== "") unknown.add(`${f.name} reaches the folder ${other} of commons by a relative path`);
    for (const r of f.roots) {
      const from = join(root, "commons", f.dir, r);
      if (!existsSync(from)) continue;
      for (const rel of filesUnder(from)) {
        const source = join(from, rel);
        const inPackage = `${r}/${rel}`;
        place(source, join(stage, f.name, inPackage), names, unknown, `${f.name}/${inPackage}`);
      }
    }
    // the folders the library reads at run time, once: the compiled files are beside their sources, so the module that reads them finds them at the same path under Bun and under Node
    for (const r of f.folders) {
      const from = join(root, "commons", f.dir, r);
      for (const rel of filesUnder(from)) place(join(from, rel), join(stage, f.name, r, rel), names, unknown, `${f.name}/${r}/${rel}`);
    }
  }
  found.push(...[...unknown].sort(byName));
  // the commands
  const binOut: Record<string, string> = {};
  for (const c of cmds.commands) {
    const file = join(stage, "bin", `${c.name}.mjs`);
    mkdirSync(dirname(file), { recursive: true });
    writeTextFileSync(file, launcherOf(c));
    await chmod(file, 0o755);
    binOut[c.name] = `./bin/${c.name}.mjs`;
  }
  // the files that do something when they are loaded
  const effects: string[] = [];
  for (const rel of filesUnder(stage)) {
    if (COMPILED.test(rel) && !rel.startsWith("bin/") && runsWhenLoaded(readTextFileSync(join(stage, rel)))) {
      effects.push(rel);
      const src = rel.replace(/\.js$/, ".ts");
      if (existsSync(join(stage, src))) effects.push(src);
    }
  }
  const exportsOut = exportsMap(facts);
  const licenseId = licenseOf(manifestOfFolder.library);
  const asked = peersOf(facts);
  found.push(...asked.problems);
  // an optional peer is a peerDependencies entry marked optional where the registries keep peerDependenciesMeta; the GitHub package registry drops it, so there it is named in ifcOptionalPeers (FR-023)
  const metaKept = optionalPeersAsPeerDependencies();
  const required = Object.fromEntries(Object.entries(asked.peerDependencies).filter(([n]) => !(n in asked.peerDependenciesMeta)));
  const optionalOnes = Object.fromEntries(Object.entries(asked.peerDependencies).filter(([n]) => n in asked.peerDependenciesMeta));
  const peers = { ...(namesNodeTypes(stage) ? { "@types/node": ">=26" } : {}), ...required, ...(metaKept ? optionalOnes : {}) };
  const manifest: Json = {
    name: SELF,
    version,
    description: "Intellectual Frontiers Commons as one package: every library of commons at one version, with the declarations of each entry, for Bun and Node 26.",
    license: licenseId,
    type: "module",
    engines: { node: ">=26" },
    sideEffects: effects.map((e) => `./${e}`).sort(byName),
    bin: binOut,
    exports: exportsOut,
    dependencies: union.dependencies,
    ...(Object.keys(peers).length === 0 ? {} : { peerDependencies: peers }),
    ...(!metaKept || Object.keys(asked.peerDependenciesMeta).length === 0 ? {} : { peerDependenciesMeta: asked.peerDependenciesMeta }),
    ...(metaKept || Object.keys(optionalOnes).length === 0 ? {} : { ifcOptionalPeers: optionalOnes }),
    files: ["bin", ...facts.map((f) => f.name), "README.md", "LICENSE"],
    keywords: ["intellectual-frontiers", "commons"],
    repository: { type: "git", url: "git+https://github.com/intellectual-frontiers/.github.git", directory: SINGLE.folder },
    homepage: "https://github.com/intellectual-frontiers/.github/tree/main/commons",
    bugs: { url: "https://github.com/intellectual-frontiers/.github/issues" },
    // a package that is sent to the GitHub package registry alone says so (the scope maps to it); one that is also sent to npm says only that it is public, and the publication names the GitHub registry where it sends it there
    publishConfig: SINGLE_TARGETS.includes("npm") ? { access: "public" } : { registry: GITHUB_REGISTRY },
  };
  writeTextFileSync(join(stage, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  writeTextFileSync(join(stage, "README.md"), readmeOf(version, facts, cmds.commands));
  if (existsSync(join(folder, "LICENSE"))) writeTextFileSync(join(stage, "LICENSE"), readTextFileSync(join(folder, "LICENSE")));
  else found.push(`${SINGLE.folder} has no LICENSE; run: bun commons/libraries/src/license.ts`);
  found.push(...inspectCommons(stage, facts.map((f) => f.name)));
  const counts = { libraries: facts.length, files: filesUnder(stage).length, exports: Object.keys(exportsOut).length, commands: cmds.commands.length, sideEffects: effects.length };
  const advisories: string[] = [...budgetAdvisories(stage)];
  if (found.length > 0) return { stage, tarball: undefined, findings: found, advisories, manifest, counts };
  const packed = await run([bun, "pm", "pack", "--destination", dist], { cwd: stage });
  if (packed.code !== 0) return { stage, tarball: undefined, findings: [`bun pm pack stopped: ${packed.stderr || packed.stdout}`.trim()], advisories, manifest, counts };
  const tarball = join(dist, tarballName(SELF, version));
  // what was packed, as a report for the page of the site and the budget of the tarball (0036-distribution FR-032)
  const report = reportOfStage(stage, statSync(tarball).size);
  writeTextFileSync(join(dist, "package-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  if (report.tarballBytes !== undefined && report.tarballBytes > SINGLE_BUDGET.tarballBytes) advisories.push(`the tarball is ${report.tarballBytes} bytes, and the budget is ${SINGLE_BUDGET.tarballBytes}`);
  return { stage, tarball, findings: [], advisories, manifest, counts };
}

/** The facts of the package without compiling: the libraries, the keys of the `exports`, the commands and the dependencies, and what is wrong with them. */
export function reportOf(repo: string): { readonly libraries: readonly string[]; readonly exports: readonly string[]; readonly commands: readonly Command[]; readonly dependencies: Readonly<Record<string, string>>; readonly problems: Findings } {
  const root = resolve(repo);
  const listed = packableLibraries(root);
  const problems: string[] = [...listed.problems];
  const facts: Facts[] = [];
  for (const l of listed.libraries) {
    const r = factsOf(root, l);
    problems.push(...r.problems);
    facts.push(r.facts);
  }
  const cmds = commandsOf(root, facts);
  const union = unionDependencies(facts);
  return {
    libraries: facts.map((f) => f.name),
    exports: Object.keys(exportsMap(facts)),
    commands: cmds.commands,
    dependencies: union.dependencies,
    problems: [...problems, ...cmds.problems, ...union.problems],
  };
}

/** The keys of the package's `exports` that the libraries make (the keys, in order), for the floor of the release (0001-libraries FR-027). */
export function singleExportKeys(repo: string): readonly string[] {
  return reportOf(repo).exports;
}

/** The tools that compiling the libraries needs (FR-029): from their manifests and from what their packed sources import. */
export function toolsOfLibraries(repo: string, facts: readonly Facts[], union: Tools): { readonly tools: Tools; readonly problems: Findings } {
  const sources = facts.map((f) => ({ name: f.name, roots: f.roots, dependencies: f.dependencies, devDependencies: f.devDependencies }));
  const imported = importedPackages(facts.flatMap((f) => sourcesOf(repo, f.name, f.roots, f.dir)));
  // what the package asks of the consumer is not installed by it, and compiling needs it at the version the libraries are written against
  const pinned = Object.fromEntries(facts.flatMap((f) => Object.entries(f.peers)));
  return toolsOf(sources, { ...pinned, ...union }, imported);
}

/** What the manifest and the lockfile of the folder of the package lack of the tools. */
export function toolsFindingsOf(repo: string, tools: Tools): Findings {
  const folder = join(repo, SINGLE.folder);
  const read = (name: string): string | undefined => (existsSync(join(folder, name)) ? readTextFileSync(join(folder, name)) : undefined);
  return toolFindings(SINGLE.folder, read("package.json"), read("bun.lock"), tools);
}

/** `--tools`: the manifest and the lockfile of the folder hold the tools; written, or only checked. */
async function toolsMain(repo: string, check: boolean): Promise<number> {
  const root = resolve(repo);
  const listed = packableLibraries(root);
  const found: string[] = [...listed.problems];
  const facts: Facts[] = [];
  for (const l of listed.libraries) {
    const r = factsOf(root, l);
    found.push(...r.problems);
    facts.push(r.facts);
  }
  const union = unionDependencies(facts);
  found.push(...union.problems);
  const needed = toolsOfLibraries(root, facts, union.dependencies);
  found.push(...needed.problems);
  if (found.length > 0) {
    for (const f of found) console.error(f);
    return 1;
  }
  if (!check) found.push(...(await syncTools(root, SINGLE.folder, needed.tools)));
  else {
    const current = existsSync(join(root, SINGLE.folder, "package.json")) ? (JSON.parse(readTextFileSync(join(root, SINGLE.folder, "package.json"))) as { devDependencies?: Record<string, string> }).devDependencies ?? {} : {};
    const expected = devDependenciesOf(current, needed.tools);
    if (JSON.stringify(expected) !== JSON.stringify(current)) found.push(`${SINGLE.folder}/package.json has devDependencies that are not the tools of the libraries: run bun commons/libraries/src/pack-commons.ts --tools`);
    found.push(...toolsFindingsOf(root, needed.tools));
  }
  for (const f of found) console.error(f);
  if (found.length === 0) console.log(`${SINGLE.folder}: ${Object.keys(needed.tools).length} tools, in its package.json and its bun.lock`);
  return found.length > 0 ? 1 : 0;
}

/** The command line of `commons/commons/tools/pack.ts`: pack, print what was found (or the tarball) and the exit status. */
export async function main(repo: string, argv: readonly string[], options: PackCommonsOptions = {}): Promise<number> {
  const mode = activeMode(env.get(MODE_VARIABLE));
  if (mode.kind === "err") {
    console.error(mode.error);
    return 2;
  }
  if (mode.value !== "single") {
    console.error(`the distribution is ${mode.value}: the one package is made in single mode (${MODE_VARIABLE}=single)`);
    return 1;
  }
  // the check inside `verify` is left out where CI says nothing that the package is made of changed (`IFC_SKIP_PACK`); the packing for a publication is never skipped
  if (argv.includes("--check") && (env.get("IFC_SKIP_PACK") ?? "") !== "") {
    console.log("pack check skipped: no export and no packer changed in this push (IFC_SKIP_PACK); the release packs it");
    return 0;
  }
  if (argv.includes("--tools")) return toolsMain(repo, argv.includes("--check"));
  if (argv.includes("--report")) {
    const r = reportOf(repo);
    console.log(JSON.stringify({ libraries: r.libraries.length, exports: r.exports.length, commands: r.commands.map((c) => c.name), dependencies: r.dependencies, problems: r.problems }, null, 2));
    return r.problems.length > 0 ? 1 : 0;
  }
  const r = await packCommons(repo, options);
  for (const f of r.findings) console.error(f);
  for (const a of r.advisories) console.error(`finding, does not block the release: ${a}`);
  if (r.tarball === undefined) return 1;
  if (argv.includes("--size")) {
    console.log(sizeTable(reportOfStage(r.stage, statSync(r.tarball).size)));
    return 0;
  }
  console.log(argv.includes("--check") ? `packed ${r.tarball}: nothing wrong (${r.counts.libraries} libraries, ${r.counts.exports} entries, ${r.counts.files} files)` : r.tarball);
  return 0;
}

if (import.meta.main) {
  const at = process.argv.indexOf("--repo");
  process.exitCode = await main(at >= 0 ? resolve(process.argv[at + 1] ?? ".") : resolve("."), process.argv.slice(2));
}
