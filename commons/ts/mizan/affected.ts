/**
 * What a change affects (commons 0027-commons-libraries FR-019 to FR-022): the files a library's checks read, taken from its package and its sources, and the libraries that a list of changed files
 * affects, so that CI runs what changed and nothing else.
 *
 *     bun commons/ts/mizan/affected.ts --base origin/main        the libraries a change since the merge base with origin/main affects, as {"include":[{"name","folder","verify"}]}
 *     bun commons/ts/mizan/affected.ts --files a.ts,b/c.ts       the same for a list of files (paths from the repository's root)
 *     bun commons/ts/mizan/affected.ts --all                     every library
 *     bun commons/ts/mizan/affected.ts --inputs data             the folders and files the library `data` reads, one a line
 *     other flags: --repo DIR (the repository, the working folder by default)
 *
 * @remarks
 * A library depends on another folder of commons where its `package.json` names it by path (`link:`, `file:` or `workspace:`), and what it reads of it is what its sources import from the package (the
 * `exports` of the dependency say which file each import is), what its scripts run by a path to another folder (`bun ../ts/mizan/check.ts`), and everything those files import by a relative path, followed
 * file by file. An import that no entry of `exports` names takes the whole dependency. The library's inputs are also `commons/tools/**`, `.github/actions/**`, its own workflow and its own folder. A library is
 * affected where a changed file is among its inputs, or where a library it depends on is affected. Nothing is run and nothing is written; the result is the same for the same files.
 *
 * @limits
 * It reads sources with a pattern for `import`, `export ... from` and `import()`, which finds every file a source names (and at worst a file that a comment names, which only adds an input); a file that
 * is read by a program through a path it builds at run time is not found, and a dependency that a library has outside commons is not followed. Where Git cannot say what changed, every library is affected.
 *
 * @example
 * ```ts
 * import { affectedBy } from "./affected.ts";
 * affectedBy(".", ["commons/data/engine/api.ts"]).map((l) => l.name); // ["data"]
 * ```
 *
 * @module
 */
import process from "node:process";
import { existsSync, readDirSync, readTextFileSync } from "../runtime/fs.ts";
import { dirname, join, normalize, resolve, toPosix } from "../runtime/path.ts";
import { stdio } from "../runtime/mod.ts";
import { run } from "../runtime/proc.ts";
import { type Library, readLibraries } from "./libraries.ts";

/** What a library reads: its folder, the folders and files it takes from others, what it depends on, and the files it imports one by one. */
export type Inputs = {
  /** The paths of the library's inputs: `commons/<name>/` and each folder (`commons/ts/kernel/**`) or file the library takes from another. */
  readonly paths: readonly string[];
  /** The folders of commons that the library depends on through its package. */
  readonly dependsOn: readonly string[];
  /** Every file of another folder that it reads, from the repository's root, in order. */
  readonly files: readonly string[];
};

/** The folders whose change is every library's change: the tools that check a library and the action that installs Bun. */
export const SHARED = ["commons/tools/**", ".github/actions/**"] as const;

const SOURCE = /\.(?:ts|mts|js|mjs)$/;
const SPECIFIER = /(?:\bimport|\bexport)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/g;

const posix = (p: string): string => toPosix(normalize(p));

function objectOf(x: unknown): Readonly<Record<string, unknown>> {
  return typeof x === "object" && x !== null && !Array.isArray(x) ? Object.fromEntries(Object.entries(x)) : {};
}
const stringOf = (x: unknown): string | undefined => (typeof x === "string" ? x : undefined);

/** A package.json as the parts this reads. */
type Pkg = {
  readonly name: string | undefined;
  readonly exports: ReadonlyMap<string, string>;
  readonly dependencies: ReadonlyMap<string, string>;
  readonly scripts: readonly string[];
};

function readPackage(dir: string): Pkg | undefined {
  const file = join(dir, "package.json");
  if (!existsSync(file)) return undefined;
  const o = objectOf(JSON.parse(readTextFileSync(file)) as unknown);
  const exports = new Map<string, string>();
  for (const [k, v] of Object.entries(objectOf(o["exports"]))) {
    const target =
      stringOf(v) ??
      Object.values(objectOf(v))
        .map(stringOf)
        .find((s) => s !== undefined);
    if (target !== undefined) exports.set(k, target);
  }
  const dependencies = new Map<string, string>();
  for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"])
    for (const [k, v] of Object.entries(objectOf(o[field]))) if (typeof v === "string") dependencies.set(k, v);
  return {
    name: stringOf(o["name"]),
    exports,
    dependencies,
    scripts: Object.values(objectOf(o["scripts"])).flatMap((s) => (typeof s === "string" ? [s] : [])),
  };
}

/** The files under a folder that are sources, from the repository's root (`node_modules` and `dist` are not looked into). */
function sourcesUnder(root: string, dir: string): readonly string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const e of readDirSync(join(root, d))) {
      if (e.name === "node_modules" || e.name === "dist" || e.name.startsWith(".")) continue;
      const p = `${d}/${e.name}`;
      if (e.isDirectory) walk(p);
      else if (e.isFile && SOURCE.test(e.name)) out.push(p);
    }
  };
  walk(dir);
  return out.sort();
}

const specifiersOf = (text: string): readonly string[] =>
  [...text.matchAll(SPECIFIER)].map((m) => m[1] ?? m[2] ?? "").filter((s) => s !== "");

/** The file a relative specifier names, from the repository's root: the path as written, or with `.ts`, `/mod.ts` or `/index.ts`. */
function resolveFile(root: string, from: string, specifier: string): string | undefined {
  const base = posix(join(dirname(from), specifier));
  if (base.startsWith("..")) return undefined;
  for (const c of [base, `${base}.ts`, `${base}/mod.ts`, `${base}/index.ts`]) if (SOURCE.test(c) && existsSync(join(root, c))) return c;
  return undefined;
}

/** Every file reached from the entries by relative imports, the entries included. */
function closure(root: string, entries: readonly string[]): ReadonlySet<string> {
  const seen = new Set<string>();
  const todo = [...entries];
  for (let f = todo.pop(); f !== undefined; f = todo.pop()) {
    if (seen.has(f) || !existsSync(join(root, f))) continue;
    seen.add(f);
    if (!SOURCE.test(f)) continue;
    for (const s of specifiersOf(readTextFileSync(join(root, f)))) {
      if (!s.startsWith(".")) continue;
      const r = resolveFile(root, f, s);
      if (r !== undefined) todo.push(r);
    }
  }
  return seen;
}

/** The path as a filter reads it: the folder of a file two levels under `commons/<folder>/` is `commons/<folder>/<sub>/**`, one level `commons/<folder>/**`, and a file at the top is itself. */
function folderOf(file: string): string {
  const parts = file.split("/");
  if (parts[0] === "commons" && parts.length >= 4) return `commons/${parts[1] ?? ""}/${parts[2] ?? ""}/**`;
  if (parts[0] === "commons" && parts.length === 3) return `commons/${parts[1] ?? ""}/**`;
  return file;
}

/** What the library `name` reads (FR-020). */
export function inputsOf(repo: string, name: string): Inputs {
  const root = repo.replace(/[\\/]$/, "");
  const folder = `commons/${name}`;
  const pkg = readPackage(join(root, folder));
  const sources = sourcesUnder(root, folder);
  const texts = sources.map((f) => ({ f, text: readTextFileSync(join(root, f)) }));
  const entries = new Set<string>();
  const whole = new Set<string>();
  const dependsOn = new Set<string>();
  // a dependency by path: its folder, what the library's sources import from it, and the entries it maps them to
  for (const [dep, spec] of pkg?.dependencies ?? []) {
    const m = /^(?:link|file|workspace):(.+)$/.exec(spec);
    if (m?.[1] === undefined) continue;
    const dir = posix(join(folder, m[1]));
    if (dir.startsWith("..") || !existsSync(join(root, dir))) continue;
    const depPkg = readPackage(join(root, dir));
    dependsOn.add(dir.split("/")[1] ?? dir);
    const imported = new Set<string>();
    for (const { text } of texts)
      for (const s of specifiersOf(text))
        if (s === dep || s.startsWith(`${dep}/`)) imported.add(s === dep ? "." : `.${s.slice(dep.length)}`);
    for (const key of imported) {
      const target = depPkg?.exports.get(key);
      if (target === undefined) whole.add(`${dir}/**`);
      else entries.add(posix(join(dir, target)));
    }
  }
  // a path to another folder in a script of the package: `bun ../ts/mizan/check.ts`
  for (const script of pkg?.scripts ?? [])
    for (const m of script.matchAll(/(?:^|\s)(\.\.\/[\w./-]+)/g)) {
      const p = posix(join(folder, m[1] ?? ""));
      if (!p.startsWith("..") && existsSync(join(root, p)) && SOURCE.test(p)) entries.add(p);
    }
  const files = [...closure(root, [...entries])].filter((f) => !f.startsWith(`${folder}/`)).sort();
  const paths = [`${folder}/**`, ...new Set([...files.map(folderOf), ...whole, ...SHARED, `.github/workflows/${name}.auto.yml`])].sort();
  for (const f of files) {
    const d = f.split("/")[1];
    if (d !== undefined && d !== name && existsSync(join(root, "commons", d, "library.ts"))) dependsOn.add(d);
  }
  return { paths, dependsOn: [...dependsOn].sort(), files };
}

/** Whether a path of the repository is among the paths of an input: `dir/**` is the folder and what is under it, anything else the file. */
export function matches(paths: readonly string[], file: string): boolean {
  return paths.some((p) => (p.endsWith("/**") ? file.startsWith(p.slice(0, -2)) : p === file));
}

/** The libraries that a list of changed files affects (FR-021): those with a changed file among their inputs, and those that depend on one of these, in order of their names. */
export function affectedBy(repo: string, changed: readonly string[]): readonly (Library & { readonly folder: string })[] {
  const root = repo.replace(/[\\/]$/, "");
  const libs = readLibraries(root).flatMap((f) => ("library" in f ? [f.library] : []));
  const inputs = new Map(libs.map((l) => [l.name, inputsOf(root, l.name)]));
  const hit = new Set(libs.filter((l) => changed.some((c) => matches(inputs.get(l.name)?.paths ?? [], c))).map((l) => l.name));
  for (let grew = true; grew;) {
    grew = false;
    for (const l of libs) {
      if (!hit.has(l.name) && (inputs.get(l.name)?.dependsOn ?? []).some((d) => hit.has(d))) {
        hit.add(l.name);
        grew = true;
      }
    }
  }
  return libs.filter((l) => hit.has(l.name)).map((l) => ({ ...l, folder: `commons/${l.name}` }));
}

/** The files changed since the merge base of `base` and the head, tracked files of the working tree included; undefined where Git cannot say. */
export async function changedSince(repo: string, base: string): Promise<readonly string[] | undefined> {
  const root = resolve(repo);
  try {
    const mb = await run(["git", "-C", root, "merge-base", base, "HEAD"]);
    if (mb.code !== 0) return undefined;
    const d = await run(["git", "-C", root, "diff", "--name-only", mb.stdout.trim()]);
    return d.code === 0 ? d.stdout.split("\n").filter((l) => l !== "") : undefined;
  } catch {
    return undefined;
  }
}

/** The matrix a workflow reads: `{"include":[{"name","folder","verify"}]}`. */
export function matrixOf(libs: readonly (Library & { readonly folder: string })[]): string {
  return JSON.stringify({ include: libs.map((l) => ({ name: l.name, folder: l.folder, verify: l.verify })) });
}

/** The command line. Returns the exit status: 0, or 2 for a usage error. */
export async function main(argv: readonly string[]): Promise<number> {
  const arg = (flag: string): string | undefined => {
    const at = argv.indexOf(flag);
    return at >= 0 ? argv[at + 1] : undefined;
  };
  const repo = arg("--repo") ?? ".";
  const inputs = arg("--inputs");
  if (inputs !== undefined) {
    const i = inputsOf(repo, inputs);
    stdio.stdout.writeSync(`${[...i.paths, ...i.files.map((f) => `  ${f}`)].join("\n")}\n`);
    return 0;
  }
  const everything = readLibraries(repo).flatMap((f) => ("library" in f ? [{ ...f.library, folder: `commons/${f.dir}` }] : []));
  const files = arg("--files");
  const base = arg("--base");
  if (argv.includes("--all")) stdio.stdout.writeSync(`${matrixOf(everything)}\n`);
  else if (files !== undefined)
    stdio.stdout.writeSync(
      `${matrixOf(
        affectedBy(
          repo,
          files.split(",").filter((f) => f !== ""),
        ),
      )}\n`,
    );
  else if (base !== undefined) {
    const changed = await changedSince(repo, base);
    if (changed === undefined) stdio.stderr.writeSync(`affected: git cannot say what changed since ${base}; every library is affected\n`);
    stdio.stdout.writeSync(`${matrixOf(changed === undefined ? everything : affectedBy(repo, changed))}\n`);
  } else {
    stdio.stderr.writeSync("affected: give --base REF, --files a,b, --all or --inputs NAME\n");
    return 2;
  }
  return 0;
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
