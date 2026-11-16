/**
 * The conventions of the generator (commons 0011-documentation FR-001, FR-002, FR-004, FR-026): a package whose dependencies are IFC
 * TypeScript by its release tarball, TypeScript and Mermaid, pinned exactly, imported by nothing outside it but commons' configuration,
 * importing only what it may, depending on no library it shows, held to IFC TypeScript's rules, and a commons with no README.
 *
 * @module
 */
import { fs, path } from "@intellectual-frontiers/ifc-ts/runtime";
import { assert, assertEquals, proves } from "@intellectual-frontiers/ifc-ts/runtime/test";
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

/** IFC TypeScript's release tarball, by its tag. */
export const IFC_TS = "https://github.com/intellectual-frontiers/.github/releases/download/ifc-ts-v0.4.0/intellectual-frontiers-ifc-ts-0.4.0.tgz";

proves(["0011-documentation FR-001"], "IFC TypeScript by its release URL, TypeScript 7.1.0-beta and Mermaid, each pinned exactly", () => {
  const pkg: unknown = JSON.parse(read("commons/docs/package.json"));
  const deps = entries(pkg, "dependencies");
  const dev = entries(pkg, "devDependencies");
  assertEquals(deps.map(([n]) => n).sort(), ["@intellectual-frontiers/ifc-ts", "mermaid", "typescript"]);
  assertEquals(dev.map(([n]) => n).sort(), ["@types/node"]);
  for (const [n, v] of [...deps, ...dev]) {
    assert(/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(v) || (n === "@intellectual-frontiers/ifc-ts" && v === IFC_TS), `${n} is pinned exactly`);
  }
  assert(deps.some(([n, v]) => n === "typescript" && v === "7.1.0-beta"));
  assert(read("commons/docs/bun.lock").includes(`"@intellectual-frontiers/ifc-ts@${IFC_TS}", {}, "sha512-`), "the lockfile holds the tarball's integrity");
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

const PACKAGES = new Set(["@intellectual-frontiers/ifc-ts/kernel", "@intellectual-frontiers/ifc-ts/runtime", "@intellectual-frontiers/ifc-ts/runtime/test", "typescript/async"]);

proves(["0011-documentation FR-002"], "a file imports the generator, IFC TypeScript by its name and typescript/async; a lens also the libraries' entry points", () => {
  const lensMay = new Set(["docs/mod.ts", "ts/data/sql-aide/mod.ts", "ts/data/file-aide/mod.ts"]);
  for (const f of mine) {
    const fixture = f.startsWith("commons/docs/suite/fixture-repo/");
    for (const s of specifiers(read(f))) {
      if (PACKAGES.has(s) || (fixture && s === "@intellectual-frontiers/ifc-docs/config")) continue;
      assert(s.startsWith("."), `${f} imports ${s}`);
      const target = path.relative(path.join(ROOT, "commons"), path.resolve(path.dirname(path.join(ROOT, f)), s)).split(path.sep).join("/");
      if (f.startsWith("commons/docs/lens/")) assert(lensMay.has(target), `the lens ${f} imports ${s}, which it may not: a lens imports the generator through mod.ts`);
      else if (f.startsWith("commons/docs/suite/")) assert(target.startsWith("docs/") || lensMay.has(target) || target === "docs.config.ts", `${f} imports ${s}, which it may not`);
      else assert(target.startsWith("docs/") && !target.startsWith("docs/lens/"), `${f} imports ${s}, which it may not`);
    }
  }
});

proves(["0011-documentation FR-026"], "the release depends on no library it shows: lens/, the tests and the tools are left out of it, and what it builds imports no data library", () => {
  const build: unknown = JSON.parse(read("commons/docs/tsconfig.build.json"));
  const raw = fieldOf(build, "include");
  assert(Array.isArray(raw));
  const include = raw.map((x: unknown) => String(x));
  assertEquals(include.sort(), ["*.ts", "emit/**/*.ts", "extract/**/*.ts", "pages/**/*.ts"]);
  const shipped = mine.filter((f) => /^commons\/docs\/(?:[^/]+|(?:emit|extract|pages)\/.+)\.ts$/.test(f) && f !== "commons/docs/about.ts" && f !== "commons/docs/docs.config.ts");
  assert(shipped.includes("commons/docs/mod.ts") && shipped.includes("commons/docs/config.ts"));
  for (const f of shipped) for (const s of specifiers(read(f))) assert(!/(^|\/)data\/|lens\//.test(s), `${f}, which the release carries, imports ${s}`);
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
