// Spec: 0007-repoctl-hygiene FR-003
/**
 * The facts of a repository for the hygiene check, gathered through the ports (commons repoctl 0007-repoctl-hygiene FR-003; commons 0036-distribution FR-011): the lockfiles read as data (`bun.lock` is JSON with comments and trailing commas,
 * `package-lock.json` is JSON of lockfile versions 2 and 3), the `package.json` files outside `node_modules`, the packages installed under `node_modules` (a folder of the scope, nested ones and Bun's `.bun` store) and the relative imports of the sources.
 * The parsers are pure; only `gatherHygieneFacts` of this module reads, and only through `Files`.
 *
 * @example
 * ```ts
 * import { parseNpmLock } from "./hygiene-facts.ts";
 * const r = parseNpmLock('{ "packages": { "node_modules/@intellectual-frontiers/core": { "version": "0.1.5" } } }', "package-lock.json");
 * r.kind; // "read"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { Copy, Dependency, HygieneFacts, ImportFact, LockFacts, PackageFacts, TreeFacts } from "./hygiene.ts";
import type { HygienePolicy } from "@intellectual-frontiers/repoctl/governance";
import type { Files, World } from "./ports.ts";

/** The text of a JSON with comments and trailing commas as JSON: comments and the commas before `}` and `]` are removed, and strings are left as they are. */
export function stripJsonc(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const c = text.charAt(i);
    const next = text.charAt(i + 1);
    if (c === '"') {
      let j = i + 1;
      while (j < text.length && text.charAt(j) !== '"') j += text.charAt(j) === "\\" ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j;
    } else if (c === "/" && next === "/") {
      while (i < text.length && text.charAt(i) !== "\n") i++;
      out += "\n";
    } else if (c === "/" && next === "*") {
      const end = text.indexOf("*/", i + 2);
      i = end < 0 ? text.length : end + 1;
    } else out += c;
  }
  return out.replace(/,(\s*[}\]])/g, "$1");
}

const record = (v: unknown): Readonly<Record<string, unknown>> => (typeof v === "object" && v !== null && !Array.isArray(v) ? Object.fromEntries(Object.entries(v)) : {});
const text = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

const add = (into: Map<string, Copy[]>, name: string, c: Copy): void => void into.set(name, [...(into.get(name) ?? []), c]);

/** The copies of the packages of commons a `bun.lock` holds: each entry of `packages` is `[ "name@version", ... ]` under a key that says where it is nested. */
export function parseBunLock(source: string, file: string, scope: string): LockFacts {
  let json: unknown;
  try {
    json = JSON.parse(stripJsonc(source));
  } catch (e) {
    return { kind: "unreadable", file, why: e instanceof Error ? e.message : String(e) };
  }
  const packages = record(record(json)["packages"]);
  const copies = new Map<string, Copy[]>();
  for (const [key, value] of Object.entries(packages)) {
    const head = Array.isArray(value) ? text(value[0]) : undefined;
    const at = head === undefined ? -1 : head.lastIndexOf("@");
    if (head === undefined || at <= 0) continue;
    const name = head.slice(0, at);
    const version = head.slice(at + 1);
    if (name.startsWith(scope) && /^\d/.test(version)) add(copies, name, { version, where: `${file}: ${key}`, owner: key.endsWith(`/${name}`) ? key.slice(0, key.length - name.length - 1).split("/node_modules/")[0] ?? "" : "" });
  }
  return { kind: "read", file, copies };
}

/** The copies of the packages of commons a `package-lock.json` (versions 2 and 3: `packages` keyed by path) holds. */
export function parseNpmLock(source: string, file: string, scope: string): LockFacts {
  let json: unknown;
  try {
    json = JSON.parse(source);
  } catch (e) {
    return { kind: "unreadable", file, why: e instanceof Error ? e.message : String(e) };
  }
  const packages = record(record(json)["packages"]);
  const copies = new Map<string, Copy[]>();
  for (const [key, value] of Object.entries(packages)) {
    const at = key.lastIndexOf("node_modules/");
    if (at < 0) continue;
    const name = key.slice(at + "node_modules/".length);
    const version = text(record(value)["version"]);
    if (name.startsWith(scope) && version !== undefined) add(copies, name, { version, where: `${file}: ${key}`, owner: at > 0 ? key.slice(0, at).split("node_modules/")[0]?.replace(/\/$/, "") ?? "" : "" });
  }
  return { kind: "read", file, copies };
}

const SECTIONS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"] as const;

/** The facts of one `package.json`'s text: its name and its dependencies of every section; the workspaces it declares are the second part. */
export function parsePackage(source: string, path: string): Result<{ readonly facts: PackageFacts; readonly workspaces: readonly string[] }, string> {
  let json: unknown;
  try {
    json = JSON.parse(source);
  } catch (e) {
    return err(`${path} is not JSON (${e instanceof Error ? e.message : String(e)})`);
  }
  const o = record(json);
  const dependencies: Dependency[] = [];
  for (const section of SECTIONS)
    for (const [name, spec] of Object.entries(record(o[section]))) if (typeof spec === "string") dependencies.push({ name, spec });
  const ws = o["workspaces"];
  const nested = record(ws)["packages"];
  const globs: readonly unknown[] = Array.isArray(ws) ? ws : Array.isArray(nested) ? nested : [];
  return ok({ facts: { path, name: text(o["name"]), dependencies }, workspaces: globs.flatMap((g) => (typeof g === "string" ? [g] : [])) });
}

/** The relative specifiers a source imports, with the specifier as written. */
export function relativeImports(source: string): readonly string[] {
  return [...source.matchAll(/(?:\bfrom\s+|\bimport\s+|\bimport\(\s*|\brequire\(\s*)["'](\.[^"']*)["']/g)].map((m) => m[1] ?? "").filter((s) => s !== "");
}

const SOURCE = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;

/** The copies of the packages of commons installed under a folder `node_modules`, and under the `node_modules` of each package in it (and of Bun's `.bun` store). */
async function installedUnder(files: Files, root: string, nm: string, into: Map<string, Copy[]>, depth: number, scope: string): Promise<void> {
  if (depth > 4) return;
  for (const entry of await files.list(`${root}/${nm}`)) {
    if (entry === ".bun") {
      for (const store of await files.list(`${root}/${nm}/.bun`)) await installedUnder(files, root, `${nm}/.bun/${store}/node_modules`, into, depth + 1, scope);
      continue;
    }
    if (entry.startsWith(".")) continue;
    const names = entry.startsWith("@") ? (await files.list(`${root}/${nm}/${entry}`)).map((n) => `${entry}/${n}`) : [entry];
    for (const name of names) {
      const dir = `${nm}/${name}`;
      const manifest = await files.read(`${root}/${dir}/package.json`);
      if (manifest !== undefined && name.startsWith(scope)) {
        const r = parsePackage(manifest, `${dir}/package.json`);
        const version = (() => {
          try {
            return text(record(JSON.parse(manifest))["version"]);
          } catch {
            return undefined;
          }
        })();
        if (r.kind === "ok" && version !== undefined) add(into, name, { version, where: dir });
      }
      await installedUnder(files, root, `${dir}/node_modules`, into, depth + 1, scope);
    }
  }
}

/** The folders that hold only what is made or fetched, never read for a lockfile or a package: a path with one of these segments is left out. `node_modules` is never walked at all. */
export const IGNORED_FOLDERS: readonly string[] = [".git", "dist", "coverage", ".cache", ".turbo", ".next"];

const ignored = (path: string): boolean => path.split("/").some((s) => IGNORED_FOLDERS.includes(s));

/** The lockfiles of the kinds the rule reads, in a folder (`""` the root), and the files they were read from. */
async function locksIn(files: Files, repo: string, folder: string, scope: string): Promise<readonly LockFacts[]> {
  const locks: LockFacts[] = [];
  for (const [name, parse] of [["bun.lock", parseBunLock], ["package-lock.json", parseNpmLock]] as const) {
    const file = folder === "" ? name : `${folder}/${name}`;
    const read = await files.read(`${repo}/${file}`);
    if (read !== undefined) locks.push(parse(read, file, scope));
  }
  return locks;
}

/** Gathers the facts of the repository of a world: the only reads of the check. Every folder with a `package.json` is a tree of its own, with the lockfiles next to it and its own `node_modules`. */
export async function gatherHygieneFacts(w: Pick<World, "files" | "repo">, policy: HygienePolicy): Promise<HygieneFacts> {
  const all = (await w.files.walk(w.repo)).filter((p) => !ignored(p));
  const packages: PackageFacts[] = [];
  let workspaces: readonly string[] = [];
  const imports: ImportFact[] = [];
  const folderNames = new Set<string>();
  for (const p of all) {
    if (p === "package.json" || p.endsWith("/package.json")) {
      const read = await w.files.read(`${w.repo}/${p}`);
      if (read === undefined) continue;
      const parsed = parsePackage(read, p);
      if (parsed.kind === "err") continue;
      packages.push(parsed.value.facts);
      if (p === "package.json") workspaces = parsed.value.workspaces;
      else folderNames.add(p.slice(0, p.lastIndexOf("/")));
    } else if (SOURCE.test(p)) {
      const read = await w.files.read(`${w.repo}/${p}`);
      if (read !== undefined) for (const specifier of relativeImports(read)) imports.push({ file: p, specifier });
    }
  }
  const locks = await locksIn(w.files, w.repo, "", policy.scope);
  const installed = new Map<string, Copy[]>();
  await installedUnder(w.files, w.repo, "node_modules", installed, 0, policy.scope);
  const folders: TreeFacts[] = [];
  for (const folder of [...folderNames].sort()) {
    const into = new Map<string, Copy[]>();
    await installedUnder(w.files, w.repo, `${folder}/node_modules`, into, 0, policy.scope);
    folders.push({ folder, locks: await locksIn(w.files, w.repo, folder, policy.scope), installed: into });
  }
  const repository = policy.sourceMarker !== "" && (await w.files.exists(`${w.repo}/${policy.sourceMarker}`)) ? "source" : "consumer";
  return { repository, packages, locks, installed, folders, imports, workspaces };
}
