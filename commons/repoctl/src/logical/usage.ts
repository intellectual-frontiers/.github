// Spec: 0013-repoctl-usage FR-001, FR-002, FR-003, FR-004
/**
 * What a consumer uses of the package `@intellectual-frontiers/commons` (commons repoctl 0013-repoctl-usage; commons 0036-distribution FR-034): the libraries a repository imports and with which subpaths, read from its own files; the graph of the package, read from the sources
 * of the installed copy (which library imports which, the files and bytes of each); and the answer, a pure function of the two: the libraries imported directly, those reached only through the imports of those, and those never touched, with their sizes.
 *
 * @remarks
 * The answer is the same for the same inputs and is in the order of the names of the libraries. A library the repository imports that the package does not hold is a finding and is not counted; a library reached by two paths names the one through which it is reached first, in the order of the names.
 *
 * @example
 * ```ts
 * import { consumerImports, usageOf } from "./usage.ts";
 * consumerImports('import { ok } from "@intellectual-frontiers/commons/core";', "a.ts", "@intellectual-frontiers/commons");
 * // [{ library: "core", subpath: undefined, file: "a.ts" }]
 * ```
 *
 * @module
 */

/** One import of a library of the package by a file of the consumer. */
export type ConsumerImport = { readonly library: string; readonly subpath: string | undefined; readonly file: string };

/** A library of the package: the libraries its sources import, its files and its bytes. */
export type PackageLibrary = { readonly name: string; readonly imports: readonly string[]; readonly files: number; readonly bytes: number };

/** The libraries a file imports from the package: each specifier `<package>/<library>[/<subpath>]`; the bare package names no library and is left out. */
export function consumerImports(text: string, file: string, packageName: string): readonly ConsumerImport[] {
  const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const out: ConsumerImport[] = [];
  for (const m of text.matchAll(new RegExp(`["'\`]${escaped}/([a-z0-9][a-z0-9-]*)(?:/([^"'\`\\s]+))?["'\`]`, "g"))) out.push({ library: m[1] ?? "", subpath: m[2], file });
  return out;
}

/** The libraries of the package that a source imports: the specifiers `<package>/<library>...` (and `@intellectual-frontiers/<library>...` as the sources of a library write them), other than the library itself. */
export function libraryImports(text: string, self: string, packageName: string, known: ReadonlySet<string>): readonly string[] {
  const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const found = new Set<string>();
  for (const m of text.matchAll(new RegExp(`["'\`](?:${escaped}|@intellectual-frontiers)/([a-z0-9][a-z0-9-]*)(?:/[^"'\`\\s]*)?["'\`]`, "g"))) {
    const name = m[1] ?? "";
    if (name !== self && known.has(name)) found.add(name);
  }
  return [...found].sort();
}

/** What the repository imports of one library. */
export type Direct = { readonly library: string; readonly subpaths: readonly string[]; readonly files: number; readonly bytes: number };
/** A library the repository reaches only through others. */
export type Reached = { readonly library: string; readonly via: string; readonly bytes: number };
/** A library the repository never touches. */
export type Untouched = { readonly library: string; readonly bytes: number };

/** The answer. */
export type UsageReport = {
  readonly package: string;
  readonly libraries: number;
  readonly bytes: number;
  readonly direct: readonly Direct[];
  readonly reached: readonly Reached[];
  readonly untouched: readonly Untouched[];
  readonly totals: {
    readonly direct: { readonly libraries: number; readonly bytes: number };
    readonly reached: { readonly libraries: number; readonly bytes: number };
    readonly untouched: { readonly libraries: number; readonly bytes: number };
  };
  /** The libraries the repository imports that the package does not hold. */
  readonly unknown: readonly string[];
};

/** The answer for the imports of a repository and the graph of a package. */
export function usageOf(packageName: string, imports: readonly ConsumerImport[], graph: readonly PackageLibrary[]): UsageReport {
  const nodes = new Map(graph.map((n) => [n.name, n] as const));
  const names = [...nodes.keys()].sort();
  const direct = new Map<string, { subpaths: Set<string>; files: Set<string> }>();
  const unknown = new Set<string>();
  for (const i of imports) {
    if (!nodes.has(i.library)) {
      unknown.add(i.library);
      continue;
    }
    const d = direct.get(i.library) ?? { subpaths: new Set<string>(), files: new Set<string>() };
    if (i.subpath !== undefined) d.subpaths.add(i.subpath);
    d.files.add(i.file);
    direct.set(i.library, d);
  }
  // what is reached through the libraries imported directly: a walk, in the order of the names, that names the library each is first reached through
  const via = new Map<string, string>();
  const queue = [...direct.keys()].sort();
  const reachedFrom = new Map<string, string>(queue.map((q) => [q, q]));
  for (let at = 0; at < queue.length; at++) {
    const from = queue[at] ?? "";
    for (const next of [...(nodes.get(from)?.imports ?? [])].sort()) {
      if (reachedFrom.has(next) || !nodes.has(next)) continue;
      reachedFrom.set(next, from);
      via.set(next, direct.has(from) ? from : (via.get(from) ?? from));
      queue.push(next);
    }
  }
  const bytesOf = (n: string): number => nodes.get(n)?.bytes ?? 0;
  const directRows: Direct[] = names.filter((n) => direct.has(n)).map((n) => ({ library: n, subpaths: [...(direct.get(n)?.subpaths ?? [])].sort(), files: direct.get(n)?.files.size ?? 0, bytes: bytesOf(n) }));
  const reachedRows: Reached[] = names.filter((n) => !direct.has(n) && reachedFrom.has(n)).map((n) => ({ library: n, via: via.get(n) ?? "", bytes: bytesOf(n) }));
  const untouchedRows: Untouched[] = names.filter((n) => !reachedFrom.has(n)).map((n) => ({ library: n, bytes: bytesOf(n) }));
  const sum = (rows: readonly { readonly bytes: number }[]): { libraries: number; bytes: number } => ({ libraries: rows.length, bytes: rows.reduce((a, r) => a + r.bytes, 0) });
  return {
    package: packageName,
    libraries: names.length,
    bytes: graph.reduce((a, n) => a + n.bytes, 0),
    direct: directRows,
    reached: reachedRows,
    untouched: untouchedRows,
    totals: { direct: sum(directRows), reached: sum(reachedRows), untouched: sum(untouchedRows) },
    unknown: [...unknown].sort(),
  };
}

/** The answer as text: the three groups with their sizes, and the libraries of each. */
export function usageText(r: UsageReport): string {
  const mb = (b: number): string => `${(b / 1_048_576).toFixed(2)} MB`;
  const head = (label: string, t: { libraries: number; bytes: number }): string => `${label}: ${t.libraries} of ${r.libraries} libraries, ${mb(t.bytes)}`;
  return [
    `${r.package}: ${r.libraries} libraries, ${mb(r.bytes)} of sources`,
    head("imported directly", r.totals.direct),
    ...r.direct.map((d) => `  ${d.library.padEnd(30)} ${String(d.files).padStart(4)} files  ${d.subpaths.length === 0 ? "(the library itself)" : d.subpaths.join(", ")}`),
    head("reached through those", r.totals.reached),
    ...r.reached.map((d) => `  ${d.library.padEnd(30)} through ${d.via}`),
    head("never touched", r.totals.untouched),
    ...r.untouched.map((d) => `  ${d.library.padEnd(30)} ${mb(d.bytes)}`),
    ...(r.unknown.length === 0 ? [] : [`not libraries of the package: ${r.unknown.join(", ")}`]),
  ].join("\n");
}
