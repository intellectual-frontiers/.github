// Spec: 0002-desired-os-state-governance FR-004
/**
 * A guard against a secret in a model: a model holds a reference to a secret and never the secret, and this finds the text of a desired state that looks like one. It is a guard, never a
 * proof that no secret is present: the rule is that the model holds references only.
 *
 * @example
 * ```ts
 * import { findSecretLike } from "./secret.ts";
 * findSecretLike({ content: "-----BEGIN " + "PRIVATE KEY-----" }); // [{ path: "$.content", why: "private-key" }]
 * ```
 *
 * @module
 */
import { isSecretRef } from "./ids.ts";
import type { JsonValue } from "./json.ts";

/** Why a text was taken for a secret. */
export type SecretReason = "private-key" | "cloud-key" | "token" | "named-secret";

/** A text of a desired state that looks like a secret, and where it is. */
export type SecretFinding = { readonly path: string; readonly why: SecretReason };

const PATTERNS: readonly (readonly [SecretReason, RegExp])[] = [
  ["private-key", /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/],
  ["cloud-key", /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ["token", /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|glpat-[A-Za-z0-9_-]{20,})\b/],
];

const SECRET_NAMES = /(?:password|passphrase|secret|token|private[-_]?key|api[-_]?key)$/i;

/** Every text of a value that looks like a secret, by the path where it is: a text in a private key, a key of a cloud or a token of a code host, and any non-empty text under a key named for a secret that is not a reference to one. */
export function findSecretLike(value: JsonValue, path = "$", key = ""): readonly SecretFinding[] {
  if (typeof value === "string") {
    for (const [why, pattern] of PATTERNS) if (pattern.test(value)) return [{ path, why }];
    if (value !== "" && SECRET_NAMES.test(key) && !isSecretRef(value)) return [{ path, why: "named-secret" }];
    return [];
  }
  if (value === null || typeof value !== "object") return [];
  if (Array.isArray(value)) {
    const found: SecretFinding[] = [];
    value.forEach((item: JsonValue, i) => found.push(...findSecretLike(item, `${path}[${i}]`, key)));
    return found;
  }
  return Object.entries(value).flatMap(([k, item]) => findSecretLike(item, `${path}.${k}`, k));
}
