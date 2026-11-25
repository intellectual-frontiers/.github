/**
 * Tests of the logical layer of AnyFS (commons anyfs 0003-anyfs-logical FR-001 to FR-006): the operations as data and the capability and effect of each, the store whose methods are exactly its capabilities and
 * whose type refuses a store without one, the laws, attenuation that only narrows, mounts that resolve by the longest prefix, and consent held by effect.
 *
 * @module
 */
import fc from "fast-check";
import { err } from "@intellectual-frontiers/core";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import {
  asStore,
  capabilitiesNeeded,
  capabilityOf,
  type Change,
  effectOf,
  emptyNamespace,
  guarded,
  makeStore,
  mount,
  only,
  OP_NAMES,
  type Op,
  type OpCapability,
  pathOf,
  readOnly,
  resolve,
  type Store,
  sub,
  supports,
} from "../src/logical/mod.ts";
import {
  CAPABILITIES,
  type CoreCapability,
  expectAbsent,
  expectAny,
  expectRev,
  type Path,
  parsePath,
  parsePrefix,
  parseRevision,
  type Prefix,
  ROOT,
  unavailable,
} from "../src/governance/mod.ts";
import { memoryStore } from "../src/physical/memory/mod.ts";

const p = (text: string): Path => {
  const r = parsePath(text);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};
const prefix = (text: string): Prefix => {
  const r = parsePrefix(text);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};
const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);
const text = (b: Uint8Array): string => new TextDecoder().decode(b);
const rev = (t: string) => {
  const r = parseRevision(t);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};

/** Every operation, one of each. */
const OPS: readonly Op[] = [
  { op: "read", path: p("a") },
  { op: "write", path: p("a"), bytes: bytes("x"), expect: expectAny },
  { op: "stat", path: p("a") },
  { op: "list", prefix: ROOT },
  { op: "delete", path: p("a"), expect: expectAny },
  { op: "batch", changes: [{ kind: "put", path: p("a"), bytes: bytes("x"), expect: expectAny }] },
  { op: "rename", from: p("a"), to: p("b"), expect: expectAny },
  { op: "history", path: p("a") },
  { op: "rangeRead", path: p("a"), start: 0, length: 1 },
  { op: "append", path: p("a"), bytes: bytes("x"), expect: expectAny },
  { op: "search", prefix: ROOT, text: "x" },
  { op: "merge", action: { kind: "vector" } },
];

const METHOD: Readonly<Record<OpCapability, string>> = {
  read: "read",
  write: "write",
  list: "list",
  stat: "stat",
  delete: "delete",
  cas: "cas",
  batch: "batch",
  rename: "rename",
  history: "history",
  rangeRead: "readRange",
  append: "append",
  search: "search",
  merge: "applyDelta",
};
const OP_CAPABILITIES = Object.keys(METHOD) as OpCapability[];

/** A store of the capabilities given whose handler refuses everything: only its shape is of interest. */
const stub = <const C extends OpCapability>(capabilities: readonly C[], id = "stub") =>
  makeStore<C>({ id, place: { kind: "memory", name: "stub" }, consistency: "strong", traits: { caseSensitive: true }, capabilities, handle: async () => err(unavailable("a stub", false)) });

proves(["0003-anyfs-logical FR-001"], "an operation is data, every operation needs one capability (and a revision needs cas), and every effect is read, mutate or destructive", () => {
  assertEquals(OPS.map((o) => o.op), [...OP_NAMES]);
  for (const o of OPS) assertEquals(capabilityOf(o), o.op);
  assertEquals(capabilitiesNeeded(OPS[0] as Op), ["read"]);
  assertEquals(capabilitiesNeeded({ op: "write", path: p("a"), bytes: bytes(""), expect: expectRev(rev("sha256:1")) }), ["write", "cas"]);
  const change: Change = { kind: "delete", path: p("a"), expect: expectRev(rev("sha256:1")) };
  assertEquals(capabilitiesNeeded({ op: "batch", changes: [change] }), ["batch", "cas"]);
  assertEquals(OPS.map(effectOf), ["read", "mutate", "read", "read", "destructive", "mutate", "mutate", "read", "read", "mutate", "read", "read"]);
  assertEquals(effectOf({ op: "merge", action: { kind: "since", since: {} } }), "read");
  assert(["mutate", "destructive"].includes(effectOf({ op: "merge", action: { kind: "apply", delta: { format: 1, origin: "0".repeat(32) as never, versions: [], blobs: [] } } })));
  assertEquals(effectOf({ op: "batch", changes: [change] }), "destructive");
  assertEquals(pathOf(OPS[0] as Op), p("a"));
  assertEquals(pathOf(OPS[3] as Op), undefined);
  assertEquals(pathOf(OPS[6] as Op), p("a"));
});

proves(["0003-anyfs-logical FR-002"], "a store has exactly the methods of its capabilities, checks them before each operation, never throws, and a function that needs a capability refuses a store without it", async () => {
  for (const c of OP_CAPABILITIES) {
    const s = stub([c]);
    for (const other of OP_CAPABILITIES) assertEquals(METHOD[other] in s, other === c, `${c}: ${other}`);
    assertEquals([...s.capabilities], [c]);
  }
  fc.assert(
    fc.property(fc.subarray(OP_CAPABILITIES), (caps) => {
      const s = stub(caps);
      return OP_CAPABILITIES.every((c) => METHOD[c] in s === caps.includes(c)) && s.capabilities.size === caps.length;
    }),
  );
  // the checks before an operation, and a handler that throws
  const readOnlyStub = stub(["read"]);
  const refusedWrite = await readOnlyStub.handle({ op: "write", path: p("a"), bytes: bytes(""), expect: expectAny });
  assert(refusedWrite.kind === "err" && refusedWrite.error.kind === "refused" && refusedWrite.error.reason === "capability-absent");
  const noCas = stub(["write"]);
  const revWrite = await noCas.handle({ op: "write", path: p("a"), bytes: bytes(""), expect: expectRev(rev("sha256:1")) });
  assert(revWrite.kind === "err" && revWrite.error.kind === "refused" && revWrite.error.reason === "unsupported-expectation");
  const thrower = makeStore({ id: "t", place: { kind: "memory", name: "t" }, consistency: "strong", traits: { caseSensitive: true }, capabilities: ["read"], handle: async () => { throw new Error("boom"); } });
  const thrown = await thrower.read(p("a"));
  assert(thrown.kind === "err" && thrown.error.kind === "unavailable");
  // types: a function that needs write refuses a store without it, and a revision needs cas
  const needsWrite = (s: Store<"write">): boolean => s.capabilities.has("write");
  assert(needsWrite(stub(["write"])));
  // @ts-expect-error a store of read alone has no write
  needsWrite(stub(["read"]));
  const needsCas = (s: Store<"write" | "cas">) => s.write(p("a"), bytes(""), expectRev(rev("sha256:1")));
  void needsCas;
  // @ts-expect-error a store without cas takes no revision
  stub(["write"]).write(p("a"), bytes(""), expectRev(rev("sha256:1")));
  // supports narrows a store to more capabilities where its set has them
  const m: Store<CoreCapability> = memoryStore();
  assert(supports(m, "cas"));
  assertEquals(m.cas, true);
  assert(!supports(readOnlyStub, "write"));
});

proves(["0003-anyfs-logical FR-003"], "the laws of a store: read after write, conflicts that change nothing, replacement, idempotent delete, revisions that follow the bytes, lists in order", async () => {
  const s = memoryStore();
  const w = await s.write(p("a"), bytes("one"), expectAny);
  assert(w.kind === "ok");
  const r = await s.read(p("a"));
  assert(r.kind === "ok" && text(r.value.bytes) === "one" && r.value.rev === w.value.rev);
  const c = await s.write(p("a"), bytes("two"), expectAbsent);
  assert(c.kind === "err" && c.error.kind === "conflict");
  const stale = await s.write(p("a"), bytes("two"), expectRev(rev("sha256:0")));
  assert(stale.kind === "err" && stale.error.kind === "conflict");
  const again = await s.read(p("a"));
  assert(again.kind === "ok" && text(again.value.bytes) === "one", "a conflict changes nothing");
  const d1 = await s.delete(p("a"), expectAny);
  const d2 = await s.delete(p("a"), expectAny);
  assert(d1.kind === "ok" && d1.value.existed && d2.kind === "ok" && !d2.value.existed);
  await s.write(p("z"), bytes("1"), expectAny);
  await s.write(p("b/y"), bytes("1"), expectAny);
  await s.write(p("b/x"), bytes("1"), expectAny);
  const l = await s.list(ROOT);
  assert(l.kind === "ok");
  assertEquals(l.value.entries.map((e) => e.path), ["b/x", "b/y", "z"]);
});

proves(["0003-anyfs-logical FR-004"], "attenuation only narrows: read only has nothing that changes, sub reaches only below its prefix, only keeps what is named, and no attenuation gives a capability", async () => {
  const base = memoryStore();
  await base.write(p("a/x"), bytes("ax"), expectAny);
  await base.write(p("b/y"), bytes("by"), expectAny);
  const ro = readOnly(base);
  assert(!("write" in ro) && !("delete" in ro) && !("batch" in ro) && !("rename" in ro) && "read" in ro && "list" in ro);
  const refusedWrite = await ro.handle({ op: "write", path: p("a/x"), bytes: bytes(""), expect: expectAny });
  assert(refusedWrite.kind === "err" && refusedWrite.error.kind === "refused");
  assertEquals((await ro.read(p("a/x"))).kind, "ok");

  const a = sub(base, prefix("a"));
  const rx = await a.read(p("x"));
  assert(rx.kind === "ok" && text(rx.value.bytes) === "ax");
  assertEquals((await a.read(p("y"))).kind, "err", "a path of the other folder is not there");
  const la = await a.list(ROOT);
  assert(la.kind === "ok");
  assertEquals(la.value.entries.map((e) => e.path), ["x"], "a list shows the paths below the prefix");
  const w = await a.write(p("new"), bytes("n"), expectAny);
  assert(w.kind === "ok");
  assertEquals((await base.read(p("a/new"))).kind, "ok", "a write goes below the prefix");
  const missing = await a.read(p("nothing"));
  assert(missing.kind === "err" && missing.error.kind === "missing" && missing.error.path === "nothing", "a problem names the path as the program wrote it");
  const long = await sub(base, prefix(Array.from({ length: 150 }, () => "aaaa").join("/"))).write(p(Array.from({ length: 80 }, () => "bbbb").join("/")), bytes(""), expectAny);
  assert(long.kind === "err" && long.error.kind === "refused" && long.error.reason === "too-large");

  const reader = only(base, ["read", "stat"]);
  assertEquals([...reader.capabilities].sort(), ["read", "stat"]);
  assert(!("list" in reader));

  fc.assert(
    fc.asyncProperty(fc.subarray(OP_CAPABILITIES), fc.subarray(OP_CAPABILITIES), async (caps, keep) => {
      const s = stub(caps);
      const wide = new Set<string>(caps);
      const narrower: Store<OpCapability>[] = [readOnly(s) as unknown as Store<OpCapability>, sub(s, prefix("x")) as unknown as Store<OpCapability>, guarded(s, "mutate") as unknown as Store<OpCapability>];
      return narrower.every((n) => [...n.capabilities].every((c) => wide.has(c))) && [...only(s, keep.filter((k) => caps.includes(k))).capabilities].every((c) => wide.has(c));
    }),
  );
});

proves(["0003-anyfs-logical FR-005"], "a namespace resolves a path to the store of the longest prefix, refuses a second mount of a prefix, and is one store whose list merges the mounts", async () => {
  const fleet = memoryStore({ name: "fleet" });
  const secrets = memoryStore({ name: "secrets" });
  const root = memoryStore({ name: "root" });
  await fleet.write(p("synthetic-server-01"), bytes("o"), expectAny);
  await secrets.write(p("key"), bytes("k"), expectAny);
  await root.write(p("readme"), bytes("r"), expectAny);
  await root.write(p("fleet/shadowed"), bytes("s"), expectAny);
  const m1 = mount(emptyNamespace, ROOT, root);
  assert(m1.kind === "ok");
  const m2 = mount(m1.value, prefix("fleet"), fleet);
  assert(m2.kind === "ok");
  const m3 = mount(m2.value, prefix("fleet/secrets"), secrets);
  assert(m3.kind === "ok");
  assertEquals(mount(m3.value, prefix("fleet"), fleet).kind, "err");
  const r = resolve(m3.value, p("fleet/secrets/key"));
  assert(r.kind === "ok" && r.value.path === "key" && r.value.mount.prefix === "fleet/secrets");
  const r2 = resolve(m3.value, p("fleet/synthetic-server-01"));
  assert(r2.kind === "ok" && r2.value.path === "synthetic-server-01" && r2.value.mount.prefix === "fleet");
  const r3 = resolve(m3.value, p("readme"));
  assert(r3.kind === "ok" && r3.value.mount.prefix === "");
  assertEquals(resolve(m2.value, p("fleet/x")).kind, "ok");
  assertEquals(resolve(mount(emptyNamespace, prefix("only"), root).kind === "ok" ? (mount(emptyNamespace, prefix("only"), root) as { value: typeof emptyNamespace }).value : emptyNamespace, p("else")).kind, "err");

  const ns = asStore(m3.value, "ns", ["read", "write", "list", "stat", "delete", "rename", "batch"]);
  assert(ns.kind === "ok");
  const store = ns.value;
  const k = await store.read(p("fleet/secrets/key"));
  assert(k.kind === "ok" && text(k.value.bytes) === "k");
  assertEquals((await store.write(p("fleet/new"), bytes("n"), expectAny)).kind, "ok");
  assertEquals((await fleet.read(p("new"))).kind, "ok", "a write lands in the mounted store, below its prefix");
  const all = await store.list(ROOT);
  assert(all.kind === "ok");
  assertEquals(all.value.entries.map((e) => e.path), ["fleet/new", "fleet/secrets/key", "fleet/synthetic-server-01", "readme"], "the merged list hides what a longer mount covers");
  const page = await store.list(ROOT, { limit: 2 });
  assert(page.kind === "ok" && page.value.entries.length === 2 && page.value.next !== undefined);
  const rest = await store.list(ROOT, { limit: 10, after: page.value.next });
  assert(rest.kind === "ok");
  assertEquals([...page.value.entries, ...rest.value.entries].map((e) => e.path), ["fleet/new", "fleet/secrets/key", "fleet/synthetic-server-01", "readme"]);
  const crossing = await store.rename(p("fleet/synthetic-server-01"), p("readme2"), expectAny);
  assert(crossing.kind === "err" && crossing.error.kind === "refused" && crossing.error.reason === "outside-scope");
  const moved = await store.rename(p("fleet/synthetic-server-01"), p("fleet/synthetic-server-02"), expectAny);
  assertEquals(moved.kind, "ok");
  const batch = await store.batch([{ kind: "put", path: p("fleet/b1"), bytes: bytes("1"), expect: expectAny }, { kind: "put", path: p("fleet/b2"), bytes: bytes("2"), expect: expectAny }]);
  assert(batch.kind === "ok" && batch.value.results.map((x) => x.path).join() === "fleet/b1,fleet/b2");
  const split = await store.batch([{ kind: "put", path: p("fleet/b3"), bytes: bytes("1"), expect: expectAny }, { kind: "put", path: p("readme"), bytes: bytes("2"), expect: expectAny }]);
  assert(split.kind === "err" && split.error.kind === "refused");
  const narrow = mount(emptyNamespace, ROOT, only(root, ["read", "list"]));
  assert(narrow.kind === "ok");
  assertEquals(asStore(narrow.value, "x", ["write"]).kind, "err", "a mount without write gives no namespace with it");
  assertEquals(asStore(narrow.value, "x", ["read", "list"]).kind, "ok");
  assertEquals(asStore(m3.value, "x", ["search"]).kind, "err");
  assertEquals(asStore(emptyNamespace, "x", ["read"]).kind, "err");
});

proves(["0003-anyfs-logical FR-006"], "a guarded store refuses, as consent, every operation above its effect and none below it", async () => {
  const base = memoryStore();
  await base.write(p("a"), bytes("x"), expectAny);
  const read = guarded(base, "read");
  assertEquals((await read.read(p("a"))).kind, "ok");
  assertEquals((await read.list(ROOT)).kind, "ok");
  const w = await read.write(p("b"), bytes("y"), expectAny);
  assert(w.kind === "err" && w.error.kind === "refused" && w.error.reason === "consent");
  assertStringIncludes(w.error.kind === "refused" ? w.error.detail : "", "only read");
  const mutate = guarded(base, "mutate");
  assertEquals((await mutate.write(p("b"), bytes("y"), expectAny)).kind, "ok");
  const d = await mutate.delete(p("b"), expectAny);
  assert(d.kind === "err" && d.error.kind === "refused" && d.error.reason === "consent");
  const destroy = guarded(base, "destructive");
  assertEquals((await destroy.delete(p("b"), expectAny)).kind, "ok");
  assert([...CAPABILITIES].length === 15);
});
