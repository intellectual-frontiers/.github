/**
 * Plain Git behind the one interface (commons 0023-if-workspaces FR-015 to FR-017): any Git remote that is not GitHub or GitLab, read by running `git`. It answers the four common
 * capabilities (the clone URL, credentials, the default branch and whether a commit's signature verifies) and returns `unsupported` for the rest: protected branches, issues and change
 * requests are what a host adds, and plain Git has none.
 *
 * @remarks
 * A remote is asked with `git ls-remote --symref`, so its own credential helper authenticates and no terminal prompt is ever shown (`GIT_TERMINAL_PROMPT=0`); this adapter holds no
 * credential and writes none. A signature is read from a clone that the caller names (`localOf`), by `git log --format=%G?`, with the user's own Git configuration (the key's `allowedSignersFile`
 * for an SSH signature, the keyring for an OpenPGP one): the commit is verified where Git says `G`.
 *
 * @limits Visibility is `unknown`, and `archived` is `false`: a plain remote says neither. A path of more than two segments is `unsupported` (`NestedGroups`), as on GitHub.
 *
 * @module
 */
import { err, ok, type Result } from "../kernel/result.ts";
import { NotFound } from "../runtime/errors.ts";
import { output } from "../runtime/proc.ts";
import { CAPABILITIES, unsupported } from "./capabilities.ts";
import { cloneUrlOf, describeRef } from "./remote.ts";
import type { GitHostClient, HostFailure, HostResult, RepoInfo, RepoRef } from "./types.ts";

/** How a plain Git client is made. */
export type PlainGitOptions = {
  /** The program (`git` on the path by default). */
  readonly program?: string;
  /** The URL or path a repository is asked from; its HTTPS clone URL by default. Never one with a credential in it. */
  readonly remoteOf?: (ref: RepoRef) => string;
  /** A clone of the repository on this computer, where the signature of a commit can be read; none by default (a signature is then `not-found`). */
  readonly localOf?: (ref: RepoRef) => string | undefined;
  /** Variables added to `git`'s environment (a test points `GIT_CONFIG_GLOBAL` at its own file; nothing here may be a credential). */
  readonly env?: Readonly<Record<string, string>>;
};

const ENV: Readonly<Record<string, string>> = { GIT_TERMINAL_PROMPT: "0", GIT_PAGER: "cat", LC_ALL: "C", LANGUAGE: "C" };

type Ran = { readonly code: number; readonly stdout: string; readonly stderr: string };

async function git(program: string, args: readonly string[], env: Readonly<Record<string, string>>): Promise<Result<Ran, HostFailure>> {
  try {
    const r = await output([program, "--no-pager", ...args], { env: { ...ENV, ...env } });
    const dec = new TextDecoder();
    return ok({ code: r.code, stdout: dec.decode(r.stdout), stderr: dec.decode(r.stderr).trim() });
  } catch (e) {
    if (e instanceof NotFound) return err({ kind: "unreachable", reason: `${program} is not installed (or not on the path)` });
    return err({ kind: "unreachable", reason: e instanceof Error ? e.message : String(e) });
  }
}

/** What git said, on one line and with any `user:secret@` in a URL taken out. */
function said(stderr: string): string {
  return (stderr.split("\n").find((l) => l.trim() !== "") ?? "").replace(/(\w+:\/\/)[^/@\s]*@/g, "$1").slice(0, 200);
}

/** A failed `git ls-remote` as the host's refusal it is. */
function remoteFailure(what: string, r: Ran): HostFailure {
  const s = r.stderr;
  if (
    /Authentication failed|could not read (?:Username|Password)|terminal prompts disabled|Permission denied|HTTP Basic: Access denied|returned error: 40[13]/i.test(
      s,
    )
  ) {
    return { kind: "unauthorized", reason: `the remote asks for a credential and Git has none (${said(s)})` };
  }
  if (/not found|does not appear to be a git repository|returned error: 404|Could not read from remote repository/i.test(s)) {
    return { kind: "not-found", what };
  }
  if (/Could not resolve host|Failed to connect|Connection (?:refused|timed out|reset)|unable to access|Network is unreachable/i.test(s)) {
    return { kind: "unreachable", reason: said(s) };
  }
  return { kind: "unexpected", status: r.code, reason: said(s) === "" ? `git exited ${r.code}` : said(s) };
}

/** The branch a `git ls-remote --symref <url> HEAD` says HEAD points to: empty where it says none (an empty repository). */
export function defaultBranchOf(lsRemote: string): string {
  for (const line of lsRemote.split("\n")) {
    const m = /^ref:\s+refs\/heads\/(\S+)\s+HEAD$/.exec(line.trim());
    if (m?.[1] !== undefined) return m[1];
  }
  return "";
}

/** A plain Git client: the common four capabilities, and `unsupported` for protected branches, issues and change requests. */
export function plainGitClient(options: PlainGitOptions = {}): GitHostClient {
  const program = options.program ?? "git";
  const env = options.env ?? {};

  async function repository(ref: RepoRef): Promise<HostResult<RepoInfo>> {
    if (ref.path.length > 2) return unsupported("Git", "NestedGroups");
    const url = options.remoteOf?.(ref) ?? cloneUrlOf(ref);
    const r = await git(program, ["ls-remote", "--symref", "--", url, "HEAD"], env);
    if (r.kind === "err") return r;
    if (r.value.code !== 0) return err(remoteFailure(`repository ${describeRef(ref)}`, r.value));
    return ok({ ref, visibility: "unknown", defaultBranch: defaultBranchOf(r.value.stdout), cloneUrl: cloneUrlOf(ref), archived: false });
  }

  async function commitVerified(ref: RepoRef, sha: string): Promise<HostResult<boolean>> {
    const what = `commit ${sha.slice(0, 12)} of ${describeRef(ref)}`;
    const folder = options.localOf?.(ref);
    if (folder === undefined)
      return err({ kind: "not-found", what: `${what} (plain Git can check a signature only in a clone on this computer)` });
    if (!/^[0-9a-fA-F]{4,64}$/.test(sha)) return err({ kind: "not-found", what });
    const r = await git(program, ["-C", folder, "log", "-1", "--format=%G?", `${sha}^{commit}`, "--"], env);
    if (r.kind === "err") return r;
    if (r.value.code !== 0) return err({ kind: "not-found", what });
    return ok(r.value.stdout.trim() === "G");
  }

  return {
    kind: "Git",
    capabilities: CAPABILITIES.Git,
    repository,
    issue: () => Promise.resolve(unsupported("Git", "Issues")),
    changeRequest: () => Promise.resolve(unsupported("Git", "ChangeRequests")),
    branchProtection: () => Promise.resolve(unsupported("Git", "ProtectedBranches")),
    commitVerified,
  };
}
