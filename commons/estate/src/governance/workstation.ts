// Spec: 0008-estate-workstations FR-009, FR-010, FR-011
/**
 * The ownership of a workstation: `ergonex` is the system that observes and checks an adopted one and carries out what its commands carry out for a managed one, and `person` owns what a person does and nothing automates (the identity of
 * the account where its key is not Ergonex's, the backup, the retirement of a persistent machine). A persistent workstation is never retired by a system.
 *
 * @example
 * ```ts
 * import { workstationOwners } from "./workstation.ts";
 * workstationOwners({ state: "adopted" }); // { observe: "ergonex", verify: "ergonex" }
 * ```
 *
 * @module
 */
import type { AssetState, Capability } from "./ids.ts";

/** The system id of Ergonex, the coordinator of agent workspaces. */
export const ERGONEX = "ergonex";

/** The system id of what a person does and nothing automates (0008-estate-workstations FR-010). */
export const PERSON = "person";

/** What `workstationOwners` takes. */
export type WorkstationOwnersInput = {
  readonly state: AssetState;
  /** Whether the workstation may be thrown away: `disposable` is retired by Ergonex, anything else by a person. */
  readonly disposability?: "disposable" | "persistent";
  /** Where the harness's key is Ergonex's, Ergonex owns `identity`; else a person does. */
  readonly identity?: typeof ERGONEX | typeof PERSON;
  /** The system that installed the machine, for a managed workstation whose origin is `provisioned` (Ergonex does not install an operating system). */
  readonly provision?: string;
};

/** The owners of a workstation, by capability, for its state: what the commands of Ergonex carry out are Ergonex's, and the rest a person's. */
export function workstationOwners(i: WorkstationOwnersInput): Readonly<Partial<Record<Capability, string>>> {
  if (i.state === "discovered") return {};
  if (i.state === "adopted") return { observe: ERGONEX, verify: ERGONEX };
  return {
    observe: ERGONEX,
    verify: ERGONEX,
    access: ERGONEX,
    plan: ERGONEX,
    converge: ERGONEX,
    update: ERGONEX,
    identity: i.identity ?? PERSON,
    backup: PERSON,
    retire: i.disposability === "disposable" ? ERGONEX : PERSON,
    ...(i.provision === undefined ? {} : { provision: i.provision }),
  };
}

/** The reasons the owners of a workstation cannot hold: where `retire` is owned by a system and the machine is persistent, or by Ergonex and the machine is not stated disposable. Nothing for an asset that offers no `retire`. */
export function checkWorkstationOwners(owners: Readonly<Partial<Record<Capability, string>>>, attributes: Readonly<Record<string, unknown>> | undefined): readonly string[] {
  const retire = owners.retire;
  if (retire === undefined) return [];
  const disposability = attributes?.["disposability"];
  if (disposability === "persistent" && retire !== PERSON) return [`retire is owned by ${retire}, and a persistent workstation is never retired by a system: ${PERSON} owns it`];
  if (retire === ERGONEX && disposability !== "disposable") return [`retire is owned by ${ERGONEX}, which retires only a disposable workstation, and this one does not say it is disposable`];
  return [];
}
