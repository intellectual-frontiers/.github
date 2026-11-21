// Spec: 0005-netboot-profiles FR-001, FR-002, FR-003
/**
 * A boot profile: what one distribution needs from a network boot, as data. The server, the menus and the arming are the same for every distribution; a profile says which files are served and how each is pinned (`BootPins`), what the kernel is told
 * on its command line, and which file under the install's URL is the install document the installer reads (the autoinstall's `user-data`, a Debian `preseed.cfg`, and so on). A boot server serves one profile at a time, because the names of the boot files (`linux`, `initrd`)
 * are the same in every distribution.
 *
 * The command line is a template: `{base}` is the boot server's URL (ending in a slash), `{install}` is the install's own URL (ending in a slash, with the host, the token and the MAC in it), `{iso}` is the URL of the installer image, and `{mac}` is what GRUB fills in as the MAC it booted from.
 *
 * @example
 * ```ts
 * import { profileById } from "./profile.ts";
 * profileById("debian-13")?.document; // "preseed.cfg"
 * ```
 *
 * @module
 */
import { UBUNTU_26_04, type BootPins } from "./pins.ts";

/** The files an install may ask the server for as its install document. */
export const INSTALL_DOCUMENTS = ["user-data", "preseed.cfg", "ks.cfg", "autoinst.xml"] as const;
/** The name of an install document. */
export type InstallDocument = (typeof INSTALL_DOCUMENTS)[number];

/** What one distribution needs from a network boot. */
export type BootProfile = {
  /** The profile's name, as a person selects it: the distribution and its release. */
  readonly id: string;
  /** The family the platform model gives the distribution, so that the install is rendered for the right installer. */
  readonly family: "debian" | "redhat" | "suse" | "arch";
  /** The distribution and release as the menu says them. */
  readonly title: string;
  readonly pins: BootPins;
  /** The name of the kernel among the pinned files. */
  readonly kernel: string;
  /** The name of the initial ramdisk among the pinned files. */
  readonly initrd: string;
  /** The kernel's command line, with the placeholders of the header. */
  readonly cmdline: string;
  /** The install document the installer reads from the install's URL. */
  readonly document: InstallDocument;
  /** The content type the install document is served with. */
  readonly documentType: string;
};

/** Ubuntu 26.04.1: the live server's autoinstall, fed by cloud-init's NoCloud from the install's URL. */
export const UBUNTU_26_04_PROFILE: BootProfile = {
  id: "ubuntu-26.04",
  family: "debian",
  title: `Ubuntu ${UBUNTU_26_04.point}`,
  pins: UBUNTU_26_04,
  kernel: "linux",
  initrd: "initrd",
  cmdline: "ip=dhcp iso-url={iso} autoinstall ds=nocloud-net\\;s={install} ---",
  document: "user-data",
  documentType: "text/cloud-config; charset=utf-8",
};

/**
 * Debian 13 (trixie): the netboot installer, which fetches its packages from the mirror, so there is no image. The files are those of the installer's `current` folder, pinned by the SHA-256 of its `SHA256SUMS` of 2026-11-21 (the files of a point release are
 * replaced in place, so a new point release is adopted by changing these pins in a reviewed commit; a file that does not match its pin is not served).
 */
export const DEBIAN_13: BootPins = {
  release: "13",
  point: "13.8",
  netboot: "https://deb.debian.org/debian/dists/stable/main/installer-amd64/current/images/netboot/debian-installer/amd64/",
  files: {
    "bootnetx64.efi": "e103c5d02657879f141b086ed703584d28bb9e2721b423333be085ee1b4d397b",
    "grubx64.efi": "30d9df215175ba2c0e3ff7ed33c9a30acba87c2638ecc1cac3b7fd29bf48cfb3",
    linux: "14159c607ad9762133db41e479dafecde1d6a5fe715a8d65d292a3262e4b6bed",
    "initrd.gz": "8931fe75c6fefc90009f833afd6bb52d10e6f30d9723664eeee5f4258a7eabc3",
  },
};

/** Debian 13: the installer is told where its preseed is, and runs with no question that the preseed answers. */
export const DEBIAN_13_PROFILE: BootProfile = {
  id: "debian-13",
  family: "debian",
  title: `Debian ${DEBIAN_13.point}`,
  pins: DEBIAN_13,
  kernel: "linux",
  initrd: "initrd.gz",
  cmdline: "auto=true priority=critical netcfg/choose_interface=auto url={install}preseed.cfg ---",
  document: "preseed.cfg",
  documentType: "text/plain; charset=utf-8",
};

/** Every profile there is. */
export const PROFILES: readonly BootProfile[] = [UBUNTU_26_04_PROFILE, DEBIAN_13_PROFILE];

/** The profile of a name, if there is one. */
export function profileById(id: string): BootProfile | undefined {
  return PROFILES.find((p) => p.id === id);
}
