/**
 * Objects made for `exactOptionalPropertyTypes` (commons 0005-typescript-runtime FR-064): `compact` builds an object from fields some of
 * which may be `undefined`, leaving those out, and its type says so exactly, so that a caller writes `compact({ a, b: maybe })` instead of
 * `{ a, ...(maybe === undefined ? {} : { b: maybe }) }` once for each optional field.
 *
 * @example
 * ```ts
 * import { compact } from "./objects.ts";
 * const timeout: number | undefined = undefined;
 * const options = compact({ url: "https://example.com", timeout }); // { url: string; timeout?: number }, and no `timeout` key
 * ```
 *
 * @module
 */

/** One object type with the members of an intersection, so that it reads (and compares) as one. */
export type Simplify<T> = { [K in keyof T]: T[K] } & {};

/** The keys of `T` whose type admits `undefined`. */
type MaybeKeys<T> = { [K in keyof T]-?: undefined extends T[K] ? K : never }[keyof T];

/**
 * `T` with each field whose type admits `undefined` made optional without `undefined`, and every other field kept as it is (`readonly`
 * kept): the type of `compact(value)` under `exactOptionalPropertyTypes`.
 */
export type Compact<T> = Simplify<
  { [K in keyof T as K extends MaybeKeys<T> ? never : K]: T[K] } & {
    [K in keyof T as K extends MaybeKeys<T> ? K : never]?: Exclude<T[K], undefined>;
  }
>;

/**
 * The object with its fields that are `undefined` left out (FR-064), typed exactly by {@link Compact}. Keys are kept in their order; a key
 * named `__proto__` is kept as an own field, never as the prototype.
 */
export function compact<T extends object>(value: T): Compact<T> {
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (v !== undefined) Object.defineProperty(out, k, { value: v, enumerable: true, writable: true, configurable: true });
  }
  // The loop above keeps exactly the own enumerable fields that are not `undefined`, which is what `Compact<T>` says; TypeScript cannot
  // follow a loop's keys into a mapped type, so this is the one assertion.
  return out as Compact<T>;
}
