// Spec: 0001-layers FR-004, FR-005, FR-008, FR-009, FR-010, FR-011
/**
 * The layers check of the library (commons data 0001-layers): which unit each file is in, which units it may import, and a finding for every import that
 * does not follow the table. It reads every import, relative or by package name, because an import by package name is invisible to the kernel's layers
 * check, which reads relative imports only (commons 0005-typescript-runtime FR-077); it resolves the library's own package name through `exports`, as Node
 * and the compiler do.
 *
 * @remarks
 * Pure: it is given the files and the `exports` map and returns findings as data, which `check.ts` holds against a baseline.
 *
 * @limits
 * It reads imports by the text's shape, as the kernel's reader does: a comment line is skipped, and an import inside a template literal that begins a line is read.
 *
 * @module
 */
import { layers, type trace } from "@intellectual-frontiers/commons/ts/kernel";

/** The package's own name, which a file uses to import another unit. */
export const PACKAGE = "@intellectual-frontiers/data";
/** The kernel's entry point, the one package the lower layers may import. */
export const KERNEL = "@intellectual-frontiers/commons/ts/kernel";

/** The kinds of unit of the table (0001-layers FR-004, FR-008, 0011-sql-lifecycle FR-001). */
export type UnitClass =
  | "engine"
  | "governance"
  | "logical"
  | "physical"
  | "lifecycle"
  | "preset"
  | "dialect"
  | "sqlextension"
  | "issues"
  | "model"
  | "extension"
  | "cli"
  | "suite"
  | "examples"
  | "tools"
  | "root";

/** A unit: a folder of the table. A class with instances (`models/`) has one unit for each of its folders. */
export type Unit = { readonly name: string; readonly class: UnitClass };

/** The rules of this check. */
export type LayerRule = "layers/unclassified" | "layers/relative" | "layers/private" | "layers/external" | "layers/above" | "layers/around" | "layers/cycle";

/** A finding of this check, in the shape the kernel's baseline holds (`trace.Keyed`). */
export type LayerFinding = trace.Keyed & { readonly rule: LayerRule };

type Folder = { readonly prefix: string; readonly class: UnitClass; readonly instances: boolean };

/** The folders of the table, each with its class; where `instances` is true each folder under the prefix is a unit of its own. */
const FOLDERS: readonly Folder[] = [
  { prefix: "engine/", class: "engine", instances: false },
  { prefix: "governance/", class: "governance", instances: false },
  { prefix: "sql/logical/", class: "logical", instances: false },
  { prefix: "sql/physical/", class: "physical", instances: false },
  { prefix: "sql/lifecycle/", class: "lifecycle", instances: false },
  { prefix: "sql/dialects/", class: "dialect", instances: true },
  { prefix: "sql/extensions/", class: "sqlextension", instances: true },
  { prefix: "sql/presets/", class: "preset", instances: false },
  { prefix: "sql/cli/", class: "cli", instances: false },
  { prefix: "issues/", class: "issues", instances: false },
  { prefix: "models/", class: "model", instances: true },
  { prefix: "extensions/", class: "extension", instances: true },
  { prefix: "suite/", class: "suite", instances: false },
  { prefix: "examples/", class: "examples", instances: false },
  { prefix: "tools/", class: "tools", instances: false },
];

/** What each class may import (0001-layers FR-004); a unit may always import itself. */
export const MAY_IMPORT: Readonly<Record<UnitClass, readonly UnitClass[]>> = {
  engine: [],
  governance: ["engine"],
  logical: ["governance", "engine"],
  physical: ["logical", "governance", "engine"],
  lifecycle: ["physical", "logical", "governance", "engine"],
  dialect: ["physical", "logical", "governance", "engine"],
  sqlextension: ["lifecycle", "physical", "logical", "governance", "engine"],
  preset: ["sqlextension", "lifecycle", "physical", "logical", "governance", "engine"],
  issues: ["governance", "engine"],
  model: ["governance", "engine", "model"],
  extension: ["governance", "engine"],
  cli: ["preset", "sqlextension", "dialect", "lifecycle", "physical", "logical", "governance", "engine", "extension", "model"],
  suite: ["engine", "governance", "logical", "physical", "lifecycle", "dialect", "sqlextension", "preset", "model", "extension", "cli", "examples"],
  examples: ["engine", "governance", "logical", "physical", "lifecycle", "dialect", "sqlextension", "preset", "model", "extension", "cli"],
  tools: [],
  root: [],
};

/** How high a class stands: an import of a higher level climbs (`layers/above`), of the same or a lower one that is not allowed reaches around (`layers/around`). */
const LEVEL: Readonly<Record<UnitClass, number>> = {
  engine: 0,
  governance: 1,
  logical: 2,
  physical: 3,
  lifecycle: 3.5,
  dialect: 4,
  sqlextension: 4,
  preset: 4.5,
  issues: 4,
  model: 4,
  extension: 4,
  cli: 5,
  suite: 6,
  examples: 6,
  tools: 6,
  root: 6,
};

/** The library's own checking, which may import any file of the library by a relative path (0001-layers FR-010). */
const OWN: ReadonlySet<UnitClass> = new Set<UnitClass>(["suite", "examples", "tools", "root"]);

/** The classes that import the kernel and the library alone (0001-layers FR-005). */
const STRICT: ReadonlySet<UnitClass> = new Set<UnitClass>(["engine", "governance", "logical", "physical"]);

/** The unit a file is in, from its path relative to the library with `/`; `undefined` where it is in none (0001-layers FR-008). */
export function unitOf(path: string): Unit | undefined {
  if (!path.includes("/")) return path.endsWith(".ts") ? { name: "(root)", class: "root" } : undefined;
  for (const f of FOLDERS) {
    if (!path.startsWith(f.prefix)) continue;
    if (!f.instances) return { name: f.prefix, class: f.class };
    const rest = path.slice(f.prefix.length);
    const slash = rest.indexOf("/");
    return slash > 0 ? { name: `${f.prefix}${rest.slice(0, slash)}/`, class: f.class } : undefined;
  }
  return undefined;
}

/** An import of a file, with its line. */
export type Specifier = { readonly line: number; readonly specifier: string };

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

function make(rule: LayerRule, file: string, line: number, message: string, about?: string): LayerFinding {
  return { file, line, rule, message, key: about === undefined ? `${rule} ${file}` : `${rule} ${file} ${about}` };
}

/**
 * Every finding of the layers check over a library's files.
 *
 * @param files - each file of the library, its path from the library with `/` and its text
 * @param exportsMap - the `exports` of the library's `package.json`, each subpath (`./engine`) to its file (`./engine/api.ts`)
 * @returns the findings, in the order of the files
 */
export function layerFindings(files: readonly trace.SourceFile[], exportsMap: Readonly<Record<string, string>>): readonly LayerFinding[] {
  const out: LayerFinding[] = [];
  // the imports of one model by another (0028-modules FR-006): they must not make a cycle
  const among = new Map<string, Map<string, { readonly file: string; readonly line: number }>>();
  for (const file of files) {
    const here = unitOf(file.path);
    if (here === undefined) {
      out.push(make("layers/unclassified", file.path, 1, "no unit of the table holds it: put it in one, or add the unit to the table"));
      continue;
    }
    for (const { line, specifier } of specifiersOf(file.text)) {
      if (specifier.startsWith("./") || specifier.startsWith("../")) {
        const target = unitOf(layers.resolveImport(file.path, specifier));
        if (target !== undefined && target.name !== here.name && !OWN.has(here.class)) {
          out.push(
            make(
              "layers/relative",
              file.path,
              line,
              `it imports ${specifier}, a file of ${target.name}: import it by ${PACKAGE}`,
              specifier,
            ),
          );
        }
        continue;
      }
      if (specifier === PACKAGE || specifier.startsWith(`${PACKAGE}/`)) {
        const entry = exportsMap[`.${specifier.slice(PACKAGE.length)}`];
        const target = entry === undefined ? undefined : unitOf(entry.replace(/^\.\//, ""));
        if (entry === undefined || target === undefined) {
          out.push(make("layers/private", file.path, line, `it imports ${specifier}, which exports does not name`, specifier));
          continue;
        }
        if (here.class === "model" && target.class === "model" && target.name !== here.name) {
          const to = among.get(here.name) ?? new Map<string, { readonly file: string; readonly line: number }>();
          if (!to.has(target.name)) to.set(target.name, { file: file.path, line });
          among.set(here.name, to);
        }
        if (target.name === here.name || MAY_IMPORT[here.class].includes(target.class)) continue;
        const climbs = LEVEL[target.class] > LEVEL[here.class];
        out.push(
          make(
            climbs ? "layers/above" : "layers/around",
            file.path,
            line,
            `${here.name} (${here.class}) imports ${specifier}, ${target.name} (${target.class}), which it ${climbs ? "stands below" : "may not reach"}`,
            specifier,
          ),
        );
        continue;
      }
      if (STRICT.has(here.class) && specifier !== KERNEL) {
        out.push(
          make("layers/external", file.path, line, `${here.name} imports ${specifier}: only the kernel and this package`, specifier),
        );
      }
    }
  }
  // a cycle among models: found once, at the import that closes it
  const state = new Map<string, "visiting" | "done">();
  const walk = (from: string, path: readonly string[]): void => {
    state.set(from, "visiting");
    for (const [to, at] of among.get(from) ?? []) {
      if (state.get(to) === "visiting") {
        const loop = [...path.slice(path.indexOf(to)), to];
        out.push(make("layers/cycle", at.file, at.line, `${from} imports ${to}, which imports ${from} again: ${loop.join(" -> ")}`, loop.join(">")));
      } else if (state.get(to) === undefined) walk(to, [...path, to]);
    }
    state.set(from, "done");
  };
  for (const from of [...among.keys()].sort()) if (state.get(from) === undefined) walk(from, [from]);
  return out;
}
