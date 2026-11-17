/**
 * What the workspace requires of itself (commons 0023-if-workspaces FR-032, FR-033, 0024-ifws-host FR-015): the policy the manifest names, and the judgements that follow from it as pure
 * functions: a regulated domain requires signed commits, a commit that is not signed and verified is an error there and a warning elsewhere, a hook that cannot run its checker fails there
 * and says so elsewhere, and a Git host the policy does not allow is told.
 *
 * @module
 */
import { UNAPPROVED_GRACE_DAYS, type Severity } from "./findings.ts";

/** The workspace's policy (`ifws:WorkspacePolicy`). */
export type Policy = {
  /** Whether a commit must be signed (OpenPGP or SSH) and verified; always true where a regulated domain is named. */
  readonly requiresSignedCommits: boolean;
  /** The regulated domains the manifest names (the keys of `ifccm:RegulatedDomain`); none means an unregulated workspace. */
  readonly regulatedDomain: readonly string[];
  /** How many days a tool or module outside the catalog is informational before it is a warning. */
  readonly unapprovedGraceDays: number;
  /** The Git hosts a repository of the manifest may be on; empty means any. */
  readonly allowedGitHost: readonly string[];
};

/** What the manifest says of the policy, each part optional. */
export type PolicyInput = {
  readonly requiresSignedCommits?: boolean | undefined;
  readonly regulatedDomain?: readonly string[] | undefined;
  readonly unapprovedGraceDays?: number | undefined;
  readonly allowedGitHost?: readonly string[] | undefined;
};

/** The policy from what the manifest says: signed commits are required wherever a regulated domain is named, whatever else it says (FR-032). */
export function policyOf(input: PolicyInput = {}): Policy {
  const regulatedDomain = input.regulatedDomain ?? [];
  return {
    requiresSignedCommits: regulatedDomain.length > 0 || input.requiresSignedCommits === true,
    regulatedDomain,
    unapprovedGraceDays: input.unapprovedGraceDays ?? UNAPPROVED_GRACE_DAYS,
    allowedGitHost: (input.allowedGitHost ?? []).map((h) => h.toLowerCase()),
  };
}

/** Whether the workspace names a regulated domain. */
export function isRegulated(policy: Policy): boolean {
  return policy.regulatedDomain.length > 0;
}

/**
 * The severity of a commit in a managed repository: nothing where the commit is signed and verified; an error where a regulated domain is named; a warning elsewhere (FR-032: "elsewhere
 * the same commit MUST be a warning").
 */
export function unsignedCommitSeverity(policy: Policy, signedAndVerified: boolean): Severity | undefined {
  if (signedAndVerified) return undefined;
  return isRegulated(policy) ? "Error" : "Warning";
}

/** Whether a Git hook that cannot run its checker fails (exits non-zero) or only says so on standard error: it fails where a regulated domain is named (0024-ifws-host FR-015). */
export function hookFailsWhenUnableToCheck(policy: Policy): boolean {
  return isRegulated(policy);
}

/** Whether a Git host is allowed: any, where the policy lists none. */
export function hostAllowed(policy: Policy, host: string): boolean {
  return policy.allowedGitHost.length === 0 || policy.allowedGitHost.includes(host.toLowerCase());
}
