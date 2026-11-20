// Spec: 0002-workspace-model FR-021
/**
 * The plan (commons 0002-workspace-model FR-021 to FR-027, FR-029, FR-030): `plan(desired, observed)` is a pure function from what the manifest wants and what was observed to an ordered list of
 * actions, each of one of the ten kinds of `ergonex:ActionKind`. It reads nothing, writes nothing and changes nothing: applying the plan is another layer's work, which observes again before each action.
 *
 * @remarks
 * Fast-forward only: a `FastForward` is planned for a repository that is `Behind` and for no other state, and no action of any kind merges, rebases, resets, forces or removes a repository, a
 * worktree or a folder that holds local work: there is no such action, and `mayRemove` is the guard a layer that removes anything asks first (FR-026, FR-027). A repository in `Dirty`, `Ahead`,
 * `Diverged`, `Locked` or `Detached` is skipped with the reason; one on the wrong remote or not a repository is refused, never overwritten. A generated file is written where it is absent or still
 * the bytes the state record holds, and refused where it was edited by hand. A repository has one action for its state (the state's default) and a `ConfigureRepo` where its local Git
 * configuration differs from the manifest's; a worktree is planned only where another worker or uncommitted work is on the repository (FR-007). A change of the host outside the workspace
 * (`ConfigureHost`, `InstallTool`) is in a plan only for `ergonex setup --apply` (FR-030). The actions are in the order of their paths, folded, so that the same inputs give the same plan.
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import { type Sha256, sha256 } from "@intellectual-frontiers/crypto";
import type { RepoRef } from "@intellectual-frontiers/githost";
import { foldKey } from "./portable.ts";
import { holdsLocalWork, type RepoState } from "./state.ts";
import type { BranchName, RepoPath, Version } from "./types.ts";

/** The repository the manifest names, at its path. */
export type DesiredRepo = {
  readonly path: RepoPath;
  readonly ref: RepoRef;
  /** The URL it is cloned from, with no credential. */
  readonly cloneUrl: string;
  /** The branch to check out when cloning; the remote's default where absent. */
  readonly branch?: BranchName | undefined;
  /** The local Git configuration the policy wants (`core.hooksPath`, the signing settings, the identity); key to value. */
  readonly settings: Readonly<Record<string, string>>;
};

/** A worktree the manifest asks for. */
export type DesiredWorktree = {
  readonly path: RepoPath;
  readonly repo: RepoPath;
  readonly branch: BranchName;
};

/** A generated file the templates give: its path and the SHA-256 of its bytes. */
export type DesiredFile = { readonly path: RepoPath; readonly sha256: Sha256 };

/** A change of the host outside the workspace, which only `ergonex setup --apply` may plan. */
export type HostChange =
  | {
      readonly kind: "ConfigureHost";
      readonly target: string;
      readonly what: string;
    }
  | {
      readonly kind: "InstallTool";
      readonly target: string;
      readonly tool: string;
      readonly version: Version;
    };

/** What the manifest and its templates want. */
export type Desired = {
  readonly repos: readonly DesiredRepo[];
  readonly worktrees: readonly DesiredWorktree[];
  readonly files: readonly DesiredFile[];
  readonly hostChanges: readonly HostChange[];
};

/** What was observed of a repository. */
export type ObservedRepo = {
  readonly state: RepoState;
  /** Its local Git configuration, key to value (only the keys the policy sets need be here). */
  readonly config: Readonly<Record<string, string>>;
  /** Another person or agent is working in it (its own checkout or another worktree is in use). */
  readonly busy: boolean;
};

/** What was observed of a generated file: its bytes on disk and the bytes the state record holds; undefined where there is none. */
export type ObservedFile = {
  readonly onDisk?: Sha256 | undefined;
  readonly recorded?: Sha256 | undefined;
};

/** What was observed of the workspace. A path with no entry is absent. */
export type Observed = {
  readonly repos: Readonly<Record<string, ObservedRepo>>;
  readonly worktrees: Readonly<Record<string, RepoState>>;
  readonly files: Readonly<Record<string, ObservedFile>>;
};

/** Why an action does nothing. */
export type SkipWhy =
  | { readonly kind: "in-sync" }
  | { readonly kind: "uncommitted-changes" }
  | { readonly kind: "ahead"; readonly commits: number }
  | {
      readonly kind: "diverged";
      readonly ahead: number;
      readonly behind: number;
    }
  | { readonly kind: "locked" }
  | { readonly kind: "detached" }
  | { readonly kind: "worktree-unneeded" }
  | { readonly kind: "worktree-exists" }
  | { readonly kind: "base-unavailable"; readonly state: string }
  | { readonly kind: "file-current" }
  | { readonly kind: "file-absent" };

/** Why an action is refused. */
export type RefuseWhy =
  { readonly kind: "wrong-remote"; readonly found: string } | { readonly kind: "not-a-repository" } | { readonly kind: "generated-edited" };

/** A step of a plan, of one of the ten kinds of `ergonex:ActionKind` (`kind` is the key). */
export type Action =
  | {
      readonly kind: "Clone";
      readonly target: RepoPath;
      readonly url: string;
      readonly branch?: BranchName | undefined;
    }
  | {
      readonly kind: "FastForward";
      readonly target: RepoPath;
      readonly commits: number;
    }
  | {
      readonly kind: "CreateWorktree";
      readonly target: RepoPath;
      readonly repo: RepoPath;
      readonly branch: BranchName;
    }
  | {
      readonly kind: "ConfigureRepo";
      readonly target: RepoPath;
      readonly settings: Readonly<Record<string, string>>;
    }
  | {
      readonly kind: "ConfigureHost";
      readonly target: string;
      readonly what: string;
    }
  | {
      readonly kind: "WriteGenerated";
      readonly target: RepoPath;
      readonly sha256: Sha256;
    }
  | { readonly kind: "RemoveGenerated"; readonly target: RepoPath }
  | {
      readonly kind: "InstallTool";
      readonly target: string;
      readonly tool: string;
      readonly version: Version;
    }
  | { readonly kind: "Skip"; readonly target: string; readonly why: SkipWhy }
  | {
      readonly kind: "Refuse";
      readonly target: string;
      readonly why: RefuseWhy;
    };

/** The kind of an action: a key of `ergonex:ActionKind`. */
export type ActionKind = Action["kind"];

/** An ordered list of actions: an `ergonex:Plan`, a plan in the sense of PROV-O. */
export type Plan = { readonly actions: readonly Action[] };

/** Whether an action removes what exists (`ergonex:destructive`): only `RemoveGenerated`. It is carried out only where the run says `--allow-destructive` (FR-029). */
export function isDestructive(action: Action | ActionKind): boolean {
  const kind = typeof action === "string" ? action : action.kind;
  switch (kind) {
    case "RemoveGenerated":
      return true;
    case "Clone":
    case "FastForward":
    case "CreateWorktree":
    case "ConfigureRepo":
    case "ConfigureHost":
    case "WriteGenerated":
    case "InstallTool":
    case "Skip":
    case "Refuse":
      return false;
    default:
      return absurd(kind);
  }
}

/** Whether an action changes the host outside the workspace (`ergonex:hostChange`): `ConfigureHost` and `InstallTool`, which only `ergonex setup --apply` carries out (FR-030). */
export function isHostChange(action: Action | ActionKind): boolean {
  const kind = typeof action === "string" ? action : action.kind;
  switch (kind) {
    case "ConfigureHost":
    case "InstallTool":
      return true;
    case "Clone":
    case "FastForward":
    case "CreateWorktree":
    case "ConfigureRepo":
    case "WriteGenerated":
    case "RemoveGenerated":
    case "Skip":
    case "Refuse":
      return false;
    default:
      return absurd(kind);
  }
}

/** Whether a folder in this state may be removed: never one that holds local work (FR-027). A layer that deletes anything asks this first, with a state it has just observed. */
export function mayRemove(state: RepoState): boolean {
  return !holdsLocalWork(state.kind);
}

/** An action in words, for a person: what will be done, or why not. */
export function describeAction(action: Action): string {
  switch (action.kind) {
    case "Clone":
      return `clone ${action.url} into ${action.target}`;
    case "FastForward":
      return `fast-forward ${action.target} by ${action.commits} commit${action.commits === 1 ? "" : "s"}`;
    case "CreateWorktree":
      return `add a worktree of ${action.repo} for ${action.branch} at ${action.target}`;
    case "ConfigureRepo":
      return `set ${Object.keys(action.settings).sort().join(", ")} in the local Git configuration of ${action.target}`;
    case "ConfigureHost":
      return `change the host: ${action.what}`;
    case "WriteGenerated":
      return `write the generated file ${action.target}`;
    case "RemoveGenerated":
      return `remove the generated file ${action.target}`;
    case "InstallTool":
      return `install ${action.tool} ${action.version}`;
    case "Skip":
      return `skip ${action.target}: ${describeSkip(action.why)}`;
    case "Refuse":
      return `refuse ${action.target}: ${describeRefusal(action.why)}`;
    default:
      return absurd(action);
  }
}

/** A reason for skipping, as one sentence. */
export function describeSkip(why: SkipWhy): string {
  switch (why.kind) {
    case "in-sync":
      return "it is up to date";
    case "uncommitted-changes":
      return "it has uncommitted changes, which are never touched";
    case "ahead":
      return `it has ${why.commits} commit${why.commits === 1 ? "" : "s"} its remote does not`;
    case "diverged":
      return `it has ${why.ahead} commit${why.ahead === 1 ? "" : "s"} its remote does not and the remote has ${why.behind} it does not; only a person merges`;
    case "locked":
      return "a Git lock file is there, so another process may be working in it; the lock is not removed";
    case "detached":
      return "HEAD is on no branch";
    case "worktree-unneeded":
      return "nobody else is working in the repository and it has no uncommitted work, so its own checkout is the place to work";
    case "worktree-exists":
      return "the worktree is there";
    case "base-unavailable":
      return `its repository is ${why.state}`;
    case "file-current":
      return "its bytes are the generated ones";
    case "file-absent":
      return "it is not there and is not wanted";
    default:
      return absurd(why);
  }
}

/** A reason for refusing, as one sentence. */
export function describeRefusal(why: RefuseWhy): string {
  switch (why.kind) {
    case "wrong-remote":
      return `a repository of ${why.found} is at that path, not the one the manifest names, and it is never overwritten`;
    case "not-a-repository":
      return "something that is not a Git repository is at that path, and it is never overwritten";
    case "generated-edited":
      return "its bytes are not the ones the state record holds, so it was edited by hand; `--force` replaces it";
    default:
      return absurd(why);
  }
}

/** The action a repository's state calls for: its default (`ergonex:defaultAction`). */
function forState(repo: DesiredRepo, state: RepoState): Action {
  const target = repo.path;
  switch (state.kind) {
    case "Missing":
      return { kind: "Clone", target, url: repo.cloneUrl, branch: repo.branch };
    case "Behind":
      return { kind: "FastForward", target, commits: state.commits };
    case "Clean":
      return { kind: "Skip", target, why: { kind: "in-sync" } };
    case "Dirty":
      return { kind: "Skip", target, why: { kind: "uncommitted-changes" } };
    case "Ahead":
      return {
        kind: "Skip",
        target,
        why: { kind: "ahead", commits: state.commits },
      };
    case "Diverged":
      return {
        kind: "Skip",
        target,
        why: { kind: "diverged", ahead: state.ahead, behind: state.behind },
      };
    case "Locked":
      return { kind: "Skip", target, why: { kind: "locked" } };
    case "Detached":
      return { kind: "Skip", target, why: { kind: "detached" } };
    case "WrongRemote":
      return {
        kind: "Refuse",
        target,
        why: { kind: "wrong-remote", found: state.found },
      };
    case "NotARepo":
      return { kind: "Refuse", target, why: { kind: "not-a-repository" } };
    default:
      return absurd(state);
  }
}

/** Whether a repository in this state takes a setting in its local configuration (or will, once it is cloned). */
function takesConfiguration(state: RepoState): boolean {
  switch (state.kind) {
    case "Missing":
    case "Clean":
    case "Dirty":
    case "Ahead":
    case "Behind":
    case "Diverged":
    case "Detached":
      return true;
    case "Locked":
    case "WrongRemote":
    case "NotARepo":
      return false;
    default:
      return absurd(state);
  }
}

const ABSENT: ObservedRepo = {
  state: { kind: "Missing" },
  config: {},
  busy: false,
};

const byPath = <T extends { readonly path: string }>(a: T, b: T): number =>
  foldKey(a.path) < foldKey(b.path) ? -1 : foldKey(a.path) > foldKey(b.path) ? 1 : a.path < b.path ? -1 : a.path > b.path ? 1 : 0;

/** What a plan is made under. */
export type PlanOptions = {
  /** True only for `ergonex setup --apply`: the only run whose plan may hold a change of the host (FR-030). */
  readonly setupApply?: boolean;
};

/** The settings of a repository that differ from its observed configuration, or undefined where none does. */
function settingsToSet(repo: DesiredRepo, observed: ObservedRepo): Readonly<Record<string, string>> | undefined {
  const diff: Record<string, string> = {};
  for (const key of Object.keys(repo.settings).sort()) {
    const want = repo.settings[key];
    if (want !== undefined && observed.config[key] !== want) diff[key] = want;
  }
  return Object.keys(diff).length === 0 ? undefined : diff;
}

/**
 * The plan from what the manifest wants and what was observed. Pure: it reads and writes nothing and never mutates its arguments; the same arguments give the same plan, its actions in the order of
 * their paths (repositories, then worktrees, then generated files, then the changes of the host a setup run may hold).
 */
export function plan(desired: Desired, observed: Observed, options: PlanOptions = {}): Plan {
  const actions: Action[] = [];

  for (const repo of [...desired.repos].sort(byPath)) {
    const seen = Object.hasOwn(observed.repos, repo.path) ? (observed.repos[repo.path] ?? ABSENT) : ABSENT;
    actions.push(forState(repo, seen.state));
    const settings = takesConfiguration(seen.state) ? settingsToSet(repo, seen) : undefined;
    if (settings !== undefined) actions.push({ kind: "ConfigureRepo", target: repo.path, settings });
  }

  for (const wt of [...desired.worktrees].sort(byPath)) {
    const there = Object.hasOwn(observed.worktrees, wt.path) ? observed.worktrees[wt.path] : undefined;
    if (there !== undefined && there.kind !== "Missing") {
      actions.push({
        kind: "Skip",
        target: wt.path,
        why: { kind: "worktree-exists" },
      });
      continue;
    }
    const base = Object.hasOwn(observed.repos, wt.repo) ? (observed.repos[wt.repo] ?? ABSENT) : ABSENT;
    switch (base.state.kind) {
      case "Missing":
        // the repository is cloned by this very plan: a fresh checkout has no one else in it and no work
        actions.push({
          kind: "Skip",
          target: wt.path,
          why: { kind: "worktree-unneeded" },
        });
        break;
      case "Locked":
      case "WrongRemote":
      case "NotARepo":
        actions.push({
          kind: "Skip",
          target: wt.path,
          why: { kind: "base-unavailable", state: base.state.kind },
        });
        break;
      case "Dirty":
        actions.push({
          kind: "CreateWorktree",
          target: wt.path,
          repo: wt.repo,
          branch: wt.branch,
        });
        break;
      case "Clean":
      case "Ahead":
      case "Behind":
      case "Diverged":
      case "Detached":
        actions.push(
          base.busy
            ? {
                kind: "CreateWorktree",
                target: wt.path,
                repo: wt.repo,
                branch: wt.branch,
              }
            : {
                kind: "Skip",
                target: wt.path,
                why: { kind: "worktree-unneeded" },
              },
        );
        break;
      default:
        return absurd(base.state);
    }
  }

  const wanted = new Set(desired.files.map((f) => f.path as string));
  const files: Action[] = [];
  for (const f of desired.files) {
    const seen = Object.hasOwn(observed.files, f.path) ? (observed.files[f.path] ?? {}) : {};
    if (seen.onDisk === f.sha256)
      files.push({
        kind: "Skip",
        target: f.path,
        why: { kind: "file-current" },
      });
    else if (seen.onDisk === undefined || seen.onDisk === seen.recorded)
      files.push({ kind: "WriteGenerated", target: f.path, sha256: f.sha256 });
    else
      files.push({
        kind: "Refuse",
        target: f.path,
        why: { kind: "generated-edited" },
      });
  }
  for (const [path, seen] of Object.entries(observed.files)) {
    if (wanted.has(path) || seen.recorded === undefined) continue;
    // no longer generated: removed only where it is still the bytes the record holds (FR-027); a path is a RepoPath where it comes from the record
    const target = path as RepoPath;
    if (seen.onDisk === undefined) files.push({ kind: "Skip", target, why: { kind: "file-absent" } });
    else if (seen.onDisk === seen.recorded) files.push({ kind: "RemoveGenerated", target });
    else files.push({ kind: "Refuse", target, why: { kind: "generated-edited" } });
  }
  actions.push(...files.sort((a, b) => (foldKey(a.target) < foldKey(b.target) ? -1 : foldKey(a.target) > foldKey(b.target) ? 1 : 0)));

  if (options.setupApply === true) for (const c of desired.hostChanges) actions.push({ ...c });
  return { actions };
}

/** The SHA-256 of a plan: of its actions as JSON, in order. The same plan has the same hash; the evidence of a run names it (0002-workspace-model FR-042). */
export async function planDigest(p: Plan): Promise<Sha256> {
  return await sha256(JSON.stringify(p.actions));
}

/** Whether a plan changes nothing: every action is a `Skip` (FR-025). */
export function isSettled(p: Plan): boolean {
  return p.actions.every((a) => a.kind === "Skip");
}
