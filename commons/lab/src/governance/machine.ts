// Spec: 0002-lab-machine FR-001, FR-005
/**
 * What a disposable machine is and what a container can stand in for. A machine is described by a name, a base image, its users and its packages; and every area of what a machine is has a statement of whether a container stands in
 * for it faithfully or not, so that a test says which of its claims a container can prove, and a green run is never read as proof of what a container cannot show.
 *
 * @example
 * ```ts
 * import { AREAS } from "./machine.ts";
 * AREAS.find((a) => a.area === "firewall")?.fidelity; // "not faithful"
 * ```
 *
 * @module
 */

/** The base images a machine may be made from: the releases of Ubuntu the fleet runs. */
export type BaseImage = "ubuntu:24.04" | "ubuntu:26.04";

/** A user of a machine: its name, and whether it may use sudo with no password (as the first user of a cloud image does). */
export type MachineUser = { readonly name: string; readonly sudo: boolean };

/** What a machine is made from. */
export type MachineSpec = {
  /** A name of lower case letters, digits and hyphens: the name of the container is made from it. */
  readonly name: string;
  readonly image: BaseImage;
  readonly users: readonly MachineUser[];
  /** Packages of the release's own archive, installed with apt when the image is made. */
  readonly packages: readonly string[];
  /** The time zone the machine is set to (an area/location name). */
  readonly timezone?: string;
};

/** An area of what a machine is. */
export type Area =
  | "systemd units and timers"
  | "apt packages"
  | "users, groups and keys"
  | "files and directories"
  | "time zone and locale"
  | "sshd and a restricted key"
  | "host name"
  | "firewall"
  | "kernel settings"
  | "mounts and disks"
  | "UEFI, Secure Boot and boot"
  | "hardware facts"
  | "power cycle";

/** Whether a container stands in for an area, and why. */
export type AreaFidelity = { readonly area: Area; readonly fidelity: "faithful" | "not faithful"; readonly note: string };

/** Every area, with what a container does for it: what is `faithful` is proved on a container, and what is `not faithful` is left to a real machine. */
export const AREAS: readonly AreaFidelity[] = [
  { area: "systemd units and timers", fidelity: "faithful", note: "systemd runs as the first process of the container" },
  { area: "apt packages", fidelity: "faithful", note: "the release's own archive and dpkg" },
  { area: "users, groups and keys", fidelity: "faithful", note: "the system's own accounts" },
  { area: "files and directories", fidelity: "faithful", note: "the container's own file system" },
  { area: "time zone and locale", fidelity: "faithful", note: "timedatectl and localectl act on the container" },
  { area: "sshd and a restricted key", fidelity: "faithful", note: "a real sshd on its own port, a real ssh client and a forced command" },
  { area: "host name", fidelity: "not faithful", note: "the container shares the host's network namespace, so it has the host's name and setting one of its own fails" },
  { area: "firewall", fidelity: "not faithful", note: "the container shares the host's network and has no firewall of its own" },
  { area: "kernel settings", fidelity: "not faithful", note: "the kernel is the host's" },
  { area: "mounts and disks", fidelity: "not faithful", note: "there is no disk, no partition table and no encrypted volume" },
  { area: "UEFI, Secure Boot and boot", fidelity: "not faithful", note: "nothing boots: the container starts at systemd" },
  { area: "hardware facts", fidelity: "not faithful", note: "the processors and memory are the host's" },
  { area: "power cycle", fidelity: "not faithful", note: "stopping a container is not a reboot of a machine" },
];

/** The areas a container does not stand in for: left to a real machine. */
export const NOT_FAITHFUL: readonly Area[] = AREAS.filter((a) => a.fidelity === "not faithful").map((a) => a.area);
