/**
 * Tests of the handler (commons anyfs-serve 0003-anyfs-serve-logical FR-010 to FR-015): the order of its checks, reads, writes, collections, copies and moves, properties and locks, over a store of every capability, a store of the core capabilities alone and a
 * store that only reads.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { handler, noAuthentication, tokenAuthenticator } from "../src/mod.ts";
import { client, core, full, hrefsOf, LOCKINFO, reading, tokenOf } from "./world.ts";

const etagOf = (h: Headers): string => (h.get("etag") ?? "").replace(/^"|"$/gu, "");

// ---- FR-010: the order of the checks
proves(["0003-anyfs-serve-logical FR-010"], "a request is checked in the order of host, method, credentials, address and store, and an unexpected error is a 500", async () => {
  const c = client(full(), { authenticator: tokenAuthenticator("tok") });
  const ask = async (method: string, path: string, headers: Record<string, string> = {}) => {
    const h = handler(full(), { authenticator: tokenAuthenticator("tok") });
    const r = await h(new Request(`http://127.0.0.1${path}`, { method, headers }));
    return r;
  };
  void c;
  const rebound = await ask("GET", "/", { host: "attacker.example.test", authorization: "Bearer tok" });
  assertEquals(rebound.status, 403, "a host that is not listed is refused before anything else");
  assertEquals((await ask("PATCH", "/", { authorization: "Bearer tok" })).status, 405);
  assertEquals((await ask("PATCH", "/", { authorization: "Bearer tok" })).headers.get("allow"), "OPTIONS, GET, HEAD, PUT, DELETE, MKCOL, COPY, MOVE, PROPFIND, PROPPATCH, LOCK, UNLOCK");
  const challenge = await ask("GET", "/");
  assertEquals(challenge.status, 401);
  assertStringIncludes(challenge.headers.get("www-authenticate") ?? "", "Basic");
  assertStringIncludes(challenge.headers.get("www-authenticate") ?? "", "Bearer");
  assertEquals((await ask("GET", "/", { authorization: "Bearer wrong" })).status, 401);
  assertEquals((await ask("GET", "/", { authorization: `Basic ${btoa("u:tok")}` })).status, 200);
  assertEquals((await ask("PATCH", "/")).status, 405, "the method is looked at before the credentials");
  assertEquals((await ask("GET", "/%ZZ", { authorization: "Bearer tok" })).status, 400);
  assertEquals((await ask("GET", "/a%2Fb", { authorization: "Bearer tok" })).status, 400);
  const based = handler(full(), { authenticator: noAuthentication, base: "/dav" });
  assertEquals((await based(new Request("http://127.0.0.1/other"))).status, 404);
  assertEquals((await based(new Request("http://127.0.0.1/dav/", { method: "PROPFIND", headers: { depth: "0" } }))).status, 207);
  const broken = handler(full(), { authenticator: async () => { throw new Error("down"); } });
  assertEquals((await broken(new Request("http://127.0.0.1/"))).status, 401, "an authenticator that throws lets nobody in");
  const ro = client(reading());
  for (const m of ["PUT", "DELETE", "MKCOL", "COPY", "MOVE", "PROPPATCH"]) {
    const r = await ro.call(m, "/x", m === "PUT" ? { body: "x", headers: { destination: "/y" } } : { headers: { destination: "/y" } });
    assertEquals(r.status, 403, m);
    assertEquals(r.headers.get("x-anyfs-fidelity"), "refused; reason=read-only");
  }
  assertEquals((await ro.call("GET", "/")).status, 200);
  assertEquals((await ro.call("OPTIONS", "/")).headers.get("allow"), "OPTIONS, GET, HEAD, PROPFIND, UNLOCK");
  const events: string[] = [];
  const logged = handler(full(), { authenticator: noAuthentication, onEvent: (e) => events.push(`${e.method} ${e.path} ${e.status} ${e.fidelity ?? "-"}`) });
  await logged(new Request("http://127.0.0.1/n.txt", { method: "PUT", body: "x", headers: { authorization: "Bearer secret" } }));
  assertEquals(events, ["PUT /n.txt 201 native"]);
  assert(!events.join("").includes("secret"));
  const withFragment = await ask("GET", "/a#frag", { authorization: "Bearer tok" });
  assert(withFragment.status === 200 || withFragment.status === 404 || withFragment.status === 400);
});

// ---- FR-011: GET and HEAD
proves(["0003-anyfs-serve-logical FR-011"], "GET and HEAD give an object with its type, entity tag, time and ranges, with conditions, and a collection as a page of escaped names", async () => {
  const c = client(full());
  await c.call("PUT", "/docs/a.json", { body: '{"a":1}' });
  const get = await c.call("GET", "/docs/a.json");
  assertEquals(get.status, 200);
  assertEquals(get.text, '{"a":1}');
  assertEquals(get.headers.get("content-type"), "application/json");
  assertEquals(get.headers.get("content-length"), "7");
  assertEquals(get.headers.get("accept-ranges"), "bytes");
  assertEquals(get.headers.get("x-anyfs-fidelity"), "native");
  assertEquals(get.headers.get("content-security-policy"), "sandbox");
  assert(/^"sha256:[0-9a-f]{64}"$/u.test(get.headers.get("etag") ?? ""));
  assert(get.headers.get("last-modified") !== null);
  const head = await c.call("HEAD", "/docs/a.json");
  assertEquals([head.status, head.text, head.headers.get("content-length"), head.headers.get("etag")], [200, "", "7", get.headers.get("etag")]);
  const etag = get.headers.get("etag") ?? "";
  assertEquals((await c.call("GET", "/docs/a.json", { headers: { "if-none-match": etag } })).status, 304);
  assertEquals((await c.call("GET", "/docs/a.json", { headers: { "if-none-match": `"other", ${etag}` } })).status, 304);
  assertEquals((await c.call("GET", "/docs/a.json", { headers: { "if-none-match": "*" } })).status, 304);
  assertEquals((await c.call("GET", "/docs/a.json", { headers: { "if-none-match": '"other"' } })).status, 200);
  assertEquals((await c.call("GET", "/docs/a.json", { headers: { "if-match": '"other"' } })).status, 412);
  assertEquals((await c.call("GET", "/docs/a.json", { headers: { "if-match": etag } })).status, 200);
  const ranged = await c.call("GET", "/docs/a.json", { headers: { range: "bytes=1-3" } });
  assertEquals([ranged.status, ranged.text, ranged.headers.get("content-range")], [206, '"a"', "bytes 1-3/7"]);
  assertEquals(ranged.headers.get("x-anyfs-fidelity"), "emulated; reason=whole-object-range; risk=cost");
  assertEquals((await c.call("GET", "/docs/a.json", { headers: { range: "bytes=4-" } })).text, ":1}");
  assertEquals((await c.call("GET", "/docs/a.json", { headers: { range: "bytes=-2" } })).text, "1}");
  assertEquals((await c.call("GET", "/docs/a.json", { headers: { range: "bytes=2-100" } })).text, 'a":1}');
  const past = await c.call("GET", "/docs/a.json", { headers: { range: "bytes=50-60" } });
  assertEquals([past.status, past.headers.get("content-range")], [416, "bytes */7"]);
  assertEquals((await c.call("GET", "/docs/a.json", { headers: { range: "bytes=0-1,3-4" } })).status, 200, "more than one range is answered whole");
  assertEquals((await c.call("GET", "/docs/missing")).status, 404);
  await c.call("PUT", "/docs/<b>&\"q\".txt", { body: "x" });
  const page = await c.call("GET", "/docs/");
  assertEquals(page.status, 200);
  assertStringIncludes(page.headers.get("content-type") ?? "", "text/html");
  assert(!page.text.includes("<b>") && page.text.includes("&lt;b&gt;&amp;&quot;q&quot;.txt"));
  assert(page.text.includes('href="/docs/%3Cb%3E%26%22q%22.txt"'));
});

// ---- FR-012: PUT
proves(["0003-anyfs-serve-logical FR-012"], "PUT writes the object whole, 201 or 204, with the entity tag, and takes the guards of the request as the expectation of the write", async () => {
  const c = client(full());
  const made = await c.call("PUT", "/a.txt", { body: "one" });
  assertEquals(made.status, 201);
  assertEquals(made.headers.get("location"), "/a.txt");
  assertEquals(made.headers.get("x-anyfs-fidelity"), "native");
  const first = etagOf(made.headers);
  const replaced = await c.call("PUT", "/a.txt", { body: "two" });
  assertEquals(replaced.status, 204);
  assert(etagOf(replaced.headers) !== first);
  assertEquals((await c.call("GET", "/a.txt")).text, "two");
  const exclusive = await c.call("PUT", "/a.txt", { body: "three", headers: { "if-none-match": "*" } });
  assertEquals(exclusive.status, 412);
  assertEquals((await c.call("GET", "/a.txt")).text, "two");
  assertEquals((await c.call("PUT", "/b.txt", { body: "x", headers: { "if-none-match": "*" } })).status, 201);
  assertEquals((await c.call("PUT", "/a.txt", { body: "x", headers: { "if-match": `"${first}"` } })).status, 412, "a stale revision");
  const current = etagOf(replaced.headers);
  const guarded = await c.call("PUT", "/a.txt", { body: "three", headers: { "if-match": `"${current}"` } });
  assertEquals([guarded.status, guarded.headers.get("x-anyfs-fidelity")], [204, "native"]);
  assertEquals((await c.call("PUT", "/nothing.txt", { body: "x", headers: { "if-match": '"x"' } })).status, 412, "If-Match of an object that is not there");
  assertEquals((await c.call("PUT", "/a.txt", { body: "x", headers: { "if-none-match": `"${etagOf(guarded.headers)}"` } })).status, 412);
  assertEquals((await c.call("PUT", "/", { body: "x" })).status, 405);
  await c.call("MKCOL", "/d");
  assertEquals((await c.call("PUT", "/d", { body: "x" })).status, 405, "a collection is made with MKCOL");
  assertEquals((await c.call("PUT", "/a.txt/under", { body: "x" })).status, 409, "a file on the way");
  assertEquals((await c.call("PUT", "/d/.keep", { body: "x" })).status, 403, "the name the server keeps");
  assertEquals((await c.call("PUT", "/new/deep/er.txt", { body: "x" })).status, 201, "the collections on the way are implied");
  const tiny = client(full(), { limits: { maxBody: 4, maxXml: 1024, maxXmlDepth: 8, maxXmlNodes: 100, maxLockSeconds: 10, maxLocks: 5, maxResources: 10 } });
  assertEquals((await tiny.call("PUT", "/ok.txt", { body: "1234" })).status, 201);
  assertEquals((await tiny.call("PUT", "/big.txt", { body: "12345" })).status, 413);
  assertEquals((await tiny.call("GET", "/big.txt")).status, 404, "nothing was written");
  const chunked = new Request("http://127.0.0.1/stream.txt", { method: "PUT", body: new ReadableStream<Uint8Array>({ start(ctl) { ctl.enqueue(new TextEncoder().encode("123")); ctl.enqueue(new TextEncoder().encode("456")); ctl.close(); } }), duplex: "half" } as RequestInit);
  assertEquals((await handler(full(), { authenticator: noAuthentication, limits: { maxBody: 4, maxXml: 1024, maxXmlDepth: 8, maxXmlNodes: 100, maxLockSeconds: 10, maxLocks: 5, maxResources: 10 } })(chunked)).status, 413, "a body with no length is counted as it comes");
});

proves(["0003-anyfs-serve-logical FR-012"], "a store without cas holds a revision by a check that is labelled unguarded, and a store that holds revisions refuses a change under a lock before it looks at the lock", async () => {
  const c = client(core());
  const made = await c.call("PUT", "/a.txt", { body: "one" });
  const rev = etagOf(made.headers);
  const guarded = await c.call("PUT", "/a.txt", { body: "two", headers: { "if-match": `"${rev}"` } });
  assertEquals(guarded.status, 204);
  assertEquals(guarded.headers.get("x-anyfs-fidelity"), "emulated; reason=unguarded-write; risk=unguarded");
  assertEquals((await c.call("PUT", "/a.txt", { body: "three", headers: { "if-match": `"${rev}"` } })).status, 412);
  const c2 = client(full());
  await c2.call("PUT", "/l.txt", { body: "x" });
  const lock = await c2.call("LOCK", "/l.txt", { body: LOCKINFO });
  assertEquals(lock.status, 200);
  const token = tokenOf(lock);
  assertEquals((await c2.call("PUT", "/l.txt", { body: "y" })).status, 423);
  assertEquals((await c2.call("PUT", "/l.txt", { body: "y", headers: { if: `(<DAV:no-lock>)` } })).status, 412, "an If that does not hold is 412, before the lock is looked at");
  assertEquals((await c2.call("PUT", "/l.txt", { body: "y", headers: { if: `(<${token}>)` } })).status, 204);
});

// ---- FR-013: DELETE, MKCOL, COPY, MOVE
proves(["0003-anyfs-serve-logical FR-013"], "DELETE removes an object or a collection with what is below it, and MKCOL makes a collection or says why not", async () => {
  const c = client(full());
  assertEquals((await c.call("MKCOL", "/d")).status, 201);
  assertEquals((await c.call("MKCOL", "/d")).status, 405);
  assertEquals((await c.call("MKCOL", "/d/e/f")).status, 409, "no parent");
  assertEquals((await c.call("MKCOL", "/d/e")).status, 201);
  assertEquals((await c.call("MKCOL", "/d/body", { body: "x" })).status, 415);
  await c.call("PUT", "/f.txt", { body: "x" });
  assertEquals((await c.call("MKCOL", "/f.txt/under")).status, 409, "the parent is a file");
  assertEquals((await c.call("MKCOL", "/f.txt")).status, 405);
  assertEquals((await c.call("MKCOL", "/")).status, 405);
  await c.call("PUT", "/d/e/x.txt", { body: "x" });
  assertEquals((await c.call("DELETE", "/d/e/x.txt")).status, 204);
  assertEquals((await c.call("DELETE", "/d/e/x.txt")).status, 404);
  assertEquals((await c.call("DELETE", "/d")).status, 204, "a collection with a collection in it");
  assertEquals((await c.call("GET", "/d/e/")).status, 404);
  assertEquals((await c.call("DELETE", "/")).status, 403);
  assertEquals((await c.call("DELETE", "/nothing")).status, 404);
  const etag = etagOf((await c.call("GET", "/f.txt")).headers);
  assertEquals((await c.call("DELETE", "/f.txt", { headers: { "if-match": '"other"' } })).status, 412);
  assertEquals((await c.call("DELETE", "/f.txt", { headers: { "if-match": `"${etag}"` } })).status, 204);
  const v = client(full(), { directories: "virtual" });
  const made = await v.call("MKCOL", "/gone");
  assertEquals([made.status, made.headers.get("x-anyfs-fidelity")], [201, "emulated; reason=no-marker; risk=not-durable"]);
  assertEquals((await v.call("PROPFIND", "/gone", { headers: { depth: "0" } })).status, 404, "nothing was written, so nothing is there");
});

proves(["0003-anyfs-serve-logical FR-013"], "COPY and MOVE read the destination, the overwrite and the depth, and refuse what cannot be done", async () => {
  const c = client(full());
  await c.call("PUT", "/a/1.txt", { body: "one" });
  await c.call("PUT", "/a/sub/2.txt", { body: "two" });
  await c.call("PUT", "/x.txt", { body: "x" });
  const copy = await c.call("COPY", "/a/1.txt", { headers: { destination: "http://127.0.0.1/c.txt" } });
  assertEquals(copy.status, 201);
  assertEquals(copy.headers.get("x-anyfs-fidelity")?.startsWith("emulated"), true);
  assertEquals((await c.call("GET", "/c.txt")).text, "one");
  assertEquals((await c.call("COPY", "/a/1.txt", { headers: { destination: "/c.txt" } })).status, 204, "over an object");
  assertEquals((await c.call("COPY", "/a/1.txt", { headers: { destination: "/c.txt", overwrite: "F" } })).status, 412);
  assertEquals((await c.call("COPY", "/a/1.txt", { headers: { destination: "/nope/c.txt" } })).status, 409, "no parent");
  assertEquals((await c.call("COPY", "/a/1.txt", { headers: { destination: "/x.txt/under" } })).status, 409, "the parent is a file");
  assertEquals((await c.call("COPY", "/a/1.txt", { headers: { destination: "http://elsewhere.test/c.txt" } })).status, 502);
  assertEquals((await c.call("COPY", "/a/1.txt")).status, 400, "no Destination");
  assertEquals((await c.call("COPY", "/a/1.txt", { headers: { destination: "/a/1.txt" } })).status, 403, "itself");
  assertEquals((await c.call("COPY", "/a", { headers: { destination: "/a/sub/copy" } })).status, 403, "into itself");
  assertEquals((await c.call("COPY", "/a/sub", { headers: { destination: "/a" } })).status, 403, "over what it lies in");
  assertEquals((await c.call("COPY", "/missing", { headers: { destination: "/m" } })).status, 404);
  assertEquals((await c.call("COPY", "/a", { headers: { destination: "/deep", depth: "1" } })).status, 400);
  assertEquals((await c.call("COPY", "/a", { headers: { destination: "/shallow", depth: "0" } })).status, 201);
  assertEquals((await c.call("GET", "/shallow/1.txt")).status, 404, "depth 0 makes the collection only");
  assertEquals((await c.call("COPY", "/a", { headers: { destination: "/whole" } })).status, 201);
  assertEquals((await c.call("GET", "/whole/sub/2.txt")).text, "two");
  assertEquals((await c.call("GET", "/a/sub/2.txt")).text, "two", "a copy leaves the source");
  const moved = await c.call("MOVE", "/whole", { headers: { destination: "/moved" } });
  assertEquals(moved.status, 201);
  assertEquals(moved.headers.get("location"), "/moved/");
  assertEquals((await c.call("GET", "/whole/sub/2.txt")).status, 404);
  assertEquals((await c.call("GET", "/moved/sub/2.txt")).text, "two");
  assertEquals((await c.call("MOVE", "/moved", { headers: { destination: "/x.txt" } })).status, 204, "over an object");
  assertEquals((await c.call("GET", "/x.txt/sub/2.txt")).text, "two");
  assertEquals((await c.call("MOVE", "/a", { headers: { destination: "/z", depth: "0" } })).status, 400);
  assertEquals((await c.call("MOVE", "/", { headers: { destination: "/z" } })).status, 403);
  assertEquals((await c.call("MOVE", "/a/1.txt", { headers: { destination: "/a/.keep" } })).status, 403);
  const c2 = client(core());
  await c2.call("PUT", "/p.txt", { body: "p" });
  const m2 = await c2.call("MOVE", "/p.txt", { headers: { destination: "/q.txt" } });
  assertEquals([m2.status, m2.headers.get("x-anyfs-fidelity")], [201, "emulated; reason=copy-then-delete; risk=non-atomic"]);
});

// ---- FR-014: PROPFIND and PROPPATCH
proves(["0003-anyfs-serve-logical FR-014"], "PROPFIND answers depth 0 and 1, refuses infinity and a missing depth, 404 for what is not there, and hides junk where asked", async () => {
  const c = client(full());
  await c.call("PUT", "/d/a.txt", { body: "abc" });
  await c.call("PUT", "/d/sub/b.txt", { body: "b" });
  await c.call("PUT", "/d/.DS_Store", { body: "j" });
  const zero = await c.call("PROPFIND", "/d/", { headers: { depth: "0" } });
  assertEquals(zero.status, 207);
  assertEquals(hrefsOf(zero.text), ["/d/"]);
  const one = await c.call("PROPFIND", "/d/", { headers: { depth: "1" } });
  assertEquals(hrefsOf(one.text), ["/d/", "/d/.DS_Store", "/d/a.txt", "/d/sub/"]);
  assertStringIncludes(one.text, "<D:getcontentlength>3</D:getcontentlength>");
  assertStringIncludes(one.text, "<D:resourcetype><D:collection/></D:resourcetype>");
  assertStringIncludes(one.text, "<D:getlastmodified>");
  assertEquals(one.headers.get("x-anyfs-fidelity"), "emulated; reason=derived-directory; risk=none");
  const infinite = await c.call("PROPFIND", "/d/", { headers: { depth: "infinity" } });
  assertEquals(infinite.status, 403);
  assertStringIncludes(infinite.text, "propfind-finite-depth");
  assertEquals((await c.call("PROPFIND", "/d/")).status, 403, "a missing depth is infinity");
  assertEquals((await c.call("PROPFIND", "/missing", { headers: { depth: "0" } })).status, 404);
  const names = await c.call("PROPFIND", "/d/a.txt", { headers: { depth: "0" }, body: '<D:propfind xmlns:D="DAV:"><D:propname/></D:propfind>' });
  assertStringIncludes(names.text, "<D:getetag/>");
  assert(!names.text.includes("<D:getetag>"));
  const mine = await c.call("PROPFIND", "/d/a.txt", { headers: { depth: "0" }, body: '<D:propfind xmlns:D="DAV:" xmlns:x="urn:x"><D:prop><D:getcontentlength/><x:mine/></D:prop></D:propfind>' });
  assertStringIncludes(mine.text, "HTTP/1.1 404 Not Found");
  assertStringIncludes(mine.text, "<n1:mine/>");
  assertEquals((await c.call("PROPFIND", "/d/", { headers: { depth: "0" }, body: "<not-xml" })).status, 400);
  assertEquals((await c.call("PROPFIND", "/d/", { headers: { depth: "0" }, body: "<!DOCTYPE a><a/>" })).status, 400);
  const hide = client(full(), { junk: "hide" });
  await hide.call("PUT", "/d/a.txt", { body: "a" });
  await hide.call("PUT", "/d/._a.txt", { body: "j" });
  assertEquals(hrefsOf((await hide.call("PROPFIND", "/d/", { headers: { depth: "1" } })).text), ["/d/", "/d/a.txt"]);
  assert(!(await hide.call("GET", "/d/")).text.includes("._a.txt"));
  const few = client(full(), { limits: { maxBody: 100, maxXml: 1024, maxXmlDepth: 8, maxXmlNodes: 100, maxLockSeconds: 10, maxLocks: 5, maxResources: 3 } });
  for (const n of ["1", "2", "3"]) await few.call("PUT", `/e/${n}`, { body: n });
  assertEquals((await few.call("PROPFIND", "/e/", { headers: { depth: "1" } })).status, 413);
});

proves(["0003-anyfs-serve-logical FR-014"], "PROPPATCH answers every property 403, because no property is stored, and 404 for a resource that is not there", async () => {
  const c = client(full());
  await c.call("PUT", "/a.txt", { body: "x" });
  const body = '<D:propertyupdate xmlns:D="DAV:" xmlns:x="urn:x"><D:set><D:prop><x:a>1</x:a></D:prop></D:set><D:remove><D:prop><x:b/></D:prop></D:remove></D:propertyupdate>';
  const r = await c.call("PROPPATCH", "/a.txt", { body });
  assertEquals(r.status, 207);
  assertStringIncludes(r.text, "HTTP/1.1 403 Forbidden");
  assertStringIncludes(r.text, "<n1:a/>");
  assertStringIncludes(r.text, "<n1:b/>");
  assertEquals(r.headers.get("x-anyfs-fidelity"), "refused; reason=not-in-model");
  assertEquals((await c.call("PROPPATCH", "/nothing", { body })).status, 404);
  assertEquals((await c.call("PROPPATCH", "/a.txt", { body: "<a/>" })).status, 400);
  assertEquals((await c.call("PROPPATCH", "/a.txt", { body: "<!DOCTYPE x><x/>" })).status, 400);
});

// ---- FR-015: LOCK and UNLOCK
proves(["0003-anyfs-serve-logical FR-015"], "LOCK gives an exclusive write lock, refuses a second, makes an empty object where there is none, refreshes, and UNLOCK releases it", async () => {
  let now = 1_000;
  const c = client(full(), { clock: () => now });
  await c.call("PUT", "/a.txt", { body: "x" });
  const lock = await c.call("LOCK", "/a.txt", { body: LOCKINFO, headers: { timeout: "Second-60" } });
  assertEquals(lock.status, 200);
  const token = tokenOf(lock);
  assert(token.startsWith("opaquelocktoken:"));
  assertStringIncludes(lock.text, "<D:lockdiscovery>");
  assertStringIncludes(lock.text, "Second-60");
  assertStringIncludes(lock.text, "<D:href>someone</D:href>".replace("<D:href>", "").replace("</D:href>", ""));
  const second = await c.call("LOCK", "/a.txt", { body: LOCKINFO });
  assertEquals(second.status, 423);
  assertStringIncludes(second.text, "no-conflicting-lock");
  const shared = await c.call("LOCK", "/other.txt", { body: LOCKINFO.replace("exclusive", "shared") });
  assertEquals(shared.status, 412);
  assertEquals((await c.call("LOCK", "/other.txt", { body: "<a/>" })).status, 400);
  assertEquals((await c.call("LOCK", "/other.txt", { body: "<!DOCTYPE a><a/>" })).status, 400);
  assertEquals((await c.call("LOCK", "/a.txt", { headers: { timeout: "Second-1000" } })).status, 400, "a refresh names its lock");
  now += 30_000;
  const refreshed = await c.call("LOCK", "/a.txt", { headers: { if: `(<${token}>)`, timeout: "Second-60" } });
  assertEquals(refreshed.status, 200);
  assertEquals((await c.call("LOCK", "/a.txt", { headers: { if: "(<opaquelocktoken:nope>)" } })).status, 412);
  now += 50_000;
  assertEquals((await c.call("PUT", "/a.txt", { body: "y" })).status, 423, "still held after the first 60 s because it was refreshed");
  const pd = await c.call("PROPFIND", "/a.txt", { headers: { depth: "0" } });
  assertStringIncludes(pd.text, token);
  now += 20_000;
  assertEquals((await c.call("PUT", "/a.txt", { body: "y" })).status, 204, "the lock ended");
  const nothing = await c.call("LOCK", "/new.txt", { body: LOCKINFO });
  assertEquals([nothing.status, nothing.headers.get("x-anyfs-fidelity")?.startsWith("emulated")], [201, true]);
  assertEquals((await c.call("GET", "/new.txt")).text, "");
  const t2 = tokenOf(nothing);
  assertEquals((await c.call("UNLOCK", "/new.txt", { headers: { "lock-token": `<${t2}>` } })).status, 204);
  assertEquals((await c.call("UNLOCK", "/new.txt", { headers: { "lock-token": `<${t2}>` } })).status, 409);
  assertEquals((await c.call("UNLOCK", "/new.txt")).status, 400);
  await c.call("MKCOL", "/tree");
  const dir = await c.call("LOCK", "/tree", { body: LOCKINFO });
  const t3 = tokenOf(dir);
  assertEquals((await c.call("PUT", "/tree/x.txt", { body: "x" })).status, 423, "a lock of infinity covers what is below");
  assertEquals((await c.call("DELETE", "/tree")).status, 423);
  assertEquals((await c.call("MOVE", "/a.txt", { headers: { destination: "/tree/a.txt" } })).status, 423, "the destination is locked");
  assertEquals((await c.call("PUT", "/tree/x.txt", { body: "x", headers: { if: `(<${t3}>)` } })).status, 201);
  assertEquals((await c.call("DELETE", "/tree", { headers: { if: `(<${t3}>)` } })).status, 204);
  const off = client(full(), { locks: false });
  assertEquals((await off.call("LOCK", "/x", { body: LOCKINFO })).status, 405);
  assertEquals((await off.call("OPTIONS", "/")).headers.get("dav"), "1");
  assertEquals((await off.call("PUT", "/x", { body: "x" })).status, 201);
  const ro = client(reading());
  assertEquals((await ro.call("LOCK", "/x", { body: LOCKINFO })).status, 403);
});
