// Spec: 0003-toolchain-logical FR-001, FR-002
/**
 * What a dialect of tools says it can guarantee, as data, and whether that meets the control `toolIntegrity` of a fleet's assurance. A dialect of artifacts and a dialect of a package manager
 * differ a great deal in how exactly they pin and how they check what they install, and a fleet's assurance says how much it needs; this is where the two are compared.
 *
 * @example
 * ```ts
 * import { meetsIntegrity } from "./guarantees.ts";
 * // meetsIntegrity("exact-hashed", { pin: "rolling", integrity: "none", ... }) lists the reasons it does not
 * ```
 *
 * @module
 */
import type { Controls, DialectId } from "@intellectual-frontiers/archon/governance";
import { PIN_POLICIES, type ManagerId, type Platform, type PinPolicy, type Scope } from "@intellectual-frontiers/toolchain/governance";

/** How a dialect checks what it installs. */
export type Integrity = "hash" | "signature" | "none";

/** What a dialect of tools guarantees. */
export type ToolGuarantees = {
  /** How exactly it pins. */
  readonly pin: PinPolicy;
  readonly integrity: Integrity;
  /** The scopes it can install in. */
  readonly scopes: readonly Scope[];
  /** The platforms it can reach. */
  readonly platforms: readonly Platform[];
  /** Whether it takes the download of a pin or the packages of its manager. */
  readonly binds: "pin" | "package";
  /** Whether it can build from source. */
  readonly sourceBuild: boolean;
};

/** A dialect of tools: its id, the package manager of the ontology it drives where it drives one, and what it guarantees. */
export type ToolDialect = { readonly id: DialectId; readonly manager?: ManagerId; readonly guarantees: ToolGuarantees };

/** How strictly a control asks tools to be pinned. */
export function pinOfControl(control: Controls["toolIntegrity"]): PinPolicy {
  switch (control) {
    case "rolling":
      return "rolling";
    case "release-line":
      return "release-line";
    case "exact-hashed":
      return "exact";
  }
}

/** The rank of a pin policy: 0 is the least strict. */
export function pinRank(pin: PinPolicy): number {
  return PIN_POLICIES.indexOf(pin);
}

/** Every reason a dialect does not meet the control `toolIntegrity`; none where it does. */
export function meetsIntegrity(control: Controls["toolIntegrity"], g: ToolGuarantees): readonly string[] {
  const reasons: string[] = [];
  if (pinRank(g.pin) < pinRank(pinOfControl(control))) reasons.push(`it pins ${g.pin}, and ${control} asks for ${pinOfControl(control)}`);
  if (control === "exact-hashed" && g.integrity !== "hash") reasons.push(`it checks by ${g.integrity}, and exact-hashed asks for a hash`);
  return reasons;
}
