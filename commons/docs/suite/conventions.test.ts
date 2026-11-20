/**
 * The conventions of the generator (commons 0011-documentation FR-001, FR-002, FR-004, FR-026): a package of the root package's name
 * whose dependencies are TypeScript and Mermaid, pinned exactly and the root's, that imports IFC TypeScript by relative path, imported by
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

proves(["0011-documentation FR-001"], "the root package's name and ./docs, TypeScript 7.1.0-beta and Mermaid pinned exactly and the root's, no IFC TypeScript", () => {
  const pkg: unknown = JSON.parse(read("commons/docs/package.json"));
  const root: unknown = JSON.parse(read("package.json"));
  assertEquals(fieldOf(pkg, "name"), "@intellectual-frontiers/commons");
  assertEquals(fieldOf(pkg, "exports"), { "./docs": "./mod.ts" });
  const deps = entries(pkg, "dependencies");
  const dev = entries(pkg, "devDependencies");
  assertEquals(deps.map(([n]) => n).sort(), ["mermaid", "typescript"]);
  assertEquals(dev.map(([n]) => n).sort(), ["@types/node"]);
  for (const [n, v] of [...deps, ...dev]) assert(/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(v), `${n} is pinned exactly`);
  assert(deps.some(([n, v]) => n === "typescript" && v === "7.1.0-beta"));
  assertEquals(entries(root, "dependencies"), deps, "the root package's dependencies are the generator's");
  const lock = read("commons/docs/bun.lock");
  for (const [n, v] of [...deps, ...dev]) assert(lock.includes(`["${n}@${v}", "", `), `the lockfile holds ${n}@${v} and its integrity`);
});

proves(["0011-documentation FR-001"], "nothing outside commons/docs imports a file of it but commons' configuration", () => {
  const commonsFiles = [...fs.readDirSync(path.join(ROOT, "commons"))].filter((e) => e.isFile && e.name.endsWith(".ts") && e.name !== "docs.config.ts").map((e) => `commons/${e.name}`);
  for (const dir of ["commons/ts", "commons/tools", "bin", "tests", ...commonsFiles]) {
    if (!fs.existsSync(path.join(ROOT, dir))) continue;
    for (const f of dir.endsWith(".ts") ? [dir] : sources(dir)) {
      for (const s of specifiers(read(f))) {
        const target = path.resolve(path.dirname(path.join(ROOT, f)), s);
        assert(!target.startsWith(`${DOCS}${path.sep}`), `${f} imports ${s}`);
      }
    }
  }
});

const PACKAGES = new Set(["typescript/async"]);
const IFC_TS = new Set(["ts/kernel/mod.ts", "ts/runtime/mod.ts", "ts/runtime/test.ts"]);

proves(["0011-documentation FR-002"], "a file imports the generator, IFC TypeScript by relative path and typescript/async; a lens also the libraries' entry points", () => {
  const lensMay = new Set(["docs/mod.ts"]);
  for (const f of mine) {
    const fixture = f.startsWith("commons/docs/suite/fixture-repo/");
    for (const s of specifiers(read(f))) {
      if (PACKAGES.has(s) || (fixture && s === "@intellectual-frontiers/commons/docs")) continue;
      assert(s.startsWith("."), `${f} imports ${s}`);
      const target = path.relative(path.join(ROOT, "commons"), path.resolve(path.dirname(path.join(ROOT, f)), s)).split(path.sep).join("/");
      if (IFC_TS.has(target) && (target !== "ts/runtime/test.ts" || f.startsWith("commons/docs/suite/"))) continue;
      if (f.startsWith("commons/docs/lens/")) assert(lensMay.has(target), `the lens ${f} imports ${s}, which it may not: a lens imports the generator through mod.ts`);
      else if (f.startsWith("commons/docs/suite/")) assert(target.startsWith("docs/") || lensMay.has(target) || target === "docs.config.ts", `${f} imports ${s}, which it may not`);
      else assert(target.startsWith("docs/") && !target.startsWith("docs/lens/"), `${f} imports ${s}, which it may not`);
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
  assert(bin.includes('import("./cli.ts")'), "ifc-docs runs cli.ts");
  const files = new Set([...reached("commons/docs/mod.ts"), ...reached("commons/docs/cli.ts")]);
  assert(files.has("commons/docs/config.ts") && files.has("commons/docs/site.ts"));
  for (const f of files) {
    assert(!f.startsWith("commons/docs/lens/") && !f.startsWith("commons/docs/suite/") && !f.startsWith("commons/docs/tools/"), `${f} is reached from an entry point`);
    for (const s of specifiers(read(f))) assert(!/(^|\/)data\/|lens\//.test(s), `${f}, which an entry point reaches, imports ${s}`);
  }
});

proves(["0011-documentation FR-002"], "@module on every file, TSDoc on every export, no any and no non-null assertion", () => {
  for (const f of mine) {
    const text = read(f);
    assert(/^(?:#![^\n]*\n)?\/\*\*[\s\S]*?@module[\s\S]*?\*\//.test(text), `${f}: no @module block at its top`);
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
  assertEquals(readmes("commons").filter((r) => !r.includes("/tree/") && !r.includes("/fixtures/")), []);
});
