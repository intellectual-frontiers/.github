// Spec: 0001-docs FR-025
/**
 * Which tests exercise an export (docs 0001-docs FR-025): a test exercises what its file imports. `importedNames` reads the names a source file imports from its relative modules and from packages of the repository; `testsImporting`
 * gives the tests of the run whose files import a name, by package, each with its library. It says that a test imports an export, not that it calls it or checks what it returns, and the pages say so.
 *
 * @module
 */
import type { Build } from "./build.ts";
import type { TestResult } from "./evidence.ts";

const IMPORT = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+["']([^"']+)["']/g;

/** The names a file imports with `import { a, b as c, type D } from "..."` from a relative module or a package of the repository (`@intellectual-frontiers/...`), as they are exported (`b`, not `c`). */
export function importedNames(source: string): ReadonlySet<string> {
  const out = new Set<string>();
  for (const m of source.matchAll(IMPORT)) {
    const from = m[2] ?? "";
    if (!from.startsWith(".") && !from.startsWith("@intellectual-frontiers/")) continue;
    for (const part of (m[1] ?? "").split(",")) {
      const name = part.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0]?.trim();
      if (name !== undefined && name !== "") out.add(name);
    }
  }
  return out;
}

/** The tests of the run, each with the names its file imports (a file is read once). */
export function importIndex(b: Build): readonly { readonly test: TestResult; readonly library: string; readonly names: ReadonlySet<string> }[] {
  const cache = new Map<string, ReadonlySet<string>>();
  const namesOf = (file: string): ReadonlySet<string> => {
    let n = cache.get(file);
    if (n === undefined) {
      n = file !== "" && b.exists(file) ? importedNames(b.read(file)) : new Set<string>();
      cache.set(file, n);
    }
    return n;
  };
  return [...b.evidence.results.values()].flatMap((l) => l.tests.map((test) => ({ test, library: l.library, names: namesOf(test.file) })));
}

/** The tests of a package (the folder `dir`, from the root) whose files import a name: the head of a namespace's (`fs.readTextFile` is `fs`). Sorted by name. */
export function testsImporting(index: ReturnType<typeof importIndex>, dir: string, name: string): readonly { readonly test: TestResult; readonly library: string }[] {
  const head = name.split(".")[0] ?? name;
  const prefix = dir === "" ? "" : `${dir}/`;
  return index.filter((x) => x.test.file.startsWith(prefix) && x.names.has(head)).sort((a, c) => (a.test.name < c.test.name ? -1 : a.test.name > c.test.name ? 1 : 0));
}
