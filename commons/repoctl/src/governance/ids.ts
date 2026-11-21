// Spec: 0002-repoctl-governance FR-001
/**
 * The identities of Repoctl as types that cannot be made wrong (commons repoctl 0002-repoctl-governance FR-001): a library name, a version, an issue number, a session address, a commit subject and a Git reference are values
 * of a branded type, each made only by its smart constructor, which says why a text is not one. A function that takes one never checks again.
 *
 * @example
 * ```ts
 * import { parseLibraryName, parseSemver } from "./ids.ts";
 * parseLibraryName("repoctl").kind; // "ok"
 * parseSemver("1.2").kind; // "err"
 * ```
 *
 * @module
 */
import { err, ok, refine, string, type Brand, type Result } from "@intellectual-frontiers/core";

/** The name of a library of commons: its folder and the end of its package name. */
export type LibraryName = Brand<string, "library name">;
/** A version of Semantic Versioning, with an optional pre-release and build part. */
export type Semver = Brand<string, "semver">;
/** The number of an issue of the repository, in digits. */
export type IssueNumber = Brand<string, "issue number">;
/** The address of a Claude Code session: https, with a host and no credential. */
export type SessionUrl = Brand<string, "session url">;
/** The subject line of a commit: one line of at most 100 characters that does not end with a full stop. */
export type CommitSubject = Brand<string, "commit subject">;
/** A name Git accepts for a branch, a tag or a remote reference, which does not begin with a dash. */
export type GitRef = Brand<string, "git ref">;
/** The name of a generator or of a check of a repository's configuration: lower-case words, digits, hyphens and colons. */
export type StepId = Brand<string, "step id">;
/** The name of an environment variable: capitals, digits and underscores, not starting with a digit. */
export type VariableName = Brand<string, "variable name">;

const LIBRARY = refine(string, "library name", (t) => /^[a-z][a-z0-9-]*$/.test(t) && t.length <= 60);
const SEMVER = refine(string, "semver", (t) => /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(t));
const ISSUE = refine(string, "issue number", (t) => /^[1-9]\d{0,8}$/.test(t));
const SESSION = refine(string, "session url", (t) => /^https:\/\/[A-Za-z0-9.-]+(?:\/[A-Za-z0-9._~%/-]*)?$/.test(t));
const SUBJECT = refine(string, "commit subject", (t) => t.trim() === t && t !== "" && !t.includes("\n") && t.length <= 100 && !t.endsWith("."));
const STEP = refine(string, "step id", (t) => /^[a-z][a-z0-9:-]*$/.test(t) && t.length <= 60);
const VARIABLE = refine(string, "variable name", (t) => /^[A-Z][A-Z0-9_]*$/.test(t) && t.length <= 80);
const REF = refine(string, "git ref", (t) => t !== "" && !t.startsWith("-") && !/[\s~^:?*[\\]|\.\.|@\{|\/\/|\.lock$|\/$/.test(t));

/** A library name from text, or why the text is not one. */
export function parseLibraryName(text: string): Result<LibraryName, string> {
  const r = LIBRARY(text, "name");
  return r.kind === "ok" ? ok(r.value) : err(`${JSON.stringify(text)} is not a library name: lower-case letters, digits and hyphens, starting with a letter, at most 60 characters`);
}

/** A version from text, or why the text is not one. */
export function parseSemver(text: string): Result<Semver, string> {
  const r = SEMVER(text, "version");
  return r.kind === "ok" ? ok(r.value) : err(`${JSON.stringify(text)} is not a version of the form 1.2.3, with an optional -pre-release`);
}

/** An issue number from text (`10` or `#10`), or why the text is not one. */
export function parseIssueNumber(text: string): Result<IssueNumber, string> {
  const r = ISSUE(text.startsWith("#") ? text.slice(1) : text, "issue");
  return r.kind === "ok" ? ok(r.value) : err(`${JSON.stringify(text)} is not an issue number: digits, from 1`);
}

/** The impacts a commit may state on its `Impact:` line (commons 0026-works-versioning FR-021): a closed union, least first. */
export const COMMIT_IMPACTS = ["patch", "minor", "major"] as const;
/** The impact a commit states: how much the release raises the version of a library the commit changes. */
export type CommitImpact = (typeof COMMIT_IMPACTS)[number];

/** An impact from text (`major`, `minor` or `patch`), or why the text is not one. */
export function parseCommitImpact(text: string): Result<CommitImpact, string> {
  const impact = COMMIT_IMPACTS.find((i) => i === text);
  return impact === undefined ? err(`${JSON.stringify(text)} is not an impact: major (a breaking change), minor (a feature) or patch (a fix)`) : ok(impact);
}

/** A session address from text, or why the text is not one. */
export function parseSessionUrl(text: string): Result<SessionUrl, string> {
  const r = SESSION(text, "session");
  return r.kind === "ok" ? ok(r.value) : err(`${JSON.stringify(text)} is not a session address: an https address with no user name or password`);
}

/** A commit subject from text, or why the text is not one. */
export function parseSubject(text: string): Result<CommitSubject, string> {
  const r = SUBJECT(text, "subject");
  return r.kind === "ok" ? ok(r.value) : err("the subject is one line of at most 100 characters, with nothing around it and no full stop at its end");
}

/** A Git reference from text, or why the text is not one. */
export function parseGitRef(text: string): Result<GitRef, string> {
  const r = REF(text, "ref");
  return r.kind === "ok" ? ok(r.value) : err(`${JSON.stringify(text)} is not a name Git accepts for a reference`);
}

/** The name of a generator or of a check from text, or why the text is not one. */
export function parseStepId(text: string): Result<StepId, string> {
  const r = STEP(text, "id");
  return r.kind === "ok" ? ok(r.value) : err(`${JSON.stringify(text)} is not an id: lower-case letters, digits, hyphens and colons, starting with a letter, at most 60 characters`);
}

/** The name of an environment variable from text, or why the text is not one. */
export function parseVariableName(text: string): Result<VariableName, string> {
  const r = VARIABLE(text, "variable");
  return r.kind === "ok" ? ok(r.value) : err(`${JSON.stringify(text)} is not the name of an environment variable: capitals, digits and underscores, starting with a capital`);
}
