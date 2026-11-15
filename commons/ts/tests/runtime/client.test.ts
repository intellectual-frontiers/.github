/**
 * Tests of `runtime/http-client.ts` and `runtime/lock.ts`: a client against a real local server (credentials refused unless allowed,
 * read-only, backoff with `Retry-After`, typed failures, both kinds of paging, recorded exchanges), and a lock taken, refused, waited for,
 * taken over from a holder that no longer runs, inherited and released.
 *
 * @module
 */
import { array, integer, nullable, object, string } from "../../kernel/decode.ts";
import { exists, readTextFile, withTempDir, writeTextFile } from "../../runtime/fs.ts";
import {
  bearer,
  carriesCredential,
  cursorPages,
  decodeRecorded,
  type Exchange,
  formatReadError,
  getJson,
  linkPages,
  liveTransport,
  readOnly,
  recordedText,
  recordedTransport,
  withBackoff,
} from "../../runtime/http-client.ts";
import { acquireLock, describeHolder, processRuns, readHolder } from "../../runtime/lock.ts";
import { join } from "../../runtime/path.ts";
import { serve, type ServeHandler } from "../../runtime/serve.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "../../runtime/test.ts";
import process from "node:process";

const CLIENT = "0005-typescript-runtime FR-040";
const LOCK = "0005-typescript-runtime FR-039";

async function withServer(handler: ServeHandler, f: (base: string) => Promise<void>): Promise<void> {
  const server = await serve({ port: 0 }, handler);
  try {
    await f(`http://127.0.0.1:${server.addr.port}`);
  } finally {
    await server.shutdown();
  }
}

const item = object({ id: integer });

proves([CLIENT], "a JSON read is decoded, a denial and a status are told apart, and no header or body is said", async () => {
  await withServer(
    (req) => {
      const p = new URL(req.url).pathname;
      if (p === "/ok") return Response.json({ id: 1, name: "a" });
      if (p === "/denied") return new Response("secret body", { status: 403 });
      if (p === "/bad") return Response.json({ id: "x" });
      return new Response("no", { status: 404 });
    },
    async (base) => {
      const t = liveTransport();
      assertEquals(await getJson(t, `${base}/ok`, item), { kind: "ok", value: { id: 1 } });
      const denied = await getJson(t, `${base}/denied`, item);
      assertEquals(denied, { kind: "err", error: { kind: "denied", status: 403, url: `${base}/denied` } });
      if (denied.kind === "err") assertEquals(formatReadError(denied.error), "/denied: 403 (the credential may not read this)");
      const missing = await getJson(t, `${base}/missing`, item);
      assertEquals(missing.kind === "err" ? formatReadError(missing.error) : "", "/missing: HTTP 404");
      const bad = await getJson(t, `${base}/bad`, item);
      assertEquals(bad.kind === "err" ? bad.error.kind : "", "decode");
      const down = await getJson(liveTransport({ timeoutSeconds: 5 }), "http://127.0.0.1:9/x", item);
      assertEquals(down.kind === "err" ? down.error.kind : "", "network");
    },
  );
});

proves([CLIENT], "a credential is refused before anything is sent unless the transport allows it; read-only refuses writes", async () => {
  let hits = 0;
  await withServer(
    (req) => {
      hits++;
      return Response.json({ id: req.headers.get("authorization") === "Bearer t0k3n" ? 2 : 1 });
    },
    async (base) => {
      const refusing = liveTransport();
      for (const h of ["Authorization", "Cookie", "X-Api-Key", "PRIVATE-TOKEN"]) {
        const r = await refusing.send({ method: "GET", url: `${base}/a`, headers: { [h]: "secret-value" } });
        assert(r.kind === "err" && r.error.kind === "refused" && !r.error.message.includes("secret-value"), h);
      }
      assert(carriesCredential({ method: "GET", url: `${base}/a?api_key=1`, headers: {} }) !== undefined);
      assertEquals(hits, 0);
      assertEquals(await getJson(liveTransport({ credentials: "allow" }), `${base}/a`, item, bearer("t0k3n")), {
        kind: "ok",
        value: { id: 2 },
      });
      const ro = readOnly(liveTransport(), [`${base}/token`]);
      const put = await ro.send({ method: "PUT", url: `${base}/a`, headers: {} });
      assert(put.kind === "err" && put.error.message.startsWith("read-only: PUT"));
      assertEquals((await ro.send({ method: "POST", url: `${base}/token`, headers: {} })).kind, "ok");
      assertEquals((await ro.send({ method: "POST", url: `${base}/other`, headers: {} })).kind, "err");
      assertEquals(hits, 2);
    },
  );
});

proves([CLIENT], "backoff waits as long as Retry-After asks, up to the cap, else 1, 2, 4 seconds, and gives the last answer", async () => {
  let hits = 0;
  await withServer(
    () => {
      hits++;
      if (hits === 1) return new Response("", { status: 429, headers: { "retry-after": "2" } });
      if (hits === 2) return new Response("", { status: 503, headers: { "retry-after": "999" } });
      if (hits === 3) return new Response("", { status: 503 });
      return Response.json({ id: hits });
    },
    async (base) => {
      const waits: number[] = [];
      const t = withBackoff(liveTransport(), { pause: (ms) => (waits.push(ms), Promise.resolve()), capMs: 30_000 });
      assertEquals(await getJson(t, `${base}/`, item), { kind: "ok", value: { id: 4 } });
      assertEquals(waits, [2000, 30_000, 4000]);
      hits = 1;
      const once = withBackoff(liveTransport(), { retries: 0, pause: () => Promise.resolve() });
      const r = await once.send({ method: "GET", url: `${base}/`, headers: {} });
      assertEquals(r.kind === "ok" ? r.value.status : 0, 503);
    },
  );
});

proves([CLIENT], "every item of a list paged by Link, and of one paged by a cursor", async () => {
  await withServer(
    (req) => {
      const url = new URL(req.url);
      const page = Number(url.searchParams.get("page") ?? "1");
      if (url.pathname === "/link") {
        const headers: Record<string, string> =
          page < 3 ? { link: `</link?page=${page + 1}>; rel="next", </link?page=3>; rel="last"` } : {};
        return Response.json([{ id: page * 10 }, { id: page * 10 + 1 }], { headers });
      }
      const after = url.searchParams.get("after");
      return Response.json(after === null ? { items: [{ id: 1 }], next: "x" } : { items: [{ id: 2 }], next: null });
    },
    async (base) => {
      const t = liveTransport();
      const got: number[] = [];
      const pages = linkPages(t, `${base}/link`, item);
      for (;;) {
        const n = await pages.next();
        if (n.done === true) {
          assertEquals(n.value, { kind: "ok", value: 3 });
          break;
        }
        got.push(n.value.id);
      }
      assertEquals(got, [10, 11, 20, 21, 30, 31]);
      const body = object({ items: array(item), next: nullable(string) });
      const ids: number[] = [];
      for await (const x of cursorPages(
        t,
        `${base}/cursor`,
        body,
        (b) => b.items,
        (b, u) => (b.next === null ? undefined : `${u.split("?")[0] ?? u}?after=${b.next}`),
      ))
        ids.push(x.id);
      assertEquals(ids, [1, 2]);
      const capped: number[] = [];
      for await (const x of linkPages(t, `${base}/link`, item, { maxPages: 1 })) capped.push(x.id);
      assertEquals(capped, [10, 11]);
    },
  );
});

proves([CLIENT], "a recorded transport answers what was recorded and names what it has not; a recording reads back", async () => {
  const x: Exchange = {
    method: "GET",
    url: "https://example.org/a",
    status: 200,
    headers: { "content-type": "application/json" },
    body: '{"id":7}',
  };
  const t = recordedTransport([x]);
  assertEquals(await getJson(t, x.url, item), { kind: "ok", value: { id: 7 } });
  const none = await t.send({ method: "GET", url: "https://example.org/b", headers: {} });
  assert(none.kind === "err" && none.error.message.includes("https://example.org/b"));
  const text = recordedText(x, "recorded for a test");
  assert(text.startsWith("// recorded for a test\n"));
  assertEquals(decodeRecorded(text), { kind: "ok", value: x });
  assertEquals(decodeRecorded("{").kind, "err");
  assertEquals(decodeRecorded('{method: "TRACE", url: "", status: 1, headers: {}, body: ""}').kind, "err");
});

proves([LOCK], "a lock is taken once, refused or waited for while held, and given back", async () => {
  await withTempDir(async (dir) => {
    const path = join(dir, "run.lock");
    const held = await acquireLock(path, { wait: false, command: "update" });
    assert(held !== undefined);
    const holder = await readHolder(path);
    assertEquals([holder?.pid, holder?.command], [process.pid, "update"]);
    assertStringIncludes(describeHolder(held.holder, Date.parse(held.holder.since) + 192_000), "update (pid ");
    assertStringIncludes(describeHolder(held.holder, Date.parse(held.holder.since) + 192_000), "for 3m 12s)");
    assertEquals(await acquireLock(path, { wait: false }), undefined);
    assertEquals(await acquireLock(path, { wait: true, pollMs: 10, timeoutMs: 50 }), undefined);
    let waitedFor = "";
    const waiting = acquireLock(path, { wait: true, pollMs: 10, onWait: (h) => (waitedFor = h?.command ?? "") });
    setTimeout(() => held.release(), 60);
    const second = await waiting;
    assert(second !== undefined);
    assertEquals(waitedFor, "update");
    second.release();
    second.release();
    assert(!(await exists(path)));
  });
});

proves([LOCK], "a lock whose holder no longer runs, or whose file is unreadable, is taken over; a child inherits it", async () => {
  await withTempDir(async (dir) => {
    const path = join(dir, "run.lock");
    let dead = 2_000_000;
    while (processRuns(dead)) dead++;
    await writeTextFile(path, JSON.stringify({ pid: dead, command: "gone", since: new Date().toISOString(), token: "t" }));
    const taken = await acquireLock(path, { wait: false });
    assert(taken !== undefined);
    assertStringIncludes(await readTextFile(path), taken.holder.token);
    taken.release();
    await writeTextFile(path, "not json");
    const again = await acquireLock(path, { wait: false, inheritEnv: "IFC_TS_TEST_LOCK" });
    assert(again !== undefined);
    assertEquals(process.env["IFC_TS_TEST_LOCK"], "1");
    const child = await acquireLock(path, { wait: false, inheritEnv: "IFC_TS_TEST_LOCK" });
    assert(child !== undefined);
    child.release();
    assert(await exists(path), "the inherited release leaves the parent's lock");
    again.release();
    assertEquals(process.env["IFC_TS_TEST_LOCK"], undefined);
    assert(processRuns(process.pid));
  });
});
