// Spec: 0007-repoctl-hygiene FR-002
/**
 * The hygiene of a repository that consumes commons (commons repoctl 0007-repoctl-hygiene FR-002, FR-003; 0009-repoctl-config FR-005; commons 0036-distribution FR-001, FR-002, FR-010, FR-011, FR-013): a pure function from the facts of a repository (its `package.json` files,
 * its lockfiles, what is installed, the relative imports of its sources) to the findings of the rule that commons reaches a repository only as a published package. Nothing here reads a file: `hygiene-facts.ts` gathers the
 * facts through the ports, and the verb draws the findings.
 *
 * @remarks
 * A finding is one of six, each with its code: a dependency by Git on the repository of commons (`E-HYGIENE-GIT`), a `file:` or `link:` dependency into a path that has a segment `commons` (`E-HYGIENE-PATH`), a relative import into
 * such a path (`E-HYGIENE-IMPORT`), a vendored copy (`E-HYGIENE-VENDORED`), two installed copies of one library at different versions (`E-HYGIENE-DUPLICATE`) and, as a warning, a dependency that is not an exact version (`E-HYGIENE-RANGE`). In the
 * repository of commons itself the packages under `commons/` are its own, so the three findings about paths and copies are not made there.
 *
 * @limits
 * It does not know the names of the libraries of commons: a path is a path of commons where a segment is named `commons`, and a package under a folder is a vendored copy where its name is in the scope of commons and the folder is
 * not the root package and not a workspace the root declares.
 *
 * @example
 * ```ts
 * import { hygiene } from "./hygiene.ts";
 * const policy = { scope: "@acme/", gitSources: ["acme/platform"], pathSegment: "platform", sourceMarker: "", allow: { paths: [], packages: [] } };
 * hygiene({ repository: "consumer", packages: [], locks: [], installed: new Map(), folders: [], imports: [], workspaces: [] }, policy); // []
 * ```
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import type { HygienePolicy } from "@intellectual-frontiers/repoctl/governance";
import type { Finding } from "./findings.ts";
import { matches } from "./glob.ts";

/** A dependency a `package.json` declares: its name and what it asks for. */
export type Dependency = { readonly name: string; readonly spec: string };

/** A `package.json` of the repository: its path from the root, its name and its dependencies (of every section). */
export type PackageFacts = { readonly path: string; readonly name: string | undefined; readonly dependencies: readonly Dependency[] };

/**
 * One installed copy of a package: its version and where it is (a path from the root, or a key of the lockfile). `owner` is what a lockfile says the copy is nested under (the folder or the name of a package, `""` where it is
 * at the top): where that is a workspace, the copy is the workspace's own pin (0007-repoctl-hygiene FR-008).
 */
export type Copy = { readonly version: string; readonly where: string; readonly owner?: string };

/** What reading a lockfile gave: the copies of each package of commons it holds, or why it could not be read. */
export type LockFacts =
  | { readonly kind: "read"; readonly file: string; readonly copies: ReadonlyMap<string, readonly Copy[]> }
  | { readonly kind: "unreadable"; readonly file: string; readonly why: string };

/** A relative import of a source: the file and the specifier as written. */
export type ImportFact = { readonly file: string; readonly specifier: string };

/** Whose repository it is: the repository the family's packages are made in (the policy's source marker is there), or a repository that consumes them. */
export type Repository = "source" | "consumer";

/** The lockfiles and the installed copies of one folder that holds a `package.json` (a folder of its own is one tree: the copies of two folders are never one install). `folder` is a path from the root, `""` for the root itself. */
export type TreeFacts = {
  readonly folder: string;
  readonly locks: readonly LockFacts[];
  readonly installed: ReadonlyMap<string, readonly Copy[]>;
};

/** Everything the check reads of a repository. */
export type HygieneFacts = {
  readonly repository: Repository;
  readonly packages: readonly PackageFacts[];
  /** One entry for each lockfile found at the root (`bun.lock`, `package-lock.json`); none where there is none. */
  readonly locks: readonly LockFacts[];
  /** The copies found in the `node_modules` of the root, by package. */
  readonly installed: ReadonlyMap<string, readonly Copy[]>;
  /** The same for each other folder that holds a `package.json`, nested ones included (never a folder under `node_modules`, `dist` or `.git`); each is an install of its own. */
  readonly folders: readonly TreeFacts[];
  readonly imports: readonly ImportFact[];
  /** The globs of the workspaces the root `package.json` declares: the packages of the repository itself. */
  readonly workspaces: readonly string[];
};

/** A finding of the check, with the path it was found at. */
export type HygieneFinding = Finding & { readonly path: string };

const EXACT = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

/** Whether a version specifier is an exact version. */
export function isExactVersion(spec: string): boolean {
  return EXACT.test(spec);
}

/** Whether a dependency specifier is a dependency by Git on the family's own repository (a fragment of the policy's `gitSources` is in it). */
export function isGitOfFamily(policy: HygienePolicy, spec: string): boolean {
  const lower = spec.toLowerCase();
  return policy.gitSources.some((g) => lower.includes(g));
}

/** The kind of a path dependency: `file:` or `link:` and the path, or nothing where the specifier is none. */
export function pathOf(spec: string): string | undefined {
  const m = /^(?:file|link):(.*)$/.exec(spec);
  return m?.[1];
}

/** The segments of a path, on either kind of slash, without the empty ones and the dots. */
function segments(path: string): readonly string[] {
  return path.split(/[\\/]/).filter((s) => s !== "" && s !== "." && s !== "..");
}

/** Whether a path goes through the policy's folder name and the folder holds something: the name is a segment and is not the last. A policy with no folder name has no such path. */
export function intoFamily(policy: HygienePolicy, path: string): boolean {
  if (policy.pathSegment === "") return false;
  const s = segments(path);
  const at = s.indexOf(policy.pathSegment);
  return at >= 0 && at < s.length - 1 && !policy.allow.paths.some((g) => matches(g, path.replace(/\\/g, "/")));
}

const dirOf = (file: string): string => file.slice(0, Math.max(0, file.lastIndexOf("/")));

/** Whether a `package.json` is the root's, or one of the workspaces the root declares. */
function isOwn(p: PackageFacts, workspaces: readonly string[]): boolean {
  if (p.path === "package.json") return true;
  const dir = dirOf(p.path);
  return workspaces.some((w) => matches(w.replace(/^\.\//, "").replace(/\/$/, ""), dir));
}

/** The consumer a copy belongs to: the workspace (a member of the root's workspaces, by folder or by name) the lockfile nests it under, or `""` for the root's own tree. Two workspaces may pin their own version of one package. */
function consumerOf(facts: HygieneFacts, c: Copy): string {
  const o = c.owner ?? "";
  if (o === "") return "";
  return facts.packages.some((p) => p.path !== "package.json" && isOwn(p, facts.workspaces) && (dirOf(p.path) === o || p.name === o)) ? o : "";
}

const ORDER: readonly string[] = ["E-HYGIENE-GIT", "E-HYGIENE-PATH", "E-HYGIENE-IMPORT", "E-HYGIENE-VENDORED", "E-HYGIENE-DUPLICATE", "E-HYGIENE-RANGE", "E-ENVIRONMENT"];

/** The findings of a repository, in the order of the codes and then of the paths. */
export function hygiene(facts: HygieneFacts, policy: HygienePolicy): readonly HygieneFinding[] {
  const out: HygieneFinding[] = [];
  const own = facts.repository === "source";
  const SCOPE = policy.scope;
  for (const p of facts.packages) {
    for (const d of p.dependencies) {
      if (isGitOfFamily(policy, d.spec))
        out.push({ level: "fail", code: "E-HYGIENE-GIT", path: p.path, message: `${p.path}: ${d.name} is a Git dependency on the family's own repository (${d.spec}): install a published package instead`, fix: `bun add ${SCOPE}<package>@<version> --exact` });
      const target = pathOf(d.spec);
      if (!own && target !== undefined && intoFamily(policy, target))
        out.push({ level: "fail", code: "E-HYGIENE-PATH", path: p.path, message: `${p.path}: ${d.name} is a ${d.spec.slice(0, d.spec.indexOf(":"))}: dependency into a checkout of the family (${target}): install a published package instead`, fix: `bun add ${SCOPE}<package>@<version> --exact` });
      if (d.name.startsWith(SCOPE) && target === undefined && !isGitOfFamily(policy, d.spec) && !d.spec.startsWith("workspace:") && !isExactVersion(d.spec))
        out.push({ level: "warn", code: "E-HYGIENE-RANGE", path: p.path, message: `${p.path}: ${d.name} is "${d.spec}", which is not an exact version`, fix: `bun add ${d.name}@<version> --exact` });
    }
    if (!own && p.name !== undefined && p.name.startsWith(SCOPE) && !policy.allow.packages.includes(p.name) && !isOwn(p, facts.workspaces))
      out.push({ level: "fail", code: "E-HYGIENE-VENDORED", path: p.path, message: `${p.path}: a folder of this repository carries the package ${p.name}, which is a copy of a package of the family: remove it and install the published package`, fix: `bun add ${p.name}@<version> --exact` });
  }
  if (!own)
    for (const i of facts.imports)
      if (i.specifier.startsWith(".") && intoFamily(policy, i.specifier))
        out.push({ level: "fail", code: "E-HYGIENE-IMPORT", path: i.file, message: `${i.file}: imports ${i.specifier}, which reaches into a copy of the family: import the package by its name`, fix: "import from @intellectual-frontiers/<library>" });
  const trees: readonly TreeFacts[] = [{ folder: "", locks: facts.locks, installed: facts.installed }, ...facts.folders];
  for (const tree of trees) {
    const copies = new Map<string, Copy[]>();
    const add = (pkg: string, c: Copy): void => void copies.set(`${pkg}\0${consumerOf(facts, c)}`, [...(copies.get(`${pkg}\0${consumerOf(facts, c)}`) ?? []), c]);
    for (const l of tree.locks) if (l.kind === "read") for (const [pkg, cs] of l.copies) for (const c of cs) add(pkg, c);
    for (const [pkg, cs] of tree.installed) for (const c of cs) add(pkg, c);
    for (const [key, cs] of [...copies].sort(([a], [b]) => (a < b ? -1 : 1))) {
      const pkg = key.slice(0, key.indexOf("\0"));
      const versions = [...new Set(cs.map((c) => c.version))].sort();
      if (versions.length < 2) continue;
      const where = versions.map((v) => `${v} (${cs.find((c) => c.version === v)?.where ?? "?"})`).join(", ");
      const owner = key.slice(key.indexOf("\0") + 1);
      out.push({
        level: "fail",
        code: "E-HYGIENE-DUPLICATE",
        path: cs[0]?.where ?? pkg,
        message: `${pkg} is installed ${versions.length} times${owner === "" ? "" : ` for ${owner}`}, at ${where}: make the tree hold one copy`,
        fix: `pin one version${owner === "" ? "" : ` in ${owner}`}: add "overrides": { "${pkg}": "${versions[versions.length - 1] ?? ""}" } to its package.json and install again`,
      });
    }
    for (const l of tree.locks)
      if (l.kind === "unreadable") out.push({ level: "fail", code: "E-ENVIRONMENT", path: l.file, message: `${l.file} could not be read (${l.why}), so the installed copies are not known`, fix: "bun install" });
  }
  // a lockfile next to a package.json installs it, and so does one of a folder above it (the workspaces of a root install their members)
  const locked = (folder: string): boolean => trees.some((t) => t.locks.length > 0 && (t.folder === "" || folder === t.folder || folder.startsWith(`${t.folder}/`)));
  for (const p of facts.packages) {
    if (p.dependencies.length === 0) continue;
    const folder = dirOf(p.path);
    if (locked(folder)) continue;
    out.push(
      folder === ""
        ? { level: "warn", code: "E-ENVIRONMENT", path: p.path, message: "there is no bun.lock or package-lock.json: the installed copies are read from node_modules alone", fix: "bun install" }
        : { level: "warn", code: "E-ENVIRONMENT", path: p.path, message: `there is no bun.lock or package-lock.json next to ${p.path} (folder ${folder}): the installed copies are read from its node_modules alone`, fix: `bun install in ${folder}` },
    );
  }
  return out.sort((a, b) => ORDER.indexOf(a.code) - ORDER.indexOf(b.code) || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0) || (a.message < b.message ? -1 : 1));
}

/** Whether any finding fails the run: a warning alone does not. */
export function hygieneFails(findings: readonly Finding[]): boolean {
  return findings.some((f) => {
    switch (f.level) {
      case "fail":
        return true;
      case "warn":
      case "info":
        return false;
      default:
        return absurd(f.level);
    }
  });
}

/** The counts of a run: failures and warnings. */
export function countsOf(findings: readonly Finding[]): { readonly failures: number; readonly warnings: number } {
  return { failures: findings.filter((f) => f.level === "fail").length, warnings: findings.filter((f) => f.level === "warn").length };
}
