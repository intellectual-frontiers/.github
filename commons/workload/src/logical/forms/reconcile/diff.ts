// Spec: 0009-form-reconcile FR-006
/**
 * The diff and the plan, pure and deterministic. A state is named values; the diff of the actual state with the desired one is the changes that make the first the second, each a create, an update or a delete, in the order of
 * their names; the plan is the canonical text of those changes, the same bytes for the same changes, and what a person approves is the SHA-256 of that text, made by the native runner. The least mode of effect that can apply a
 * plan follows from its actions: a create appends, an update mutates and a delete destroys.
 *
 * @example
 * ```ts
 * import { diffStates, planText } from "./diff.ts";
 * diffStates({ a: 1 }, { a: 2, b: 1 }).map((c) => c.action); // ["update", "create"]
 * ```
 *
 * @module
 */
import { type Mode, modeRank } from "@intellectual-frontiers/workload/governance";
import type { ChangeAction } from "./terms.ts";

/** One value of a state. */
export type Value = string | number | boolean;

/** A state: named values. */
export type State = Readonly<Record<string, Value>>;

/** One difference: the name, what to do, and the values it goes from and to. */
export type Change = { readonly key: string; readonly action: ChangeAction; readonly from?: Value; readonly to?: Value };

/** The changes that make `actual` into `desired`, in the order of their names. */
export function diffStates(actual: State, desired: State): readonly Change[] {
  const keys = [...new Set([...Object.keys(actual), ...Object.keys(desired)])].sort();
  const out: Change[] = [];
  for (const key of keys) {
    const from = Object.hasOwn(actual, key) ? actual[key] : undefined;
    const to = Object.hasOwn(desired, key) ? desired[key] : undefined;
    if (from === to) continue;
    if (from === undefined && to !== undefined) out.push({ key, action: "create", to });
    else if (from !== undefined && to === undefined) out.push({ key, action: "delete", from });
    else if (from !== undefined && to !== undefined) out.push({ key, action: "update", from, to });
  }
  return out;
}

/** The canonical text of a plan: the same bytes for the same changes. */
export const planText = (changes: readonly Change[]): string => JSON.stringify(changes.map((c) => Object.fromEntries(Object.entries(c).sort(([a], [b]) => (a < b ? -1 : 1)))));

/** The text of a plan hash: 64 lower case hexadecimal digits. */
export const isPlanHash = (text: string): boolean => /^[0-9a-f]{64}$/u.test(text);

/** The mode an action needs of the effect that applies it. */
export const modeOf = (a: ChangeAction): Mode => (a === "create" ? "append" : a === "update" ? "mutate" : "destroy");

/** The least mode of effect that can apply the plan: `read` where there is nothing to apply. */
export function requiredMode(changes: readonly Change[]): Mode {
  return changes.map((c) => modeOf(c.action)).reduce<Mode>((a, b) => (modeRank(b) > modeRank(a) ? b : a), "read");
}

/** The changes a text holds, or why it is not a plan: a person's tool reads what it is asked to apply. */
export function parsePlan(text: string): readonly Change[] | undefined {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (!Array.isArray(raw)) return undefined;
  const out: Change[] = [];
  const items: readonly unknown[] = raw;
  for (const item of items) {
    if (typeof item !== "object" || item === null) return undefined;
    const key: unknown = Reflect.get(item, "key");
    const action: unknown = Reflect.get(item, "action");
    if (typeof key !== "string" || (action !== "create" && action !== "update" && action !== "delete")) return undefined;
    const from: unknown = Reflect.get(item, "from");
    const to: unknown = Reflect.get(item, "to");
    const ok = (v: unknown): v is Value | undefined => v === undefined || typeof v === "string" || typeof v === "number" || typeof v === "boolean";
    if (!ok(from) || !ok(to)) return undefined;
    out.push({ key, action, ...(from === undefined ? {} : { from }), ...(to === undefined ? {} : { to }) });
  }
  return out;
}
