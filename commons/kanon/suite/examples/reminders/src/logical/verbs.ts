// Spec: 0033-kanon FR-002
/**
 * The logical model of the example: the verb a program reasons with, made from an action of Governance by a function, never written a second time.
 *
 * @module
 */
import { ACTIONS, type Action } from "@example/reminders/governance";

/** The model of an action: its words, and what a caller must know before running it. */
export type Verb = {
  /** The id of the action it was made from (the trace edge of 0033-kanon FR-003). */
  readonly from: string;
  readonly words: readonly string[];
  readonly summary: string;
  readonly readOnly: boolean;
  readonly destructive: boolean;
  readonly idempotent: boolean;
};

/** The projection of one action into one verb. */
export function verbOf(a: Action): Verb {
  return {
    from: a.id,
    words: a.id.split(" "),
    summary: a.summary,
    readOnly: a.effect === "read",
    destructive: a.effect === "destructive",
    idempotent: a.idempotent,
  };
}

/** The model of the whole program: a verb for each action, in the order of Governance. */
export const VERBS: readonly Verb[] = ACTIONS.map(verbOf);
