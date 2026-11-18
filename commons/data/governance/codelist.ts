// Spec: 0003-governance FR-001
/**
 * A code list (commons data 0003-governance FR-001): the controlled vocabulary of a domain, a set of codes each with a label and, where the label is not enough, a definition. The names
 * of its codes are literal types.
 *
 * @module
 */
import type { Annotation } from "./annotation.ts";

/** One code: what a person is shown, and what it means where that is not enough. */
export interface CodeSpec {
  readonly label: string;
  readonly definition?: string;
}

/** A code list. */
export interface CodeList<N extends string = string, K extends string = string> {
  readonly kind: "codelist";
  readonly name: N;
  readonly definition: string;
  readonly codes: Readonly<Record<K, CodeSpec>>;
  readonly annotations: readonly Annotation[];
}

/** A code list of any name and codes. */
export type AnyCodeList = CodeList<string, string>;

/** What `codeList` is given. */
export interface CodeListSpec<K extends string> {
  readonly definition?: string;
  readonly codes: Readonly<Record<K, CodeSpec>>;
  readonly annotations?: readonly Annotation[];
}

/**
 * Makes a code list; total, it never fails (`domain` says what is wrong).
 *
 * @param name - its name
 * @param spec - its definition, its codes and its annotations
 * @returns the code list, frozen
 */
export function codeList<const N extends string, const K extends string>(name: N, spec: CodeListSpec<K>): CodeList<N, K> {
  return Object.freeze({
    kind: "codelist",
    name,
    definition: spec.definition ?? "",
    codes: spec.codes,
    annotations: Object.freeze([...(spec.annotations ?? [])]),
  });
}
