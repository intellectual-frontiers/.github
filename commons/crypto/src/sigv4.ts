// Spec: 0001-crypto FR-004
/**
 * AWS Signature Version 4 (commons 0001-crypto FR-004): an HTTP request signed with `AWS4-HMAC-SHA256`, by HMAC-SHA256 on
 * Web Crypto, from its parts or from a web `Request`. The canonical request (the method; the path normalized and encoded twice, except for
 * S3, which signs it as given, encoded once; the query sorted and encoded by RFC 3986; the headers in lower case, trimmed, sorted and
 * signed with `host` and `x-amz-date`; the payload's SHA-256), the string to sign over the credential scope, the key derived from the
 * secret through the day, region, service and `aws4_request`, and the `Authorization` header. The time is the caller's: the kernel reads
 * no clock. Checked against AWS's published examples.
 *
 * @example
 * ```ts
 * import { sign } from "./sigv4.ts";
 * const credentials = { accessKeyId: "AKIDEXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY" }; // AWS's example key
 * const signed = await sign(
 *   { method: "GET", url: "https://iam.amazonaws.com/?Action=ListUsers&Version=2010-05-08", headers: {} },
 *   { credentials, region: "us-east-1", service: "iam", date: new Date() },
 * );
 * signed.headers; // the request's headers with x-amz-date and authorization added, never host
 * ```
 *
 * @module
 */
import { toHex } from "@intellectual-frontiers/formats/hex";
import { sha256 } from "./sha256.ts";

/** An access key: its id, its secret, and a session token where the key is temporary. */
export type AwsCredentials = {
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly sessionToken?: string;
};

/** How to sign. */
export type SigV4Options = {
  readonly credentials: AwsCredentials;
  /** The region of the credential scope (`us-east-1`). */
  readonly region: string;
  /** The service of the credential scope (`iam`, `sts`, `s3`, `ec2`). */
  readonly service: string;
  /** The time of signing, which becomes `x-amz-date` (the kernel reads no clock). */
  readonly date: Date;
  /** Sign `UNSIGNED-PAYLOAD` instead of the body's SHA-256 (S3 allows it). */
  readonly unsignedPayload?: boolean;
  /** Also send the payload's hash as `x-amz-content-sha256` (always for S3, which requires it). */
  readonly contentSha256Header?: boolean;
};

/** A request to sign, by its parts. */
export type SigV4Request = {
  readonly method: string;
  /** The whole URL, as text (its path is signed as written there, before any normalization a URL parser would make). */
  readonly url: string;
  /** The headers to send; each is signed, but for those a transport may change (`user-agent`, `traceparent`, ...). */
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: string | Uint8Array;
};

/** A signed request: the headers to send and, for whoever must check them, what was signed. */
export type Signed = {
  /**
   * The request's headers with `x-amz-date`, `x-amz-security-token` and `x-amz-content-sha256` where they apply, and `authorization`;
   * never `host`, which the transport sets from the URL.
   */
  readonly headers: Readonly<Record<string, string>>;
  readonly canonicalRequest: string;
  readonly stringToSign: string;
  /** The signature, 64 lower-case hexadecimal digits. */
  readonly signature: string;
  /** The value of the `Authorization` header. */
  readonly authorization: string;
};

/** The algorithm's name, as the string to sign and the `Authorization` header begin. */
export const ALGORITHM = "AWS4-HMAC-SHA256";

/** What is signed in place of a body's hash where the payload is not signed. */
export const UNSIGNED_PAYLOAD = "UNSIGNED-PAYLOAD";

// Headers a transport, a proxy or a tracer may add or change after signing: never signed, so that changing them breaks no signature.
const UNSIGNED_HEADERS = new Set(["authorization", "connection", "expect", "user-agent", "x-amzn-trace-id", "traceparent", "tracestate"]);

const encoder = new TextEncoder();

/** RFC 3986 percent-encoding, as SigV4 wants it: everything but `A-Z a-z 0-9 - _ . ~` encoded, in upper-case hexadecimal. */
export function uriEncode(text: string): string {
  return encodeURIComponent(text).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function decoded(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/** `20150830T123600Z`: the time as `x-amz-date` writes it. */
export function amzDate(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

/** The authority, path and query of a URL as written, without parsing (and so without normalizing) its path. */
function urlParts(url: string): { readonly host: string; readonly path: string; readonly query: string } {
  const m = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/([^/?#]*)([^?#]*)(?:\?([^#]*))?/.exec(url);
  if (m === null) return { host: "", path: "/", query: "" };
  const authority = m[1] ?? "";
  const host = authority.slice(authority.lastIndexOf("@") + 1);
  return { host, path: m[2] === undefined || m[2] === "" ? "/" : m[2], query: m[3] ?? "" };
}

/**
 * The path as SigV4 signs it. For a service other than S3: `.` and `..` segments resolved and empty segments dropped, each segment
 * decoded and encoded twice (RFC 3986). For S3: the path as given, each segment decoded and encoded once.
 */
export function canonicalPath(path: string, service: string): string {
  const absolute = path.startsWith("/");
  const raw = path.split("/");
  if (service === "s3") return raw.map((s) => uriEncode(decoded(s))).join("/") || "/";
  const segments: string[] = [];
  for (const s of raw) {
    if (s === "" || s === ".") continue;
    if (s === "..") segments.pop();
    else segments.push(s);
  }
  const trailing = segments.length > 0 && path.endsWith("/") ? "/" : "";
  const joined = segments.map((s) => uriEncode(uriEncode(decoded(s)))).join("/");
  return `${absolute ? "/" : ""}${joined}${trailing}` || "/";
}

/** The query as SigV4 signs it: each name and value decoded and encoded by RFC 3986, a name without `=` given an empty value, sorted. */
export function canonicalQuery(query: string): string {
  if (query === "") return "";
  const pairs = query
    .split("&")
    .filter((p) => p !== "")
    .map((p): readonly [string, string] => {
      const eq = p.indexOf("=");
      const name = eq < 0 ? p : p.slice(0, eq);
      const value = eq < 0 ? "" : p.slice(eq + 1);
      return [uriEncode(decoded(name)), uriEncode(decoded(value))];
    });
  pairs.sort(([a, x], [b, y]) => (a < b ? -1 : a > b ? 1 : x < y ? -1 : x > y ? 1 : 0));
  return pairs.map(([k, v]) => `${k}=${v}`).join("&");
}

async function hmac(key: Uint8Array, data: string): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", new Uint8Array(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, encoder.encode(data)));
}

/** The signing key: HMAC-SHA256 of `AWS4` and the secret through the day (`YYYYMMDD`), the region, the service and `aws4_request`. */
export async function signingKey(secretAccessKey: string, day: string, region: string, service: string): Promise<Uint8Array> {
  let k = await hmac(encoder.encode(`AWS4${secretAccessKey}`), day);
  for (const part of [region, service, "aws4_request"]) k = await hmac(k, part);
  return k;
}

/** A request signed by Signature Version 4 (FR-068): the headers to send, and the canonical request, string to sign and signature. */
export async function sign(request: SigV4Request, options: SigV4Options): Promise<Signed> {
  const { credentials, region, service } = options;
  const when = amzDate(options.date);
  const day = when.slice(0, 8);
  const url = urlParts(request.url);
  const body = request.body ?? "";
  const payload = options.unsignedPayload === true ? UNSIGNED_PAYLOAD : await sha256(body);
  const send = new Map<string, { readonly name: string; readonly value: string }>();
  for (const [name, value] of Object.entries(request.headers)) {
    const lower = name.toLowerCase();
    const before = send.get(lower);
    send.set(lower, { name, value: before === undefined ? value : `${before.value},${value}` });
  }
  const put = (name: string, value: string): void => void send.set(name, { name, value });
  put("x-amz-date", when);
  if (credentials.sessionToken !== undefined) put("x-amz-security-token", credentials.sessionToken);
  if (options.contentSha256Header === true || service === "s3") put("x-amz-content-sha256", payload);
  const host = send.get("host")?.value ?? url.host;
  const signedValues = new Map<string, string>([["host", host]]);
  for (const [lower, { value }] of send) if (!UNSIGNED_HEADERS.has(lower) && lower !== "host") signedValues.set(lower, value);
  const names = [...signedValues.keys()].sort();
  const canonicalHeaders = names.map((n) => `${n}:${(signedValues.get(n) ?? "").trim().replace(/\s+/g, " ")}\n`).join("");
  const signedHeaders = names.join(";");
  const canonicalRequest = [
    request.method.toUpperCase(),
    canonicalPath(url.path, service),
    canonicalQuery(url.query),
    canonicalHeaders,
    signedHeaders,
    payload,
  ].join("\n");
  const scope = `${day}/${region}/${service}/aws4_request`;
  const stringToSign = [ALGORITHM, when, scope, await sha256(canonicalRequest)].join("\n");
  const signature = toHex(await hmac(await signingKey(credentials.secretAccessKey, day, region, service), stringToSign));
  const authorization = `${ALGORITHM} Credential=${credentials.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const headers: Record<string, string> = {};
  for (const [lower, { name, value }] of send) if (lower !== "host" && lower !== "authorization") headers[name] = value;
  headers["authorization"] = authorization;
  return { headers, canonicalRequest, stringToSign, signature, authorization };
}

/**
 * A web `Request` signed by Signature Version 4 (FR-068): a new `Request` with the same method, URL and body and the signed headers. Its
 * body is read once (from a clone) to be hashed. The URL is the one the `Request` holds, which a URL parser has already normalized.
 */
export async function signRequest(request: Request, options: SigV4Options): Promise<Request> {
  const hasBody = request.method !== "GET" && request.method !== "HEAD" && request.body !== null;
  const body = hasBody ? new Uint8Array(await request.clone().arrayBuffer()) : undefined;
  const headers: Record<string, string> = {};
  request.headers.forEach((value, name) => {
    headers[name] = value;
  });
  const signed = await sign({ method: request.method, url: request.url, headers, ...(body === undefined ? {} : { body }) }, options);
  return new Request(request.url, { method: request.method, headers: signed.headers, ...(body === undefined ? {} : { body }) });
}
