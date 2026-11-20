// Spec: 0002-workspace-model FR-007
/**
 * Worktrees with the real `git` (commons 0002-workspace-model FR-007, FR-027, 0001-ergonex FR-016): listing a repository's worktrees, making one for a branch, and removing one only where it has no
 * uncommitted change and no commit that is on no remote. Git's own refusal to remove a worktree with changes is a second guard under this one: `git worktree remove` is never given `--force`.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { existsSync, mkdir } from "../platform/r-fs.ts";
import { dirname } from "../platform/r-path.ts";
import { run } from "../platform/r-proc.ts";

const ENV: Readonly<Record<string, string>> = {
  GIT_TERMINAL_PROMPT: "0",
  GIT_PAGER: "cat",
  PAGER: "cat",
  LC_ALL: "C",
  LANGUAGE: "C",
};

/** One worktree of a repository: where it is, its branch (none where HEAD is detached) and whether it is the repository's own checkout. */
export type WorktreeInfo = {
  readonly path: string;
  readonly branch: string | undefined;
  readonly main: boolean;
};

async function git(folder: string, args: readonly string[]): Promise<Result<string, string>> {
  const r = await run(["git", "-C", folder, ...args], { env: ENV });
  return r.success ? ok(r.stdout.trim()) : err((r.stderr.split("\n").find((l) => l.trim() !== "") ?? "git failed").trim());
}

/** The worktrees of a repository, its own checkout first. */
export async function listWorktrees(folder: string): Promise<Result<readonly WorktreeInfo[], string>> {
  const r = await git(folder, ["worktree", "list", "--porcelain"]);
  if (r.kind === "err") return r;
  const out: WorktreeInfo[] = [];
  for (const block of r.value.split(/\n\s*\n/)) {
    const lines = block.split("\n");
    const path = lines.find((l) => l.startsWith("worktree "))?.slice("worktree ".length);
    if (path === undefined) continue;
    const branch = lines
      .find((l) => l.startsWith("branch "))
      ?.slice("branch ".length)
      .replace(/^refs\/heads\//, "");
    out.push({ path, branch, main: out.length === 0 });
  }
  return ok(out);
}

/** What a worktree holds that exists nowhere else: whether it has uncommitted changes, and how many commits are on no remote. */
export async function localWork(worktree: string): Promise<Result<{ readonly dirty: boolean; readonly unpushed: number }, string>> {
  const status = await git(worktree, ["status", "--porcelain=v1", "--untracked-files=normal"]);
  if (status.kind === "err") return status;
  const own = await git(worktree, ["rev-list", "--count", "HEAD", "--not", "--remotes"]);
  if (own.kind === "err") return own;
  return ok({ dirty: status.value !== "", unpushed: Number(own.value) || 0 });
}

/** Makes a worktree of the repository for a branch at `target`: the branch as it is where it exists, else a new one from HEAD. */
export async function createWorktree(folder: string, target: string, branch: string): Promise<Result<string, string>> {
  if (existsSync(target)) return err(`${target} exists`);
  await mkdir(dirname(target), { recursive: true });
  const exists = await git(folder, ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`]);
  const r = await git(folder, exists.kind === "ok" ? ["worktree", "add", target, branch] : ["worktree", "add", "-b", branch, target]);
  return r.kind === "ok" ? ok(`worktree for ${branch}`) : r;
}

/** Removes a worktree where it has no uncommitted change and no unpushed commit; never with `--force`. */
export async function removeWorktree(folder: string, worktree: string): Promise<Result<string, string>> {
  const work = await localWork(worktree);
  if (work.kind === "err") return work;
  if (work.value.dirty) return err("it has uncommitted changes");
  if (work.value.unpushed > 0)
    return err(`it has ${work.value.unpushed} commit${work.value.unpushed === 1 ? "" : "s"} that are on no remote`);
  const r = await git(folder, ["worktree", "remove", worktree]);
  return r.kind === "ok" ? ok("removed") : r;
}
