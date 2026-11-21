/**
 * Tests of the boundaries of the library (commons mizan 0001-harness FR-007): the modules import only `node:process` and `node:url`, `core`, `crypto`, `formats`, `githost`, `ontology`, `rdf` and `system`, by package name, or the library's own modules.
 *
 * @module
 */
import { readDirSync, readTextFileSync } from "@intellectual-frontiers/system/fs";
import { dirname, fromFileUrl, join, resolve } from "@intellectual-frontiers/system/path";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";

const SRC = join(resolve(dirname(fromFileUrl(import.meta.url)), ".."), "src");

/** The files of a folder below `dir`, with their paths from `dir`, in order. */
function files(dir: string, below = ""): string[] {
  const out: string[] = [];
  for (const e of readDirSync(join(dir, below)).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const rel = below === "" ? e.name : `${below}/${e.name}`;
    if (e.isDirectory) out.push(...files(dir, rel));
    else if (e.isFile && e.name.endsWith(".ts")) out.push(rel);
  }
  return out;
}

/** The module specifiers a file imports or re-exports from, outside its documentation blocks. */
function specifiers(file: string): string[] {
  const text = readTextFileSync(join(SRC, file)).replace(/\/\*[\s\S]*?\*\//g, "");
  return [...text.matchAll(/(?:from|import)\s*\(?\s*"([^"]+)"/g)].map((m) => m[1] ?? "").filter((x) => /^(\.|@|node:)/.test(x));
}

/** The module of the questions in SQL, which may also name the SQL language library (0002-mizan-query FR-005). */
const QUERY_MODULES: readonly string[] = ["query.ts"];

const ALLOWED = (s: string, file = ""): boolean =>
  s.startsWith(".") ||
  (QUERY_MODULES.includes(file) && /^@intellectual-frontiers\/lang-sql\/aide\/(catalog|guard|relational|text)$/.test(s)) ||
  s === "node:process" ||
  s === "node:url" ||
  /^@intellectual-frontiers\/(core|crypto|formats|githost|ontology|rdf|system)(\/|$)/.test(s);

proves(
  ["0001-harness FR-007"],
  "the modules import only node:process and node:url, core, crypto, formats, githost, ontology, rdf and system",
  () => {
    const all = files(SRC);
    assert(all.length >= 30, `the modules of the library are there: ${all.length}`);
    for (const f of all) {
      const bad = specifiers(f).filter((s) => !ALLOWED(s, f));
      assertEquals(bad, [], `${f} imports only node: process and url, core, crypto, formats, githost, ontology, rdf and system`);
    }
  },
);

proves(
  ["0019-mizan-integrations FR-001"],
  "the integrations module has a pure layer that imports only the foundation libraries and itself, and a host layer",
  () => {
    const pure = files(SRC, "integrations/pure");
    assert(pure.length >= 3, `the pure layer: ${pure.length}`);
    assert(files(SRC, "integrations/host").length >= 1, "the host layer is there");
    for (const f of pure) {
      const bad = specifiers(f).filter((s) => !(s.startsWith(".") || /^@intellectual-frontiers\/(core|crypto|formats|rdf)(\/|$)/.test(s)));
      assertEquals(bad, [], `${f} imports only core, crypto, formats and rdf, and its own layer`);
    }
  },
);
