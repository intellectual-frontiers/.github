// Spec: 0003-repoctl-sync FR-008
/**
 * The constants of the sources that say a library's version (commons repoctl 0003-repoctl-sync FR-008): a constant named for its library (`TOOL_VERSION` of `tool`), or named by the manifest in `versionConstants`,
 * must say the version of its package. A release that raised the manifest and the package and left such a constant behind broke a build at one release; this finds it before the push. Pure: it reads texts it is given.
 *
 * @example
 * ```ts
 * import { constantFindings } from "./constants.ts";
 * const lib = { name: "tool", folder: "commons/tool", version: "0.4.7", level: "L1", specKit: undefined, npm: true, versionConstants: [] };
 * constantFindings([lib], [{ path: "commons/tool/src/state-record.ts", text: 'export const TOOL_VERSION = "0.4.6";' }]).length; // 1
 * ```
 *
 * @module
 */
import { parseSemver } from "@intellectual-frontiers/repoctl/governance";
import { finding, type Finding } from "./findings.ts";
import type { LibraryInfo } from "./ports.ts";

/** A constant of a library's sources that holds its version: the file from the library's folder and the constant's name. */
export type VersionConstant = { readonly file: string; readonly name: string };

/** A source file: its path from the repository's root and its text. */
export type Source = { readonly path: string; readonly text: string };

/** One `NAME_VERSION = "text"` found in a source, and the line it is on. */
export type Found = { readonly path: string; readonly name: string; readonly value: string; readonly line: number };

const DECLARATION = /\b([A-Z][A-Z0-9_]*_VERSION)\b[^=\n]*=\s*"([^"\n]*)"/g;

/** Every constant of a source that ends in `_VERSION` and is a text. */
export function constantsIn(source: Source): readonly Found[] {
  const out: Found[] = [];
  for (const m of source.text.matchAll(DECLARATION)) {
    const name = m[1];
    const value = m[2];
    if (name === undefined || value === undefined) continue;
    out.push({ path: source.path, name, value, line: source.text.slice(0, m.index).split("\n").length });
  }
  return out;
}

/** The name a library's own version constant has by convention: its name in capitals, hyphens as underscores, and `_VERSION`. */
export function conventionName(library: string): string {
  return `${library.toUpperCase().replace(/-/g, "_")}_VERSION`;
}

/** The sources of a library that are read for constants: the TypeScript under its `src/`, and the files its manifest names. */
export function isRead(library: LibraryInfo, path: string): boolean {
  const own = `${library.folder}/`;
  if (!path.startsWith(own)) return false;
  const inside = path.slice(own.length);
  return (inside.startsWith("src/") && inside.endsWith(".ts")) || library.versionConstants.some((c) => c.file === inside);
}

/** What is wrong with the constants of the libraries' sources: one that disagrees with its library's version, one the manifest names that is not there, one that is not a version. */
export function constantFindings(libraries: readonly LibraryInfo[], sources: readonly Source[]): readonly Finding[] {
  const out: Finding[] = [];
  for (const lib of libraries) {
    const here = sources.filter((s) => isRead(lib, s.path));
    const found = here.flatMap(constantsIn);
    const declared = new Set(lib.versionConstants.map((c) => `${lib.folder}/${c.file}\u0000${c.name}`));
    for (const c of lib.versionConstants) {
      if (!found.some((f) => f.path === `${lib.folder}/${c.file}` && f.name === c.name))
        out.push(finding("fail", "E-VERSION-CONSTANT", `${lib.folder}/${c.file}: the manifest names ${c.name} as holding the version of ${lib.name}, and the file does not say ${c.name} = "<version>"`, `fix the manifest's versionConstants of ${lib.name}`));
    }
    for (const f of found) {
      const named = declared.has(`${f.path}\u0000${f.name}`);
      if (!named && f.name !== conventionName(lib.name)) continue;
      if (parseSemver(f.value).kind === "err") {
        out.push(finding("fail", "E-VERSION-CONSTANT", `${f.path}:${f.line}: ${f.name} is "${f.value}", which is not a version`, "repoctl sync"));
        continue;
      }
      if (f.value !== lib.version)
        out.push(finding("fail", "E-VERSION-CONSTANT", `${f.path}:${f.line}: ${f.name} is "${f.value}" and the version of ${lib.name} is "${lib.version}"`, `set ${f.name} to "${lib.version}" in ${f.path}`));
    }
  }
  return out;
}
