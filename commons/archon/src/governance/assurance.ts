// Spec: 0002-archon-governance FR-005, FR-006, FR-007, FR-008
/**
 * The assurance of a fleet: how strictly it approves a change to its machines. A profile (`solo`, `team` or `regulated`) is a table of controls, each control a value with a rank from the
 * least strict to the most; a fleet can override one control with a reason and a date; and a floor that no profile and no override lowers is stated beside them. `judgeAssuranceChange` decides
 * whether a tip that proposes another assurance is accepted by the assurance in force, so that a commit cannot lower its own bar.
 *
 * @example
 * ```ts
 * import { PROFILES } from "./assurance.ts";
 * PROFILES.solo.approval; // "authenticated-push"
 * PROFILES.regulated.keyCustody; // "hardware-required"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";

/** A named level of strictness. */
export type ProfileName = "solo" | "team" | "regulated";
/** Every profile, from the least strict to the most. */
export const PROFILE_NAMES: readonly ProfileName[] = ["solo", "team", "regulated"];

/** The controls of a profile. */
export type Controls = {
  /** How a change is approved. */
  readonly approval: "authenticated-push" | "signed-commit" | "signed-commit-second-approver";
  /** How the key that approves is held. */
  readonly keyCustody: "optional" | "passphrase-or-hardware" | "hardware-required";
  /** What a machine accepts as the tip to follow. */
  readonly tipAccept: "authenticated-remote" | "signed-by-listed-signer" | "signed-with-plan-hash";
  /** How a fleet recovers when a key is lost. */
  readonly recovery: "owner-backup" | "recovery-key" | "recovery-key-escrow-break-glass";
  /** What is kept of what happened. */
  readonly audit: "run-log" | "mail-every-change" | "offbox-ledger";
  /** How remote access is exposed. */
  readonly exposure: "lan-only" | "passkeys" | "passkeys-mfa";
  /** Whether a change of tier or a destructive change needs a second approver. */
  readonly secondApprover: "never" | "tier-and-destructive";
  /** Whether an approval must name the hash of the plan. */
  readonly planHash: "optional" | "required";
  /** How strictly the tools of a computer are pinned: any current version, a release line, or one exact version with the hash of its artifact. */
  readonly toolIntegrity: "rolling" | "release-line" | "exact-hashed";
};

/** The name of a control. */
export type ControlName = keyof Controls;

/** The values of each control from the least strict to the most: the position is the rank. */
const ORDER: { readonly [K in ControlName]: readonly Controls[K][] } = {
  approval: ["authenticated-push", "signed-commit", "signed-commit-second-approver"],
  keyCustody: ["optional", "passphrase-or-hardware", "hardware-required"],
  tipAccept: ["authenticated-remote", "signed-by-listed-signer", "signed-with-plan-hash"],
  recovery: ["owner-backup", "recovery-key", "recovery-key-escrow-break-glass"],
  audit: ["run-log", "mail-every-change", "offbox-ledger"],
  exposure: ["lan-only", "passkeys", "passkeys-mfa"],
  secondApprover: ["never", "tier-and-destructive"],
  planHash: ["optional", "required"],
  toolIntegrity: ["rolling", "release-line", "exact-hashed"],
};

const VALUES: Readonly<Record<ControlName, readonly string[]>> = ORDER;

/** The names of the controls. */
export const CONTROL_NAMES: readonly ControlName[] = ["approval", "keyCustody", "tipAccept", "recovery", "audit", "exposure", "secondApprover", "planHash", "toolIntegrity"];

/** The rank of a value of a control (0 is the least strict), or -1 where it is not a value of it. */
export function rankOf(control: ControlName, value: string): number {
  return VALUES[control].indexOf(value);
}

/** The profiles. */
export const PROFILES: Readonly<Record<ProfileName, Controls>> = {
  solo: {
    approval: "authenticated-push",
    keyCustody: "optional",
    tipAccept: "authenticated-remote",
    recovery: "owner-backup",
    audit: "run-log",
    exposure: "lan-only",
    secondApprover: "never",
    planHash: "optional",
    toolIntegrity: "rolling",
  },
  team: {
    approval: "signed-commit",
    keyCustody: "passphrase-or-hardware",
    tipAccept: "signed-by-listed-signer",
    recovery: "recovery-key",
    audit: "mail-every-change",
    exposure: "passkeys",
    secondApprover: "never",
    planHash: "optional",
    toolIntegrity: "release-line",
  },
  regulated: {
    approval: "signed-commit-second-approver",
    keyCustody: "hardware-required",
    tipAccept: "signed-with-plan-hash",
    recovery: "recovery-key-escrow-break-glass",
    audit: "offbox-ledger",
    exposure: "passkeys-mfa",
    secondApprover: "tier-and-destructive",
    planHash: "required",
    toolIntegrity: "exact-hashed",
  },
};

/** One rule of the floor. */
export type FloorRule = { readonly id: string; readonly rule: string };

/** What holds whatever the profile and whatever the overrides. */
export const FLOOR: readonly FloorRule[] = [
  { id: "no-secret-in-a-model", rule: "No secret is in a model, a specification, a commit, a log or a report: a model holds a reference to a secret." },
  { id: "no-passphrase-stored", rule: "No library stores or sees a passphrase: a person types it where it is asked for." },
  { id: "agent-proposes-person-approves", rule: "An agent proposes and a person approves: no agent can approve." },
  { id: "destructive-needs-typed-confirmation", rule: "A destructive action needs the marker of its requirement and a confirmation typed by a person." },
];

/** An override of one control of a profile, with the reason and the date it was decided. */
export type Override = {
  readonly control: ControlName;
  readonly value: string;
  readonly reason: string;
  readonly decidedOn: string;
};

/** A profile with the overrides of a fleet, resolved to its controls. */
export type Assurance = {
  readonly profile: ProfileName;
  readonly controls: Controls;
  readonly overrides: readonly Override[];
};

function isControlName(text: string): text is ControlName {
  return CONTROL_NAMES.some((c) => c === text);
}

/** An override from untyped data, or why it is not one. */
export function parseOverride(input: unknown): Result<Override, string> {
  if (typeof input !== "object" || input === null) return err("an override is an object");
  const o: { readonly [key: string]: unknown } = Object.fromEntries(Object.entries(input));
  const { control, value, reason, decidedOn } = o;
  if (typeof control !== "string" || !isControlName(control)) return err(`an override names a control of ${CONTROL_NAMES.join(", ")}`);
  if (typeof value !== "string" || rankOf(control, value) < 0) return err(`the value of ${control} is one of ${VALUES[control].join(", ")}`);
  if (typeof reason !== "string" || reason.trim() === "") return err(`the override of ${control} has a reason`);
  if (typeof decidedOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(decidedOn)) return err(`the override of ${control} has the date it was decided, as YYYY-MM-DD`);
  return ok({ control, value, reason, decidedOn });
}

/** The assurance of a profile with overrides, or every reason an override is refused. */
export function resolveAssurance(profile: ProfileName, overrides: readonly unknown[] = []): Result<Assurance, readonly string[]> {
  const parsed: Override[] = [];
  const problems: string[] = [];
  for (const o of overrides) {
    const r = parseOverride(o);
    if (r.kind === "ok") parsed.push(r.value);
    else problems.push(r.error);
  }
  if (problems.length > 0) return err(problems);
  let controls: Controls = PROFILES[profile];
  for (const o of parsed) controls = { ...controls, [o.control]: o.value };
  return ok({ profile, controls, overrides: parsed });
}

/** What the approval of a tip is shown to have been. */
export type ApprovalEvidence = {
  readonly mechanism: Controls["approval"];
  readonly keyHeld: "none" | "passphrase" | "hardware";
  readonly tip: Controls["tipAccept"];
  readonly secondApproverPresent: boolean;
  readonly planHashNamed: boolean;
};

/** The controls of an assurance that the evidence of an approval does not meet. Recovery, audit and exposure are not shown by an approval and are not judged here. */
export function unmetBy(controls: Controls, evidence: ApprovalEvidence): readonly ControlName[] {
  const unmet: ControlName[] = [];
  if (rankOf("approval", evidence.mechanism) < rankOf("approval", controls.approval)) unmet.push("approval");
  const heldRank = evidence.keyHeld === "hardware" ? 2 : evidence.keyHeld === "passphrase" ? 1 : 0;
  if (heldRank < rankOf("keyCustody", controls.keyCustody)) unmet.push("keyCustody");
  if (rankOf("tipAccept", evidence.tip) < rankOf("tipAccept", controls.tipAccept)) unmet.push("tipAccept");
  if (controls.secondApprover === "tier-and-destructive" && !evidence.secondApproverPresent) unmet.push("secondApprover");
  if (controls.planHash === "required" && !evidence.planHashNamed) unmet.push("planHash");
  return unmet;
}

/** The controls that the proposed assurance holds less strictly than the one in force. */
export function loweredBy(inForce: Assurance, proposed: Assurance): readonly ControlName[] {
  return CONTROL_NAMES.filter((c) => rankOf(c, proposed.controls[c]) < rankOf(c, inForce.controls[c]));
}

/** The judgement of a tip that proposes an assurance. */
export type AssuranceJudgement =
  | { readonly kind: "accepted"; readonly lowered: readonly ControlName[] }
  | { readonly kind: "refused"; readonly unmet: readonly ControlName[] };

/** Whether a tip that proposes `proposed` is accepted: by the assurance in force, never by the one proposed, so that a commit cannot lower its own bar. An accepted change records the controls it lowers. */
export function judgeAssuranceChange(input: { readonly inForce: Assurance; readonly proposed: Assurance; readonly evidence: ApprovalEvidence }): AssuranceJudgement {
  const unmet = unmetBy(input.inForce.controls, input.evidence);
  if (unmet.length > 0) return { kind: "refused", unmet };
  return { kind: "accepted", lowered: loweredBy(input.inForce, input.proposed) };
}
