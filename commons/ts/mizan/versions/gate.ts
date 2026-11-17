/**
 * The release gate (commons 0026-works-versioning FR-026): a harness that declares a regulated domain (0020-ifccm) releases only on the evidence tier it declares (`releaseTier` of its declaration), and
 * every release records the tier it was released on.
 *
 * @remarks
 * Pure: the declaration and the tier judged (by `quality tier`, 0021-ifqs) are arguments, so this module imports nothing of the quality system. A regulated harness whose declaration names no
 * `releaseTier` is refused; so is one whose tier was not judged or is below the declared one. A harness that declares no regulated domain is not held to a tier and the release records the
 * tier judged, or says it was not judged.
 *
 * @limits
 * It does not judge a tier: it compares two.
 *
 * @example
 * ```ts
 * import { releaseGate } from "./gate.ts";
 * releaseGate({ regulatedDomains: ["DeviceQuality"], releaseTier: "Tier2" }, "Tier1").kind; // "refused"
 * ```
 *
 * @module
 */
import { type Declaration, isRegulated, RELEASE_TIERS, type ReleaseTier } from "../changes/declaration.ts";

/** What the gate says of a release. */
export type GateOutcome =
  | {
      readonly kind: "allowed";
      /** The tier the release records: the tier judged, or undefined where none was. */ readonly tier: ReleaseTier | undefined;
    }
  | { readonly kind: "refused"; readonly reason: string };

/** Whether a text is a tier a harness may name. */
export function isReleaseTier(text: string): text is ReleaseTier {
  return RELEASE_TIERS.some((t) => t === text);
}

/** Whether `judged` is at least `declared`. */
export function tierAtLeast(judged: ReleaseTier, declared: ReleaseTier): boolean {
  return RELEASE_TIERS.indexOf(judged) >= RELEASE_TIERS.indexOf(declared);
}

/** The gate: a regulated harness releases only at the tier it declares or above, and one that declares none, or whose tier was not judged, is refused (FR-026). */
export function releaseGate(declaration: Declaration | undefined, judged: ReleaseTier | undefined): GateOutcome {
  if (!isRegulated(declaration)) return { kind: "allowed", tier: judged };
  const declared = declaration?.releaseTier;
  const domains = (declaration?.regulatedDomains ?? []).join(", ");
  if (declared === undefined)
    return {
      kind: "refused",
      reason: `the harness declares ${domains} and its declaration names no releaseTier: a regulated harness states the tier it releases on`,
    };
  if (judged === undefined)
    return {
      kind: "refused",
      reason: `the harness declares ${domains} and ${declared} as its releaseTier, and no tier was judged: give --tier from \`quality tier\``,
    };
  return tierAtLeast(judged, declared)
    ? { kind: "allowed", tier: judged }
    : {
        kind: "refused",
        reason: `the harness declares ${declared} as its releaseTier and the tier judged is ${judged}: it releases only on the tier it declares`,
      };
}
