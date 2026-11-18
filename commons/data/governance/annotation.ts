// Spec: 0003-governance FR-007
/**
 * Annotations (commons data 0003-governance FR-007): a typed value of a kind that a vocabulary defines, on an element. A kind is made by `annotationKind<T>(name, about)` and says which
 * kinds of element it may be on; `annotate(kind, value)` types the value by it, so that a value of another type does not compile; `annotationsOf` reads them back, typed. The kinds are
 * open: a vocabulary an extension adds defines more, and nothing here knows them.
 *
 * @example
 * ```ts
 * const synonym = annotationKind<string>("docs.synonym", ["concept", "attribute"]);
 * annotate(synonym, "client");
 * ```
 *
 * @module
 */
import type { ElementKind } from "./id.ts";

/** The name of an annotation kind: a vocabulary, a dot and a name (`privacy.personal`). */
export type AnnotationName = `${string}.${string}`;

/** A kind of annotation: its name, the kinds of element it may be on, and (for the compiler only) the type of its value. */
export interface AnnotationKind<T> {
  readonly name: AnnotationName;
  readonly about: readonly ElementKind[];
  /** Never set: carries the type of the value, for the compiler. */
  readonly __value?: T;
}

/**
 * Declares a kind of annotation.
 *
 * @param name - the vocabulary and the name, such as `security.classification`
 * @param about - the kinds of element it may be on
 * @returns the kind, frozen
 */
export function annotationKind<T>(name: AnnotationName, about: readonly ElementKind[]): AnnotationKind<T> {
  return Object.freeze({ name, about: Object.freeze([...about]) });
}

/** An annotation on an element: its kind, where that kind may be, and its value. */
export interface Annotation {
  readonly kind: AnnotationName;
  readonly about: readonly ElementKind[];
  readonly value: unknown;
}

/**
 * Annotates, typed by the kind: a value of another type does not compile.
 *
 * @param kind - the kind
 * @param value - its value
 * @returns the annotation, frozen
 */
export function annotate<T>(kind: AnnotationKind<T>, value: T): Annotation {
  return Object.freeze({ kind: kind.name, about: kind.about, value });
}

/** Whatever carries annotations: every element. */
export interface Annotated {
  readonly annotations: readonly Annotation[];
}

/**
 * The values of the annotations of a kind on an element, typed.
 *
 * @param element - the element
 * @param kind - the kind
 * @returns the values, in the order they were written
 */
export function annotationsOf<T>(element: Annotated, kind: AnnotationKind<T>): readonly T[] {
  // the one place a value is read back as its type: `annotate` typed it by a kind of the same name
  return element.annotations.filter((a) => a.kind === kind.name).map((a) => a.value as T);
}
