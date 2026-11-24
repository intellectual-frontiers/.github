// Spec: 0002-anyfs-githost-store FR-005, FR-006
/**
 * What the one store logic needs of a host, as a typed interface: the host's REST API read as a repository of Git. GitHub and GitLab each give it (`github.ts`, `gitlab.ts`), and a host that
 * speaks neither can give it too; the store (`store.ts`) never names a host's word. Every call is a value (a success or an `ApiProblem`) and none throws.
 *
 * @module
 */
import type { Result } from "@intellectual-frontiers/core";
import type { Identity } from "@intellectual-frontiers/anyfs-githost/governance";

/** Why a host's API did not do what it was asked: a closed union, a sentence each. */
export type ApiProblem =
  /** The repository, branch, file or commit asked for is not there (or the caller may not see it: a host says so for both). */
  | { readonly kind: "not-found"; readonly what: string }
  /** The branch moved, or a file changed, or a file was made, under the commit: the change must be read and made again. */
  | { readonly kind: "conflict"; readonly message: string }
  /** The host will not do it for this token. */
  | { readonly kind: "denied"; readonly reason: "unauthorized" | "permission" | "protected"; readonly message: string }
  /** The host asks the caller to wait. */
  | { readonly kind: "rate-limited"; readonly message: string; readonly retryAfterSeconds?: number }
  /** The host will not hold an object so large. */
  | { readonly kind: "too-large"; readonly message: string }
  /** The host could not be reached or failed: worth another try where `retryable`. */
  | { readonly kind: "unavailable"; readonly message: string; readonly retryable: boolean }
  /** The host answered with what its documentation does not say. */
  | { readonly kind: "unexpected"; readonly status: number; readonly message: string };

/** What a host says of a repository. */
export type RepoFacts = {
  readonly defaultBranch: string | undefined;
  /** Whether the token may push to the repository, where the host says. */
  readonly canPush: boolean | undefined;
};

/** What a host says of a branch. */
export type BranchFacts = {
  /** The commit at its tip. */
  readonly tip: string;
  /** Whether the host protects it (no direct push, or review required). */
  readonly protected: boolean;
  /** Whether the token may push to it, where the host says. */
  readonly canPush: boolean | undefined;
};

/** One entry of a tree: a file, below the top of the repository. */
export type TreeEntry = {
  /** The path from the top of the repository. */
  readonly path: string;
  /** The name of the blob, which stands for its bytes for ever. */
  readonly blob: string;
  /** The mode in Git: `100644` or `100755` for a file. */
  readonly mode: string;
};

/** What is at a path of a commit. */
export type Located =
  | { readonly kind: "file"; readonly blob: string; readonly mode: string }
  | { readonly kind: "dir" }
  | { readonly kind: "link"; readonly what: string }
  | { readonly kind: "none" };

/** A commit that changed a file. */
export type LogItem = {
  readonly commit: string;
  readonly author: { readonly name: string; readonly email: string };
  /** When it was made (ISO 8601, UTC). */
  readonly at: string;
  readonly subject: string;
};

/** One change of a commit, in its final state. */
export type FileChange =
  /** A file is made or changed; `exists` says whether it was a file at the commit the change is made on. */
  | { readonly kind: "put"; readonly path: string; readonly bytes: Uint8Array; readonly exists: boolean; readonly mode: string }
  | { readonly kind: "delete"; readonly path: string }
  /** A file is moved, with its bytes unchanged. */
  | { readonly kind: "move"; readonly from: string; readonly to: string; readonly blob: string; readonly mode: string };

/** What a commit is made of. */
export type CommitRequest = {
  readonly branch: string;
  /** The commit the changes were checked at: the tip they were read at, or the commit a new branch starts from. */
  readonly base: string;
  /** Whether the branch is made by this commit. */
  readonly create: boolean;
  readonly message: string;
  readonly author: Identity;
  readonly committer: Identity;
  readonly at: Date;
  readonly changes: readonly FileChange[];
};

/** The commit a request made. */
export type Committed = { readonly commit: string };

/** A host's API as a repository of Git. */
export type HostApi = {
  readonly host: "github" | "gitlab";
  /** Where the repository is, as a sentence. */
  readonly describe: string;
  repo(): Promise<Result<RepoFacts, ApiProblem>>;
  branch(name: string): Promise<Result<BranchFacts | undefined, ApiProblem>>;
  /** Every file at or below a folder of a commit, complete: a tree that the host cuts short is read again by folder, and is never returned partial. */
  list(commit: string, folder: string): Promise<Result<readonly TreeEntry[], ApiProblem>>;
  locate(commit: string, path: string): Promise<Result<Located, ApiProblem>>;
  blob(id: string): Promise<Result<Uint8Array, ApiProblem>>;
  /** Makes one commit and moves the branch to it, never by force: a branch that moved, or a file that changed, is a `conflict`. */
  commit(request: CommitRequest): Promise<Result<Committed, ApiProblem>>;
  /** The commits at or before a commit that changed a file, newest first. */
  log(commit: string, path: string, limit: number): Promise<Result<readonly LogItem[], ApiProblem>>;
};
