// Spec: 0003-git-ref FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008
/**
 * A branch of a Git repository as a store. It is written with Git's plumbing, so the working tree, the index and the branch a person has checked out are never touched, and it refuses a branch that is checked out
 * in a working tree (a commit made under a person's feet would show there as the opposite change). A file is an object, its revision is `sha256:` and the digest of its bytes (so a revision means the same as in
 * every other store, and Git's own names for the blob and the commit are given beside it), a write is guarded by the revision it expects and by the tip it was made on, a batch is one commit, a history is the commits
 * that changed the file, and a branch that has no commit yet is made by the first write with no parent. It holds regular files: a link or another repository in the tree is refused when it is named and left out of a list;
 * large files are refused at a limit and large file storage is not part of it.
 *
 * @example
 * ```ts
 * import { gitRefStore, parseIdentity } from "@intellectual-frontiers/anyfs-git";
 * const who = parseIdentity("collector", "collector@localhost");
 * // const opened = who.kind === "ok" && await gitRefStore({ repo: "/srv/fleet.git", branch: "fleet", commit: { author: who.value } });
 * // opened.kind === "ok" && await opened.value.store.write(path, bytes, expectAny);
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import {
  comparePaths,
  type Cursor,
  formatPlace,
  missing,
  parseCursor,
  parsePath,
  type Path,
  type Place,
  type Prefix,
  type Problem,
  portabilityFindings,
  refused,
  type Revision,
  ROOT,
  unavailable,
} from "@intellectual-frontiers/anyfs/governance";
import { type ChangeResult, type Done, type Handler, makeStore, type Op, type Stat, type Store, type Versions } from "@intellectual-frontiers/anyfs/logical";
import { DEFAULT_MAX_OBJECT_BYTES, defaultSubject, gitPathProblems, type Identity, type Subject, type Trailer } from "@intellectual-frontiers/anyfs-git/governance";
import { failure, type Git, openGit, textOf } from "../git.ts";
import { Digests, type Entry, isRegular, lsTree, revisionOf } from "../objects.ts";
import { type Authorship, Branch, type Mutation, repoPath } from "./branch.ts";
import { fetchBranch, type Fetched, pushBranch, type Pushed, type RemoteProblem } from "./remote.ts";

/** The capabilities of the store of a branch. */
export const GIT_REF_CAPABILITIES = ["read", "write", "list", "stat", "delete", "cas", "batch", "rename", "history"] as const;
/** The type of the store of a branch. */
export type GitRefStore = Store<(typeof GIT_REF_CAPABILITIES)[number]>;

/** Who a commit is by and what it says: set by the program, never read from the configuration of a computer. */
export type CommitOptions = {
  readonly author: Identity;
  /** Where it differs from the author. */
  readonly committer?: Identity;
  /** The first line of the message, from what the commit changes. */
  readonly subject?: Subject;
  /** Lines after the message. */
  readonly trailers?: readonly Trailer[];
  /** The clock that dates a commit, in milliseconds. */
  readonly clock?: () => number;
};

/** What the store of a branch is made with. */
export type GitRefOptions = {
  /** The repository: its working tree, its Git folder, or a bare repository; an absolute path. */
  readonly repo: string;
  readonly branch: string;
  /** The folder of the branch the store is of (the top of the branch where none). */
  readonly prefix?: Prefix;
  readonly commit: CommitOptions;
  /** The largest object, in bytes (50 MiB where none). */
  readonly maxObjectBytes?: number;
  /** Refuse a path another file system could not hold (the default). */
  readonly portable?: boolean;
  /** How many times to read a branch that moved and try again (8 where none). */
  readonly attempts?: number;
  /** Make a store of a branch that is checked out in a working tree: what a person sees there changes under them. */
  readonly allowCheckedOut?: boolean;
  /** The program that runs Git (`git` where none). */
  readonly program?: string;
};

/** What Git knows of a file beyond what a store says. */
export type ObjectInfo = {
  readonly path: Path;
  /** The name of the blob in Git. */
  readonly blob: string;
  /** The mode of the file in Git: `100644` or `100755`. */
  readonly mode: string;
  readonly size: number;
  readonly rev: Revision;
  /** The newest commit that changed the file. */
  readonly commit: string;
};

/** One commit that changed a file. */
export type LogEntry = {
  readonly commit: string;
  readonly author: { readonly name: string; readonly email: string };
  /** When it was made (ISO 8601, UTC). */
  readonly at: string;
  readonly subject: string;
  /** The revision the file had after it, or nothing where it removed the file. */
  readonly rev: Revision | undefined;
};

/** A store of a branch, with what Git adds. */
export type GitRef = {
  readonly store: GitRefStore;
  readonly repo: string;
  readonly branch: string;
  /** The commit at the tip of the branch, or nothing where there is none yet. */
  tip(): Promise<Result<string | undefined, Problem>>;
  /** The blob, mode and newest commit of a file. */
  info(path: Path): Promise<Result<ObjectInfo, Problem>>;
  /** The commits that changed a file, newest first, with who made them. */
  log(path: Path, limit?: number): Promise<Result<readonly LogEntry[], Problem>>;
  /** Pushes this branch and nothing else to a remote; never forced, so a remote that has moved is refused. */
  push(remote: string): Promise<Result<Pushed, RemoteProblem>>;
  /** Brings the branch up to a remote's where that is a fast-forward; a branch that has diverged is left as it is and said so. */
  fetch(remote: string): Promise<Result<Fetched, RemoteProblem>>;
};

const PAGE = 1000;
const MAX_PAGE = 10000;
const DEFAULT_ATTEMPTS = 8;

const bad = (error: string): Result<never, string> => err(error);

/** The branch of a repository as a store, or why there is none. */
export async function gitRefStore(options: GitRefOptions): Promise<Result<GitRef, string>> {
  const opened = await openGit(options.repo, options.program);
  if (opened.kind === "err") return opened;
  const git = opened.value;
  const name = await git.run(["check-ref-format", `refs/heads/${options.branch}`]);
  if (!name.success || options.branch.startsWith("-")) return bad(`${JSON.stringify(options.branch)} is not the name of a branch`);
  const prefix = options.prefix ?? ROOT;
  const portable = options.portable !== false;
  const maxObjectBytes = options.maxObjectBytes ?? DEFAULT_MAX_OBJECT_BYTES;
  const attempts = Math.max(1, Math.floor(options.attempts ?? DEFAULT_ATTEMPTS));
  if (options.allowCheckedOut !== true) {
    const where = await checkedOutAt(git, options.branch);
    if (where !== undefined) {
      return bad(
        `${options.branch} is checked out at ${where}: a commit made on it would show there as the opposite change; use another branch, or allow it with allowCheckedOut`,
      );
    }
  }
  const author = options.commit.author;
  const authorship: Authorship = {
    author,
    committer: options.commit.committer ?? author,
    subject: options.commit.subject ?? defaultSubject,
    trailers: options.commit.trailers ?? [],
    clock: options.commit.clock ?? ((): number => Date.now()),
  };
  const digests = new Digests();
  const branch = new Branch({ git, branch: options.branch, prefix, authorship, maxObjectBytes, portable, attempts, digests });
  const place: Place = { kind: "git", repo: git.gitDir, ref: options.branch };

  const unportable = (p: Path): Problem | undefined => {
    const problems = [...gitPathProblems(p), ...(portable ? portabilityFindings(p) : [])];
    return problems[0] === undefined ? undefined : refused("unportable-path", problems[0], p);
  };

  const lookup = async (p: Path): Promise<Result<{ readonly tip: string; readonly entry: Entry }, Problem>> => {
    const tip = await branch.tip();
    if (tip.kind === "err") return err(unavailable(tip.error, true));
    if (tip.value === undefined) return err(missing(p));
    const found = await lsTree(git, tip.value, [repoPath(prefix, p)], false);
    if (found.kind === "err") return err(unavailable(found.error, true));
    const entry = found.value.find((e) => e.name === repoPath(prefix, p));
    if (entry === undefined || entry.type === "tree") return err(missing(p));
    if (!isRegular(entry)) return err(refused("outside-scope", `${p} is ${entry.mode === "120000" ? "a symbolic link" : "not a file"} in the repository: the store holds files only`, p));
    return ok({ tip: tip.value, entry });
  };

  const statOf = async (p: Path): Promise<Result<Stat, Problem>> => {
    const at = await lookup(p);
    if (at.kind === "err") return at;
    const revs = await digests.of(git, [at.value.entry.oid]);
    if (revs.kind === "err") return err(unavailable(revs.error, true));
    const rev = revs.value.get(at.value.entry.oid);
    return rev === undefined ? err(unavailable(`the digest of ${p} is not known`, false)) : ok({ path: p, size: at.value.entry.size ?? 0, rev });
  };

  const read = async (p: Path): Promise<Result<{ readonly bytes: Uint8Array; readonly rev: Revision }, Problem>> => {
    const at = await lookup(p);
    if (at.kind === "err") return at;
    const out = await git.run(["cat-file", "blob", at.value.entry.oid]);
    if (!out.success) return err(unavailable(`git could not read ${p}: ${failure(out)}`, true));
    const rev = await revisionOf(out.stdout);
    digests.set(at.value.entry.oid, rev);
    return ok({ bytes: out.stdout, rev });
  };

  const list = async (op: Extract<Op, { op: "list" }>): Promise<Result<Done, Problem>> => {
    const tip = await branch.tip();
    if (tip.kind === "err") return err(unavailable(tip.error, true));
    if (tip.value === undefined) return ok({ op: "list" as const, value: { entries: [] as readonly Stat[] } });
    const under = repoPath(prefix, op.prefix);
    const tree = await lsTree(git, tip.value, under === "" ? [] : [`${under}/`], true);
    if (tree.kind === "err") return err(unavailable(tree.error, true));
    const limit = Math.min(Math.max(1, Math.floor(op.limit ?? PAGE)), MAX_PAGE);
    const after = op.after === undefined ? undefined : decodeURIComponent(op.after);
    const stripped = prefix === "" ? 0 : prefix.length + 1;
    const files: { readonly path: Path; readonly entry: Entry }[] = [];
    for (const e of tree.value) {
      if (!isRegular(e)) continue;
      const inside = e.name.slice(stripped);
      const parsed = parsePath(inside);
      // a name that is not text in its normal form is not an object of the store
      if (parsed.kind === "err" || parsed.value !== inside) continue;
      files.push({ path: parsed.value, entry: e });
    }
    files.sort((x, y) => comparePaths(x.path, y.path));
    const rest = after === undefined ? files : files.filter((f) => comparePaths(f.path, after) > 0);
    const page = rest.slice(0, limit);
    const revs = await digests.of(git, page.map((f) => f.entry.oid));
    if (revs.kind === "err") return err(unavailable(revs.error, true));
    const entries: Stat[] = [];
    for (const f of page) {
      const rev = revs.value.get(f.entry.oid);
      if (rev !== undefined) entries.push({ path: f.path, size: f.entry.size ?? 0, rev });
    }
    const last = page[page.length - 1];
    let next: Cursor | undefined;
    if (rest.length > limit && last !== undefined) {
      const c = parseCursor(encodeURIComponent(last.path));
      if (c.kind === "err") return err(unavailable(c.error, false));
      next = c.value;
    }
    return ok({ op: "list" as const, value: next === undefined ? { entries } : { entries, next } });
  };

  const log = async (p: Path, limit: number): Promise<Result<readonly LogEntry[], Problem>> => {
    const tip = await branch.tip();
    if (tip.kind === "err") return err(unavailable(tip.error, true));
    if (tip.value === undefined) return ok([]);
    const out = await git.run([
      "log",
      "-m",
      "--first-parent",
      "--no-renames",
      "--raw",
      "--no-abbrev",
      `-n${Math.min(Math.max(1, Math.floor(limit)), MAX_PAGE)}`,
      "--format=%x1e%H%x1f%an%x1f%ae%x1f%cI%x1f%s",
      branch.ref,
      "--",
      `:(literal)${repoPath(prefix, p)}`,
    ]);
    if (!out.success) return err(unavailable(`git could not read the history of ${p}: ${failure(out)}`, true));
    const entries: { commit: string; author: { name: string; email: string }; at: string; subject: string; oid: string | undefined }[] = [];
    for (const block of textOf(out.stdout).split("\x1e")) {
      if (block.trim() === "") continue;
      const [head = "", ...raw] = block.split("\n");
      const [commit = "", name = "", email = "", at = "", ...subject] = head.split("\x1f");
      const line = raw.find((l) => l.startsWith(":"));
      const fields = line === undefined ? [] : (line.split("\t")[0] ?? "").slice(1).split(" ");
      const oid = fields[3];
      entries.push({ commit, author: { name, email }, at: new Date(at).toISOString(), subject: subject.join("\x1f"), oid: oid === undefined || /^0+$/u.test(oid) ? undefined : oid });
    }
    const revs = await digests.of(git, entries.flatMap((e) => (e.oid === undefined ? [] : [e.oid])));
    if (revs.kind === "err") return err(unavailable(revs.error, true));
    return ok(entries.map((e) => ({ commit: e.commit, author: e.author, at: e.at, subject: e.subject, rev: e.oid === undefined ? undefined : revs.value.get(e.oid) })));
  };

  const mutate = async (ms: readonly Mutation[]) => {
    const targets = ms.flatMap((m) => (m.kind === "move" ? [m.to] : m.kind === "put" ? [m.path] : []));
    for (const t of targets) {
      const problem = unportable(t);
      if (problem !== undefined) return err(problem);
    }
    return branch.mutate(ms);
  };

  const handle: Handler = async (op) => {
    switch (op.op) {
      case "read": {
        const r = await read(op.path);
        return r.kind === "err" ? r : ok({ op: "read", value: { bytes: r.value.bytes, rev: r.value.rev } });
      }
      case "stat": {
        const r = await statOf(op.path);
        return r.kind === "err" ? r : ok({ op: "stat", value: r.value });
      }
      case "list":
        return list(op);
      case "write": {
        const done = await mutate([{ kind: "put", path: op.path, bytes: op.bytes, expect: op.expect }]);
        if (done.kind === "err") return done;
        const o = done.value.outcomes[0];
        return o?.kind === "put" ? ok({ op: "write", value: { rev: o.rev, created: o.created } }) : err(unavailable("the change made no outcome", false));
      }
      case "delete": {
        const done = await mutate([{ kind: "delete", path: op.path, expect: op.expect }]);
        if (done.kind === "err") return done;
        const o = done.value.outcomes[0];
        return o?.kind === "delete" ? ok({ op: "delete", value: { existed: o.existed } }) : err(unavailable("the change made no outcome", false));
      }
      case "rename": {
        const done = await mutate([{ kind: "move", from: op.from, to: op.to, expect: op.expect }]);
        if (done.kind === "err") return done;
        const o = done.value.outcomes[0];
        return o?.kind === "move" ? ok({ op: "rename", value: { rev: o.rev, created: true } }) : err(unavailable("the change made no outcome", false));
      }
      case "batch": {
        const done = await mutate(op.changes.map((c): Mutation => (c.kind === "put" ? { kind: "put", path: c.path, bytes: c.bytes, expect: c.expect } : { kind: "delete", path: c.path, expect: c.expect })));
        if (done.kind === "err") return done;
        const results: ChangeResult[] = [];
        for (const [i, o] of done.value.outcomes.entries()) {
          const c = op.changes[i];
          if (c === undefined) continue;
          if (c.kind === "put" && o.kind === "put") results.push({ kind: "put", path: c.path, rev: o.rev, created: o.created });
          else if (c.kind === "delete" && o.kind === "delete") results.push({ kind: "delete", path: c.path, existed: o.existed });
        }
        return ok({ op: "batch", value: { results } });
      }
      case "history": {
        const at = await lookup(op.path);
        if (at.kind === "err") return at;
        const entries = await log(op.path, op.limit ?? PAGE);
        if (entries.kind === "err") return entries;
        const versions: { rev: Revision; size: number; modified: string }[] = [];
        const sizes = await lsTreeSizes(git, entries.value.map((e) => e.commit), repoPath(prefix, op.path));
        for (const e of entries.value) {
          if (e.rev === undefined) continue;
          if (versions[versions.length - 1]?.rev === e.rev) continue;
          versions.push({ rev: e.rev, size: sizes.get(e.commit) ?? 0, modified: e.at });
        }
        const value: Versions = { versions };
        return ok({ op: "history", value });
      }
      case "rangeRead":
      case "append":
      case "search":
        return err(refused("capability-absent", `the store of a branch does not have ${op.op}`));
      default:
        return err(unavailable("an operation of no known kind", false));
    }
  };

  const store = makeStore({ id: formatPlace(place), place, consistency: "strong", traits: { caseSensitive: true, maxObject: maxObjectBytes }, capabilities: GIT_REF_CAPABILITIES, handle });

  return ok({
    store,
    repo: git.gitDir,
    branch: options.branch,
    async tip() {
      const t = await branch.tip();
      return t.kind === "err" ? err(unavailable(t.error, true)) : ok(t.value);
    },
    async info(p) {
      const at = await lookup(p);
      if (at.kind === "err") return at;
      const revs = await digests.of(git, [at.value.entry.oid]);
      if (revs.kind === "err") return err(unavailable(revs.error, true));
      const rev = revs.value.get(at.value.entry.oid);
      const newest = await log(p, 1);
      if (newest.kind === "err") return newest;
      const commit = newest.value[0]?.commit;
      if (rev === undefined || commit === undefined) return err(unavailable(`Git has no record of ${p}`, false));
      return ok({ path: p, blob: at.value.entry.oid, mode: at.value.entry.mode, size: at.value.entry.size ?? 0, rev, commit });
    },
    log: (p, limit = PAGE) => log(p, limit),
    push: (remote) => pushBranch(git, options.branch, remote),
    fetch: (remote) => fetchBranch(git, options.branch, remote),
  });
}

/** The size of a file at each of some commits (a commit where it is not there has none). */
async function lsTreeSizes(git: Git, commits: readonly string[], file: string): Promise<ReadonlyMap<string, number>> {
  const sizes = new Map<string, number>();
  await Promise.all(
    commits.map(async (c) => {
      const r = await lsTree(git, c, [file], false);
      const e = r.kind === "ok" ? r.value.find((x) => x.name === file) : undefined;
      if (e?.size !== undefined) sizes.set(c, e.size);
    }),
  );
  return sizes;
}

/** Where a branch is checked out, in this working tree or another: the folder, or nothing where it is not. */
async function checkedOutAt(git: Git, branch: string): Promise<string | undefined> {
  const out = await git.run(["worktree", "list", "--porcelain"]);
  if (!out.success) return undefined;
  let dir = "";
  for (const line of textOf(out.stdout).split("\n")) {
    if (line.startsWith("worktree ")) dir = line.slice("worktree ".length);
    if (line === `branch refs/heads/${branch}`) return dir;
  }
  return undefined;
}

