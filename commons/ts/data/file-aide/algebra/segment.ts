/**
 * Segments: the typed parts of a path, each with the text it matches, how it is read and written, and a few values of its own (its witnesses)
 * by which a layout finds two entries that match the same path (commons 0010-file-aide FR-006, FR-010).
 *
 * @module
 */
import { err, ok, type Result } from "../../../kernel/mod.ts";

/** Which case of the union a segment is. */
export type SegmentKind =
  | "literal"
  | "enumeration"
  | "slug"
  | "ulid"
  | "uuid"
  | "integer"
  | "date"
  | "partition"
  | "digest"
  | "fanout"
  | "file-name"
  | "rest"
  | "custom";

/** What a path does with a segment beyond reading and writing its text: nothing, compute it from another segment, or give it the rest of the path. */
export type SegmentRole =
  | { readonly kind: "plain" }
  | { readonly kind: "fanout"; readonly of: string; readonly chars: number }
  | { readonly kind: "rest"; readonly except: readonly string[] };

/**
 * One typed part of a path.
 *
 * @typeParam N - the segment's name, which is its field in a key
 * @typeParam T - the TypeScript type of its values
 * @typeParam D - whether its value is computed from another segment (a fan-out), and so is not a field of a key
 */
export interface Segment<N extends string, T, D extends boolean = false> {
  /** Which case it is. */
  readonly kind: SegmentKind;
  /** Its name, the field of a key it fills. */
  readonly name: N;
  /** Whether it is computed from another segment. */
  readonly derived: D;
  /** The regular expression its text matches whole, with no capturing group. */
  readonly source: string;
  /** Whether its text may have more than one length. */
  readonly variable: boolean;
  /** What a path does with it beyond reading and writing. */
  readonly role: SegmentRole;
  /** A few values of its own, which a layout formats into paths to find ambiguity. */
  readonly witnesses: readonly T[];
  /** Reads a value from its text, or says why the text is not one. */
  parse(text: string): Result<T, string>;
  /** Writes a value as text, or says why the value is not one of its. */
  format(value: T): Result<string, string>;
}

/** A segment of any name and type, as a path holds it. */
export type AnySegment = Segment<string, unknown, boolean>;

/** The type of a segment's values. */
export type ValueOf<S> = S extends Segment<string, infer T, boolean> ? T : never;

/** Escapes text so that a regular expression matches it as written. */
export const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

const whole = (source: string): RegExp => new RegExp(`^(?:${source})$`, "u");

/** A check of text that also refuses a value that is not a string, which a key built outside the compiler's sight may hold. */
const strings =
  <T>(check: (text: string) => Result<T, string>): ((value: unknown) => Result<T, string>) =>
  (value) =>
    typeof value === "string" ? check(value) : err(`${JSON.stringify(value)} is not text`);

function textSegment<const N extends string>(
  kind: SegmentKind,
  name: N,
  source: string,
  variable: boolean,
  witnesses: readonly string[],
  what: string,
): Segment<N, string> {
  const re = whole(source);
  const check = (text: string): Result<string, string> => (re.test(text) ? ok(text) : err(`${JSON.stringify(text)} is not ${what}`));
  return { kind, name, derived: false, source, variable, role: { kind: "plain" }, witnesses, parse: check, format: strings(check) };
}

/**
 * A segment that is always the same text.
 *
 * @param name - its field in a key, whose value is always `text`
 * @param text - the text
 */
export function literal<const N extends string, const V extends string>(name: N, text: V): Segment<N, V> {
  const check = (t: string): Result<V, string> => (t === text ? ok(text) : err(`${JSON.stringify(t)} is not ${JSON.stringify(text)}`));
  return {
    kind: "literal",
    name,
    derived: false,
    source: escapeRegExp(text),
    variable: false,
    role: { kind: "plain" },
    witnesses: [text],
    parse: check,
    format: strings(check),
  };
}

/**
 * A segment that is one of a few words.
 *
 * @param name - its field in a key
 * @param values - the words, at least one
 */
export function enumeration<const N extends string, const V extends string>(name: N, values: readonly [V, ...V[]]): Segment<N, V> {
  const set: ReadonlySet<string> = new Set(values);
  const isValue = (t: string): t is V => set.has(t);
  const check = (t: string): Result<V, string> => (isValue(t) ? ok(t) : err(`${JSON.stringify(t)} is not one of ${values.join(", ")}`));
  const lengths = new Set(values.map((v) => v.length));
  return {
    kind: "enumeration",
    name,
    derived: false,
    source: [...values]
      .sort((a, b) => b.length - a.length)
      .map(escapeRegExp)
      .join("|"),
    variable: lengths.size > 1,
    role: { kind: "plain" },
    witnesses: values,
    parse: check,
    format: strings(check),
  };
}

/**
 * Lowercase letters and digits in words joined by single hyphens: `design-systems-handbook`.
 *
 * @param name - its field in a key
 */
export function slug<const N extends string>(name: N): Segment<N, string> {
  return textSegment("slug", name, "[a-z0-9]+(?:-[a-z0-9]+)*", true, ["slug", "a-2"], "a slug");
}

/**
 * A ULID: 26 characters of Crockford's base 32, the first at most `7`.
 *
 * @param name - its field in a key
 */
export function ulid<const N extends string>(name: N): Segment<N, string> {
  return textSegment("ulid", name, "[0-7][0-9A-HJKMNP-TV-Z]{25}", false, ["01ARZ3NDEKTSV4RRFFQ69G5FAV"], "a ULID");
}

/**
 * A UUID, in lowercase.
 *
 * @param name - its field in a key
 */
export function uuid<const N extends string>(name: N): Segment<N, string> {
  const h = (n: number): string => `[0-9a-f]{${n}}`;
  return textSegment(
    "uuid",
    name,
    `${h(8)}-${h(4)}-${h(4)}-${h(4)}-${h(12)}`,
    false,
    ["0190f3c2-7a4b-7c3d-8e5f-0a1b2c3d4e5f"],
    "a lowercase UUID",
  );
}

/**
 * A whole number that is not negative: with no leading zero, or padded with zeros to a width.
 *
 * @param name - its field in a key
 * @param options - `width`, where the number is always written with that many digits
 */
export function integer<const N extends string>(name: N, options: { readonly width?: number } = {}): Segment<N, number> {
  const width = options.width;
  const source = width === undefined ? "0|[1-9][0-9]*" : `[0-9]{${width}}`;
  const re = whole(source);
  return {
    kind: "integer",
    name,
    derived: false,
    source,
    variable: width === undefined,
    role: { kind: "plain" },
    witnesses: [0, 7, 42],
    parse: (t) => {
      const n = Number(t);
      return re.test(t) && Number.isSafeInteger(n)
        ? ok(n)
        : err(`${JSON.stringify(t)} is not a whole number${width === undefined ? "" : ` of ${width} digits`}`);
    },
    format: (n) => {
      if (!Number.isSafeInteger(n) || n < 0) return err(`${n} is not a whole number that is not negative`);
      const t = width === undefined ? String(n) : String(n).padStart(width, "0");
      return re.test(t) ? ok(t) : err(`${n} does not fit in ${width ?? 0} digits`);
    },
  };
}

/** The formats a date segment is written in. */
export type DateFormat = "YYYY" | "YYYY-MM" | "YYYY-MM-DD" | "YYYYMMDD";

const DATE_SOURCE: { readonly [F in DateFormat]: string } = {
  YYYY: "[0-9]{4}",
  "YYYY-MM": "[0-9]{4}-[0-9]{2}",
  "YYYY-MM-DD": "[0-9]{4}-[0-9]{2}-[0-9]{2}",
  YYYYMMDD: "[0-9]{8}",
};
const DATE_WITNESS: { readonly [F in DateFormat]: string } = {
  YYYY: "2026",
  "YYYY-MM": "2026-11",
  "YYYY-MM-DD": "2026-11-15",
  YYYYMMDD: "20261115",
};

function realDate(t: string, format: DateFormat): boolean {
  const digits = t.replaceAll("-", "");
  const y = Number(digits.slice(0, 4));
  const m = format === "YYYY" ? 1 : Number(digits.slice(4, 6));
  const d = format === "YYYY-MM-DD" || format === "YYYYMMDD" ? Number(digits.slice(6, 8)) : 1;
  const at = new Date(Date.UTC(y, m - 1, d));
  return at.getUTCFullYear() === y && at.getUTCMonth() === m - 1 && at.getUTCDate() === d;
}

/**
 * A date of the calendar, kept as the text it is written as, which sorts as the dates do.
 *
 * @param name - its field in a key
 * @param format - how it is written
 */
export function date<const N extends string>(name: N, format: DateFormat): Segment<N, string> {
  const re = whole(DATE_SOURCE[format]);
  const check = (t: string): Result<string, string> =>
    re.test(t) && realDate(t, format) ? ok(t) : err(`${JSON.stringify(t)} is not a date written ${format}`);
  return {
    kind: "date",
    name,
    derived: false,
    source: DATE_SOURCE[format],
    variable: false,
    role: { kind: "plain" },
    witnesses: [DATE_WITNESS[format]],
    parse: check,
    format: strings(check),
  };
}

/**
 * A segment written as a `name=value` partition, as Hive and the stores that read its layout write it: `dt=2026-11-15`.
 *
 * @param inner - the segment of the value
 * @param key - the text before `=`, the inner segment's name where it is not given
 */
export function partition<const N extends string, T>(inner: Segment<N, T>, key: string = inner.name): Segment<N, T> {
  const prefix = `${key}=`;
  return {
    kind: "partition",
    name: inner.name,
    derived: false,
    source: `${escapeRegExp(prefix)}(?:${inner.source})`,
    variable: inner.variable,
    role: { kind: "plain" },
    witnesses: inner.witnesses,
    parse: (t) => (t.startsWith(prefix) ? inner.parse(t.slice(prefix.length)) : err(`${JSON.stringify(t)} does not begin with ${prefix}`)),
    format: (v) => {
      const r = inner.format(v);
      return r.kind === "ok" ? ok(`${prefix}${r.value}`) : r;
    },
  };
}

/** The algorithms a digest segment names, with the number of hexadecimal digits of each. */
export const DIGEST_LENGTHS = { sha256: 64, sha512: 128, sha1: 40, md5: 32 } as const;

/**
 * A digest in lowercase hexadecimal.
 *
 * @param name - its field in a key
 * @param algorithm - the algorithm, which fixes the length
 */
export function digest<const N extends string>(name: N, algorithm: keyof typeof DIGEST_LENGTHS): Segment<N, string> {
  const n = DIGEST_LENGTHS[algorithm];
  return textSegment("digest", name, `[0-9a-f]{${n}}`, false, ["0".repeat(n)], `a ${algorithm} digest in lowercase hexadecimal`);
}

/**
 * The first characters of another segment of the same path, written to spread files over folders: `ab/abcdef.pdf`. It is computed when a
 * key is written and checked when a path is read, and is not a field of the key.
 *
 * @param name - its own name, which no key holds
 * @param of - the segment whose text it begins
 * @param chars - how many characters
 */
export function fanout<const N extends string>(name: N, of: Segment<string, unknown>, chars: number): Segment<N, string, true> {
  const source = `[^/]{${chars}}`;
  const re = whole(source);
  const check = (t: string): Result<string, string> => (re.test(t) ? ok(t) : err(`${JSON.stringify(t)} is not ${chars} characters`));
  return {
    kind: "fanout",
    name,
    derived: true,
    source,
    variable: false,
    role: { kind: "fanout", of: of.name, chars },
    witnesses: [],
    parse: check,
    format: strings(check),
  };
}

const plainName = (t: string): boolean => t !== "" && t !== "." && t !== ".." && !t.includes("/");

/**
 * Any one name of a path: a file's or a folder's.
 *
 * @param name - its field in a key
 */
export function fileName<const N extends string>(name: N): Segment<N, string> {
  const check = (t: string): Result<string, string> => (plainName(t) ? ok(t) : err(`${JSON.stringify(t)} is not one name of a path`));
  return {
    kind: "file-name",
    name,
    derived: false,
    source: "[^/]+",
    variable: true,
    role: { kind: "plain" },
    witnesses: ["name.txt", "name"],
    parse: check,
    format: strings(check),
  };
}

/**
 * The rest of a path, one or more names: the last interpolation of a pattern and the whole of its element.
 *
 * @param name - its field in a key, whose value is the names joined by `/`
 * @param options - `except`, the first names it does not take (`issues.d`, a folder another entry holds)
 */
export function rest<const N extends string>(name: N, options: { readonly except?: readonly string[] } = {}): Segment<N, string> {
  const except = options.except ?? [];
  const check = (t: string): Result<string, string> => {
    const names = t.split("/");
    if (!names.every(plainName)) return err(`${JSON.stringify(t)} is not a path of names`);
    const first = names[0] ?? "";
    if (except.includes(first)) return err(`${JSON.stringify(t)} is below ${first}/, which it does not take`);
    return ok(t);
  };
  return {
    kind: "rest",
    name,
    derived: false,
    source: "[^/]+(?:/[^/]+)*",
    variable: true,
    role: { kind: "rest", except },
    witnesses: ["name.txt", "folder/name.txt"],
    parse: check,
    format: strings(check),
  };
}

/**
 * A segment whose text and type the caller gives.
 *
 * @param name - its field in a key
 * @param spec - the text it matches (a regular expression with no capturing group and no `/`), how its values are read and written, and
 *   witnesses
 */
export function custom<const N extends string, T>(
  name: N,
  spec: {
    readonly source: string;
    readonly variable: boolean;
    readonly witnesses: readonly T[];
    readonly parse: (text: string) => Result<T, string>;
    readonly format: (value: T) => Result<string, string>;
  },
): Segment<N, T> {
  return {
    kind: "custom",
    name,
    derived: false,
    source: spec.source,
    variable: spec.variable,
    role: { kind: "plain" },
    witnesses: spec.witnesses,
    parse: spec.parse,
    format: spec.format,
  };
}
