// Spec: 0033-kanon FR-001
/**
 * Governance of the example: what a reminder action is and what it may do, stated once, in the words of the domain. Nothing here imports another unit of the library.
 *
 * @module
 */

/** What an action may do to the world. */
export type Effect = "read" | "mutate" | "destructive";

/** One action and the facts that govern it. */
export type Action = {
  /** Its words as a person types them. */
  readonly id: string;
  readonly summary: string;
  readonly effect: Effect;
  /** Whether running it again with the same input changes nothing more. */
  readonly idempotent: boolean;
  /** An annotation: what must be recorded when it runs (FR-005 of 0033-kanon: each annotation ends expressed, carried or unexpressed). */
  readonly audit: string;
};

/** The actions of the example: the one place that says what they are. */
export const ACTIONS: readonly Action[] = [
  { id: "reminder list", summary: "List the reminders.", effect: "read", idempotent: true, audit: "not recorded: a read" },
  { id: "reminder add", summary: "Add a reminder.", effect: "mutate", idempotent: false, audit: "the change is recorded with who made it" },
  { id: "reminder clear", summary: "Remove every reminder.", effect: "destructive", idempotent: true, audit: "the change is recorded with who made it" },
];
