/**
 * Tests of the conformance suite and of the two stores the library ships (commons anyfs 0005-anyfs-conformance FR-001 to FR-006): the suite chooses its cases by the capabilities of a store and says what differed,
 * the store in memory and the store in a folder pass every case they are held to, the store in a folder is confined, atomic and honest about what it cannot do, and a store that claims what it does not keep fails.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { fs, path as osPath } from "@intellectual-frontiers/system";
import {
  ALL_CASES,
  CASES,
  casesFor,
  generator,
  makeStore,
  type Op,
  type OpCapability,
  runCase,
  runConformance,
  type Store,
} from "../src/logical/mod.ts";
import {
  CAPABILITIES,
  type CoreCapability,
  expectAbsent,
  expectAny,
  expectRev,
  type Path,
  parsePath,
  ROOT,
  unavailable,
} from "../src/governance/mod.ts";
import { MEMORY_CAPABILITIES, memoryStore } from "../src/physical/memory/mod.ts";
import { LOCAL_CAPABILITIES, localStore } from "../src/physical/local/mod.ts";

const p = (text: string): Path => {
  const r = parsePath(text);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};
const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);
const text = (b: Uint8Array): string => new TextDecoder().decode(b);
const METHOD: Readonly<Record<OpCapability, string>> = { read: "read", write: "write", list: "list", stat: "stat", delete: "delete", cas: "cas", batch: "batch", rename: "rename", history: "history", rangeRead: "readRange", append: "append", search: "search", merge: "applyDelta" };

/** A fresh folder for a test, removed after it. */
async function inFolder<T>(run: (dir: string) => Promise<T>): Promise<T> {
  const dir = await fs.makeTempDir({ prefix: "anyfs-" });
  try {
    return await run(await fs.realPath(dir));
  } finally {
    await fs.remove(dir, { recursive: true });
  }
}

async function localIn(dir: string, options = {}): Promise<Store<(typeof LOCAL_CAPABILITIES)[number]>> {
  const s = await localStore(dir, options);
  if (s.kind === "err") throw new Error(s.error);
  return s.value;
}

proves(["0005-anyfs-conformance FR-001"], "the suite gives the cases a store's capabilities hold it to, and a failing case says what differed", async () => {
  const core = casesFor(["read", "write", "list", "stat", "delete"]).map((c) => c.id);
  for (const needing of ["expect-revision", "race-revision", "delete-at-revision", "batch-all-or-nothing", "rename-does-not-overwrite", "history-newest-first"]) assert(!core.includes(needing), `${needing} needs more than the core`);
  for (const id of ["round-trip", "expect-absent", "list-paging"]) assert(core.includes(id));
  assertEquals(casesFor(CAPABILITIES).length, ALL_CASES.length);
  assertEquals(new Set(ALL_CASES.map((c) => c.id)).size, ALL_CASES.length, "case ids are unique");
  // a store that never makes what it is given fails the round trip with a sentence that names the difference
  const lossy = async (): Promise<Store<CoreCapability>> => {
    const inner = memoryStore();
    return makeStore({
      id: "lossy",
      place: inner.place,
      consistency: "strong",
      traits: { caseSensitive: true },
      capabilities: ["read", "write", "list", "stat", "delete"],
      handle: async (op: Op) => (op.op === "write" ? inner.handle({ ...op, bytes: bytes("changed") }) : inner.handle(op)),
    });
  };
  const roundTrip = CASES.find((c) => c.id === "round-trip");
  assert(roundTrip !== undefined);
  const report = await runCase(roundTrip, lossy);
  assertStringIncludes(report.failure ?? "", "the bytes read");
  assertStringIncludes(report.failure ?? "", "hello");
});

proves(["0005-anyfs-conformance FR-002"], "the suite covers the round trip, the expectations, racing writers, lists and pages, stat, delete, odd names, the empty object, batch, rename, history and a seeded model", async () => {
  const ids = ALL_CASES.map((c) => c.id);
  for (const id of ["round-trip", "revision-follows-bytes", "expect-absent", "expect-any", "expect-revision", "race-absent", "race-revision", "list-order-and-prefix", "list-paging", "stat", "delete-is-idempotent", "delete-at-revision", "names", "empty-object", "batch-all-or-nothing", "rename-does-not-overwrite", "history-newest-first", "model-1", "model-2", "model-3"]) {
    assert(ids.includes(id), id);
  }
  const a = generator(7);
  const b = generator(7);
  assertEquals([a(), a(), a()], [b(), b(), b()], "a seed gives the same numbers");
  // a store that loses a delete fails the model with the seed in the sentence
  const forgetful = async (): Promise<Store<CoreCapability>> => {
    const inner = memoryStore();
    return makeStore({
      id: "forgetful",
      place: inner.place,
      consistency: "strong",
      traits: { caseSensitive: true },
      capabilities: ["read", "write", "list", "stat", "delete"],
      handle: async (op: Op) => (op.op === "delete" ? ok({ op: "delete", value: { existed: true } }) : inner.handle(op)),
    });
  };
  const model = ALL_CASES.find((c) => c.id === "model-1");
  assert(model !== undefined);
  const report = await runCase(model, forgetful);
  assertStringIncludes(report.failure ?? "", "seed 1, step");
});

proves(["0005-anyfs-conformance FR-003"], "the store in memory has the capabilities of the specification, is strong, and its revision is sha256 of the bytes", async () => {
  const s = memoryStore({ name: "m" });
  assertEquals([...s.capabilities].sort(), [...MEMORY_CAPABILITIES].sort());
  assertEquals(s.consistency, "strong");
  assertEquals(s.id, "memory:m");
  const w = await s.write(p("a"), bytes("hello"), expectAny);
  assert(w.kind === "ok");
  assertEquals(w.value.rev, `sha256:${await sha256(bytes("hello"))}`);
  const r = await s.read(p("a"));
  assert(r.kind === "ok");
  r.value.bytes[0] = 0;
  const again = await s.read(p("a"));
  assert(again.kind === "ok" && text(again.value.bytes) === "hello", "the caller cannot change what the store holds");
  const h = await s.history(p("a"));
  assert(h.kind === "ok" && h.value.versions.length === 1);
});

proves(["0005-anyfs-conformance FR-004", "0005-anyfs-conformance FR-005"], "the store in a folder has the capabilities of the specification and no batch, writes whole through hidden files, lists none of its own, and claims only what it keeps", async () => {
  await inFolder(async (dir) => {
    const s = await localIn(dir);
    assertEquals([...s.capabilities].sort(), [...LOCAL_CAPABILITIES].sort());
    assert(!s.capabilities.has("batch") && !("batch" in s), "the file system has no atomic change of several files");
    assertEquals(s.consistency, "strong");
    const w = await s.write(p("a/b.txt"), bytes("hello"), expectAny);
    assert(w.kind === "ok");
    assertEquals(w.value.rev, `sha256:${await sha256(bytes("hello"))}`);
    assertEquals(await fs.readTextFile(osPath.join(dir, "a", "b.txt")), "hello");
    const names: string[] = [];
    for await (const e of fs.readDir(osPath.join(dir, "a"))) names.push(e.name);
    assertEquals(names, ["b.txt"], "no temporary file is left");
    const l = await s.list(ROOT);
    assert(l.kind === "ok" && l.value.entries.map((e) => e.path).join() === "a/b.txt", "the store's own files are not listed");
    const batch = await s.handle({ op: "batch", changes: [] });
    assert(batch.kind === "err" && batch.error.kind === "refused");
    // a name another file system could not hold, and the store's own names, are refused
    const bad = await s.write(p("a/what?.txt"), bytes("x"), expectAny);
    assert(bad.kind === "err" && bad.error.kind === "refused" && bad.error.reason === "unportable-path");
    const reserved = await s.write(p(".anyfs-mine"), bytes("x"), expectAny);
    assert(reserved.kind === "err" && reserved.error.kind === "refused");
    const lax = await localIn(dir, { portable: true });
    assertEquals((await lax.read(p("a/b.txt"))).kind, "ok");
    // a file and a folder cannot share a name
    const clash = await s.write(p("a/b.txt/inner"), bytes("x"), expectAny);
    assert(clash.kind === "err" && clash.error.kind === "refused");
    // a delete removes the empty folders it leaves
    await s.delete(p("a/b.txt"), expectAny);
    assertEquals(await fs.exists(osPath.join(dir, "a")), false);
    // a relative folder and a file are refused as a root
    assertEquals((await localStore("relative/dir")).kind, "err");
    assertEquals((await localStore(osPath.join(dir, "nothing"))).kind, "err");
    assertEquals((await localStore(osPath.join(dir, "made"), { create: true })).kind, "ok");
    // a store at the root of the file system opens without writing there, reads what is below it, and takes the names the computer has
    const rootPath = osPath.parse(dir).root;
    const locks = osPath.join(dir, "locks-of-the-wide-store");
    const wide = await localStore(rootPath, { portable: false, caseSensitive: true, lockDir: locks });
    assert(wide.kind === "ok", "the root of the file system opens");
    const below = p(dir.slice(rootPath.length).split(osPath.sep).join("/") + "/a/b.txt");
    await s.write(p("a/b.txt"), bytes("seen from the root"), expectAny);
    const seen = await wide.value.read(below);
    assert(seen.kind === "ok" && new TextDecoder().decode(seen.value.bytes) === "seen from the root");
    const written = await wide.value.write(p(`${dir.slice(rootPath.length).split(osPath.sep).join("/")}/a/c.txt`), bytes("written through the root"), expectAny);
    assert(written.kind === "ok");
    assertEquals(await fs.exists(locks), true);
  });
  // a store whose methods do not match its capabilities is found by the check the suite is run with
  for (const s of [memoryStore(), await inFolder((dir) => localIn(dir))]) {
    for (const c of Object.keys(METHOD) as OpCapability[]) assertEquals(METHOD[c] in s, s.capabilities.has(c), `${s.id}: ${c}`);
  }
});

proves(["0005-anyfs-conformance FR-004"], "the store in a folder refuses every operation that would reach a file outside it, by a path or by a link", async () => {
  if (process.platform === "win32") return;
  await inFolder(async (outside) => {
    await fs.writeTextFile(osPath.join(outside, "secret.txt"), "outside");
    await inFolder(async (dir) => {
      const s = await localIn(dir);
      await fs.symlink(outside, osPath.join(dir, "escape"));
      await fs.symlink(osPath.join(outside, "secret.txt"), osPath.join(dir, "leak.txt"));
      await fs.symlink(osPath.join(outside, "nothing"), osPath.join(dir, "dangling"));
      for (const path of ["escape/secret.txt", "leak.txt"]) {
        const r = await s.read(p(path));
        assert(r.kind === "err" && r.error.kind === "refused" && r.error.reason === "outside-scope", `read ${path}`);
      }
      const w = await s.write(p("escape/new.txt"), bytes("x"), expectAny);
      assert(w.kind === "err" && w.error.kind === "refused" && w.error.reason === "outside-scope");
      assertEquals(await fs.exists(osPath.join(outside, "new.txt")), false, "nothing was written outside");
      const d = await s.write(p("dangling"), bytes("x"), expectAny);
      assert(d.kind === "err" && d.error.kind === "refused" && d.error.reason === "outside-scope", "a link to nothing that leaves the folder");
      assertEquals(await fs.readTextFile(osPath.join(outside, "secret.txt")), "outside");
      const del = await s.delete(p("escape/secret.txt"), expectAny);
      assert(del.kind === "err" && del.error.kind === "refused");
      assertEquals(await fs.exists(osPath.join(outside, "secret.txt")), true, "nothing was deleted outside");
      const listed = await s.list(p("escape") as never);
      assert(listed.kind === "err" && listed.error.kind === "refused");
      const inside = await s.list(ROOT);
      assert(inside.kind === "ok" && inside.value.entries.length === 0, "a link is not an object");
    });
  });
});

proves(["0005-anyfs-conformance FR-004"], "the store in a folder lets one of racing writers win, across many writers and many paths", async () => {
  await inFolder(async (dir) => {
    const s = await localIn(dir);
    const results = await Promise.all(Array.from({ length: 16 }, (_, i) => s.write(p("race"), bytes(`w${i}`), expectAbsent)));
    assertEquals(results.filter((r) => r.kind === "ok").length, 1);
    const first = await s.read(p("race"));
    assert(first.kind === "ok");
    const rev = first.value.rev;
    const cas = await Promise.all(Array.from({ length: 16 }, (_, i) => s.write(p("race"), bytes(`v${i}`), expectRev(rev))));
    assertEquals(cas.filter((r) => r.kind === "ok").length, 1);
    const names: string[] = [];
    for await (const e of fs.readDir(dir)) names.push(e.name);
    assertEquals(names.filter((n) => n !== ".anyfs-locks").sort(), ["race"], "no temporary file is left after the race");
  });
});

proves(["0005-anyfs-conformance FR-005"], "a store that claims a batch it does not make whole fails the batch case and names what was written", async () => {
  const lying = async (): Promise<Store<CoreCapability>> => {
    const inner = memoryStore();
    return makeStore({
      id: "lying",
      place: inner.place,
      consistency: "strong",
      traits: { caseSensitive: true },
      capabilities: ["read", "write", "list", "stat", "delete", "cas", "batch"],
      handle: async (op: Op) => {
        if (op.op !== "batch") return inner.handle(op);
        const results = [];
        for (const c of op.changes) {
          const r = c.kind === "put" ? await inner.handle({ op: "write", path: c.path, bytes: c.bytes, expect: c.expect }) : await inner.handle({ op: "delete", path: c.path, expect: c.expect });
          if (r.kind === "err") return r;
          results.push(c.kind === "put" && r.value.op === "write" ? { kind: "put" as const, path: c.path, rev: r.value.value.rev, created: r.value.value.created } : { kind: "delete" as const, path: c.path, existed: true });
        }
        return ok({ op: "batch", value: { results } });
      },
    });
  };
  const batchCase = CASES.find((c) => c.id === "batch-all-or-nothing");
  assert(batchCase !== undefined);
  const report = await runCase(batchCase, lying);
  assertStringIncludes(report.failure ?? "", "batch/one");
  const honest = await runCase(batchCase, async () => memoryStore());
  assertEquals(honest.failure, undefined);
});

proves(["0005-anyfs-conformance FR-006", "0003-anyfs-logical FR-003"], "the store in memory and the store in a folder pass every case they are held to", async () => {
  const memory = await runConformance(async () => memoryStore());
  assertEquals(memory.filter((r) => r.failure !== undefined), []);
  assert(memory.length >= ALL_CASES.length - 0, "every case ran for the store in memory");
  await inFolder(async (dir) => {
    let n = 0;
    const local = await runConformance(async () => {
      n++;
      return localIn(osPath.join(dir, `store-${n}`), { create: true });
    });
    assertEquals(local.filter((r) => r.failure !== undefined), []);
    const ids = local.map((r) => r.id);
    assert(!ids.includes("batch-all-or-nothing") && !ids.includes("history-newest-first"), "a case needing more than the store has is not run");
    assert(ids.includes("rename-does-not-overwrite") && ids.includes("expect-revision") && ids.includes("model-3"));
  });
  void err;
  void unavailable;
});

proves(["0005-anyfs-conformance FR-003"], "the memory store keeps a write that is made while a batch is being prepared: the batch is applied to the state as it is when the batch is committed", async () => {
  const store = memoryStore({ name: "race" });
  const at = (text: string): Path => {
    const r = parsePath(text);
    if (r.kind === "err") throw new Error(r.error);
    return r.value;
  };
  const big = new Uint8Array(1 << 20).fill(7);
  const batching = store.batch([{ kind: "put", path: at("batch/a"), bytes: big, expect: expectAny }]);
  const writing = Promise.all(Array.from({ length: 20 }, (_, i) => store.write(at(`w/${i}`), new TextEncoder().encode(String(i)), expectAny)));
  const [batched] = await Promise.all([batching, writing]);
  assert(batched.kind === "ok");
  const listed = await store.list(ROOT);
  assert(listed.kind === "ok");
  assertEquals(listed.value.entries.length, 21, "no write was lost by the batch");
});
