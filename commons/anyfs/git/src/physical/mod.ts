// Spec: 0001-git-layers FR-001
/**
 * The physical layer of the Git stores of AnyFS: the store of a branch and the store of a working tree, each through Git's own commands.
 *
 * @module
 */
export { failure, type Git, openGit } from "./git.ts";
export { type Entry, isRegular } from "./objects.ts";
export {
  type CommitOptions,
  GIT_REF_CAPABILITIES,
  type GitRef,
  type GitRefOptions,
  type GitRefStore,
  gitRefStore,
  type LogEntry,
  type ObjectInfo,
} from "./ref/mod.ts";
export { type Fetched, type Pushed, type RemoteProblem, remoteProblem } from "./ref/remote.ts";
export {
  type Committed,
  type CommitRequest,
  type DirtyPolicy,
  GIT_WORKTREE_CAPABILITIES,
  type GitWorktree,
  type GitWorktreeOptions,
  type GitWorktreeStore,
  gitWorktreeStore,
  type TreeChange,
  type WorktreeProblem,
} from "./worktree/mod.ts";
