// Spec: 0007-repoctl-prove FR-007
/**
 * The public type surface of a library as values (commons repoctl 0007-repoctl-prove FR-006 to FR-008): the declarations a compiler emitted for its sources, read statement by statement, each exported one with the declarations local to
 * its file that it can mention; the fingerprint of the surface (a hash of each declaration, by name); the names that changed between two fingerprints; and what a source imports from a package, by name. The functions are pure: the
 * Physical layer emits the declarations and hashes the texts, and these decide what changed and who uses it.
 *
 * @remarks
 * A declaration file is regular enough to be cut by depth: a statement ends at a semicolon outside every bracket, or at the brace that closes a block declaration (`interface`, `class`, `namespace`, `enum`) when a new statement
 * follows. Comments are removed by the compiler; the scanner also skips them and strings, so a comment that holds a brace changes nothing.
 *
 * @limits
 * A name is the key of a declaration, so two declarations of one name in two files of a library are one entry with both texts; an overload is one entry. A change that only moves a declaration to another file leaves its entry as it was.
 *
 * @example
 * ```ts
 * import { declarationsOf, importsOf } from "./surface.ts";
 * declarationsOf("a.d.ts", "export declare function f(x: number): string;\n").map((d) => d.name); // ["f"]
 * importsOf('import { a, type B } from "@x/y/z";', "@x/y"); // { all: false, names: ["a", "B"] }
 * ```
 *
 * @module
 */

/** One exported declaration: the file it is in, its name, and its text with the declarations local to the file that it can mention. */
export type Declaration = { readonly file: string; readonly name: string; readonly text: string };

/** What a source imports from a package: every name (a namespace import, a re-export of everything, a dynamic import) or these names. */
export type Usage = { readonly all: boolean; readonly names: readonly string[] };

/** The fingerprint of a surface: each exported name with the hash of its declarations. */
export type Fingerprint = ReadonlyMap<string, string>;

/** How a library's surface differs between two states: not at all, in these names, or in a way that cannot be told. */
export type SurfaceDelta = { readonly kind: "same" } | { readonly kind: "changed"; readonly symbols: readonly string[] } | { readonly kind: "unknown"; readonly why: string };

const WORD = /[A-Za-z_$][\w$]*/y;
const BLOCK = /^(?:export\s+)?(?:declare\s+)?(?:default\s+)?(?:abstract\s+)?(?:interface|class|namespace|module|enum|const\s+enum|global)\b/;
const STARTERS = new Set(["export", "declare", "import", "type", "interface", "const", "function", "class", "namespace", "enum", "let", "var", "abstract", "module", "global"]);

/** The index just after the string or the template that starts at `i`. */
function skipString(text: string, i: number): number {
  const q = text[i] ?? "";
  let j = i + 1;
  while (j < text.length) {
    const c = text[j] ?? "";
    if (c === "\\") j += 2;
    else if (c === q) return j + 1;
    else if (q === "`" && c === "$" && text[j + 1] === "{") j = skipBraces(text, j + 1);
    else j++;
  }
  return text.length;
}

/** The index just after the braces that open at `i`, strings inside them skipped. */
function skipBraces(text: string, i: number): number {
  let depth = 0;
  let j = i;
  while (j < text.length) {
    const c = text[j] ?? "";
    if (c === "'" || c === '"' || c === "`") j = skipString(text, j);
    else {
      if (c === "{") depth++;
      if (c === "}") {
        depth--;
        if (depth === 0) return j + 1;
      }
      j++;
    }
  }
  return text.length;
}

/** The text of TypeScript or JavaScript without its comments, the strings, templates and regular expressions kept as they are. */
export function stripComments(text: string): string {
  let out = "";
  let i = 0;
  let prev = "";
  while (i < text.length) {
    const c = text[i] ?? "";
    const next = text[i + 1] ?? "";
    if (c === "/" && next === "/") {
      while (i < text.length && text[i] !== "\n") i++;
    } else if (c === "/" && next === "*") {
      const end = text.indexOf("*/", i + 2);
      i = end < 0 ? text.length : end + 2;
      out += " ";
    } else if (c === "'" || c === '"' || c === "`") {
      const j = skipString(text, i);
      out += text.slice(i, j);
      i = j;
      prev = c;
    } else if (c === "/" && (prev === "" || "(,=:[!&|?{};".includes(prev) || /(?:^|[^\w$])(?:return|typeof|case|in|of|void)$/.test(out.trimEnd()))) {
      let j = i + 1;
      let inClass = false;
      while (j < text.length && text[j] !== "\n") {
        const d = text[j] ?? "";
        if (d === "\\") j++;
        else if (d === "[") inClass = true;
        else if (d === "]") inClass = false;
        else if (d === "/" && !inClass) break;
        j++;
      }
      out += text.slice(i, j + 1);
      i = j + 1;
      prev = "/";
    } else {
      out += c;
      if (c.trim() !== "") prev = c;
      i++;
    }
  }
  return out;
}

/** The code of a text with its comments removed and its white space made one space: two texts that differ only in comments or layout are the same. */
export function codeOf(text: string): string {
  return stripComments(text).replace(/\s+/g, " ").trim();
}

/** The statements of a declaration file, each as its text. */
export function statementsOf(text: string): readonly string[] {
  const out: string[] = [];
  let start = 0;
  let depth = 0;
  let i = 0;
  const push = (end: number): void => {
    const s = text.slice(start, end).trim();
    if (s !== "") out.push(s);
    start = end;
  };
  while (i < text.length) {
    const c = text[i] ?? "";
    if (c === "'" || c === '"' || c === "`") {
      i = skipString(text, i);
    } else if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
    } else if (c === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      i = end < 0 ? text.length : end + 2;
    } else if ("{([".includes(c)) {
      depth++;
      i++;
    } else if (")}]".includes(c)) {
      depth--;
      i++;
      if (depth === 0 && c === "}" && BLOCK.test(text.slice(start, i).trimStart())) {
        WORD.lastIndex = text.length - text.slice(i).trimStart().length;
        const upcoming = WORD.exec(text)?.[0];
        const rest = text.slice(i).trimStart();
        if (rest === "" || rest.startsWith(";") || (upcoming !== undefined && STARTERS.has(upcoming))) {
          if (rest.startsWith(";")) i = text.length - rest.length + 1;
          push(i);
        }
      }
    } else if (c === ";" && depth === 0) {
      i++;
      push(i);
    } else i++;
  }
  push(text.length);
  return out;
}

const DECLARED = /^export\s+(?:declare\s+)?(?:default\s+)?(?:abstract\s+)?(?:async\s+)?(?:function\*?|class|interface|type|const|let|var|enum|namespace|module)\s+([A-Za-z_$][\w$]*)/;

/** The names a statement exports; none where it exports nothing. */
export function exportedNames(statement: string): readonly string[] {
  const s = statement.trimStart();
  if (!s.startsWith("export")) return [];
  const declared = DECLARED.exec(s);
  if (declared?.[1] !== undefined) return [declared[1]];
  if (/^export\s+default\b/.test(s)) return ["default"];
  const star = /^export\s+\*\s+(?:as\s+([A-Za-z_$][\w$]*)\s+)?from\b/.exec(s);
  if (star !== null) return [star[1] ?? "*"];
  const list = /^export\s+(?:type\s+)?\{([^}]*)\}/.exec(s);
  if (list?.[1] !== undefined)
    return list[1]
      .split(",")
      .map((item) => item.trim().replace(/^type\s+/, ""))
      .filter((item) => item !== "")
      .map((item) => item.split(/\s+as\s+/).pop() ?? item);
  return [];
}

/** The exported declarations of one declaration file, each with the file's local declarations that it can mention. */
export function declarationsOf(file: string, text: string): readonly Declaration[] {
  const statements = statementsOf(text).map((s) => s.replace(/\s+/g, " "));
  const local = statements.filter((s) => exportedNames(s).length === 0 && s !== "export {};").join("\n");
  return statements.flatMap((s) => exportedNames(s).map((name) => ({ file, name, text: `${s}\n${local}` })));
}

/** The fingerprint of declarations: each name with the hash of its texts, sorted and joined, so that moving a declaration to another file changes nothing and the order of files changes nothing. */
export function fingerprintOf(declarations: readonly Declaration[], hash: (text: string) => string): Fingerprint {
  const byName = new Map<string, string[]>();
  for (const d of declarations) byName.set(d.name, [...(byName.get(d.name) ?? []), hash(d.text)]);
  return new Map([...byName].sort(([a], [b]) => (a < b ? -1 : 1)).map(([name, hashes]) => [name, hash([...hashes].sort().join(","))]));
}

/** The names whose hash differs, that appeared or that went away between two fingerprints, sorted. */
export function surfaceDelta(base: Fingerprint, now: Fingerprint): SurfaceDelta {
  const changed = [...new Set([...base.keys(), ...now.keys()])].filter((n) => base.get(n) !== now.get(n)).sort();
  return changed.length === 0 ? { kind: "same" } : { kind: "changed", symbols: changed };
}

/** The identifiers that the declarations mention: what a changed name could reach through a library's own surface. */
export function mentionsOf(declarations: readonly Declaration[]): readonly string[] {
  return [...new Set(declarations.flatMap((d) => d.text.match(/[A-Za-z_$][\w$]*/g) ?? []))].sort();
}

const IMPORT_FROM = /\b(?:import|export)\s+(?:type\s+)?([^'";]*?)\s*from\s*["']([^"']+)["']/g;
const SIDE_EFFECT = /\bimport\s*["']([^"']+)["']/g;
const DYNAMIC = /\bimport\(\s*["']([^"']+)["']\s*\)/g;

/** The package a specifier names: `@scope/name` or `name`, without the subpath; none for a relative path. */
export function packageOf(specifier: string): string | undefined {
  if (specifier.startsWith(".") || specifier.startsWith("/") || specifier.startsWith("node:")) return undefined;
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

/** What a source imports from each package it imports (the subpaths of one package together): the names, or all of them where the import cannot say which. */
export function usagesOf(text: string): ReadonlyMap<string, Usage> {
  const code = stripComments(text);
  const found = new Map<string, { all: boolean; names: Set<string> }>();
  const entry = (specifier: string): { all: boolean; names: Set<string> } | undefined => {
    const pkg = packageOf(specifier);
    if (pkg === undefined) return undefined;
    const e = found.get(pkg) ?? { all: false, names: new Set<string>() };
    found.set(pkg, e);
    return e;
  };
  for (const m of code.matchAll(IMPORT_FROM)) {
    const e = m[2] === undefined ? undefined : entry(m[2]);
    if (e === undefined) continue;
    const clause = m[1] ?? "";
    if (clause.includes("*")) e.all = true;
    const braces = /\{([^}]*)\}/.exec(clause);
    const outside = clause.replace(/\{[^}]*\}/, "").replace(/^type\s+/, "").replace(/,/g, " ").trim();
    if (outside !== "" && !outside.includes("*")) e.names.add("default");
    for (const item of (braces?.[1] ?? "").split(",")) {
      const original = item.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0]?.trim() ?? "";
      if (original !== "") e.names.add(original);
    }
  }
  for (const m of code.matchAll(SIDE_EFFECT)) {
    const e = m[1] === undefined ? undefined : entry(m[1]);
    if (e !== undefined) e.all = true;
  }
  for (const m of code.matchAll(DYNAMIC)) {
    const e = m[1] === undefined ? undefined : entry(m[1]);
    if (e !== undefined) e.all = true;
  }
  return new Map([...found].map(([pkg, e]) => [pkg, { all: e.all, names: [...e.names].sort() }]));
}

/** What a source imports from a package (the package name, or any subpath of it). */
export function importsOf(text: string, pkg: string): Usage {
  return usagesOf(text).get(pkg) ?? { all: false, names: [] };
}

/** The union of usages. */
export function joinUsage(a: Usage, b: Usage): Usage {
  return { all: a.all || b.all, names: [...new Set([...a.names, ...b.names])].sort() };
}
