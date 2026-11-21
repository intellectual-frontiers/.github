// Spec: 0002-anyfs-s3-store FR-009, FR-010, FR-011, FR-012, FR-013, FR-014
/**
 * The store over a bucket and a prefix of any S3-compatible service. It holds whole objects (up to `maxBytes`, 64 MiB where it is left out; multipart upload is a later capability and a larger object is refused),
 * and it says what it is by what it was found to keep: the probe of the endpoint decides whether it has `cas`, and a store that cannot keep a condition is made without it, in its type, so that code which needs
 * compare-and-write cannot be given one. A write expecting no object is `If-None-Match: *` and one expecting a revision is `If-Match` on the entity tag, so that of several writers exactly one wins; where the
 * endpoint ignores `If-None-Match` the store refuses to write expecting no object, and says why, and never lets two writers both think they made it.
 *
 * The revision of an object is, by default, `sha256:` and the digest of its bytes, kept in the metadata `x-amz-meta-anyfs-sha256` and checked on every read (and, where the service supports it, sent as
 * `x-amz-checksum-sha256` so that the service checks the bytes it received): the same bytes are the same revision here as in memory, on a disk or on a host, and a bridge compares them without reading
 * them. An object written by another tool has none, and its revision is the digest of what a read gives. With `revisions: "etag"` the revision is `etag:` and the entity tag, which costs no read and no request for a
 * listing, and is the same only between stores of S3.
 *
 * @remarks
 * Limits, said once: a read keeps the whole object in memory; the metadata of an object is trusted by `stat` and a listing, and checked only by a read; a listing in the default mode asks for each object it lists
 * (a few at a time, `listConcurrency`) because a listing does not carry the metadata; a rename, a batch, a history, a range and an append are not here; a call is not retried here, and the layer `retrying` does it
 * for the problems that say they are worth one.
 *
 * @example
 * ```ts
 * import { openS3Store } from "./store.ts";
 * // const opened = await openS3Store({ place, credentials, endpoint: "http://127.0.0.1:9000" });
 * // opened.kind === "ok" && opened.value.mode; // "cas"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { fromHex } from "@intellectual-frontiers/formats/hex";
import { toBase64 } from "@intellectual-frontiers/formats/base64";
import { makeStore, type Handler, type Op, type Stat, type Store } from "@intellectual-frontiers/anyfs/logical";
import {
  conflict,
  type Consistency,
  type Cursor,
  type Expect,
  type Found,
  formatPlace,
  parseCursor,
  type Path,
  type Place,
  type Problem,
  refused,
  type Revision,
  tampered,
  unavailable,
} from "@intellectual-frontiers/anyfs/governance";
import { type BucketName, parseBucketName } from "./bucket.ts";
import { type Addressing, awsEndpoint, type CallError, type Endpoint, makeClient, parseEndpoint, type PayloadSigning, type S3Client } from "./client.ts";
import type { CredentialSource } from "./credentials.ts";
import { kindOf, problemOf, type Subject } from "./errors.ts";
import { decodeListedKey, keyOf, pathOfKey } from "./keys.ts";
import { casOf, type Facts, probeEndpoint } from "./probe.ts";
import { fetchTransport, type Transport } from "./transport.ts";
import { parseListing } from "./xml.ts";

/** The place of a store of S3. */
export type S3Place = Extract<Place, { readonly kind: "s3" }>;

/** What a revision is made of: the digest of the bytes, or the entity tag. */
export type RevisionMode = "sha256" | "etag";

/** The capabilities of a store that can only read. */
export const READ_CAPABILITIES = ["read", "list", "stat"] as const;
/** The capabilities of a store of an endpoint that does not keep every condition. */
export const PLAIN_CAPABILITIES = ["read", "write", "list", "stat", "delete"] as const;
/** The capabilities of a store of an endpoint that keeps every condition. */
export const CAS_CAPABILITIES = ["read", "write", "list", "stat", "delete", "cas"] as const;

/** A store that can only read. */
export type S3ReadStore = Store<(typeof READ_CAPABILITIES)[number]>;
/** A store without compare-and-write. */
export type S3PlainStore = Store<(typeof PLAIN_CAPABILITIES)[number]>;
/** A store with compare-and-write. */
export type S3CasStore = Store<(typeof CAS_CAPABILITIES)[number]>;

/** What a store is made with. */
export type S3Options = {
  /** The bucket and the prefix: `parsePlace("s3://bucket/prefix")`. */
  readonly place: S3Place;
  readonly credentials: CredentialSource;
  /** Where the service listens. Amazon S3 in the region where it is left out. */
  readonly endpoint?: string;
  /** The region of the signature. `us-east-1` where it is left out. */
  readonly region?: string;
  /** How the bucket is written in a URL: virtual-hosted style for Amazon S3 with a bucket that has no dot, path style otherwise. */
  readonly addressing?: Addressing;
  /** What a revision is. `sha256` where it is left out. */
  readonly revisions?: RevisionMode;
  /** The most bytes an object may have. 64 MiB where it is left out. */
  readonly maxBytes?: number;
  readonly transport?: Transport;
  /** How long a request may take. 30 s where it is left out. */
  readonly timeoutMs?: number;
  readonly payload?: PayloadSigning;
  /** How many objects a listing asks about at once. 16 where it is left out. */
  readonly listConcurrency?: number;
  readonly consistency?: Consistency;
  readonly now?: () => Date;
};

/** What the store was found to be. */
export type S3Facts = {
  readonly probe: Facts;
  readonly revisions: RevisionMode;
  /** What a bridge may take a revision for: the digest of the bytes, or an entity tag. */
  readonly digest: "sha256-native" | "etag";
  readonly endpoint: Endpoint;
  readonly addressing: Addressing;
};

/** A store of S3 and what it was found to be: the mode says which capabilities it has, and the type follows the mode. */
export type Opened =
  | { readonly mode: "cas"; readonly store: S3CasStore; readonly facts: S3Facts; readonly client: S3Client }
  | { readonly mode: "plain"; readonly store: S3PlainStore; readonly facts: S3Facts; readonly client: S3Client }
  | { readonly mode: "read-only"; readonly store: S3ReadStore; readonly facts: S3Facts; readonly client: S3Client };

const DEFAULT_MAX = 64 * 1024 * 1024;
const PAGE = 1000;
const MAX_FETCHES = 200;
const HEX64 = /^[0-9a-f]{64}$/u;

const quoted = (etag: string): string => `"${etag}"`;

/** The problem a failed call is. */
function problemOfCall(e: CallError, subject: Subject): Problem {
  switch (e.kind) {
    case "transport":
      return unavailable(e.message, true, subject.path);
    case "credentials":
      return unavailable(e.message, false, subject.path);
    case "failure":
      return problemOf(e.failure, subject);
    default:
      return unavailable("a failure of no known kind", false, subject.path);
  }
}

/** A revision from text: a parsed one, never a cast of text that was not checked. */
const revision = (text: string): Revision => text as Revision;

async function mapLimit<T, R>(items: readonly T[], limit: number, f: (item: T) => Promise<R>): Promise<readonly R[]> {
  const out: R[] = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await f(items[i] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return out;
}

/** What the headers of an object say of it. */
type Head = { readonly size: number; readonly etag: string; readonly modified?: string; readonly digest?: string };

function headOf(headers: Readonly<Record<string, string>>): Result<Head, string> {
  const size = Number.parseInt(headers["content-length"] ?? "", 10);
  if (!Number.isSafeInteger(size) || size < 0) return err("the service gave no size for the object");
  const meta = headers["x-amz-meta-anyfs-sha256"];
  const stamp = headers["last-modified"] === undefined ? Number.NaN : Date.parse(headers["last-modified"]);
  return ok({ size, etag: (headers["etag"] ?? "").replaceAll('"', ""), ...(Number.isNaN(stamp) ? {} : { modified: new Date(stamp).toISOString() }), ...(meta !== undefined && HEX64.test(meta) ? { digest: meta } : {}) });
}

/** A store of S3, or why there is none. The probe runs once, here, and the store is made as what the probe found. */
export async function openS3Store(options: S3Options): Promise<Result<Opened, string>> {
  const bucket = parseBucketName(options.place.bucket);
  if (bucket.kind === "err") return bucket;
  const region = options.region ?? "us-east-1";
  let endpoint: Endpoint;
  if (options.endpoint === undefined) endpoint = awsEndpoint(region);
  else {
    const parsed = parseEndpoint(options.endpoint);
    if (parsed.kind === "err") return parsed;
    endpoint = parsed.value;
  }
  const addressing: Addressing = options.addressing ?? (options.endpoint === undefined && !bucket.value.includes(".") ? "virtual" : "path");
  const maxBytes = options.maxBytes ?? DEFAULT_MAX;
  const mode: RevisionMode = options.revisions ?? "sha256";
  const concurrency = options.listConcurrency ?? 16;
  const client = makeClient({
    endpoint,
    region,
    bucket: bucket.value as BucketName,
    addressing,
    credentials: options.credentials,
    transport: options.transport ?? fetchTransport(),
    timeoutMs: options.timeoutMs ?? 30_000,
    payload: options.payload ?? "auto",
    now: options.now ?? (() => new Date()),
  });
  const prefix = options.place.prefix;
  const base = prefix === "" ? "" : `${prefix}/`;
  const probed = await probeEndpoint(client, base);
  if (probed.kind === "err") return probed;
  const facts = probed.value;
  const s3facts: S3Facts = { probe: facts, revisions: mode, digest: mode === "sha256" ? "sha256-native" : "etag", endpoint, addressing };

  const keyFor = (path: Path): Result<string, Problem> => {
    const k = keyOf(prefix, path);
    return k.kind === "ok" ? k : err(refused("unportable-path", k.error, path));
  };
  const ownName = (path: Path): Problem | undefined => (path.split("/").some((s) => s.startsWith(".anyfs-")) ? refused("unportable-path", "names that begin with .anyfs- are the store's own", path) : undefined);

  const headObject = async (path: Path, key: string): Promise<Result<Head, Problem>> => {
    const answer = await client.send({ method: "HEAD", key });
    if (answer.kind === "err") return err(problemOfCall(answer.error, { path }));
    const h = headOf(answer.value.headers);
    return h.kind === "ok" ? h : err(unavailable(h.error, false, path));
  };

  /** The revision of an object that has been asked about: the one its mode says, from what is known, and from its bytes where the metadata is not there. */
  const revisionOfHead = async (path: Path, key: string, head: Head): Promise<Result<Revision, Problem>> => {
    if (mode === "etag") return head.etag === "" ? err(unavailable("the service gave no entity tag for the object", false, path)) : ok(revision(`etag:${head.etag}`));
    if (head.digest !== undefined) return ok(revision(`sha256:${head.digest}`));
    if (head.size > maxBytes) return err(refused("too-large", `${head.size} bytes are more than the ${maxBytes} this store takes, and the object has no digest to go by`, path));
    const got = await client.send({ method: "GET", key });
    if (got.kind === "err") return err(problemOfCall(got.error, { path }));
    return ok(revision(`sha256:${await sha256(got.value.body)}`));
  };

  const foundOf = async (path: Path, key: string): Promise<Found | Problem> => {
    const head = await headObject(path, key);
    if (head.kind === "err") return head.error.kind === "missing" ? { kind: "absent" } : head.error;
    const rev = await revisionOfHead(path, key, head.value);
    return rev.kind === "ok" ? { kind: "rev", rev: rev.value } : rev.error;
  };

  /** A conflict about an object: what it is at now. */
  const conflictAt = async (path: Path, key: string, expect: Expect): Promise<Problem> => {
    const found = await foundOf(path, key);
    return "kind" in found && (found.kind === "absent" || found.kind === "rev") ? conflict(path, expect, found as Found) : (found as Problem);
  };

  /** The condition an expectation puts on a write or a delete, or the conflict or refusal it is already. */
  const conditionFor = async (path: Path, key: string, expect: Expect): Promise<Result<Readonly<Record<string, string>>, Problem>> => {
    switch (expect.kind) {
      case "any":
        return ok({});
      case "absent":
        return facts.ifNoneMatch ? ok({ "if-none-match": "*" }) : err(refused("unsupported-expectation", "the service ignores If-None-Match, so a write cannot be made to expect no object without two writers both winning", path));
      case "rev": {
        const wanted = expect.rev as string;
        if (mode === "etag") {
          return wanted.startsWith("etag:") && wanted.length > 5 ? ok({ "if-match": quoted(wanted.slice(5)) }) : err(refused("unsupported-expectation", `${wanted} is not a revision of this store: a revision is etag: and the entity tag`, path));
        }
        if (!wanted.startsWith("sha256:") || !HEX64.test(wanted.slice(7))) return err(refused("unsupported-expectation", `${wanted} is not a revision of this store: a revision is sha256: and the digest of the bytes`, path));
        const head = await headObject(path, key);
        if (head.kind === "err") return err(head.error.kind === "missing" ? conflict(path, expect, { kind: "absent" }) : head.error);
        const have = await revisionOfHead(path, key, head.value);
        if (have.kind === "err") return have;
        if (have.value !== expect.rev) return err(conflict(path, expect, { kind: "rev", rev: have.value }));
        return head.value.etag === "" ? err(unavailable("the service gave no entity tag to hold the write to", false, path)) : ok({ "if-match": quoted(head.value.etag) });
      }
      default:
        return err(unavailable("an expectation of no known kind", false, path));
    }
  };

  const handle: Handler = async (op: Op) => {
    switch (op.op) {
      case "read": {
        const own = ownName(op.path);
        if (own !== undefined) return err(own);
        const key = keyFor(op.path);
        if (key.kind === "err") return err(key.error);
        const got = await client.send({ method: "GET", key: key.value });
        if (got.kind === "err") return err(problemOfCall(got.error, { path: op.path }));
        const bytes = got.value.body;
        if (bytes.length > maxBytes) return err(refused("too-large", `${bytes.length} bytes are more than the ${maxBytes} this store takes`, op.path));
        const head = headOf({ ...got.value.headers, "content-length": String(bytes.length) });
        if (head.kind === "err") return err(unavailable(head.error, false, op.path));
        const digest = await sha256(bytes);
        if (head.value.digest !== undefined && head.value.digest !== digest) return err(tampered(op.path, "the bytes are not the ones their digest in the metadata says they are"));
        const rev = mode === "etag" ? (head.value.etag === "" ? undefined : revision(`etag:${head.value.etag}`)) : revision(`sha256:${digest}`);
        if (rev === undefined) return err(unavailable("the service gave no entity tag for the object", false, op.path));
        return ok({ op: "read", value: { bytes, rev, ...(head.value.modified === undefined ? {} : { modified: head.value.modified }) } });
      }
      case "stat": {
        const own = ownName(op.path);
        if (own !== undefined) return err(own);
        const key = keyFor(op.path);
        if (key.kind === "err") return err(key.error);
        const head = await headObject(op.path, key.value);
        if (head.kind === "err") return err(head.error);
        const rev = await revisionOfHead(op.path, key.value, head.value);
        if (rev.kind === "err") return err(rev.error);
        const value: Stat = { path: op.path, size: head.value.size, rev: rev.value, ...(head.value.modified === undefined ? {} : { modified: head.value.modified }) };
        return ok({ op: "stat", value });
      }
      case "write": {
        const own = ownName(op.path);
        if (own !== undefined) return err(own);
        if (op.bytes.length > maxBytes) return err(refused("too-large", `${op.bytes.length} bytes are more than the ${maxBytes} this store takes`, op.path));
        const key = keyFor(op.path);
        if (key.kind === "err") return err(key.error);
        const hex = await sha256(op.bytes);
        const headers: Record<string, string> = { "content-type": "application/octet-stream", "x-amz-meta-anyfs-sha256": hex };
        if (facts.checksum) headers["x-amz-checksum-sha256"] = toBase64(fromHex(hex) ?? new Uint8Array());
        const condition = await conditionFor(op.path, key.value, op.expect);
        if (condition.kind === "err") return err(condition.error);
        const put = (extra: Readonly<Record<string, string>>) => client.send({ method: "PUT", key: key.value, body: op.bytes, headers: { ...headers, ...extra } });
        let created = op.expect.kind === "absent";
        let sent;
        if (op.expect.kind === "any") {
          // the first attempt of a write that expects nothing asks for no object, so that it knows whether it made one; where an object is, it replaces it
          if (facts.ifNoneMatch) {
            sent = await put({ "if-none-match": "*" });
            created = sent.kind === "ok";
            if (sent.kind === "err" && sent.error.kind === "failure" && kindOf(sent.error.failure) === "precondition") sent = await put({});
          } else {
            const before = await headObject(op.path, key.value);
            created = before.kind === "err" && before.error.kind === "missing";
            sent = await put({});
          }
        } else {
          sent = await put(condition.value);
        }
        if (sent.kind === "err") {
          const e = sent.error;
          if (e.kind === "failure") {
            const kind = kindOf(e.failure);
            if (op.expect.kind !== "any" && (kind === "precondition" || kind === "in-progress")) return err(await conflictAt(op.path, key.value, op.expect));
            if (op.expect.kind === "rev" && kind === "not-found") return err(conflict(op.path, op.expect, { kind: "absent" }));
          }
          return err(problemOfCall(e, { path: op.path }));
        }
        if (facts.checksum) {
          const echoed = sent.value.headers["x-amz-checksum-sha256"];
          if (echoed !== undefined && echoed !== toBase64(fromHex(hex) ?? new Uint8Array())) return err(tampered(op.path, "the service holds bytes that are not the ones sent"));
        }
        const etag = (sent.value.headers["etag"] ?? "").replaceAll('"', "");
        const rev = mode === "etag" ? (etag === "" ? undefined : revision(`etag:${etag}`)) : revision(`sha256:${hex}`);
        if (rev === undefined) return err(unavailable("the service gave no entity tag for the object written", false, op.path));
        return ok({ op: "write", value: { rev, created } });
      }
      case "delete": {
        const own = ownName(op.path);
        if (own !== undefined) return err(own);
        const key = keyFor(op.path);
        if (key.kind === "err") return err(key.error);
        const head = await headObject(op.path, key.value);
        const exists = head.kind === "ok";
        if (head.kind === "err" && head.error.kind !== "missing") return err(head.error);
        if (op.expect.kind === "absent") {
          if (exists) return err(await conflictAt(op.path, key.value, op.expect));
          return ok({ op: "delete", value: { existed: false } });
        }
        if (op.expect.kind === "rev") {
          if (!exists) return err(conflict(op.path, op.expect, { kind: "absent" }));
          const condition = await conditionFor(op.path, key.value, op.expect);
          if (condition.kind === "err") return err(condition.error);
          const done = await client.send({ method: "DELETE", key: key.value, headers: condition.value });
          if (done.kind === "err") {
            const e = done.error;
            if (e.kind === "failure" && (kindOf(e.failure) === "precondition" || kindOf(e.failure) === "in-progress")) return err(await conflictAt(op.path, key.value, op.expect));
            if (e.kind === "failure" && kindOf(e.failure) === "not-found") return err(conflict(op.path, op.expect, { kind: "absent" }));
            return err(problemOfCall(e, { path: op.path }));
          }
          return ok({ op: "delete", value: { existed: true } });
        }
        const done = await client.send({ method: "DELETE", key: key.value });
        if (done.kind === "err" && !(done.error.kind === "failure" && kindOf(done.error.failure) === "not-found")) return err(problemOfCall(done.error, { path: op.path }));
        return ok({ op: "delete", value: { existed: exists } });
      }
      case "list": {
        const limit = Math.min(Math.max(1, Math.floor(op.limit ?? PAGE)), PAGE);
        const listPrefix = `${base}${op.prefix === "" ? "" : `${op.prefix}/`}`;
        let startAfter: string | undefined;
        if (op.after !== undefined) {
          let last: string;
          try {
            last = decodeURIComponent(op.after);
          } catch {
            return err(unavailable("the cursor is not one this store made", false));
          }
          startAfter = `${base}${last}`;
        }
        const found: { readonly path: Path; readonly size: number; readonly etag: string; readonly modified?: string }[] = [];
        let more = false;
        for (let fetches = 0; fetches < MAX_FETCHES; fetches++) {
          const query: Record<string, string> = { "list-type": "2", "encoding-type": "url", prefix: listPrefix, "max-keys": String(Math.min(PAGE, limit + 1)) };
          if (startAfter !== undefined) query["start-after"] = startAfter;
          const answer = await client.send({ method: "GET", query });
          if (answer.kind === "err") return err(problemOfCall(answer.error, {}));
          const page = parseListing(new TextDecoder().decode(answer.value.body));
          if (page.kind === "err") return err(unavailable(`the listing could not be read: ${page.error}`, false));
          let lastKey: string | undefined;
          for (const o of page.value.objects) {
            const decoded = decodeListedKey(o.key);
            if (decoded.kind === "err") return err(unavailable(decoded.error, false));
            lastKey = decoded.value;
            const path = pathOfKey(prefix, decoded.value);
            // a key that is not the key of a path of the store (not normalized, a name the store keeps, outside the prefix) is not listed: it is no object of the store
            if (path.kind === "err") continue;
            found.push({ path: path.value, size: o.size, etag: o.etag, ...(o.modified === undefined ? {} : { modified: new Date(o.modified).toISOString() }) });
          }
          if (found.length > limit) {
            more = true;
            break;
          }
          if (!page.value.truncated || lastKey === undefined) break;
          startAfter = lastKey;
        }
        const entries = found.slice(0, limit);
        const stats = await mapLimit(entries, concurrency, async (e): Promise<Result<Stat, Problem>> => {
          if (mode === "etag") return ok({ path: e.path, size: e.size, rev: revision(`etag:${e.etag}`), ...(e.modified === undefined ? {} : { modified: e.modified }) });
          const k = keyOf(prefix, e.path);
          if (k.kind === "err") return err(refused("unportable-path", k.error, e.path));
          const head = await headObject(e.path, k.value);
          if (head.kind === "err") return err(head.error);
          const rev = await revisionOfHead(e.path, k.value, head.value);
          return rev.kind === "err" ? rev : ok({ path: e.path, size: head.value.size, rev: rev.value, ...(e.modified === undefined ? {} : { modified: e.modified }) });
        });
        const out: Stat[] = [];
        for (const s of stats) {
          if (s.kind === "err") {
            // an object that went between the listing and the question is not in the list; any other problem is the list's
            if (s.error.kind === "missing") continue;
            return err(s.error);
          }
          out.push(s.value);
        }
        const last = entries[entries.length - 1];
        let next: Cursor | undefined;
        if (more && last !== undefined) {
          const c = parseCursor(encodeURIComponent(last.path));
          if (c.kind === "err") return err(unavailable(c.error, false));
          next = c.value;
        }
        return ok({ op: "list", value: next === undefined ? { entries: out } : { entries: out, next } });
      }
      case "batch":
      case "rename":
      case "history":
      case "rangeRead":
      case "append":
      case "search":
        return err(refused("capability-absent", `a store of S3 does not have ${op.op}`));
      default:
        return err(unavailable("an operation of no known kind", false));
    }
  };

  const place: Place = options.place;
  const spec = { id: formatPlace(place), place, consistency: options.consistency ?? ("strong" as const), traits: { caseSensitive: true, maxObject: maxBytes }, handle };
  if (!facts.writable) return ok({ mode: "read-only", store: makeStore({ ...spec, capabilities: READ_CAPABILITIES }), facts: s3facts, client });
  if (casOf(facts)) return ok({ mode: "cas", store: makeStore({ ...spec, capabilities: CAS_CAPABILITIES }), facts: s3facts, client });
  return ok({ mode: "plain", store: makeStore({ ...spec, capabilities: PLAIN_CAPABILITIES }), facts: s3facts, client });
}
