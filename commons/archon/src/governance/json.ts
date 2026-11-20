// Spec: 0002-archon-governance FR-003
// Spec: 0003-archon-logical FR-005
/**
 * Data, the only thing a requirement may ask for: a value of JSON, with a canonical text in which the keys are in a fixed order, so that two values that are equal are the same text.
 *
 * @example
 * ```ts
 * import { canonicalJson } from "./json.ts";
 * canonicalJson({ b: 1, a: [true, null] }); // '{"a":[true,null],"b":1}'
 * ```
 *
 * @module
 */

/** A value of JSON. */
export type JsonValue = null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue };

/** Whether a value is a list (`Array.isArray` does not narrow a read-only list away from the other cases). */
function isList(value: JsonValue): value is readonly JsonValue[] {
  return Array.isArray(value);
}

/** Whether an unknown value is data: null, a boolean, a finite number, a string, a list of data or a plain object of data. */
export function isJson(value: unknown): value is JsonValue {
  if (value === null) return true;
  switch (typeof value) {
    case "boolean":
    case "string":
      return true;
    case "number":
      return Number.isFinite(value);
    case "object": {
      if (Array.isArray(value)) {
        for (const item of value) if (!isJson(item)) return false;
        return true;
      }
      const proto: unknown = Object.getPrototypeOf(value);
      if (proto !== Object.prototype && proto !== null) return false;
      for (const item of Object.values(value)) if (!isJson(item)) return false;
      return true;
    }
    default:
      return false;
  }
}

/** The text of a value with the keys of every object in order, no space, and nothing that depends on the order they were made in. */
export function canonicalJson(value: JsonValue): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (isList(value)) return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
}

/** Whether two values are the same data, whatever the order of the keys. */
export function sameJson(a: JsonValue, b: JsonValue): boolean {
  return canonicalJson(a) === canonicalJson(b);
}
