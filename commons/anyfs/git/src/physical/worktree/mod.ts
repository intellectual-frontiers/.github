// Spec: 0004-git-worktree FR-001, FR-002, FR-003, FR-004, FR-005
/**
 * A Git working tree as a store: the files below one folder of it, held as the store in a folder holds them, with the folder of Git itself never a path of the store (it is not listed and cannot be named), links and
 * folders never objects, and the commit an explicit operation of its own. A commit takes the paths asked for, or every changed path below the folder, and refuses to go on where something else in the repository has
 * changed (the default), so that it never takes what a person has staged; it never runs a hook unless asked, and it is by the identity the program gives, never by the configuration of a computer.
 *
 * @example
 * ```ts
 * import { gitWorktreeStore, parseIdentity } from "@intellectual-frontiers/anyfs-git";
 * const who = parseIdentity("collector", "collector@localhost");
 * // const opened = who.kind === "ok" && await gitWorktreeStore({ dir: "/srv/fleet", commit: { author: who.value } });
 * // opened.kind === "ok" && await opened.value.commit({ paths: [path] });
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import * as fs from "@intellectual-frontiers/system/fs";
import * as osPath from "@intellectual-frontiers/system/path";
import {
  comparePaths,
  type Cursor,
  formatPlace,
  parseCursor,
  parsePath,
  type Path,
  type Place,
  type Prefix,
  type Problem,
  refused,
  ROOT,
  unavailable,
} from "@intellectual-frontiers/anyfs/governance";
import { type Done, type Handler, type Listing, makeStore, type Op, type Stat, type Store } from "@intellectual-frontiers/anyfs/logical";
import { LOCAL_CAPABILITIES, localStore } from "@intellectual-frontiers/anyfs/local";
import { type Changed, defaultSubject, gitPathProblems, messageOf } from "@intellectual-frontiers/anyfs-git/governance";
import { failure, openGit, textOf } from "../git.ts";
import { literal } from "../objects.ts";
import type { CommitOptions } from "../ref/mod.ts";

/** The capabilities of the store of a working tree. */
export const GIT_WORKTREE_CAPABILITIES = LOCAL_CAPABILITIES;
/** The type of the store of a working tree. */
export type GitWorktreeStore = Store<(typeof GIT_WORKTREE_CAPABILITIES)[number]>;

/** What the store of a working tree is made with. */
export type GitWorktreeOptions = {
  /** The working tree (or any folder of it); an absolute path. */
  readonly dir: string;
  /** The folder of the working tree the store is of (the top where none). */
  readonly prefix?: Prefix;
  /** Who a commit is by, and what it says. */
  readonly commit: CommitOptions;
  /** Refuse a path another file system could not hold (the default). */
  readonly portable?: boolean;
  /** The program that runs Git (`git` where none). */
  readonly program?: string;
};

/** Whether a commit goes on when something it was not asked to take has changed: it is refused (the default) or the commit takes only what it was asked. */
export type DirtyPolicy = "refuse" | "allow";

/** What a commit is asked. */
export type CommitRequest = {
  /** The paths to take; every changed path below the folder where none. */
  readonly paths?: readonly Path[];
  readonly dirty?: DirtyPolicy;
  /** Run the hooks of the repository (they are off unless asked). */
  readonly hooks?: boolean;
};

/** What a commit came to: the commit (none where nothing had changed) and the paths it took. */
export type Committed = { readonly commit: string | undefined; readonly paths: readonly Path[] };

/** Why a commit was not made: a closed union. */
export type WorktreeProblem =
  | { readonly kind: "dirty"; readonly paths: readonly string[] }
  | { readonly kind: "outside"; readonly path: string }
  | { readonly kind: "git"; readonly message: string };

/** A change of the working tree: the path in the repository and what Git says of it. */
export type TreeChange = { readonly path: string; readonly status: string };

/** A store of a working tree, with what Git adds. */
export type GitWorktree = {
  readonly store: GitWorktreeStore;
  /** The top of the working tree. */
  readonly dir: string;
  /** Every changed path of the repository: staged, not staged and not tracked. */
  status(): Promise<Result<readonly TreeChange[], WorktreeProblem>>;
  /** Commits the paths asked for, or every changed path below the folder. */
  commit(request?: CommitRequest): Promise<Result<Committed, WorktreeProblem>>;
};

const PAGE = 1000;
const MAX_PAGE = 10000;
const HIDDEN = ".anyfs-";

/** The working tree as a store, or why there is none. */
export async function gitWorktreeStore(options: GitWorktreeOptions): Promise<Result<GitWorktree, string>> {
  const opened = await openGit(options.dir, options.program);
  if (opened.kind === "err") return opened;
  const git = opened.value;
  if (git.workTree === undefined) return err(`${options.dir} is a repository with no working tree`);
  const top = git.workTree;
  const prefix = options.prefix ?? ROOT;
  const root = prefix === "" ? top : osPath.join(top, ...prefix.split("/"));
  const inner = await localStore(root, { create: true, portable: options.portable !== false });
  if (inner.kind === "err") return inner;
  const store = inner.value;
  const place: Place = { kind: "git", repo: top };
  const author = options.commit.author;
  const committer = options.commit.committer ?? author;
  const subject = options.commit.subject ?? defaultSubject;
  const trailers = options.commit.trailers ?? [];
  const clock = options.commit.clock ?? ((): number => Date.now());
  const repoPath = (p: string): string => (prefix === "" ? p : `${prefix}/${p}`);

  const named = (op: Op): readonly Path[] => {
    switch (op.op) {
      case "read":
      case "write":
      case "stat":
      case "delete":
      case "history":
      case "rangeRead":
      case "append":
        return [op.path];
      case "rename":
        return [op.from, op.to];
      case "batch":
        return op.changes.map((c) => c.path);
      case "list":
      case "search":
        return [];
      default:
        return [];
    }
  };

  /** The files below a prefix that a store holds, in order: no folder of Git, no file the store of a folder makes, no link, no name that is not text in its normal form. */
  async function walk(under: Prefix): Promise<readonly Path[]> {
    const found: Path[] = [];
    const visit = async (dir: string, rel: string): Promise<void> => {
      let entries: { readonly name: string; readonly isFile: boolean; readonly isDirectory: boolean }[];
      try {
        entries = [];
        for await (const e of fs.readDir(dir)) entries.push(e);
      } catch {
        return;
      }
      for (const e of entries) {
        if (e.name.startsWith(HIDDEN) || e.name.toLowerCase() === ".git") continue;
        const sub = rel === "" ? e.name : `${rel}/${e.name}`;
        if (e.isDirectory) await visit(osPath.join(dir, e.name), sub);
        else if (e.isFile) {
          const parsed = parsePath(sub);
          if (parsed.kind === "ok" && parsed.value === sub && gitPathProblems(parsed.value).length === 0) found.push(parsed.value);
        }
      }
    };
    await visit(under === "" ? root : osPath.join(root, ...under.split("/")), under);
    return found.sort(comparePaths);
  }

  const list = async (op: Extract<Op, { op: "list" }>): Promise<Result<Done, Problem>> => {
    const limit = Math.min(Math.max(1, Math.floor(op.limit ?? PAGE)), MAX_PAGE);
    const after = op.after === undefined ? undefined : decodeURIComponent(op.after);
    const all = await walk(op.prefix);
    const rest = after === undefined ? all : all.filter((p) => comparePaths(p, after) > 0);
    const entries: Stat[] = [];
    let used = 0;
    for (const p of rest) {
      if (entries.length >= limit) break;
      used++;
      const s = await store.stat(p);
      if (s.kind === "ok") entries.push(s.value);
    }
    const last = entries[entries.length - 1];
    let next: Cursor | undefined;
    if (rest.length > used && last !== undefined) {
      const c = parseCursor(encodeURIComponent(last.path));
      if (c.kind === "err") return err(unavailable(c.error, false));
      next = c.value;
    }
    const value: Listing = next === undefined ? { entries } : { entries, next };
    return ok({ op: "list", value });
  };

  const handle: Handler = async (op) => {
    for (const p of named(op)) {
      const problem = gitPathProblems(p)[0];
      if (problem !== undefined) return err(refused("unportable-path", problem, p));
    }
    return op.op === "list" ? list(op) : store.handle(op);
  };

  const guarded = makeStore({ id: formatPlace(place), place, consistency: "strong", traits: store.traits, capabilities: GIT_WORKTREE_CAPABILITIES, handle });

  const status = async (): Promise<Result<readonly TreeChange[], WorktreeProblem>> => {
    const out = await git.run(["status", "--porcelain=v1", "-z", "--untracked-files=all", "--no-renames"], { cwd: top });
    if (!out.success) return err({ kind: "git", message: failure(out) });
    const changes: TreeChange[] = [];
    for (const record of textOf(out.stdout).split("\0")) {
      if (record.length < 4) continue;
      changes.push({ status: record.slice(0, 2), path: record.slice(3) });
    }
    return ok(changes);
  };

  const commit = async (request: CommitRequest = {}): Promise<Result<Committed, WorktreeProblem>> => {
    const changed = await status();
    if (changed.kind === "err") return changed;
    const below = (rp: string): boolean => prefix === "" || rp.startsWith(`${prefix}/`);
    let wanted: readonly TreeChange[];
    if (request.paths === undefined) {
      wanted = changed.value.filter((c) => below(c.path));
    } else {
      const set = new Set(request.paths.map((p) => repoPath(p)));
      for (const p of request.paths) {
        const problem = gitPathProblems(p)[0];
        if (problem !== undefined) return err({ kind: "outside", path: p });
      }
      wanted = changed.value.filter((c) => set.has(c.path));
    }
    const wantedPaths = new Set(wanted.map((c) => c.path));
    const others = changed.value.filter((c) => !wantedPaths.has(c.path) && (request.paths === undefined ? !below(c.path) : true));
    const policy = request.dirty ?? "refuse";
    if (policy === "refuse" && others.length > 0) return err({ kind: "dirty", paths: others.map((c) => c.path).sort() });
    if (wanted.length === 0) return ok({ commit: undefined, paths: [] });

    const specs = wanted.map((c) => literal(c.path));
    const add = await git.run(["add", "-A", "--", ...specs], { cwd: top, ...(request.hooks === true ? { hooks: true } : {}) });
    if (!add.success) return err({ kind: "git", message: failure(add) });
    const summary: Changed[] = wanted.map((c) => (c.status.includes("D") ? { kind: "delete", path: c.path } : { kind: "put", path: c.path }));
    const message = messageOf(subject, summary, trailers);
    const when = `${Math.floor(clock() / 1000)} +0000`;
    const made = await git.run(["commit", ...(request.hooks === true ? [] : ["--no-verify"]), "--no-gpg-sign", "--allow-empty-message", "-F", "-", "--", ...specs], {
      cwd: top,
      input: message,
      ...(request.hooks === true ? { hooks: true } : {}),
      env: {
        GIT_AUTHOR_NAME: author.name,
        GIT_AUTHOR_EMAIL: author.email,
        GIT_COMMITTER_NAME: committer.name,
        GIT_COMMITTER_EMAIL: committer.email,
        GIT_AUTHOR_DATE: when,
        GIT_COMMITTER_DATE: when,
      },
    });
    if (!made.success) return err({ kind: "git", message: failure(made) });
    const head = await git.run(["rev-parse", "HEAD"], { cwd: top });
    if (!head.success) return err({ kind: "git", message: failure(head) });
    const stripped = prefix === "" ? 0 : prefix.length + 1;
    const paths: Path[] = [];
    for (const c of wanted) {
      const p = parsePath(c.path.slice(stripped));
      if (p.kind === "ok") paths.push(p.value);
    }
    return ok({ commit: textOf(head.stdout).trim(), paths });
  };

  return ok({ store: guarded, dir: top, status, commit });
}
