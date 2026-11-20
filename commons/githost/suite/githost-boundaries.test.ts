/**
 * Tests of the boundaries of the library (commons githost 0001-githost FR-009): the types, the table of capabilities and the reader of a remote import `core` alone, and the adapters import only `node:`
 * built-ins, `core`, `net` and `system`, by package name or from the library's own modules.
 *
 * @module
 */
import { readDirSync, readTextFileSync } from "@intellectual-frontiers/system/fs";
import { dirname, fromFileUrl, join, resolve } from "@intellectual-frontiers/system/path";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";

const SRC = join(resolve(dirname(fromFileUrl(import.meta.url)), ".."), "src");

/** The module specifiers a file imports or re-exports from, outside its documentation blocks. */
function specifiers(file: string): string[] {
  const text = readTextFileSync(join(SRC, file)).replace(/\/\*[\s\S]*?\*\//g, "");
  return [...text.matchAll(/(?:from|import)\s*\(?\s*"([^"]+)"/g)].map((m) => m[1] ?? "");
}

const PURE = ["types.ts", "capabilities.ts", "remote.ts"];
const CORE = "@intellectual-frontiers/core";
const ALLOWED = (s: string): boolean =>
  s.startsWith("./") ||
  s.startsWith("node:") ||
  s === CORE ||
  s === "@intellectual-frontiers/net/http-client" ||
  s === "@intellectual-frontiers/net/serve" ||
  s.startsWith("@intellectual-frontiers/system/");

proves(
  ["0001-githost FR-009"],
  "the types, the table of capabilities and the reader of a remote import core alone, and the adapters import only node: built-ins, core, net and system",
  () => {
    const files = readDirSync(SRC)
      .filter((e) => e.isFile && e.name.endsWith(".ts"))
      .map((e) => e.name);
    assert(files.length >= 8, `the modules of the library are there: ${files.join(", ")}`);
    for (const f of PURE) {
      const outside = specifiers(f).filter((s) => !s.startsWith("./") && s !== CORE);
      assertEquals(outside, [], `${f} imports core alone`);
      const sideways = specifiers(f).filter((s) => s.startsWith("./") && !PURE.includes(`${s.slice(2).replace(/\.ts$/, "")}.ts`));
      assertEquals(sideways, [], `${f} imports only the pure modules of the library`);
    }
    for (const f of files) {
      const bad = specifiers(f).filter((s) => !ALLOWED(s));
      assertEquals(bad, [], `${f} imports only node: built-ins, core, net and system`);
    }
  },
);
