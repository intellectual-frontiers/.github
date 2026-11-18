// Spec: 0006-logical FR-012
/**
 * The types of the rows of a concept (commons data 0006-logical FR-012), computed from what governance says: `RowOf` is a record, `InsertOf` the record to insert (what is optional may be
 * left out) and `KeyOf` the value that identifies it. An attribute is typed by its datatype, a code by the names of its list, an optional attribute is null where it has no value, an
 * attribute that is many is a list, and a relationship holds the key of what it points to. A value of another type than its attribute's does not compile.
 *
 * @example
 * ```ts
 * import type { RowOf } from "@intellectual-frontiers/data/sql/logical";
 * type Person = RowOf<typeof person>; // { givenName: string; birthDate: string | null; party: string; ... }
 * ```
 *
 * @module
 */
import type { AnyConcept, Attribute, CodeType, Datatype, Relationship, Target } from "@intellectual-frontiers/data/governance";

/** The TypeScript type of the values of a datatype: a code is one of the names of its list, a decimal, a date and an instant are text. */
export type ValueOf<T extends Datatype> = T extends { readonly kind: "text" | "identifier" | "decimal" | "date" | "instant" }
  ? string
  : T extends { readonly kind: "integer" }
    ? number
    : T extends { readonly kind: "boolean" }
      ? boolean
      : T extends CodeType<infer L>
        ? keyof L["codes"] & string
        : T extends { readonly kind: "structured" }
          ? unknown
          : T extends { readonly kind: "binary" }
            ? Uint8Array
            : T extends { readonly kind: "vector" }
              ? readonly number[]
              : never;

/** The concept a target gives. */
export type TargetOf<T extends Target> = T extends () => infer C ? (C extends AnyConcept ? C : never) : T extends AnyConcept ? T : never;

/** The type of the value of an attribute: null where it is optional, a list where it is many. */
export type AttributeValue<A extends Attribute> =
  A extends Attribute<infer T, infer M>
    ? M extends "many"
      ? readonly ValueOf<T>[]
      : M extends "optional"
        ? ValueOf<T> | null
        : ValueOf<T>
    : never;

/** The type of the key that identifies a concept: the value of its identifying member where it has one, and a record of them where it has several. */
export type KeyOf<C extends AnyConcept> = C extends {
  readonly attributes: infer A;
  readonly relationships: infer R;
  readonly identifiedBy: readonly (infer I)[];
}
  ? [I] extends [never]
    ? never
    : IsUnion<I> extends true
      ? { readonly [K in I & string]: MemberKey<A, R, K> }
      : MemberKey<A, R, I & string>
  : never;

type IsUnion<T, U = T> = T extends unknown ? ([U] extends [T] ? false : true) : never;

type MemberKey<A, R, K extends string> = K extends keyof A
  ? A[K] extends Attribute<infer T, "required" | "optional" | "many">
    ? ValueOf<T>
    : never
  : K extends keyof R
    ? R[K] extends Relationship<"one" | "optional" | "many", infer T>
      ? KeyOf<TargetOf<T>>
      : never
    : never;

/** The type of the value of a relationship: the key of what it points to, null where it is optional, a list where it is many. */
export type RelationshipValue<R extends Relationship> =
  R extends Relationship<infer C, infer T>
    ? C extends "many"
      ? readonly KeyOf<TargetOf<T>>[]
      : C extends "optional"
        ? KeyOf<TargetOf<T>> | null
        : KeyOf<TargetOf<T>>
    : never;

/** A row of a concept: its attributes and its relationships, by their names. */
export type RowOf<C extends AnyConcept> = {
  readonly [K in keyof C["attributes"]]: AttributeValue<C["attributes"][K]>;
} & {
  readonly [K in keyof C["relationships"]]: RelationshipValue<C["relationships"][K]>;
};

type OptionalKeys<C extends AnyConcept> =
  | { [K in keyof C["attributes"]]: C["attributes"][K] extends Attribute<Datatype, "optional" | "many"> ? K : never }[keyof C["attributes"]]
  | {
      [K in keyof C["relationships"]]: C["relationships"][K] extends Relationship<"optional" | "many"> ? K : never;
    }[keyof C["relationships"]];

/** A row of a concept to insert: what is optional, or many, may be left out. */
export type InsertOf<C extends AnyConcept> = Omit<RowOf<C>, OptionalKeys<C> & string> & {
  readonly [K in OptionalKeys<C> & keyof RowOf<C>]?: RowOf<C>[K];
};
