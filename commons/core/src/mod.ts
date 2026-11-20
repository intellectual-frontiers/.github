// Spec: 0001-core FR-007
/**
 * Core, the foundation of Intellectual Frontiers Commons (its specification 0001-core): errors as values (`Result`), exhaustive matching (`absurd`), branded types (`Brand`), decoders from `unknown`
 * to typed values, the pure text helpers, type-level tests, graphs of work and objects made for `exactOptionalPropertyTypes`. It imports nothing, names no host global and runs wherever ECMAScript does
 * (Bun, Node, a browser, a Worker).
 *
 * @example
 * ```ts
 * import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
 * type Stage = { readonly kind: "intake" } | { readonly kind: "review" };
 * function next(s: Stage): Result<Stage, string> {
 *   switch (s.kind) {
 *     case "intake": return ok({ kind: "review" });
 *     case "review": return err("review is the last stage");
 *     default: return absurd(s);
 *   }
 * }
 * ```
 *
 * @module
 */
export { absurd } from "./absurd.ts";
export type { Brand } from "./brand.ts";
export {
  array,
  boolean,
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
} from "./decode.ts";
export type { Decoded, DecodeError, Decoder, Fields, ObjectOf } from "./decode.ts";
export { order, schedule } from "./graph.ts";
export type { Cycle, Graph, Ran } from "./graph.ts";
export { compact } from "./objects.ts";
export type { Compact, Simplify } from "./objects.ts";
export { all, andThen, attempt, done, err, isErr, isOk, map, mapErr, match, ok, orElse, settle, unwrapOr } from "./result.ts";
export type { Err, Ok, Result } from "./result.ts";
export { ANSI, lf, plain, quoteArgs, splitArgs } from "./text.ts";
export { expectType } from "./types.ts";
export type { Equal, Extends, Not } from "./types.ts";
