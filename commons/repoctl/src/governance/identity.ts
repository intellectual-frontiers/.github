// Spec: 0005-repoctl-library-commit-doctor FR-004
/**
 * The identity of a commit of this repository (commons repoctl 0005-repoctl-library-commit-doctor FR-004, FR-005): the author and committer are one person, and the trailers that follow the subject are fixed lines. They are data, here and nowhere
 * else; the merge and the commit read them.
 *
 * @example
 * ```ts
 * import { IDENTITY, CO_AUTHOR } from "./identity.ts";
 * IDENTITY.email; // "47497+shah@users.noreply.github.com"
 * CO_AUTHOR; // "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
 * ```
 *
 * @module
 */

/** The name and the address a commit is made with. */
export const IDENTITY = { name: "Shahid Shah", email: "47497+shah@users.noreply.github.com" } as const;

/** The trailer that credits the agent, which follows `Refs #N` and precedes `Claude-Session`. */
export const CO_AUTHOR = "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>";

/** The environment variable that holds the address of the session. */
export const SESSION_VARIABLE = "CLAUDE_SESSION_URL";

/** The arguments of `git` that make the commit as the identity, whatever the checkout's own configuration says. */
export const IDENTITY_ARGS: readonly string[] = ["-c", `user.name=${IDENTITY.name}`, "-c", `user.email=${IDENTITY.email}`];
