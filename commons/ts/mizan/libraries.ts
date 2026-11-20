/**
 * The manifest of a library of commons (commons 0027-commons-libraries FR-011 to FR-014) and the requirements it makes: a library is a folder `commons/<name>/` that holds `library.ts`, an
 * object literal read as data and never run, and this repository knows it from that file alone. The decoder of the manifest, the check that a manifest and its folder agree, and the generator of
 * the section "The libraries" of 0027-commons-libraries and of its rows of `enforcement.tsv`.
 *
 *     bun commons/ts/mizan/libraries.ts            write the section and the rows again from the manifests
 *     bun commons/ts/mizan/libraries.ts --check    write nothing and exit 1 where a file is not what the manifests make, or where a manifest and its folder disagree
 *     other flags: --repo DIR (the repository, the working folder by default)
 *
 * @remarks
 * A manifest declares the library's `name` (its folder), its conformance `level` (`L1` where it declares none, 0028-conformance-levels), the path of its spec kit, its `verify` command, its
 * `version`, its `exports` (the keys of the package's `exports`) and its `distribution` (the registries it is published to: `github`, the default, and `npm` as well where a decision about that package has made it so; FR-015 to FR-018). The section "The libraries" of the specification is between the markers `<!-- libraries:begin -->` and `<!-- libraries:end -->`,
 * one requirement for each library numbered from FR-101, an id kept for the life of the library; the rows of those requirements are in `enforcement.tsv`. Adding a library is adding a folder with a manifest and
 * running this command.
 *
 * @limits
 * It reads files and writes two; it runs no library's `verify` (`check.ts --all` does, 0028-conformance-levels FR-012), and it does not read inside a library but its manifest, its package and the files that name its spec kit.
 *
 * @example
 * ```ts
 * import { decodeLibrarySource } from "./libraries.ts";
 * const r = decodeLibrarySource('export const library = { name: "x", verify: "bun run verify", version: "0.1.0", exports: [] };');
 * r.kind; // "ok"
 * ```
 *
 * @module
 */
import process from "node:process";
import {
  array,
  type Decoder,
  describe,
  formatDecodeError,
  literal,
  object,
  string,
  err,
  ok,
  type Result,
} from "@intellectual-frontiers/core";
import { exportedLiteral } from "../kernel/ts-literal.ts";
import { existsSync, readDirSync, readTextFileSync, writeTextFileSync } from "../runtime/fs.ts";
import { stdio } from "../runtime/mod.ts";
import { spawn } from "../runtime/proc.ts";
import { DEFAULT_LIBRARY_LEVEL, LEVELS, type LevelKey, rankOf } from "./levels.ts";

/** The name of a library's manifest in its folder. */
export const LIBRARY_FILE = "library.ts";

/** The specification that holds the requirements of the libraries, and the first number of the requirements it generates. */
export const LIBRARIES_SPEC = "0027-commons-libraries";
/** The first requirement number of the section "The libraries", which is generated (0027-commons-libraries FR-011). */
export const FIRST_GENERATED = 101;
/** The marker that opens the generated section, and the one that closes it. */
export const BEGIN = "<!-- libraries:begin -->";
export const END = "<!-- libraries:end -->";

/** Where the generated section begins and ends: the markers on lines of their own (a requirement may name them in its text). */
function bounds(spec: string): { readonly from: number; readonly to: number } | undefined {
  const from = spec.indexOf(`\n${BEGIN}\n`);
  const to = spec.indexOf(`\n${END}\n`, from);
  return from < 0 || to < 0 ? undefined : { from: from + 1, to: to + 1 };
}

/** A library's manifest. */
export type Library = {
  /** The folder's name, and the package's: `@intellectual-frontiers/<name>`. */
  readonly name: string;
  /** The conformance level the library is held to (`L1` where the manifest declares none). */
  readonly level: LevelKey;
  /** The path of its spec kit from its folder; none at L0. */
  readonly specKit?: string;
  /** The command that proves it, run from its folder with no argument. */
  readonly verify: string;
  /** Its version: the package's. */
  readonly version: string;
  /** The keys of the package's `exports`. */
  readonly exports: readonly string[];
  /** What it is, in a sentence, for the requirement made of it. */
  readonly summary?: string;
  /** Where it is published: always `github` (the GitHub package registry of the organization), and `npm` as well where a decision about that package has made it so (FR-015 and FR-016). */
  readonly distribution: readonly Registry[];
};

/** The registries a library may be published to: the kinds only, never a host or a credential (0027-commons-libraries FR-018). */
export const REGISTRIES = ["github", "npm"] as const;
export type Registry = (typeof REGISTRIES)[number];
/** Where a manifest that declares no distribution is published. */
export const DEFAULT_DISTRIBUTION: readonly Registry[] = ["github"];

const nonEmpty: Decoder<string> = (input, path = "$") => {
  const r = string(input, path);
  if (r.kind === "err") return r;
  return r.value.trim() === "" ? err({ kind: "decode", path, expected: "a non-empty string", found: describe(input) }) : r;
};
const nameDecoder: Decoder<string> = (input, path = "$") => {
  const r = string(input, path);
  if (r.kind === "err") return r;
  return /^[a-z][a-z0-9-]*$/.test(r.value)
    ? r
    : err({ kind: "decode", path, expected: "a name of lower-case letters, digits and hyphens", found: describe(input) });
};
const body = object(
  { name: nameDecoder, verify: nonEmpty, version: nonEmpty, exports: array(nonEmpty) },
  { level: literal(...LEVELS), specKit: nonEmpty, summary: nonEmpty, distribution: array(literal(...REGISTRIES)) },
);
const FIELDS = ["name", "level", "specKit", "verify", "version", "exports", "summary", "distribution"] as const;

/** The manifest read from the text of its file: `export const library = { ... }` and no other export, read as data and never run (0027-commons-libraries FR-012). */
export function decodeLibrarySource(source: string): Result<Library, string> {
  const exports = source.split("\n").filter((l) => /^export\s/.test(l));
  if (exports.length !== 1) return err(`a manifest exports only library, and this file has ${exports.length} exports`);
  const lit = exportedLiteral(source, "library");
  if (lit.kind === "err") return err(`the manifest is not a literal: ${lit.error.expected}`);
  const input = lit.value;
  if (typeof input === "object" && input !== null && !Array.isArray(input)) {
    const known: readonly string[] = FIELDS;
    const bad = Object.keys(input).find((k) => !known.includes(k));
    if (bad !== undefined) return err(`library.${bad} is an unknown field (a manifest has ${FIELDS.join(", ")})`);
  }
  const r = body(input, "library");
  if (r.kind === "err") return err(formatDecodeError(r.error));
  const v = r.value;
  const distribution = v.distribution ?? DEFAULT_DISTRIBUTION;
  if (distribution.length === 0 || new Set(distribution).size !== distribution.length)
    return err("library.distribution lists each registry once and at least one (FR-015)");
  if (!distribution.includes("github"))
    return err(
      "library.distribution includes github: a library is published to the GitHub package registry whatever else it is published to (FR-015, FR-016)",
    );
  return ok({
    name: v.name,
    level: v.level ?? DEFAULT_LIBRARY_LEVEL,
    ...(v.specKit === undefined ? {} : { specKit: v.specKit }),
    verify: v.verify,
    version: v.version,
    exports: v.exports,
    ...(v.summary === undefined ? {} : { summary: v.summary }),
    distribution,
  });
}

/** A library found in the folder of commons: its folder and what its manifest says, or why it cannot be read. */
export type Found = { readonly dir: string; readonly library: Library } | { readonly dir: string; readonly problem: string };

/** The manifests of `commons/*`, in the order of the folders' names: every folder that holds a `library.ts`. */
export function readLibraries(repo: string): readonly Found[] {
  const commons = `${repo.replace(/[\\/]$/, "")}/commons`;
  if (!existsSync(commons)) return [];
  return readDirSync(commons)
    .filter((e) => e.isDirectory && existsSync(`${commons}/${e.name}/${LIBRARY_FILE}`))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .map((e): Found => {
      const r = decodeLibrarySource(readTextFileSync(`${commons}/${e.name}/${LIBRARY_FILE}`));
      return r.kind === "ok" ? { dir: e.name, library: r.value } : { dir: e.name, problem: r.error };
    });
}

/** The keys of a package's `exports`, its name and version and the scripts it has, read from `package.json`. */
function packageOf(file: string): {
  readonly name?: string;
  readonly version?: string;
  readonly exports: readonly string[];
  readonly scripts: readonly string[];
} {
  const raw: unknown = JSON.parse(readTextFileSync(file));
  const o = typeof raw === "object" && raw !== null ? raw : {};
  const field = (k: string): unknown => Object.entries(o).find(([n]) => n === k)?.[1];
  const keys = (v: unknown): readonly string[] => (typeof v === "object" && v !== null ? Object.keys(v) : []);
  const name = field("name");
  const version = field("version");
  return {
    ...(typeof name === "string" ? { name } : {}),
    ...(typeof version === "string" ? { version } : {}),
    exports: keys(field("exports")),
    scripts: keys(field("scripts")),
  };
}

/** The script a verify command runs: `bun run verify` runs the script `verify`. */
function scriptOf(verify: string): string | undefined {
  return /^bun run ([A-Za-z0-9:_-]+)$/.exec(verify)?.[1];
}

/**
 * What is wrong where a manifest and its folder disagree (0027-commons-libraries FR-013), one sentence each: a folder with a spec kit and no manifest, a manifest that cannot be read, that names another
 * folder, a level above L0 with no spec kit, a spec kit that is not there, a package of another name, a version that is not the package's, exports that are not the package's, and a verify that is no script of the package.
 */
export function manifestFindings(repo: string): readonly string[] {
  const root = repo.replace(/[\\/]$/, "");
  const commons = `${root}/commons`;
  const found: string[] = [];
  const have = readLibraries(root);
  for (const e of existsSync(commons) ? readDirSync(commons) : [])
    if (e.isDirectory && existsSync(`${commons}/${e.name}/spec-kit`) && !have.some((l) => l.dir === e.name))
      found.push(`commons/${e.name} has a spec kit and no ${LIBRARY_FILE}: a library declares itself (FR-012)`);
  for (const f of have) {
    const dir = `${commons}/${f.dir}`;
    if ("problem" in f) {
      found.push(`commons/${f.dir}/${LIBRARY_FILE}: ${f.problem} (FR-012)`);
      continue;
    }
    const l = f.library;
    if (l.name !== f.dir) found.push(`commons/${f.dir}/${LIBRARY_FILE} is named ${l.name}, and its folder is ${f.dir} (FR-013)`);
    if (rankOf(l.level) >= 1 && l.specKit === undefined)
      found.push(`commons/${f.dir}/${LIBRARY_FILE} declares ${l.level} and no spec kit, which a level above L0 asks (FR-013)`);
    if (l.specKit !== undefined && !existsSync(`${dir}/${l.specKit}/registry.tsv`))
      found.push(`commons/${f.dir}: the spec kit ${l.specKit} the manifest names has no registry.tsv (FR-013)`);
    if (!existsSync(`${dir}/package.json`)) {
      found.push(`commons/${f.dir}/package.json is missing (FR-013)`);
      continue;
    }
    const pkg = packageOf(`${dir}/package.json`);
    if (pkg.name !== `@intellectual-frontiers/${l.name}`)
      found.push(`commons/${f.dir}/package.json is not named @intellectual-frontiers/${l.name} (FR-013)`);
    if (pkg.version !== l.version)
      found.push(`commons/${f.dir}: the manifest says version ${l.version} and the package says ${pkg.version ?? "none"} (FR-013)`);
    const missing = l.exports.filter((x) => !pkg.exports.includes(x));
    const extra = pkg.exports.filter((x) => !l.exports.includes(x));
    if (missing.length > 0 || extra.length > 0)
      found.push(
        `commons/${f.dir}: the manifest and the package disagree on exports (${[...missing.map((x) => `${x} is not the package's`), ...extra.map((x) => `${x} is not the manifest's`)].join("; ")}) (FR-013)`,
      );
    const script = scriptOf(l.verify);
    if (script === undefined || !pkg.scripts.includes(script))
      found.push(`commons/${f.dir}: the verify command ${JSON.stringify(l.verify)} is not a script of the package (FR-013)`);
    const verifyText = script === undefined ? "" : scriptText(`${dir}/package.json`, script);
    if (rankOf(l.level) >= 1 && rankOf(l.level) < rankOf("L3") && !verifyText.includes(`--level ${l.level}`))
      found.push(
        `commons/${f.dir}: the manifest declares ${l.level} and the verify script does not run the Mizan check with --level ${l.level} (0028-conformance-levels FR-013)`,
      );
  }
  return found;
}

/** A field of a value read from JSON, `undefined` where the value is not an object or has no such field. */
function fieldOf(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null ? Object.entries(value).find(([n]) => n === key)?.[1] : undefined;
}

function scriptText(file: string, script: string): string {
  const raw: unknown = JSON.parse(readTextFileSync(file));
  const text = fieldOf(fieldOf(raw, "scripts"), script);
  return typeof text === "string" ? text : "";
}

/** The ontology's name for a level of a manifest: `mz:Registered`, `mz:Core`, `mz:Standards` or `mz:Governed`. */
const LEVEL_TERM: Readonly<Record<LevelKey, string>> = { L0: "mz:Registered", L1: "mz:Core", L2: "mz:Standards", L3: "mz:Governed" };

/** How a registry is named in the requirement of a library. */
const REGISTRY_NAME: Readonly<Record<Registry, string>> = { github: "the GitHub package registry", npm: "npm" };

const list = (items: readonly string[]): string => {
  const quoted = items.map((i) => `\`${i}\``);
  return quoted.length <= 1 ? (quoted[0] ?? "no exports") : `${quoted.slice(0, -1).join(", ")} and ${quoted[quoted.length - 1] ?? ""}`;
};

/** The requirement of a library, as the section "The libraries" holds it (FR-014): one line. */
export function requirementOf(id: string, l: Library): string {
  const kit = l.specKit === undefined ? "" : `, its spec kit at \`commons/${l.name}/${l.specKit}\``;
  const summary = l.summary === undefined ? "" : ` ${l.summary}`;
  const where = l.distribution.map((r) => REGISTRY_NAME[r]).join(" and ");
  return `- **${id}**: \`commons/${l.name}\` MUST be a library at conformance level ${l.level} (\`${LEVEL_TERM[l.level]}\`): the package \`@intellectual-frontiers/${l.name}\` at version \`${l.version}\`${kit}, exporting ${list(l.exports)}, published to ${where}, proved by \`cd commons/${l.name} && ${l.verify}\`.${summary}`;
}

/** The row of `enforcement.tsv` of a library's requirement. */
export function rowOf(id: string, l: Library): string {
  const kit = l.specKit === undefined ? "its manifest" : "its compiler, specification checker, rules and tests";
  return `${LIBRARIES_SPEC} ${id}\tcheck\t.github: cd commons/${l.name} && ${l.verify}\tcommons/${l.name}: the verify of the library (${kit}); the manifest ${LIBRARY_FILE} agrees with the folder and the package (commons-libraries.test.ts)`;
}

/** The ids the section already gives each library, by name, read from its text between the markers. */
export function idsIn(spec: string): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  const b = bounds(spec);
  if (b === undefined) return out;
  for (const line of spec.slice(b.from, b.to).split("\n")) {
    const m = /^- \*\*(FR-\d+)\*\*: `commons\/([a-z][a-z0-9-]*)`/.exec(line);
    if (m?.[1] !== undefined && m[2] !== undefined) out.set(m[2], m[1]);
  }
  return out;
}

/** The id each library has: the one it had, or the next number after the greatest. */
export function idsFor(libraries: readonly Library[], had: ReadonlyMap<string, string>): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  let next = Math.max(FIRST_GENERATED - 1, ...[...had.values()].map((id) => Number(id.slice(3)))) + 1;
  for (const l of libraries) {
    const id = had.get(l.name);
    if (id !== undefined) out.set(l.name, id);
    else out.set(l.name, `FR-${String(next++).padStart(3, "0")}`);
  }
  return out;
}

/** The text of the specification and of the register, made again from the libraries: nothing where the specification has no markers. */
export function generated(
  spec: string,
  enforcement: string,
  libraries: readonly Library[],
): Result<{ readonly spec: string; readonly enforcement: string }, string> {
  const b = bounds(spec);
  if (b === undefined)
    return err(`${LIBRARIES_SPEC} has no ${BEGIN} and ${END}, each on a line of its own, around the section "The libraries"`);
  const ids = idsFor(libraries, idsIn(spec));
  // in the order of their numbers, which a library keeps for its life: a library added later is after those that were there, whatever its name
  const byNumber = [...libraries].sort((a, b) => Number((ids.get(a.name) ?? "").slice(3)) - Number((ids.get(b.name) ?? "").slice(3)));
  const lines = byNumber.map((l) => requirementOf(ids.get(l.name) ?? "", l));
  const newSpec = `${spec.slice(0, b.from + BEGIN.length)}\n\n${lines.join("\n")}\n\n${spec.slice(b.to)}`;
  const rows = byNumber.map((l) => rowOf(ids.get(l.name) ?? "", l));
  const kept = enforcement.split("\n").filter((l) => l !== "" && !new RegExp(`^${LIBRARIES_SPEC} FR-(?:[1-9]\\d{2,})\\t`).test(l));
  const last = kept.map((l, i) => (l.startsWith(`${LIBRARIES_SPEC} `) ? i : -1)).reduce((a, b) => Math.max(a, b), -1);
  const at = last < 0 ? kept.length : last + 1;
  return ok({ spec: newSpec, enforcement: `${[...kept.slice(0, at), ...rows, ...kept.slice(at)].join("\n")}\n` });
}

const SPEC_FILE = (repo: string): string => `${repo}/commons/spec-kit/specs/${LIBRARIES_SPEC}/spec.md`;
const ENFORCEMENT_FILE = (repo: string): string => `${repo}/commons/spec-kit/enforcement.tsv`;

/** The files that are not what the manifests make (relative to the repository), and what is wrong with the manifests; with `write`, the files are written. */
export function synchronize(repo: string, write: boolean): { readonly stale: readonly string[]; readonly problems: readonly string[] } {
  const root = repo.replace(/[\\/]$/, "");
  const have = readLibraries(root);
  const problems = [
    ...have.flatMap((f) => ("problem" in f ? [`commons/${f.dir}/${LIBRARY_FILE}: ${f.problem}`] : [])),
    ...manifestFindings(root),
  ];
  const libraries = have.flatMap((f) => ("library" in f ? [f.library] : []));
  const spec = readTextFileSync(SPEC_FILE(root)).replace(/\r\n/g, "\n"); // a Windows checkout may hold CRLF; the markers are found on lines of LF
  const enforcement = readTextFileSync(ENFORCEMENT_FILE(root)).replace(/\r\n/g, "\n");
  const made = generated(spec, enforcement, libraries);
  if (made.kind === "err") return { stale: [], problems: [...problems, made.error] };
  const stale: string[] = [];
  if (made.value.spec !== spec) {
    stale.push(`commons/spec-kit/specs/${LIBRARIES_SPEC}/spec.md`);
    if (write) writeTextFileSync(SPEC_FILE(root), made.value.spec);
  }
  if (made.value.enforcement !== enforcement) {
    stale.push("commons/spec-kit/enforcement.tsv");
    if (write) writeTextFileSync(ENFORCEMENT_FILE(root), made.value.enforcement);
  }
  return { stale, problems };
}

/** The result of one library's `verify`. */
export type Verified = { readonly name: string; readonly code: number };

/** Runs the `verify` of every library a manifest declares, each from its own folder, and gives each status (0028-conformance-levels FR-012). */
export async function verifyAll(repo: string): Promise<readonly Verified[]> {
  const root = repo.replace(/[\\/]$/, "");
  const out: Verified[] = [];
  for (const f of readLibraries(root)) {
    if ("problem" in f) {
      out.push({ name: f.dir, code: 1 });
      continue;
    }
    stdio.stderr.writeSync(`verify ${f.dir}: ${f.library.verify}\n`);
    const [cmd, ...args] = f.library.verify.split(" ");
    try {
      await using child = spawn([cmd ?? "", ...args], { cwd: `${root}/commons/${f.dir}` });
      const status = await child.status;
      out.push({ name: f.dir, code: status.code });
    } catch (e) {
      stdio.stderr.writeSync(`verify ${f.dir}: ${e instanceof Error ? e.message : String(e)}\n`);
      out.push({ name: f.dir, code: 1 });
    }
  }
  return out;
}

/** The command line. Returns the exit status: 0, or 1 where a file is not what the manifests make or a manifest and its folder disagree. */
export function main(argv: readonly string[]): number {
  const at = argv.indexOf("--repo");
  const repo = at >= 0 ? (argv[at + 1] ?? ".") : ".";
  const check = argv.includes("--check");
  const r = synchronize(repo, !check);
  for (const p of r.problems) stdio.stderr.writeSync(`${p}\n`);
  for (const s of r.stale)
    stdio.stderr.writeSync(check ? `${s} is not what the manifests make; run: bun commons/ts/mizan/libraries.ts\n` : `wrote ${s}\n`);
  return r.problems.length > 0 || (check && r.stale.length > 0) ? 1 : 0;
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
