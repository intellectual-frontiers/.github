// Spec: 0001-anyfs-githost-layers FR-001
/**
 * The physical layer of the Git host stores of AnyFS: the store of a branch on GitHub or GitLab, the REST clients of the two hosts and the table of their failures.
 *
 * @module
 */
export type { ApiProblem, BranchFacts, Committed, CommitRequest, FileChange, HostApi, Located, LogItem, RepoFacts, TreeEntry } from "./api.ts";
export { gitBlobId, isBlob, revisionOf } from "./blob.ts";
export { describeApiProblem, problemOf } from "./errors.ts";
export { githubApi, type GithubApiOptions } from "./github.ts";
export { gitlabApi, type GitlabApiOptions } from "./gitlab.ts";
export { type Call, makeCaller, type Reply, type Request } from "./http.ts";
export { type GithubOptions, type GithubPlace, type GitlabOptions, type GitlabPlace, type HostOptions, openGithubStore, openGitlabStore } from "./hosts.ts";
export {
  type CommitOptions,
  HOST_CAPABILITIES,
  HOST_READ_CAPABILITIES,
  type HostFacts,
  type HostReadStore,
  type HostRef,
  type HostStore,
  type HostStoreOptions,
  type LogEntry,
  type ObjectInfo,
  type OpenedHost,
  openHostStore,
} from "./store.ts";
