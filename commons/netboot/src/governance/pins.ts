// Spec: 0002-netboot-pins FR-001, FR-002
/**
 * The boot files a netboot serves, each pinned by SHA-256, and where they come from. A new point release of Ubuntu is adopted by changing this data in a reviewed commit; nothing is served that does not match its pin.
 *
 * How the pins were established (carried from the retired engine's record of 2026-11-10, and checked again by the first fetch, which refuses a file that does not match): the ISO's hash is the one in Ubuntu's `SHA256SUMS` for the release; `bootx64.efi` (shim), `linux` and
 * `initrd` from the release's `netboot/amd64/` are byte-identical to `EFI/boot/bootx64.efi`, `casper/vmlinuz` and `casper/initrd` in that ISO; `grubx64.efi` is Ubuntu's network GRUB, which Ubuntu publishes no separate checksum for, so it is pinned here, and Secure Boot also checks Canonical's
 * signature on it at every boot.
 *
 * @example
 * ```ts
 * import { UBUNTU_26_04 } from "./pins.ts";
 * Object.keys(UBUNTU_26_04.files); // ["bootx64.efi", "grubx64.efi", "linux", "initrd"]
 * ```
 *
 * @module
 */

/** The files of one release of Ubuntu that a netboot serves. */
export type BootPins = {
  readonly release: string;
  readonly point: string;
  /** The folder of the release's network boot files. */
  readonly netboot: string;
  /** The installer image the machine downloads, where the installer is an image (Ubuntu's live server); a network installer that fetches its packages from a mirror has none. */
  readonly iso?: { readonly name: string; readonly url: string; readonly sha256: string };
  /** The network boot files by name, each with its SHA-256. */
  readonly files: Readonly<Record<string, string>>;
  /** Where a file is, relative to `netboot`, where that is not its own name (the boot files of some distributions are in two folders). */
  readonly paths?: Readonly<Record<string, string>>;
};

/** Ubuntu 26.04.1 for amd64. */
export const UBUNTU_26_04: BootPins = {
  release: "26.04",
  point: "26.04.1",
  netboot: "https://releases.ubuntu.com/26.04/netboot/amd64/",
  iso: {
    name: "ubuntu-26.04.1-live-server-amd64.iso",
    url: "https://releases.ubuntu.com/26.04/ubuntu-26.04.1-live-server-amd64.iso",
    sha256: "cc8a95cde20f6ced61a322420de00f10cc3c90ced545daa46cb9c1a117f1d927",
  },
  files: {
    "bootx64.efi": "4c89145e958cf592a6f16552eadf112ef2c1c525e2435c2761e6a99fa88188b3",
    "grubx64.efi": "f1dcfde2af47e7d7c2c46ca95f4529d22692383fe826e56058652437fd2a8b9d",
    linux: "0ad39b13e289e1a5cf806d14541ac8f221eefe849017f5915e0846917ed67785",
    initrd: "7aeb757e12400830fc59e962c603a43439d662fb9309ab36cb2537f41a1b8335",
  },
};

/** What stands for the boot server's URL for one install in a rendered file; the server puts the URL in (ending in a slash) when it serves the file. */
export const BASE_PLACEHOLDER = "@archon:base@";
/** What stands for the administrator's password hash in a rendered file; the server puts the hash in when it serves the file. */
export const PASSWORD_PLACEHOLDER = "@archon:password-hash@";
