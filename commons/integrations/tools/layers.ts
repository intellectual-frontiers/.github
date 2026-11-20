// Spec: 0001-integrations-layers FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007
/**
 * The layers check of Integrations (commons integrations 0001-integrations-layers), modelled on the check of commons data: which unit each file is in, which units it
 * may import, and a finding for every import that does not follow the table. It reads every import, relative or by package name, and resolves the library's
 * own package name through `exports`, as Node and the compiler do. Each file is one unit's, imports point one way (governance, logical, a surface), and a
 * file of one unit reaches another only through the package's `exports`, never by a relative path.
 *
 * @remarks
 * Pure: it is given the files and the `exports` map and returns findings as data, which `check.ts` holds against a baseline. A new surface (`mcp`,
 * `rest`) is a row of `SURFACES`: a folder under `src/surfaces/` with no row is `layers/unclassified`, so a surface cannot appear without its table entry
 * saying what it may import.
 *
 * @limits
 * It reads imports by the text's shape, as the kernel's reader does: a comment line is skipped, and an import inside a template literal that begins a line is read.
 *
 * @module
 */
import * as layers from "@intellectual-frontiers/mizan/layers";
import * as trace from "@intellectual-frontiers/mizan/trace";

/** The package's own name, which a file uses to import another unit. */
export const PACKAGE = "@intellectual-frontiers/integrations";
/** The foundation, a package of commons of its own. */
export const CORE = "@intellectual-frontiers/core";

/** The kinds of unit of the table. */
export type UnitClass = "governance" | "logical" | "physical" | "surface" | "suite" | "tools" | "root";

/** A unit: a folder of the table. A class with instances (`physical/`, `surfaces/`) has one unit for each of its folders. */
export type Unit = { readonly name: string; readonly class: UnitClass };

/** The rules of this check. */
export type LayerRule = "layers/unclassified" | "layers/relative" | "layers/private" | "layers/external" | "layers/above" | "layers/around";

/** A finding of this check, in the shape the kernel's baseline holds (`trace.Keyed`). */
export type LayerFinding = trace.Keyed & { readonly rule: LayerRule };

/** A package a unit may import, with the subpaths it may reach: `any` (the package and every entry of it), none (`[]`: the package's own entry only), or the listed subpaths (and not the package's own entry). */
export type Allowed = { readonly name: string; readonly subpaths: "any" | readonly string[] };

const NET = "@intellectual-frontiers/net";
const HEADLESS = "@intellectual-frontiers/headless";
const TERMINAL = "@intellectual-frontiers/terminal";

/** The physical adapters there are: one row each, with what the adapter may import besides the layers below it. They are the only units that reach a network. */
export const PHYSICAL: Readonly<Record<string, readonly Allowed[]>> = {
  http: [
    { name: CORE, subpaths: [] },
    { name: NET, subpaths: ["http-client"] },
  ],
  transport: [
    { name: CORE, subpaths: [] },
    { name: NET, subpaths: ["http-client"] },
  ],
};

/** The surfaces there are: one row each. */
export const SURFACES: Readonly<Record<string, readonly Allowed[]>> = {
  headless: [
    { name: CORE, subpaths: [] },
    { name: HEADLESS, subpaths: ["governance", "logical"] },
    { name: TERMINAL, subpaths: ["args"] },
  ],
};

/** What each class may import by package name, besides this package's other units. A physical adapter's and a surface's rows are their own. */
const EXTERNAL: Readonly<Record<UnitClass, readonly Allowed[]>> = {
  governance: [{ name: CORE, subpaths: [] }],
  logical: [{ name: CORE, subpaths: [] }],
  physical: [],
  surface: [],
  suite: [],
  tools: [],
  root: [],
};

/** What each class may import of this package's units (a unit may always import itself). */
export const MAY_IMPORT: Readonly<Record<UnitClass, readonly UnitClass[]>> = {
  governance: [],
  logical: ["governance"],
  physical: ["logical", "governance"],
  surface: ["physical", "logical", "governance"],
  suite: ["governance", "logical", "physical", "surface", "root"],
  tools: [],
  root: ["governance", "logical"],
};

/** How high a class stands: an import of a higher level climbs (`layers/above`), of the same or a lower one that is not allowed reaches around (`layers/around`). */
const LEVEL: Readonly<Record<UnitClass, number>> = { governance: 1, logical: 2, physical: 3, surface: 4, root: 5, suite: 6, tools: 6 };

/** The checking of the library itself, which may import any file of the library by a relative path. */
const OWN: ReadonlySet<UnitClass> = new Set<UnitClass>(["suite", "tools", "root"]);

/** The unit a file is in, from its path relative to the library with `/`; `undefined` where it is in none. */
export function unitOf(path: string): Unit | undefined {
  if (!path.includes("/")) return path.endsWith(".ts") ? { name: "(root)", class: "root" } : undefined;
  if (path === "src/mod.ts") return { name: "(entry)", class: "root" };
  if (path.startsWith("src/governance/")) return { name: "src/governance/", class: "governance" };
  if (path.startsWith("src/logical/")) return { name: "src/logical/", class: "logical" };
  if (path.startsWith("src/physical/")) {
    const rest = path.slice("src/physical/".length);
    const slash = rest.indexOf("/");
    const name = slash > 0 ? rest.slice(0, slash) : undefined;
    return name !== undefined && PHYSICAL[name] !== undefined ? { name: `src/physical/${name}/`, class: "physical" } : undefined;
  }
  if (path.startsWith("src/surfaces/")) {
    const rest = path.slice("src/surfaces/".length);
    const slash = rest.indexOf("/");
    const name = slash > 0 ? rest.slice(0, slash) : undefined;
    return name !== undefined && SURFACES[name] !== undefined ? { name: `src/surfaces/${name}/`, class: "surface" } : undefined;
  }
  if (path.startsWith("suite/")) return { name: "suite/", class: "suite" };
  if (path.startsWith("tools/")) return { name: "tools/", class: "tools" };
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

/** Whether a specifier is one of the packages a unit may import. */
export function allowedExternal(allowed: readonly Allowed[], specifier: string): boolean {
  return allowed.some((a) => {
    if (specifier === a.name) return a.subpaths === "any" || a.subpaths.length === 0;
    if (!specifier.startsWith(`${a.name}/`)) return false;
    return a.subpaths === "any" || a.subpaths.includes(specifier.slice(a.name.length + 1));
  });
}

/** What a unit may import by package name besides this package: its class's row, or for a surface the row of the surface. */
export function externalsOf(unit: Unit): readonly Allowed[] {
  if (unit.class === "physical") return PHYSICAL[unit.name.replace(/^src\/physical\//, "").replace(/\/$/, "")] ?? [];
  if (unit.class === "surface") return SURFACES[unit.name.replace(/^src\/surfaces\//, "").replace(/\/$/, "")] ?? [];
  return EXTERNAL[unit.class];
}

/**
 * Every finding of the layers check over a library's files.
 *
 * @param files - each file of the library, its path from the library with `/` and its text
 * @param exportsMap - the `exports` of the library's `package.json`, each subpath (`./governance`) to its file (`./src/governance/mod.ts`)
 * @returns the findings, in the order of the files
 */
export function layerFindings(files: readonly trace.SourceFile[], exportsMap: Readonly<Record<string, string>>): readonly LayerFinding[] {
  const out: LayerFinding[] = [];
  for (const file of files) {
    const here = unitOf(file.path);
    if (here === undefined) {
      out.push(make("layers/unclassified", file.path, 1, "no unit of the table holds it: put it in one, or add the surface to the table"));
      continue;
    }
    for (const { line, specifier } of specifiersOf(file.text)) {
      if (specifier.startsWith("./") || specifier.startsWith("../")) {
        const target = unitOf(layers.resolveImport(file.path, specifier));
        if (target !== undefined && target.name !== here.name && !OWN.has(here.class)) {
          out.push(make("layers/relative", file.path, line, `it imports ${specifier}, a file of ${target.name}: import it by ${PACKAGE}`, specifier));
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
      if (OWN.has(here.class)) continue;
      if (!allowedExternal(externalsOf(here), specifier)) {
        out.push(make("layers/external", file.path, line, `${here.name} imports ${specifier}, which its row of the table does not allow`, specifier));
      }
    }
  }
  return out;
}
