// Spec: 0001-layers FR-004, FR-005, FR-008, FR-009, FR-010, FR-011; 0002-engine FR-001
/**
 * The layers check of the library (commons data 0001-layers): the real tree has no finding of it, and each rule is broken in files made for the purpose and named. The
 * check reads text, so no file is written; the real tree is read with the runtime's own reader.
 *
 * @module
 */
import { fs, path } from "@intellectual-frontiers/system";
import * as runtime from "@intellectual-frontiers/mizan/host/trace";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { CORE, KERNEL, layerFindings, PACKAGE, specifiersOf, unitOf } from "../tools/layers.ts";
import { main } from "../tools/check.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");
const EXPORTS = {
  "./engine": "./engine/api.ts",
  "./governance": "./governance/api.ts",
  "./sql/logical": "./sql/logical/api.ts",
  "./sql/physical": "./sql/physical/api.ts",
} as const;
const ENGINE = `${PACKAGE}/engine`;
const GOVERNANCE = `${PACKAGE}/governance`;
const LOGICAL = `${PACKAGE}/sql/logical`;
const PHYSICAL = `${PACKAGE}/sql/physical`;

/** The rules of the findings of one file that imports the given specifiers. */
const rules = (file: string, ...imports: readonly string[]): readonly string[] =>
  layerFindings([{ path: file, text: imports.map((s) => `import "${s}";`).join("\n") }], EXPORTS).map((f) => f.rule);

const realFiles = (): ReturnType<typeof runtime.readSources> =>
  runtime.readSources(ROOT, ["about.ts", "engine", "governance", "models", "extensions", "sql", "tools", "examples", "suite"]);

proves(
  ["0001-layers FR-004", "0001-layers FR-011"],
  "the real tree has no finding of the layers check, and verify runs the check against its baseline",
  async () => {
    const real = JSON.parse(await fs.readTextFile(path.join(ROOT, "package.json"))) as { exports: Record<string, string> };
    assertEquals(layerFindings(await realFiles(), real.exports), []);
    const r = await main([]);
    assertEquals(r.code, 0, r.lines.join("\n"));
    const pkg = JSON.parse(await fs.readTextFile(path.join(ROOT, "package.json"))) as { scripts: Record<string, string> };
    assert(pkg.scripts["verify"]?.includes("tools/check.ts"), "verify does not run tools/check.ts");
  },
);

proves(["0001-layers FR-004"], "an import that climbs is layers/above, and one that reaches around is layers/around", () => {
  assertEquals(rules("governance/x.ts", LOGICAL), ["layers/above"]);
  assertEquals(rules("sql/logical/x.ts", PHYSICAL), ["layers/above"]);
  assertEquals(rules("engine/x.ts", GOVERNANCE), ["layers/above"]);
  assertEquals(rules("extensions/a/x.ts", PHYSICAL), ["layers/around"]);
  assertEquals(rules("models/arca/x.ts", PHYSICAL), ["layers/around"]);
  assertEquals(rules("extensions/a/x.ts", LOGICAL), ["layers/around"]);
  assertEquals(rules("sql/extensions/a/x.ts", PHYSICAL, LOGICAL, GOVERNANCE, ENGINE), []);
  assertEquals(rules("sql/dialects/postgres/x.ts", PHYSICAL), []);
  assertEquals(rules("sql/physical/x.ts", LOGICAL, GOVERNANCE, ENGINE), []);
  assertEquals(rules("sql/logical/x.ts", GOVERNANCE, ENGINE), []);
  assertEquals(rules("governance/x.ts", ENGINE), []);
});

proves(
  ["0001-layers FR-004"],
  "an extension does not import another unit of its own class, and a suite and the command line import what they need",
  () => {
    const SQL_EXT = `${PACKAGE}/sql/extensions/b`;
    const files = [
      { path: "sql/extensions/a/x.ts", text: `import "${SQL_EXT}";\n` },
      { path: "suite/x.ts", text: `import "${GOVERNANCE}";\nimport "${PHYSICAL}";\n` },
      { path: "sql/cli/x.ts", text: `import "${PHYSICAL}";\nimport "${SQL_EXT}";\n` },
    ];
    const exportsMap = { ...EXPORTS, "./sql/extensions/b": "./sql/extensions/b/mod.ts" };
    assertEquals(
      layerFindings(files, exportsMap).map((f) => `${f.file} ${f.rule}`),
      ["sql/extensions/a/x.ts layers/around"],
    );
  },
);

proves(
  ["0001-layers FR-005", "0002-engine FR-001"],
  "the lower layers import only the kernel and the package, and a driver, a host module or another package is layers/external",
  () => {
    assertEquals(rules("sql/physical/x.ts", "pg"), ["layers/external"]);
    assertEquals(rules("sql/physical/x.ts", "node:fs"), ["layers/external"]);
    assertEquals(rules("governance/x.ts", "zod"), ["layers/external"]);
    assertEquals(rules("engine/x.ts", "@intellectual-frontiers/commons/ts/runtime"), ["layers/external"]);
    assertEquals(rules("engine/x.ts", KERNEL), []);
    assertEquals(rules("sql/logical/x.ts", KERNEL, GOVERNANCE), []);
    assertEquals(rules("tools/x.ts", "node:fs", "@intellectual-frontiers/commons/ts/runtime"), []);
    assertEquals(rules("sql/dialects/duckdb/x.ts", "@duckdb/node-api"), []);
  },
);

proves(
  ["0002-engine FR-001"],
  "the engine of the real tree imports nothing of the library and only the kernel by package name",
  async () => {
    const engine = (await realFiles()).filter((f) => f.path.startsWith("engine/"));
    assert(engine.length > 0);
    for (const f of engine) {
      for (const { specifier } of specifiersOf(f.text)) {
        assert(specifier.startsWith("./") || specifier === KERNEL || specifier === CORE, `${f.path} imports ${specifier}`);
      }
    }
  },
);

proves(["0001-layers FR-008"], "every file of the real tree is in a unit, and a file in none is layers/unclassified", async () => {
  for (const f of await realFiles()) assert(unitOf(f.path) !== undefined, `${f.path} is in no unit`);
  assertEquals(rules("sql/other/x.ts"), ["layers/unclassified"]);
  assertEquals(rules("models/x.ts"), ["layers/unclassified"]);
  assertEquals(rules("misc/x.ts"), ["layers/unclassified"]);
  assertEquals(unitOf("models/arca/party.ts"), { name: "models/arca/", class: "model" });
  assertEquals(unitOf("about.ts"), { name: "(root)", class: "root" });
});

proves(
  ["0001-layers FR-009"],
  "the four layer entries of exports are the api.ts of their folders, and a subpath exports does not name is layers/private",
  async () => {
    const pkg = JSON.parse(await fs.readTextFile(path.join(ROOT, "package.json"))) as { exports: Record<string, string> };
    for (const [subpath, dir] of [
      ["./engine", "engine"],
      ["./governance", "governance"],
      ["./sql/logical", "sql/logical"],
      ["./sql/physical", "sql/physical"],
    ] as const) {
      assertEquals(pkg.exports[subpath], `./${dir}/api.ts`);
      assert(
        await fs.stat(path.join(ROOT, dir, "api.ts")).then(
          () => true,
          () => false,
        ),
        `${dir}/api.ts is not there`,
      );
    }
    assertEquals(rules("governance/x.ts", `${ENGINE}/internal`), ["layers/private"]);
    assertEquals(rules("governance/x.ts", `${PACKAGE}/nothing`), ["layers/private"]);
  },
);

proves(["0001-layers FR-010"], "a relative import into another unit is layers/relative, and one inside the unit is not", () => {
  assertEquals(rules("governance/x.ts", "../engine/api.ts"), ["layers/relative"]);
  assertEquals(rules("sql/logical/x.ts", "../physical/api.ts"), ["layers/relative"]);
  assertEquals(rules("models/arca/x.ts", "../other/y.ts"), ["layers/relative"]);
  assertEquals(rules("governance/x.ts", "./y.ts", "./deep/z.ts"), []);
  assertEquals(rules("models/arca/x.ts", "./party.ts"), []);
  assertEquals(rules("suite/x.ts", "../tools/layers.ts", "../engine/api.ts"), []);
  assertEquals(rules("tools/x.ts", "../governance/api.ts"), []);
});

proves(
  ["0001-layers FR-011"],
  "the check reads every form of import and no comment, and gives each finding a key that does not name its line",
  () => {
    const text = [
      'import { a } from "x1";',
      'import type { B } from "x2";',
      'export { c } from "x3";',
      'import "x4";',
      'const d = await import("x5");',
      "import {",
      "  e,",
      '} from "x6";',
      '// import "nope";',
      ' * import "nope2";',
    ].join("\n");
    assertEquals(
      specifiersOf(text).map((s) => s.specifier),
      ["x1", "x2", "x3", "x4", "x5", "x6"],
    );
    const [one] = layerFindings([{ path: "governance/x.ts", text: `\n\nimport "${LOGICAL}";\n` }], EXPORTS);
    assertEquals(one?.line, 3);
    assertEquals(one?.key, `layers/above governance/x.ts ${LOGICAL}`);
  },
);
