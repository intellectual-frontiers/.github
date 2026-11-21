// Spec: 0005-repoctl-library-commit-doctor FR-004
/**
 * `repoctl commit` (commons repoctl 0005-repoctl-library-commit-doctor FR-004 to FR-007): the commit of this repository, made one way. The author and the committer are the identity of the repository's configuration, the message is the subject and then the trailers the configuration lists (the reference to an issue,
 * the line that credits the agent, the session) on their own lines, files that must not be committed (the local folder of an agent, installed packages, files that look like secrets) are refused by their paths and by what they say,
 * and the generated files are checked first (before anything is staged), so that no commit leaves one stale. Pure where it can be: the message and the refusals are functions of their inputs.
 *
 * @example
 * ```ts
 * import { DEFAULT_ALLOWED_PATHS, DEFAULT_FORBIDDEN_PATHS } from "@intellectual-frontiers/repoctl/governance";
 * import { forbidden, messageOf } from "./commit.ts";
 * forbidden({ paths: DEFAULT_FORBIDDEN_PATHS, allow: DEFAULT_ALLOWED_PATHS, secrets: [] }, ".claude/settings.json"); // "the local folder of an agent (.claude/)"
 * messageOf({ issue: { prefix: "Refs #", required: false }, trailers: ["issue"] }, { subject: "Add", refs: "10", coAuthor: undefined, session: undefined }).trailers; // ["Refs #10"]
 * ```
 *
 * @module
 */
import { type CommitImpact, type CommitPolicy, type CommitSubject, type Generator, identityArgs, type IssueNumber, type SessionUrl } from "@intellectual-frontiers/repoctl/governance";
import { matches } from "./glob.ts";
import { absurd } from "@intellectual-frontiers/core";
import { finding, type Finding } from "./findings.ts";
import type { World } from "./ports.ts";
import { findingsOfSync, runSync } from "./sync.ts";

/** What a commit is made of. */
export type CommitInput = {
  readonly subject: CommitSubject;
  readonly refs: IssueNumber | undefined;
  /** The impact the commit states on its `Impact:` line, where the policy has the trailer and the commit gives one. */
  readonly impact: CommitImpact | undefined;
  /** The address of the session, where the policy has the trailer. */
  readonly session: SessionUrl | undefined;
  /** The line that credits the agent, where the policy has the trailer. */
  readonly coAuthor: string | undefined;
  /** Paths to stage first (the files already staged are committed in any case). */
  readonly paths: readonly string[];
  readonly dryRun: boolean;
};

/** The message of a commit: the subject, and the trailers, each a line. */
export type Message = { readonly subject: string; readonly trailers: readonly string[] };

/** The message: the subject, then the trailers the policy lists, in its order, each a line: the reference to an issue (the policy's prefix and the number), `Impact:` and the impact, the line that credits the agent, and `Claude-Session`. A trailer whose value is not given is left out. */
export function messageOf(policy: Pick<CommitPolicy, "issue" | "trailers">, input: { readonly subject: string; readonly refs: string | undefined; readonly impact?: string | undefined; readonly coAuthor: string | undefined; readonly session: string | undefined }): Message {
  const lines = policy.trailers.flatMap((t): readonly string[] => {
    switch (t) {
      case "issue":
        return input.refs === undefined ? [] : [`${policy.issue.prefix}${input.refs}`];
      case "impact":
        return input.impact === undefined ? [] : [`Impact: ${input.impact}`];
      case "co-author":
        return input.coAuthor === undefined ? [] : [input.coAuthor];
      case "session":
        return input.session === undefined ? [] : [`Claude-Session: ${input.session}`];
      default:
        return absurd(t);
    }
  });
  return { subject: input.subject, trailers: lines };
}

/** The message as Git is given it: the subject, a blank line, and the trailers on lines of their own. */
export function messageText(m: Message): string {
  return m.trailers.length === 0 ? `${m.subject}\n` : `${m.subject}\n\n${m.trailers.join("\n")}\n`;
}

/** Why a path must not be committed under the policy, or undefined where it may be: a forbidden glob matches it and no allowed glob does. */
export function forbidden(policy: CommitPolicy["forbidden"], path: string): string | undefined {
  if (policy.allow.some((g) => matches(g, path))) return undefined;
  return policy.paths.find((p) => matches(p.glob, path))?.why;
}

/** What a text holds that looks like a secret under the policy, or undefined where it holds none. */
export function secretLike(policy: CommitPolicy["forbidden"], text: string): string | undefined {
  return policy.secrets.find((s) => new RegExp(s.pattern).test(text))?.label;
}

/** What a commit came to. */
export type CommitReport =
  | { readonly kind: "refused"; readonly findings: readonly Finding[] }
  | { readonly kind: "preview"; readonly message: string; readonly files: readonly string[] }
  | { readonly kind: "committed"; readonly message: string; readonly files: readonly string[]; readonly sha: string };

const lines = (text: string): readonly string[] =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "");

/** Makes the commit: stages the paths, refuses what must not be committed, checks the generated files, and commits as the repository's identity. */
export async function runCommit(w: Pick<World, "process" | "repo" | "files">, input: CommitInput, order: readonly Generator[], policy: CommitPolicy): Promise<CommitReport> {
  const here = { cwd: w.repo };
  const git = (...args: readonly string[]) => w.process.run(["git", "-c", "core.quotepath=false", ...args], here);
  const refuse = (found: readonly Finding[]): CommitReport => ({ kind: "refused", findings: found });
  const named = input.paths.flatMap((p) => {
    const why = forbidden(policy.forbidden, p);
    return why === undefined ? [] : [finding("fail", "E-COMMIT-FORBIDDEN", `${p} is ${why}`, `do not add ${p}`)];
  });
  if (named.length > 0) return refuse(named);
  const synced = findingsOfSync(await runSync(w, "check", order));
  if (synced.length > 0) return refuse(synced);
  if (!input.dryRun && input.paths.length > 0) {
    const added = await git("add", "--", ...input.paths);
    if (added.code !== 0) return refuse([finding("fail", "E-COMMIT-FAILED", `git could not add the paths: ${lines(added.stderr).slice(-1)[0] ?? "no message"}`, "git status")]);
  }
  const staged = lines((await git("diff", "--cached", "--name-only")).stdout);
  const files = input.dryRun ? [...new Set([...staged, ...input.paths])] : staged;
  if (files.length === 0) return refuse([finding("fail", "E-COMMIT-NOTHING", "nothing is staged and no path was given", "git status")]);
  const found: Finding[] = [];
  for (const path of files) {
    const why = forbidden(policy.forbidden, path);
    if (why !== undefined) {
      found.push(finding("fail", "E-COMMIT-FORBIDDEN", `${path} is ${why}`, `git restore --staged ${path}`));
      continue;
    }
    const text = await w.files.read(`${w.repo}/${path}`);
    const looks = text === undefined ? undefined : secretLike(policy.forbidden, text);
    if (looks !== undefined) found.push(finding("fail", "E-COMMIT-FORBIDDEN", `${path} holds what looks like ${looks}`, `git restore --staged ${path}`));
  }
  if (found.length > 0) return refuse(found);
  const message = messageOf(policy, { subject: input.subject, refs: input.refs, impact: input.impact, coAuthor: input.coAuthor, session: input.session });
  const text = messageText(message);
  if (input.dryRun) return { kind: "preview", message: text, files };
  const made = await w.process.run(["git", ...identityArgs(policy.identity), "commit", "-m", message.subject, ...(message.trailers.length === 0 ? [] : ["-m", message.trailers.join("\n")])], here);
  if (made.code !== 0) return refuse([finding("fail", "E-COMMIT-FAILED", `git did not make the commit: ${lines(`${made.stdout}\n${made.stderr}`).slice(-2).join("; ")}`, "git status")]);
  const sha = lines((await git("rev-parse", "--short", "HEAD")).stdout)[0] ?? "";
  return { kind: "committed", message: text, files, sha };
}
