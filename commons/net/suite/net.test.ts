/**
 * Tests of `serve` and `net`: a real server on a free local port answers web requests; downloads are retried only where another try can help,
 * resumed, and kept only where their SHA-256 is the one expected.
 *
 * @module
 */
import { type Sha256, sha256 } from "@intellectual-frontiers/crypto/sha256";
import { errors } from "@intellectual-frontiers/system/errors";
import { exists, readTextFile, withTempDir, writeTextFile } from "@intellectual-frontiers/system/fs";
import {
  classify,
  describeFailure,
  downloadVerified,
  fetchOnce,
  fetchTo,
  hostOf,
  type NetFailure,
  reach,
  Retries,
  retryable,
} from "../src/net.ts";
import { join } from "@intellectual-frontiers/system/path";
import { serve, type ServeHandler } from "../src/serve.ts";
import { assert, assertEquals, assertRejects, assertStringIncludes, proves } from "@intellectual-frontiers/commons/ts/runtime/test";

const SERVE = "0001-net FR-002";
const NET = "0001-net FR-001";

async function withServer(handler: ServeHandler, f: (base: string) => Promise<void>): Promise<void> {
  const server = await serve({ port: 0 }, handler);
  try {
    await f(`http://127.0.0.1:${server.addr.port}`);
  } finally {
    await server.shutdown();
  }
}

proves([SERVE], "a handler of web Requests answers with web Responses: method, path, headers, cookies, streamed bodies, HEAD", async () => {
  await withServer(
    async (req, info) => {
      const url = new URL(req.url);
      if (url.pathname === "/echo")
        return new Response(`${req.method} ${await req.text()} ${req.headers.get("x-a")}`, { headers: { "x-b": "2" } });
      if (url.pathname === "/cookies") {
        const h = new Headers();
        h.append("set-cookie", "a=1");
        h.append("set-cookie", "b=2");
        return new Response(null, { status: 204, headers: h });
      }
      if (url.pathname === "/stream") {
        const body = new ReadableStream<Uint8Array>({
          start(c) {
            for (let i = 0; i < 3; i++) c.enqueue(new TextEncoder().encode(`chunk${i};`));
            c.close();
          },
        });
        return new Response(body);
      }
      if (url.pathname === "/throw") throw new Error("boom");
      return new Response(`${url.pathname}${url.search} from ${info.remoteAddr.hostname}`, { status: 404 });
    },
    async (base) => {
      const r = await fetch(`${base}/echo`, { method: "POST", body: "payload", headers: { "x-a": "1" } });
      assertEquals([r.status, await r.text(), r.headers.get("x-b")], [200, "POST payload 1", "2"]);
      const c = await fetch(`${base}/cookies`);
      assertEquals([c.status, c.headers.getSetCookie()], [204, ["a=1", "b=2"]]);
      assertEquals(await (await fetch(`${base}/stream`)).text(), "chunk0;chunk1;chunk2;");
      const t = await fetch(`${base}/throw`);
      assertEquals([t.status, await t.text()], [500, "internal server error"]);
      const n = await fetch(`${base}/x?y=1`);
      assertEquals(n.status, 404);
      assertStringIncludes(await n.text(), "/x?y=1 from ");
      const h = await fetch(`${base}/echo`, { method: "HEAD" });
      assertEquals([h.status, await h.text()], [200, ""]);
    },
  );
});

proves([SERVE], "a port in use is AddrInUse; an aborted signal shuts the server down", async () => {
  const ctl = new AbortController();
  const server = await serve({ port: 0, signal: ctl.signal }, () => new Response("ok"));
  await assertRejects(() => serve({ port: server.addr.port }, () => new Response("")), errors.AddrInUse);
  ctl.abort();
  await server.finished;
  await assertRejects(() => fetch(`http://127.0.0.1:${server.addr.port}/`));
});

proves([NET], "failures are classified by code and by words, and only those another try can help are retried", () => {
  const withCause = (code: string): Error => new TypeError("fetch failed", { cause: Object.assign(new Error(code), { code }) });
  assertEquals(classify(withCause("ENOTFOUND")), { kind: "dns" });
  assertEquals(classify(withCause("ECONNREFUSED")), { kind: "connect" });
  assertEquals(classify(withCause("ECONNRESET")), { kind: "broken" });
  assertEquals(classify(withCause("CERT_HAS_EXPIRED")), { kind: "certificate" });
  assertEquals(classify(withCause("UND_ERR_CONNECT_TIMEOUT")), { kind: "timeout" });
  assertEquals(classify(new DOMException("x", "TimeoutError")), { kind: "timeout" });
  assertEquals(classify(new Error("error trying to connect: dns error: failed to lookup address")), { kind: "dns" });
  assertEquals(classify(new Error("invalid peer certificate: UnknownIssuer")), { kind: "certificate" });
  assertEquals(classify(new Error("strange")), { kind: "other", message: "strange" });
  const all: NetFailure[] = [
    { kind: "dns" },
    { kind: "connect" },
    { kind: "broken" },
    { kind: "timeout" },
    { kind: "tls" },
    { kind: "certificate" },
    { kind: "http", status: 503 },
    { kind: "http", status: 416 },
    { kind: "http", status: 404 },
    { kind: "other", message: "m" },
  ];
  assertEquals(all.map(retryable), [true, true, true, true, true, false, true, true, false, false]);
  for (const f of all) assert(describeFailure(f) !== "");
  assertEquals(hostOf("https://example.com:8443/a"), "example.com:8443");
  assertEquals(hostOf("not a url"), "not a url");
});

proves([NET], "the wait doubles from the base up to the cap, and the retries are said and counted", async () => {
  const said: string[] = [];
  const r = new Retries(
    { tries: 6, base: 2, cap: 10 },
    (l) => said.push(l),
    () => 0,
    async () => {},
  );
  assertEquals(
    [1, 2, 3, 4, 5].map((n) => r.wait(n)),
    [2, 4, 8, 10, 10],
  );
  await r.again("a.example", "busy", 1);
  await r.again("b.example", "busy", 1);
  await r.again("a.example", "busy", 2);
  await r.again("c.example", "busy", 1, 99);
  assertStringIncludes(said[3] ?? "", "trying again in 10s");
  assertEquals(r.top(), "a.example (2), b.example (1), c.example (1)");
  assertEquals(said[0], "a.example: busy; trying again in 2s (attempt 2 of 6)");
});

proves([NET], "a download is retried where the server is busy, not where it refuses, and kept only with the expected SHA-256", async () => {
  const body = new TextEncoder().encode("the pinned tool");
  const sum: Sha256 = await sha256(body);
  let hits = 0;
  await withServer(
    (req) => {
      const path = new URL(req.url).pathname;
      if (path === "/busy-then-ok")
        return ++hits < 3 ? new Response("busy", { status: 503, headers: hits === 2 ? { "retry-after": "1" } : {} }) : new Response(body);
      if (path === "/ok") return new Response(body);
      return new Response("no", { status: 404 });
    },
    async (base) => {
      await withTempDir(async (cache) => {
        const said: string[] = [];
        const retries = new Retries(
          { tries: 5, base: 1, cap: 1 },
          (l) => said.push(l),
          () => 0,
          async () => {},
        );
        const got = await downloadVerified(retries, `${base}/busy-then-ok`, sum, cache);
        assertEquals(got, { kind: "ok", value: join(cache, "downloads", sum) });
        assertEquals([hits, said.length], [3, 2]);
        assertStringIncludes(said[1] ?? "", "trying again in 1s");
        assertEquals(await downloadVerified(retries, `${base}/nothing-fetched-again`, sum, cache), got);
        const wrong = await sha256("other");
        const bad = await downloadVerified(retries, `${base}/ok`, wrong, cache);
        assert(bad.kind === "err");
        assertStringIncludes(bad.error, "not the one expected");
        assert(!(await exists(join(cache, "downloads", `${wrong}.part`))) && !(await exists(join(cache, "downloads", wrong))));
        const missing = await fetchTo(retries, `${base}/missing`, join(cache, "m"));
        assertEquals(missing, { kind: "err", error: `127.0.0.1:${new URL(base).port}: the server answered 404 (after 1 of 5 attempts)` });
        const closed = await serve({ port: 0 }, () => new Response(""));
        await closed.shutdown();
        const unreachable = await fetchTo(
          new Retries(
            { tries: 2, base: 0, cap: 0 },
            () => {},
            () => 0,
            async () => {},
          ),
          `http://127.0.0.1:${closed.addr.port}/x`,
          join(cache, "u"),
        );
        assert(unreachable.kind === "err" && unreachable.error.includes("after 2 of 2"), JSON.stringify(unreachable));
        assertEquals((await reach(retries, `127.0.0.1:${new URL(base).port}`, "http")).kind, "ok");
      });
    },
  );
});

proves([NET], "a .part file is resumed with a Range request", async () => {
  const whole = "0123456789";
  let range: string | null = null;
  await withServer(
    (req) => {
      range = req.headers.get("range");
      const from = range === null ? 0 : Number(/bytes=(\d+)-/.exec(range)?.[1] ?? 0);
      return new Response(whole.slice(from), { status: range === null ? 200 : 206 });
    },
    async (base) => {
      await withTempDir(async (dir) => {
        const part = join(dir, "f.part");
        await writeTextFile(part, "01234");
        assertEquals(await fetchOnce(`${base}/f`, part), { kind: "ok", value: undefined });
        assertEquals([range, await readTextFile(part)], ["bytes=5-", whole]);
      });
    },
  );
});
