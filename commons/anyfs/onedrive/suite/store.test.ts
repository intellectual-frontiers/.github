/**
 * Tests of the store over a drive and a folder of Microsoft Graph (commons anyfs-onedrive 0002-anyfs-onedrive-store FR-001 to FR-009), on a Graph made in process from its documentation: what goes on the wire (the bearer
 * token, the redirect of a download, the conditions of a write), the capabilities, the revision of the bytes, a write that does not hold, a delete and the folders it leaves, a listing in pages, the names OneDrive
 * does not keep, the table of errors and the bound on the size of an object.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import { comparePaths } from "@intellectual-frontiers/anyfs/governance";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { memoryStore } from "@intellectual-frontiers/anyfs/memory";
import { expectAbsent, expectAny, expectRev, ROOT, parsePrefix, parsePath, parseRevision, type Path, type Cursor } from "@intellectual-frontiers/anyfs/governance";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { CAPABILITIES, FAILURE_KINDS, failureOf, kindOf, openOneDriveStore, problemOf, segmentProblem, type TokenSource } from "../src/mod.ts";
import { ENDPOINT, fakeGraph } from "./fake-graph.ts";
import { bytes, open, p, placeOf, text } from "./support.ts";

const must = <T>(r: { readonly kind: "ok"; readonly value: T } | { readonly kind: "err"; readonly error: unknown }): T => {
  if (r.kind !== "ok") throw new Error(JSON.stringify(r.error));
  return r.value;
};
const prefix = (t: string) => must(parsePrefix(t));

proves(["0002-anyfs-onedrive-store FR-001"], "every request carries the bearer token, a download is fetched from its redirect with no token and only over https, a drive is addressed by its id, and a token that is not accepted is asked for again once and never shown", async () => {
  const fake = fakeGraph();
  const store = await open(fake);
  must(await store.write(p("a.txt"), bytes("one"), expectAny));
  assertEquals(text(must(await store.read(p("a.txt"))).bytes), "one");
  for (const r of fake.log.filter((x) => x.url.startsWith(ENDPOINT))) assertEquals(r.headers["authorization"], "Bearer good-token", r.url);
  assertEquals(fake.leaked, []);
  assert(fake.log.some((x) => x.url.startsWith("https://download.test/")), "the content came from the address of the redirect");
  // a drive by id
  const other = await openOneDriveStore({ place: placeOf("onedrive://b!abc123/fleet"), token: async () => ok("good-token"), endpoint: ENDPOINT, transport: fake.transport });
  assert(other.kind === "ok");
  assert(fake.requests.some((r) => r.includes("/drives/b!abc123")), "a drive that is not the account's is addressed by its id");
  // a redirect to an address that is not https is refused
  const bad = fakeGraph();
  const evil = await open(bad);
  must(await evil.write(p("x"), bytes("x"), expectAny));
  const base = bad.transport;
  const rewired = await openOneDriveStore({ place: placeOf("onedrive://me/run-evil"), token: async () => ok("good-token"), endpoint: ENDPOINT, transport: async (req, o) => {
    const r = await base(req, o);
    return r.kind === "ok" && r.value.status === 302 ? ok({ ...r.value, headers: { location: "http://evil.test/steal" } }) : r;
  } });
  const e = must(rewired);
  must(await e.write(p("y"), bytes("y"), expectAny));
  const read = await e.read(p("y"));
  assert(read.kind === "err" && read.error.kind === "unavailable");
  assertEquals(bad.log.filter((r) => r.url.startsWith("http://evil.test")).length, 0, "nothing was sent there");
  // a token that is refused once and then given anew
  const issued: string[] = [];
  const rotating: TokenSource = async () => {
    issued.push("t");
    return ok(issued.length === 1 ? "stale" : "good-token");
  };
  const fresh = must(await openOneDriveStore({ place: placeOf("onedrive://me/rotating"), token: rotating, endpoint: ENDPOINT, transport: fake.transport }));
  must(await fresh.write(p("k"), bytes("k"), expectAny));
  assert(issued.length >= 2, "the source was asked again after the 401");
  // a token that never works: the store does not open, the problem does not hold the token
  const no = await openOneDriveStore({ place: placeOf("onedrive://me/x"), token: async () => ok("secret-token-text"), endpoint: ENDPOINT, transport: fake.transport });
  assert(no.kind === "err");
  assert(!JSON.stringify(no).includes("secret-token-text"), "the token is not in the answer");
  const none = await openOneDriveStore({ place: placeOf("onedrive://me/x"), token: async () => err("the sign-in expired"), endpoint: ENDPOINT, transport: fake.transport });
  assert(none.kind === "err");
});

proves(["0002-anyfs-onedrive-store FR-002"], "the store has exactly read, write, list, stat, delete and cas, says its names are not case-sensitive and its largest object, and refuses what it does not have", async () => {
  const fake = fakeGraph();
  const store = await open(fake, { maxBytes: 1000 });
  assertEquals([...store.capabilities].sort(), [...CAPABILITIES].sort());
  assertEquals(store.traits, { caseSensitive: false, maxObject: 1000 });
  assertEquals(store.consistency, "strong");
  for (const op of [{ op: "batch", changes: [] }, { op: "history", path: p("a") }, { op: "rangeRead", path: p("a"), start: 0, length: 1 }, { op: "search", prefix: ROOT, text: "x" }] as const) {
    const r = await store.handle(op);
    assert(r.kind === "err" && r.error.kind === "refused" && r.error.reason === "capability-absent", op.op);
  }
  const big = fakeGraph();
  const capped = await open(big, { maxBytes: 999_999_999 });
  assertEquals(capped.traits.maxObject, 250_000_000, "never above the 250 MB of one request");
});

proves(["0002-anyfs-onedrive-store FR-003"], "the revision is sha256 and the digest of the bytes, the same as in memory; the digest Graph keeps is used where it is given, and bytes that are not the digest are tampered", async () => {
  const fake = fakeGraph();
  const store = await open(fake);
  const memory = memoryStore();
  const w = must(await store.write(p("docs/r.txt"), bytes("same bytes"), expectAny));
  const m = must(await memory.write(p("docs/r.txt"), bytes("same bytes"), expectAny));
  assertEquals(w.rev, m.rev);
  assertEquals(w.rev, `sha256:${await sha256(bytes("same bytes"))}`);
  fake.requests.length = 0;
  assertEquals(must(await store.stat(p("docs/r.txt"))).rev, w.rev);
  assert(!fake.requests.some((r) => r.includes(":/content")), "a stat of a drive that keeps the digest asks for no bytes");
  const plain = fakeGraph({ hashes: false });
  const s2 = await open(plain);
  must(await s2.write(p("r.txt"), bytes("same bytes"), expectAny));
  plain.requests.length = 0;
  assertEquals(must(await s2.stat(p("r.txt"))).rev, w.rev);
  assert(plain.requests.some((r) => r.includes(":/content")), "where the drive keeps no digest the bytes are read");
  const folder = fake.names().find((n) => n.endsWith("/docs/r.txt"));
  assert(folder !== undefined);
  fake.corrupt(folder ?? "");
  const t = await store.read(p("docs/r.txt"));
  assert(t.kind === "err" && t.error.kind === "tampered", JSON.stringify(t));
});

proves(["0002-anyfs-onedrive-store FR-004"], "a write expecting no object says conflictBehavior fail, one expecting a revision says If-Match on the entity tag, one that does not hold is a conflict that names what is there, and a change in between is a conflict too", async () => {
  const fake = fakeGraph();
  const store = await open(fake);
  const first = must(await store.write(p("w.txt"), bytes("one"), expectAbsent));
  assertEquals(first.created, true);
  assert(fake.log.some((r) => r.method === "PUT" && r.url.includes("conflictBehavior=fail")), "no object is conflictBehavior=fail");
  const second = await store.write(p("w.txt"), bytes("two"), expectAbsent);
  assert(second.kind === "err" && second.error.kind === "conflict" && second.error.found.kind === "rev" && second.error.found.rev === first.rev);
  fake.log.length = 0;
  const third = must(await store.write(p("w.txt"), bytes("three"), expectRev(first.rev)));
  assertEquals(third.created, false);
  const put = fake.log.find((r) => r.method === "PUT");
  assert(put?.headers["if-match"] !== undefined && put.headers["if-match"].includes("{"), "the write is held to the entity tag");
  const stale = await store.write(p("w.txt"), bytes("four"), expectRev(first.rev));
  assert(stale.kind === "err" && stale.error.kind === "conflict" && stale.error.found.kind === "rev" && stale.error.found.rev === third.rev);
  const none = await store.write(p("nothing.txt"), bytes("x"), expectRev(first.rev));
  assert(none.kind === "err" && none.error.kind === "conflict" && none.error.found.kind === "absent");
  const unlike = await store.write(p("w.txt"), bytes("x"), expectRev(must(parseRevision("etag:abc"))));
  assert(unlike.kind === "err" && unlike.error.kind === "refused" && unlike.error.reason === "unsupported-expectation");
  // another client changes the file after the store looked and before it wrote
  const base = fake.transport;
  const folder = fake.names().find((n) => n.endsWith("/w.txt"))?.replace(/\/w\.txt$/u, "") ?? "";
  const sha = await sha256(bytes("sneaky"));
  let done = false;
  const racing = must(
    await openOneDriveStore({
      place: placeOf(`onedrive://me/${folder}`),
      token: async () => ok("good-token"),
      endpoint: ENDPOINT,
      transport: async (req, o) => {
        if (req.method === "PUT" && !done) {
          done = true;
          fake.bump(`${folder}/w.txt`, "sneaky", sha);
        }
        return base(req, o);
      },
    }),
  );
  const lost = await racing.write(p("w.txt"), bytes("mine"), expectRev(third.rev));
  assert(lost.kind === "err" && lost.error.kind === "conflict" && lost.error.found.kind === "rev" && lost.error.found.rev === `sha256:${sha}`, JSON.stringify(lost));
  assertEquals(fake.text(`${folder}/w.txt`), "sneaky");
});

proves(["0002-anyfs-onedrive-store FR-005"], "a delete is idempotent and holds to its expectation, and removes the folders it leaves empty so that a name that was a folder can be a file", async () => {
  const fake = fakeGraph();
  const store = await open(fake);
  const w = must(await store.write(p("a/b/c.txt"), bytes("deep"), expectAny));
  assertEquals(must(await store.delete(p("nothing"), expectAny)).existed, false);
  assertEquals(must(await store.delete(p("nothing"), expectAbsent)).existed, false);
  const wrong = await store.delete(p("a/b/c.txt"), expectAbsent);
  assert(wrong.kind === "err" && wrong.error.kind === "conflict");
  const stale = await store.delete(p("a/b/c.txt"), expectRev(must(await store.write(p("o"), bytes("other"), expectAny)).rev));
  assert(stale.kind === "err" && stale.error.kind === "conflict" && stale.error.found.kind === "rev" && stale.error.found.rev === w.rev);
  assertEquals(must(await store.delete(p("a/b/c.txt"), expectRev(w.rev))).existed, true);
  assertEquals(must(await store.delete(p("a/b/c.txt"), expectAny)).existed, false);
  must(await store.write(p("a"), bytes("now a file"), expectAbsent));
  assertEquals(text(must(await store.read(p("a"))).bytes), "now a file");
  const under = await store.write(p("a/z.txt"), bytes("below a file"), expectAny);
  assert(under.kind === "err" && under.error.kind === "refused" && under.error.reason === "unportable-path", JSON.stringify(under));
});

proves(["0002-anyfs-onedrive-store FR-006"], "a listing walks the folders in pages, gives files only in the order of paths with a cursor, skips what is not a file and refuses to walk past its bounds", async () => {
  const fake = fakeGraph({ pageSize: 3 });
  const store = await open(fake);
  const names = ["b.txt", "a/z", "a/y", "a/x/1", "c d.txt", "ab/q", "Z.txt", "d/e/f/g.txt", "d/e/h.txt", "m1", "m2", "m3"];
  for (const n of names) must(await store.write(p(n), bytes(n), expectAny));
  const folder = fake.names().find((n) => n.endsWith("/b.txt"))?.replace(/\/b\.txt$/u, "") ?? "";
  fake.addPackage(`${folder}/notebook`);
  await fake.put(`${folder}/weird.`, "skipped: a name OneDrive does not keep as a path of the store");
  const all: Path[] = [];
  let after: Cursor | undefined;
  let pages = 0;
  for (; pages < 20; pages++) {
    const page = must(await store.list(ROOT, after === undefined ? { limit: 4 } : { limit: 4, after }));
    all.push(...page.entries.map((e) => e.path));
    if (page.next === undefined) break;
    after = page.next;
  }
  assertEquals(pages + 1, 3, "twelve files in pages of four");
  assertEquals(new Set(all).size, names.length);
  assertEquals(all, [...all].sort((x, y) => comparePaths(x, y)), "in the order of paths");
  assertEquals([...all].sort(), [...names].map((n) => p(n)).sort());
  const under = must(await store.list(prefix("a"), {}));
  assertEquals(under.entries.map((e) => e.path), [p("a/x/1"), p("a/y"), p("a/z")]);
  assertEquals(must(await store.list(prefix("nothing"), {})).entries, []);
  // bounds
  const small = await open(fake, { maxEntries: 3 }, folder);
  const tooMany = await small.list(ROOT, {});
  assert(tooMany.kind === "err" && tooMany.error.kind === "unavailable", JSON.stringify(tooMany));
  const few = await open(fake, { maxRequests: 2 }, folder);
  const tooLong = await few.list(ROOT, {});
  assert(tooLong.kind === "err" && tooLong.error.kind === "unavailable");
  // a link to another host is not followed
  const base = fake.transport;
  const foreign = await openOneDriveStore({
    place: placeOf(`onedrive://me/${folder}`),
    token: async () => ok("good-token"),
    endpoint: ENDPOINT,
    transport: async (req, o) => {
      const r = await base(req, o);
      if (r.kind === "ok" && req.url.includes("/children")) {
        const body = JSON.parse(new TextDecoder().decode(r.value.body)) as Record<string, unknown>;
        if (body["@odata.nextLink"] !== undefined) body["@odata.nextLink"] = "https://evil.test/next";
        return ok({ ...r.value, body: new TextEncoder().encode(JSON.stringify(body)) });
      }
      return r;
    },
  });
  const f = must(foreign);
  const refused = await f.list(ROOT, {});
  assert(refused.kind === "err", "the link to another host is refused");
  assertEquals(fake.log.filter((r) => r.url.startsWith("https://evil.test")).length, 0);
});

proves(["0002-anyfs-onedrive-store FR-007"], "a name OneDrive does not keep is refused before any request, and two paths that differ only by case are one object", async () => {
  for (const bad of ["a:b", "q?", "x*y", "pipe|d", "lt<", 'quote"', "trail.", "trail ", " lead", "CON", "nul.txt", "COM3.log", ".lock", "desktop.ini", "~$temp.docx", "_vti_x", "a/b\\c"]) {
    assert(segmentProblem(bad.split("/")[0] ?? "") !== undefined || bad.includes("/"), bad);
  }
  assertEquals(segmentProblem("report-2026.txt"), undefined);
  assertEquals(segmentProblem("é 😀.txt"), undefined);
  const fake = fakeGraph();
  const store = await open(fake);
  const before = fake.requests.length;
  for (const bad of ["a:b", "dir/q?", "CON", "dir/desktop.ini"]) {
    const w = await store.write(p(bad), bytes("x"), expectAny);
    assert(w.kind === "err" && w.error.kind === "refused" && w.error.reason === "unportable-path", bad);
    const r = await store.read(p(bad));
    assert(r.kind === "err" && r.error.kind === "refused", bad);
  }
  assertEquals(fake.requests.length, before, "no request was made for a name that is refused");
  const opened = await openOneDriveStore({ place: placeOf("onedrive://me/bad:folder"), token: async () => ok("good-token"), endpoint: ENDPOINT, transport: fake.transport });
  assert(opened.kind === "err");
  must(await store.write(p("Docs/Report.TXT"), bytes("one"), expectAny));
  assertEquals(text(must(await store.read(p("docs/report.txt"))).bytes), "one");
  const again = must(await store.write(p("DOCS/REPORT.txt"), bytes("two"), expectAny));
  assertEquals(again.created, false);
});

proves(["0002-anyfs-onedrive-store FR-008"], "every failure kind is a problem by a total table, a throttle and a fault are worth a retry and a denial and a refused token are not, and Retry-After is said", async () => {
  const table: readonly (readonly [number, string, string, string, boolean | undefined])[] = [
    [404, "itemNotFound", "not-found", "missing", undefined],
    [409, "nameAlreadyExists", "name-exists", "refused", undefined],
    [412, "preconditionFailed", "precondition", "unavailable", true],
    [423, "resourceLocked", "locked", "unavailable", false],
    [429, "activityLimitReached", "throttled", "unavailable", true],
    [503, "serviceNotAvailable", "server", "unavailable", true],
    [403, "accessDenied", "denied", "unavailable", false],
    [401, "InvalidAuthenticationToken", "bad-token", "unavailable", false],
    [507, "", "quota", "refused", undefined],
    [413, "", "too-large", "refused", undefined],
    [400, "badRequest", "invalid", "unavailable", false],
    [302, "", "redirect", "unavailable", false],
  ];
  assertEquals(new Set(table.map((row) => row[2])), new Set(FAILURE_KINDS), "the table has a row for every kind");
  for (const [status, code, kind, problem, retry] of table) {
    const f = { status, code, message: "x" };
    assertEquals(kindOf(f), kind, `${status} ${code}`);
    const pr = problemOf(f, { path: p("a") });
    assertEquals(pr.kind, problem, `${status} ${code}`);
    if (pr.kind === "unavailable" && retry !== undefined) assertEquals(pr.retryable, retry, `${status} ${code}`);
  }
  const f = failureOf(429, { "retry-after": "7" }, bytes('{"error":{"code":"activityLimitReached","message":"slow down"}}'));
  assertEquals([f.code, f.retryAfterMs], ["activityLimitReached", 7000]);
  const pr = problemOf(f, {});
  assert(pr.kind === "unavailable" && pr.retryable && pr.detail.includes("7 s"));
  assertEquals(failureOf(500, {}, bytes("not json")), { status: 500, code: "", message: "" });
  // on the wire
  const fake = fakeGraph();
  const store = await open(fake);
  fake.inject = (r) => (r.method === "GET" && r.url.includes(":/content") ? { status: 429, headers: { "retry-after": "3" }, body: bytes('{"error":{"code":"activityLimitReached"}}') } : undefined);
  must(await store.write(p("t.txt"), bytes("t"), expectAny));
  const throttled = await store.read(p("t.txt"));
  assert(throttled.kind === "err" && throttled.error.kind === "unavailable" && throttled.error.retryable);
  fake.inject = () => ({ status: 403, headers: {}, body: bytes('{"error":{"code":"accessDenied"}}') });
  const denied = await store.stat(p("t.txt"));
  assert(denied.kind === "err" && denied.error.kind === "unavailable" && !denied.error.retryable);
  fake.inject = () => undefined;
  assertStringIncludes(JSON.stringify(denied), "accessDenied");
});

proves(["0002-anyfs-onedrive-store FR-009"], "an object larger than the limit is refused as too large before it is sent", async () => {
  const fake = fakeGraph();
  const store = await open(fake, { maxBytes: 8 });
  fake.requests.length = 0;
  const w = await store.write(p("big"), bytes("123456789"), expectAny);
  assert(w.kind === "err" && w.error.kind === "refused" && w.error.reason === "too-large");
  assertEquals(fake.requests.length, 0);
  must(await store.write(p("ok"), bytes("12345678"), expectAny));
  const direct = fakeGraph();
  await direct.put("run-d/huge", "123456789012");
  const s = await open(direct, { maxBytes: 8 }, "run-d");
  const r = await s.read(p("huge"));
  assert(r.kind === "err" && r.error.kind === "refused" && r.error.reason === "too-large", JSON.stringify(r));
  void parsePath;
});
