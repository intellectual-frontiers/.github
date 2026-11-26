/**
 * Tests of the dialogue state machine and of the conversation that wraps it: every move of the table, every refusal, expiry, approve and refuse by a person.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import type { EnrollmentSession, SessionId, SessionState } from "@intellectual-frontiers/ssh-server/governance";
import { MOVES, approveSession, decodeMessage, enrollConversation, refuseSession, step } from "@intellectual-frontiers/ssh-server/logical";
import type { EnrollMessage, StepEnv } from "@intellectual-frontiers/ssh-server/logical";
import { syntheticFacts } from "./helpers.ts";

const env = (over: Partial<StepEnv> = {}): StepEnv => ({ now: 1000, enroll: { rules: [] }, assets: [], planFor: () => ({ steps: [{ kind: "run", argv: ["/bin/true"], as: "user", expect: [0] }] }), sourceIp: "10.0.0.2", ...over });
const session = (state: SessionState): EnrollmentSession => ({ id: "en-aaaaaaaaaaaaaaaa" as SessionId, state, sourceIp: "10.0.0.2", clientIdent: "SSH-2.0-OpenSSH_9.6", deviceClass: "openssh", offeredKeys: [], createdAt: 0, updatedAt: 0, expiresAt: 100_000 });
const STATES = Object.keys(MOVES) as SessionState[];
const messages: EnrollMessage[] = [{ type: "hello" }, { type: "facts", facts: syntheticFacts(1) }, { type: "consent", granted: true }, { type: "consent", granted: false }, { type: "plan" }, { type: "result", ok: true, steps: [] }, { type: "result", ok: false, steps: [{ index: 0, ok: false, detail: "x" }] }];

proves(["0002-enrollment-protocol FR-004"], "every state moves only by the table: the state after a step is the state or one the table allows, and the final states do not move", () => {
  for (const from of STATES) {
    for (const m of messages) {
      const r = step(session(from), m, env());
      if (r.kind === "err") continue;
      const to = r.value.session.state;
      assert(to === from || MOVES[from].includes(to), `${from} -> ${to} on ${m.type}`);
    }
  }
  for (const final of ["enrolled", "refused", "expired"] as const) {
    assertEquals(MOVES[final], []);
    for (const m of messages) {
      const r = step(session(final), m, env());
      if (r.kind === "ok") assertEquals(r.value.session.state, final);
    }
  }
});

proves(["0002-enrollment-protocol FR-004", "0002-enrollment-protocol FR-008"], "the path of an enrollment: facts, wait, approve, plan, consent, result; and a refusal, a decline and a failed install", () => {
  let s = session("pending");
  const facts = step(s, { type: "facts", facts: syntheticFacts(1) }, env());
  assert(facts.kind === "ok");
  assertEquals(facts.value.session.state, "interrogated");
  s = facts.value.session;
  assertEquals(step(s, { type: "plan" }, env()).kind === "ok" && (step(s, { type: "plan" }, env()) as { value: { reply: { stdout: string } } }).value.reply.stdout.startsWith("WAIT"), true);
  assertEquals(step(s, { type: "consent", granted: true }, env()).kind, "err", "no consent before approval");
  assertEquals(step(s, { type: "result", ok: true, steps: [] }, env()).kind, "err");
  const approved = approveSession(s, "synthetic-person-01", { steps: [{ kind: "run", argv: ["/bin/true"], as: "user", expect: [0] }] }, 2000);
  assert(approved.kind === "ok");
  s = approved.value;
  const plan = step(s, { type: "plan" }, env());
  assert(plan.kind === "ok" && plan.value.reply.stdout.startsWith("PLAN\t1\ten-aaaaaaaaaaaaaaaa\n"));
  assertEquals(step(s, { type: "result", ok: true, steps: [] }, env()).kind, "err", "no result before consent");
  const consent = step(s, { type: "consent", granted: true }, env());
  assert(consent.kind === "ok");
  s = consent.value.session;
  assertEquals(s.state, "installing");
  const failed = step(s, { type: "result", ok: false, steps: [{ index: 0, ok: false, detail: "x" }] }, env());
  assert(failed.kind === "ok");
  assertEquals(failed.value.session.state, "approved", "a failed install can be tried again");
  const done = step(s, { type: "result", ok: true, steps: [{ index: 0, ok: true, detail: "run" }] }, env());
  assert(done.kind === "ok");
  assertEquals(done.value.session.state, "enrolled");
  const declined = step(approved.value, { type: "consent", granted: false }, env());
  assert(declined.kind === "ok");
  assertEquals(declined.value.session.state, "refused");
  const refused = refuseSession(session("interrogated"), "synthetic-person-01", "no", 5);
  assert(refused.kind === "ok" && refused.value.state === "refused");
  assertEquals(refuseSession(session("enrolled"), "synthetic-person-01", "no", 5).kind, "err");
  assertEquals(approveSession(session("refused"), "synthetic-person-01", { steps: [] }, 5).kind, "err");
  assertEquals(approveSession(session("pending"), " ", { steps: [] }, 5).kind, "err", "a person is named");
});

proves(["0002-enrollment-protocol FR-004"], "a session past its time becomes expired, and every step carries its audit event", () => {
  const r = step(session("interrogated"), { type: "plan" }, env({ now: 200_000 }));
  assert(r.kind === "ok");
  assertEquals(r.value.session.state, "expired");
  assert(r.value.effects.some((e) => e.kind === "audit"));
  const ok = step(session("pending"), { type: "facts", facts: syntheticFacts(1) }, env());
  assert(ok.kind === "ok" && ok.value.effects.some((e) => e.kind === "audit" && e.event.kind === "decision"));
});

proves(["0002-enrollment-protocol FR-005"], "a message is one JSON line of the right type for its command and within its size", () => {
  const facts = JSON.stringify({ type: "facts", facts: syntheticFacts(1) });
  assertEquals(decodeMessage("report", facts, 100_000).kind, "ok");
  assertEquals(decodeMessage("report", facts, 100).kind, "err");
  assertEquals(decodeMessage("done", facts, 100_000).kind, "err", "facts do not belong to done");
  assertEquals(decodeMessage("report", "{", 100).kind, "err");
  assertEquals(decodeMessage("report", "null", 100).kind, "err");
  assertEquals(decodeMessage("report", '{"type":"consent","granted":"yes"}', 100).kind, "err");
  assertEquals(decodeMessage("report", '{"type":"consent","granted":true}', 100).kind, "ok");
  assertEquals(decodeMessage("done", '{"type":"result","ok":true,"steps":[{"index":0,"ok":true,"detail":"x"}]}', 1000).kind, "ok");
  assertEquals(decodeMessage("done", '{"type":"result","ok":true,"steps":[{"index":"0"}]}', 1000).kind, "err");
});

proves(["0002-enrollment-protocol FR-016"], "the enrollment is a conversation of the algebra: its step is the machine", () => {
  const c = enrollConversation(session("pending"), env());
  assertEquals(c.id, "enroll");
  assertEquals(c.account, "s-enroll");
  const r = c.step(c.initial, { type: "facts", facts: syntheticFacts(1) });
  assert(r.kind === "ok");
  assertEquals(r.value.state.state, "interrogated");
  assertEquals(r.value.out.length, 1);
});
