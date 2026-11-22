// Spec: 0001-kanon-checker FR-002, FR-003, FR-004, FR-012
/**
 * The import check of Kanon (commons 0033-kanon FR-004, FR-006, FR-011): given a table and the files of a library, every import of every file as data: which unit each file is in, and a
 * finding for each import that does not follow the table. It reads every import, relative or by package name, because an import by package name is invisible to a check of relative imports; it
 * resolves the library's own package name through `exports`, as Node and the compiler do. Lifted from the checks of `commons/data` and `commons/headless`, which each kept a table of their own.
 *
 * @remarks
 * Pure: it is given the files and the `exports` map and returns findings, which a program holds against a baseline. A file in no unit of the table is `layers/unclassified`, so that a surface or
 * a dialect cannot appear without its row saying what it may import.
 *
 * @limits
 * It reads imports by the text's shape: a comment line is skipped, and an import inside a template literal that begins a line is read.
 *
 * @example
 * ```ts
 * import { importFindings } from "@intellectual-frontiers/kanon";
 * const table = {
 *   package: "@intellectual-frontiers/x",
 *   units: [
 *     { folder: "src/governance/", layer: "governance" },
 *     { folder: "src/logical/", layer: "logical" },
 *   ],
 * } as const;
 * importFindings(table, [{ path: "src/governance/a.ts", text: 'import { b } from "@intellectual-frontiers/x/logical";\n' }], { "./logical": "./src/logical/mod.ts" }).map((f) => f.rule); // ["layers/above"]
 * ```
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import { classify, rootPackage } from "./family.ts";
import { type Allowed, type Layer, RANK, type Table, type Unit } from "./table.ts";

/** An `exports` map: each subpath to its target, a string or an object of conditions of strings. */
export type ExportsMap = Readonly<Record<string, string | { readonly [condition: string]: string }>>;

/** The codes of this check (0033-kanon FR-011); `kanon/dropped` is the check of a model's annotations (`dropped.ts`). */
export type Rule =
  | "layers/unclassified"
  | "layers/relative"
  | "layers/private"
  | "layers/external"
  | "layers/above"
  | "layers/around"
  | "layers/cycle"
  | "instances/sibling"
  | "instances/undeclared"
  | "plugins/inverted"
  | "plugins/undeclared"
  | "plugins/contract"
  | "family/name"
  | "kanon/dropped"
  | "kanon/kind"
  | "kanon/annotation"
  | "kanon/dangling"
  | "kanon/relation-layer"
  | "kanon/duplicate-id";

/** The codes in one list, for a program that walks them. */
export const RULES = [
  "layers/unclassified",
  "layers/relative",
  "layers/private",
  "layers/external",
  "layers/above",
  "layers/around",
  "layers/cycle",
  "instances/sibling",
  "instances/undeclared",
  "plugins/inverted",
  "plugins/undeclared",
  "plugins/contract",
  "family/name",
  "kanon/dropped",
  "kanon/kind",
  "kanon/annotation",
  "kanon/dangling",
  "kanon/relation-layer",
  "kanon/duplicate-id",
] as const satisfies readonly Rule[];

/** What each code means, in a sentence: a registry with an entry for every code of the closed union, which the compiler holds complete. */
export const RULE_SUMMARY: Readonly<Record<Rule, string>> = {
  "layers/unclassified": "a file that no unit of the table holds",
  "layers/relative": "a file of another unit imported by a relative path",
  "layers/private": "an import of the package by a path its exports does not name",
  "layers/external": "an import of a package that the row of the unit does not allow",
  "layers/above": "an import of a unit that stands below the importer",
  "layers/around": "an import of another unit of the same layer that the row does not list",
  "layers/cycle": "units of one class that import each other in a loop",
  "instances/sibling": "an instance of a unit kind that imports another instance of it",
  "instances/undeclared": "a folder under a unit with declared instances that the table does not declare as an instance",
  "plugins/inverted": "a host that imports a package that extends it",
  "plugins/undeclared": "an extension that imports another member of the family it does not declare a dependency on",
  "plugins/contract": "a plugin contract that the host does not export, or a plugin that does not import it",
  "family/name": "a package that extends a host and is not named and declared by the host's family rule",
  "kanon/dropped": "an annotation of Governance that ends neither expressed, nor carried, nor named unexpressed",
  "kanon/kind": "an element or a relation of a kind that the model's vocabulary does not list",
  "kanon/annotation": "an annotation of Governance whose name the model's vocabulary does not list",
  "kanon/dangling": "a relation with an end that is no element of the model",
  "kanon/relation-layer": "a relation between elements of two layers, which is a trace edge's work and not a relation's",
  "kanon/duplicate-id": "two elements of a model with one id",
};

/** The family of a code: the import check's or the model's; an exhaustive match, so that a code added to the union fails to compile here until it is placed. */
export function familyOf(rule: Rule): "layers" | "instances" | "plugins" | "family" | "kanon" {
  switch (rule) {
    case "layers/unclassified":
    case "layers/relative":
    case "layers/private":
    case "layers/external":
    case "layers/above":
    case "layers/around":
    case "layers/cycle":
      return "layers";
    case "instances/sibling":
    case "instances/undeclared":
      return "instances";
    case "plugins/inverted":
    case "plugins/undeclared":
    case "plugins/contract":
      return "plugins";
    case "family/name":
      return "family";
    case "kanon/dropped":
    case "kanon/kind":
    case "kanon/annotation":
    case "kanon/dangling":
    case "kanon/relation-layer":
    case "kanon/duplicate-id":
      return "kanon";
    default:
      return absurd(rule);
  }
}

/** A finding: its code, the file and line, one sentence, and a key that a baseline of findings can hold (`<rule> <file> <about>`). */
export type Finding = {
  readonly rule: Rule;
  readonly file: string;
  readonly line: number;
  readonly message: string;
  readonly key: string;
};

/** A file of the library: its path from the library's root with `/`, and its text. */
export type SourceFile = { readonly path: string; readonly text: string };

/** The unit a file is in, as the table holds it: the unit's name (its folder, and for an instance the folder under it) and the row it comes from. */
export type Placed = { readonly name: string; readonly unit: Unit };

/** An import of a file, with its line. */
export type Specifier = { readonly line: number; readonly specifier: string };

/** Make a finding with its key. */
export function finding(rule: Rule, file: string, line: number, message: string, about?: string): Finding {
  return { rule, file, line, message, key: about === undefined ? `${rule} ${file}` : `${rule} ${file} ${about}` };
}

/** The unit a file is in, from its path relative to the library with `/`; `undefined` where it is in none (`layers/unclassified`). The most specific folder wins. */
export function unitOf(table: Table, path: string): Placed | undefined {
  let best: Placed | undefined;
  for (const u of table.units) {
    const inside = u.folder === "./" ? !path.includes("/") : path.startsWith(u.folder);
    if (!inside) continue;
    let placed: Placed | undefined;
    if (!u.instances) placed = { name: u.folder, unit: u };
    else {
      const rest = path.slice(u.folder.length);
      const slash = rest.indexOf("/");
      if (slash > 0) placed = { name: `${u.folder}${rest.slice(0, slash)}/`, unit: u };
    }
    if (placed !== undefined && (best === undefined || placed.name.length > best.name.length)) best = placed;
  }
  return best;
}

/** Whether a relative specifier climbs out of the library's root from the file that imports it. */
export function escapesRoot(from: string, specifier: string): boolean {
  let depth = from.split("/").length - 1;
  for (const p of specifier.split("/")) {
    if (p === "" || p === ".") continue;
    if (p === "..") {
      depth -= 1;
      if (depth < 0) return true;
    } else depth += 1;
  }
  return false;
}

/** The path a relative specifier names, from the file that imports it. */
export function resolveImport(from: string, specifier: string): string {
  const parts = from.split("/").slice(0, -1);
  for (const p of specifier.split("/")) {
    if (p === "" || p === ".") continue;
    if (p === "..") parts.pop();
    else parts.push(p);
  }
  return parts.join("/");
}

/** Every import of a file's text, relative or by name: static, side-effect, re-export and dynamic `import()`, `import type` included. */
export function specifiersOf(text: string): readonly Specifier[] {
  const out: Specifier[] = [];
  for (const [i, raw] of text.split("\n").entries()) {
    const t = raw.trim();
    if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) continue;
    const found = [
      ...raw.matchAll(/^\s*(?:import|export)\b[^;'"]*?\bfrom\s*["']([^"']+)["']/g),
      ...raw.matchAll(/^\s*import\s*["']([^"']+)["']/g),
      ...raw.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g),
      ...raw.matchAll(/^\s*\}\s*from\s*["']([^"']+)["']/g),
    ];
    for (const m of found) if (m[1] !== undefined) out.push({ line: i + 1, specifier: m[1] });
  }
  return out;
}

/** Whether a specifier is one of the packages a unit may import. */
export function allowedExternal(allowed: readonly Allowed[], specifier: string): boolean {
  return allowed.some((a) => {
    if (specifier === a.name) return a.subpaths === "any" || a.subpaths.length === 0;
    if (!specifier.startsWith(`${a.name}/`)) return false;
    return a.subpaths === "any" || a.subpaths.includes(specifier.slice(a.name.length + 1));
  });
}

/** The target of an `exports` entry: a string, or the `default` or `bun` of an object; none for anything else. */
export function entryOf(map: ExportsMap, key: string): string | undefined {
  const v = map[key];
  if (typeof v === "string") return v;
  if (v === undefined) return undefined;
  return v["bun"] ?? v["default"];
}

/** The layer of a unit; none for the library's own checking. An exhaustive match over the two kinds of unit. */
export function layerOf(u: Unit): Layer | undefined {
  switch (u.kind) {
    case "layered":
      return u.layer;
    case "own":
      return undefined;
    default:
      return absurd(u);
  }
}

/** Whether a unit may import another unit of the library (0033-kanon FR-004): its own folder, the units its row lists, or by default a unit of a layer above its own. */
export function mayReach(from: Placed, to: Placed): boolean {
  if (to.name === from.name) return true;
  const list = from.unit.mayImport;
  if (list !== undefined) return list.some((m) => m === to.name || m === to.unit.folder);
  const a = layerOf(from.unit);
  const b = layerOf(to.unit);
  return a !== undefined && b !== undefined && RANK[b] < RANK[a];
}

/** Whether an import of `to` from `from` climbs: it stands below `from` in the layers. */
export function climbs(from: Placed, to: Placed): boolean {
  const a = layerOf(from.unit);
  const b = layerOf(to.unit);
  return a !== undefined && b !== undefined && RANK[b] > RANK[a];
}

/**
 * Every finding of the import check over a library's files (0033-kanon FR-011).
 *
 * @param table - the library's table
 * @param files - each file of the library the check reads, its path from the library with `/` and its text
 * @param exportsMap - the `exports` of the library's `package.json`, each subpath (`./logical`) to its file (`./src/logical/mod.ts`)
 * @returns the findings, in the order of the files
 */
export function importFindings(
  table: Table,
  files: readonly SourceFile[],
  exportsMap: ExportsMap,
): readonly Finding[] {
  const out: Finding[] = [];
  const undeclared = new Set<string>();
  const hasDeclared = (folder: string): boolean => table.instances.some((i) => i.kind === "folder" && i.instanceOf === folder);
  const among = new Map<string, Map<string, { readonly file: string; readonly line: number }>>();
  const pkg: string = table.package;
  for (const file of files) {
    const here = unitOf(table, file.path);
    if (here === undefined) {
      out.push(finding("layers/unclassified", file.path, 1, "no unit of the table holds it: put it in one, or add the unit to the table"));
      continue;
    }
    if (here.unit.instances && hasDeclared(here.unit.folder) && !table.instances.some((i) => i.kind === "folder" && i.folder === here.name) && !undeclared.has(here.name)) {
      undeclared.add(here.name);
      out.push(
        finding(
          "instances/undeclared",
          file.path,
          1,
          `${here.name} is a folder of ${here.unit.folder}, whose instances the table declares, and it declares none named so`,
          here.name,
        ),
      );
    }
    for (const { line, specifier } of specifiersOf(file.text)) {
      if (specifier.startsWith("./") || specifier.startsWith("../")) {
        if (escapesRoot(file.path, specifier)) {
          out.push(finding("layers/relative", file.path, line, `it imports ${specifier}, which leaves the package: import it by its package name`, specifier));
          continue;
        }
        const target = unitOf(table, resolveImport(file.path, specifier));
        if (target !== undefined && target.name !== here.name && here.unit.kind !== "own")
          out.push(
            finding(
              "layers/relative",
              file.path,
              line,
              `it imports ${specifier}, a file of ${target.name}: import it by ${pkg}`,
              specifier,
            ),
          );
        continue;
      }
      const member = table.family === undefined ? undefined : classify(table.family, table.package, rootPackage(specifier));
      if (member !== undefined && member.kind !== "host" && here.unit.kind !== "own") {
        out.push(
          finding(
            "plugins/inverted",
            file.path,
            line,
            `${here.name} imports ${specifier}, a ${member.kind} of its own family: a host never imports what extends it`,
            specifier,
          ),
        );
        continue;
      }
      if (specifier === pkg || specifier.startsWith(`${pkg}/`)) {
        const entry = entryOf(exportsMap, `.${specifier.slice(pkg.length)}`);
        const target = entry === undefined ? undefined : unitOf(table, entry.replace(/^\.\//, ""));
        if (entry === undefined || target === undefined) {
          out.push(finding("layers/private", file.path, line, `it imports ${specifier}, which exports does not name`, specifier));
          continue;
        }
        if (here.unit.kind === "own") continue;
        if (target.name !== here.name && target.unit.instances && target.unit.folder === here.unit.folder && hasDeclared(here.unit.folder)) {
          out.push(
            finding(
              "instances/sibling",
              file.path,
              line,
              `${here.name} imports ${specifier}, ${target.name}, another instance of ${here.unit.folder}: an instance imports only the layers it extends`,
              specifier,
            ),
          );
          continue;
        }
        if (target.name !== here.name && target.unit.instances && target.unit.folder === here.unit.folder && mayReach(here, target)) {
          const to = among.get(here.name) ?? new Map<string, { readonly file: string; readonly line: number }>();
          if (!to.has(target.name)) to.set(target.name, { file: file.path, line });
          among.set(here.name, to);
          continue;
        }
        if (mayReach(here, target)) continue;
        const up = climbs(here, target);
        out.push(
          finding(
            up ? "layers/above" : "layers/around",
            file.path,
            line,
            `${here.name} (${layerOf(here.unit) ?? "own"}) imports ${specifier}, ${target.name} (${layerOf(target.unit) ?? "own"}), which it ${up ? "stands below" : "may not reach"}`,
            specifier,
          ),
        );
        continue;
      }
      if (here.unit.packages !== undefined && !allowedExternal(here.unit.packages, specifier))
        out.push(
          finding(
            "layers/external",
            file.path,
            line,
            `${here.name} imports ${specifier}, which its row of the table does not allow`,
            specifier,
          ),
        );
    }
  }
  const contract = table.family?.contract;
  if (contract !== undefined && entryOf(exportsMap, contract) === undefined)
    out.push(finding("plugins/contract", "library.ts", 1, `the family names ${contract} as the plugin contract and the package's exports do not`, contract));
  // a cycle among instances of one class: found once, at the import that closes it
  const state = new Map<string, "visiting" | "done">();
  const walk = (from: string, path: readonly string[]): void => {
    state.set(from, "visiting");
    for (const [to, at] of among.get(from) ?? []) {
      if (state.get(to) === "visiting") {
        const loop = [...path.slice(path.indexOf(to)), to];
        out.push(
          finding(
            "layers/cycle",
            at.file,
            at.line,
            `${from} imports ${to}, which imports ${from} again: ${loop.join(" -> ")}`,
            loop.join(">"),
          ),
        );
      } else if (state.get(to) === undefined) walk(to, [...path, to]);
    }
    state.set(from, "done");
  };
  for (const from of [...among.keys()].sort()) if (state.get(from) === undefined) walk(from, [from]);
  return out;
}
