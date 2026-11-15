/**
 * Tests that run unchanged under `deno test`, `node --test` and `bun test` (commons 0005-typescript-runtime FR-013): registration on
 * `node:test`, assertions on `node:assert/strict`, with the names of `@std/assert` so a conversion is a rename. `proves` names the
 * requirements a test proves, as erga's kernel `test.ts` does, and keeps them for a report. Kept out of `./mod.ts`, so that importing the
 * runtime never loads a test runner.
 *
 * @example
 * ```ts
 * import { assertEquals, proves } from "./test.ts";
 * proves(["0005-typescript-runtime FR-013"], "one and one", () => assertEquals(1 + 1, 2));
 * ```
 *
 * @module
 */
import nodeAssert from "node:assert/strict";
import { test as nodeTest } from "node:test";

/** A test's body. */
export type TestFn = () => void | Promise<void>;

/** How to run a test: `skip` it (with the reason as a string), or give it a `timeout` in milliseconds. */
export type TestOptions = { readonly skip?: boolean | string; readonly timeout?: number };

/** A test registered with the runtime's runner. */
export function test(name: string, fn: TestFn, options: TestOptions = {}): void {
  if (options.skip === undefined && options.timeout === undefined) {
    nodeTest(name, async () => {
      await fn();
    });
    return;
  }
  nodeTest(name, { ...(options.skip === undefined ? {} : { skip: options.skip }), ...(options.timeout === undefined ? {} : { timeout: options.timeout }) }, async () => {
    await fn();
  });
}

/** A requirement cited by its specification and number: `0005-typescript-runtime FR-013`, or another repository's `erga 241-typescript-first FR-015`. */
export type Requirement = string;

/** The requirements each test proves, in the order the tests were registered, for a report. */
export const proofs: { readonly test: string; readonly requirements: readonly Requirement[] }[] = [];

/** The requirements declared as proven by review rather than a test, with the reason. */
export const reviews: { readonly requirement: Requirement; readonly reason: string }[] = [];

/** A test that proves one or more requirements, named for them: `0005-typescript-runtime FR-013: <name>`. */
export function proves(requirements: readonly [Requirement, ...Requirement[]], name: string, fn: TestFn, options: TestOptions = {}): void {
  const full = `${requirements.join(", ")}: ${name}`;
  proofs.push({ test: full, requirements });
  test(full, fn, options);
}

/** A requirement proven by review rather than by a test, with the reason. */
export function reviewed(requirement: Requirement, reason: string): void {
  reviews.push({ requirement, reason });
}

/** Fails unless `value` is truthy; narrows its type. */
export function assert(value: unknown, message?: string): asserts value {
  if (message === undefined) nodeAssert.ok(value);
  else nodeAssert.ok(value, message);
}

/** Fails unless the two are deeply and strictly equal (the same types, prototypes and values). */
export function assertEquals<T>(actual: T, expected: T, message?: string): void {
  if (message === undefined) nodeAssert.deepStrictEqual(actual, expected);
  else nodeAssert.deepStrictEqual(actual, expected, message);
}

/** Fails where the two are deeply and strictly equal. */
export function assertNotEquals<T>(actual: T, expected: T, message?: string): void {
  if (message === undefined) nodeAssert.notDeepStrictEqual(actual, expected);
  else nodeAssert.notDeepStrictEqual(actual, expected, message);
}

/** Fails unless the two are the same value (`Object.is`). */
export function assertStrictEquals<T>(actual: T, expected: T, message?: string): void {
  if (message === undefined) nodeAssert.strictEqual(actual, expected);
  else nodeAssert.strictEqual(actual, expected, message);
}

/** Fails unless the value is neither `null` nor `undefined`; narrows its type. */
export function assertExists<T>(value: T, message?: string): asserts value is NonNullable<T> {
  nodeAssert.ok(value !== null && value !== undefined, message ?? "expected a value, found null or undefined");
}

/** Fails unless the value is an instance of the class; narrows its type. */
export function assertInstanceOf<T>(value: unknown, Class: abstract new (...args: never[]) => T, message?: string): asserts value is T {
  nodeAssert.ok(value instanceof Class, message ?? `expected an instance of ${Class.name}`);
}

/** Fails unless the text includes the part. */
export function assertStringIncludes(actual: string, expected: string, message?: string): void {
  nodeAssert.ok(actual.includes(expected), message ?? `expected ${JSON.stringify(actual)} to include ${JSON.stringify(expected)}`);
}

/** Fails unless the text matches the pattern. */
export function assertMatch(actual: string, pattern: RegExp, message?: string): void {
  if (message === undefined) nodeAssert.match(actual, pattern);
  else nodeAssert.match(actual, pattern, message);
}

/** Fails unless every expected element is deeply equal to some element of the array. */
export function assertArrayIncludes<T>(actual: readonly T[], expected: readonly T[], message?: string): void {
  const missing = expected.filter((e) => !actual.some((a) => isDeepStrictEqual(a, e)));
  nodeAssert.ok(missing.length === 0, message ?? `expected the array to include ${JSON.stringify(missing)}`);
}

function isDeepStrictEqual(a: unknown, b: unknown): boolean {
  try {
    nodeAssert.deepStrictEqual(a, b);
    return true;
  } catch {
    return false;
  }
}

/** The error a function throws; fails where it throws none, or one not of `Class`, or one whose message does not include `includes`. */
export function assertThrows<E extends Error = Error>(fn: () => unknown, Class?: abstract new (...args: never[]) => E, includes?: string): E {
  try {
    fn();
  } catch (e) {
    checkThrown(e, Class, includes);
    return e as E;
  }
  throw new nodeAssert.AssertionError({ message: "expected the function to throw" });
}

/** The error a promise rejects with; fails where it fulfils, or rejects with one not of `Class`, or whose message does not include `includes`. */
export async function assertRejects<E extends Error = Error>(
  fn: () => PromiseLike<unknown>,
  Class?: abstract new (...args: never[]) => E,
  includes?: string,
): Promise<E> {
  try {
    await fn();
  } catch (e) {
    checkThrown(e, Class, includes);
    return e as E;
  }
  throw new nodeAssert.AssertionError({ message: "expected the promise to reject" });
}

function checkThrown(e: unknown, Class: (abstract new (...args: never[]) => Error) | undefined, includes: string | undefined): void {
  if (Class !== undefined && !(e instanceof Class)) {
    throw new nodeAssert.AssertionError({ message: `expected ${Class.name}, got ${e instanceof Error ? e.name : String(e)}: ${String(e)}` });
  }
  if (includes !== undefined && !(e instanceof Error && e.message.includes(includes))) {
    throw new nodeAssert.AssertionError({ message: `expected the error to include ${JSON.stringify(includes)}, got ${String(e)}` });
  }
}

/** Fails, with the message. */
export function fail(message: string): never {
  throw new nodeAssert.AssertionError({ message });
}
