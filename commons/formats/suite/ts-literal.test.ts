/**
 * Tests of `ts-literal.ts`: literals written and read back, keys, comments and trailing commas, and the type-level refusal of what is not shaped as JSON.
 *
 * @module
 */
import fc from "fast-check";
import { exportedLiteral, type Literal, type LiteralShape, parseTsLiteral, tsKey, tsLiteral } from "../src/ts-literal.ts";
import { expectType, type Extends, type Not } from "@intellectual-frontiers/core";
import { assertEquals, proves } from "@intellectual-frontiers/test";

const literal: fc.Arbitrary<Literal> = fc.jsonValue().map((v) => JSON.parse(JSON.stringify(v)) as Literal);

proves(["0001-formats FR-006", "0001-core FR-004"], "a literal written and read back is the same value (round trip)", () => {
  fc.assert(
    fc.property(literal, (v) => {
      const text = tsLiteral(v);
      assertEquals(parseTsLiteral(text), { kind: "ok", value: { value: v, end: text.length } });
    }),
  );
});

proves(["0001-formats FR-006"], "keys bare where they can be; comments and trailing commas read; anything else refused", () => {
  assertEquals(tsKey("timezone"), "timezone");
  assertEquals(tsKey("otel-ui"), '"otel-ui"');
  assertEquals(
    tsLiteral({ a: 1, "b-c": [true, null], d: undefined, e: {} }),
    '{\n  a: 1,\n  "b-c": [\n    true,\n    null,\n  ],\n  e: {},\n}',
  );
  assertEquals(tsLiteral(Number.POSITIVE_INFINITY), "null");
  const src = 'export const fleet: Fleet = {\n  // a comment\n  name: "x",\n};\n';
  assertEquals(exportedLiteral(src, "fleet"), { kind: "ok", value: { name: "x" } });
  assertEquals(exportedLiteral(src, "other").kind, "err");
  assertEquals(parseTsLiteral("{ a: f() }"), { kind: "err", error: { kind: "literal", at: 5, expected: "a value" } });
  assertEquals(parseTsLiteral('"open').kind, "err");
  assertEquals(parseTsLiteral("[1 2]").kind, "err");
  const proto = parseTsLiteral('{ "__proto__": { "x": 1 } }');
  assertEquals(proto.kind === "ok" ? Object.getPrototypeOf(proto.value.value) : undefined, Object.prototype);
});

interface Fleet {
  readonly name: string;
  readonly tags?: readonly string[];
  readonly owner: { readonly role: string; readonly since: number | null };
  readonly pair: readonly [string, boolean];
}

proves(
  ["0001-formats FR-007", "0001-core FR-004"],
  "tsLiteral takes any type shaped as JSON and refuses one that is not",
  () => {
    const fleet: Fleet = { name: "east", owner: { role: "operator", since: null }, pair: ["a", true] };
    assertEquals(tsLiteral(fleet), tsLiteral({ name: "east", owner: { role: "operator", since: null }, pair: ["a", true] }));
    const read = parseTsLiteral(tsLiteral({ ...fleet, tags: ["x"] }));
    assertEquals(read.kind === "ok" ? read.value.value : undefined, { ...fleet, tags: ["x"] });
    const literal: Literal = { a: [1, "b"] };
    assertEquals(tsLiteral(literal), '{\n  a: [\n    1,\n    "b",\n  ],\n}');
    expectType<Extends<Fleet, LiteralShape<Fleet>>>();
    expectType<Extends<Literal, LiteralShape<Literal>>>();
    expectType<Not<Extends<{ when: Date }, LiteralShape<{ when: Date }>>>>();
    expectType<Not<Extends<{ n: bigint }, LiteralShape<{ n: bigint }>>>>();
    expectType<Not<Extends<{ x: unknown }, LiteralShape<{ x: unknown }>>>>();
    expectType<Not<Extends<readonly (string | undefined)[], LiteralShape<readonly (string | undefined)[]>>>>();
    interface WithMethod {
      readonly name: string;
      greet(): string;
    }
    const withMethod: WithMethod = { name: "x", greet: () => "hi" };
    // @ts-expect-error a value holding a method is not shaped as JSON
    tsLiteral(withMethod);
    // @ts-expect-error a Date is not shaped as JSON
    tsLiteral({ when: new Date(0) });
    // @ts-expect-error a Map is not shaped as JSON
    tsLiteral({ m: new Map<string, string>() });
    // @ts-expect-error undefined is a property's absence, never an item of an array
    tsLiteral([1, undefined]);
    // @ts-expect-error undefined alone is not a literal
    tsLiteral(undefined);
    // @ts-expect-error a symbol is not shaped as JSON
    tsLiteral({ s: Symbol("s") });
    // @ts-expect-error a bigint is not shaped as JSON
    tsLiteral({ n: 1n });
  },
);
