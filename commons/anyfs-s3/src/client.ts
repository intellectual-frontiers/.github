// Spec: 0002-anyfs-s3-store FR-007
/**
 * The client of a bucket: it builds the URL of a request (path style, `host/bucket/key`, or virtual-hosted style, `bucket.host/key`, each key encoded as RFC 3986 says), signs it with Signature Version 4 of
 * `@intellectual-frontiers/crypto` for the service `s3` (the payload's SHA-256 is signed on a connection that is not encrypted, and not signed on one that is, where `UNSIGNED-PAYLOAD` is allowed), sends it through
 * a transport, and gives the answer if its status is a success and the failure S3 describes if it is not. It holds no state but the keys, which it asks its source for each time (a source remembers them as long as
 * they last), and it never writes a key, a signature or a header that carries one.
 *
 * @example
 * ```ts
 * import { parseEndpoint } from "./client.ts";
 * const e = parseEndpoint("http://127.0.0.1:9000");
 * e.kind === "ok" && e.value.host; // "127.0.0.1"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { sign, uriEncode } from "@intellectual-frontiers/crypto/sigv4";
import type { BucketName } from "./bucket.ts";
import { cachedCredentials, type CredentialSource } from "./credentials.ts";
import type { Failure } from "./errors.ts";
import { encodeKey } from "./keys.ts";
import type { HttpMethod, HttpResponse, Transport } from "./transport.ts";
import { parseErrorBody } from "./xml.ts";

/** Where a service listens. */
export type Endpoint = { readonly scheme: "http" | "https"; readonly host: string; readonly port?: number };

/** How a bucket is written in a URL. */
export type Addressing = "path" | "virtual";

/** Whether the SHA-256 of a body is signed. */
export type PayloadSigning = "auto" | "signed" | "unsigned";

const HOST = /^(?:\[[0-9a-fA-F:.]+\]|[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?)$/u;

/** An endpoint from a URL with no path, query or credentials. */
export function parseEndpoint(text: string): Result<Endpoint, string> {
  const m = /^(https?):\/\/([^/?#@:]+|\[[^\]]+\])(?::(\d{1,5}))?\/?$/u.exec(text);
  if (m === null) return err(`${JSON.stringify(text.slice(0, 80))} is not an endpoint: a scheme, a host and perhaps a port, with no path, query or credentials`);
  const host = m[2] ?? "";
  if (!HOST.test(host)) return err(`${JSON.stringify(host)} is not a host name`);
  const port = m[3] === undefined ? undefined : Number.parseInt(m[3], 10);
  if (port !== undefined && (port < 1 || port > 65535)) return err(`${port} is not a port`);
  return ok({ scheme: m[1] === "http" ? "http" : "https", host, ...(port === undefined ? {} : { port }) });
}

/** The endpoint of Amazon S3 in a region. */
export const awsEndpoint = (region: string): Endpoint => ({ scheme: "https", host: `s3.${region}.amazonaws.com` });

/** An endpoint as the text of its authority. */
const authority = (e: Endpoint): string => `${e.host}${e.port === undefined ? "" : `:${e.port}`}`;

/** What a client is made with. */
export type ClientOptions = {
  readonly endpoint: Endpoint;
  readonly region: string;
  readonly bucket: BucketName;
  readonly addressing: Addressing;
  readonly credentials: CredentialSource;
  readonly transport: Transport;
  readonly timeoutMs: number;
  readonly payload: PayloadSigning;
  readonly now: () => Date;
};

/** A request of the store: what it asks of the bucket. */
export type Call = {
  readonly method: HttpMethod;
  /** The key of an object, or none for a request of the bucket. */
  readonly key?: string;
  /** The query, with every value as text and unencoded. */
  readonly query?: Readonly<Record<string, string>>;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: Uint8Array;
};

/** Why a call has no answer that succeeded. */
export type CallError = { readonly kind: "transport"; readonly message: string } | { readonly kind: "credentials"; readonly message: string } | { readonly kind: "failure"; readonly failure: Failure };

/** The client of one bucket. */
export type S3Client = {
  readonly bucket: BucketName;
  readonly endpoint: Endpoint;
  readonly addressing: Addressing;
  /** The URL a call would be sent to, with nothing signed. */
  readonly urlOf: (call: Call) => string;
  /** The answer to a call if its status is 2xx, and the reason it is not one otherwise. */
  readonly send: (call: Call) => Promise<Result<HttpResponse, CallError>>;
};

/** The failure an answer that is not a success stands for. */
export function failureOf(response: HttpResponse): Failure {
  const text = new TextDecoder().decode(response.body);
  const body = text.trimStart().startsWith("<") ? parseErrorBody(text) : undefined;
  const requestId = response.headers["x-amz-request-id"];
  if (body !== undefined && body.kind === "ok") return { status: response.status, code: body.value.code, message: body.value.message, ...(body.value.requestId !== undefined ? { requestId: body.value.requestId } : requestId === undefined ? {} : { requestId }) };
  return { status: response.status, code: "", message: "", ...(requestId === undefined ? {} : { requestId }) };
}

/** The client of a bucket. */
export function makeClient(options: ClientOptions): S3Client {
  const credentials = cachedCredentials(options.credentials);
  const virtual = options.addressing === "virtual";
  const urlOf = (call: Call): string => {
    const key = call.key === undefined || call.key === "" ? "" : encodeKey(call.key);
    const path = virtual ? `/${key}` : key === "" ? `/${options.bucket}` : `/${options.bucket}/${key}`;
    const host = virtual ? `${options.bucket}.${authority(options.endpoint)}` : authority(options.endpoint);
    const names = Object.keys(call.query ?? {}).sort();
    const query = names.map((n) => `${uriEncode(n)}=${uriEncode(call.query?.[n] ?? "")}`).join("&");
    return `${options.endpoint.scheme}://${host}${path}${query === "" ? "" : `?${query}`}`;
  };
  const unsigned = options.payload === "unsigned" || (options.payload === "auto" && options.endpoint.scheme === "https");
  return {
    bucket: options.bucket,
    endpoint: options.endpoint,
    addressing: options.addressing,
    urlOf,
    send: async (call) => {
      const keys = await credentials();
      if (keys.kind === "err") return err({ kind: "credentials", message: keys.error });
      const url = urlOf(call);
      const signed = await sign(
        { method: call.method, url, headers: call.headers ?? {}, ...(call.body === undefined ? {} : { body: call.body }) },
        { credentials: keys.value, region: options.region, service: "s3", date: options.now(), unsignedPayload: unsigned },
      );
      const answer = await options.transport({ method: call.method, url, headers: signed.headers, ...(call.body === undefined ? {} : { body: call.body }) }, { timeoutMs: options.timeoutMs });
      if (answer.kind === "err") return err({ kind: "transport", message: answer.error });
      if (answer.value.status < 200 || answer.value.status >= 300) return err({ kind: "failure", failure: failureOf(answer.value) });
      return ok(answer.value);
    },
  };
}
