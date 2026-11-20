/**
 * Tests of the boundaries of the library (commons ontology 0001-ontologies FR-003): the modules import only `core` and `rdf` by package name, or the library's own modules.
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

const ALLOWED = (s: string): boolean => s.startsWith(".") || /^@intellectual-frontiers\/(core|rdf)(\/|$)/.test(s);

proves(["0001-ontologies FR-003"], "the ontologies import only core and rdf and each other", () => {
  const all = files(SRC);
  assert(all.length >= 15, `the modules of the library are there: ${all.length}`);
  for (const f of all) {
    const bad = specifiers(f).filter((s) => !ALLOWED(s));
    assertEquals(bad, [], `${f} imports only core and rdf`);
  }
});
