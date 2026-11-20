// Spec: 0004-integrations-physical FR-004, FR-005, FR-006
/**
 * The transports of exchange (commons integrations 0004-integrations-physical): an `ExchangeTransport` is a port, a record of functions, and this module gives HTTPS on
 * Net's transport (a POST of a document to a partner's endpoint, with a bearer secret), the token request of OAuth2 backend services in the manner of SMART (a client
 * credentials grant with a signed assertion, the signing a port), and the framing of MLLP over TCP. SFTP, AS2 and AS4 are specified and Planned.
 *
 * @remarks
 * What a partner answers is a payload: it is returned to the caller and never put in a failure, a log or a trace; a failure holds a kind and a status.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { Transport } from "@intellectual-frontiers/net/http-client";
import type { Secret } from "@intellectual-frontiers/integrations/logical";
import { secretOf } from "@intellectual-frontiers/integrations/logical";

/** A document to send. */
export type Outbound = { readonly contentType: string; readonly body: string };

/** What a partner gave back: a status and a body, which is a payload. */
export type Delivered = { readonly status: number; readonly body: string };

/** Why nothing was delivered. */
export type TransportFailure = { readonly kind: "refused" } | { readonly kind: "network" } | { readonly kind: "rejected"; readonly status: number };

/** The transport port of exchange. */
export type ExchangeTransport = { readonly send: (message: Outbound) => Promise<Result<Delivered, TransportFailure>> };

/** HTTPS: a POST of the document to the endpoint, authorized by a bearer secret; a status of 400 or more is `rejected`, with the status only. */
export function httpsTransport(t: Transport, endpoint: string, bearer: Secret): ExchangeTransport {
  return {
    send: async (m) => {
      const x = await t.send({ method: "POST", url: endpoint, headers: { "content-type": m.contentType, authorization: `Bearer ${bearer.reveal()}` }, body: m.body });
      if (x.kind === "err") return err({ kind: x.error.kind });
      return x.value.status >= 400 ? err({ kind: "rejected", status: x.value.status }) : ok({ status: x.value.status, body: x.value.body });
    },
  };
}

/** The claims of the assertion that proves the client to a token endpoint. */
export type AssertionClaims = { readonly iss: string; readonly sub: string; readonly aud: string; readonly jti: string; readonly exp: number };

/** The port that signs an assertion with the client's key: the key never leaves it. */
export type AssertionSigner = { readonly sign: (claims: AssertionClaims) => Promise<Result<Secret, { readonly kind: "signing-failed" }>> };

/** Why a token was not obtained. */
export type TokenFailure = { readonly kind: "signing-failed" } | { readonly kind: "refused" } | { readonly kind: "network" } | { readonly kind: "rejected"; readonly status: number } | { readonly kind: "malformed" };

/** The form of a client credentials request that carries a signed assertion (RFC 7523, as SMART Backend Services uses it). */
export function backendServicesForm(assertion: Secret, scope: string): string {
  const pairs: readonly (readonly [string, string])[] = [
    ["grant_type", "client_credentials"],
    ["client_assertion_type", "urn:ietf:params:oauth:client-assertion-type:jwt-bearer"],
    ["client_assertion", assertion.reveal()],
    ["scope", scope],
  ];
  return pairs.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
}

/** A bearer secret from the token endpoint: it signs an assertion, posts the form and reads `access_token` of the answer. */
export async function requestToken(t: Transport, tokenUrl: string, signer: AssertionSigner, claims: AssertionClaims, scope: string): Promise<Result<Secret, TokenFailure>> {
  const signed = await signer.sign(claims);
  if (signed.kind === "err") return err(signed.error);
  const x = await t.send({ method: "POST", url: tokenUrl, headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" }, body: backendServicesForm(signed.value, scope) });
  if (x.kind === "err") return err({ kind: x.error.kind });
  if (x.value.status >= 400) return err({ kind: "rejected", status: x.value.status });
  try {
    const body: unknown = JSON.parse(x.value.body);
    const token = typeof body === "object" && body !== null && "access_token" in body ? body.access_token : undefined;
    return typeof token === "string" && token !== "" ? ok(secretOf(token)) : err({ kind: "malformed" });
  } catch {
    return err({ kind: "malformed" });
  }
}

/** MLLP start block, end block and carriage return. */
export const MLLP = { start: "\u000b", end: "\u001c", cr: "\r" } as const;

/** A message in the framing of MLLP. */
export const mllpFrame = (message: string): string => `${MLLP.start}${message}${MLLP.end}${MLLP.cr}`;

/** The message of a frame, or `undefined` where the text is not one whole frame. */
export function mllpUnframe(frame: string): string | undefined {
  return frame.startsWith(MLLP.start) && frame.endsWith(`${MLLP.end}${MLLP.cr}`) ? frame.slice(1, -2) : undefined;
}
