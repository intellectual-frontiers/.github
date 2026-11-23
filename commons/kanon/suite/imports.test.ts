/**
 * Tests of the import check of Kanon (commons kanon 0001-kanon-checker FR-002, FR-003, FR-004): a file is placed in a unit, imports are read as data, and each code of the check is found from a
 * table, some files and an `exports` map.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { decodeTable, importFindings, readModuleReferences, specifiersOf, type Table, unitOf } from "../src/mod.ts";

const PKG = "@intellectual-frontiers/x";
const RAW = {
  package: PKG,
  units: [
    { folder: "./", own: true },
    { folder: "src/governance/", layer: "governance", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }] },
    { folder: "src/logical/", layer: "logical" },
    { folder: "src/surfaces/", layer: "physical", instances: true },
    { folder: "src/models/", layer: "physical", instances: true, mayImport: ["src/models/"] },
    { folder: "suite/", own: true },
  ],
};
/** The table is parsed once, from the form a manifest gives. */
function parsed(raw: unknown): Table {
  const r = decodeTable(raw);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
}
const TABLE = parsed(RAW);
const EXPORTS: Record<string, string> = {
  ".": "./src/mod.ts",
  "./governance": "./src/governance/mod.ts",
  "./logical": "./src/logical/mod.ts",
  "./cli": "./src/surfaces/cli/mod.ts",
  "./a": "./src/models/a/mod.ts",
  "./b": "./src/models/b/mod.ts",
};
const at = (path: string, text: string) => ({ path, text });
const rules = (files: readonly { path: string; text: string }[]): string[] => importFindings(TABLE, files, EXPORTS).map((f) => f.rule);
/** A step up, written so that this file does not itself read as an import of a file outside the library. */
const UP = "../";

proves(
  ["0001-kanon-checker FR-002"],
  "a file is in the most specific unit, an instance in the unit of its folder, and none where no unit holds it",
  () => {
    assertEquals(unitOf(TABLE, "src/governance/a.ts")?.name, "src/governance/");
    assertEquals(unitOf(TABLE, "src/surfaces/cli/run.ts")?.name, "src/surfaces/cli/");
    assertEquals(unitOf(TABLE, "src/surfaces/loose.ts"), undefined);
    assertEquals(unitOf(TABLE, "about.ts")?.name, "./");
    assertEquals(unitOf(TABLE, "elsewhere/a.ts"), undefined);
  },
);

proves(
  ["0001-kanon-checker FR-003"],
  "static, side-effect, re-export and dynamic imports are read with their lines, and a comment is not",
  () => {
    const text = [
      '// import { a } from "./comment.ts";',
      'import { b } from "./b.ts";',
      'import "./side.ts";',
      'export { c } from "../c.ts";',
      'const d = await import("./d.ts");',
      "import {",
      "  e,",
      '} from "./e.ts";',
    ].join("\n");
    assertEquals(
      specifiersOf(text).map((s) => [s.line, s.specifier]),
      [
        [2, "./b.ts"],
        [3, "./side.ts"],
        [4, "../c.ts"],
        [5, "./d.ts"],
        [8, "./e.ts"],
      ],
    );
  },
);

proves(["0001-kanon-checker FR-003"], "imports follow TypeScript syntax and distinguish literal targets from computed targets", () => {
  const result = readModuleReferences([
    `const example = 'import("fake-string")';`,
    '/* import "fake-comment"; */',
    "import { x }",
    '  from "./multiline.ts";',
    'import "./setup.ts";',
    'export * from "./re-export.ts";',
    'import type { T } from "./types.ts";',
    'type C = typeof import("./type-query.ts");',
    'import Q = require("./equals.ts");',
    'await import(`./literal.ts`);',
    'await import(name);',
  ].join("\n"));
  assert(result.kind === "ok");
  assertEquals(result.value, [
    { kind: "static", line: 4, specifier: "./multiline.ts" },
    { kind: "side-effect", line: 5, specifier: "./setup.ts" },
    { kind: "re-export", line: 6, specifier: "./re-export.ts" },
    { kind: "type", line: 7, specifier: "./types.ts" },
    { kind: "type", line: 8, specifier: "./type-query.ts" },
    { kind: "static", line: 9, specifier: "./equals.ts" },
    { kind: "dynamic", line: 10, specifier: "./literal.ts" },
    { kind: "computed-dynamic", line: 11 },
  ]);
});

proves(["0001-kanon-checker FR-003", "0001-kanon-checker FR-004"], "multiline imports reach layer checks and a syntax error is a finding", () => {
  const file = "src/governance/a.ts";
  assertEquals(rules([at(file, `import { x }\n  from "${PKG}/logical";`)]), ["layers/above"]);
  const found = importFindings(TABLE, [at(file, "const ok = 1;\nconst broken = ;")], EXPORTS);
  assertEquals(found.map(({ rule, line }) => [rule, line]), [["layers/syntax", 2]]);
});

proves(["0001-kanon-checker FR-004"], "a file in no unit is layers/unclassified", () => {
  assertEquals(rules([at("src/surfaces/mcp.ts", "export const a = 1;\n")]), ["layers/unclassified"]);
});

proves(["0001-kanon-checker FR-004"], "a relative import of a file of another unit is layers/relative, and an own unit may", () => {
  assertEquals(rules([at("src/logical/a.ts", `import { x } from "${UP}surfaces/cli/run.ts";\n`)]), ["layers/relative"]);
  assertEquals(rules([at("suite/a.test.ts", `import { x } from "${UP}src/logical/a.ts";\n`)]), []);
  assertEquals(rules([at("src/logical/a.ts", 'import { x } from "./b.ts";\n')]), []);
});

proves(["0001-kanon-checker FR-004"], "an import of the package by a path exports does not name is layers/private", () => {
  assertEquals(rules([at("src/logical/a.ts", `import { x } from "${PKG}/hidden";\n`)]), ["layers/private"]);
});

proves(["0001-kanon-checker FR-004"], "an import of a unit below is layers/above, and of a unit above is allowed", () => {
  assertEquals(rules([at("src/governance/a.ts", `import { x } from "${PKG}/logical";\n`)]), ["layers/above"]);
  assertEquals(rules([at("src/logical/a.ts", `import { x } from "${PKG}/governance";\n`)]), []);
  assertEquals(rules([at("src/surfaces/cli/a.ts", `import { x } from "${PKG}/logical";\nimport { y } from "${PKG}/governance";\n`)]), []);
});

proves(["0001-kanon-checker FR-004"], "an import of another unit of the same layer that the row does not list is layers/around", () => {
  const found = importFindings(TABLE, [at("src/surfaces/cli/a.ts", `import { x } from "${PKG}/a";\n`)], EXPORTS);
  assertEquals(
    found.map((f) => f.rule),
    ["layers/around"],
  );
  assertEquals(found[0]?.key, `layers/around src/surfaces/cli/a.ts ${PKG}/a`);
});

proves(
  ["0001-kanon-checker FR-004"],
  "an import of a package the row does not allow is layers/external, and a row with no list allows any",
  () => {
    assertEquals(rules([at("src/governance/a.ts", 'import { x } from "@intellectual-frontiers/system";\n')]), ["layers/external"]);
    assertEquals(rules([at("src/governance/a.ts", 'import { x } from "@intellectual-frontiers/core";\n')]), []);
    assertEquals(rules([at("src/logical/a.ts", 'import { x } from "@intellectual-frontiers/system";\n')]), []);
  },
);

proves(["0001-kanon-checker FR-004"], "a loop among instances of one class is layers/cycle, once, at the import that closes it", () => {
  const found = importFindings(
    TABLE,
    [at("src/models/a/x.ts", `import { y } from "${PKG}/b";\n`), at("src/models/b/y.ts", `import { x } from "${PKG}/a";\n`)],
    EXPORTS,
  );
  assertEquals(
    found.map((f) => f.rule),
    ["layers/cycle"],
  );
  assert(
    found[0]?.message.includes("src/models/a/ -> src/models/b/ -> src/models/a/") === true || found[0]?.message.includes("->") === true,
  );
});

proves(["0001-kanon-checker FR-004"], "the target of an exports entry may be an object of conditions", () => {
  const found = importFindings(TABLE, [at("src/governance/a.ts", `import { x } from "${PKG}/logical";\n`)], {
    "./logical": { types: "./dist/logical.d.ts", bun: "./src/logical/mod.ts" },
  });
  assertEquals(
    found.map((f) => f.rule),
    ["layers/above"],
  );
});

proves(["0001-kanon-checker FR-004"], "an allowlist cannot permit an upward dependency and same-layer unit cycles are reported", () => {
  const decoded = decodeTable({ package: PKG, units: [
    { folder: "src/governance/", layer: "governance", mayImport: ["src/a/"] },
    { folder: "src/a/", layer: "logical", mayImport: ["src/b/"] },
    { folder: "src/b/", layer: "logical", mayImport: ["src/a/"] },
  ] });
  assert(decoded.kind === "ok");
  const found = importFindings(decoded.value, [
    at("src/governance/mod.ts", `import "${PKG}/a";`),
    at("src/a/mod.ts", `import "${PKG}/b";`),
    at("src/b/mod.ts", `import "${PKG}/a";`),
  ], { "./a": "./src/a/mod.ts", "./b": "./src/b/mod.ts" });
  assertEquals(found.map((f) => f.rule), ["layers/above", "layers/cycle"]);
});
