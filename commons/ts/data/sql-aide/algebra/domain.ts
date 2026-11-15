/**
 * Domains: the logical SQL types of the model, as one tagged union, each carrying the TypeScript type of its values
 * (commons 0009-sql-aide FR-006). A dialect says how each is written (FR-010).
 *
 * @module
 */

/** A value JSON can hold. */
export type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };

/** A value that can be written as a SQL literal or bound as a parameter. */
export type SqlValue = null | boolean | number | bigint | string | Date | Uint8Array | Json;

/** The logical SQL type of a domain: what it is, apart from how any dialect writes it. */
export type DomainSpec =
  | { readonly kind: "text"; readonly length?: number }
  | { readonly kind: "integer" }
  | { readonly kind: "bigint" }
  | { readonly kind: "real" }
  | { readonly kind: "numeric"; readonly precision: number; readonly scale: number }
  | { readonly kind: "boolean" }
  | { readonly kind: "date" }
  | { readonly kind: "timestamp"; readonly zone: boolean }
  | { readonly kind: "json"; readonly binary: boolean }
  | { readonly kind: "uuid" }
  | { readonly kind: "bytes" }
  | { readonly kind: "enum"; readonly values: readonly string[] }
  | { readonly kind: "array"; readonly of: DomainSpec }
  | { readonly kind: "custom"; readonly name: string };

/** The kinds of domain, the tags of {@link DomainSpec}. */
export type DomainKind = DomainSpec["kind"];

/**
 * A domain: a logical SQL type, the TypeScript type `T` of its values and the features `Req` a dialect must have to hold it.
 * `T` and `Req` exist only for the compiler.
 */
export interface Domain<T, Req extends string = never> {
  /** The logical type. */
  readonly spec: DomainSpec;
  /** Never set: carries the type of the values. */
  readonly __t?: T;
  /** Never set: carries the features the domain needs. */
  readonly __req?: Req;
}

/** Makes a domain of a logical type. The type of its values is the caller's to state: the factories below state it. */
export const domain = <T, Req extends string = never>(spec: DomainSpec): Domain<T, Req> => ({ spec });

/** Text of any length, or of at most `length` characters. */
export const textDomain = (length?: number): Domain<string> => domain(length === undefined ? { kind: "text" } : { kind: "text", length });
/** A 32-bit integer. */
export const integerDomain: Domain<number> = domain({ kind: "integer" });
/** A 64-bit integer, a `bigint` in TypeScript. */
export const bigintDomain: Domain<bigint> = domain({ kind: "bigint" });
/** A double-precision number. */
export const realDomain: Domain<number> = domain({ kind: "real" });
/** An exact decimal, kept as text in TypeScript so that no digit is lost. */
export const numericDomain = (precision: number, scale: number): Domain<string> => domain({ kind: "numeric", precision, scale });
/** True or false. */
export const booleanDomain: Domain<boolean> = domain({ kind: "boolean" });
/** A calendar date, `YYYY-MM-DD` in TypeScript. */
export const dateDomain: Domain<string> = domain({ kind: "date" });
/** A moment with no zone. */
export const timestampDomain: Domain<Date> = domain({ kind: "timestamp", zone: false });
/** A moment in a zone. */
export const timestamptzDomain: Domain<Date> = domain({ kind: "timestamp", zone: true });
/** A JSON value of type `T`, stored as text or, with `binary`, in the engine's binary form. */
export const jsonDomain = <T extends Json = Json>(binary = false): Domain<T> => domain({ kind: "json", binary });
/** A UUID, as text in TypeScript. */
export const uuidDomain: Domain<string> = domain({ kind: "uuid" });
/** Bytes. */
export const bytesDomain: Domain<Uint8Array> = domain({ kind: "bytes" });
/** One of a closed set of words, written as text with a check so that every dialect holds it. */
export const enumDomain = <const V extends readonly string[]>(values: V): Domain<V[number]> => domain({ kind: "enum", values });
/** An array of another domain's values: a dialect needs the `arrays` feature for it. */
export const arrayDomain = <T, Req extends string>(of: Domain<T, Req>): Domain<readonly T[], Req | "arrays"> =>
  domain({ kind: "array", of: of.spec });
