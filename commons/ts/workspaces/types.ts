/**
 * The branded types of Intellectual Frontiers Workspaces (commons 0023-if-workspaces FR-006 to FR-012): a Git host's name, a path segment that is valid on Linux, macOS and Windows alike, a
 * path of the workspace, a branch, a commit and a pinned version are each a type of their own, made only by the function that refuses what it should, so that an unchecked string never
 * reaches the layout or the plan.
 *
 * @remarks
 * `PortableSegment` and `RepoPath` are made in `portable.ts`; the others are made here. A refusal is a `Result` whose error says what is wrong and names the text, never a throw.
 *
 * @module
 */
import { absurd } from "../kernel/absurd.ts";
import type { Brand } from "../kernel/brand.ts";
import { err, ok, type Result } from "../kernel/result.ts";
import { parseSemVer } from "../kernel/semver.ts";

/** One name in a path, valid on every operating system (made only by `segment` in `portable.ts`). */
export type PortableSegment = Brand<string, "PortableSegment">;

/** A path of the workspace below its root: portable segments with `/` between them, never absolute and never holding `..` (made only by `repoPath` in `portable.ts`). */
export type RepoPath = Brand<string, "RepoPath">;

/** A Git host's name in lower case, as the first folder of a repository's path (`github.com`). */
export type GitHost = Brand<string, "GitHost">;

/** A branch's name, by the rules of `git check-ref-format --branch`. */
export type BranchName = Brand<string, "BranchName">;

/** A commit's object id: 40 (SHA-1) or 64 (SHA-256) lower-case hexadecimal digits. */
export type Sha = Brand<string, "Sha">;

/** A pinned version of a tool: `major.minor.patch` with an optional pre-release and build, never `latest` and never a range. */
export type Version = Brand<string, "Version">;

/** A text refused as a type of this module, and why. */
export type BrandError =
  | { readonly kind: "git-host"; readonly text: string; readonly reason: string }
  | { readonly kind: "branch-name"; readonly text: string; readonly reason: string }
  | { readonly kind: "sha"; readonly text: string }
  | { readonly kind: "version"; readonly text: string; readonly reason: string };

/** A refusal as one sentence. */
export function describeBrandError(e: BrandError): string {
  switch (e.kind) {
    case "git-host":
      return `${JSON.stringify(e.text)} is not a Git host name: ${e.reason}`;
    case "branch-name":
      return `${JSON.stringify(e.text)} is not a branch name: ${e.reason}`;
    case "sha":
      return `${JSON.stringify(e.text)} is not a commit id (40 or 64 lower-case hexadecimal digits)`;
    case "version":
      return `${JSON.stringify(e.text)} is not a pinned version: ${e.reason}`;
    default:
      return absurd(e);
  }
}

/** A Git host's name: letters, digits, `-`, `_` and `.` between labels, lower-cased; no port, no scheme, no credential. */
export function gitHost(text: string): Result<GitHost, BrandError> {
  const host = text.toLowerCase();
  if (host === "") return err({ kind: "git-host", text, reason: "it is empty" });
  if (!/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/.test(host)) {
    return err({
      kind: "git-host",
      text,
      reason:
        "it holds a character a host name does not (a port, a path, a scheme, a credential and non-ASCII letters are not part of the name)",
    });
  }
  if (host.includes("..")) return err({ kind: "git-host", text, reason: "it holds an empty label" });
  return ok(host as GitHost);
}

/** A branch's name, by the rules of Git's ref names (`git check-ref-format`): no control character, space, `~ ^ : ? * [ \`, `..` or `@{`, no component that starts with `.` or ends in `.lock`, and no start with `-`. */
export function branchName(text: string): Result<BranchName, BrandError> {
  const bad = (reason: string): Result<BranchName, BrandError> => err({ kind: "branch-name", text, reason });
  if (text === "") return bad("it is empty");
  if (text === "@") return bad("it is `@`");
  if (text.startsWith("-")) return bad("it starts with `-`");
  if (text.startsWith("/") || text.endsWith("/") || text.includes("//")) return bad("it has an empty component");
  if (text.endsWith(".")) return bad("it ends in a dot");
  if (text.includes("..")) return bad("it holds `..`");
  if (text.includes("@{")) return bad("it holds `@{`");
  // eslint-disable-next-line no-control-regex
  if (/[\u0000- \u007f~^:?*[\\]/.test(text)) return bad("it holds a control character, a space or one of ~ ^ : ? * [ \\");
  for (const part of text.split("/")) {
    if (part.startsWith(".")) return bad("a component starts with a dot");
    if (part.endsWith(".lock")) return bad("a component ends in `.lock`");
  }
  return ok(text as BranchName);
}

/** A commit id. */
export function sha(text: string): Result<Sha, BrandError> {
  return /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(text) ? ok(text as Sha) : err({ kind: "sha", text });
}

/** A pinned version: a semantic version with no `v` and nothing around it, so `latest`, `1.x`, `^1.2.0`, `>=1` and `v1.2.3` are refused (0023-if-workspaces FR-037). */
export function version(text: string): Result<Version, BrandError> {
  if (text === "latest") return err({ kind: "version", text, reason: "`latest` is not a version" });
  if (!/^\d/.test(text)) return err({ kind: "version", text, reason: "it is not major.minor.patch (a range or a tag is not a pin)" });
  const parsed = parseSemVer(text);
  if (parsed.kind === "err")
    return err({ kind: "version", text, reason: "it is not major.minor.patch with an optional pre-release or build" });
  return ok(text as Version);
}
