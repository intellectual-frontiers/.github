// Spec: 0002-anyfs-posix-governance FR-002, FR-003
/**
 * How faithfully an operation is carried out, as a closed union: `native` where the store does what POSIX says, `emulated` where the library does it with other operations (and says what that costs), and
 * `refused` where the store has no way to do it. Nothing is pretended: every result of the library carries one, an emulation names its reason and the risk it brings, and a program that will not take
 * a risk reads it from the label and stops.
 *
 * @example
 * ```ts
 * import { emulated, isStrictViolation, native } from "./fidelity.ts";
 * isStrictViolation(native); // false
 * isStrictViolation(emulated("copy-then-delete")); // true: a copy and a delete are not one change
 * ```
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";

/** What an emulation risks, from the least to the most: nothing, cost (more calls or bytes), a result that is not there until close, a detail that is not kept, a change that is not one, a write that is not guarded, a change that does not persist. */
export const RISKS = ["none", "cost", "deferred", "lossy", "non-atomic", "unguarded", "not-durable"] as const;
/** One risk. */
export type Risk = (typeof RISKS)[number];

/** The risks a program that asks for strictness will not take: the ones that lose or change something it did not mean to. */
export const STRICT_RISKS: readonly Risk[] = ["lossy", "non-atomic", "unguarded", "not-durable"];

/** How the library does what a store cannot: a closed list. */
export const EMULATIONS = [
  "derived-directory",
  "marker-object",
  "no-marker",
  "write-back-buffer",
  "unguarded-write",
  "whole-object-range",
  "read-modify-write",
  "copy-then-delete",
  "listing-walk",
  "touch-without-mtime",
] as const;
/** One way of emulating. */
export type EmulationReason = (typeof EMULATIONS)[number];

/** What each emulation risks, and says. */
export const EMULATION_FACTS: Readonly<Record<EmulationReason, { readonly risk: Risk; readonly summary: string }>> = {
  "derived-directory": { risk: "none", summary: "a directory is not an object: it exists while an object lies below it, and is read from a list" },
  "marker-object": { risk: "none", summary: "a directory is kept as a marker object below it, which a list does not show" },
  "no-marker": { risk: "not-durable", summary: "nothing is written for a directory: an empty directory is not kept" },
  "write-back-buffer": { risk: "deferred", summary: "writes are held in memory and put as one object at close or fsync" },
  "unguarded-write": { risk: "unguarded", summary: "the store cannot compare revisions, so a change made by another writer since the open is overwritten" },
  "whole-object-range": { risk: "cost", summary: "a part of an object is read by reading the whole object" },
  "read-modify-write": { risk: "cost", summary: "the object is read, changed and written back, guarded by its revision" },
  "copy-then-delete": { risk: "non-atomic", summary: "the object is copied and then removed: a failure between the two leaves both" },
  "listing-walk": { risk: "non-atomic", summary: "every object below the directory is listed and then changed one at a time" },
  "touch-without-mtime": { risk: "lossy", summary: "an object that exists is left as it is: the store keeps no time that a touch could change" },
};

/** Why the library does not do it: a closed list. */
export const REFUSALS_OF_POSIX = ["not-in-model", "capability-absent", "read-only"] as const;
/** One reason for a refusal. */
export type PosixRefusal = (typeof REFUSALS_OF_POSIX)[number];

/** How an operation is carried out. */
export type Fidelity =
  | { readonly kind: "native" }
  | { readonly kind: "emulated"; readonly reason: EmulationReason; readonly risk: Risk; readonly detail: string }
  | { readonly kind: "refused"; readonly reason: PosixRefusal; readonly detail: string };

/** The store does what POSIX says. */
export const native: Fidelity = { kind: "native" };

/** The library does it with other operations: the risk and the sentence are the reason's, unless a sentence of this case is given. */
export function emulated(reason: EmulationReason, detail?: string): Fidelity {
  const facts = EMULATION_FACTS[reason];
  return { kind: "emulated", reason, risk: facts.risk, detail: detail ?? facts.summary };
}

/** The library will not do it, and says why. */
export function refusedBy(reason: PosixRefusal, detail: string): Fidelity {
  return { kind: "refused", reason, detail };
}

/** A fidelity in one line. */
export function describeFidelity(fidelity: Fidelity): string {
  switch (fidelity.kind) {
    case "native":
      return "native";
    case "emulated":
      return `emulated (${fidelity.reason}, risk ${fidelity.risk}): ${fidelity.detail}`;
    case "refused":
      return `refused (${fidelity.reason}): ${fidelity.detail}`;
    default:
      return absurd(fidelity);
  }
}

/** Whether a program that asks for strictness stops at this: an emulation with a risk that loses or changes something it did not mean to, or a refusal. */
export function isStrictViolation(fidelity: Fidelity): boolean {
  switch (fidelity.kind) {
    case "native":
      return false;
    case "emulated":
      return STRICT_RISKS.includes(fidelity.risk);
    case "refused":
      return true;
    default:
      return absurd(fidelity);
  }
}

const RANK_OF_RISK: Readonly<Record<Risk, number>> = { none: 0, cost: 1, deferred: 2, lossy: 3, "non-atomic": 4, unguarded: 5, "not-durable": 6 };

/** The worse of two fidelities: a refusal is worse than an emulation, an emulation of more risk is worse than one of less, and an emulation is worse than native. */
export function worse(a: Fidelity, b: Fidelity): Fidelity {
  const rank = (f: Fidelity): number => (f.kind === "native" ? 0 : f.kind === "emulated" ? 1 + RANK_OF_RISK[f.risk] : 100);
  return rank(b) > rank(a) ? b : a;
}
