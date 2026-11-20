// Spec: 0005-repoctl-library-commit-doctor FR-004
/**
 * `repoctl commit` (commons repoctl 0005-repoctl-library-commit-doctor FR-004 to FR-007): the commit of this repository, made one way. The author and the committer are the repository's identity, the message is the subject and then the lines
 * `Refs #N`, `Co-Authored-By` and `Claude-Session` on their own lines, files that must not be committed (the local folder of an agent, installed packages, files that look like secrets) are refused by their paths and by what they say,
 * and the generated files are checked first (before anything is staged), so that no commit leaves one stale. Pure where it can be: the message and the refusals are functions of their inputs.
 *
 * @example
 * ```ts
 * import { forbidden, messageOf } from "./commit.ts";
 * forbidden(".claude/settings.json"); // "the local folder of an agent (.claude/)"
 * messageOf({ subject: "Add repoctl", refs: undefined, session: "https://claude.ai/code/session_x" }).trailers.at(-1); // "Claude-Session: https://claude.ai/code/session_x"
 * ```
 *
 * @module
 */
import { CO_AUTHOR, IDENTITY_ARGS, type CommitSubject, type Generator, type IssueNumber, type SessionUrl } from "@intellectual-frontiers/repoctl/governance";
import { finding, type Finding } from "./findings.ts";
import type { World } from "./ports.ts";
import { findingsOfSync, runSync } from "./sync.ts";

/** What a commit is made of. */
export type CommitInput = {
  readonly subject: CommitSubject;
  readonly refs: IssueNumber | undefined;
  readonly session: SessionUrl;
  /** Paths to stage first (the files already staged are committed in any case). */
  readonly paths: readonly string[];
  readonly dryRun: boolean;
};

/** The message of a commit: the subject, and the trailers, each a line. */
export type Message = { readonly subject: string; readonly trailers: readonly string[] };

/** The message: the subject, then `Refs #N` (where an issue is given), `Co-Authored-By` and `Claude-Session`, in that order. */
export function messageOf(input: { readonly subject: string; readonly refs: string | undefined; readonly session: string }): Message {
  return {
    subject: input.subject,
    trailers: [...(input.refs === undefined ? [] : [`Refs #${input.refs}`]), CO_AUTHOR, `Claude-Session: ${input.session}`],
  };
}

/** The message as Git is given it: the subject, a blank line, and the trailers on lines of their own. */
export function messageText(m: Message): string {
  return `${m.subject}\n\n${m.trailers.join("\n")}\n`;
}

const FORBIDDEN_PATHS: readonly (readonly [RegExp, string])[] = [
  [/(^|\/)\.claude(\/|$)/, "the local folder of an agent (.claude/)"],
  [/(^|\/)node_modules(\/|$)/, "installed packages (node_modules/)"],
  [/(^|\/)\.env(\.(?!example$|sample$|template$)[^/]*)?$/, "an environment file, which may hold secrets"],
  [/\.(pem|key|p12|pfx|jks|keystore)$/i, "a key or a certificate"],
  [/(^|\/)id_(rsa|dsa|ecdsa|ed25519)$/, "a private key of ssh"],
  [/(^|\/)\.(npmrc|netrc|pypirc)$/, "a file of credentials"],
  [/(^|\/)credentials(\.json)?$/i, "a file of credentials"],
];

/** Why a path must not be committed, or undefined where it may be. */
export function forbidden(path: string): string | undefined {
  return FORBIDDEN_PATHS.find(([re]) => re.test(path))?.[1];
}

const SECRET_TEXT: readonly (readonly [RegExp, string])[] = [
  [/-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY/, "a private key"],
  [/\bnpm_[A-Za-z0-9]{36}\b/, "an npm token"],
  [/\bgh[pousr]_[A-Za-z0-9]{36,}\b/, "a GitHub token"],
  [/\bgithub_pat_[A-Za-z0-9_]{22,}\b/, "a GitHub token"],
  [/\bAKIA[0-9A-Z]{16}\b/, "an access key of AWS"],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}/, "a token of Slack"],
  [/\bsk-ant-[A-Za-z0-9_-]{20,}/, "a key of an API"],
];

/** What a text holds that looks like a secret, or undefined where it holds none. */
export function secretLike(text: string): string | undefined {
  return SECRET_TEXT.find(([re]) => re.test(text))?.[1];
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
export async function runCommit(w: Pick<World, "process" | "repo" | "files">, input: CommitInput, order: readonly Generator[]): Promise<CommitReport> {
  const here = { cwd: w.repo };
  const git = (...args: readonly string[]) => w.process.run(["git", "-c", "core.quotepath=false", ...args], here);
  const refuse = (found: readonly Finding[]): CommitReport => ({ kind: "refused", findings: found });
  const named = input.paths.flatMap((p) => {
    const why = forbidden(p);
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
    const why = forbidden(path);
    if (why !== undefined) {
      found.push(finding("fail", "E-COMMIT-FORBIDDEN", `${path} is ${why}`, `git restore --staged ${path}`));
      continue;
    }
    const text = await w.files.read(`${w.repo}/${path}`);
    const looks = text === undefined ? undefined : secretLike(text);
    if (looks !== undefined) found.push(finding("fail", "E-COMMIT-FORBIDDEN", `${path} holds what looks like ${looks}`, `git restore --staged ${path}`));
  }
  if (found.length > 0) return refuse(found);
  const message = messageOf({ subject: input.subject, refs: input.refs, session: input.session });
  const text = messageText(message);
  if (input.dryRun) return { kind: "preview", message: text, files };
  const made = await w.process.run(["git", ...IDENTITY_ARGS, "commit", "-m", message.subject, "-m", message.trailers.join("\n")], here);
  if (made.code !== 0) return refuse([finding("fail", "E-COMMIT-FAILED", `git did not make the commit: ${lines(`${made.stdout}\n${made.stderr}`).slice(-2).join("; ")}`, "git status")]);
  const sha = lines((await git("rev-parse", "--short", "HEAD")).stdout)[0] ?? "";
  return { kind: "committed", message: text, files, sha };
}
