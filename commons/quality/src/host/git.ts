// Spec: 0001-quality-evidence FR-021
/**
 * Real `git`, run by its argument vector for the `quality` branch (commons 0001-quality-evidence FR-021, FR-023): never through a shell, with no pager,
 * no terminal prompt and messages in English. The host's own Git configuration is what signs (`gpg.format`, `user.signingkey`,
 * `commit.gpgsign`) and names the committer; nothing here holds a key. Every failure is a `Result`, a missing `git` included.
 *
 * @example
 * ```ts
 * import { git, text } from "./git.ts";
 * const r = await git(".", ["rev-parse", "HEAD"]);
 * if (r.kind === "ok") console.log(text(r.value).trim());
 * ```
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import { NotFound } from "@intellectual-frontiers/system/errors";
import { output } from "@intellectual-frontiers/system/proc";

/** Why the quality branch could not be read or written. */
export type HostError =
  | { readonly kind: "git-missing" }
  | { readonly kind: "git"; readonly args: readonly string[]; readonly code: number; readonly message: string }
  | { readonly kind: "exists"; readonly path: string }
  | { readonly kind: "moved"; readonly branch: string }
  | { readonly kind: "unknown-commit"; readonly commit: string }
  | { readonly kind: "unsigned"; readonly reason: string }
  | { readonly kind: "refused"; readonly reason: string }
  | { readonly kind: "unreadable"; readonly reason: string };

/** A host error as one sentence. */
export function formatHostError(e: HostError): string {
  switch (e.kind) {
    case "git-missing":
      return "git is not installed (or not on PATH)";
    case "git":
      return `git ${e.args.join(" ")} failed (${e.code}): ${e.message}`;
    case "exists":
      return `${e.path} is already kept: an evidence file is never changed or replaced, a correction is a new run (0001-quality-evidence FR-021)`;
    case "moved":
      return `the branch ${e.branch} moved while the run was being kept; it was not changed`;
    case "unknown-commit":
      return `${e.commit} is not a commit of this repository`;
    case "unsigned":
      return `the commit could not be signed: ${e.reason}`;
    case "refused":
      return e.reason;
    case "unreadable":
      return e.reason;
    default:
      return absurd(e);
  }
}

const ENV: Readonly<Record<string, string>> = {
  GIT_TERMINAL_PROMPT: "0",
  GIT_PAGER: "cat",
  PAGER: "cat",
  GIT_OPTIONAL_LOCKS: "0",
  LC_ALL: "C",
  LANGUAGE: "C",
};

/** What `git` is given besides its arguments: text for its standard input, and variables for its environment. */
export type GitInput = { readonly input?: string | Uint8Array; readonly env?: Readonly<Record<string, string>> };

/** What a `git` run wrote, and how it ended. */
export type GitRan = { readonly stdout: Uint8Array; readonly stderr: string; readonly code: number };

/** `git --no-pager -C repo ...args`: what it wrote and its status; `git-missing` where there is no git. A non-zero status is not an error here. */
export async function gitRaw(repo: string, args: readonly string[], options: GitInput = {}): Promise<Result<GitRan, HostError>> {
  try {
    const r = await output(["git", "--no-pager", "-C", repo, ...args], {
      env: { ...ENV, ...options.env },
      ...(options.input === undefined ? {} : { input: options.input }),
    });
    return ok({ stdout: r.stdout, stderr: new TextDecoder().decode(r.stderr).trim(), code: r.code });
  } catch (e) {
    if (e instanceof NotFound) return err({ kind: "git-missing" });
    return err({ kind: "git", args, code: -1, message: e instanceof Error ? e.message : String(e) });
  }
}

/** `git` run, where a status of 0 is a success: its output; the failure otherwise names what git said. */
export async function git(repo: string, args: readonly string[], options: GitInput = {}): Promise<Result<Uint8Array, HostError>> {
  const r = await gitRaw(repo, args, options);
  if (r.kind === "err") return r;
  if (r.value.code !== 0) return err({ kind: "git", args, code: r.value.code, message: r.value.stderr });
  return ok(r.value.stdout);
}

/** Bytes as UTF-8 text. */
export function text(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/** `git` run for its text, trimmed. */
export async function gitText(repo: string, args: readonly string[], options: GitInput = {}): Promise<Result<string, HostError>> {
  const r = await git(repo, args, options);
  return r.kind === "ok" ? ok(text(r.value).trim()) : r;
}
