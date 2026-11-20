// Spec: 0003-estate-logical FR-007
/**
 * The invariants of the Operational Truth Ontology (commons ontology 0002-oto FR-003) that an estate can check: no unowned responsibilities (every capability an asset offers has an owning system), no evidence without attribution
 * (every observation names its source) and no compliance without traceability (every policy result names the controls it gives evidence for). A violation is a system error, not an audit finding. The other three invariants
 * need policies and the criticality of controls, which an estate does not hold, and are named here as not checked.
 *
 * @example
 * ```ts
 * import { checkInvariants } from "./invariants.ts";
 * checkInvariants({ assets: [], observations: [], results: [{ asset: "athens", id: "disk-encryption", status: "pass", controls: [] }] })[0]?.invariant; // "NoComplianceWithoutTraceability"
 * ```
 *
 * @module
 */
import type { Asset } from "@intellectual-frontiers/estate/governance";
import type { Observation } from "./truth.ts";
import type { PolicyOutcome } from "./risk.ts";

/** The invariants of OTO, by their names in the ontology. */
export type InvariantName = "NoOrphanPolicies" | "NoUnownedResponsibilities" | "NoUnenforcedCriticalControls" | "NoEvidenceWithoutAttribution" | "NoAuthorityWithoutScope" | "NoComplianceWithoutTraceability";

/** Whether an estate checks an invariant: `checked`, or `not checked` where it needs what an estate does not hold. */
export const INVARIANT_COVERAGE: Readonly<Record<InvariantName, "checked" | "not checked">> = {
  NoOrphanPolicies: "not checked",
  NoUnownedResponsibilities: "checked",
  NoUnenforcedCriticalControls: "not checked",
  NoEvidenceWithoutAttribution: "checked",
  NoAuthorityWithoutScope: "not checked",
  NoComplianceWithoutTraceability: "checked",
};

/** A violation: the invariant, what it is about and what is wrong. */
export type Violation = { readonly invariant: InvariantName; readonly subject: string; readonly message: string };

/** What an estate is checked with: its assets, the observations of them (the asset each is of) and the policy results (the asset each is of). */
export type InvariantInput = {
  readonly assets: readonly Asset[];
  readonly observations: readonly { readonly asset: string; readonly observation: Observation }[];
  readonly results: readonly (PolicyOutcome & { readonly asset: string })[];
};

/** Every violation of the invariants an estate checks, in the order of the assets, the observations and the results. */
export function checkInvariants(i: InvariantInput): readonly Violation[] {
  const out: Violation[] = [];
  for (const a of i.assets) {
    for (const line of a.capabilities) {
      if (line.offered && String(line.owner).trim() === "") out.push({ invariant: "NoUnownedResponsibilities", subject: `${a.id} ${line.capability}`, message: "an offered capability has no owning system" });
    }
  }
  for (const o of i.observations) {
    if (o.observation.source.trim() === "") out.push({ invariant: "NoEvidenceWithoutAttribution", subject: o.asset, message: `the observation of ${o.observation.at} names no source` });
  }
  for (const r of i.results) {
    if (r.controls.length === 0) out.push({ invariant: "NoComplianceWithoutTraceability", subject: `${r.asset} ${r.id}`, message: "the policy result names no control it gives evidence for" });
  }
  return out;
}
