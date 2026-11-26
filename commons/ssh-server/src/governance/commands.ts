// Spec: 0002-enrollment-protocol FR-001, FR-002, FR-003
/**
 * The service commands as data: the closed grammar of a command line, and the type of a command definition that a registry holds. A command line is words of a small alphabet separated by single spaces: there is no shell syntax in it,
 * no quoting, no free text. The registry is closed at runtime and open at build time: adding a command is adding a definition, and never touches the core.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import type { Result } from "@intellectual-frontiers/core";

/** The longest command line, in characters. */
export const MAX_COMMAND = 256;
/** What a word may hold. */
export const WORD = /^[A-Za-z0-9._:=-]{1,96}$/;

/** What a command needs to be proven before it runs. */
export type AuthRequirement = "none" | "proven-key" | "token" | "pairing-code";

/** The audit kind a command writes (0002-enrollment-protocol FR-014). */
export type AuditKind = "hello" | "status" | "script" | "facts" | "plan" | "consent" | "result" | "join" | "knock" | "checkin" | "leave" | "pairing" | "reserved";

/** A kind of effect a command may ask the server to make. Declared by the definition, so a reviewer reads what a command can do. */
export type EffectKind = "put-session" | "put-asset" | "request-removal" | "audit";

/** The words of a command line: the command name and its arguments, split at single spaces, each word of the alphabet. */
export function wordsOf(text: unknown): Result<readonly string[], string> {
  if (typeof text !== "string") return err("a command is text");
  if (text.length === 0) return err("an empty command");
  if (text.length > MAX_COMMAND) return err(`a command is at most ${MAX_COMMAND} characters`);
  const words = text.split(" ");
  for (const w of words) if (!WORD.test(w)) return err("a command holds words of letters, digits and . _ : = - only, separated by single spaces");
  return ok(words);
}

/** A command that was read: its name, its typed arguments and the token presented with it, if any. */
export type ServiceCommand<A = unknown> = { readonly name: string; readonly args: A; readonly token?: string };

/** The type of the first argument of a command definition: how to read the words after the name. */
export type Decode<A> = (words: readonly string[]) => Result<A, string>;

/** A conversation: the algebra every service of the host is made in. Its state, the messages it takes and gives, the account that may start it, what must be proven, its limits and its audience. Its step is a pure function. */
export type Conversation<State, In, Out> = {
  readonly id: string;
  readonly account: string;
  readonly auth: AuthRequirement;
  readonly audience: string;
  readonly limits: { readonly maxInBytes: number; readonly timeoutMs: number };
  readonly initial: State;
  readonly step: (state: State, input: In) => Result<{ readonly state: State; readonly out: readonly Out[]; readonly effects: readonly unknown[] }, string>;
};
