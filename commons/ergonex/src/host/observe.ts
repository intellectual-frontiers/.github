// Spec: 0002-workspace-model FR-022
/**
 * Observing a repository of the workspace with the real `git` (commons 0002-workspace-model FR-022, FR-028): what is at a path, its remote, its lock files, whether HEAD is on a branch, whether the
 * working tree has changes and how far the branch is from its upstream, read into `RepoFacts`, which the pure `classify` turns into one `RepoState`. This is the host layer of `state.ts`.
 *
 * @remarks
 * It only reads: `git` is run by its argument vector, never through a shell, with no pager, no terminal prompt and no optional locks, and no lock file is removed. With `fetch`, it runs `git fetch`
 * of `origin` first, which moves only the remote-tracking references, never a branch or the working tree; a fetch that fails (no network) leaves what was fetched before, and the state
 * is then of that. An empty folder is not a repository and holds nothing: it is `Missing`, where a clone can go. A folder with a `.git` that Git cannot read is `NotARepo`.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/commons/ts/kernel";
import type { RepoRef } from "@intellectual-frontiers/commons/ts/githost";
import { NotFound } from "../platform/r-errors.ts";
import { existsSync, lstatSync, readDirSync } from "../platform/r-fs.ts";
import { join } from "../platform/r-path.ts";
import { output } from "../platform/r-proc.ts";
import { classify, type RepoFacts, type RepoState } from "../state.ts";

/** How to observe. */
export type ObserveOptions = {
  /** Run `git fetch` of `origin` first, so that ahead and behind are against the remote as it is now. Off by default: a plan observes without the network. */
  readonly fetch?: boolean;
  /** The program (`git` on the path by default). */
  readonly program?: string;
  /** Variables added to `git`'s environment (a test isolates the configuration with them). */
  readonly env?: Readonly<Record<string, string>>;
};

/** Why `git` could not be run at all. */
export type ObserveError = {
  readonly kind: "git-missing";
  readonly program: string;
};

const ENV: Readonly<Record<string, string>> = {
  GIT_TERMINAL_PROMPT: "0",
  GIT_PAGER: "cat",
  PAGER: "cat",
  GIT_OPTIONAL_LOCKS: "0",
  LC_ALL: "C",
  LANGUAGE: "C",
};

type Ran = { readonly code: number; readonly stdout: string };

async function git(folder: string, args: readonly string[], options: ObserveOptions): Promise<Result<Ran, ObserveError>> {
  const program = options.program ?? "git";
  try {
    const r = await output([program, "--no-pager", "-C", folder, ...args], {
      env: { ...ENV, ...options.env },
    });
    return ok({
      code: r.code,
      stdout: new TextDecoder().decode(r.stdout).trim(),
    });
  } catch (e) {
    if (e instanceof NotFound) return err({ kind: "git-missing", program });
    throw e;
  }
}

/** Whether a folder holds a lock file of Git: `*.lock` at the top of its Git directory, or under `refs/`. */
function hasLockFile(gitDir: string): boolean {
  const walk = (dir: string, depth: number): boolean => {
    let entries;
    try {
      entries = readDirSync(dir);
    } catch {
      return false;
    }
    for (const e of entries) {
      if (e.isFile && e.name.endsWith(".lock")) return true;
      if (e.isDirectory && depth > 0 && walk(join(dir, e.name), depth - 1)) return true;
    }
    return false;
  };
  const top = readDirSync(gitDir).some((e) => e.isFile && e.name.endsWith(".lock"));
  return top || (existsSync(join(gitDir, "refs")) && walk(join(gitDir, "refs"), 6));
}

/** What is at a folder: the facts the classification reads. */
export async function observeFacts(folder: string, options: ObserveOptions = {}): Promise<Result<RepoFacts, ObserveError>> {
  if (!existsSync(folder)) return ok({ kind: "absent" });
  if (!lstatSync(folder).isDirectory) return ok({ kind: "not-a-repository" });
  if (readDirSync(folder).length === 0) return ok({ kind: "absent" });
  if (!existsSync(join(folder, ".git"))) return ok({ kind: "not-a-repository" });

  const dir = await git(folder, ["rev-parse", "--absolute-git-dir"], options);
  if (dir.kind === "err") return dir;
  if (dir.value.code !== 0 || dir.value.stdout === "") return ok({ kind: "not-a-repository" });

  const remote = await git(folder, ["config", "--get", "remote.origin.url"], options);
  if (remote.kind === "err") return remote;
  const originUrl = remote.value.code === 0 && remote.value.stdout !== "" ? remote.value.stdout : undefined;

  if (options.fetch === true && originUrl !== undefined) {
    const f = await git(folder, ["fetch", "--quiet", "origin"], options);
    if (f.kind === "err") return f;
  }

  const head = await git(folder, ["symbolic-ref", "-q", "HEAD"], options);
  if (head.kind === "err") return head;
  const detached = head.value.code !== 0;

  const status = await git(folder, ["status", "--porcelain=v1", "-z", "--untracked-files=normal", "--ignore-submodules=none"], options);
  if (status.kind === "err") return status;
  const dirty = status.value.code === 0 && status.value.stdout !== "";

  let ahead = 0;
  let behind = 0;
  if (!detached) {
    const counts = await git(folder, ["rev-list", "--left-right", "--count", "HEAD...@{upstream}"], options);
    if (counts.kind === "err") return counts;
    const m = counts.value.code === 0 ? /^(\d+)\s+(\d+)$/.exec(counts.value.stdout) : null;
    if (m !== null) {
      ahead = Number(m[1]);
      behind = Number(m[2]);
    } else {
      // no upstream: the commits that are on no remote are the branch's own, and there is nothing to be behind
      const own = await git(folder, ["rev-list", "--count", "HEAD", "--not", "--remotes"], options);
      if (own.kind === "err") return own;
      ahead = own.value.code === 0 && /^\d+$/.test(own.value.stdout) ? Number(own.value.stdout) : 0;
    }
  }
  return ok({
    kind: "repository",
    remote: originUrl,
    lockFile: hasLockFile(dir.value.stdout),
    detached,
    dirty,
    ahead,
    behind,
  });
}

/** The one state of the repository at a folder, against the repository the manifest names there. */
export async function observe(folder: string, expected: RepoRef, options: ObserveOptions = {}): Promise<Result<RepoState, ObserveError>> {
  const facts = await observeFacts(folder, options);
  return facts.kind === "err" ? facts : ok(classify(facts.value, expected));
}
