/**
 * A rule of a lint plugin run against code, in a test (commons 0005-typescript-runtime FR-061): the files are written to a new folder
 * and the real linter, `bun lint` of the pinned Bun, is run over them with the plugin loaded by `--plugin` and only the rule turned on
 * by `--rule`, so that a test proves the rule and the way `bun lint` loads it. Its problems come back from its JSON report, decoded.
 *
 * The linter is the Bun named by `IFC_LINT_BUN` (a path to a Bun whose `lint` runs plugins), else the pinned canary through `bun x
 * --no-install bun@<LINT_BUN_VERSION>`, which is never fetched here: where it is not installed, `linter()` says so and the tests that
 * need it are skipped with that reason (`bun x bun@<LINT_BUN_VERSION> --version` installs it).
 *
 * @example
 * ```ts
 * import { lintFiles } from "./test-rule.ts";
 * const problems = await lintFiles({ rule: "no-registry-import", files: { "a.ts": 'import x from "npm:x";\nexport { x };\n' } });
 * // { kind: "ok", value: [{ file: "a.ts", rule: "no-registry-import", line: 1, column: 1, message: "..." }] }
 * ```
 *
 * @module
 */
import { fileURLToPath } from "node:url";
import { array, integer, json, nullable, object, string, err, ok, type Result } from "@intellectual-frontiers/core";
import { makeTempDir, mkdir, readTextFile, realPath, remove, writeTextFile } from "@intellectual-frontiers/system/fs";
import { dirname, join, relative } from "@intellectual-frontiers/system/path";
import { env, run } from "@intellectual-frontiers/system/proc";

/** The Bun whose `lint` runs ESLint plugins, until a release has it (FR-028). */
export const LINT_BUN_VERSION = "1.4.4-canary.20261115.1";

/** The plugin of this folder. */
export const PLUGIN_PATH: string = fileURLToPath(new URL("./plugin.ts", import.meta.url));

/** A problem the linter reported: the file (as given), the rule without its prefix, the line and column from 1, and the message. */
export type Problem = {
  readonly file: string;
  readonly rule: string;
  readonly line: number;
  readonly column: number;
  readonly message: string;
};

/** A rule to run: its name, its options object, the files (relative paths and their text), and the plugin (this folder's by default). */
export type LintRun = {
  readonly rule: string;
  readonly options?: unknown;
  readonly files: Readonly<Record<string, string>>;
  readonly plugin?: string;
  /** The plugin's name, the prefix of its rules (`ifc` by default). */
  readonly prefix?: string;
};

/** The command that runs `bun lint`, without `lint`: `IFC_LINT_BUN`, or the pinned canary through `bun x --no-install`. */
export function lintCommand(): readonly string[] {
  const given = env.get("IFC_LINT_BUN")?.trim();
  return given !== undefined && given !== "" ? [given] : ["bun", "x", "--no-install", `bun@${LINT_BUN_VERSION}`];
}

/** The linter's command where it runs and can load a plugin, or why not. */
export async function linter(): Promise<Result<readonly string[], string>> {
  const command = lintCommand();
  try {
    const r = await run([...command, "lint", "--help", "--all"]);
    if (r.success && r.stdout.includes("--plugin")) return ok(command);
    return err(`${command.join(" ")} lint does not load plugins here (exit ${r.code}); run bun x bun@${LINT_BUN_VERSION} --version once`);
  } catch (e) {
    return err(`${command.join(" ")} does not run here: ${e instanceof Error ? e.message : String(e)}`);
  }
}

const report = array(
  object(
    { filePath: string },
    { messages: array(object({ message: string }, { ruleId: nullable(string), line: integer, column: integer })) },
  ),
);

/**
 * The problems one rule of a plugin finds in the files given (FR-061), by running `bun lint` over them in a new folder (its working
 * folder, with a `bunfig.toml` of an empty `[lint]`), the rule set to `error` with its options. Problems of other rules (Bun's own
 * defaults) are left out. An error where the linter fails (exit 2: a rule threw, or the plugin did not load).
 */
export async function lintFiles(r: LintRun): Promise<Result<readonly Problem[], string>> {
  const prefix = r.prefix ?? "ifc";
  const dir = await makeTempDir({ prefix: "ifc-lint-" });
  try {
    await writeTextFile(join(dir, "bunfig.toml"), "[lint]\n");
    const names = Object.keys(r.files);
    for (const [name, text] of Object.entries(r.files)) {
      const path = join(dir, name);
      await mkdir(dirname(path), { recursive: true });
      await writeTextFile(path, text);
    }
    const out = join(dir, "report.json");
    const setting = r.options === undefined ? ["error"] : ["error", r.options];
    const result = await run(
      [
        ...lintCommand(),
        "lint",
        "--format",
        "json",
        "--output-file",
        out,
        `--plugin=${r.plugin ?? PLUGIN_PATH}`,
        "--rule",
        JSON.stringify({ [`${prefix}/${r.rule}`]: setting }),
        ...names,
      ],
      { cwd: dir },
    );
    if (result.code !== 0 && result.code !== 1) return err(`bun lint exited with ${result.code}: ${result.stderr}${result.stdout}`);
    const decoded = json(await readTextFile(out), report);
    if (decoded.kind === "err")
      return err(`bun lint's report is not what it should be: ${decoded.error.expected} at ${decoded.error.path}`);
    const problems: Problem[] = [];
    const real = await realPath(dir);
    for (const f of decoded.value) {
      const file = relative(real, await realPath(f.filePath)).replaceAll("\\", "/");
      for (const m of f.messages ?? []) {
        if (m.ruleId === undefined || m.ruleId === null || !m.ruleId.startsWith(`${prefix}/`)) continue;
        problems.push({ file, rule: m.ruleId.slice(prefix.length + 1), line: m.line ?? 0, column: m.column ?? 0, message: m.message });
      }
    }
    return ok(problems.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line || a.column - b.column)));
  } finally {
    await remove(dir, { recursive: true });
  }
}
