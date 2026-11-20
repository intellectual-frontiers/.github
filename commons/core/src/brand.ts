// Spec: 0001-core FR-001
/**
 * Identifiers are types: a branded type is a plain value that the compiler keeps apart from others of the same shape, made only by the
 * function that validates it (0001-core FR-001).
 *
 * @example
 * ```ts
 * import type { Brand } from "./brand.ts";
 * type UserId = Brand<string, "UserId">;
 * const userId = (s: string): UserId | undefined => /^u[0-9]+$/.test(s) ? s as UserId : undefined;
 * ```
 *
 * @module
 */

/** A value of `T` that has been validated as a `B`; the brand exists only for the compiler and costs nothing at run time. */
export type Brand<T, B extends string> = T & { readonly "@ifc/brand": B };
