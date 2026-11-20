/**
 * Tests of `runtime/acme.ts`: a fake ACME server, written here as a `fetch` stub, that implements what RFC 8555 asks of a server for
 * DNS-01 (the directory, nonces it checks and spends, accounts by JWK and by `kid`, orders, authorizations, challenges it validates by
 * looking up the TXT record in a fake DNS, finalization that verifies the CSR's signature and its subject alternative names, the
 * certificate) and that verifies the ES256 signature of every JWS; a fake DNS provider that records each set and removal; certificates
 * made with the kernel's `der` to read their validity; and `cloudflareDns` against a fake Cloudflare API on a local server. Nothing here
 * reaches Let's Encrypt or Cloudflare.
 *
 * @module
 */
import { fromBase64, fromBase64Url, toBase64Url } from "@intellectual-frontiers/formats/base64";
import { ecdsaDerToRaw } from "@intellectual-frontiers/crypto/cose";
import * as der from "@intellectual-frontiers/formats/der";
import type { Result } from "@intellectual-frontiers/core";
import {
  challengeName,
  cloudflareDns,
  csr,
  dns01Value,
  type DnsProvider,
  ecdsaRawToDer,
  issue,
  jwkThumbprint,
  LETS_ENCRYPT,
  LETS_ENCRYPT_STAGING,
  needsRenewal,
  notAfterOf,
  pem,
} from "../src/acme.ts";
import { serve } from "../src/serve.ts";
import { assert, assertEquals, assertStringIncludes, proves, the } from "@intellectual-frontiers/commons/ts/runtime/test";

const FLOW = "0001-net FR-008";
const JWS = "0001-net FR-009";
const ACCOUNT = "0001-net FR-010";
const CLEANUP = "0001-net FR-011";
const FAILURE = "0001-net FR-012";
const CSR = "0001-net FR-013";
const VALIDITY = "0001-net FR-014";
const CLOUDFLARE = "0001-net FR-015";

const BASE = "https://acme.test";
const DIRECTORY = `${BASE}/directory`;
const EC = { name: "ECDSA", namedCurve: "P-256" } as const;
const ES256 = { name: "ECDSA", hash: "SHA-256" } as const;
const DAY = 86_400_000;

const utf8 = (s: string): Uint8Array<ArrayBuffer> => new TextEncoder().encode(s);
const text = (b: Uint8Array): string => new TextDecoder().decode(b);
const own = (b: Uint8Array): Uint8Array<ArrayBuffer> => new Uint8Array(b);
const okOf = <T, E>(r: Result<T, E>): T => {
  if (r.kind === "err") throw new Error(String(r.error));
  return r.value;
};
const kids = (t: der.Tlv): readonly der.Tlv[] => okOf(der.children(t.content));
const read = (b: Uint8Array): der.Tlv => okOf(der.readTlv(b));
const at = (list: readonly der.Tlv[], i: number): der.Tlv => the(list[i], `element ${i}`);

/** A fake DNS: what is set, what was asked, in order. */
type FakeDns = DnsProvider & { readonly records: Map<string, Set<string>>; readonly calls: string[] };

function fakeDns(o: { readonly failSet?: string; readonly failRemove?: boolean } = {}): FakeDns {
  const records = new Map<string, Set<string>>();
  const calls: string[] = [];
  return {
    records,
    calls,
    setTxt(name, value) {
      calls.push(`set ${name} ${value}`);
      if (name === o.failSet) return Promise.reject(new Error(`the DNS refused ${name}`));
      records.set(name, (records.get(name) ?? new Set()).add(value));
      return Promise.resolve();
    },
    removeTxt(name, value) {
      calls.push(`remove ${name} ${value}`);
      if (o.failRemove === true) return Promise.reject(new Error("the DNS is down"));
      records.get(name)?.delete(value);
      if (records.get(name)?.size === 0) records.delete(name);
      return Promise.resolve();
    },
  };
}

function utcTime(d: Date): Uint8Array {
  const p = (n: number): string => String(n).padStart(2, "0");
  const y = d.getUTCFullYear();
  const body = `${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
  return y >= 2050 ? der.tlv(der.TAG.generalizedTime, utf8(`${y}${body}`)) : der.tlv(der.TAG.utcTime, utf8(`${p(y % 100)}${body}`));
}

const name = (cn: string): Uint8Array => der.sequence(der.setOf(der.sequence(der.oid("2.5.4.3"), der.utf8String(cn))));

/** An X.509 certificate signed by `ca` for this key and these names, valid between the two times. */
async function certificate(o: {
  readonly ca: CryptoKeyPair;
  readonly spki: Uint8Array;
  readonly sans: readonly string[];
  readonly notBefore: Date;
  readonly notAfter: Date;
}): Promise<Uint8Array> {
  const san = der.sequence(...o.sans.map((d) => der.implicit(2, utf8(d), false)));
  const tbs = der.sequence(
    der.explicit(0, der.integer(2)),
    der.integer(Date.now()),
    der.algorithm("1.2.840.10045.4.3.2"),
    name("Fake ACME CA"),
    der.sequence(utcTime(o.notBefore), utcTime(o.notAfter)),
    name(o.sans[0] ?? ""),
    o.spki,
    der.explicit(3, der.sequence(der.sequence(der.oid("2.5.29.17"), der.octetString(san)))),
  );
  const sig = new Uint8Array(await crypto.subtle.sign(ES256, o.ca.privateKey, own(tbs)));
  return der.sequence(tbs, der.algorithm("1.2.840.10045.4.3.2"), der.bitString(ecdsaRawToDer(sig)));
}

/** A CSR read and its signature verified: its common name, its DNS names and its public key (SPKI). */
async function readCsr(
  bytes: Uint8Array,
): Promise<Result<{ readonly cn: string; readonly sans: readonly string[]; readonly spki: Uint8Array }, string>> {
  try {
    const [info, , sigBits] = kids(read(bytes));
    if (info === undefined || sigBits === undefined) return { kind: "err", error: "not a CSR" };
    const [, subject, spki, attrs] = kids(info);
    if (subject === undefined || spki === undefined || attrs === undefined || attrs.tag !== 0xa0)
      return { kind: "err", error: "not a CSR" };
    const key = await crypto.subtle.importKey("spki", own(spki.raw), EC, true, ["verify"]);
    const raw = okOf(ecdsaDerToRaw(sigBits.content.subarray(1)));
    if (!(await crypto.subtle.verify(ES256, key, own(raw), own(info.raw))))
      return { kind: "err", error: "the CSR's signature does not verify" };
    const cn = text(at(kids(at(kids(at(kids(subject), 0)), 0)), 1).content);
    const attribute = at(kids(attrs), 0);
    const extensions = at(kids(at(kids(attribute), 1)), 0);
    const sans: string[] = [];
    for (const ext of kids(extensions)) {
      const [id, value] = kids(ext);
      if (id === undefined || value === undefined || okOf(der.readOid(id.content)) !== "2.5.29.17") continue;
      for (const g of kids(read(value.content))) if (g.tag === 0x82) sans.push(text(g.content));
    }
    return { kind: "ok", value: { cn, sans, spki: spki.raw } };
  } catch (e) {
    return { kind: "err", error: e instanceof Error ? e.message : String(e) };
  }
}

type Authz = {
  readonly url: string;
  readonly domain: string;
  readonly wildcard: boolean;
  readonly token: string;
  readonly challenge: string;
  status: string;
  polls: number;
};
type Order = {
  readonly url: string;
  readonly identifiers: readonly string[];
  readonly authz: readonly Authz[];
  status: string;
  polls: number;
  cert?: string;
};

type FakeAcmeOptions = {
  readonly dns: FakeDns;
  /** Refuse the first newOrder with badNonce. */
  readonly badNonceOnce?: boolean;
  /** Refuse every request with badNonce. */
  readonly badNonceAlways?: boolean;
  /** Never let an authorization leave pending. */
  readonly stuck?: boolean;
  /** Answer the directory with this status. */
  readonly directoryStatus?: number;
};

/** The fake ACME server: a `fetch` stub and what it saw. */
async function fakeAcme(o: FakeAcmeOptions) {
  const ca = await crypto.subtle.generateKey(EC, true, ["sign", "verify"]);
  const nonces = new Set<string>();
  const accounts = new Map<string, JsonWebKey>(); // account URL to its public JWK
  const authzs = new Map<string, Authz>();
  const orders = new Map<string, Order>();
  const certs = new Map<string, string>();
  const seen = {
    verified: 0,
    badNonces: 0,
    onlyReturnExisting: 0,
    accountsMade: 0,
    csrs: [] as { cn: string; sans: readonly string[] }[],
    spkis: [] as Uint8Array[],
  };
  let n = 0;
  const nonce = (): string => {
    const v = `nonce-${++n}`;
    nonces.add(v);
    return v;
  };
  const reply = (status: number, body: unknown, headers: Record<string, string> = {}): Response =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "replay-nonce": nonce(), ...headers } });
  const problem = (status: number, type: string, detail: string): Response =>
    new Response(JSON.stringify({ type: `urn:ietf:params:acme:error:${type}`, detail }), {
      status,
      headers: { "content-type": "application/problem+json", "replay-nonce": nonce() },
    });
  const authzBody = (a: Authz): unknown => ({
    status: a.status,
    identifier: { type: "dns", value: a.domain },
    challenges: [
      { type: "http-01", url: `${a.challenge}-http`, token: a.token, status: "pending" },
      {
        type: "dns-01",
        url: a.challenge,
        token: a.token,
        status: a.status === "valid" ? "valid" : a.status === "invalid" ? "invalid" : "pending",
      },
    ],
    ...(a.wildcard ? { wildcard: true } : {}),
  });
  const orderBody = (ord: Order): unknown => ({
    status: ord.status,
    identifiers: ord.identifiers.map((value) => ({ type: "dns", value })),
    authorizations: ord.authz.map((a) => a.url),
    finalize: `${ord.url}/finalize`,
    ...(ord.cert === undefined ? {} : { certificate: ord.cert }),
  });

  const handle = async (url: string, init: RequestInit | undefined): Promise<Response> => {
    const method = init?.method ?? "GET";
    if (url === DIRECTORY && method === "GET") {
      if (o.directoryStatus !== undefined) return new Response("down", { status: o.directoryStatus });
      return Response.json({ newNonce: `${BASE}/new-nonce`, newAccount: `${BASE}/new-account`, newOrder: `${BASE}/new-order`, meta: {} });
    }
    if (url === `${BASE}/new-nonce` && method === "HEAD") return new Response(null, { status: 200, headers: { "replay-nonce": nonce() } });
    if (method !== "POST") return new Response("no", { status: 405 });
    assertEquals(new Headers(init?.headers).get("content-type"), "application/jose+json");
    // RFC 8555 §6.2: the JWS, its header and its signature
    const jws = JSON.parse(typeof init?.body === "string" ? init.body : "{}") as { protected: string; payload: string; signature: string };
    const header = JSON.parse(text(okOf(fromBase64Url(jws.protected)))) as {
      alg: string;
      nonce: string;
      url: string;
      jwk?: JsonWebKey;
      kid?: string;
    };
    if (header.alg !== "ES256") return problem(400, "badSignatureAlgorithm", header.alg);
    if (header.url !== url) return problem(401, "unauthorized", "the url of the header is not the request's");
    if (o.badNonceAlways === true || !nonces.delete(header.nonce)) {
      seen.badNonces++;
      return problem(400, "badNonce", "that nonce is not one of ours");
    }
    if ((header.jwk === undefined) === (header.kid === undefined)) return problem(400, "malformed", "exactly one of jwk and kid");
    if (url === `${BASE}/new-account` ? header.jwk === undefined : header.kid === undefined)
      return problem(400, "malformed", "jwk only for newAccount");
    const jwk = header.jwk ?? accounts.get(header.kid ?? "");
    if (jwk === undefined) return problem(400, "accountDoesNotExist", "no such account");
    const key = await crypto.subtle.importKey("jwk", jwk, EC, true, ["verify"]);
    const signed = utf8(`${jws.protected}.${jws.payload}`);
    if (!(await crypto.subtle.verify(ES256, key, own(okOf(fromBase64Url(jws.signature))), signed)))
      return problem(400, "malformed", "the signature does not verify");
    seen.verified++;
    const payload: unknown = jws.payload === "" ? undefined : JSON.parse(text(okOf(fromBase64Url(jws.payload))));
    const field = (k: string): unknown => (typeof payload === "object" && payload !== null ? Reflect.get(payload, k) : undefined);

    if (url === `${BASE}/new-account`) {
      const thumb = await jwkThumbprint(jwk);
      const existing = `${BASE}/acct/${thumb}`;
      if (accounts.has(existing)) return reply(200, { status: "valid" }, { location: existing });
      if (field("onlyReturnExisting") === true) {
        seen.onlyReturnExisting++;
        return problem(400, "accountDoesNotExist", "no account for this key");
      }
      if (field("termsOfServiceAgreed") !== true) return problem(400, "userActionRequired", "agree to the terms");
      accounts.set(existing, { kty: "EC", crv: "P-256", x: jwk.x ?? "", y: jwk.y ?? "" });
      seen.accountsMade++;
      return reply(201, { status: "valid", contact: field("contact") }, { location: existing });
    }
    const account = the(accounts.get(header.kid ?? ""));
    if (url === `${BASE}/new-order`) {
      if (o.badNonceOnce === true && seen.badNonces === 0) {
        seen.badNonces++;
        return problem(400, "badNonce", "try again");
      }
      const ids = (field("identifiers") as { type: string; value: string }[]).map((i) => i.value);
      const ordUrl = `${BASE}/order/${orders.size + 1}`;
      const list = ids.map((id, i): Authz => {
        const wildcard = id.startsWith("*.");
        const a: Authz = {
          url: `${ordUrl}/authz/${i}`,
          domain: wildcard ? id.slice(2) : id,
          wildcard,
          token: toBase64Url(crypto.getRandomValues(new Uint8Array(16))),
          challenge: `${ordUrl}/chall/${i}`,
          status: "pending",
          polls: 1,
        };
        authzs.set(a.url, a);
        return a;
      });
      const ord: Order = { url: ordUrl, identifiers: ids, authz: list, status: "pending", polls: 1 };
      orders.set(ordUrl, ord);
      return reply(201, orderBody(ord), { location: ordUrl });
    }
    const authz = authzs.get(url);
    if (authz !== undefined) {
      if (authz.status === "processing" && !(o.stuck ?? false) && authz.polls-- <= 0) {
        const want = await dns01Value(authz.token, await jwkThumbprint(account));
        authz.status = o.dns.records.get(challengeName(authz.domain))?.has(want) === true ? "valid" : "invalid";
      }
      const shown = { ...authz, status: authz.status === "processing" ? "pending" : authz.status };
      return reply(200, authzBody(shown), authz.status === "processing" ? { "retry-after": "0" } : {});
    }
    const challenged = [...authzs.values()].find((a) => a.challenge === url);
    if (challenged !== undefined) {
      if (challenged.status === "pending") challenged.status = "processing";
      return reply(200, { type: "dns-01", url, token: challenged.token, status: "processing" });
    }
    const finalizing = [...orders.values()].find((x) => `${x.url}/finalize` === url);
    if (finalizing !== undefined) {
      if (!finalizing.authz.every((a) => a.status === "valid")) return problem(403, "orderNotReady", "the authorizations are not valid");
      const request = await readCsr(okOf(fromBase64Url(String(field("csr")))));
      if (request.kind === "err") return problem(400, "badCSR", request.error);
      seen.csrs.push({ cn: request.value.cn, sans: request.value.sans });
      seen.spkis.push(request.value.spki);
      if ([...request.value.sans].sort().join(",") !== [...finalizing.identifiers].sort().join(","))
        return problem(400, "badCSR", "the names are not the order's");
      finalizing.status = "processing";
      const now = new Date();
      const leaf = await certificate({
        ca,
        spki: request.value.spki,
        sans: request.value.sans,
        notBefore: now,
        notAfter: new Date(now.getTime() + 90 * DAY),
      });
      certs.set(`${finalizing.url}/cert`, pem("CERTIFICATE", leaf));
      return reply(200, orderBody(finalizing));
    }
    const ord = orders.get(url);
    if (ord !== undefined) {
      if (ord.status === "processing" && ord.polls-- <= 0) {
        ord.status = "valid";
        ord.cert = `${ord.url}/cert`;
      } else if (ord.status === "pending" && ord.authz.every((a) => a.status === "valid")) ord.status = "ready";
      return reply(200, orderBody(ord), ord.status === "processing" ? { "retry-after": "0" } : {});
    }
    const cert = certs.get(url);
    if (cert !== undefined) {
      assertEquals(new Headers(init?.headers).get("accept"), "application/pem-certificate-chain");
      return new Response(cert, { status: 200, headers: { "content-type": "application/pem-certificate-chain", "replay-nonce": nonce() } });
    }
    return problem(404, "malformed", `no resource ${url}`);
  };
  const fetcher = ((input: RequestInfo | URL, init?: RequestInit) =>
    handle(input instanceof Request ? input.url : input instanceof URL ? input.href : input, init)) as typeof fetch;
  return { fetch: fetcher, seen, accounts, authzs, certs };
}

const quick = { pollIntervalMs: 1, pollTimeoutMs: 2000 } as const;

proves([FLOW], "the directories of Let's Encrypt are named", () => {
  assertEquals(LETS_ENCRYPT, "https://acme-v02.api.letsencrypt.org/directory");
  assertEquals(LETS_ENCRYPT_STAGING, "https://acme-staging-v02.api.letsencrypt.org/directory");
});

proves(
  [FLOW, CLEANUP],
  "a certificate for a name and its wildcard: TXT records of the key authorizations, answered, polled, finalized, downloaded",
  async () => {
    const dns = fakeDns();
    const acme = await fakeAcme({ dns });
    const waited: string[] = [];
    const r = okOf(
      await issue({
        directory: DIRECTORY,
        domains: ["erga.fyi", "*.erga.fyi"],
        dns,
        contact: ["mailto:ops@erga.fyi"],
        fetch: acme.fetch,
        propagationWait: (n, v) => {
          waited.push(`wait ${n} ${v}`);
          return Promise.resolve();
        },
        ...quick,
      }),
    );
    // the TXT values, computed here from the server's tokens and the account's thumbprint
    const account = the([...acme.accounts.values()][0]);
    const thumb = await jwkThumbprint(account);
    const values = await Promise.all(
      [...acme.authzs.values()].map(async (a) => {
        const keyAuthorization = `${a.token}.${thumb}`;
        const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", utf8(keyAuthorization)));
        return `_acme-challenge.erga.fyi ${toBase64Url(digest)}`;
      }),
    );
    assertEquals(dns.calls, [...values.map((v) => `set ${v}`), ...values.map((v) => `remove ${v}`)]);
    assertEquals(
      waited,
      values.map((v) => `wait ${v}`),
      "the wait is for each record, after all are set and before any challenge is answered",
    );
    assertEquals(dns.records.size, 0, "every TXT record is removed");
    assertEquals(r.certificatePem, the([...acme.certs.values()][0]));
    assertEquals(r.warnings, []);
    assertEquals(acme.seen.csrs, [{ cn: "erga.fyi", sans: ["erga.fyi", "*.erga.fyi"] }]);
    // the private key is the certificate's: PKCS #8 PEM of the key whose SPKI the CSR carried
    assert(r.privateKeyPem.startsWith("-----BEGIN PRIVATE KEY-----\n") && r.privateKeyPem.endsWith("-----END PRIVATE KEY-----\n"));
    const body = r.privateKeyPem.replace(/-----[A-Z ]+-----/g, "");
    const imported = await crypto.subtle.importKey("pkcs8", own(okOf(fromBase64(body))), EC, true, ["sign"]);
    const jwk = await crypto.subtle.exportKey("jwk", imported);
    const spkiKey = await crypto.subtle.exportKey(
      "jwk",
      await crypto.subtle.importKey("spki", own(the(acme.seen.spkis[0])), EC, true, ["verify"]),
    );
    assertEquals([jwk.x, jwk.y], [spkiKey.x, spkiKey.y]);
    assertEquals(r.notAfter, the(notAfterOf(r.certificatePem)).toISOString());
    assert(Math.abs(new Date(r.notAfter).getTime() - (Date.now() + 90 * DAY)) < 60_000, "valid for 90 days");
    assertEquals(needsRenewal(r.certificatePem, new Date()), false);
    assertEquals(r.accountKey.kty, "EC");
    assert(r.accountKey.d !== undefined, "the account's private key is given back to keep");
  },
);

proves(
  [JWS],
  "every request is an ES256 JWS the server verifies, with the JWK only to make the account and a fresh nonce each time; badNonce is retried",
  async () => {
    const dns = fakeDns();
    const acme = await fakeAcme({ dns, badNonceOnce: true });
    const r = await issue({ directory: DIRECTORY, domains: ["erga.fyi"], dns, fetch: acme.fetch, ...quick });
    assertEquals(r.kind, "ok");
    assertEquals(acme.seen.badNonces, 1, "the badNonce refusal was met, and the order placed again with the nonce it carried");
    assert(acme.seen.verified >= 8, `each signed request verified (${acme.seen.verified})`);
    const always = await fakeAcme({ dns: fakeDns(), badNonceAlways: true });
    const refused = await issue({ directory: DIRECTORY, domains: ["erga.fyi"], dns: fakeDns(), fetch: always.fetch, ...quick });
    assert(refused.kind === "err");
    assertStringIncludes(refused.error, "badNonce");
    assertEquals(always.seen.badNonces, 6, "retried five times, then given up");
  },
);

proves([ACCOUNT], "an account key given is found again with onlyReturnExisting, or its account made when the server has none", async () => {
  const dns = fakeDns();
  const acme = await fakeAcme({ dns });
  const first = okOf(await issue({ directory: DIRECTORY, domains: ["erga.fyi"], dns, fetch: acme.fetch, ...quick }));
  assertEquals(acme.seen.accountsMade, 1);
  assertEquals(acme.seen.onlyReturnExisting, 0, "no key was given: the account is made at once");
  const second = okOf(
    await issue({ directory: DIRECTORY, domains: ["erga.fyi"], dns, fetch: acme.fetch, accountKey: first.accountKey, ...quick }),
  );
  assertEquals(acme.seen.accountsMade, 1, "the same account, found by its key");
  assertEquals(second.accountKey, first.accountKey);
  const pair = await crypto.subtle.generateKey(EC, true, ["sign", "verify"]);
  const unknown = await crypto.subtle.exportKey("jwk", pair.privateKey);
  okOf(await issue({ directory: DIRECTORY, domains: ["erga.fyi"], dns, fetch: acme.fetch, accountKey: unknown, ...quick }));
  assertEquals(acme.seen.onlyReturnExisting, 1, "asked for first");
  assertEquals(acme.seen.accountsMade, 2, "then made");
  const bad = await issue({
    directory: DIRECTORY,
    domains: ["erga.fyi"],
    dns,
    fetch: acme.fetch,
    accountKey: { kty: "RSA", n: "AQAB", e: "AQAB" },
  });
  assert(bad.kind === "err");
  assertStringIncludes(bad.error, "not an ES256");
});

proves([CLEANUP, FAILURE], "a challenge the server finds invalid fails the issue, and the TXT records are still removed", async () => {
  // a DNS that sets the record somewhere the server does not look
  const dns = fakeDns();
  const misplaced: FakeDns = {
    ...dns,
    setTxt: (n, v) => dns.setTxt(`${n}.elsewhere`, v),
    removeTxt: (n, v) => dns.removeTxt(`${n}.elsewhere`, v),
  };
  const acme = await fakeAcme({ dns });
  const r = await issue({ directory: DIRECTORY, domains: ["erga.fyi"], dns: misplaced, fetch: acme.fetch, ...quick });
  assert(r.kind === "err");
  assertEquals(r.error, "the authorization of erga.fyi is invalid (its dns-01 challenge is invalid)");
  assertEquals(dns.records.size, 0);
  assertEquals(dns.calls.filter((c) => c.startsWith("remove")).length, 1);
});

proves([CLEANUP], "a TXT record that cannot be removed is a warning of the certificate, or added to the error", async () => {
  const dns = fakeDns({ failRemove: true });
  const acme = await fakeAcme({ dns });
  const r = okOf(await issue({ directory: DIRECTORY, domains: ["erga.fyi"], dns, fetch: acme.fetch, ...quick }));
  assertEquals(r.warnings, ["the TXT record at _acme-challenge.erga.fyi could not be removed: the DNS is down"]);
  const stuck = await fakeAcme({ dns, stuck: true });
  const timedOut = await issue({
    directory: DIRECTORY,
    domains: ["erga.fyi"],
    dns,
    fetch: stuck.fetch,
    pollIntervalMs: 1,
    pollTimeoutMs: 30,
  });
  assert(timedOut.kind === "err");
  assertStringIncludes(
    timedOut.error,
    "still pending when the wait ran out; and the TXT record at _acme-challenge.erga.fyi could not be removed",
  );
});

proves(
  [FAILURE],
  "the directory down, the DNS refusing, the network failing and no names are each a sentence, never an exception",
  async () => {
    const dns = fakeDns();
    const down = await fakeAcme({ dns, directoryStatus: 503 });
    assertEquals(await issue({ directory: DIRECTORY, domains: ["erga.fyi"], dns, fetch: down.fetch }), {
      kind: "err",
      error: "reading the directory: the server answered 503",
    });
    const refusing = fakeDns({ failSet: "_acme-challenge.www.erga.fyi" });
    const acme = await fakeAcme({ dns: refusing });
    const r = await issue({ directory: DIRECTORY, domains: ["erga.fyi", "www.erga.fyi"], dns: refusing, fetch: acme.fetch, ...quick });
    assertEquals(r, { kind: "err", error: "the certificate could not be issued: the DNS refused _acme-challenge.www.erga.fyi" });
    assertEquals(refusing.records.size, 0, "the record set before the refusal is removed");
    const offline = (() => Promise.reject(new TypeError("fetch failed"))) as typeof fetch;
    assertEquals(await issue({ directory: DIRECTORY, domains: ["erga.fyi"], dns, fetch: offline }), {
      kind: "err",
      error: "the certificate could not be issued: fetch failed",
    });
    assertEquals(await issue({ directory: DIRECTORY, domains: [], dns, fetch: offline }), {
      kind: "err",
      error: "no names to issue a certificate for",
    });
  },
);

proves([CSR], "the CSR is signed by a new ES256 key, names the first name as its subject and every name as a SAN", async () => {
  const keys = await crypto.subtle.generateKey(EC, true, ["sign", "verify"]);
  const request = await csr(["erga.fyi", "*.erga.fyi", "www.erga.fyi"], keys);
  const read = okOf(await readCsr(request));
  assertEquals(read.cn, "erga.fyi");
  assertEquals(read.sans, ["erga.fyi", "*.erga.fyi", "www.erga.fyi"]);
  assertEquals(read.spki, new Uint8Array(await crypto.subtle.exportKey("spki", keys.publicKey)));
  const tampered = Uint8Array.from(request, (b, i) => (i === 40 ? b ^ 1 : b));
  assertEquals((await readCsr(tampered)).kind, "err", "the test's reader does check the signature");
});

proves(
  [VALIDITY],
  "notAfterOf reads UTCTime and GeneralizedTime; needsRenewal within the days given, or where the certificate cannot be read",
  async () => {
    const ca = await crypto.subtle.generateKey(EC, true, ["sign", "verify"]);
    const spki = new Uint8Array(await crypto.subtle.exportKey("spki", ca.publicKey));
    const notAfter = new Date("2027-02-14T12:00:00Z");
    const cert = pem(
      "CERTIFICATE",
      await certificate({ ca, spki, sans: ["erga.fyi"], notBefore: new Date("2026-11-16T12:00:00Z"), notAfter }),
    );
    assertEquals(notAfterOf(cert), notAfter);
    assertEquals(notAfterOf(`some text\n${cert}${cert}`), notAfter, "the first certificate of a chain");
    assertEquals(needsRenewal(cert, new Date("2027-01-14T11:59:59Z")), false);
    assertEquals(needsRenewal(cert, new Date("2027-01-15T12:00:01Z")), true, "within 30 days");
    assertEquals(needsRenewal(cert, new Date("2027-01-15T12:00:01Z"), 20), false);
    assertEquals(needsRenewal(cert, new Date("2027-03-01T00:00:00Z")), true, "ended");
    const far = new Date("2051-06-01T00:00:00Z");
    assertEquals(
      notAfterOf(pem("CERTIFICATE", await certificate({ ca, spki, sans: ["erga.fyi"], notBefore: new Date(), notAfter: far }))),
      far,
    );
    assertEquals(notAfterOf("not a certificate"), undefined);
    assertEquals(notAfterOf(pem("CERTIFICATE", Uint8Array.of(0x30, 0x03, 0x02, 0x01, 0x01))), undefined);
    assertEquals(needsRenewal("not a certificate", new Date()), true);
  },
);

proves(
  [CLOUDFLARE],
  "cloudflareDns finds the zone by name, adds a quoted TXT record and deletes it, with the token as a bearer",
  async () => {
    const records = new Map<string, { name: string; content: string }>();
    const seen: string[] = [];
    let auth = new Set<string>();
    const server = await serve({ port: 0 }, async (req) => {
      const u = new URL(req.url);
      auth.add(req.headers.get("authorization") ?? "");
      seen.push(`${req.method} ${u.pathname}${u.search}`);
      const ok = (result: unknown): Response => Response.json({ success: true, errors: [], messages: [], result });
      if (u.pathname === "/client/v4/zones" && req.method === "GET") {
        return ok(u.searchParams.get("name") === "erga.fyi" ? [{ id: "z1", name: "erga.fyi" }] : []);
      }
      if (u.pathname === "/client/v4/zones/z1/dns_records" && req.method === "POST") {
        const body = (await req.json()) as { type: string; name: string; content: string; ttl: number };
        if (body.type !== "TXT") return Response.json({ success: false, errors: [{ code: 1, message: "not TXT" }] }, { status: 400 });
        const id = `r${records.size + 1}`;
        records.set(id, { name: body.name, content: body.content });
        return ok({ id, ...body });
      }
      if (u.pathname === "/client/v4/zones/z1/dns_records" && req.method === "GET") {
        return ok([...records].filter(([, r]) => r.name === u.searchParams.get("name")).map(([id, r]) => ({ id, ...r })));
      }
      const del = /^\/client\/v4\/zones\/z1\/dns_records\/(\w+)$/.exec(u.pathname);
      if (del !== null && req.method === "DELETE" && records.delete(del[1] ?? "")) return ok({ id: del[1] });
      return Response.json({ success: false, errors: [{ code: 7003, message: "Could not route" }] }, { status: 404 });
    });
    try {
      const api = `http://127.0.0.1:${server.addr.port}/client/v4`;
      const dns = cloudflareDns({ token: "test-token-123", zone: "erga.fyi", api });
      await dns.setTxt("_acme-challenge.erga.fyi", "abc");
      assertEquals([...records.values()], [{ name: "_acme-challenge.erga.fyi", content: '"abc"' }]);
      await dns.removeTxt("_acme-challenge.erga.fyi", "abc");
      assertEquals(records.size, 0);
      assertEquals(seen, [
        "GET /client/v4/zones?name=erga.fyi",
        "POST /client/v4/zones/z1/dns_records",
        "DELETE /client/v4/zones/z1/dns_records/r1",
      ]);
      assertEquals(auth, new Set(["Bearer test-token-123"]));
      // a record this provider did not make (another run's) is found by its name and content
      records.set("old", { name: "_acme-challenge.erga.fyi", content: '"left"' });
      records.set("keep", { name: "_acme-challenge.erga.fyi", content: '"other"' });
      await cloudflareDns({ token: "test-token-123", zone: "erga.fyi", api }).removeTxt("_acme-challenge.erga.fyi", "left");
      assertEquals([...records.keys()], ["keep"]);
      // refusals say what, never the token
      auth = new Set();
      const outside = await cloudflareDns({ token: "test-token-123", zone: "erga.fyi", api })
        .setTxt("_acme-challenge.example.com", "x")
        .then(
          () => "",
          (e: unknown) => (e instanceof Error ? e.message : ""),
        );
      assertEquals(outside, "Cloudflare: _acme-challenge.example.com is not in the zone erga.fyi");
      const noZone = await cloudflareDns({ token: "test-token-123", zone: "other.fyi", api })
        .setTxt("_acme-challenge.other.fyi", "x")
        .then(
          () => "",
          (e: unknown) => (e instanceof Error ? e.message : ""),
        );
      assertEquals(noZone, "Cloudflare: no zone other.fyi for this token");
      const gone = await cloudflareDns({ token: "test-token-123", zone: "erga.fyi", api: `${api}/nowhere` })
        .setTxt("_acme-challenge.erga.fyi", "x")
        .then(
          () => "",
          (e: unknown) => (e instanceof Error ? e.message : ""),
        );
      assertEquals(gone, "Cloudflare, finding the zone: 404 (Could not route)");
      assert(![outside, noZone, gone].some((m) => m.includes("test-token-123")));
    } finally {
      await server.shutdown();
    }
  },
);
