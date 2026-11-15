/**
 * Tests of types with no framework (commons 0005-typescript-runtime FR-014): `expectType<Equal<A, B>>()` compiles only where `A` and `B`
 * are the same type, and `// @ts-expect-error` above a line that must not compile fails the check where that line becomes legal. They cost
 * nothing at run time; `tsc` is what runs them.
 *
 * @example
 * ```ts
 * import { type Equal, expectType } from "./types.ts";
 * expectType<Equal<ReturnType<typeof Math.max>, number>>();
 * ```
 *
 * @module
 */

/** `true` where `A` and `B` are exactly the same type (not merely assignable either way), else `false`. */
export type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

/** `true` where `A` is assignable to `B`. */
export type Extends<A, B> = [A] extends [B] ? true : false;

/** `true` where `T` is `false`: the negation of a type-level test. */
export type Not<T extends boolean> = T extends true ? false : true;

/** Compiles only where its type argument is `true`; does nothing when run. */
export function expectType<_T extends true>(): void {}
