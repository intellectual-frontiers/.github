/**
 * The one interface to a Git host (commons 0020-ifccm FR-027 to FR-030, 0023-if-workspaces FR-016 to FR-021): GitHub, GitLab and plain Git are read through it, so that a check of change
 * control and a workspace never name a host's own word. The types here are pure; the adapters (`github.ts`, `gitlab.ts`, `git.ts`) are the only code that does.
 *
 * A host answers only what it has: a capability it lacks is `unsupported`, never a guess (0023-if-workspaces FR-017). A private repository is asked with a credential from the
 * environment or a credential helper, never from a file; a refusal for want of one is `unauthorized`, which is a finding for a person to act on, not a retry.
 *
 * @module
 */
import type { Result } from "../kernel/result.ts";

/** The kinds of host: the keys of the code list `ifws:GitManagerKind` and `ifccm:GitHostKind`. */
export type HostKind = "Github" | "Gitlab" | "Git";

/** The capabilities a host may offer: the keys of the code list `ifws:GitCapability`. */
export type Capability =
  "CloneUrl" | "Credentials" | "DefaultBranch" | "SignedCommits" | "ProtectedBranches" | "Issues" | "ChangeRequests" | "NestedGroups";

/** A repository on a host: the host name, and the path from it (owner then repository on GitHub; groups to any depth then repository on GitLab). Never contains a scheme or `.git`. */
export type RepoRef = {
  readonly kind: HostKind;
  /** The host name, such as `github.com`, `gitlab.com` or the name of a self-managed host. */
  readonly host: string;
  /** The path segments, the last being the repository. */
  readonly path: readonly string[];
};

/** Whether a repository may be seen by anyone: `unknown` where the host was not asked or does not say. */
export type Visibility = "public" | "private" | "internal" | "unknown";

/** What a host says of a repository. */
export type RepoInfo = {
  readonly ref: RepoRef;
  readonly visibility: Visibility;
  readonly defaultBranch: string;
  /** The URL a clone is made from (HTTPS), without a credential in it. */
  readonly cloneUrl: string;
  readonly archived: boolean;
};

/** What a host says of an issue: the words and sections the change-control check reads. */
export type IssueInfo = {
  /** The number the host gives it, in the repository (`#N` on GitHub, `#N` of a project on GitLab). */
  readonly number: number;
  readonly title: string;
  readonly body: string;
  readonly state: "open" | "closed";
  readonly url: string;
  /** The issue this one is a child of, where the host has parent and child issues. */
  readonly parent?: number | undefined;
  /** The issues that are children of this one, where the host has them. */
  readonly children: readonly number[];
  readonly labels: readonly string[];
};

/** What a host says of a pull request or a merge request. */
export type ChangeRequestInfo = {
  readonly number: number;
  readonly title: string;
  readonly state: "open" | "closed" | "merged";
  readonly url: string;
  readonly sourceBranch: string;
  readonly targetBranch: string;
};

/** Whether a branch of a repository is protected (no push, no force, review required). */
export type BranchProtection = {
  readonly branch: string;
  readonly protected: boolean;
  readonly requiresReview: boolean;
  readonly allowsForcePush: boolean;
};

/** Why a host did not answer. */
export type HostFailure =
  | { readonly kind: "unsupported"; readonly capability: Capability; readonly host: HostKind }
  | { readonly kind: "unauthorized"; readonly reason: string }
  | { readonly kind: "not-found"; readonly what: string }
  | { readonly kind: "rate-limited"; readonly retryAfterSeconds?: number | undefined }
  | { readonly kind: "unreachable"; readonly reason: string }
  | { readonly kind: "unexpected"; readonly status: number; readonly reason: string };

/** An answer of a host. */
export type HostResult<T> = Result<T, HostFailure>;

/** The one interface to a host. Every method that a host may lack returns `unsupported` for it, and `capabilities` says which. */
export type GitHostClient = {
  readonly kind: HostKind;
  readonly capabilities: ReadonlySet<Capability>;
  repository(ref: RepoRef): Promise<HostResult<RepoInfo>>;
  issue(ref: RepoRef, number: number): Promise<HostResult<IssueInfo>>;
  changeRequest(ref: RepoRef, number: number): Promise<HostResult<ChangeRequestInfo>>;
  branchProtection(ref: RepoRef, branch: string): Promise<HostResult<BranchProtection>>;
  /** Whether the commit's signature is verified by the host, where the host can say. */
  commitVerified(ref: RepoRef, sha: string): Promise<HostResult<boolean>>;
};

/** The words of a failure, as a sentence for a finding. */
export function describeFailure(f: HostFailure): string {
  switch (f.kind) {
    case "unsupported":
      return `${f.host} does not offer ${f.capability}`;
    case "unauthorized":
      return `not authorized: ${f.reason}`;
    case "not-found":
      return `${f.what} was not found`;
    case "rate-limited":
      return f.retryAfterSeconds === undefined ? "rate limited" : `rate limited, retry after ${f.retryAfterSeconds} s`;
    case "unreachable":
      return `unreachable: ${f.reason}`;
    case "unexpected":
      return `unexpected answer ${f.status}: ${f.reason}`;
  }
}
