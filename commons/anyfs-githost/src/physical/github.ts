// Spec: 0002-anyfs-githost-store FR-004, FR-006, FR-009, FR-010, FR-011, FR-013
/**
 * GitHub's REST API as a repository of Git (`HostApi`): the branch's tip, the trees (a tree the host cuts short is read again folder by folder, so a listing is never partial), the blobs by name, the history of a path, and
 * a commit made through the Git Data API: the blobs are made, then a tree on the tree of the commit the changes were checked at, then a commit, then the branch is moved to it with `force: false`, so that a branch
 * that moved is refused by the host and never overwritten. One batch is one commit. A host that is GitHub Enterprise Server is the same API under `/api/v3`.
 *
 * @remarks
 * Limits, said once: the Git Data API makes no commit in a repository that has none yet (`409`, said as such: make the first commit another way); a blob is at most 100 MB for the host and the store refuses
 * far less; a file is read through its blob, so a listing asks for each blob it has not seen, a few at a time; a commit is by the author and the committer the store names, and a host may show a verified signature
 * for none of them (signing is off).
 *
 * @module
 */
import { array, boolean, err, object, ok, string, type Result } from "@intellectual-frontiers/core";
import { fromBase64, toBase64 } from "@intellectual-frontiers/formats/base64";
import type { ApiProblem, BranchFacts, Committed, CommitRequest, FileChange, HostApi, Located, LogItem, RepoFacts, TreeEntry } from "./api.ts";
import { type Call, decode, said } from "./http.ts";

const repoShape = object({}, { default_branch: string, permissions: object({}, { push: boolean }) });
const branchShape = object({ name: string, protected: boolean, commit: object({ sha: string }) });
const commitShape = object({ sha: string, tree: object({ sha: string }) });
const treeShape = object({ sha: string, tree: array(object({ path: string, mode: string, type: string, sha: string })) }, { truncated: boolean });
const blobShape = object({ content: string, encoding: string });
const shaShape = object({ sha: string });
const logShape = array(object({ sha: string, commit: object({ message: string, author: object({ name: string, email: string, date: string }) }) }));

/** A host's refusal of a push to a protected branch is told apart from a token that may not push at all. */
const refine = (p: ApiProblem): ApiProblem =>
  p.kind === "denied" && p.reason === "permission" && /protected|GH006|required status|review/iu.test(p.message) ? { kind: "denied", reason: "protected", message: p.message } : p;

type TreeNode = { readonly path: string; readonly mode: string; readonly type: string; readonly sha: string };
const REGULAR = new Set(["100644", "100755", "100664"]);
const enc = (name: string): string => name.split("/").map(encodeURIComponent).join("/");

/** What GitHub's client is made with. */
export type GithubApiOptions = {
  readonly call: Call;
  readonly owner: string;
  readonly repo: string;
  /** How many blobs are made at once by a commit: 4 where left out. */
  readonly concurrency?: number;
};

/** GitHub's API as a repository of Git. */
export function githubApi(options: GithubApiOptions): HostApi {
  const { call } = options;
  const base = `/repos/${encodeURIComponent(options.owner)}/${encodeURIComponent(options.repo)}`;
  const describe = `${options.owner}/${options.repo} on GitHub`;
  const treeOfCommit = new Map<string, string>();
  const trees = new Map<string, readonly TreeNode[]>();

  const failed = (p: ApiProblem): Result<never, ApiProblem> => err(refine(p));

  /** What a reply that is not a success says, as a problem. */
  const otherwise = (r: { readonly status: number; readonly body: string }, what: string): ApiProblem => {
    const m = said({ status: r.status, headers: {}, body: r.body });
    if (r.status === 404) return { kind: "not-found", what };
    if (r.status === 409 && /empty/iu.test(m)) return { kind: "unavailable", message: `${what}: the repository is empty, and the Git Data API makes no commit in one: make its first commit another way`, retryable: false };
    if (r.status === 409 || r.status === 412) return { kind: "conflict", message: m === "" ? `HTTP ${r.status}` : m };
    if (r.status === 413 || (r.status === 422 && /too large|too big|size/iu.test(m))) return { kind: "too-large", message: m === "" ? `HTTP ${r.status}` : m };
    if (r.status === 422) return { kind: "unexpected", status: 422, message: m };
    return { kind: "unexpected", status: r.status, message: m === "" ? `HTTP ${r.status}` : m };
  };

  const treeOf = async (commit: string): Promise<Result<string, ApiProblem>> => {
    const had = treeOfCommit.get(commit);
    if (had !== undefined) return ok(had);
    const r = await call({ method: "GET", path: `${base}/git/commits/${encodeURIComponent(commit)}` });
    if (r.kind === "err") return failed(r.error);
    if (r.value.status !== 200) return err(otherwise(r.value, `commit ${commit.slice(0, 12)} of ${describe}`));
    const c = decode(r.value, commitShape, `commit ${commit.slice(0, 12)}`);
    if (c.kind === "err") return c;
    treeOfCommit.set(commit, c.value.tree.sha);
    return ok(c.value.tree.sha);
  };

  /** The entries of one tree, not below it; a tree never changes, so it is kept. */
  const level = async (sha: string): Promise<Result<readonly TreeNode[], ApiProblem>> => {
    const had = trees.get(sha);
    if (had !== undefined) return ok(had);
    const r = await call({ method: "GET", path: `${base}/git/trees/${encodeURIComponent(sha)}` });
    if (r.kind === "err") return failed(r.error);
    if (r.value.status !== 200) return err(otherwise(r.value, `tree ${sha.slice(0, 12)} of ${describe}`));
    const t = decode(r.value, treeShape, `tree ${sha.slice(0, 12)}`);
    if (t.kind === "err") return t;
    trees.set(sha, t.value.tree);
    return ok(t.value.tree);
  };

  /** The tree at a folder of a tree, or none where the folder is not one. */
  const folderTree = async (root: string, folder: string): Promise<Result<string | undefined, ApiProblem>> => {
    let at = root;
    for (const segment of folder === "" ? [] : folder.split("/")) {
      const entries = await level(at);
      if (entries.kind === "err") return entries;
      const e = entries.value.find((x) => x.path === segment);
      if (e === undefined || e.type !== "tree") return ok(undefined);
      at = e.sha;
    }
    return ok(at);
  };

  /** Every file below a tree: the whole tree in one call, and where the host says it cut it short, folder by folder. */
  const files = async (sha: string, under: string): Promise<Result<readonly TreeEntry[], ApiProblem>> => {
    const r = await call({ method: "GET", path: `${base}/git/trees/${encodeURIComponent(sha)}`, query: { recursive: "1" } });
    if (r.kind === "err") return failed(r.error);
    if (r.value.status !== 200) return err(otherwise(r.value, `tree ${sha.slice(0, 12)} of ${describe}`));
    const t = decode(r.value, treeShape, `tree ${sha.slice(0, 12)}`);
    if (t.kind === "err") return t;
    const where = (p: string): string => (under === "" ? p : `${under}/${p}`);
    if (t.value.truncated !== true) {
      return ok(t.value.tree.filter((e) => e.type === "blob" && REGULAR.has(e.mode)).map((e) => ({ path: where(e.path), blob: e.sha, mode: e.mode })));
    }
    const out: TreeEntry[] = [];
    const here = await level(sha);
    if (here.kind === "err") return here;
    for (const e of here.value) {
      if (e.type === "blob" && REGULAR.has(e.mode)) out.push({ path: where(e.path), blob: e.sha, mode: e.mode });
      else if (e.type === "tree") {
        const sub = await files(e.sha, where(e.path));
        if (sub.kind === "err") return sub;
        out.push(...sub.value);
      }
    }
    return ok(out);
  };

  const makeBlob = async (bytes: Uint8Array): Promise<Result<string, ApiProblem>> => {
    const r = await call({ method: "POST", path: `${base}/git/blobs`, json: { content: toBase64(bytes), encoding: "base64" } });
    if (r.kind === "err") return failed(r.error);
    if (r.value.status !== 201) return err(otherwise(r.value, "a blob"));
    const s = decode(r.value, shaShape, "a blob");
    return s.kind === "err" ? s : ok(s.value.sha);
  };

  const stamp = (id: { readonly name: string; readonly email: string }, at: Date): { readonly name: string; readonly email: string; readonly date: string } => ({ name: id.name, email: id.email, date: at.toISOString() });

  return {
    host: "github",
    describe,
    async repo() {
      const r = await call({ method: "GET", path: base });
      if (r.kind === "err") return failed(r.error);
      if (r.value.status !== 200) return err(otherwise(r.value, describe));
      const d = decode(r.value, repoShape, describe);
      if (d.kind === "err") return d;
      const facts: RepoFacts = { defaultBranch: d.value.default_branch, canPush: d.value.permissions?.push };
      return ok(facts);
    },
    async branch(name) {
      const r = await call({ method: "GET", path: `${base}/branches/${enc(name)}` });
      if (r.kind === "err") return failed(r.error);
      if (r.value.status === 404 && /branch not found/iu.test(said(r.value))) return ok(undefined);
      if (r.value.status !== 200) return err(otherwise(r.value, `${describe}`));
      const b = decode(r.value, branchShape, `branch ${name}`);
      if (b.kind === "err") return b;
      const facts: BranchFacts = { tip: b.value.commit.sha, protected: b.value.protected, canPush: undefined };
      return ok(facts);
    },
    async list(commit, folder) {
      const root = await treeOf(commit);
      if (root.kind === "err") return root;
      const at = await folderTree(root.value, folder);
      if (at.kind === "err") return at;
      return at.value === undefined ? ok([]) : files(at.value, folder);
    },
    async locate(commit, path): Promise<Result<Located, ApiProblem>> {
      const root = await treeOf(commit);
      if (root.kind === "err") return root;
      const segments = path.split("/");
      const last = segments[segments.length - 1] ?? "";
      const dir = await folderTree(root.value, segments.slice(0, -1).join("/"));
      if (dir.kind === "err") return dir;
      if (dir.value === undefined) return ok({ kind: "none" });
      const entries = await level(dir.value);
      if (entries.kind === "err") return entries;
      const e = entries.value.find((x) => x.path === last);
      if (e === undefined) return ok({ kind: "none" });
      if (e.type === "tree") return ok({ kind: "dir" });
      if (e.type === "commit") return ok({ kind: "link", what: "another repository" });
      if (e.mode === "120000") return ok({ kind: "link", what: "a symbolic link" });
      return REGULAR.has(e.mode) ? ok({ kind: "file", blob: e.sha, mode: e.mode }) : ok({ kind: "link", what: "an entry that is not a file" });
    },
    async blob(id) {
      const r = await call({ method: "GET", path: `${base}/git/blobs/${encodeURIComponent(id)}` });
      if (r.kind === "err") return failed(r.error);
      if (r.value.status !== 200) return err(otherwise(r.value, `blob ${id.slice(0, 12)} of ${describe}`));
      const b = decode(r.value, blobShape, `blob ${id.slice(0, 12)}`);
      if (b.kind === "err") return b;
      if (b.value.encoding !== "base64") return err({ kind: "unexpected", status: 200, message: `the blob is in the encoding ${b.value.encoding}, not base64` });
      const bytes = fromBase64(b.value.content.replace(/\s+/gu, ""));
      return bytes.kind === "err" ? err({ kind: "unexpected", status: 200, message: bytes.error }) : ok(bytes.value);
    },
    async commit(request: CommitRequest): Promise<Result<Committed, ApiProblem>> {
      const baseTree = await treeOf(request.base);
      if (baseTree.kind === "err") return baseTree;
      const entries: { path: string; mode: string; type: "blob"; sha: string | null }[] = [];
      const puts = request.changes.filter((c): c is Extract<FileChange, { kind: "put" }> => c.kind === "put");
      const made = new Map<FileChange, string>();
      const width = Math.max(1, options.concurrency ?? 4);
      for (let i = 0; i < puts.length; i += width) {
        const slice = puts.slice(i, i + width);
        const shas = await Promise.all(slice.map((p) => makeBlob(p.bytes)));
        for (const [j, s] of shas.entries()) {
          const c = slice[j];
          if (s.kind === "err") return s;
          if (c !== undefined) made.set(c, s.value);
        }
      }
      for (const c of request.changes) {
        if (c.kind === "put") entries.push({ path: c.path, mode: c.mode, type: "blob", sha: made.get(c) ?? null });
        else if (c.kind === "delete") entries.push({ path: c.path, mode: "100644", type: "blob", sha: null });
        else {
          entries.push({ path: c.from, mode: "100644", type: "blob", sha: null });
          entries.push({ path: c.to, mode: c.mode, type: "blob", sha: c.blob });
        }
      }
      const tr = await call({ method: "POST", path: `${base}/git/trees`, json: { base_tree: baseTree.value, tree: entries } });
      if (tr.kind === "err") return failed(tr.error);
      if (tr.value.status !== 201) return err(otherwise(tr.value, "the tree of the commit"));
      const tree = decode(tr.value, shaShape, "the tree of the commit");
      if (tree.kind === "err") return tree;
      const cm = await call({
        method: "POST",
        path: `${base}/git/commits`,
        json: { message: request.message, tree: tree.value.sha, parents: [request.base], author: stamp(request.author, request.at), committer: stamp(request.committer, request.at) },
      });
      if (cm.kind === "err") return failed(cm.error);
      if (cm.value.status !== 201) return err(otherwise(cm.value, "the commit"));
      const commit = decode(cm.value, shaShape, "the commit");
      if (commit.kind === "err") return commit;
      const moved = request.create
        ? await call({ method: "POST", path: `${base}/git/refs`, json: { ref: `refs/heads/${request.branch}`, sha: commit.value.sha } })
        : await call({ method: "PATCH", path: `${base}/git/refs/heads/${enc(request.branch)}`, json: { sha: commit.value.sha, force: false } });
      if (moved.kind === "err") return failed(moved.error);
      if (moved.value.status === 200 || moved.value.status === 201) return ok({ commit: commit.value.sha });
      if (moved.value.status === 422 || moved.value.status === 409) {
        const m = said(moved.value);
        // "not a fast forward" and "already exists" are the branch having moved under the commit; anything else the host says of a 422 is a refusal of the request
        if (/fast forward|already exists|reference update failed/iu.test(m)) return err({ kind: "conflict", message: m });
        return err({ kind: "unexpected", status: moved.value.status, message: m === "" ? `HTTP ${moved.value.status}` : m });
      }
      return err(otherwise(moved.value, `the branch ${request.branch}`));
    },
    async log(commit, path, limit): Promise<Result<readonly LogItem[], ApiProblem>> {
      const r = await call({ method: "GET", path: `${base}/commits`, query: { sha: commit, path, per_page: String(Math.min(Math.max(1, Math.floor(limit)), 100)) } });
      if (r.kind === "err") return failed(r.error);
      if (r.value.status !== 200) return err(otherwise(r.value, `the history of ${path}`));
      const l = decode(r.value, logShape, `the history of ${path}`);
      if (l.kind === "err") return l;
      return ok(l.value.map((c) => ({ commit: c.sha, author: { name: c.commit.author.name, email: c.commit.author.email }, at: new Date(c.commit.author.date).toISOString(), subject: c.commit.message.split("\n")[0] ?? "" })));
    },
  };
}
