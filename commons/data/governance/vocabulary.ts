// Spec: 0003-governance FR-008, FR-009
/**
 * A vocabulary (commons data 0003-governance FR-008): the annotation kinds a part of governance speaks in, and the lint rules that say where a domain falls short of them. The engine's
 * contribution point `governance.vocabulary` lets an extension add one; `vocabulariesFrom` reads those of a composition in its order. A finding is data: the rule, the element, a sentence
 * and a severity.
 *
 * @module
 */
import {
  type Composition,
  contribute,
  defineExtension,
  type Extension,
  extensionId,
  type IdError,
  point,
} from "@intellectual-frontiers/data/engine";
import { err, ok, type Result } from "@intellectual-frontiers/commons/ts/kernel";
import type { AnnotationKind } from "./annotation.ts";
import type { ElementId } from "./id.ts";
import type { Domain } from "./model.ts";

/** How serious a finding is: an error is a fault in the domain, a warning is a gap. */
export type Severity = "error" | "warning";

/** What lint says of one element. */
export interface Finding {
  /** The rule that found it, `<vocabulary>/<name>`. */
  readonly rule: string;
  readonly element: ElementId;
  /** One plain sentence. */
  readonly message: string;
  readonly severity: Severity;
}

/** A finding, made. */
export const finding = (rule: string, element: ElementId, message: string, severity: Severity = "warning"): Finding => ({
  rule,
  element,
  message,
  severity,
});

/** A lint rule: what it looks for, and how it looks. */
export interface LintRule {
  /** `<vocabulary>/<name>`. */
  readonly id: string;
  /** What it looks for, in a sentence. */
  readonly describe: string;
  readonly check: (domain: Domain) => readonly Finding[];
}

/** A vocabulary: annotation kinds and the rules that hold a domain to them. */
export interface Vocabulary {
  readonly id: string;
  readonly kinds: readonly AnnotationKind<unknown>[];
  readonly rules: readonly LintRule[];
}

/** The contribution point an extension fills to add a vocabulary. */
export const vocabularyPoint = point<Vocabulary>("governance.vocabulary");

/**
 * The vocabularies of a composition, in its order.
 *
 * @param composition - the project's composition
 * @returns the vocabularies its extensions contribute
 */
export function vocabulariesFrom(composition: Composition): readonly Vocabulary[] {
  return composition.contributions(vocabularyPoint);
}

/**
 * An extension that contributes a vocabulary, named `governance.<id>`.
 *
 * @param v - the vocabulary
 * @param version - the extension's version
 * @returns the extension, or why its identifier is not one
 */
export function vocabularyExtension(v: Vocabulary, version = "1.0.0"): Result<Extension, IdError> {
  const id = extensionId(`governance.${v.id}`);
  return id.kind === "err" ? err(id.error) : ok(defineExtension({ id: id.value, version, contributes: [contribute(vocabularyPoint, v)] }));
}
