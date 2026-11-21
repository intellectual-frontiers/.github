// Spec: 0002-anyfs-s3-store FR-008
/**
 * What an endpoint keeps, found by asking it and never by assuming: S3-compatible services differ in whether they honour a condition on a write (`If-None-Match: *`, `If-Match`) and on a delete (`If-Match`), and a store
 * that claimed compare-and-write on one that ignores the condition would let two writers both win. The probe writes an object of its own below the prefix of the store (a name that begins with `.anyfs-probe-` and a random
 * text, which the store never shows), asks each question with the object in a state that decides it, and removes the object whatever the answers were. An answer that is not the one that proves the condition honoured (a
 * `200` where a `412` was due, or any other failure) is a condition not kept: the store is then made without `cas`. A key the credentials may not write is a store that can only read.
 *
 * @example
 * ```ts
 * import { casOf } from "./probe.ts";
 * casOf({ writable: true, ifNoneMatch: true, ifMatch: true, conditionalDelete: true, checksum: false }); // true
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { fromHex } from "@intellectual-frontiers/formats/hex";
import { toBase64 } from "@intellectual-frontiers/formats/base64";
import { type CallError, type S3Client } from "./client.ts";
import { describeFailure, kindOf } from "./errors.ts";

/** What an endpoint was found to keep. */
export type Facts = {
  /** Whether the credentials may write. Where they may not, nothing else is known. */
  readonly writable: boolean;
  /** Whether a write with `If-None-Match: *` fails where an object is. */
  readonly ifNoneMatch: boolean;
  /** Whether a write with `If-Match` fails where the entity tag is another and succeeds where it is the same. */
  readonly ifMatch: boolean;
  /** Whether a delete with `If-Match` fails where the entity tag is another and keeps the object. */
  readonly conditionalDelete: boolean;
  /** Whether the service checks and returns `x-amz-checksum-sha256`. */
  readonly checksum: boolean;
};

/** Whether the endpoint keeps what compare-and-write needs: every condition. */
export const casOf = (f: Facts): boolean => f.writable && f.ifNoneMatch && f.ifMatch && f.conditionalDelete;

/** The sentence a call error is, for the person who opens a store. */
export function describeCallError(e: CallError): string {
  switch (e.kind) {
    case "transport":
    case "credentials":
      return e.message;
    case "failure":
      return describeFailure(e.failure);
    default:
      return "a failure of no known kind";
  }
}

const etagOf = (headers: Readonly<Record<string, string>>): string => (headers["etag"] ?? "").replaceAll('"', "");
const quoted = (etag: string): string => `"${etag}"`;

/** The probe of an endpoint below the key prefix of a store: the facts, or why the bucket cannot be used at all. */
export async function probeEndpoint(client: S3Client, base: string, random: () => string = () => crypto.randomUUID()): Promise<Result<Facts, string>> {
  const reach = await client.send({ method: "GET", query: { "list-type": "2", "max-keys": "1", prefix: base } });
  if (reach.kind === "err") {
    const e = reach.error;
    if (e.kind === "failure" && kindOf(e.failure) === "no-bucket") return err(`the bucket ${client.bucket} does not exist`);
    return err(`the bucket ${client.bucket} cannot be listed: ${describeCallError(e)}`);
  }
  const key = `${base}.anyfs-probe-${random()}`;
  const put = async (body: string, condition: Readonly<Record<string, string>> = {}): Promise<Result<Readonly<Record<string, string>>, CallError>> => {
    const bytes = new TextEncoder().encode(body);
    const hex = await sha256(bytes);
    const digest = fromHex(hex) ?? new Uint8Array();
    const answer = await client.send({ method: "PUT", key, body: bytes, headers: { "content-type": "application/octet-stream", "x-amz-checksum-sha256": toBase64(digest), ...condition } });
    return answer.kind === "ok" ? ok(answer.value.headers) : answer;
  };
  const refusedBy = (r: Result<unknown, CallError>): boolean => r.kind === "err" && r.error.kind === "failure" && kindOf(r.error.failure) === "precondition";
  try {
    const first = await put("probe one");
    if (first.kind === "err") {
      const e = first.error;
      if (e.kind === "failure" && kindOf(e.failure) === "denied") return ok({ writable: false, ifNoneMatch: false, ifMatch: false, conditionalDelete: false, checksum: false });
      return err(`a probe object cannot be written below ${JSON.stringify(base)}: ${describeCallError(e)}`);
    }
    const digestOne = fromHex(await sha256(new TextEncoder().encode("probe one"))) ?? new Uint8Array();
    const checksum = first.value["x-amz-checksum-sha256"] === toBase64(digestOne);
    const tagOne = etagOf(first.value);
    const ifNoneMatch = refusedBy(await put("probe one again", { "if-none-match": "*" }));
    const wrong = refusedBy(await put("probe two", { "if-match": quoted("0".repeat(32)) }));
    const right = tagOne === "" ? undefined : await put("probe three", { "if-match": quoted(tagOne) });
    const ifMatch = wrong && right !== undefined && right.kind === "ok";
    const head = await client.send({ method: "HEAD", key });
    const tagNow = head.kind === "ok" ? etagOf(head.value.headers) : "";
    let conditionalDelete = false;
    if (tagNow !== "") {
      const refused = await client.send({ method: "DELETE", key, headers: { "if-match": quoted("0".repeat(32)) } });
      const kept = await client.send({ method: "HEAD", key });
      if (refused.kind === "err" && refused.error.kind === "failure" && kindOf(refused.error.failure) === "precondition" && kept.kind === "ok") {
        const done = await client.send({ method: "DELETE", key, headers: { "if-match": quoted(etagOf(kept.value.headers)) } });
        const gone = await client.send({ method: "HEAD", key });
        conditionalDelete = done.kind === "ok" && gone.kind === "err";
      }
    }
    return ok({ writable: true, ifNoneMatch, ifMatch, conditionalDelete, checksum });
  } finally {
    await client.send({ method: "DELETE", key });
  }
}

/** Makes the bucket of a client where it is not there (the endpoint of a test, or a first run); it is a no-op where the bucket is already the caller's. */
export async function createBucket(client: S3Client, region: string): Promise<Result<void, string>> {
  const aws = client.endpoint.host.endsWith(".amazonaws.com");
  const body = aws && region !== "us-east-1" ? new TextEncoder().encode(`<CreateBucketConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><LocationConstraint>${region}</LocationConstraint></CreateBucketConfiguration>`) : undefined;
  const made = await client.send({ method: "PUT", ...(body === undefined ? {} : { body }) });
  if (made.kind === "ok") return ok(undefined);
  const e = made.error;
  if (e.kind === "failure" && (e.failure.code === "BucketAlreadyOwnedByYou" || e.failure.code === "BucketAlreadyExists")) return ok(undefined);
  return err(`the bucket ${client.bucket} cannot be made: ${describeCallError(e)}`);
}
