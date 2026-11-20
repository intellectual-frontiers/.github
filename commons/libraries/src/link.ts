/**
 * The links of the libraries (commons 0001-libraries FR-011): every package of commons linked under `commons/node_modules/@intellectual-frontiers`, so that a library imports another by its package name and reads the checkout's
 * source. It is the first command of every script that imports a library of commons (`dev:check`, `release`, the plan of CI), and it imports none: a fresh checkout has no link yet, and the command that makes them cannot
 * itself need one.
 *
 *     bun commons/libraries/src/link.ts            link what is not linked, from the repository above this folder (or --repo DIR)
 *
 * @remarks
 * A folder of `commons/` whose `package.json` is named `@intellectual-frontiers/<name>` is linked as that name, and `commons/ts` as `@intellectual-frontiers/commons` (`commons/docs` bears the same name and is not linked). A link
 * that is there is left as it is. Only the built-ins of Node are used, so it runs on Bun and on Node 26 before anything is installed.
 *
 * @limits
 * It links and nothing else: the packages the root and a library install are `bun install`'s.
 *
 * @example
 * ```ts
 * import { linksOf } from "./link.ts";
 * linksOf(".").get("@intellectual-frontiers/commons"); // the path of commons/ts
 * ```
 *
 * Spec: 0001-libraries FR-011
 *
 * @module
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, symlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCOPE = "@intellectual-frontiers/";

const nameOf = (file: string): string | undefined => {
  try {
    const x: unknown = JSON.parse(readFileSync(file, "utf8"));
    return typeof x === "object" && x !== null && "name" in x && typeof x.name === "string" ? x.name : undefined;
  } catch {
    return undefined;
  }
};

/** The packages of commons by name and the folder of each; `commons/ts` comes first, so that it is the one that bears `@intellectual-frontiers/commons`. */
export function linksOf(repo: string): ReadonlyMap<string, string> {
  const links = new Map<string, string>();
  const dirs = readdirSync(join(repo, "commons"), { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== "node_modules")
    .map((e) => e.name)
    .sort((a, b) => (a === "ts" ? -1 : b === "ts" ? 1 : a < b ? -1 : 1));
  for (const d of dirs) {
    const name = nameOf(join(repo, "commons", d, "package.json"));
    if (name !== undefined && name.startsWith(SCOPE) && !links.has(name)) links.set(name, join(repo, "commons", d));
  }
  return links;
}

/** Links each package that is not linked yet, and gives how many it linked, or why it could not. */
export function linkAll(repo: string): { readonly made: number } | { readonly problem: string } {
  try {
    const scope = join(repo, "commons", "node_modules", "@intellectual-frontiers");
    let made = 0;
    for (const [name, dir] of linksOf(repo)) {
      const at = join(scope, name.slice(SCOPE.length));
      if (existsSync(at)) continue;
      if (made === 0) mkdirSync(scope, { recursive: true });
      symlinkSync(dir, at, "junction");
      made += 1;
    }
    return { made };
  } catch (e) {
    return { problem: `the libraries could not be linked under commons/node_modules: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** The repository above a folder: the nearest one that has `commons/libraries/library.ts`. */
export function rootAbove(from: string): string | undefined {
  for (let d = resolve(from); ; d = dirname(d)) {
    if (existsSync(join(d, "commons", "libraries", "library.ts"))) return d;
    if (dirname(d) === d) return undefined;
  }
}

/** The command line: 0, or 1 where it could not link. */
export function main(argv: readonly string[]): number {
  const at = argv.indexOf("--repo");
  const repo = at >= 0 ? resolve(argv[at + 1] ?? ".") : rootAbove(dirname(fileURLToPath(import.meta.url)));
  if (repo === undefined) {
    process.stderr.write("link: no repository with commons/libraries here; give --repo DIR\n");
    return 1;
  }
  const r = linkAll(repo);
  if ("problem" in r) {
    process.stderr.write(`link: ${r.problem}\n`);
    return 1;
  }
  return 0;
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
