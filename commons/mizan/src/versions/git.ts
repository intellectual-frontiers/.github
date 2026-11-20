/**
 * The host layer of the `versions` tool that reads and writes Git (commons 0026-works-versioning FR-017 to FR-024, FR-031): the tracked paths and the records of a tree, the base of a check, the
 * paths that changed, the facts about the commits that editions name, the tags with their commits and trees and signatures, the commits since a tag with the paths each touched, and the creation
 * of an annotated tag, signed where Git is set to sign. Each is the real `git`, run by its argument vector (never through a shell), with no pager and no terminal prompt.
 *
 * @remarks
 * Every failure is an `Err` that names what went wrong, and nothing throws. A shallow clone, a base that is not there and a directory that is no repository are errors of their own kind, so that
 * the command says `not_run` with the reason (FR-031) and never a pass. The tool reads only Git: a repository on plain Git, with no host, is enough.
 *
 * @limits
 * It does not verify a signature (it reports whether a tag carries one), does not contact a remote and does not move or delete a tag: `createTag` only creates.
 *
 * @example
 * ```ts
 * import { readTags } from "./git.ts";
 * const r = await readTags(".");
 * if (r.kind === "ok") console.log(r.value.map((t) => t.name));
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { readTextFile } from "@intellectual-frontiers/system/fs";
import { NotFound } from "@intellectual-frontiers/system/errors";
import { type GitError } from "@intellectual-frontiers/system/git";
import { join } from "@intellectual-frontiers/system/path";
import { output } from "@intellectual-frontiers/system/proc";
import type { EditionFacts, TreeFacts } from "./judge.ts";
import type { TagFact } from "./ledger.ts";
import type { CommitFact } from "./notes.ts";
import { RECORD_FILE } from "./record.ts";
import { utcDay } from "./scheme.ts";
import { workFolders } from "./works.ts";

const ENV: Readonly<Record<string, string>> = {
  GIT_TERMINAL_PROMPT: "0",
  GIT_PAGER: "cat",
  PAGER: "cat",
  GIT_OPTIONAL_LOCKS: "0",
  LC_ALL: "C",
  LANGUAGE: "C",
};

/** What `git` said: its exit status and both streams as text. */
export type Raw = { readonly code: number; readonly stdout: string; readonly stderr: string };

/** `git --no-pager -C repo ...args`, whatever its status, or why `git` could not run at all. */
export async function raw(repo: string, args: readonly string[]): Promise<Result<Raw, GitError>> {
  try {
    const r = await output(["git", "--no-pager", "-c", "core.quotepath=off", "-C", repo, ...args], { env: ENV });
    const stdout = new TextDecoder().decode(r.stdout);
    const stderr = new TextDecoder().decode(r.stderr).trim();
    if (r.code !== 0 && /not a git repository|cannot change to/i.test(stderr))
      return err({ kind: "not-a-repository", repo, message: stderr });
    return ok({ code: r.code, stdout, stderr });
  } catch (e) {
    if (e instanceof NotFound) return err({ kind: "git-missing", program: "git" });
    return err({ kind: "failed", args, code: -1, message: e instanceof Error ? e.message : String(e) });
  }
}

/** `git ...args` as text where it succeeded, or why it did not. */
export async function text(repo: string, args: readonly string[]): Promise<Result<string, GitError>> {
  const r = await raw(repo, args);
  if (r.kind === "err") return r;
  if (r.value.code === 0) return ok(r.value.stdout);
  if (
    /unknown revision|bad revision|ambiguous argument|invalid revision|bad object|not a valid object|Needed a single revision/i.test(
      r.value.stderr,
    )
  )
    return err({ kind: "bad-revision", rev: args.join(" "), message: r.value.stderr });
  return err({ kind: "failed", args, code: r.value.code, message: r.value.stderr });
}

/** Whether the folder is inside a Git repository (any failure to say so is the error). */
export async function isRepository(repo: string): Promise<Result<boolean, GitError>> {
  const r = await raw(repo, ["rev-parse", "--git-dir"]);
  if (r.kind === "err") return r.error.kind === "not-a-repository" ? ok(false) : r;
  return ok(r.value.code === 0);
}

/** The full object name of a revision as a commit, or why there is none. */
export async function resolveCommit(repo: string, rev: string): Promise<Result<string, GitError>> {
  if (rev === "" || rev.startsWith("-")) return err({ kind: "bad-revision", rev, message: "a revision may not be empty or start with -" });
  const r = await text(repo, ["rev-parse", "--verify", "--quiet", `${rev}^{commit}`]);
  return r.kind === "ok"
    ? ok(r.value.trim())
    : err({
        kind: "bad-revision",
        rev,
        message: r.error.kind === "bad-revision" || r.error.kind === "failed" ? "not a commit of this repository" : "",
      });
}

/** The paths tracked by Git now (the index), in the order Git lists them. */
export async function trackedPaths(repo: string): Promise<Result<readonly string[], GitError>> {
  const r = await text(repo, ["ls-files", "-z"]);
  return r.kind === "ok" ? ok(r.value.split("\0").filter((p) => p !== "")) : r;
}

/** The paths of the tree of a commit. */
export async function treePaths(repo: string, rev: string): Promise<Result<readonly string[], GitError>> {
  const r = await text(repo, ["ls-tree", "-r", "--name-only", "-z", rev]);
  return r.kind === "ok" ? ok(r.value.split("\0").filter((p) => p !== "")) : r;
}

/** A file as it was at a revision, or undefined where there was none. */
export async function fileAt(repo: string, rev: string, path: string): Promise<Result<string | undefined, GitError>> {
  const r = await raw(repo, ["show", `${rev}:${path}`]);
  if (r.kind === "err") return r;
  return ok(r.value.code === 0 ? r.value.stdout : undefined);
}

/** The tree of a commit with the text of every record in it. */
export async function readTree(repo: string, rev: string): Promise<Result<TreeFacts, GitError>> {
  const paths = await treePaths(repo, rev);
  if (paths.kind === "err") return paths;
  const records = new Map<string, string>();
  for (const folder of workFolders(paths.value)) {
    const t = await fileAt(repo, rev, folder === "" ? RECORD_FILE : `${folder}/${RECORD_FILE}`);
    if (t.kind === "err") return t;
    if (t.value !== undefined) records.set(folder, t.value);
  }
  return ok({ paths: paths.value, records });
}

/** The tracked paths now with the text of every record as it is on disk (what `bump`, `tag`, `cite` and `ledger` read). */
export async function readWorkingTree(repo: string): Promise<Result<TreeFacts, GitError>> {
  const paths = await trackedPaths(repo);
  if (paths.kind === "err") return paths;
  const records = new Map<string, string>();
  for (const folder of workFolders(paths.value)) {
    const file = join(repo, folder, RECORD_FILE);
    try {
      records.set(folder, await readTextFile(file));
    } catch (e) {
      if (!(e instanceof NotFound))
        return err({ kind: "failed", args: ["read", file], code: -1, message: e instanceof Error ? e.message : String(e) });
    }
  }
  return ok({ paths: paths.value, records });
}

/** Where the check compares with: a commit, or nothing where the head is the first commit (every work is then new). */
export type Base = { readonly kind: "commit"; readonly commit: string } | { readonly kind: "none" };

/** Why a base could not be found: said as `not_run` with this reason (FR-031). */
export type BaseError = { readonly kind: "not-found"; readonly reason: string } | { readonly kind: "git"; readonly error: GitError };

/**
 * The base of a check (FR-022): the merge base of the head with `rev` (`origin/main` unless given), or the head's first parent where the head is `rev` (a push to the branch itself). A shallow
 * clone that does not hold the base, a revision that is not there and a history that shares nothing are `not-found` with the reason.
 */
export async function findBase(repo: string, rev: string): Promise<Result<Base, BaseError>> {
  const head = await resolveCommit(repo, "HEAD");
  if (head.kind === "err") return err({ kind: "git", error: head.error });
  const shallow = await text(repo, ["rev-parse", "--is-shallow-repository"]);
  const isShallow = shallow.kind === "ok" && shallow.value.trim() === "true";
  const target = await resolveCommit(repo, rev);
  if (target.kind === "err")
    return err({
      kind: "not-found",
      reason: `the base ${rev} is not a commit of this repository${isShallow ? " (a shallow clone: fetch the history, or give --base)" : ""}`,
    });
  if (target.value === head.value) {
    const parent = await raw(repo, ["rev-parse", "--verify", "--quiet", "HEAD^1^{commit}"]);
    if (parent.kind === "err") return err({ kind: "git", error: parent.error });
    if (parent.value.code === 0) return ok({ kind: "commit", commit: parent.value.stdout.trim() });
    return isShallow
      ? err({ kind: "not-found", reason: "the head is the base and its parent is not in this shallow clone: fetch the history" })
      : ok({ kind: "none" });
  }
  const mb = await raw(repo, ["merge-base", head.value, target.value]);
  if (mb.kind === "err") return err({ kind: "git", error: mb.error });
  if (mb.value.code !== 0 || mb.value.stdout.trim() === "")
    return err({
      kind: "not-found",
      reason: `no merge base of HEAD and ${rev}${isShallow ? ": a shallow clone does not hold the history, fetch it" : ": their histories share no commit"}`,
    });
  return ok({ kind: "commit", commit: mb.value.stdout.trim() });
}

/** The paths that differ between two commits, a rename counted as a removal and an addition. */
export async function changedBetween(repo: string, base: string, head: string): Promise<Result<readonly string[], GitError>> {
  const r = await text(repo, ["diff", "--name-only", "--no-renames", "-z", base, head, "--"]);
  return r.kind === "ok" ? ok(r.value.split("\0").filter((p) => p !== "")) : r;
}

/** Whether `a` is an ancestor of `b` or the same commit. */
export async function isAncestor(repo: string, a: string, b: string): Promise<Result<boolean, GitError>> {
  if (a === b) return ok(true);
  const r = await raw(repo, ["merge-base", "--is-ancestor", a, b]);
  if (r.kind === "err") return r;
  if (r.value.code === 0) return ok(true);
  if (r.value.code === 1) return ok(false);
  return err({ kind: "failed", args: ["merge-base", "--is-ancestor", a, b], code: r.value.code, message: r.value.stderr });
}

/** What Git says of the commits the editions name (FR-011): the commit and its UTC day for each first eight characters that names one, and which is an ancestor of which. */
export async function editionFacts(repo: string, commit8s: readonly string[], head: string): Promise<Result<EditionFacts, GitError>> {
  const commits = new Map<string, { readonly commit: string; readonly day: string }>();
  for (const c8 of commit8s) {
    const full = await raw(repo, ["rev-parse", "--verify", "--quiet", `${c8}^{commit}`]);
    if (full.kind === "err") return full;
    if (full.value.code !== 0) continue;
    const commit = full.value.stdout.trim();
    const t = await text(repo, ["log", "-1", "--format=%ct", commit]);
    if (t.kind === "err") return t;
    commits.set(c8, { commit, day: utcDay(Number(t.value.trim())) });
  }
  const ids = [...new Set([head, ...[...commits.values()].map((c) => c.commit)])];
  const ancestry = new Set<string>();
  for (const a of ids)
    for (const b of ids) {
      if (a === b) continue;
      const r = await isAncestor(repo, a, b);
      if (r.kind === "err") return r;
      if (r.value) ancestry.add(`${a} ${b}`);
    }
  return ok({ commits, ancestry, head });
}

const FIELD = "\u001f";
const RECORD = "\u001e";

/** The tags of the repository with their commits, trees, signatures and commit times; a tag of a tree or a blob is left out. */
export async function readTags(repo: string): Promise<Result<readonly TagFact[], GitError>> {
  const format = ["%(refname:short)", "%(objecttype)", "%(objectname)", "%(*objecttype)", "%(*objectname)", "%(contents:signature)"].join(
    "%1f",
  );
  const list = await text(repo, ["for-each-ref", `--format=${format}%1e`, "refs/tags"]);
  if (list.kind === "err") return list;
  const rows = list.value
    .split(RECORD)
    .map((r) => r.replace(/^\n/, ""))
    .filter((r) => r.trim() !== "")
    .map((r) => r.split(FIELD))
    .flatMap(([name = "", type = "", object = "", peeledType = "", peeled = "", signature = ""]) => {
      const annotated = type === "tag";
      const commit = annotated ? peeled : object;
      return (annotated ? peeledType : type) === "commit" && name !== "" && commit !== ""
        ? [{ name, annotated, signed: annotated && signature.trim() !== "", commit }]
        : [];
    });
  const facts = new Map<string, { readonly tree: string; readonly seconds: number }>();
  const commits = [...new Set(rows.map((r) => r.commit))];
  if (commits.length > 0) {
    const log = await text(repo, ["log", "--no-walk=unsorted", `--format=%H${FIELD}%T${FIELD}%ct`, ...commits, "--"]);
    if (log.kind === "err") return log;
    for (const line of log.value.split("\n")) {
      const [sha = "", tree = "", ct = ""] = line.split(FIELD);
      if (sha !== "") facts.set(sha, { tree, seconds: Number(ct) });
    }
  }
  return ok(
    rows
      .flatMap((r) => {
        const f = facts.get(r.commit);
        return f === undefined ? [] : [{ ...r, tree: f.tree, seconds: f.seconds }];
      })
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)),
  );
}

/** The ancestry of the commits of tags: the pairs `<ancestor> <descendant>` of commits of tags, ancestor and descendant different. One `for-each-ref --merged` for each distinct commit. */
export async function tagAncestry(repo: string, tags: readonly TagFact[]): Promise<Result<ReadonlySet<string>, GitError>> {
  const out = new Set<string>();
  const byName = new Map(tags.map((t) => [t.name, t.commit] as const));
  for (const commit of new Set(tags.map((t) => t.commit))) {
    const r = await text(repo, ["for-each-ref", "--merged", commit, "--format=%(refname:short)", "refs/tags"]);
    if (r.kind === "err") return r;
    for (const name of r.value.split("\n")) {
      const c = byName.get(name);
      if (c !== undefined && c !== commit) out.add(`${c} ${commit}`);
    }
  }
  return ok(out);
}

/** The names of the tags whose commit is an ancestor of `rev` or is it. */
export async function tagsMerged(repo: string, rev: string): Promise<Result<ReadonlySet<string>, GitError>> {
  const r = await text(repo, ["for-each-ref", "--merged", rev, "--format=%(refname:short)", "refs/tags"]);
  return r.kind === "ok" ? ok(new Set(r.value.split("\n").filter((n) => n !== ""))) : r;
}

/** The commits after `from` up to `HEAD` (the whole history where `from` is undefined), each with its subject, its message and the paths it touched; oldest first. */
export async function commitsSince(repo: string, from: string | undefined): Promise<Result<readonly CommitFact[], GitError>> {
  const r = await text(repo, [
    "log",
    "--reverse",
    "--name-only",
    "--no-renames",
    `--format=${RECORD}%H${FIELD}%s${FIELD}%B${FIELD}`,
    ...(from === undefined ? ["HEAD"] : [`${from}..HEAD`]),
    "--",
  ]);
  if (r.kind === "err") return r;
  const out: CommitFact[] = [];
  for (const rec of r.value.split(RECORD)) {
    if (rec.trim() === "") continue;
    const [sha = "", subject = "", message = "", names = ""] = rec.split(FIELD);
    out.push({ sha, subject, message: message.trimEnd(), files: names.split("\n").filter((n) => n.trim() !== "") });
  }
  return ok(out);
}

/** The time of a commit, in seconds since the epoch. */
export async function commitSeconds(repo: string, rev: string): Promise<Result<number, GitError>> {
  const r = await text(repo, ["log", "-1", "--format=%ct", rev]);
  return r.kind === "ok" ? ok(Number(r.value.trim())) : r;
}

/** Whether a path has a change not committed (a modified, staged or untracked file). */
export async function isDirty(repo: string, path: string): Promise<Result<boolean, GitError>> {
  const r = await text(repo, ["status", "--porcelain", "--", path]);
  return r.kind === "ok" ? ok(r.value.trim() !== "") : r;
}

/** Whether Git is set to sign tags: a signing key is configured, or `tag.gpgSign` is true. */
export async function signingConfigured(repo: string): Promise<Result<boolean, GitError>> {
  const key = await raw(repo, ["config", "--get", "user.signingkey"]);
  if (key.kind === "err") return key;
  if (key.value.code === 0 && key.value.stdout.trim() !== "") return ok(true);
  const sign = await raw(repo, ["config", "--type=bool", "--get", "tag.gpgSign"]);
  if (sign.kind === "err") return sign;
  return ok(sign.value.code === 0 && sign.value.stdout.trim() === "true");
}

/** Creates an annotated tag at `HEAD`, signed (`git tag -s`) where `sign` is true; Git refuses a name that exists, and a signature that cannot be made is an error and no tag. */
export async function createTag(repo: string, name: string, message: string, sign: boolean): Promise<Result<void, GitError>> {
  const r = await raw(repo, ["tag", sign ? "-s" : "-a", "-m", message, name, "HEAD"]);
  if (r.kind === "err") return r;
  return r.value.code === 0 ? ok(undefined) : err({ kind: "failed", args: ["tag", name], code: r.value.code, message: r.value.stderr });
}
