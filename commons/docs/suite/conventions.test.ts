/**
 * The conventions of the generator (commons 0011-documentation FR-001, FR-002, FR-004, FR-026): a package of the root package's name
 * whose dependencies are TypeScript, Shiki and beautiful-mermaid, pinned exactly and the root's, imported by
 * nothing outside it but commons' configuration, importing only what it may, whose entry points reach no library it shows, held to IFC
 * TypeScript's rules, and a commons with no README.
 *
 * @module
 */
import { fs, path } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { ROOT } from "./helpers.ts";

const DOCS = path.join(ROOT, "commons/docs");

/** The TypeScript files under a folder, from the checkout's root, leaving out `node_modules`. */
function sources(dir: string): string[] {
  const out: string[] = [];
  for (const e of [...fs.readDirSync(path.join(ROOT, dir))].sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory && e.name !== "node_modules" && e.name !== "dist") out.push(...sources(rel));
    else if (e.isFile && e.name.endsWith(".ts")) out.push(rel);
  }
  return out;
}
const read = (rel: string): string => fs.readTextFileSync(path.join(ROOT, rel));
const code = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "").replace(/`(?:\\.|[^`\\])*`/g, "``").replace(/"(?:\\.|[^"\\\n])*"/g, '""');
const specifiers = (text: string): string[] => [...text.matchAll(/^\s*(?:import|export)\b[^;]*?\bfrom\s+"([^"]+)"/gm)].map((m) => m[1] ?? "");
const mine = sources("commons/docs");

/** A field of a value read from JSON. */
const fieldOf = (v: unknown, key: string): unknown => (typeof v === "object" && v !== null ? Object.entries(v).find(([k]) => k === key)?.[1] : undefined);

/** The entries of a field of `package.json` that is an object of strings. */
function entries(pkg: unknown, field: string): [string, string][] {
  const v = fieldOf(pkg, field);
  assert(typeof v === "object" && v !== null, `package.json has ${field}`);
  return Object.entries(v).map(([k, x]) => [k, String(x)]);
}

proves(["0011-documentation FR-001"], "the package's name, exports and command, TypeScript 7.1.0-beta, Shiki and the diagram renderer pinned exactly and the root's", () => {
  const pkg: unknown = JSON.parse(read("commons/docs/package.json"));
  const root: unknown = JSON.parse(read("package.json"));
  assertEquals(fieldOf(pkg, "name"), "@intellectual-frontiers/docs");
  assertEquals(fieldOf(pkg, "exports"), { ".": "./src/mod.ts", "./lens/layered": "./src/lens/layered.ts", "./lens/program": "./src/lens/program.ts", "./lens/guides": "./src/lens/guides.ts", "./lens/releases": "./src/lens/releases.ts", "./lens/repo-ops": "./src/lens/repo-ops.ts" });
  assertEquals(fieldOf(pkg, "bin"), { "ifc-docs": "./ifc-docs.mjs" });
  const deps = entries(pkg, "dependencies");
  const dev = entries(pkg, "devDependencies");
  assertEquals(deps.map(([n]) => n).sort(), ["beautiful-mermaid", "shiki", "typescript"]);
  assertEquals(dev.map(([n]) => n).sort(), ["@intellectual-frontiers/core", "@intellectual-frontiers/lang-sql", "@intellectual-frontiers/libraries", "@intellectual-frontiers/mizan", "@intellectual-frontiers/system", "@intellectual-frontiers/test", "@types/node"]);
  for (const [n, v] of dev) if (n.startsWith("@intellectual-frontiers/")) assertEquals(v, `link:../${n.split("/")[1]}`, `${n} is a link to its library`);
  for (const [n, v] of [...deps, ...dev]) if (!v.startsWith("link:")) assert(/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(v), `${n} is pinned exactly`);
  assert(deps.some(([n, v]) => n === "typescript" && v === "7.1.0-beta"));
  const rootDeps = new Map(entries(root, "dependencies"));
  for (const [n, v] of deps) assertEquals(rootDeps.get(n), v, `the root package depends on the generator's ${n} at the same version`);
  const lock = read("commons/docs/bun.lock");
  for (const [n, v] of [...deps, ...dev]) if (!v.startsWith("link:")) assert(lock.includes(`["${n}@${v}", "", `), `the lockfile holds ${n}@${v} and its integrity`);
});

proves(["0011-documentation FR-001"], "nothing outside commons/docs imports a file of it but commons' configuration", () => {
  const commonsFiles = [...fs.readDirSync(path.join(ROOT, "commons"))].filter((e) => e.isFile && e.name.endsWith(".ts") && e.name !== "docs.config.ts").map((e) => `commons/${e.name}`);
  for (const dir of ["commons/tools", "bin", "tests", ...commonsFiles]) {
    if (!fs.existsSync(path.join(ROOT, dir))) continue;
    for (const f of dir.endsWith(".ts") ? [dir] : sources(dir)) {
      for (const s of specifiers(read(f))) {
        const target = path.resolve(path.dirname(path.join(ROOT, f)), s);
        assert(!target.startsWith(`${DOCS}${path.sep}`), `${f} imports ${s}`);
      }
    }
  }
});

const PACKAGES = new Set(["typescript/async", "beautiful-mermaid", "shiki/core", "shiki/wasm", "shiki/engine/oniguruma"]);
/** The grammars and themes of Shiki the highlighter imports one by one. */
const SHIKI_FILES = /^shiki\/(langs|themes)\/[a-z-]+\.mjs$/;
/** The libraries lifted out of IFC TypeScript, which the generator imports by package name (0032-libraries-by-concern FR-003). */
const LIFTED = /^@intellectual-frontiers\/(core(\/about)?|system|test)$|^@intellectual-frontiers\/(libraries\/(pack|distribution|ci\/(findings|policy|inventory))|mizan\/(trace|host\/trace)|lang-sql\/(aide\/text|dialects\/postgres))$/;

proves(["0011-documentation FR-002"], "a file imports the generator and typescript/async; a lens also the libraries' entry points", () => {
  const lensMay = new Set(["docs/src/mod.ts"]);
  for (const f of mine) {
    const fixture = f.startsWith("commons/docs/suite/fixture-repo/");
    for (const s of specifiers(read(f))) {
      if (PACKAGES.has(s) || (f.startsWith("commons/docs/tools/") && s === "node:process") || SHIKI_FILES.test(s) || LIFTED.test(s) || (fixture && s === "@intellectual-frontiers/docs")) continue;
      assert(s.startsWith("."), `${f} imports ${s}`);
      const target = path.relative(path.join(ROOT, "commons"), path.resolve(path.dirname(path.join(ROOT, f)), s)).split(path.sep).join("/");
      if (f.startsWith("commons/docs/src/lens/")) assert(lensMay.has(target), `the lens ${f} imports ${s}, which it may not: a lens imports the generator through mod.ts`);
      else if (f.startsWith("commons/docs/suite/")) assert(target.startsWith("docs/") || lensMay.has(target) || target === "docs.config.ts", `${f} imports ${s}, which it may not`);
      else assert(target.startsWith("docs/") && !target.startsWith("docs/src/lens/"), `${f} imports ${s}, which it may not`);
    }
  }
});

/** Every file of commons/docs a file reaches by its relative imports, from the checkout's root, the file itself first. */
function reached(from: string): string[] {
  const seen = new Set<string>();
  const walk = (f: string): void => {
    if (seen.has(f) || !f.startsWith("commons/docs/") || !f.endsWith(".ts")) return;
    seen.add(f);
    for (const s of specifiers(read(f)))
      if (s.startsWith(".")) walk(path.relative(ROOT, path.resolve(path.dirname(path.join(ROOT, f)), s)).split(path.sep).join("/"));
  };
  walk(from);
  return [...seen];
}

proves(["0011-documentation FR-026"], "the package depends on no library it shows: what ./docs and ifc-docs reach imports no data library and no lens", () => {
  const bin = read("commons/docs/ifc-docs.mjs");
  assert(bin.includes('from "./src/cli.ts"'), "ifc-docs runs cli.ts");
  const files = new Set([...reached("commons/docs/src/mod.ts"), ...reached("commons/docs/src/cli.ts")]);
  assert(files.has("commons/docs/src/config.ts") && files.has("commons/docs/src/site.ts"));
  for (const f of files) {
    assert(!f.startsWith("commons/docs/src/lens/") && !f.startsWith("commons/docs/suite/") && !f.startsWith("commons/docs/tools/"), `${f} is reached from an entry point`);
    for (const s of specifiers(read(f))) assert(!/(^|\/)data\/|lens\//.test(s), `${f}, which an entry point reaches, imports ${s}`);
  }
});

proves(["0011-documentation FR-002"], "@module on every file, TSDoc on every export, no any and no non-null assertion", () => {
  for (const f of mine) {
    const text = read(f);
    assert(/^(?:#![^\n]*\n)?(?:\/\/[^\n]*\n)*\/\*\*[\s\S]*?@module[\s\S]*?\*\//.test(text), `${f}: no @module block at its top`);
    const lines = text.split("\n");
    lines.forEach((line, i) => {
      if (!/^export\s+(?:async\s+)?(?:const|function|type\s+\w|interface|class)\b/.test(line)) return;
      assert((lines[i - 1] ?? "").trimEnd().endsWith("*/"), `${f}:${i + 1}: an export with no TSDoc`);
    });
    const c = code(text);
    assert(!/(?::|<|\bas|,|\|)\s*any\b/.test(c), `${f}: any`);
    assert(!/[\w\])]!(?:\.|\[|\)|,|;)/.test(c), `${f}: non-null assertion`);
  }
});

proves(["0011-documentation FR-004"], "commons keeps no README", () => {
  const readmes = (dir: string): string[] =>
    [...fs.readDirSync(path.join(ROOT, dir))].flatMap((e) => {
      if (e.name === "node_modules" || e.name === "suite" || e.name === "dist") return [];
      const rel = `${dir}/${e.name}`;
      return e.isDirectory ? readmes(rel) : e.name.toLowerCase() === "readme.md" ? [rel] : [];
    });
  // a library's own README is the page its package shows (commons/<library>/README.md); no other folder keeps one
  const own = (r: string): boolean => /^commons\/[a-z-]+\/README\.md$/.test(r) && fs.existsSync(path.join(ROOT, r.replace(/README\.md$/, "package.json")));
  // and the walk-through of an acceptance kit (0027-commons-libraries FR-025): commons/<library>/<acceptance|oat|uat|aat>/[<kit>/]README.md
  const kit = (r: string): boolean => /^commons\/[a-z-]+\/(acceptance|oat|uat|aat)\/([a-z0-9-]+\/)?README\.md$/.test(r);
  assertEquals(readmes("commons").filter((r) => !r.includes("/tree/") && !r.includes("/fixtures/") && !own(r) && !kit(r)), []);
});
