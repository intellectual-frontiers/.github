/**
 * The conventions of the generator (commons 0011-documentation FR-001, FR-002, FR-004): a package with no dependencies and exact pins,
 * imported by nothing outside it, importing only what it may, held to IFC TypeScript's rules, and a commons with no README.
 *
 * @module
 */
import { fs, path } from "../../ts/runtime/mod.ts";
import { assert, assertEquals, proves } from "../../ts/runtime/test.ts";
import { ROOT } from "./helpers.ts";

const DOCS = path.join(ROOT, "commons/docs");

/** The TypeScript files under a folder, from the checkout's root, leaving out `node_modules`. */
function sources(dir: string): string[] {
  const out: string[] = [];
  for (const e of [...fs.readDirSync(path.join(ROOT, dir))].sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory && e.name !== "node_modules") out.push(...sources(rel));
    else if (e.isFile && e.name.endsWith(".ts")) out.push(rel);
  }
  return out;
}
const read = (rel: string): string => fs.readTextFileSync(path.join(ROOT, rel));
const code = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "").replace(/`(?:\\.|[^`\\])*`/g, "``").replace(/"(?:\\.|[^"\\\n])*"/g, '""');
const specifiers = (text: string): string[] => [...text.matchAll(/^\s*(?:import|export)\b[^;]*?\bfrom\s+"([^"]+)"/gm)].map((m) => m[1] ?? "");
const mine = sources("commons/docs");

proves(["0011-documentation FR-001"], "no dependencies, and every development dependency pinned exactly", () => {
  const pkg: unknown = JSON.parse(read("commons/docs/package.json"));
  assert(typeof pkg === "object" && pkg !== null && "devDependencies" in pkg && typeof pkg.devDependencies === "object" && pkg.devDependencies !== null);
  assertEquals("dependencies" in pkg, false);
  const dev = Object.entries(pkg.devDependencies);
  assertEquals(dev.map(([n]) => n).sort(), ["@types/node", "mermaid", "typescript"]);
  for (const [n, v] of dev) assert(typeof v === "string" && /^\d+\.\d+\.\d+(-[\w.]+)?$/.test(v), `${n} is pinned exactly`);
  assert(dev.some(([n, v]) => n === "typescript" && v === "7.1.0-beta"));
  assert(fs.existsSync(path.join(DOCS, "bun.lock")), "the lockfile holds the integrity of each");
});

proves(["0011-documentation FR-001"], "nothing outside commons/docs imports a file of it", () => {
  for (const dir of ["commons/ts", "commons/tools", "bin", "tests"]) {
    if (!fs.existsSync(path.join(ROOT, dir))) continue;
    for (const f of sources(dir)) {
      for (const s of specifiers(read(f))) {
        const target = path.resolve(path.dirname(path.join(ROOT, f)), s);
        assert(!target.startsWith(`${DOCS}${path.sep}`), `${f} imports ${s}`);
      }
    }
  }
});

proves(["0011-documentation FR-002"], "a file of the generator imports itself, the kernel, the runtime, the libraries' entry points and typescript/async", () => {
  const allowed = new Set(["ts/kernel/mod.ts", "ts/runtime/mod.ts", "ts/runtime/test.ts", "ts/data/sql-aide/mod.ts", "ts/data/file-aide/mod.ts"]);
  for (const f of mine) {
    for (const s of specifiers(read(f))) {
      if (s === "typescript/async") continue;
      assert(s.startsWith("."), `${f} imports ${s}`);
      const target = path.relative(path.join(ROOT, "commons"), path.resolve(path.dirname(path.join(ROOT, f)), s)).split(path.sep).join("/");
      assert(target.startsWith("docs/") || allowed.has(target), `${f} imports ${s}, which it may not`);
    }
  }
});

proves(["0011-documentation FR-002"], "@module on every file, TSDoc on every export, no any and no non-null assertion", () => {
  for (const f of mine) {
    const text = read(f);
    assert(/^\/\*\*[\s\S]*?@module[\s\S]*?\*\//.test(text), `${f}: no @module block at its top`);
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
      if (e.name === "node_modules" || e.name === "suite") return [];
      const rel = `${dir}/${e.name}`;
      return e.isDirectory ? readmes(rel) : e.name.toLowerCase() === "readme.md" ? [rel] : [];
    });
  assertEquals(readmes("commons").filter((r) => !r.includes("/tree/") && !r.includes("/fixtures/")), []);
});
