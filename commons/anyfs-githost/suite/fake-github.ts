/**
 * The subset of GitHub's REST API the store reads and writes, made in process as a transport: repository, branch, the Git Data API (commits, trees, blobs, refs) and the commit list, with the refusals a host makes (a ref that is not
 * a fast forward is `422`, a protected branch `403`, a rate limit `403` with its headers, a token that is not accepted `401`) and the knobs the tests turn: a tree that is cut short, a failure of the next calls, a hook that runs between the
 * making of a commit and the moving of the branch (so that another writer can move it first), and every request kept for the tests that look at what was sent.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import type { Exchange, OutRequest, Transport } from "@intellectual-frontiers/net/http-client";
import type { FakeRepo, Flat } from "./fake-git.ts";

export type Seen = { readonly method: string; readonly path: string; readonly query: string; readonly headers: Readonly<Record<string, string>>; readonly body: string };

export type GithubKnobs = {
  /** The token the host accepts, if it asks for one. */
  token: string | undefined;
  /** Whether the token may push. */
  push: boolean;
  /** Entries after which a recursive tree is cut short (0 for never). */
  truncateAt: number;
  /** Failures to answer the next requests with, in order. */
  failNext: { status: number; headers?: Record<string, string>; body?: string }[];
  /** Run between the making of the commit and the moving of the ref. */
  beforeRef: (() => void) | undefined;
  /** Bytes after which a blob is refused. */
  blobLimit: number;
  /** Whether the repository is empty. */
  empty: boolean;
};

export type FakeGithub = {
  readonly transport: Transport;
  readonly seen: Seen[];
  readonly knobs: GithubKnobs;
  /** The requests of one kind, by method and the start of the path. */
  count(method: string, startsWith: string): number;
};

const reply = (status: number, body: unknown, headers: Record<string, string> = {}): Exchange => ({ method: "GET", url: "", status, headers: { "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });

export function fakeGithub(repo: FakeRepo, options: { readonly owner?: string; readonly name?: string; readonly defaultBranch?: string } = {}): FakeGithub {
  const owner = options.owner ?? "acme";
  const name = options.name ?? "fleet";
  const base = `/repos/${owner}/${name}`;
  const knobs: GithubKnobs = { token: undefined, push: true, truncateAt: 0, failNext: [], beforeRef: undefined, blobLimit: Number.POSITIVE_INFINITY, empty: false };
  const seen: Seen[] = [];

  const handle = (r: OutRequest): Exchange => {
    const url = new URL(r.url);
    const path = url.pathname;
    seen.push({ method: r.method, path, query: url.search, headers: { ...r.headers }, body: r.body ?? "" });
    const failing = knobs.failNext.shift();
    if (failing !== undefined) return reply(failing.status, failing.body ?? { message: "failure on purpose" }, failing.headers ?? {});
    const auth = Object.entries(r.headers).find(([k]) => k.toLowerCase() === "authorization")?.[1];
    if (knobs.token !== undefined && auth !== `Bearer ${knobs.token}`) return reply(401, { message: "Bad credentials" });
    if (!path.startsWith(base)) return reply(404, { message: "Not Found" });
    const rest = path.slice(base.length);
    const q = url.searchParams;

    if (rest === "" && r.method === "GET") return reply(200, { default_branch: options.defaultBranch ?? "main", private: true, permissions: { push: knobs.push } });
    if (knobs.empty && rest.startsWith("/git/")) return reply(409, { message: "Git Repository is empty." });

    let m = /^\/branches\/(.+)$/u.exec(rest);
    if (m !== null && r.method === "GET") {
      const b = decodeURIComponent(m[1] ?? "");
      const tip = repo.branches.get(b);
      return tip === undefined ? reply(404, { message: "Branch not found" }) : reply(200, { name: b, protected: repo.protectedBranches.has(b), commit: { sha: tip } });
    }
    m = /^\/git\/commits\/([0-9a-f]+)$/u.exec(rest);
    if (m !== null && r.method === "GET") {
      const c = repo.commits.get(m[1] ?? "");
      return c === undefined ? reply(404, { message: "Not Found" }) : reply(200, { sha: m[1], tree: { sha: c.tree } });
    }
    m = /^\/git\/trees\/([0-9a-f]+)$/u.exec(rest);
    if (m !== null && r.method === "GET") {
      const sha = m[1] ?? "";
      const t = repo.trees.get(sha);
      if (t === undefined) return reply(404, { message: "Not Found" });
      if (q.get("recursive") !== null) {
        const all: { path: string; mode: string; type: string; sha: string }[] = [];
        const walk = (tree: string, prefix: string): void => {
          for (const n of repo.trees.get(tree) ?? []) {
            const p = prefix === "" ? n.name : `${prefix}/${n.name}`;
            all.push({ path: p, mode: n.mode, type: n.type, sha: n.sha });
            if (n.type === "tree") walk(n.sha, p);
          }
        };
        walk(sha, "");
        const cut = knobs.truncateAt > 0 && all.length > knobs.truncateAt;
        return reply(200, { sha, tree: cut ? all.slice(0, knobs.truncateAt) : all, truncated: cut });
      }
      return reply(200, { sha, tree: t.map((n) => ({ path: n.name, mode: n.mode, type: n.type, sha: n.sha })), truncated: false });
    }
    m = /^\/git\/blobs\/([0-9a-f]+)$/u.exec(rest);
    if (m !== null && r.method === "GET") {
      const b = repo.blobs.get(m[1] ?? "");
      if (b === undefined) return reply(404, { message: "Not Found" });
      const text = Buffer.from(b).toString("base64").replace(/(.{60})/gu, "$1\n");
      return reply(200, { sha: m[1], size: b.length, encoding: "base64", content: text });
    }
    if (rest === "/git/blobs" && r.method === "POST") {
      const body = JSON.parse(r.body ?? "{}") as { content: string; encoding: string };
      const bytes = body.encoding === "base64" ? new Uint8Array(Buffer.from(body.content, "base64")) : new TextEncoder().encode(body.content);
      if (bytes.length > knobs.blobLimit) return reply(422, { message: "Content is too large" });
      return reply(201, { sha: repo.addBlob(bytes) });
    }
    if (rest === "/git/trees" && r.method === "POST") {
      if (!knobs.push) return reply(403, { message: "Resource not accessible by personal access token" });
      const body = JSON.parse(r.body ?? "{}") as { base_tree?: string; tree: { path: string; mode: string; type: string; sha: string | null }[] };
      const flat = repo.flatten(body.base_tree);
      for (const e of body.tree) {
        if (e.sha === null) flat.delete(e.path);
        else flat.set(e.path, { mode: e.mode, blob: e.sha });
      }
      return reply(201, { sha: repo.treeOf(flat as Flat) });
    }
    if (rest === "/git/commits" && r.method === "POST") {
      const body = JSON.parse(r.body ?? "{}") as { message: string; tree: string; parents: string[]; author: { name: string; email: string; date: string }; committer: { name: string; email: string; date: string } };
      return reply(201, { sha: repo.addCommit({ tree: body.tree, parents: body.parents, message: body.message, author: body.author, committer: body.committer }) });
    }
    m = /^\/git\/refs(?:\/heads\/(.+))?$/u.exec(rest);
    if (m !== null && (r.method === "PATCH" || r.method === "POST")) {
      knobs.beforeRef?.();
      const body = JSON.parse(r.body ?? "{}") as { sha: string; force?: boolean; ref?: string };
      const branch = r.method === "PATCH" ? decodeURIComponent(m[1] ?? "") : (body.ref ?? "").replace(/^refs\/heads\//u, "");
      if (repo.protectedBranches.has(branch)) return reply(403, { message: "Protected branch update failed for refs/heads/" + branch + "." });
      const tip = repo.branches.get(branch);
      if (r.method === "POST") {
        if (tip !== undefined) return reply(422, { message: "Reference already exists" });
        repo.branches.set(branch, body.sha);
        return reply(201, { ref: `refs/heads/${branch}`, object: { sha: body.sha } });
      }
      if (tip === undefined) return reply(422, { message: "Reference does not exist" });
      if (body.force !== true && !repo.descends(body.sha, tip)) return reply(422, { message: "Update is not a fast forward" });
      repo.branches.set(branch, body.sha);
      return reply(200, { ref: `refs/heads/${branch}`, object: { sha: body.sha } });
    }
    if (rest === "/commits" && r.method === "GET") {
      const sha = q.get("sha") ?? "";
      const file = q.get("path") ?? "";
      const per = Number(q.get("per_page") ?? "30");
      const list = repo.history(sha, file).slice(0, per);
      return reply(
        200,
        list.map((id) => {
          const c = repo.commits.get(id);
          return { sha: id, commit: { message: c?.message ?? "", author: c?.author ?? { name: "", email: "", date: "" } } };
        }),
      );
    }
    return reply(404, { message: "Not Found" });
  };

  const transport: Transport = {
    kind: "recorded",
    send: (r) => {
      const x = handle(r);
      return Promise.resolve(x === undefined ? err({ kind: "network" as const, message: "no answer" }) : ok({ ...x, method: r.method, url: r.url }));
    },
  };
  return { transport, seen, knobs, count: (method, startsWith) => seen.filter((s) => s.method === method && s.path.slice(base.length).startsWith(startsWith)).length };
}
