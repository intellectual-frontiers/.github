/**
 * What the REST adapters (`github.ts`, `gitlab.ts`) share: one GET over the runtime's `Transport`, and a host's refusal told as the contract's `HostFailure` the same way for both
 * (commons 0020-ifccm FR-039, FR-018). A credential is only ever put in a request's headers; no failure, no message and no result holds a header, a URL's query or a token.
 *
 * @module
 */
import { type Decoder, formatDecodeError, json, err, ok, type Result } from "@intellectual-frontiers/core";
import type { Exchange, Transport } from "@intellectual-frontiers/net/http-client";
import type { HostFailure } from "./types.ts";

/** One GET, its answer whatever the status, or why the host was not reached. */
export async function get(
  transport: Transport,
  url: string,
  headers: Readonly<Record<string, string>>,
): Promise<Result<Exchange, HostFailure>> {
  const x = await transport.send({ method: "GET", url, headers });
  if (x.kind === "err") return err({ kind: "unreachable", reason: x.error.message });
  return ok(x.value);
}

/** The `message` a host says in a JSON error body, short and on one line; empty where the body says none. */
export function messageOf(body: string): string {
  const parsed = json(body, (input) => ok(typeof input === "object" && input !== null ? input : {}));
  if (parsed.kind === "err") return "";
  const message: unknown = Reflect.get(parsed.value, "message") ?? Reflect.get(parsed.value, "error");
  return typeof message === "string" ? message.replace(/\s+/g, " ").slice(0, 200) : "";
}

/** A token as it may be put in a header: trimmed, and undefined where it is empty or holds a control character (a header could be split by it). */
export function usableToken(token: string | undefined): string | undefined {
  const t = token?.trim();
  // eslint-disable-next-line no-control-regex
  return t === undefined || t === "" || /[\u0000-\u001f\u007f]/.test(t) ? undefined : t;
}

/** Seconds from a `Retry-After` header given as a number of seconds, or undefined. */
export function retryAfterSeconds(x: Exchange): number | undefined {
  const v = x.headers["retry-after"];
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.ceil(n) : undefined;
}

/**
 * A refusal as a `HostFailure`: 401 is `unauthorized`; 403 is `unauthorized` unless `rateLimited` says it is the rate; 404 is `not-found` naming `what` (and, where no credential was sent, saying
 * that a host answers 404 for a private repository too); 429 is `rate-limited`; any other status from 400 up, and any 3xx, is `unexpected`. Undefined where the status is a success.
 */
export function failureOf(
  x: Exchange,
  what: string,
  options: { readonly credential: boolean; readonly rateLimited?: (x: Exchange) => boolean },
): HostFailure | undefined {
  const s = x.status;
  if (s >= 200 && s < 300) return undefined;
  const said = messageOf(x.body);
  if (s === 429 || (s === 403 && options.rateLimited?.(x) === true)) {
    const after = retryAfterSeconds(x);
    return after === undefined ? { kind: "rate-limited" } : { kind: "rate-limited", retryAfterSeconds: after };
  }
  if (s === 401) {
    return {
      kind: "unauthorized",
      reason: options.credential
        ? `the host did not accept the credential${said === "" ? "" : ` (${said})`}`
        : "the host asks for a credential and none was given",
    };
  }
  if (s === 403) {
    return {
      kind: "unauthorized",
      reason: options.credential
        ? `the credential may not read ${what}${said === "" ? "" : ` (${said})`}`
        : `${what} needs a credential and none was given`,
    };
  }
  if (s === 404) {
    return {
      kind: "not-found",
      what: options.credential ? what : `${what} (the host answers not found for a private repository to a caller with no credential)`,
    };
  }
  return { kind: "unexpected", status: s, reason: said === "" ? `HTTP ${s}` : said };
}

/** A successful answer's JSON body decoded, or an `unexpected` failure that says which field is not what the host's documentation says. */
export function decodeBody<T>(x: Exchange, decoder: Decoder<T>): Result<T, HostFailure> {
  const v = json(x.body, decoder);
  if (v.kind === "err")
    return err({ kind: "unexpected", status: x.status, reason: `the answer is not what was expected: ${formatDecodeError(v.error)}` });
  return ok(v.value);
}

/** A GET whose answer is decoded: the refusal as a `HostFailure`, or the decoded body. */
export async function getDecoded<T>(
  transport: Transport,
  url: string,
  headers: Readonly<Record<string, string>>,
  decoder: Decoder<T>,
  what: string,
  options: { readonly credential: boolean; readonly rateLimited?: (x: Exchange) => boolean },
): Promise<Result<T, HostFailure>> {
  const x = await get(transport, url, headers);
  if (x.kind === "err") return x;
  const failure = failureOf(x.value, what, options);
  return failure === undefined ? decodeBody(x.value, decoder) : err(failure);
}
