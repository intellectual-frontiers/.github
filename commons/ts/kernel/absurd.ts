/**
 * Exhaustive matching: a `switch` on a union's `kind` ends with `default: return absurd(value)`, so that an alternative left out does not
 * compile (commons 0005-typescript-runtime FR-005). One name, `absurd`, for what erga called `absurd` and the machine setup `assertNever`.
 *
 * @example
 * ```ts
 * import { absurd } from "./absurd.ts";
 * type Shape = { readonly kind: "circle"; readonly r: number } | { readonly kind: "square"; readonly side: number };
 * function area(s: Shape): number {
 *   switch (s.kind) {
 *     case "circle": return Math.PI * s.r ** 2;
 *     case "square": return s.side ** 2;
 *     default: return absurd(s);
 *   }
 * }
 * ```
 *
 * @module
 */

/** The end of an exhaustive `switch`: its argument has the type `never` only when every alternative was handled. It throws if reached. */
export function absurd(value: never): never {
  throw new Error(`an alternative was not handled: ${JSON.stringify(value)}`);
}
