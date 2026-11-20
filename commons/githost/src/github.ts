// Spec: 0001-githost FR-001
/**
 * GitHub behind the one interface (commons 0001-githost FR-001 to FR-004): REST API v3 over the runtime's `Transport`, public and private repositories,
 * issues with their parent and sub-issues, pull requests, protected branches and whether a commit's signature is verified.
 *
 * @remarks
 * The token is given once to `githubClient` and lives only in the closure that builds the request headers: it is in no result, no failure and no property of the client, and it is sent
 * only to the one host the client serves (`github.com` by default; a GitHub Enterprise Server host by `host` and `apiBase`). A private repository asked for with no token is answered
 * `not-found`, as GitHub says (it answers 404 where a repository exists and the caller may not see it); with a token that may not read it, `unauthorized`. GitHub has no groups below an
 * owner, so a path of more than two segments is `unsupported` (`NestedGroups`).
 *
 * @limits Single resources only: no listing is paged. The protection rules of a branch are shown to administrators, so for anyone else a protected branch is answered with `detail:
 * "protected-only"`.
 *
 * @module
 */
import {
  array,
  boolean,
  integer,
  literal,
  nullable,
  object,
  oneOf,
  string,
  unknownValue,
  err,
  ok,
  type Result,
} from "@intellectual-frontiers/core";
import type { Exchange, Transport } from "@intellectual-frontiers/net/http-client";
import { CAPABILITIES, unsupported } from "./capabilities.ts";
import { describeRef } from "./remote.ts";
import { decodeBody, failureOf, get, getDecoded, usableToken } from "./http.ts";
import type {
  BranchProtection,
  ChangeRequestInfo,
  GitHostClient,
  HostFailure,
  HostResult,
  IssueInfo,
  RepoInfo,
  RepoRef,
  Visibility,
} from "./types.ts";

/** How a GitHub client is made. */
export type GithubOptions = {
  /** How requests are sent: the live transport, or a recorded one. */
  readonly transport: Transport;
  /** A token, from the environment by the caller; never stored in a file and never in a result. Absent: only what is public. */
  readonly token?: string | undefined;
  /** The one host this client serves (`github.com` by default); a reference to another host is `not-found`, so the token is never sent elsewhere. */
  readonly host?: string;
  /** The API's base URL (`https://api.github.com` for `github.com`, `https://<host>/api/v3` for another host by default). */
  readonly apiBase?: string;
};

const repoShape = object({ private: boolean, default_branch: string, clone_url: string, archived: boolean }, { visibility: string });
const issueShape = object(
  { number: integer, title: string, state: literal("open", "closed"), html_url: string },
  { body: nullable(string), labels: array(oneOf(string, object({ name: string }))), pull_request: unknownValue },
);
const subIssuesShape = array(object({ number: integer }));
const pullShape = object(
  {
    number: integer,
    title: string,
    state: literal("open", "closed"),
    html_url: string,
    head: object({ ref: string }),
    base: object({ ref: string }),
  },
  { merged: boolean, merged_at: nullable(string) },
);
const branchShape = object({ name: string, protected: boolean });
const protectionShape = object({}, { required_pull_request_reviews: unknownValue, allow_force_pushes: object({ enabled: boolean }) });
const commitShape = object({ commit: object({ verification: object({ verified: boolean }) }) });

const visibilityOf = (v: string | undefined, isPrivate: boolean): Visibility =>
  v === "public" || v === "private" || v === "internal" ? v : isPrivate ? "private" : "public";

const rateLimited = (x: Exchange): boolean =>
  x.headers["x-ratelimit-remaining"] === "0" || x.headers["retry-after"] !== undefined || /rate limit/i.test(x.body.slice(0, 400));

/** A GitHub client over a transport: the common four capabilities and protected branches, issues and pull requests, with no nested groups. */
export function githubClient(options: GithubOptions): GitHostClient {
  const host = (options.host ?? "github.com").toLowerCase();
  const apiBase = (options.apiBase ?? (host === "github.com" ? "https://api.github.com" : `https://${host}/api/v3`)).replace(/\/+$/, "");
  const token = usableToken(options.token);
  const credential = token !== undefined;
  const headers = (): Readonly<Record<string, string>> => ({
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
  });
  const refused = { credential, rateLimited };

  /** The API path of a repository, or the failure for a reference this client does not serve. */
  const repoPath = (ref: RepoRef): Result<string, HostFailure> => {
    if (ref.host.toLowerCase() !== host) return err({ kind: "not-found", what: `${describeRef(ref)} (this client serves only ${host})` });
    if (ref.path.length > 2) return unsupported("Github", "NestedGroups");
    const [owner, repo] = ref.path;
    if (owner === undefined || repo === undefined)
      return err({ kind: "not-found", what: `${describeRef(ref)} (a GitHub repository is an owner and a name)` });
    return ok(`${apiBase}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
  };
  const encodeRef = (name: string): string => name.split("/").map(encodeURIComponent).join("/");

  async function repository(ref: RepoRef): Promise<HostResult<RepoInfo>> {
    const base = repoPath(ref);
    if (base.kind === "err") return base;
    const r = await getDecoded(options.transport, base.value, headers(), repoShape, `repository ${describeRef(ref)}`, refused);
    if (r.kind === "err") return r;
    return ok({
      ref,
      visibility: visibilityOf(r.value.visibility, r.value.private),
      defaultBranch: r.value.default_branch,
      cloneUrl: r.value.clone_url,
      archived: r.value.archived,
    });
  }

  async function issue(ref: RepoRef, number: number): Promise<HostResult<IssueInfo>> {
    const base = repoPath(ref);
    if (base.kind === "err") return base;
    const what = `issue #${number} of ${describeRef(ref)}`;
    const url = `${base.value}/issues/${number}`;
    const r = await getDecoded(options.transport, url, headers(), issueShape, what, refused);
    if (r.kind === "err") return r;
    // GitHub lists a pull request among the issues; it is not one for the change-control check.
    if (r.value.pull_request !== undefined) return err({ kind: "not-found", what: `${what} (that number is a pull request)` });
    const parent = await get(options.transport, `${url}/parent`, headers());
    if (parent.kind === "err") return parent;
    let parentNumber: number | undefined;
    if (parent.value.status !== 404) {
      const f = failureOf(parent.value, what, refused);
      if (f !== undefined) return err(f);
      const p = decodeBody(parent.value, object({ number: integer }));
      if (p.kind === "err") return p;
      parentNumber = p.value.number;
    }
    const subs = await get(options.transport, `${url}/sub_issues?per_page=100`, headers());
    if (subs.kind === "err") return subs;
    let children: readonly number[] = [];
    let hierarchy: "known" | "unavailable" = "known";
    if (subs.value.status === 404) {
      hierarchy = "unavailable";
    } else {
      const f = failureOf(subs.value, what, refused);
      if (f !== undefined) return err(f);
      const c = decodeBody(subs.value, subIssuesShape);
      if (c.kind === "err") return c;
      children = c.value.map((i) => i.number);
    }
    return ok({
      number: r.value.number,
      title: r.value.title,
      body: r.value.body ?? "",
      state: r.value.state,
      url: r.value.html_url,
      ...(parentNumber === undefined ? {} : { parent: parentNumber }),
      children,
      labels: (r.value.labels ?? []).map((l) => (typeof l === "string" ? l : l.name)),
      hierarchy,
    });
  }

  async function changeRequest(ref: RepoRef, number: number): Promise<HostResult<ChangeRequestInfo>> {
    const base = repoPath(ref);
    if (base.kind === "err") return base;
    const r = await getDecoded(
      options.transport,
      `${base.value}/pulls/${number}`,
      headers(),
      pullShape,
      `pull request #${number} of ${describeRef(ref)}`,
      refused,
    );
    if (r.kind === "err") return r;
    const merged = r.value.merged === true || (r.value.merged_at !== undefined && r.value.merged_at !== null);
    return ok({
      number: r.value.number,
      title: r.value.title,
      state: merged ? "merged" : r.value.state,
      url: r.value.html_url,
      sourceBranch: r.value.head.ref,
      targetBranch: r.value.base.ref,
    });
  }

  async function branchProtection(ref: RepoRef, branch: string): Promise<HostResult<BranchProtection>> {
    const base = repoPath(ref);
    if (base.kind === "err") return base;
    const what = `branch ${branch} of ${describeRef(ref)}`;
    const b = await getDecoded(options.transport, `${base.value}/branches/${encodeRef(branch)}`, headers(), branchShape, what, refused);
    if (b.kind === "err") return b;
    if (!b.value.protected) return ok({ branch, protected: false, requiresReview: false, allowsForcePush: true, detail: "full" });
    const x = await get(options.transport, `${base.value}/branches/${encodeRef(branch)}/protection`, headers());
    if (x.kind === "err") return x;
    // The rules are shown to administrators: a refusal to show them is not a refusal of the answer that the branch is protected.
    if (x.value.status === 403 || x.value.status === 404 || x.value.status === 401) {
      return ok({ branch, protected: true, requiresReview: false, allowsForcePush: false, detail: "protected-only" });
    }
    const f = failureOf(x.value, what, refused);
    if (f !== undefined) return err(f);
    const p = decodeBody(x.value, protectionShape);
    if (p.kind === "err") return p;
    return ok({
      branch,
      protected: true,
      requiresReview: p.value.required_pull_request_reviews !== undefined,
      allowsForcePush: p.value.allow_force_pushes?.enabled === true,
      detail: "full",
    });
  }

  async function commitVerified(ref: RepoRef, sha: string): Promise<HostResult<boolean>> {
    const base = repoPath(ref);
    if (base.kind === "err") return base;
    const r = await getDecoded(
      options.transport,
      `${base.value}/commits/${encodeURIComponent(sha)}`,
      headers(),
      commitShape,
      `commit ${sha.slice(0, 12)} of ${describeRef(ref)}`,
      refused,
    );
    return r.kind === "err" ? r : ok(r.value.commit.verification.verified);
  }

  return { kind: "Github", capabilities: CAPABILITIES.Github, repository, issue, changeRequest, branchProtection, commitVerified };
}
