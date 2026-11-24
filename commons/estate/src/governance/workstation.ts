// Spec: 0008-estate-workstations FR-009, FR-010, FR-011
/**
 * The ownership of a workstation. The estate has no view on how a workstation is set up, so it names no system of its own: the caller gives the system that observes and checks an adopted
 * workstation and carries out what a managed one has done to it (`system`), and `person` owns what a person does and nothing automates (the identity of the account, the backup, the
 * retirement of a persistent machine). A persistent workstation is never retired by a system.
 *
 * @example
 * ```ts
 * import { workstationOwners } from "./workstation.ts";
 * workstationOwners({ system: "opsfolio", state: "adopted" }); // { observe: "opsfolio", verify: "opsfolio" }
 * ```
 *
 * @module
 */
import type { AssetState, Capability } from "./ids.ts";

/** The system id of what a person does and nothing automates (0008-estate-workstations FR-010). */
export const PERSON = "person";

/** What `workstationOwners` takes. */
export type WorkstationOwnersInput = {
  /** The system that observes and checks the workstation and carries out what is done to a managed one: any system id the estate accepts. */
  readonly system: string;
  readonly state: AssetState;
  /** Whether the workstation may be thrown away: `disposable` is retired by the system, anything else by a person. */
  readonly disposability?: "disposable" | "persistent";
  /** Who owns `identity`, the account of the harness: the system or a person; a person where it is not said. */
  readonly identity?: string;
  /** The system that installed the machine, for a managed workstation whose origin is `provisioned`. */
  readonly provision?: string;
};

/** The owners of a workstation, by capability, for its state: what the system carries out is the system's, and the rest a person's. */
export function workstationOwners(i: WorkstationOwnersInput): Readonly<Partial<Record<Capability, string>>> {
  if (i.state === "discovered") return {};
  if (i.state === "adopted") return { observe: i.system, verify: i.system };
  return {
    observe: i.system,
    verify: i.system,
    access: i.system,
    plan: i.system,
    converge: i.system,
    update: i.system,
    identity: i.identity ?? PERSON,
    backup: PERSON,
    retire: i.disposability === "disposable" ? i.system : PERSON,
    ...(i.provision === undefined ? {} : { provision: i.provision }),
  };
}

/** The reasons the owners of a workstation cannot hold: where `retire` is owned by a system and the machine is persistent, or the machine is not stated disposable. Nothing for an asset that offers no `retire`. */
export function checkWorkstationOwners(owners: Readonly<Partial<Record<Capability, string>>>, attributes: Readonly<Record<string, unknown>> | undefined): readonly string[] {
  const retire = owners.retire;
  if (retire === undefined || retire === PERSON) return [];
  const disposability = attributes?.["disposability"];
  if (disposability === "persistent") return [`retire is owned by ${retire}, and a persistent workstation is never retired by a system: ${PERSON} owns it`];
  if (disposability !== "disposable") return [`retire is owned by ${retire}, which retires only a disposable workstation, and this one does not say it is disposable`];
  return [];
}
