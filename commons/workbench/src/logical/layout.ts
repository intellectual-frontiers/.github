// Spec: 0002-workbench-terms FR-002, FR-003, FR-004
/**
 * The suggested layout of a workspace, so that a path means the same on every workshop and workstation: a repository at `<home>/workspaces/<githost>/<org>/<repo>`, a worktree of one actor on one task beside it at
 * `<repo>.wt/<actor>/<task>`, other stores at `<home>/workspaces/stores/<kind>/<place>`, and what the workbench keeps (claims, hand-back reports, approvals, the output of `ready`) in `.workbench` of the repository. An actor is a
 * person or an agent and never two at once: one actor to a worktree.
 *
 * @example
 * ```ts
 * import { parseRemote, workspacePath, worktreePath } from "./layout.ts";
 * const r = parseRemote("git@github.com:example-org/example-repo.git");
 * r.kind === "ok" && workspacePath("/home/u", r.value); // "/home/u/workspaces/github.com/example-org/example-repo"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";

/** Where a repository is: its Git host, organization and name. */
export type Remote = { readonly githost: string; readonly org: string; readonly repo: string };

/** The folder of the workbench's own records in a repository: not committed. */
export const WORKBENCH_DIR = ".workbench";

const SEGMENT = /^[A-Za-z0-9_][A-Za-z0-9._-]*$/u;
const HOST = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/u;
const safe = (s: string): boolean => SEGMENT.test(s) && s !== "." && s !== ".." && !s.includes("..");

/** The remote of a clone from its URL: `https://host/org/repo(.git)`, `ssh://git@host/org/repo(.git)` or `git@host:org/repo(.git)`; or why it is none. */
export function parseRemote(url: string): Result<Remote, string> {
  const text = url.trim().replace(/\/+$/u, "");
  const patterns = [/^https?:\/\/(?:[^@/]+@)?([^/:]+)(?::\d+)?\/([^/]+)\/([^/]+?)(?:\.git)?$/u, /^ssh:\/\/(?:[^@/]+@)?([^/:]+)(?::\d+)?\/([^/]+)\/([^/]+?)(?:\.git)?$/u, /^[^@/\s]+@([^:/]+):([^/]+)\/([^/]+?)(?:\.git)?$/u];
  for (const p of patterns) {
    const m = p.exec(text);
    if (m === null) continue;
    const githost = (m[1] ?? "").toLowerCase();
    const org = m[2] ?? "";
    const repo = m[3] ?? "";
    if (!HOST.test(githost) || !safe(org) || !safe(repo)) return err(`${JSON.stringify(url)} names a host, organization or repository that is not a safe folder name`);
    return ok({ githost, org, repo });
  }
  return err(`${JSON.stringify(url)} is not a Git remote of the form https://host/org/repo, ssh://host/org/repo or git@host:org/repo`);
}

const join = (...parts: readonly string[]): string => parts.join("/").replace(/\/{2,}/gu, "/");

/** The folder of a repository's primary checkout, which is a person's: an agent never writes it. */
export const workspacePath = (home: string, r: Remote): string => join(home, "workspaces", r.githost, r.org, r.repo);

/** The segment that names an actor in a path: `human-<id>` or `agent-<harness>-<session>`, each part made safe. */
export function actorSegment(kind: "human" | "agent", id: string, session?: string): Result<string, string> {
  const parts = kind === "human" ? [id] : [id, session ?? ""].filter((p) => p !== "");
  if (parts.length === 0 || parts.some((p) => !safe(p))) return err("an actor is named by safe words: letters, digits, dots, hyphens and underscores");
  return ok(`${kind}-${parts.join("-")}`);
}

/** The folder of one actor's worktree for one task: the repository's folder, `.wt`, the actor and the task. */
export function worktreePath(home: string, r: Remote, actor: string, task: string): Result<string, string> {
  if (!safe(actor) || !safe(task)) return err("an actor and a task are named by safe words");
  return ok(join(`${workspacePath(home, r)}.wt`, actor, task));
}

/** The folder of another store (a bucket, a drive) by its kind and place. */
export function storePath(home: string, kind: string, place: string): Result<string, string> {
  if (!safe(kind) || !place.split("/").every((s) => safe(s))) return err("a store is named by a kind and a place of safe words");
  return ok(join(home, "workspaces", "stores", kind, place));
}
