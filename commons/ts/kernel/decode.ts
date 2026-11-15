/**
 * Decoders: everything that enters a program is decoded from `unknown` into a typed value once, where it enters, and past a decoder no code
 * holds `unknown` (commons 0005-typescript-runtime FR-006). The type assertions a decoder needs are confined to this file. Taken from erga's
 * kernel (`decode.decode.ts`), with `nullable`, `record`, `tuple` and `json` added.
 *
 * @example
 * ```ts
 * import { integer, object, string } from "./decode.ts";
 * const person = object({ name: string, age: integer });
 * person({ name: "Ada", age: 36 }); // { kind: "ok", value: { name: "Ada", age: 36 } }
 * ```
 *
 * @module
 */
import type { Brand } from "./brand.ts";
import { err, ok, type Result } from "./result.ts";

/** Why a value did not decode: the path of the first field that failed, what was expected there and what was found. */
export type DecodeError = { readonly kind: "decode"; readonly path: string; readonly expected: string; readonly found: string };

/** A function from anything to a typed value, or the reason it is not one; `path` names where the value sits, `$` by default. */
export type Decoder<T> = (input: unknown, path?: string) => Result<T, DecodeError>;

/** The type a decoder gives. */
export type Decoded<D> = D extends Decoder<infer T> ? T : never;

/** A short description of a value for an error message: its type, and the start of it where it is a string. */
export function describe(input: unknown): string {
  if (input === null) return "null";
  if (input === undefined) return "nothing";
  if (Array.isArray(input)) return "an array";
  const t = typeof input;
  if (t === "string") return `the string ${JSON.stringify(input).slice(0, 60)}`;
  if (t === "object") return "an object";
  if (t === "function") return "a function";
  return `${t} ${String(input)}`;
}

function fail(path: string, expected: string, input: unknown): Result<never, DecodeError> {
  return err({ kind: "decode", path, expected, found: describe(input) });
}

/** A decode error as one sentence: `$.age: expected an integer, found the string "x"`. */
export function formatDecodeError(e: DecodeError): string {
  return `${e.path}: expected ${e.expected}, found ${e.found}`;
}

/** A string. */
export const string: Decoder<string> = (input, path = "$") => typeof input === "string" ? ok(input) : fail(path, "a string", input);

/** A finite number. */
export const number: Decoder<number> = (input, path = "$") =>
  typeof input === "number" && Number.isFinite(input) ? ok(input) : fail(path, "a finite number", input);

/** An integer. */
export const integer: Decoder<number> = (input, path = "$") =>
  typeof input === "number" && Number.isInteger(input) ? ok(input) : fail(path, "an integer", input);

/** A boolean. */
export const boolean: Decoder<boolean> = (input, path = "$") => typeof input === "boolean" ? ok(input) : fail(path, "a boolean", input);

/** Any value at all, kept as `unknown`: for a field whose contents another decoder reads later. */
export const unknownValue: Decoder<unknown> = (input) => ok(input);

/** One of the given string literals. */
export function literal<const L extends readonly string[]>(...values: L): Decoder<L[number]> {
  return (input, path = "$") =>
    typeof input === "string" && values.includes(input) ? ok(input as L[number]) : fail(path, `one of ${values.join(", ")}`, input);
}

/** `null`, or what `inner` decodes. */
export function nullable<T>(inner: Decoder<T>): Decoder<T | null> {
  return (input, path = "$") => input === null ? ok(null) : inner(input, path);
}

/** An array whose every element decodes. */
export function array<T>(element: Decoder<T>): Decoder<readonly T[]> {
  return (input, path = "$") => {
    if (!Array.isArray(input)) return fail(path, "an array", input);
    const out: T[] = [];
    for (const [i, value] of input.entries()) {
      const r = element(value, `${path}[${i}]`);
      if (r.kind === "err") return r;
      out.push(r.value);
    }
    return ok(out);
  };
}

/** An array of exactly as many elements as decoders, each decoded by its own. */
export function tuple<const D extends readonly Decoder<unknown>[]>(...elements: D): Decoder<{ readonly [K in keyof D]: Decoded<D[K]> }> {
  return (input, path = "$") => {
    if (!Array.isArray(input) || input.length !== elements.length) return fail(path, `an array of ${elements.length}`, input);
    const out: unknown[] = [];
    for (const [i, decoder] of elements.entries()) {
      const r = decoder(input[i], `${path}[${i}]`);
      if (r.kind === "err") return r;
      out.push(r.value);
    }
    return ok(out as { readonly [K in keyof D]: Decoded<D[K]> });
  };
}

const isPlainObject = (input: unknown): input is object => typeof input === "object" && input !== null && !Array.isArray(input);

/** An object used as a map: every own key kept, every value decoded. */
export function record<T>(value: Decoder<T>): Decoder<Readonly<Record<string, T>>> {
  return (input, path = "$") => {
    if (!isPlainObject(input)) return fail(path, "an object", input);
    const out: Record<string, T> = {};
    for (const key of Object.keys(input)) {
      const r = value(Reflect.get(input, key), `${path}.${key}`);
      if (r.kind === "err") return r;
      out[key] = r.value;
    }
    return ok(out);
  };
}

/** The decoders of an object's fields. */
export type Fields = Readonly<Record<string, Decoder<unknown>>>;

/** The value an object decoder gives: the required fields, and the optional ones that may be absent. */
export type ObjectOf<R extends Fields, O extends Fields> = { readonly [K in keyof R]: Decoded<R[K]> } & { readonly [K in keyof O]?: Decoded<O[K]> };

/** An object whose every required field decodes; `optional` fields may be absent (or `undefined`), and are then absent from the value. Other fields are dropped. */
export function object<R extends Fields, O extends Fields = Record<never, never>>(required: R, optional?: O): Decoder<ObjectOf<R, O>> {
  return (input, path = "$") => {
    if (!isPlainObject(input)) return fail(path, "an object", input);
    const out: Record<string, unknown> = {};
    for (const [key, decoder] of Object.entries(required)) {
      const r = decoder(Reflect.get(input, key), `${path}.${key}`);
      if (r.kind === "err") return r;
      out[key] = r.value;
    }
    for (const [key, decoder] of Object.entries(optional ?? {})) {
      const value: unknown = Reflect.get(input, key);
      if (value === undefined) continue;
      const r = decoder(value, `${path}.${key}`);
      if (r.kind === "err") return r;
      out[key] = r.value;
    }
    return ok(out as ObjectOf<R, O>);
  };
}

/** A union of object types told apart by their `kind`: the decoder of the alternative the input's `kind` names. */
export function tagged<const D extends Readonly<Record<string, Decoder<{ readonly kind: string }>>>>(alternatives: D): Decoder<Decoded<D[keyof D]>> {
  return (input, path = "$") => {
    const kind: unknown = isPlainObject(input) ? Reflect.get(input, "kind") : undefined;
    const decoder = typeof kind === "string" && Object.hasOwn(alternatives, kind) ? alternatives[kind] : undefined;
    if (decoder === undefined) return fail(`${path}.kind`, `one of ${Object.keys(alternatives).join(", ")}`, kind);
    return decoder(input, path) as Result<Decoded<D[keyof D]>, DecodeError>;
  };
}

/** The first of several decoders that accepts the input. */
export function oneOf<const D extends readonly Decoder<unknown>[]>(...alternatives: D): Decoder<Decoded<D[number]>> {
  return (input, path = "$") => {
    for (const decoder of alternatives) {
      const r = decoder(input, path);
      if (r.kind === "ok") return r as Result<Decoded<D[number]>, DecodeError>;
    }
    return fail(path, `one of ${alternatives.length} alternatives`, input);
  };
}

/** A decoded value transformed, as a decoder of the new type. */
export function mapDecoder<T, U>(base: Decoder<T>, f: (value: T) => U): Decoder<U> {
  return (input, path = "$") => {
    const r = base(input, path);
    return r.kind === "ok" ? ok(f(r.value)) : r;
  };
}

/** A value of `T` validated as a `B`: the one way a branded type is made. */
export function refine<T, B extends string>(base: Decoder<T>, name: B, valid: (value: T) => boolean): Decoder<Brand<T, B>> {
  return (input, path = "$") => {
    const r = base(input, path);
    if (r.kind === "err") return r;
    return valid(r.value) ? ok(r.value as Brand<T, B>) : fail(path, `a ${name}`, input);
  };
}

/** Text parsed as JSON and decoded; text that is not JSON is an error at `$` that says so. */
export function json<T>(text: string, decoder: Decoder<T>): Result<T, DecodeError> {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (e) {
    return err({ kind: "decode", path: "$", expected: "JSON", found: e instanceof Error ? e.message : String(e) });
  }
  return decoder(value);
}
