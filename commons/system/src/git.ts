// Spec: 0001-system FR-014
/**
 * A Git repository read by running `git` (commons 0007-grc FR-021): the commit at `HEAD`, whether the working tree is clean, the paths
 * changed between two revisions, and a file's bytes as it is at a revision. Each runs `git -C REPO ...` by its argument vector, never
 * through a shell, with no pager, no terminal prompt, no optional locks and messages in English; paths are read NUL-separated (`-z`), so
 * spaces, quotes and non-ASCII names come back as they are. Every failure is an `Err` naming what went wrong, a repository that is not
 * there and a `git` that is not installed included; nothing here throws.
 *
 * @example
 * ```ts
 * import { changedPaths, head } from "./git.ts";
 * const h = await head(".");
 * if (h.kind === "ok") console.log(h.value);
 * const changed = await changedPaths(".", "HEAD~1", "HEAD"); // { kind: "ok", value: ["src/a.ts", ...] }
 * ```
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import type { Brand } from "@intellectual-frontiers/core";
import { NotFound } from "./errors.ts";
import { output } from "./proc.ts";

/** A commit's object id: 40 (SHA-1) or 64 (SHA-256) lower-case hexadecimal digits, made only by `commitIdOf`. */
export type CommitId = Brand<string, "CommitId">;

/** Text as a commit id, or undefined where it is not 40 or 64 lower-case hexadecimal digits. */
export function commitIdOf(text: string): CommitId | undefined {
  return /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(text) ? (text as CommitId) : undefined; // checked just now: the brand's one constructor
}

/** Why a repository could not be read. */
export type GitError =
  | { readonly kind: "git-missing"; readonly program: string }
  | { readonly kind: "not-a-repository"; readonly repo: string; readonly message: string }
  | { readonly kind: "bad-revision"; readonly rev: string; readonly message: string }
  | { readonly kind: "no-such-path"; readonly rev: string; readonly path: string; readonly message: string }
  | { readonly kind: "failed"; readonly args: readonly string[]; readonly code: number; readonly message: string };

/** A Git error as one sentence. */
export function formatGitError(e: GitError): string {
  switch (e.kind) {
    case "git-missing":
      return `${e.program} is not installed (or not on PATH)`;
    case "not-a-repository":
      return `${e.repo} is not a Git repository: ${e.message}`;
    case "bad-revision":
      return `no revision ${e.rev}: ${e.message}`;
    case "no-such-path":
      return `no file ${e.path} at ${e.rev}: ${e.message}`;
    case "failed":
      return `git ${e.args.join(" ")} failed (${e.code}): ${e.message}`;
    default:
      return absurd(e);
  }
}

/** How `git` is run: the program (`git` on PATH by default). */
export type GitOptions = { readonly program?: string };

const ENV: Readonly<Record<string, string>> = {
  GIT_TERMINAL_PROMPT: "0",
  GIT_PAGER: "cat",
  PAGER: "cat",
  GIT_OPTIONAL_LOCKS: "0",
  LC_ALL: "C",
  LANGUAGE: "C",
};

type Ran = { readonly stdout: Uint8Array; readonly stderr: string; readonly code: number };

/** `git --no-pager -C repo ...args`, its output, or `git-missing` where there is no git. */
async function git(repo: string, args: readonly string[], options: GitOptions): Promise<Result<Ran, GitError>> {
  const program = options.program ?? "git";
  try {
    const r = await output([program, "--no-pager", "-C", repo, ...args], { env: ENV });
    return ok({ stdout: r.stdout, stderr: new TextDecoder().decode(r.stderr).trim(), code: r.code });
  } catch (e) {
    if (e instanceof NotFound) return err({ kind: "git-missing", program });
    return err({ kind: "failed", args, code: -1, message: e instanceof Error ? e.message : String(e) });
  }
}

/** A failed run as the error it says it is: no repository (or no folder) there, else `fallback`. */
function failure(repo: string, args: readonly string[], r: Ran, fallback?: GitError): GitError {
  if (/not a git repository|cannot change to/i.test(r.stderr)) return { kind: "not-a-repository", repo, message: r.stderr };
  return fallback ?? { kind: "failed", args, code: r.code, message: r.stderr };
}

/** A revision that would read as an option is refused rather than passed to git. */
function checkRev(rev: string): Result<string, GitError> {
  return rev === "" || rev.startsWith("-")
    ? err({ kind: "bad-revision", rev, message: "a revision may not be empty or start with -" })
    : ok(rev);
}

/** The NUL-separated fields of git's `-z` output, as text. */
function nulFields(bytes: Uint8Array): readonly string[] {
  const text = new TextDecoder().decode(bytes);
  return text.split("\0").filter((p) => p !== "");
}

/** The commit `HEAD` points to; `bad-revision` in a repository with no commit yet. */
export async function head(repo: string, options: GitOptions = {}): Promise<Result<CommitId, GitError>> {
  const args = ["rev-parse", "--verify", "--quiet", "HEAD^{commit}"];
  const r = await git(repo, args, options);
  if (r.kind === "err") return r;
  if (r.value.code !== 0)
    return err(failure(repo, args, r.value, { kind: "bad-revision", rev: "HEAD", message: r.value.stderr || "no commit yet" }));
  const text = new TextDecoder().decode(r.value.stdout).trim();
  const id = commitIdOf(text);
  return id === undefined ? err({ kind: "failed", args, code: 0, message: `not a commit id: ${text}` }) : ok(id);
}

/** Whether the working tree and the index match `HEAD`, with no untracked file that is not ignored. */
export async function isClean(repo: string, options: GitOptions = {}): Promise<Result<boolean, GitError>> {
  const args = ["status", "--porcelain=v1", "-z", "--untracked-files=normal", "--ignore-submodules=none"];
  const r = await git(repo, args, options);
  if (r.kind === "err") return r;
  if (r.value.code !== 0) return err(failure(repo, args, r.value));
  return ok(r.value.stdout.length === 0);
}

/**
 * The paths (relative to the repository's top, `/`-separated) whose content differs between two revisions, in Git's order, each once;
 * a rename gives both its old and its new path.
 */
export async function changedPaths(
  repo: string,
  from: string,
  to: string,
  options: GitOptions = {},
): Promise<Result<readonly string[], GitError>> {
  for (const rev of [from, to]) {
    const c = checkRev(rev);
    if (c.kind === "err") return c;
    const v = await git(repo, ["rev-parse", "--verify", "--quiet", `${rev}^{commit}`], options);
    if (v.kind === "err") return v;
    if (v.value.code !== 0)
      return err(failure(repo, ["rev-parse", rev], v.value, { kind: "bad-revision", rev, message: v.value.stderr || "unknown revision" }));
  }
  const args = ["diff", "--name-only", "-z", "--no-renames", "--no-ext-diff", "--no-textconv", from, to, "--"];
  const r = await git(repo, args, options);
  if (r.kind === "err") return r;
  if (r.value.code !== 0) return err(failure(repo, args, r.value));
  return ok([...new Set(nulFields(r.value.stdout))]);
}

/** A file's bytes as it is at a revision, its path relative to the repository's top (`/`-separated); `no-such-path` where it is not there. */
export async function fileAt(repo: string, rev: string, path: string, options: GitOptions = {}): Promise<Result<Uint8Array, GitError>> {
  const c = checkRev(rev);
  if (c.kind === "err") return c;
  const v = await git(repo, ["rev-parse", "--verify", "--quiet", `${rev}^{commit}`], options);
  if (v.kind === "err") return v;
  if (v.value.code !== 0)
    return err(failure(repo, ["rev-parse", rev], v.value, { kind: "bad-revision", rev, message: v.value.stderr || "unknown revision" }));
  const rel = path.replaceAll("\\", "/").replace(/^\.\//, "");
  const args = ["cat-file", "blob", `${rev}:${rel}`];
  const r = await git(repo, args, options);
  if (r.kind === "err") return r;
  if (r.value.code !== 0) return err(failure(repo, args, r.value, { kind: "no-such-path", rev, path: rel, message: r.value.stderr }));
  return ok(r.value.stdout);
}
