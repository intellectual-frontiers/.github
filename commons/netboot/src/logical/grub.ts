// Spec: 0003-netboot-logical FR-001
/**
 * The GRUB configurations Ubuntu's network GRUB is served. A machine is found by its MAC address; one that is not armed boots its own disk, and one the server does not know is offered the armed hosts with its own disk as the default, so that a stray network boot
 * never reinstalls anything.
 *
 * @example
 * ```ts
 * import { mainMenu } from "./grub.ts";
 * mainMenu().includes("configfile /boot/hosts/"); // true
 * ```
 *
 * @module
 */
import type { BootPins } from "@intellectual-frontiers/netboot/governance";

/** A host the menus name. */
export type MenuHost = { readonly name: string };

/** The menu every machine starts at: hand the machine to its own configuration by its MAC address. */
export function mainMenu(): string {
  return `# netboot: a machine is looked up by MAC address.
set timeout=5
configfile /boot/hosts/\${net_default_mac}.cfg
menuentry "Not an Archon host (\${net_default_mac}): boot the local disk" {
  exit
}
`;
}

/** An install entry: GRUB fills in the MAC it booted from, so that the installed network matches it. `base` is the server's URL ending in a slash. */
function installEntry(host: MenuHost, pins: BootPins, base: string, token: string): string {
  const ds = `ds=nocloud-net\;s=${base}install/${host.name}/${token}/\${net_default_mac}/`;
  return `menuentry "Install ${host.name} (Ubuntu ${pins.point}, erases this machine's disk)" {
  linux /boot/linux ip=dhcp iso-url=${base}iso/${pins.iso.name} autoinstall ${ds} ---
  initrd /boot/initrd
}
`;
}

/** The menu of a known host: an unattended install when it is armed (`token` set), otherwise its own disk. */
export function hostMenu(host: MenuHost, pins: BootPins, base: string, token: string | undefined): string {
  if (token === undefined) {
    return `# ${host.name} is not armed for an install.
set timeout=3
menuentry "${host.name}: not armed for install, booting its own disk" {
  exit
}
`;
  }
  return `# ${host.name}: unattended install of Ubuntu ${pins.point}.
set timeout=3
${installEntry(host, pins, base, token)}menuentry "${host.name}: boot the local disk instead" {
  exit
}
`;
}

/** The menu of a machine the server does not know: the armed hosts, with the local disk the default unless someone at the console picks one. */
export function chooserMenu(armed: ReadonlyArray<{ readonly host: MenuHost; readonly token: string }>, pins: BootPins, base: string): string {
  if (armed.length === 0) {
    return `# Unknown machine and no host is armed: boot the local disk.
set timeout=3
menuentry "Not an Archon host (\${net_default_mac}), nothing armed: boot the local disk" {
  exit
}
`;
  }
  return `# Unknown machine: choose which armed host it becomes, or boot its disk.
set default=0
set timeout=60
menuentry "Unknown machine (\${net_default_mac}): boot the local disk" {
  exit
}
${armed.map((a) => installEntry(a.host, pins, base, a.token)).join("")}`;
}
