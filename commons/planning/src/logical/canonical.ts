// Spec: 0002-planning-core FR-006
/**
 * The canonical text of a value: its properties sorted by name, recursively, and its arrays in their order (the order of RFC 8785 section 3.2.3 for the keys), with a property whose value is `undefined`
 * left out. Two events with one id are one event where their canonical texts are the same, and a conflict where they are not (0037-planning FR-017).
 *
 * @example
 * ```ts
 * import { canonical } from "./canonical.ts";
 * canonical({ b: 1, a: [2, { d: 4, c: 3 }] }); // '{"a":[2,{"c":3,"d":4}],"b":1}'
 * ```
 *
 * @module
 */

/** A text of a value that does not depend on the order its properties were made in. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? "null" : canonical(v))).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const keys = Object.keys(value)
      .filter((k) => Reflect.get(value, k) !== undefined)
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(Reflect.get(value, k))}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
