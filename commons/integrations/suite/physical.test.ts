/**
 * Tests of the physical adapters (commons integrations 0004-integrations-physical FR-001 to FR-006): the read port over a transport that is read-only, backs off, pages
 * and names no query; the digest; HTTPS delivery; the token request of backend services; MLLP framing. A transport here is a recorder, never a network.
 *
 * @module
 */
import fc from "fast-check";
import { err, ok } from "@intellectual-frontiers/core";
import { readOnly, type Exchange, type OutRequest, type Transport } from "@intellectual-frontiers/net/http-client";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { httpReadPort, sha256Of } from "../src/physical/http/mod.ts";
import { backendServicesForm, httpsTransport, mllpFrame, mllpUnframe, requestToken, type AssertionClaims } from "../src/physical/transport/mod.ts";
import { secretOf, type Json } from "../src/logical/mod.ts";
import { must } from "./world.ts";

type Recorder = Transport & { readonly sent: OutRequest[] };

/** A transport that records what it is sent and answers from a list of answers, in order, the last one repeating. */
function recorder(answers: readonly Partial<Exchange>[]): Recorder {
  const sent: OutRequest[] = [];
  return {
    kind: "recorded",
    sent,
    send: (r) => {
      sent.push(r);
      const a = answers[Math.min(sent.length - 1, answers.length - 1)] ?? {};
      return Promise.resolve(ok({ method: r.method, url: r.url, status: 200, headers: {}, body: "{}", ...a }));
    },
  };
}

const port = (t: Transport, extra: Partial<Parameters<typeof httpReadPort>[0]> = {}) =>
  httpReadPort({ transport: t, base: "https://api.sample.test", auth: { kind: "bearer", secret: secretOf("tok-secret-value"), scheme: "Bearer" }, pause: () => Promise.resolve(), ...extra });

async function collect(g: AsyncGenerator<Json, unknown>): Promise<Json[]> {
  const out: Json[] = [];
  for (;;) {
    const n = await g.next();
    if (n.done === true) return out;
    out.push(n.value);
  }
}

proves(["0004-integrations-physical FR-001"], "a write is refused by the guard and never reaches the transport; reads back off and are authorized", async () => {
  const t = recorder([{ status: 429, headers: { "retry-after": "0" } }, { status: 200, body: '{"login":"acme"}' }]);
  const r = must(await port(t).get("/me"));
  assertEquals(r, { login: "acme" });
  assertEquals(t.sent.map((s) => s.method), ["GET", "GET"]);
  assertEquals(t.sent[0]?.headers["authorization"], "Bearer tok-secret-value");
  const guarded = readOnly(t, ["https://api.sample.test/token"]);
  const before = t.sent.length;
  for (const method of ["DELETE", "PUT", "PATCH", "POST"] as const) {
    const refused = await guarded.send({ method, url: "https://api.sample.test/repos/1", headers: {} });
    assertEquals(refused.kind, "err");
  }
  assertEquals((await guarded.send({ method: "POST", url: "https://api.sample.test/token", headers: {} })).kind, "ok");
  assertEquals(t.sent.length, before + 1, "only the token endpoint got through");
});

proves(["0004-integrations-physical FR-002"], "pages by Link and by cursor, and failures name the path only", async () => {
  const linked = recorder([
    { body: '[{"n":1},{"n":2}]', headers: { link: '<https://api.sample.test/repos?page=2>; rel="next"' } },
    { body: '[{"n":3}]' },
  ]);
  assertEquals((await collect(port(linked).pages("/repos"))).length, 3);
  assertEquals(linked.sent.map((s) => s.url), ["https://api.sample.test/repos", "https://api.sample.test/repos?page=2"]);
  const cursor = recorder([{ body: '{"items":[1,2],"next":"/c?after=2"}' }, { body: '{"items":[3]}' }]);
  const items = await collect(
    port(cursor, {
      paging: { kind: "cursor", items: (b) => (typeof b === "object" && b !== null && "items" in b && Array.isArray(b["items"]) ? b["items"] : []), next: (b) => (typeof b === "object" && b !== null && "next" in b && typeof b["next"] === "string" ? `https://api.sample.test${b["next"]}` : undefined) },
    }).pages("/c"),
  );
  assertEquals(items, [1, 2, 3]);
  for (const [status, kind] of [[401, "denied"], [403, "denied"], [404, "not-found"], [429, "rate-limited"], [500, "server"]] as const) {
    const f = await port(recorder([{ status }]), { pause: () => Promise.resolve() }).get("/x?access_token=hunter2");
    assert(f.kind === "err" && f.error.kind === kind, `${status}`);
    assert(!JSON.stringify(f).includes("hunter2"), "the query is not said");
  }
  const bad = await port(recorder([{ body: "not json" }])).get("/x");
  assert(bad.kind === "err" && bad.error.kind === "decode");
  const net = await port({ kind: "live", send: () => Promise.resolve(err({ kind: "network", message: "secret host unreachable" })) }).get("/x");
  assert(net.kind === "err" && net.error.kind === "network" && !JSON.stringify(net).includes("secret host"));
  const failed = port(recorder([{ status: 500 }]));
  const g = failed.pages("/p");
  const end = await g.next();
  assert(end.done === true && end.value.kind === "err");
});

proves(["0004-integrations-physical FR-003"], "the digest of a known text", async () => {
  assertEquals(must(await sha256Of("abc")), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

proves(["0004-integrations-physical FR-004"], "a delivery, and a rejection with its status only", async () => {
  const ok200 = recorder([{ status: 202, body: "accepted-body" }]);
  const d = must(await httpsTransport(ok200, "https://partner.example.test/in", secretOf("bearer-secret")).send({ contentType: "application/fhir+json", body: "{}" }));
  assertEquals(d.status, 202);
  assertEquals(ok200.sent[0]?.method, "POST");
  assertEquals(ok200.sent[0]?.headers["authorization"], "Bearer bearer-secret");
  const rej = await httpsTransport(recorder([{ status: 422, body: "patient Zyxwvut is invalid" }]), "https://partner.example.test/in", secretOf("x")).send({ contentType: "text/plain", body: "" });
  assert(rej.kind === "err" && rej.error.kind === "rejected" && rej.error.status === 422);
  assert(!JSON.stringify(rej).includes("Zyxwvut"));
  const down = await httpsTransport({ kind: "live", send: () => Promise.resolve(err({ kind: "network", message: "x" })) }, "https://p.example.test", secretOf("x")).send({ contentType: "text/plain", body: "" });
  assert(down.kind === "err" && down.error.kind === "network");
});

const claims: AssertionClaims = { iss: "client-1", sub: "client-1", aud: "https://auth.example.test/token", jti: "j-1", exp: 1_800_000_000 };

proves(["0004-integrations-physical FR-005"], "the token form and the failures", async () => {
  const form = backendServicesForm(secretOf("signed.jwt.value"), "system/*.read");
  assertEquals(new URLSearchParams(form).get("grant_type"), "client_credentials");
  assertEquals(new URLSearchParams(form).get("client_assertion_type"), "urn:ietf:params:oauth:client-assertion-type:jwt-bearer");
  assertEquals(new URLSearchParams(form).get("client_assertion"), "signed.jwt.value");
  assertEquals(new URLSearchParams(form).get("scope"), "system/*.read");
  const signer = { sign: () => Promise.resolve(ok(secretOf("signed.jwt.value"))) };
  const t = recorder([{ body: '{"access_token":"at-123","token_type":"bearer"}' }]);
  const token = must(await requestToken(t, "https://auth.example.test/token", signer, claims, "system/*.read"));
  assertEquals(token.reveal(), "at-123");
  assert(!JSON.stringify(token).includes("at-123"));
  assertEquals(t.sent[0]?.headers["content-type"], "application/x-www-form-urlencoded");
  const failure = async (answers: readonly Partial<Exchange>[]) => (await requestToken(recorder(answers), "https://auth.example.test/token", signer, claims, "s"));
  const rejected = await failure([{ status: 401 }]);
  assert(rejected.kind === "err" && rejected.error.kind === "rejected");
  const bad = await failure([{ body: '{"nope":1}' }]);
  assert(bad.kind === "err" && bad.error.kind === "malformed");
  const notJson = await failure([{ body: "x" }]);
  assert(notJson.kind === "err" && notJson.error.kind === "malformed");
  const nosign = await requestToken(t, "https://auth.example.test/token", { sign: () => Promise.resolve(err({ kind: "signing-failed" as const })) }, claims, "s");
  assert(nosign.kind === "err" && nosign.error.kind === "signing-failed");
});

proves(["0004-integrations-physical FR-006"], "frame and unframe round-trip (property)", () => {
  fc.assert(fc.property(fc.string().filter((s) => !s.includes("\u001c") && !s.includes("\u000b")), (m) => assertEquals(mllpUnframe(mllpFrame(m)), m)));
  assertEquals(mllpUnframe("MSH|^~\\&|"), undefined);
  assertEquals(mllpUnframe("\u000bMSH|\u001c"), undefined);
});
