/**
 * IF Workspaces, the pure core (commons 0023-if-workspaces, 0024-ifws-host): the managed place on a computer where the repositories of Intellectual Frontiers live. This module is rung 10 of the
 * ladder, the environment the other rungs are worked in (0016-ladder), and no rung below it imports it. Built here: the branded types (`GitHost`, `RepoPath`, `PortableSegment`, `BranchName`, `Sha`,
 * `Version`), the layout from a remote to a path and back, the portability of a path on Linux, macOS and Windows, the typed manifest, the state of a repository and its classification, the plan
 * as a pure function, the findings with their severities and SARIF, and the policy. The three Git host adapters are in `../githost/`. The command (`ifws`), its apply, the generated files, the
 * tools and the policy scans are other milestones' work.
 *
 * @remarks
 * Everything here but `host/` is pure: no file, no process, no clock, no environment; each takes what it needs as an argument. `host/observe.ts` is the one file that runs `git`, and it only reads.
 *
 * @module
 */
export {
  type Action,
  type ActionKind,
  type Desired,
  type DesiredFile,
  type DesiredRepo,
  type DesiredWorktree,
  describeAction,
  describeRefusal,
  describeSkip,
  type HostChange,
  isDestructive,
  isHostChange,
  isSettled,
  mayRemove,
  type Observed,
  type ObservedFile,
  type ObservedRepo,
  plan,
  type Plan,
  planDigest,
  type PlanOptions,
  type RefuseWhy,
  type SkipWhy,
} from "./plan.ts";
export {
  checkPathLength,
  child,
  type Collision,
  collisions,
  describePortableError,
  foldKey,
  MAX_SEGMENT_BYTES,
  nativePath,
  type PathTooLong,
  type PortableError,
  repoPath,
  segment,
  segmentsOf,
  WINDOWS_PATH_LIMIT,
} from "./portable.ts";
export {
  describeLayoutError,
  gitHostOf,
  homeOf,
  type HomeError,
  type HomeFacts,
  type LayoutError,
  refOfPath,
  repoPathOf,
  slugOf,
  WORKSPACE_FOLDERS,
  worktreePathOf,
  worktreeWanted,
  type WorktreeFacts,
} from "./layout.ts";
export {
  decodeManifest,
  hostKindIn,
  issueFinding,
  type Manifest,
  type ManifestIssue,
  type ManifestRepo,
  type ManifestWorktree,
} from "./manifest.ts";
export {
  classify,
  defaultActionOf,
  describeRemote,
  fastForwardable,
  holdsLocalWork,
  isExpectedRemote,
  REPO_STATE_KINDS,
  type RepoFacts,
  type RepoState,
  type RepoStateKind,
} from "./state.ts";
export {
  daysBetween,
  dayNumber,
  exitStatusOf,
  type Finding,
  firstSeenOf,
  sarifLevel,
  type SarifLog,
  type Severity,
  SEVERITIES,
  toSarif,
  UNAPPROVED_GRACE_DAYS,
  unapprovedSeverity,
  worst,
} from "./findings.ts";
export {
  hookFailsWhenUnableToCheck,
  hostAllowed,
  isRegulated,
  type Policy,
  policyOf,
  type PolicyInput,
  unsignedCommitSeverity,
} from "./policy.ts";
export {
  type BranchName,
  branchName,
  type BrandError,
  describeBrandError,
  type GitHost,
  gitHost,
  type PortableSegment,
  type RepoPath,
  type Sha,
  sha,
  type Version,
  version,
} from "./types.ts";
