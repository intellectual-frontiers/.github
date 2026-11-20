/**
 * Tests of `hex.ts` (commons formats 0001-formats FR-013): bytes written as lower-case hexadecimal and read back, as a property, and the refusals of `fromHex`.
 *
 * @module
 */
import fc from "fast-check";
import { fromHex, toHex } from "../src/hex.ts";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";

proves(["0001-formats FR-013"], "toHex writes two lower-case digits for each byte and fromHex reads them back", () => {
  assertEquals(toHex(new Uint8Array([0, 1, 15, 16, 255])), "00010f10ff");
  assertEquals(fromHex("00010f10FF"), new Uint8Array([0, 1, 15, 16, 255]));
  assertEquals(fromHex(""), new Uint8Array([]));
  fc.assert(
    fc.property(fc.uint8Array({ maxLength: 64 }), (bytes) => {
      const text = toHex(bytes);
      assert(/^[0-9a-f]*$/.test(text) && text.length === bytes.length * 2);
      assertEquals(fromHex(text), bytes);
    }),
  );
});

proves(["0001-formats FR-013"], "fromHex refuses an odd length and a character that is not a hexadecimal digit", () => {
  assertEquals(fromHex("abc"), undefined);
  assertEquals(fromHex("zz"), undefined);
  assertEquals(fromHex("0g"), undefined);
});
