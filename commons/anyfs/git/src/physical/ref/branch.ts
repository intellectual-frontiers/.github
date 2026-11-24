// Spec: 0003-git-ref FR-002, FR-003, FR-004, FR-006, FR-007
/**
 * One branch of a repository, written and read through Git's plumbing. A change is made against the tip it was read at: the files are read at the tip, each change checks what it expects of the file it
 * changes, the new blobs are written, a tree is made in a temporary index (so that the index of the repository is never touched), a commit is made on the tip, and the branch is moved to it only if it is still
 * at the tip. A branch that moved is read again and the changes checked again, so that two writers of different files both win and two writers who expect the same file cannot both.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import * as fs from "@intellectual-frontiers/system/fs";
import * as path from "@intellectual-frontiers/system/path";
import * as proc from "@intellectual-frontiers/system/proc";
import {
  conflict,
  type Expect,
  type Found,
  missing,
  type Path,
  type Problem,
  refused,
  type Revision,
  unavailable,
} from "@intellectual-frontiers/anyfs/governance";
import { type Changed, type Identity, messageOf, type Subject, type Trailer } from "@intellectual-frontiers/anyfs-git/governance";
import { failure, type Git, textOf } from "../git.ts";
import { Digests, type Entry, isRegular, lsTree, revisionOf } from "../objects.ts";

/** What a commit is made with. */
export type Authorship = {
  readonly author: Identity;
  readonly committer: Identity;
  readonly subject: Subject;
  readonly trailers: readonly Trailer[];
  readonly clock: () => number;
};

/** One change of a branch, as the store is asked for it. */
export type Mutation =
  | { readonly kind: "put"; readonly path: Path; readonly bytes: Uint8Array; readonly expect: Expect }
  | { readonly kind: "delete"; readonly path: Path; readonly expect: Expect }
  | { readonly kind: "move"; readonly from: Path; readonly to: Path; readonly expect: Expect };

/** What one change came to. */
export type Outcome =
  | { readonly kind: "put"; readonly rev: Revision; readonly created: boolean }
  | { readonly kind: "delete"; readonly existed: boolean }
  | { readonly kind: "move"; readonly rev: Revision };

/** What a call of `mutate` came to: what each change came to, and the commit made (none where nothing changed). */
export type Mutated = { readonly outcomes: readonly Outcome[]; readonly commit: string | undefined };

/** What a branch is made with. */
export type BranchSpec = {
  readonly git: Git;
  readonly branch: string;
  /** Where the paths of the store are in the repository: a folder, or nothing for the top. */
  readonly prefix: string;
  readonly authorship: Authorship;
  readonly maxObjectBytes: number;
  readonly portable: boolean;
  readonly attempts: number;
  readonly digests: Digests;
};

type Slot =
  | { readonly kind: "file"; readonly mode: string; readonly oid: string | undefined; readonly bytes: Uint8Array | undefined; readonly rev: Revision | undefined }
  | { readonly kind: "link"; readonly what: string }
  | { readonly kind: "folder" }
  | { readonly kind: "none" };

const NONE: Slot = { kind: "none" };

/** The repository path of a path of the store. */
export function repoPath(prefix: string, p: string): string {
  return prefix === "" ? p : `${prefix}/${p}`;
}

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

/** The changes being made to a branch by this process, one after another: writers of one process queue, so that only writers of other processes meet at the compare-and-swap of the branch. */
const queues = new Map<string, Promise<unknown>>();

async function serially<T>(key: string, job: () => Promise<T>): Promise<T> {
  const before = queues.get(key) ?? Promise.resolve();
  const run = before.then(job, job);
  const tail = run.then(
    () => undefined,
    () => undefined,
  );
  queues.set(key, tail);
  try {
    return await run;
  } finally {
    if (queues.get(key) === tail) queues.delete(key);
  }
}

/** A branch of a repository. */
export class Branch {
  readonly ref: string;
  readonly spec: BranchSpec;
  constructor(spec: BranchSpec) {
    this.spec = spec;
    this.ref = `refs/heads/${spec.branch}`;
  }

  /** The commit at the tip of the branch, or nothing where the branch does not exist. */
  async tip(): Promise<Result<string | undefined, string>> {
    const r = await this.spec.git.run(["rev-parse", "--verify", "-q", `${this.ref}^{commit}`]);
    if (r.success) return ok(textOf(r.stdout).trim());
    // a missing branch ends with 1 and says nothing; anything else is a failure of Git
    return r.code === 1 && textOf(r.stderr).trim() === "" ? ok(undefined) : err(failure(r));
  }

  /** The entries at a commit that the paths name, by their paths. */
  async entries(commit: string | undefined, paths: readonly string[]): Promise<Result<ReadonlyMap<string, Entry>, string>> {
    const by = new Map<string, Entry>();
    if (commit === undefined || paths.length === 0) return ok(by);
    const r = await lsTree(this.spec.git, commit, paths, false);
    if (r.kind === "err") return r;
    for (const e of r.value) by.set(e.name, e);
    return ok(by);
  }

  /** What is at a path of the repository at a commit, with its revision where it is a file and `need` says so. */
  async slotOf(entry: Entry | undefined): Promise<Result<Slot, string>> {
    if (entry === undefined) return ok(NONE);
    if (entry.type === "tree") return ok({ kind: "folder" });
    if (!isRegular(entry)) return ok({ kind: "link", what: entry.mode === "120000" ? "a symbolic link" : entry.type === "commit" ? "another repository" : "an entry that is not a file" });
    const revs = await this.spec.digests.of(this.spec.git, [entry.oid]);
    if (revs.kind === "err") return revs;
    return ok({ kind: "file", mode: entry.mode, oid: entry.oid, bytes: undefined, rev: revs.value.get(entry.oid) });
  }

  /** Makes the changes as one commit, or says which does not hold. A change that changes nothing is not a commit. */
  async mutate(mutations: readonly Mutation[]): Promise<Result<Mutated, Problem>> {
    for (const m of mutations) {
      const bad = this.vet(m);
      if (bad !== undefined) return err(bad);
    }
    return serially(`${this.spec.git.gitDir}\0${this.ref}`, async () => {
      for (let attempt = 1; attempt <= this.spec.attempts; attempt++) {
        const done = await this.once(mutations);
        if (done !== "moved") return done;
        // another process moved the branch: wait a little, for a time that grows and differs from the other writer's
        if (attempt < this.spec.attempts) await proc.sleep(Math.floor(Math.random() * 15 * attempt) + 1);
      }
      return err(unavailable(`the branch ${this.spec.branch} kept moving while the change was made (${this.spec.attempts} tries)`, true));
    });
  }

  private vet(m: Mutation): Problem | undefined {
    const paths = m.kind === "move" ? [m.to] : [m.path];
    for (const p of paths) {
      if (repoPath(this.spec.prefix, p).length > 4096) return refused("unportable-path", "the path is too long for the repository", p);
    }
    if (m.kind === "put" && m.bytes.length > this.spec.maxObjectBytes) {
      return refused("too-large", `${m.path} is ${m.bytes.length} bytes and the store holds objects of at most ${this.spec.maxObjectBytes}: large files are not kept in Git by this store`, m.path);
    }
    return undefined;
  }

  private async once(mutations: readonly Mutation[]): Promise<Result<Mutated, Problem> | "moved"> {
    const { git } = this.spec;
    const tipped = await this.tip();
    if (tipped.kind === "err") return err(unavailable(tipped.error, true));
    const tip = tipped.value;

    const involved = new Set<string>();
    for (const m of mutations) {
      for (const p of m.kind === "move" ? [m.from, m.to] : [m.path]) {
        const rp = repoPath(this.spec.prefix, p);
        involved.add(rp);
        for (const a of ancestorsOf(rp)) involved.add(a);
      }
    }
    const base = await this.entries(tip, [...involved]);
    if (base.kind === "err") return err(unavailable(base.error, true));

    const overlay = new Map<string, Slot>();
    const slot = async (rp: string): Promise<Result<Slot, Problem>> => {
      const had = overlay.get(rp);
      if (had !== undefined) return ok(had);
      const s = await this.slotOf(base.value.get(rp));
      return s.kind === "err" ? err(unavailable(s.error, true)) : s;
    };
    /** Whether a file at the path would sit on a file or a folder of the same name. */
    const collides = async (p: Path, rp: string): Promise<Problem | undefined> => {
      const here = await slot(rp);
      if (here.kind === "err") return here.error;
      if (here.value.kind === "folder") return refused("unportable-path", `${p} is a folder in the repository: Git holds a file or a folder at a path, never both`, p);
      for (const a of ancestorsOf(rp)) {
        const up = await slot(a);
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
    for (const m of mutations) {
      switch (m.kind) {
        case "put": {
          const rp = repoPath(this.spec.prefix, m.path);
          const bad = await collides(m.path, rp);
          if (bad !== undefined) return err(bad);
          const here = await slot(rp);
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
          overlay.set(rp, { kind: "file", mode: had?.mode ?? "100644", oid: undefined, bytes: m.bytes, rev });
          outcomes.push({ kind: "put", rev, created: had === undefined });
          changed.push({ kind: "put", path: m.path });
          break;
        }
        case "delete": {
          const rp = repoPath(this.spec.prefix, m.path);
          const here = await slot(rp);
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
          const from = repoPath(this.spec.prefix, m.from);
          const to = repoPath(this.spec.prefix, m.to);
          const there = await slot(from);
          if (there.kind === "err") return there;
          if (there.value.kind === "link") return err(refused("outside-scope", `${m.from} is ${there.value.what} in the repository: the store holds files only`, m.from));
          if (there.value.kind !== "file" || there.value.rev === undefined) return err(missing(m.from));
          const problem = check(m.from, m.expect, there.value.rev);
          if (problem !== undefined) return err(problem);
          if (from === to) return err(refused("outside-scope", "a rename to the same path moves nothing", m.from));
          const bad = await collides(m.to, to);
          if (bad !== undefined) return err(bad);
          const target = await slot(to);
          if (target.kind === "err") return target;
          if (target.value.kind === "file") return err(conflict(m.to, { kind: "absent" }, found(target.value.rev)));
          if (target.value.kind === "link") return err(refused("outside-scope", `${m.to} is ${target.value.what} in the repository: the store holds files only`, m.to));
          overlay.set(from, NONE);
          overlay.set(to, there.value);
          outcomes.push({ kind: "move", rev: there.value.rev });
          changed.push({ kind: "move", path: m.from, to: m.to });
          break;
        }
        default:
          return err(unavailable("a change of no known kind", false));
      }
    }

    // what differs from the tip: a path whose final state is its state at the tip is not a change
    const lines: { readonly path: string; readonly slot: Slot }[] = [];
    for (const [rp, final] of overlay) {
      const was = await this.slotOf(base.value.get(rp));
      if (was.kind === "err") return err(unavailable(was.error, true));
      const same =
        (final.kind === "none" && was.value.kind === "none") || (final.kind === "file" && was.value.kind === "file" && final.rev === was.value.rev && final.mode === was.value.mode);
      if (!same) lines.push({ path: rp, slot: final });
    }
    if (lines.length === 0) return ok({ outcomes, commit: undefined });

    // the blobs of the files that are new
    const entries: string[] = [];
    let zero = tip === undefined ? "" : "0".repeat(tip.length);
    for (const l of lines) {
      if (l.slot.kind === "file") {
        let oid = l.slot.oid;
        if (oid === undefined) {
          const w = await git.run(["hash-object", "-w", "-t", "blob", "--stdin"], { input: l.slot.bytes ?? new Uint8Array() });
          if (!w.success) return err(unavailable(`git could not write ${l.path}: ${failure(w)}`, true));
          oid = textOf(w.stdout).trim();
        }
        if (zero === "") zero = "0".repeat(oid.length);
        entries.push(`${l.slot.mode} ${oid}\t${l.path}\0`);
      }
    }
    for (const l of lines) {
      if (l.slot.kind === "none") entries.push(`0 ${zero}\t${l.path}\0`);
    }

    const dir = await fs.makeTempDir({ prefix: "anyfs-git-" });
    try {
      // a temporary index and a temporary folder stand for the working tree, so that the index and the working tree of the repository are never touched
      const env = { GIT_INDEX_FILE: path.join(dir, "index"), GIT_WORK_TREE: dir };
      if (tip !== undefined) {
        const rt = await git.run(["read-tree", tip], { env });
        if (!rt.success) return err(unavailable(`git could not read the tree of ${this.spec.branch}: ${failure(rt)}`, true));
      }
      const ui = await git.run(["update-index", "-z", "--index-info"], { env, input: entries.join("") });
      if (!ui.success) return err(unavailable(`git could not make the tree: ${failure(ui)}`, true));
      const wt = await git.run(["write-tree"], { env });
      if (!wt.success) return err(unavailable(`git could not write the tree: ${failure(wt)}`, true));
      const tree = textOf(wt.stdout).trim();
      if (zero === "") zero = "0".repeat(tree.length);

      const a = this.spec.authorship;
      const when = `${Math.floor(a.clock() / 1000)} +0000`;
      const message = messageOf(a.subject, changed, a.trailers);
      const ct = await git.run(["commit-tree", tree, ...(tip === undefined ? [] : ["-p", tip])], {
        input: message,
        env: {
          GIT_AUTHOR_NAME: a.author.name,
          GIT_AUTHOR_EMAIL: a.author.email,
          GIT_COMMITTER_NAME: a.committer.name,
          GIT_COMMITTER_EMAIL: a.committer.email,
          GIT_AUTHOR_DATE: when,
          GIT_COMMITTER_DATE: when,
        },
      });
      if (!ct.success) return err(unavailable(`git could not make the commit: ${failure(ct)}`, true));
      const commit = textOf(ct.stdout).trim();
      const moved = await git.run(["update-ref", "-m", message.split("\n")[0] ?? "anyfs", this.ref, commit, tip ?? zero]);
      if (moved.success) return ok({ outcomes, commit });
      const now = await this.tip();
      if (now.kind === "ok" && now.value !== tip) return "moved";
      return err(unavailable(`git could not move ${this.spec.branch}: ${failure(moved)}`, true));
    } finally {
      await fs.remove(dir, { recursive: true }).catch(() => undefined);
    }
  }
}

