// Spec: 0003-governance FR-010, FR-011, FR-012, FR-014, FR-015, FR-016, FR-017
/**
 * The vocabularies of governance (commons data 0003-governance): the library's own starting set. Each is a namespace with its annotation kinds and its `vocabulary` value, which a project
 * passes to `lint` or contributes through an extension (`vocabularyExtension`).
 *
 * @example
 * ```ts
 * import { annotate, vocabularies } from "@intellectual-frontiers/data/governance";
 * annotate(vocabularies.security.classification, "confidential");
 * ```
 *
 * @module
 */
import type { Vocabulary } from "../vocabulary.ts";
import * as docs from "./docs.ts";
import * as lifecycle from "./lifecycle.ts";
import * as ownership from "./ownership.ts";
import * as privacy from "./privacy.ts";
import * as quality from "./quality.ts";
import * as requirements from "./requirements.ts";
import * as security from "./security.ts";
import * as usage from "./usage.ts";

export { docs, lifecycle, ownership, privacy, quality, requirements, security, usage };

/** The vocabularies of this library, in the order lint runs them. */
export const defaultVocabularies: readonly Vocabulary[] = [
  docs.vocabulary,
  requirements.vocabulary,
  privacy.vocabulary,
  security.vocabulary,
  ownership.vocabulary,
  quality.vocabulary,
  usage.vocabulary,
  lifecycle.vocabulary,
];
