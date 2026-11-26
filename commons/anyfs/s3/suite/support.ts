/**
 * What the tests stand a store on: the fake server of S3 made in process, always, and RustFS, the real server, where its binary can be had and run. A test that holds a contract runs it on every server this
 * module gives, so that the fake is only trusted as far as the real one agrees with it.
 *
 * @module
 */
import { type Opened, openS3Store, type S3CasStore, type S3Options, type S3Place, type S3PlainStore, staticCredentials, createBucket, makeClient, parseBucketName, parseEndpoint, fetchTransport, type CredentialSource } from "../src/mod.ts";
import process from "node:process";
import { parsePlace } from "@intellectual-frontiers/anyfs/governance";
import { rustfsBinary, startRustfs } from "../tools/rustfs.ts";
import { startFake, type FakeOptions } from "./fake-s3.ts";

/** A server the tests run on. */
export type Server = {
  readonly name: "fake" | "rustfs";
  readonly endpoint: string;
  readonly credentials: CredentialSource;
  readonly stop: () => Promise<void>;
};

const credentialsOf = (id: string, secret: string): CredentialSource => {
  const c = staticCredentials(id, secret);
  if (c.kind === "err") throw new Error(c.error);
  return c.value;
};

/** A fake server, and the handle of it for the tests that look inside. */
export async function fake(options: FakeOptions = {}) {
  const f = await startFake(options);
  const server: Server = { name: "fake", endpoint: f.endpoint, credentials: credentialsOf(f.accessKey, f.secretKey), stop: f.stop };
  return { server, fake: f };
}

let shared: Promise<Server | string> | undefined;

/**
 * RustFS, where its binary can be had and run: its endpoint and throwaway keys, or the reason it cannot. One server serves every test of the process, and it is stopped when the process ends (each test
 * makes buckets and prefixes of its own, so that none sees another's objects).
 */
export function rustfs(): Promise<Server | string> {
  shared ??= (async () => {
    const bin = await rustfsBinary();
    if (bin.kind === "err") return bin.error;
    const run = await startRustfs(bin.value);
    if (run.kind === "err") return run.error;
    process.once("exit", () => run.value.kill());
    run.value.unref();
    return { name: "rustfs" as const, endpoint: run.value.endpoint, credentials: credentialsOf(run.value.accessKey, run.value.secretKey), stop: run.value.stop };
  })();
  return shared;
}

/** Runs a body on every server the tests hold a contract on: the fake (made for the run and stopped after it) and RustFS where it can be run. Where it cannot, the body is told why, and nothing is silent. */
export async function onServers<T>(run: (server: Server, label: string) => Promise<T>, note?: (reason: string) => void): Promise<readonly T[]> {
  const { server, fake: handle } = await fake();
  const out: T[] = [];
  try {
    out.push(await run(server, "fake"));
  } finally {
    await handle.stop();
  }
  const real = await rustfs();
  if (typeof real === "string") note?.(`RustFS was not run: ${real}`);
  else out.push(await run(real, "rustfs"));
  return out;
}

/** The place `s3://bucket/prefix`. */
export function placeOf(bucket: string, prefix = ""): S3Place {
  const p = parsePlace(`s3://${bucket}${prefix === "" ? "" : `/${prefix}`}`);
  if (p.kind === "err" || p.value.kind !== "s3") throw new Error(`not a place: ${bucket}/${prefix}`);
  return p.value;
}

/** A bucket on a server, made. */
export async function bucketOn(server: Server, name: string): Promise<void> {
  const bucket = parseBucketName(name);
  const endpoint = parseEndpoint(server.endpoint);
  if (bucket.kind === "err" || endpoint.kind === "err") throw new Error("not a bucket or an endpoint");
  const client = makeClient({ endpoint: endpoint.value, region: "us-east-1", bucket: bucket.value, addressing: "path", credentials: server.credentials, transport: fetchTransport(), timeoutMs: 10_000, payload: "auto", now: () => new Date() });
  const made = await createBucket(client, "us-east-1");
  if (made.kind === "err") throw new Error(made.error);
}

/** A store on a server, opened. */
export async function openOn(server: Server, bucket: string, prefix: string, options: Partial<S3Options> = {}): Promise<Opened> {
  const opened = await openS3Store({ place: placeOf(bucket, prefix), credentials: server.credentials, endpoint: server.endpoint, ...options });
  if (opened.kind === "err") throw new Error(opened.error);
  return opened.value;
}

/** A store on a server that can be written to, typed as a store without cas (a store with cas is one too), and the same store typed with cas where the endpoint keeps it. */
export async function writableOn(
  server: Server,
  bucket: string,
  prefix: string,
  options: Partial<S3Options> = {},
): Promise<{ readonly mode: "cas" | "plain"; readonly store: S3PlainStore; readonly cas: S3CasStore | undefined; readonly facts: Opened["facts"]; readonly client: Opened["client"] }> {
  const opened = await openOn(server, bucket, prefix, options);
  if (opened.mode === "read-only") throw new Error("a store that can be written to was expected");
  return { mode: opened.mode, store: opened.store, cas: opened.mode === "cas" ? opened.store : undefined, facts: opened.facts, client: opened.client };
}
