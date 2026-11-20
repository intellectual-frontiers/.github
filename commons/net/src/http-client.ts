// Spec: 0001-net FR-003
/**
 * How a typed client reaches a system over HTTP (commons 0001-net FR-003): a transport, live (`fetch`) or recorded (the
 * exchanges a test keeps, so it reaches no host), and over it the guards and helpers every client otherwise rewrites: a read-only guard
 * (safe methods only, POST to the token endpoints named, and the POSTs a predicate says only read, FR-066), AWS Signature Version 4 on each
 * request (FR-069), backoff on 429 and 503 that honours `Retry-After`, a JSON read decoded at the boundary with typed failures (a denied
 * call is told apart, so a caller can record a gap instead of failing), and every item of a list that pages by `Link: rel="next"` or by a
 * cursor in the body. A request that carries a credential is refused before it is sent unless the transport is made to allow it, so a
 * harness whose proxy injects credentials never sends one by mistake. Taken from erga's `lib/ts/http-client` and Stolos's connector SDK
 * (`src/archon/connect/sdk.ts`, `connector.ts`).
 *
 * @example
 * ```ts
 * import { array, object, string } from "@intellectual-frontiers/core";
 * import { getJson, liveTransport, withBackoff } from "./http-client.ts";
 * const http = withBackoff(liveTransport());
 * const repo = await getJson(http, "https://api.github.com/repos/oven-sh/bun", object({ full_name: string }));
 * ```
 *
 * @module
 */
import {
  absurd,
  array,
  type Decoder,
  formatDecodeError,
  json,
  literal,
  number,
  object,
  record,
  string,
  err,
  ok,
  type Result,
} from "@intellectual-frontiers/core";
import { isSafeMethod, nextLink, retryAfterMs } from "@intellectual-frontiers/formats/http";
import { formatJson5Error, parseJson5, toJson5 } from "@intellectual-frontiers/formats/json5";
import { type AwsCredentials, sign } from "@intellectual-frontiers/crypto/sigv4";
import { traceHttpClient } from "@intellectual-frontiers/telemetry/host/otel";
import { sleep } from "@intellectual-frontiers/system/proc";

/** A request a client makes. */
export type OutRequest = {
  readonly method: "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE";
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: string;
  /** Read the answer as bytes (`Exchange.bytes`), for an artifact that is not text (a tarball, a zip); the text `body` of the answer is then empty. */
  readonly binary?: boolean;
};

/** One exchange: a request and what answered it. */
export type Exchange = {
  readonly method: OutRequest["method"];
  readonly url: string;
  readonly status: number;
  /** The headers kept: the content type, paging, rate limits and `Retry-After`. */
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
  /** The answer's bytes: present where the request asked for `binary` (a recorded exchange of an artifact holds them). */
  readonly bytes?: Uint8Array;
};

/** Why a request got no answer at all (a refusal before it was sent, or the network). */
export type TransportError =
  { readonly kind: "refused"; readonly message: string } | { readonly kind: "network"; readonly message: string };

/** A way to reach a system. */
export type Transport = { readonly kind: "live" | "recorded"; readonly send: (r: OutRequest) => Promise<Result<Exchange, TransportError>> };

/** The headers a credential travels in. */
export const CREDENTIAL_HEADERS: readonly string[] = [
  "authorization",
  "proxy-authorization",
  "cookie",
  "x-api-key",
  "x-goog-api-key",
  "api-key",
  "private-token",
  "job-token",
];

/** Why a request may not be sent where credentials are refused: it carries one in a header or in its query. Undefined where it carries none. */
export function carriesCredential(r: OutRequest): string | undefined {
  const named = Object.keys(r.headers)
    .map((h) => h.toLowerCase())
    .find((h) => CREDENTIAL_HEADERS.includes(h));
  if (named !== undefined)
    return `${r.method} ${r.url.split("?")[0] ?? r.url} carries the header ${named}, and this transport sends no credential`;
  if (/[?&](key|api_key|apikey|access_token|token|password|passwd)=/i.test(r.url)) {
    return `${r.method} ${r.url.split("?")[0] ?? r.url} carries a credential in its query, and this transport sends no credential`;
  }
  return undefined;
}

const KEPT = ["content-type", "link", "retry-after", "x-ratelimit-remaining", "x-ratelimit-reset", "etag", "location"];

/** How the live transport sends. */
export type LiveOptions = {
  /** The `fetch` to use (the platform's by default). */
  readonly fetch?: typeof fetch;
  /** Refuse a request that carries a credential (the default), or send it. */
  readonly credentials?: "refuse" | "allow";
  /** The `User-Agent` said to every system: a generic name, never a person's. */
  readonly userAgent?: string;
  /** No answer within this many seconds fails the request (30 by default). */
  readonly timeoutSeconds?: number;
};

/** The live transport, over `fetch`. */
export function liveTransport(options: LiveOptions = {}): Transport {
  const fetcher = options.fetch ?? fetch;
  return {
    kind: "live",
    async send(r) {
      if (options.credentials !== "allow") {
        const why = carriesCredential(r);
        if (why !== undefined) return err({ kind: "refused", message: why });
      }
      // Where a telemetry pipeline is installed, the request is an `http.client` span and carries `traceparent` (0001-net FR-016).
      return traceHttpClient(
        r.method,
        r.url,
        async (trace): Promise<Result<Exchange, TransportError>> => {
          try {
            const res = await fetcher(r.url, {
              method: r.method,
              headers: { "user-agent": options.userAgent ?? "ifc-ts", ...trace, ...r.headers },
              ...(r.body === undefined ? {} : { body: r.body }),
              signal: AbortSignal.timeout((options.timeoutSeconds ?? 30) * 1000),
            });
            const headers: Record<string, string> = {};
            for (const k of KEPT) {
              const v = res.headers.get(k);
              if (v !== null) headers[k] = v;
            }
            if (r.binary === true) {
              return ok({
                method: r.method,
                url: r.url,
                status: res.status,
                headers,
                body: "",
                bytes: new Uint8Array(await res.arrayBuffer()),
              });
            }
            return ok({ method: r.method, url: r.url, status: res.status, headers, body: await res.text() });
          } catch (e) {
            return err({
              kind: "network",
              message: e instanceof Error ? `${e.message}${e.cause instanceof Error ? `: ${e.cause.message}` : ""}` : String(e),
            });
          }
        },
        (x) => (x.kind === "ok" ? x.value.status : undefined),
      );
    },
  };
}

/** A transport that answers from recorded exchanges, by method and URL, and refuses a request it has none for, naming it. */
export function recordedTransport(exchanges: readonly Exchange[]): Transport {
  return {
    kind: "recorded",
    send(r) {
      const x = exchanges.find((e) => e.method === r.method && e.url === r.url);
      return Promise.resolve(x === undefined ? err({ kind: "refused", message: `no recorded exchange for ${r.method} ${r.url}` }) : ok(x));
    },
  };
}

/**
 * Whether a `POST` only reads (FR-066): a GraphQL query, a search, a JSON API's `Describe` and `Get` actions. It is given the whole
 * request (method, URL, headers and body), as an action may be named in a header (`x-amz-target`) or the body.
 */
export type ReadPost = (r: OutRequest) => boolean;

/**
 * A transport that sends only safe methods (GET, HEAD, ...), POST to URLs that start with one of `tokenEndpoints`, and the POSTs that
 * `readPost` says only read (FR-066). Every other request (PUT, PATCH, DELETE, any other POST) is refused without being sent.
 */
export function readOnly(t: Transport, tokenEndpoints: readonly string[] = [], readPost?: ReadPost): Transport {
  return {
    kind: t.kind,
    send(r) {
      const post = r.method === "POST" && (tokenEndpoints.some((p) => r.url.startsWith(p)) || readPost?.(r) === true);
      if (isSafeMethod(r.method) || post) return t.send(r);
      return Promise.resolve(err({ kind: "refused", message: `read-only: ${r.method} ${new URL(r.url).origin} is refused` }));
    },
  };
}

/** How {@link withSigV4} signs. */
export type SigV4TransportOptions = {
  readonly credentials: AwsCredentials;
  readonly region: string;
  readonly service: string;
  /** The clock read as each request is sent (`new Date()` by default; a test gives its own). */
  readonly now?: () => Date;
  /** Sign `UNSIGNED-PAYLOAD` instead of the body's hash (S3 allows it). */
  readonly unsignedPayload?: boolean;
};

/**
 * A transport that signs each request by AWS Signature Version 4 (FR-069, by the kernel's `sigv4`, FR-068) when it is sent. A signed
 * request carries a credential, so the live transport under it must be made with `credentials: "allow"`, or it refuses the request.
 */
export function withSigV4(t: Transport, options: SigV4TransportOptions): Transport {
  return {
    kind: t.kind,
    async send(r) {
      const signed = await sign(r, {
        credentials: options.credentials,
        region: options.region,
        service: options.service,
        date: (options.now ?? (() => new Date()))(),
        ...(options.unsignedPayload === undefined ? {} : { unsignedPayload: options.unsignedPayload }),
      });
      return await t.send({ ...r, headers: signed.headers });
    },
  };
}

/** How long to back off. */
export type BackoffOptions = {
  /** Tries after the first (3 by default). */
  readonly retries?: number;
  /** How a wait is spent (a timer by default; a test passes one that returns at once). */
  readonly pause?: (ms: number) => Promise<void>;
  /** The longest wait, whatever `Retry-After` asks (60 s by default). */
  readonly capMs?: number;
};

/** A transport that waits and tries again on 429 and 503: as long as `Retry-After` asks (up to the cap), else 1, 2, 4 seconds. */
export function withBackoff(t: Transport, options: BackoffOptions = {}): Transport {
  const pause = options.pause ?? ((ms: number) => sleep(ms));
  const cap = options.capMs ?? 60_000;
  return {
    kind: t.kind,
    async send(r) {
      for (let n = 0; ; n++) {
        const x = await t.send(r);
        if (x.kind === "err" || (x.value.status !== 429 && x.value.status !== 503) || n >= (options.retries ?? 3)) return x;
        const asked = retryAfterMs(x.value.headers["retry-after"], Date.now());
        await pause(Math.min(cap, asked ?? 1000 * 2 ** n));
      }
    },
  };
}

/** Why a JSON read failed. */
export type ReadError =
  | TransportError
  | { readonly kind: "denied"; readonly status: 401 | 403; readonly url: string }
  | { readonly kind: "status"; readonly status: number; readonly url: string }
  | { readonly kind: "decode"; readonly url: string; readonly message: string };

/** A read error as one sentence; never a header or a body, so no credential or personal datum is said. */
export function formatReadError(e: ReadError): string {
  switch (e.kind) {
    case "refused":
    case "network":
      return e.message;
    case "denied":
      return `${new URL(e.url).pathname}: ${e.status} (the credential may not read this)`;
    case "status":
      return `${new URL(e.url).pathname}: HTTP ${e.status}`;
    case "decode":
      return `${new URL(e.url).pathname}: ${e.message}`;
    default:
      return absurd(e);
  }
}

/** A GET whose JSON body is decoded, with the exchange; 401 and 403 are `denied`, any other status from 400 up is `status`. */
export async function getExchange<T>(
  t: Transport,
  url: string,
  decoder: Decoder<T>,
  headers: Readonly<Record<string, string>> = {},
): Promise<Result<{ readonly value: T; readonly exchange: Exchange }, ReadError>> {
  const x = await t.send({ method: "GET", url, headers: { accept: "application/json", ...headers } });
  if (x.kind === "err") return x;
  const { status } = x.value;
  if (status === 401 || status === 403) return err({ kind: "denied", status, url });
  if (status >= 400) return err({ kind: "status", status, url });
  const v = json(x.value.body, decoder);
  if (v.kind === "err") return err({ kind: "decode", url, message: formatDecodeError(v.error) });
  return ok({ value: v.value, exchange: x.value });
}

/** A GET whose JSON body is decoded. */
export async function getJson<T>(
  t: Transport,
  url: string,
  decoder: Decoder<T>,
  headers: Readonly<Record<string, string>> = {},
): Promise<Result<T, ReadError>> {
  const r = await getExchange(t, url, decoder, headers);
  return r.kind === "ok" ? ok(r.value.value) : r;
}

/** Every page of a list that pages by `Link: <...>; rel="next"`, at most `maxPages` (200 by default); the first failure ends it, as an error. */
export async function* linkPages<T>(
  t: Transport,
  url: string,
  item: Decoder<T>,
  options: { readonly headers?: Readonly<Record<string, string>>; readonly maxPages?: number } = {},
): AsyncGenerator<T, Result<number, ReadError>> {
  const page = array(item);
  let next: string | undefined = url;
  let pages = 0;
  while (next !== undefined && pages < (options.maxPages ?? 200)) {
    const r = await getExchange(t, next, page, options.headers);
    if (r.kind === "err") return r;
    yield* r.value.value;
    pages++;
    next = nextLink(r.value.exchange.headers["link"], "next", next);
  }
  return ok(pages);
}

/** Every item of a list that pages by a cursor in its body: `items` takes a page's items, `next` the next page's URL or undefined. */
export async function* cursorPages<B, T>(
  t: Transport,
  first: string,
  page: Decoder<B>,
  items: (body: B) => readonly T[],
  next: (body: B, url: string) => string | undefined,
  options: { readonly headers?: Readonly<Record<string, string>>; readonly maxPages?: number } = {},
): AsyncGenerator<T, Result<number, ReadError>> {
  let url: string | undefined = first;
  let pages = 0;
  while (url !== undefined && pages < (options.maxPages ?? 200)) {
    const r = await getJson(t, url, page, options.headers);
    if (r.kind === "err") return r;
    yield* items(r.value);
    pages++;
    url = next(r.value, url);
  }
  return ok(pages);
}

const exchangeDecoder: Decoder<Exchange> = object({
  method: literal("GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"),
  url: string,
  status: number,
  headers: record(string),
  body: string,
});

/** A recorded exchange read from the JSON5 text `recordedText` writes, or why it is not one. */
export function decodeRecorded(text: string): Result<Exchange, string> {
  const v = parseJson5(text);
  if (v.kind === "err") return err(`not JSON5: ${formatJson5Error(v.error)}`);
  const x = exchangeDecoder(v.value);
  return x.kind === "ok" ? ok(x.value) : err(formatDecodeError(x.error));
}

/** The text a recorded exchange is kept in: a comment that says where and when it was recorded, then the exchange as JSON5. */
export function recordedText(x: Exchange, note: string): string {
  return toJson5({ method: x.method, url: x.url, status: x.status, headers: x.headers, body: x.body }, note);
}

/** Headers that give a bearer token (for a transport made to allow credentials). */
export function bearer(token: string, scheme = "Bearer"): Readonly<Record<string, string>> {
  return { authorization: `${scheme} ${token}` };
}
