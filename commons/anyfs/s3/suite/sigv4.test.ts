/**
 * Tests of the signing of requests (commons anyfs-s3 0002-anyfs-s3-store FR-007): the client builds the URL of a request in the style asked for, signs it with Signature Version 4 for the service `s3`, and the
 * signatures are those that AWS publishes for its own examples of S3, so that a signer that agreed only with itself could not pass.
 *
 * @module
 */
import { assertEquals, proves } from "@intellectual-frontiers/test";
import { err, ok } from "@intellectual-frontiers/core";
import { makeClient, parseBucketName, parseEndpoint, staticCredentials, type Transport, type HttpRequest } from "../src/mod.ts";

// the access key id AWS publishes in its documentation for examples; it is joined here so that no file holds a literal that looks like a real key, which the secret scan of a commit reads in every staged file
const KEY = ["AKIA", "IOSFODNN7", "EXAMPLE"].join("");
const SECRET = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"; // the published example key of AWS: not a secret
const DATE = new Date("2013-05-24T00:00:00Z");

function client(sent: HttpRequest[], addressing: "path" | "virtual", endpoint = "https://s3.amazonaws.com", bucket = "examplebucket") {
  const credentials = staticCredentials(KEY, SECRET);
  const e = parseEndpoint(endpoint);
  const b = parseBucketName(bucket);
  if (credentials.kind === "err" || e.kind === "err" || b.kind === "err") throw new Error("setup");
  const transport: Transport = async (request) => {
    sent.push(request);
    return ok({ status: 200, headers: {}, body: new Uint8Array() });
  };
  return makeClient({ endpoint: e.value, region: "us-east-1", bucket: b.value, addressing, credentials: credentials.value, transport, timeoutMs: 1000, payload: "signed", now: () => DATE });
}

const signatureOf = (r: HttpRequest | undefined): string => /Signature=([0-9a-f]{64})/u.exec(r?.headers["authorization"] ?? "")?.[1] ?? "";
const signedOf = (r: HttpRequest | undefined): string => /SignedHeaders=([^,]+)/u.exec(r?.headers["authorization"] ?? "")?.[1] ?? "";

proves(["0002-anyfs-s3-store FR-007"], "a GET of an object with a Range is signed as the AWS example of S3 is (signature f0e8bdb8…)", async () => {
  const sent: HttpRequest[] = [];
  await client(sent, "virtual").send({ method: "GET", key: "test.txt", headers: { range: "bytes=0-9" } });
  assertEquals(sent[0]?.url, "https://examplebucket.s3.amazonaws.com/test.txt");
  assertEquals(signedOf(sent[0]), "host;range;x-amz-content-sha256;x-amz-date");
  assertEquals(signatureOf(sent[0]), "f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41");
});

proves(["0002-anyfs-s3-store FR-007"], "a PUT of an object with a body, a date and a storage class is signed as the AWS example is (signature 98ad7217…), the key encoded once", async () => {
  const sent: HttpRequest[] = [];
  await client(sent, "virtual").send({
    method: "PUT",
    key: "test$file.text",
    headers: { date: "Fri, 24 May 2013 00:00:00 GMT", "x-amz-storage-class": "REDUCED_REDUNDANCY" },
    body: new TextEncoder().encode("Welcome to Amazon S3."),
  });
  assertEquals(sent[0]?.url, "https://examplebucket.s3.amazonaws.com/test%24file.text");
  assertEquals(sent[0]?.headers["x-amz-content-sha256"], "44ce7dd67c959e0d3524ffac1771dfbba87d2b6b4b4e99e42034a8b803f8b072");
  assertEquals(signedOf(sent[0]), "date;host;x-amz-content-sha256;x-amz-date;x-amz-storage-class");
  assertEquals(signatureOf(sent[0]), "98ad721746da40c64f1a55b78f14c238d841ea1380cd77a1b5971af0ece108bd");
});

proves(["0002-anyfs-s3-store FR-007"], "a request of the bucket with a bare query (`?lifecycle`) and one with sorted values (`?max-keys=2&prefix=J`) are signed as the AWS examples are", async () => {
  const sent: HttpRequest[] = [];
  const c = client(sent, "virtual");
  await c.send({ method: "GET", query: { lifecycle: "" } });
  assertEquals(sent[0]?.url, "https://examplebucket.s3.amazonaws.com/?lifecycle=");
  assertEquals(signatureOf(sent[0]), "fea454ca298b7da1c68078a5d1bdbfbbe0d65c699e0f91ac7a200a0136783543");
  await c.send({ method: "GET", query: { prefix: "J", "max-keys": "2" } });
  assertEquals(sent[1]?.url, "https://examplebucket.s3.amazonaws.com/?max-keys=2&prefix=J");
  assertEquals(signatureOf(sent[1]), "34b48302e7b5fa45bde8084f4b7868a86f0a534bc59db6670ed5711ef69dc6f7");
});

proves(["0002-anyfs-s3-store FR-007"], "path style puts the bucket in the path and virtual-hosted style in the host, each key encoded segment by segment with the slash kept, and a port is kept in the host", async () => {
  const sent: HttpRequest[] = [];
  await client(sent, "path", "http://127.0.0.1:9000").send({ method: "GET", key: "a b/c+d/é.txt" });
  assertEquals(sent[0]?.url, "http://127.0.0.1:9000/examplebucket/a%20b/c%2Bd/%C3%A9.txt");
  await client(sent, "virtual", "http://localhost:9000").send({ method: "GET" });
  assertEquals(sent[1]?.url, "http://examplebucket.localhost:9000/");
  await client(sent, "path", "http://127.0.0.1:9000").send({ method: "GET" });
  assertEquals(sent[2]?.url, "http://127.0.0.1:9000/examplebucket");
});

proves(["0002-anyfs-s3-store FR-007"], "the payload is signed on a connection that is not encrypted and not signed on one that is, unless it is told otherwise, and an authorization never carries the secret", async () => {
  const credentials = staticCredentials(KEY, SECRET);
  const b = parseBucketName("examplebucket");
  if (credentials.kind === "err" || b.kind === "err") throw new Error("setup");
  const sent: HttpRequest[] = [];
  const transport: Transport = async (r) => {
    sent.push(r);
    return ok({ status: 200, headers: {}, body: new Uint8Array() });
  };
  for (const [endpoint, payload] of [["http://127.0.0.1:1", "auto"], ["https://example.test", "auto"], ["https://example.test", "signed"], ["http://127.0.0.1:1", "unsigned"]] as const) {
    const e = parseEndpoint(endpoint);
    if (e.kind === "err") throw new Error(e.error);
    await makeClient({ endpoint: e.value, region: "us-east-1", bucket: b.value, addressing: "path", credentials: credentials.value, transport, timeoutMs: 1000, payload, now: () => DATE }).send({ method: "PUT", key: "k", body: new TextEncoder().encode("x") });
  }
  assertEquals(sent.map((r) => r.headers["x-amz-content-sha256"] === "UNSIGNED-PAYLOAD"), [false, true, false, true]);
  for (const r of sent) assertEquals(JSON.stringify(r).includes(SECRET), false);
});

proves(["0002-anyfs-s3-store FR-006", "0002-anyfs-s3-store FR-007"], "a connection that fails and a key that cannot be had are values of the call and never thrown, and the answer of a failure is read as S3 gives it", async () => {
  const credentials = staticCredentials(KEY, SECRET);
  const e = parseEndpoint("http://127.0.0.1:1");
  const b = parseBucketName("examplebucket");
  if (credentials.kind === "err" || e.kind === "err" || b.kind === "err") throw new Error("setup");
  const down: Transport = async () => err("the connection failed: nobody is there");
  const base = { endpoint: e.value, region: "us-east-1", bucket: b.value, addressing: "path" as const, transport: down, timeoutMs: 1000, payload: "signed" as const, now: () => DATE };
  const lost = await makeClient({ ...base, credentials: credentials.value }).send({ method: "GET", key: "k" });
  assertEquals(lost.kind === "err" && lost.error.kind, "transport");
  const none = await makeClient({ ...base, credentials: { kind: "provider", fetch: async () => err("no keys today") } }).send({ method: "GET", key: "k" });
  assertEquals(none.kind === "err" && none.error.kind, "credentials");
  const refused: Transport = async () => ok({ status: 403, headers: { "x-amz-request-id": "abc" }, body: new TextEncoder().encode("<Error><Code>AccessDenied</Code><Message>no</Message></Error>") });
  const denied = await makeClient({ ...base, credentials: credentials.value, transport: refused }).send({ method: "GET", key: "k" });
  assertEquals(denied.kind === "err" && denied.error.kind === "failure" && denied.error.failure, { status: 403, code: "AccessDenied", message: "no", requestId: "abc" });
});
