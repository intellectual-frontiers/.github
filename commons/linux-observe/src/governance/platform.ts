// Spec: 0004-linux-observe-platform FR-001, FR-002
/**
 * What kind of machine a Linux machine is: its family (the way its packages are managed), its distribution, its release and its architecture. The family is the fact the rest depends on: a dialect carries a package by the program of the family, and an observation reads it by the program of the family.
 *
 * @example
 * ```ts
 * import { familyOf } from "./platform.ts";
 * familyOf("rocky", "rhel centos fedora"); // "rhel"
 * ```
 *
 * @module
 */

/** The families of Linux that Desired OS State tells apart, by how packages are managed: `debian` (dpkg and apt), `rhel` (rpm and dnf), `suse` (rpm and zypper), `arch` (pacman). */
export const FAMILIES = ["debian", "rhel", "suse", "arch"] as const;
/** A family. */
export type Family = (typeof FAMILIES)[number];

/** The architectures of a machine, as `uname -m` names them for the ones in use. */
export const ARCHITECTURES = ["x86_64", "aarch64"] as const;
/** An architecture. */
export type Architecture = (typeof ARCHITECTURES)[number];

/** What is read of a machine: its family, the `ID` and `VERSION_ID` of `/etc/os-release`, and the architecture where it was asked. */
export type Observed = { readonly family: Family; readonly distro: string; readonly release: string; readonly arch?: Architecture };

/** What the model declares of a machine: the same, with the architecture always said. Whether it is a server, a workstation or a workshop is the kind of its asset, said once there. */
export type Declared = { readonly family: Family; readonly distro: string; readonly release: string; readonly arch: Architecture };

/** The families by the `ID` of a distribution. The ones a distribution derives from are found by `ID_LIKE` where the `ID` is not here. */
export const FAMILY_OF_ID: Readonly<Record<string, Family>> = {
  debian: "debian",
  ubuntu: "debian",
  raspbian: "debian",
  rhel: "rhel",
  centos: "rhel",
  rocky: "rhel",
  almalinux: "rhel",
  fedora: "rhel",
  ol: "rhel",
  sles: "suse",
  sled: "suse",
  opensuse: "suse",
  "opensuse-leap": "suse",
  "opensuse-tumbleweed": "suse",
  arch: "arch",
  archarm: "arch",
  manjaro: "arch",
  endeavouros: "arch",
};

/** The family of a distribution from the `ID` and the `ID_LIKE` of its `os-release`, or nothing where neither is one Desired OS State knows (it is then said, never guessed). */
export function familyOf(id: string, idLike: string = ""): Family | undefined {
  const own = FAMILY_OF_ID[id.toLowerCase()];
  if (own !== undefined) return own;
  for (const like of idLike.toLowerCase().split(/\s+/)) {
    const f = FAMILY_OF_ID[like];
    if (f !== undefined) return f;
  }
  return undefined;
}
