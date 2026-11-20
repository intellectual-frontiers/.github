/**
 * Tests of groups of entities (0009-grc-groups): identities and references, the scope and its applicability, the snapshot an entity gives, the reading of a group through per-entity readers, the group
 * view with its roll-ups, and the conformance of readers over per-entity ports that cannot see each other.
 *
 * @module
 */
import fc from "fast-check";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import {
  applicability,
  appliesTo,
  controlScope,
  entityGroup,
  entityId,
  portRef,
  scopeProblems,
  secretRef,
  type ControlScope,
  type EntityGroup,
  type EntityId,
} from "@intellectual-frontiers/grc/governance";
import {
  appendEntry,
  canonicalize,
  type EntityReader,
  type EntityReading,
  type EntitySnapshot,
  GROUP_COVERAGE_ORDER,
  groupView,
  joinCoverage,
  readGroup,
  snapshotOf,
  type GroupCoverage,
  STATUSES,
  standardKinds,
  type LedgerEntry,
} from "@intellectual-frontiers/grc/logical";
import { entityReader, type EntityPorts, type GroupMaterial } from "@intellectual-frontiers/grc/physical";
import { groupConformance, type EntityData, type GroupCase } from "@intellectual-frontiers/grc/conformance";
import { memoryStore } from "@intellectual-frontiers/grc/stores/memory";
import { aCheck, anException, A1, A2, AT, B1, aResult, ex, must, walk } from "./fixtures.ts";

const head = { schema: "1", createdAt: AT, provenance: { producer: { name: "test", version: "1" }, inputs: [] } };
const id = (text: string): EntityId => {
  const r = entityId(text);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};
const [UA, UB, UC] = [id("unit-a"), id("unit-b"), id("unit-c")];
const CONTROLS = [A1, A2, B1];

function entityOf(name: string): Record<string, unknown> {
  return { id: name, title: name, ledger: `ledger-${name}`, store: `store-${name}`, keys: [`key-${name}`], secrets: [`secret:${name}/signing`] };
}
const group: EntityGroup = must(entityGroup.decode, { ...head, kind: "grc.entity-group", id: "group", title: "Group", entities: ["unit-a", "unit-b", "unit-c"].map(entityOf) });
const scope: ControlScope = must(controlScope.decode, {
  ...head,
  kind: "grc.control-scope",
  id: "scope",
  group: "group",
  rules: [
    { control: A2, entities: { kind: "only", entities: ["unit-a"] } },
    { control: B1, entities: { kind: "except", entities: ["unit-c"] } },
  ],
});
const material: GroupMaterial = { frameworks: [ex], crosswalks: [walk], checks: [aCheck("c-a1", [A1]), aCheck("c-a2", [A2]), aCheck("c-b1", [B1])] };

async function dataOf(entity: EntityId, statuses: Readonly<Record<string, string>>): Promise<EntityData> {
  const results = Object.entries(statuses).map(([check, status]) => aResult(check, entity, status, { controls: [check === "c-a1" ? A1 : check === "c-a2" ? A2 : B1], value: { secret: "never-leaves" } }));
  let last: LedgerEntry | undefined;
  const ledger: LedgerEntry[] = [];
  for (const r of results) {
    last = await appendEntry(last, { at: AT, type: "observation", subject: r.subject, evidence: "ab".repeat(32) });
    ledger.push(last);
  }
  return { ledger, results, exceptions: [], store: memoryStore() };
}

async function theCase(): Promise<GroupCase> {
  const data = new Map<EntityId, EntityData>([
    [UA, await dataOf(UA, { "c-a1": "pass", "c-a2": "pass", "c-b1": "pass" })],
    [UB, await dataOf(UB, { "c-a1": "fail", "c-b1": "pass" })],
    [UC, await dataOf(UC, { "c-a1": "pass" })],
  ]);
  return { group, scope, material, data, exceptions: [], at: AT };
}

proves(["0009-grc-groups FR-001"], "identities and references are branded and made only by constructors; a secret's value is a decode error", () => {
  assertEquals(entityId("unit-a").kind, "ok");
  assertEquals(entityId("Unit A").kind, "err");
  assertEquals(portRef("ledger-a").kind, "ok");
  assertEquals(portRef("").kind, "err");
  assertEquals(secretRef("secret:unit-a/signing").kind, "ok");
  assertEquals(secretRef("hunter2").kind, "err");
  const bad = entityGroup.decode({ ...group, entities: [{ ...entityOf("unit-a"), secrets: ["hunter2"] }] });
  assert(bad.kind === "err" && bad.error.path.includes("secrets"), "the value of a secret is refused");
});

proves(["0009-grc-groups FR-002"], "a group document holds each entity with its ports as references, and is a registered kind", () => {
  assertEquals(
    group.entities.map((e) => [e.id, e.ledger, e.store, ...e.keys, ...e.secrets].map(String)),
    ["a", "b", "c"].map((n) => [`unit-${n}`, `ledger-unit-${n}`, `store-unit-${n}`, `key-unit-${n}`, `secret:unit-${n}/signing`]),
  );
  assert(standardKinds().has("grc.entity-group") && standardKinds().has("grc.control-scope") && standardKinds().has("grc.entity-snapshot"));
});

proves(["0009-grc-groups FR-003"], "a control no rule names applies to all; only and except select entities; the matrix is in the order given", () => {
  assertEquals(appliesTo(scope, A1, UC), "applies");
  assertEquals(appliesTo(scope, A2, UB), "not-applicable");
  assertEquals(appliesTo(scope, B1, UC), "not-applicable");
  assertEquals(applicability(group, scope, [A2, A1]).map((c) => `${c.control}/${c.entity}/${c.applicability}`), [
    `${A2}/unit-a/applies`,
    `${A2}/unit-b/not-applicable`,
    `${A2}/unit-c/not-applicable`,
    `${A1}/unit-a/applies`,
    `${A1}/unit-b/applies`,
    `${A1}/unit-c/applies`,
  ]);
});

proves(["0009-grc-groups FR-004"], "scopeProblems finds an unknown entity, an unknown control, a control scoped twice and an entity listed twice", () => {
  const bad = must(controlScope.decode, {
    ...head,
    kind: "grc.control-scope",
    id: "bad",
    group: "group",
    rules: [
      { control: A1, entities: { kind: "only", entities: ["unit-z", "unit-a", "unit-a"] } },
      { control: A1, entities: { kind: "all" } },
      { control: "urn:grc:ex:1:Z-9", entities: { kind: "all" } },
    ],
  });
  assertEquals(scopeProblems(group, bad, CONTROLS).map((p) => p.rule).sort(), ["scope/duplicate-control", "scope/duplicate-entity", "scope/unknown-control", "scope/unknown-entity"]);
  assertEquals(scopeProblems(group, scope, CONTROLS), []);
  const twice = must(entityGroup.decode, { ...group, entities: [entityOf("unit-a"), entityOf("unit-a")] });
  assertEquals(scopeProblems(twice, scope, CONTROLS).map((p) => p.rule), ["entity/duplicate", "scope/unknown-entity"]);
});

proves(["0009-grc-groups FR-005"], "an exception of a control for an entity turns its fail into accepted while it is in force, and only for that entity", async () => {
  const c = await theCase();
  const readings = await readGroup(group, readersOf(c), AT);
  const e = anException({ id: "exc-ua", excuses: { type: "control", ref: A1 }, subjects: ["unit-b"], grantedAt: "2026-05-01T00:00:00Z", expiresAt: "2026-07-01T00:00:00Z" });
  const at = (when: string) => groupView({ group, scope, controls: CONTROLS, readings, exceptions: [e], at: when }).cells.find((x) => x.control === A1 && x.entity === UB)?.status;
  assertEquals(at(AT), "accepted");
  assertEquals(at("2026-08-01T00:00:00Z"), "fail");
  assertEquals(groupView({ group, scope, controls: CONTROLS, readings, exceptions: [e], at: AT }).cells.find((x) => x.control === A1 && x.entity === UA)?.status, "pass");
});

proves(["0009-grc-groups FR-006"], "a snapshot holds statuses and digests only: no evidence payload, no secret, and nothing it was not made of", async () => {
  const d = await dataOf(UA, { "c-a1": "pass" });
  const s = await snapshotOf({ entity: UA, ...material, results: d.results, exceptions: [], ledgerHead: "ab".repeat(32) }, AT);
  assert(s.kind === "ok");
  const text = JSON.stringify(s.value);
  assert(!text.includes("never-leaves") && !text.includes("secret"), "no payload and no secret");
  const first = s.value.controls.find((x) => x.control === A1);
  assertEquals(Object.keys(first ?? {}).sort(), ["control", "coverage", "digests", "observedAt", "severity", "status"]);
  assertEquals(first?.digests.length, 1);
  assertEquals(s.value.controls.find((x) => x.control === A2)?.status, "gap");
  assertEquals((await snapshotOf({ entity: UA, ...material, results: [], exceptions: [], ledgerHead: "" }, "yesterday")).kind, "err");
});

function readersOf(c: GroupCase): ReadonlyMap<EntityId, EntityReader> {
  return new Map([...c.data].map(([e, d]) => [e, entityReader({ entity: e, ledger: { entries: () => Promise.resolve(d.ledger) }, results: { list: () => Promise.resolve(d.results) }, exceptions: { list: () => Promise.resolve(d.exceptions) }, store: d.store }, c.material)]));
}

proves(["0009-grc-groups FR-007"], "a reader that rejects, throws, answers for another entity or is missing is a fault, and a field that is not known never passes through", async () => {
  const c = await theCase();
  const good = readersOf(c);
  const ua = good.get(UA);
  const ub = good.get(UB);
  assert(ua !== undefined && ub !== undefined);
  const readers = new Map<EntityId, EntityReader>([
    [UA, async (at) => {
      const r = await ua(at);
      return r.kind === "ok" ? { kind: "ok", value: { ...r.value, payload: "never-leaves" } as EntitySnapshot } : r;
    }],
    [UB, () => Promise.reject(new Error("down"))],
  ]);
  const readings = await readGroup(group, readers, AT);
  assertEquals(readings.map((r) => r.kind), ["read", "unread", "unread"]);
  assert(!JSON.stringify(readings[0]).includes("never-leaves"));
  const faults = readings.flatMap((r) => (r.kind === "unread" ? [r.fault.kind + ":" + r.fault.message] : []));
  assertEquals(faults, ["unreachable:down", "unreachable:no reader for unit-c"]);
  const wrong = await readGroup(group, new Map([[UC, (at: string) => ub(at)]]), AT);
  const wrongC = wrong.find((r) => r.kind === "unread" && r.entity === UC);
  assertEquals(wrongC?.kind === "unread" ? wrongC.fault.kind : undefined, "malformed");
  const throwing = await readGroup(group, new Map([[UA, () => { throw new Error("sync"); }]]), AT);
  assertEquals(throwing.filter((r) => r.kind === "unread").length, 3);
  const denied = await readGroup(group, new Map([[UA, () => Promise.resolve({ kind: "err" as const, error: { kind: "denied" as const, message: "no" } })]]), AT);
  assertEquals(denied[0]?.kind === "unread" && denied[0].fault.kind, "denied");
});

proves(["0009-grc-groups FR-008"], "cells are not-applicable by scope, pending for an unread entity, gap for a read entity with no state, and the entity's status otherwise", async () => {
  const c = await theCase();
  const readings = (await readGroup(group, readersOf(c), AT)).filter((r) => entityOf2(r) !== "unit-c");
  const v = groupView({ group, scope, controls: CONTROLS, readings, exceptions: [], at: AT });
  const cell = (control: string, e: EntityId) => v.cells.find((x) => x.control === control && x.entity === e);
  assertEquals(cell(A2, UB)?.status, "not-applicable");
  assertEquals(cell(A1, UC)?.status, "pending");
  assertEquals(cell(A1, UC)?.coverage, "unknown");
  assertEquals(cell(A2, UA)?.status, "pass");
  assertEquals(cell(B1, UB)?.status, "pass");
  assertEquals(cell(A1, UB)?.status, "fail");
  const gap = groupView({ group, scope, controls: CONTROLS, readings: await readGroup(group, readersOf(c), AT), exceptions: [], at: AT });
  assertEquals(gap.cells.find((x) => x.control === A1 && x.entity === UC)?.status, "pass");
  assertEquals(gap.cells.find((x) => x.control === B1 && x.entity === UB)?.status, "pass");
  assertEquals(gap.cells.find((x) => x.control === A2 && x.entity === UA)?.status, "pass");
  const lonely = (await dataOf(UA, {}));
  const nothing = await snapshotOf({ entity: UA, ...material, results: lonely.results, exceptions: [], ledgerHead: "" }, AT);
  assert(nothing.kind === "ok");
  assertEquals(groupView({ group, scope, controls: CONTROLS, readings: [{ kind: "read", snapshot: nothing.value }], exceptions: [], at: AT }).cells.find((x) => x.control === A1 && x.entity === UA)?.status, "gap");
});

function entityOf2(r: EntityReading): string {
  return r.kind === "read" ? r.snapshot.entity : r.entity;
}

proves(["0009-grc-groups FR-009"], "the roll-ups join cells, coverage is worst-of with unknown below failing, and the view is the same for any order", async () => {
  const c = await theCase();
  const readings = await readGroup(group, readersOf(c), AT);
  const v = groupView({ group, scope, controls: CONTROLS, readings, exceptions: [], at: AT });
  assertEquals(v.controls.find((x) => x.control === A1)?.status, "fail");
  assertEquals(v.controls.find((x) => x.control === A1)?.coverage, "failing");
  assertEquals(v.entities.find((x) => x.entity === UB)?.status, "fail");
  assertEquals(v.overall.worst, "fail");
  assertEquals(v.controls.find((x) => x.control === A2)?.applicable, 1);
  const empty = must(entityGroup.decode, { ...group, entities: [] });
  const none = groupView({ group: empty, scope, controls: CONTROLS, readings: [], exceptions: [], at: AT });
  assertEquals([none.cells.length, none.overall.worst, none.controls[0]?.coverage], [0, "not-applicable", "not-applicable"]);
  const co = fc.constantFrom<GroupCoverage>(...GROUP_COVERAGE_ORDER);
  fc.assert(fc.property(co, co, co, (a, b, d) => joinCoverage(a, b) === joinCoverage(b, a) && joinCoverage(joinCoverage(a, b), d) === joinCoverage(a, joinCoverage(b, d)) && joinCoverage(a, a) === a));
  assert(GROUP_COVERAGE_ORDER.indexOf("unknown") > GROUP_COVERAGE_ORDER.indexOf("partial") && GROUP_COVERAGE_ORDER.indexOf("unknown") < GROUP_COVERAGE_ORDER.indexOf("failing"));
  fc.assert(
    fc.property(fc.shuffledSubarray([...readings], { minLength: readings.length }), fc.shuffledSubarray(CONTROLS, { minLength: 3 }), (rs, cs) => {
      const w = groupView({ group, scope, controls: cs, readings: rs, exceptions: [], at: AT });
      return canonicalize(w) === canonicalize(v);
    }),
  );
});

proves(["0009-grc-groups FR-008", "0009-grc-groups FR-009"], "an entity that cannot be read is never an assumed pass, whatever the others are", async () => {
  const c = await theCase();
  const snaps = (await readGroup(group, readersOf(c), AT)).flatMap((r) => (r.kind === "read" ? [r] : []));
  fc.assert(
    fc.property(fc.subarray([...snaps]), (kept) => {
      const dropped = snaps.filter((s) => !kept.includes(s)).map((s) => s.snapshot.entity);
      const v = groupView({ group, scope, controls: CONTROLS, readings: kept, exceptions: [], at: AT });
      const unread = v.cells.filter((x) => dropped.includes(x.entity) && x.status !== "not-applicable");
      const worstIdx = STATUSES.indexOf(v.overall.worst);
      return unread.every((x) => x.status === "pending" && x.coverage === "unknown") && (unread.length === 0 || worstIdx >= STATUSES.indexOf("pending"));
    }),
  );
});

proves(["0009-grc-groups FR-010"], "the group learns of an entity through its reader alone: a view is made from readings with no port in sight", async () => {
  const c = await theCase();
  const snap = await snapshotOf({ entity: UA, ...material, results: [], exceptions: [], ledgerHead: "" }, AT);
  assert(snap.kind === "ok");
  const only = groupView({ group, scope, controls: CONTROLS, readings: [{ kind: "read", snapshot: snap.value }], exceptions: [], at: AT });
  assertEquals(only.entities.map((e) => [e.entity, e.reading]), [["unit-a", "read"], ["unit-b", "unread"], ["unit-c", "unread"]]);
  assert(c.data.size === 3);
});

proves(["0009-grc-groups FR-011"], "the conformance passes the reference reader over per-entity stores that cannot see each other, and finds a reader that touches another entity", async () => {
  const c = await theCase();
  assertEquals(await groupConformance(c), []);
  const all = new Map<EntityId, EntityPorts>();
  const cheat = (ports: EntityPorts, m: GroupMaterial): EntityReader => {
    all.set(ports.entity, ports);
    const own = entityReader(ports, m);
    return async (at) => {
      const other = [...all.values()].find((p) => p.entity !== ports.entity);
      if (other !== undefined) await other.results.list();
      return own(at);
    };
  };
  const failures = await groupConformance(c, cheat);
  assert(failures.some((f) => f.suite === "group" && f.message.includes("touched the results of")), JSON.stringify(failures));
  const broken = await groupConformance(c, () => () => Promise.resolve({ kind: "err", error: { kind: "unreachable", message: "x" } }));
  assert(broken.some((f) => f.name === "every entity is read"));
});
