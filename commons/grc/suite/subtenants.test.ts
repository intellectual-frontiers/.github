/**
 * Tests of subtenants (0012-grc-subtenants): the tree of entities and its faults, the inheritance of a control's scope with the nearest explicit rule winning, the inheritable exception, the roll-up of a
 * subtenant's snapshot into its parent's status (with properties over random trees), and the conformance of readers over trees whose per-entity ports cannot see each other.
 *
 * @module
 */
import fc from "fast-check";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import {
  applicability,
  appliesTo,
  controlScope,
  entityDecoder,
  entityGroup,
  entityId,
  entityTree,
  exceptionCovers,
  scopeProblems,
  type ControlScope,
  type Entity,
  type EntityGroup,
  type EntityId,
  type EntityTree,
  type TreeFault,
} from "@intellectual-frontiers/grc/governance";
import {
  appendEntry,
  canonicalize,
  type CoverageState,
  entitySnapshot,
  type EntityReader,
  type EntityReading,
  type EntitySnapshot,
  GROUP_COVERAGE_ORDER,
  groupView,
  type GroupView,
  type LedgerEntry,
  readGroup,
  STATUSES,
  type Status,
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

function record(name: string, parent?: string): Record<string, unknown> {
  return { id: name, title: name, ledger: `ledger-${name}`, store: `store-${name}`, keys: [], secrets: [], ...(parent === undefined ? {} : { parent }) };
}
/** An entity that need not belong to a sound group. */
const entityRec = (name: string, parent?: string): Entity => must(entityDecoder, record(name, parent));
/** A group from `[entity, parent?]` pairs. */
function groupOf(pairs: readonly (readonly [string, string?])[]): EntityGroup {
  return must(entityGroup.decode, { ...head, kind: "grc.entity-group", id: "group", title: "Group", entities: pairs.map(([n, p]) => record(n, p)) });
}
function treeOf(g: EntityGroup): EntityTree {
  const r = entityTree(g);
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
}
function scopeOf(rules: readonly Record<string, unknown>[]): ControlScope {
  return must(controlScope.decode, { ...head, kind: "grc.control-scope", id: "scope", group: "group", rules });
}
const faultOf = (g: EntityGroup): TreeFault | undefined => {
  const r = entityTree(g);
  return r.kind === "err" ? r.error : undefined;
};

/**
 * org
 *  - unit-a
 *     - unit-a1
 *     - unit-a2
 *  - unit-b
 * solo
 */
const PAIRS = [["org"], ["unit-a", "org"], ["unit-b", "org"], ["unit-a1", "unit-a"], ["unit-a2", "unit-a"], ["solo"]] as const satisfies readonly (readonly [string, string?])[];
const group = groupOf(PAIRS);
const tree = treeOf(group);
const [ORG, UA, UB, UA1, UA2, SOLO] = ["org", "unit-a", "unit-b", "unit-a1", "unit-a2", "solo"].map(id) as [EntityId, EntityId, EntityId, EntityId, EntityId, EntityId];
const CONTROLS = [A1, A2, B1];

const COVERAGE: Readonly<Record<Status, CoverageState>> = { "not-applicable": "covered", pass: "covered", accepted: "accepted", pending: "untested", warn: "partial", gap: "gap", fail: "failing", error: "failing" };
function snap(entity: EntityId, status: Status): EntitySnapshot {
  return must(entitySnapshot.decode, {
    ...head,
    kind: "grc.entity-snapshot",
    id: `snapshot:${entity}`,
    entity,
    ledgerHead: "head",
    controls: [{ control: A1, status, coverage: COVERAGE[status], severity: "medium", digests: [] }],
  });
}
const read = (entity: EntityId, status: Status): EntityReading => ({ kind: "read", snapshot: snap(entity, status) });
const unread = (entity: EntityId): EntityReading => ({ kind: "unread", entity, fault: { kind: "unreachable", message: "down" } });
const view = (t: EntityTree, readings: readonly EntityReading[], scope: ControlScope = scopeOf([]), exceptions: Parameters<typeof groupView>[0]["exceptions"] = []): GroupView =>
  groupView({ tree: t, scope, controls: [A1], readings, exceptions, at: AT });
const row = (v: GroupView, e: EntityId) => v.entities.find((x) => x.entity === e);
const idx = (s: Status): number => STATUSES.indexOf(s);

proves(["0012-grc-subtenants FR-001"], "an entity holds at most one parent, and the decoder refuses an unknown parent, a cycle and a self-parent", () => {
  assertEquals(group.entities.map((e) => e.parent ?? null), [null, "org", "org", "unit-a", "unit-a", null]);
  const refused = (pairs: readonly (readonly [string, string?])[]): string | undefined => {
    const r = entityGroup.decode({ ...head, kind: "grc.entity-group", id: "g", title: "G", entities: pairs.map(([n, p]) => record(n, p)) });
    return r.kind === "err" ? r.error.expected : undefined;
  };
  assert(refused([["a", "ghost"]])?.includes("ghost") === true, "an unknown parent is refused");
  assert(refused([["a", "b"], ["b", "a"]])?.includes("each other's ancestors") === true, "a cycle is refused");
  assert(refused([["a", "a"]])?.includes("its own parent") === true, "a self-parent is a cycle");
  assertEquals(refused([["a"], ["b", "a"]]), undefined);
  const notId = entityGroup.decode({ ...head, kind: "grc.entity-group", id: "g", title: "G", entities: [record("a", "Not An Id")] });
  assert(notId.kind === "err" && notId.error.path.includes("parent"), "a parent is an EntityId");
});

proves(["0012-grc-subtenants FR-002"], "entityTree is the one constructor; its faults are duplicate, unknown parent and cycle; the same group in any order gives the same tree", () => {
  assertEquals([...tree.roots], [ORG, SOLO]);
  assertEquals([...tree.ancestorsOf(UA1)], [UA, ORG]);
  assertEquals([...tree.descendantsOf(ORG)], [UA, UA1, UA2, UB]);
  assertEquals([...tree.childrenOf(UA)], [UA1, UA2]);
  assertEquals([tree.parentOf(UA1), tree.parentOf(ORG), tree.depthOf(UA2)], [UA, undefined, 2]);
  assertEquals(faultOf({ ...group, entities: [...group.entities, ...group.entities.slice(0, 1)] }), { kind: "duplicate-entity", entity: ORG });
  const [a, b, c] = [id("a"), id("b"), id("c")];
  assertEquals(faultOf({ ...group, entities: [entityRec("a", "ghost")] }), { kind: "unknown-parent", entity: a, parent: id("ghost") });
  const cyc: EntityGroup = { ...group, entities: [entityRec("c", "a"), entityRec("a", "b"), entityRec("b", "c")] };
  assertEquals(faultOf(cyc), { kind: "cycle", entities: [a, b, c] });
  fc.assert(
    fc.property(fc.shuffledSubarray([...group.entities], { minLength: group.entities.length }), (es) => {
      const t = treeOf({ ...group, entities: es });
      return canonicalize([t.entities, t.roots, t.entities.map((e) => [t.ancestorsOf(e), t.descendantsOf(e)])]) === canonicalize([tree.entities, tree.roots, tree.entities.map((e) => [tree.ancestorsOf(e), tree.descendantsOf(e)])]);
    }),
  );
});

proves(["0012-grc-subtenants FR-003"], "scopeProblems finds an unknown parent and a cycle in a group the decoder did not make", () => {
  const bad: EntityGroup = { ...group, entities: [entityRec("a", "ghost"), entityRec("b", "c"), entityRec("c", "b")] };
  assertEquals(scopeProblems(bad, scopeOf([]), CONTROLS).map((p) => `${p.rule}:${p.id}`), ["entity/unknown-parent:a", "entity/parent-cycle:b,c"]);
  assertEquals(scopeProblems(group, scopeOf([]), CONTROLS), []);
});

proves(["0012-grc-subtenants FR-004"], "a rule holds an optional anchor and an inherit flag; a name in a selector stands for its subtenants only where it inherits", () => {
  const r = controlScope.decode({ ...head, kind: "grc.control-scope", id: "s", group: "g", rules: [{ control: A1, for: "unit-a", inherit: false, entities: { kind: "all" } }] });
  assert(r.kind === "ok" && r.value.rules[0]?.for === "unit-a" && r.value.rules[0].inherit === false);
  assertEquals(controlScope.decode({ ...head, kind: "grc.control-scope", id: "s", group: "g", rules: [{ control: A1, inherit: "no", entities: { kind: "all" } }] }).kind, "err");
  assertEquals(controlScope.decode({ ...head, kind: "grc.control-scope", id: "s", group: "g", rules: [{ control: A1, for: "Not An Id", entities: { kind: "all" } }] }).kind, "err");
  const only = scopeOf([{ control: A1, entities: { kind: "only", entities: ["unit-a"] } }]);
  const literal = scopeOf([{ control: A1, inherit: false, entities: { kind: "only", entities: ["unit-a"] } }]);
  assertEquals(tree.entities.map((e) => appliesTo(only, tree, A1, e)), ["not-applicable", "not-applicable", "applies", "applies", "applies", "not-applicable"]);
  assertEquals(tree.entities.map((e) => appliesTo(literal, tree, A1, e)), ["not-applicable", "not-applicable", "applies", "not-applicable", "not-applicable", "not-applicable"]);
});

proves(["0012-grc-subtenants FR-005"], "the nearest explicit rule decides: a scoped parent reaches its subtenants, an entity's own rule wins, and a control no rule names applies", () => {
  const all = (e: readonly EntityId[], s: ControlScope) => e.map((x) => appliesTo(s, tree, A1, x));
  const parent = scopeOf([{ control: A1, entities: { kind: "only", entities: ["unit-a"] } }]);
  assertEquals(all([UA1, UA2, UB, ORG], parent), ["applies", "applies", "not-applicable", "not-applicable"]);
  const carved = scopeOf([
    { control: A1, entities: { kind: "only", entities: ["unit-a"] } },
    { control: A1, for: "unit-a2", entities: { kind: "only", entities: [] } },
  ]);
  assertEquals(all([UA, UA1, UA2], carved), ["applies", "applies", "not-applicable"]);
  const exceptParent = scopeOf([{ control: A1, entities: { kind: "except", entities: ["unit-a"] } }, { control: A1, for: "unit-a1", entities: { kind: "all" } }]);
  assertEquals(all([UA, UA1, UA2, UB], exceptParent), ["not-applicable", "applies", "not-applicable", "applies"]);
  const selfOnly = scopeOf([{ control: A1, for: "unit-a", inherit: false, entities: { kind: "only", entities: [] } }]);
  assertEquals(all([UA, UA1, UB], selfOnly), ["not-applicable", "applies", "applies"]);
  assertEquals(tree.entities.map((e) => appliesTo(parent, tree, A2, e)), tree.entities.map(() => "applies"));
  assertEquals(applicability(tree, parent, [A2, A1]).map((c) => `${c.control}/${c.entity}`).slice(5, 8), [`${A2}/unit-b`, `${A1}/org`, `${A1}/solo`]);
});

const shapes = fc
  .array(fc.option(fc.nat(100), { nil: undefined }), { minLength: 1, maxLength: 9 })
  .map((xs): readonly (readonly [string, string?])[] => xs.map((x, i) => (x === undefined || i === 0 ? [`n${i}`] : [`n${i}`, `n${x % i}`])));
const selectors = (names: readonly string[]) =>
  fc.oneof(
    fc.constant({ kind: "all" }),
    fc.record({ kind: fc.constant("only"), entities: fc.subarray([...names]) }),
    fc.record({ kind: fc.constant("except"), entities: fc.subarray([...names]) }),
  );

proves(["0012-grc-subtenants FR-005"], "property: a rule for an entity decides it and its subtenants whatever the rules above say, and leaves every other entity as it was", () => {
  fc.assert(
    fc.property(
      shapes,
      fc.nat(100),
      fc.boolean(),
      fc.boolean(),
      fc.array(fc.tuple(fc.nat(100), fc.boolean(), fc.nat(3)), { maxLength: 4 }),
      fc.nat(3),
      (pairs, pick, verdict, inherit, base, sel) => {
        const g = groupOf(pairs);
        const t = treeOf(g);
        const names = pairs.map(([n]) => n);
        const x = id(names[pick % names.length] ?? "n0");
        const rule = (entity: string | undefined, inh: boolean, kind: number, list: readonly string[]): Record<string, unknown> => ({
          control: A1,
          ...(entity === undefined ? {} : { for: entity }),
          ...(inh ? {} : { inherit: false }),
          entities: kind === 0 ? { kind: "all" } : kind === 1 ? { kind: "only", entities: list } : { kind: "except", entities: list },
        });
        const seen = new Set<string>();
        const baseRules = base.flatMap(([i, inh, kind]) => {
          const anchor = names[i % names.length] ?? "n0";
          if (anchor === x || seen.has(anchor)) return [];
          seen.add(anchor);
          return [rule(anchor, inh, kind, [anchor])];
        });
        const groupRule = rule(undefined, true, sel, [names[0] ?? "n0"]);
        const before = scopeOf([groupRule, ...baseRules]);
        const word = { kind: verdict ? "all" : "only", ...(verdict ? {} : { entities: [] }) };
        const after = scopeOf([groupRule, ...baseRules, { control: A1, for: x, ...(inherit ? {} : { inherit: false }), entities: word }]);
        const want = verdict ? "applies" : "not-applicable";
        const subtree = new Set<EntityId>([x, ...t.descendantsOf(x)]);
        const anchors = new Set(baseRules.map((r) => String(r["for"])));
        return t.entities.every((e) => {
          const now = appliesTo(after, t, A1, e);
          if (!subtree.has(e)) return now === appliesTo(before, t, A1, e);
          if (e === x) return now === want;
          if (!inherit) return now === appliesTo(before, t, A1, e);
          const shadowed = [e, ...t.ancestorsOf(e)].some((y) => y !== x && subtree.has(y) && anchors.has(y) && [e, ...t.ancestorsOf(e)].indexOf(y) < [e, ...t.ancestorsOf(e)].indexOf(x));
          return shadowed || now === want;
        });
      },
    ),
  );
});

proves(["0012-grc-subtenants FR-005"], "property: a group rule that names an entity reaches its subtenants, and not them where it does not inherit", () => {
  fc.assert(
    fc.property(shapes, fc.nat(100), fc.constantFrom("only", "except"), fc.boolean(), (pairs, pick, kind, inherit) => {
      const t = treeOf(groupOf(pairs));
      const x = t.entities[pick % t.entities.length] ?? id("n0");
      const s = scopeOf([{ control: A1, ...(inherit ? {} : { inherit: false }), entities: { kind, entities: [x] } }]);
      const reached = new Set<EntityId>(inherit ? [x, ...t.descendantsOf(x)] : [x]);
      return t.entities.every((e) => (appliesTo(s, t, A1, e) === "applies") === (kind === "only" ? reached.has(e) : !reached.has(e)));
    }),
  );
  fc.assert(fc.property(shapes, selectors(["n0", "n1"]), (pairs, sel) => treeOf(groupOf(pairs)).entities.every((e) => appliesTo(scopeOf([]), treeOf(groupOf(pairs)), A1, e) === "applies" && sel !== undefined)));
});

proves(["0012-grc-subtenants FR-006"], "scopeProblems finds an unknown anchor, a name outside what the anchor ranges over, and a control scoped twice for the same anchor", () => {
  const bad = scopeOf([
    { control: A1, for: "unit-a", entities: { kind: "only", entities: ["unit-b", "unit-a1"] } },
    { control: A1, for: "unit-a", entities: { kind: "all" } },
    { control: A1, for: "ghost", entities: { kind: "all" } },
    { control: A1, entities: { kind: "all" } },
  ]);
  assertEquals(scopeProblems(group, bad, CONTROLS).map((p) => `${p.rule}:${p.id}`), ["scope/outside-anchor:unit-b", "scope/duplicate-control:" + A1, "scope/unknown-entity:ghost"]);
  const fine = scopeOf([{ control: A1, for: "unit-a", entities: { kind: "only", entities: ["unit-a1"] } }, { control: A1, for: "unit-b", entities: { kind: "all" } }, { control: A1, entities: { kind: "all" } }]);
  assertEquals(scopeProblems(group, fine, CONTROLS), []);
});

proves(["0012-grc-subtenants FR-007"], "an exception is not inherited unless it says inheritable, and then only from an ancestor", () => {
  const e = (extra: Record<string, unknown>) => anException({ excuses: { type: "control", ref: A1 }, subjects: ["unit-a"], grantedAt: "2026-05-01T00:00:00Z", expiresAt: "2026-07-01T00:00:00Z", ...extra });
  const plain = e({});
  const inheritable = e({ inheritable: true });
  assertEquals([exceptionCovers(plain, tree, UA, AT), exceptionCovers(plain, tree, UA1, AT)], [true, false]);
  assertEquals([exceptionCovers(inheritable, tree, UA, AT), exceptionCovers(inheritable, tree, UA1, AT), exceptionCovers(inheritable, tree, ORG, AT), exceptionCovers(inheritable, tree, UB, AT)], [true, true, false, false]);
  assertEquals(exceptionCovers(inheritable, tree, UA1, "2026-08-01T00:00:00Z"), false);
  const failing = [read(ORG, "pass"), read(UA, "fail"), read(UA1, "fail"), read(UA2, "pass"), read(UB, "pass"), read(SOLO, "pass")];
  const statusOf = (x: typeof plain, entity: EntityId) => view(tree, failing, scopeOf([]), [x]).cells.find((c) => c.entity === entity)?.status;
  assertEquals([statusOf(plain, UA), statusOf(plain, UA1)], ["accepted", "fail"]);
  assertEquals([statusOf(inheritable, UA), statusOf(inheritable, UA1)], ["accepted", "accepted"]);
});

proves(["0012-grc-subtenants FR-008"], "a view gives each entity its place, its own status and coverage, and the status and coverage rolled up from its subtenants", () => {
  const v = view(tree, [read(ORG, "pass"), read(UA, "pass"), read(UB, "pass"), read(UA1, "fail"), read(UA2, "warn"), read(SOLO, "pass")]);
  assertEquals([...v.roots], [ORG, SOLO]);
  assertEquals([row(v, UA)?.own, row(v, UA)?.rolledUp, row(v, UA)?.ownCoverage, row(v, UA)?.rolledUpCoverage], ["pass", "fail", "covered", "failing"]);
  assertEquals([row(v, ORG)?.own, row(v, ORG)?.rolledUp, row(v, UB)?.rolledUp, row(v, SOLO)?.rolledUp], ["pass", "fail", "pass", "pass"]);
  assertEquals([row(v, UA1)?.parent, row(v, ORG)?.parent, row(v, UA)?.depth, [...(row(v, UA)?.children ?? [])]], [UA, undefined, 1, [UA1, UA2]]);
  const flat = groupOf([["a"], ["b"]]);
  const w = view(treeOf(flat), [read(id("a"), "fail"), read(id("b"), "pass")]);
  assert(w.entities.every((e) => e.own === e.rolledUp && e.ownCoverage === e.rolledUpCoverage), "with no parents the roll-up is the own value");
  const none = view(tree, [read(ORG, "pass"), read(UA, "pass"), read(UB, "pass"), read(UA1, "pass"), read(UA2, "pass"), read(SOLO, "pass")], scopeOf([{ control: A1, for: "unit-a2", entities: { kind: "only", entities: [] } }]));
  assertEquals([row(none, UA2)?.own, row(none, UA2)?.rolledUp, row(none, UA)?.rolledUp], ["not-applicable", "not-applicable", "pass"]);
  fc.assert(
    fc.property(shapes, fc.array(fc.constantFrom(...STATUSES), { minLength: 9, maxLength: 9 }), fc.nat(1000), (pairs, statuses, seed) => {
      const g = groupOf(pairs);
      const readings = g.entities.map((e, i) => read(e.id, statuses[i] ?? "pass"));
      const shuffled = [...g.entities].sort((a, b) => ((a.id.length + seed) * 31 + a.id.charCodeAt(1)) % 7 - ((b.id.length + seed) * 31 + b.id.charCodeAt(1)) % 7 || (a.id < b.id ? 1 : -1));
      const again = view(treeOf({ ...g, entities: shuffled }), [...readings].reverse());
      return canonicalize(again) === canonicalize(view(treeOf(g), readings));
    }),
  );
});

/** A new leaf under the entity at `pick`, with the readings of the group and of the leaf. */
function grown(pairs: readonly (readonly [string, string?])[], statuses: readonly Status[], pick: number, leaf: (e: EntityId) => EntityReading) {
  const g = groupOf(pairs);
  const t = treeOf(g);
  const readings = g.entities.map((e, i) => read(e.id, statuses[i] ?? "pass"));
  const parent = t.entities[pick % t.entities.length] ?? id("n0");
  const extra = id("extra");
  const t2 = treeOf(groupOf([...pairs, ["extra", parent]]));
  return { t, t2, parent, extra, before: view(t, readings), after: view(t2, [...readings, leaf(extra)]) };
}
const statusLists = fc.array(fc.constantFrom(...STATUSES), { minLength: 9, maxLength: 9 });
const covIdx = (c: string): number => (c === "not-applicable" ? -1 : GROUP_COVERAGE_ORDER.findIndex((x) => x === c));

proves(["0012-grc-subtenants FR-009"], "property: adding a passing subtenant never worsens a parent past pass, and a failing or unreadable one never improves any entity", () => {
  fc.assert(
    fc.property(shapes, statusLists, fc.nat(100), (pairs, statuses, pick) => {
      const { t2, parent, extra, before, after } = grown(pairs, statuses, pick, (e) => read(e, "pass"));
      const up = new Set<EntityId>([parent, ...t2.ancestorsOf(parent)]);
      return before.entities.every((b) => {
        const a = row(after, b.entity);
        return a !== undefined && (up.has(b.entity) ? idx(a.rolledUp) <= Math.max(idx(b.rolledUp), idx("pass")) : canonicalize(a) === canonicalize(b)) && a.entity !== extra;
      });
    }),
  );
  for (const bad of ["fail", "error", "warn", "gap", "pending"] as const) {
    fc.assert(
      fc.property(shapes, statusLists, fc.nat(100), (pairs, statuses, pick) => {
        const { t2, parent, before, after } = grown(pairs, statuses, pick, (e) => read(e, bad));
        const up = [parent, ...t2.ancestorsOf(parent)];
        return (
          before.entities.every((b) => idx(row(after, b.entity)?.rolledUp ?? "not-applicable") >= idx(b.rolledUp) && covIdx(row(after, b.entity)?.rolledUpCoverage ?? "not-applicable") >= covIdx(b.rolledUpCoverage)) &&
          up.every((u) => idx(row(after, u)?.rolledUp ?? "not-applicable") >= idx(bad))
        );
      }),
    );
  }
  fc.assert(
    fc.property(shapes, statusLists, fc.nat(100), (pairs, statuses, pick) => {
      const { t2, parent, before, after } = grown(pairs, statuses, pick, unread);
      const up = [parent, ...t2.ancestorsOf(parent)];
      return (
        before.entities.every((b) => idx(row(after, b.entity)?.rolledUp ?? "not-applicable") >= idx(b.rolledUp)) &&
        up.every((u) => idx(row(after, u)?.rolledUp ?? "not-applicable") >= idx("pending") && covIdx(row(after, u)?.rolledUpCoverage ?? "not-applicable") >= GROUP_COVERAGE_ORDER.indexOf("unknown"))
      );
    }),
  );
});

proves(["0012-grc-subtenants FR-009"], "a subtenant that cannot be read is pending and unknown for itself and its parent, never a pass, and a snapshot holds no evidence", () => {
  const v = view(tree, [read(ORG, "pass"), read(UA, "pass"), read(UB, "pass"), unread(UA1), read(UA2, "pass"), read(SOLO, "pass")]);
  assertEquals([row(v, UA1)?.own, row(v, UA1)?.ownCoverage, row(v, UA)?.own, row(v, UA)?.rolledUp, row(v, UA)?.rolledUpCoverage, row(v, ORG)?.rolledUp], ["pending", "unknown", "pass", "pending", "unknown", "pending"]);
  assertEquals(v.overall.worst === "pass", false);
  assert(!JSON.stringify(snap(UA1, "pass")).includes("secret"));
});

proves(["0012-grc-subtenants FR-010"], "a subtenant that cannot be read leaves the cells, own status and rolled-up status of every entity that is not its ancestor unchanged", () => {
  fc.assert(
    fc.property(shapes, statusLists, fc.nat(100), (pairs, statuses, pick) => {
      const g = groupOf(pairs);
      const t = treeOf(g);
      const readings = g.entities.map((e, i) => read(e.id, statuses[i] ?? "pass"));
      const down = t.entities[pick % t.entities.length] ?? id("n0");
      const lost = readings.map((r) => (r.kind === "read" && r.snapshot.entity === down ? unread(down) : r));
      const [a, b] = [view(t, readings), view(t, lost)];
      const ancestors = new Set(t.ancestorsOf(down));
      const quiet = (v: GroupView) => canonicalize([v.cells.filter((c) => c.entity !== down), v.entities.filter((e) => e.entity !== down && !ancestors.has(e.entity))]);
      return quiet(a) === quiet(b);
    }),
  );
  const v = view(tree, [read(ORG, "pass"), read(UA, "pass"), read(UB, "pass"), unread(UA1), read(UA2, "pass"), read(SOLO, "pass")]);
  assertEquals([row(v, UA2)?.rolledUp, row(v, UB)?.rolledUp, row(v, SOLO)?.rolledUp], ["pass", "pass", "pass"]);
});

// The data of one entity of a conformance case: a ledger with an observation for each result, the results and its own store.
async function dataOf(entity: EntityId, statuses: Readonly<Record<string, string>>): Promise<EntityData> {
  const controlOf = (check: string): string => (check === "c-a1" ? A1 : check === "c-a2" ? A2 : B1);
  const results = Object.entries(statuses).map(([check, status]) => aResult(check, entity, status, { controls: [controlOf(check)] }));
  const ledger: LedgerEntry[] = [];
  let last: LedgerEntry | undefined;
  for (const r of results) {
    last = await appendEntry(last, { at: AT, type: "observation", subject: r.subject, evidence: "ab".repeat(32) });
    ledger.push(last);
  }
  return { ledger, results, exceptions: [], store: memoryStore() };
}
const material: GroupMaterial = { frameworks: [ex], crosswalks: [walk], checks: [aCheck("c-a1", [A1]), aCheck("c-a2", [A2]), aCheck("c-b1", [B1])] };
async function caseOf(g: EntityGroup, scope: ControlScope = scopeOf([])): Promise<GroupCase> {
  const data = new Map<EntityId, EntityData>();
  for (const [i, e] of g.entities.entries()) data.set(e.id, await dataOf(e.id, { "c-a1": "pass", "c-a2": i % 3 === 0 ? "fail" : "pass", "c-b1": "pass" }));
  return { group: g, scope, material, data, exceptions: [], at: AT };
}
const deep = groupOf([["n0"], ["n1", "n0"], ["n2", "n1"], ["n3", "n2"], ["n4", "n3"], ["n5", "n4"], ["n6", "n2"], ["n7", "n6"], ["n8"]]);

proves(["0012-grc-subtenants FR-011"], "readers per entity learn of their parent, siblings and subtenants only through snapshots: a reader that reaches into another entity's ports is caught", async () => {
  const c = await caseOf(deep);
  const all = new Map<EntityId, EntityPorts>();
  const reaching = (target: (ports: EntityPorts) => EntityId | undefined) => (ports: EntityPorts, m: GroupMaterial): EntityReader => {
    all.set(ports.entity, ports);
    const own = entityReader(ports, m);
    return async (at) => {
      const other = target(ports);
      const p = other === undefined ? undefined : all.get(other);
      if (p !== undefined) await p.ledger.entries();
      return own(at);
    };
  };
  const t = treeOf(deep);
  for (const [name, target] of [
    ["parent", (p: EntityPorts) => t.parentOf(p.entity)],
    ["subtenant", (p: EntityPorts) => t.childrenOf(p.entity)[0]],
    ["sibling", (p: EntityPorts) => t.childrenOf(t.parentOf(p.entity) ?? p.entity).find((s) => s !== p.entity)],
  ] as const) {
    all.clear();
    const failures = await groupConformance(c, reaching(target));
    assert(failures.some((f) => f.name === "no reader touches another entity's ports" && f.message.includes("touched the ledger of")), `${name}: ${JSON.stringify(failures)}`);
  }
});

proves(["0012-grc-subtenants FR-012"], "the conformance passes a deep tree, refuses a cycle and an unknown parent, and finds a reader that makes up a pass for an entity it cannot read", async () => {
  const c = await caseOf(deep, scopeOf([{ control: A2, entities: { kind: "only", entities: ["n1", "n8"] } }, { control: A2, for: "n6", entities: { kind: "all" } }]));
  assertEquals(await groupConformance(c), []);
  assertEquals(treeOf(deep).depthOf(id("n5")), 5);
  const cyc: EntityGroup = { ...deep, entities: [entityRec("a", "b"), entityRec("b", "a")] };
  assertEquals((await groupConformance({ ...(await caseOf(deep)), group: cyc })).map((f) => [f.suite, f.name]), [["group", "the entities form a tree"]]);
  const ghost: EntityGroup = { ...deep, entities: [entityRec("a", "ghost")] };
  const refused = await groupConformance({ ...(await caseOf(deep)), group: ghost });
  assert(refused[0]?.message.includes("ghost") === true);
  const made = (ports: EntityPorts, m: GroupMaterial): EntityReader => {
    const inner = entityReader(ports, m);
    return async (at) => {
      const r = await inner(at);
      return r.kind === "ok" ? r : { kind: "ok", value: { ...snap(ports.entity, "pass"), controls: CONTROLS.map((control) => ({ control, status: "pass", coverage: "covered", severity: "medium", digests: [] })) } };
    };
  };
  const failures = await groupConformance(await caseOf(deep), made);
  assert(failures.some((f) => f.name === "an entity that cannot be read is pending, and only its ancestors show it"), JSON.stringify(failures));
  const readings = await readGroup(deep, new Map(), AT);
  assert(readings.every((r) => r.kind === "unread"));
});
