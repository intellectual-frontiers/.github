// Spec: 0003-repoctl-sync FR-010
/**
 * The packages a library imports and does not declare (commons repoctl 0003-repoctl-sync FR-010): a library job of CI installs only its own folder, so a package that a source, a test or a tool of the library imports by name
 * (and `node:` imports, which need `@types/node`) must be in its `dependencies` or `devDependencies`, or the job fails where a checkout with the whole repository installed passes. Pure: it reads the texts it is given.
 *
 * @example
 * ```ts
 * import { undeclaredFindings } from "./declared.ts";
 * const lib = { name: "a", folder: "commons/a", manifest: '{"devDependencies":{}}', sources: [{ path: "commons/a/suite/x.test.ts", text: 'import { x } from "left-pad";' }] };
 * undeclaredFindings([lib]).length; // 1
 * ```
 *
 * @module
 */
import { finding, type Finding } from "./findings.ts";
import type { Source } from "./constants.ts";

/** A library as this check reads it: its folder, the text of its `package.json` and the TypeScript of its sources, suite and tools. */
export type DeclaredInput = { readonly name: string; readonly folder: string; readonly manifest: string; readonly sources: readonly Source[] };

const FROM = /^[ \t]*(?:(?:import|export)\b[^"'`\n]*?|\}[ \t]*)\bfrom[ \t]+"([^"\n]+)"|^[ \t]*import[ \t]+"([^"\n]+)"/gm;

const isRecord = (v: unknown): v is Readonly<Record<string, unknown>> => typeof v === "object" && v !== null && !Array.isArray(v);

/** The package a specifier names, `node:` for a built-in of Node, or undefined for a relative path, a path, a template and a built-in of Bun. */
export function importedPackageOf(specifier: string): string | undefined {
  if (specifier.startsWith("node:")) return "@types/node";
  if (specifier.startsWith(".") || specifier.startsWith("/") || specifier.startsWith("$") || specifier.startsWith("bun:") || specifier === "bun") return undefined;
  const parts = specifier.split("/");
  const head = parts[0];
  if (head === undefined) return undefined;
  return head.startsWith("@") ? `${head}/${parts[1] ?? ""}` : head;
}

/** The text of a source without its block comments, whose examples import what the library does not. */
export function withoutBlockComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));
}

/** The packages a source imports, each with the first line that does. */
export function importedPackages(source: Source): ReadonlyMap<string, number> {
  const text = withoutBlockComments(source.text);
  const out = new Map<string, number>();
  for (const m of text.matchAll(FROM)) {
    const pkg = importedPackageOf(m[1] ?? m[2] ?? "");
    if (pkg !== undefined && !out.has(pkg)) out.set(pkg, text.slice(0, m.index).split("\n").length);
  }
  return out;
}

/** The names a manifest declares under dependencies, devDependencies, peerDependencies and optionalDependencies; none where it cannot be read. */
export function declaredNames(manifest: string): ReadonlySet<string> {
  let json: unknown;
  try {
    json = JSON.parse(manifest);
  } catch {
    return new Set();
  }
  if (!isRecord(json)) return new Set();
  const names = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"].flatMap((k) => {
    const section = json[k];
    return isRecord(section) ? Object.keys(section) : [];
  });
  return new Set(names);
}

/** A finding for each package a library imports and does not declare, naming the first file and line that imports it. */
export function undeclaredFindings(libraries: readonly DeclaredInput[]): readonly Finding[] {
  const out: Finding[] = [];
  for (const lib of libraries) {
    const declared = declaredNames(lib.manifest);
    const own = `@intellectual-frontiers/${lib.name}`;
    const first = new Map<string, string>();
    for (const source of lib.sources) {
      for (const [pkg, line] of importedPackages(source)) if (pkg !== own && !declared.has(pkg) && !first.has(pkg)) first.set(pkg, `${source.path}:${line}`);
    }
    for (const [pkg, where] of [...first].sort(([a], [b]) => a.localeCompare(b))) {
      const add = pkg.startsWith("@intellectual-frontiers/") ? `"${pkg}": "link:../${pkg.slice("@intellectual-frontiers/".length)}"` : `${pkg} (exact version)`;
      out.push(finding("fail", "E-UNDECLARED-DEPENDENCY", `${lib.folder}: ${where} imports ${pkg}, which ${lib.folder}/package.json does not declare`, `add ${add} to the devDependencies of ${lib.folder}/package.json`));
    }
  }
  return out;
}
