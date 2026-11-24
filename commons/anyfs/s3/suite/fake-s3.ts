/**
 * A server of S3 made in process, for the tests that need no binary and for those that need an endpoint that behaves in a way a real one does not (one that ignores a condition, one that does not check a
 * checksum). It speaks the subset the store uses over real HTTP on the loopback: a bucket made by `PUT`, an object by `PUT`, `GET`, `HEAD` and `DELETE` with `If-Match` and `If-None-Match`, `x-amz-meta-*`, `x-amz-checksum-sha256` checked and
 * echoed, `ListObjectsV2` with `prefix`, `start-after`, `continuation-token`, `max-keys` and `encoding-type=url`, the XML of an error, and Signature Version 4 *checked* (a request whose signature is not the one its
 * keys make is refused as S3 refuses it). The same contract tests run on it and on RustFS, which is how the tests know it behaves as a real server does.
 *
 * @module
 */
import { createHash } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { sign } from "@intellectual-frontiers/crypto/sigv4";

/** What the fake keeps or ignores. */
export type FakeConditions = {
  /** Whether `If-None-Match: *` on a write is honoured. */
  readonly ifNoneMatch: boolean;
  /** Whether `If-Match` on a write is honoured. */
  readonly ifMatch: boolean;
  /** Whether `If-Match` on a delete is honoured. */
  readonly ifMatchDelete: boolean;
  /** Whether `x-amz-checksum-sha256` is checked and echoed. */
  readonly checksum: boolean;
};

export type FakeOptions = {
  readonly conditions?: Partial<FakeConditions>;
  readonly accessKey?: string;
  readonly secretKey?: string;
  /** Fail the next requests with this status (and the code) instead of serving them. */
  /** Refuse every write and delete of an object as a key that may only read is refused. */
  readonly readOnly?: boolean;
  readonly fail?: { readonly status: number; readonly code: string; readonly times: number };
};

type Stored = { bytes: Uint8Array; meta: Record<string, string>; modified: Date };

/** A request the fake saw. */
export type Seen = { readonly method: string; readonly path: string; readonly query: string; readonly headers: Readonly<Record<string, string | string[] | undefined>> };

/** A running fake. */
export type Fake = {
  readonly endpoint: string;
  readonly accessKey: string;
  readonly secretKey: string;
  readonly seen: Seen[];
  /** The objects of a bucket, by key. */
  readonly objects: (bucket: string) => Map<string, Stored>;
  /** Fails the next `times` requests with the status and the code, as an overloaded service does. */
  readonly failNext: (status: number, code: string, times: number) => void;
  readonly stop: () => Promise<void>;
};

const md5 = (bytes: Uint8Array): string => createHash("md5").update(bytes).digest("hex");
const sha = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
const escapeXml = (t: string): string => t.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
/** The encoding S3 gives with `encoding-type=url`: every byte but the unreserved ones and `/` as %XX, the space as `+`. */
const encodeListed = (key: string): string => encodeURIComponent(key).replaceAll("%2F", "/").replace(/[!'()*]/gu, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`).replaceAll("%20", "+");

async function body(request: IncomingMessage): Promise<Uint8Array> {
  const parts: Buffer[] = [];
  for await (const chunk of request) parts.push(chunk as Buffer);
  return new Uint8Array(Buffer.concat(parts));
}

/** Starts a fake on the loopback. */
export async function startFake(options: FakeOptions = {}): Promise<Fake> {
  const conditions: FakeConditions = { ifNoneMatch: true, ifMatch: true, ifMatchDelete: true, checksum: true, ...options.conditions };
  const accessKey = options.accessKey ?? "AKIDFAKEACCESSKEY";
  const secretKey = options.secretKey ?? "fake-secret-key-for-tests";
  const buckets = new Map<string, Map<string, Stored>>();
  const seen: Seen[] = [];
  let failures = options.fail?.times ?? 0;
  let failing = options.fail ?? { status: 503, code: "SlowDown", times: 0 };

  const send = (res: ServerResponse, status: number, headers: Record<string, string>, payload: Uint8Array | string = ""): void => {
    const data = typeof payload === "string" ? Buffer.from(payload) : Buffer.from(payload);
    res.writeHead(status, { "content-length": String(data.length), ...headers });
    res.end(data);
  };
  const problem = (res: ServerResponse, method: string, status: number, code: string, message: string): void => {
    if (method === "HEAD") return send(res, status, {});
    send(res, status, { "content-type": "application/xml" }, `<?xml version="1.0" encoding="UTF-8"?><Error><Code>${code}</Code><Message>${escapeXml(message)}</Message><RequestId>fake</RequestId></Error>`);
  };

  const server = createServer(async (req, res) => {
    const payload = await body(req);
    const url = new URL(req.url ?? "/", "http://fake");
    const method = req.method ?? "GET";
    seen.push({ method, path: url.pathname, query: url.search, headers: { ...req.headers } });
    if (failures > 0) {
      failures--;
      return problem(res, method, failing.status, failing.code, "failed on purpose");
    }
    // Signature Version 4, checked as the service checks it
    const auth = req.headers["authorization"] ?? "";
    const m = /^AWS4-HMAC-SHA256 Credential=([^/]+)\/(\d{8})\/([^/]+)\/s3\/aws4_request, SignedHeaders=([^,]+), Signature=([0-9a-f]{64})$/u.exec(auth);
    if (m === null) return problem(res, method, 403, "AccessDenied", "no valid Authorization header");
    if (m[1] !== accessKey) return problem(res, method, 403, "InvalidAccessKeyId", "the access key id is not known");
    const signedNames = (m[4] ?? "").split(";");
    const given: Record<string, string> = {};
    for (const n of signedNames) {
      if (n === "host" || n === "x-amz-date") continue;
      const v = req.headers[n];
      given[n] = Array.isArray(v) ? v.join(",") : (v ?? "");
    }
    const amzDate = String(req.headers["x-amz-date"] ?? "");
    const date = new Date(`${amzDate.slice(0, 4)}-${amzDate.slice(4, 6)}-${amzDate.slice(6, 8)}T${amzDate.slice(9, 11)}:${amzDate.slice(11, 13)}:${amzDate.slice(13, 15)}Z`);
    const declared = String(req.headers["x-amz-content-sha256"] ?? "");
    if (declared !== "UNSIGNED-PAYLOAD" && declared !== sha(payload)) return problem(res, method, 400, "XAmzContentSHA256Mismatch", "the payload is not the one signed");
    const expected = await sign(
      { method, url: `http://${req.headers["host"] ?? "fake"}${req.url ?? "/"}`, headers: given, body: payload },
      { credentials: { accessKeyId: accessKey, secretAccessKey: secretKey }, region: m[3] ?? "us-east-1", service: "s3", date, unsignedPayload: declared === "UNSIGNED-PAYLOAD" },
    );
    if (expected.signature !== m[5]) return problem(res, method, 403, "SignatureDoesNotMatch", "the request signature does not match");

    const segments = url.pathname.split("/").slice(1);
    const bucket = decodeURIComponent(segments[0] ?? "");
    const key = segments.length > 1 ? segments.slice(1).map(decodeURIComponent).join("/") : "";
    if (key === "" && method === "PUT") {
      if (!buckets.has(bucket)) buckets.set(bucket, new Map());
      return send(res, 200, {});
    }
    const objects = buckets.get(bucket);
    if (objects === undefined) return problem(res, method, 404, "NoSuchBucket", "the bucket does not exist");

    if (key === "" && method === "GET") {
      const prefix = url.searchParams.get("prefix") ?? "";
      const max = Math.min(1000, Number.parseInt(url.searchParams.get("max-keys") ?? "1000", 10));
      const token = url.searchParams.get("continuation-token");
      const after = token !== null ? Buffer.from(token, "base64").toString("utf8") : (url.searchParams.get("start-after") ?? "");
      const encode = url.searchParams.get("encoding-type") === "url";
      const keys = [...objects.keys()].filter((k) => k.startsWith(prefix) && (after === "" || Buffer.compare(Buffer.from(k), Buffer.from(after)) > 0)).sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
      const page = keys.slice(0, max);
      const truncated = keys.length > page.length;
      const e = (k: string): string => escapeXml(encode ? encodeListed(k) : k);
      const contents = page
        .map((k) => {
          const o = objects.get(k) as Stored;
          return `<Contents><Key>${e(k)}</Key><LastModified>${o.modified.toISOString()}</LastModified><ETag>&quot;${md5(o.bytes)}&quot;</ETag><Size>${o.bytes.length}</Size><StorageClass>STANDARD</StorageClass></Contents>`;
        })
        .join("");
      const next = truncated ? `<NextContinuationToken>${Buffer.from(page[page.length - 1] ?? "").toString("base64")}</NextContinuationToken>` : "";
      return send(
        res,
        200,
        { "content-type": "application/xml" },
        `<?xml version="1.0" encoding="UTF-8"?><ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Name>${bucket}</Name><Prefix>${e(prefix)}</Prefix><KeyCount>${page.length}</KeyCount><MaxKeys>${max}</MaxKeys>${encode ? "<EncodingType>url</EncodingType>" : ""}<IsTruncated>${truncated}</IsTruncated>${next}${contents}</ListBucketResult>`,
      );
    }

    const have = objects.get(key);
    const etag = have === undefined ? undefined : md5(have.bytes);
    const quote = (t: string): string => t.replaceAll('"', "");
    const headersOf = (o: Stored): Record<string, string> => {
      const h: Record<string, string> = { etag: `"${md5(o.bytes)}"`, "last-modified": o.modified.toUTCString(), "content-type": "application/octet-stream" };
      for (const [k, v] of Object.entries(o.meta)) h[k] = v;
      if (conditions.checksum) h["x-amz-checksum-sha256"] = Buffer.from(sha(o.bytes), "hex").toString("base64");
      return h;
    };
    if (method === "GET" || method === "HEAD") {
      if (have === undefined) return problem(res, method, 404, "NoSuchKey", "the key does not exist");
      const h = headersOf(have);
      if (method === "HEAD") {
        res.writeHead(200, { ...h, "content-length": String(have.bytes.length) });
        return void res.end();
      }
      return send(res, 200, h, have.bytes);
    }
    if (options.readOnly === true && (method === "PUT" || method === "DELETE")) return problem(res, method, 403, "AccessDenied", "the key may only read");
    if (method === "PUT") {
      const ifNone = req.headers["if-none-match"];
      const ifMatch = req.headers["if-match"];
      if (conditions.ifNoneMatch && ifNone === "*" && have !== undefined) return problem(res, method, 412, "PreconditionFailed", "at least one of the preconditions you specified did not hold");
      if (conditions.ifMatch && typeof ifMatch === "string") {
        if (have === undefined) return problem(res, method, 404, "NoSuchKey", "the key does not exist");
        if (quote(ifMatch) !== etag) return problem(res, method, 412, "PreconditionFailed", "at least one of the preconditions you specified did not hold");
      }
      const meta: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers)) if (k.startsWith("x-amz-meta-") && typeof v === "string") meta[k] = v;
      if (conditions.checksum) {
        const claimed = req.headers["x-amz-checksum-sha256"];
        if (typeof claimed === "string" && claimed !== Buffer.from(sha(payload), "hex").toString("base64")) return problem(res, method, 400, "BadDigest", "the checksum does not match the bytes");
      }
      const stored: Stored = { bytes: payload, meta, modified: new Date() };
      objects.set(key, stored);
      const echo: Record<string, string> = { etag: `"${md5(payload)}"` };
      if (conditions.checksum && typeof req.headers["x-amz-checksum-sha256"] === "string") echo["x-amz-checksum-sha256"] = req.headers["x-amz-checksum-sha256"];
      return send(res, 200, echo);
    }
    if (method === "DELETE") {
      const ifMatch = req.headers["if-match"];
      if (conditions.ifMatchDelete && typeof ifMatch === "string") {
        if (have === undefined) return problem(res, method, 404, "NoSuchKey", "the key does not exist");
        if (quote(ifMatch) !== etag) return problem(res, method, 412, "PreconditionFailed", "at least one of the preconditions you specified did not hold");
      }
      objects.delete(key);
      return send(res, 204, {});
    }
    return problem(res, method, 405, "MethodNotAllowed", "not allowed");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  return {
    endpoint: `http://127.0.0.1:${port}`,
    accessKey,
    secretKey,
    seen,
    objects: (bucket) => buckets.get(bucket) ?? new Map<string, Stored>(),
    failNext: (status, code, times) => {
      failing = { status, code, times };
      failures = times;
    },
    stop: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
