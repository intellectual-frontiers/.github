// Spec: 0007-repoctl-prove FR-011
/**
 * Tests selected and run through a result cache (commons repoctl 0007-repoctl-prove FR-011, FR-012): the imports of each test file followed to every source it reads (relative imports, and the packages of the libraries through their
 * `exports`), what the files of its library import of other libraries, the selection of the Logical layer applied, and each selected test run as its own program, its pass kept under a key that is the hash of the test, of the sources it
 * imports and of the runtime. A key that is in the cache is not run again; a test that reads the checkout is never cached.
 *
 * @remarks
 * The cache is a folder outside the repository (the cache folder of the program under XDG, or the variable `REPOCTL_CACHE`), one small file for each key; it holds passes only, so a failure is always run again. A test that cannot be
 * shown not to reach what changed runs. The key is exact: a changed byte of a test, of any source it reaches (a folder where an import could not be resolved to a file), or of the runtime is a new key.
 *
 * @limits
 * A test that reads a file by a path it builds at run time, outside the checkout's own names, is not seen by the imports; the cache would keep its pass after that file changed. Such a test is `environmental` by naming the checkout.
 *
 * @example
 * ```ts
 * import { packageIndexOf } from "./tests.ts";
 * typeof packageIndexOf; // "function"
 * ```
 *
 * @module
 */
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { dirname, join, normalize, toPosix } from "@intellectual-frontiers/system/path";
import { type LibraryName, parseLibraryName } from "@intellectual-frontiers/repoctl/governance";
import {
  cacheKeyOf,
  packageOf,
  pool,
  provesOf,
  readsTheTree,
  seedsOf,
  type LibraryNode,
  type TestReach,
  usagesOf,
  type Usage,
  type World,
} from "@intellectual-frontiers/repoctl/logical";

/** A package of the repository by its name: its folder and the files its `exports` name, by subpath. */
export type PackageIndex = ReadonlyMap<string, { readonly folder: string; readonly exports: ReadonlyMap<string, string> }>;

const SPECIFIER = /(?:\bimport|\bexport)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/g;
const SOURCE = /\.(?:ts|mts|mjs|js)$/;

/** The packages of the libraries (and of `commons/ts`) with what their `exports` map each subpath to. */
export async function packageIndexOf(w: World, libraries: readonly { readonly name: string; readonly folder: string }[]): Promise<PackageIndex> {
  const index = new Map<string, { folder: string; exports: Map<string, string> }>();
  for (const l of [...libraries, { name: "commons", folder: "commons/ts" }]) {
    const text = await w.files.read(join(w.repo, l.folder, "package.json"));
    const exports = new Map<string, string>();
    if (text !== undefined) {
      try {
        const x: unknown = JSON.parse(text);
        const e = typeof x === "object" && x !== null && "exports" in x ? x.exports : undefined;
        if (typeof e === "object" && e !== null)
          for (const [k, v] of Object.entries(e)) {
            const target = typeof v === "string" ? v : typeof v === "object" && v !== null ? Object.values(v).find((t): t is string => typeof t === "string") : undefined;
            if (target !== undefined) exports.set(k, toPosix(normalize(join(l.folder, target))));
          }
      } catch {
        // an unreadable package names no export: its importers depend on its folder
      }
    }
    index.set(`@intellectual-frontiers/${l.name}`, { folder: l.folder, exports });
  }
  return index;
}

/** What one source reads: files and folders, and what it imports of each package. */
type Edges = { readonly files: readonly string[]; readonly folders: readonly string[]; readonly uses: ReadonlyMap<string, Usage> };

/** Reads the imports of the sources a run needs, once for each file. */
export function readerOf(w: World, index: PackageIndex) {
  const texts = new Map<string, string | undefined>();
  const edges = new Map<string, Edges>();
  const text = async (path: string): Promise<string | undefined> => {
    if (!texts.has(path)) texts.set(path, await w.files.read(join(w.repo, path)));
    return texts.get(path);
  };
  const resolveRelative = async (from: string, specifier: string): Promise<string | undefined> => {
    const base = toPosix(normalize(join(dirname(from), specifier)));
    if (base.startsWith("..")) return undefined;
    for (const c of [base, `${base}.ts`, `${base}/mod.ts`, `${base}/index.ts`]) if (SOURCE.test(c) && (await w.files.exists(join(w.repo, c)))) return c;
    return undefined;
  };
  const edgesOf = async (path: string): Promise<Edges> => {
    const known = edges.get(path);
    if (known !== undefined) return known;
    const t = (await text(path)) ?? "";
    const files = new Set<string>();
    const folders = new Set<string>();
    for (const m of t.matchAll(SPECIFIER)) {
      const specifier = m[1] ?? m[2] ?? "";
      if (specifier.startsWith(".")) {
        const r = await resolveRelative(path, specifier);
        if (r !== undefined) files.add(r);
        continue;
      }
      const pkg = packageOf(specifier);
      const entry = pkg === undefined ? undefined : index.get(pkg);
      if (pkg === undefined || entry === undefined) continue;
      const key = specifier === pkg ? "." : `.${specifier.slice(pkg.length)}`;
      const target = entry.exports.get(key);
      if (target === undefined) folders.add(`${entry.folder}/`);
      else files.add(target);
    }
    const found: Edges = { files: [...files], folders: [...folders], uses: usagesOf(t) };
    edges.set(path, found);
    return found;
  };
  /** Every file and folder a source transitively reads, itself included. */
  const closureOf = async (entry: string): Promise<{ readonly files: readonly string[]; readonly folders: readonly string[] }> => {
    const seen = new Set<string>();
    const folders = new Set<string>();
    const todo = [entry];
    for (let f = todo.pop(); f !== undefined; f = todo.pop()) {
      if (seen.has(f)) continue;
      seen.add(f);
      const e = await edgesOf(f);
      for (const x of e.files) todo.push(x);
      for (const d of e.folders) folders.add(d);
    }
    return { files: [...seen].sort(), folders: [...folders].sort() };
  };
  return { text, edgesOf, closureOf };
}

/** The tests of a library: each test file of its `suite/` with what it reaches, what its library imports of the others through it and whether it reads the checkout. */
export async function readTests(w: World, node: LibraryNode, index: PackageIndex, reader = readerOf(w, index)): Promise<readonly TestReach[]> {
  const files = (await w.files.walk(join(w.repo, node.folder, "suite"))).filter((f) => f.endsWith(".test.ts")).sort();
  const byPackage = new Map([...index].map(([pkg, e]) => [pkg, e.folder.replace(/^commons\//, "")]));
  return await pool(files, 8, async (f): Promise<TestReach> => {
    const path = `${node.folder}/suite/${f}`;
    const closure = await reader.closureOf(path);
    const own = closure.files.filter((x) => x.startsWith(`${node.folder}/`));
    const merged = new Map<string, { all: boolean; names: Set<string> }>();
    let environmental = false;
    for (const x of own) {
      const t = (await reader.text(x)) ?? "";
      if (x.startsWith(`${node.folder}/suite/`) && readsTheTree(t)) environmental = true;
      for (const [pkg, usage] of (await reader.edgesOf(x)).uses) {
        const e = merged.get(pkg) ?? { all: false, names: new Set<string>() };
        merged.set(pkg, { all: e.all || usage.all, names: new Set([...e.names, ...usage.names]) });
      }
    }
    const uses = [...merged].flatMap(([pkg, e]) => {
      const folder = byPackage.get(pkg);
      const parsed = folder === undefined ? undefined : parseLibraryName(folder);
      return parsed?.kind !== "ok" || parsed.value === node.name ? [] : [{ provider: parsed.value, usage: { all: e.all, names: [...e.names].sort() } }];
    });
    return { library: node.name, path, depends: [...closure.files, ...closure.folders, join(node.folder, "package.json"), join(node.folder, "tsconfig.json")].map(toPosix), environmental, proves: provesOf((await reader.text(path)) ?? ""), uses };
  });
}

/** How one test ended. */
export type TestOutcome =
  | { readonly kind: "passed"; readonly seconds: number; readonly cached: boolean }
  | { readonly kind: "failed"; readonly seconds: number; readonly output: readonly string[]; readonly seeds: readonly string[] };

/** The cache of results: a folder outside the repository, one file for each key; undefined where the host gives none (nothing is cached then). */
export type ResultCache = { readonly folder: string; readonly runtime: string } | undefined;

/** The hash of a file, once. */
function hasher(reader: ReturnType<typeof readerOf>) {
  const known = new Map<string, string>();
  return async (path: string): Promise<string> => {
    const k = known.get(path);
    if (k !== undefined) return k;
    const h = await sha256((await reader.text(path)) ?? "\u0000missing");
    known.set(path, h);
    return h;
  };
}

/** Runs the tests, a few at a time, each as its own program in its library's folder; a test whose key is in the cache is not run. */
export async function runTests(w: World, tests: readonly TestReach[], cache: ResultCache, index: PackageIndex, width: number): Promise<ReadonlyMap<string, TestOutcome>> {
  const reader = readerOf(w, index);
  const hash = hasher(reader);
  const folderOf = new Map<LibraryName, string>();
  for (const t of tests) folderOf.set(t.library, t.path.split("/suite/")[0] ?? "");
  const done = await pool(tests, width, async (t): Promise<readonly [string, TestOutcome]> => {
    let key: string | undefined;
    if (cache !== undefined && !t.environmental) {
      const hashes: (readonly [string, string])[] = [];
      for (const d of t.depends) {
        if (d.endsWith("/")) for (const f of await w.files.walk(join(w.repo, d))) hashes.push([`${d}${f}`, await hash(`${d}${f}`)]);
        else hashes.push([d, await hash(d)]);
      }
      key = await sha256(cacheKeyOf({ runtime: cache.runtime, library: t.library, test: t.path, hashes }));
      if (await w.files.exists(join(cache.folder, key))) return [t.path, { kind: "passed", seconds: 0, cached: true }];
    }
    const folder = folderOf.get(t.library) ?? "";
    const t0 = performance.now();
    const r = await w.process.run(["bun", "test", t.path.slice(folder.length + 1)], { cwd: join(w.repo, folder), env: { CI: "" } });
    const seconds = (performance.now() - t0) / 1000;
    const text = `${r.stdout}\n${r.stderr}`;
    if (r.code === 0) {
      if (cache !== undefined && key !== undefined) await w.files.write(join(cache.folder, key), "pass\n");
      return [t.path, { kind: "passed", seconds, cached: false }];
    }
    const lines = text.split("\n").map((l) => l.trim()).filter((l) => l !== "");
    return [t.path, { kind: "failed", seconds, output: lines.slice(-30), seeds: seedsOf(text) }];
  });
  return new Map(done);
}
