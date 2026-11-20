// Spec: 0005-repoctl-library-commit-doctor FR-004
/**
 * The names a commit of any repository shares (commons repoctl 0005-repoctl-library-commit-doctor FR-004, FR-005; 0009-repoctl-config FR-004): the variable that holds the address of the session and the arguments of `git` that make a commit as
 * the identity a repository's configuration names. The identity itself, the trailers and the issue reference are the repository's, in its `repoctl.config.ts`; nothing about one repository is here.
 *
 * @example
 * ```ts
 * import { identityArgs } from "./identity.ts";
 * identityArgs({ name: "A B", email: "a@example.test" }); // ["-c", "user.name=A B", "-c", "user.email=a@example.test"]
 * ```
 *
 * @module
 */

/** The name and the address a commit is made with. */
export type Identity = { readonly name: string; readonly email: string };

/** The environment variable that holds the address of the session. */
export const SESSION_VARIABLE = "CLAUDE_SESSION_URL";

/** The environment variable that holds the line that credits the agent, where the command line does not give `--co-author`. */
export const CO_AUTHOR_VARIABLE = "REPOCTL_CO_AUTHOR";

/** The arguments of `git` that make the commit as the identity, whatever the checkout's own configuration says. */
export function identityArgs(identity: Identity): readonly string[] {
  return ["-c", `user.name=${identity.name}`, "-c", `user.email=${identity.email}`];
}
