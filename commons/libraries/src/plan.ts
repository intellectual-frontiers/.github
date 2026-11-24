/**
 * The plan of CI (commons 0001-libraries FR-012): the libraries a push or a pull request affects, and for each the cells that the one workflow `ci` runs, so that a change proves what it touches and nothing else.
 *
 *     bun commons/libraries/src/plan.ts --base origin/main                      the plan for what changed since the merge base with origin/main, as JSON
 *     bun commons/libraries/src/plan.ts --all                                    every library
 *     bun commons/libraries/src/plan.ts --files a.ts,b/c.ts                      the libraries these files affect
 *     bun commons/libraries/src/plan.ts --base REF --github-output "$GITHUB_OUTPUT"   the same, written as the outputs of a step: has-linux, linux, has-systems, systems
 *
 * @remarks
 * The libraries are those of `affected.ts` (the same code the development loop and every check read), with the reach of `verify`: what a library's `verify` reads, and what depends on it. Each library has a cell on Linux; a
 * library whose record of CI (`LIBRARY_CI`) names Windows or macOS has a cell on each of them too, because it has code of its own for them. A matrix with no cell is not written as a matrix (a workflow cannot run
 * one): `has-linux` and `has-systems` say whether there is one.
 *
 * @limits
 * It decides nothing about a version, a tag or a release; those are the release's. It cannot say what changed where Git cannot: it plans every library then, and says why.
 *
 * @example
 * ```ts
 * import { planOf } from "./plan.ts";
 * planOf([{ name: "net", folder: "commons/net", verify: "bun run verify" }]).systems.include.map((c) => c.os); // ["windows-latest", "macos-latest"]
 * ```
 *
 * Spec: 0001-libraries FR-012
 *
 * @module
 */
import process from "node:process";
import { stdio } from "@intellectual-frontiers/system";
import { existsSync, readTextFileSync, writeTextFileSync } from "@intellectual-frontiers/system/fs";
import { join } from "@intellectual-frontiers/system/path";
import { run } from "@intellectual-frontiers/system/proc";
import { flag, formatUsageError, helpText, many, parseArgs, value } from "@intellectual-frontiers/terminal/args";
import { isSingle } from "./distribution.ts";
import { affectedBy, changedSince, everyLibrary } from "./affected.ts";
import { type Cell, cellOf, LIBRARY_CI } from "./workflows/definitions.ts";

/** A library as the plan reads it. */
export type Planned = { readonly name: string; readonly folder: string; readonly verify: string };

/** The cells of a job: what `strategy.matrix` reads as `{"include": [...]}`. */
export type Include = { readonly include: readonly Cell[] };

/** What CI runs for a change: the cells on Linux, and the cells on the other systems. */
export type Plan = { readonly linux: Include; readonly systems: Include };

/** The plan for these libraries: a cell on Linux for each, and one on each system its record names, in the order of the libraries; the packing is checked in the cells of the libraries named in `packs`. */
export function planOf(libs: readonly Planned[], packs: ReadonlySet<string> = new Set()): Plan {
  return {
    linux: { include: libs.flatMap((l) => shardedCells(cellOf(l, undefined, packs.has(l.name)))) },
    systems: { include: libs.flatMap((l) => (LIBRARY_CI[l.name]?.systems ?? []).map((os) => cellOf(l, os, packs.has(l.name)))) },
  };
}

/** The cell, or the cells that its library's tests are split among (0001-libraries FR-034): `data 1/4` to `data 4/4`, each with its place in `shard`; the packing is checked in the first. */
function shardedCells(cell: Cell): readonly Cell[] {
  const n = LIBRARY_CI[cell.name]?.shards ?? 1;
  if (n <= 1) return [cell];
  return Array.from({ length: n }, (_, i) => ({ ...cell, name: `${cell.name} ${i + 1}/${n}`, shard: `${i + 1}/${n}`, pack: cell.pack && i === 0 }));
}

/** The exports of a package.json as one line, the keys in order, so that two of them are the same where the entries are. */
export function exportsLine(packageJson: string): string {
  try {
    const x: unknown = JSON.parse(packageJson);
    const e = typeof x === "object" && x !== null && "exports" in x ? x.exports : undefined;
    const sorted = (v: unknown): unknown =>
      typeof v === "object" && v !== null && !Array.isArray(v)
        ? Object.fromEntries(
            Object.entries(v)
              .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
              .map(([k, n]) => [k, sorted(n)]),
          )
        : v;
    return JSON.stringify(sorted(e ?? null));
  } catch {
    return "unreadable";
  }
}

/**
 * The libraries whose packing a push checks (0001-libraries FR-012). In `per-library` mode: those that changed their `exports` since the base (a new library included), and every library where the packer itself
 * changed. In `single` mode there is one package, so its packing is checked once, in the cell of the library `commons`, where any library changed its `exports` or the packer changed, and in no other cell.
 * Git that cannot say gives every library (`commons` alone in `single` mode).
 */
export async function packsFor(repo: string, base: string, libs: readonly Planned[], single = isSingle(process.env["IFC_DISTRIBUTION"])): Promise<ReadonlySet<string>> {
  const everything: ReadonlySet<string> = single ? new Set([PACKAGE_LIBRARY]) : new Set(libs.map((l) => l.name));
  const mb = await run(["git", "-C", repo, "merge-base", base, "HEAD"]);
  if (mb.code !== 0) return everything;
  const packer = await run(["git", "-C", repo, "diff", "--name-only", mb.stdout.trim(), "--", "commons/libraries/src/pack-library.ts", "commons/libraries/src/pack-commons.ts", "commons/libraries/src/distribution.ts"]);
  if (packer.code !== 0 || packer.stdout.trim() !== "") return everything;
  const out = new Set<string>();
  for (const l of libs) {
    const before = await run(["git", "-C", repo, "show", `${mb.stdout.trim()}:${l.folder}/package.json`]);
    const now = join(repo, l.folder, "package.json");
    if (before.code !== 0 || !existsSync(now) || exportsLine(before.stdout) !== exportsLine(readTextFileSync(now))) out.add(l.name);
  }
  // the one package is made of every library: it is packed once, where any library's exports changed (0036-distribution FR-021)
  if (single) return out.size > 0 ? new Set([PACKAGE_LIBRARY]) : new Set();
  return out;
}

/** The library whose `verify` packs the one package in `single` mode. */
export const PACKAGE_LIBRARY = "commons";

/** The libraries with the library `commons` among them where the packing is to be checked in its cell (`single` mode), and as they are otherwise. */
export function withPackage(libs: readonly Planned[], packs: ReadonlySet<string>, repo: string): readonly Planned[] {
  if (!packs.has(PACKAGE_LIBRARY) || libs.some((l) => l.name === PACKAGE_LIBRARY)) return libs;
  const pkg = everyLibrary(repo).find((l) => l.name === PACKAGE_LIBRARY);
  return pkg === undefined ? libs : [...libs, pkg];
}

/** The outputs of a step that a workflow reads: the matrices as one line of JSON each and whether each has a cell. */
export function outputsOf(p: Plan): string {
  return [
    `has-linux=${p.linux.include.length > 0}`,
    `linux=${JSON.stringify(p.linux)}`,
    `has-systems=${p.systems.include.length > 0}`,
    `systems=${JSON.stringify(p.systems)}`,
  ].join("\n");
}

const OPTIONS = {
  base: value({ help: "The revision the change starts at (the merge base with it is compared with the head).", valueName: "REF" }),
  files: many({ help: "A file that changed (from the repository's root); the libraries it affects. Repeat or separate with commas.", valueName: "FILE" }),
  all: flag({ help: "Every library." }),
  repo: value({ help: "The repository (the working folder by default).", valueName: "DIR", default: "." }),
  githubOutput: value({ help: "Append the outputs to this file, as a step's `$GITHUB_OUTPUT` is read.", valueName: "FILE" }),
};

/** The command line. Returns the exit status: 0, or 2 for a command line that does not fit. */
export async function main(argv: readonly string[]): Promise<number> {
  const parsed = parseArgs(argv, OPTIONS);
  if (parsed.kind === "err") {
    stdio.stderr.writeSync(`${formatUsageError(parsed.error, "plan")}\n`);
    return 2;
  }
  if (parsed.value.kind === "help") {
    stdio.stdout.writeSync(`${helpText("plan", "The libraries a change affects and the cells CI runs for them.", OPTIONS)}\n`);
    return 0;
  }
  const o = parsed.value.options;
  const files = (o.files ?? []).flatMap((f) => f.split(",")).filter((f) => f !== "");
  let libs: readonly Planned[];
  let packs: ReadonlySet<string> = new Set();
  if (o.all) {
    libs = everyLibrary(o.repo);
    packs = isSingle(process.env["IFC_DISTRIBUTION"]) ? new Set([PACKAGE_LIBRARY]) : new Set(libs.map((l) => l.name));
  } else if (files.length > 0) libs = affectedBy(o.repo, files);
  else if (o.base !== undefined) {
    const changed = await changedSince(o.repo, o.base);
    if (changed === undefined) stdio.stderr.writeSync(`plan: git cannot say what changed since ${o.base}; every library is planned\n`);
    libs = changed === undefined ? everyLibrary(o.repo) : affectedBy(o.repo, changed);
    packs = changed === undefined ? (isSingle(process.env["IFC_DISTRIBUTION"]) ? new Set([PACKAGE_LIBRARY]) : new Set(libs.map((l) => l.name))) : await packsFor(o.repo, o.base, libs);
    libs = withPackage(libs, packs, o.repo);
  } else {
    stdio.stderr.writeSync("plan: give --base REF, --files a,b or --all\n");
    return 2;
  }
  const plan = planOf(libs, packs);
  if (o.githubOutput === undefined) stdio.stdout.writeSync(`${JSON.stringify(plan)}\n`);
  else writeTextFileSync(o.githubOutput, `${outputsOf(plan)}\n`, { append: true });
  stdio.stderr.writeSync(`plan: ${libs.length} libraries: ${libs.map((l) => l.name).join(", ") || "none"}\n`);
  return 0;
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
