// Spec: 0002-enrollment-protocol FR-004, FR-005, FR-008
/**
 * The dialogue of an enrollment as a state machine, pure: `step(session, message)` gives the session after, the reply to print and the effects the server must make. A person approves or refuses with `approveSession` and `refuseSession`;
 * an agent never does. The device consents before the install, and the consent is a message of its own.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import type { Result } from "@intellectual-frontiers/core";
import { decodeFacts, planWire, TERMINAL } from "@intellectual-frontiers/ssh-server/governance";
import type { AuditEvent, EnrollPolicy, EnrollmentSession, Facts, InstallPlan, KnownAsset, SessionState, StepResult } from "@intellectual-frontiers/ssh-server/governance";
import { decideEnrollment } from "./decide.ts";

/** What the server prints to the client and how the command ends. */
export type Reply = { readonly stdout: string; readonly stderr: string; readonly exit: number };
/** What a step asks the server to make: store the session, store an asset, record a request to remove, write an audit event. */
export type Effect =
  | { readonly kind: "put-session"; readonly session: EnrollmentSession }
  | { readonly kind: "put-asset"; readonly asset: KnownAsset }
  | { readonly kind: "request-removal"; readonly assetId: string }
  | { readonly kind: "audit"; readonly event: AuditEvent };

/** A message of the dialogue. */
export type EnrollMessage =
  | { readonly type: "hello" }
  | { readonly type: "facts"; readonly facts: Facts }
  | { readonly type: "consent"; readonly granted: boolean }
  | { readonly type: "plan" }
  | { readonly type: "result"; readonly ok: boolean; readonly steps: readonly StepResult[] };

/** What a step needs besides the session. */
export type StepEnv = {
  readonly now: number;
  readonly enroll: EnrollPolicy;
  readonly assets: readonly KnownAsset[];
  /** The plan made for a device that a rule approved. */
  readonly planFor: (facts: Facts) => InstallPlan;
  readonly sourceIp: string;
};

/** What a step gives. */
export type StepOutcome = { readonly session: EnrollmentSession; readonly reply: Reply; readonly effects: readonly Effect[] };

/** A reply of one line: the words of the protocol, separated by tabs. */
export function line(...fields: readonly string[]): Reply {
  return { stdout: `${fields.join("\t")}\n`, stderr: "", exit: 0 };
}

/** The seconds the script waits between asking `next`. */
export const WAIT_SECONDS = 10;

function audit(env: StepEnv, session: EnrollmentSession, kind: AuditEvent["kind"], outcome: AuditEvent["outcome"], detail: string, rule?: number): Effect {
  return { kind: "audit", event: { at: env.now, kind, sourceIp: env.sourceIp, session: session.id, outcome, detail, ...(rule === undefined ? {} : { rule }) } };
}

function moved(s: EnrollmentSession, state: SessionState, now: number, more: Partial<EnrollmentSession> = {}): EnrollmentSession {
  return { ...s, ...more, state, updatedAt: now };
}

/** The legal moves between states: the table the state machine is held to. */
export const MOVES: Readonly<Record<SessionState, readonly SessionState[]>> = {
  pending: ["interrogated", "approved", "refused", "expired"],
  interrogated: ["approved", "refused", "expired"],
  approved: ["installing", "refused", "expired"],
  installing: ["enrolled", "approved", "refused", "expired"],
  enrolled: [],
  refused: [],
  expired: [],
};

/** Step the dialogue. An error is a message that does not belong in the state the session is in. */
export function step(session: EnrollmentSession, message: EnrollMessage, env: StepEnv): Result<StepOutcome, string> {
  if (!TERMINAL.includes(session.state) && env.now >= session.expiresAt) {
    const s = moved(session, "expired", env.now);
    return ok({ session: s, reply: line("EXPIRED"), effects: [{ kind: "put-session", session: s }, audit(env, s, "state", "ok", "expired")] });
  }
  switch (message.type) {
    case "hello":
      return ok({ session, reply: line("OK", session.state), effects: [] });
    case "facts": {
      if (session.state !== "pending" && session.state !== "interrogated") return err(`facts are not taken in the state ${session.state}`);
      const decision = decideEnrollment(env.enroll, session, message.facts, env.assets);
      const base = { facts: message.facts, ...(decision.assetId === undefined ? {} : { assetId: decision.assetId }) };
      if (decision.outcome === "approve") {
        const plan = env.planFor(message.facts);
        const s = moved(session, "approved", env.now, { ...base, plan, decision: { outcome: "approve", by: "policy", at: env.now, ...(decision.rule === undefined ? {} : { rule: decision.rule }), explanation: decision.explanation } });
        return ok({ session: s, reply: line("OK", "approved"), effects: [{ kind: "put-session", session: s }, audit(env, s, "decision", "ok", decision.explanation, decision.rule)] });
      }
      if (decision.outcome === "refuse") {
        const s = moved(session, "refused", env.now, { ...base, decision: { outcome: "refuse", by: "policy", at: env.now, ...(decision.rule === undefined ? {} : { rule: decision.rule }), explanation: decision.explanation } });
        return ok({ session: s, reply: line("REFUSED", "policy"), effects: [{ kind: "put-session", session: s }, audit(env, s, "decision", "refused", decision.explanation, decision.rule)] });
      }
      const s = moved(session, "interrogated", env.now, { ...base, decision: { outcome: "pending", by: "policy", at: env.now, explanation: decision.explanation } });
      return ok({ session: s, reply: line("OK", "interrogated"), effects: [{ kind: "put-session", session: s }, audit(env, s, "decision", "ok", decision.explanation)] });
    }
    case "plan": {
      switch (session.state) {
        case "pending":
        case "interrogated":
          return ok({ session, reply: line("WAIT", String(WAIT_SECONDS)), effects: [] });
        case "approved":
        case "installing":
          return ok({ session, reply: { stdout: planWire(session.id, session.plan ?? { steps: [] }), stderr: "", exit: 0 }, effects: [audit(env, session, "plan", "ok", "plan sent")] });
        case "refused":
          return ok({ session, reply: line("REFUSED", session.decision?.by === "policy" ? "policy" : "person"), effects: [] });
        case "enrolled":
          return ok({ session, reply: line("ENROLLED"), effects: [] });
        case "expired":
          return ok({ session, reply: line("EXPIRED"), effects: [] });
      }
      return err("unreachable");
    }
    case "consent": {
      if (session.state !== "approved") return err(`consent is not taken in the state ${session.state}`);
      if (message.granted) {
        const s = moved(session, "installing", env.now, { consent: true });
        return ok({ session: s, reply: line("OK", "installing"), effects: [{ kind: "put-session", session: s }, audit(env, s, "state", "ok", "the person at the device consented")] });
      }
      const s = moved(session, "refused", env.now, { consent: false, decision: { outcome: "refuse", by: "device", at: env.now, explanation: "the person at the device declined" } });
      return ok({ session: s, reply: line("REFUSED", "declined"), effects: [{ kind: "put-session", session: s }, audit(env, s, "state", "refused", "the person at the device declined")] });
    }
    case "result": {
      if (session.state !== "installing") return err(`a result is not taken in the state ${session.state}`);
      const failed = !message.ok || message.steps.some((r) => !r.ok);
      const s = moved(session, failed ? "approved" : "enrolled", env.now);
      const detail = failed ? `install failed at ${message.steps.filter((r) => !r.ok).map((r) => r.index).join(",") || "?"}` : "enrolled";
      return ok({ session: s, reply: line("OK", s.state), effects: [{ kind: "put-session", session: s }, audit(env, s, "state", failed ? "error" : "ok", detail)] });
    }
  }
}

/** The person approves a session with a plan (`by` names the person: an agent is not one and never calls this for itself). Allowed from `pending` and `interrogated`. */
export function approveSession(session: EnrollmentSession, by: string, plan: InstallPlan, now: number): Result<EnrollmentSession, string> {
  if (session.state !== "pending" && session.state !== "interrogated") return err(`a session in the state ${session.state} is not approved`);
  if (by.trim() === "") return err("a person's name is needed to approve");
  if (session.pairing !== undefined && session.pairing.confirmed !== true) return err("the pairing code of this session is not confirmed: use confirmPairing");
  return ok(moved(session, "approved", now, { plan, decision: { outcome: "approve", by, at: now, explanation: `approved by ${by}` } }));
}

/** The person refuses a session. */
export function refuseSession(session: EnrollmentSession, by: string, reason: string, now: number): Result<EnrollmentSession, string> {
  if (TERMINAL.includes(session.state)) return err(`a session in the state ${session.state} is not refused`);
  if (by.trim() === "") return err("a person's name is needed to refuse");
  return ok(moved(session, "refused", now, { decision: { outcome: "refuse", by, at: now, explanation: reason } }));
}

/** Read a message from the text a client sent on the standard input: one JSON line, at most `max` bytes. */
export function decodeMessage(command: "report" | "done", text: string, max: number): Result<EnrollMessage, string> {
  if (text.length > max) return err("the message is too large");
  let json: unknown;
  try {
    json = JSON.parse(text.trim());
  } catch {
    return err("the message is not JSON");
  }
  if (typeof json !== "object" || json === null) return err("the message is an object");
  const o = json as Record<string, unknown>;
  if (command === "report" && o["type"] === "facts") {
    const facts = decodeFacts(o["facts"]);
    return facts.kind === "ok" ? ok({ type: "facts", facts: facts.value }) : err(facts.error);
  }
  if (command === "report" && o["type"] === "consent") return typeof o["granted"] === "boolean" ? ok({ type: "consent", granted: o["granted"] }) : err("granted is true or false");
  if (command === "done" && o["type"] === "result") {
    const raw = o["steps"];
    if (typeof o["ok"] !== "boolean" || !Array.isArray(raw) || raw.length > 64) return err("a result has ok and up to 64 steps");
    const steps: StepResult[] = [];
    for (const r of raw) {
      const x = r as Record<string, unknown>;
      if (typeof x["index"] !== "number" || typeof x["ok"] !== "boolean" || typeof x["detail"] !== "string") return err("a step result has index, ok and detail");
      steps.push({ index: x["index"], ok: x["ok"], detail: x["detail"].slice(0, 200) });
    }
    return ok({ type: "result", ok: o["ok"], steps });
  }
  return err(`a message of type ${String(o["type"])} does not belong to ${command}`);
}
