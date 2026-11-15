/**
 * Tests of `kernel/sigv4.ts`: AWS's published Signature Version 4 examples (the signature test suite's `get-vanilla`,
 * `get-vanilla-query-order-key-case`, `get-header-value-trim`, `post-vanilla` and `post-x-www-form-urlencoded`, IAM's `ListUsers` and
 * S3's `GET Object` from the documentation), their canonical request and string to sign, cross-checked with an independent signer
 * (Python's `hashlib` and `hmac`); the path, the query and the headers made canonical; and a web `Request` signed.
 *
 * @module
 */
import fc from "fast-check";
import { sha256 } from "../../kernel/sha256.ts";
import {
  amzDate,
  canonicalPath,
  canonicalQuery,
  sign,
  type SigV4Options,
  signRequest,
  uriEncode,
  UNSIGNED_PAYLOAD,
} from "../../kernel/sigv4.ts";
import { assert, assertEquals, proves } from "../../runtime/test.ts";

const FR = "0005-typescript-runtime FR-068";

// The test suite's credentials and time (AWS's "Signature Version 4 test suite"; the key is AWS's documented example, not a secret).
const SUITE: SigV4Options = {
  credentials: { accessKeyId: "AKIDEXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY" },
  region: "us-east-1",
  service: "service",
  date: new Date("2015-08-30T12:36:00Z"),
};
const HOST = { Host: "example.amazonaws.com", "X-Amz-Date": "20150830T123600Z" };
const scope = "AKIDEXAMPLE/20150830/us-east-1/service/aws4_request";

proves([FR], "AWS's get-vanilla example: its canonical request, string to sign, signature and Authorization header", async () => {
  const s = await sign({ method: "GET", url: "https://example.amazonaws.com/", headers: HOST }, SUITE);
  assertEquals(
    s.canonicalRequest,
    "GET\n/\n\nhost:example.amazonaws.com\nx-amz-date:20150830T123600Z\n\nhost;x-amz-date\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  );
  assertEquals(
    s.stringToSign,
    "AWS4-HMAC-SHA256\n20150830T123600Z\n20150830/us-east-1/service/aws4_request\nbb579772317eb040ac9ed261061d46c1f17a8133879d6129b6e1c25292927e63",
  );
  assertEquals(s.signature, "5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31");
  assertEquals(
    s.headers,
    {
      "x-amz-date": "20150830T123600Z",
      authorization: `AWS4-HMAC-SHA256 Credential=${scope}, SignedHeaders=host;x-amz-date, Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31`,
    },
    "host is signed but never sent as a header (the transport sets it), and x-amz-date is the time of signing",
  );
});

proves([FR], "AWS's test suite: the query sorted by its keys, headers trimmed, and POST with and without a body", async () => {
  const cases = [
    {
      name: "get-vanilla-query-order-key-case",
      method: "GET",
      url: "https://example.amazonaws.com/?Param2=value2&Param1=value1",
      headers: HOST,
      signed: "host;x-amz-date",
      signature: "b97d918cfa904a5beff61c982a1b6f458b799221646efd99d3219ec94cdf2500",
    },
    {
      name: "get-header-value-trim",
      method: "GET",
      url: "https://example.amazonaws.com/",
      headers: { ...HOST, "My-Header1": " value1", "My-Header2": ' "a   b   c"' },
      signed: "host;my-header1;my-header2;x-amz-date",
      signature: "acc3ed3afb60bb290fc8d2dd0098b9911fcaa05412b367055dee359757a9c736",
    },
    {
      name: "post-vanilla",
      method: "POST",
      url: "https://example.amazonaws.com/",
      headers: HOST,
      signed: "host;x-amz-date",
      signature: "5da7c1a2acd57cee7505fc6676e4e544621c30862966e37dddb68e92efbe5d6b",
    },
    {
      name: "post-x-www-form-urlencoded",
      method: "POST",
      url: "https://example.amazonaws.com/",
      headers: { ...HOST, "Content-Type": "application/x-www-form-urlencoded" },
      body: "Param1=value1",
      signed: "content-type;host;x-amz-date",
      signature: "ff11897932ad3f4e8b18135d722051e5ac45fc38421b1da7b9d196a0fe09473a",
    },
  ];
  for (const c of cases) {
    const s = await sign({ method: c.method, url: c.url, headers: c.headers, ...(c.body === undefined ? {} : { body: c.body }) }, SUITE);
    assertEquals(s.signature, c.signature, c.name);
    assertEquals(s.authorization, `AWS4-HMAC-SHA256 Credential=${scope}, SignedHeaders=${c.signed}, Signature=${c.signature}`, c.name);
  }
});

proves([FR], "the documentation's IAM ListUsers and S3 GET Object examples", async () => {
  const iam = await sign(
    {
      method: "GET",
      url: "https://iam.amazonaws.com/?Action=ListUsers&Version=2010-05-08",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=utf-8" },
    },
    { ...SUITE, service: "iam" },
  );
  assertEquals(iam.signature, "5d672d79c15b13162d9279b0855cfba6789a8edb4c82c400e06b5924a6f2b5d7");
  assertEquals(iam.headers["x-amz-date"], "20150830T123600Z");
  const s3 = await sign(
    { method: "GET", url: "https://examplebucket.s3.amazonaws.com/test.txt", headers: { Range: "bytes=0-9" } },
    {
      credentials: { accessKeyId: "AKIAIOSFODNN7EXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY" },
      region: "us-east-1",
      service: "s3",
      date: new Date("2013-05-24T00:00:00Z"),
    },
  );
  assertEquals(s3.signature, "f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41");
  assertEquals(s3.headers["x-amz-content-sha256"], await sha256(""), "S3 is always sent the payload's hash");
  assert(s3.authorization.includes("SignedHeaders=host;range;x-amz-content-sha256;x-amz-date"));
});

proves([FR], "paths are normalized and encoded twice, but for S3; queries are sorted and encoded by RFC 3986", () => {
  assertEquals(canonicalPath("/a//b/../c", "service"), "/a/c");
  assertEquals(canonicalPath("/a//b/../c", "s3"), "/a//b/../c");
  assertEquals(canonicalPath("/example space/", "service"), "/example%2520space/");
  assertEquals(canonicalPath("/example%20space/", "s3"), "/example%20space/");
  assertEquals(canonicalPath("", "service"), "/");
  assertEquals(canonicalPath("/./", "service"), "/");
  assertEquals(canonicalQuery("b=2&a=x y&a=1&flag&c=%2F*"), "a=1&a=x%20y&b=2&c=%2F%2A&flag=");
  assertEquals(uriEncode("A-Z_a.z~0 !'()*/"), "A-Z_a.z~0%20%21%27%28%29%2A%2F");
  assertEquals(amzDate(new Date("2015-08-30T12:36:00.123Z")), "20150830T123600Z");
  fc.assert(
    fc.property(fc.string({ unit: "grapheme" }), (s) => {
      assert(/^[A-Za-z0-9\-_.~%]*$/.test(uriEncode(s)));
      assertEquals(decodeURIComponent(uriEncode(s)), s);
    }),
  );
});

proves(
  [FR],
  "a session token is sent and signed, an unsigned payload is said, and a transport's own headers are left unsigned",
  async () => {
    const s = await sign(
      { method: "PUT", url: "https://bucket.s3.amazonaws.com/key", headers: { "User-Agent": "ifc-ts", traceparent: "00-x" }, body: "data" },
      { ...SUITE, service: "s3", credentials: { ...SUITE.credentials, sessionToken: "token-of-a-session" }, unsignedPayload: true },
    );
    assertEquals(s.headers["x-amz-security-token"], "token-of-a-session");
    assertEquals(s.headers["x-amz-content-sha256"], UNSIGNED_PAYLOAD);
    assert(s.canonicalRequest.endsWith(`\n${UNSIGNED_PAYLOAD}`));
    assert(s.authorization.includes("SignedHeaders=host;x-amz-content-sha256;x-amz-date;x-amz-security-token,"), s.authorization);
    assertEquals([s.headers["User-Agent"], s.headers["traceparent"]], ["ifc-ts", "00-x"]);
  },
);

proves([FR], "a web Request is signed as its parts are, its body hashed and kept", async () => {
  const request = new Request("https://example.amazonaws.com/", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "x-amz-date": "20150830T123600Z" },
    body: "Param1=value1",
  });
  const signed = await signRequest(request, SUITE);
  assertEquals(
    signed.headers.get("authorization"),
    `AWS4-HMAC-SHA256 Credential=${scope}, SignedHeaders=content-type;host;x-amz-date, Signature=ff11897932ad3f4e8b18135d722051e5ac45fc38421b1da7b9d196a0fe09473a`,
  );
  assertEquals(await signed.text(), "Param1=value1");
  assertEquals([signed.method, signed.url], ["POST", "https://example.amazonaws.com/"]);
  const get = await signRequest(new Request("https://example.amazonaws.com/"), SUITE);
  assert(get.headers.get("authorization")?.endsWith("Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31"));
});
