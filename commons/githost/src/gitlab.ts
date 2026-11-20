// Spec: 0001-githost FR-001
/**
 * GitLab behind the one interface (commons 0001-githost FR-001 to FR-006): REST API v4 over the runtime's `Transport`, `gitlab.com` or a self-managed host,
 * public and private projects, groups to any depth (a project is addressed by its whole path, URL-encoded), issues, merge requests, protected branches and whether a commit's signature is
 * verified.
 *
 * @remarks
 * The token is given once to `gitlabClient` and lives only in the closure that builds the request headers (`PRIVATE-TOKEN` for a personal or project access token, `JOB-TOKEN` for a CI job's
 * token): it is in no result, no failure and no property of the client, and it is sent only to the one host the client serves. A private project asked for with no token is answered
 * `not-found`, as GitLab says; with a token that may not read it, `unauthorized`. On GitLab, `requiresReview` of a protected branch means that changes enter only by a merge request (no one may push)
 * or that a code owner must approve, which is what the branch rule alone tells; the approval rules of a merge request are another endpoint of a paid plan.
 *
 * @limits GitLab's REST API v4 has no parent and child issues (they are work items, in its GraphQL API), so an issue is answered with `hierarchy: "unavailable"`, no parent and no children. A
 * project with no commit has no default branch, and its `defaultBranch` is empty.
 *
 * @module
 */
import { array, boolean, integer, literal, nullable, object, string, err, ok, type Result } from "@intellectual-frontiers/core";
import type { Transport } from "@intellectual-frontiers/net/http-client";
import { CAPABILITIES } from "./capabilities.ts";
import { describeRef } from "./remote.ts";
import { failureOf, get, getDecoded, messageOf, usableToken, decodeBody } from "./http.ts";
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

/** How a GitLab client is made. */
export type GitlabOptions = {
  /** How requests are sent: the live transport, or a recorded one. */
  readonly transport: Transport;
  /** The host's address without the API path (`https://gitlab.com` by default); its host name is the one host this client serves. */
  readonly baseUrl?: string;
  /** A token, from the environment by the caller; never stored in a file and never in a result. Absent: only what is public. */
  readonly token?: string | undefined;
  /** What the token is: a personal or project access token (`PRIVATE-TOKEN`, the default), or a CI job's token (`JOB-TOKEN`). */
  readonly tokenKind?: "access" | "job";
};

const projectShape = object(
  { http_url_to_repo: string },
  { archived: boolean, visibility: literal("public", "internal", "private"), default_branch: nullable(string) },
);
const issueShape = object(
  { iid: integer, title: string, state: literal("opened", "closed"), web_url: string },
  { description: nullable(string), labels: array(string) },
);
const mergeRequestShape = object({
  iid: integer,
  title: string,
  state: literal("opened", "closed", "merged", "locked"),
  web_url: string,
  source_branch: string,
  target_branch: string,
});
const branchShape = object({ name: string, protected: boolean });
const protectedShape = object(
  { name: string, allow_force_push: boolean },
  { code_owner_approval_required: boolean, push_access_levels: array(object({ access_level: integer })) },
);
const signatureShape = object({ verification_status: string });

/** A GitLab client over a transport: the common four capabilities, protected branches, issues and merge requests, and groups to any depth. */
export function gitlabClient(options: GitlabOptions): GitHostClient {
  const baseUrl = (options.baseUrl ?? "https://gitlab.com").replace(/\/+$/, "");
  const host = new URL(baseUrl).hostname.toLowerCase();
  const api = `${baseUrl}/api/v4`;
  const token = usableToken(options.token);
  const credential = token !== undefined;
  const headers = (): Readonly<Record<string, string>> => ({
    accept: "application/json",
    ...(token === undefined ? {} : { [options.tokenKind === "job" ? "job-token" : "private-token"]: token }),
  });
  const refused = { credential };

  const projectUrl = (ref: RepoRef): Result<string, HostFailure> => {
    if (ref.host.toLowerCase() !== host) return err({ kind: "not-found", what: `${describeRef(ref)} (this client serves only ${host})` });
    if (ref.path.length < 2)
      return err({ kind: "not-found", what: `${describeRef(ref)} (a GitLab project is a group or user and a name)` });
    return ok(`${api}/projects/${encodeURIComponent(ref.path.join("/"))}`);
  };

  async function repository(ref: RepoRef): Promise<HostResult<RepoInfo>> {
    const p = projectUrl(ref);
    if (p.kind === "err") return p;
    const r = await getDecoded(options.transport, p.value, headers(), projectShape, `project ${describeRef(ref)}`, refused);
    if (r.kind === "err") return r;
    const visibility: Visibility = r.value.visibility ?? "unknown";
    return ok({
      ref,
      visibility,
      defaultBranch: r.value.default_branch ?? "",
      cloneUrl: r.value.http_url_to_repo,
      archived: r.value.archived ?? false, // an unauthenticated answer for a public project does not carry it
    });
  }

  async function issue(ref: RepoRef, number: number): Promise<HostResult<IssueInfo>> {
    const p = projectUrl(ref);
    if (p.kind === "err") return p;
    const r = await getDecoded(
      options.transport,
      `${p.value}/issues/${number}`,
      headers(),
      issueShape,
      `issue #${number} of ${describeRef(ref)}`,
      refused,
    );
    if (r.kind === "err") return r;
    return ok({
      number: r.value.iid,
      title: r.value.title,
      body: r.value.description ?? "",
      state: r.value.state === "opened" ? "open" : "closed",
      url: r.value.web_url,
      children: [],
      labels: r.value.labels ?? [],
      hierarchy: "unavailable",
    });
  }

  async function changeRequest(ref: RepoRef, number: number): Promise<HostResult<ChangeRequestInfo>> {
    const p = projectUrl(ref);
    if (p.kind === "err") return p;
    const what = `merge request !${number} of ${describeRef(ref)}`;
    const r = await getDecoded(options.transport, `${p.value}/merge_requests/${number}`, headers(), mergeRequestShape, what, refused);
    if (r.kind === "err") return r;
    return ok({
      number: r.value.iid,
      title: r.value.title,
      state: r.value.state === "merged" ? "merged" : r.value.state === "closed" ? "closed" : "open",
      url: r.value.web_url,
      sourceBranch: r.value.source_branch,
      targetBranch: r.value.target_branch,
    });
  }

  async function branchProtection(ref: RepoRef, branch: string): Promise<HostResult<BranchProtection>> {
    const p = projectUrl(ref);
    if (p.kind === "err") return p;
    const name = encodeURIComponent(branch);
    const what = `branch ${branch} of ${describeRef(ref)}`;
    const b = await getDecoded(options.transport, `${p.value}/repository/branches/${name}`, headers(), branchShape, what, refused);
    if (b.kind === "err") return b;
    if (!b.value.protected) return ok({ branch, protected: false, requiresReview: false, allowsForcePush: true, detail: "full" });
    const x = await get(options.transport, `${p.value}/protected_branches/${name}`, headers());
    if (x.kind === "err") return x;
    // A wildcard rule (`release/*`) is not found by the branch's name, and the rules may be for maintainers to read: the branch is protected all the same.
    if (x.value.status === 401 || x.value.status === 403 || x.value.status === 404) {
      return ok({ branch, protected: true, requiresReview: false, allowsForcePush: false, detail: "protected-only" });
    }
    const f = failureOf(x.value, what, refused);
    if (f !== undefined) return err(f);
    const rule = decodeBody(x.value, protectedShape);
    if (rule.kind === "err") return rule;
    const pushers = rule.value.push_access_levels ?? [];
    const nobodyPushes = pushers.length > 0 && pushers.every((l) => l.access_level === 0);
    return ok({
      branch,
      protected: true,
      requiresReview: rule.value.code_owner_approval_required === true || nobodyPushes,
      allowsForcePush: rule.value.allow_force_push,
      detail: "full",
    });
  }

  async function commitVerified(ref: RepoRef, sha: string): Promise<HostResult<boolean>> {
    const p = projectUrl(ref);
    if (p.kind === "err") return p;
    const what = `commit ${sha.slice(0, 12)} of ${describeRef(ref)}`;
    const x = await get(options.transport, `${p.value}/repository/commits/${encodeURIComponent(sha)}/signature`, headers());
    if (x.kind === "err") return x;
    // GitLab answers 404 "GPG Signature Not Found" for a commit with no signature, and 404 "Commit Not Found" for no commit.
    if (x.value.status === 404 && /signature/i.test(messageOf(x.value.body))) return ok(false);
    const f = failureOf(x.value, what, refused);
    if (f !== undefined) return err(f);
    const s = decodeBody(x.value, signatureShape);
    return s.kind === "err" ? s : ok(s.value.verification_status === "verified");
  }

  return { kind: "Gitlab", capabilities: CAPABILITIES.Gitlab, repository, issue, changeRequest, branchProtection, commitVerified };
}
