/**
 * Tests of `kernel/decode.ts`: every decoder accepts what it describes and names the path of what it refuses, decoding the output of
 * `JSON.stringify` gives the value back, and the types it gives are the types described.
 *
 * @module
 */
import fc from "fast-check";
import type { Brand } from "../../kernel/brand.ts";
import {
  array,
  boolean,
  type Decoded,
  describe,
  formatDecodeError,
  integer,
  json,
  literal,
  mapDecoder,
  nullable,
  number,
  object,
  oneOf,
  record,
  refine,
  string,
  tagged,
  tuple,
  unknownValue,
} from "../../kernel/decode.ts";
import { err, ok } from "../../kernel/result.ts";
import { type Equal, expectType, type Extends } from "../../kernel/types.ts";
import { assertEquals, proves } from "../../runtime/test.ts";

const FR = "0005-typescript-runtime FR-006";

const person = object({ name: string, age: integer, tags: array(string) }, { email: string, nick: nullable(string) });
type Person = Decoded<typeof person>;

proves([FR, "0005-typescript-runtime FR-014"], "a value written as JSON decodes back to itself (round trip)", () => {
  const arb = fc.record(
    { name: fc.string(), age: fc.integer(), tags: fc.array(fc.string()), email: fc.string(), nick: fc.option(fc.string(), { nil: null }) },
    { requiredKeys: ["name", "age", "tags"], noNullPrototype: true },
  );
  fc.assert(fc.property(arb, (p) => assertEquals(json(JSON.stringify(p), person), ok(p))));
});

proves([FR], "each decoder names the path, what it expected and what it found", () => {
  assertEquals(person({ name: "a", age: 1.5, tags: [] }), err({ kind: "decode", path: "$.age", expected: "an integer", found: "number 1.5" }));
  assertEquals(person({ name: "a", age: 1, tags: ["x", 2] }), err({ kind: "decode", path: "$.tags[1]", expected: "a string", found: "number 2" }));
  assertEquals(person([]), err({ kind: "decode", path: "$", expected: "an object", found: "an array" }));
  assertEquals(number(Number.NaN).kind, "err");
  assertEquals(boolean("true").kind, "err");
  assertEquals(literal("a", "b")("c"), err({ kind: "decode", path: "$", expected: "one of a, b", found: 'the string "c"' }));
  assertEquals(tuple(string, integer)(["a", 1]), ok(["a", 1] as const));
  assertEquals(tuple(string, integer)(["a"]).kind, "err");
  assertEquals(record(integer)({ a: 1, b: 2 }), ok({ a: 1, b: 2 }));
  assertEquals(record(integer)({ a: "x" }).kind, "err");
  assertEquals(oneOf(integer, string)("x"), ok("x"));
  assertEquals(oneOf(integer, string)(true).kind, "err");
  assertEquals(mapDecoder(string, (s) => s.length)("abc"), ok(3));
  assertEquals(unknownValue(Symbol.for("x")).kind, "ok");
  assertEquals(json("{", string).kind, "err");
  assertEquals(describe(undefined), "nothing");
  assertEquals(describe(() => 1), "a function");
  assertEquals(formatDecodeError({ kind: "decode", path: "$.a", expected: "a string", found: "null" }), "$.a: expected a string, found null");
});

proves([FR], "optional fields absent or undefined are left out; unknown fields are dropped", () => {
  assertEquals(person({ name: "a", age: 1, tags: [], email: undefined, extra: 1 }), ok({ name: "a", age: 1, tags: [] }));
});

const shape = tagged({
  circle: object({ kind: literal("circle"), r: number }),
  square: object({ kind: literal("square"), side: number }),
});

proves([FR], "tagged picks the alternative by kind, and names kind where none fits", () => {
  assertEquals(shape({ kind: "circle", r: 1 }), ok({ kind: "circle", r: 1 }));
  assertEquals(shape({ kind: "hexagon" }), err({ kind: "decode", path: "$.kind", expected: "one of circle, square", found: 'the string "hexagon"' }));
  assertEquals(shape({ kind: "toString" }).kind, "err");
});

type Port = Brand<number, "port">;
const port = refine(integer, "port", (n) => n > 0 && n < 65536);

proves([FR, "0005-typescript-runtime FR-014"], "refine makes a branded value only where it is valid, and the types follow", () => {
  assertEquals(port(80), ok(80 as Port));
  assertEquals(port(0), err({ kind: "decode", path: "$", expected: "a port", found: "number 0" }));
  expectType<Equal<Decoded<typeof port>, Port>>();
  expectType<Equal<Person["age"], number>>();
  expectType<Equal<Person["email"], string | undefined>>();
  type Shape = { readonly kind: "circle"; readonly r: number } | { readonly kind: "square"; readonly side: number };
  expectType<Extends<Decoded<typeof shape>, Shape>>();
  expectType<Extends<Shape, Decoded<typeof shape>>>();
  // @ts-expect-error a plain number is not a Port
  const p: Port = 80;
  void p;
});
