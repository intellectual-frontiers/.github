// Spec: 0003-netboot-logical FR-005
/**
 * What a request for a path is: a boot file, the menu of the network GRUB, the installer image, the menu of one MAC, or one of the files and posts of an install (`/install/<host>/<token>/<mac>/<what>`). TFTP and HTTP use the same classification, so that PXE and HTTP boot
 * get the same files. Pure.
 *
 * @example
 * ```ts
 * import { classify } from "./routes.ts";
 * classify("/boot/hosts/aa:bb:cc:dd:ee:ff.cfg").kind; // "mac-menu"
 * ```
 *
 * @module
 */

/** The install's own names under its URL. */
export const INSTALL_FILES = ["user-data", "preseed.cfg", "ks.cfg", "autoinst.xml", "meta-data", "vendor-data", "guard.sh", "facts", "event", "done"] as const;
/** A name under an install's URL. */
export type InstallFile = (typeof INSTALL_FILES)[number];

/** What a path is. */
export type Route =
  | { readonly kind: "boot-file"; readonly name: string }
  | { readonly kind: "main-menu" }
  | { readonly kind: "mac-menu"; readonly mac: string }
  | { readonly kind: "host-boot-file"; readonly host: string; readonly name: string }
  | { readonly kind: "iso"; readonly name: string }
  | { readonly kind: "install"; readonly host: string; readonly token: string; readonly mac: string; readonly file: InstallFile }
  | { readonly kind: "unknown" };

const MAC = /^[0-9a-f]{2}(:[0-9a-f]{2}){5}$/i;
const NAME = /^(?!\.+$)[A-Za-z0-9._-]+$/;

/** The kind of route a path is. `bootFiles` are the names of the files the server holds (`bootx64.efi`, `grubx64.efi`, `linux`, `initrd`). */
export function classify(path: string, bootFiles: readonly string[] = ["bootx64.efi", "grubx64.efi", "linux", "initrd"]): Route {
  const p = path.split("?")[0] ?? "";
  const parts = p.split("/").filter((x) => x !== "");
  const bare = (n: string): boolean => bootFiles.includes(n);
  if (parts.length === 1 && bare(parts[0] ?? "")) return { kind: "boot-file", name: parts[0] ?? "" };
  if (p === "/grub/grub.cfg" || p === "/grub.cfg" || p === "/boot/grub/grub.cfg") return { kind: "main-menu" };
  if (parts[0] === "boot") {
    if (parts.length === 2 && bare(parts[1] ?? "")) return { kind: "boot-file", name: parts[1] ?? "" };
    if (parts.length === 3 && parts[1] === "hosts" && (parts[2] ?? "").endsWith(".cfg")) {
      const mac = (parts[2] ?? "").slice(0, -4).replace(/-/g, ":");
      return MAC.test(mac) ? { kind: "mac-menu", mac: mac.toLowerCase() } : { kind: "unknown" };
    }
    if (parts.length === 3 && NAME.test(parts[1] ?? "") && bare(parts[2] ?? "")) return { kind: "host-boot-file", host: parts[1] ?? "", name: parts[2] ?? "" };
  }
  if (parts[0] === "iso" && parts.length === 2 && NAME.test(parts[1] ?? "")) return { kind: "iso", name: parts[1] ?? "" };
  if (parts[0] === "install" && parts.length === 5) {
    const [, host = "", token = "", mac = "", file = ""] = parts;
    if (NAME.test(host) && /^[0-9a-f]{16,}$/.test(token) && (INSTALL_FILES as readonly string[]).includes(file) && (MAC.test(mac.replace(/-/g, ":")) || mac === "unknown")) {
      return { kind: "install", host, token, mac: mac.replace(/-/g, ":").toLowerCase(), file: file as InstallFile };
    }
  }
  return { kind: "unknown" };
}
