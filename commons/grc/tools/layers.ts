// Spec: 0001-grc-layers FR-011
/**
 * The layers check of the library (0001-grc-layers): which unit each file is in, which units it may import, which packages it may name, and a finding for every import that does not follow the
 * table, for a name of a framework, runner, store, vendor or exchange format in the core, and for a shim. It reads every import, relative or by package name, because an import by package name is
 * invisible to the kernel's layers check, which reads relative imports only (commons 0005-typescript-practice FR-077); it resolves the library's own package name through `exports`, as Node and the
 * compiler do. The shape is that of `data` 0001-layers, which Kanon will hold for every library.
 *
 * @remarks
 * Pure: it is given the files and the `exports` map and returns findings as data, which `check.ts` holds against a baseline.
 *
 * @limits
 * It reads imports by the text's shape, as the kernel's reader does: a comment line is skipped, and an import inside a template literal that begins a line is read. A name is looked for in the
 * lines of code only, not in comments.
 *
 * @module
 */
import * as layers from "@intellectual-frontiers/mizan/layers";
import * as trace from "@intellectual-frontiers/mizan/trace";

/** The package's own name, which a file uses to import another unit. */
export const PACKAGE = "@intellectual-frontiers/grc";

/** The kinds of unit of the table (0001-grc-layers FR-004 to FR-008). */
export type UnitClass = "governance" | "logical" | "physical" | "serializer" | "runner" | "store" | "signer" | "conformance" | "surface" | "suite" | "tools" | "root";

/** A unit: a folder of the table. A class with instances (`runners/`) has one unit for each of its folders. */
export type Unit = { readonly name: string; readonly class: UnitClass };

/** The rules of this check. */
export type LayerRule = "layers/unclassified" | "layers/relative" | "layers/private" | "layers/external" | "layers/above" | "layers/around" | "layers/named" | "layers/compat";

/** A finding of this check, in the shape the kernel's baseline holds. */
export type LayerFinding = trace.Keyed & { readonly rule: LayerRule };

type Folder = { readonly prefix: string; readonly class: UnitClass; readonly instances: boolean };

const FOLDERS: readonly Folder[] = [
  { prefix: "src/governance/", class: "governance", instances: false },
  { prefix: "src/logical/", class: "logical", instances: false },
  { prefix: "src/physical/", class: "physical", instances: false },
  { prefix: "src/serializers/", class: "serializer", instances: true },
  { prefix: "src/runners/", class: "runner", instances: true },
  { prefix: "src/stores/", class: "store", instances: true },
  { prefix: "src/signers/", class: "signer", instances: true },
  { prefix: "src/conformance/", class: "conformance", instances: false },
  { prefix: "src/surfaces/", class: "surface", instances: true },
  { prefix: "suite/", class: "suite", instances: false },
  { prefix: "tools/", class: "tools", instances: false },
];

const EXTENSIONS: readonly UnitClass[] = ["serializer", "runner", "store", "signer"];

/** What each class may import (0001-grc-layers FR-004 to FR-008); a unit may always import itself, and never another extension. */
export const MAY_IMPORT: Readonly<Record<UnitClass, readonly UnitClass[]>> = {
  governance: [],
  logical: ["governance"],
  physical: ["logical", "governance"],
  serializer: ["logical", "governance"],
  runner: ["physical", "logical", "governance"],
  store: ["physical", "logical", "governance"],
  signer: ["physical", "logical", "governance"],
  conformance: ["physical", "logical", "governance", ...EXTENSIONS],
  surface: ["conformance", "physical", "logical", "governance", ...EXTENSIONS],
  suite: [],
  tools: [],
  root: [],
};

const LEVEL: Readonly<Record<UnitClass, number>> = {
  governance: 1,
  logical: 2,
  physical: 3,
  serializer: 4,
  runner: 4,
  store: 4,
  signer: 4,
  conformance: 5,
  surface: 6,
  suite: 7,
  tools: 7,
  root: 7,
};

/** The library's own checking, which may import any file of the library by a relative path (0001-grc-layers FR-006). */
const OWN: ReadonlySet<UnitClass> = new Set<UnitClass>(["suite", "tools", "root"]);

const CORE = "@intellectual-frontiers/core";
const PURE = [CORE, "@intellectual-frontiers/crypto", "@intellectual-frontiers/formats"];
const HOSTED = [...PURE, "@intellectual-frontiers/system"];

/** The packages each class may name besides its own (0001-grc-layers FR-004 to FR-008); `undefined` is any. */
export const MAY_NAME: Readonly<Record<UnitClass, readonly string[] | undefined>> = {
  governance: [CORE],
  logical: PURE,
  physical: HOSTED,
  serializer: PURE,
  runner: [...HOSTED, "@intellectual-frontiers/lang-sql"],
  store: HOSTED,
  signer: HOSTED,
  conformance: PURE,
  surface: [...HOSTED, "@intellectual-frontiers/headless", "@intellectual-frontiers/terminal"],
  suite: undefined,
  tools: undefined,
  root: undefined,
};

/** Classes whose code names no framework, runner, store, vendor or exchange format (0001-grc-layers FR-001). */
const CORE_CLASSES: ReadonlySet<UnitClass> = new Set<UnitClass>(["governance", "logical", "physical"]);

const NAMED = /\b(NIST|FedRAMP|SOC ?2|ISO ?27001|HIPAA|PCI|osquery|PostgreSQL|SQLite|DuckDB|AWS|Azure|GitHub|GitLab|OPA|Rego|OSCAL|OCSF|SARIF|CycloneDX|in-toto|SCF|DSSE)\b/;
const SHIM = /(@deprecated|\blegacy\b|backward[- ]?compat)/i;

/** The unit a file is in, from its path relative to the library with `/`; `undefined` where it is in none (0001-grc-layers FR-011). */
export function unitOf(path: string): Unit | undefined {
  if (!path.includes("/") || (path.startsWith("src/") && path.indexOf("/", 4) < 0)) return path.endsWith(".ts") ? { name: "(root)", class: "root" } : undefined;
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

function isComment(line: string): boolean {
  const t = line.trim();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*");
}

/**
 * Every finding of the layers check over a library's files.
 *
 * @param files - each file of the library, its path from the library with `/` and its text
 * @param exportsMap - the `exports` of the library's `package.json`, each subpath (`./governance`) to its file
 * @returns the findings, in the order of the files
 */
export function layerFindings(files: readonly trace.SourceFile[], exportsMap: Readonly<Record<string, string>>): readonly LayerFinding[] {
  const out: LayerFinding[] = [];
  for (const file of files) {
    const here = unitOf(file.path);
    if (here === undefined) {
      out.push(make("layers/unclassified", file.path, 1, "no unit of the table holds it: put it in one, or add the unit to the table"));
      continue;
    }
    for (const [i, line] of file.text.split("\n").entries()) {
      if (SHIM.test(line) && (!isComment(line) || line.includes("@deprecated")) && here.class !== "tools" && here.class !== "suite") {
        out.push(make("layers/compat", file.path, i + 1, "a shim, an alias or a deprecated name: GRC keeps no compatibility (0001-grc-layers FR-003)", `${i + 1}`));
      }
      if (CORE_CLASSES.has(here.class) && !isComment(line)) {
        const m = NAMED.exec(line);
        if (m !== null) out.push(make("layers/named", file.path, i + 1, `the core names ${m[0]}: a framework, runner, store, vendor or exchange format belongs to an extension or to data`, `${m[0]} ${i + 1}`));
      }
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
        if (target.name === here.name || OWN.has(here.class) || MAY_IMPORT[here.class].includes(target.class)) continue;
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
      const allowed = MAY_NAME[here.class];
      if (allowed !== undefined && !allowed.some((p) => specifier === p || specifier.startsWith(`${p}/`))) {
        out.push(make("layers/external", file.path, line, `${here.name} imports ${specifier}: it may name only ${allowed.join(", ")} and this package`, specifier));
      }
    }
  }
  return out;
}
