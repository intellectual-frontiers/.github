/**
 * The command line of the documentation generator (commons 0011-documentation FR-003): `bun main.ts [--out DIR]` writes the site into DIR
 * (`_site` at the checkout's root by default); `bun main.ts --check` builds it into a temporary folder, prints every finding as
 * `where: message` on standard error, writes nothing in the checkout, and exits 1 where there is one.
 *
 * @module
 */
import { fs, path, proc } from "../ts/runtime/mod.ts";
import { report } from "./check.ts";
import { buildSite, writeSite } from "./site.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "../..");

/** What the command line asks for. */
export interface Options {
  /** Whether to check, writing nothing in the checkout. */
  readonly check: boolean;
  /** Where to write the site. */
  readonly out: string;
}

/**
 * The options of a command line.
 *
 * @param args - its arguments
 */
export function optionsOf(args: readonly string[]): Options {
  const at = args.indexOf("--out");
  const out = at >= 0 ? path.resolve(args[at + 1] ?? "_site") : path.join(ROOT, "_site");
  return { check: args.includes("--check"), out };
}

/**
 * The generator run: the site built, written or checked; the exit status.
 *
 * @param args - the command line's arguments
 */
export async function main(args: readonly string[]): Promise<number> {
  const o = optionsOf(args);
  const built = await buildSite(ROOT);
  const lines = report(built.found);
  if (o.check) {
    const tmp = await fs.makeTempDir({ prefix: "ifc-docs-" });
    try {
      await writeSite(ROOT, built, tmp);
    } finally {
      await fs.remove(tmp, { recursive: true });
    }
    for (const l of lines) console.error(l);
    console.error(`${built.pages.length} pages, ${lines.length} findings`);
    return lines.length > 0 ? 1 : 0;
  }
  await writeSite(ROOT, built, o.out);
  for (const l of lines) console.error(l);
  console.error(`${built.pages.length} pages written to ${o.out}; ${lines.length} findings`);
  return 0;
}

if (import.meta.main) proc.exit(await main(proc.args));
