// Spec: 0002-bridge-plans FR-005
/**
 * The hash of a plan: the SHA-256 of its canonical text, in which every object has its keys in order and nothing depends on how the plan was made. Two plans with the same actions, the same losses and
 * the same ends have the same hash, and a plan changed in any way has another, so that an apply can hold a plan to the hash a person approved.
 *
 * @example
 * ```ts
 * import { canonical } from "./hash.ts";
 * canonical({ b: 1, a: [2, { d: 1, c: 0 }] }); // '{"a":[2,{"c":0,"d":1}],"b":1}'
 * ```
 *
 * @module
 */
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import type { Plan, PlanHash } from "@intellectual-frontiers/anyfs-bridge/governance";

/** A value as text with the keys of every object in order and no space: one text for one value. */
export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((v) => canonical(v)).join(",")}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys.filter((k) => (value as Record<string, unknown>)[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(",")}}`;
}

/** The hash of a plan without its hash. */
export async function hashPlan(plan: Omit<Plan, "hash">): Promise<PlanHash> {
  return (await sha256(canonical(plan))) as unknown as PlanHash;
}
