/**
 * Tests of `sha256.ts`: the digests of the standard's test vectors, hexadecimal round trips, and a checksum is a type of its own.
 *
 * @module
 */
import fc from "fast-check";
import { fromHex, toHex } from "@intellectual-frontiers/formats/hex";
import { parseSha256Sums, sameSha256, type Sha256, sha256, sha256Of } from "../src/sha256.ts";
import { assert, assertEquals, proves } from "@intellectual-frontiers/commons/ts/runtime/test";

const FR = "0001-crypto FR-001";

proves([FR], "the digests of FIPS 180-2's test vectors", async () => {
  assertEquals(await sha256(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  assertEquals(await sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assertEquals(
    await sha256(new TextEncoder().encode("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")),
    "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
  );
});

proves([FR, "0005-typescript-runtime FR-014"], "bytes to hexadecimal and back are the same bytes", () => {
  fc.assert(fc.property(fc.uint8Array(), (b) => assertEquals(fromHex(toHex(b)), b)));
  assertEquals(fromHex("abc"), undefined);
  assertEquals(fromHex("zz"), undefined);
});

proves([FR], "only 64 hexadecimal digits are a checksum; checksums compare equal only where equal", async () => {
  const s = await sha256("abc");
  assertEquals(sha256Of(s.toUpperCase()), s);
  assertEquals(sha256Of("abc"), undefined);
  assert(sameSha256(s, s));
  assert(!sameSha256(s, await sha256("abd")));
  // @ts-expect-error a plain string is not a Sha256
  const t: Sha256 = "0".repeat(64);
  void t;
});

proves([FR], "a SHASUMS file is read as name to checksum, other lines skipped", () => {
  const sum = "a".repeat(64);
  const sums = parseSha256Sums(`${sum}  node-v26.tar.xz\n${"B".repeat(64)} *bin.zip\n-----BEGIN PGP-----\n`);
  assertEquals([...sums.keys()], ["node-v26.tar.xz", "bin.zip"]);
  assertEquals(sums.get("bin.zip"), "b".repeat(64));
});
