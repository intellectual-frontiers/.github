// Spec: 0001-docs FR-003
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
import { type Finding, report } from "./check.ts";
import { type Config, PRESENTATION_IDS, type PresentationId, resolveConfig } from "./config.ts";
import { presentationFiles, staleFiles } from "./presentation.ts";
import { buildSite, writeSite } from "./site.ts";

/** What the command line asks for. */
export type Command =
  | {
    readonly kind: "build";
    readonly out: string | undefined;
    readonly config: string | undefined;
    /** The presentations asked for; the configuration's where none. */
    readonly presentations?: readonly PresentationId[];
    /** Write nothing: say which files are not what a build would write. */
    readonly verify?: boolean;
  }
  | { readonly kind: "check"; readonly config: string | undefined }
  | { readonly kind: "help" };

/** The usage, printed by `--help` and with a refusal. */
export const USAGE = `usage: ifc-docs build [--out DIR] [--config FILE] [--presentation NAME[,NAME...]] [--check]
       ifc-docs check [--config FILE]

build   writes the site into DIR (the configuration's out, else _site at the repository's root)
--presentation NAME   what to write: ${PRESENTATION_IDS.join(", ")} (the configuration's presentations, else web, markdown and data); book writes <volume>/generated/<volume>.adoc for each volume
--check   with build: writes nothing, and exits 1 where a file is not what a build would write
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
  let presentations: PresentationId[] | undefined;
  let verify = false;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    const value = rest[i + 1];
    if (a === "--check") verify = true;
    else if (a === "--out" || a === "--config" || a === "--presentation") {
      if (value === undefined || value.startsWith("--")) return err(`${a} needs a value`);
      if (a === "--out") out = value;
      else if (a === "--config") config = value;
      else {
        for (const name of value.split(",")) {
          const id = PRESENTATION_IDS.find((x) => x === name);
          if (id === undefined) return err(`--presentation ${JSON.stringify(name)} is not one of ${PRESENTATION_IDS.join(", ")}`);
          presentations = [...(presentations ?? []), id];
        }
      }
      i++;
    } else return err(`unknown argument ${JSON.stringify(a)}`);
  }
  switch (verb) {
    case "build":
      return ok({ kind: "build", out, config, ...(presentations === undefined ? {} : { presentations }), ...(verify ? { verify } : {}) });
    case "check":
      if (out !== undefined) return err("check writes nothing: --out is for build");
      if (presentations !== undefined || verify) return err("check builds every presentation its configuration names: --presentation and --check are for build");
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
    let more: readonly Finding[] = [];
    try {
      more = await writeSite(config, built, tmp, [...new Set<PresentationId>([...config.presentations, ...(config.books.volumes.length > 0 ? ["book" as const] : [])])]);
    } finally {
      await fs.remove(tmp, { recursive: true });
    }
    lines.push(...report([...more]));
    for (const l of lines) console.error(l);
    console.error(`${built.pages.length} pages, ${lines.length} findings`);
    return lines.length > 0 ? 1 : 0;
  }
  const out = c.out === undefined ? config.out : path.resolve(cwd, c.out);
  const ids = c.presentations ?? config.presentations;
  if (ids.includes("book") && config.books.volumes.length === 0) {
    console.error("ifc-docs: --presentation book, and the configuration names no volume (books.volumes)");
    return 2;
  }
  if (c.verify === true) {
    const made = presentationFiles(config, built, ids);
    const stale = await staleFiles(out, made.files);
    lines.push(...report([...made.found]));
    for (const l of lines) console.error(l);
    for (const s of stale) console.error(`${path.join(out, s)}: is not what a build writes; rewrite it with ifc-docs build${c.presentations === undefined ? "" : ` --presentation ${ids.join(",")}`}`);
    console.error(`${stale.length} of ${made.files.length} files are not current; ${lines.length} findings`);
    return stale.length > 0 || lines.length > 0 ? 1 : 0;
  }
  lines.push(...report([...(await writeSite(config, built, out, ids))]));
  for (const l of lines) console.error(l);
  console.error(`${built.pages.length} pages written to ${out}; ${lines.length} findings`);
  return 0;
}

