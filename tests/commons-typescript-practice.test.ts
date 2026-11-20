/**
 * How the TypeScript of commons is written, checked and run, held for every library (commons 0005-typescript-practice FR-001, FR-004, FR-015, FR-016, FR-017, FR-026, FR-028, FR-076):
 * every package is an ES module for Node 26; no source names a vendor's API or a registry; every file and every export carries TSDoc; the dependencies are exact and each package that installs
 * packages has its lockfile; the strict base configuration is what every `tsconfig.json` extends; Bun is the only tool; the lint rules are errors; and a library imports its own package only through
 * its `exports`.
 *
 * @module
 */
import { fs, path } from "../commons/system/src/mod.ts";
import { VENDOR_GLOBALS } from "../commons/lint/src/rules/no-vendor-api.ts";
import { assert, assertEquals, proves } from "../commons/test/src/test.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");
const COMMONS = path.join(ROOT, "commons");

/** The text of a file of the repository. */
const read = (rel: string): string => fs.readTextFileSync(path.join(ROOT, rel));

/** What a `package.json` says of the fields these rules read. */
type Manifest = {
  readonly name: string;
  readonly type: string;
  readonly engines: Readonly<Record<string, string>>;
  readonly exports: Readonly<Record<string, unknown>>;
  readonly dependencies: Readonly<Record<string, string>>;
  readonly devDependencies: Readonly<Record<string, string>>;
};

const isRecord = (v: unknown): v is Readonly<Record<string, unknown>> => typeof v === "object" && v !== null && !Array.isArray(v);
const strings = (v: unknown): Readonly<Record<string, string>> =>
  isRecord(v) ? Object.fromEntries(Object.entries(v).filter((e): e is [string, string] => typeof e[1] === "string")) : {};

/** A `package.json` of the repository, from its root, read into the fields that matter. */
function manifest(rel: string): Manifest {
  const v: unknown = JSON.parse(read(rel));
  const o = isRecord(v) ? v : {};
  return {
    name: typeof o["name"] === "string" ? o["name"] : "",
    type: typeof o["type"] === "string" ? o["type"] : "",
    engines: strings(o["engines"]),
    exports: isRecord(o["exports"]) ? o["exports"] : {},
    dependencies: strings(o["dependencies"]),
    devDependencies: strings(o["devDependencies"]),
  };
}

/** The folders of commons that are packages with a manifest of their own (the libraries and the metapackages). */
const PACKAGES: readonly string[] = fs
  .readDirSync(COMMONS)
  .filter((e) => e.isDirectory && fs.existsSync(path.join(COMMONS, e.name, "library.ts")) && fs.existsSync(path.join(COMMONS, e.name, "package.json")))
  .map((e) => e.name)
  .sort();

/** The `.ts` files under a folder, from the repository's root, leaving out installed packages and built output. */
function sources(rel: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readDirSync(dir)) {
      if (e.name === "node_modules" || e.name === "dist") continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory) walk(p);
      else if (e.name.endsWith(".ts")) out.push(path.toPosix(path.relative(ROOT, p)));
    }
  };
  walk(path.join(ROOT, rel));
  return out.sort();
}

/** The sources and the tests of every library. */
const SRC = PACKAGES.flatMap((p) => sources(`commons/${p}/src`));
const SUITE = PACKAGES.flatMap((p) => sources(`commons/${p}/suite`));

/** The module specifiers a file imports or re-exports, statically or dynamically. */
function specifiers(text: string): string[] {
  const out: string[] = [];
  for (const re of [
    /^\s*(?:import|export)\b[^;'"]*?\bfrom\s*["']([^"']+)["']/gm,
    /^\s*import\s*["']([^"']+)["']/gm,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  ]) {
    for (const m of text.matchAll(re)) if (m[1] !== undefined) out.push(m[1]);
  }
  return out;
}

/** The lines of a file that are code, not comments. */
function codeLines(text: string): { readonly line: number; readonly text: string }[] {
  const out: { line: number; text: string }[] = [];
  let inBlock = false;
  for (const [i, raw] of text.split("\n").entries()) {
    const t = raw.trim();
    if (inBlock) {
      if (t.includes("*/")) inBlock = false;
      continue;
    }
    if (t.startsWith("/*")) {
      inBlock = !t.includes("*/");
      continue;
    }
    if (t.startsWith("//")) continue;
    out.push({ line: i + 1, text: raw });
  }
  return out;
}

proves(["0005-typescript-practice FR-001"], "every package is an ES module for Node 26 or later, and the base configuration keeps the sources to erasable TypeScript", () => {
  assert(PACKAGES.length > 30, `${PACKAGES.length} packages`);
  const bad: string[] = [];
  for (const rel of ["package.json", ...PACKAGES.map((p) => `commons/${p}/package.json`)]) {
    const m = manifest(rel);
    if (m.type !== "module") bad.push(`${rel}: "type" is ${m.type}`);
    if (m.engines["node"] !== ">=26") bad.push(`${rel}: engines.node is ${m.engines["node"] ?? "absent"}`);
  }
  assertEquals(bad, []);
  assertEquals(JSON.parse(read("commons/tsconfig.base.json")).compilerOptions.erasableSyntaxOnly, true);
});

/** The vendor globals the lint rule `no-vendor-api` refuses, as expressions that find a member of one, and the registries and URLs it does not allow. */
const VENDOR = [...VENDOR_GLOBALS.map((g) => new RegExp(`\\b${g}\\s*\\.`)), /["']jsr:/, /["']npm:/, /["']@std\//, /["']https?:\/\/[^"']*\.(?:ts|js|mjs)["']/];
/** The files that name a vendor's API on purpose: the rule's own list, the library that builds a binary with Bun and the installers' texts, which say what they install. */
const VENDOR_ALLOWED = /^commons\/(lint\/|system\/src\/compile\.ts|ergonex\/src\/install\/)/;

proves(["0005-typescript-practice FR-004"], "no source of a library uses a vendor global, a registry or a URL import", () => {
  const bad: string[] = [];
  for (const f of SRC) {
    if (VENDOR_ALLOWED.test(f)) continue;
    for (const { line, text } of codeLines(read(f))) for (const re of VENDOR) if (re.test(text)) bad.push(`${f}:${line}: ${text.trim()}`);
  }
  assertEquals(bad, []);
  assert(VENDOR.some((re) => re.test('import x from "jsr:@std/path";')), "the check sees a registry import");
  assertEquals(codeLines("/**\n * Bun.file\n */\n// Bun.x\nBun.exit();"), [{ line: 5, text: "Bun.exit();" }]);
});

proves(["0005-typescript-practice FR-015"], "every file of a library's src/ and suite/ begins with a TSDoc block that says @module, and every export of src/ has TSDoc", () => {
  const bad: string[] = [];
  for (const f of [...SRC, ...SUITE]) {
    if (f.endsWith(".auto.ts")) continue; // generated, with the line that says so
    const text = read(f);
    const head = /^(?:\/\/[^\n]*\n|#![^\n]*\n)*\/\*\*[\s\S]*?\*\//.exec(text);
    if (head === null || !head[0].includes("@module")) bad.push(`${f}: no @module block at the top`);
    if (!f.includes("/src/")) continue;
    const lines = text.split("\n");
    for (const [i, l] of lines.entries()) {
      if (!/^export\s+(?:declare\s+)?(?:async\s+)?(?:function\*?|const|let|class|type\s+\w|interface|abstract\s+class)\b/.test(l)) continue;
      let j = i - 1;
      while (j >= 0 && (lines[j] ?? "").trim() === "") j--;
      if (!(lines[j] ?? "").trim().endsWith("*/")) bad.push(`${f}:${i + 1}: ${l.trim().slice(0, 60)} has no TSDoc`);
    }
  }
  assertEquals(bad, []);
});

/** Whether a dependency is pinned exactly: a version, an alias of a version, or a link to a package of this repository. */
const pinned = (v: string): boolean => /^\d+\.\d+\.\d+(-[\w.]+)?$/.test(v) || v.startsWith("link:") || /^npm:[\w@/.-]+@\d+\.\d+\.\d+(-[\w.]+)?$/.test(v);

proves(["0005-typescript-practice FR-016"], "the dependencies of the root and of every library are exact or links, and the root has its lockfile", () => {
  const bad: string[] = [];
  for (const rel of ["package.json", ...PACKAGES.map((p) => `commons/${p}/package.json`)]) {
    const m = manifest(rel);
    for (const [n, v] of [...Object.entries(m.dependencies), ...Object.entries(m.devDependencies)]) if (!pinned(v)) bad.push(`${rel}: ${n} is ${v}`);
  }
  assertEquals(bad, []);
  assert(fs.existsSync(path.join(ROOT, "bun.lock")), "the root's bun.lock");
  for (const gone of ["package-lock.json", "yarn.lock", "pnpm-lock.yaml"]) assert(!fs.existsSync(path.join(ROOT, gone)), gone);
  assert(/^7\./.test(manifest("package.json").dependencies["typescript"] ?? ""), "the root's TypeScript is 7");
});

proves(["0005-typescript-practice FR-017"], "the base configuration sets the strict options and every tsconfig of the repository extends it", () => {
  const base: unknown = JSON.parse(read("commons/tsconfig.base.json"));
  const options = isRecord(base) && isRecord(base["compilerOptions"]) ? base["compilerOptions"] : {};
  for (const flag of [
    "strict",
    "noEmit",
    "allowImportingTsExtensions",
    "erasableSyntaxOnly",
    "verbatimModuleSyntax",
    "isolatedModules",
    "noUncheckedIndexedAccess",
    "exactOptionalPropertyTypes",
    "noImplicitReturns",
    "noImplicitOverride",
    "noFallthroughCasesInSwitch",
    "noPropertyAccessFromIndexSignature",
    "noUnusedLocals",
    "noUnusedParameters",
  ])
    assertEquals(options[flag], true, flag);
  assertEquals(options["module"], "nodenext");
  assertEquals(options["types"], ["node"]);
  const bad: string[] = [];
  const configs = [
    ...PACKAGES.flatMap((p) => fs.readDirSync(path.join(COMMONS, p)).filter((e) => /^tsconfig.*\.json$/.test(e.name)).map((e) => `commons/${p}/${e.name}`)),
    "tests/tsconfig.json",
    "commons/tools/tsconfig.json",
  ];
  assert(configs.length > 30, `${configs.length} configurations`);
  for (const rel of configs) {
    const c: unknown = JSON.parse(read(rel));
    const ext = isRecord(c) && typeof c["extends"] === "string" ? c["extends"] : "";
    if (path.resolve(path.join(ROOT, path.dirname(rel)), ext) !== path.join(COMMONS, "tsconfig.base.json")) bad.push(`${rel} extends ${ext}`);
  }
  assertEquals(bad, []);
});

proves(["0005-typescript-practice FR-026"], "no formatter, linter, test framework or package manager but Bun is a dependency, and the pins name Bun", () => {
  const tools =
    /^(prettier|eslint|@typescript-eslint\/.*|dprint|@dprint\/.*|biome|@biomejs\/.*|oxlint|vitest|jest|mocha|ava|tsx|ts-node|npm|pnpm|yarn)$/;
  const found: string[] = [];
  for (const rel of ["package.json", ...PACKAGES.map((p) => `commons/${p}/package.json`)]) {
    const m = manifest(rel);
    for (const n of [...Object.keys(m.dependencies), ...Object.keys(m.devDependencies)]) if (tools.test(n)) found.push(`${rel}: ${n}`);
  }
  assertEquals(found, []);
  assert(/^BUN_VERSION=\d+\.\d+\.\d+/m.test(read("commons/generated/pins.auto.env")), "the pins name Bun's version");
});

proves(["0005-typescript-practice FR-027", "0005-typescript-practice FR-028"], "bunfig.toml sets the formatter and makes an error of every rule FR-028 names", () => {
  const config = read("bunfig.toml");
  assert(/^\[fmt\]/m.test(config) && /^printWidth = 140$/m.test(config) && /^\[lint\]/m.test(config) && /^typeAware = true$/m.test(config));
  const rules = [
    "typescript/no-explicit-any",
    "typescript/no-non-null-assertion",
    "typescript/explicit-module-boundary-types",
    "typescript/switch-exhaustiveness-check",
    "typescript/no-floating-promises",
    "typescript/no-misused-promises",
    "typescript/consistent-type-imports",
    "typescript/only-throw-error",
    "typescript/no-unnecessary-type-assertion",
    "typescript/ban-ts-comment",
    "eslint/eqeqeq",
    "ifc/no-vendor-api",
    "ifc/no-registry-import",
    "ifc/module-doc",
    "ifc/switch-absurd",
  ];
  for (const r of rules) assert(new RegExp(`^"${r}" = (?:"error"|\\["error")`, "m").test(config), `${r} is not an error in bunfig.toml`);
  assert(fs.existsSync(path.join(ROOT, "commons/lint/src/plugin.ts")), "the plugin bunfig.toml loads is there");
  const workflow = read(".github/workflows/tests.auto.yml");
  assert(workflow.includes("bun fmt --check") && workflow.includes("--max-warnings 0"), "the check job runs the formatter and the linter");
});

proves(["0005-typescript-practice FR-076"], "a library imports its own package only through the entries its exports name", () => {
  const bad: string[] = [];
  for (const p of PACKAGES) {
    const m = manifest(`commons/${p}/package.json`);
    const entries = new Set(Object.keys(m.exports));
    for (const f of [...sources(`commons/${p}/src`), ...sources(`commons/${p}/suite`), ...sources(`commons/${p}/tools`)]) {
      for (const s of specifiers(read(f))) {
        if (s !== m.name && !s.startsWith(`${m.name}/`)) continue;
        const sub = s === m.name ? "." : `.${s.slice(m.name.length)}`;
        if (!entries.has(sub)) bad.push(`${f}: ${s}`);
      }
    }
  }
  assertEquals(bad, []);
});
