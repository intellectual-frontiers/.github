/**
 * Tests of the store over a folder of Google Drive (commons anyfs-gdrive 0002-anyfs-gdrive-store FR-001 to FR-009), on a Drive made in process from the documentation of the API: what goes on the wire, the capabilities
 * (and the one the store does not have), the revision of the bytes, the resolution of names where Drive holds many of one name, the race of writers that expect no object, the trash, a listing in pages, the table of
 * errors and the bound on the size of an object.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { memoryStore } from "@intellectual-frontiers/anyfs/memory";
import { comparePaths, type Cursor, expectAbsent, expectAny, expectRev, parsePrefix, parseRevision, type Path, ROOT as ROOT_PREFIX } from "@intellectual-frontiers/anyfs/governance";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { CAPABILITIES, FAILURE_KINDS, failureOf, kindOf, openDriveStore, problemOf, type TokenSource } from "../src/mod.ts";
import { ENDPOINT, fakeDrive, ROOT } from "./fake-drive.ts";
import { bytes, open, p, placeOf, text } from "./support.ts";

const must = <T>(r: { readonly kind: "ok"; readonly value: T } | { readonly kind: "err"; readonly error: unknown }): T => {
  if (r.kind !== "ok") throw new Error(JSON.stringify(r.error));
  return r.value;
};

proves(["0002-anyfs-gdrive-store FR-001"], "every request carries the bearer token and supportsAllDrives, a token that is refused is asked for again once, and a folder that is not there or a token that is not accepted is found at open and never shown", async () => {
  const fake = fakeDrive();
  const { store } = await open(fake);
  must(await store.write(p("a.txt"), bytes("one"), expectAny));
  assertEquals(text(must(await store.read(p("a.txt"))).bytes), "one");
  for (const r of fake.log) {
    assertEquals(r.headers["authorization"], "Bearer good-token", r.url);
    assertStringIncludes(r.url, "supportsAllDrives=true");
  }
  const issued: string[] = [];
  const rotating: TokenSource = async () => {
    issued.push("t");
    return ok(issued.length === 1 ? "stale" : "good-token");
  };
  const folder = fake.folder(ROOT, "rot");
  const fresh = must(await openDriveStore({ place: placeOf(folder), token: rotating, endpoint: ENDPOINT, transport: fake.transport }));
  must(await fresh.write(p("k"), bytes("k"), expectAny));
  assert(issued.length >= 2, "the source was asked again after the 401");
  const bad = await openDriveStore({ place: placeOf(folder), token: async () => ok("secret-token-text"), endpoint: ENDPOINT, transport: fake.transport });
  assert(bad.kind === "err");
  assert(!JSON.stringify(bad).includes("secret-token-text"), "the token is not in the answer");
  assert((await openDriveStore({ place: placeOf("NOSUCHFOLDER"), token: async () => ok("good-token"), endpoint: ENDPOINT, transport: fake.transport })).kind === "err");
  assert((await openDriveStore({ place: placeOf(folder), token: async () => err("the sign-in expired"), endpoint: ENDPOINT, transport: fake.transport })).kind === "err");
  const file = await fake.put(folder, "afile", "x");
  assert((await openDriveStore({ place: placeOf(file), token: async () => ok("good-token"), endpoint: ENDPOINT, transport: fake.transport })).kind === "err", "a file is not a folder");
});

proves(["0002-anyfs-gdrive-store FR-002"], "the store has read, write, list, stat and delete and no cas, so that a revision cannot be expected, and refuses what it does not have", async () => {
  const fake = fakeDrive();
  const { store } = await open(fake, { maxBytes: 1000 });
  assertEquals([...store.capabilities].sort(), [...CAPABILITIES].sort());
  assert(!store.capabilities.has("cas"));
  assertEquals(store.traits, { caseSensitive: true, maxObject: 1000 });
  const w = must(await store.write(p("a"), bytes("x"), expectAny));
  const viaHandle = await store.handle({ op: "write", path: p("a"), bytes: bytes("y"), expect: expectRev(w.rev) });
  assert(viaHandle.kind === "err" && viaHandle.error.kind === "refused" && viaHandle.error.reason === "unsupported-expectation");
  const del = await store.handle({ op: "delete", path: p("a"), expect: expectRev(w.rev) });
  assert(del.kind === "err" && del.error.kind === "refused" && del.error.reason === "unsupported-expectation");
  for (const op of [{ op: "batch", changes: [] }, { op: "history", path: p("a") }, { op: "rangeRead", path: p("a"), start: 0, length: 1 }, { op: "search", prefix: ROOT_PREFIX, text: "x" }] as const) {
    const r = await store.handle(op);
    assert(r.kind === "err" && r.error.kind === "refused" && r.error.reason === "capability-absent", op.op);
  }
  const big = await open(fake, { maxBytes: 99_999_999 });
  assertEquals(big.store.traits.maxObject, 5 * 1024 * 1024, "never above what one multipart upload takes");
});

proves(["0002-anyfs-gdrive-store FR-003"], "the revision is sha256 and the digest of the bytes, the same as in memory; the checksum Drive keeps is used where given; bytes that are not the digest are tampered", async () => {
  const fake = fakeDrive();
  const { store } = await open(fake);
  const memory = memoryStore();
  const w = must(await store.write(p("docs/r.txt"), bytes("same bytes"), expectAny));
  assertEquals(w.rev, must(await memory.write(p("docs/r.txt"), bytes("same bytes"), expectAny)).rev);
  assertEquals(w.rev, `sha256:${await sha256(bytes("same bytes"))}`);
  fake.requests.length = 0;
  assertEquals(must(await store.stat(p("docs/r.txt"))).rev, w.rev);
  assert(!fake.requests.some((r) => r.includes("alt=media")), "a stat of a service that keeps the digest asks for no bytes");
  const plain = fakeDrive({ checksums: false });
  const s2 = (await open(plain)).store;
  must(await s2.write(p("r.txt"), bytes("same bytes"), expectAny));
  plain.requests.length = 0;
  assertEquals(must(await s2.stat(p("r.txt"))).rev, w.rev);
  assert(plain.requests.some((r) => r.includes("alt=media")), "where Drive keeps no digest the bytes are read");
  const id = fake.byName("r.txt")[0]?.id ?? "";
  fake.corrupt(id);
  const t = await store.read(p("docs/r.txt"));
  assert(t.kind === "err" && t.error.kind === "tampered", JSON.stringify(t));
});

proves(["0002-anyfs-gdrive-store FR-004"], "where Drive holds many files of one name the store means the oldest, a name is compared exactly and a name in the trash counts for nothing", async () => {
  const fake = fakeDrive();
  const { store, folder } = await open(fake);
  const older = await fake.put(folder, "dup.txt", "the older");
  await fake.put(folder, "dup.txt", "the newer");
  assertEquals(text(must(await store.read(p("dup.txt"))).bytes), "the older");
  const w = must(await store.write(p("dup.txt"), bytes("replaced"), expectAny));
  assertEquals(w.created, false);
  assertEquals(fake.byName("dup.txt").find((f) => f.id === older)?.text, "replaced");
  // exact names: the fake's query is loose, and `File.txt` and `file.txt` are two objects
  must(await store.write(p("File.txt"), bytes("upper"), expectAny));
  assertEquals((await store.read(p("file.txt"))).kind, "err");
  must(await store.write(p("file.txt"), bytes("lower"), expectAny));
  assertEquals(text(must(await store.read(p("File.txt"))).bytes), "upper");
  assertEquals(text(must(await store.read(p("file.txt"))).bytes), "lower");
  // quotes in a name are escaped in the query
  for (const name of ["it's.txt", 'say "hi".txt', "é 😀 and name = 'x'.txt"]) {
    must(await store.write(p(name), bytes(name), expectAny));
    assertEquals(text(must(await store.read(p(name))).bytes), name);
  }
  // a name in the trash is not there
  must(await store.delete(p("File.txt"), expectAny));
  assertEquals((await store.read(p("File.txt"))).kind, "err");
  assertEquals(must(await store.write(p("File.txt"), bytes("again"), expectAbsent)).created, true);
});

proves(["0002-anyfs-gdrive-store FR-005"], "of several writers that expect no object exactly one wins and the others are conflicts that name the winner, and folders made at once are one folder", async () => {
  const fake = fakeDrive();
  const { store, folder } = await open(fake);
  const results = await Promise.all(Array.from({ length: 8 }, (_, i) => store.write(p("race/one.txt"), bytes(`writer ${i}`), expectAbsent)));
  const wins = results.flatMap((r, i) => (r.kind === "ok" ? [i] : []));
  assertEquals(wins.length, 1);
  for (const r of results) if (r.kind === "err") assert(r.error.kind === "conflict" && r.error.found.kind === "rev", JSON.stringify(r));
  const winner = wins[0] ?? 0;
  assertEquals(text(must(await store.read(p("race/one.txt"))).bytes), `writer ${winner}`);
  assertEquals(fake.byName("race").filter((f) => !f.trashed).length, 1, "one folder race");
  assertEquals(fake.byName("one.txt").filter((f) => !f.trashed).length, 1, "one file one.txt");
  // different names in one new folder, at once
  const many = await Promise.all(Array.from({ length: 6 }, (_, i) => store.write(p(`fresh/f${i}`), bytes(`${i}`), expectAny)));
  for (const r of many) assert(r.kind === "ok", JSON.stringify(r));
  assertEquals(fake.byName("fresh").filter((f) => !f.trashed).length, 1, "one folder fresh");
  for (let i = 0; i < 6; i++) assertEquals(text(must(await store.read(p(`fresh/f${i}`))).bytes), `${i}`);
  // the answer of a conflict names the revision of the older
  const first = must(await store.write(p("solo"), bytes("first"), expectAbsent));
  const again = await store.write(p("solo"), bytes("second"), expectAbsent);
  assert(again.kind === "err" && again.error.kind === "conflict" && again.error.found.kind === "rev" && again.error.found.rev === first.rev);
  assertEquals(must(await store.write(p("any"), bytes("1"), expectAny)).created, true);
  assertEquals(must(await store.write(p("any"), bytes("2"), expectAny)).created, false);
  // a folder is not a file, and a file is not a folder
  const a = await store.write(p("race"), bytes("x"), expectAny);
  assert(a.kind === "err" && a.error.kind === "refused" && a.error.reason === "unportable-path");
  const b = await store.write(p("solo/inside"), bytes("x"), expectAny);
  assert(b.kind === "err" && b.error.kind === "refused" && b.error.reason === "unportable-path");
  void folder;
});

proves(["0002-anyfs-gdrive-store FR-006"], "a delete is idempotent, moves to the trash or removes for good as told, takes every duplicate of the name, and removes the folders it leaves empty", async () => {
  const fake = fakeDrive();
  const { store, folder } = await open(fake);
  must(await store.write(p("a/b/c.txt"), bytes("deep"), expectAny));
  assertEquals(must(await store.delete(p("nothing"), expectAny)).existed, false);
  assertEquals(must(await store.delete(p("nothing"), expectAbsent)).existed, false);
  const wrong = await store.delete(p("a/b/c.txt"), expectAbsent);
  assert(wrong.kind === "err" && wrong.error.kind === "conflict");
  assertEquals(must(await store.delete(p("a/b/c.txt"), expectAny)).existed, true);
  assert(fake.trashed().includes("c.txt"), "moved to the trash");
  assertEquals(must(await store.delete(p("a/b/c.txt"), expectAny)).existed, false);
  assertEquals(must(await store.write(p("a"), bytes("now a file"), expectAbsent)).created, true);
  await fake.put(folder, "twice", "one");
  await fake.put(folder, "twice", "two");
  assertEquals(must(await store.delete(p("twice"), expectAny)).existed, true);
  assertEquals((await store.read(p("twice"))).kind, "err");
  assertEquals(fake.byName("twice").filter((f) => !f.trashed).length, 0);
  const hard = fakeDrive();
  const h = (await open(hard, { deletion: "delete" })).store;
  must(await h.write(p("gone"), bytes("x"), expectAny));
  must(await h.delete(p("gone"), expectAny));
  assertEquals(hard.byName("gone"), [], "removed for good, not in the trash");
});

proves(["0002-anyfs-gdrive-store FR-007"], "a listing walks the folders with pageToken, lists blobs only, counts the trash for nothing, shows a duplicated name once, and is in the order of paths with a cursor and bounds", async () => {
  const fake = fakeDrive({ pageSize: 3 });
  const { store, folder } = await open(fake);
  const names = ["b.txt", "a/z", "a/y", "a/x/1", "c d.txt", "ab/q", "Z.txt", "d/e/f/g.txt", "d/e/h.txt", "m1", "m2", "m3"];
  for (const n of names) must(await store.write(p(n), bytes(n), expectAny));
  await fake.put(folder, "doc", "no bytes", "application/vnd.google-apps.document");
  await fake.put(folder, "m1", "a duplicate that is newer");
  must(await store.write(p("gone.txt"), bytes("x"), expectAny));
  must(await store.delete(p("gone.txt"), expectAny));
  const all: Path[] = [];
  let after: Cursor | undefined;
  let pages = 0;
  for (; pages < 20; pages++) {
    const page = must(await store.list(ROOT_PREFIX, after === undefined ? { limit: 4 } : { limit: 4, after }));
    all.push(...page.entries.map((e) => e.path));
    if (page.next === undefined) break;
    after = page.next;
  }
  assertEquals(pages + 1, 3, "twelve objects in pages of four");
  assertEquals(all, [...all].sort((x, y) => comparePaths(x, y)), "in the order of paths");
  assertEquals([...all].sort(), names.map((n) => p(n)).sort());
  const under = must(await store.list(must(parsePrefix("a")), {}));
  assertEquals(under.entries.map((e) => e.path), [p("a/x/1"), p("a/y"), p("a/z")]);
  assertEquals(must(await store.list(must(parsePrefix("nothing")), {})).entries, []);
  assertEquals(text(must(await store.read(p("m1"))).bytes), "m1", "the older of the duplicates is the object");
  const small = await open(fake, { maxEntries: 3 }, folder);
  const tooMany = await small.store.list(ROOT_PREFIX, {});
  assert(tooMany.kind === "err" && tooMany.error.kind === "unavailable");
  const few = await open(fake, { maxRequests: 2 }, folder);
  const tooLong = await few.store.list(ROOT_PREFIX, {});
  assert(tooLong.kind === "err" && tooLong.error.kind === "unavailable");
});

proves(["0002-anyfs-gdrive-store FR-008"], "every failure kind is a problem by a total table, a rate limit and a fault are worth a retry, a denial and a refused token are not, a 403 is told by its reason, and Retry-After is said", async () => {
  const table: readonly (readonly [number, string, string, string, boolean | undefined])[] = [
    [404, "notFound", "not-found", "missing", undefined],
    [403, "rateLimitExceeded", "throttled", "unavailable", true],
    [403, "userRateLimitExceeded", "throttled", "unavailable", true],
    [429, "", "throttled", "unavailable", true],
    [500, "backendError", "server", "unavailable", true],
    [503, "", "server", "unavailable", true],
    [403, "forbidden", "denied", "unavailable", false],
    [403, "insufficientFilePermissions", "denied", "unavailable", false],
    [401, "authError", "bad-token", "unavailable", false],
    [403, "storageQuotaExceeded", "quota", "refused", undefined],
    [413, "", "too-large", "refused", undefined],
    [409, "conflict", "conflict", "unavailable", true],
    [400, "badRequest", "invalid", "unavailable", false],
    [302, "", "redirect", "unavailable", false],
  ];
  assertEquals(new Set(table.map((row) => row[2])), new Set(FAILURE_KINDS), "the table has a row for every kind");
  for (const [status, reason, kind, problem, retry] of table) {
    const f = { status, reason, message: "x" };
    assertEquals(kindOf(f), kind, `${status} ${reason}`);
    const pr = problemOf(f, { path: p("a") });
    assertEquals(pr.kind, problem, `${status} ${reason}`);
    if (pr.kind === "unavailable" && retry !== undefined) assertEquals(pr.retryable, retry, `${status} ${reason}`);
  }
  const f = failureOf(403, { "retry-after": "7" }, bytes('{"error":{"code":403,"message":"slow down","errors":[{"reason":"userRateLimitExceeded"}]}}'));
  assertEquals([f.reason, f.retryAfterMs], ["userRateLimitExceeded", 7000]);
  const pr = problemOf(f, {});
  assert(pr.kind === "unavailable" && pr.retryable && pr.detail.includes("7 s"));
  assertEquals(failureOf(500, {}, bytes("not json")), { status: 500, reason: "", message: "" });
  const fake = fakeDrive();
  const { store } = await open(fake);
  must(await store.write(p("t.txt"), bytes("t"), expectAny));
  fake.inject = (r) => (r.url.includes("alt=media") ? { status: 403, headers: {}, body: bytes('{"error":{"code":403,"errors":[{"reason":"rateLimitExceeded"}]}}') } : undefined);
  const throttled = await store.read(p("t.txt"));
  assert(throttled.kind === "err" && throttled.error.kind === "unavailable" && throttled.error.retryable);
  fake.inject = () => ({ status: 403, headers: {}, body: bytes('{"error":{"code":403,"message":"nope","errors":[{"reason":"forbidden"}]}}') });
  const denied = await store.stat(p("t.txt"));
  assert(denied.kind === "err" && denied.error.kind === "unavailable" && !denied.error.retryable);
  fake.inject = undefined;
});

proves(["0002-anyfs-gdrive-store FR-009"], "an object larger than the limit is refused before it is sent", async () => {
  const fake = fakeDrive();
  const { store } = await open(fake, { maxBytes: 8 });
  fake.requests.length = 0;
  const w = await store.write(p("big"), bytes("123456789"), expectAny);
  assert(w.kind === "err" && w.error.kind === "refused" && w.error.reason === "too-large");
  assertEquals(fake.requests.length, 0);
  must(await store.write(p("ok"), bytes("12345678"), expectAny));
  const direct = fakeDrive();
  const folder = direct.folder(ROOT, "d");
  await direct.put(folder, "huge", "123456789012");
  const s = (await open(direct, { maxBytes: 8 }, folder)).store;
  const r = await s.read(p("huge"));
  assert(r.kind === "err" && r.error.kind === "refused" && r.error.reason === "too-large", JSON.stringify(r));
  assert(parseRevision("sha256:" + "0".repeat(64)).kind === "ok");
});
