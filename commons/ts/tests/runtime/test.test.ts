/**
 * Tests of `runtime/test.ts`: the assertions fail where they should, `proves` keeps what each test proves, and a skipped test is skipped.
 *
 * @module
 */
import {
  assert,
  assertArrayIncludes,
  assertEquals,
  assertExists,
  assertInstanceOf,
  assertMatch,
  assertNotEquals,
  assertRejects,
  assertStrictEquals,
  assertStringIncludes,
  assertThrows,
  fail,
  proofs,
  proves,
  reviewed,
  reviews,
  test,
} from "../../runtime/test.ts";

const FR = "0005-typescript-runtime FR-013";

proves([FR], "each assertion passes on what it describes and throws on what it does not", async () => {
  assert(true);
  assertEquals({ a: [1, new Uint8Array([2])] }, { a: [1, new Uint8Array([2])] });
  assertNotEquals({ a: 1 }, { a: 2 });
  assertStrictEquals(Number.NaN, Number.NaN);
  assertExists(0);
  assertInstanceOf(new TypeError("x"), Error);
  assertStringIncludes("hello", "ell");
  assertMatch("v1.2", /\d\.\d/);
  assertArrayIncludes([{ a: 1 }, { b: 2 }], [{ b: 2 }]);
  const cases: (() => void)[] = [
    () => assert(false, "m"),
    () => assertEquals({ a: 1 }, { a: 2 }, "m"),
    () => assertEquals<unknown>(1, "1"),
    () => assertNotEquals(1, 1),
    () => assertStrictEquals({}, {}),
    () => assertExists(null),
    () => assertInstanceOf("x", Error),
    () => assertStringIncludes("a", "b"),
    () => assertMatch("a", /b/),
    () => assertArrayIncludes([1], [2]),
    () => assertThrows(() => 1),
    () => assertThrows(() => {
      throw new Error("x");
    }, TypeError),
    () => assertThrows(() => {
      throw new Error("x");
    }, Error, "y"),
    () => fail("always"),
  ];
  for (const c of cases) {
    let threw = false;
    try {
      c();
    } catch {
      threw = true;
    }
    assert(threw, c.toString());
  }
  const e = assertThrows(() => {
    throw new RangeError("out of range");
  }, RangeError, "range");
  assertEquals(e.message, "out of range");
  await assertRejects(() => Promise.reject(new TypeError("t")), TypeError, "t");
  let rejected = false;
  await assertRejects(() => Promise.resolve(1)).catch(() => {
    rejected = true;
  });
  assert(rejected);
});

reviewed("example-spec FR-001", "an example of a review declared in code");

proves([FR], "proves names the test for its requirements and keeps them; reviewed keeps the reason", () => {
  const mine = proofs.find((p) => p.test.endsWith("keeps the reason"));
  assertEquals(mine?.requirements, [FR]);
  assert(mine?.test.startsWith(`${FR}: `) === true);
  assertEquals(reviews.find((r) => r.requirement === "example-spec FR-001")?.reason, "an example of a review declared in code");
});

test("helper: a skipped test is not run", () => fail("a skipped test ran"), { skip: "it is skipped on purpose" });
test("helper: a test with a timeout runs", async () => {
  await Promise.resolve();
}, { timeout: 10_000 });
