// Spec: 0003-estate-logical FR-007
// Spec: 0008-estate-workstations FR-013, FR-014, FR-015, FR-016
/**
 * The invariants of the Operational Truth Ontology (commons ontology 0002-oto FR-003) that an estate can check: no unowned responsibilities (every capability an asset offers has an owning system), no evidence without attribution
 * (every observation names its source) and no compliance without traceability (every policy result names the controls it gives evidence for). A violation is a system error, not an audit finding. The other three invariants
 * need policies and the criticality of controls, which an estate does not hold, and are named here as not checked, except `NoAuthorityWithoutScope`, which is checked for the kind `workstation` and for no other: the harnesses of a workstation are
 * an authority, and the digest of the typed `agents` policy that bounds them is its scope. For an agent workspace the estate also checks that a persistent one is managed only with an approval record, that it is observed within its freshness window
 * and that what is observed of its secrets is their names, never a value.
 *
 * @example
 * ```ts
 * import { checkInvariants } from "./invariants.ts";
 * checkInvariants({ assets: [], observations: [], results: [{ asset: "synthetic-server-02", id: "disk-encryption", status: "pass", controls: [] }] })[0]?.invariant; // "NoComplianceWithoutTraceability"
 * ```
 *
 * @module
 */
import { AGENTS_POLICY_DIGEST, cadenceOf, freshnessWindowMs, type Asset, type CapturePolicy } from "@intellectual-frontiers/estate/governance";
import { parseDuration } from "@intellectual-frontiers/grc/governance";
import type { Observation } from "./truth.ts";
import type { PolicyOutcome } from "./risk.ts";

/** The invariants of OTO, by their names in the ontology. */
export type InvariantName = "NoOrphanPolicies" | "NoUnownedResponsibilities" | "NoUnenforcedCriticalControls" | "NoEvidenceWithoutAttribution" | "NoAuthorityWithoutScope" | "NoComplianceWithoutTraceability";

/** The invariants an estate adds for its workstations, beside those of OTO. */
export type EstateInvariantName = "PersistentAgentWorkspaceApproved" | "AgentWorkspaceObserved" | "NoSecretValuesObserved";

/** Whether an estate checks an invariant: `checked`, or `not checked` where it needs what an estate does not hold. */
export const INVARIANT_COVERAGE: Readonly<Record<InvariantName, "checked" | "not checked">> = {
  NoOrphanPolicies: "not checked",
  NoUnownedResponsibilities: "checked",
  NoUnenforcedCriticalControls: "not checked",
  NoEvidenceWithoutAttribution: "checked",
  NoAuthorityWithoutScope: "checked",
  NoComplianceWithoutTraceability: "checked",
};

/** A violation: the invariant, what it is about and what is wrong. */
export type Violation = { readonly invariant: InvariantName | EstateInvariantName; readonly subject: string; readonly message: string };

/** What an estate is checked with: its assets, the observations of them (the asset each is of) and the policy results (the asset each is of). */
export type InvariantInput = {
  readonly assets: readonly Asset[];
  readonly observations: readonly { readonly asset: string; readonly observation: Observation }[];
  readonly results: readonly (PolicyOutcome & { readonly asset: string })[];
  /** The approvals of the managed assets (the person and the hash of the plan), by asset: a persistent agent workspace is managed only with one. */
  readonly approvals?: readonly { readonly asset: string; readonly by: string; readonly planHash: string }[];
  /** The instant now and the capture policy, for the freshness of the observations of the agent workspaces; without it freshness is not checked. */
  readonly freshness?: { readonly now: string; readonly policy: CapturePolicy };
};

const SECRET_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const PLAN_HASH = /^sha256:[0-9a-f]{64}$/;

/** Every violation of the invariants an estate checks, in the order of the assets, the observations and the results. */
export function checkInvariants(i: InvariantInput): readonly Violation[] {
  const out: Violation[] = [];
  for (const a of i.assets) {
    for (const line of a.capabilities) {
      if (line.offered && String(line.owner).trim() === "") out.push({ invariant: "NoUnownedResponsibilities", subject: `${a.id} ${line.capability}`, message: "an offered capability has no owning system" });
    }
  }
  for (const a of i.assets) if (a.kind === "workstation") out.push(...workstationViolations(a, i));
  for (const o of i.observations) {
    if (o.observation.source.trim() === "") out.push({ invariant: "NoEvidenceWithoutAttribution", subject: o.asset, message: `the observation of ${o.observation.at} names no source` });
  }
  for (const r of i.results) {
    if (r.controls.length === 0) out.push({ invariant: "NoComplianceWithoutTraceability", subject: `${r.asset} ${r.id}`, message: "the policy result names no control it gives evidence for" });
  }
  return out;
}

function workstationViolations(a: Asset, i: InvariantInput): readonly Violation[] {
  const out: Violation[] = [];
  const at = a.attributes ?? {};
  const harnesses = at["harnesses"];
  const hasHarnesses = Array.isArray(harnesses) && harnesses.length > 0;
  const agent = at["role"] === "agent-workspace";
  const policy = at["agents-policy"];
  if ((agent || hasHarnesses) && !(typeof policy === "string" && AGENTS_POLICY_DIGEST.test(policy))) {
    out.push({ invariant: "NoAuthorityWithoutScope", subject: a.id, message: `${agent ? "an agent workspace" : "a workstation that holds harnesses"} states no agents-policy (the digest of the typed policy that bounds what its harnesses may do), and an authority without a scope is refused` });
  }
  if (agent && at["disposability"] === "persistent" && a.state === "managed") {
    const approved = (i.approvals ?? []).some((x) => x.asset === a.id && x.by.trim() !== "" && PLAN_HASH.test(x.planHash));
    if (!approved) out.push({ invariant: "PersistentAgentWorkspaceApproved", subject: a.id, message: "a persistent agent workspace is managed only with an approval record: the person and the hash of the plan they approved" });
  }
  const observations = i.observations.filter((o) => o.asset === a.id);
  if (agent && a.state !== "discovered" && i.freshness !== undefined) {
    const cadence = cadenceOf(i.freshness.policy, a);
    const ms = cadence === undefined ? undefined : parseDuration(cadence);
    const latest = observations.map((o) => Date.parse(o.observation.at)).filter((t) => !Number.isNaN(t)).sort((x, y) => y - x)[0];
    const now = Date.parse(i.freshness.now);
    if (ms !== undefined && ms.kind === "ok" && !Number.isNaN(now)) {
      const window = freshnessWindowMs(ms.value);
      if (latest === undefined) out.push({ invariant: "AgentWorkspaceObserved", subject: a.id, message: "an agent workspace was never observed" });
      else if (now - latest > window) out.push({ invariant: "AgentWorkspaceObserved", subject: a.id, message: `the last observation is older than its freshness window (${Math.round(window / 60_000)} minutes)` });
    }
  }
  for (const o of observations) {
    const names = (o.observation.state["agent"] as { readonly [k: string]: unknown } | undefined)?.["ambient-secret-names"];
    if (Array.isArray(names)) for (const n of names) if (typeof n !== "string" || !SECRET_NAME.test(n)) out.push({ invariant: "NoSecretValuesObserved", subject: a.id, message: "ambient secrets are observed by the names of their variables, never by value" });
  }
  return out;
}
