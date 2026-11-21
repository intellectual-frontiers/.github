// Spec: 0002-anyfs-githost-store FR-003, FR-004, FR-013
/**
 * What the two clients of a host share: one request over a transport, with the token put in the one header the host reads it from, and the failures that mean the same on both (a token not accepted, a token
 * that may not, a throttle, a host that failed) told as the problems of the API. The transport is a function from a request to an answer that never throws: a connection that fails is a value, and no
 * redirect is followed by this code. No URL, header, detail or log line made here holds the token: every sentence passes through the redactor, and the token travels in its one header of its one request.
 *
 * @module
 */
import { err, formatDecodeError, json, ok, type Decoder, type Result } from "@intellectual-frontiers/core";
import type { Exchange, OutRequest, Transport } from "@intellectual-frontiers/net/http-client";
import type { ApiProblem } from "./api.ts";

/** One answer, whatever its status below 400 and the statuses a host's client reads itself. */
export type Reply = { readonly status: number; readonly headers: Readonly<Record<string, string>>; readonly body: string };

/** One request: the method, the path from the base of the API, the query, and a JSON body. */
export type Request = {
  readonly method: OutRequest["method"];
  readonly path: string;
  readonly query?: Readonly<Record<string, string>>;
  readonly json?: unknown;
};

/** A function from a request to an answer or why there is none. */
export type Call = (request: Request) => Promise<Result<Reply, ApiProblem>>;

/** What a caller is made with. */
export type CallerOptions = {
  readonly transport: Transport;
  /** The API's base URL, with no trailing slash. */
  readonly base: string;
  /** The headers a token is sent in: one header name and the value for a token. */
  readonly authorize: (token: string) => Readonly<Record<string, string>>;
  readonly accept: string;
  readonly extraHeaders?: Readonly<Record<string, string>>;
  /** The token now, or none: asked for each request, so a short-lived token is fresh. */
  readonly token: () => Promise<Result<string | undefined, string>>;
  readonly redact: (text: string) => string;
  /** The clock, in milliseconds, for the wait a host's reset time asks for. */
  readonly clock?: () => number;
};

/** The statuses a client reads itself (the host's word for a conflict or a missing object). */
const OWN = new Set([400, 404, 409, 410, 412, 413, 422]);

/** The `message` of a JSON body of an error, short and on one line; empty where the body says none. */
export function messageOf(body: string): string {
  const parsed = json(body, (input) => ok(typeof input === "object" && input !== null ? input : {}));
  if (parsed.kind === "err") return body.replace(/\s+/gu, " ").trim().slice(0, 200);
  const message: unknown = Reflect.get(parsed.value, "message") ?? Reflect.get(parsed.value, "error") ?? Reflect.get(parsed.value, "error_description");
  return typeof message === "string" ? message.replace(/\s+/gu, " ").slice(0, 200) : typeof message === "object" && message !== null ? JSON.stringify(message).slice(0, 200) : "";
}

const rateLimited = (x: Exchange): boolean =>
  x.status === 429 || x.headers["x-ratelimit-remaining"] === "0" || x.headers["retry-after"] !== undefined || /rate limit|abuse|too many requests/iu.test(x.body.slice(0, 400));

/** Seconds to wait before the host answers again: `Retry-After`, else the time of the reset it names. */
function waitOf(x: Exchange, now: number): number | undefined {
  const after = x.headers["retry-after"];
  if (after !== undefined && Number.isFinite(Number(after)) && Number(after) >= 0) return Math.ceil(Number(after));
  const reset = x.headers["x-ratelimit-reset"];
  if (reset !== undefined && Number.isFinite(Number(reset))) return Math.max(0, Math.ceil(Number(reset) - now / 1000));
  return undefined;
}

/** A caller over a transport. */
export function makeCaller(options: CallerOptions): Call {
  const clock = options.clock ?? ((): number => Date.now());
  return async (request) => {
    const token = await options.token();
    if (token.kind === "err") return err({ kind: "denied", reason: "unauthorized", message: options.redact(token.error) });
    const query = request.query === undefined ? "" : `?${new URLSearchParams(request.query).toString()}`;
    // a link to the next page is followed only where it stays on the host the token is for: a token never travels to another address
    const absolute = /^https?:\/\//iu.test(request.path);
    if (absolute && !request.path.startsWith(`${options.base}/`)) return err({ kind: "unexpected", status: 0, message: "a link to another address is not followed: the token is for one host" });
    const url = absolute ? request.path : `${options.base}${request.path}${query}`;
    const headers: Record<string, string> = {
      accept: options.accept,
      ...(request.json === undefined ? {} : { "content-type": "application/json" }),
      ...options.extraHeaders,
      ...(token.value === undefined ? {} : options.authorize(token.value)),
    };
    const sent = await options.transport.send({ method: request.method, url, headers, ...(request.json === undefined ? {} : { body: JSON.stringify(request.json) }) });
    if (sent.kind === "err") return err({ kind: "unavailable", message: options.redact(`the host was not reached: ${sent.error.message}`), retryable: sent.error.kind === "network" });
    const x = sent.value;
    if (x.status >= 200 && x.status < 400) return ok({ status: x.status, headers: x.headers, body: x.body });
    const said = options.redact(messageOf(x.body));
    if (x.status === 401) return err({ kind: "denied", reason: "unauthorized", message: said === "" ? "no token, or one the host does not accept" : said });
    if (x.status === 429 || (x.status === 403 && rateLimited(x))) {
      const wait = waitOf(x, clock());
      return err({ kind: "rate-limited", message: said === "" ? "rate limit" : said, ...(wait === undefined ? {} : { retryAfterSeconds: wait }) });
    }
    if (x.status === 403) return err({ kind: "denied", reason: "permission", message: said === "" ? "the token may not do this" : said });
    if (x.status >= 500) return err({ kind: "unavailable", message: `the host answered ${x.status}${said === "" ? "" : `: ${said}`}`, retryable: true });
    if (OWN.has(x.status)) return ok({ status: x.status, headers: x.headers, body: x.body });
    return err({ kind: "unexpected", status: x.status, message: said === "" ? `HTTP ${x.status}` : said });
  };
}

/** The message a reply says, redacted by the caller's redactor where the caller needs a sentence. */
export const said = (reply: Reply): string => messageOf(reply.body);

/** The JSON of a reply decoded, or a problem that says which field is not what the host's documentation says. */
export function decode<T>(reply: Reply, decoder: Decoder<T>, what: string): Result<T, ApiProblem> {
  const v = json(reply.body, decoder);
  return v.kind === "err" ? err({ kind: "unexpected", status: reply.status, message: `the answer about ${what} is not what was expected: ${formatDecodeError(v.error).slice(0, 200)}` }) : ok(v.value);
}

/** The next page of a list from the `Link` header, or nothing at the last page. */
export function nextPage(reply: Reply): string | undefined {
  const link = reply.headers["link"];
  if (link === undefined) return undefined;
  for (const part of link.split(",")) {
    const m = /<([^>]+)>\s*;\s*rel="?next"?/iu.exec(part);
    if (m?.[1] !== undefined) return m[1];
  }
  return undefined;
}
