/**
 * Tests of `http-client`: a client against a real local server (credentials refused unless allowed, read-only, backoff with `Retry-After`,
 * typed failures, both kinds of paging, recorded exchanges).
 *
 * @module
 */
import { array, integer, nullable, object, string } from "@intellectual-frontiers/core";
import { sign } from "@intellectual-frontiers/crypto/sigv4";
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
  type ReadPost,
  recordedText,
  recordedTransport,
  withBackoff,
  withSigV4,
} from "../src/http-client.ts";
import { serve, type ServeHandler } from "../src/serve.ts";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";

const CLIENT = "0001-net FR-003";

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

proves(["0001-net FR-004"], "read-only lets through the POSTs its predicate says only read, and refuses every other write", async () => {
  const sent: string[] = [];
  await withServer(
    async (req) => {
      sent.push(`${req.method} ${new URL(req.url).pathname} ${await req.text()}`);
      return Response.json({ data: {} });
    },
    async (base) => {
      // a GraphQL query reads; a mutation writes; an AWS-style JSON API names its action in a header
      const readPost: ReadPost = (r) =>
        (r.url === `${base}/graphql` && /^\s*(query\b|\{)/.test(r.body ?? "")) ||
        (r.url === `${base}/` && /^Service\.(Describe|Get|List)[A-Za-z]+$/.test(r.headers["x-amz-target"] ?? ""));
      const ro = readOnly(liveTransport(), [], readPost);
      const post = (url: string, body: string, headers: Readonly<Record<string, string>> = {}) =>
        ro.send({ method: "POST", url, headers, body });
      assertEquals((await post(`${base}/graphql`, "query { viewer { login } }")).kind, "ok");
      assertEquals((await post(`${base}/graphql`, "{ viewer { login } }")).kind, "ok");
      const mutation = await post(`${base}/graphql`, "mutation { deleteRepository }");
      assert(mutation.kind === "err" && mutation.error.kind === "refused" && mutation.error.message.startsWith("read-only: POST"));
      assertEquals((await post(`${base}/`, "{}", { "x-amz-target": "Service.DescribeTrails" })).kind, "ok");
      assertEquals((await post(`${base}/`, "{}", { "x-amz-target": "Service.DeleteTrail" })).kind, "err");
      for (const method of ["PUT", "PATCH", "DELETE"] as const) {
        assertEquals((await ro.send({ method, url: `${base}/graphql`, headers: {}, body: "query { x }" })).kind, "err", method);
      }
      assertEquals(sent, ["POST /graphql query { viewer { login } }", "POST /graphql { viewer { login } }", "POST / {}"]);
    },
  );
});

proves(
  ["0001-net FR-005", CLIENT],
  "a SigV4 transport signs each request as it is sent, and the live transport refuses it unless allowed",
  async () => {
    const seen: { authorization: string | null; date: string | null; token: string | null }[] = [];
    await withServer(
      (req) => {
        seen.push({
          authorization: req.headers.get("authorization"),
          date: req.headers.get("x-amz-date"),
          token: req.headers.get("x-amz-security-token"),
        });
        return Response.json({ id: 1 });
      },
      async (base) => {
        const credentials = {
          accessKeyId: "AKIDEXAMPLE",
          secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
          sessionToken: "session",
        };
        const at = new Date("2015-08-30T12:36:00Z");
        const options = { credentials, region: "us-east-1", service: "service", now: () => at };
        const refused = await withSigV4(liveTransport(), options).send({ method: "GET", url: `${base}/a?b=1`, headers: {} });
        assert(refused.kind === "err" && refused.error.kind === "refused" && refused.error.message.includes("authorization"));
        assert(refused.kind === "err" && !refused.error.message.includes("Signature="), "the credential is never said");
        assertEquals(seen.length, 0);
        const live = withSigV4(liveTransport({ credentials: "allow" }), options);
        assertEquals(await getJson(live, `${base}/a?b=1`, item), { kind: "ok", value: { id: 1 } });
        const expected = await sign(
          { method: "GET", url: `${base}/a?b=1`, headers: { accept: "application/json" } },
          { credentials, region: "us-east-1", service: "service", date: at },
        );
        assertEquals(seen, [{ authorization: expected.authorization, date: "20150830T123600Z", token: "session" }]);
      },
    );
  },
);

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
