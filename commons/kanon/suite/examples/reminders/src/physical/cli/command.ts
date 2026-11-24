// Spec: 0033-kanon FR-004
/**
 * The command-line surface of the example: a usage line for each verb of the logical model. It imports Logical and Governance and no other surface.
 *
 * @module
 */
import { type Verb, VERBS } from "@example/reminders/logical";

/** The usage line of a verb: a destructive verb asks for `--yes`. */
export function usageOf(v: Verb): string {
  return `${v.words.join(" ")}${v.destructive ? " --yes" : ""}   ${v.summary}`;
}

/** The help of the program: one line for each verb. */
export const HELP: readonly string[] = VERBS.map(usageOf);
