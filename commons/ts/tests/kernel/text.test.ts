/**
 * Tests of `kernel/text.ts`, `kernel/ts-literal.ts`, `kernel/absurd.ts`, `kernel/brand.ts` and `kernel/types.ts`: text helpers, literals
 * written and read back, and the type-level tests themselves, with negative controls.
 *
 * @module
 */
import fc from "fast-check";
import { absurd } from "../../kernel/absurd.ts";
import type { Brand } from "../../kernel/brand.ts";
import { lf, plain, quoteArgs, splitArgs } from "../../kernel/text.ts";
import { exportedLiteral, type Literal, parseTsLiteral, tsKey, tsLiteral } from "../../kernel/ts-literal.ts";
import { type Equal, expectType, type Extends, type Not } from "../../kernel/types.ts";
import { assertEquals, assertThrows, proves } from "../../runtime/test.ts";

proves(["0005-typescript-runtime FR-009"], "lf, plain, splitArgs and quoteArgs", () => {
  assertEquals(lf("a\r\nb\r\n"), "a\nb\n");
  assertEquals(plain("\u001b[1;32mok\u001b[0m done"), "ok done");
  assertEquals(splitArgs(`git commit -m "a message" '' x`), { kind: "ok", value: ["git", "commit", "-m", "a message", "", "x"] });
  assertEquals(splitArgs(`echo "open`).kind, "err");
  assertEquals(quoteArgs(["echo", "it's", "a b", "", "x=1"]), `echo 'it'"'"'s' 'a b' '' x=1`);
});

proves(
  ["0005-typescript-runtime FR-009", "0005-typescript-runtime FR-014"],
  "words quoted by quoteArgs split back to the same words",
  () => {
    const word = fc.stringMatching(/^[A-Za-z0-9 _.\-=/]{0,8}$/);
    fc.assert(
      fc.property(fc.array(word, { maxLength: 6 }), (words) => assertEquals(splitArgs(quoteArgs(words)), { kind: "ok", value: words })),
    );
  },
);

const literal: fc.Arbitrary<Literal> = fc.jsonValue().map((v) => JSON.parse(JSON.stringify(v)) as Literal);

proves(
  ["0005-typescript-runtime FR-011", "0005-typescript-runtime FR-014"],
  "a literal written and read back is the same value (round trip)",
  () => {
    fc.assert(
      fc.property(literal, (v) => {
        const text = tsLiteral(v);
        assertEquals(parseTsLiteral(text), { kind: "ok", value: { value: v, end: text.length } });
      }),
    );
  },
);

proves(["0005-typescript-runtime FR-011"], "keys bare where they can be; comments and trailing commas read; anything else refused", () => {
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

type Shape = { readonly kind: "circle"; readonly r: number } | { readonly kind: "square"; readonly side: number };
function area(s: Shape): number {
  switch (s.kind) {
    case "circle":
      return Math.PI * s.r ** 2;
    case "square":
      return s.side ** 2;
    default:
      return absurd(s);
  }
}

proves(
  ["0005-typescript-runtime FR-005", "0005-typescript-runtime FR-014"],
  "absurd: a switch that leaves an alternative out does not compile",
  () => {
    assertEquals(area({ kind: "square", side: 2 }), 4);
    const partial = (s: Shape): number => {
      if (s.kind === "circle") return 0;
      // @ts-expect-error the square is not handled, so s is not never
      return absurd(s);
    };
    assertThrows(() => partial({ kind: "square", side: 1 }), Error, "not handled");
  },
);

type UserId = Brand<string, "UserId">;
type OrderId = Brand<string, "OrderId">;

proves(
  ["0005-typescript-runtime FR-005", "0005-typescript-runtime FR-014"],
  "brands keep identifiers apart; the type-level tests see the difference",
  () => {
    const id = "u1" as UserId;
    // @ts-expect-error a UserId is not an OrderId
    const order: OrderId = id;
    void order;
    // @ts-expect-error a plain string is not a UserId
    const plainId: UserId = "u1";
    void plainId;
    const s: string = id;
    void s;
    expectType<Equal<1, 1>>();
    expectType<Not<Equal<1, number>>>();
    expectType<Not<Equal<{ a: 1 }, { readonly a: 1 }>>>();
    expectType<Extends<1, number>>();
    // @ts-expect-error the negative control: number is not 1, so Equal is false and expectType refuses it
    expectType<Equal<number, 1>>();
  },
);
