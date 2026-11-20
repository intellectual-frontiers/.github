// Spec: 0004-grc-documents FR-005
/**
 * The serializer port (0004-grc-documents FR-005): a plugin that writes an assessment in an exchange format. The registry holds them by stable id; the formats themselves are in units of their
 * own (`src/serializers/<id>/`), and nothing here names one.
 *
 * @module
 */
import type { Result } from "@intellectual-frontiers/core";
import { createRegistry, type Crosswalk, type Json, type Registry } from "@intellectual-frontiers/grc/governance";
import type { Assessment } from "./kinds.ts";

/** What a serializer may be given besides the assessment. */
export type SerializeContext = {
  /** Crosswalks, so that a control is written under another framework's identifier. */
  readonly crosswalks?: readonly Crosswalk[];
  /** The predicate type of a statement, where the format has one. */
  readonly predicateType?: string;
  readonly options?: Readonly<Record<string, Json>>;
};

/** Why an assessment could not be written. */
export type SerializeProblem = { readonly kind: "unsupported" | "invalid"; readonly message: string };

/** A serializer: deterministic (the same assessment gives the same bytes) and never reading the clock. */
export type Serializer = {
  readonly id: string;
  /** The name of the format. */
  readonly format: string;
  /** The version of the format it writes. */
  readonly version: string;
  readonly media: string;
  serialize(assessment: Assessment, context: SerializeContext): Promise<Result<string, SerializeProblem>>;
};

/** A registry of serializers. */
export type Serializers = Registry<Serializer>;

/** A registry of serializers, empty. */
export function createSerializers(): Serializers {
  return createRegistry<Serializer>("serializer");
}
