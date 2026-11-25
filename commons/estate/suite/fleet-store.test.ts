/**
 * Tests of the fleet store (commons estate 0006-estate-fleet-store FR-001 to FR-012): a store opened and made a fleet store only when asked, refused when it is newer or another's, an asset written with the
 * expectation the caller states and two operators who change it one winner and one conflict, an observation written once, what is declared and the risks accepted, a snapshot that begins again when a document
 * changes under it, the estate's truth read from a store the same as the truth of the same data in memory, a closed list of problems, findings beside the good documents, a mirror with replicas, a store for development
 * and the configuration of an example fleet. Every name is made up.
 *
 * @module
 */
import fc from "fast-check";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { err } from "@intellectual-frontiers/core";
import { expectAbsent, expectAny, expectRev, ROOT, unavailable } from "@intellectual-frontiers/anyfs/governance";
import { makeStore, opCapabilitiesOf } from "@intellectual-frontiers/anyfs/logical";
import { memoryStore } from "@intellectual-frontiers/anyfs/memory";
import { fs, path as fsPath } from "@intellectual-frontiers/system";
import { defineAsset } from "../src/governance/mod.ts";
import { assessSnapshot, describeFleetProblem, devFleetStore, type FleetEvent, type FleetProblem, type FleetSnapshot, fleetConfigExample, openFleetStore } from "../src/physical/mod.ts";
import { adopted, bytes, fleetOf, hooked, managed, named, path, ticking } from "./support.ts";

const NOW = "2026-12-01T12:00:00Z";
const AT = Date.UTC(2026, 10, 20, 10, 0, 0);
const at = (minutes: number): string => new Date(AT + minutes * 60_000).toISOString();

const manifestOf = (store: ReturnType<typeof memoryStore>) => async (text: string): Promise<void> => {
  assert((await store.write(path("fleet.json"), bytes(text), expectAny)).kind === "ok");
};

proves(["0006-estate-fleet-store FR-001"], "a store with no manifest is refused unless it is opened with create, which makes the manifest once, and two openers that make it at the same time end with one manifest and both succeed", async () => {
  const store = memoryStore({ name: "record" });
  const refused = await openFleetStore({ primary: { name: named("record"), store }, actor: "operator" });
  assert(refused.kind === "err");
  assertEquals(refused.error, { kind: "no-manifest" });
  assertStringIncludes(describeFleetProblem(refused.error), "create");
  const both = await Promise.all([1, 2, 3].map((n) => openFleetStore({ primary: { name: named("record"), store }, create: true, actor: `operator-${n}`, identity: "example" })));
  assert(both.every((b) => b.kind === "ok"), "every opener succeeds");
  const read = await store.read(path("fleet.json"));
  assert(read.kind === "ok");
  const stored = JSON.parse(new TextDecoder().decode(read.value.bytes)) as { store: string; schema: number };
  assertEquals([stored.store, stored.schema], ["example", 1]);
  const again = await openFleetStore({ primary: { name: named("record"), store }, actor: "operator", identity: "example" });
  assert(again.kind === "ok" && again.value.manifest.store === "example");
});

proves(["0006-estate-fleet-store FR-002"], "a store kept at a newer schema, in another layout or as another fleet is refused with the facts, and nothing is written to it", async () => {
  const store = memoryStore({ name: "record" });
  const write = manifestOf(store);
  const open = (identity?: string) => openFleetStore({ primary: { name: named("record"), store }, create: true, actor: "operator", ...(identity === undefined ? {} : { identity }) });
  const count = async (): Promise<number> => {
    const l = await store.list(ROOT, { limit: 100 });
    assert(l.kind === "ok");
    return l.value.entries.length;
  };
  await write('{"store":"example","schema":2,"layout":1,"created":"2026-11-20T10:00:00Z","$version":1}');
  const newer = await open();
  assert(newer.kind === "err");
  assertEquals(newer.error, { kind: "newer-schema", found: 2, reads: 1 });
  await write('{"store":"example","schema":1,"layout":7,"created":"2026-11-20T10:00:00Z","$version":1}');
  const other = await open();
  assert(other.kind === "err");
  assertEquals(other.error, { kind: "other-layout", found: 7, names: 1 });
  await write('{"store":"example","schema":1,"layout":1,"created":"2026-11-20T10:00:00Z","$version":1}');
  const fleet = await open("another");
  assert(fleet.kind === "err");
  assertEquals(fleet.error, { kind: "other-fleet", asked: "another", found: "example" });
  for (const r of [newer, other, fleet]) assert(r.kind === "err" && describeFleetProblem(r.error).length > 10);
  assertEquals(await count(), 1, "only the manifest is there: nothing was written");
});

proves(["0006-estate-fleet-store FR-003"], "an asset is written with the expectation stated, comes back with its revision, two operators who change it are one winner and one conflict, and an update that lost begins again and wins", async () => {
  const { fleet, store } = await fleetOf();
  const first = await fleet.putAsset(adopted("synthetic-server-01"), expectAbsent);
  assert(first.kind === "ok" && first.value.created);
  const again = await fleet.putAsset(adopted("synthetic-server-01"), expectAbsent);
  assert(again.kind === "err" && again.error.kind === "documents" && again.error.problem.kind === "store" && again.error.problem.problem.kind === "conflict", "writing over an asset that is there is a conflict");
  const read = await fleet.getAsset("synthetic-server-01");
  assert(read.kind === "ok");
  assertEquals(read.value.rev, first.value.rev);
  // two operators on one primary
  const other = await openFleetStore({ primary: { name: named("record"), store }, actor: "second", clock: ticking(AT) });
  assert(other.kind === "ok");
  const mine = await fleet.getAsset("synthetic-server-01");
  assert(mine.kind === "ok");
  const theirs = await other.value.putAsset(managed("synthetic-server-01"), expectRev(mine.value.rev));
  assert(theirs.kind === "ok", "the second operator wins with the revision they read");
  const lost = await fleet.putAsset(adopted("synthetic-server-01", "workstation"), expectRev(mine.value.rev));
  assert(lost.kind === "err" && lost.error.kind === "documents" && lost.error.problem.kind === "store" && lost.error.problem.problem.kind === "conflict", "the first is told, and nothing is lost silently");
  // an update that loses once begins again with what the other wrote
  let calls = 0;
  const updated = await fleet.updateAsset("synthetic-server-01", async (current) => {
    calls += 1;
    assert(current !== undefined);
    if (calls === 1) {
      const raced = await other.value.updateAsset("synthetic-server-01", (c) => (c === undefined ? undefined : defineOwn(c.id, "raced")));
      assert(raced.kind === "ok");
    }
    return defineOwn(current.id, `${current.kind}-seen`);
  });
  assert(updated.kind === "ok" && updated.value.kind === "put");
  assertEquals(updated.value.attempts, 2);
  const final = await fleet.getAsset("synthetic-server-01");
  assert(final.kind === "ok");
  assertEquals(final.value.value.kind, "raced-seen", "the update was made on what the other operator wrote");
});

const defineOwn = (id: string, kind: string) => {
  const made = defineAsset({ id, kind, state: "adopted", origin: "paired", owners: { observe: "archon", verify: "archon" } });
  assert(made.kind === "ok");
  return made.value;
};

proves(["0006-estate-fleet-store FR-004"], "an observation is written once, the same one again is not made again, a different one at the same instant is refused, the observations come back in the order of their instants within a range, and the latest is answered by reading one document", async () => {
  const reads: string[] = [];
  const base = memoryStore({ name: "record" });
  const { fleet } = await fleetOf(base);
  const counted = await openFleetStore({
    primary: { name: named("record"), store: hooked(base, (op) => void (op.op === "read" && reads.push(op.path))) },
    actor: "operator",
    clock: ticking(AT),
  });
  assert(counted.kind === "ok");
  for (const m of [3, 1, 2, 0, 4]) assert((await fleet.recordObservation({ asset: "synthetic-server-01", at: at(m), source: "probe", state: { n: m } })).kind === "ok");
  const same = await fleet.recordObservation({ asset: "synthetic-server-01", at: at(2), source: "probe", state: { n: 2 } });
  assert(same.kind === "ok" && !same.value.created);
  const different = await fleet.recordObservation({ asset: "synthetic-server-01", at: at(2), source: "probe", state: { n: 99 } });
  assert(different.kind === "err" && different.error.kind === "exists");
  const all = await fleet.observationsOf("synthetic-server-01");
  assert(all.kind === "ok");
  assertEquals(all.value.observations.map((o) => o.state["n"]), [0, 1, 2, 3, 4]);
  const some = await fleet.observationsOf("synthetic-server-01", { from: at(1), to: at(3) });
  assert(some.kind === "ok");
  assertEquals(some.value.observations.map((o) => o.state["n"]), [1, 2, 3]);
  const limited = await fleet.observationsOf("synthetic-server-01", { limit: 2 });
  assert(limited.kind === "ok" && limited.value.observations.length === 2);
  reads.length = 0;
  const latest = await counted.value.latestObservation("synthetic-server-01");
  assert(latest.kind === "ok" && latest.value !== undefined);
  assertEquals(latest.value.state["n"], 4);
  assertEquals(reads.length, 1, "one document was read");
  const none = await fleet.latestObservation("synthetic-server-02");
  assert(none.kind === "ok");
  assertEquals(none.value, undefined);
});

proves(["0006-estate-fleet-store FR-005"], "what is declared is written with the expectation stated, a risk is accepted only as the logical layer allows, one of the same policy replaces the earlier, and two acceptances at once are both kept", async () => {
  const { fleet, store } = await fleetOf();
  assert((await fleet.declare("synthetic-server-01", { os: "linux" }, expectAbsent)).kind === "ok");
  assertEquals((await fleet.declare("synthetic-server-01", { os: "bsd" }, expectAbsent)).kind, "err", "a second declaration that expects none is a conflict");
  const d = await fleet.declarationOf("synthetic-server-01");
  assert(d.kind === "ok" && d.value !== undefined);
  assertEquals([d.value.value.declared, d.value.value.by], [{ os: "linux" }, "operator"]);
  assert((await fleet.declare("synthetic-server-01", { os: "bsd" }, expectRev(d.value.rev))).kind === "ok");
  const nothing = await fleet.declarationOf("synthetic-server-02");
  assert(nothing.kind === "ok" && nothing.value === undefined);
  const GOOD = { policy: "disk-encryption", reason: "holds only open-source code", by: "an owner", until: "2027-03-01" };
  assert((await fleet.acceptRisk("synthetic-server-01", GOOD)).kind === "ok");
  for (const bad of [{ ...GOOD, until: "2020-01-01" }, { ...GOOD, reason: "no" }, { ...GOOD, until: "2035-01-01" }, { ...GOOD, policy: " " }]) {
    const r = await fleet.acceptRisk("synthetic-server-01", bad);
    assert(r.kind === "err" && r.error.kind === "refused" && r.error.reasons.length > 0);
  }
  const replaced = await fleet.acceptRisk("synthetic-server-01", { ...GOOD, reason: "holds only open-source code, reviewed" });
  assert(replaced.kind === "ok" && replaced.value.risks.length === 1);
  await Promise.all([1, 2, 3].map((n) => fleet.acceptRisk("synthetic-server-01", { ...GOOD, policy: `policy-${n}` })));
  const risks = await fleet.risksOf("synthetic-server-01");
  assert(risks.kind === "ok");
  assertEquals(risks.value.map((r) => r.policy), ["disk-encryption", "policy-1", "policy-2", "policy-3"]);
  assertEquals((await store.list(ROOT, { limit: 100 })).kind, "ok");
});

proves(["0006-estate-fleet-store FR-006"], "a snapshot reads the assets, declarations, accepted risks and observations in the shapes the logical layer takes, begins again when a document changed under it, and says whether it ended stable", async () => {
  const base = memoryStore({ name: "record" });
  let mutate: () => Promise<void> = async () => {};
  const { fleet } = await fleetOf(base, {});
  const watched = await openFleetStore({
    primary: { name: named("record"), store: hooked(base, async (op) => op.op === "list" && op.prefix === "assets" ? mutate() : undefined) },
    actor: "operator",
    clock: ticking(AT),
  });
  assert(watched.kind === "ok");
  assert((await fleet.putAsset(adopted("synthetic-server-01"), expectAbsent)).kind === "ok");
  assert((await fleet.declare("synthetic-server-01", { os: "linux" }, expectAbsent)).kind === "ok");
  assert((await fleet.recordObservation({ asset: "synthetic-server-01", at: at(0), source: "probe", state: { os: "linux" }, results: [{ id: "p", status: "pass", controls: ["c"] }] })).kind === "ok");
  assert((await fleet.recordObservation({ asset: "synthetic-server-01", at: at(5), source: "probe", state: { os: "linux" }, results: [{ id: "p", status: "fail", controls: ["c"] }] })).kind === "ok");
  const quiet = await watched.value.snapshot();
  assert(quiet.kind === "ok" && quiet.value.stable);
  assertEquals(quiet.value.assets.map((a) => a.id), ["synthetic-server-01"]);
  assertEquals(quiet.value.declared, { "synthetic-server-01": { os: "linux" } });
  assertEquals(quiet.value.observations.length, 1, "the latest of each asset");
  assertEquals(quiet.value.results, [{ asset: "synthetic-server-01", id: "p", status: "fail", controls: ["c"] }]);
  const all = await watched.value.snapshot({ observations: "all" });
  assert(all.kind === "ok" && all.value.observations.length === 2);
  // a document changes while it reads, once: it begins again and ends stable with the new asset
  let lists = 0;
  mutate = async () => {
    lists += 1;
    if (lists === 2) assert((await fleet.putAsset(adopted("synthetic-server-02"), expectAbsent)).kind === "ok");
  };
  const moved = await watched.value.snapshot();
  assert(moved.kind === "ok");
  assert(moved.value.stable, "the second reading was stable");
  assertEquals(moved.value.assets.map((a) => a.id).sort(), ["synthetic-server-01", "synthetic-server-02"]);
  // a store that never stops changing ends with stable false after the attempts
  let n = 0;
  mutate = async () => {
    n += 1;
    assert((await fleet.putAsset(adopted(`node-${n}`), expectAbsent)).kind === "ok");
  };
  const restless = await watched.value.snapshot({ attempts: 2 });
  assert(restless.kind === "ok");
  assertEquals(restless.value.stable, false);
});

const idArb = fc.constantFrom("alpha", "beta", "gamma-1", "delta.2", "x");
const stateArb = fc.record({ os: fc.constantFrom("linux", "bsd"), n: fc.integer({ min: 0, max: 3 }) });
const statusArb = fc.constantFrom("pass", "fail", "warn", "unknown" as const);
const resultsArb = fc.array(fc.record({ id: fc.constantFrom("p1", "p2", "p3"), status: statusArb, controls: fc.array(fc.constantFrom("c1", "c2"), { maxLength: 2 }) }), { maxLength: 3 }).map((rs) => rs.filter((r, i) => rs.findIndex((o) => o.id === r.id) === i));
const assetArb = fc.record({
  id: idArb,
  managed: fc.boolean(),
  declared: fc.option(stateArb, { nil: undefined }),
  observations: fc.array(fc.record({ state: stateArb, results: resultsArb }), { maxLength: 3 }),
  risk: fc.option(fc.constantFrom("p1", "p2", "p3"), { nil: undefined }),
});

proves(["0006-estate-fleet-store FR-007"], "the logical layer's judgement of a snapshot read from a store is its judgement of the same data made in memory: truth, invariants and the status of each policy", async () => {
  await fc.assert(
    fc.asyncProperty(fc.array(assetArb, { minLength: 1, maxLength: 4 }), async (generated) => {
      const unique = generated.filter((g, i) => generated.findIndex((o) => o.id === g.id) === i);
      const { fleet } = await fleetOf();
      const direct: { assets: FleetSnapshot["assets"][number][]; declared: Record<string, Record<string, never> | Record<string, unknown>>; observations: { asset: string; observation: { at: string; source: string; state: Record<string, never> | Record<string, unknown> } }[]; results: { asset: string; id: string; status: "pass" | "fail" | "warn" | "unknown"; controls: readonly string[] }[]; acceptances: Record<string, { policy: string; reason: string; by: string; until: string }[]> } = { assets: [], declared: {}, observations: [], results: [], acceptances: {} };
      for (const g of unique) {
        const asset = g.managed ? managed(g.id) : adopted(g.id);
        assert((await fleet.putAsset(asset, expectAbsent)).kind === "ok");
        direct.assets.push(asset);
        if (g.declared !== undefined) {
          assert((await fleet.declare(g.id, g.declared, expectAbsent)).kind === "ok");
          direct.declared[g.id] = g.declared;
        }
        let latest: (typeof g.observations)[number] | undefined;
        for (const [i, o] of g.observations.entries()) {
          assert((await fleet.recordObservation({ asset: g.id, at: at(i), source: "probe", state: o.state, results: o.results })).kind === "ok");
          direct.observations.push({ asset: g.id, observation: { at: new Date(AT + i * 60_000).toISOString(), source: "probe", state: o.state } });
          latest = o;
        }
        for (const r of latest?.results ?? []) direct.results.push({ asset: g.id, ...r });
        if (g.risk !== undefined) {
          const risk = { policy: g.risk, reason: "a reason an auditor reads", by: "an owner", until: "2027-03-01" };
          assert((await fleet.acceptRisk(g.id, risk)).kind === "ok");
          direct.acceptances[g.id] = [risk];
        }
      }
      const stored = await fleet.snapshot({ observations: "all" });
      assert(stored.kind === "ok");
      const inMemory = { ...direct, manifest: stored.value.manifest, evidence: [], findings: [], stable: true } as unknown as FleetSnapshot;
      const a = assessSnapshot(stored.value, NOW, "PT30M");
      const b = assessSnapshot(inMemory, NOW, "PT30M");
      assert(a.kind === "ok" && b.kind === "ok");
      const norm = (x: typeof a.value) => ({
        truths: [...x.truths].sort((p, q) => (p.asset < q.asset ? -1 : 1)),
        violations: [...x.violations].sort((p, q) => (`${p.invariant}${p.subject}` < `${q.invariant}${q.subject}` ? -1 : 1)),
        judged: [...x.judged].sort((p, q) => (`${p.asset}${p.policy.id}` < `${q.asset}${q.policy.id}` ? -1 : 1)),
      });
      assertEquals(norm(a.value), norm(b.value));
    }),
    { numRuns: 25 },
  );
});

proves(["0006-estate-fleet-store FR-008"], "what a fleet store cannot do is one of a closed list of problems, each with the facts and its own sentence", () => {
  const problems: FleetProblem[] = [
    { kind: "documents", problem: { kind: "refused", detail: "the document is not accepted" } },
    { kind: "no-manifest" },
    { kind: "newer-schema", found: 3, reads: 1 },
    { kind: "other-layout", found: 2, names: 1 },
    { kind: "other-fleet", asked: "a", found: "b" },
    { kind: "refused", reasons: ["one", "two"] },
    { kind: "exists", path: "observations/synthetic-server-01/x.json" },
    { kind: "mirror", problem: { kind: "unknown-replica", name: "z" } },
    { kind: "no-mirror" },
    { kind: "no-history", replica: "copy" },
  ];
  const sentences = problems.map(describeFleetProblem);
  assertEquals(new Set(sentences).size, problems.length, "each has its own sentence");
  for (const s of sentences) assert(s.length > 12);
  assertEquals(new Set(problems.map((p) => p.kind)).size, 10);
});

proves(["0006-estate-fleet-store FR-009"], "a file no layout names, a document that cannot be decoded and a document of a newer version are findings beside the good documents, and never fail a listing, a snapshot or a query of observations", async () => {
  const { fleet, store } = await fleetOf();
  assert((await fleet.putAsset(adopted("synthetic-server-01"), expectAbsent)).kind === "ok");
  assert((await fleet.recordObservation({ asset: "synthetic-server-01", at: at(0), source: "probe", state: {} })).kind === "ok");
  assert((await fleet.recordEvidence({ subject: "synthetic-server-01", digest: "c".repeat(64), store: "evidence", type: "config", observedAt: at(0) })).kind === "ok");
  const put = async (p: string, text: string): Promise<void> => void assert((await store.write(path(p), bytes(text), expectAny)).kind === "ok");
  await put("assets/o/readme.txt", "not a document");
  await put("assets/z/zeta.json", "{not json");
  await put("assets/y/yankee.json", '{"id":"yankee","$version":9}');
  await put("observations/synthetic-server-01/notes.txt", "a note");
  await put("observations/synthetic-server-01/20261120T100100.000Z.json", "[1,2]");
  await put(`evidence/synthetic-server-01/${"d".repeat(64)}.json`, '{"subject":"synthetic-server-01"}');
  const listed = await fleet.listAssets();
  assert(listed.kind === "ok");
  assertEquals(listed.value.docs.map((d) => d.value.id), ["synthetic-server-01"]);
  assertEquals(listed.value.findings.map((f) => f.path).sort(), ["assets/o/readme.txt", "assets/y/yankee.json", "assets/z/zeta.json"]);
  const observed = await fleet.observationsOf("synthetic-server-01");
  assert(observed.kind === "ok");
  assertEquals(observed.value.observations.length, 1);
  assertEquals(observed.value.findings.map((f) => f.path).sort(), ["observations/synthetic-server-01/20261120T100100.000Z.json", "observations/synthetic-server-01/notes.txt"]);
  const evidence = await fleet.evidenceOf("synthetic-server-01");
  assert(evidence.kind === "ok");
  assertEquals(evidence.value.refs.length, 1);
  assertEquals(evidence.value.findings.length, 1);
  const snap = await fleet.snapshot({ evidence: true });
  assert(snap.kind === "ok");
  assertEquals(snap.value.assets.map((a) => a.id), ["synthetic-server-01"]);
  assert(snap.value.findings.length >= 6, "every finding is in the snapshot");
  const latest = await fleet.latestObservation("synthetic-server-01");
  assert(latest.kind === "ok" && latest.value !== undefined, "the good observation is the latest that can be read");
});

proves(["0006-estate-fleet-store FR-010"], "with replicas a write goes to the primary and is queued, settle brings the replicas up to it, a replica that cannot be reached never fails a write, a replica changed by someone else is left as it is, promote makes a replica the primary, and subscribers are told", async () => {
  const primary = memoryStore({ name: "record" });
  const copy = memoryStore({ name: "copy" });
  const down = { now: false };
  const outage = makeStore({
    id: "history",
    place: copy.place,
    consistency: copy.consistency,
    traits: copy.traits,
    capabilities: opCapabilitiesOf(copy),
    handle: async (op) => (down.now ? err(unavailable("the replica cannot be reached", true)) : copy.handle(op)),
  });
  const history = memoryStore({ name: "history-2" });
  const opened = await openFleetStore({
    primary: { name: named("record"), store: primary },
    replicas: [{ name: named("copy"), store: outage }, { name: named("history"), store: history }],
    create: true,
    actor: "operator",
    clock: ticking(AT),
  });
  assert(opened.kind === "ok");
  const fleet = opened.value;
  const events: FleetEvent[] = [];
  const stop = fleet.subscribe((e) => events.push(e));
  assert((await fleet.putAsset(adopted("synthetic-server-01"), expectAbsent)).kind === "ok");
  assertEquals((await fleet.status()).map((s) => [s.replica, s.state.kind]), [["copy", "behind"], ["history", "behind"]]);
  const settled = await fleet.settle();
  assert(settled.kind === "ok");
  assertEquals((await fleet.status()).map((s) => s.state.kind), ["in-sync", "in-sync"]);
  assert((await copy.read(path("assets/s/synthetic-server-01.json"))).kind === "ok", "the replica holds the document");
  assert((await history.read(path("fleet.json"))).kind === "ok", "the replica holds the manifest");
  // a replica that cannot be reached never fails a write
  down.now = true;
  assert((await fleet.putAsset(adopted("synthetic-server-02"), expectAbsent)).kind === "ok", "the write is made");
  const during = await fleet.settle("copy");
  assert(during.kind === "ok" && during.value[0]?.reachable === false, "the replica is behind and unreachable");
  down.now = false;
  assert((await fleet.settle()).kind === "ok");
  assertEquals((await fleet.status()).map((s) => s.state.kind), ["in-sync", "in-sync"]);
  // a replica changed by someone else is left as it is
  assert((await history.write(path("assets/s/synthetic-server-01.json"), bytes('{"someone":"else"}'), expectAny)).kind === "ok");
  assert((await fleet.updateAsset("synthetic-server-01", (c) => (c === undefined ? undefined : defineOwn(c.id, "changed")))).kind === "ok");
  assert((await fleet.settle()).kind === "ok");
  const status = await fleet.status();
  const diverged = status.find((s) => s.replica === "history");
  assert(diverged !== undefined && diverged.state.kind === "diverged");
  const kept = await history.read(path("assets/s/synthetic-server-01.json"));
  assert(kept.kind === "ok");
  assertEquals(new TextDecoder().decode(kept.value.bytes), '{"someone":"else"}', "the replica was left as someone made it");
  // promote the replica that is in sync
  const promoted = await fleet.promote("copy");
  assert(promoted.kind === "ok");
  assertEquals(promoted.value.to, "copy");
  assert((await fleet.putAsset(adopted("synthetic-server-03"), expectAbsent)).kind === "ok");
  assert((await copy.read(path("assets/s/synthetic-server-03.json"))).kind === "ok", "writes go to the new primary");
  assertEquals((await fleet.history("synthetic-server-01", "copy")).kind, "ok", "the replica keeps history");
  assertEquals((await fleet.history("synthetic-server-01", "nowhere")).kind, "err");
  stop();
  const kinds = new Set(events.map((e) => e.kind));
  for (const k of ["asset", "mirror"] as const) assert(kinds.has(k), `an event of ${k} was told`);
  const mirrorKinds = new Set(events.flatMap((e) => (e.kind === "mirror" ? [e.event.kind] : [])));
  for (const k of ["written", "queued", "converged", "promoted"] as const) assert(mirrorKinds.has(k), `a mirror event of ${k} was told`);
  await fleet.close();
});

proves(["0006-estate-fleet-store FR-011"], "a fleet store for development is opened with the same function over memory or a folder with no replicas: its status is empty, its settle does nothing, and a folder keeps what was written", async () => {
  const memory = await devFleetStore({ kind: "memory" }, { actor: "operator" });
  assert(memory.kind === "ok");
  assertEquals(await memory.value.status(), []);
  const settled = await memory.value.settle();
  assert(settled.kind === "ok");
  assertEquals(settled.value, []);
  const promote = await memory.value.promote("anywhere");
  assert(promote.kind === "err" && promote.error.kind === "no-mirror");
  const dir = await fs.makeTempDir({ prefix: "fleet-dev-" });
  try {
    const first = await devFleetStore({ kind: "folder", dir: fsPath.join(dir, "fleet") }, { actor: "operator" });
    assert(first.kind === "ok");
    assert((await first.value.putAsset(adopted("synthetic-server-01"), expectAbsent)).kind === "ok");
    const second = await devFleetStore({ kind: "folder", dir: fsPath.join(dir, "fleet") }, { actor: "operator" });
    assert(second.kind === "ok");
    const got = await second.value.getAsset("synthetic-server-01");
    assert(got.kind === "ok" && got.value.value.id === "synthetic-server-01", "the folder kept the asset");
  } finally {
    await fs.remove(dir, { recursive: true });
  }
});

proves(["0006-estate-fleet-store FR-012"], "the configuration of the example fleet is code: the host is the primary, the Git branch and the bucket are its replicas, nothing is deleted at a replica and a settlement is made when it is asked for", async () => {
  const [ssh, git, cloud] = [memoryStore({ name: "ssh" }), memoryStore({ name: "git" }), memoryStore({ name: "cloud" })];
  const config = fleetConfigExample({ ssh, git, cloud }, "operator");
  assertEquals([config.primary.name, (config.replicas ?? []).map((r) => r.name), config.identity, config.actor], ["record", ["history", "copy"], "example-fleet", "operator"]);
  assertEquals(config.mirror, { deletes: { kind: "forbid" }, fallback: "unavailable", auto: "manual" });
  const opened = await openFleetStore({ ...config, create: true });
  assert(opened.kind === "ok");
  assertEquals(opened.value.manifest.store, "example-fleet");
  assert((await opened.value.putAsset(adopted("synthetic-server-01"), expectAbsent)).kind === "ok");
  assert((await opened.value.settle()).kind === "ok");
  assert((await git.read(path("assets/s/synthetic-server-01.json"))).kind === "ok" && (await cloud.read(path("assets/s/synthetic-server-01.json"))).kind === "ok", "both replicas hold the asset");
});
