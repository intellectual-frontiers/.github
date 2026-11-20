/**
 * Tests of `kernel/objects.ts`: `compact` leaves out the fields that are `undefined`, keeps the others and their order, and its type is
 * exact under `exactOptionalPropertyTypes`, with negative controls.
 *
 * @module
 */
import fc from "fast-check";
import { type Compact, compact } from "../src/objects.ts";
import { type Equal, expectType, type Extends, type Not } from "../src/types.ts";
import { assert, assertEquals, proves } from "@intellectual-frontiers/commons/ts/runtime/test";

const FR = "0001-core FR-006";

proves([FR, "0001-core FR-004"], "compact leaves out undefined fields, and its type makes them optional without undefined", () => {
  const maybe = (n: number): string | undefined => (n > 0 ? "x" : undefined);
  const some = compact({ a: 1, b: maybe(1), c: null });
  const none = compact({ a: 1, b: maybe(0), c: null });
  assertEquals(some, { a: 1, b: "x", c: null });
  assertEquals(none, { a: 1, c: null });
  assert(!Object.hasOwn(none, "b"), "no b key at all, not b: undefined");
  expectType<Equal<typeof some, { a: number; b?: string; c: null }>>();
  expectType<
    Equal<
      Compact<{ readonly a: number; readonly b?: string | undefined; c: undefined }>,
      { readonly a: number; readonly b?: string; c?: never }
    >
  >();
  expectType<Not<Equal<typeof some, { a: number; b: string | undefined; c: null }>>>();
  expectType<Not<Extends<{ b: undefined }, Compact<{ b: string | undefined }>>>>();
  const typed: { a: number; b?: string; c: null } = none;
  // @ts-expect-error under exactOptionalPropertyTypes the uncompacted object does not fit, which is why compact exists
  const raw: { a: number; b?: string } = { a: 1, b: maybe(0) };
  assertEquals([typed.a, raw.a], [1, 1]);
});

proves([FR], "compact keeps every defined field in its order, and a __proto__ field as an own field", () => {
  fc.assert(
    fc.property(fc.dictionary(fc.string(), fc.option(fc.integer(), { nil: undefined }), { noNullPrototype: true }), (d) => {
      const c = compact(d);
      assertEquals(
        Object.keys(c),
        Object.keys(d).filter((k) => d[k] !== undefined),
      );
      for (const [k, v] of Object.entries(c)) assertEquals(v, d[k]);
    }),
  );
  const parsed = JSON.parse('{"__proto__": {"polluted": true}}') as Record<string, unknown>;
  const proto = compact({ ...parsed, x: undefined });
  assertEquals(Object.getPrototypeOf(proto), Object.prototype);
  assertEquals(Object.keys(proto), ["__proto__"]);
});
