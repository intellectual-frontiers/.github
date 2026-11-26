// Spec: 0004-scripts FR-008
/**
 * The pinned install artifacts: osquery 5.24.1 from its official release on github.com/osquery/osquery, downloaded and hashed on 2026-11-26 (the SHA-256 is of the bytes the release serves). Windows on ARM and any platform not listed
 * here has no pin and is left out of the catalog rather than guessed (0004-scripts FR-008, UNVERIFIED items). The default plan is made from this catalog.
 *
 * @module
 */
import type { Facts, InstallPlan, InstallPackageStep } from "@intellectual-frontiers/ssh-server/governance";

/** One pinned artifact: the step that installs it, and the architecture it is for. */
export type Pin = { readonly arch: "amd64" | "arm64" | "any"; readonly step: InstallPackageStep };

const RELEASE = "https://github.com/osquery/osquery/releases/download/5.24.1";

function osquery(arch: Pin["arch"], osFamily: InstallPackageStep["osFamily"], installer: InstallPackageStep["installer"], file: string, sha256: string): Pin {
  return { arch, step: { kind: "install-package", osFamily, name: "osquery", version: "5.24.1", url: `${RELEASE}/${file}`, sha256, installer } };
}

/** The catalog of pins. */
export const OSQUERY_PINS: readonly Pin[] = [
  osquery("amd64", "linux", "deb", "osquery_5.24.1-1.linux_amd64.deb", "c6a37aec1156712cce0fafeb01a3697a2b73a1863a2b39fc3473b07600aea68d"),
  osquery("arm64", "linux", "deb", "osquery_5.24.1-1.linux_arm64.deb", "6a14f55b8be802e1e9b10108295ce7df82437e02161f28030ce71711fbf27a64"),
  osquery("amd64", "linux", "rpm", "osquery-5.24.1-1.linux.x86_64.rpm", "e0ba6a45327a5abdfa42b4ae9f37637af5c4006d588061940668358f80d59244"),
  osquery("arm64", "linux", "rpm", "osquery-5.24.1-1.linux.aarch64.rpm", "e6cb11f99fde4329edfaf0000aa57997fe52365251848f9f47780e4446b8eea9"),
  osquery("amd64", "windows", "msi", "osquery-5.24.1.msi", "36cc35dea559270c48040d894adde22785150bd2fcfe8f2489b86ead4688b004"),
  osquery("any", "macos", "pkg", "osquery-5.24.1.pkg", "950cc119f68c4d292f3e9407171205633e7174e13fc14ab593f48c75d907bd4f"),
];

/** The architecture a fact says, as the pins name it. */
export function archOf(arch: string): "amd64" | "arm64" | undefined {
  const a = arch.toLowerCase();
  if (a === "x86_64" || a === "amd64" || a === "x64") return "amd64";
  if (a === "aarch64" || a === "arm64") return "arm64";
  return undefined;
}

/** The installer a device takes, from its package manager and family. */
export function installerOf(facts: Facts): InstallPackageStep["installer"] | undefined {
  if (facts.os.family === "windows") return "msi";
  if (facts.os.family === "macos") return "pkg";
  if (facts.packageManager === "apt") return "deb";
  if (facts.packageManager === "dnf" || facts.packageManager === "yum" || facts.packageManager === "zypper") return "rpm";
  return undefined;
}

/** The default plan for a device: osquery from the catalog where a pin fits its family, installer and architecture, and an empty plan where none does. */
export function defaultPlan(facts: Facts, catalog: readonly Pin[] = OSQUERY_PINS): InstallPlan {
  const installer = installerOf(facts);
  const arch = archOf(facts.os.arch);
  const pin = catalog.find((p) => p.step.installer === installer && (p.arch === "any" || p.arch === arch));
  return { steps: pin === undefined ? [] : [pin.step] };
}

/** The names and versions of the packages that may be installed on a family, for the script to say before it asks. */
export function offered(catalog: readonly Pin[], osFamily: InstallPackageStep["osFamily"]): readonly string[] {
  return [...new Set(catalog.filter((p) => p.step.osFamily === osFamily).map((p) => `${p.step.name} ${p.step.version}`))];
}
