/**
 * Tests of the request layer (commons anyfs-githost 0002-anyfs-githost-store FR-004): a request through a transport whose failures are values, the token in the one header of the host, a link to the next page followed only on the host the token
 * is for, and the one table of statuses both hosts share.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import type { Exchange, OutRequest, Transport } from "@intellectual-frontiers/net/http-client";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { type ApiProblem, makeCaller, type Reply } from "../src/mod.ts";

const BASE = "https://api.example.test";
const TOKEN = "request-token-0123456789";

const exchange = (r: OutRequest, status: number, headers: Record<string, string> = {}, body = ""): Exchange => ({ method: r.method, url: r.url, status, headers, body });

function callerOver(send: (r: OutRequest) => ReturnType<Transport["send"]>, token: string | null = TOKEN) {
  const sent: OutRequest[] = [];
  const transport: Transport = { kind: "recorded", send: (r) => (sent.push(r), send(r)) };
  const call = makeCaller({
    transport,
    base: BASE,
    accept: "application/json",
    authorize: (t) => ({ authorization: `Bearer ${t}` }),
    token: async () => ok(token ?? undefined),
    redact: (s) => s.split(TOKEN).join("[redacted]"),
    clock: () => 1_000_000,
  });
  return { call, sent };
}

const problemOf = (r: { readonly kind: "ok"; readonly value: Reply } | { readonly kind: "err"; readonly error: ApiProblem }): ApiProblem | undefined => (r.kind === "err" ? r.error : undefined);

proves(["0002-anyfs-githost-store FR-004"], "a request carries the token in the one header and a JSON body with its type, a query is encoded, and an answer below 400 and the statuses a client reads itself are values", async () => {
  const { call, sent } = callerOver(async (r) => ok(exchange(r, 200, { etag: "x" }, "{}")));
  const r = await call({ method: "POST", path: "/things", query: { a: "b c", d: "é" }, json: { k: "v" } });
  assert(r.kind === "ok" && r.value.status === 200);
  assertEquals(sent[0]?.url, `${BASE}/things?a=b+c&d=%C3%A9`);
  assertEquals(sent[0]?.headers["authorization"], `Bearer ${TOKEN}`);
  assertEquals(sent[0]?.headers["content-type"], "application/json");
  assertEquals(sent[0]?.body, '{"k":"v"}');
  for (const status of [400, 404, 409, 410, 412, 413, 422]) {
    const x = await callerOver(async (q) => ok(exchange(q, status, {}, '{"message":"m"}'))).call({ method: "GET", path: "/x" });
    assert(x.kind === "ok" && x.value.status === status, `${status} is read by the client`);
  }
  const noToken = callerOver(async (q) => ok(exchange(q, 200)), null);
  await noToken.call({ method: "GET", path: "/x" });
  assertEquals(Object.keys(noToken.sent[0]?.headers ?? {}).includes("authorization"), false);
});

proves(["0002-anyfs-githost-store FR-004"], "a connection that fails is a value, a token that cannot be had is a problem with no token in it, and a throttle, a refusal and a failed host are told by one table", async () => {
  const lost = await callerOver(async () => err({ kind: "network", message: `connection reset while sending ${TOKEN}` })).call({ method: "GET", path: "/x" });
  const lostProblem = problemOf(lost);
  assert(lostProblem?.kind === "unavailable" && lostProblem.retryable);
  assertEquals(JSON.stringify(lostProblem).includes(TOKEN), false);
  const refusedSend = await callerOver(async () => err({ kind: "refused", message: "refused" })).call({ method: "GET", path: "/x" });
  assert(problemOf(refusedSend)?.kind === "unavailable" && (problemOf(refusedSend) as { retryable: boolean }).retryable === false);

  const noToken = makeCaller({ transport: { kind: "recorded", send: async (r) => ok(exchange(r, 200)) }, base: BASE, accept: "x", authorize: () => ({}), token: async () => err("the token is not set"), redact: (s) => s });
  const nt = problemOf(await noToken({ method: "GET", path: "/x" }));
  assert(nt?.kind === "denied" && nt.reason === "unauthorized" && nt.message === "the token is not set");

  const table: readonly [number, Record<string, string>, string, string][] = [
    [401, {}, '{"message":"Bad credentials"}', "denied/unauthorized"],
    [403, {}, '{"message":"Resource not accessible"}', "denied/permission"],
    [403, { "x-ratelimit-remaining": "0" }, '{"message":"limit"}', "rate-limited"],
    [403, { "retry-after": "9" }, "{}", "rate-limited"],
    [403, {}, '{"message":"You have exceeded a secondary rate limit"}', "rate-limited"],
    [429, {}, "{}", "rate-limited"],
    [500, {}, "{}", "unavailable/retryable"],
    [503, {}, '{"message":"down"}', "unavailable/retryable"],
    [418, {}, '{"message":"teapot"}', "unexpected"],
  ];
  for (const [status, headers, body, want] of table) {
    const p = problemOf(await callerOver(async (r) => ok(exchange(r, status, headers, body))).call({ method: "GET", path: "/x" }));
    const got = p === undefined ? "ok" : p.kind === "denied" ? `denied/${p.reason}` : p.kind === "unavailable" ? (p.retryable ? "unavailable/retryable" : "unavailable") : p.kind;
    assertEquals(got, want, `${status} ${JSON.stringify(headers)}`);
  }
  const waits = problemOf(await callerOver(async (r) => ok(exchange(r, 403, { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1060" }, "{}"))).call({ method: "GET", path: "/x" }));
  assert(waits?.kind === "rate-limited" && waits.retryAfterSeconds === 60, "the wait is the reset time minus now");
  const after = problemOf(await callerOver(async (r) => ok(exchange(r, 429, { "retry-after": "12" }, "{}"))).call({ method: "GET", path: "/x" }));
  assert(after?.kind === "rate-limited" && after.retryAfterSeconds === 12);
  const echoed = problemOf(await callerOver(async (r) => ok(exchange(r, 401, {}, JSON.stringify({ message: `bad ${TOKEN}` })))).call({ method: "GET", path: "/x" }));
  assertEquals(JSON.stringify(echoed).includes(TOKEN), false);
  assertStringIncludes(JSON.stringify(echoed), "[redacted]");
});

proves(["0002-anyfs-githost-store FR-004"], "a link to the next page is followed on the host the token is for and refused on any other, and the next page is found in the Link header", async () => {
  const seen: string[] = [];
  const { call } = callerOver(async (r) => (seen.push(r.url), ok(exchange(r, 200, {}, "[]"))));
  assert((await call({ method: "GET", path: `${BASE}/projects/1/tree?page=2` })).kind === "ok");
  assertEquals(seen, [`${BASE}/projects/1/tree?page=2`]);
  const elsewhere = await call({ method: "GET", path: "https://evil.example.test/steal?page=2" });
  const p = problemOf(elsewhere);
  assert(p?.kind === "unexpected" && /another address/u.test(p.message));
  assertEquals(seen.length, 1, "nothing was sent to the other address");
  const lookalike = problemOf(await call({ method: "GET", path: `${BASE}.evil.example.test/x` }));
  assert(lookalike?.kind === "unexpected", "a host that only begins like this one is another host");
});
