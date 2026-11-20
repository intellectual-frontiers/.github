/**
 * Tests of `md5.ts`: the whole test suite of RFC 1321's appendix A.5, the digest taken a piece at a time equal to the whole, and a
 * stream digested as it is read.
 *
 * @module
 */
import fc from "fast-check";
import { Md5, md5, md5Hex, md5Stream } from "../src/md5.ts";
import { toBase64 } from "@intellectual-frontiers/formats/base64";
import { assertEquals, assertThrows, proves } from "@intellectual-frontiers/test";

const FR = "0001-crypto FR-002";

proves([FR], "the digests of RFC 1321's test suite (appendix A.5)", () => {
  assertEquals(md5Hex(""), "d41d8cd98f00b204e9800998ecf8427e");
  assertEquals(md5Hex("a"), "0cc175b9c0f1b6a831c399e269772661");
  assertEquals(md5Hex("abc"), "900150983cd24fb0d6963f7d28e17f72");
  assertEquals(md5Hex("message digest"), "f96b697d7cb7938d525a2f31aaf161d0");
  assertEquals(md5Hex("abcdefghijklmnopqrstuvwxyz"), "c3fcd3d76192e4007dfb496cca67e13b");
  assertEquals(md5Hex("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"), "d174ab98d277d9f5a5611c2c9f419d9f");
  assertEquals(md5Hex("1234567890".repeat(8)), "57edf4a22be3c955ac49da2e2107b67a");
});

proves([FR], "bytes and hexadecimal are the same digest; base64 of it is S3's Content-MD5", () => {
  const d = md5(new TextEncoder().encode("abc"));
  assertEquals(d.length, 16);
  assertEquals(md5Hex(new TextEncoder().encode("abc")), "900150983cd24fb0d6963f7d28e17f72");
  assertEquals(toBase64(md5("")), "1B2M2Y8AsgTpgAmY7PhCfg==");
});

proves([FR], "the digest taken a piece at a time, cut anywhere, is the digest of the whole", () => {
  fc.assert(
    fc.property(fc.uint8Array({ maxLength: 300 }), fc.array(fc.nat(300), { maxLength: 6 }), (bytes, cuts) => {
      const points = [...new Set([0, ...cuts.map((c) => c % (bytes.length + 1)), bytes.length])].sort((a, b) => a - b);
      const h = new Md5();
      for (let i = 1; i < points.length; i++) h.update(bytes.subarray(points[i - 1], points[i]));
      assertEquals(h.digest(), md5(bytes));
    }),
  );
});

proves([FR], "the lengths around the padding boundary, whole and a byte at a time, give the digests of a reference MD5", () => {
  const expected: readonly (readonly [number, string])[] = [
    [55, "8d24280288a696559fd8d5aa1b6d8c6e"],
    [56, "ef2c72b7254c92459e498eddd4ace573"],
    [57, "5e319059f1ba9373988437b589fb9f21"],
    [63, "c4c8c6d513f4e1604eb18508a1769364"],
    [64, "a2fcb39a253b9b785b1f97518fa37683"],
    [65, "e49fe82d0bb12967a196c85de313e446"],
    [119, "1640deea49ebb258ec6ede18d4b2d2d7"],
    [120, "05f879f7b542a7ebf0605adff67d4423"],
    [128, "fe942895e9aae953f3e246e5fd00739d"],
  ];
  for (const [n, hex] of expected) {
    const bytes = new Uint8Array(n).map((_, i) => i * 7);
    assertEquals(md5Hex(bytes), hex, `length ${n}`);
    const h = new Md5();
    for (const b of bytes) h.update(new Uint8Array([b]));
    assertEquals(h.hex(), hex, `length ${n}, a byte at a time`);
  }
  assertEquals(md5Hex(new Uint8Array(1_000_000).fill(0x61)), "7707d6ae4e027c70eea2a935c2296f21");
});

proves([FR], "a stream is digested as it is read; a digest taken takes no more bytes", async () => {
  const chunks = Array.from({ length: 50 }, (_, i) => new Uint8Array(1000).fill(i));
  const whole = new Uint8Array(50_000);
  chunks.forEach((c, i) => whole.set(c, i * 1000));
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(c);
      controller.close();
    },
  });
  assertEquals(await md5Stream(stream), md5(whole));
  const h = new Md5().update("abc");
  assertEquals(h.hex(), h.hex());
  assertThrows(() => h.update("d"));
});
