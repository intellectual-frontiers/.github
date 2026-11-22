/**
 * Tests of the server of NFS version 3 over a real socket of the loopback (commons anyfs-serve 0006-anyfs-serve-nfs FR-004 to FR-012): the mount protocol, handles, attributes, listings, buffered writes and their commit,
 * the refusals of what a store cannot keep, the uids that may ask, the bounds, the events with their fidelity, and a model test against the POSIX view. The client is the one of `nfs-client.ts`, written from the RFCs;
 * there is no kernel client here (no NFS in this sandbox), so the mount of an operating system is untested, which the specification says (out of scope).
 *
 * @module
 */
import fc from "fast-check";
import { memoryStore } from "@intellectual-frontiers/anyfs/memory";
import { only, readOnly, type Store } from "@intellectual-frontiers/anyfs/logical";
import { keepMarkers, defaultPolicy } from "@intellectual-frontiers/anyfs-posix/governance";
import { posix } from "@intellectual-frontiers/anyfs-posix/physical";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { MOUNT_PROGRAM, NFS_PROGRAM, NFS_STATUS, serveNfs, XdrWriter, type NfsEvent, type ServeNfsOptions } from "../src/mod.ts";
import { type Fattr, NfsClient } from "./nfs-client.ts";

type Viewable = "read" | "list" | "stat";
const enc = (s: string): Uint8Array => new TextEncoder().encode(s);
const dec = (b: Uint8Array | undefined): string => new TextDecoder().decode(b);

type Rig = { readonly c: NfsClient; readonly root: Uint8Array; readonly store: Store<Viewable>; readonly events: NfsEvent[]; readonly port: number; readonly close: () => Promise<readonly string[]>; readonly dropped: () => number };

async function rig(options: ServeNfsOptions = {}, store: Store<Viewable> = memoryStore()): Promise<Rig> {
  const events: NfsEvent[] = [];
  const s = await serveNfs(store, { ...options, onEvent: (e) => void events.push(e) });
  if (s.kind === "err") throw new Error(s.error);
  const c = await NfsClient.open(s.value.port);
  const m = await c.mount();
  if (m.fh === undefined) throw new Error(`mount ${m.status}`);
  return {
    c,
    root: m.fh,
    store,
    events,
    port: s.value.port,
    dropped: s.value.dropped,
    close: async () => {
      c.close();
      return s.value.close();
    },
  };
}

async function using<T>(options: ServeNfsOptions, body: (r: Rig) => Promise<T>, store?: Store<Viewable>): Promise<T> {
  const r = await rig(options, store);
  try {
    return await body(r);
  } finally {
    await r.close();
  }
}

proves(["0006-anyfs-serve-nfs FR-004"], "the mount protocol gives the handle of the root for the export and refuses another path, and the export is listed on the same port as NFS", () =>
  using({}, async (r) => {
    assertEquals((await r.c.mount("/")).flavors, [1, 0]);
    assertEquals((await r.c.mount("/nope")).status, 2);
    const exp = await r.c.rpc(MOUNT_PROGRAM, 3, 5);
    assert(exp.kind === "ok");
    const dump = await r.c.rpc(MOUNT_PROGRAM, 3, 2);
    assert(dump.kind === "ok");
    assertEquals((await r.c.rpc(MOUNT_PROGRAM, 3, 3, new XdrWriter().string("/").bytes())).kind, "ok");
    assertEquals((await r.c.rpc(NFS_PROGRAM, 3, 0)).kind, "ok");
    const a = await r.c.getattr(r.root);
    assertEquals([a.status, a.attr?.type, a.attr?.nlink], [0, 2, 2]);
  }),
);

proves(["0006-anyfs-serve-nfs FR-002"], "a program, a version and a procedure the server does not have, and a call it cannot read, are answered with what RFC 5531 says, with the xid of the call", () =>
  using({}, async (r) => {
    const other = await r.c.rpc(100000, 2, 3);
    assertEquals([other.kind, other.kind === "failed" ? other.accept : -1], ["failed", 1]);
    const vers = await r.c.rpc(NFS_PROGRAM, 4, 0);
    assertEquals(vers.kind === "failed" ? [vers.accept, vers.versions] : [], [2, [3, 3]]);
    const proc = await r.c.rpc(NFS_PROGRAM, 3, 99);
    assertEquals(proc.kind === "failed" ? proc.accept : -1, 3);
    const garbage = await r.c.rpc(NFS_PROGRAM, 3, 1, new Uint8Array([1, 2]));
    assertEquals(garbage.kind === "failed" ? garbage.accept : -1, 4);
    const bad = await r.c.raw(r.c.callBytes(NFS_PROGRAM, 3, 0, new Uint8Array(), 4242, 3));
    assertEquals(new DataView(bad.buffer, bad.byteOffset).getUint32(0), 4242);
    const ok = await r.c.rpc(NFS_PROGRAM, 3, 0);
    assertEquals(ok.xid > 0, true);
  }),
);

proves(["0006-anyfs-serve-nfs FR-005"], "a handle is opaque and stable, refuses what was never given, what another boot gave and what is gone, and a rename keeps the handle of what was renamed", () =>
  using({}, async (r) => {
    const d = await r.c.mkdir(r.root, "d");
    const f = await r.c.create(d.fh ?? new Uint8Array(), "f.txt");
    assert(f.fh !== undefined && f.fh.length <= 64);
    assertEquals(dec((await r.c.lookup(d.fh ?? new Uint8Array(), "f.txt")).fh), dec(f.fh));
    assertEquals((await r.c.getattr(new Uint8Array(17))).status, NFS_STATUS.BADHANDLE === 10001 ? 10001 : -1);
    const wrongBoot = Uint8Array.from(f.fh ?? []);
    wrongBoot[1] = (wrongBoot[1] ?? 0) ^ 0xff;
    assertEquals((await r.c.getattr(wrongBoot)).status, NFS_STATUS.STALE);
    const unknown = Uint8Array.from(f.fh ?? []);
    unknown[16] = 0xee;
    unknown[15] = 0xee;
    assertEquals((await r.c.getattr(unknown)).status, NFS_STATUS.STALE);
    assertEquals(await r.c.rename(d.fh ?? new Uint8Array(), "f.txt", r.root, "g.txt"), 0);
    assertEquals((await r.c.getattr(f.fh ?? new Uint8Array())).status, 0);
    assertEquals((await r.c.lookup(d.fh ?? new Uint8Array(), "f.txt")).status, NFS_STATUS.NOENT);
    assertEquals(await r.c.remove(r.root, "g.txt"), 0);
    assertEquals((await r.c.getattr(f.fh ?? new Uint8Array())).status, NFS_STATUS.STALE);
  }),
);

proves(["0006-anyfs-serve-nfs FR-005"], "the table of handles is bounded: a handle that was dropped is stale and a name looked up again gives a handle", () =>
  using({ maxHandles: 4 }, async (r) => {
    const first = await r.c.create(r.root, "n0");
    for (let i = 1; i < 12; i++) await r.c.create(r.root, `n${i}`);
    assertEquals((await r.c.getattr(first.fh ?? new Uint8Array())).status, NFS_STATUS.STALE);
    const again = await r.c.lookup(r.root, "n0");
    assertEquals(again.status, 0);
    assertEquals((await r.c.getattr(again.fh ?? new Uint8Array())).status, 0);
    assertEquals((await r.c.getattr(r.root)).status, 0);
  }),
);

proves(["0006-anyfs-serve-nfs FR-006"], "attributes, lookups, access and listings are those of the view, in a stable order that resumes, and names that the store would not keep are invalid", () =>
  using({}, async (r) => {
    for (const n of ["b.txt", "a.txt", "c.txt"]) {
      const f = await r.c.create(r.root, n);
      await r.c.write(f.fh ?? new Uint8Array(), 0, enc(`hello ${n}`), 2);
    }
    await r.c.mkdir(r.root, "dir");
    const plain = await r.c.readdir(r.root);
    assertEquals(plain.names, [".", "..", "a.txt", "b.txt", "c.txt", "dir"]);
    const plus = await r.c.readdir(r.root, true);
    assertEquals(plus.names, plain.names);
    assertEquals(plus.attrs.get("a.txt")?.size, "hello a.txt".length);
    assertEquals(plus.attrs.get("dir")?.type, 2);
    const hit = await r.c.lookup(r.root, "b.txt");
    assertEquals([hit.attr?.type, hit.attr?.size, hit.attr?.mode, hit.attr?.nlink], [1, 11, 0o644, 1]);
    assertEquals((await r.c.lookup(r.root, "..")).status, 0);
    assertEquals((await r.c.lookup(r.root, "missing")).status, NFS_STATUS.NOENT);
    assertEquals((await r.c.lookup(hit.fh ?? new Uint8Array(), "x")).status, NFS_STATUS.NOTDIR);
    for (const bad of ["", "a/b", "a\u0000b", "é"]) assertEquals((await r.c.lookup(r.root, bad)).status, NFS_STATUS.INVAL, JSON.stringify(bad));
    assertEquals((await r.c.lookup(r.root, "x".repeat(300))).status, NFS_STATUS.NAMETOOLONG);
    const acc = await r.c.nfs("ACCESS", new XdrWriter().opaque(r.root).u32(0x3f).bytes());
    assertEquals(acc.u32(), 0);
    const info = await r.c.nfs("FSINFO", new XdrWriter().opaque(r.root).bytes());
    assertEquals(info.u32(), 0);
    assertEquals(await r.c.plain("PATHCONF", r.root), 0);
    assertEquals(await r.c.plain("FSSTAT", r.root), 0);
    assertEquals((await r.c.read(hit.fh ?? new Uint8Array(), 6, 100)).eof, true);
    assertEquals(dec((await r.c.read(hit.fh ?? new Uint8Array(), 0, 5)).data), "hello");
    assertEquals((await r.c.read(r.root, 0, 5)).status, NFS_STATUS.ISDIR);
  }),
);

proves(["0006-anyfs-serve-nfs FR-006"], "a time that the store does not keep changes when the revision of an object does, so that a client's cache is not kept past a change", () =>
  using({}, async (r) => {
    const f = await r.c.create(r.root, "t.txt");
    await r.c.write(f.fh ?? new Uint8Array(), 0, enc("one"), 2);
    const before = (await r.c.getattr(f.fh ?? new Uint8Array())).attr?.mtime;
    await r.c.write(f.fh ?? new Uint8Array(), 0, enc("two"), 2);
    const after = (await r.c.getattr(f.fh ?? new Uint8Array())).attr?.mtime;
    assert(before !== undefined && after !== undefined);
    assert(before?.[0] !== after?.[0] || before?.[1] !== after?.[1], "the time moved with the change");
  }),
);

proves(["0006-anyfs-serve-nfs FR-007"], "writes are held and put as one object at COMMIT, are seen by reads before that, and the verifier is the boot identity", () =>
  using({ flushAfterMs: 60_000 }, async (r) => {
    const f = await r.c.create(r.root, "big.bin");
    const fh = f.fh ?? new Uint8Array();
    const one = await r.c.write(fh, 0, enc("hello "), 0);
    const two = await r.c.write(fh, 6, enc("world"), 0);
    assertEquals([one.committed, two.committed, one.count], [0, 0, 6]);
    assertEquals(one.verf, two.verf);
    assertEquals(dec(await r.c.readAll(fh)), "hello world");
    assertEquals((await r.c.getattr(fh)).attr?.size, 11);
    const held = await r.store.read("big.bin" as never);
    assertEquals(held.kind === "ok" ? held.value.bytes.length : -1, 0, "nothing was put yet");
    const c = await r.c.commit(fh);
    assertEquals(c.status, 0);
    assertEquals(dec(c.verf), dec(one.verf));
    const put = await r.store.read("big.bin" as never);
    assertEquals(put.kind === "ok" ? dec(put.value.bytes) : "", "hello world");
    // a write past the end fills the gap with zeros
    await r.c.write(fh, 14, enc("!"), 2);
    assertEquals([...(await r.c.readAll(fh))].slice(11), [0, 0, 0, 33]);
    // a stable write is put at once
    const s = await r.c.write(fh, 0, enc("HELLO"), 2);
    assertEquals(s.committed, 2);
    const stable = await r.store.read("big.bin" as never);
    assertEquals(stable.kind === "ok" ? dec(stable.value.bytes.subarray(0, 5)) : "", "HELLO");
    // truncate through SETATTR
    assertEquals(await r.c.setattr(fh, { size: 3 }), 0);
    assertEquals(dec(await r.c.readAll(fh)), "HEL");
  }),
);

proves(["0006-anyfs-serve-nfs FR-007"], "a buffer is put when it has been idle, before a rename and when the server closes, and an object larger than the limit is FBIG", async () => {
  await using({ flushAfterMs: 30 }, async (r) => {
    const f = await r.c.create(r.root, "idle.txt");
    await r.c.write(f.fh ?? new Uint8Array(), 0, enc("late"), 0);
    for (let i = 0; i < 100; i++) {
      const got = await r.store.read("idle.txt" as never);
      if (got.kind === "ok" && got.value.bytes.length === 4) break;
      await new Promise((res) => setTimeout(res, 20));
    }
    const got = await r.store.read("idle.txt" as never);
    assertEquals(got.kind === "ok" ? dec(got.value.bytes) : "", "late");
  });
  await using({ flushAfterMs: 60_000 }, async (r) => {
    const f = await r.c.create(r.root, "before.txt");
    await r.c.write(f.fh ?? new Uint8Array(), 0, enc("moved"), 0);
    assertEquals(await r.c.rename(r.root, "before.txt", r.root, "after.txt"), 0);
    const got = await r.store.read("after.txt" as never);
    assertEquals(got.kind === "ok" ? dec(got.value.bytes) : "", "moved");
    const g = await r.c.create(r.root, "closing.txt");
    await r.c.write(g.fh ?? new Uint8Array(), 0, enc("kept"), 0);
  });
  const store = memoryStore();
  const s = await serveNfs(store, { flushAfterMs: 60_000, maxFileBytes: 1024 });
  assert(s.kind === "ok");
  if (s.kind !== "ok") return;
  const c = await NfsClient.open(s.value.port);
  const root = (await c.mount()).fh ?? new Uint8Array();
  const f = await c.create(root, "x.txt");
  assertEquals((await c.write(f.fh ?? new Uint8Array(), 1020, enc("too long"), 0)).status, NFS_STATUS.FBIG);
  await c.write(f.fh ?? new Uint8Array(), 0, enc("final"), 0);
  c.close();
  assertEquals(await s.value.close(), []);
  const got = await store.read("x.txt" as never);
  assertEquals(got.kind === "ok" ? dec(got.value.bytes) : "", "final");
});

async function using2<T>(options: ServeNfsOptions, body: (r: Rig) => Promise<T>): Promise<T> {
  return using(options, body);
}
void using2;

proves(["0006-anyfs-serve-nfs FR-008"], "create (unchecked, guarded, exclusive with its verifier), mkdir, remove, rmdir and rename are done through the view and fail with the statuses of a file system", () =>
  using({}, async (r) => {
    const d = await r.c.mkdir(r.root, "d");
    assertEquals((await r.c.mkdir(r.root, "d")).status, NFS_STATUS.EXIST);
    const dfh = d.fh ?? new Uint8Array();
    const f = await r.c.create(dfh, "f", 1);
    assertEquals(f.status, 0);
    assertEquals((await r.c.create(dfh, "f", 1)).status, NFS_STATUS.EXIST);
    assertEquals((await r.c.create(dfh, "f", 0)).status, 0);
    const verf = Uint8Array.of(1, 2, 3, 4, 5, 6, 7, 8);
    assertEquals((await r.c.create(dfh, "x", 2, verf)).status, 0);
    assertEquals((await r.c.create(dfh, "x", 2, verf)).status, 0);
    assertEquals((await r.c.create(dfh, "x", 2, Uint8Array.of(9, 9, 9, 9, 9, 9, 9, 9))).status, NFS_STATUS.EXIST);
    assertEquals((await r.c.create(r.root, "d", 0)).status, NFS_STATUS.ISDIR);
    assertEquals(await r.c.remove(r.root, "d"), NFS_STATUS.ISDIR);
    assertEquals(await r.c.remove(dfh, "f", "RMDIR"), NFS_STATUS.NOTDIR);
    assertEquals(await r.c.remove(r.root, "d", "RMDIR"), NFS_STATUS.NOTEMPTY);
    assertEquals(await r.c.remove(dfh, "nothing"), NFS_STATUS.NOENT);
    assertEquals(await r.c.rename(dfh, "nothing", r.root, "z"), NFS_STATUS.NOENT);
    assertEquals(await r.c.remove(dfh, "f"), 0);
    assertEquals(await r.c.remove(dfh, "x"), 0);
    assertEquals(await r.c.remove(r.root, "d", "RMDIR"), 0);
    assertEquals((await r.c.lookup(r.root, "d")).status, NFS_STATUS.NOENT);
  }),
);

proves(["0006-anyfs-serve-nfs FR-008"], "an overwrite as a kernel client makes it, an unchecked create with a size of 0 or a SETATTR of the size, truncates the file, and a guarded create of a name that is there is refused", () =>
  using({}, async (r) => {
    const bytes = (s: string): Uint8Array => new TextEncoder().encode(s);
    const text = async (fh: Uint8Array): Promise<string> => new TextDecoder().decode(await r.c.readAll(fh));
    const f = await r.c.create(r.root, "o.txt", 1);
    const fh = f.fh ?? new Uint8Array();
    assertEquals((await r.c.write(fh, 0, bytes("old content"))).status, 0);
    // a guarded create (what libnfs 5.0.2 sends for nfs_creat) is refused and changes nothing
    assertEquals((await r.c.create(r.root, "o.txt", 1, undefined, 0o644)).status, NFS_STATUS.EXIST);
    assertEquals(await text(fh), "old content");
    // an unchecked create without a size accepts the name and keeps the bytes
    assertEquals((await r.c.create(r.root, "o.txt", 0, undefined, 0o644)).status, 0);
    assertEquals(await text(fh), "old content");
    // an unchecked create with a size of 0 (open with O_TRUNC) truncates
    assertEquals((await r.c.create(r.root, "o.txt", 0, undefined, undefined, 0)).status, 0);
    assertEquals(await text(fh), "");
    assertEquals((await r.c.write(fh, 0, bytes("new"))).status, 0);
    assertEquals(await text(fh), "new");
    // a SETATTR of the size truncates and extends
    assertEquals(await r.c.setattr(fh, { size: 0 }), 0);
    assertEquals(await text(fh), "");
    assertEquals((await r.c.write(fh, 0, bytes("abcdef"))).status, 0);
    assertEquals(await r.c.setattr(fh, { size: 3 }), 0);
    assertEquals(await text(fh), "abc");
  }),
);

proves(["0006-anyfs-serve-nfs FR-009"], "links, symbolic links and nodes are refused, a mode, owner or time the store cannot keep is refused by default and accepted and counted where asked, and the mode of a create is said not to be kept", async () => {
  await using({}, async (r) => {
    const f = await r.c.create(r.root, "f", 1, undefined, 0o600);
    const fh = f.fh ?? new Uint8Array();
    assertEquals(r.events.find((e) => e.proc === "CREATE")?.note, "the mode 600 of the create is not kept");
    assertEquals((await r.c.nfs("SYMLINK", new XdrWriter().opaque(r.root).string("l").u32(0).u32(0).u32(0).u32(0).u32(0).u32(0).u32(0).u32(0).string("f").bytes())).u32(), NFS_STATUS.NOTSUPP);
    assertEquals((await r.c.nfs("LINK", new XdrWriter().opaque(fh).opaque(r.root).string("h").bytes())).u32(), NFS_STATUS.NOTSUPP);
    assertEquals((await r.c.nfs("MKNOD", new XdrWriter().opaque(r.root).string("n").u32(3).bytes())).u32(), NFS_STATUS.BADTYPE);
    assertEquals((await r.c.nfs("READLINK", new XdrWriter().opaque(fh).bytes())).u32(), NFS_STATUS.INVAL);
    assertEquals(await r.c.setattr(fh, { mode: 0o600 }), NFS_STATUS.NOTSUPP);
    assertEquals(await r.c.setattr(fh, { mode: 0o644 }), 0, "what the object already has is no change");
    assertEquals(await r.c.setattr(fh, { mtime: "server" }), NFS_STATUS.NOTSUPP);
    assertEquals(await r.c.setattr(fh, { uid: 5 }), NFS_STATUS.NOTSUPP);
    const refused = r.events.filter((e) => e.proc === "SETATTR" && e.status === NFS_STATUS.NOTSUPP);
    assertEquals(refused.length, 3);
    assertEquals(refused[0]?.fidelity.kind, "refused");
    assertEquals(r.dropped(), 0);
  });
  await using({ attributes: "ignore" }, async (r) => {
    const f = await r.c.create(r.root, "f");
    const fh = f.fh ?? new Uint8Array();
    assertEquals(await r.c.setattr(fh, { mode: 0o600, mtime: "server" }), 0);
    assertEquals(r.dropped(), 2);
    const e = r.events.filter((x) => x.proc === "SETATTR").at(-1);
    assertEquals(e?.fidelity.kind, "emulated");
    assertStringIncludes(e?.note ?? "", "mode");
    assertEquals((await r.c.getattr(fh)).attr?.mode, 0o644, "and the object does not say it kept it");
  });
});

proves(["0006-anyfs-serve-nfs FR-010"], "only the uids that are named may mount or ask, and a refused caller gets no handle", async () => {
  const store = memoryStore();
  const s = await serveNfs(store, { uids: [1000] });
  assert(s.kind === "ok");
  if (s.kind !== "ok") return;
  try {
    const stranger = await NfsClient.open(s.value.port, { kind: "sys", uid: 4242, gid: 4242 });
    assertEquals((await stranger.mount()).status, 13);
    const anon = await NfsClient.open(s.value.port, { kind: "none" });
    assertEquals((await anon.mount()).status, 13);
    const sneaky = await stranger.getattr(new Uint8Array(17));
    assertEquals(sneaky.status, NFS_STATUS.ACCES);
    const mine = await NfsClient.open(s.value.port, { kind: "sys", uid: 1000, gid: 1 });
    assertEquals((await mine.mount()).status, 0);
    assertEquals((await stranger.rpc(NFS_PROGRAM, 3, 0)).kind, "ok");
    stranger.close();
    anon.close();
    mine.close();
  } finally {
    await s.value.close();
  }
});

proves(["0006-anyfs-serve-nfs FR-010"], "the server listens on the loopback, bounds its connections, drops a record that is too long, and refuses every change where it is read-only or the store cannot write", async () => {
  const s = await serveNfs(memoryStore(), { maxConnections: 2 });
  assert(s.kind === "ok");
  if (s.kind !== "ok") return;
  assertEquals(s.value.hostname, "127.0.0.1");
  assertStringIncludes(s.value.mountCommand("/mnt/x"), `port=${s.value.port},mountport=${s.value.port},nolock`);
  const a = await NfsClient.open(s.value.port);
  const b = await NfsClient.open(s.value.port);
  assertEquals((await a.mount()).status, 0);
  assertEquals((await b.mount()).status, 0);
  const third = await NfsClient.open(s.value.port);
  const gone = await Promise.race([third.mount().then(() => "answered", () => "closed"), new Promise<string>((res) => setTimeout(() => res("closed"), 500))]);
  assertEquals(gone, "closed");
  a.close();
  b.close();
  third.close();
  await s.value.close();
  await using({ readOnly: true }, async (r) => {
    assertEquals((await r.c.create(r.root, "f")).status, NFS_STATUS.ROFS);
    assertEquals((await r.c.mkdir(r.root, "d")).status, NFS_STATUS.ROFS);
    assertEquals(await r.c.remove(r.root, "f"), NFS_STATUS.ROFS);
    assertEquals((await r.c.getattr(r.root)).status, 0);
    const acc = await r.c.nfs("ACCESS", new XdrWriter().opaque(r.root).u32(0x3f).bytes());
    acc.u32();
    assertEquals(acc.bool(), true);
  });
  const ro = readOnly(memoryStore()) as unknown as Store<Viewable>;
  await using({}, async (r) => {
    assertEquals((await r.c.create(r.root, "f")).status, NFS_STATUS.ROFS);
  }, ro);
  const reading = only(memoryStore(), ["read", "list", "stat"] as const);
  await using({}, async (r) => {
    assertEquals((await r.c.mkdir(r.root, "d")).status, NFS_STATUS.ROFS);
  }, reading);
});

proves(["0006-anyfs-serve-nfs FR-011"], "every operation tells the procedure, the path, the status and how it was carried out, and the bytes of an object are not in what is told", () =>
  using({ flushAfterMs: 60_000 }, async (r) => {
    const f = await r.c.create(r.root, "secret.txt");
    await r.c.write(f.fh ?? new Uint8Array(), 0, enc("TOP-SECRET-BYTES"), 0);
    await r.c.getattr(f.fh ?? new Uint8Array());
    await r.c.lookup(r.root, "missing");
    const procs = r.events.map((e) => e.proc);
    for (const p of ["MNT", "CREATE", "WRITE", "GETATTR", "LOOKUP"] as const) assert(procs.includes(p), p);
    const write = r.events.find((e) => e.proc === "WRITE");
    assertEquals([write?.path, write?.status, write?.fidelity.kind], ["/secret.txt", 0, "emulated"]);
    const miss = r.events.find((e) => e.proc === "LOOKUP");
    assertEquals(miss?.status, NFS_STATUS.NOENT);
    assert(miss?.fidelity !== undefined, "and how the view carried it out");
    assert(!JSON.stringify(r.events).includes("TOP-SECRET"), "no bytes in the events");
    assertEquals(r.events.find((e) => e.proc === "WRITE")?.uid, 1000);
  }),
);

// ---- the model: the same steps through the protocol and through the view end with the same files ----

type Step = { readonly op: "mkdir" | "put" | "rm" | "rmdir" | "mv"; readonly a: string; readonly b: string; readonly data: string };
const NAMES = ["p", "q", "r"];
const pathArb = fc.tuple(fc.constantFrom(...NAMES), fc.option(fc.constantFrom("x", "y"), { nil: undefined })).map(([d, f]) => (f === undefined ? `/${d}` : `/${d}/${f}`));
const stepArb: fc.Arbitrary<Step> = fc.record({ op: fc.constantFrom("mkdir", "put", "rm", "rmdir", "mv"), a: pathArb, b: pathArb, data: fc.string({ maxLength: 12 }).map((s) => s.replace(/[^\x20-\x7e]/gu, "")) });

async function walk(c: NfsClient, root: Uint8Array, path: string): Promise<{ status: number; fh?: Uint8Array }> {
  let fh = root;
  for (const part of path.split("/").filter((p) => p !== "")) {
    const l = await c.lookup(fh, part);
    if (l.status !== 0 || l.fh === undefined) return { status: l.status };
    fh = l.fh;
  }
  return { status: 0, fh };
}

const split = (path: string): { dir: string; name: string } => {
  const i = path.lastIndexOf("/");
  return { dir: i <= 0 ? "/" : path.slice(0, i), name: path.slice(i + 1) };
};

/** What a client of NFS cannot do and the view can: make a name where its directory is not there (the view derives the directory). */
async function parentThere(view: ReturnType<typeof posix>, path: string): Promise<boolean> {
  const dir = split(path).dir;
  if (dir === "/") return true;
  const s = await view.stat(dir);
  return s.kind === "ok" && s.value.value.type === "dir";
}

async function treeOf(view: ReturnType<typeof posix>, dir: string, out: string[]): Promise<void> {
  const listed = await view.readdir(dir);
  if (listed.kind !== "ok") return;
  for (const e of [...listed.value.value].sort((x, y) => (x.name < y.name ? -1 : 1))) {
    const p = dir === "/" ? `/${e.name}` : `${dir}/${e.name}`;
    if (e.type === "dir") {
      out.push(`${p}/`);
      await treeOf(view, p, out);
    } else {
      const r = await view.readFile(p);
      out.push(`${p}=${r.kind === "ok" ? dec(r.value.value) : "?"}`);
    }
  }
}

proves(["0006-anyfs-serve-nfs FR-012"], "random steps of mkdir, put, remove, rmdir and rename through the protocol and through the view end with the same files, and each step succeeds in both or in neither", async () => {
  const kept = keepMarkers(".keep");
  const policy = kept.kind === "ok" ? { ...defaultPolicy(), markers: kept.value } : defaultPolicy();
  await fc.assert(
    fc.asyncProperty(fc.array(stepArb, { maxLength: 14 }), async (steps) => {
      const viaNfs = memoryStore();
      const viaView = memoryStore();
      const s = await serveNfs(viaNfs, { flushAfterMs: 60_000 });
      if (s.kind !== "ok") throw new Error(s.error);
      const c = await NfsClient.open(s.value.port);
      const root = (await c.mount()).fh ?? new Uint8Array();
      const view = posix(viaView, { policy });
      try {
        for (const st of steps) {
          let nfsOk: boolean;
          let viewOk: boolean;
          const A = split(st.a);
          if (st.op === "mkdir") {
            const dir = await walk(c, root, A.dir);
            nfsOk = dir.fh !== undefined && (await c.mkdir(dir.fh, A.name)).status === 0;
            viewOk = (await parentThere(view, st.a)) && (await view.mkdir(st.a)).kind === "ok";
          } else if (st.op === "put") {
            const dir = await walk(c, root, A.dir);
            let ok = false;
            if (dir.fh !== undefined) {
              const f = await c.create(dir.fh, A.name, 0);
              if (f.status === 0 && f.fh !== undefined) {
                ok = (await c.write(f.fh, 0, enc(st.data), 0)).status === 0;
                if (ok) ok = (await c.setattr(f.fh, { size: st.data.length })) === 0;
                if (ok) ok = (await c.commit(f.fh)).status === 0;
              }
            }
            nfsOk = ok;
            viewOk = (await parentThere(view, st.a)) && (await view.writeFile(st.a, enc(st.data))).kind === "ok";
          } else if (st.op === "rm" || st.op === "rmdir") {
            const dir = await walk(c, root, A.dir);
            nfsOk = dir.fh !== undefined && (await c.remove(dir.fh, A.name, st.op === "rm" ? "REMOVE" : "RMDIR")) === 0;
            viewOk = (st.op === "rm" ? await view.unlink(st.a) : await view.rmdir(st.a)).kind === "ok";
          } else {
            const B = split(st.b);
            const from = await walk(c, root, A.dir);
            const to = await walk(c, root, B.dir);
            nfsOk = from.fh !== undefined && to.fh !== undefined && (await c.rename(from.fh, A.name, to.fh, B.name)) === 0;
            viewOk = (await parentThere(view, st.b)) && (await view.rename(st.a, st.b)).kind === "ok";
          }
          if (nfsOk !== viewOk) throw new Error(`${JSON.stringify(st)}: the protocol ${nfsOk ? "did" : "refused"} and the view ${viewOk ? "did" : "refused"}`);
        }
        assertEquals(await s.value.close(), []);
        const a: string[] = [];
        const b: string[] = [];
        await treeOf(posix(viaNfs, { policy }), "/", a);
        await treeOf(view, "/", b);
        assertEquals(a, b);
      } finally {
        c.close();
        await s.value.close();
      }
    }),
    { numRuns: 40 },
  );
});

proves(["0006-anyfs-serve-nfs FR-012"], "a client that writes a file in many parts, lists and reads it, then renames and removes it, ends with the file in the store as one object", () =>
  using({}, async (r) => {
    const d = await r.c.mkdir(r.root, "docs");
    const f = await r.c.create(d.fh ?? new Uint8Array(), "report.txt");
    const body = "x".repeat(10_000);
    for (let at = 0; at < body.length; at += 3000) await r.c.write(f.fh ?? new Uint8Array(), at, enc(body.slice(at, at + 3000)), 0);
    assertEquals((await r.c.commit(f.fh ?? new Uint8Array())).status, 0);
    const put = await r.store.read("docs/report.txt" as never);
    assertEquals(put.kind === "ok" ? put.value.bytes.length : -1, 10_000);
    const listed = await r.c.readdir(d.fh ?? new Uint8Array(), true);
    assertEquals(listed.names.filter((n) => !n.startsWith(".")), ["report.txt"]);
    assertEquals(listed.attrs.get("report.txt")?.size, 10_000);
    assertEquals((await r.c.readAll(f.fh ?? new Uint8Array())).length, 10_000);
    assertEquals(await r.c.rename(d.fh ?? new Uint8Array(), "report.txt", r.root, "final.txt"), 0);
    assertEquals(await r.c.remove(r.root, "final.txt"), 0);
    assertEquals(await r.c.remove(r.root, "docs", "RMDIR"), 0);
    const attrs: Fattr | undefined = (await r.c.getattr(r.root)).attr;
    assertEquals(attrs?.type, 2);
  }),
);
