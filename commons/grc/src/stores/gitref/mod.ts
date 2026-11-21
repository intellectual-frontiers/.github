// Spec: 0013-grc-gitref FR-001, FR-002, FR-003, FR-004, FR-005, FR-006
/**
 * A branch of a Git repository kept as a store of files (commons grc 0013-grc-gitref): for evidence that a program writes without a person, many times a day. A commit is made with Git's plumbing (`hash-object`, a temporary index, `write-tree`,
 * `commit-tree`, `update-ref` guarded by the tip it was made on), so that the working tree, the index and the branch a person has checked out are never touched; only the files whose bytes differ from the tip are written, so that nothing that did
 * not change is a commit; a file that is read, listed or followed through the history is read from the branch; the commits of an instant are those at or before it; and the branch, and only it, is pushed, never forced.
 *
 * @example
 * ```ts
 * import { gitRefStore } from "./mod.ts";
 * // const store = gitRefStore({ repo: ".", branch: "evidence", identity: { name: "collector", email: "collector@localhost" } });
 * // await store.commit([{ path: "state/olympia.json", bytes }], "olympia: state changed");
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { fs, path, proc } from "@intellectual-frontiers/system";

/** Who a commit is by: the program that writes without a person. */
export type Identity = { readonly name: string; readonly email: string };

/** What a store is made over. */
export type GitRefOptions = { readonly repo: string; readonly branch: string; readonly identity: Identity };

/** A file to write: its path in the branch and its bytes. */
export type FileChange = { readonly path: string; readonly bytes: Uint8Array };

/** What a commit came to: the commit made (none where no file differed) and the paths that differed. */
export type Committed = { readonly commit: string | undefined; readonly changed: readonly string[] };

/** One commit that touched a path: the commit, its instant (ISO 8601, UTC) and its subject. */
export type Revision = { readonly commit: string; readonly at: string; readonly subject: string };

/** Why a call of Git did not do what was asked. */
export type GitRefError = { readonly kind: "git" | "moved" | "path"; readonly message: string };

/** The store. */
export type GitRefStore = {
  readonly repo: string;
  readonly branch: string;
  /** The tip of the branch, or nothing where the branch does not exist yet. */
  head(): Promise<string | undefined>;
  /** The bytes of a file at the tip (or at a commit), or nothing where there is none. */
  read(file: string, at?: string): Promise<Uint8Array | undefined>;
  /** The files under a folder at the tip (or at a commit), as paths of the branch, in order. */
  list(folder: string, at?: string): Promise<readonly string[]>;
  /** Writes the files that differ from the tip in one commit, made at `when` (now where none); a commit that would change nothing is not made. */
  commit(changes: readonly FileChange[], message: string, when?: string): Promise<Result<Committed, GitRefError>>;
  /** The commits that touched a path, newest first. */
  history(file: string): Promise<readonly Revision[]>;
  /** The newest commit made at or before an instant. */
  at(instant: string): Promise<string | undefined>;
  /** Pushes the branch, and nothing else, to a remote; never forced, so a remote that has moved is an error. */
  push(remote: string): Promise<Result<void, GitRefError>>;
};

const ZERO = "0000000000000000000000000000000000000000";
const SAFE_PATH = /^[A-Za-z0-9._][A-Za-z0-9._@+=,-]*(?:\/[A-Za-z0-9._][A-Za-z0-9._@+=,-]*)*$/;

/** A store over a branch of a repository. */
export function gitRefStore(o: GitRefOptions): GitRefStore {
  const ref = `refs/heads/${o.branch}`;
  const env = (when?: string): Record<string, string> => ({
    GIT_AUTHOR_NAME: o.identity.name,
    GIT_AUTHOR_EMAIL: o.identity.email,
    GIT_COMMITTER_NAME: o.identity.name,
    GIT_COMMITTER_EMAIL: o.identity.email,
    ...(when === undefined ? {} : { GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when }),
  });
  const git = (args: readonly string[], extra: Record<string, string> = {}, input?: string | Uint8Array) =>
    proc.run(["git", "-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", ...args], { cwd: o.repo, env: { ...extra }, ...(input === undefined ? {} : { input }) });

  const head = async (): Promise<string | undefined> => {
    const r = await git(["rev-parse", "--verify", "-q", `${ref}^{commit}`]);
    return r.success ? r.stdout.trim() : undefined;
  };
  const read = async (file: string, at?: string): Promise<Uint8Array | undefined> => {
    const rev = at ?? (await head());
    if (rev === undefined) return undefined;
    const r = await proc.output(["git", "cat-file", "blob", `${rev}:${file}`], { cwd: o.repo });
    return r.success ? r.stdout : undefined;
  };
  const same = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((x, i) => x === b[i]);

  return {
    repo: o.repo,
    branch: o.branch,
    head,
    read,
    async list(folder, at) {
      const rev = at ?? (await head());
      if (rev === undefined) return [];
      const prefix = folder === "" ? "" : folder.endsWith("/") ? folder : `${folder}/`;
      const r = await git(["ls-tree", "-r", "--name-only", rev, ...(prefix === "" ? [] : ["--", prefix])]);
      return r.success ? r.stdout.split("\n").filter((l) => l !== "").sort() : [];
    },
    async commit(changes, message, when) {
      for (const c of changes) if (!SAFE_PATH.test(c.path) || c.path.includes("..")) return err({ kind: "path", message: `${JSON.stringify(c.path)} is not a path of the branch` });
      const tip = await head();
      const differing: FileChange[] = [];
      for (const c of changes) {
        const have = tip === undefined ? undefined : await read(c.path, tip);
        if (have === undefined || !same(have, c.bytes)) differing.push(c);
      }
      if (differing.length === 0) return ok({ commit: undefined, changed: [] });
      const dir = await fs.makeTempDir({ prefix: "gitref-" });
      try {
        const index = { GIT_INDEX_FILE: path.join(dir, "index") };
        if (tip !== undefined) {
          const rt = await git(["read-tree", tip], index);
          if (!rt.success) return err({ kind: "git", message: rt.stderr.trim() });
        }
        for (const c of differing) {
          const blob = await proc.output(["git", "hash-object", "-w", "--stdin"], { cwd: o.repo, input: c.bytes });
          if (!blob.success) return err({ kind: "git", message: new TextDecoder().decode(blob.stderr).trim() });
          const sha = new TextDecoder().decode(blob.stdout).trim();
          const ui = await git(["update-index", "--add", "--cacheinfo", `100644,${sha},${c.path}`], index);
          if (!ui.success) return err({ kind: "git", message: ui.stderr.trim() });
        }
        const tree = await git(["write-tree"], index);
        if (!tree.success) return err({ kind: "git", message: tree.stderr.trim() });
        const made = await git(["commit-tree", tree.stdout.trim(), ...(tip === undefined ? [] : ["-p", tip]), "-m", message], env(when));
        if (!made.success) return err({ kind: "git", message: made.stderr.trim() });
        const commit = made.stdout.trim();
        const moved = await git(["update-ref", ref, commit, tip ?? ZERO]);
        if (!moved.success) return err({ kind: "moved", message: `the branch ${o.branch} moved while the commit was made: ${moved.stderr.trim()}` });
        return ok({ commit, changed: differing.map((c) => c.path) });
      } finally {
        await fs.remove(dir, { recursive: true }).catch(() => undefined);
      }
    },
    async history(file) {
      if ((await head()) === undefined) return [];
      const r = await git(["log", "--first-parent", "--format=%H%x09%cI%x09%s", ref, "--", file]);
      if (!r.success) return [];
      return r.stdout.split("\n").filter((l) => l !== "").map((l) => {
        const [commit = "", at = "", ...subject] = l.split("\t");
        return { commit, at: new Date(at).toISOString(), subject: subject.join("\t") };
      });
    },
    async at(instant) {
      if ((await head()) === undefined) return undefined;
      const ms = Date.parse(instant);
      if (Number.isNaN(ms)) return undefined;
      // `--before` has the granularity of a second and excludes the second itself; ask for the end of that second
      const r = await git(["rev-list", "-1", "--first-parent", `--before=${new Date(ms + 999).toISOString()}`, ref]);
      const sha = r.stdout.trim();
      return r.success && sha !== "" ? sha : undefined;
    },
    async push(remote) {
      const r = await git(["push", remote, `${ref}:${ref}`]);
      return r.success ? ok(undefined) : err({ kind: "git", message: (r.stderr.trim() || r.stdout.trim()).split("\n").slice(-2).join(" | ") });
    },
  };
}
