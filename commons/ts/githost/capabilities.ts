/**
 * What each kind of Git host offers (commons 0023-if-workspaces FR-016, FR-017): the table of `ifws:GitManagerKind` and its `ifws:supports`, as the pure types the adapters and the
 * workspace read, and the typed answer for a capability a kind lacks. A test holds this table equal to the ontology's.
 *
 * @module
 */
import { err, type Result } from "../kernel/result.ts";
import type { Capability, HostFailure, HostKind } from "./types.ts";

/** The four capabilities every kind offers (`ifws:CloneUrl`, `ifws:Credentials`, `ifws:DefaultBranch`, `ifws:SignedCommits`). */
export const COMMON_CAPABILITIES: readonly Capability[] = ["CloneUrl", "Credentials", "DefaultBranch", "SignedCommits"];

const HOSTED: readonly Capability[] = [...COMMON_CAPABILITIES, "ProtectedBranches", "Issues", "ChangeRequests"];

/** The capabilities of each kind: GitHub the common four and the three a host adds, GitLab those and groups to any depth, plain Git the common four alone. */
export const CAPABILITIES: Readonly<Record<HostKind, ReadonlySet<Capability>>> = {
  Github: new Set(HOSTED),
  Gitlab: new Set<Capability>([...HOSTED, "NestedGroups"]),
  Git: new Set(COMMON_CAPABILITIES),
};

/** Whether a kind of host offers a capability. */
export function supports(kind: HostKind, capability: Capability): boolean {
  return CAPABILITIES[kind].has(capability);
}

/** The answer for a capability that a kind of host does not offer: typed, naming the host and the capability, never a guess (0023-if-workspaces FR-017). */
export function unsupported(host: HostKind, capability: Capability): Result<never, HostFailure> {
  return err({ kind: "unsupported", capability, host });
}

/** The most path segments (owner or groups, then repository) a kind of host takes: 2 where it has no nested groups, unlimited where it has. */
export function maxDepth(kind: HostKind): number {
  return supports(kind, "NestedGroups") ? Number.POSITIVE_INFINITY : 2;
}
