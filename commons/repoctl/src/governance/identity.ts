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

/** The environment variable where a remote agent session keeps its id (`cse_` and the id of the session): the address of the session is made from it where no other gives it (commons 0048-actors FR-063). */
export const REMOTE_SESSION_VARIABLE = "CLAUDE_CODE_REMOTE_SESSION_ID";

/** The environment variable a harness sets to say that an agent runs the command: its value names the agent. */
export const AGENT_VARIABLE = "AI_AGENT";

/** The environment variable that holds the model the agent says it runs, where the command line does not give `--model`. */
export const MODEL_VARIABLE = "REPOCTL_MODEL";

/** The address of a session from the id a remote session keeps (`cse_01AbC` is `https://claude.ai/code/session_01AbC`), or undefined where there is none or it is not of that form. */
export function sessionUrlOfRemote(id: string | undefined): string | undefined {
  const m = /^cse_([A-Za-z0-9]+)$/.exec(id ?? "");
  return m === null ? undefined : `https://claude.ai/code/session_${m[1] ?? ""}`;
}

/** The environment variable that holds the line that credits the agent, where the command line does not give `--co-author`. */
export const CO_AUTHOR_VARIABLE = "REPOCTL_CO_AUTHOR";

/** The arguments of `git` that make the commit as the identity, whatever the checkout's own configuration says. */
export function identityArgs(identity: Identity): readonly string[] {
  return ["-c", `user.name=${identity.name}`, "-c", `user.email=${identity.email}`];
}
