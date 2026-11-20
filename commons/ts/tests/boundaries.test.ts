/**
 * The rules of IFC TypeScript as tests (commons 0005-typescript-runtime FR-001 to FR-004, FR-015, FR-016, FR-026, FR-028, FR-029): the
 * kernel imports nothing outside itself; the runtime imports only `node:` builtins, the kernel and itself; no file names a vendor's API or
 * registry; every file and every export carries JSDoc; the development dependencies are pinned exactly in Bun's lockfile; Bun is the only
 * tool; the lint rules are errors; the package, a Git dependency of the root, exports what it should.
 *
 * @module
 */
import { lf } from "@intellectual-frontiers/core";
import { VENDOR_GLOBALS } from "../lint/rules/no-vendor-api.ts";
import { decodeManifest, type Manifest, PACKAGE_NAME, rootEntries } from "../tools/manifest.ts";
import { existsSync, readDirSync, readTextFile, readTextFileSync, statSync } from "@intellectual-frontiers/system/fs";
import { dirname, fromFileUrl, join, relative, resolve, toPosix } from "@intellectual-frontiers/system/path";
import { assert, assertEquals, assertStringIncludes, proves } from "../runtime/test.ts";

const ROOT = resolve(dirname(fromFileUrl(import.meta.url)), "..");

/** Every `.ts` file under a folder of the package, relative to the package with `/` between parts. */
function sources(folder: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const e of readDirSync(dir)) {
      const p = join(dir, e.name);
      if (e.isDirectory) walk(p);
      else if (e.name.endsWith(".ts")) out.push(toPosix(relative(ROOT, p)));
    }
  };
  walk(join(ROOT, folder));
  return out.sort();
}

/** The module specifiers a file imports or re-exports, statically or dynamically. */
export function specifiers(text: string): string[] {
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

/** The lines of a file that are code, not comments: a line whose text starts a comment, or lies inside a block comment, is left out. */
export function codeLines(text: string): { readonly line: number; readonly text: string }[] {
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

/** The one package that code of commons may import by name: the foundation (commons 0032-lifting-libraries FR-003). */
const CORE = "@intellectual-frontiers/core";
/** The packages of commons that code in this folder may import by name: the libraries lifted out of it. */
const LIFTED = new Set([
  CORE,
  "@intellectual-frontiers/crypto",
  "@intellectual-frontiers/formats",
  "@intellectual-frontiers/rdf",
  "@intellectual-frontiers/system",
  "@intellectual-frontiers/terminal",
]);
/** Whether a specifier is a lifted library or one of its entries (`@intellectual-frontiers/terminal/args`). */
const isLifted = (s: string): boolean => [...LIFTED].some((p) => s === p || s.startsWith(`${p}/`));
/** The host library: it touches the host, so the pure code of this folder does not import it (the kernel and the pure layers). */
const SYSTEM = "@intellectual-frontiers/system";
const isPureLifted = (s: string): boolean => isLifted(s) && s !== SYSTEM && !s.startsWith(`${SYSTEM}/`);

const KERNEL = sources("kernel");
const RUNTIME = sources("runtime");
const TESTS = sources("tests");
const TOOLS = sources("tools");
const LINT = sources("lint");
const MIZAN = sources("mizan");

proves(
  ["0003-mizan FR-017"],
  "Mizan's files import only node: built-ins, the kernel, the runtime, the ontology, the Git host contract's types and themselves",
  () => {
    assert(MIZAN.length > 1);
    const bad: string[] = [];
    for (const f of MIZAN) {
      for (const s of specifiers(readTextFileSync(join(ROOT, f)))) {
        if (s.startsWith("node:") || isLifted(s)) continue;
        const target = toPosix(relative(ROOT, resolve(ROOT, dirname(f), s)));
        const ok =
          target.startsWith("mizan/") ||
          target.startsWith("kernel/") ||
          target.startsWith("runtime/") ||
          target.startsWith("../ontology/") ||
          target === "githost/types.ts";
        if (!ok) bad.push(`${f}: ${s}`);
      }
    }
    assertEquals(bad, []);
  },
);

proves(
  ["0019-mizan-integrations FR-001"],
  "the integrations module has a pure layer that imports only the kernel and itself, and a host layer",
  () => {
    const pure = sources("mizan/integrations/pure");
    assert(pure.length >= 3);
    assert(sources("mizan/integrations/host").length >= 1);
    const bad: string[] = [];
    for (const f of pure) {
      for (const s of specifiers(readTextFileSync(join(ROOT, f)))) {
        if (isPureLifted(s)) continue;
        if (s.startsWith("node:")) {
          bad.push(`${f}: ${s}`);
          continue;
        }
        const target = toPosix(relative(ROOT, resolve(ROOT, dirname(f), s)));
        if (!target.startsWith("kernel/") && !target.startsWith("mizan/integrations/pure/")) bad.push(`${f}: ${s}`);
      }
    }
    assertEquals(bad, []);
  },
);

proves(["0005-typescript-runtime FR-002"], "the kernel imports nothing outside kernel/ but core, the foundation", () => {
  assert(KERNEL.length > 5);
  const bad: string[] = [];
  for (const f of KERNEL) {
    for (const s of specifiers(readTextFileSync(join(ROOT, f)))) {
      if (isPureLifted(s)) continue;
      const target = toPosix(relative(ROOT, resolve(ROOT, dirname(f), s)));
      if (!s.startsWith("./") || !target.startsWith("kernel/")) bad.push(`${f}: ${s}`);
    }
  }
  assertEquals(bad, []);
});

proves(["0005-typescript-runtime FR-003"], "the runtime imports only node: builtins, kernel/ and runtime/", () => {
  assert(RUNTIME.length > 5);
  const bad: string[] = [];
  for (const f of RUNTIME) {
    for (const s of specifiers(readTextFileSync(join(ROOT, f)))) {
      if (s.startsWith("node:") || isLifted(s)) continue;
      const target = toPosix(relative(ROOT, resolve(ROOT, dirname(f), s)));
      if (!s.startsWith(".") || !(target.startsWith("kernel/") || target.startsWith("runtime/"))) bad.push(`${f}: ${s}`);
    }
  }
  assertEquals(bad, []);
});

proves(
  ["0005-typescript-runtime FR-061", "0005-typescript-runtime FR-003"],
  "the lint plugin imports only node: builtins, kernel/, lint/ and runtime/",
  () => {
    assert(LINT.length > 3);
    const bad: string[] = [];
    for (const f of LINT) {
      for (const s of specifiers(
        codeLines(readTextFileSync(join(ROOT, f)))
          .map((l) => l.text)
          .join("\n"),
      )) {
        if (s.startsWith("node:") || isLifted(s)) continue;
        const target = toPosix(relative(ROOT, resolve(ROOT, dirname(f), s)));
        if (!s.startsWith(".") || !["kernel/", "lint/", "runtime/"].some((p) => target.startsWith(p))) bad.push(`${f}: ${s}`);
      }
    }
    assertEquals(bad, []);
  },
);

/** The vendor globals the lint rule `no-vendor-api` refuses, as expressions that find a member of one. */
const VENDOR_MEMBER = VENDOR_GLOBALS.map((g) => new RegExp(`\\b${g}\\s*\\.`));
const VENDOR = [...VENDOR_MEMBER, /["']jsr:/, /["']npm:/, /["']@std\//, /["']@erga\//, /["']https?:\/\/[^"']*\.(?:ts|js|mjs)["']/];
/** A line with the contents of its single- and double-quoted strings blanked, so that a name such as `"process.runtime.name"` is not taken for the host global. */
export function withoutStrings(text: string): string {
  return text.replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, (m) => `${m[0]}${" ".repeat(m.length - 2)}${m[0]}`);
}

const HOST_IN_KERNEL = [
  /\bprocess\b/,
  /\bBuffer\b/,
  /\brequire\s*\(/,
  /\b__dirname\b/,
  new RegExp(`\\bglobalThis\\s*\\.\\s*(?:process|${VENDOR_GLOBALS.join("|")})\\b`),
];

proves(
  ["0005-typescript-runtime FR-004"],
  "no code uses a vendor global, a registry or a URL import; the kernel names no host global",
  () => {
    const bad: string[] = [];
    for (const f of [...KERNEL, ...RUNTIME, ...LINT, ...TESTS, ...TOOLS]) {
      for (const { line, text } of codeLines(readTextFileSync(join(ROOT, f)))) {
        for (const re of VENDOR) if (re.test(text) && !f.startsWith("tests/boundaries")) bad.push(`${f}:${line}: ${text.trim()}`);
        if (f.startsWith("kernel/"))
          for (const re of HOST_IN_KERNEL) if (re.test(withoutStrings(text))) bad.push(`${f}:${line}: ${text.trim()}`);
      }
    }
    assertEquals(bad, []);
  },
);

proves(["0005-typescript-runtime FR-004"], "the checks see what they look for (negative controls)", () => {
  assertEquals(
    specifiers(
      `import a from "x";\nexport { b } from './y.ts';\nimport "z";\nconst m = await import("w");\nimport type {\n  T,\n} from "v";`,
    ),
    ["x", "./y.ts", "v", "z", "w"],
  );
  const code = codeLines("/**\n * Bun.file\n */\n// Bun.x\nBun.exit();");
  assertEquals(code, [{ line: 5, text: "Bun.exit();" }]);
  assert(VENDOR.some((re) => re.test(`import x from "jsr:@std/path";`)));
  assert(HOST_IN_KERNEL.some((re) => re.test(withoutStrings("const e = process.env;"))));
  assert(!HOST_IN_KERNEL.some((re) => re.test(withoutStrings(`const k = "process.runtime.name", q = 'a \\' process';`))));
});

proves(["0005-typescript-runtime FR-015"], "every file begins with a JSDoc block that says @module, and every export has JSDoc", () => {
  const bad: string[] = [];
  for (const f of [...KERNEL, ...RUNTIME, ...LINT, ...TESTS, ...TOOLS]) {
    const text = readTextFileSync(join(ROOT, f));
    const head = /^\/\*\*[\s\S]*?\*\//.exec(text);
    if (head === null || !head[0].includes("@module")) bad.push(`${f}: no @module block at the top`);
    if (f.startsWith("tests/")) continue;
    const lines = text.split("\n");
    for (const [i, l] of lines.entries()) {
      if (!/^export\s+(?:declare\s+)?(?:async\s+)?(?:function\*?|const|let|class|type\s+\w|interface|abstract\s+class)\b/.test(l)) continue;
      let j = i - 1;
      while (j >= 0 && (lines[j] ?? "").trim() === "") j--;
      if (!(lines[j] ?? "").trim().endsWith("*/")) bad.push(`${f}:${i + 1}: ${l.trim().slice(0, 60)} has no JSDoc`);
    }
  }
  assertEquals(bad, []);
});

/** The text of a file of the package. */
const text = (f: string): string => readTextFileSync(join(ROOT, f));

/** The source package.json, decoded once by the tooling's own decoder. */
function manifest(): Manifest {
  const m = decodeManifest(text("package.json"));
  if (m.kind === "err") throw new Error(m.error);
  return m.value;
}

proves(
  ["0005-typescript-runtime FR-016"],
  "the development dependencies are pinned exactly, Bun's lockfile holds the same versions, and there are no run-time dependencies",
  () => {
    const m = manifest();
    const pins = Object.entries(m.devDependencies);
    assertEquals(pins.map(([k]) => k).sort(), ["@types/node", "fast-check", "typescript"]);
    for (const [name, v] of pins) assert(/^\d+\.\d+\.\d+$/.test(v), `${name} is not pinned exactly: ${v}`);
    assert(/^7\./.test(m.devDependencies["typescript"] ?? ""), "TypeScript is 7");
    // the one run-time dependency is core, the foundation (commons 0032-lifting-libraries FR-003), linked in this repository
    assertEquals(m.dependencies, {
      "@intellectual-frontiers/core": "link:../core",
      "@intellectual-frontiers/crypto": "link:../crypto",
      "@intellectual-frontiers/formats": "link:../formats",
      "@intellectual-frontiers/rdf": "link:../rdf",
      "@intellectual-frontiers/system": "link:../system",
      "@intellectual-frontiers/terminal": "link:../terminal",
    });
    const lock = text("bun.lock");
    for (const [name, v] of pins) {
      assertStringIncludes(lock, `"${name}": "${v}"`);
      assertStringIncludes(lock, `["${name}@${v}"`);
    }
    assert(
      !existsSync(join(ROOT, "package-lock.json")) && !existsSync(join(ROOT, "yarn.lock")) && !existsSync(join(ROOT, "pnpm-lock.yaml")),
    );
  },
);

proves(["0005-typescript-runtime FR-026"], "no formatter, linter, test framework or package manager but Bun is a dependency", () => {
  const m = manifest();
  const tools =
    /^(prettier|eslint|@typescript-eslint\/.*|dprint|@dprint\/.*|biome|@biomejs\/.*|oxlint|vitest|jest|mocha|ava|tsx|ts-node|npm|pnpm|yarn)$/;
  assertEquals(
    Object.keys(m.devDependencies).filter((d) => tools.test(d)),
    [],
  );
});

proves(["0005-typescript-runtime FR-028"], "bunfig.toml makes an error of every rule FR-028 names", () => {
  const config = text("bunfig.toml");
  assert(/^\[fmt\]/m.test(config) && /^\[lint\]/m.test(config) && /^typeAware = true$/m.test(config));
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
  ];
  for (const r of rules) assert(new RegExp(`^"${r}" = (?:"error"|\\["error")`, "m").test(config), `${r} is not an error in bunfig.toml`);
});

/** A `package.json` of the repository, from its root, decoded by the tooling's own decoder. */
function manifestAt(rel: string): Manifest {
  const m = decodeManifest(readTextFileSync(join(ROOT, "..", "..", rel)));
  if (m.kind === "err") throw new Error(`${rel}: ${m.error}`);
  return m.value;
}

proves(
  ["0005-typescript-runtime FR-029"],
  "the root package is the Git dependency: this folder's entry points, the hook and ifc, exact run-time pins, and no release or tarball",
  () => {
    const m = manifest();
    assertEquals(m.name, PACKAGE_NAME);
    assertEquals(m.exports, {
      "./ts/kernel": "./kernel/mod.ts",
      "./ts/runtime": "./runtime/mod.ts",
      "./ts/runtime/test": "./runtime/test.ts",
      "./ts/runtime/test-run": "./runtime/test-run.ts",
      "./ts/lint": "./lint/plugin.ts",
      "./ts/lint/rule": "./lint/rule.ts",
      "./ts/lint/test-rule": "./lint/test-rule.ts",
      "./ts/mizan": "./mizan/mod.ts",
      "./ts/mizan/integrations": "./mizan/integrations/mod.ts",
      "./ts/mizan/changes": "./mizan/changes.ts",
      "./ts/mizan/changes/commit-message": "./mizan/changes/commit-message.ts",
      "./ts/mizan/changes/declaration": "./mizan/changes/declaration.ts",
      "./ts/mizan/check": "./mizan/check.ts",
      "./ts/mizan/oscal-register": "./mizan/oscal-register.ts",
      "./ts/mizan/versions": "./mizan/versions.ts",
      "./ts/quality": "./quality/mod.ts",
      "./ts/githost": "./githost/mod.ts",
      "./ts/githost/workflows": "./githost/workflows/mod.ts",
      "./ts/tools/pack-library": "./tools/pack-library.ts",
      "./ts/node": "./node/register.mjs",
    });
    for (const target of Object.values(m.exports)) assert(existsSync(join(ROOT, target)), target);
    const root = manifestAt("package.json");
    assertEquals(root.name, PACKAGE_NAME);
    const json: unknown = JSON.parse(readTextFileSync(join(ROOT, "..", "..", "package.json")));
    assert(typeof json === "object" && json !== null && "private" in json && json.private === true, "the root package is private");
    assert(!("version" in json), "the commit is the version: the root package has none");
    const ts = Object.fromEntries(Object.entries(root.exports).filter(([k]) => k.startsWith("./ts/")));
    assertEquals(ts, rootEntries(m));
    assertEquals(root.exports["./ontology/mizan"], "./commons/ontology/mizan/mod.ts");
    assert(existsSync(join(ROOT, "..", "ontology", "mizan", "mod.ts")), "the shared ontology the root exports is there");
    assertEquals(root.bin?.["ifc"], "./commons/ts/node/ifc.mjs");
    const deps = Object.entries(root.dependencies ?? {});
    for (const [name, v] of deps) assert(/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(v), `${name} is not pinned exactly: ${v}`);
    // the root package's run-time dependencies are docs' and core, which the kernel imports (exact, from npm)
    assertEquals(root.dependencies, {
      ...manifestAt("commons/docs/package.json").dependencies,
      "@intellectual-frontiers/core": "0.1.0",
      "@intellectual-frontiers/crypto": "0.1.0",
      "@intellectual-frontiers/formats": "0.1.0",
      "@intellectual-frontiers/rdf": "0.1.0",
      "@intellectual-frontiers/system": "0.1.0",
      "@intellectual-frontiers/terminal": "0.1.0",
    });
    assertEquals(root.devDependencies, {});
    const lock = readTextFileSync(join(ROOT, "..", "..", "bun.lock"));
    for (const [name, v] of deps) assertStringIncludes(lock, `["${name}@${v}"`);
    for (const gone of ["tools/pack.ts", "tsconfig.build.json", "../../.github/workflows/ifc-typescript-release.yml"])
      assert(!existsSync(join(ROOT, gone)), `${gone} is gone: commons is not released`);
    const ifc = lf(readTextFileSync(join(ROOT, "node", "ifc.mjs")));
    assert(ifc.startsWith("#!/usr/bin/env node\n"), "ifc runs from a shebang");
    assert(
      ifc.indexOf('import "./register.mjs"') < ifc.indexOf('import("../tools/test.ts")'),
      "ifc registers the hook before it imports TypeScript",
    );
  },
);

proves(
  ["0005-typescript-runtime FR-001"],
  "the layout: the folders and files are there, and runtime/mod.ts does not load the test runner",
  async () => {
    for (const f of [
      "kernel/mod.ts",
      "runtime/mod.ts",
      "runtime/test.ts",
      "package.json",
      "bun.lock",
      "bunfig.toml",
      "tsconfig.json",
      "tsconfig.kernel.json",
      "about.ts",
      "node/register.mjs",
    ]) {
      assert(statSync(join(ROOT, f)).isFile, f);
    }
    const mod = await readTextFile(join(ROOT, "runtime", "mod.ts"));
    assert(!specifiers(mod).some((s) => s.includes("test")), "runtime/mod.ts re-exports test.ts");
    assert(!specifiers(await readTextFile(join(ROOT, "kernel", "mod.ts"))).some((s) => s.includes("runtime")));
  },
);
