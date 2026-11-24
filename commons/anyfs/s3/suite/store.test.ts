/**
 * Tests of the store over a bucket (commons anyfs-s3 0002-anyfs-s3-store FR-008 to FR-014), on the server made in process and on RustFS where it can be run: the store passes the conformance suite of AnyFS in both
 * modes of revision, is made as what the endpoint was found to keep, revises as the bytes do, writes exactly as its expectation says, lists in pages in the order of the paths, and says what it does not have.
 *
 * @module
 */
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { runConformance } from "@intellectual-frontiers/anyfs/conformance";
import { retrying } from "@intellectual-frontiers/anyfs/layers";
import { memoryStore } from "@intellectual-frontiers/anyfs/memory";
import { expectAbsent, expectAny, expectRev, parsePath, parsePrefix, type Path, ROOT } from "@intellectual-frontiers/anyfs/governance";
import { CAS_CAPABILITIES, openS3Store, PLAIN_CAPABILITIES, READ_CAPABILITIES, staticCredentials } from "../src/mod.ts";
import { bucketOn, fake, onServers, openOn, placeOf, type Server, writableOn } from "./support.ts";

const p = (text: string): Path => {
  const r = parsePath(text);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};
const bytes = (t: string): Uint8Array => new TextEncoder().encode(t);
const text = (b: Uint8Array): string => new TextDecoder().decode(b);
let counter = 0;
const unique = (label: string): string => `${label}-${Date.now().toString(36)}-${counter++}`;

/** A bucket of its own on a server. */
async function fresh(server: Server, label: string): Promise<string> {
  const bucket = unique(label);
  await bucketOn(server, bucket);
  return bucket;
}

/** The text of a failure of a conformance run, none where it passed. */
const failures = (reports: readonly { readonly id: string; readonly failure?: string }[]): readonly string[] => reports.filter((r) => r.failure !== undefined).map((r) => `${r.id}: ${r.failure}`);

proves(["0002-anyfs-s3-store FR-014", "0003-anyfs-s3-tests FR-002", "0003-anyfs-s3-tests FR-003"], "the store passes every case of the conformance suite of AnyFS, with revisions of the digest and with revisions of the entity tag, on the server in process and on RustFS", async (t) => {
  await onServers(
    async (server, label) => {
      for (const revisions of ["sha256", "etag"] as const) {
        const bucket = await fresh(server, "conf");
        let n = 0;
        const reports = await runConformance(async () => (await writableOn(server, bucket, `run-${n++}`, { revisions })).store);
        assertEquals(failures(reports), [], `${label} ${revisions}`);
        assert(reports.some((r) => r.id === "race-revision" && r.failure === undefined), "the race of revisions was run: the store has cas");
      }
    },
    (reason) => t.skip(reason),
  );
});

proves(["0002-anyfs-s3-store FR-008"], "a store of an endpoint that keeps every condition has cas, and the capabilities are exactly read, write, list, stat, delete and cas, with no batch, rename, history, range, append or search", async () => {
  const { server, fake: f } = await fake();
  try {
    const bucket = await fresh(server, "caps");
    const o = await openOn(server, bucket, "x");
    assertEquals(o.mode, "cas");
    assertEquals([...o.store.capabilities].sort(), [...CAS_CAPABILITIES].sort());
    assertEquals(o.facts.probe, { writable: true, ifNoneMatch: true, ifMatch: true, conditionalDelete: true, checksum: true });
    assertEquals(o.facts.digest, "sha256-native");
    assertEquals(o.store.consistency, "strong");
    assertEquals(o.store.traits, { caseSensitive: true, maxObject: 64 * 1024 * 1024 });
    for (const op of ["batch", "rename", "history", "rangeRead", "append", "search"] as const) {
      const r = await o.store.handle(op === "batch" ? { op, changes: [] } : op === "rename" ? { op, from: p("a"), to: p("b"), expect: expectAny } : op === "history" ? { op, path: p("a") } : op === "rangeRead" ? { op, path: p("a"), start: 0, length: 1 } : op === "append" ? { op, path: p("a"), bytes: bytes("x"), expect: expectAny } : { op, prefix: ROOT, text: "x" });
      assert(r.kind === "err" && r.error.kind === "refused" && r.error.reason === "capability-absent", op);
    }
    assertEquals(f.seen.some((r) => JSON.stringify(r.headers).includes(server.credentials.kind === "static" ? server.credentials.credentials.secretAccessKey : "?")), false, "no request carried the secret");
  } finally {
    await f.stop();
  }
});

proves(["0002-anyfs-s3-store FR-008"], "an endpoint that ignores If-Match, or ignores it on a delete, is made without cas in its type, and a store without cas takes no expectation of a revision", async () => {
  for (const conditions of [{ ifMatch: false }, { ifMatchDelete: false }] as const) {
    const { server, fake: f } = await fake({ conditions });
    try {
      const bucket = await fresh(server, "plain");
      const o = await writableOn(server, bucket, "x");
      assertEquals(o.mode, "plain");
      assertEquals(o.cas, undefined);
      assertEquals([...o.store.capabilities].sort(), [...PLAIN_CAPABILITIES].sort());
      const w = await o.store.write(p("a"), bytes("1"), expectAbsent);
      assert(w.kind === "ok");
      // @ts-expect-error a store without cas takes no expectation of a revision
      await o.store.write(p("a"), bytes("2"), expectRev(w.value.rev));
      const via = await o.store.handle({ op: "write", path: p("a"), bytes: bytes("2"), expect: expectRev(w.value.rev) });
      assert(via.kind === "err" && via.error.kind === "refused" && via.error.reason === "unsupported-expectation");
      assertEquals(f.objects(bucket).size, 1, "nothing was left of the probe");
    } finally {
      await f.stop();
    }
  }
});

proves(["0002-anyfs-s3-store FR-008"], "an endpoint that ignores If-None-Match is refused the write that expects no object, with the reason, so that two writers never both make an object", async () => {
  const { server, fake: f } = await fake({ conditions: { ifNoneMatch: false } });
  try {
    const bucket = await fresh(server, "none");
    const o = await writableOn(server, bucket, "x");
    assertEquals(o.mode, "plain");
    const r = await o.store.write(p("a"), bytes("1"), expectAbsent);
    assert(r.kind === "err" && r.error.kind === "refused" && r.error.reason === "unsupported-expectation");
    assertStringIncludes(r.error.detail, "If-None-Match");
    assert((await o.store.write(p("a"), bytes("1"), expectAny)).kind === "ok", "a write that expects nothing is made, and learns whether it made the object by asking first");
  } finally {
    await f.stop();
  }
});

proves(["0002-anyfs-s3-store FR-008"], "keys that may only read give a store that can only read, with the capabilities of read, list and stat and no write in its type", async () => {
  const { server, fake: f } = await fake({ readOnly: true });
  try {
    const bucket = await fresh(server, "ro");
    const o = await openOn(server, bucket, "x");
    assertEquals(o.mode, "read-only");
    assertEquals([...o.store.capabilities].sort(), [...READ_CAPABILITIES].sort());
    assertEquals("write" in o.store, false);
    assertEquals((await o.store.list(ROOT)).kind, "ok");
  } finally {
    await f.stop();
  }
});

proves(["0002-anyfs-s3-store FR-008", "0003-anyfs-s3-tests FR-002"], "a store is not made where the bucket is not there, the keys are not accepted, the signature does not match or nobody answers, and each says which, with no key in the sentence", async () => {
  const { server, fake: f } = await fake();
  try {
    const missing = await openS3Store({ place: placeOf("no-such-bucket", "x"), credentials: server.credentials, endpoint: server.endpoint });
    assert(missing.kind === "err");
    assertStringIncludes(missing.error, "does not exist");
    const bucket = await fresh(server, "auth");
    const wrongSecret = staticCredentials(server.credentials.kind === "static" ? server.credentials.credentials.accessKeyId : "x", "another-secret-value");
    const wrongId = staticCredentials("AKIDSOMEONEELSE", "another-secret-value");
    assert(wrongSecret.kind === "ok" && wrongId.kind === "ok");
    const badSecret = await openS3Store({ place: placeOf(bucket, "x"), credentials: wrongSecret.value, endpoint: server.endpoint });
    assert(badSecret.kind === "err");
    assertStringIncludes(badSecret.error, "SignatureDoesNotMatch");
    assertEquals(badSecret.error.includes("another-secret-value"), false);
    const badId = await openS3Store({ place: placeOf(bucket, "x"), credentials: wrongId.value, endpoint: server.endpoint });
    assert(badId.kind === "err");
    assertStringIncludes(badId.error, "InvalidAccessKeyId");
    const nobody = await openS3Store({ place: placeOf(bucket, "x"), credentials: server.credentials, endpoint: "http://127.0.0.1:1", timeoutMs: 2000 });
    assert(nobody.kind === "err");
    assertStringIncludes(nobody.error, "connection");
    assertEquals((await openS3Store({ place: placeOf(bucket, "x"), credentials: server.credentials, endpoint: "ftp://example.test" })).kind, "err");
  } finally {
    await f.stop();
  }
});

proves(["0002-anyfs-s3-store FR-009"], "the revision of an object is sha256: and the digest of its bytes, the same as a store in memory gives for the same bytes, whether it is written, read, stat or listed, on both servers", async (t) => {
  await onServers(
    async (server) => {
      const bucket = await fresh(server, "rev");
      const o = await writableOn(server, bucket, "r");
      const mem = memoryStore();
      const hello = bytes("hello, bucket");
      const w = await o.store.write(p("d/hello"), hello, expectAny);
      const m = await mem.write(p("d/hello"), hello, expectAny);
      assert(w.kind === "ok" && m.kind === "ok");
      assertEquals(w.value.rev, `sha256:${await sha256(hello)}`);
      assertEquals(w.value.rev, m.value.rev);
      const read = await o.store.read(p("d/hello"));
      const stat = await o.store.stat(p("d/hello"));
      const list = await o.store.list(ROOT);
      assert(read.kind === "ok" && stat.kind === "ok" && list.kind === "ok");
      assertEquals([read.value.rev, stat.value.rev, list.value.entries[0]?.rev], [w.value.rev, w.value.rev, w.value.rev]);
      assertEquals(w.value.created, true);
      const again = await o.store.write(p("d/hello"), hello, expectAny);
      assert(again.kind === "ok");
      assertEquals(again.value.created, false);
    },
    (reason) => t.skip(reason),
  );
});

proves(["0002-anyfs-s3-store FR-009"], "an object written by another tool has no digest of ours and is at the digest of its bytes, whether it is read, stat or listed, and a revision of it holds a write", async (t) => {
  await onServers(
    async (server) => {
      const bucket = await fresh(server, "foreign");
      const o = await writableOn(server, bucket, "f");
      const raw = await o.client.send({ method: "PUT", key: "f/foreign.txt", body: bytes("made elsewhere"), headers: { "content-type": "text/plain" } });
      assert(raw.kind === "ok");
      const want = `sha256:${await sha256(bytes("made elsewhere"))}`;
      const stat = await o.store.stat(p("foreign.txt"));
      assert(stat.kind === "ok");
      assertEquals(stat.value.rev, want);
      assertEquals((await o.store.list(ROOT)).kind === "ok" && (await o.store.list(ROOT)).kind === "ok" ? "ok" : "no", "ok");
      assertEquals((await o.store.read(p("foreign.txt")) as { value: { rev: string } }).value.rev, want);
      if (o.cas !== undefined) {
        const done = await o.cas.write(p("foreign.txt"), bytes("now ours"), expectRev(stat.value.rev));
        assert(done.kind === "ok", "a write at the revision of a foreign object");
      }
    },
    (reason) => t.skip(reason),
  );
});

proves(["0002-anyfs-s3-store FR-009"], "a read whose bytes are not the digest the metadata names is tampered, and a foreign object too big to hash for a revision is refused", async () => {
  const { server, fake: f } = await fake();
  try {
    const bucket = await fresh(server, "tamper");
    const o = await writableOn(server, bucket, "t", { maxBytes: 16 });
    const ok1 = await o.store.write(p("a"), bytes("original"), expectAny);
    assert(ok1.kind === "ok");
    const stored = f.objects(bucket).get("t/a");
    assert(stored !== undefined);
    stored.bytes = bytes("replaced");
    const r = await o.store.read(p("a"));
    assert(r.kind === "err" && r.error.kind === "tampered");
    await o.client.send({ method: "PUT", key: "t/big", body: bytes("x".repeat(40)) });
    const big = await o.store.stat(p("big"));
    assert(big.kind === "err" && big.error.kind === "refused" && big.error.reason === "too-large");
    const wr = await o.store.write(p("c"), bytes("x".repeat(40)), expectAny);
    assert(wr.kind === "err" && wr.error.kind === "refused" && wr.error.reason === "too-large");
  } finally {
    await f.stop();
  }
});

proves(["0002-anyfs-s3-store FR-009"], "in the mode of the entity tag a revision is etag: and the tag, the digest revision is not taken, and in the mode of the digest an etag revision is not taken", async () => {
  const { server, fake: f } = await fake();
  try {
    const bucket = await fresh(server, "modes");
    const e = await writableOn(server, bucket, "e", { revisions: "etag" });
    const s = await writableOn(server, bucket, "s");
    assertEquals(e.facts.digest, "etag");
    const w = await e.store.write(p("a"), bytes("tagged"), expectAny);
    assert(w.kind === "ok");
    assert(/^etag:[0-9a-f]{32}$/u.test(w.value.rev), w.value.rev);
    if (e.cas !== undefined && s.cas !== undefined) {
      const wrong = await e.cas.write(p("a"), bytes("x"), expectRev(`sha256:${"0".repeat(64)}` as never));
      assert(wrong.kind === "err" && wrong.error.kind === "refused" && wrong.error.reason === "unsupported-expectation");
      const w2 = await s.cas.write(p("a"), bytes("sha"), expectAny);
      assert(w2.kind === "ok");
      const wrong2 = await s.cas.write(p("a"), bytes("x"), expectRev(w.value.rev));
      assert(wrong2.kind === "err" && wrong2.error.kind === "refused" && wrong2.error.reason === "unsupported-expectation");
    }
  } finally {
    await f.stop();
  }
});

proves(["0002-anyfs-s3-store FR-010"], "of writers that race to make one object, or to replace one revision, exactly one wins and the others conflict, with what the object is at, on both servers", async (t) => {
  await onServers(
    async (server, label) => {
      const bucket = await fresh(server, "race");
      const o = await writableOn(server, bucket, "r");
      assertEquals(o.mode, "cas", label);
      const cas = o.cas;
      if (cas === undefined) return;
      const made = await Promise.all(Array.from({ length: 12 }, (_, i) => o.store.write(p("one"), bytes(`w${i}`), expectAbsent)));
      const won = made.flatMap((r, i) => (r.kind === "ok" ? [i] : []));
      assertEquals(won.length, 1, label);
      for (const r of made) if (r.kind === "err") assertEquals(r.error.kind, "conflict");
      const first = made[won[0] ?? 0];
      assert(first !== undefined && first.kind === "ok");
      const replaced = await Promise.all(Array.from({ length: 12 }, (_, i) => cas.write(p("one"), bytes(`v${i}`), expectRev(first.value.rev))));
      assertEquals(replaced.filter((r) => r.kind === "ok").length, 1, label);
      const loser = replaced.find((r) => r.kind === "err");
      assert(loser !== undefined && loser.kind === "err" && loser.error.kind === "conflict" && loser.error.found.kind === "rev");
    },
    (reason) => t.skip(reason),
  );
});

proves(["0002-anyfs-s3-store FR-011"], "a delete that expects a revision removes the object only at it, and a delete of a missing object succeeds, on both servers", async (t) => {
  await onServers(
    async (server) => {
      const bucket = await fresh(server, "del");
      const o = await writableOn(server, bucket, "d");
      const cas = o.cas;
      if (cas === undefined) throw new Error("a store with cas was expected");
      const a = await cas.write(p("x"), bytes("1"), expectAny);
      const b = await cas.write(p("x"), bytes("2"), expectAny);
      assert(a.kind === "ok" && b.kind === "ok");
      const stale = await cas.delete(p("x"), expectRev(a.value.rev));
      assert(stale.kind === "err" && stale.error.kind === "conflict");
      assertEquals((await cas.read(p("x"))).kind, "ok");
      assertEquals(await cas.delete(p("x"), expectRev(b.value.rev)), { kind: "ok", value: { existed: true } });
      assertEquals(await cas.delete(p("x"), expectAny), { kind: "ok", value: { existed: false } });
      const gone = await cas.delete(p("x"), expectRev(b.value.rev));
      assert(gone.kind === "err" && gone.error.kind === "conflict" && gone.error.found.kind === "absent");
    },
    (reason) => t.skip(reason),
  );
});

proves(["0002-anyfs-s3-store FR-012"], "names with spaces, plus signs, percent signs, ampersands, equals signs, hashes, question marks and non-ASCII text are held, listed and read back as they were written, on both servers", async (t) => {
  await onServers(
    async (server) => {
      const bucket = await fresh(server, "names");
      const o = await writableOn(server, bucket, "n");
      const names = ["a b", "plus+sign", "100%", "a&b=c", "h#ash", "q?uestion", "dir with space/é", "日本語/ファイル", "emoji/😀", "x/semi;colon", "tilde~dot.dash-under_score", "(paren)/[bracket]/{brace}", "star*bang!tick'"];
      for (const n of names) assert((await o.store.write(p(n), bytes(n), expectAny)).kind === "ok", n);
      const listed = await o.store.list(ROOT);
      assert(listed.kind === "ok");
      assertEquals(listed.value.entries.map((e) => e.path).sort(), names.map(p).sort());
      for (const n of names) {
        const r = await o.store.read(p(n));
        assert(r.kind === "ok" && text(r.value.bytes) === n, n);
      }
    },
    (reason) => t.skip(reason),
  );
});

proves(["0002-anyfs-s3-store FR-012"], "a list of more than a thousand objects is given in pages of any size in the order of the paths, the whole of it once, with a cursor until the last page, on both servers", async (t) => {
  await onServers(
    async (server) => {
      const bucket = await fresh(server, "many");
      const o = await writableOn(server, bucket, "m");
      const names = Array.from({ length: 1105 }, (_, i) => `k/${String(i).padStart(5, "0")}`);
      for (let i = 0; i < names.length; i += 50) await Promise.all(names.slice(i, i + 50).map((n) => o.store.write(p(n), bytes(n), expectAny)));
      for (const limit of [1000, 333]) {
        const seen: string[] = [];
        let after;
        let pages = 0;
        for (;;) {
          const page = await o.store.list(ROOT, after === undefined ? { limit } : { limit, after });
          assert(page.kind === "ok");
          assert(page.value.entries.length <= limit);
          seen.push(...page.value.entries.map((e) => e.path));
          pages++;
          if (page.value.next === undefined) break;
          assertEquals(page.value.entries.length, limit, "a page with a cursor is full");
          after = page.value.next;
        }
        assertEquals(seen, names, `limit ${limit}`);
        assertEquals(pages, Math.ceil(names.length / limit), `pages at ${limit}`);
      }
      const k = parsePrefix("k");
      assert(k.kind === "ok");
      const prefixed = await o.store.list(k.value, { limit: 5 });
      assert(prefixed.kind === "ok" && prefixed.value.entries.length === 5);
    },
    (reason) => t.skip(reason),
  );
});

proves(["0002-anyfs-s3-store FR-012"], "keys that are no path of the store are not listed and not readable: another prefix that begins the same, a name the store keeps, text not in normalization form C", async (t) => {
  await onServers(
    async (server) => {
      const bucket = await fresh(server, "keys");
      const o = await writableOn(server, bucket, "p");
      const other = await writableOn(server, bucket, "p2");
      assert((await other.store.write(p("stranger"), bytes("not ours"), expectAny)).kind === "ok");
      await o.client.send({ method: "PUT", key: "p/.anyfs-secret", body: bytes("ours alone") });
      await o.client.send({ method: "PUT", key: "p/é", body: bytes("decomposed") });
      await o.client.send({ method: "PUT", key: "p/fine", body: bytes("fine") });
      const listed = await o.store.list(ROOT);
      assert(listed.kind === "ok");
      assertEquals(listed.value.entries.map((e) => e.path), ["fine"]);
      const own = await o.store.read(p(".anyfs-secret"));
      assert(own.kind === "err" && own.error.kind === "refused" && own.error.reason === "unportable-path");
      assertEquals((await o.store.read(p("stranger"))).kind, "err");
    },
    (reason) => t.skip(reason),
  );
});

proves(["0002-anyfs-s3-store FR-013"], "a connection that fails during an operation is a problem worth a retry, and an object larger than the store takes is refused before anything is sent", async () => {
  const { server, fake: f } = await fake();
  try {
    const bucket = await fresh(server, "lost");
    let down = false;
    const o = await writableOn(server, bucket, "l", {
      maxBytes: 8,
      transport: async (request, options) => {
        if (down) return { kind: "err", error: "the connection failed: down" };
        const live = await import("../src/mod.ts");
        return live.fetchTransport()(request, options);
      },
    });
    assert((await o.store.write(p("a"), bytes("ok"), expectAny)).kind === "ok");
    down = true;
    const r = await o.store.read(p("a"));
    assert(r.kind === "err" && r.error.kind === "unavailable" && r.error.retryable);
    const before = f.seen.length;
    const big = await o.store.write(p("b"), bytes("123456789"), expectAny);
    assert(big.kind === "err" && big.error.kind === "refused" && big.error.reason === "too-large");
    assertEquals(f.seen.length, before, "nothing was sent for it");
  } finally {
    await f.stop();
  }
});

proves(["0002-anyfs-s3-store FR-013"], "a request the service throttles ends as a problem worth a retry, and the layer of retries makes the same request succeed once the service lets it", async () => {
  const { server, fake: f } = await fake();
  try {
    const bucket = await fresh(server, "slow");
    const o = await writableOn(server, bucket, "s");
    assert((await o.store.write(p("a"), bytes("kept"), expectAny)).kind === "ok");
    f.failNext(503, "SlowDown", 1);
    const first = await o.store.read(p("a"));
    assert(first.kind === "err" && first.error.kind === "unavailable" && first.error.retryable);
    f.failNext(503, "SlowDown", 2);
    const retried = retrying(o.store, { attempts: 4, baseMs: 1, maxMs: 4 }, { sleep: async () => undefined });
    const again = await retried.read(p("a"));
    assert(again.kind === "ok" && text(again.value.bytes) === "kept");
  } finally {
    await f.stop();
  }
});
