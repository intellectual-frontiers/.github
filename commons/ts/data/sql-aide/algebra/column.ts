/**
 * Columns: a domain with its nullability, how it is filled, and its key role. Each of these is in the column's type, so that the row a
 * table gives, takes on insert and takes on update is computed and never written beside it (commons 0009-sql-aide FR-007, FR-008).
 *
 * @module
 */
import type { Brand } from "../../../kernel/mod.ts";
import type { AnySql } from "../emit/sql.ts";
import { pd } from "../govern/dpv.auto.ts";
import {
  arrayDomain,
  bigintDomain,
  booleanDomain,
  bytesDomain,
  dateDomain,
  type Domain,
  type DomainSpec,
  enumDomain,
  integerDomain,
  type Json,
  jsonDomain,
  numericDomain,
  realDomain,
  type SqlValue,
  textDomain,
  timestampDomain,
  timestamptzDomain,
  uuidDomain,
} from "./domain.ts";

/** How a column gets its value on insert: the row must give it, a default may, or the database always does. */
export type Fill = "required" | "default" | "generated";

/** What a foreign key does when the row it points to is deleted or its key changes. */
export type ReferentialAction = "no action" | "restrict" | "cascade" | "set null" | "set default";

/** The column a foreign key points to. */
export interface Reference {
  /** The table pointed to; `undefined` for the column's own table. */
  readonly table: (() => { readonly name: string; readonly schema: string | undefined }) | undefined;
  /** The column pointed to. */
  readonly column: string;
  /** What happens on delete. */
  readonly onDelete?: ReferentialAction;
  /** What happens on update. */
  readonly onUpdate?: ReferentialAction;
}

/** A class of the Data Privacy Vocabulary that says how personal a column's data is (FR-026). */
export type Personal = "PersonalData" | "SensitivePersonalData" | "SpecialCategoryPersonalData";

/** A category of personal data: a term of DPV's Personal Data extension. */
export type PdTerm = keyof typeof pd;

/** Everything known of a column, as data. */
export interface ColumnSpec {
  /** The logical type. */
  readonly domain: DomainSpec;
  /** Whether it may be null. */
  readonly nullable: boolean;
  /** How it is filled on insert. */
  readonly fill: Fill;
  /** The default, as SQL. */
  readonly default?: AnySql;
  /** The expression of a generated column. */
  readonly generated?: AnySql;
  /** Whether the database numbers it. */
  readonly identity: boolean;
  /** Whether it is, alone, the primary key. */
  readonly primaryKey: boolean;
  /** Whether its values are unique. */
  readonly unique: boolean;
  /** The column it points to. */
  readonly references?: Reference;
  /** A check on its value, given the column as an expression. */
  readonly check?: (self: AnySql) => AnySql;
  /** Its description, where it is not taken from a TSDoc comment. */
  readonly doc?: string;
  /** The entities its type is, which must be defined before its table (an enumerated type, a domain). */
  readonly needs?: readonly { readonly name: string; readonly schema: string | undefined }[];
  /** How personal its data is. */
  readonly personal?: Personal;
  /** Its category, a term of DPV's Personal Data extension. */
  readonly category?: PdTerm;
}

/**
 * A column. `T` is the type of its values, `Null` whether it may be null, `F` how it is filled, `Key` whether it is a primary key and
 * `Req` the dialect features it needs. Every method gives a new column whose type says what changed.
 */
export interface Column<
  T,
  Null extends boolean = false,
  F extends Fill = "required",
  Key extends boolean = false,
  Req extends string = never,
> {
  /** The column as data. */
  readonly spec: ColumnSpec;
  /** Never set: carries `T`. */
  readonly __t?: T;
  /** Never set: carries `Null`. */
  readonly __null?: Null;
  /** Never set: carries `F`. */
  readonly __fill?: F;
  /** Never set: carries `Key`. */
  readonly __key?: Key;
  /** Never set: carries `Req`. */
  readonly __req?: Req;
  /** The column may be null. */
  nullable(): Column<T, true, F, Key, Req>;
  /** The column has a default: a value of its type, or SQL. */
  default(value: Extract<T, SqlValue> | AnySql): Column<T, Null, "default", Key, Req>;
  /** The database computes the column from an expression and stores it. */
  generatedAs(expression: AnySql): Column<T, Null, "generated", Key, Req>;
  /** The column is the primary key, and so not null. */
  primaryKey(): Column<T, false, F, true, Req>;
  /** The column's values are unique. */
  unique(): Column<T, Null, F, Key, Req>;
  /** The column's value must pass a check. */
  check(check: (self: AnySql) => AnySql): Column<T, Null, F, Key, Req>;
  /** What happens to the row when the row its foreign key points to is deleted or changes its key: a dialect needs `fk:actions` for it. */
  on(event: "delete" | "update", action: ReferentialAction): Column<T, Null, F, Key, Req | "fk:actions">;
  /** The column's description, for a column a function makes: a column a person writes takes it from its TSDoc comment. */
  doc(text: string): Column<T, Null, F, Key, Req>;
  /** The column's type is an entity that must be defined before the column's table. */
  needs(entity: { readonly name: string; readonly schema: string | undefined }): Column<T, Null, F, Key, Req>;
  /** The column holds personal data: of a category of DPV's Personal Data extension, whose class the vocabulary gives, or of no category said. */
  personal(category?: PdTerm): Column<T, Null, F, Key, Req>;
}

/** Any column. */
export type AnyColumn = Column<unknown, boolean, Fill, boolean, string>;

function isSql(x: unknown): x is AnySql {
  return typeof x === "object" && x !== null && "sqlKind" in x;
}

function make<T, Null extends boolean, F extends Fill, Key extends boolean, Req extends string>(
  spec: ColumnSpec,
): Column<T, Null, F, Key, Req> {
  return {
    spec,
    nullable: () => make({ ...spec, nullable: true }),
    default: (value) =>
      make({
        ...spec,
        fill: "default",
        default: isSql(value) ? value : { sqlKind: "expression", chunks: () => [{ kind: "value", value, spec: spec.domain }] },
      }),
    generatedAs: (expression) => make({ ...spec, fill: "generated", generated: expression }),
    primaryKey: () => make({ ...spec, primaryKey: true, nullable: false }),
    unique: () => make({ ...spec, unique: true }),
    check: (check) => make({ ...spec, check }),
    on: (event, action) =>
      spec.references === undefined
        ? make(spec)
        : make({ ...spec, references: { ...spec.references, ...(event === "delete" ? { onDelete: action } : { onUpdate: action }) } }),
    doc: (text) => make({ ...spec, doc: text }),
    needs: (entity) => make({ ...spec, needs: [...(spec.needs ?? []), entity] }),
    personal: (category) =>
      make(category === undefined ? { ...spec, personal: "PersonalData" } : { ...spec, personal: pd[category].kind, category }),
  };
}

/**
 * Makes a column of a domain: not null, required on insert, no key.
 *
 * @param d - the domain
 */
export function column<T, Req extends string = never>(d: Domain<T, Req>): Column<T, false, "required", false, Req> {
  return make({ domain: d.spec, nullable: false, fill: "required", identity: false, primaryKey: false, unique: false });
}

/** A text column, of any length or of at most `length` characters. */
export const text = (length?: number): Column<string> => column(textDomain(length));
/** A 32-bit integer column. */
export const integer = (): Column<number> => column(integerDomain);
/** A 64-bit integer column. */
export const bigint = (): Column<bigint> => column(bigintDomain);
/** A double-precision column. */
export const real = (): Column<number> => column(realDomain);
/** An exact decimal column. */
export const numeric = (precision: number, scale: number): Column<string> => column(numericDomain(precision, scale));
/** A true-or-false column. */
export const boolean = (): Column<boolean> => column(booleanDomain);
/** A calendar date column. */
export const date = (): Column<string> => column(dateDomain);
/** A column of moments with no zone. */
export const timestamp = (): Column<Date> => column(timestampDomain);
/** A column of moments in a zone. */
export const timestamptz = (): Column<Date> => column(timestamptzDomain);
/** A JSON column whose values are of type `T`. */
export const json = <T extends Json = Json>(): Column<T> => column(jsonDomain<T>(false));
/** A JSON column in the engine's binary form. */
export const jsonb = <T extends Json = Json>(): Column<T> => column(jsonDomain<T>(true));
/** A UUID column. */
export const uuid = (): Column<string> => column(uuidDomain);
/** A column of bytes. */
export const bytes = (): Column<Uint8Array> => column(bytesDomain);
/** A column that holds one of a closed set of words. */
export const oneOf = <const V extends readonly string[]>(values: V): Column<V[number]> => column(enumDomain(values));
/** A column that holds an array of another column's values: the dialect needs arrays. */
export const arrayOf = <T, Req extends string>(
  of: Column<T, false, "required", false, Req>,
): Column<readonly T[], false, "required", false, Req | "arrays"> => column(arrayDomain<T, Req>({ spec: of.spec.domain }));

/** A column bound to its table: what a foreign key points to. */
export interface Referable<T, Req extends string = never> {
  /** The table it belongs to. */
  readonly owner: () => { readonly name: string; readonly schema: string | undefined };
  /** Its name. */
  readonly column: string;
  /** The column as data. */
  readonly spec: ColumnSpec;
  /** Never set: carries the type of its values. */
  readonly __t?: T;
  /** Never set: carries the features it needs. */
  readonly __req?: Req;
}

/**
 * A foreign key: a column of the type of the column it points to, so that a key of one table is not taken for another's.
 *
 * @param target - the column pointed to, of a table defined before this one
 * @example
 * const person = table("person", { party_id: fk(party.c.party_id).primaryKey(), ... });
 */
export function fk<T, Req extends string>(target: Referable<T, Req>): Column<NonNullable<T>, false, "required", false, Req> {
  return make({
    domain: target.spec.domain,
    nullable: false,
    fill: "required",
    identity: false,
    primaryKey: false,
    unique: false,
    references: { table: target.owner, column: target.column },
  });
}

/** A column that points to a column of its own table. Its type is that column's, which the table works out. */
export interface SelfColumn<Target extends string, Null extends boolean = false> {
  /** The column of the same table it points to. */
  readonly self: Target;
  /** Never set: carries `Null`. */
  readonly __null?: Null;
  /** The column may be null. */
  readonly nullable: () => SelfColumn<Target, true>;
  /** The column's description. */
  readonly doc: (text: string) => SelfColumn<Target, Null>;
  /** What it adds to the column it copies. */
  readonly over: { readonly nullable: boolean; readonly doc?: string };
}

/**
 * A reference to a column of the same table (a parent, a predecessor).
 *
 * @param target - the name of the column pointed to; the table does not compile where it has no such column
 */
export function self<const Target extends string>(target: Target): SelfColumn<Target, false> {
  const make2 = <N extends boolean>(over: { readonly nullable: boolean; readonly doc?: string }): SelfColumn<Target, N> => ({
    self: target,
    over,
    nullable: () => make2<true>({ ...over, nullable: true }),
    doc: (text) => make2<N>({ ...over, doc: text }),
  });
  return make2<false>({ nullable: false });
}

/** Primary keys of the usual kinds. */
export const pk = {
  /** A text key the application gives, such as a ULID. */
  text: (): Column<string, false, "required", true> => text().primaryKey(),
  /** A ULID kept as text: the application makes it, so a row can be named before it is stored. */
  ulid: (): Column<string, false, "required", true> => text().primaryKey(),
  /** An integer the database numbers. */
  autoInc: (): Column<number, false, "default", true> =>
    make({ domain: integerDomain.spec, nullable: false, fill: "default", identity: true, primaryKey: true, unique: false }),
} as const;

/** The type of a column's values, with null where it may be null; a key that is not already another table's key is branded by its table. */
export type ValueOf<TN extends string, C> =
  C extends Column<infer T, infer Null, Fill, infer Key, string>
    ? (Key extends true ? (T extends { readonly "@ifc/brand": string } ? T : Brand<T, TN>) : T) | (Null extends true ? null : never)
    : never;

/** How a column is filled. */
export type FillOf<C> = C extends Column<unknown, boolean, infer F, boolean, string> ? F : never;
/** Whether a column may be null. */
export type NullOf<C> = C extends Column<unknown, infer Null, Fill, boolean, string> ? Null : never;
/** The features a column needs. */
export type ReqOfColumn<C> = C extends Column<unknown, boolean, Fill, boolean, infer R> ? R : never;
