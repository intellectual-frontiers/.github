/**
 * The subset of GitLab's REST API (v4) the store reads and writes, made in process as a transport: the project (found by its whole path with every `/` encoded), branches, the tree in pages along a `Link` header, blobs, the commits of a
 * path, and the Commits API with the checks GitLab makes of each file a commit changes (a create of a file that exists, an update or a delete of one that does not, and an update or a delete that carries a `last_commit_id` that is not the
 * file's, are each `400`). It commits on the head the branch has when the request arrives, as GitLab does, not on the commit the writer read, and it takes the token in `PRIVATE-TOKEN`.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import type { Exchange, OutRequest, Transport } from "@intellectual-frontiers/net/http-client";
import type { FakeRepo } from "./fake-git.ts";
import type { Seen } from "./fake-github.ts";

export type GitlabKnobs = {
  token: string | undefined;
  /** The access level of the token on the project (30 is Developer). */
  accessLevel: number;
  failNext: { status: number; headers?: Record<string, string>; body?: string }[];
  /** Run when a commit request arrives, before it is applied (so that another writer can commit first). */
  beforeCommit: (() => void) | undefined;
  /** The size of a page of a tree. */
  pageSize: number;
};

export type FakeGitlab = {
  readonly transport: Transport;
  readonly seen: Seen[];
  readonly knobs: GitlabKnobs;
  count(method: string, startsWith: string): number;
};

const reply = (status: number, body: unknown, headers: Record<string, string> = {}): Exchange => ({ method: "GET", url: "", status, headers: { "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });

export function fakeGitlab(repo: FakeRepo, options: { readonly project?: string; readonly defaultBranch?: string } = {}): FakeGitlab {
  const project = options.project ?? "acme/ops/fleet";
  const base = `/api/v4/projects/${encodeURIComponent(project)}`;
  const knobs: GitlabKnobs = { token: undefined, accessLevel: 30, failNext: [], beforeCommit: undefined, pageSize: 100 };
  const seen: Seen[] = [];

  const handle = (r: OutRequest): Exchange => {
    const url = new URL(r.url);
    // the path as it was written, with the encoded slashes of the project kept
    const path = url.pathname;
    seen.push({ method: r.method, path, query: url.search, headers: { ...r.headers }, body: r.body ?? "" });
    const failing = knobs.failNext.shift();
    if (failing !== undefined) return reply(failing.status, failing.body ?? { message: "failure on purpose" }, failing.headers ?? {});
    const auth = Object.entries(r.headers).find(([k]) => k.toLowerCase() === "private-token")?.[1];
    if (knobs.token !== undefined && auth !== knobs.token) return reply(401, { message: "401 Unauthorized" });
    if (!path.startsWith(base)) return reply(404, { message: "404 Project Not Found" });
    const rest = path.slice(base.length);
    const q = url.searchParams;

    if (rest === "" && r.method === "GET") return reply(200, { default_branch: options.defaultBranch ?? "main", permissions: { project_access: { access_level: knobs.accessLevel }, group_access: null } });
    let m = /^\/repository\/branches\/(.+)$/u.exec(rest);
    if (m !== null && r.method === "GET") {
      const b = decodeURIComponent(m[1] ?? "");
      const tip = repo.branches.get(b);
      return tip === undefined ? reply(404, { message: "404 Branch Not Found" }) : reply(200, { name: b, protected: repo.protectedBranches.has(b), can_push: knobs.accessLevel >= 30 && !repo.protectedBranches.has(b), commit: { id: tip } });
    }
    if (rest === "/repository/tree" && r.method === "GET") {
      const ref = q.get("ref") ?? "";
      const c = repo.commits.get(ref);
      if (c === undefined) return reply(404, { message: "404 Tree Not Found" });
      const folder = q.get("path") ?? "";
      const recursive = q.get("recursive") === "true";
      const rows: { id: string; name: string; type: string; path: string; mode: string }[] = [];
      const walk = (tree: string, prefix: string, deep: boolean): void => {
        for (const n of repo.trees.get(tree) ?? []) {
          const p = prefix === "" ? n.name : `${prefix}/${n.name}`;
          rows.push({ id: n.sha, name: n.name, type: n.type, path: p, mode: n.mode });
          if (n.type === "tree" && deep) walk(n.sha, p, deep);
        }
      };
      let at: string | undefined = c.tree;
      for (const seg of folder === "" ? [] : folder.split("/")) {
        const e: { readonly name: string; readonly type: string; readonly sha: string } | undefined = repo.trees.get(at ?? "")?.find((x) => x.name === seg && x.type === "tree");
        at = e?.sha;
        if (at === undefined) break;
      }
      if (at === undefined) return reply(404, { message: "404 Tree Not Found" });
      walk(at, folder, recursive);
      const per = Math.min(Number(q.get("per_page") ?? "20"), knobs.pageSize);
      const page = Number(q.get("page") ?? "1");
      const slice = rows.slice((page - 1) * per, page * per);
      const more = page * per < rows.length;
      const next = new URL(r.url);
      next.searchParams.set("page", String(page + 1));
      next.searchParams.set("per_page", String(per));
      return reply(200, slice, more ? { link: `<${next.toString()}>; rel="next"` } : {});
    }
    m = /^\/repository\/blobs\/([0-9a-f]+)$/u.exec(rest);
    if (m !== null && r.method === "GET") {
      const b = repo.blobs.get(m[1] ?? "");
      return b === undefined ? reply(404, { message: "404 Blob Not Found" }) : reply(200, { id: m[1], size: b.length, encoding: "base64", content: Buffer.from(b).toString("base64") });
    }
    if (rest === "/repository/commits" && r.method === "GET") {
      const ref = q.get("ref_name") ?? "";
      const file = q.get("path") ?? "";
      const per = Number(q.get("per_page") ?? "20");
      const list = repo.history(ref, file).slice(0, per);
      return reply(
        200,
        list.map((id) => {
          const c = repo.commits.get(id);
          return { id, title: (c?.message ?? "").split("\n")[0], author_name: c?.author.name, author_email: c?.author.email, authored_date: c?.author.date };
        }),
      );
    }
    if (rest === "/repository/commits" && r.method === "POST") {
      knobs.beforeCommit?.();
      if (knobs.accessLevel < 30) return reply(403, { message: "403 Forbidden" });
      const body = JSON.parse(r.body ?? "{}") as {
        branch: string;
        start_sha?: string;
        commit_message: string;
        author_name: string;
        author_email: string;
        actions: { action: string; file_path: string; previous_path?: string; content?: string; encoding?: string; last_commit_id?: string; execute_filemode?: boolean }[];
      };
      if (repo.protectedBranches.has(body.branch)) return reply(403, { message: "You are not allowed to push into this branch" });
      let tip = repo.branches.get(body.branch);
      const creating = tip === undefined;
      if (tip === undefined) {
        if (body.start_sha === undefined || !repo.commits.has(body.start_sha)) return reply(400, { message: "You can only create or edit files when you are on a branch" });
        tip = body.start_sha;
      } else if (body.start_sha !== undefined) {
        return reply(400, { message: "Branch already exists" });
      }
      const flat = repo.flatten(repo.commits.get(tip)?.tree);
      const lastOf = (p: string): string | undefined => repo.history(tip as string, p)[0];
      for (const a of body.actions) {
        const exists = flat.has(a.file_path);
        if (a.action === "create") {
          if (exists) return reply(400, { message: "A file with this name already exists" });
          flat.set(a.file_path, { mode: a.execute_filemode === true ? "100755" : "100644", blob: repo.addBlob(new Uint8Array(Buffer.from(a.content ?? "", a.encoding === "base64" ? "base64" : "utf8"))) });
        } else if (a.action === "update") {
          if (!exists) return reply(400, { message: "A file with this name doesn't exist" });
          if (a.last_commit_id !== undefined && a.last_commit_id !== lastOf(a.file_path)) return reply(400, { message: "You are attempting to update or delete a file that has changed since you started editing it" });
          flat.set(a.file_path, { mode: a.execute_filemode === true ? "100755" : (flat.get(a.file_path)?.mode ?? "100644"), blob: repo.addBlob(new Uint8Array(Buffer.from(a.content ?? "", a.encoding === "base64" ? "base64" : "utf8"))) });
        } else if (a.action === "delete") {
          if (!exists) return reply(400, { message: "A file with this name doesn't exist" });
          if (a.last_commit_id !== undefined && a.last_commit_id !== lastOf(a.file_path)) return reply(400, { message: "You are attempting to update or delete a file that has changed since you started editing it" });
          flat.delete(a.file_path);
        } else if (a.action === "move") {
          const from = a.previous_path ?? "";
          const f = flat.get(from);
          if (f === undefined) return reply(400, { message: "A file with this name doesn't exist" });
          if (flat.has(a.file_path)) return reply(400, { message: "A file with this name already exists" });
          if (a.last_commit_id !== undefined && a.last_commit_id !== lastOf(from)) return reply(400, { message: "You are attempting to update or delete a file that has changed since you started editing it" });
          flat.delete(from);
          flat.set(a.file_path, f);
        } else return reply(400, { message: `unknown action ${a.action}` });
      }
      const who = { name: body.author_name, email: body.author_email, date: repo.now() };
      const id = repo.addCommit({ tree: repo.treeOf(flat), parents: [tip], message: body.commit_message, author: who, committer: { name: "token user", email: "token@example.test", date: who.date } });
      repo.branches.set(body.branch, id);
      void creating;
      return reply(201, { id });
    }
    return reply(404, { message: "404 Not Found" });
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

