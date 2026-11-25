/**
 * The shape of the SQL language core's folder (commons lang-sql 0001-sql-lang): its files import only each other by relative paths and `@intellectual-frontiers/core` by name, so that it can be moved out of this
 * library whole; the core does not import the dialects or the extensions and names no dialect but the base; a dialect imports the core and the dialects it extends; an extension imports the core alone; and the
 * rest of this library does not reach into it by a relative path.
 *
 * Spec: 0001-sql-lang FR-001, FR-002, FR-003
 *
 * @module
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LANG = join(ROOT, "src");

/** The `.ts` files under a folder, never entering `node_modules` (a library's own install links other libraries back into this checkout, a loop that a recursive listing would follow). */
const tsFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.isDirectory()) return e.name === "node_modules" ? [] : tsFiles(join(dir, e.name));
    return e.isFile() && e.name.endsWith(".ts") ? [join(dir, e.name)] : [];
  });

const specifiers = (text: string): string[] => {
  const out: string[] = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) continue;
    for (const m of line.matchAll(/^\s*(?:import|export)\b[^;'"]*?\bfrom\s*["']([^"']+)["']/g)) if (m[1] !== undefined) out.push(m[1]);
    for (const m of line.matchAll(/^\s*import\s*["']([^"']+)["']/g)) if (m[1] !== undefined) out.push(m[1]);
    for (const m of line.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)) if (m[1] !== undefined) out.push(m[1]);
  }
  return out;
};

/** Where a file is in the folder: the core, a dialect (with its name) or an extension (with its name). */
const placeOf = (file: string): { kind: "core" } | { kind: "dialect" | "extension"; name: string } => {
  const parts = relative(LANG, file).split(sep);
  if (parts.length === 1) return { kind: "core" };
  const [folder, name] = parts;
  if (folder === "dialects" && name !== undefined) return { kind: "dialect", name };
  if (folder === "extensions" && name !== undefined) return { kind: "extension", name };
  return { kind: "core" };
};

proves(
  ["0001-sql-lang FR-001"],
  "every file of src imports only files of src by relative paths and @intellectual-frontiers/core by name, and no node: module",
  () => {
    const files = tsFiles(LANG);
    assert(files.length >= 10, "the folder was found");
    for (const f of files) {
      for (const s of specifiers(readFileSync(f, "utf8"))) {
        if (s.startsWith("./") || s.startsWith("../")) {
          const target = resolve(dirname(f), s);
          assert(target.startsWith(LANG + sep), `${relative(ROOT, f)} imports ${s}, which is outside src`);
        } else assertEquals(s, "@intellectual-frontiers/core", `${relative(ROOT, f)} imports ${s}`);
      }
    }
  },
);

proves(
  ["0001-sql-lang FR-002"],
  "the core imports neither dialects nor extensions and names no dialect but the base; a dialect imports the core and its parent dialects; an extension imports the core alone",
  () => {
    for (const f of tsFiles(LANG)) {
      const here = placeOf(f);
      const text = readFileSync(f, "utf8");
      if (here.kind === "core" && relative(LANG, f).split(sep).length === 1) {
        for (const d of ["sqlite", "postgres", "duckdb"]) assert(!text.includes(`"${d}"`), `${relative(ROOT, f)} names ${d}`);
      }
      for (const s of specifiers(text)) {
        if (!s.startsWith(".")) continue;
        const there = placeOf(resolve(dirname(f), s));
        if (here.kind === "core") assertEquals(there.kind, "core", `${relative(ROOT, f)} imports ${s}`);
        else if (here.kind === "extension")
          assert(there.kind === "core" || (there.kind === "extension" && there.name === here.name), `${relative(ROOT, f)} imports ${s}`);
        else assert(there.kind === "core" || there.kind === "dialect", `${relative(ROOT, f)} imports ${s}`);
      }
    }
  },
);

proves(
  ["0001-sql-lang FR-003"],
  "the manifest exports the core, every dialect folder and every extension folder, and no other library of commons imports a file of this one by a relative path",
  () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { exports: Record<string, string> };
    assertEquals(pkg.exports["."], "./src/mod.ts");
    for (const kind of ["dialects", "extensions"]) {
      for (const e of readdirSync(join(LANG, kind), { withFileTypes: true })) {
        if (e.isDirectory()) assertEquals(pkg.exports[`./${kind}/${e.name}`], `./src/${kind}/${e.name}/mod.ts`, `${kind}/${e.name}`);
      }
    }
    const commons = resolve(ROOT, "..");
    const others = readdirSync(commons, { withFileTypes: true }).filter((e) => e.isDirectory() && e.name !== "lang-sql" && e.name !== "node_modules");
    assert(others.length > 10, "the other libraries were found");
    for (const lib of others) {
      for (const f of tsFiles(join(commons, lib.name))) {
        for (const s of specifiers(readFileSync(f, "utf8"))) {
          if (!s.startsWith(".")) continue;
          assert(!(resolve(dirname(f), s) + sep).startsWith(ROOT + sep), `${relative(commons, f)} imports ${s}`);
        }
      }
    }
  },
);
