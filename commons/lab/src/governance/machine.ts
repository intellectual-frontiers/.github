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

/** The base images a machine may be made from: the releases of Ubuntu the fleet runs, Debian 13, Rocky Linux 9 (a RHEL-family image from a registry that does not limit anonymous pulls) and Arch Linux's own image (0003-lab-arch-family FR-001). */
export const BASE_IMAGES = ["ubuntu:24.04", "ubuntu:26.04", "debian:13", "quay.io/rockylinux/rockylinux:9", "ghcr.io/archlinux/archlinux:latest"] as const;

/** A base image. */
export type BaseImage = (typeof BASE_IMAGES)[number];

/** The family of Linux of an image, by how its packages are managed: `debian` (apt), `rhel` (dnf) or `arch` (pacman). */
export type ImageFamily = "debian" | "rhel" | "arch";

/** The family of an image; the `switch` ends in `absurd`, so a base image added to the list without a family does not compile. */
export function imageFamily(image: BaseImage): ImageFamily {
  switch (image) {
    case "ubuntu:24.04":
    case "ubuntu:26.04":
    case "debian:13":
      return "debian";
    case "quay.io/rockylinux/rockylinux:9":
      return "rhel";
    case "ghcr.io/archlinux/archlinux:latest":
      return "arch";
    default:
      return absurd(image);
  }
}

function absurd(x: never): never {
  throw new Error(`an image with no family: ${String(x)}`);
}

/** How a machine of the family `arch` is started: `systemd` as the first process, or `none`, with the SSH server in the foreground and no systemd (0003-lab-arch-family FR-004). */
export type InitMode = "systemd" | "none";

/** The packages of Omarchy's terminal side that Arch's own repositories carry (read from `install/omarchy-base.packages` of Omarchy 4.5.0, checked against `core` and `extra`). A machine made with them is Arch with Omarchy's terminal-side packages and never Omarchy: `omarchy`, `omarchy-settings`, `herdr`, `mise-bin` and `yay` are in Omarchy's own repository and are not installed (0003-lab-arch-family FR-006). */
export const OMARCHY_TERMINAL_PACKAGES = ["fd", "fzf", "git", "github-cli", "gum", "jq", "mise", "ripgrep", "starship", "tmux"] as const;

/** What a machine of this kind is called where it is described to a person: never Omarchy for a container (FR-006). */
export const ARCH_WITH_OMARCHY_TERMINAL = "Arch with Omarchy's terminal-side packages";

/** A user of a machine: its name, and whether it may use sudo with no password (as the first user of a cloud image does). */
export type MachineUser = { readonly name: string; readonly sudo: boolean };

/** What a machine is made from. */
export type MachineSpec = {
  /** A name of lower case letters, digits and hyphens: the name of the container is made from it. */
  readonly name: string;
  readonly image: BaseImage;
  readonly users: readonly MachineUser[];
  /** Packages of the release's own archive, installed with the package program of the image's family (apt or dnf) when the image is made. */
  readonly packages: readonly string[];
  /** The time zone the machine is set to (an area/location name). */
  readonly timezone?: string;
  /** How a machine of the family `arch` is started (`systemd` by default); not given for the other families. */
  readonly init?: InitMode;
};

/** An area of what a machine is. */
export type Area =
  | "systemd units and timers"
  | "packages (apt, dnf or pacman)"
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
  { area: "packages (apt, dnf or pacman)", fidelity: "faithful", note: "the release's own archive and its package program: dpkg, rpm or pacman" },
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

/** What a virtual machine stands in for: the areas a virtual machine does not stand in for, though it boots (0003-lab-arch-family FR-012): the firmware and Secure Boot are the emulator's, the hardware is emulated, and a power cycle of the emulator is not one of a machine. */
export const VM_NOT_FAITHFUL: readonly AreaFidelity[] = [
  { area: "UEFI, Secure Boot and boot", fidelity: "not faithful", note: "the kernel and initrd are handed to the emulator, so there is no firmware boot, no boot loader and no Secure Boot" },
  { area: "hardware facts", fidelity: "not faithful", note: "the processors, memory and devices are the emulator's, and under emulation (tcg) nothing may be said of speed" },
  { area: "power cycle", fidelity: "not faithful", note: "stopping the emulator is not a reboot of a machine" },
];
