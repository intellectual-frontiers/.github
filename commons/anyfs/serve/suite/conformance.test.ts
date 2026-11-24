/**
 * Tests of what proves the server (commons anyfs-serve 0005-anyfs-serve-conformance FR-001 to FR-004): the protocol suite litmus against the server over a store in memory and a store in a folder, a model of the tree, hostile XML, and the requests of the desktops.
 *
 * @module
 */
import fc from "fast-check";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { localStore } from "@intellectual-frontiers/anyfs/local";
import { fs, proc } from "@intellectual-frontiers/system";
import { serveStore } from "../src/mod.ts";
import { client, full, hrefsOf, LOCKINFO, type Client } from "./world.ts";

// ---- FR-001: litmus, the protocol suite of WebDAV
/** The tests of litmus that the server does not pass, by suite: the ones that need a property to be stored, a second kind of lock or a longer `If` header than litmus sends. */
const KNOWN_FAILURES: Readonly<Record<string, readonly string[]>> = {
  basic: [],
  copymove: [],
  http: [],
  locks: ["owner_modify", "owner_modify", "complex_cond_put", "fail_complex_cond_put", "lock_shared"],
  props: ["propset", "propmanyns", "propget"],
};
const PASSING = { basic: 16, copymove: 13, http: 4, locks: 29, props: 11 } as const;

type Suite = keyof typeof PASSING;

async function litmus(url: string, suite: Suite): Promise<{ readonly passed: number; readonly failed: readonly string[] }> {
  const bin = proc.which("litmus");
  if (bin === undefined) throw new Error("litmus is not installed");
  const out = await proc.run([bin, url, "anyfs", "tok"], { env: { TESTS: suite }, cwd: await fs.makeTempDir({ prefix: "litmus-" }) });
  const text = out.stdout + out.stderr;
  const summary = new RegExp(`summary for \`${suite}': of (\\d+) tests run: (\\d+) passed`, "u").exec(text);
  if (summary === null) throw new Error(`no summary for ${suite}:\n${text.slice(-600)}`);
  const failed = [...text.matchAll(/^\s*\d+\.\s+([a-z0-9_]+)\.+\s+\d+\.\s+[a-z0-9_]+\.+\s+FAIL/gmu)].map((m) => m[1] ?? "");
  return { passed: Number(summary[2]), failed };
}

proves(["0005-anyfs-serve-conformance FR-001"], "over a store in memory and a store in a folder, the server passes the suites basic, copymove and http of litmus whole and fails in locks and props exactly the recorded tests (skipped where litmus is not installed)", async () => {
  if (proc.which("litmus") === undefined) return;
  const dir = await fs.makeTempDir({ prefix: "anyfs-serve-litmus-" });
  try {
    const local = await localStore(dir);
    assert(local.kind === "ok");
    for (const store of [full(), local.value]) {
      const s = await serveStore(store as never, { token: "tok" });
      assert(s.kind === "ok");
      try {
        for (const suite of Object.keys(PASSING) as Suite[]) {
          const r = await litmus(s.value.url, suite);
          assertEquals([...r.failed].sort(), [...(KNOWN_FAILURES[suite] ?? [])].sort(), `${suite} on ${store.id}`);
          assertEquals(r.passed >= PASSING[suite] - 0, true, `${suite} passed ${r.passed}`);
        }
      } finally {
        await s.value.close();
      }
    }
  } finally {
    await fs.remove(dir, { recursive: true });
  }
}, { timeoutMs: 120_000 } as never);

// ---- FR-002: a model of the tree
type Model = { readonly files: Map<string, string>; readonly dirs: Set<string> };

const parentOf = (p: string): string => p.slice(0, p.lastIndexOf("/")) || "/";
const ancestors = (p: string): string[] => {
  const out: string[] = [];
  for (let a = parentOf(p); a !== "/"; a = parentOf(a)) out.push(a);
  return out;
};
const below = (dir: string, p: string): boolean => p.startsWith(dir === "/" ? "/" : `${dir}/`) && p !== dir;
const isDir = (m: Model, p: string): boolean => p === "/" || m.dirs.has(p) || [...m.files.keys()].some((f) => below(p, f)) || [...m.dirs].some((d) => below(p, d));
const isFile = (m: Model, p: string): boolean => m.files.has(p);
const exists = (m: Model, p: string): boolean => isFile(m, p) || isDir(m, p);
const parentOk = (m: Model, p: string): boolean => parentOf(p) === "/" || (isDir(m, parentOf(p)) && !isFile(m, parentOf(p)));
const noFileOnTheWay = (m: Model, p: string): boolean => ancestors(p).every((a) => !isFile(m, a));

type Op = { readonly op: "MKCOL" | "PUT" | "DELETE" | "COPY" | "MOVE"; readonly a: string; readonly b: string; readonly body: string };

/** What the server must answer, as a class, and what it must leave; `undefined` where the model does not say. */
function apply(m: Model, op: Op): boolean {
  switch (op.op) {
    case "MKCOL":
      if (exists(m, op.a) || !parentOk(m, op.a)) return false;
      m.dirs.add(op.a);
      return true;
    case "PUT":
      if (isDir(m, op.a) || !noFileOnTheWay(m, op.a)) return false;
      m.files.set(op.a, op.body);
      return true;
    case "DELETE": {
      if (!exists(m, op.a)) return false;
      for (const f of [...m.files.keys()]) if (f === op.a || below(op.a, f)) m.files.delete(f);
      for (const d of [...m.dirs]) if (d === op.a || below(op.a, d)) m.dirs.delete(d);
      return true;
    }
    case "COPY":
    case "MOVE": {
      const src = op.a;
      const dst = op.b;
      if (!exists(m, src) || src === dst || below(src, dst) || below(dst, src) || !parentOk(m, dst)) return false;
      const moving = op.op === "MOVE";
      const sourceFiles = [...m.files].filter(([f]) => f === src || below(src, f));
      const sourceDirs = [...m.dirs].filter((d) => d === src || below(src, d));
      const wasDir = isDir(m, src) && !isFile(m, src);
      const implicit = wasDir ? [...new Set([...sourceFiles.map(([f]) => f), ...sourceDirs].flatMap((p) => [...ancestors(p), ...(isDir(m, p) ? [p] : [])]).filter((d) => d === src || below(src, d)))] : [];
      for (const f of [...m.files.keys()]) if (f === dst || below(dst, f)) m.files.delete(f);
      for (const d of [...m.dirs]) if (d === dst || below(dst, d)) m.dirs.delete(d);
      for (const [f, body] of sourceFiles) m.files.set(dst + f.slice(src.length), body);
      // a copy makes every collection it walks a kept one; a move carries the marker of a kept one and no more
      for (const d of moving ? sourceDirs : implicit) m.dirs.add(dst + d.slice(src.length));
      if (wasDir && !moving) m.dirs.add(dst);
      if (moving) {
        for (const [f] of sourceFiles) m.files.delete(f);
        for (const d of sourceDirs) m.dirs.delete(d);
      }
      return true;
    }
  }
}

async function treeOf(call: Client): Promise<{ readonly files: Map<string, string>; readonly dirs: Set<string> }> {
  const files = new Map<string, string>();
  const dirs = new Set<string>();
  const walk = async (dir: string): Promise<void> => {
    const r = await call("PROPFIND", dir === "/" ? "/" : `${dir}/`, { headers: { depth: "1" } });
    if (r.status !== 207) return;
    for (const h of hrefsOf(r.text).slice(1)) {
      const p = decodeURIComponent(h).replace(/\/$/u, "");
      if (h.endsWith("/")) {
        dirs.add(p);
        await walk(p);
      } else files.set(p, (await call("GET", h)).text);
    }
  };
  await walk("/");
  return { files, dirs };
}

const NAMES = ["a", "b", "c"] as const;
const PATH = fc.array(fc.constantFrom(...NAMES), { minLength: 1, maxLength: 3 }).map((s) => `/${s.join("/")}`);
const OP: fc.Arbitrary<Op> = fc.record({ op: fc.constantFrom("MKCOL", "PUT", "DELETE", "COPY", "MOVE", "PUT", "MKCOL"), a: PATH, b: PATH, body: fc.constantFrom("x", "yy", "zzz") });

proves(["0005-anyfs-serve-conformance FR-002"], "a random sequence of MKCOL, PUT, DELETE, COPY and MOVE leaves the tree of a model in memory, and the class of each status is the model's (property)", async () => {
  await fc.assert(
    fc.asyncProperty(fc.array(OP, { minLength: 1, maxLength: 14 }), async (ops) => {
      const c = client(full());
      const model: Model = { files: new Map(), dirs: new Set() };
      for (const op of ops) {
        const should = apply(model, op);
        const r =
          op.op === "PUT"
            ? await c.call("PUT", op.a, { body: op.body })
            : op.op === "COPY" || op.op === "MOVE"
              ? await c.call(op.op, op.a, { headers: { destination: op.b } })
              : await c.call(op.op, op.a);
        assertEquals(r.status >= 200 && r.status < 300, should, `${op.op} ${op.a}${op.op === "COPY" || op.op === "MOVE" ? ` -> ${op.b}` : ""} gave ${r.status}`);
      }
      const seen = await treeOf(c.call);
      assertEquals([...seen.files].sort(), [...model.files].sort());
      // a collection that is there is one that the model has as kept or as the parent of something
      const expected = new Set<string>();
      for (const p of [...model.files.keys(), ...model.dirs]) {
        for (const a of ancestors(p)) expected.add(a);
      }
      for (const d of model.dirs) expected.add(d);
      assertEquals([...seen.dirs].sort(), [...expected].sort());
    }),
    { numRuns: 120 },
  );
});

proves(["0005-anyfs-serve-conformance FR-002"], "a COPY of a collection over a resource whose parent is there only for it replaces the resource and keeps the parent (the counterexample of the property, as examples)", async () => {
  const sequences: readonly (readonly (readonly [string, string, string?])[])[] = [
    // a collection over a file that is the only thing below its parent
    [["MKCOL", "/c"], ["PUT", "/a/a/c"], ["COPY", "/c", "/a/a/c"]],
    // a collection with a file over a file
    [["MKCOL", "/c"], ["PUT", "/c/f"], ["PUT", "/a/a/c"], ["COPY", "/c", "/a/a/c"]],
    // a collection over a collection that holds one file
    [["MKCOL", "/c"], ["PUT", "/a/a/c/g"], ["COPY", "/c", "/a/a/c"]],
  ];
  for (const steps of sequences) {
    const c = client(full());
    for (const [method, from, to] of steps) {
      const r = method === "PUT" ? await c.call(method, from, { body: "x" }) : to === undefined ? await c.call(method, from) : await c.call(method, from, { headers: { destination: to } });
      assertEquals(r.status >= 200 && r.status < 300 && r.status !== 207, true, `${method} ${from}${to === undefined ? "" : ` -> ${to}`} gave ${r.status}`);
    }
    assertEquals((await c.call("MKCOL", "/a")).status, 405, "the parent of the copy is there");
    assertEquals((await c.call("PROPFIND", "/a/a/", { headers: { depth: "0" } })).status, 207, "and so is the one below it");
  }
});

// ---- FR-003: hostile XML
proves(["0005-anyfs-serve-conformance FR-003"], "a PROPFIND, a PROPPATCH or a LOCK with a hostile body is refused with 400 or 413 and no resource is touched", async () => {
  const limits = { maxBody: 1000, maxXml: 2000, maxXmlDepth: 8, maxXmlNodes: 200, maxLockSeconds: 60, maxLocks: 10, maxResources: 100 };
  const c = client(full(), { limits });
  await c.call("PUT", "/a.txt", { body: "x" });
  const hostile: readonly (readonly [string, number])[] = [
    ['<!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">]><D:propfind xmlns:D="DAV:"><D:prop><D:displayname>&lol2;</D:displayname></D:prop></D:propfind>', 400],
    ['<?xml version="1.0"?><!DOCTYPE d [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><D:lockinfo xmlns:D="DAV:"><D:owner>&xxe;</D:owner></D:lockinfo>', 400],
    [`<D:propfind xmlns:D="DAV:">${"<D:prop>".repeat(20)}${"</D:prop>".repeat(20)}</D:propfind>`, 400],
    [`<D:propfind xmlns:D="DAV:"><D:prop>${"<D:x/>".repeat(300)}</D:prop></D:propfind>`, 400],
    [`<D:propfind xmlns:D="DAV:"><D:prop>${"<D:x/>".repeat(1000)}</D:prop></D:propfind>`, 413],
    ['<D:propfind xmlns:D="DAV:"><x:y/></D:propfind>', 400],
    ["\u0000<a/>", 400],
  ];
  for (const [body, status] of hostile) {
    for (const method of ["PROPFIND", "PROPPATCH", "LOCK"]) {
      const r = await c.call(method, "/a.txt", { body, headers: { depth: "0" } });
      assertEquals(r.status, status, `${method} ${body.slice(0, 50)}`);
    }
  }
  assertEquals((await c.call("GET", "/a.txt")).text, "x", "nothing was touched");
  assertEquals((await c.call("PROPFIND", "/", { headers: { depth: "0" } })).status, 207, "the server still answers");
  void LOCKINFO;
});

// ---- FR-004: the desktops
proves(["0005-anyfs-serve-conformance FR-004"], "the requests of Finder and Windows are answered as they expect: OPTIONS, a PROPFIND of what is not there, the properties a desktop asks for, junk files by the policy, and a challenge for Basic", async () => {
  const c = client(full());
  const options = await c.call("OPTIONS", "/anything");
  assertEquals(options.status, 200);
  assertEquals(options.headers.get("dav"), "1, 2");
  assertEquals(options.headers.get("ms-author-via"), "DAV");
  assertStringIncludes(options.headers.get("allow") ?? "", "PROPFIND");
  assertEquals((await c.call("PROPFIND", "/no-such", { headers: { depth: "0" } })).status, 404);
  assertEquals((await c.call("PROPFIND", "/", { headers: { depth: "0" }, body: "" })).status, 207, "an empty body asks for every property");
  await c.call("PUT", "/f.txt", { body: "abc" });
  const asked = await c.call("PROPFIND", "/f.txt", {
    headers: { depth: "0" },
    body: '<?xml version="1.0" encoding="utf-8"?><D:propfind xmlns:D="DAV:" xmlns:m="urn:schemas-microsoft-com:"><D:prop><D:resourcetype/><D:getcontentlength/><m:Win32FileAttributes/><D:creationdate/><D:getlastmodified/><D:displayname/></D:prop></D:propfind>',
  });
  assertEquals(asked.status, 207);
  assertStringIncludes(asked.text, "<D:displayname>f.txt</D:displayname>");
  assertStringIncludes(asked.text, "HTTP/1.1 404 Not Found");
  assertStringIncludes(asked.text, "Win32FileAttributes");
  for (const [junk, name] of [["allow", ".DS_Store"], ["allow", "._f.txt"], ["allow", "Thumbs.db"], ["allow", "desktop.ini"]] as const) {
    const a = client(full(), { junk });
    assertEquals((await a.call("PUT", `/${name}`, { body: "j" })).status, 201, `${junk} ${name}`);
    assertEquals(hrefsOf((await a.call("PROPFIND", "/", { headers: { depth: "1" } })).text).length, 2);
  }
  for (const name of [".DS_Store", "._f.txt", "Thumbs.db", "desktop.ini"]) {
    const h = client(full(), { junk: "hide" });
    assertEquals((await h.call("PUT", `/${name}`, { body: "j" })).status, 201);
    assertEquals(hrefsOf((await h.call("PROPFIND", "/", { headers: { depth: "1" } })).text), ["/"]);
    assertEquals((await h.call("GET", `/${name}`)).text, "j", "hidden from the listing, still there");
    const r = client(full(), { junk: "refuse" });
    assertEquals((await r.call("PUT", `/${name}`, { body: "j" })).status, 403, name);
    assertEquals((await r.call("MKCOL", `/${name}`)).status, 403);
    assertEquals((await r.call("PUT", "/ok.txt", { body: "x" })).status, 201);
  }
  const guarded = client(full(), { authenticator: async () => false });
  const challenge = await guarded.call("PROPFIND", "/", { headers: { depth: "0" } });
  assertEquals(challenge.status, 401);
  assertStringIncludes(challenge.headers.get("www-authenticate") ?? "", 'Basic realm="anyfs"');
  const nfd = client(full());
  assertEquals((await nfd.call("PUT", "/e%CC%81.txt", { body: "x" })).status, 201);
  assertEquals((await nfd.call("GET", "/%C3%A9.txt")).text, "x", "a name that arrives decomposed is the composed one");
  const strict = client(full(), { unicode: "refuse" });
  assertEquals((await strict.call("PUT", "/e%CC%81.txt", { body: "x" })).status, 400);
});
