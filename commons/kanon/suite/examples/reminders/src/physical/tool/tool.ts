// Spec: 0033-kanon FR-004
/**
 * The tool surface of the example: a tool descriptor for each verb, with the hints an agent needs. It imports Logical and Governance and no other surface.
 *
 * @module
 */
import { type Verb, VERBS } from "@example/reminders/logical";

/** A tool as a client lists it. */
export type Tool = {
  readonly name: string;
  readonly description: string;
  readonly annotations: { readonly readOnlyHint: boolean; readonly destructiveHint: boolean; readonly idempotentHint: boolean };
};

/** The tool of a verb: the words joined by underscores, and the hints from the model. */
export function toolOf(v: Verb): Tool {
  return {
    name: v.words.join("_"),
    description: v.summary,
    annotations: { readOnlyHint: v.readOnly, destructiveHint: v.destructive, idempotentHint: v.idempotent },
  };
}

/** The tools of the program: one for each verb. */
export const TOOLS: readonly Tool[] = VERBS.map(toolOf);
