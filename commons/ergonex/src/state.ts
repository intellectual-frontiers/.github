// Spec: 0002-workspace-model FR-022
/**
 * The state of one repository of the workspace (commons 0002-workspace-model FR-022, FR-026, FR-027): a repository is observed as exactly one `RepoState`, classified by a pure function from the
 * facts a host layer read (what is at the path, its remote, its lock files, whether HEAD is on a branch, whether the tree has changes, how many commits it is ahead of and behind its upstream).
 *
 * @remarks
 * The ten states are the keys of the code list `ergonex:RepoState`, and the three facts the plan reads of each (its default action, whether it is fast-forwardable, whether it holds local work) are the
 * list's: a test holds these tables equal to the ontology's. The order of the classification is the order of what is most in the way: nothing there, then something that is not a repository, a
 * remote that is not the manifest's, a lock, a detached HEAD, uncommitted changes, then the branch against its upstream (diverged, ahead, behind, clean). A remote is compared as a repository, so a
 * clone over SSH is the same as the manifest's HTTPS; a credential in an observed remote is never kept: the state names the host and the path only.
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import { describeRef, parseRemote, sameRepository } from "@intellectual-frontiers/commons/ts/githost";
import type { RepoRef } from "@intellectual-frontiers/commons/ts/githost";

/** What a host layer read of a path. */
export type RepoFacts =
  | { readonly kind: "absent" }
  | { readonly kind: "not-a-repository" }
  | {
      readonly kind: "repository";
      /** The URL of the remote `origin`, as Git holds it (it may hold a credential, which is never kept); undefined where there is none. */
      readonly remote: string | undefined;
      /** A Git lock file (`index.lock`, `HEAD.lock`, `shallow.lock`, `config.lock`, a ref's `.lock`) is present. */
      readonly lockFile: boolean;
      /** HEAD is on no branch. */
      readonly detached: boolean;
      /** The working tree has uncommitted or untracked changes. */
      readonly dirty: boolean;
      /** Commits the branch has that its upstream does not (those on no remote, where it has no upstream). */
      readonly ahead: number;
      /** Commits the upstream has that the branch does not. */
      readonly behind: number;
    };

/** The observed state of one repository: exactly one of the ten of `ergonex:RepoState`. */
export type RepoState =
  | { readonly kind: "Missing" }
  | { readonly kind: "Clean" }
  | { readonly kind: "Dirty" }
  | { readonly kind: "Ahead"; readonly commits: number }
  | { readonly kind: "Behind"; readonly commits: number }
  | {
      readonly kind: "Diverged";
      readonly ahead: number;
      readonly behind: number;
    }
  | { readonly kind: "Locked" }
  | { readonly kind: "Detached" }
  | { readonly kind: "WrongRemote"; readonly found: string }
  | { readonly kind: "NotARepo" };

/** The key of a state: the local name of an `ergonex:RepoState`. */
export type RepoStateKind = RepoState["kind"];

/** All the keys, in the order of the code list. */
export const REPO_STATE_KINDS: readonly RepoStateKind[] = [
  "Missing",
  "Clean",
  "Dirty",
  "Ahead",
  "Behind",
  "Diverged",
  "Locked",
  "Detached",
  "WrongRemote",
  "NotARepo",
];

/** The kind of action that is a state's default (`ergonex:defaultAction`): clone where it is missing, fast-forward where it is behind, refuse where it is on the wrong remote or not a repository, skip otherwise. */
export function defaultActionOf(kind: RepoStateKind): "Clone" | "FastForward" | "Skip" | "Refuse" {
  switch (kind) {
    case "Missing":
      return "Clone";
    case "Behind":
      return "FastForward";
    case "WrongRemote":
    case "NotARepo":
      return "Refuse";
    case "Clean":
    case "Dirty":
    case "Ahead":
    case "Diverged":
    case "Locked":
    case "Detached":
      return "Skip";
    default:
      return absurd(kind);
  }
}

/** Whether a state may be fast-forwarded (`ergonex:fastForwardable`): `Behind` alone (0002-workspace-model FR-026). */
export function fastForwardable(kind: RepoStateKind): boolean {
  return kind === "Behind";
}

/** Whether a folder in a state holds work that exists nowhere else (`ergonex:holdsLocalWork`): every state but `Missing`, `Clean` and `Behind` (FR-027). Such a folder is never deleted. */
export function holdsLocalWork(kind: RepoStateKind): boolean {
  switch (kind) {
    case "Missing":
    case "Clean":
    case "Behind":
      return false;
    case "Dirty":
    case "Ahead":
    case "Diverged":
    case "Locked":
    case "Detached":
    case "WrongRemote":
    case "NotARepo":
      return true;
    default:
      return absurd(kind);
  }
}

/** A remote as it may be said in a finding or a plan: the host and the path, never a credential, `(none)` where there is no remote and `(not a remote of a host)` where it is a path or unreadable. */
export function describeRemote(remote: string | undefined): string {
  if (remote === undefined || remote.trim() === "") return "(none)";
  const r = parseRemote(remote);
  return r.kind === "ok" ? describeRef(r.value) : "(not a remote of a host)";
}

/** Whether an observed remote is the repository the manifest names (the same host and path, whatever the scheme). */
export function isExpectedRemote(remote: string | undefined, expected: RepoRef): boolean {
  if (remote === undefined) return false;
  const r = parseRemote(remote);
  return r.kind === "ok" && sameRepository(r.value, expected);
}

/** The one state a repository is in, from what was read of it and the repository the manifest names at its path. */
export function classify(facts: RepoFacts, expected: RepoRef): RepoState {
  switch (facts.kind) {
    case "absent":
      return { kind: "Missing" };
    case "not-a-repository":
      return { kind: "NotARepo" };
    case "repository": {
      if (!isExpectedRemote(facts.remote, expected)) return { kind: "WrongRemote", found: describeRemote(facts.remote) };
      if (facts.lockFile) return { kind: "Locked" };
      if (facts.detached) return { kind: "Detached" };
      if (facts.dirty) return { kind: "Dirty" };
      if (facts.ahead > 0 && facts.behind > 0) return { kind: "Diverged", ahead: facts.ahead, behind: facts.behind };
      if (facts.ahead > 0) return { kind: "Ahead", commits: facts.ahead };
      if (facts.behind > 0) return { kind: "Behind", commits: facts.behind };
      return { kind: "Clean" };
    }
    default:
      return absurd(facts);
  }
}
