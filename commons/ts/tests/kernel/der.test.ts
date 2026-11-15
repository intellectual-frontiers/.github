/**
 * Tests of `kernel/der.ts` and `kernel/base64.ts`: X.690's own encodings, round trips of integers, OIDs and nested structures
 * (property-tested), what is not DER refused with its place, and RFC 4648's test vectors with round trips.
 *
 * @module
 */
import fc from "fast-check";
import { fromBase64, fromBase64Url, toBase64, toBase64Url } from "../../kernel/base64.ts";
import {
  algorithm,
  bitString,
  boolean,
  children,
  derNull,
  encodeLength,
  explicit,
  implicit,
  integer,
  octetString,
  oid,
  readInteger,
  readOid,
  readTlv,
  sequence,
  setOf,
  TAG,
  utf8String,
} from "../../kernel/der.ts";
import { fromHex, toHex } from "../../kernel/sha256.ts";
import { assert, assertEquals, assertThrows, proves } from "../../runtime/test.ts";

const DER = "0005-typescript-runtime FR-041";
const B64 = "0005-typescript-runtime FR-042";
const LAWS = "0005-typescript-runtime FR-014";

const content = (bytes: Uint8Array): Uint8Array => {
  const t = readTlv(bytes);
  if (t.kind === "err") throw new Error(t.error.message);
  return t.value.content;
};

proves([DER], "the encodings X.690 and RFC 5652 give", () => {
  assertEquals(toHex(oid("1.2.840.113549.1.7.1")), "06092a864886f70d010701");
  assertEquals(toHex(oid("2.999.3")), "0603883703");
  assertEquals(
    [
      toHex(integer(0)),
      toHex(integer(127)),
      toHex(integer(128)),
      toHex(integer(256)),
      toHex(integer(-1)),
      toHex(integer(-128)),
      toHex(integer(-129)),
    ],
    ["020100", "02017f", "02020080", "02020100", "0201ff", "020180", "0202ff7f"],
  );
  assertEquals(toHex(integer(Uint8Array.of(0, 0, 0x80))), "02020080");
  assertEquals([toHex(encodeLength(127)), toHex(encodeLength(128)), toHex(encodeLength(300))], ["7f", "8180", "82012c"]);
  assertEquals(toHex(sequence(derNull(), boolean(true))), "3005050001 01ff".replace(" ", ""));
  assertEquals(toHex(setOf(octetString(Uint8Array.of(2)), octetString(Uint8Array.of(1)))), "3106040101040102");
  assertEquals(toHex(explicit(0, integer(1))), "a003020101");
  assertEquals(toHex(implicit(1, Uint8Array.of(5), false)), "810105");
  assertEquals(toHex(bitString(Uint8Array.of(0xff))), "030200ff");
  assertEquals(toHex(utf8String("é")), "0c02c3a9");
  assertEquals(toHex(algorithm("1.2.3", derNull())), "30060602 2a030500".replace(" ", ""));
  assertEquals(TAG.sequence, 0x30);
  for (const bad of ["1", "3.1", "1.40", "a.b", "1..2"]) assertThrows(() => oid(bad), RangeError);
  assertThrows(() => integer(2 ** 60), RangeError);
});

proves([DER, LAWS], "integers, OIDs and nested sequences read back as written", () => {
  fc.assert(
    fc.property(fc.bigInt({ min: -(2n ** 200n), max: 2n ** 200n }), (n) =>
      assertEquals(readInteger(content(integer(n))), { kind: "ok", value: n }),
    ),
  );
  const arc = fc.bigInt({ min: 0n, max: 2n ** 70n });
  const dotted = fc
    .tuple(fc.integer({ min: 0, max: 2 }), fc.bigInt({ min: 0n, max: 39n }), fc.array(arc, { maxLength: 6 }))
    .map(([a, b, rest]) => [a, a === 2 ? b * 1000n : b, ...rest].join("."));
  fc.assert(fc.property(dotted, (d) => assertEquals(readOid(content(oid(d))), { kind: "ok", value: d })));
  fc.assert(
    fc.property(fc.array(fc.uint8Array({ maxLength: 300 }), { maxLength: 5 }), (parts) => {
      const kids = children(content(sequence(...parts.map(octetString))));
      assert(kids.kind === "ok");
      assertEquals(
        kids.value.map((k) => [k.tag, k.content]),
        parts.map((p) => [TAG.octetString, p]),
      );
    }),
  );
});

proves([DER], "what is not DER is refused with the byte where it goes wrong", () => {
  const bad: readonly (readonly [string, number, string])[] = [
    ["", 0, "no tag"],
    ["1f01", 0, "high tag"],
    ["04", 1, "no length"],
    ["0480", 1, "indefinite"],
    ["048105", 1, "shortest form"],
    ["0403aa", 2, "3 bytes of content"],
    ["0482", 2, "rest of the length"],
  ];
  for (const [hex, at, says] of bad) {
    const r = readTlv(fromHex(hex) ?? new Uint8Array());
    assert(r.kind === "err", hex);
    assertEquals(r.error.at, at, `${hex}: ${r.error.message}`);
    assert(r.error.message.includes(says), `${hex}: ${r.error.message}`);
  }
  assertEquals(readInteger(Uint8Array.of(0, 1)).kind, "err");
  assertEquals(readInteger(Uint8Array.of(0xff, 0x80)).kind, "err");
  assertEquals(readInteger(new Uint8Array()).kind, "err");
  assertEquals(readOid(Uint8Array.of(0x2a, 0x86)).kind, "err");
  assertEquals(readOid(Uint8Array.of(0x80, 0x01)).kind, "err");
  assertEquals(children(Uint8Array.of(0x04, 0x05, 1)).kind, "err");
});

proves([B64], "RFC 4648's test vectors, both alphabets", () => {
  const enc = (s: string): Uint8Array => new TextEncoder().encode(s);
  const vectors = [
    ["", ""],
    ["f", "Zg=="],
    ["fo", "Zm8="],
    ["foo", "Zm9v"],
    ["foob", "Zm9vYg=="],
    ["fooba", "Zm9vYmE="],
    ["foobar", "Zm9vYmFy"],
  ] as const;
  for (const [plain, coded] of vectors) {
    assertEquals(toBase64(enc(plain)), coded);
    assertEquals(fromBase64(coded), { kind: "ok", value: enc(plain) });
    assertEquals(toBase64Url(enc(plain)), coded.replace(/=+$/, ""));
  }
  assertEquals(toBase64Url(Uint8Array.of(0xfb, 0xff)), "-_8");
  assertEquals(toBase64(Uint8Array.of(0xfb, 0xff)), "+/8=");
  assertEquals(fromBase64("Zm9v\nYmFy"), { kind: "ok", value: enc("foobar") });
  for (const bad of ["Zm9", "Zm9v=", "Zm9v!", "-_8=", "Z==="]) assertEquals(fromBase64(bad).kind, "err", bad);
  for (const bad of ["+/8", "a", "ab=c"]) assertEquals(fromBase64Url(bad).kind, "err", bad);
  assertEquals(fromBase64Url("-_8="), { kind: "ok", value: Uint8Array.of(0xfb, 0xff) });
});

proves([B64, LAWS], "bytes read back as written, in both alphabets, large ones too", () => {
  fc.assert(
    fc.property(fc.uint8Array({ maxLength: 100_000 }), (b) => {
      assertEquals(fromBase64(toBase64(b)), { kind: "ok", value: b });
      assertEquals(fromBase64Url(toBase64Url(b)), { kind: "ok", value: b });
    }),
    { numRuns: 30 },
  );
});
