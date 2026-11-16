/**
 * Tests of `kernel/cbor.ts`: the examples of RFC 8949 Appendix A that WebAuthn's subset needs (unsigned and negative integers to 64 bits,
 * byte and text strings, arrays, maps, tags, the simple values, and floats of the three widths), each decoded and, where it is in the
 * deterministic encoding, written back to the same bytes; the refusals (an indefinite length, a reserved value, text that is not UTF-8, a
 * key given twice or not an integer or text, a count the bytes cannot meet, nesting too deep, bytes left over); and a round-trip property.
 *
 * @module
 */
import fc from "fast-check";
import { type CborKey, type CborValue, decodeCbor, decodeCborItem, encodeCbor, formatCborError } from "../../kernel/cbor.ts";
import { fromHex, toHex } from "../../kernel/sha256.ts";
import { assert, assertEquals, assertThrows, proves, the } from "../../runtime/test.ts";

const FR = "0014-webauthn FR-001";

const hex = (h: string): Uint8Array => the(fromHex(h.replace(/\s/g, "")), h);
const map = (...pairs: readonly (readonly [CborKey, CborValue])[]): ReadonlyMap<CborKey, CborValue> => new Map(pairs);

// RFC 8949 Appendix A: the value, its encoding, and whether that encoding is the deterministic one (written back as it is).
const VECTORS: readonly (readonly [CborValue, string, boolean])[] = [
  [0, "00", true],
  [1, "01", true],
  [10, "0a", true],
  [23, "17", true],
  [24, "1818", true],
  [25, "1819", true],
  [100, "1864", true],
  [1000, "1903e8", true],
  [1000000, "1a000f4240", true],
  [1000000000000, "1b000000e8d4a51000", true],
  [18446744073709551615n, "1bffffffffffffffff", true],
  [-18446744073709551616n, "3bffffffffffffffff", true],
  [-1, "20", true],
  [-10, "29", true],
  [-100, "3863", true],
  [-1000, "3903e7", true],
  [false, "f4", true],
  [true, "f5", true],
  [null, "f6", true],
  [undefined, "f7", true],
  [new Uint8Array(0), "40", true],
  [Uint8Array.of(1, 2, 3, 4), "4401020304", true],
  ["", "60", true],
  ["a", "6161", true],
  ["IETF", "6449455446", true],
  ['"\\', "62225c", true],
  ["ü", "62c3bc", true],
  ["水", "63e6b0b4", true],
  ["𐅑", "64f0908591", true],
  [[], "80", true],
  [[1, 2, 3], "83010203", true],
  [[1, [2, 3], [4, 5]], "8301820203820405", true],
  [Array.from({ length: 25 }, (_, i) => i + 1), "98190102030405060708090a0b0c0d0e0f101112131415161718181819", true],
  [map(), "a0", true],
  [map([1, 2], [3, 4]), "a201020304", true],
  [map(["a", 1], ["b", [2, 3]]), "a26161016162820203", true],
  [["a", map(["b", "c"])], "826161a161626163", true],
  [map(["a", "A"], ["b", "B"], ["c", "C"], ["d", "D"], ["e", "E"]), "a56161614161626142616361436164614461656145", true],
  [{ tag: 1, value: 1363896240 }, "c11a514b67b0", true],
  [{ tag: 23, value: Uint8Array.of(1, 2, 3, 4) }, "d74401020304", true],
  [1.5, "f93e00", false],
  [100000, "fa47c35000", false],
  [1.1, "fb3ff199999999999a", true],
  [-4.1, "fbc010666666666666", true],
  [65504, "f97bff", false],
  [5.960464477539063e-8, "f90001", false],
  [-Infinity, "f9fc00", false],
];

proves([FR], "RFC 8949 Appendix A: each example decoded, and the deterministic ones written back to the same bytes", () => {
  for (const [value, encoded, deterministic] of VECTORS) {
    assertEquals(decodeCbor(hex(encoded)), { kind: "ok", value }, encoded);
    if (deterministic) assertEquals(toHex(encodeCbor(value)), encoded, `${encoded} written`);
  }
});

proves([FR], "a map's keys are written sorted by their encoding, whatever their order in the value", () => {
  assertEquals(toHex(encodeCbor(map(["b", 1], [-1, 2], ["a", 3], [10, 4]))), "a40a042002616103616201");
  // the WebAuthn attestation object's own order: fmt, attStmt, authData
  assertEquals(
    encodeCbor(map(["authData", Uint8Array.of(0)], ["attStmt", map()], ["fmt", "none"])),
    hex("a3 63666d74 646e6f6e65 6761747453746d74 a0 686175746844617461 4100"),
  );
});

proves([FR], "an item followed by more bytes is read with where it ends, as authenticator data needs", () => {
  assertEquals(decodeCborItem(hex("a201020304ffff")), { kind: "ok", value: { value: map([1, 2], [3, 4]), end: 5 } });
  assertEquals(decodeCborItem(hex("00 1903e8"), 1), { kind: "ok", value: { value: 1000, end: 4 } });
});

proves([FR], "what is not CBOR this reader takes is refused with what and where", () => {
  const cases: readonly (readonly [string, string])[] = [
    ["", "no data item"],
    ["19 01", "2 bytes of argument"],
    ["5f 41 01 ff", "an indefinite length"],
    ["9f 01 ff", "an indefinite length"],
    ["1c", "the reserved additional information 28"],
    ["62 c3 28", "not UTF-8"],
    ["a2 01 02 01 03", "the map key 1 given twice"],
    ["a1 40 01", "neither an integer nor a text string"],
    ["44 01 02", "4 bytes of content"],
    ["9a ffffffff", "the bytes end first"],
    ["ba ffffffff", "the bytes end first"],
    ["00 00", "1 bytes after the data item"],
    ["f8 20", "the simple value 32"],
    [`${"81".repeat(70)}00`, "nesting deeper than 64"],
  ];
  for (const [bytes, says] of cases) {
    const r = decodeCbor(hex(bytes));
    assert(r.kind === "err", `${bytes} refused`);
    assert(formatCborError(r.error).includes(says), `${bytes}: ${formatCborError(r.error)}`);
  }
});

proves([FR], "a value no CBOR item can hold is a programming error", () => {
  assertThrows(() => encodeCbor(2n ** 64n), RangeError);
  assertThrows(() => encodeCbor(-(2n ** 64n) - 1n), RangeError);
});

proves([FR], "property: integers, strings, bytes, booleans, arrays and maps written then read are what they were", () => {
  const leaf = fc.oneof(
    fc.maxSafeInteger(),
    fc
      .bigInt({ min: -(2n ** 64n), max: 2n ** 64n - 1n })
      .filter((n) => n > BigInt(Number.MAX_SAFE_INTEGER) || n < BigInt(Number.MIN_SAFE_INTEGER)),
    fc.string(),
    fc.uint8Array({ maxLength: 40 }),
    fc.boolean(),
    fc.constant(null),
  );
  const value = fc.letrec<{ v: CborValue }>((tie) => ({
    v: fc.oneof(
      { depthSize: "small" },
      leaf,
      fc.array(tie("v"), { maxLength: 4 }),
      fc
        .uniqueArray(fc.tuple(fc.oneof(fc.integer(), fc.string()), tie("v")), { maxLength: 4, selector: (p) => p[0] })
        .map((pairs) => map(...pairs)),
    ),
  })).v;
  fc.assert(
    fc.property(value, (v) => {
      assertEquals(decodeCbor(encodeCbor(v)), { kind: "ok", value: v });
    }),
  );
});
