/**
 * The strict mode of the `changes` check (commons 0020-ifccm FR-009, FR-028, FR-030): ask a Git host, through the one interface of `githost/types.ts`, for each change request the commits
 * name, and say what the host answered so that `rules.ts` can judge it. Nothing in this file names a host's API, URL or word.
 *
 * @remarks
 * The client is an argument and is never made here: the command is given one by whoever wires the adapters. Where there is no client, or the host is plain Git (it has no tracker), or the host
 * cannot be asked (unreachable, unauthorized, rate limited), the strict cases are `not_run` with the reason, never passed (FR-030). A reference to another repository (`owner/repo#N`) is asked of the
 * same host, in that repository.
 *
 * @limits
 * It asks about issues only; a pull request or a merge request is read as part of a change, never as a change request (FR-029), and `#N` means the issue.
 *
 * @example
 * ```ts
 * import { askHost } from "./strict.ts";
 * // const outcome = await askHost(client, { kind: "Github", host: "github.com", path: ["owner", "repo"] }, commits);
 * ```
 *
 * @module
 */
import { describeFailure, type GitHostClient, type RepoRef } from "../../githost/types.ts";
import { namedIssues, parseMessage } from "./commit-message.ts";
import type { CommitFacts, IssueAnswer } from "./rules.ts";

/** What the host said of every change request the commits name, and why some could not be asked. */
export type StrictOutcome = {
  /** Each named change request (`owner/repo#N` or `#N`) and the answer. */
  readonly answers: ReadonlyMap<string, IssueAnswer>;
  /** Set where the strict rules were not run, or not run for every reference: why. */
  readonly notRun: string | undefined;
};

/** The reason a strict run does not happen where the host is plain Git (0020-ifccm FR-030). */
export const NO_HOST_API = "there is no host API: the repository is on plain Git, which has no tracker to ask";

/** The reason where no client was given. */
export const NO_CLIENT = "no Git host client was given to the check, so the host was not asked";

/** The repository a reference names: the one it is `owner/repo` of, on the same host as `home`, or `home` itself. */
function repoOf(home: RepoRef, named: string): RepoRef {
  const slash = named.indexOf("#");
  const repo = named.slice(0, slash);
  if (repo === "") return home;
  return { kind: home.kind, host: home.host, path: repo.split("/") };
}

/** Ask the host for each change request the commits name (0020-ifccm FR-009), each once. */
export async function askHost(client: GitHostClient | undefined, home: RepoRef, commits: readonly CommitFacts[]): Promise<StrictOutcome> {
  const answers = new Map<string, IssueAnswer>();
  if (client === undefined) return { answers, notRun: NO_CLIENT };
  if (client.kind === "Git" || !client.capabilities.has("Issues")) return { answers, notRun: NO_HOST_API };
  const wanted = [...new Set(commits.flatMap((c) => namedIssues(parseMessage(c.message))))];
  const reasons: string[] = [];
  for (const id of wanted) {
    const number = Number(id.slice(id.indexOf("#") + 1));
    const r = await client.issue(repoOf(home, id), number);
    if (r.kind === "ok") answers.set(id, { kind: "found", issue: r.value });
    else if (r.error.kind === "not-found") answers.set(id, { kind: "missing" });
    else {
      const reason = `${id}: ${describeFailure(r.error)}`;
      reasons.push(reason);
      answers.set(id, { kind: "not_run", reason });
    }
  }
  return {
    answers,
    notRun:
      reasons.length === 0
        ? undefined
        : `the host could not answer for ${reasons.length} of ${wanted.length} references (${reasons[0] ?? ""})`,
  };
}
