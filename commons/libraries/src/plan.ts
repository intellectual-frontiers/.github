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
import { writeTextFileSync } from "@intellectual-frontiers/system/fs";
import { flag, formatUsageError, helpText, many, parseArgs, value } from "@intellectual-frontiers/terminal/args";
import { affectedBy, changedSince, everyLibrary } from "./affected.ts";
import { type Cell, cellOf, LIBRARY_CI } from "./workflows/definitions.ts";

/** A library as the plan reads it. */
export type Planned = { readonly name: string; readonly folder: string; readonly verify: string };

/** The cells of a job: what `strategy.matrix` reads as `{"include": [...]}`. */
export type Include = { readonly include: readonly Cell[] };

/** What CI runs for a change: the cells on Linux, and the cells on the other systems. */
export type Plan = { readonly linux: Include; readonly systems: Include };

/** The plan for these libraries: a cell on Linux for each, and one on each system its record names, in the order of the libraries. */
export function planOf(libs: readonly Planned[]): Plan {
  return {
    linux: { include: libs.map((l) => cellOf(l)) },
    systems: { include: libs.flatMap((l) => (LIBRARY_CI[l.name]?.systems ?? []).map((os) => cellOf(l, os))) },
  };
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
  if (o.all) libs = everyLibrary(o.repo);
  else if (files.length > 0) libs = affectedBy(o.repo, files);
  else if (o.base !== undefined) {
    const changed = await changedSince(o.repo, o.base);
    if (changed === undefined) stdio.stderr.writeSync(`plan: git cannot say what changed since ${o.base}; every library is planned\n`);
    libs = changed === undefined ? everyLibrary(o.repo) : affectedBy(o.repo, changed);
  } else {
    stdio.stderr.writeSync("plan: give --base REF, --files a,b or --all\n");
    return 2;
  }
  const plan = planOf(libs);
  if (o.githubOutput === undefined) stdio.stdout.writeSync(`${JSON.stringify(plan)}\n`);
  else writeTextFileSync(o.githubOutput, `${outputsOf(plan)}\n`, { append: true });
  stdio.stderr.writeSync(`plan: ${libs.length} libraries: ${libs.map((l) => l.name).join(", ") || "none"}\n`);
  return 0;
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
