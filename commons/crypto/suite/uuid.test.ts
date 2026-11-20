/**
 * Tests of `uuid.ts`: version 5 UUIDs against RFC 9562's example and other well-known vectors (Python's `uuid.uuid5` gives the
 * same), the version and variant bits on random names, text and bytes round trips, and names made of parts kept apart.
 *
 * @module
 */
import fc from "fast-check";
import {
  NAMESPACE_DNS,
  NAMESPACE_OID,
  NAMESPACE_URL,
  NAMESPACE_X500,
  NIL_UUID,
  nameOf,
  type Uuid,
  uuidBytes,
  uuidDecoder,
  uuidFromBytes,
  uuidOf,
  uuidUrn,
  uuidV5,
  uuidV5Of,
  uuidVersion,
} from "../src/uuid.ts";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";

const OSCAL = "0007-grc FR-017";
const CDX = "0007-grc FR-018";

proves([OSCAL, CDX], "uuidV5 gives RFC 9562's example and the well-known vectors of each standard namespace", async () => {
  assertEquals(await uuidV5(NAMESPACE_DNS, "www.example.com"), "2ed6657d-e927-568b-95e1-2665a8aea6a2");
  assertEquals(await uuidV5(NAMESPACE_DNS, "python.org"), "886313e1-3b8a-5372-9b90-0c9aee199e5d");
  assertEquals(await uuidV5(NAMESPACE_URL, "https://example.com/"), "dd2c1780-811a-5296-81c5-178a0ef488bc");
  assertEquals(await uuidV5(NAMESPACE_OID, "1.3.6.1"), "1447fa61-5277-5fef-a9b3-fbc6e44f4af3");
  assertEquals(await uuidV5(NAMESPACE_X500, "cn=example"), "3ecc4f45-80bb-593a-be98-00e146377827");
  assertEquals(await uuidV5(NAMESPACE_DNS, "é✓"), "0ab2dff9-ba69-57a8-855f-ef112a00023b");
  assertEquals(await uuidV5(NAMESPACE_DNS, ""), "4ebd0208-8328-5d69-8c44-ec50939c0967");
  assertEquals(await uuidV5(NAMESPACE_DNS, new TextEncoder().encode("www.example.com")), "2ed6657d-e927-568b-95e1-2665a8aea6a2");
});

proves([OSCAL], "every version 5 UUID has version 5 and the RFC variant, and is the same for the same namespace and name", async () => {
  await fc.assert(
    fc.asyncProperty(fc.string(), async (name) => {
      const u = await uuidV5(NAMESPACE_URL, name);
      assertEquals(uuidVersion(u), 5);
      assert(["8", "9", "a", "b"].includes(u.charAt(19)), `the variant of ${u}`);
      assertEquals(await uuidV5(NAMESPACE_URL, name), u);
      assertEquals(uuidOf(u), u);
    }),
    { numRuns: 50 },
  );
});

proves([OSCAL], "UUIDs read any case and a urn:uuid: prefix, refuse what is not one, and round-trip through bytes", () => {
  assertEquals(uuidOf("URN:UUID:6BA7B810-9DAD-11D1-80B4-00C04FD430C8"), NAMESPACE_DNS);
  assertEquals(uuidOf("6ba7b810-9dad-11d1-80b4-00c04fd430c"), undefined);
  assertEquals(uuidOf("6ba7b810-9dad-11d1-80b4-00c04fd430cg"), undefined);
  assertEquals(uuidUrn(NAMESPACE_DNS), "urn:uuid:6ba7b810-9dad-11d1-80b4-00c04fd430c8");
  assertEquals(uuidFromBytes(new Uint8Array(16)), NIL_UUID);
  assertEquals(uuidFromBytes(new Uint8Array(15)), undefined);
  assertEquals(uuidDecoder("6BA7B811-9DAD-11D1-80B4-00C04FD430C8").kind, "ok");
  assertEquals(uuidDecoder(42).kind, "err");
  fc.assert(
    fc.property(fc.uint8Array({ minLength: 16, maxLength: 16 }), (bytes) => {
      const u: Uuid | undefined = uuidFromBytes(bytes);
      assert(u !== undefined);
      assertEquals([...uuidBytes(u)], [...bytes]);
    }),
  );
});

proves([OSCAL], "names made of parts are kept apart: [a/b] and [a, b] give different UUIDs", async () => {
  assertEquals(nameOf(["a", "b"]), '["a","b"]');
  const one = await uuidV5Of(NAMESPACE_URL, ["a/b"]);
  const two = await uuidV5Of(NAMESPACE_URL, ["a", "b"]);
  assert(one !== two);
  assertEquals(await uuidV5Of(NAMESPACE_URL, ["a", "b"]), two);
});
