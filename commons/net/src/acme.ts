// Spec: 0001-net FR-008
/**
 * An ACME client (RFC 8555) that gets a certificate by the DNS-01 challenge (commons 0013-acme): an account (made, or found again by its
 * key with `onlyReturnExisting`), an order for the names, a TXT record `_acme-challenge.<name>` holding the base64url SHA-256 of each key
 * authorization, the challenges answered, the authorizations and the order polled with a growing wait (or the server's `Retry-After`), a
 * certificate signing request for a new ES256 key with the names as its subject alternative names (built with the kernel's `der`), the
 * order finalized and the certificate downloaded. Every request is a JWS (ES256: the account's JWK until the account exists, its `kid`
 * after) with a fresh nonce, and a `badNonce` refusal is retried with the nonce it carries. The TXT records set are always removed, whether
 * the certificate came or not. `cloudflareDns` is a `DnsProvider` over Cloudflare's API; `needsRenewal` and `notAfterOf` read a
 * certificate's validity.
 *
 * Every expected failure (the server refuses, a challenge is invalid, the DNS provider throws, the network fails, the wait runs out) is a
 * `Result` with one sentence; nothing secret (the token, a private key) is ever in it.
 *
 * @example
 * ```ts
 * import { cloudflareDns, issue, LETS_ENCRYPT_STAGING } from "./acme.ts";
 * const r = await issue({
 *   directory: LETS_ENCRYPT_STAGING,
 *   domains: ["erga.fyi", "*.erga.fyi"],
 *   dns: cloudflareDns({ token: "<a token with Zone.DNS edit>", zone: "erga.fyi" }),
 *   contact: ["mailto:ops@example.com"],
 * });
 * if (r.kind === "ok") {
 *   // keep r.value.accountKey for the next renewal; write r.value.certificatePem and r.value.privateKeyPem where the server reads them
 * }
 * ```
 *
 * @limits
 * DNS-01 only (no HTTP-01 or TLS-ALPN-01), ES256 only (for the account and the certificate's key), no External Account Binding, no
 * revocation, no key change, and no ACME Renewal Information: `needsRenewal` decides by the certificate's own `notAfter`.
 *
 * @module
 */
import { fromBase64, toBase64, toBase64Url } from "@intellectual-frontiers/formats/base64";
import * as der from "@intellectual-frontiers/formats/der";
import {
  array,
  boolean,
  type Decoder,
  formatDecodeError,
  json,
  literal,
  object,
  string,
  err,
  ok,
  type Result,
} from "@intellectual-frontiers/core";

/** Let's Encrypt's production directory. */
export const LETS_ENCRYPT = "https://acme-v02.api.letsencrypt.org/directory";
/** Let's Encrypt's staging directory: certificates no browser trusts, for trying a setup without its rate limits. */
export const LETS_ENCRYPT_STAGING = "https://acme-staging-v02.api.letsencrypt.org/directory";

/** Where TXT records are set and removed (a zone's DNS host): `name` is the whole name, `value` the record's text. */
export type DnsProvider = {
  setTxt(name: string, value: string): Promise<void>;
  removeTxt(name: string, value: string): Promise<void>;
};

/** What `issue` takes. */
export type IssueOptions = {
  /** The ACME directory's URL (`LETS_ENCRYPT`, `LETS_ENCRYPT_STAGING`, or another CA's). */
  readonly directory: string;
  /** The names the certificate is for; the first is also its common name. A wildcard (`*.erga.fyi`) is proven at `_acme-challenge.erga.fyi`. */
  readonly domains: readonly string[];
  readonly dns: DnsProvider;
  /** The account's ES256 private key as a JWK; a new one is made where it is absent (and given back to keep). */
  readonly accountKey?: JsonWebKey;
  /** The account's contacts (`mailto:...`), sent when the account is made. */
  readonly contact?: readonly string[];
  /** Called for each TXT record once all are set, before the challenges are answered: wait until the record can be seen. */
  readonly propagationWait?: (name: string, value: string) => Promise<void>;
  /** The `fetch` used (a stub, in tests). */
  readonly fetch?: typeof fetch;
  /** The first wait between two polls, growing by half each time up to ten times this (1000 by default). */
  readonly pollIntervalMs?: number;
  /** How long an authorization or the order may take, in all (300000 by default). */
  readonly pollTimeoutMs?: number;
};

/** What `issue` gives: the certificate chain, its key, the account's key to keep, the end of its validity, and what could not be cleaned up. */
export type Issued = {
  /** The certificate and its chain, PEM, as the CA gives them. */
  readonly certificatePem: string;
  /** The certificate's ES256 private key, PKCS #8 PEM. */
  readonly privateKeyPem: string;
  /** The account's ES256 private key as a JWK: keep it (it is a secret) and give it to the next `issue`. */
  readonly accountKey: JsonWebKey;
  /** The certificate's `notAfter`, ISO 8601. */
  readonly notAfter: string;
  /** A TXT record that could not be removed, one sentence each (none when all were). */
  readonly warnings: readonly string[];
};

const UA = "intellectual-frontiers-commons-acme";
const PROBLEM = "urn:ietf:params:acme:error:";

type Problem = { readonly type: string; readonly detail: string };
type Reply = { readonly status: number; readonly headers: Headers; readonly text: string };

const directoryDecoder = object({ newNonce: string, newAccount: string, newOrder: string });
const accountDecoder = object({ status: string });
const orderDecoder = object({ status: string, authorizations: array(string), finalize: string }, { certificate: string });
const challengeDecoder = object({ type: string, url: string, status: string }, { token: string });
const authzDecoder = object(
  { status: string, identifier: object({ type: literal("dns"), value: string }), challenges: array(challengeDecoder) },
  { wildcard: boolean },
);
const problemDecoder = object({ type: string }, { detail: string });

function problemOf(reply: Reply): Problem | undefined {
  const p = json(reply.text, problemDecoder);
  return p.kind === "ok" ? { type: p.value.type, detail: p.value.detail ?? "" } : undefined;
}

function describeReply(what: string, reply: Reply): string {
  const p = problemOf(reply);
  if (p === undefined) return `${what}: the server answered ${reply.status}`;
  const type = p.type.startsWith(PROBLEM) ? p.type.slice(PROBLEM.length) : p.type;
  return `${what}: the server answered ${reply.status} ${type}${p.detail === "" ? "" : ` (${p.detail})`}`;
}

function decoded<T>(what: string, reply: Reply, decoder: Decoder<T>): Result<T, string> {
  const d = json(reply.text, decoder);
  return d.kind === "ok" ? d : err(`${what}: the server's answer is not ACME's (${formatDecodeError(d.error)})`);
}

function bytesOf(buffer: ArrayBuffer): Uint8Array {
  return new Uint8Array(buffer);
}

function utf8(text: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(text);
}

/** Bytes as PEM: the label's lines around the base64, 64 characters a line. */
export function pem(label: string, bytes: Uint8Array): string {
  const b64 = toBase64(bytes);
  const lines: string[] = [];
  for (let i = 0; i < b64.length; i += 64) lines.push(b64.slice(i, i + 64));
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----\n`;
}

/** An ECDSA P-256 signature as raw `r || s` (what Web Crypto gives) turned into DER (`SEQUENCE { r INTEGER, s INTEGER }`), as X.509 wants it. */
export function ecdsaRawToDer(raw: Uint8Array): Uint8Array {
  const half = raw.length / 2;
  return der.sequence(der.integer(raw.subarray(0, half)), der.integer(raw.subarray(half)));
}

/** The RFC 7638 thumbprint of an EC public JWK: the base64url SHA-256 of `{"crv","kty","x","y"}` in that order. */
export async function jwkThumbprint(jwk: JsonWebKey): Promise<string> {
  const canonical = JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y });
  return toBase64Url(bytesOf(await crypto.subtle.digest("SHA-256", utf8(canonical))));
}

/** The TXT value of a DNS-01 challenge: the base64url SHA-256 of the key authorization `token.thumbprint` (RFC 8555 §8.4). */
export async function dns01Value(token: string, thumbprint: string): Promise<string> {
  return toBase64Url(bytesOf(await crypto.subtle.digest("SHA-256", utf8(`${token}.${thumbprint}`))));
}

/** The name a DNS-01 TXT record is set at for a name (a wildcard's at its base name). */
export function challengeName(domain: string): string {
  return `_acme-challenge.${domain.replace(/^\*\./, "")}`;
}

const EC = { name: "ECDSA", namedCurve: "P-256" } as const;
const ES256 = { name: "ECDSA", hash: "SHA-256" } as const;

/** A certification request (PKCS #10, RFC 2986) for these names, signed by the key: the first name as the common name, all as DNS SANs. */
export async function csr(domains: readonly string[], keys: CryptoKeyPair): Promise<Uint8Array> {
  const first = domains[0] ?? "";
  const subject =
    first.length > 0 && first.length <= 64
      ? der.sequence(der.setOf(der.sequence(der.oid("2.5.4.3"), der.utf8String(first))))
      : der.sequence();
  const spki = bytesOf(await crypto.subtle.exportKey("spki", keys.publicKey));
  const san = der.sequence(...domains.map((d) => der.implicit(2, utf8(d), false)));
  const extensions = der.sequence(der.sequence(der.oid("2.5.29.17"), der.octetString(san)));
  const extensionRequest = der.sequence(der.oid("1.2.840.113549.1.9.14"), der.setOf(extensions));
  const info = der.sequence(der.integer(0), subject, spki, der.implicit(0, extensionRequest, true));
  const signature = bytesOf(await crypto.subtle.sign(ES256, keys.privateKey, new Uint8Array(info)));
  return der.sequence(info, der.algorithm("1.2.840.10045.4.3.2"), der.bitString(ecdsaRawToDer(signature)));
}

function readTime(t: der.Tlv): Date | undefined {
  const s = new TextDecoder().decode(t.content);
  const m =
    t.tag === der.TAG.utcTime
      ? /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/.exec(s)
      : t.tag === der.TAG.generalizedTime
        ? /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/.exec(s)
        : null;
  if (m === null) return undefined;
  const [, y = "", mo = "", d = "", h = "", mi = "", se = ""] = m;
  let year = Number(y);
  if (t.tag === der.TAG.utcTime) year += year >= 50 ? 1900 : 2000;
  return new Date(Date.UTC(year, Number(mo) - 1, Number(d), Number(h), Number(mi), Number(se)));
}

/** The `notAfter` of the first certificate in PEM text, or undefined where there is none or it cannot be read. */
export function notAfterOf(certificatePem: string): Date | undefined {
  const m = /-----BEGIN CERTIFICATE-----([\s\S]*?)-----END CERTIFICATE-----/.exec(certificatePem);
  if (m === null) return undefined;
  const bytes = fromBase64(m[1] ?? "");
  if (bytes.kind === "err") return undefined;
  const cert = der.readTlv(bytes.value);
  if (cert.kind === "err" || cert.value.tag !== der.TAG.sequence) return undefined;
  const top = der.children(cert.value.content);
  const tbs = top.kind === "ok" ? top.value[0] : undefined;
  if (tbs === undefined || tbs.tag !== der.TAG.sequence) return undefined;
  const fields = der.children(tbs.content);
  if (fields.kind === "err") return undefined;
  const offset = fields.value[0]?.tag === 0xa0 ? 1 : 0;
  const validity = fields.value[offset + 3];
  if (validity === undefined || validity.tag !== der.TAG.sequence) return undefined;
  const times = der.children(validity.content);
  const notAfter = times.kind === "ok" ? times.value[1] : undefined;
  return notAfter === undefined ? undefined : readTime(notAfter);
}

/** Whether a certificate ends within `days` of `now` (or has ended, or cannot be read): the time to get a new one. */
export function needsRenewal(certificatePem: string, now: Date, days = 30): boolean {
  const end = notAfterOf(certificatePem);
  return end === undefined || end.getTime() - now.getTime() < days * 86_400_000;
}

type AccountKey = { readonly privateKey: CryptoKey; readonly jwk: JsonWebKey; readonly privateJwk: JsonWebKey };

async function accountKeyOf(given: JsonWebKey | undefined): Promise<Result<AccountKey, string>> {
  try {
    let privateJwk = given;
    if (privateJwk === undefined) {
      const pair = await crypto.subtle.generateKey(EC, true, ["sign", "verify"]);
      privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
    }
    if (privateJwk.kty !== "EC" || privateJwk.crv !== "P-256" || privateJwk.d === undefined)
      return err("the account key is not an ES256 (EC P-256) private JWK");
    const privateKey = await crypto.subtle.importKey("jwk", privateJwk, EC, false, ["sign"]);
    const jwk: JsonWebKey = { kty: "EC", crv: "P-256", x: privateJwk.x ?? "", y: privateJwk.y ?? "" };
    const { key_ops: _ops, ext: _ext, ...kept } = privateJwk;
    return ok({ privateKey, jwk, privateJwk: kept });
  } catch {
    return err("the account key cannot be used as an ES256 private key");
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryAfter(headers: Headers): number | undefined {
  const v = headers.get("retry-after");
  if (v === null) return undefined;
  const seconds = Number(v);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const at = Date.parse(v);
  return Number.isNaN(at) ? undefined : Math.max(0, at - Date.now());
}

/** A session with one ACME server: the last nonce, the account key and, once known, the account's URL (`kid`). */
type Session = {
  kid: string | undefined;
  /** A signed POST of `payload` (or POST-as-GET where it is undefined), retried on `badNonce`. */
  post(url: string, payload: unknown, accept?: string): Promise<Reply>;
};

function openSession(fetcher: typeof fetch, newNonceUrl: string, key: AccountKey): Session {
  let nonce: string | undefined;
  const keep = (headers: Headers): void => {
    const n = headers.get("replay-nonce");
    if (n !== null) nonce = n;
  };
  const fresh = async (): Promise<string> => {
    if (nonce !== undefined) {
      const n = nonce;
      nonce = undefined;
      return n;
    }
    const r = await fetcher(newNonceUrl, { method: "HEAD", headers: { "user-agent": UA } });
    const n = r.headers.get("replay-nonce");
    if (n === null) throw new Error("the server gave no nonce");
    return n;
  };
  const s: Session = {
    kid: undefined,
    async post(url, payload, accept) {
      for (let attempt = 0; ; attempt++) {
        const header = { alg: "ES256", nonce: await fresh(), url, ...(s.kid === undefined ? { jwk: key.jwk } : { kid: s.kid }) };
        const protectedB64 = toBase64Url(utf8(JSON.stringify(header)));
        const payloadB64 = payload === undefined ? "" : toBase64Url(utf8(JSON.stringify(payload)));
        const sig = bytesOf(await crypto.subtle.sign(ES256, key.privateKey, utf8(`${protectedB64}.${payloadB64}`)));
        const r = await fetcher(url, {
          method: "POST",
          headers: { "content-type": "application/jose+json", "user-agent": UA, ...(accept === undefined ? {} : { accept }) },
          body: JSON.stringify({ protected: protectedB64, payload: payloadB64, signature: toBase64Url(sig) }),
        });
        keep(r.headers);
        const reply: Reply = { status: r.status, headers: r.headers, text: await r.text() };
        if (reply.status === 400 && attempt < 5 && problemOf(reply)?.type === `${PROBLEM}badNonce`) continue;
        return reply;
      }
    },
  };
  return s;
}

async function poll<T extends { readonly status: string }>(
  session: Session,
  what: string,
  url: string,
  decoder: Decoder<T>,
  pending: readonly string[],
  o: IssueOptions,
): Promise<Result<T, string>> {
  const first = o.pollIntervalMs ?? 1000;
  const deadline = Date.now() + (o.pollTimeoutMs ?? 300_000);
  let wait = first;
  for (;;) {
    const reply = await session.post(url, undefined);
    if (reply.status !== 200) return err(describeReply(what, reply));
    const d = decoded(what, reply, decoder);
    if (d.kind === "err" || !pending.includes(d.value.status)) return d;
    const next = retryAfter(reply.headers) ?? wait;
    if (Date.now() + next > deadline) return err(`${what}: still ${d.value.status} when the wait ran out`);
    await sleep(next);
    wait = Math.min(wait * 1.5, first * 10);
  }
}

async function getAccount(
  session: Session,
  url: string,
  given: boolean,
  contact: readonly string[] | undefined,
): Promise<Result<void, string>> {
  if (given) {
    const found = await session.post(url, { onlyReturnExisting: true });
    if (found.status === 200) {
      const kid = found.headers.get("location");
      if (kid === null) return err("finding the account: the server gave no account URL");
      const a = decoded("finding the account", found, accountDecoder);
      if (a.kind === "err") return a;
      if (a.value.status !== "valid") return err(`finding the account: it is ${a.value.status}`);
      session.kid = kid;
      return ok(undefined);
    }
    if (problemOf(found)?.type !== `${PROBLEM}accountDoesNotExist`) return err(describeReply("finding the account", found));
  }
  const made = await session.post(url, { termsOfServiceAgreed: true, ...(contact === undefined ? {} : { contact }) });
  if (made.status !== 201 && made.status !== 200) return err(describeReply("making the account", made));
  const kid = made.headers.get("location");
  if (kid === null) return err("making the account: the server gave no account URL");
  const a = decoded("making the account", made, accountDecoder);
  if (a.kind === "err") return a;
  if (a.value.status !== "valid") return err(`making the account: it is ${a.value.status}`);
  session.kid = kid;
  return ok(undefined);
}

type Txt = { readonly name: string; readonly value: string };

async function run(o: IssueOptions, key: AccountKey, fetcher: typeof fetch, set: Txt[]): Promise<Result<Omit<Issued, "warnings">, string>> {
  const domains = o.domains.map((d) => d.toLowerCase());
  const dirReply = await fetcher(o.directory, { headers: { "user-agent": UA } });
  if (dirReply.status !== 200) return err(`reading the directory: the server answered ${dirReply.status}`);
  const dir = decoded("reading the directory", { status: 200, headers: dirReply.headers, text: await dirReply.text() }, directoryDecoder);
  if (dir.kind === "err") return dir;
  const session = openSession(fetcher, dir.value.newNonce, key);
  const account = await getAccount(session, dir.value.newAccount, o.accountKey !== undefined, o.contact);
  if (account.kind === "err") return account;

  const placed = await session.post(dir.value.newOrder, { identifiers: domains.map((value) => ({ type: "dns", value })) });
  if (placed.status !== 201) return err(describeReply("placing the order", placed));
  const orderUrl = placed.headers.get("location");
  if (orderUrl === null) return err("placing the order: the server gave no order URL");
  const order = decoded("placing the order", placed, orderDecoder);
  if (order.kind === "err") return order;
  if (order.value.status === "invalid") return err("placing the order: the order is invalid");

  const thumbprint = await jwkThumbprint(key.jwk);
  const answer: { readonly authz: string; readonly challenge: string; readonly domain: string }[] = [];
  for (const authzUrl of order.value.authorizations) {
    const reply = await session.post(authzUrl, undefined);
    if (reply.status !== 200) return err(describeReply("reading an authorization", reply));
    const authz = decoded("reading an authorization", reply, authzDecoder);
    if (authz.kind === "err") return authz;
    const domain = authz.value.identifier.value;
    if (authz.value.status === "valid") continue;
    if (authz.value.status !== "pending") return err(`the authorization of ${domain} is ${authz.value.status}`);
    const ch = authz.value.challenges.find((c) => c.type === "dns-01");
    if (ch === undefined || ch.token === undefined) return err(`the authorization of ${domain} offers no dns-01 challenge`);
    const txt = { name: challengeName(domain), value: await dns01Value(ch.token, thumbprint) };
    await o.dns.setTxt(txt.name, txt.value);
    set.push(txt);
    answer.push({ authz: authzUrl, challenge: ch.url, domain });
  }
  if (o.propagationWait !== undefined) for (const t of set) await o.propagationWait(t.name, t.value);
  for (const a of answer) {
    const reply = await session.post(a.challenge, {});
    if (reply.status !== 200) return err(describeReply(`answering the challenge of ${a.domain}`, reply));
  }
  for (const a of answer) {
    const done = await poll(session, `the authorization of ${a.domain}`, a.authz, authzDecoder, ["pending", "processing"], o);
    if (done.kind === "err") return done;
    if (done.value.status !== "valid") {
      const why = done.value.challenges.find((c) => c.type === "dns-01")?.status ?? done.value.status;
      return err(`the authorization of ${a.domain} is ${done.value.status} (its dns-01 challenge is ${why})`);
    }
  }

  const certKeys = await crypto.subtle.generateKey(EC, true, ["sign", "verify"]);
  const request = await csr(domains, certKeys);
  const finalized = await session.post(order.value.finalize, { csr: toBase64Url(request) });
  if (finalized.status !== 200) return err(describeReply("finalizing the order", finalized));
  const final = await poll(session, "the order", orderUrl, orderDecoder, ["pending", "ready", "processing"], o);
  if (final.kind === "err") return final;
  if (final.value.status !== "valid" || final.value.certificate === undefined)
    return err(`the order is ${final.value.status}, with no certificate`);
  const cert = await session.post(final.value.certificate, undefined, "application/pem-certificate-chain");
  if (cert.status !== 200) return err(describeReply("downloading the certificate", cert));
  const notAfter = notAfterOf(cert.text);
  if (notAfter === undefined) return err("downloading the certificate: what came is not a PEM certificate");
  const pkcs8 = bytesOf(await crypto.subtle.exportKey("pkcs8", certKeys.privateKey));
  return ok({
    certificatePem: cert.text,
    privateKeyPem: pem("PRIVATE KEY", pkcs8),
    accountKey: key.privateJwk,
    notAfter: notAfter.toISOString(),
  });
}

function reason(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * A certificate for `domains` from the ACME server at `directory`, proven by DNS-01 through `dns`; or why not. The TXT records set are
 * removed in every case; one that could not be removed is a warning of the result (or added to its error).
 */
export async function issue(o: IssueOptions): Promise<Result<Issued, string>> {
  if (o.domains.length === 0) return err("no names to issue a certificate for");
  const key = await accountKeyOf(o.accountKey);
  if (key.kind === "err") return key;
  const fetcher = o.fetch ?? fetch;
  const set: Txt[] = [];
  let result: Result<Omit<Issued, "warnings">, string>;
  try {
    result = await run(o, key.value, fetcher, set);
  } catch (e) {
    result = err(`the certificate could not be issued: ${reason(e)}`);
  }
  const warnings: string[] = [];
  for (const t of set) {
    try {
      await o.dns.removeTxt(t.name, t.value);
    } catch (e) {
      warnings.push(`the TXT record at ${t.name} could not be removed: ${reason(e)}`);
    }
  }
  if (result.kind === "err") return warnings.length === 0 ? result : err(`${result.error}; and ${warnings.join("; ")}`);
  return ok({ ...result.value, warnings });
}

const cfEnvelope = object({ success: boolean });
const cfError = object({ errors: array(object({ message: string })) });
const cfZones = object({ result: array(object({ id: string, name: string })) });
const cfRecord = object({ result: object({ id: string }) });
const cfRecords = object({ result: array(object({ id: string, content: string })) });

/** A `DnsProvider` over Cloudflare's API (v4) for one zone, by an API token allowed to edit its DNS (`Zone.DNS`). */
export function cloudflareDns(o: {
  readonly token: string;
  readonly zone: string;
  readonly api?: string;
  readonly fetch?: typeof fetch;
}): DnsProvider {
  const api = (o.api ?? "https://api.cloudflare.com/client/v4").replace(/\/+$/, "");
  const fetcher = o.fetch ?? fetch;
  const zone = o.zone.toLowerCase();
  const made = new Map<string, string>();
  let zoneId: string | undefined;

  async function call<T>(what: string, method: string, path: string, decoder: Decoder<T>, body?: unknown): Promise<T> {
    const r = await fetcher(`${api}${path}`, {
      method,
      headers: { authorization: `Bearer ${o.token}`, "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await r.text();
    const env = json(text, cfEnvelope);
    if (!r.ok || env.kind === "err" || !env.value.success) {
      const errors = json(text, cfError);
      const said = errors.kind === "ok" ? errors.value.errors.map((e) => e.message).join("; ") : "";
      throw new Error(`Cloudflare, ${what}: ${r.status}${said === "" ? "" : ` (${said})`}`);
    }
    const d = json(text, decoder);
    if (d.kind === "err") throw new Error(`Cloudflare, ${what}: an answer not understood (${formatDecodeError(d.error)})`);
    return d.value;
  }

  async function idOfZone(): Promise<string> {
    if (zoneId !== undefined) return zoneId;
    const zones = await call("finding the zone", "GET", `/zones?name=${encodeURIComponent(zone)}`, cfZones);
    const z = zones.result.find((x) => x.name.toLowerCase() === zone);
    if (z === undefined) throw new Error(`Cloudflare: no zone ${zone} for this token`);
    zoneId = z.id;
    return z.id;
  }

  function inZone(name: string): void {
    const n = name.toLowerCase();
    if (n !== zone && !n.endsWith(`.${zone}`)) throw new Error(`Cloudflare: ${name} is not in the zone ${zone}`);
  }

  return {
    async setTxt(name, value) {
      inZone(name);
      const id = await idOfZone();
      const r = await call("adding a TXT record", "POST", `/zones/${id}/dns_records`, cfRecord, {
        type: "TXT",
        name,
        content: `"${value}"`,
        ttl: 60,
        comment: "ACME DNS-01 challenge",
      });
      made.set(`${name}\n${value}`, r.result.id);
    },
    async removeTxt(name, value) {
      inZone(name);
      const id = await idOfZone();
      const known = made.get(`${name}\n${value}`);
      const ids =
        known !== undefined
          ? [known]
          : (
              await call("finding TXT records", "GET", `/zones/${id}/dns_records?type=TXT&name=${encodeURIComponent(name)}`, cfRecords)
            ).result
              .filter((rec) => rec.content === value || rec.content === `"${value}"`)
              .map((rec) => rec.id);
      for (const recordId of ids) await call("removing a TXT record", "DELETE", `/zones/${id}/dns_records/${recordId}`, cfEnvelope);
      made.delete(`${name}\n${value}`);
    },
  };
}
