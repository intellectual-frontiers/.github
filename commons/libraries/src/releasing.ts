/**
 * The release (commons 0001-libraries FR-013 to FR-015, 0026-works-versioning FR-022): versions grow here, at the release, and not on every push. One command plans what a release does and makes it, and writes the record
 * that the one release workflow reads.
 *
 *     bun commons/libraries/src/releasing.ts plan                    what a release would do, from the tags and the working tree; writes nothing (the default command)
 *     bun commons/libraries/src/releasing.ts apply                   raise the versions the plan says, make the generated files once, run the tests that pack, install and type-check every library, write the record
 *     bun commons/libraries/src/releasing.ts matrix --github-output F   what the release workflow builds and publishes, from the record, leaving out what is tagged (written as the outputs of a step)
 *     other flags: --repo DIR, and for apply --no-tests (leave out the tests that pack: for trying the command, never for a release)
 *
 * @remarks
 * A library is released at the version its manifest has, and its version is raised here and nowhere else: a library whose files changed since its last tag (its folder, and the paths its record adds) is raised by the greatest `Impact:`
 * of the commits since that tag (a patch where none states one), and a library that imports a library that is raised is raised by at least a patch, and so on up the imports. A library whose version is not tagged yet is released as it is,
 * whatever the tags say of earlier versions: a library that has never been tagged (the first release of it, or a backlog that was never tagged), or whose manifest is ahead of its last tag (a version raised by hand). A library whose
 * version is tagged and whose files did not change is left alone. The order of the release is the order of the imports, a library after the libraries it imports. The record, `commons/generated/release.auto.json`, lists what the release
 * workflow publishes and tags, in that order; it says nothing of a day or a person, so the same state gives the same bytes. Nothing here publishes, tags or commits: the workflow publishes and tags, and a person commits what `apply` made.
 *
 * @limits
 * The plan reads the tags of this repository, so a clone without its tags plans a first release of everything. It cannot know what a registry holds: the workflow asks it, and skips a version that is there. A work that is not a library
 * (`commons/ts`, `commons/docs`) is a Git dependency and is not released here.
 *
 * @example
 * ```ts
 * import { planRelease } from "./release.ts";
 * // a library whose version is tagged and whose files changed is raised; one that imports it is raised by a patch
 * ```
 *
 * Spec: 0001-libraries FR-013
 *
 * @module
 */
import process from "node:process";
import { absurd, err, ok, order, type Result } from "@intellectual-frontiers/core";
import { stdio } from "@intellectual-frontiers/system";
import { existsSync, mkdirSync, readTextFileSync, writeTextFileSync } from "@intellectual-frontiers/system/fs";
import { join, resolve } from "@intellectual-frontiers/system/path";
import { run } from "@intellectual-frontiers/system/proc";
import { currentLook, type Look } from "@intellectual-frontiers/system/tty";
import { flag, formatUsageError, helpText, type Operand, parseArgs, value } from "@intellectual-frontiers/terminal/args";
import { label, paint } from "@intellectual-frontiers/terminal/palette";
import { formatGitError } from "@intellectual-frontiers/system/git";
import { changedBetween, commitsSince, readTags, readWorkingTree, resolveCommit } from "@intellectual-frontiers/mizan/versions/git";
import { impactOfCommits } from "@intellectual-frontiers/mizan/versions/notes";
import { decodeReleaseSource, releaseSource, type Slug, slugOf, withVersion } from "@intellectual-frontiers/mizan/versions/record";
import { compareVersions, greaterImpact, type Impact, nextSemVer, parseVersion } from "@intellectual-frontiers/mizan/versions/scheme";
import { scopeOf, workFolders } from "@intellectual-frontiers/mizan/versions/works";
import { inputsOf } from "./affected.ts";
import { everyLibrary } from "./affected.ts";

/** The record of the release, from the repository's root. */
export const RECORD_PATH = "commons/generated/release.auto.json";

/** What the plan knows of a library: its version, what it imports, the last tag of it, whether its files changed since, and the impact the commits since state. */
export type Facts = {
  readonly slug: Slug;
  readonly folder: string;
  readonly version: string;
  /** The libraries (by slug) whose package its own sources import. */
  readonly imports: readonly Slug[];
  /** The greatest tag of the library by Semantic Version precedence, where it has one. */
  readonly last: { readonly version: string; readonly tag: string } | undefined;
  /** Whether a file of the library changed since `last`; false where there is none. */
  readonly changed: boolean;
  /** The greatest impact the commits since `last` state, a patch where none does. */
  readonly impact: Impact;
  /** Whether the release sends it to a registry: a library that names npm. */
  readonly publish: boolean;
};

/** What the release does to one library. */
export type Decision =
  | { readonly kind: "unchanged" }
  | { readonly kind: "as-is"; readonly why: "no-tag" | "ahead-of-tag" }
  | { readonly kind: "raised"; readonly to: string; readonly impact: Impact }
  | { readonly kind: "dependent"; readonly to: string; readonly because: readonly Slug[] };

/** One step of a release: a library, its version before and after, and what is done to it. */
export type Step = {
  readonly slug: Slug;
  readonly folder: string;
  readonly from: string;
  readonly to: string;
  readonly tag: string;
  readonly publish: boolean;
  readonly decision: Exclude<Decision, { readonly kind: "unchanged" }>;
};

/** The plan: every step in the order of the imports, and the libraries that are left alone. */
export type Plan = { readonly steps: readonly Step[]; readonly unchanged: readonly Slug[] };

const tagOf = (slug: string, version: string): string => `${slug}-v${version}`;

/** The text of a decision, in a sentence. */
export function describe(d: Decision, from: string): string {
  switch (d.kind) {
    case "unchanged":
      return "left alone: tagged, and no file changed since";
    case "as-is":
      return d.why === "no-tag" ? `released as it is (${from}): it has no tag yet` : `released as it is (${from}): its version is ahead of its last tag`;
    case "raised":
      return `raised to ${d.to} (${d.impact}): files changed since its last tag`;
    case "dependent":
      return `raised to ${d.to} (patch): it imports ${d.because.join(", ")}, which ${d.because.length === 1 ? "is" : "are"} raised`;
    default:
      return absurd(d);
  }
}

/**
 * The plan of a release from the facts of the libraries (FR-013): a library with no tag, or ahead of its last tag, is released as it is; one that is tagged at its version and changed is raised by its impact; one that is tagged,
 * unchanged and imports a library that is raised, directly or through another, is raised by a patch; the rest are left alone. A library whose version is below its last tag is an error, and so is a cycle of imports.
 */
export function planRelease(facts: readonly Facts[]): Result<Plan, string> {
  const by = new Map(facts.map((f) => [f.slug, f] as const));
  const decided = new Map<Slug, Decision>();
  for (const f of facts) {
    if (f.last === undefined) {
      decided.set(f.slug, { kind: "as-is", why: "no-tag" });
      continue;
    }
    const c = compare(f.version, f.last.version);
    if (c === undefined) return err(`${f.slug}: the version ${f.version} or the tag ${f.last.tag} is not a Semantic Version`);
    if (c < 0) return err(`${f.slug}: the version ${f.version} is below its last tag ${f.last.tag}: a version never goes back`);
    if (c > 0) decided.set(f.slug, { kind: "as-is", why: "ahead-of-tag" });
    else if (f.changed) {
      const to = nextSemVer(f.version, f.impact);
      if (to.kind === "err") return err(`${f.slug}: ${to.error}`);
      decided.set(f.slug, { kind: "raised", to: to.value, impact: f.impact });
    } else decided.set(f.slug, { kind: "unchanged" });
  }
  // a library that imports a raised library is raised by a patch, and so on up the imports
  for (let grew = true; grew; ) {
    grew = false;
    for (const f of facts) {
      if (decided.get(f.slug)?.kind !== "unchanged") continue;
      const because = f.imports.filter((i) => {
        const k = decided.get(i)?.kind;
        return k === "raised" || k === "dependent";
      });
      if (because.length === 0) continue;
      const to = nextSemVer(f.version, "patch");
      if (to.kind === "err") return err(`${f.slug}: ${to.error}`);
      decided.set(f.slug, { kind: "dependent", to: to.value, because });
      grew = true;
    }
  }
  const releasing = facts.filter((f) => decided.get(f.slug)?.kind !== "unchanged");
  const graph = new Map(releasing.map((f) => [f.slug, f.imports.filter((i) => by.has(i))] as const));
  const sorted = order(graph);
  if (sorted.kind === "err") return err(`the libraries import each other in a cycle: ${sorted.error.nodes.join(" -> ")}`);
  const steps: Step[] = [];
  for (const slug of sorted.value) {
    const f = by.get(slug);
    const d = decided.get(slug);
    if (f === undefined || d === undefined || d.kind === "unchanged") continue;
    const to = d.kind === "as-is" ? f.version : d.to;
    steps.push({ slug, folder: f.folder, from: f.version, to, tag: tagOf(slug, to), publish: f.publish, decision: d });
  }
  return ok({ steps, unchanged: facts.filter((f) => decided.get(f.slug)?.kind === "unchanged").map((f) => f.slug) });
}

function compare(a: string, b: string): number | undefined {
  const x = parseVersion("SemVer", a);
  const y = parseVersion("SemVer", b);
  return x.kind === "ok" && y.kind === "ok" ? compareVersions(x.value, y.value) : undefined;
}

/** The record the workflow reads, as the bytes of its file: the steps that publish or tag, in order. */
export function recordText(plan: Plan): string {
  const releases = plan.steps.map((s) => ({ slug: s.slug, version: s.to, folder: s.folder, tag: s.tag, publish: s.publish }));
  return `${JSON.stringify({ generated: "bun commons/libraries/src/releasing.ts apply; do not edit (commons 0001-libraries FR-014)", releases }, null, 2)}\n`;
}

/** One entry of the record, as the workflow reads it. */
export type Entry = { readonly slug: string; readonly version: string; readonly folder: string; readonly tag: string; readonly publish: boolean };

/** The entries of a record's text, or why it is not one. */
export function readRecord(text: string): Result<readonly Entry[], string> {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return err(`${RECORD_PATH} is not JSON`);
  }
  const list = typeof json === "object" && json !== null && "releases" in json ? json.releases : undefined;
  if (!Array.isArray(list)) return err(`${RECORD_PATH} has no list of releases`);
  const out: Entry[] = [];
  for (const e of list as readonly unknown[]) {
    if (typeof e !== "object" || e === null) return err(`${RECORD_PATH}: an entry is not an object`);
    const o = Object.fromEntries(Object.entries(e));
    const { slug, version, folder, tag, publish } = o;
    if (typeof slug !== "string" || typeof version !== "string" || typeof folder !== "string" || typeof tag !== "string" || typeof publish !== "boolean")
      return err(`${RECORD_PATH}: an entry lacks its slug, version, folder, tag or publish`);
    out.push({ slug, version, folder, tag, publish });
  }
  return ok(out);
}

/** What the workflow builds and publishes: the entries whose tag is not there yet, as the cells of a matrix and the sequence to publish in, as the outputs of a step. */
export function matrixOutputs(entries: readonly Entry[], tagged: ReadonlySet<string>): string {
  const todo = entries.filter((e) => !tagged.has(e.tag));
  const build = { include: todo.filter((e) => e.publish).map((e) => ({ slug: e.slug, folder: e.folder, version: e.version, tag: e.tag })) };
  const sequence = todo.map((e) => ({ slug: e.slug, version: e.version, tag: e.tag, publish: e.publish }));
  return [`has-build=${build.include.length > 0 || sequence.length > 0}`, `build=${JSON.stringify(build)}`, `sequence=${JSON.stringify(sequence)}`].join("\n");
}

const set = (text: string, pattern: RegExp, to: string): string | undefined => (pattern.test(text) ? text.replace(pattern, to) : undefined);

/** Writes a library's new version into its record, its manifest and its package, each where it says the version; the problem where one does not. */
export function writeVersion(repo: string, step: Step): Result<readonly string[], string> {
  const files: string[] = [];
  const record = join(repo, step.folder, "release.ts");
  // a library that has no record of its own (it is not a work of the register yet) has its version in its manifest and its package alone
  if (existsSync(record)) {
    const decoded = decodeReleaseSource(readTextFileSync(record));
    if (decoded.kind === "err") return err(`${step.folder}/release.ts does not decode`);
    writeTextFileSync(record, releaseSource(withVersion(decoded.value, step.to)));
    files.push(`${step.folder}/release.ts`);
  }
  for (const [file, pattern, to] of [
    [`${step.folder}/library.ts`, /(\bversion"?:\s*)"[^"]*"/, `$1"${step.to}"`],
    [`${step.folder}/package.json`, /("version":\s*)"[^"]*"/, `$1"${step.to}"`],
  ] as const) {
    const at = join(repo, file);
    if (!existsSync(at)) return err(`${file} is missing`);
    const changed = set(readTextFileSync(at), pattern, to);
    if (changed === undefined) return err(`${file} does not say its version`);
    writeTextFileSync(at, changed);
    files.push(file);
  }
  return ok(files);
}

/** What the host gives the plan: the facts of the libraries from the tags and the tree. */
export async function factsOf(repo: string): Promise<Result<readonly Facts[], string>> {
  const tree = await readWorkingTree(repo);
  if (tree.kind === "err") return err(formatGitError(tree.error));
  const tags = await readTags(repo);
  if (tags.kind === "err") return err(formatGitError(tags.error));
  const head = await resolveCommit(repo, "HEAD");
  if (head.kind === "err") return err(formatGitError(head.error));
  const folders = workFolders(tree.value.paths);
  const libs = everyLibrary(repo);
  const slugs = new Map<string, Slug>();
  for (const l of libs) {
    const s = slugOf(l.name);
    if (s !== undefined) slugs.set(l.name, s);
  }
  const out: Facts[] = [];
  for (const l of libs) {
    const slug = slugs.get(l.name);
    const text = tree.value.records.get(l.folder);
    const record = text === undefined ? undefined : decodeReleaseSource(text);
    if (slug === undefined) return err(`${l.name} is not a slug`);
    if (record?.kind === "err") return err(`${l.folder}/release.ts does not decode`);
    let last: { readonly version: string; readonly tag: string; readonly commit: string } | undefined;
    for (const t of tags.value) {
      if (!t.name.startsWith(`${slug}-v`)) continue;
      const version = t.name.slice(slug.length + 2);
      const v = parseVersion("SemVer", version);
      if (v.kind === "err") continue;
      const best = last === undefined ? undefined : parseVersion("SemVer", last.version);
      if (last === undefined || (best?.kind === "ok" && compareVersions(v.value, best.value) === 1)) last = { version, tag: t.name, commit: t.commit };
    }
    const inScope = scopeOf(l.folder, folders, record?.value.exclude ?? [], record?.value.paths ?? []);
    let changed = false;
    let impact: Impact = "patch";
    if (last !== undefined) {
      const files = await changedBetween(repo, last.commit, head.value);
      if (files.kind === "err") return err(formatGitError(files.error));
      changed = files.value.some(inScope);
      const commits = await commitsSince(repo, last.commit);
      if (commits.kind === "err") return err(formatGitError(commits.error));
      impact = impactOfCommits(commits.value.filter((c) => c.files.some(inScope))) ?? "patch";
    }
    const imports = inputsOf(repo, l.name).imports.flatMap((n) => {
      const s = slugs.get(n);
      return s === undefined ? [] : [s];
    });
    out.push({
      slug,
      folder: l.folder,
      version: l.version,
      imports,
      last: last === undefined ? undefined : { version: last.version, tag: last.tag },
      changed,
      impact: greaterImpact("patch", impact),
      publish: l.distribution.includes("npm"),
    });
  }
  return ok(out);
}

/** The commands that make the generated files, in the order they are made: the section of the libraries first, the register last. Each is run once, by `apply`. */
export const GENERATORS: readonly (readonly string[])[] = [
  ["commons/libraries/src/libraries.ts"],
  ["commons/tools/generate-packaging.ts"],
  ["commons/libraries/src/generate-ontology.ts"],
  ["commons/libraries/src/generate-workflows.ts"],
  ["commons/libraries/src/oscal-register.ts"],
];

/** The tests that pack every library, install it into a consumer and type-check against it (the heavy proof a release asks for and a push does not). */
export const PACKAGE_TESTS: readonly string[] = ["bun", "test", "./tests/release/"];

/** What `apply` runs besides the planner: the generators and the tests, which a test of this module replaces. */
export type Host = {
  readonly generate: (repo: string, command: readonly string[]) => Promise<Result<void, string>>;
  readonly prove: (repo: string) => Promise<Result<void, string>>;
};

/** The real host: each command run with Bun from the repository's root. */
export const REAL: Host = {
  generate: async (repo, command) => {
    const r = await run(["bun", ...command], { cwd: repo });
    return r.code === 0 ? ok(undefined) : err(`${command.join(" ")} ended with ${r.code}: ${`${r.stdout}${r.stderr}`.trim().split("\n").slice(-8).join("\n")}`);
  },
  prove: async (repo) => {
    const r = await run(PACKAGE_TESTS, { cwd: repo });
    return r.code === 0 ? ok(undefined) : err(`${PACKAGE_TESTS.join(" ")} ended with ${r.code}:\n${`${r.stdout}${r.stderr}`.trim().split("\n").slice(-30).join("\n")}`);
  },
};

/** What `apply` did: the files written, in order. */
export type Applied = { readonly plan: Plan; readonly written: readonly string[] };

/** Makes the release (FR-014): raises the versions of the plan, makes the generated files once, runs the tests that pack unless asked not to, and writes the record. */
export async function applyRelease(repo: string, host: Host, options: { readonly tests: boolean }): Promise<Result<Applied, string>> {
  const facts = await factsOf(repo);
  if (facts.kind === "err") return facts;
  const planned = planRelease(facts.value);
  if (planned.kind === "err") return planned;
  const written: string[] = [];
  for (const step of planned.value.steps) {
    if (step.decision.kind === "as-is") continue;
    const w = writeVersion(repo, step);
    if (w.kind === "err") return w;
    written.push(...w.value);
  }
  for (const g of GENERATORS) {
    const r = await host.generate(repo, g);
    if (r.kind === "err") return r;
  }
  if (options.tests) {
    const proved = await host.prove(repo);
    if (proved.kind === "err") return proved;
  }
  mkdirSync(join(repo, RECORD_PATH, ".."), { recursive: true });
  writeTextFileSync(join(repo, RECORD_PATH), recordText(planned.value));
  written.push(RECORD_PATH);
  return ok({ plan: planned.value, written });
}

/** The lines the plan prints: one for each library that is released, and the libraries left alone. */
export function planLines(look: Look, plan: Plan): readonly string[] {
  if (plan.steps.length === 0) return [`${label("skipped", "nothing to release: every library is tagged at its version and unchanged", look)}`];
  const out = plan.steps.map(
    (s) => `${label("action", `${s.slug} ${s.from === s.to ? s.to : `${s.from} -> ${s.to}`}${s.publish ? "" : " (tag only)"}`, look)}  ${paint("dim", describe(s.decision, s.from), look)}`,
  );
  if (plan.unchanged.length > 0) out.push(`${paint("dim", `left alone (${plan.unchanged.length}): ${plan.unchanged.join(", ")}`, look)}`);
  return out;
}

const COMMANDS = ["plan", "apply", "matrix"] as const;
type Command = (typeof COMMANDS)[number];
const isCommand = (t: string): t is Command => (COMMANDS as readonly string[]).includes(t);

const OPTIONS = {
  repo: value({ help: "The repository (the working folder by default).", valueName: "DIR", default: "." }),
  tests: flag({ help: "Run the tests that pack, install and type-check every library (on by default; apply only).", negatable: true, default: true }),
  githubOutput: value({ help: "Append the outputs to this file, as a step's `$GITHUB_OUTPUT` is read (matrix only).", valueName: "FILE" }),
};
const WORDS: readonly Operand[] = [{ name: "COMMAND", help: "plan, apply or matrix (plan by default).", arity: "optional" }];

/** The command line. Returns the exit status: 0, 1 where a plan or a step failed, 2 for a command line that does not fit. */
export async function main(argv: readonly string[], host: Host = REAL): Promise<number> {
  const parsed = parseArgs(argv, OPTIONS, WORDS);
  if (parsed.kind === "err") {
    stdio.stderr.writeSync(`${formatUsageError(parsed.error, "release")}\n`);
    return 2;
  }
  if (parsed.value.kind === "help") {
    stdio.stdout.writeSync(`${helpText("release", "Plan, make and read a release: versions grow here, at the release.", OPTIONS, WORDS)}\n`);
    return 0;
  }
  const word = parsed.value.positionals[0] ?? "plan";
  if (!isCommand(word)) {
    stdio.stderr.writeSync(`release: ${word} is not a command (${COMMANDS.join(", ")})\n`);
    return 2;
  }
  const repo = resolve(parsed.value.options.repo);
  const look = currentLook("stdout");
  const say = (t: string): void => void stdio.stdout.writeSync(`${t}\n`);
  switch (word) {
    case "plan": {
      const facts = await factsOf(repo);
      const planned = facts.kind === "err" ? facts : planRelease(facts.value);
      if (planned.kind === "err") {
        stdio.stderr.writeSync(`release: ${planned.error}\n`);
        return 1;
      }
      for (const l of planLines(look, planned.value)) say(l);
      return 0;
    }
    case "apply": {
      const done = await applyRelease(repo, host, { tests: parsed.value.options.tests });
      if (done.kind === "err") {
        stdio.stderr.writeSync(`release: ${done.error}\n`);
        return 1;
      }
      for (const l of planLines(look, done.value.plan)) say(l);
      say(`${label("done", `${done.value.written.length} files written; commit them, push to main, then run the workflow release`, look)}`);
      return 0;
    }
    case "matrix": {
      const file = join(repo, RECORD_PATH);
      const entries = existsSync(file) ? readRecord(readTextFileSync(file)) : err(`${RECORD_PATH} is missing: run release apply`);
      if (entries.kind === "err") {
        stdio.stderr.writeSync(`release: ${entries.error}\n`);
        return 1;
      }
      const tags = await readTags(repo);
      if (tags.kind === "err") {
        stdio.stderr.writeSync(`release: ${formatGitError(tags.error)}\n`);
        return 1;
      }
      const text = matrixOutputs(entries.value, new Set(tags.value.map((t) => t.name)));
      const out = parsed.value.options.githubOutput;
      if (out === undefined) say(text);
      else writeTextFileSync(out, `${text}\n`, { append: true });
      return 0;
    }
    default:
      return absurd(word);
  }
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
