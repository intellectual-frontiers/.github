/**
 * What the tests of Planning share: a result taken or the test failed, a fixed replica and clock, the actors of a history, and the generators of histories of events (commons planning 0002-planning-core).
 *
 * @module
 */
import fc from "fast-check";
import type { Result } from "@intellectual-frontiers/core";
import { parseReplicaId, type ReplicaId } from "@intellectual-frontiers/anyfs/governance";
import {
  type Actor,
  type ActorRole,
  actorFor,
  type AuthorityField,
  AUTHORITY_FIELDS,
  type EventData,
  type EventId,
  type EventType,
  type FieldAuthority,
  FIELD_AUTHORITIES,
  type Instant,
  type ItemEvent,
  type ItemId,
  makeEvent,
  type Policy,
  parseDay,
  parseInstant,
  type PersonActor,
  person,
} from "@intellectual-frontiers/planning/governance";
import { mintEventId, mintItemId, newClock, type Clock } from "@intellectual-frontiers/planning/logical";

/** The value of a success; a failure fails the test with what it says. */
export function must<T, E>(result: Result<T, E>): T {
  if (result.kind === "err") throw new Error(`a result was expected to succeed: ${JSON.stringify(result.error)}`);
  return result.value;
}

/** The replica of the tests. */
export const REPLICA: ReplicaId = must(parseReplicaId("0123456789abcdef0123456789abcdef"));
/** A second replica. */
export const OTHER_REPLICA: ReplicaId = must(parseReplicaId("fedcba9876543210fedcba9876543210"));
/** A wall time of the tests, in milliseconds. */
export const WALL = 1_760_000_000_000;

/** The people, the agent and the tool of a history. */
export const ADA: PersonActor = must(person("ada@example.test", "Ada"));
export const BOB: PersonActor = must(person("bob@example.test", "Bob"));
/** The actors a history draws from: two people, an agent acting for Ada and a tool. */
export const ACTORS: readonly Actor[] = [
  ADA,
  BOB,
  must(actorFor({ kind: "session", person: ADA }, { kind: "agent", id: "claude", name: "Claude" })),
  must(actorFor({ kind: "session", person: BOB }, { kind: "tool", id: "scanner", name: "Scanner" })),
];

/** The clock of a fresh replica. */
export const clock = (replica: ReplicaId = REPLICA): Clock => newClock(replica);

/** `count` event ids, in the order they were made, from one clock at one wall time (so that the counter orders them). */
export function eventIds(count: number, replica: ReplicaId = REPLICA, wall: number = WALL): readonly EventId[] {
  let c = clock(replica);
  const out: EventId[] = [];
  for (let i = 0; i < count; i++) {
    const m = must(mintEventId(c, wall));
    c = m.clock;
    out.push(m.id);
  }
  return out;
}

/** An item id. */
export const itemId = (n = 0): ItemId => must(mintItemId(clock(OTHER_REPLICA), WALL + n)).id;

/** Another item. */
export const other: ItemId = itemId(1);

/** The time of the n-th event: a second after the one before. */
export const at = (n: number): Instant => must(parseInstant(new Date(WALL + n * 1000).toISOString().slice(0, 19) + "Z"));

/** An event of an item, made at the n-th second with the given id. */
export function event(item: ItemId, id: ItemEvent["id"], n: number, actor: Actor, data: EventData): ItemEvent {
  return must(makeEvent({ id, item, at: at(n), actor }, data));
}

/** One datum of each type: a table typed by the union, so that a type with no row does not compile. */
export const SAMPLES: { readonly [T in EventType]: Extract<EventData, { readonly type: T }> } = {
  opened: { type: "opened", kind: "task", title: "T", body: "B", labels: ["l"], assignees: ["a"], origin: "declared", severity: "warning", motivation: "commenting", blocker: false, target: { file: "f", page: 2, quote: "q" }, source: { tool: "t", line: 3 }, priority: "P2", size: "m", goals: ["G1"], engines: ["duckdb"], cites: ["FR-1"], evidence: ["commit abc"], sourceSeverity: "high" },
  commented: { type: "commented", body: "c" },
  edited: { type: "edited", title: "t2" },
  labeled: { type: "labeled", add: ["x"], remove: [] },
  assigned: { type: "assigned", add: [], remove: ["a"] },
  "severity-set": { type: "severity-set", severity: "error" },
  "blocker-set": { type: "blocker-set", blocker: true },
  started: { type: "started" },
  deferred: { type: "deferred", until: must(parseDay("2027-01-01")), reason: "later" },
  closed: { type: "closed", reason: "completed" },
  reopened: { type: "reopened" },
  decided: { type: "decided", verdict: "accept", note: "n" },
  linked: { type: "linked", change: "add", link: "blocks", to: other },
  confirmed: { type: "confirmed" },
};

const WORDS = ["alpha", "beta", "gamma", "delta"] as const;
const word = fc.constantFrom(...WORDS);
const actorIx = fc.integer({ min: 0, max: ACTORS.length - 1 });

/** A step of a history: which type of event, by which actor, with which words. */
export const stepArb = fc.record({ type: fc.integer({ min: 0, max: 12 }), actor: actorIx, a: word, b: word, other: fc.integer({ min: 0, max: 3 }) });
/** One step. */
export type Step = { readonly type: number; readonly actor: number; readonly a: (typeof WORDS)[number]; readonly b: (typeof WORDS)[number]; readonly other: number };

/** The data of the n-th kind of event after the opening. */
export function dataOfStep(s: Step, linkTargets: readonly ItemId[]): EventData {
  switch (s.type) {
    case 0:
      return { type: "commented", body: s.a };
    case 1:
      return { type: "edited", title: s.a, body: s.b };
    case 2:
      return { type: "edited", title: s.b };
    case 3:
      return { type: "labeled", add: [s.a], remove: [s.b] };
    case 4:
      return { type: "assigned", add: [s.a], remove: [s.b] };
    case 5:
      return { type: "severity-set", severity: s.other === 0 ? "error" : s.other === 1 ? "warning" : "note" };
    case 6:
      return { type: "blocker-set", blocker: s.other % 2 === 0 };
    case 7:
      return { type: "started" };
    case 8:
      return { type: "deferred", until: must(parseDay("2027-01-0" + String(1 + s.other))), reason: s.a };
    case 9:
      return { type: "closed", reason: s.other === 0 ? "completed" : s.other === 1 ? "not-planned" : "duplicate" };
    case 10:
      return { type: "reopened" };
    case 11:
      return { type: "decided", verdict: s.other === 0 ? "accept" : s.other === 1 ? "minor-revision" : s.other === 2 ? "major-revision" : "reject", note: s.a };
    default: {
      const to = linkTargets[s.other % linkTargets.length];
      return to === undefined ? { type: "commented", body: s.b } : { type: "linked", change: s.other % 2 === 0 ? "add" : "remove", link: s.other < 2 ? "relates-to" : "same-as", to };
    }
  }
}

/** A history: an opening by an actor, as declared or inferred, and then steps by actors of the pool; the ids are made in order, so that the order of the id is the order of the list. */
export function history(item: ItemId, origin: "declared" | "derived" | "inferred", opener: number, steps: readonly Step[], extra: readonly ItemId[] = []): readonly ItemEvent[] {
  const ids = eventIds(steps.length + 1);
  const first = ids[0];
  const openerActor = ACTORS[opener % ACTORS.length];
  if (first === undefined || openerActor === undefined) throw new Error("a history has an opening");
  const out: ItemEvent[] = [
    event(item, first, 0, openerActor, { type: "opened", kind: "issue", title: "Title", body: "Body", labels: ["alpha"], assignees: [], origin, severity: "note" }),
  ];
  steps.forEach((s, i) => {
    const id = ids[i + 1];
    const actor = ACTORS[s.actor];
    if (id === undefined || actor === undefined) return;
    const data = dataOfStep(s, extra);
    // A confirmation is the one event only a person makes; the generator never asks another.
    out.push(makeEvent({ id, item, at: at(i + 1), actor }, data).kind === "ok" ? event(item, id, i + 1, actor, data) : event(item, id, i + 1, ADA, data));
  });
  return out;
}

/** A policy: an authority or none for each field, and who confirms. */
export const policyArb: fc.Arbitrary<Policy> = fc
  .tuple(fc.array(fc.option(fc.constantFrom(...FIELD_AUTHORITIES), { nil: undefined }), { minLength: AUTHORITY_FIELDS.length, maxLength: AUTHORITY_FIELDS.length }), fc.constantFrom("any-person" as const, "principal" as const))
  .map(([list, confirmers]) => {
    const authority: { [F in AuthorityField]?: FieldAuthority } = {};
    AUTHORITY_FIELDS.forEach((f, i) => {
      const a = list[i];
      if (a !== undefined) authority[f] = a;
    });
    return { authority, confirmers };
  });

/** A role to make an actor of. */
export const roles: readonly ActorRole[] = [{ kind: "person" }, { kind: "agent", id: "claude", name: "Claude" }, { kind: "tool", id: "scanner", name: "Scanner" }];

/** The arbitrary history of one item. */
export const historyArb = fc.record({
  origin: fc.constantFrom("declared" as const, "derived" as const, "inferred" as const),
  opener: actorIx,
  steps: fc.array(stepArb, { minLength: 0, maxLength: 24 }),
});
