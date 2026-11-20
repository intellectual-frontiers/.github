// Spec: 0002-archon-governance FR-001
/**
 * The names of Archon, each a branded text made only by the function that validates it: a requirement, a kind of resource, a subject (a host name), a dialect and a reference to a secret
 * (never the secret itself).
 *
 * @example
 * ```ts
 * import { parseSubjectName } from "./ids.ts";
 * parseSubjectName("web-01.example.test").kind; // "ok"
 * parseSubjectName("Web 01").kind; // "err"
 * ```
 *
 * @module
 */
import { err, ok, refine, string, type Brand, type Result } from "@intellectual-frontiers/core";

/** The identity of a requirement, stable for the life of the requirement. */
export type RequirementId = Brand<string, "archon requirement id">;
/** The identity of a kind of resource. */
export type ResourceKindId = Brand<string, "archon resource kind">;
/** The name of a subject: a host name. */
export type SubjectName = Brand<string, "archon subject name">;
/** The identity of a dialect. */
export type DialectId = Brand<string, "archon dialect id">;
/** A reference to a secret kept in a store: `secret:<store>/<name>`. */
export type SecretRef = Brand<string, "archon secret reference">;

/** A function that makes a branded text from text, or says which rule the text broke. */
function made<B extends string>(name: B, rule: string, valid: (text: string) => boolean): (text: string) => Result<Brand<string, B>, string> {
  const decoder = refine(string, name, valid);
  return (text) => {
    const r = decoder(text);
    return r.kind === "ok" ? ok(r.value) : err(`${JSON.stringify(text)} is not a ${name}: ${rule}`);
  };
}

/** A requirement id from text: lower case words of letters and digits joined by dots or hyphens, starting with a letter, at most 100 characters. */
export const parseRequirementId: (text: string) => Result<RequirementId, string> = made("archon requirement id", "lower case words joined by dots or hyphens, starting with a letter, at most 100 characters", (t) => t.length <= 100 && /^[a-z][a-z0-9]*([.-][a-z0-9]+)*$/.test(t));

/** A kind id from text: lower case words joined by hyphens, starting with a letter. */
export const parseKindId: (text: string) => Result<ResourceKindId, string> = made("archon resource kind", "lower case words joined by hyphens, starting with a letter", (t) => t.length <= 60 && /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(t));

/** A subject name from text: a host name of labels of lower case letters, digits and hyphens joined by dots, at most 253 characters. */
export const parseSubjectName: (text: string) => Result<SubjectName, string> = made("archon subject name", "a host name of lower case letters, digits and hyphens joined by dots", (t) => t.length <= 253 && /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/.test(t));

/** A dialect id from text: lower case words joined by hyphens, starting with a letter. */
export const parseDialectId: (text: string) => Result<DialectId, string> = made("archon dialect id", "lower case words joined by hyphens, starting with a letter", (t) => t.length <= 60 && /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(t));

/** A secret reference from text: `secret:<store>/<name>`. */
export const parseSecretRef: (text: string) => Result<SecretRef, string> = made("archon secret reference", "secret:<store>/<name>, the store in lower case words joined by hyphens", (t) => t.length <= 200 && /^secret:[a-z][a-z0-9-]*\/[a-z0-9][a-z0-9._-]*$/.test(t));

/** Whether a text is a secret reference. */
export function isSecretRef(text: string): boolean {
  return parseSecretRef(text).kind === "ok";
}
