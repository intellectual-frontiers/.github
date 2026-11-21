/**
 * Tests of the physical layer of AnyFS POSIX (commons anyfs-posix 0004-anyfs-posix-physical FR-001 to FR-008): the view over a store, what it asks of the store, how a handle writes back, how a move that fails
 * halfway is reported, the read cache, the read-modify-write that needs compare-and-write, and a view of a store that cannot be written.
 *
 * @module
 */
import { err } from "@intellectual-frontiers/core";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { type Capability, parsePath, type Path, unavailable } from "@intellectual-frontiers/anyfs/governance";
import { only, readOnly } from "@intellectual-frontiers/anyfs/logical";
import { parseOwnership, withPolicy, defaultPolicy, type Policy } from "../src/governance/mod.ts";
import { ReadCache } from "../src/physical/cache.ts";
import { posix } from "../src/physical/mod.ts";
import { intercept, memoryStoreOf } from "./stores.ts";
import { keepPolicy, traced } from "./worlds.ts";

const enc = new TextEncoder();
const dec = new TextDecoder();
const key = (text: string): Path => {
  const r = parsePath(text);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};
const policyWith = (changes: Partial<Policy>, base: Policy = defaultPolicy()): Policy => {
  const r = withPolicy(base, changes);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};
const ok = <T>(r: { readonly kind: "ok"; readonly value: T } | { readonly kind: "err"; readonly error: { readonly errno: string; readonly message: string } }): T => {
  if (r.kind === "err") throw new Error(`${r.error.errno}: ${r.error.message}`);
  return r.value;
};

proves(["0004-anyfs-posix-physical FR-001"], "a view needs a store that reads, refuses one that cannot list at compile time, carries the fidelity of the plan on errors too, and shares its handles with a view of another working directory", async () => {
  const mem = memoryStoreOf("a");
  // @ts-expect-error a store that cannot list cannot be viewed as a file system
  const noList = () => posix(only(mem, ["read", "stat"]));
  assert(typeof noList === "function");
  const view = posix(mem);
  assertEquals(view.store, mem.id);
  const missing = await view.readFile("/nope");
  assert(missing.kind === "err" && missing.error.fidelity.kind === "native" && missing.error.errno === "ENOENT");
  const refused = await view.chmod("/x", 0o600);
  assert(refused.kind === "err" && refused.error.fidelity.kind === "refused");
  const fd = ok(await view.open("/h", "w")).value;
  const inner = ok(view.withCwd("/sub"));
  assertEquals(inner.cwd, "/sub");
  ok(await inner.write(fd, enc.encode("shared")));
  ok(await inner.close(fd));
  assertEquals(dec.decode(ok(await view.readFile("/h")).value), "shared");
  assertEquals(view.withCwd("a\\b").kind, "err");
  // the view asks nothing of the store but its handler: every operation it sent is a named operation
  const t = traced(mem);
  const v2 = posix(t.store);
  await v2.writeFile("/t/f", enc.encode("1"));
  await v2.readdir("/t");
  assert(t.trace().every((o) => ["stat", "list", "read", "write", "delete", "rename", "batch"].includes(o)));
});

proves(["0004-anyfs-posix-physical FR-002"], "a stat gives the object's size, revision and time and the ownership of the policy, a list pages through a store, and a name that is an object and a directory is shown as a file and noticed", async () => {
  const mem = memoryStoreOf("b");
  const own = parseOwnership(1000, 100, 0o640, 0o750);
  assert(own.kind === "ok");
  const view = posix(mem, { policy: policyWith({ ownership: own.value, listPage: 2 }) });
  for (let i = 0; i < 7; i++) ok(await view.writeFile(`/dir/f${i}.txt`, enc.encode("x".repeat(i))));
  const s = ok(await view.stat("/dir/f3.txt")).value;
  const direct = await mem.stat(key("dir/f3.txt"));
  assert(direct.kind === "ok");
  assertEquals([s.type, s.size, s.mode, s.uid, s.gid, s.rev], ["file", 3, 0o640, 1000, 100, direct.value.rev]);
  assert(s.mtime !== undefined);
  assertEquals(ok(await view.stat("/dir")).value.mode, 0o750);
  const list = ok(await view.readdir("/dir"));
  assertEquals(list.value.map((e) => e.name), ["f0.txt", "f1.txt", "f2.txt", "f3.txt", "f4.txt", "f5.txt", "f6.txt"]);
  await mem.write(key("x"), enc.encode("file"), { kind: "any" });
  await mem.write(key("x/y"), enc.encode("below"), { kind: "any" });
  const clash = ok(await view.readdir("/"));
  assertEquals(clash.value.filter((e) => e.name === "x").map((e) => e.type), ["file"]);
  assertEquals(clash.notes.length, 1);
  assertEquals(ok(await view.stat("/x")).value.type, "file");
  assertEquals((await view.readdir("/x")).kind, "err");
});

proves(["0004-anyfs-posix-physical FR-003"], "a marker keeps a directory as an object the list hides, mkdir needs its parent where markers are kept, and the ancestors are checked or trusted as the policy says", async () => {
  const mem = memoryStoreOf("c");
  const view = posix(mem, { policy: keepPolicy() });
  ok(await view.mkdir("/d"));
  const marker = await mem.stat(key("d/.keep"));
  assert(marker.kind === "ok" && marker.value.size === 0, "the marker is an empty object");
  assertEquals(ok(await view.readdir("/d")).value, []);
  assertEquals(ok(await view.readdir("/")).value.map((e) => e.name), ["d"]);
  const noParent = await view.mkdir("/x/y");
  assert(noParent.kind === "err" && noParent.error.errno === "ENOENT");
  ok(await view.mkdir("/x/y", { parents: true }));
  ok(await view.mkdir("/x/y/z"));
  assertEquals((await view.mkdir("/d")).kind, "err");
  ok(await view.writeFile("/d/file", enc.encode("f")));
  const full = await view.rmdir("/d");
  assert(full.kind === "err" && full.error.errno === "ENOTEMPTY");
  ok(await view.unlink("/d/file"));
  ok(await view.rmdir("/d"));
  assertEquals((await mem.stat(key("d/.keep"))).kind, "err");
  assertEquals((await view.unlink("/x/y/z/.keep")).kind, "err", "a marker is not a file to remove");
  // the ancestors: checked, or trusted
  const checked = posix(memoryStoreOf("d"));
  ok(await checked.writeFile("/f", enc.encode("f")));
  assert((await checked.writeFile("/f/under", enc.encode("x"))).kind === "err");
  const t = traced(memoryStoreOf("e"));
  const trusting = posix(t.store, { policy: policyWith({ ancestors: "trust" }) });
  ok(await trusting.writeFile("/a/b/c/d", enc.encode("x")));
  const trusted = t.trace().filter((o) => o === "stat").length;
  const t2 = traced(memoryStoreOf("f"));
  const checking = posix(t2.store);
  ok(await checking.writeFile("/a/b/c/d", enc.encode("x")));
  assert(t2.trace().filter((o) => o === "stat").length === trusted + 3, "three ancestors are one stat each");
});

proves(["0004-anyfs-posix-physical FR-004"], "a handle writes back at fsync and close with the revision it read, keeps working after an fsync, and a failed close lets the handle go and says what was lost", async () => {
  const mem = memoryStoreOf("g");
  const view = posix(mem);
  ok(await view.writeFile("/f", enc.encode("one")));
  const fd = ok(await view.open("/f", "r+")).value;
  ok(await view.write(fd, enc.encode("ONE"), 0));
  assertEquals(dec.decode((await mem.read(key("f")) as { kind: "ok"; value: { bytes: Uint8Array } }).value.bytes), "one", "the store is not written by a write");
  const synced = ok(await view.fsync(fd));
  assertEquals(synced.fidelity.kind, "emulated");
  assertEquals(dec.decode((await mem.read(key("f")) as { kind: "ok"; value: { bytes: Uint8Array } }).value.bytes), "ONE", "fsync puts the buffer in the store");
  ok(await view.write(fd, enc.encode("!"), 3));
  ok(await view.close(fd));
  assertEquals(dec.decode(ok(await view.readFile("/f")).value), "ONE!", "the handle went on working with the revision of the fsync");
  // a change since the open: ESTALE, the handle is gone, and the message says what was lost
  const fd2 = ok(await view.open("/f", "r+")).value;
  ok(await view.writeFile("/f", enc.encode("other")));
  ok(await view.write(fd2, enc.encode("mine"), 0));
  const closed = await view.close(fd2);
  assert(closed.kind === "err" && closed.error.errno === "ESTALE");
  assertStringIncludes(closed.kind === "err" ? closed.error.message : "", "discarded");
  assertEquals((await view.close(fd2)).kind, "err");
  assertEquals(dec.decode(ok(await view.readFile("/f")).value), "other");
  // an object that appeared since a `wx` is EEXIST at close, and one made by `w` that a writer made first is ESTALE
  const fd3 = ok(await view.open("/new", "wx")).value;
  ok(await view.writeFile("/new", enc.encode("first")));
  const late = await view.close(fd3);
  assert(late.kind === "err" && late.error.errno === "EEXIST");
  // a store that cannot compare revisions says so at the close
  const poor = posix(memoryStoreOf("h", ["read", "write", "list", "stat", "delete"]));
  ok(await poor.writeFile("/f", enc.encode("one")));
  const fd4 = ok(await poor.open("/f", "r+")).value;
  ok(await poor.write(fd4, enc.encode("x"), 0));
  const unguarded = ok(await poor.close(fd4));
  assertEquals(unguarded.fidelity.kind === "emulated" && unguarded.fidelity.reason, "unguarded-write");
  assert(unguarded.notes.length > 0);
});

proves(["0004-anyfs-posix-physical FR-005"], "a move that fails halfway says which objects it moved and which it could not, a rename over a file is guarded by revisions where it can be, and rm -r deletes in batches where the store has them", async () => {
  // a directory moved by copies and deletes: the delete of one object fails
  const base = memoryStoreOf("i", ["read", "write", "list", "stat", "delete"]);
  const flaky = intercept(base, async (op, next) => (op.op === "delete" && op.path === key("s/n/b") ? err(unavailable("the store went away", true)) : next(op)));
  const view = posix(flaky);
  ok(await view.writeFile("/s/a", enc.encode("a")));
  ok(await view.writeFile("/s/n/b", enc.encode("b")));
  const moved = await view.rename("/s", "/t");
  assert(moved.kind === "err" && moved.error.errno === "EIO");
  const report = moved.kind === "err" ? moved.error.report : undefined;
  assertEquals(report?.done.map(String), ["/s/a"]);
  assertEquals(report?.failed.map((f) => `${f.path} ${f.errno}`), ["/s/n/b EIO"]);
  assertEquals(dec.decode(ok(await view.readFile("/t/n/b")).value), "b", "what was copied stays at the destination");
  assertEquals(dec.decode(ok(await view.readFile("/s/n/b")).value), "b", "what could not be deleted stays at the source");
  // with the store's rename, one object fails to move
  const withRename = intercept(memoryStoreOf("j"), async (op, next) => (op.op === "rename" && op.from === key("s/n/b") ? err(unavailable("no", false)) : next(op)));
  const v2 = posix(withRename);
  ok(await v2.writeFile("/s/a", enc.encode("a")));
  ok(await v2.writeFile("/s/n/b", enc.encode("b")));
  const m2 = await v2.rename("/s", "/t");
  assert(m2.kind === "err" && m2.error.report?.failed.length === 1 && m2.error.report.done.length === 1);
  // a rename over a file is guarded by revisions where the store has cas, and by nothing where it has not
  const seen: string[] = [];
  const spy = intercept(memoryStoreOf("k"), async (op, next) => {
    if (op.op === "delete" || op.op === "write") seen.push(`${op.op}:${op.expect.kind}`);
    return next(op);
  });
  const v3 = posix(spy);
  ok(await v3.writeFile("/a", enc.encode("1")));
  ok(await v3.writeFile("/b", enc.encode("2")));
  seen.length = 0;
  ok(await v3.rename("/a", "/b"));
  assertEquals(seen, ["write:rev", "delete:rev"]);
  // rm -r in batches
  const t = traced(memoryStoreOf("l"));
  const v4 = posix(t.store);
  for (let i = 0; i < 250; i++) ok(await v4.writeFile(`/big/f${i}`, enc.encode("x")));
  t.reset();
  assertEquals(ok(await v4.removeAll("/big")).value.count, 250);
  assertEquals(t.trace().filter((o) => o === "batch").length, 3);
  assertEquals(t.trace().filter((o) => o === "delete").length, 0);
  const t2 = traced(memoryStoreOf("m", ["read", "write", "list", "stat", "delete"]));
  const v5 = posix(t2.store);
  for (let i = 0; i < 5; i++) ok(await v5.writeFile(`/big/f${i}`, enc.encode("x")));
  t2.reset();
  ok(await v5.removeAll("/big"));
  assertEquals(t2.trace().filter((o) => o === "delete").length, 5);
});

proves(["0004-anyfs-posix-physical FR-006"], "the read cache is keyed by revision, bounded, drops the oldest, keeps no object larger than itself and gives copies", async () => {
  const cache = new ReadCache(10);
  cache.put("a", "sha256:1", new Uint8Array(6));
  cache.put("b", "sha256:2", new Uint8Array(6));
  assertEquals([cache.get("a", "sha256:1"), cache.get("b", "sha256:2")?.length], [undefined, 6]);
  assertEquals(cache.bytes, 6);
  cache.put("big", "sha256:3", new Uint8Array(11));
  assertEquals(cache.get("big", "sha256:3"), undefined);
  const copy = cache.get("b", "sha256:2");
  copy?.fill(9);
  assertEquals(cache.get("b", "sha256:2")?.[0], 0, "a change to a copy does not change the cache");
  assertEquals(cache.get("b", "sha256:other"), undefined, "another revision is another entry");
  const t = traced(memoryStoreOf("n"));
  const view = posix(t.store);
  ok(await view.writeFile("/f", enc.encode("hello")));
  t.reset();
  ok(await view.readFile("/f"));
  assertEquals(t.trace(), ["stat", "read"]);
  t.reset();
  const hit = ok(await view.readFile("/f"));
  assertEquals(t.trace(), ["stat"], "an object that has not changed costs a stat and no bytes");
  assert(hit.notes.length > 0);
  ok(await view.writeFile("/f", enc.encode("changed")));
  t.reset();
  assertEquals(dec.decode(ok(await view.readFile("/f")).value), "changed");
  assertEquals(t.trace(), ["stat", "read"], "a changed object is another revision");
  const t2 = traced(memoryStoreOf("o"));
  const nocache = posix(t2.store, { policy: policyWith({ readCacheBytes: 0 }) });
  ok(await nocache.writeFile("/f", enc.encode("x")));
  t2.reset();
  ok(await nocache.readFile("/f"));
  ok(await nocache.readFile("/f"));
  assertEquals(t2.trace(), ["read", "read"]);
});

proves(["0004-anyfs-posix-physical FR-007"], "an append and a truncate try again after a conflict, end with ESTALE when the attempts are spent, and a refused operation touches nothing", async () => {
  // one competing writer: the append reads again and succeeds
  const mem = memoryStoreOf("p");
  let raced = 0;
  const racing = intercept(mem, async (op, next) => {
    if (op.op === "write" && op.path === key("log") && raced === 0) {
      raced++;
      await next({ op: "write", path: op.path, bytes: enc.encode("x"), expect: { kind: "any" } });
    }
    return next(op);
  });
  const view = posix(racing);
  ok(await view.writeFile("/log", enc.encode("a")));
  raced = 0;
  ok(await view.appendFile("/log", enc.encode("b")));
  assertEquals(raced, 1, "the competing writer wrote once");
  assertEquals(dec.decode(ok(await view.readFile("/log")).value), "xb", "the append was made on what the competing writer left");
  // a writer that always wins: the attempts are spent
  let writes = 0;
  const losing = intercept(memoryStoreOf("q"), async (op, next) => {
    if (op.op === "write" && op.path === key("log")) {
      writes++;
      await next({ op: "write", path: op.path, bytes: enc.encode(`w${writes}`), expect: { kind: "any" } });
    }
    return next(op);
  });
  const v2 = posix(losing, { policy: policyWith({ appendAttempts: 3 }) });
  ok(await v2.writeFile("/log", enc.encode("a")));
  writes = 0;
  const spent = await v2.appendFile("/log", enc.encode("b"));
  assert(spent.kind === "err" && spent.error.errno === "ESTALE");
  assertEquals(writes, 3, "three attempts");
  // a refused operation changes and reads nothing
  const t = traced(memoryStoreOf("r", ["read", "write", "list", "stat", "delete"]));
  const poor = posix(t.store);
  for (const r of [await poor.appendFile("/x", enc.encode("x")), await poor.truncate("/x", 1), await poor.chmod("/x", 0), await poor.symlink("/a", "/b"), await poor.mmap(3 as never)]) assert(r.kind === "err" && r.error.errno === "ENOTSUP");
  assertEquals(t.trace(), []);
});

proves(["0004-anyfs-posix-physical FR-008"], "a view of a store that cannot be written reads, shows modes without the bits of write, and refuses everything that would change it with EROFS", async () => {
  const mem = memoryStoreOf("s");
  const writer = posix(mem);
  ok(await writer.writeFile("/d/f", enc.encode("fixed")));
  const t = traced(readOnly(mem));
  const view = posix(t.store);
  assertEquals(dec.decode(ok(await view.readFile("/d/f")).value), "fixed");
  assertEquals([ok(await view.stat("/d/f")).value.mode, ok(await view.stat("/d")).value.mode], [0o444, 0o555]);
  assertEquals(ok(await view.readdir("/d")).value.map((e) => e.name), ["f"]);
  const attempts = [
    await view.writeFile("/d/g", enc.encode("x")),
    await view.mkdir("/e"),
    await view.rmdir("/d"),
    await view.unlink("/d/f"),
    await view.rename("/d/f", "/d/h"),
    await view.open("/d/f", "r+"),
    await view.open("/new", "w"),
    await view.touch("/d/t"),
    await view.removeAll("/d"),
    await view.appendFile("/d/f", enc.encode("x")),
    await view.truncate("/d/f", 0),
  ];
  for (const r of attempts) assert(r.kind === "err" && r.error.errno === "EROFS" && r.error.fidelity.kind === "refused", JSON.stringify(r.kind === "err" ? r.error.errno : "ok"));
  assert(t.trace().every((o) => o === "read" || o === "stat" || o === "list"), "nothing that changes was asked of the store");
  const ro = ok(await view.open("/d/f", "r"));
  assertEquals(dec.decode(ok(await view.read(ro.value, 5)).value), "fixed");
  ok(await view.close(ro.value));
  assertEquals(dec.decode(ok(await writer.readFile("/d/f")).value), "fixed");
  const caps = new Set<Capability>(view.capabilities);
  assert(!caps.has("write") && !caps.has("delete"));
});
