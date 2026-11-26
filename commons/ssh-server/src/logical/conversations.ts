// Spec: 0002-enrollment-protocol FR-016
/**
 * The enrollment as one conversation of the algebra of the host (`Conversation<State, In, Out>`): its state is the session, its messages are the `EnrollMessage` it takes and the `Reply` it gives, and its step is the pure `step` of the dialogue.
 * The registry of conversations is closed at runtime: the commands of the registry name the conversation they belong to, and a conversation that is not built (0006-reserved) has no entry.
 *
 * @module
 */
import type { Conversation, EnrollmentSession } from "@intellectual-frontiers/ssh-server/governance";
import { step } from "./dialogue.ts";
import type { EnrollMessage, Reply, StepEnv } from "./dialogue.ts";

/** The enrollment conversation over an environment (the clock, the policy, the assets). Its initial state is a session just opened. */
export function enrollConversation(initial: EnrollmentSession, env: StepEnv): Conversation<EnrollmentSession, EnrollMessage, Reply> {
  return {
    id: "enroll",
    account: "s-enroll",
    auth: "none",
    audience: "a device that is not yet known",
    limits: { maxInBytes: 256 * 1024, timeoutMs: 600_000 },
    initial,
    step: (state, input) => {
      const r = step(state, input, env);
      return r.kind === "ok" ? { kind: "ok", value: { state: r.value.session, out: [r.value.reply], effects: r.value.effects } } : r;
    },
  };
}

/** The conversations the host runs, by id, and whether each is built. The rest are reserved in 0006-reserved. */
export const CONVERSATIONS: readonly { readonly id: string; readonly account: string; readonly built: boolean }[] = [
  { id: "enroll", account: "s-enroll", built: true },
  { id: "checkin", account: "s-device", built: true },
  { id: "rekey", account: "s-device", built: true },
  { id: "tether", account: "s-device", built: false },
  { id: "jobs", account: "s-device", built: false },
  { id: "query", account: "s-device", built: false },
  { id: "evidence", account: "s-device", built: false },
  { id: "fetch", account: "s-device", built: false },
  { id: "health", account: "s-device", built: false },
  { id: "presence", account: "s-device", built: false },
  { id: "operator-cli", account: "s-operator", built: false },
  { id: "agent-mcp", account: "s-agent", built: false },
  { id: "assist-terminal", account: "s-assist", built: false },
];
