/**
 * The parts of the command line of the documentation generator, `ifc-docs` (commons 0011-documentation FR-003, FR-023): `ifc-docs build [--out DIR]`
 * writes the site into DIR (the configuration's `out` by default, `_site` at the repository's root unless it says otherwise);
 * `ifc-docs check` builds it into a temporary folder, prints every finding as `where: message` on standard error, writes nothing in the
 * repository, and exits 1 where there is one. Both read the configuration given by `--config FILE`, or else the first `docs.config.ts`
 * found from the working folder up to the repository's root. A command line or a configuration that is not valid is refused with exit
 * status 2. It runs on Bun, the runtime of record, and on Node 26; in commons, `bun main.ts build` and `bun main.ts check` in
 * `commons/docs/` run it from the source.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { fs, path, proc } from "@intellectual-frontiers/system";
import { report } from "./check.ts";
import { type Config, resolveConfig } from "./config.ts";
import { buildSite, writeSite } from "./site.ts";

/** What the command line asks for. */
export type Command =
  | { readonly kind: "build"; readonly out: string | undefined; readonly config: string | undefined }
  | { readonly kind: "check"; readonly config: string | undefined }
  | { readonly kind: "help" };

/** The usage, printed by `--help` and with a refusal. */
export const USAGE = `usage: ifc-docs build [--out DIR] [--config FILE]
       ifc-docs check [--config FILE]

build   writes the site into DIR (the configuration's out, else _site at the repository's root)
check   builds the site into a temporary folder, prints every finding, and exits 1 where there is one
--config FILE   the configuration (default: the first docs.config.ts from here up to the repository's root)`;

/**
 * The command a command line asks for, or why it is not one.
 *
 * @param args - its arguments
 */
export function parseArgs(args: readonly string[]): Result<Command, string> {
  const [verb, ...rest] = args;
  if (verb === undefined || verb === "--help" || verb === "-h" || verb === "help") return ok({ kind: "help" });
  let out: string | undefined;
  let config: string | undefined;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    const value = rest[i + 1];
    if (a === "--out" || a === "--config") {
      if (value === undefined || value.startsWith("--")) return err(`${a} needs a value`);
      if (a === "--out") out = value;
      else config = value;
      i++;
    } else return err(`unknown argument ${JSON.stringify(a)}`);
  }
  switch (verb) {
    case "build":
      return ok({ kind: "build", out, config });
    case "check":
      if (out !== undefined) return err("check writes nothing: --out is for build");
      return ok({ kind: "check", config });
    default:
      return err(`unknown command ${JSON.stringify(verb)}: build or check`);
  }
}

/**
 * The configuration's file: the first `docs.config.ts` from a folder up to the repository's root (the first folder that holds `.git`).
 *
 * @param from - the folder to start from
 */
export function findConfig(from: string): string | undefined {
  let dir = path.resolve(from);
  for (;;) {
    const file = path.join(dir, "docs.config.ts");
    if (fs.existsSync(file)) return file;
    const parent = path.dirname(dir);
    if (fs.existsSync(path.join(dir, ".git")) || parent === dir) return undefined;
    dir = parent;
  }
}

/**
 * A configuration's module loaded and checked: its default export, or its export `config`.
 *
 * @param file - the configuration's file
 */
export async function loadConfig(file: string): Promise<Result<Config, string[]>> {
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) return err([`${abs} does not exist`]);
  let mod: unknown;
  try {
    mod = await import(path.toFileUrl(abs).href);
  } catch (e) {
    return err([`${abs} could not be imported: ${e instanceof Error ? e.message : String(e)}`]);
  }
  const value = typeof mod === "object" && mod !== null ? ("default" in mod && mod.default !== undefined ? mod.default : "config" in mod ? mod.config : undefined) : undefined;
  return resolveConfig(value, abs);
}

/**
 * The generator run: the site built, written or checked; the exit status (0, 1 where `check` finds something, 2 where it is refused).
 *
 * @param args - the command line's arguments
 * @param cwd - the working folder, where the search for the configuration starts
 */
export async function main(args: readonly string[], cwd: string = proc.cwd()): Promise<number> {
  const parsed = parseArgs(args);
  if (parsed.kind === "err") {
    console.error(`ifc-docs: ${parsed.error}\n${USAGE}`);
    return 2;
  }
  const c = parsed.value;
  if (c.kind === "help") {
    console.log(USAGE);
    return 0;
  }
  const file = c.config === undefined ? findConfig(cwd) : path.resolve(cwd, c.config);
  if (file === undefined) {
    console.error(`ifc-docs: no docs.config.ts from ${cwd} up to the repository's root; give one with --config`);
    return 2;
  }
  const loaded = await loadConfig(file);
  if (loaded.kind === "err") {
    for (const p of loaded.error) console.error(`${file}: ${p}`);
    return 2;
  }
  const config = loaded.value;
  const built = await buildSite(config);
  const lines = report(built.found);
  if (c.kind === "check") {
    const tmp = await fs.makeTempDir({ prefix: "ifc-docs-" });
    try {
      await writeSite(config, built, tmp);
    } finally {
      await fs.remove(tmp, { recursive: true });
    }
    for (const l of lines) console.error(l);
    console.error(`${built.pages.length} pages, ${lines.length} findings`);
    return lines.length > 0 ? 1 : 0;
  }
  const out = c.out === undefined ? config.out : path.resolve(cwd, c.out);
  await writeSite(config, built, out);
  for (const l of lines) console.error(l);
  console.error(`${built.pages.length} pages written to ${out}; ${lines.length} findings`);
  return 0;
}

