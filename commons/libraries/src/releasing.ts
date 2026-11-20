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
import { createHash } from "node:crypto";
import process from "node:process";
import { gunzipSync } from "node:zlib";
import { absurd, err, ok, order, type Result } from "@intellectual-frontiers/core";
import { stdio } from "@intellectual-frontiers/system";
import { existsSync, mkdirSync, readDirSync, readFileSync, readTextFileSync, writeTextFileSync } from "@intellectual-frontiers/system/fs";
import { join, resolve } from "@intellectual-frontiers/system/path";
import { env, run } from "@intellectual-frontiers/system/proc";
import { currentLook, type Look } from "@intellectual-frontiers/system/tty";
import { flag, formatUsageError, helpText, many, type Operand, parseArgs, value } from "@intellectual-frontiers/terminal/args";
import { label, paint } from "@intellectual-frontiers/terminal/palette";
import { formatGitError } from "@intellectual-frontiers/system/git";
import { changedBetween, commitsSince, readTags, readWorkingTree, resolveCommit } from "@intellectual-frontiers/mizan/versions/git";
import { impactOfCommits } from "@intellectual-frontiers/mizan/versions/notes";
import { decodeReleaseSource, releaseSource, type Slug, slugOf, withVersion } from "@intellectual-frontiers/mizan/versions/record";
import { compareVersions, greaterImpact, type Impact, nextSemVer, parseVersion } from "@intellectual-frontiers/mizan/versions/scheme";
import { scopeOf, workFolders } from "@intellectual-frontiers/mizan/versions/works";
import { inputsOf } from "./affected.ts";
import { exportsLine } from "./plan.ts";
import { decodeLibrarySource, LIBRARY_FILE, publishedPackage, type VersionConstant } from "./libraries.ts";
import { membersOf } from "./metapackages.ts";
import { everyLibrary } from "./affected.ts";

/** The record of the release, from the repository's root. */
export const RECORD_PATH = "commons/generated/release.auto.json";

/** What the plan knows of a library: its version, what it imports, the last tag of it, whether its files changed since, and the impact the commits since state. */
export type Facts = {
  readonly slug: Slug;
  readonly folder: string;
  /** The package the library publishes: `@intellectual-frontiers/<slug>`, or the one its manifest names in `publishes` (commons 0036-distribution FR-009). */
  readonly package: string;
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
  /** For a version that is not tagged or is ahead of its tag: what npm holds of this version, compared with the files of the library. */
  readonly registry: Drift;
  /** Whether a file of the library changed since the last commit that raised its version, and the impact the commits since state (a patch where none does): the fallback where npm cannot be compared. */
  readonly sinceVersion: { readonly changed: boolean; readonly impact: Impact };
};

/** What npm holds of a version, against the files of the library: not there, there and the same, there and different, or not known (offline, or the registry did not say). */
export type Drift = "absent" | "same" | "differs" | "unknown";

/** Why a library is raised. */
export type Why = "changed" | "differs-from-npm" | "changed-since-version" | "manual";

/** What the release does to one library. */
export type Decision =
  | { readonly kind: "unchanged" }
  | { readonly kind: "as-is"; readonly why: "no-tag" | "ahead-of-tag"; readonly npm: Drift }
  | { readonly kind: "raised"; readonly to: string; readonly impact: Impact; readonly why: Why }
  | { readonly kind: "dependent"; readonly to: string; readonly because: readonly Slug[] };

/** One step of a release: a library, its version before and after, and what is done to it. */
export type Step = {
  readonly slug: Slug;
  readonly folder: string;
  readonly package: string;
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
    case "as-is": {
      const because = d.why === "no-tag" ? "it has no tag yet" : "its version is ahead of its last tag";
      const npm =
        d.npm === "absent"
          ? "it is not on npm, so it is published"
          : d.npm === "same"
            ? "npm has this version with the same files, so it is only tagged"
            : d.npm === "differs"
              ? "npm has this version with other files"
              : "npm was not compared, and no file changed since its version was raised";
      return `released as it is (${from}): ${because}; ${npm}`;
    }
    case "raised":
      return `raised to ${d.to} (${d.impact}): ${
        d.why === "changed"
          ? "files changed since its last tag"
          : d.why === "differs-from-npm"
            ? "its files differ from the version npm holds, which stays as published"
            : d.why === "changed-since-version"
              ? "npm was not compared, and files changed since its version was raised"
              : "asked for (--raise)"
      }`;
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
export function planRelease(facts: readonly Facts[], raise: ReadonlyMap<string, Impact | undefined> = new Map()): Result<Plan, string> {
  const by = new Map(facts.map((f) => [f.slug as string, f] as const));
  const unknown = [...raise.keys()].filter((k) => !by.has(k));
  if (unknown.length > 0) return err(`--raise names ${unknown.join(", ")}, which ${unknown.length === 1 ? "is" : "are"} no library (they are: ${facts.map((f) => f.slug).join(", ")})`);
  const decided = new Map<Slug, Decision>();
  const raised = (f: Facts, impact: Impact, why: Why): Result<Decision, string> => {
    const to = nextSemVer(f.version, impact);
    return to.kind === "err" ? err(`${f.slug}: ${to.error}`) : ok({ kind: "raised", to: to.value, impact, why });
  };
  for (const f of facts) {
    let candidate = f.last === undefined;
    if (f.last !== undefined) {
      const c = compare(f.version, f.last.version);
      if (c === undefined) return err(`${f.slug}: the version ${f.version} or the tag ${f.last.tag} is not a Semantic Version`);
      if (c < 0) return err(`${f.slug}: the version ${f.version} is below its last tag ${f.last.tag}: a version never goes back`);
      candidate = c > 0;
    }
    const asked = raise.has(f.slug);
    let d: Result<Decision, string>;
    if (asked) d = raised(f, raise.get(f.slug) ?? f.sinceVersion.impact, "manual");
    else if (candidate) {
      // a version that has no tag, or is ahead of its tag, may be on npm already with other files: it is then raised, and not released as it is
      if (f.registry === "differs") d = raised(f, f.sinceVersion.impact, "differs-from-npm");
      else if (f.registry === "unknown" && f.sinceVersion.changed) d = raised(f, f.sinceVersion.impact, "changed-since-version");
      else d = ok({ kind: "as-is", why: f.last === undefined ? "no-tag" : "ahead-of-tag", npm: f.registry });
    } else d = f.changed ? raised(f, f.impact, "changed") : ok({ kind: "unchanged" });
    if (d.kind === "err") return d;
    decided.set(f.slug, d.value);
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
    steps.push({ slug, folder: f.folder, package: f.package, from: f.version, to, tag: tagOf(slug, to), publish: f.publish, decision: d });
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
  const releases = plan.steps.map((s) => ({ slug: s.slug, package: s.package, version: s.to, folder: s.folder, tag: s.tag, publish: s.publish }));
  return `${JSON.stringify({ generated: "bun commons/libraries/src/releasing.ts apply; do not edit (commons 0001-libraries FR-014)", releases }, null, 2)}\n`;
}

/** One entry of the record, as the workflow reads it. */
export type Entry = { readonly slug: string; readonly package: string; readonly version: string; readonly folder: string; readonly tag: string; readonly publish: boolean };

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
    const pkg = o["package"];
    if (typeof slug !== "string" || typeof pkg !== "string" || typeof version !== "string" || typeof folder !== "string" || typeof tag !== "string" || typeof publish !== "boolean")
      return err(`${RECORD_PATH}: an entry lacks its slug, package, version, folder, tag or publish`);
    out.push({ slug, package: pkg, version, folder, tag, publish });
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
  const manifest = decodeLibrarySource(readTextFileSync(join(repo, step.folder, LIBRARY_FILE)));
  if (manifest.kind === "err") return err(`${step.folder}/${LIBRARY_FILE}: ${manifest.error}`);
  for (const c of manifest.value.versionConstants ?? []) {
    const done = writeConstant(repo, step, c);
    if (done.kind === "err") return done;
    files.push(done.value);
  }
  return ok(files);
}

/** Escapes the characters of a name that a regular expression reads as syntax. */
const quoted = (name: string): string => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Writes the new version into a constant of the library's sources that holds it (`export const NAME = "1.2.3"`); the file's path from the root, or the problem where the file or the constant is not there. */
export function writeConstant(repo: string, step: Step, c: VersionConstant): Result<string, string> {
  const path = `${step.folder}/${c.file}`;
  const at = join(repo, path);
  if (!existsSync(at)) return err(`${path} is missing: the manifest names it as holding the version in ${c.name}`);
  const changed = set(readTextFileSync(at), new RegExp(`(\\b${quoted(c.name)}\\b[^=\\n]*=\\s*)"[^"]*"`), `$1"${step.to}"`);
  if (changed === undefined) return err(`${path} does not say ${c.name} = "<version>"`);
  writeTextFileSync(at, changed);
  return ok(path);
}

/** What a tarball holds that the comparison reads: the SHA-256 of each file by its path (without the folder `package/`), and the text of its `package.json`. */
export type Tarball = { readonly hashes: ReadonlyMap<string, string>; readonly packageJson: string };

/** The files of a gzipped tar, as a registry serves it: each regular file's path and SHA-256. A header it cannot read ends the list there. */
export function tarballOf(gz: Uint8Array): Tarball {
  const bytes = gunzipSync(gz);
  const text = (from: number, to: number): string => new TextDecoder().decode(bytes.subarray(from, to)).replace(/\0.*$/s, "");
  const hashes = new Map<string, string>();
  let packageJson = "";
  for (let at = 0; at + 512 <= bytes.length; ) {
    const name = text(at, at + 100);
    if (name === "") break;
    const size = Number.parseInt(text(at + 124, at + 136).trim() || "0", 8);
    const type = text(at + 156, at + 157);
    const prefix = text(at + 345, at + 500);
    const body = bytes.subarray(at + 512, at + 512 + size);
    if (type === "0" || type === "") {
      const path = (prefix === "" ? name : `${prefix}/${name}`).replace(/^package\//, "");
      hashes.set(path, createHash("sha256").update(body).digest("hex"));
      if (path === "package.json") packageJson = new TextDecoder().decode(body);
    }
    at += 512 + Math.ceil(size / 512) * 512;
  }
  return { hashes, packageJson };
}

/**
 * Whether the files of a library are those of the version npm holds (FR-013): the sources the package carries (`src/`, each by its SHA-256 against the library's own file) and the keys of its `exports` (the packer rewrites the rest of
 * `package.json`, and the compiled files are the compiler's). A source that is missing here, or other, or an entry of `exports` that was added or removed, is a difference.
 */
export function driftOf(published: Tarball, local: { readonly hash: (path: string) => string | undefined; readonly packageJson: string }): "same" | "differs" {
  if (exportsLine(published.packageJson) !== exportsLine(local.packageJson)) return "differs";
  for (const [path, sha] of published.hashes) if (path.startsWith("src/") && local.hash(path) !== sha) return "differs";
  return "same";
}

/** Compares a library's version with what npm holds of it. */
export type Registry = (pkg: string, version: string, folder: string) => Promise<Drift>;

/** The registry of npm itself, read over HTTPS: the metadata of the version, its tarball, and the library's files under `repo`; anything that goes wrong is `unknown`, never a guess. */
export function realRegistry(repo: string): Registry {
  return async (name, version, folder) => {
    try {
      const meta = await fetch(`https://registry.npmjs.org/${name.replace("/", "%2F")}/${version}`, { signal: AbortSignal.timeout(30_000) });
      if (meta.status === 404) return "absent";
      if (!meta.ok) return "unknown";
      const json: unknown = await meta.json();
      const dist = typeof json === "object" && json !== null && "dist" in json ? json.dist : undefined;
      const url = typeof dist === "object" && dist !== null && "tarball" in dist ? dist.tarball : undefined;
      if (typeof url !== "string") return "unknown";
      const tgz = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (!tgz.ok) return "unknown";
      const published = tarballOf(new Uint8Array(await tgz.arrayBuffer()));
      const pkg = join(repo, folder, "package.json");
      return driftOf(published, {
        hash: (path) => {
          const f = join(repo, folder, path);
          return existsSync(f) ? createHash("sha256").update(readFileSync(f)).digest("hex") : undefined;
        },
        packageJson: existsSync(pkg) ? readTextFileSync(pkg) : "",
      });
    } catch {
      return "unknown";
    }
  };
}

/** What the host gives the plan: the facts of the libraries from the tags and the tree. */
export async function factsOf(repo: string, registry: Registry = realRegistry(repo)): Promise<Result<readonly Facts[], string>> {
  const tree = await readWorkingTree(repo);
  if (tree.kind === "err") return err(formatGitError(tree.error));
  const tags = await readTags(repo);
  if (tags.kind === "err") return err(formatGitError(tags.error));
  const head = await resolveCommit(repo, "HEAD");
  if (head.kind === "err") return err(formatGitError(head.error));
  const folders = workFolders(tree.value.paths);
  const libs = everyLibrary(repo).filter((l) => l.held === undefined);
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
    // a version with no tag, or ahead of its tag, may be on npm already: what npm holds of it is compared, and where it cannot be, the files since the version was raised say
    const ahead = last === undefined || (compare(l.version, last.version) ?? 0) > 0;
    let drift: Drift = "unknown";
    let sinceVersion = { changed: false, impact: "patch" as Impact };
    if (ahead) {
      if (l.distribution.includes("npm")) drift = await registry(publishedPackage(l), l.version, l.folder);
      const raisedAt = await run(["git", "-C", repo, "log", "-1", "--format=%H", '-G"version"', "--", `${l.folder}/package.json`]);
      const commit = raisedAt.code === 0 ? raisedAt.stdout.trim() : "";
      if (commit !== "") {
        const files = await changedBetween(repo, commit, head.value);
        const commits = await commitsSince(repo, commit);
        if (files.kind === "err") return err(formatGitError(files.error));
        if (commits.kind === "err") return err(formatGitError(commits.error));
        sinceVersion = {
          changed: files.value.some(inScope),
          impact: greaterImpact("patch", impactOfCommits(commits.value.filter((c) => c.files.some(inScope))) ?? "patch"),
        };
      }
    }
    // a metapackage has no code to import: it depends on each member of its set, which is what raises it where a member is raised (0036-distribution FR-008)
    const members = l.bundle === undefined ? undefined : membersOf(l.bundle, libs);
    const imports = (members?.kind === "ok" ? members.value.map((m) => m.library) : inputsOf(repo, l.name).imports).flatMap((n) => {
      const s = slugs.get(n);
      return s === undefined ? [] : [s];
    });
    out.push({
      slug,
      folder: l.folder,
      package: publishedPackage(l),
      version: l.version,
      imports,
      last: last === undefined ? undefined : { version: last.version, tag: last.tag },
      changed,
      impact: greaterImpact("patch", impact),
      publish: l.distribution.includes("npm"),
      registry: drift,
      sinceVersion,
    });
  }
  return ok(out);
}

/** The commands that make the generated files, in the order they are made: the section of the libraries first, the register last. Each is run once, by `apply`. */
export const GENERATORS: readonly (readonly string[])[] = [
  ["commons/libraries/src/libraries.ts"],
  ["commons/libraries/src/pack-metapackage.ts"],
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
export async function applyRelease(
  repo: string,
  host: Host,
  options: { readonly tests: boolean; readonly raise?: ReadonlyMap<string, Impact | undefined>; readonly registry?: Registry },
): Promise<Result<Applied, string>> {
  const facts = await factsOf(repo, options.registry);
  if (facts.kind === "err") return facts;
  const planned = planRelease(facts.value, options.raise);
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

/** What the publication needs from the world, so that its order and its rules are a pure function of what these say. */
export type Tools = {
  /** Whether the version is on npm (asked again after a pause where it is not, because a version put there by hand may take a while to show). */
  readonly onNpm: (name: string, version: string) => Promise<boolean>;
  /** Sends the package to npm; the reason where it cannot (no trusted publisher and no token, or npm refused). */
  readonly npm: (e: Entry) => Promise<Result<void, string>>;
  /** Sends the package to the GitHub package registry, unless it is there. */
  readonly github: (e: Entry) => Promise<Result<void, string>>;
  /** Makes the tag at the commit that runs, or finds it there. */
  readonly tag: (tag: string) => Promise<Result<"made" | "there", string>>;
};

/** What happened to one release: the state of its publication, and of its tag. */
export type Outcome = {
  readonly slug: string;
  readonly tag: string;
  readonly npm: "present" | "published" | "failed" | "not-published";
  readonly registry: "done" | "failed" | "not-published";
  readonly tagged: "made" | "there" | "withheld" | "failed";
  readonly reasons: readonly string[];
};

/**
 * Publishes and tags the releases in order (FR-015), each by itself: a version that is on npm is not sent again and is tagged; one that is not is sent, and where nothing can send it (no trusted publisher, no token) it is
 * reported and its tag withheld, and the others go on; a release that is only tagged (a library that names no npm) is tagged. A tag that is there is kept. The failures are in the outcomes, never thrown.
 */
export async function publishAll(entries: readonly Entry[], tools: Tools): Promise<readonly Outcome[]> {
  const out: Outcome[] = [];
  for (const e of entries) {
    const reasons: string[] = [];
    let npm: Outcome["npm"] = "not-published";
    let registry: Outcome["registry"] = "not-published";
    if (e.publish) {
      if (await tools.onNpm(e.package, e.version)) npm = "present";
      else {
        const sent = await tools.npm(e);
        npm = sent.kind === "ok" ? "published" : "failed";
        if (sent.kind === "err") reasons.push(sent.error);
      }
      if (npm !== "failed") {
        const sent = await tools.github(e);
        registry = sent.kind === "ok" ? "done" : "failed";
        if (sent.kind === "err") reasons.push(sent.error);
      }
    }
    let tagged: Outcome["tagged"] = "withheld";
    if (npm !== "failed" && registry !== "failed") {
      const made = await tools.tag(e.tag);
      tagged = made.kind === "ok" ? made.value : "failed";
      if (made.kind === "err") reasons.push(made.error);
    }
    out.push({ slug: e.slug, tag: e.tag, npm, registry, tagged, reasons });
  }
  return out;
}

/** The lines that say how each release went, and whether the run is a failure: one failure anywhere fails it, after every release was tried. */
export function outcomeLines(outcomes: readonly Outcome[]): { readonly lines: readonly string[]; readonly failed: boolean } {
  const lines = outcomes.map((o) => {
    const npm = o.npm === "present" ? "on npm already" : o.npm === "published" ? "published to npm" : o.npm === "failed" ? "NOT on npm" : "no npm";
    const tag = o.tagged === "made" ? `tagged ${o.tag}` : o.tagged === "there" ? `${o.tag} was there` : o.tagged === "withheld" ? `${o.tag} withheld` : `${o.tag} not made`;
    return `${o.slug}: ${npm}; ${tag}${o.reasons.length > 0 ? ` (${o.reasons.join("; ")})` : ""}`;
  });
  return { lines, failed: outcomes.some((o) => o.npm === "failed" || o.registry === "failed" || o.tagged === "failed" || o.tagged === "withheld") };
}

const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));
const tail = (t: string): string => t.trim().split("\n").slice(-3).join(" ");

/** The tools of a run of the release workflow: npm and the GitHub CLI, the tarballs under `dir` (one folder for each library, `package-<slug>`), and the environment's credentials. */
export function realTools(dir: string): Tools {
  const token = env.get("NPM_TOKEN") ?? "";
  const github = env.get("GITHUB_TOKEN") ?? "";
  const tarball = (slug: string): string | undefined => {
    const d = join(dir, `package-${slug}`);
    return existsSync(d) ? readDirSync(d).find((f) => f.name.endsWith(".tgz"))?.name : undefined;
  };
  const view = async (name: string, version: string, extra: readonly string[] = []): Promise<boolean> =>
    (await run(["npm", "view", `${name}@${version}`, "version", ...extra])).code === 0;
  return {
    onNpm: async (name, version) => {
      for (let i = 0; i < 3; i++) {
        if (await view(name, version)) return true;
        if (i < 2) await sleep(10_000);
      }
      return false;
    },
    npm: async (e) => {
      const f = tarball(e.slug);
      if (f === undefined) return err(`${e.slug}: no tarball was built for it`);
      const r = await run(["npm", "publish", join(dir, `package-${e.slug}`, f), "--access", "public", "--provenance"], {
        env: token === "" ? {} : { NODE_AUTH_TOKEN: token },
      });
      return r.code === 0
        ? ok(undefined)
        : err(`${e.slug} ${e.version} is not on npm and could not be published (${token === "" ? "no INFRO_NPMJS_TOKEN, so trusted publishing was tried" : "with INFRO_NPMJS_TOKEN"}; configure a trusted publisher for ${e.package} or publish it by hand): ${tail(`${r.stderr}${r.stdout}`)}`);
    },
    github: async (e) => {
      const auth = [`--registry=https://npm.pkg.github.com`, `--//npm.pkg.github.com/:_authToken=${github}`];
      if (await view(e.package, e.version, auth)) return ok(undefined);
      const f = tarball(e.slug);
      if (f === undefined) return err(`${e.slug}: no tarball was built for it`);
      const r = await run(["npm", "publish", join(dir, `package-${e.slug}`, f), ...auth]);
      return r.code === 0 ? ok(undefined) : err(`${e.slug} ${e.version} could not be published to the GitHub package registry: ${tail(`${r.stderr}${r.stdout}`)}`);
    },
    tag: async (tag) => {
      const repo = env.get("GITHUB_REPOSITORY") ?? "";
      if ((await run(["gh", "api", `repos/${repo}/git/ref/tags/${tag}`])).code === 0) return ok("there");
      const made = await run(["gh", "api", `repos/${repo}/git/refs`, "-f", `ref=refs/tags/${tag}`, "-f", `sha=${env.get("GITHUB_SHA") ?? ""}`]);
      return made.code === 0 ? ok("made") : err(`the tag ${tag} could not be made: ${tail(`${made.stderr}${made.stdout}`)}`);
    },
  };
}

/** What `--raise` says: each library by its name, with the impact after an `=` where one is given. */
export function raiseOf(words: readonly string[]): Result<ReadonlyMap<string, Impact | undefined>, string> {
  const out = new Map<string, Impact | undefined>();
  for (const w of words.flatMap((x) => x.split(",")).filter((x) => x !== "")) {
    const [name = "", impact] = w.split("=");
    if (name === "") return err(`--raise ${w}: no library`);
    if (impact === undefined) out.set(name, undefined);
    else if (impact === "major" || impact === "minor" || impact === "patch") out.set(name, impact);
    else return err(`--raise ${w}: the impact is major, minor or patch`);
  }
  return ok(out);
}

/** The registry that is not asked (`--offline`). */
export const offlineRegistry: Registry = () => Promise.resolve("unknown");

const COMMANDS = ["plan", "apply", "matrix", "publish"] as const;
type Command = (typeof COMMANDS)[number];
const isCommand = (t: string): t is Command => (COMMANDS as readonly string[]).includes(t);

const OPTIONS = {
  repo: value({ help: "The repository (the working folder by default).", valueName: "DIR", default: "." }),
  tests: flag({ help: "Run the tests that pack, install and type-check every library (on by default; apply only).", negatable: true, default: true }),
  githubOutput: value({ help: "Append the outputs to this file, as a step's `$GITHUB_OUTPUT` is read (matrix only).", valueName: "FILE" }),
  raise: many({ help: "Raise a library whatever its state says: NAME, or NAME=major|minor|patch (the impact of its commits, or a patch, where none is given). Repeat, or separate with commas.", valueName: "NAME[=IMPACT]" }),
  offline: flag({ help: "Do not ask npm what it holds: a version with no tag is then raised only where its files changed since it was raised." }),
  dir: value({ help: "Where the tarballs are, a folder `package-<slug>` for each library (publish only).", valueName: "DIR", default: "package" }),
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
      const raise = raiseOf(parsed.value.options.raise ?? []);
      if (raise.kind === "err") {
        stdio.stderr.writeSync(`release: ${raise.error}\n`);
        return 2;
      }
      const facts = await factsOf(repo, parsed.value.options.offline ? offlineRegistry : realRegistry(repo));
      const planned = facts.kind === "err" ? facts : planRelease(facts.value, raise.value);
      if (planned.kind === "err") {
        stdio.stderr.writeSync(`release: ${planned.error}\n`);
        return 1;
      }
      for (const l of planLines(look, planned.value)) say(l);
      return 0;
    }
    case "apply": {
      const raise = raiseOf(parsed.value.options.raise ?? []);
      if (raise.kind === "err") {
        stdio.stderr.writeSync(`release: ${raise.error}\n`);
        return 2;
      }
      const done = await applyRelease(repo, host, {
        tests: parsed.value.options.tests,
        raise: raise.value,
        registry: parsed.value.options.offline ? offlineRegistry : realRegistry(repo),
      });
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
    case "publish": {
      const file = join(repo, RECORD_PATH);
      const entries = existsSync(file) ? readRecord(readTextFileSync(file)) : err(`${RECORD_PATH} is missing: run release apply`);
      const tags = await readTags(repo);
      if (entries.kind === "err") {
        stdio.stderr.writeSync(`release: ${entries.error}\n`);
        return 1;
      }
      if (tags.kind === "err") {
        stdio.stderr.writeSync(`release: ${formatGitError(tags.error)}\n`);
        return 1;
      }
      const tagged = new Set(tags.value.map((t) => t.name));
      const report = outcomeLines(await publishAll(entries.value.filter((e) => !tagged.has(e.tag)), realTools(resolve(repo, parsed.value.options.dir))));
      for (const l of report.lines) say(l);
      return report.failed ? 1 : 0;
    }
    default:
      return absurd(word);
  }
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
