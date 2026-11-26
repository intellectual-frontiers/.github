// Spec: 0003-workbench-contract FR-003, FR-004
/**
 * Who does the work and how far an agent may go: a role is held by a person, an agent or either; a stage of a workflow has one of four autonomy levels; a gate is a point where work stops for a person who is never the author.
 * The levels are what let a regulated stage be `agent-proposes` while another stage of the same repository is `agent-autonomous`, and move up one stage at a time as evidence accumulates.
 *
 * @example
 * ```ts
 * import { agentMay } from "./roles.ts";
 * agentMay("agent-proposes", "commit"); // false
 * agentMay("agent-acts-human-reviews", "commit"); // true
 * agentMay("agent-autonomous", "tag"); // false: a tag is always a person's
 * ```
 *
 * @module
 */

/** Who may hold a role: a closed list. */
export const HOLDERS = ["human", "agent", "either"] as const;
/** One kind of holder. */
export type Holder = (typeof HOLDERS)[number];

/** The four autonomy levels, from least to most an agent does alone. */
export const AUTONOMY = ["human-only", "agent-proposes", "agent-acts-human-reviews", "agent-autonomous"] as const;
/** One autonomy level. */
export type Autonomy = (typeof AUTONOMY)[number];

/** What an actor does in a workflow: a closed list. */
export const ACTIONS = ["read", "edit", "test", "propose", "commit", "push", "approve", "publish", "tag"] as const;
/** One action. */
export type Action = (typeof ACTIONS)[number];

/** The actions that are always a person's, at every level: an approval and a signed tag. */
export const PERSON_ONLY: readonly Action[] = ["approve", "tag"];

const BY_LEVEL: Readonly<Record<Autonomy, readonly Action[]>> = {
  "human-only": [],
  "agent-proposes": ["read", "edit", "test", "propose"],
  "agent-acts-human-reviews": ["read", "edit", "test", "propose", "commit", "push"],
  "agent-autonomous": ["read", "edit", "test", "propose", "commit", "push", "publish"],
};

/** Whether an agent may do the action at a level. */
export function agentMay(level: Autonomy, action: Action): boolean {
  return !PERSON_ONLY.includes(action) && BY_LEVEL[level].includes(action);
}

/** A role: its id, who may hold it, and what it may do. */
export type Role = { readonly id: string; readonly holder: Holder; readonly may: readonly Action[] };

/** A gate: a point where work stops for a person who holds the approver role and is never the author of what is approved. */
export type Gate = { readonly id: string; readonly summary: string; readonly approver: string; readonly commands: readonly string[] };

/** A stage of a workflow: its autonomy level and the gates it passes through. */
export type Stage = { readonly id: string; readonly level: Autonomy; readonly gates: readonly string[] };
