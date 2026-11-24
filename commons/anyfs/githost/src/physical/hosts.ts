// Spec: 0002-anyfs-githost-store FR-003, FR-004, FR-006
/**
 * The two ways to open the store of a branch: `openGithubStore` for a place `github://owner/repo@branch/prefix` and `openGitlabStore` for `gitlab://host/group/subgroup/project@branch/prefix`. Each makes the request caller of its host
 * (the token in the header the host reads it from, on the API of `github.com` or of the endpoint named, `https://<host>/api/v4` for GitLab), the client of the host's API, and the store over it. The token comes from a source and is
 * asked for again at each request, so a short-lived token is fresh and a person is asked once; it is in no place, URL, result or sentence. A branch left out of the place is the default branch of the repository.
 *
 * @example
 * ```ts
 * import { openGithubStore, staticToken, parseIdentity } from "@intellectual-frontiers/anyfs-githost";
 * // const opened = await openGithubStore({ place, token, commit: { author } });
 * // opened.kind === "ok" && opened.value.mode; // "writable" where the token may push
 * ```
 *
 * @module
 */
import { err, type Result } from "@intellectual-frontiers/core";
import { liveTransport, type Transport } from "@intellectual-frontiers/net/http-client";
import type { Place } from "@intellectual-frontiers/anyfs/governance";
import { cachedToken, redactor, type TokenSource } from "@intellectual-frontiers/anyfs-githost/governance";
import type { HostApi } from "./api.ts";
import { githubApi } from "./github.ts";
import { gitlabApi } from "./gitlab.ts";
import { type Call, makeCaller } from "./http.ts";
import { type CommitOptions, type HostStoreOptions, openHostStore, type OpenedHost } from "./store.ts";

/** The place of a store on GitHub. */
export type GithubPlace = Extract<Place, { readonly kind: "github" }>;
/** The place of a store on GitLab. */
export type GitlabPlace = Extract<Place, { readonly kind: "gitlab" }>;

/** What both hosts are opened with. */
export type HostOptions = {
  readonly token: TokenSource;
  readonly commit: CommitOptions;
  /** How requests are sent: the live transport where left out; a test gives its own. */
  readonly transport?: Transport;
  /** The branch a branch that does not exist is started from. */
  readonly createFrom?: string;
  readonly maxObjectBytes?: number;
  readonly portable?: boolean;
  readonly attempts?: number;
  readonly listConcurrency?: number;
  /** How long a request may take, in seconds: 30 where left out. */
  readonly timeoutSeconds?: number;
  /** The clock in milliseconds, for the wait a host's reset time asks for. */
  readonly clock?: () => number;
};

/** What a store on GitHub is made with. */
export type GithubOptions = HostOptions & {
  readonly place: GithubPlace;
  /** The base of the API: `https://api.github.com` where left out, `https://<host>/api/v3` for GitHub Enterprise Server. */
  readonly endpoint?: string;
};

/** What a store on GitLab is made with. */
export type GitlabOptions = HostOptions & {
  readonly place: GitlabPlace;
  /** The address of the server without the API path: `https://<host of the place>` where left out. */
  readonly endpoint?: string;
  /** What the token is: a personal or project access token (the default) or the token of a CI job. */
  readonly tokenKind?: "access" | "job";
};

const trimEnd = (u: string): string => u.replace(/\/+$/u, "");

/** The caller of a host, and the redactor of the tokens it has been given. */
function callerOf(options: HostOptions, base: string, accept: string, authorize: (token: string) => Readonly<Record<string, string>>, extra: Readonly<Record<string, string>> = {}): { readonly call: Call; readonly redact: (text: string) => string } {
  const asked = cachedToken(options.token);
  const seen = new Set<string>();
  const redact = (text: string): string => redactor([...seen])(text);
  const call = makeCaller({
    transport: options.transport ?? liveTransport({ credentials: "allow", userAgent: "anyfs-githost", ...(options.timeoutSeconds === undefined ? {} : { timeoutSeconds: options.timeoutSeconds }) }),
    base,
    accept,
    authorize,
    extraHeaders: extra,
    token: async () => {
      const t = await asked();
      if (t.kind === "ok" && t.value !== undefined) seen.add(t.value);
      return t;
    },
    redact,
    ...(options.clock === undefined ? {} : { clock: options.clock }),
  });
  return { call, redact };
}

async function open(api: HostApi, place: Place, branch: string | undefined, options: HostOptions, redact: (t: string) => string, prefix: HostStoreOptions["prefix"]): Promise<Result<OpenedHost, string>> {
  let name = branch;
  if (name === undefined) {
    const repo = await api.repo();
    if (repo.kind === "err") return err(redact(`${api.describe}: the repository could not be read (${repo.error.kind})`));
    name = repo.value.defaultBranch;
    if (name === undefined) return err(`${api.describe} has no default branch: it is empty, or the place names no branch`);
  }
  return openHostStore({
    api,
    place,
    branch: name,
    commit: options.commit,
    redact,
    ...(prefix === undefined ? {} : { prefix }),
    ...(options.createFrom === undefined ? {} : { createFrom: options.createFrom }),
    ...(options.maxObjectBytes === undefined ? {} : { maxObjectBytes: options.maxObjectBytes }),
    ...(options.portable === undefined ? {} : { portable: options.portable }),
    ...(options.attempts === undefined ? {} : { attempts: options.attempts }),
    ...(options.listConcurrency === undefined ? {} : { listConcurrency: options.listConcurrency }),
  });
}

/** The store of a branch of a repository on GitHub, or why there is none. */
export async function openGithubStore(options: GithubOptions): Promise<Result<OpenedHost, string>> {
  const base = trimEnd(options.endpoint ?? "https://api.github.com");
  const { call, redact } = callerOf(options, base, "application/vnd.github+json", (t) => ({ authorization: `Bearer ${t}` }), { "x-github-api-version": "2022-11-28" });
  const api = githubApi({ call, owner: options.place.owner, repo: options.place.repo });
  return open(api, options.place, options.place.ref, options, redact, options.place.prefix);
}

/** The store of a branch of a project on GitLab, or why there is none. */
export async function openGitlabStore(options: GitlabOptions): Promise<Result<OpenedHost, string>> {
  const server = trimEnd(options.endpoint ?? `https://${options.place.host}`);
  const kind = options.tokenKind ?? "access";
  const { call, redact } = callerOf(options, `${server}/api/v4`, "application/json", (t) => (kind === "job" ? { "job-token": t } : { "private-token": t }));
  const api = gitlabApi({ call, project: options.place.project, host: options.place.host });
  return open(api, options.place, options.place.ref, options, redact, options.place.prefix);
}
