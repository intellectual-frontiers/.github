// Spec: 0002-anyfs-githost-store FR-004, FR-006, FR-009, FR-010, FR-011, FR-013
/**
 * GitLab's REST API (v4) as a repository of Git (`HostApi`), for gitlab.com or a server of one's own: a project is addressed by its whole path with every `/` encoded (groups to any depth), the tree is read by
 * pages along the `Link` header until the last, and a commit is made with the Commits API, which takes every change of a batch as one commit. Where GitHub's branch is moved by compare-and-swap, GitLab
 * checks each file the commit changes: an update, a delete or a move carries the last commit that changed the file at the commit it was checked at, and a create is refused where the file exists, so that a writer
 * that read a file before another changed it conflicts, and writers of different files both win.
 *
 * @remarks
 * Limits, said once: a commit is by the author the store names and the committer is the user of the token (GitLab does not take another); the author's date is the host's clock; a tree is read in pages of a hundred and a
 * tree of more than a hundred thousand entries is refused as such, never returned in part; a file is read through its blob, so a listing asks for each blob it has not seen, a few at a time.
 *
 * @module
 */
import { array, boolean, err, integer, nullable, object, ok, string, type Result } from "@intellectual-frontiers/core";
import { fromBase64, toBase64 } from "@intellectual-frontiers/formats/base64";
import type { ApiProblem, BranchFacts, Committed, CommitRequest, HostApi, Located, LogItem, RepoFacts, TreeEntry } from "./api.ts";
import { type Call, decode, nextPage, said } from "./http.ts";

const access = nullable(object({ access_level: integer }));
const projectShape = object({}, { default_branch: nullable(string), permissions: object({}, { project_access: access, group_access: access }) });
const branchShape = object({ name: string, protected: boolean, commit: object({ id: string }) }, { can_push: boolean });
const treeShape = array(object({ id: string, name: string, type: string, path: string, mode: string }));
type TreeItem = { readonly id: string; readonly name: string; readonly type: string; readonly path: string; readonly mode: string };
const blobShape = object({ content: string, encoding: string });
const idShape = object({ id: string });
const logShape = array(object({ id: string, title: string, author_name: string, author_email: string, authored_date: string }));

/** The access level that may push to a branch that is not protected: Developer. */
const DEVELOPER = 30;
const PAGE = 100;
const MAX_PAGES = 1000;
const REGULAR = new Set(["100644", "100755", "100664"]);

const refine = (p: ApiProblem): ApiProblem =>
  p.kind === "denied" && p.reason === "permission" && /protected|not allowed to push|push rules/iu.test(p.message) ? { kind: "denied", reason: "protected", message: p.message } : p;

/** What GitLab's client is made with. */
export type GitlabApiOptions = {
  readonly call: Call;
  /** The whole path of the project, such as `group/subgroup/project`. */
  readonly project: string;
  readonly host: string;
  readonly concurrency?: number;
};

/** GitLab's API as a repository of Git. */
export function gitlabApi(options: GitlabApiOptions): HostApi {
  const { call } = options;
  const base = `/projects/${encodeURIComponent(options.project)}`;
  const describe = `${options.project} on ${options.host}`;
  const folders = new Map<string, readonly TreeItem[] | undefined>();

  const failed = (p: ApiProblem): Result<never, ApiProblem> => err(refine(p));

  const otherwise = (r: { readonly status: number; readonly body: string }, what: string): ApiProblem => {
    const m = said({ status: r.status, headers: {}, body: r.body });
    if (r.status === 404) return { kind: "not-found", what };
    if (r.status === 413) return { kind: "too-large", message: m === "" ? "HTTP 413" : m };
    if (r.status === 409 || r.status === 412) return { kind: "conflict", message: m === "" ? `HTTP ${r.status}` : m };
    return { kind: "unexpected", status: r.status, message: m === "" ? `HTTP ${r.status}` : m };
  };

  /** Every entry of a tree listing: the pages, followed along `Link` until the last. */
  const pages = async (first: { readonly path: string; readonly query: Readonly<Record<string, string>> }, what: string): Promise<Result<readonly TreeItem[], ApiProblem>> => {
    const out: TreeItem[] = [];
    let next: { readonly path: string; readonly query?: Readonly<Record<string, string>> } | undefined = first;
    for (let n = 0; next !== undefined; n++) {
      if (n >= MAX_PAGES) return err({ kind: "unavailable", message: `${what} has more than ${MAX_PAGES * PAGE} entries: a listing is never returned in part, and this is too large to read`, retryable: false });
      const r = await call({ method: "GET", path: next.path, ...(next.query === undefined ? {} : { query: next.query }) });
      if (r.kind === "err") return failed(r.error);
      if (r.value.status === 404) return err({ kind: "not-found", what });
      if (r.value.status !== 200) return err(otherwise(r.value, what));
      const t = decode(r.value, treeShape, what);
      if (t.kind === "err") return t;
      out.push(...t.value);
      const link = nextPage(r.value);
      next = link === undefined ? undefined : { path: link };
    }
    return ok(out);
  };

  /** The entries of one folder at a commit, not below it: none where the folder is not one. */
  const level = async (commit: string, folder: string): Promise<Result<readonly TreeItem[] | undefined, ApiProblem>> => {
    const key = `${commit}\0${folder}`;
    if (folders.has(key)) return ok(folders.get(key));
    const got = await pages({ path: `${base}/repository/tree`, query: { ref: commit, per_page: String(PAGE), ...(folder === "" ? {} : { path: folder }) } }, `the folder ${folder === "" ? "/" : folder} of ${describe}`);
    if (got.kind === "err") {
      if (got.error.kind === "not-found") {
        folders.set(key, undefined);
        return ok(undefined);
      }
      return got;
    }
    folders.set(key, got.value);
    return ok(got.value);
  };

  const lastCommitOf = async (commit: string, path: string): Promise<Result<string | undefined, ApiProblem>> => {
    const r = await call({ method: "GET", path: `${base}/repository/commits`, query: { ref_name: commit, path, per_page: "1" } });
    if (r.kind === "err") return failed(r.error);
    if (r.value.status !== 200) return err(otherwise(r.value, `the last commit of ${path}`));
    const l = decode(r.value, array(object({ id: string })), `the last commit of ${path}`);
    return l.kind === "err" ? l : ok(l.value[0]?.id);
  };

  return {
    host: "gitlab",
    describe,
    async repo() {
      const r = await call({ method: "GET", path: base });
      if (r.kind === "err") return failed(r.error);
      if (r.value.status !== 200) return err(otherwise(r.value, describe));
      const d = decode(r.value, projectShape, describe);
      if (d.kind === "err") return d;
      const levels = [d.value.permissions?.project_access?.access_level, d.value.permissions?.group_access?.access_level].filter((x): x is number => x !== undefined);
      const facts: RepoFacts = { defaultBranch: d.value.default_branch ?? undefined, canPush: levels.length === 0 ? undefined : Math.max(...levels) >= DEVELOPER };
      return ok(facts);
    },
    async branch(name) {
      const r = await call({ method: "GET", path: `${base}/repository/branches/${encodeURIComponent(name)}` });
      if (r.kind === "err") return failed(r.error);
      if (r.value.status === 404 && /branch not found/iu.test(said(r.value))) return ok(undefined);
      if (r.value.status !== 200) return err(otherwise(r.value, describe));
      const b = decode(r.value, branchShape, `branch ${name}`);
      if (b.kind === "err") return b;
      const facts: BranchFacts = { tip: b.value.commit.id, protected: b.value.protected, canPush: b.value.can_push };
      return ok(facts);
    },
    async list(commit, folder) {
      const got = await pages({ path: `${base}/repository/tree`, query: { ref: commit, recursive: "true", per_page: String(PAGE), ...(folder === "" ? {} : { path: folder }) } }, `the tree of ${describe}`);
      if (got.kind === "err") return got.error.kind === "not-found" ? ok([]) : got;
      const out: TreeEntry[] = got.value.filter((e) => e.type === "blob" && REGULAR.has(e.mode)).map((e) => ({ path: e.path, blob: e.id, mode: e.mode }));
      return ok(out);
    },
    async locate(commit, path): Promise<Result<Located, ApiProblem>> {
      const at = path.lastIndexOf("/");
      const entries = await level(commit, at < 0 ? "" : path.slice(0, at));
      if (entries.kind === "err") return entries;
      const e = entries.value?.find((x) => x.path === path);
      if (e === undefined) return ok({ kind: "none" });
      if (e.type === "tree") return ok({ kind: "dir" });
      if (e.type === "commit") return ok({ kind: "link", what: "another repository" });
      if (e.mode === "120000") return ok({ kind: "link", what: "a symbolic link" });
      return REGULAR.has(e.mode) ? ok({ kind: "file", blob: e.id, mode: e.mode }) : ok({ kind: "link", what: "an entry that is not a file" });
    },
    async blob(id) {
      const r = await call({ method: "GET", path: `${base}/repository/blobs/${encodeURIComponent(id)}` });
      if (r.kind === "err") return failed(r.error);
      if (r.value.status !== 200) return err(otherwise(r.value, `blob ${id.slice(0, 12)} of ${describe}`));
      const b = decode(r.value, blobShape, `blob ${id.slice(0, 12)}`);
      if (b.kind === "err") return b;
      if (b.value.encoding !== "base64") return err({ kind: "unexpected", status: 200, message: `the blob is in the encoding ${b.value.encoding}, not base64` });
      const bytes = fromBase64(b.value.content.replace(/\s+/gu, ""));
      return bytes.kind === "err" ? err({ kind: "unexpected", status: 200, message: bytes.error }) : ok(bytes.value);
    },
    async commit(request: CommitRequest): Promise<Result<Committed, ApiProblem>> {
      // the last commit that changed each file the commit changes, at the commit the changes were checked at: what GitLab compares to refuse a file that changed since
      const needing = request.changes.flatMap((c) => (c.kind === "put" ? (c.exists ? [c.path] : []) : c.kind === "delete" ? [c.path] : [c.from]));
      const last = new Map<string, string>();
      const width = Math.max(1, options.concurrency ?? 4);
      for (let i = 0; i < needing.length; i += width) {
        const slice = needing.slice(i, i + width);
        const got = await Promise.all(slice.map((p) => lastCommitOf(request.base, p)));
        for (const [j, g] of got.entries()) {
          const p = slice[j];
          if (g.kind === "err") return g;
          if (p !== undefined && g.value !== undefined) last.set(p, g.value);
        }
      }
      const actions = request.changes.map((c) => {
        if (c.kind === "put") {
          return {
            action: c.exists ? "update" : "create",
            file_path: c.path,
            content: toBase64(c.bytes),
            encoding: "base64",
            execute_filemode: c.mode === "100755",
            ...(c.exists && last.has(c.path) ? { last_commit_id: last.get(c.path) } : {}),
          };
        }
        if (c.kind === "delete") return { action: "delete", file_path: c.path, ...(last.has(c.path) ? { last_commit_id: last.get(c.path) } : {}) };
        return { action: "move", file_path: c.to, previous_path: c.from, ...(last.has(c.from) ? { last_commit_id: last.get(c.from) } : {}) };
      });
      const body = {
        branch: request.branch,
        ...(request.create ? { start_sha: request.base } : {}),
        commit_message: request.message,
        author_name: request.author.name,
        author_email: request.author.email,
        actions,
      };
      const r = await call({ method: "POST", path: `${base}/repository/commits`, json: body });
      if (r.kind === "err") return failed(r.error);
      if (r.value.status === 201) {
        const c = decode(r.value, idShape, "the commit");
        return c.kind === "err" ? c : ok({ commit: c.value.id });
      }
      const m = said(r.value);
      if (r.value.status === 400) {
        if (/already exists|changed since|has changed|doesn't exist|does not exist|not exist|reference update|changed while/iu.test(m)) return err({ kind: "conflict", message: m });
        if (/not allowed to push|protected|push rule/iu.test(m)) return err({ kind: "denied", reason: "protected", message: m });
      }
      return err(otherwise(r.value, `the branch ${request.branch}`));
    },
    async log(commit, path, limit): Promise<Result<readonly LogItem[], ApiProblem>> {
      const r = await call({ method: "GET", path: `${base}/repository/commits`, query: { ref_name: commit, path, per_page: String(Math.min(Math.max(1, Math.floor(limit)), 100)) } });
      if (r.kind === "err") return failed(r.error);
      if (r.value.status !== 200) return err(otherwise(r.value, `the history of ${path}`));
      const l = decode(r.value, logShape, `the history of ${path}`);
      if (l.kind === "err") return l;
      return ok(l.value.map((c) => ({ commit: c.id, author: { name: c.author_name, email: c.author_email }, at: new Date(c.authored_date).toISOString(), subject: c.title })));
    },
  };
}
