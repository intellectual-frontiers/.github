/**
 * Tests of `kernel/result.ts`: the functor and monad laws of `Result`, property-tested, and each helper by example.
 *
 * @module
 */
import fc from "fast-check";
import {
  all,
  andThen,
  attempt,
  done,
  err,
  isErr,
  isOk,
  map,
  mapErr,
  match,
  ok,
  orElse,
  type Result,
  settle,
  unwrapOr,
} from "../src/result.ts";
import { type Equal, expectType } from "../src/types.ts";
import { assertEquals, proves } from "@intellectual-frontiers/commons/ts/runtime/test";

const FR = "0001-core FR-001";
const result: fc.Arbitrary<Result<number, string>> = fc.oneof(
  fc.integer().map((n) => ok(n)),
  fc.string().map((s) => err(s)),
);
const fn = fc.func<[number], number>(fc.integer());
const kleisli = fc.func<[number], Result<number, string>>(result);

proves([FR, "0001-core FR-004"], "map keeps identity and composition (functor laws)", () => {
  fc.assert(
    fc.property(result, (r) =>
      assertEquals(
        map(r, (x) => x),
        r,
      ),
    ),
  );
  fc.assert(
    fc.property(result, fn, fn, (r, f, g) =>
      assertEquals(
        map(map(r, f), g),
        map(r, (x) => g(f(x))),
      ),
    ),
  );
  fc.assert(
    fc.property(result, fn, fn, (r, f, g) => {
      const e: Result<number, number> = mapErr(r, (s) => s.length);
      assertEquals(
        mapErr(e, (x) => g(f(x))),
        mapErr(mapErr(e, f), g),
      );
    }),
  );
});

proves([FR, "0001-core FR-004"], "ok and andThen are a monad (left identity, right identity, associativity)", () => {
  fc.assert(fc.property(fc.integer(), kleisli, (a, f) => assertEquals(andThen(ok(a), f), f(a))));
  fc.assert(fc.property(result, (m) => assertEquals(andThen(m, ok), m)));
  fc.assert(
    fc.property(result, kleisli, kleisli, (m, f, g) =>
      assertEquals(
        andThen(andThen(m, f), g),
        andThen(m, (x) => andThen(f(x), g)),
      ),
    ),
  );
  fc.assert(
    fc.property(result, fn, (m, f) =>
      assertEquals(
        map(m, f),
        andThen(m, (x) => ok(f(x))),
      ),
    ),
  );
});

proves([FR, "0001-core FR-004"], "all gives every value in order, or the first failure", () => {
  fc.assert(
    fc.property(fc.array(result), (rs) => {
      const firstErr = rs.find(isErr);
      const got = all(rs);
      if (firstErr === undefined) assertEquals(got, ok(rs.filter(isOk).map((r) => r.value)));
      else assertEquals(got, firstErr);
    }),
  );
});

proves([FR], "orElse recovers a failure and leaves a success; unwrapOr, match, attempt and settle", async () => {
  fc.assert(
    fc.property(result, (r) =>
      assertEquals(
        orElse(r, (s) => ok(s.length)),
        ok(r.kind === "ok" ? r.value : r.error.length),
      ),
    ),
  );
  assertEquals(unwrapOr(err("x"), 3), 3);
  assertEquals(unwrapOr(ok(1), 3), 1);
  assertEquals(match(ok(2), { ok: (n) => n * 10, err: () => -1 }), 20);
  assertEquals(match(err("e"), { ok: () => "", err: (e) => e }), "e");
  assertEquals(
    attempt(
      (): unknown => JSON.parse("{"),
      () => "bad",
    ),
    err("bad"),
  );
  assertEquals(
    attempt(
      () => 1,
      () => "bad",
    ),
    ok(1),
  );
  assertEquals(await settle(Promise.reject(new Error("no")), (e) => (e instanceof Error ? e.message : "")), err("no"));
  assertEquals(await settle(Promise.resolve(4), () => ""), ok(4));
  assertEquals(done, ok(undefined));
});

proves([FR, "0001-core FR-004"], "the types: andThen keeps the error type, and a Result cannot be read without its kind", () => {
  const r = andThen(ok(1) as Result<number, "a">, (n) => ok(String(n)));
  expectType<Equal<typeof r, Result<string, "a">>>();
  assertEquals(r, ok("1"));
  const x = ok(1) as Result<number, string>;
  // @ts-expect-error the value of a result whose kind is not known cannot be read
  void x.value;
  if (x.kind === "ok") expectType<Equal<typeof x.value, number>>();
});
