/**
 * The Git hosts behind one interface (commons 0020-ifccm FR-039 to FR-044, 0020-ifccm FR-027 to FR-030): GitHub, GitLab (groups to any depth, `gitlab.com` or self-managed) and plain
 * Git, shaped together as `GitHostClient`, with the reading of a remote URL, the table of what each kind offers and `clientFor`, the one place that reads a credential.
 *
 * @remarks
 * `clientFor(ref, { env })` chooses the adapter by the kind of the reference and reads a token from `env` alone (`GITHUB_TOKEN`, then `GH_TOKEN` for GitHub; `GITLAB_TOKEN`, then
 * `CI_JOB_TOKEN` for GitLab): the caller passes its environment, so that this code reads none itself. The token is held in the adapter's closure and nowhere else; it is never in a result, a
 * failure, a URL or a log, and the live transport it makes sends it only to the host the client serves.
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import { liveTransport, type Transport, withBackoff } from "../runtime/http-client.ts";
import { githubClient } from "./github.ts";
import { plainGitClient, type PlainGitOptions } from "./git.ts";
import { gitlabClient } from "./gitlab.ts";
import { usableToken } from "./http.ts";
import type { GitHostClient, RepoRef } from "./types.ts";

export { CAPABILITIES, COMMON_CAPABILITIES, maxDepth, supports, unsupported } from "./capabilities.ts";
export { githubClient, type GithubOptions } from "./github.ts";
export { defaultBranchOf, plainGitClient, type PlainGitOptions } from "./git.ts";
export { gitlabClient, type GitlabOptions } from "./gitlab.ts";
export {
  cloneUrlOf,
  describeRef,
  describeRemoteError,
  hostKindOf,
  type HostKinds,
  parseRemote,
  readRemote,
  type ReadRemote,
  type RemoteError,
  sameRepository,
} from "./remote.ts";
export {
  type BranchProtection,
  type Capability,
  type ChangeRequestInfo,
  describeFailure,
  type GitHostClient,
  type HostFailure,
  type HostKind,
  type HostResult,
  type IssueInfo,
  type RepoInfo,
  type RepoRef,
  type Visibility,
} from "./types.ts";

/** What `clientFor` reads and uses. */
export type ClientForOptions = {
  /** The caller's environment: where the token is read from, and nowhere else. */
  readonly env: Readonly<Record<string, string | undefined>>;
  /** How requests are sent; the live transport (with backoff, and a credential allowed only where a token is given) by default. */
  readonly transport?: Transport;
  /** For a plain Git remote: where it is asked from and where a clone is. */
  readonly plain?: PlainGitOptions;
  /**
   * The hosts, besides `github.com` and `gitlab.com`, that may be sent a token: those the manifest names (a self-managed GitLab, GitHub Enterprise Server). A host not here is asked with no
   * credential, so that an environment's token is never sent to a host nobody named.
   */
  readonly trustedHosts?: readonly string[];
  /** The base URL of a self-managed GitLab, where the reference's host is not `gitlab.com` and is not served over `https://<host>`. */
  readonly gitlabBaseUrl?: string;
  /** The API's base URL of a GitHub Enterprise Server host, where it is not `https://<host>/api/v3`. */
  readonly githubApiBase?: string;
};

const first = (env: ClientForOptions["env"], names: readonly string[]): string | undefined => {
  for (const n of names) {
    const v = usableToken(env[n]);
    if (v !== undefined) return v;
  }
  return undefined;
};

/** The client for a reference's kind of host, with the token the environment holds for it, if any and if the host may receive one. */
export function clientFor(ref: RepoRef, options: ClientForOptions): GitHostClient {
  const host = ref.host.toLowerCase();
  const mayHoldToken = host === "github.com" || host === "gitlab.com" || (options.trustedHosts ?? []).some((h) => h.toLowerCase() === host);
  const transportFor = (token: string | undefined): Transport =>
    options.transport ?? withBackoff(liveTransport({ credentials: token === undefined ? "refuse" : "allow", userAgent: "ifc-githost" }));
  switch (ref.kind) {
    case "Github": {
      const token = mayHoldToken ? first(options.env, ["GITHUB_TOKEN", "GH_TOKEN"]) : undefined;
      return githubClient({
        transport: transportFor(token),
        token,
        host,
        ...(options.githubApiBase === undefined ? {} : { apiBase: options.githubApiBase }),
      });
    }
    case "Gitlab": {
      const access = mayHoldToken ? first(options.env, ["GITLAB_TOKEN"]) : undefined;
      const job = access === undefined && mayHoldToken ? first(options.env, ["CI_JOB_TOKEN"]) : undefined;
      const token = access ?? job;
      return gitlabClient({
        transport: transportFor(token),
        token,
        tokenKind: job === undefined ? "access" : "job",
        baseUrl: options.gitlabBaseUrl ?? `https://${host}`,
      });
    }
    case "Git":
      return plainGitClient(options.plain);
    default:
      return absurd(ref.kind);
  }
}
