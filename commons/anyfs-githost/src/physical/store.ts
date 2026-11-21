// Spec: 0002-anyfs-githost-store FR-006, FR-007, FR-008, FR-009, FR-010, FR-011, FR-012, FR-013
/**
 * A branch of a repository on a Git host as a store, over the REST API of the host (`HostApi`). A file is an object; its revision is `sha256:` and the digest of its bytes (the same text as in memory, on a disk and in a bucket, so a
 * bridge compares across stores), and the host's names for the blob and the commit are given beside it. A write is checked against the commit it was read at and made as a commit on it: a write expecting no object conflicts where there is
 * one, one expecting a revision conflicts where the file is at another, and where the host refuses the commit because the branch or a file moved under it the change is read again and checked again, so that writers of different files
 * both win and two writers who expect the same file cannot both. A batch is one commit, a rename is one commit, a change that changes nothing is no commit, and a branch that does not exist is made only where the store was told which
 * branch to start it from. It holds regular files: a link or another repository in the tree is refused when it is named and left out of a list.
 *
 * @remarks
 * What the store was found to be at open decides what it is: a token that may not push, or a branch it may not push to, gives a store of `read`, `list`, `stat` and `history` alone, in its type. A branch the host protects is said
 * in the facts, and a push the host refuses for that is `refused` with the host's words. Writers of one store queue; writers of other stores, or of other computers, meet at the host. A call is not retried here, and the layer
 * `retrying` does it for the problems that say they are worth one.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import {
  comparePaths,
  conflict,
  type Cursor,
  type Expect,
  type Found,
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
  tampered,
  unavailable,
} from "@intellectual-frontiers/anyfs/governance";
import { type ChangeResult, type Done, type Handler, makeStore, type Op, type Stat, type Store, type Versions } from "@intellectual-frontiers/anyfs/logical";
import { type Changed, DEFAULT_MAX_OBJECT_BYTES, defaultSubject, gitPathProblems, type Identity, messageOf, type Subject, type Trailer } from "@intellectual-frontiers/anyfs-githost/governance";
import type { ApiProblem, FileChange, HostApi, Located, LogItem } from "./api.ts";
import { gitBlobId, isBlob, revisionOf } from "./blob.ts";
import { describeApiProblem, problemOf } from "./errors.ts";

/** The capabilities of the store of a branch the token may push to. */
export const HOST_CAPABILITIES = ["read", "write", "list", "stat", "delete", "cas", "batch", "rename", "history"] as const;
/** The capabilities of the store of a branch the token may only read. */
export const HOST_READ_CAPABILITIES = ["read", "list", "stat", "history"] as const;

/** The type of the store of a branch that may be pushed to. */
export type HostStore = Store<(typeof HOST_CAPABILITIES)[number]>;
/** The type of the store of a branch that may only be read. */
export type HostReadStore = Store<(typeof HOST_READ_CAPABILITIES)[number]>;

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
export type HostStoreOptions = {
  readonly api: HostApi;
  readonly place: Place;
  readonly branch: string;
  /** The branch a branch that does not exist is started from: without it, a branch that does not exist is read as empty and is not written. */
  readonly createFrom?: string;
  /** The folder of the branch the store is of (the top where none). */
  readonly prefix?: Prefix;
  readonly commit: CommitOptions;
  /** The largest object, in bytes (25 MiB where none). */
  readonly maxObjectBytes?: number;
  /** Refuse a path another file system could not hold (the default). */
  readonly portable?: boolean;
  /** How many times to read a branch that moved and try again (8 where none). */
  readonly attempts?: number;
  /** How many blobs a listing or a history asks about at once (8 where none). */
  readonly listConcurrency?: number;
  /** Take every sentence through this before it leaves the store: the redactor of the token. */
  readonly redact?: (text: string) => string;
};

/** What the host said of the repository and the branch when the store was opened. */
export type HostFacts = {
  readonly host: "github" | "gitlab";
  readonly describe: string;
  readonly defaultBranch: string | undefined;
  readonly branch: string;
  /** Whether the branch exists. */
  readonly exists: boolean;
  /** The commit at its tip when it was opened. */
  readonly tip: string | undefined;
  /** Whether the host protects the branch. */
  readonly protected: boolean;
  /** Whether the token may push, as far as the host says: `unknown` where it does not. */
  readonly canPush: boolean | "unknown";
};

/** What the host knows of a file beyond what a store says. */
export type ObjectInfo = {
  readonly path: Path;
  /** The name of the blob in Git. */
  readonly blob: string;
  /** The mode of the file in Git: `100644` or `100755`. */
  readonly mode: string;
  readonly size: number;
  readonly rev: Revision;
  /** The newest commit that changed the file. */
  readonly commit: string | undefined;
};

/** One commit that changed a file. */
export type LogEntry = LogItem & {
  /** The revision the file had after it, or nothing where it removed the file. */
  readonly rev: Revision | undefined;
};

/** The parts of a store of a branch that do not depend on whether it may be written. */
export type HostRef = {
  readonly branch: string;
  readonly facts: HostFacts;
  /** The commit at the tip of the branch now, or nothing where there is none. */
  tip(): Promise<Result<string | undefined, Problem>>;
  /** The blob, mode and newest commit of a file. */
  info(path: Path): Promise<Result<ObjectInfo, Problem>>;
  /** The commits that changed a file, newest first, with who made them. */
  log(path: Path, limit?: number): Promise<Result<readonly LogEntry[], Problem>>;
};

/** A store of a branch that may be pushed to, and what the host adds. */
export type OpenedHost =
  | (HostRef & { readonly mode: "writable"; readonly store: HostStore })
  | (HostRef & { readonly mode: "read-only"; readonly store: HostReadStore });

const PAGE = 1000;
const MAX_PAGE = 10000;
const DEFAULT_ATTEMPTS = 8;
const LOG_LIMIT = 100;

/** An outcome of one change. */
type Outcome =
  | { readonly kind: "put"; readonly rev: Revision; readonly created: boolean }
  | { readonly kind: "delete"; readonly existed: boolean }
  | { readonly kind: "move"; readonly rev: Revision };

type Mutation =
  | { readonly kind: "put"; readonly path: Path; readonly bytes: Uint8Array; readonly expect: Expect }
  | { readonly kind: "delete"; readonly path: Path; readonly expect: Expect }
  | { readonly kind: "move"; readonly from: Path; readonly to: Path; readonly expect: Expect };

type Slot =
  | { readonly kind: "file"; readonly mode: string; readonly blob: string | undefined; readonly bytes: Uint8Array | undefined; readonly rev: Revision | undefined }
  | { readonly kind: "link"; readonly what: string }
  | { readonly kind: "folder" }
  | { readonly kind: "none" };

const NONE: Slot = { kind: "none" };

/** The path in the repository of a path of the store, or of a prefix of it: the root of the store is the folder the store is of. */
const repoPath = (prefix: string, p: string): string => (prefix === "" ? p : p === "" ? prefix : `${prefix}/${p}`);

const ancestorsOf = (p: string): readonly string[] => {
  const out: string[] = [];
  let at = p.lastIndexOf("/");
  while (at > 0) {
    out.push(p.slice(0, at));
    at = p.lastIndexOf("/", at - 1);
  }
  return out;
};

function check(p: Path, expect: Expect, rev: Revision | undefined): Problem | undefined {
  switch (expect.kind) {
    case "any":
      return undefined;
    case "absent":
      return rev === undefined ? undefined : conflict(p, expect, { kind: "rev", rev });
    case "rev":
      if (rev === undefined) return conflict(p, expect, { kind: "absent" });
      return rev === expect.rev ? undefined : conflict(p, expect, { kind: "rev", rev });
    default:
      return unavailable("an expectation of no known kind", false);
  }
}

const found = (rev: Revision | undefined): Found => (rev === undefined ? { kind: "absent" } : { kind: "rev", rev });
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Runs jobs a few at a time, in order of the results. */
async function inGroups<T, R>(items: readonly T[], width: number, run: (item: T) => Promise<R>): Promise<readonly R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += width) out.push(...(await Promise.all(items.slice(i, i + width).map(run))));
  return out;
}

/** The store of a branch on a host, or why there is none. */
export async function openHostStore(options: HostStoreOptions): Promise<Result<OpenedHost, string>> {
  const { api } = options;
  const redact = options.redact ?? ((t: string): string => t);
  const say = (p: ApiProblem): string => redact(describeApiProblem(p));
  const repo = await api.repo();
  if (repo.kind === "err") return err(`${api.describe}: ${say(repo.error)}`);
  const name = options.branch;
  if (name.trim() === "" || name.startsWith("-") || /[\u0000-\u001f\u007f ~^:?*[\\]/u.test(name) || name.includes("..") || name.endsWith("/") || name.endsWith(".lock")) return err(`${JSON.stringify(name)} is not the name of a branch`);
  const branch = await api.branch(name);
  if (branch.kind === "err") return err(`${api.describe}: ${say(branch.error)}`);
  let base: string | undefined;
  if (branch.value === undefined && options.createFrom !== undefined) {
    const from = await api.branch(options.createFrom);
    if (from.kind === "err") return err(`${api.describe}: ${say(from.error)}`);
    if (from.value === undefined) return err(`the branch ${options.createFrom} to start ${name} from does not exist`);
    base = from.value.tip;
  }
  const prefix = options.prefix ?? ROOT;
  const portable = options.portable !== false;
  const maxObjectBytes = options.maxObjectBytes ?? DEFAULT_MAX_OBJECT_BYTES;
  const attempts = Math.max(1, Math.floor(options.attempts ?? DEFAULT_ATTEMPTS));
  const width = Math.max(1, Math.floor(options.listConcurrency ?? 8));
  const author = options.commit.author;
  const committer = options.commit.committer ?? author;
  const subject = options.commit.subject ?? defaultSubject;
  const trailers = options.commit.trailers ?? [];
  const clock = options.commit.clock ?? ((): number => Date.now());

  const known = new Map<string, { readonly rev: Revision; readonly size: number }>();
  const located = new Map<string, Located>();

  const problem = (p: ApiProblem, path?: Path): Problem => {
    const q = problemOf(p, path === undefined ? {} : { path });
    return q.kind === "unavailable" || q.kind === "refused" ? { ...q, detail: redact(q.detail) } : q;
  };

  const tipOf = async (): Promise<Result<string | undefined, Problem>> => {
    const b = await api.branch(name);
    return b.kind === "err" ? err(problem(b.error)) : ok(b.value?.tip);
  };

  const locate = async (commit: string, rp: string): Promise<Result<Located, Problem>> => {
    const key = `${commit}\0${rp}`;
    const had = located.get(key);
    if (had !== undefined) return ok(had);
    const l = await api.locate(commit, rp);
    if (l.kind === "err") return err(problem(l.error));
    located.set(key, l.value);
    return ok(l.value);
  };

  /** What a blob holds: its revision and size, read once and kept by its name. */
  const digestOf = async (blob: string, p: Path | undefined): Promise<Result<{ readonly rev: Revision; readonly size: number; readonly bytes?: Uint8Array }, Problem>> => {
    const had = known.get(blob);
    if (had !== undefined) return ok(had);
    const b = await api.blob(blob);
    if (b.kind === "err") return err(problem(b.error, p));
    if (!(await isBlob(blob, b.value))) {
      const said = `the bytes the host gave are not the blob ${blob.slice(0, 12)}`;
      return err(p === undefined ? unavailable(said, false) : tampered(p, said));
    }
    const rev = await revisionOf(b.value);
    known.set(blob, { rev, size: b.value.length });
    return ok({ rev, size: b.value.length, bytes: b.value });
  };

  const unportable = (p: Path): Problem | undefined => {
    const problems = [...gitPathProblems(p), ...(portable ? portabilityFindings(p) : [])];
    return problems[0] === undefined ? undefined : refused("unportable-path", problems[0], p);
  };

  const fileAt = async (commit: string, p: Path): Promise<Result<{ readonly blob: string; readonly mode: string }, Problem>> => {
    const at = await locate(commit, repoPath(prefix, p));
    if (at.kind === "err") return at;
    if (at.value.kind === "link") return err(refused("outside-scope", `${p} is ${at.value.what} in the repository: the store holds files only`, p));
    return at.value.kind === "file" ? ok({ blob: at.value.blob, mode: at.value.mode }) : err(missing(p));
  };

  const read = async (p: Path): Promise<Result<{ readonly bytes: Uint8Array; readonly rev: Revision }, Problem>> => {
    const tip = await tipOf();
    if (tip.kind === "err") return tip;
    if (tip.value === undefined) return err(missing(p));
    const f = await fileAt(tip.value, p);
    if (f.kind === "err") return f;
    const b = await api.blob(f.value.blob);
    if (b.kind === "err") return err(problem(b.error, p));
    if (!(await isBlob(f.value.blob, b.value))) return err(tampered(p, `the bytes the host gave are not the blob ${f.value.blob.slice(0, 12)}`));
    const rev = await revisionOf(b.value);
    known.set(f.value.blob, { rev, size: b.value.length });
    return ok({ bytes: b.value, rev });
  };

  const statOf = async (p: Path): Promise<Result<Stat, Problem>> => {
    const tip = await tipOf();
    if (tip.kind === "err") return tip;
    if (tip.value === undefined) return err(missing(p));
    const f = await fileAt(tip.value, p);
    if (f.kind === "err") return f;
    const d = await digestOf(f.value.blob, p);
    return d.kind === "err" ? d : ok({ path: p, size: d.value.size, rev: d.value.rev });
  };

  const list = async (op: Extract<Op, { op: "list" }>): Promise<Result<Done, Problem>> => {
    const tip = await tipOf();
    if (tip.kind === "err") return tip;
    if (tip.value === undefined) return ok({ op: "list" as const, value: { entries: [] as readonly Stat[] } });
    const under = repoPath(prefix, op.prefix);
    const tree = await api.list(tip.value, under);
    if (tree.kind === "err") return err(problem(tree.error));
    const limit = Math.min(Math.max(1, Math.floor(op.limit ?? PAGE)), MAX_PAGE);
    const after = op.after === undefined ? undefined : decodeURIComponent(op.after);
    const stripped = prefix === "" ? 0 : prefix.length + 1;
    const files: { readonly path: Path; readonly blob: string }[] = [];
    for (const e of tree.value) {
      // a path below the folder asked for only: a listing of `a` is not of `ab`
      if (under !== "" && !e.path.startsWith(`${under}/`)) continue;
      const inside = e.path.slice(stripped);
      const parsed = parsePath(inside);
      // a name that is not text in its normal form is not an object of the store
      if (parsed.kind === "err" || parsed.value !== inside) continue;
      files.push({ path: parsed.value, blob: e.blob });
    }
    files.sort((x, y) => comparePaths(x.path, y.path));
    const rest = after === undefined ? files : files.filter((f) => comparePaths(f.path, after) > 0);
    const page = rest.slice(0, limit);
    const digests = await inGroups(page, width, (f) => digestOf(f.blob, f.path));
    const entries: Stat[] = [];
    for (const [i, d] of digests.entries()) {
      const f = page[i];
      if (d.kind === "err") return d;
      if (f !== undefined) entries.push({ path: f.path, size: d.value.size, rev: d.value.rev });
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
    const tip = await tipOf();
    if (tip.kind === "err") return tip;
    if (tip.value === undefined) return ok([]);
    const items = await api.log(tip.value, repoPath(prefix, p), Math.min(Math.max(1, Math.floor(limit)), LOG_LIMIT));
    if (items.kind === "err") return err(problem(items.error, p));
    const revs = await inGroups(items.value, width, async (item): Promise<Result<Revision | undefined, Problem>> => {
      const at = await locate(item.commit, repoPath(prefix, p));
      if (at.kind === "err") return at;
      if (at.value.kind !== "file") return ok(undefined);
      const d = await digestOf(at.value.blob, p);
      return d.kind === "err" ? d : ok(d.value.rev);
    });
    const out: LogEntry[] = [];
    for (const [i, item] of items.value.entries()) {
      const r = revs[i];
      if (r === undefined || r.kind === "err") return r ?? err(unavailable("a revision of the history is not known", false));
      out.push({ ...item, rev: r.value });
    }
    return ok(out);
  };

  /** The changes being made by this store, one after another: writers of one store queue, so that only writers of other stores meet at the host. */
  let queue: Promise<unknown> = Promise.resolve();
  const serially = async <T>(job: () => Promise<T>): Promise<T> => {
    const run = queue.then(job, job);
    queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };

  const vet = (m: Mutation): Problem | undefined => {
    const paths = m.kind === "move" ? [m.to] : [m.path];
    for (const p of paths) {
      const bad = unportable(p);
      if (bad !== undefined) return bad;
      if (repoPath(prefix, p).length > 4096) return refused("unportable-path", "the path is too long for the repository", p);
    }
    if (m.kind === "put" && m.bytes.length > maxObjectBytes) {
      return refused("too-large", `${m.path} is ${m.bytes.length} bytes and the store holds objects of at most ${maxObjectBytes}: large files are not kept in Git by this store`, m.path);
    }
    return undefined;
  };

  const once = async (mutations: readonly Mutation[]): Promise<Result<{ readonly outcomes: readonly Outcome[]; readonly commit: string | undefined }, Problem> | "moved"> => {
    const tipped = await tipOf();
    if (tipped.kind === "err") return tipped;
    const create = tipped.value === undefined;
    const at = tipped.value ?? base;
    if (at === undefined) return err(refused("outside-scope", `the branch ${name} does not exist: say which branch to start it from to make it`));

    /** What is at a path of the commit the changes are checked at. */
    const slotAtBase = async (rp: string): Promise<Result<Slot, Problem>> => {
      const l = await locate(at, rp);
      if (l.kind === "err") return l;
      if (l.value.kind === "file") {
        const d = await digestOf(l.value.blob, undefined);
        return d.kind === "err" ? d : ok({ kind: "file", mode: l.value.mode, blob: l.value.blob, bytes: undefined, rev: d.value.rev });
      }
      if (l.value.kind === "dir") return ok({ kind: "folder" });
      if (l.value.kind === "link") return ok({ kind: "link", what: l.value.what });
      return ok(NONE);
    };
    const overlay = new Map<string, Slot>();
    const slotOf = async (rp: string): Promise<Result<Slot, Problem>> => {
      const had = overlay.get(rp);
      return had !== undefined ? ok(had) : slotAtBase(rp);
    };
    /** Whether a file at the path would sit on a file or a folder of the same name. */
    const collides = async (p: Path, rp: string): Promise<Problem | undefined> => {
      const here = await slotOf(rp);
      if (here.kind === "err") return here.error;
      if (here.value.kind === "folder") return refused("unportable-path", `${p} is a folder in the repository: Git holds a file or a folder at a path, never both`, p);
      for (const a of ancestorsOf(rp)) {
        const up = await slotOf(a);
        if (up.kind === "err") return up.error;
        if (up.value.kind === "file" || up.value.kind === "link") return refused("unportable-path", `a file of the repository is at ${a}, so nothing can be below it`, p);
      }
      for (const [other, s] of overlay) {
        if (s.kind === "file" && other.startsWith(`${rp}/`)) return refused("unportable-path", `${p} would be a file where a folder of the same name is made in this change`, p);
      }
      return undefined;
    };

    const outcomes: Outcome[] = [];
    const changed: Changed[] = [];
    const moves: { readonly from: string; readonly to: string; readonly blob: string; readonly mode: string }[] = [];
    for (const m of mutations) {
      switch (m.kind) {
        case "put": {
          const rp = repoPath(prefix, m.path);
          const bad = await collides(m.path, rp);
          if (bad !== undefined) return err(bad);
          const here = await slotOf(rp);
          if (here.kind === "err") return here;
          if (here.value.kind === "link") return err(refused("outside-scope", `${m.path} is ${here.value.what} in the repository: the store holds files only`, m.path));
          const rev = await revisionOf(m.bytes);
          const had = here.value.kind === "file" ? here.value : undefined;
          const problem = check(m.path, m.expect, had?.rev);
          if (problem !== undefined) return err(problem);
          if (had !== undefined && had.rev === rev) {
            outcomes.push({ kind: "put", rev, created: false });
            break;
          }
          overlay.set(rp, { kind: "file", mode: had?.mode ?? "100644", blob: undefined, bytes: m.bytes, rev });
          outcomes.push({ kind: "put", rev, created: had === undefined });
          changed.push({ kind: "put", path: m.path });
          break;
        }
        case "delete": {
          const rp = repoPath(prefix, m.path);
          const here = await slotOf(rp);
          if (here.kind === "err") return here;
          if (here.value.kind === "link") return err(refused("outside-scope", `${m.path} is ${here.value.what} in the repository: the store holds files only`, m.path));
          const had = here.value.kind === "file" ? here.value : undefined;
          const problem = check(m.path, m.expect, had?.rev);
          if (problem !== undefined) return err(problem);
          if (had !== undefined) {
            overlay.set(rp, NONE);
            changed.push({ kind: "delete", path: m.path });
          }
          outcomes.push({ kind: "delete", existed: had !== undefined });
          break;
        }
        case "move": {
          const from = repoPath(prefix, m.from);
          const to = repoPath(prefix, m.to);
          const there = await slotOf(from);
          if (there.kind === "err") return there;
          if (there.value.kind === "link") return err(refused("outside-scope", `${m.from} is ${there.value.what} in the repository: the store holds files only`, m.from));
          if (there.value.kind !== "file" || there.value.rev === undefined) return err(missing(m.from));
          const problem = check(m.from, m.expect, there.value.rev);
          if (problem !== undefined) return err(problem);
          if (from === to) return err(refused("outside-scope", "a rename to the same path moves nothing", m.from));
          const bad = await collides(m.to, to);
          if (bad !== undefined) return err(bad);
          const target = await slotOf(to);
          if (target.kind === "err") return target;
          if (target.value.kind === "file") return err(conflict(m.to, { kind: "absent" }, found(target.value.rev)));
          if (target.value.kind === "link") return err(refused("outside-scope", `${m.to} is ${target.value.what} in the repository: the store holds files only`, m.to));
          overlay.set(from, NONE);
          overlay.set(to, there.value);
          if (there.value.blob !== undefined) moves.push({ from, to, blob: there.value.blob, mode: there.value.mode });
          outcomes.push({ kind: "move", rev: there.value.rev });
          changed.push({ kind: "move", path: m.from, to: m.to });
          break;
        }
        default:
          return err(unavailable("a change of no known kind", false));
      }
    }

    // what differs from the commit the changes were checked at: a path whose final state is its state there is not a change
    const changes: FileChange[] = [];
    const moved = new Set(moves.flatMap((x) => [x.from, x.to]));
    for (const x of moves) changes.push({ kind: "move", from: x.from, to: x.to, blob: x.blob, mode: x.mode });
    for (const [rp, final] of overlay) {
      if (moved.has(rp)) continue;
      const was = await slotAtBase(rp);
      if (was.kind === "err") return was;
      if (final.kind === "none") {
        if (was.value.kind === "file") changes.push({ kind: "delete", path: rp });
      } else if (final.kind === "file") {
        const same = was.value.kind === "file" && final.rev === was.value.rev && final.mode === was.value.mode;
        if (!same && final.bytes !== undefined) changes.push({ kind: "put", path: rp, bytes: final.bytes, exists: was.value.kind === "file", mode: final.mode });
      }
    }
    if (changes.length === 0) return ok({ outcomes, commit: undefined });

    const message = messageOf(subject, changed, trailers);
    const done = await api.commit({ branch: name, base: at, create, message, author, committer, at: new Date(clock()), changes });
    if (done.kind === "ok") {
      // the blob a host makes of these bytes has the name Git gives them: what is written is known, and need not be read to be seen
      for (const c of changes) if (c.kind === "put") known.set(await gitBlobId(c.bytes), { rev: await revisionOf(c.bytes), size: c.bytes.length });
      return ok({ outcomes, commit: done.value.commit });
    }
    if (done.error.kind === "conflict") return "moved";
    return err(problem(done.error));
  };

  const mutate = (mutations: readonly Mutation[]): Promise<Result<{ readonly outcomes: readonly Outcome[]; readonly commit: string | undefined }, Problem>> => {
    for (const m of mutations) {
      const bad = vet(m);
      if (bad !== undefined) return Promise.resolve(err(bad));
    }
    return serially(async () => {
      for (let attempt = 1; attempt <= attempts; attempt++) {
        const done = await once(mutations);
        if (done !== "moved") return done;
        // the branch or a file moved under the commit: read again, for a time that grows and differs from the other writer's
        if (attempt < attempts) await sleep(Math.floor(Math.random() * 15 * attempt) + 1);
      }
      return err(unavailable(`the branch ${name} kept moving while the change was made (${attempts} tries)`, true));
    });
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
        const tip = await tipOf();
        if (tip.kind === "err") return tip;
        if (tip.value === undefined) return err(missing(op.path));
        const f = await fileAt(tip.value, op.path);
        if (f.kind === "err") return f;
        const entries = await log(op.path, op.limit ?? LOG_LIMIT);
        if (entries.kind === "err") return entries;
        const versions: { rev: Revision; size: number; modified: string }[] = [];
        for (const e of entries.value) {
          if (e.rev === undefined) continue;
          if (versions[versions.length - 1]?.rev === e.rev) continue;
          const size = [...known.values()].find((k) => k.rev === e.rev)?.size ?? 0;
          versions.push({ rev: e.rev, size, modified: e.at });
        }
        const value: Versions = { versions };
        return ok({ op: "history", value });
      }
      case "rangeRead":
      case "append":
      case "search":
        return err(refused("capability-absent", `the store of a branch on a host does not have ${op.op}`));
      default:
        return err(unavailable("an operation of no known kind", false));
    }
  };

  const canPush: boolean | "unknown" =
    branch.value?.canPush === false || repo.value.canPush === false ? false : branch.value?.canPush === true || repo.value.canPush === true ? true : "unknown";
  const facts: HostFacts = {
    host: api.host,
    describe: api.describe,
    defaultBranch: repo.value.defaultBranch,
    branch: name,
    exists: branch.value !== undefined,
    tip: branch.value?.tip,
    protected: branch.value?.protected === true,
    canPush,
  };
  const place = options.place;
  const traits = { caseSensitive: true, maxObject: maxObjectBytes } as const;
  const parts: HostRef = {
    branch: name,
    facts,
    tip: tipOf,
    async info(p) {
      const tip = await tipOf();
      if (tip.kind === "err") return tip;
      if (tip.value === undefined) return err(missing(p));
      const f = await fileAt(tip.value, p);
      if (f.kind === "err") return f;
      const d = await digestOf(f.value.blob, p);
      if (d.kind === "err") return d;
      const newest = await api.log(tip.value, repoPath(prefix, p), 1);
      const commit = newest.kind === "ok" ? newest.value[0]?.commit : undefined;
      return ok({ path: p, blob: f.value.blob, mode: f.value.mode, size: d.value.size, rev: d.value.rev, commit });
    },
    log: (p, limit = LOG_LIMIT) => log(p, limit),
  };
  if (canPush === false) {
    const store = makeStore({ id: formatPlace(place), place, consistency: "strong", traits, capabilities: HOST_READ_CAPABILITIES, handle });
    return ok({ ...parts, mode: "read-only", store });
  }
  const store = makeStore({ id: formatPlace(place), place, consistency: "strong", traits, capabilities: HOST_CAPABILITIES, handle });
  return ok({ ...parts, mode: "writable", store });
}
