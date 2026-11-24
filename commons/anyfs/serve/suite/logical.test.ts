/**
 * Tests of the logical layer of AnyFS Serve (commons anyfs-serve 0003-anyfs-serve-logical FR-001 to FR-009): the XML, the addresses, the answers, the properties, the locks, the If header and the credentials.
 *
 * @module
 */
import fc from "fast-check";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { parseAbsolute, type PosixPath, ROOT_PATH } from "@intellectual-frontiers/anyfs-posix/governance";
import {
  credentialsOf,
  dav,
  describeXmlProblem,
  el,
  fidelityHeader,
  hrefOf,
  ifHolds,
  newLockTable,
  newToken,
  noAuthentication,
  parseIf,
  parseXml,
  pathOfDestination,
  pathOfUrl,
  propfindRequest,
  proppatchRequest,
  sameSecret,
  submittedTokens,
  tokenAuthenticator,
  writeXml,
  type XmlElement,
  type XmlLimits,
  errorAnswer,
  responseOf,
  multistatus,
  propResponse,
} from "../src/mod.ts";

const LIMITS: XmlLimits = { maxBytes: 4096, maxDepth: 8, maxNodes: 200 };
const p = (s: string): PosixPath => {
  const r = parseAbsolute(s);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};

// ---- FR-001: the reader
proves(["0003-anyfs-serve-logical FR-001"], "the reader takes elements, attributes, text, CDATA, comments and references, resolves namespaces and reads the declaration", () => {
  const doc = parseXml(`<?xml version="1.0"?><!-- c --><D:a xmlns:D="DAV:" xmlns="urn:x" k='v&amp;w'><b>1 &lt; 2 &#65;&#x42;</b><![CDATA[<raw>]]><D:c/></D:a>`, LIMITS);
  assert(doc.kind === "ok");
  assertEquals(doc.value.name, { ns: "DAV:", local: "a" });
  assertEquals(doc.value.attrs, [{ name: "k", value: "v&w" }]);
  const [b, raw, c] = doc.value.children;
  assert(b?.kind === "element" && b.name.ns === "urn:x" && b.name.local === "b");
  assertEquals(b.children, [{ kind: "text", text: "1 < 2 AB" }]);
  assertEquals(raw, { kind: "text", text: "<raw>" });
  assert(c?.kind === "element" && c.name.ns === "DAV:");
});

proves(["0003-anyfs-serve-logical FR-001"], "the reader refuses what an attacker uses: a document type, an entity, an unknown reference, an undeclared or emptied prefix, and any bound passed", () => {
  const kindOf = (s: string, l: XmlLimits = LIMITS): string => {
    const r = parseXml(s, l);
    return r.kind === "ok" ? "ok" : r.error.kind;
  };
  assertEquals(kindOf('<!DOCTYPE a [<!ENTITY x "y">]><a>&x;</a>'), "doctype");
  assertEquals(kindOf('<?xml version="1.0"?><!DOCTYPE a SYSTEM "http://example.test/a.dtd"><a/>'), "doctype");
  assertEquals(kindOf("<a><!DOCTYPE b></a>"), "doctype");
  assertEquals(kindOf("<a>&x;</a>"), "reference");
  assertEquals(kindOf("<a>&#0;</a>"), "reference");
  assertEquals(kindOf("<a>&#xD800;</a>"), "reference");
  assertEquals(kindOf("<a>&amp</a>"), "reference");
  assertEquals(kindOf("<x:a/>"), "namespace");
  assertEquals(kindOf('<a xmlns:x=""><x:b/></a>'), "namespace");
  assertEquals(kindOf("<a>".repeat(9) + "</a>".repeat(9)), "too-deep");
  assertEquals(kindOf(`<a>${"<b/>".repeat(250)}</a>`), "too-many");
  assertEquals(kindOf(`<a>${"x".repeat(5000)}</a>`), "too-large");
  for (const bad of ["", "text", "<a>", "<a></b>", "<a b></a>", "<a b=c/>", "<a/><b/>", "<a/>junk", '<a b="1" b="2"/>', '<a b="<"/>', "<a/ >", "<1/>"]) assertEquals(kindOf(bad), "malformed", JSON.stringify(bad));
  assert(describeXmlProblem({ kind: "doctype", at: 3 }).includes("no entity"));
});

proves(["0003-anyfs-serve-logical FR-001"], "a billion laughs and a deep nest are refused before they are expanded or read beyond the limit", () => {
  const laughs = '<!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">]><lolz>&lol2;</lolz>';
  assertEquals((parseXml(laughs, LIMITS) as { error: { kind: string } }).error.kind, "doctype");
  const big: XmlLimits = { maxBytes: 10_000_000, maxDepth: 32, maxNodes: 20000 };
  const deep = "<a>".repeat(100_000) + "</a>".repeat(100_000);
  const started = Date.now();
  const r = parseXml(deep, big);
  assert(r.kind === "err" && r.error.kind === "too-deep");
  assert(Date.now() - started < 2000, "refused quickly");
});

// ---- FR-002: the writer
proves(["0003-anyfs-serve-logical FR-002"], "the writer escapes text and attributes, replaces characters XML does not allow, declares namespaces once and writes empty elements empty", () => {
  const e = el(dav("a"), [el({ ns: "urn:x", local: "b" }, ["1 < 2 & \"3\" \u0001"], [{ name: "k", value: 'v"<&' }]), el(dav("c"))]);
  const text = writeXml(e);
  assert(text.startsWith('<?xml version="1.0" encoding="utf-8"?>\n<D:a xmlns:D="DAV:" xmlns:n1="urn:x">'));
  assert(text.includes('<n1:b k="v&quot;&lt;&amp;">1 &lt; 2 &amp; "3" �</n1:b>'));
  assert(text.includes("<D:c/>"));
  assertEquals((text.match(/xmlns:D=/gu) ?? []).length, 1);
});

const ARB_NAME = fc.stringMatching(/^[a-z][a-z0-9]{0,6}$/);
const arbTree = (depth: number): fc.Arbitrary<XmlElement> =>
  fc.record({
    ns: fc.constantFrom("DAV:", "urn:x", "urn:y"),
    local: ARB_NAME,
    attrs: fc.array(fc.record({ name: ARB_NAME, value: fc.string({ maxLength: 8 }) }), { maxLength: 2 }).map((a) => a.filter((x, i, all) => all.findIndex((y) => y.name === x.name) === i)),
    kids: depth === 0 ? fc.array(fc.string({ maxLength: 8 }), { maxLength: 2 }) : fc.array(fc.oneof(fc.string({ maxLength: 8 }), arbTree(depth - 1)), { maxLength: 3 }),
  }).map((r) => el({ ns: r.ns, local: r.local }, r.kids.map((k) => (typeof k === "string" ? k : k)), r.attrs));

const norm = (e: XmlElement): unknown => ({
  name: e.name,
  attrs: e.attrs,
  children: e.children.reduce<unknown[]>((out, c) => {
    if (c.kind === "text") {
      const prev = out[out.length - 1] as { text?: string } | undefined;
      if (c.text === "") return out;
      if (prev !== undefined && typeof prev.text === "string") prev.text += c.text;
      else out.push({ text: c.text });
    } else out.push(norm(c));
    return out;
  }, []),
});

proves(["0003-anyfs-serve-logical FR-002"], "a tree that the writer wrote is read back as the same tree (property)", () => {
  fc.assert(
    fc.property(arbTree(2), (tree) => {
      // text that XML 1.0 cannot hold is replaced by the writer, so the tree is compared after the same replacement
      const text = writeXml(tree);
      const back = parseXml(text, { maxBytes: 1 << 20, maxDepth: 16, maxNodes: 10000 });
      assert(back.kind === "ok", back.kind === "err" ? describeXmlProblem(back.error) : "");
      const clean = (s: string): string => [...s].map((ch) => ((ch.codePointAt(0) ?? 0) < 0x20 && ch !== "\t" && ch !== "\n" && ch !== "\r" ? "�" : ch)).join("");
      const cleaned = JSON.parse(JSON.stringify(norm(tree), (_k, v: unknown) => (typeof v === "string" ? clean(v) : v)));
      assertEquals(JSON.parse(JSON.stringify(norm(back.value))), cleaned);
    }),
    { numRuns: 100 },
  );
});

// ---- FR-003: addresses
proves(["0003-anyfs-serve-logical FR-003"], "an address is read a segment at a time and what is not a name is refused", () => {
  const read = (path: string, base = "/", unicode: "nfc" | "refuse" = "nfc"): string => {
    const r = pathOfUrl(new URL(`http://h${path}`), base, unicode);
    return r.kind === "ok" ? `${r.value.path}${r.value.collection ? " (collection)" : ""}` : r.error.kind;
  };
  assertEquals(read("/"), "/ (collection)");
  assertEquals(read("/a/b%20c.txt"), "/a/b c.txt");
  assertEquals(read("/a/b/"), "/a/b (collection)");
  assertEquals(read("//a///b"), "/a/b");
  assertEquals(read("/a%2Fb"), "malformed");
  assertEquals(read("/a%2fb"), "malformed");
  // the address parser reads an encoded dot segment as a dot segment, so nothing climbs above the root and nothing is left for a later step to resolve
  assertEquals(read("/%2e%2e/x"), "/x");
  assertEquals(read("/a/%2E/b"), "/a/b");
  assertEquals(read("/a/%2e%2e/%2e%2e/%2e%2e/x"), "/x");
  assertEquals(read("/a%00b"), "malformed");
  assertEquals(read("/a%0Ab"), "malformed");
  assertEquals(read("/a%5Cb"), "malformed");
  assertEquals(read("/a%ZZ"), "malformed");
  assertEquals(read("/é"), "/é");
  assertEquals(read("/e%CC%81", "/", "refuse"), "unicode");
  assertEquals(read("/é", "/", "refuse"), "/é");
  assertEquals(read("/dav/a", "/dav"), "/a");
  assertEquals(read("/dav", "/dav"), "/ (collection)");
  assertEquals(read("/davx/a", "/dav"), "outside");
  assertEquals(read("/other", "/dav"), "outside");
});

proves(["0003-anyfs-serve-logical FR-003"], "the address of a path reads back as the same path (property), and a Destination on another host is refused", () => {
  const seg = fc.string({ minLength: 1, maxLength: 6 }).filter((s) => !s.includes("/") && s !== "." && s !== ".." && ![...s].some((c) => (c.codePointAt(0) ?? 0) < 0x20 || c === "\\" || c === "\u007f" || (c.codePointAt(0) ?? 0) >= 0xd800 && (c.codePointAt(0) ?? 0) <= 0xdfff));
  fc.assert(
    fc.property(fc.array(seg.map((s) => s.normalize("NFC")), { minLength: 1, maxLength: 4 }), fc.boolean(), fc.constantFrom("/", "/dav", "/a/b"), (segments, collection, base) => {
      const parsed = parseAbsolute(`/${segments.join("/")}`);
      if (parsed.kind === "err") return;
      const href = hrefOf(parsed.value, collection, base);
      const back = pathOfUrl(new URL(`http://h${href}`), base, "nfc");
      assert(back.kind === "ok", `${href}`);
      assertEquals(back.value.path, parsed.value);
      assertEquals(back.value.collection, collection);
    }),
    { numRuns: 200 },
  );
  assertEquals(hrefOf(ROOT_PATH, true, "/"), "/");
  assertEquals(hrefOf(undefined, true, "/dav"), "/dav/");
  assertEquals(hrefOf(p("/a b/c'd"), false, "/"), "/a%20b/c%27d");
  const here = pathOfDestination("http://127.0.0.1:8080/x/y", "127.0.0.1:8080", "/", "nfc");
  assert(here.kind === "ok" && here.value.path === "/x/y");
  assert(pathOfDestination("/x/y", "127.0.0.1:8080", "/", "nfc").kind === "ok");
  const other = pathOfDestination("http://evil.test/x", "127.0.0.1:8080", "/", "nfc");
  assert(other.kind === "err" && other.error.kind === "other-host");
});

// ---- FR-004: answers
proves(["0003-anyfs-serve-logical FR-004"], "every answer carries the security headers, a file is sandboxed and the fidelity is written as a header", async () => {
  assertEquals(fidelityHeader({ kind: "native" }), "native");
  assertEquals(fidelityHeader({ kind: "emulated", reason: "copy-then-delete", risk: "non-atomic", detail: "x" }), "emulated; reason=copy-then-delete; risk=non-atomic");
  assertEquals(fidelityHeader({ kind: "refused", reason: "read-only", detail: "x" }), "refused; reason=read-only");
  const plain = responseOf({ status: 200, body: "x" });
  assertEquals(plain.headers.get("cache-control"), "no-store");
  assertEquals(plain.headers.get("x-content-type-options"), "nosniff");
  assertEquals(plain.headers.get("content-security-policy"), null);
  assertEquals(responseOf({ status: 200, body: "x", file: true }).headers.get("content-security-policy"), "sandbox");
  assertEquals(responseOf({ status: 204, body: "ignored" }).body, null);
  const noted = errorAnswer({ errno: "ENOENT", message: "gone", fidelity: { kind: "native" } }, "other");
  assertEquals(noted.status, 404);
  assertEquals(errorAnswer({ errno: "EIO", message: "down", fidelity: { kind: "native" }, problem: { kind: "unavailable", detail: "d", retryable: true } }, "other").status, 503);
  assertEquals(errorAnswer({ errno: "EIO", message: "down", fidelity: { kind: "native" }, problem: { kind: "unavailable", detail: "d", retryable: true } }, "other").headers?.["retry-after"], "5");
  assertEquals(errorAnswer({ errno: "EIO", message: "bad", fidelity: { kind: "native" }, problem: { kind: "tampered", path: "a" as never, detail: "d" } }, "other").status, 502);
  assertEquals(errorAnswer({ errno: "EEXIST", message: "there", fidelity: { kind: "native" } }, "mkcol").status, 405);
});

// ---- FR-005: properties
proves(["0003-anyfs-serve-logical FR-005"], "a PROPFIND body asks for all, the names or a list, and an answer has a 404 part for a property it does not have", () => {
  assertEquals(propfindRequest(""), { kind: "ok", value: { kind: "allprop" } });
  assertEquals(propfindRequest('<D:propfind xmlns:D="DAV:"><D:allprop/></D:propfind>'), { kind: "ok", value: { kind: "allprop" } });
  assertEquals(propfindRequest('<D:propfind xmlns:D="DAV:"><D:propname/></D:propfind>'), { kind: "ok", value: { kind: "propname" } });
  const some = propfindRequest('<D:propfind xmlns:D="DAV:" xmlns:x="urn:x"><D:prop><D:getetag/><x:mine/></D:prop></D:propfind>');
  assert(some.kind === "ok" && some.value.kind === "prop" && some.value.names.length === 2);
  assertEquals(propfindRequest("<other/>").kind, "err");
  assertEquals(propfindRequest("<!DOCTYPE a><a/>").kind, "err");
  const response = propResponse({ path: p("/a.txt"), collection: false, size: 3, etag: "sha256:ab", modified: "2026-01-02T03:04:05.000Z", locks: [] }, { kind: "prop", names: [dav("getetag"), { ns: "urn:x", local: "mine" }, dav("getcontentlength")] }, "/");
  const text = writeXml(multistatus([response]));
  assert(text.includes('<D:getetag>"sha256:ab"</D:getetag>'));
  assert(text.includes("<D:getcontentlength>3</D:getcontentlength>"));
  assert(text.includes("HTTP/1.1 200 OK") && text.includes("HTTP/1.1 404 Not Found"));
  const dir = writeXml(multistatus([propResponse({ path: p("/d"), collection: true, locks: [] }, { kind: "allprop" }, "/")]));
  assert(dir.includes("<D:collection/>") && !dir.includes("getetag") && !dir.includes("getcontentlength"));
  const patch = proppatchRequest('<D:propertyupdate xmlns:D="DAV:" xmlns:x="urn:x"><D:set><D:prop><x:a>1</x:a></D:prop></D:set><D:remove><D:prop><x:b/></D:prop></D:remove></D:propertyupdate>', LIMITS);
  assert(patch.kind === "ok" && patch.value.set.length === 1 && patch.value.remove.length === 1);
  assertEquals(proppatchRequest("<a/>", LIMITS).kind, "err");
});

// ---- FR-006 and FR-007: locks
proves(["0003-anyfs-serve-logical FR-006"], "the table gives exclusive locks with tokens, refuses a second where one covers, refuses a lock of infinity above one, and holds no more than its limits", () => {
  let now = 0;
  const table = newLockTable(() => now, { maxSeconds: 100, maxLocks: 3 });
  const a = table.create({ path: p("/a"), depth: "infinity", owner: "o", seconds: 1000 });
  assert(a.kind === "ok");
  assert(/^opaquelocktoken:[0-9a-f-]{36}$/u.test(a.value.token));
  assertEquals(a.value.seconds, 100, "no longer than the limit");
  assertEquals(table.create({ path: p("/a"), depth: "0", owner: "o", seconds: 5 }).kind, "err");
  assertEquals(table.create({ path: p("/a/b"), depth: "0", owner: "o", seconds: 5 }).kind, "err", "covered by a lock of infinity");
  const b = table.create({ path: p("/b/c"), depth: "0", owner: "o", seconds: 5 });
  assert(b.kind === "ok");
  assertEquals(table.create({ path: p("/b"), depth: "infinity", owner: "o", seconds: 5 }).kind, "err", "a lock of infinity above one that is held");
  assert(table.create({ path: p("/b"), depth: "0", owner: "o", seconds: 5 }).kind === "ok", "a lock of 0 above one is no conflict");
  assertEquals(table.create({ path: p("/z"), depth: "0", owner: "o", seconds: 5 }).kind, "err", "the table is full");
  now = 1_000_000;
  assertEquals(table.covering(p("/a")).length, 0);
});

proves(["0003-anyfs-serve-logical FR-007"], "a lock ends at its time, is refreshed, is released only with its own token at a resource it covers, and blocks what it covers unless its token is submitted", () => {
  let now = 0;
  const table = newLockTable(() => now, { maxSeconds: 3600, maxLocks: 10 });
  const made = table.create({ path: p("/dir"), depth: "infinity", owner: "o", seconds: 60 });
  assert(made.kind === "ok");
  const token = made.value.token;
  const none = new Set<string>();
  assertEquals(table.blocking(p("/dir/x"), none, false)?.token, token);
  assertEquals(table.blocking(p("/dir/x"), new Set([token]), false), undefined);
  assertEquals(table.blocking(p("/other"), none, false), undefined);
  assertEquals(table.blocking(p("/"), none, true)?.token, token, "a subtree change reaches the locks below it");
  assertEquals(table.blocking(p("/"), none, false), undefined);
  now = 59_000;
  assert(table.refresh(token, 60).kind === "ok");
  now = 100_000;
  assertEquals(table.covering(p("/dir")).length, 1, "refreshed to 119 s");
  assertEquals(table.release("opaquelocktoken:none", p("/dir")).kind, "err");
  assertEquals(table.release(token, p("/elsewhere")).kind, "err");
  assert(table.release(token, p("/dir/inside")).kind === "ok", "released at a resource it covers");
  assertEquals(table.find(token), undefined);
  const again = table.create({ path: p("/e"), depth: "0", owner: "o", seconds: 10 });
  assert(again.kind === "ok");
  now += 11_000;
  assertEquals(table.refresh(again.value.token, 5).kind, "err", "an ended lock is gone");
  const last = table.create({ path: p("/f/g"), depth: "0", owner: "o", seconds: 10 });
  assert(last.kind === "ok");
  table.drop(p("/f"));
  assertEquals(table.covering(p("/f/g")).length, 0);
});

// ---- FR-008: If
proves(["0003-anyfs-serve-logical FR-008"], "the If header is read as lists of tokens and entity tags, negated or not, tagged or not, and anything else is refused whole", () => {
  const ok = parseIf('<http://h/a> (<opaquelocktoken:t1> ["e1"]) (Not <DAV:no-lock>) </b> ([W/"e2"])');
  assert(ok.kind === "ok");
  assertEquals(ok.value.length, 3);
  assertEquals(ok.value[0]?.resource, "http://h/a");
  assertEquals(ok.value[1]?.conditions[0]?.not, true);
  assertEquals(ok.value[2]?.resource, "/b");
  assertEquals(ok.value[2]?.conditions[0]?.value, '"e2"');
  assertEquals([...submittedTokens(ok.value)], ["opaquelocktoken:t1"]);
  for (const bad of ["", "   ", "token", "(", "()", "(<a)", "([x)", "(x)", "<a>", "(<a> (<b>))", "(Notx <a>)"]) assertEquals(parseIf(bad).kind, "err", JSON.stringify(bad));
});

proves(["0003-anyfs-serve-logical FR-008"], "a header holds for a resource when a list that applies holds, and constrains nothing it does not name", () => {
  const lists = (s: string) => {
    const r = parseIf(s);
    assert(r.kind === "ok");
    return r.value;
  };
  const facts = (etag: string | undefined, tokens: string[], named: string[] = []) => ({ etag, tokens: new Set(tokens), names: (r: string) => named.includes(r) });
  assert(ifHolds(lists("(<t1>)"), facts(undefined, ["t1"])));
  assert(!ifHolds(lists("(<t2>)"), facts(undefined, ["t1"])));
  assert(ifHolds(lists("(<t2>) (<t1>)"), facts(undefined, ["t1"])), "any list");
  assert(!ifHolds(lists("(<t1> [\"e\"])"), facts("x", ["t1"])), "all conditions of a list");
  assert(ifHolds(lists('(<t1> ["e"])'), facts("e", ["t1"])));
  assert(ifHolds(lists("(Not <DAV:no-lock>)"), facts(undefined, [])));
  assert(!ifHolds(lists('(Not ["e"])'), facts("e", [])));
  assert(ifHolds(lists("<http://h/other> (<t9>)"), facts(undefined, []), ), "a list for a resource that is not this one constrains nothing");
  assert(!ifHolds(lists("<http://h/this> (<t9>)"), facts(undefined, [], ["http://h/this"])));
});

// ---- FR-009: credentials
proves(["0003-anyfs-serve-logical FR-009"], "credentials are read from Bearer and Basic, a token is compared as digests, and a made token is 64 hex digits", async () => {
  assertEquals(credentialsOf(null), undefined);
  assertEquals(credentialsOf("Bearer abc"), { scheme: "bearer", secret: "abc" });
  assertEquals(credentialsOf("bearer  abc "), { scheme: "bearer", secret: "abc" });
  assertEquals(credentialsOf(`Basic ${btoa("any:pass:word")}`), { scheme: "basic", user: "any", secret: "pass:word" });
  for (const bad of ["Bearer", "Bearer ", "Basic !!", `Basic ${btoa("nocolon")}`, "Digest x", "x"]) assertEquals(credentialsOf(bad), undefined, bad);
  const t = newToken();
  assert(/^[0-9a-f]{64}$/u.test(t));
  assert(t !== newToken());
  assert(await sameSecret(t, t));
  assert(!(await sameSecret(t, `${t}0`)));
  assert(!(await sameSecret("", t)));
  const may = tokenAuthenticator("tok");
  assert(await may({ scheme: "bearer", secret: "tok" }));
  assert(await may({ scheme: "basic", user: "u", secret: "tok" }));
  assert(!(await may({ scheme: "bearer", secret: "no" })));
  assert(!(await may(undefined)));
  assert(await noAuthentication(undefined));
});
