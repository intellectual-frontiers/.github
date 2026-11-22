/**
 * `repoctl usage` (commons repoctl 0014-repoctl-usage): the imports of a consumer read from its files, the graph of the installed package read from its sources, and the answer: the libraries imported directly, those reached through them and those never touched, with their sizes.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { VERBS, verbIds } from "@intellectual-frontiers/repoctl/governance";
import { consumerImports, libraryImports, usageOf, usageText, type PackageLibrary, type World } from "@intellectual-frontiers/repoctl/logical";
import { execute, hostOf } from "./world.ts";

const PKG = "@intellectual-frontiers/commons";

proves(["0014-repoctl-usage FR-001"], "the libraries a file imports are read with their subpaths; the bare package, a string that is no import of a library and another package are left out", () => {
  const text = [
    `import { ok } from "${PKG}/core";`,
    `import { sha256 } from '${PKG}/crypto/sha256';`,
    `const lazy = await import("${PKG}/docs/lens/repo-ops");`,
    `import x from "${PKG}";`,
    `import y from "@other/commons/core";`,
    "const s = `${PKG}/none`;",
  ].join("\n");
  assertEquals(consumerImports(text, "a.ts", PKG), [
    { library: "core", subpath: undefined, file: "a.ts" },
    { library: "crypto", subpath: "sha256", file: "a.ts" },
    { library: "docs", subpath: "lens/repo-ops", file: "a.ts" },
  ]);
});

proves(["0014-repoctl-usage FR-002"], "the libraries a source imports are read as the package writes them and as a library of the repository writes them, and never the library itself or a name the package does not hold", () => {
  const known = new Set(["core", "crypto", "grc"]);
  const text = `import { a } from "${PKG}/core";\nimport { b } from "@intellectual-frontiers/crypto/sha256";\nimport { c } from "@intellectual-frontiers/grc";\nimport { d } from "@intellectual-frontiers/nowhere";`;
  assertEquals(libraryImports(text, "grc", PKG, known), ["core", "crypto"]);
});

const graph: readonly PackageLibrary[] = [
  { name: "core", imports: [], files: 3, bytes: 100 },
  { name: "crypto", imports: ["core"], files: 2, bytes: 200 },
  { name: "grc", imports: ["crypto", "core"], files: 5, bytes: 400 },
  { name: "lab", imports: ["core"], files: 1, bytes: 50 },
  { name: "unused", imports: [], files: 1, bytes: 25 },
];

proves(["0014-repoctl-usage FR-003", "0014-repoctl-usage FR-004"], "the libraries are the imported ones, the reached ones with the library through which each is reached first, and the ones never touched, with their bytes, the same for the same inputs; a library the package does not hold is a finding and is not counted", () => {
  const imports = [
    { library: "grc", subpath: undefined, file: "b.ts" },
    { library: "grc", subpath: "governance", file: "a.ts" },
    { library: "lab", subpath: undefined, file: "a.ts" },
    { library: "ghost", subpath: undefined, file: "a.ts" },
  ];
  const r = usageOf(PKG, imports, graph);
  assertEquals(r.libraries, 5);
  assertEquals(r.bytes, 775);
  assertEquals(r.direct, [{ library: "grc", subpaths: ["governance"], files: 2, bytes: 400 }, { library: "lab", subpaths: [], files: 1, bytes: 50 }]);
  assertEquals(r.reached, [{ library: "core", via: "grc", bytes: 100 }, { library: "crypto", via: "grc", bytes: 200 }]);
  assertEquals(r.untouched, [{ library: "unused", bytes: 25 }]);
  assertEquals(r.totals, { direct: { libraries: 2, bytes: 450 }, reached: { libraries: 2, bytes: 300 }, untouched: { libraries: 1, bytes: 25 } });
  assertEquals(r.unknown, ["ghost"]);
  assertEquals(usageOf(PKG, [...imports].reverse(), [...graph].reverse()), r, "the order of the inputs does not change the answer");
  assertStringIncludes(usageText(r), "never touched: 1 of 5 libraries");
});

const FILES = new Map<string, string>([
  ["/repo/package.json", "{}"],
  ["/repo/app/main.ts", `import { grc } from "${PKG}/grc";\nimport { ghost } from "${PKG}/ghost";\n`],
  ["/repo/app/other.mjs", `import "${PKG}/lab/x";\n`],
  ["/repo/app/note.md", `import "${PKG}/unused";\n`],
  ["/repo/node_modules/@intellectual-frontiers/commons/package.json", "{}"],
  ["/repo/node_modules/@intellectual-frontiers/commons/core/src/mod.ts", "export const core = 1;\n"],
  ["/repo/node_modules/@intellectual-frontiers/commons/core/dist/src/mod.d.ts", "export declare const core = 1;\n"],
  ["/repo/node_modules/@intellectual-frontiers/commons/crypto/src/mod.ts", `import { core } from "${PKG}/core";\n`],
  ["/repo/node_modules/@intellectual-frontiers/commons/grc/src/mod.ts", `import { c } from "${PKG}/crypto";\n`],
  ["/repo/node_modules/@intellectual-frontiers/commons/lab/src/mod.ts", "export const lab = 1;\n"],
  ["/repo/node_modules/@intellectual-frontiers/commons/unused/src/mod.ts", "export const u = 1;\n"],
]);
const under = (dir: string): string[] => [...FILES.keys()].filter((p) => p.startsWith(`${dir}/`)).map((p) => p.slice(dir.length + 1));
const world = (files: ReadonlyMap<string, string>): World => ({
  repo: "/repo",
  process: { run: () => Promise.resolve({ code: 0, stdout: "", stderr: "" }) },
  files: {
    read: (p) => Promise.resolve(files.get(p)),
    write: () => Promise.resolve(),
    remove: () => Promise.resolve(),
    exists: (p) => Promise.resolve(files.has(p) || [...files.keys()].some((k) => k.startsWith(`${p}/`))),
    list: (dir) => Promise.resolve([...new Set([...files.keys()].filter((p) => p.startsWith(`${dir}/`)).map((p) => p.slice(dir.length + 1).split("/")[0] ?? ""))].sort()),
    walk: (dir) => Promise.resolve([...files.keys()].filter((p) => p.startsWith(`${dir}/`)).map((p) => p.slice(dir.length + 1)).filter((p) => !p.startsWith("node_modules/")).sort()),
    makeTemp: () => Promise.resolve("/tmp/x"),
    removeTree: () => Promise.resolve(),
  },
  registry: { view: () => Promise.resolve(ok("absent")) },
  credentials: { npmToken: () => undefined },
  libraries: { list: () => Promise.resolve(err("no libraries")) },
  docs: { load: () => Promise.resolve(err("no docs")) },
});
void under;

proves(["0014-repoctl-usage FR-005", "0014-repoctl-usage FR-002", "0014-repoctl-usage FR-004"], "the verb is declared once, public and read-only, reads the consumer's code files and the installed package, answers as a table and as JSON, names an import the package does not hold, and ends with an environment problem where the package is not installed", async () => {
  assert(verbIds().includes("usage") && VERBS["usage"].effect === "read" && VERBS["usage"].tier === "public");
  const host = hostOf(world(FILES), { config: { capabilities: { query: false }, libraries: { folder: "commons" } } });
  const table = await execute(host, ["usage"]);
  assertEquals(table.code, 0, table.err + table.out);
  assertStringIncludes(table.out, "imported directly: 2 of 5 libraries");
  assertStringIncludes(table.out, "reached through those: 2 of 5 libraries");
  assertStringIncludes(table.out, "never touched: 1 of 5 libraries");
  assert(table.out.includes("unused") && !table.out.includes("ghost  "), "an import in a Markdown file is not read");
  const json = await execute(host, ["usage", "--json"]);
  const doc = JSON.parse(json.out) as { data?: { reached: { library: string; via: string }[]; unknown: string[]; direct: { library: string }[] } };
  assertEquals(doc.data?.direct.map((d) => d.library), ["grc", "lab"]);
  assertEquals(doc.data?.reached.map((d) => `${d.library}<${d.via}`), ["core<grc", "crypto<grc"]);
  assertEquals(doc.data?.unknown, ["ghost"]);
  const none = await execute(hostOf(world(new Map([["/repo/app/main.ts", "export {};\n"]])), { config: { capabilities: { query: false }, libraries: { folder: "commons" } } }), ["usage"]);
  assertEquals(none.code, 3, "the package is not installed");
  assertStringIncludes(none.out + none.err, "--package");
});
