/**
 * Tests of the lint plugin of `lint/` (commons 0005-typescript-runtime FR-061): each rule against code it must refuse and code it must
 * accept, run by the real `bun lint` with the plugin loaded by `--plugin` (`lint/test-rule.ts`), its options from the rule's setting;
 * options that do not decode are reported; and a harness's own rule, made with `defineRule`, loaded from a plugin of its own.
 *
 * The names of the vendors' globals and of the registries are built from parts, so that this file does not itself name them.
 *
 * @module
 */
import plugin from "../../lint/plugin.ts";
import { type Rule } from "../../lint/rule.ts";
import { linter, lintFiles, type LintRun, type Problem } from "../../lint/test-rule.ts";
import { type Equal, expectType } from "@intellectual-frontiers/core";
import { makeTempDir, remove, writeTextFile } from "../../runtime/fs.ts";
import { join } from "../../runtime/path.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "../../runtime/test.ts";

const FR = "0005-typescript-runtime FR-061";
const ready = await linter();
const when = { skip: ready.kind === "err" ? ready.error : false };

const D = ["De", "no"].join("");
const B = ["Bu", "n"].join("");
const NPM = ["np", "m:"].join("");
const JSR = ["js", "r:"].join("");
const HTTPS = ["htt", "ps:"].join("");
const DOC = "/** A module. @module */\n";

/** The problems of a run, as `file:line rule`, or the linter's failure as an error. */
async function found(r: LintRun): Promise<readonly string[]> {
  const problems = await lintFiles(r);
  if (problems.kind === "err") throw new Error(problems.error);
  return problems.value.map((p: Problem) => `${p.file}:${p.line} ${p.rule}`);
}

proves([FR], "the plugin is in ESLint's format, named ifc, with the rules every harness wants", () => {
  assertEquals(plugin.meta.name, "ifc");
  assertEquals(Object.keys(plugin.rules).sort(), [
    "import-boundary",
    "module-doc",
    "no-registry-import",
    "no-vendor-api",
    "switch-absurd",
    "terminal-writers",
  ]);
  for (const rule of Object.values(plugin.rules)) {
    assertEquals(rule.meta.schema, false);
    assert(rule.meta.docs.description.length > 10);
    assertEquals(typeof rule.create, "function");
  }
  expectType<Equal<(typeof plugin.rules)[string], Rule>>();
});

proves(
  [FR],
  "no-vendor-api refuses a vendor's global in code and in types outside the files allowed with their reasons",
  async () => {
    const files = {
      "src/a.ts": `${DOC}export const t = await ${D}.readTextFile("x");\n`,
      "src/b.ts": `${DOC}export type K = ${D}.Kv | undefined;\n`,
      "src/c.ts": `${DOC}export const g = globalThis.${B};\nexport const w = globalThis.${B}.write;\n`,
      "src/host/d.ts": `${DOC}export const t = await ${D}.readTextFile("x");\n`,
      "src/e.ts": `${DOC}import { readFile } from "node:fs/promises";\nexport const t = await readFile("x", "utf8");\nexport const o = { ${D}: 1 }.${D};\n`,
    };
    const allow = [{ files: "src/host/**", reason: "the one module that wraps the vendor's API" }];
    assertEquals(await found({ rule: "no-vendor-api", options: { allow }, files }), [
      "src/a.ts:2 no-vendor-api",
      "src/b.ts:2 no-vendor-api",
      "src/c.ts:2 no-vendor-api",
      "src/c.ts:3 no-vendor-api",
    ]);
    assertEquals(await found({ rule: "no-vendor-api", options: { globals: ["Other"] }, files }), []);
  },
  when,
);

proves(
  [FR],
  "no-registry-import refuses npm:, jsr: and URL specifiers in every form of import; a bare name, node: and a relative path pass",
  async () => {
    const files = {
      "a.ts": `${DOC}import { x } from "${NPM}x@1";\nexport { x };\n`,
      "b.ts": `${DOC}export * from "${JSR}@std/path@1";\n`,
      "c.ts": `${DOC}export const m = await import("${HTTPS}//example.com/m.js");\n`,
      "d.ts": `${DOC}export type M = typeof import("${NPM}y");\n`,
      "e.ts": `${DOC}export { z } from "${JSR}@x/z";\n`,
      "f.ts": `${DOC}import { readFile } from "node:fs/promises";\nimport { y } from "./b.ts";\nimport x from "x";\nexport { readFile, x, y };\n`,
    };
    assertEquals(await found({ rule: "no-registry-import", files }), [
      "a.ts:2 no-registry-import",
      "b.ts:2 no-registry-import",
      "c.ts:2 no-registry-import",
      "d.ts:2 no-registry-import",
      "e.ts:2 no-registry-import",
    ]);
    assertEquals(await found({ rule: "no-registry-import", options: { prefixes: [JSR] }, files }), [
      "b.ts:2 no-registry-import",
      "e.ts:2 no-registry-import",
    ]);
  },
  when,
);

proves(
  [FR],
  "import-boundary refuses a relative import that leaves its package; one inside it, or from a file in no package, passes",
  async () => {
    const files = {
      "packages/a/src/x.ts": `${DOC}import { y } from "../../b/src/y.ts";\nexport { y };\n`,
      "packages/a/src/z.ts": `${DOC}import { w } from "./w.ts";\nimport { v } from "../v.ts";\nexport { v, w };\n`,
      "kernel/k.ts": `${DOC}export { x } from "../packages/a/src/x.ts";\n`,
      "kernel/ok.ts": `${DOC}export { k } from "./k.ts";\n`,
      "tools/t.ts": `${DOC}export { k } from "../kernel/k.ts";\n`,
    };
    assertEquals(await found({ rule: "import-boundary", options: { roots: ["kernel", "packages/*"] }, files }), [
      "kernel/k.ts:2 import-boundary",
      "packages/a/src/x.ts:2 import-boundary",
    ]);
    assertEquals(await found({ rule: "import-boundary", files }), []);
  },
  when,
);

proves(
  [FR],
  "module-doc refuses a file that does not begin with a JSDoc block saying @module; a shebang may come first",
  async () => {
    const files = {
      "none.ts": "export const n = 1;\n",
      "line-first.ts": `// a note\n${DOC}export const n = 1;\n`,
      "no-tag.ts": "/** A module. */\nexport const n = 1;\n",
      "not-jsdoc.ts": "/* A module. @module */\nexport const n = 1;\n",
      "after-code.ts": `export const n = 1;\n${DOC}`,
      "good.ts": `${DOC}export const n = 1;\n`,
      "shebang.ts": `#!/usr/bin/env node\n${DOC}export const n = 1;\n`,
    };
    assertEquals(await found({ rule: "module-doc", files }), [
      "after-code.ts:1 module-doc",
      "line-first.ts:1 module-doc",
      "no-tag.ts:1 module-doc",
      "none.ts:1 module-doc",
      "not-jsdoc.ts:1 module-doc",
    ]);
  },
  when,
);

proves(
  [FR],
  "switch-absurd refuses a switch on kind that does not end in a default calling absurd; every: true holds every switch to it",
  async () => {
    const sw = (end: string, on = "s.kind"): string =>
      `${DOC}import { absurd } from "./absurd.ts";\nexport function f(s: { kind: "a"; type: "a" } | { kind: "b"; type: "b" }): number {\n  switch (${on}) {\n    case "a":\n      return 1;\n${end}  }\n}\n`;
    const files = {
      "no-default.ts": sw(`    case "b":\n      return 2;\n`),
      "plain-default.ts": sw(`    default:\n      return 2;\n`),
      "absurd.ts": sw(`    case "b":\n      return 2;\n    default:\n      return absurd(s);\n`),
      "block.ts": sw(`    case "b":\n      return 2;\n    default: {\n      throw absurd(s);\n    }\n`),
      "other.ts": sw(`    default:\n      return 2;\n`, "s.type"),
    };
    assertEquals(await found({ rule: "switch-absurd", files }), ["no-default.ts:4 switch-absurd", "plain-default.ts:4 switch-absurd"]);
    assertEquals(await found({ rule: "switch-absurd", options: { discriminants: ["type"] }, files }), ["other.ts:4 switch-absurd"]);
    assertEquals(await found({ rule: "switch-absurd", options: { every: true, functions: ["absurd"] }, files }), [
      "no-default.ts:4 switch-absurd",
      "other.ts:4 switch-absurd",
      "plain-default.ts:4 switch-absurd",
    ]);
  },
  when,
);

proves(
  [FR],
  "terminal-writers refuses process.stdout, process.stderr, console and the vendors' streams outside the files allowed",
  async () => {
    const files = {
      "src/a.ts": `${DOC}console.log("x");\n`,
      "src/b.ts": `${DOC}import process from "node:process";\nprocess.stdout.write("x");\n`,
      "src/c.ts": `${DOC}import { stderr } from "node:process";\nexport { stderr };\n`,
      "src/d.ts": `${DOC}export const s = ${B}.stderr;\n`,
      "src/console.ts": `${DOC}console.error("x");\n`,
      "src/e.ts": `${DOC}const c = { log: (x: string): string => x };\nexport const y = c.log("x");\n`,
    };
    const allow = [{ files: "src/console.ts", reason: "the renderer, the one writer for a person" }];
    assertEquals(await found({ rule: "terminal-writers", options: { allow }, files }), [
      "src/a.ts:2 terminal-writers",
      "src/b.ts:3 terminal-writers",
      "src/c.ts:2 terminal-writers",
      "src/d.ts:2 terminal-writers",
    ]);
    assertEquals(await found({ rule: "terminal-writers", options: { allow, writers: [{ object: "console", property: "log" }] }, files }), [
      "src/a.ts:2 terminal-writers",
    ]);
  },
  when,
);

proves(
  [FR],
  "options that do not decode are reported, never ignored: an allowed file without its reason, a list that is not one",
  async () => {
    const files = { "a.ts": `${DOC}export const n = 1;\n` };
    const r = await lintFiles({ rule: "no-vendor-api", options: { allow: [{ files: "a.ts", reason: " " }] }, files });
    assert(r.kind === "ok");
    assertEquals(
      r.value.map((p) => [p.file, p.line, p.rule]),
      [["a.ts", 1, "no-vendor-api"]],
    );
    assertStringIncludes(r.value[0]?.message ?? "", "ifc/no-vendor-api: its options are not right");
    assertStringIncludes(r.value[0]?.message ?? "", "reason");
    assertEquals(await found({ rule: "import-boundary", options: { roots: "kernel" }, files }), ["a.ts:1 import-boundary"]);
  },
  when,
);

proves(
  [FR],
  "a harness defines its own rule with defineRule, in a plugin of its own, and bun lint loads it by --plugin",
  async () => {
    const dir = await makeTempDir({ prefix: "ifc-lint-plugin-" });
    try {
      const rule = new URL("../../lint/rule.ts", import.meta.url).href;
      const decode = new URL("../../../core/src/mod.ts", import.meta.url).href;
      const path = join(dir, "harness.ts");
      await writeTextFile(
        path,
        `import { defineRule } from ${JSON.stringify(rule)};
import { string } from ${JSON.stringify(decode)};
const noTodo = defineRule({ description: "no TODO in a comment", options: { word: string } }, (context, options) => ({
  Program: () => {
    for (const c of context.sourceCode.getAllComments()) {
      if (c.value.includes(options.word ?? "TODO")) context.report({ loc: { line: 1, column: 0 }, message: "open an issue instead" });
    }
  },
}));
export default { meta: { name: "harness" }, rules: { "no-todo": noTodo } };
`,
      );
      const files = { "a.ts": `${DOC}// TODO: later\nexport const n = 1;\n`, "b.ts": `${DOC}// FIXME: later\nexport const n = 1;\n` };
      assertEquals(await found({ rule: "no-todo", plugin: path, prefix: "harness", files }), ["a.ts:1 no-todo"]);
      assertEquals(await found({ rule: "no-todo", plugin: path, prefix: "harness", options: { word: "FIXME" }, files }), [
        "b.ts:1 no-todo",
      ]);
    } finally {
      await remove(dir, { recursive: true });
    }
  },
  when,
);
