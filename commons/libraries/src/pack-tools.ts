// Spec: 0036-distribution FR-029
/**
 * The tools of the one package (commons 0036-distribution FR-029): the packages that compiling every library of commons needs, which `commons/commons` installs by itself (`bun install --frozen-lockfile` in that folder alone, as the release workflow
 * does) and which its `package.json` and its `bun.lock` therefore MUST carry. They are derived from the manifests of the libraries and from what their packed sources import, never listed by hand, and a library that starts to need a package that the folder
 * lacks is a finding of `bun run verify`.
 *
 *     bun commons/libraries/src/pack-commons.ts --tools            write the `devDependencies` of `commons/commons/package.json` and refresh its `bun.lock`
 *     bun commons/libraries/src/pack-commons.ts --tools --check    say what the package and the lockfile lack, write nothing
 *
 * @remarks
 * The tools are: the union of the runtime dependencies of the libraries and the drivers (`unionDependencies`, which the package installs for its consumers, each at an exact version), `typescript` (the compiler) and `@types/node` (the types the compiled
 * libraries name), the `@types/<package>` that a library's manifest names for one of those packages (`@types/pg` for `pg`), and every other third-party package that the sources of a packed folder import, with the version a manifest names (a runtime
 * `dependencies` entry before a `devDependencies` one). The `link:` entries of the folder (the libraries that its own programs import) are kept as they are.
 *
 * @limits
 * It reads the manifests and the imports; it does not install, and it cannot make the lockfile: `bun install` in the folder does, which the writing form runs where the lockfile lacks a package. The check reads `bun.lock` as data and compares names and
 * versions.
 *
 * @example
 * ```ts
 * import { typesPackageOf } from "./pack-tools.ts";
 * typesPackageOf("@duckdb/node-api"); // "@types/duckdb__node-api"
 * ```
 *
 * Spec: 0036-distribution FR-029
 *
 * @module
 */
import { existsSync, mkdirSync, readDirSync, readTextFileSync, symlinkSync, writeTextFileSync } from "@intellectual-frontiers/system/fs";
import { join } from "@intellectual-frontiers/system/path";
import { run, which } from "@intellectual-frontiers/system/proc";
import { importSpecifiers } from "./scan.ts";
import { filesUnder, isObject, packageOf, SCOPE } from "./pack-library.ts";

/** What is wrong with the tools of the package, one sentence each. */
export type Findings = readonly string[];

/** The packages the tools need, by name, each at an exact version. */
export type Tools = Readonly<Record<string, string>>;

/** What the tools are derived from, of one library: its folder, the folders its packed sources are in and its manifest's dependency tables. */
export type ToolSource = {
  readonly name: string;
  readonly roots: readonly string[];
  readonly dependencies: Readonly<Record<string, string>>;
  readonly devDependencies: Readonly<Record<string, string>>;
};

const byName = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** The package of DefinitelyTyped for a package: `pg` is `@types/pg`, `@duckdb/node-api` is `@types/duckdb__node-api`. */
export function typesPackageOf(name: string): string {
  return `@types/${name.startsWith("@") ? name.slice(1).replace("/", "__") : name}`;
}

/** The third-party packages that the sources under the given folders import. */
export function importedPackages(sources: readonly { readonly file: string; readonly text: string }[]): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  for (const s of sources) {
    for (const spec of importSpecifiers(s.text)) {
      if (spec.startsWith(".") || spec.startsWith("node:") || spec.startsWith("bun:") || spec.startsWith("data:") || spec.startsWith(`${SCOPE}/`)) continue;
      const pkg = packageOf(spec);
      if (pkg !== undefined && !out.has(pkg)) out.set(pkg, s.file);
    }
  }
  return out;
}

/**
 * The tools of the package from the libraries it holds: `union` is the union of their runtime dependencies and of the drivers (`unionDependencies`), `imported` the third-party packages their packed sources import. A package that no manifest gives a
 * version for, and a package two manifests give two versions for where neither is a runtime dependency, is a finding.
 */
export function toolsOf(libraries: readonly ToolSource[], union: Tools, imported: ReadonlyMap<string, string>): { readonly tools: Tools; readonly problems: Findings } {
  const problems: string[] = [];
  const declared = new Map<string, Set<string>>();
  for (const l of libraries) {
    for (const [k, v] of [...Object.entries(l.dependencies), ...Object.entries(l.devDependencies)]) {
      if (k.startsWith(`${SCOPE}/`)) continue;
      (declared.get(k) ?? declared.set(k, new Set()).get(k))?.add(v);
    }
  }
  const out = new Map<string, string>(Object.entries(union));
  const want = (name: string, why: string): void => {
    if (out.has(name)) return;
    const versions = [...(declared.get(name) ?? [])].sort(byName);
    if (versions.length === 0) problems.push(`${name} is needed (${why}) and no library names a version of it`);
    else if (versions.length > 1) problems.push(`${name} is needed (${why}) and the libraries name ${versions.join(" and ")}: the folder has one version of it`);
    else out.set(name, versions[0] ?? "");
  };
  want("typescript", "the compiler");
  want("@types/node", "the types of Node");
  for (const name of [...out.keys()]) {
    const types = typesPackageOf(name);
    if (declared.has(types)) want(types, `the types of ${name}`);
  }
  for (const [name, file] of [...imported].sort(([a], [b]) => byName(a, b))) {
    want(name, `${file} imports it`);
    const types = typesPackageOf(name);
    if (declared.has(types)) want(types, `the types of ${name}`);
  }
  return { tools: Object.fromEntries([...out].sort(([a], [b]) => byName(a, b))), problems };
}

/** The third-party packages imported by the packed sources of a library of the repository (`commons/<name>/<root>/**.ts`, `suite` and the like are not read). */
export function sourcesOf(repo: string, name: string, roots: readonly string[]): readonly { readonly file: string; readonly text: string }[] {
  const out: { file: string; text: string }[] = [];
  for (const r of roots) {
    const dir = join(repo, "commons", name, r);
    if (!existsSync(dir)) continue;
    for (const rel of filesUnder(dir)) if (rel.endsWith(".ts")) out.push({ file: `${name}/${r}/${rel}`, text: readTextFileSync(join(dir, rel)) });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// the folder's manifest and lockfile
// ---------------------------------------------------------------------------------------------------------------------

const objectOf = (v: unknown): Readonly<Record<string, unknown>> => (isObject(v) ? v : {});
const stringsOf = (v: unknown): Record<string, string> => Object.fromEntries(Object.entries(objectOf(v)).flatMap(([k, x]) => (typeof x === "string" ? [[k, x] as const] : [])));

/** The `devDependencies` a folder's manifest must have: its `link:` entries as they are and the tools. */
export function devDependenciesOf(current: Readonly<Record<string, string>>, tools: Tools): Record<string, string> {
  const links = Object.entries(current).filter(([, v]) => v.startsWith("link:"));
  return Object.fromEntries([...links, ...Object.entries(tools)].sort(([a], [b]) => byName(a, b)));
}

/** A `bun.lock` as data: the dependencies of its workspaces and the version of each package it holds, or undefined where it cannot be read. */
export function readLock(text: string): { readonly workspace: Readonly<Record<string, string>>; readonly versions: ReadonlyMap<string, string> } | undefined {
  try {
    const parsed: unknown = JSON.parse(text.replace(/,(\s*[}\]])/g, "$1"));
    const root = objectOf(objectOf(objectOf(parsed)["workspaces"])[""]);
    const versions = new Map<string, string>();
    for (const [name, entry] of Object.entries(objectOf(objectOf(parsed)["packages"]))) {
      const first = Array.isArray(entry) ? entry[0] : undefined;
      if (typeof first === "string" && first.startsWith(`${name}@`)) versions.set(name, first.slice(name.length + 1));
    }
    return { workspace: { ...stringsOf(root["dependencies"]), ...stringsOf(root["devDependencies"]) }, versions };
  } catch {
    return undefined;
  }
}

/** What the manifest and the lockfile of the folder lack of the tools, one sentence each; the folder is a path under the repository, shown in the sentences. */
export function toolFindings(folder: string, manifestText: string | undefined, lockText: string | undefined, tools: Tools): Findings {
  const found: string[] = [];
  if (manifestText === undefined) return [`${folder}/package.json is missing`];
  const dev = stringsOf(objectOf(JSON.parse(manifestText) as unknown)["devDependencies"]);
  for (const [name, version] of Object.entries(tools)) {
    if (dev[name] === undefined) found.push(`${folder}/package.json has no devDependency ${name}@${version}, which compiling the libraries needs: run bun commons/libraries/src/pack-commons.ts --tools`);
    else if (dev[name] !== version) found.push(`${folder}/package.json has ${name}@${dev[name]}, and the libraries need ${version}: run bun commons/libraries/src/pack-commons.ts --tools`);
  }
  if (lockText === undefined) return [...found, `${folder}/bun.lock is missing: run bun install in ${folder} and commit it`];
  const lock = readLock(lockText);
  if (lock === undefined) return [...found, `${folder}/bun.lock cannot be read`];
  for (const [name, version] of Object.entries(tools)) {
    const locked = lock.versions.get(name);
    if (locked === undefined) found.push(`${folder}/bun.lock does not hold ${name}@${version}: run bun install in ${folder} and commit the lockfile`);
    else if (locked !== version) found.push(`${folder}/bun.lock holds ${name}@${locked} and the libraries need ${version}: run bun install in ${folder} and commit the lockfile`);
    if (lock.workspace[name] !== version && dev[name] !== undefined) found.push(`${folder}/bun.lock names ${name}@${lock.workspace[name] ?? "nothing"} for the folder and its package.json ${version}: run bun install in ${folder} and commit the lockfile`);
  }
  return found;
}

/** The text of the folder's manifest with the tools as its `devDependencies`, and whether that is a change. */
export function writeTools(manifestText: string, tools: Tools): { readonly text: string; readonly changed: boolean } {
  const manifest = objectOf(JSON.parse(manifestText) as unknown);
  const dev = devDependenciesOf(stringsOf(manifest["devDependencies"]), tools);
  const text = `${JSON.stringify({ ...manifest, devDependencies: dev }, null, 2)}\n`;
  return { text, changed: text !== manifestText };
}

/** Writes the tools into the folder's manifest and, where the lockfile lacks any, installs in the folder; the findings that remain, which are none where it worked. */
export async function syncTools(repo: string, folder: string, tools: Tools): Promise<Findings> {
  const dir = join(repo, folder);
  const manifestFile = join(dir, "package.json");
  if (!existsSync(manifestFile)) return [`${folder}/package.json is missing`];
  const written = writeTools(readTextFileSync(manifestFile), tools);
  if (written.changed) writeTextFileSync(manifestFile, written.text);
  const lockFile = join(dir, "bun.lock");
  const lacking = toolFindings(folder, readTextFileSync(manifestFile), existsSync(lockFile) ? readTextFileSync(lockFile) : undefined, tools);
  if (lacking.length === 0) return [];
  const installed = await run([which("bun") ?? "bun", "install"], { cwd: dir });
  if (installed.code !== 0) return [`bun install in ${folder} stopped: ${`${installed.stdout}${installed.stderr}`.trim().slice(0, 600)}`];
  return toolFindings(folder, readTextFileSync(manifestFile), existsSync(lockFile) ? readTextFileSync(lockFile) : undefined, tools);
}

// ---------------------------------------------------------------------------------------------------------------------
// resolution
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Links the packages installed in the tools folder under `commons/node_modules`, so that the sources of a library, which the compiler resolves from their own folder upward, find the third-party packages (with their `exports` and their types) where
 * only the folder of the package was installed. A package that `commons/node_modules` or the root's `node_modules` already holds is left as it is (a checkout with the root installed resolves from there), and the libraries of commons are not touched
 * (`link.ts` links them). The links are in a folder that is not committed.
 */
export function linkTools(repo: string, toolsFolder: string): { readonly made: number } | { readonly problem: string } {
  try {
    const from = join(toolsFolder, "node_modules");
    if (!existsSync(from)) return { made: 0 };
    const into = join(repo, "commons", "node_modules");
    const held = (name: string): boolean => existsSync(join(into, name)) || existsSync(join(repo, "node_modules", name));
    let made = 0;
    const link = (name: string): void => {
      if (held(name)) return;
      mkdirSync(join(into, ...name.split("/").slice(0, -1)), { recursive: true });
      symlinkSync(join(from, name), join(into, name), { type: "junction" });
      made += 1;
    };
    for (const e of readDirSync(from)) {
      if (e.name.startsWith(".") || e.name === SCOPE) continue;
      if (e.name.startsWith("@")) {
        for (const inner of readDirSync(join(from, e.name))) if (!inner.name.startsWith(".")) link(`${e.name}/${inner.name}`);
      } else link(e.name);
    }
    return { made };
  } catch (e) {
    return { problem: `the packages of ${toolsFolder} could not be linked under commons/node_modules: ${e instanceof Error ? e.message : String(e)}` };
  }
}
