/**
 * The development loop (commons 0001-libraries FR-011, FR-012): the libraries a working tree changes, and the libraries that depend on them, type-checked and tested in parallel processes and no more than they need, with a calm summary. It is
 * what a person or an agent runs between two edits; the release loop (the packing of every library, the register, the versions) is another command and is never part of this one.
 *
 *     bun run dev:check                          the libraries affected since origin/main (and the files not yet committed), their types and their tests
 *     bun run dev:check --only system,net        those libraries and their dependents, whatever changed
 *     bun run dev:check --files a.ts,b/c.ts      the libraries these files affect (paths from the repository's root)
 *     bun run dev:check --all                    every library
 *     bun run dev:check --list                   say what is affected and run nothing
 *     other flags: --base REF (origin/main by default), --no-types, --no-tests, --no-license, --bail (stop at the first failing test), --repo DIR
 *
 * @remarks
 * Nothing is installed per library. The repository's root installs the packages every library shares (`bun install`, once), the libraries are linked under `commons/node_modules` (a link for each folder whose package
 * name is `@intellectual-frontiers/<folder>`, and `@intellectual-frontiers/commons` for `commons/ts`), so that a library that imports another by its package name reads the checkout's source, never a copy from a
 * registry: the `exports` of each package are the sources. A library with a package of its own outside the shared set (a database driver) is installed in its folder, once. The affected libraries are those of
 * `affected.ts` (the same code the workflow of CI runs); TypeScript 7 checks each library's own `tsconfig.json`, several at a time, and the tests of each run in a `bun test` process of its own, from its folder as `verify` runs them, several at a time.
 *
 * @limits
 * It proves less than `bun run verify` of a library: no specification check, no trace, no packing, no Node 26, no other system than this one. CI runs those on the libraries a push affects.
 * A change of a file that no library reads affects no library, and nothing is run.
 *
 * @example
 * ```ts
 * import { bunCounts } from "./dev.ts";
 * bunCounts(" 913 pass\n 3 skip\n 0 fail\nRan 917 tests across 141 files. [55.88s]\n"); // { pass: 913, skip: 3, fail: 0, files: 141 }
 * ```
 *
 * Spec: 0001-libraries FR-011
 *
 * @module
 */
import process from "node:process";
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import { stdio } from "@intellectual-frontiers/system";
import { existsSync, readDirSync, readTextFileSync } from "@intellectual-frontiers/system/fs";
import { dirname, join, resolve } from "@intellectual-frontiers/system/path";
import { build, run } from "@intellectual-frontiers/system/proc";
import { currentLook, type Look } from "@intellectual-frontiers/system/tty";
import { flag, formatUsageError, helpText, many, parseArgs, value } from "@intellectual-frontiers/terminal/args";
import { label, paint } from "@intellectual-frontiers/terminal/palette";
import { affectedBy, changedSince, everyLibrary } from "./affected.ts";
import { linkAll } from "./link.ts";
import { judge as judgeLicense, sentence as licenseSentence } from "./license.ts";
import type { Library } from "./libraries.ts";

/** What the loop is asked about: what changed since a revision, a list of files, named libraries or everything. */
export type Scope =
  | { readonly kind: "since"; readonly base: string }
  | { readonly kind: "files"; readonly files: readonly string[] }
  | { readonly kind: "only"; readonly names: readonly string[] }
  | { readonly kind: "all" };

/** A library of the repository with its folder, as `affected.ts` gives it. */
export type Lib = Library & { readonly folder: string };

/** How one stage of the loop ended. */
export type Outcome =
  | { readonly kind: "passed"; readonly detail: string }
  | { readonly kind: "failed"; readonly detail: string; readonly output: readonly string[] }
  | { readonly kind: "skipped"; readonly detail: string };

/** The counts of one `bun test` run. */
export type Counts = { readonly pass: number; readonly skip: number; readonly fail: number; readonly files: number };

/** The counts in the end of what `bun test` printed, or undefined where it printed none. */
export function bunCounts(text: string): Counts | undefined {
  const n = (word: string): number => Number(new RegExp(`^\\s*(\\d+) ${word}\\s*$`, "m").exec(text)?.[1] ?? 0);
  const ran = /^Ran \d+ tests? across (\d+) files?/m.exec(text);
  return ran?.[1] === undefined ? undefined : { pass: n("pass"), skip: n("skip"), fail: n("fail"), files: Number(ran[1]) };
}

/** The lines of `bun test`'s output that say what failed: the failing tests and the error lines above each, in order. */
export function failureLines(text: string): readonly string[] {
  const lines = text.split("\n");
  const out: string[] = [];
  lines.forEach((l, i) => {
    if (!/^\(fail\)/.test(l) && !/^error:/.test(l)) return;
    if (/^\(fail\)/.test(l)) out.push(l);
    else {
      out.push(l);
      for (const next of lines.slice(i + 1, i + 6)) if (/^\s+at |^\s+\d+ \|/.test(next)) out.push(next);
    }
  });
  return out.length > 0 ? out : lines.slice(-30);
}

/** The first lines of a compiler's output, so a long one does not bury the summary. */
export function head(lines: readonly string[], n: number): readonly string[] {
  return lines.length <= n ? lines : [...lines.slice(0, n), `... and ${lines.length - n} more`];
}

/** The packages a library declares that neither are libraries of the repository nor are installed at the root: the ones it must install itself. */
export function ownPackages(pkg: Readonly<Record<string, unknown>>, shared: ReadonlySet<string>): readonly string[] {
  const out = new Set<string>();
  for (const field of ["dependencies", "devDependencies"]) {
    const o = pkg[field];
    if (typeof o !== "object" || o === null) continue;
    for (const [k, v] of Object.entries(o)) if (typeof v === "string" && !v.startsWith("link:") && !shared.has(k)) out.add(k);
  }
  return [...out].sort();
}

const readJson = (file: string): Readonly<Record<string, unknown>> => {
  try {
    const x: unknown = JSON.parse(readTextFileSync(file));
    return typeof x === "object" && x !== null && !Array.isArray(x) ? Object.fromEntries(Object.entries(x)) : {};
  } catch {
    return {};
  }
};

/** Links the libraries under `commons/node_modules` where they are not linked yet (`link.ts`, which `bun run dev:check` runs before this command can import any of them). */
export function linkLibraries(repo: string): Result<number, string> {
  const r = linkAll(repo);
  return "problem" in r ? err(r.problem) : ok(r.made);
}

/** The revision a loop compares with where none is given: `origin/main`, else `main`, else `HEAD` (the working tree alone). */
export async function defaultBase(repo: string): Promise<string> {
  for (const ref of ["origin/main", "main"]) {
    const r = await run(["git", "-C", repo, "rev-parse", "--verify", "--quiet", ref]);
    if (r.code === 0) return ref;
  }
  return "HEAD";
}

/** What a scope affects: the libraries and why, or why it cannot be said. */
export async function affectedOf(repo: string, scope: Scope): Promise<Result<{ readonly libs: readonly Lib[]; readonly why: string }, string>> {
  switch (scope.kind) {
    case "all":
      return ok({ libs: everyLibrary(repo), why: "every library" });
    case "files":
      return ok({ libs: affectedBy(repo, scope.files, "code"), why: `${scope.files.length} named files` });
    case "only": {
      const all = everyLibrary(repo);
      const unknown = scope.names.filter((n) => !all.some((l) => l.name === n));
      if (unknown.length > 0) return err(`no library named ${unknown.join(", ")} (they are: ${all.map((l) => l.name).join(", ")})`);
      const roots = all.filter((l) => scope.names.includes(l.name)).flatMap((l) => `commons/${l.name}/library.ts`);
      return ok({ libs: affectedBy(repo, roots, "code"), why: `${scope.names.join(", ")} and what imports them` });
    }
    case "since": {
      const changed = await changedSince(repo, scope.base);
      if (changed === undefined) return ok({ libs: everyLibrary(repo), why: `git cannot say what changed since ${scope.base}` });
      return ok({ libs: affectedBy(repo, changed, "code"), why: `${changed.length} files changed since ${scope.base}` });
    }
    default:
      return absurd(scope);
  }
}

/** The compiler's program for this system: the one the root installs. */
const tscOf = (repo: string): string => join(repo, "node_modules", ".bin", build.os === "windows" ? "tsc.cmd" : "tsc");

/** Runs `job` over `items`, at most `width` at a time, and gives the results in the order of the items. */
export async function pool<T, R>(items: readonly T[], width: number, job: (item: T) => Promise<R>): Promise<readonly R[]> {
  const out: R[] = [];
  const results = new Map<number, R>();
  let next = 0;
  const worker = async (): Promise<void> => {
    for (let i = next++; i < items.length; i = next++) {
      const item = items[i];
      if (item !== undefined) results.set(i, await job(item));
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(width, items.length)) }, worker));
  for (let i = 0; i < items.length; i++) {
    const r = results.get(i);
    if (r !== undefined) out.push(r);
  }
  return out;
}

const seconds = (since: number): string => `${((performance.now() - since) / 1000).toFixed(1)}s`;
const plural = (n: number, one: string, many_ = `${one}s`): string => `${n} ${n === 1 ? one : many_}`;

/** What the loop needs installed: the root's packages, the links, and the packages of a library that has its own. */
export async function prepare(repo: string, libs: readonly Lib[]): Promise<Result<readonly string[], string>> {
  const said: string[] = [];
  if (!existsSync(tscOf(repo))) {
    const r = await run(["bun", "install", "--frozen-lockfile"], { cwd: repo });
    if (r.code !== 0) return err(`bun install at the root failed:\n${r.stderr.trim()}`);
    said.push("installed the packages of the root");
  }
  const linked = linkLibraries(repo);
  if (linked.kind === "err") return linked;
  if (linked.value > 0) said.push(`linked ${plural(linked.value, "package")} under commons/node_modules`);
  const rootPkg = readJson(join(repo, "package.json"));
  const shared = new Set(
    ["dependencies", "devDependencies"].flatMap((f) => {
      const o = rootPkg[f];
      return typeof o === "object" && o !== null ? Object.keys(o) : [];
    }),
  );
  for (const l of libs) {
    const own = ownPackages(readJson(join(repo, l.folder, "package.json")), shared);
    if (own.length === 0 || existsSync(join(repo, l.folder, "node_modules"))) continue;
    const r = await run(["bun", "install", "--frozen-lockfile"], { cwd: join(repo, l.folder) });
    if (r.code !== 0) return err(`bun install in ${l.folder} failed:\n${r.stderr.trim()}`);
    said.push(`installed ${l.folder}'s own packages (${own.join(", ")})`);
  }
  return ok(said);
}

/** TypeScript on the libraries, several at a time. */
export async function typeCheck(repo: string, libs: readonly Lib[], width: number): Promise<Outcome> {
  const t0 = performance.now();
  const checked = libs.filter((l) => existsSync(join(repo, l.folder, "tsconfig.json")));
  const results = await pool(checked, width, async (l) => {
    const r = await run([tscOf(repo), "-p", "tsconfig.json", "--pretty", "false"], { cwd: join(repo, l.folder) });
    return { name: l.name, code: r.code, lines: `${r.stdout}${r.stderr}`.split("\n").filter((x) => x.trim() !== "") };
  });
  const bad = results.filter((r) => r.code !== 0);
  if (bad.length === 0) return { kind: "passed", detail: `${plural(checked.length, "library", "libraries")} in ${seconds(t0)}` };
  return {
    kind: "failed",
    detail: `${bad.map((b) => b.name).join(", ")} in ${seconds(t0)}`,
    output: bad.flatMap((b) => head(b.lines, 25).map((x) => `${b.name}: ${x}`)),
  };
}

/** The license of the repository and of each library, as the check of `license.ts` finds it: a library with no `LICENSE` fails here, and the sentence says the command that writes it. */
export async function licenseStage(repo: string): Promise<Outcome> {
  const t0 = performance.now();
  const { findings } = await judgeLicense(repo);
  if (findings.length === 0) return { kind: "passed", detail: `every LICENSE is the official text in ${seconds(t0)}` };
  return { kind: "failed", detail: plural(findings.length, "finding", "findings"), output: findings.map(licenseSentence) };
}

/** The sum of counts. */
export const addCounts = (a: Counts, b: Counts): Counts => ({ pass: a.pass + b.pass, skip: a.skip + b.skip, fail: a.fail + b.fail, files: a.files + b.files });

/**
 * The tests of the libraries: one `bun test suite/` process for each library, from its folder as its `verify` runs it, several at a time and the largest suites first. One process for all of them would be fewer, but a
 * test may set what is global to its process (the tracer of a process, a working folder), and what it sets must not reach the tests of another library.
 */
export async function runTests(repo: string, libs: readonly Lib[], width: number, bail: boolean): Promise<Outcome> {
  const t0 = performance.now();
  const files = (l: Lib): number => readDirSync(join(repo, l.folder, "suite")).length;
  const suites = libs.filter((l) => existsSync(join(repo, l.folder, "suite"))).sort((a, b) => files(b) - files(a));
  if (suites.length === 0) return { kind: "skipped", detail: "no library of these has a suite" };
  const results = await pool(suites, width, async (l) => {
    const r = await run(["bun", "test", ...(bail ? ["--bail"] : []), "suite/"], { cwd: join(repo, l.folder), env: { CI: "" } });
    const text = `${r.stdout}\n${r.stderr}`;
    return { name: l.name, code: r.code, counts: bunCounts(text), text };
  });
  const total = results.reduce((sum, r) => (r.counts === undefined ? sum : addCounts(sum, r.counts)), { pass: 0, skip: 0, fail: 0, files: 0 });
  const detail = `${total.pass} pass${total.skip > 0 ? `, ${total.skip} skipped` : ""}${total.fail > 0 ? `, ${total.fail} fail` : ""} in ${plural(total.files, "file")} of ${plural(suites.length, "library", "libraries")}, ${seconds(t0)}`;
  const bad = results.filter((r) => r.code !== 0 || r.counts === undefined);
  if (bad.length === 0) return { kind: "passed", detail };
  return {
    kind: "failed",
    detail,
    output: bad.flatMap((r) => [
      ...(r.counts === undefined ? [`${r.name}: bun test ended with ${r.code} and no summary`] : []),
      ...head(failureLines(r.text), 40).map((l) => `${r.name}: ${l}`),
    ]),
  };
}

/** The summary the loop prints: one line for what it looked at, one for each stage, and what failed under it. */
export function summaryLines(
  look: Look,
  what: { readonly why: string; readonly libs: readonly string[] },
  stages: readonly { readonly name: string; readonly outcome: Outcome }[],
  notes: readonly string[],
  took: string,
): readonly string[] {
  const out: string[] = [];
  out.push(`${paint("accent", "dev:check", look)}  ${what.why}`);
  for (const n of notes) out.push(`  ${label("hint", n, look)}`);
  if (what.libs.length === 0) out.push(`  ${label("skipped", "nothing is affected: no library reads what changed", look)}`);
  else out.push(`  ${paint("dim", "affected", look)}  ${plural(what.libs.length, "library", "libraries")}: ${what.libs.join(", ")}`);
  for (const s of stages) {
    const o = s.outcome;
    switch (o.kind) {
      case "passed":
        out.push(`  ${label("done", `${s.name.padEnd(6)} ${o.detail}`, look)}`);
        break;
      case "skipped":
        out.push(`  ${label("skipped", `${s.name.padEnd(6)} ${o.detail}`, look)}`);
        break;
      case "failed":
        out.push(`  ${label("failed", `${s.name.padEnd(6)} ${o.detail}`, look)}`, ...o.output.map((l) => `      ${l}`));
        break;
      default:
        return absurd(o);
    }
  }
  if (stages.length === 0) return out;
  const failed = stages.some((s) => s.outcome.kind === "failed");
  out.push(`  ${failed ? label("failed", `not ready to push (${took})`, look) : label("done", `ready to push (${took})`, look)}`);
  return out;
}

const OPTIONS = {
  base: value({ help: "The revision to compare with (origin/main, else main, else HEAD).", valueName: "REF" }),
  files: many({ help: "A file that changed (from the repository's root); the libraries it affects. Repeat or separate with commas.", valueName: "FILE" }),
  only: many({ help: "A library, and what depends on it, whatever changed. Repeat or separate with commas.", valueName: "NAME" }),
  all: flag({ help: "Every library." }),
  list: flag({ help: "Say what is affected and run nothing." }),
  types: flag({ help: "Type-check the libraries (on by default).", negatable: true, default: true }),
  tests: flag({ help: "Run their tests (on by default).", negatable: true, default: true }),
  license: flag({ help: "Check the license files of the repository (on by default).", negatable: true, default: true }),
  bail: flag({ help: "Stop the tests at the first one that fails." }),
  repo: value({ help: "The repository (the working folder, or the one above it that has commons/, by default).", valueName: "DIR" }),
};

const commas = (xs: readonly string[]): readonly string[] =>
  xs
    .flatMap((x) => x.split(","))
    .map((x) => x.trim())
    .filter((x) => x !== "");

/** The root of the repository that holds `from`: the nearest folder above it that has `commons/libraries/library.ts`. */
export function repoRootOf(from: string): string | undefined {
  for (let d = resolve(from); ; d = dirname(d)) {
    if (existsSync(join(d, "commons", "libraries", "library.ts"))) return d;
    if (dirname(d) === d) return undefined;
  }
}

/** The command line. Returns the exit status: 0 where what is affected passed, 1 where a stage failed, 2 for a command line that does not fit. */
export async function main(argv: readonly string[]): Promise<number> {
  const parsed = parseArgs(argv, OPTIONS);
  if (parsed.kind === "err") {
    stdio.stderr.writeSync(`${formatUsageError(parsed.error, "dev:check")}\n`);
    return 2;
  }
  if (parsed.value.kind === "help") {
    stdio.stdout.writeSync(`${helpText("dev:check", "Type-check and test the libraries a change affects, and those that depend on them.", OPTIONS)}\n`);
    return 0;
  }
  const o = parsed.value.options;
  const repo = o.repo === undefined ? repoRootOf(process.cwd()) : resolve(o.repo);
  if (repo === undefined) {
    stdio.stderr.writeSync("dev:check: no repository with commons/libraries here or above; give --repo DIR\n");
    return 2;
  }
  const look = currentLook("stdout");
  const t0 = performance.now();
  const files = commas(o.files ?? []);
  const only = commas(o.only ?? []);
  const scope: Scope = o.all
    ? { kind: "all" }
    : files.length > 0
      ? { kind: "files", files }
      : only.length > 0
        ? { kind: "only", names: only }
        : { kind: "since", base: o.base ?? (await defaultBase(repo)) };
  const found = await affectedOf(repo, scope);
  if (found.kind === "err") {
    stdio.stderr.writeSync(`dev:check: ${found.error}\n`);
    return 2;
  }
  const { libs, why } = found.value;
  const names = libs.map((l) => l.name);
  const stages: { readonly name: string; readonly outcome: Outcome }[] = [];
  let notes: readonly string[] = [];
  if (libs.length > 0 && !o.list) {
    const ready = await prepare(repo, libs);
    if (ready.kind === "err") {
      stdio.stderr.writeSync(`dev:check: ${ready.error}\n`);
      return 1;
    }
    notes = ready.value;
    const cpus = Math.max(2, globalThis.navigator?.hardwareConcurrency ?? 4);
    const width = Math.min(8, cpus);
    const [types, tests] = await Promise.all([
      o.types ? typeCheck(repo, libs, width) : Promise.resolve<Outcome>({ kind: "skipped", detail: "--no-types" }),
      o.tests ? runTests(repo, libs, cpus, o.bail) : Promise.resolve<Outcome>({ kind: "skipped", detail: "--no-tests" }),
    ]);
    stages.push({ name: "types", outcome: types }, { name: "tests", outcome: tests });
  }
  if (!o.list && o.license) stages.push({ name: "license", outcome: await licenseStage(repo) });
  for (const l of summaryLines(look, { why, libs: names }, stages, notes, seconds(t0))) stdio.stdout.writeSync(`${l}\n`);
  return stages.some((s) => s.outcome.kind === "failed") ? 1 : 0;
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
