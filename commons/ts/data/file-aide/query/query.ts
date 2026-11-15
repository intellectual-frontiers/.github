/**
 * Queries: a value of `select`, `from`, `where`, `order by key`, `limit`, `with` and `scan` and nothing else, made by a typed builder whose
 * fields are an entry's key and a file's metadata, so that a field the entry lacks or a value of the wrong type does not compile (commons
 * 0010-file-aide FR-019, FR-020, FR-026).
 *
 * @module
 */
import type { Entry, KeyOfEntry } from "../algebra/entry.ts";

/** What a query knows of every file: its path and metadata, never its contents (FR-026). */
export type Meta = {
  /** Its path from the store's root. */
  readonly path: string;
  /** Its last name. */
  readonly name: string;
  /** What follows the last `.` of its name, or `""`. */
  readonly extension: string;
  /** Its size in bytes. */
  readonly size: number;
  /** When it was last written, where the store keeps it. */
  readonly modified: Date | null;
  /** Its version tag. */
  readonly version: string;
  /** How many names it is below where the query begins. */
  readonly depth: number;
  /** Whether a name of its path below where the query begins starts with `.`. */
  readonly hidden: boolean;
};

/** What a query on a root with no layout knows, which is also whether a row is a file or a folder. */
export type TreeMeta = Meta & { readonly type: "file" | "folder" };

/** The names of the fields of a file's metadata. */
export const META_FIELDS = ["path", "name", "extension", "size", "modified", "version", "depth", "hidden"] as const;

/** A value a query compares with. */
export type Scalar = string | number | boolean | null;

/** A comparison. */
export type Comparison = "=" | "<>" | "<" | "<=" | ">" | ">=";

/** The `where` of a query, as a tagged union. */
export type Expr =
  | { readonly kind: "true" }
  | { readonly kind: "and"; readonly items: readonly Expr[] }
  | { readonly kind: "or"; readonly items: readonly Expr[] }
  | { readonly kind: "not"; readonly item: Expr }
  | { readonly kind: "compare"; readonly field: string; readonly op: Comparison; readonly value: Scalar }
  | { readonly kind: "in"; readonly field: string; readonly values: readonly Scalar[] }
  | { readonly kind: "between"; readonly field: string; readonly low: Scalar; readonly high: Scalar }
  | { readonly kind: "glob"; readonly field: string; readonly pattern: string }
  | { readonly kind: "regex"; readonly field: string; readonly pattern: string }
  | { readonly kind: "within"; readonly field: string; readonly ms: number };

/** The options of `with` (FR-024, FR-025, FR-027, FR-028). */
export type Options = {
  /** Whether `.gitignore`, `.git/info/exclude` and `.faignore` leave paths out; on by default. */
  readonly ignore: boolean;
  /** Whether names that begin with `.` are walked; off by default. */
  readonly hidden: boolean;
  /** Whether `regex` is allowed; off by default. */
  readonly regex: boolean;
  /** How many folders are listed at once. */
  readonly parallel: number;
};

/** The options a query has where it does not say. */
export const DEFAULT_OPTIONS: Options = { ignore: true, hidden: false, regex: false, parallel: 8 };

/** Where a query reads: the files of one entry of a layout, or every file and folder under a root. */
export type Source =
  { readonly kind: "entry"; readonly entry: Entry<string, object, unknown> } | { readonly kind: "root"; readonly root: string };

/** A query as a value (FR-019). */
export type QueryValue = {
  readonly select: "*" | readonly string[];
  readonly from: Source;
  readonly where: Expr;
  readonly orderByKey: boolean;
  readonly limit: number | undefined;
  readonly with: Options;
  readonly scan: boolean;
};

/** The fields of a row of an entry: its key's and a file's metadata. */
export type RowOf<E> = KeyOfEntry<E> & Meta;

/** A ready query whose rows are `R`. */
export interface Query<R> {
  /** The query as a value. */
  readonly value: QueryValue;
  /** Only so the compiler keeps the type of a row. */
  readonly row?: R;
}

/** What a `where` callback is given: one function for each part of an expression, typed by the row. */
export interface Where<R> {
  /** Every one of them holds. */
  and(...items: Expr[]): Expr;
  /** At least one of them holds. */
  or(...items: Expr[]): Expr;
  /** It does not hold. */
  not(item: Expr): Expr;
  /** The field equals the value. */
  eq<F extends keyof R & string>(field: F, value: R[F]): Expr;
  /** The field does not equal the value. */
  ne<F extends keyof R & string>(field: F, value: R[F]): Expr;
  /** The field is below the value. */
  lt<F extends keyof R & string>(field: F, value: NonNullable<R[F]> | Ordered<R[F]>): Expr;
  /** The field is below or equal to the value. */
  le<F extends keyof R & string>(field: F, value: NonNullable<R[F]> | Ordered<R[F]>): Expr;
  /** The field is above the value. */
  gt<F extends keyof R & string>(field: F, value: NonNullable<R[F]> | Ordered<R[F]>): Expr;
  /** The field is above or equal to the value. */
  ge<F extends keyof R & string>(field: F, value: NonNullable<R[F]> | Ordered<R[F]>): Expr;
  /** The field is one of the values. */
  in<F extends keyof R & string>(field: F, values: readonly R[F][]): Expr;
  /** The field is between two values, both included. */
  between<F extends keyof R & string>(field: F, low: NonNullable<R[F]> | Ordered<R[F]>, high: NonNullable<R[F]> | Ordered<R[F]>): Expr;
  /** The field, which is text, matches a glob. */
  glob<F extends TextFields<R>>(field: F, pattern: string): Expr;
  /** The field, which is text, matches a regular expression; only where `with` allows it. */
  regex<F extends TextFields<R>>(field: F, pattern: string): Expr;
  /** The time is within a duration of now: a number of milliseconds, or `7d`, `12h`, `30m`, `10s`. */
  within<F extends TimeFields<R>>(field: F, duration: number | string): Expr;
}

/** A date given as text in a comparison, written as ISO 8601. */
type Ordered<T> = [T] extends [Date | null] ? string : never;
/** The fields of a row whose values are text. */
type TextFields<R> = { [F in keyof R & string]: R[F] extends string ? F : never }[keyof R & string];
/** The fields of a row whose values are times. */
type TimeFields<R> = { [F in keyof R & string]: [R[F]] extends [Date | null] ? F : never }[keyof R & string];

const DURATION = /^([0-9]+(?:\.[0-9]+)?)(ms|s|m|h|d|w)$/u;
const UNIT: { readonly [u: string]: number } = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 };

/** A duration in milliseconds, from a number or text such as `7d`; `undefined` where it is not one. */
export function durationOf(d: number | string): number | undefined {
  if (typeof d === "number") return Number.isFinite(d) && d >= 0 ? d : undefined;
  const m = DURATION.exec(d.trim());
  const n = Number(m?.[1]);
  const unit = UNIT[m?.[2] ?? ""];
  return m === null || unit === undefined ? undefined : n * unit;
}

const scalar = (v: unknown): Scalar =>
  v instanceof Date ? v.toISOString() : typeof v === "string" || typeof v === "number" || typeof v === "boolean" ? v : null;

/** The functions a `where` callback is given. */
export function whereOf<R>(): Where<R> {
  const cmp =
    (op: Comparison) =>
    (field: string, value: unknown): Expr => ({ kind: "compare", field, op, value: scalar(value) });
  return {
    and: (...items) => ({ kind: "and", items }),
    or: (...items) => ({ kind: "or", items }),
    not: (item) => ({ kind: "not", item }),
    eq: cmp("="),
    ne: cmp("<>"),
    lt: cmp("<"),
    le: cmp("<="),
    gt: cmp(">"),
    ge: cmp(">="),
    in: (field, values) => ({ kind: "in", field, values: values.map(scalar) }),
    between: (field, low, high) => ({ kind: "between", field, low: scalar(low), high: scalar(high) }),
    glob: (field, pattern) => ({ kind: "glob", field, pattern }),
    regex: (field, pattern) => ({ kind: "regex", field, pattern }),
    within: (field, duration) => ({ kind: "within", field, ms: durationOf(duration) ?? Number.NaN }),
  };
}

/** A query being built: each step gives a new one. */
export interface Builder<Row, Selected> extends Query<Selected> {
  /** The fields each row holds. */
  select<const F extends readonly (keyof Row & string)[]>(...fields: F): Builder<Row, Pick<Row, F[number]>>;
  /** The rows to give. */
  where(f: (w: Where<Row>) => Expr): Builder<Row, Selected>;
  /** Rows in the byte order of their paths. */
  orderByKey(): Builder<Row, Selected>;
  /** At most this many rows. */
  limit(n: number): Builder<Row, Selected>;
  /** Options. */
  with(options: Partial<Options>): Builder<Row, Selected>;
  /** Permission to read everything under where the query begins (FR-023). */
  scan(): Builder<Row, Selected>;
}

function builder<Row, Selected>(value: QueryValue): Builder<Row, Selected> {
  const next = <S>(v: Partial<QueryValue>): Builder<Row, S> => builder<Row, S>({ ...value, ...v });
  return {
    value,
    select: (...fields) => next({ select: fields }),
    where: (f) => next({ where: f(whereOf<Row>()) }),
    orderByKey: () => next({ orderByKey: true }),
    limit: (n) => next({ limit: n }),
    with: (options) => next({ with: { ...value.with, ...options } }),
    scan: () => next({ scan: true }),
  };
}

/** The value of a query that reads everything, where nothing more is said. */
const bare = (from: Source): QueryValue => ({
  select: "*",
  from,
  where: { kind: "true" },
  orderByKey: false,
  limit: undefined,
  with: DEFAULT_OPTIONS,
  scan: false,
});

/**
 * A query of the files of one entry: its rows are the entry's key and each file's metadata (FR-020).
 *
 * @param entry - the entry
 */
export function query<E extends Entry<string, object, unknown>>(entry: E): Builder<RowOf<E>, RowOf<E>> {
  return builder<RowOf<E>, RowOf<E>>(bare({ kind: "entry", entry }));
}

/**
 * A query of every file and folder under a root, with no layout, as `fd` walks a folder (FR-020).
 *
 * @param root - the folder of the store to begin at, `""` for its root
 */
export function queryTree(root = ""): Builder<TreeMeta, TreeMeta> {
  return builder<TreeMeta, TreeMeta>(bare({ kind: "root", root: root.replace(/^\.\/?/, "").replace(/\/$/, "") }));
}
