// Spec: 0002-dossier-core FR-003
/**
 * The classes of disclosure (0046-dossiers FR-033) and the type that keeps a value apart from a reader who may not see it: `Disclosed<C, T>` is a value of class `C`, and `show` takes a
 * value only of a class at most the ceiling it is given, so that a function that writes a value for a reader of a lower class does not compile.
 *
 * @example
 * ```ts
 * import { disclosed, show } from "./disclosure.ts";
 * show("internal", disclosed("public", "hello")); // "hello"
 * // show("public", disclosed("cui", "no")); // does not compile
 * ```
 *
 * @module
 */

/** The four classes, lowest first. */
export const CLASSES = ["public", "internal", "cui", "restricted"] as const;

/** A class of disclosure. */
export type DisclosureClass = (typeof CLASSES)[number];

/** The classes at most `M`: what a reader of class `M` may see. */
export type AtMost<M extends DisclosureClass> = M extends "public"
  ? "public"
  : M extends "internal"
    ? "public" | "internal"
    : M extends "cui"
      ? "public" | "internal" | "cui"
      : DisclosureClass;

/** A value of a class: the class is in its type. */
export interface Disclosed<C extends DisclosureClass, T> {
  readonly class: C;
  readonly value: T;
}

/** A value of a class. */
export const disclosed = <C extends DisclosureClass, T>(cls: C, value: T): Disclosed<C, T> => ({ class: cls, value });

/** The rank of a class: 0 for public up to 3 for restricted. */
export const rank = (c: DisclosureClass): number => CLASSES.indexOf(c);

/** Whether a reader of class `reader` may see a value of class `value`. */
export const mayShow = (reader: DisclosureClass, value: DisclosureClass): boolean => rank(value) <= rank(reader);

/** The higher of two classes. */
export const higher = (a: DisclosureClass, b: DisclosureClass): DisclosureClass => (rank(a) >= rank(b) ? a : b);

/** The value, for a reader whose ceiling is `max`: only a value of a class at most `max` is taken. */
export function show<M extends DisclosureClass, T>(_max: M, v: Disclosed<AtMost<M>, T>): T {
  return v.value;
}

/** A class from text, else undefined. */
export function classOf(text: string): DisclosureClass | undefined {
  return (CLASSES as readonly string[]).includes(text) ? (text as DisclosureClass) : undefined;
}
