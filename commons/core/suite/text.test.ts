/**
 * Tests of `src/text.ts`, `src/absurd.ts`, `src/brand.ts` and `src/types.ts`: text helpers and the type-level tests themselves, with negative controls.
 *
 * @module
 */
import fc from "fast-check";
import { absurd } from "../src/absurd.ts";
import type { Brand } from "../src/brand.ts";
import { lf, plain, quoteArgs, splitArgs } from "../src/text.ts";
import { type Equal, expectType, type Extends, type Not } from "../src/types.ts";
import { assertEquals, assertThrows, proves } from "@intellectual-frontiers/commons/ts/runtime/test";

proves(["0001-core FR-003"], "lf, plain, splitArgs and quoteArgs", () => {
  assertEquals(lf("a\r\nb\r\n"), "a\nb\n");
  assertEquals(plain("\u001b[1;32mok\u001b[0m done"), "ok done");
  assertEquals(splitArgs(`git commit -m "a message" '' x`), { kind: "ok", value: ["git", "commit", "-m", "a message", "", "x"] });
  assertEquals(splitArgs(`echo "open`).kind, "err");
  assertEquals(quoteArgs(["echo", "it's", "a b", "", "x=1"]), `echo 'it'"'"'s' 'a b' '' x=1`);
});

proves(["0001-core FR-003", "0001-core FR-004"], "words quoted by quoteArgs split back to the same words", () => {
  const word = fc.stringMatching(/^[A-Za-z0-9 _.\-=/]{0,8}$/);
  fc.assert(
    fc.property(fc.array(word, { maxLength: 6 }), (words) => assertEquals(splitArgs(quoteArgs(words)), { kind: "ok", value: words })),
  );
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

proves(["0001-core FR-001", "0001-core FR-004"], "absurd: a switch that leaves an alternative out does not compile", () => {
  assertEquals(area({ kind: "square", side: 2 }), 4);
  const partial = (s: Shape): number => {
    if (s.kind === "circle") return 0;
    // @ts-expect-error the square is not handled, so s is not never
    return absurd(s);
  };
  assertThrows(() => partial({ kind: "square", side: 1 }), Error, "not handled");
});

type UserId = Brand<string, "UserId">;
type OrderId = Brand<string, "OrderId">;

proves(["0001-core FR-001", "0001-core FR-004"], "brands keep identifiers apart; the type-level tests see the difference", () => {
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
});
