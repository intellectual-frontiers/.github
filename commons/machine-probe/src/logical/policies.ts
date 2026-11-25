// Spec: 0004-machine-probe-policies FR-001, FR-002, FR-003, FR-004
// Spec: 0008-machine-probe-agent-workspace FR-004
/**
 * The policy pack for a machine that is observed and not managed: each policy reads an observation and says pass, fail, warn or unknown, with the fix in words for the machine's operating system, and names the controls of NIST SP 800-53 Rev 5 (the public anchor, by identifier) it gives evidence for, so that no result is without a control. A policy that does not apply to what was observed gives no result.
 *
 * @example
 * ```ts
 * import { POLICIES } from "./policies.ts";
 * POLICIES.find((p) => p.id === "disk-encryption")?.controls; // ["CRY-07"]
 * ```
 *
 * @module
 */
import type { PolicyOutcome } from "@intellectual-frontiers/estate/logical";
import type { Observed } from "./observed.ts";

/** What a policy found: the finding and what was found. */
export type Verdict = { readonly status: "pass" | "fail" | "warn" | "unknown"; readonly detail: string };

/** One policy: its id, what it requires, the SP 800-53 Rev 5 controls it gives evidence for, how it judges an observation and how to make it pass on that machine. */
export type Policy = {
  readonly id: string;
  readonly title: string;
  readonly controls: readonly string[];
  /** The verdict, or nothing where the policy does not apply to what was observed. */
  readonly assert: (o: Observed, now: string) => Verdict | undefined;
  readonly fix: (o: Observed) => string;
};

const mac = (o: Observed): boolean => o.os.family === "macos";
const win = (o: Observed): boolean => o.os.family === "windows";
const onOff = (v: string, warn?: string): Verdict["status"] => (v === "on" ? "pass" : v === "off" ? "fail" : warn !== undefined && v === warn ? "warn" : "unknown");

/** Whether the version of the operating system is still supported by its maker (a starter table), or nothing where it is not known. */
export function supportedOs(o: Observed): boolean | undefined {
  const v = parseFloat(o.os.version);
  const f = o.os.family.split(" ")[0];
  if (/\(arch\)/.test(o.os.family)) return true;
  if (f === "macos") return v >= 14;
  if (f === "windows") return Number(o.os.version) >= 26100;
  if (f === "ubuntu") return ["22.04", "24.04", "26.04"].includes(o.os.version);
  if (f === "debian") return v >= 12;
  if (f === "fedora") return v >= 41;
  if (f === "arch" || o.os.version === "rolling") return true;
  return undefined;
}

const DAY_MS = 86_400_000;

/** The policy pack, in the order its results are shown. */
export const POLICIES: readonly Policy[] = [
  {
    id: "observed",
    title: "Observed in the last 7 days",
    controls: ["CM-8", "SI-4"],
    assert: (o, now) => ({ status: (Date.parse(now) - Date.parse(o.at)) / DAY_MS <= 7 ? "pass" : "fail", detail: `last observed ${o.at.slice(0, 10)}` }),
    fix: () => "observe the machine again",
  },
  {
    id: "disk-encryption",
    title: "The disk is encrypted",
    controls: ["SC-28"],
    assert: (o) => ({ status: onOff(o.security.diskEncryption), detail: `disk encryption: ${o.security.diskEncryption}` }),
    fix: (o) =>
      win(o)
        ? "Settings > Privacy & security > Device encryption (or BitLocker: Control Panel > BitLocker Drive Encryption > Turn on)"
        : mac(o)
          ? "System Settings > Privacy & Security > FileVault > Turn On"
          : "Linux encrypts at installation (LUKS): reinstall with encryption, or record why this machine holds nothing sensitive",
  },
  {
    id: "firewall",
    title: "The firewall is on",
    controls: ["SC-7"],
    assert: (o) => ({ status: onOff(o.security.firewall), detail: `firewall: ${o.security.firewall}` }),
    fix: (o) =>
      win(o)
        ? "Windows Security > Firewall & network protection: turn on every network"
        : mac(o)
          ? "System Settings > Network > Firewall > On"
          : o.os.family.includes("arch")
            ? "sudo pacman -S ufw && sudo systemctl enable --now ufw && sudo ufw enable"
            : "sudo ufw enable (Ubuntu, Debian) or sudo systemctl enable --now firewalld (Fedora)",
  },
  {
    id: "auto-updates",
    title: "Security updates install by themselves",
    controls: ["SI-2"],
    assert: (o) => ({ status: onOff(o.security.autoUpdates, "manual"), detail: `automatic updates: ${o.security.autoUpdates}${o.software.pendingUpdates !== undefined ? `; ${o.software.pendingUpdates} waiting` : ""}` }),
    fix: (o) =>
      win(o)
        ? "Settings > Windows Update (and remove the policy that turns automatic updates off)"
        : mac(o)
          ? "System Settings > General > Software Update > Automatic Updates: all on"
          : o.security.autoUpdates === "manual"
            ? "a rolling distribution updates by hand: update it at least weekly"
            : "sudo apt install unattended-upgrades && sudo dpkg-reconfigure -plow unattended-upgrades",
  },
  {
    id: "updates-waiting",
    title: "Few updates waiting",
    controls: ["SI-2"],
    assert: (o) => (o.software.pendingUpdates === undefined ? undefined : { status: o.software.pendingUpdates <= 20 ? "pass" : "warn", detail: `${o.software.pendingUpdates} updates waiting` }),
    fix: (o) => (mac(o) ? "System Settings > General > Software Update" : "install them with the system's updater"),
  },
  {
    id: "supported-os",
    title: "The operating system is still supported",
    controls: ["SA-22"],
    assert: (o) => {
      const s = supportedOs(o);
      return { status: s === true ? "pass" : s === false ? "fail" : "unknown", detail: `${o.os.name} ${o.os.version}`.trim() };
    },
    fix: () => "upgrade to a supported release",
  },
  {
    id: "ssh-keys-only",
    title: "SSH accepts keys, not passwords",
    controls: ["IA-2", "IA-5"],
    assert: (o) => (o.security.sshPasswordAuth === undefined ? undefined : { status: o.security.sshPasswordAuth === "no" ? "pass" : "warn", detail: `PasswordAuthentication ${o.security.sshPasswordAuth}` }),
    fix: () => "PasswordAuthentication no in /etc/ssh/sshd_config, then restart sshd",
  },
  {
    id: "antivirus",
    title: "Anti-malware protection is on",
    controls: ["SI-3"],
    assert: (o) => (o.security.antivirus === undefined ? undefined : { status: onOff(o.security.antivirus), detail: `real-time protection: ${o.security.antivirus}` }),
    fix: () => "Windows Security > Virus & threat protection > Real-time protection: on",
  },
  {
    id: "few-admins",
    title: "At most three administrators",
    controls: ["AC-6"],
    assert: (o) => ({
      status: o.security.admins.length === 0 ? "unknown" : o.security.admins.length <= 3 ? "pass" : "warn",
      detail: o.security.admins.length > 0 ? `administrators: ${o.security.admins.join(", ")}` : "administrators: unknown",
    }),
    fix: () => "remove administrator rights from accounts that do not need them",
  },
  {
    id: "osquery",
    title: "osquery is installed (fleet-wide SQL questions)",
    controls: ["SI-4"],
    assert: (o) => ({ status: o.software.osquery ? "pass" : "warn", detail: o.software.osquery ? `osquery ${o.software.osquery}` : "osquery is not installed" }),
    fix: (o) => (win(o) ? "install osquery's MSI" : mac(o) ? "brew install --cask osquery" : "install osquery from osquery.io's apt or yum repository"),
  },
];

/** A policy's result for one observation, with how to make it pass. */
export type PolicyResult = PolicyOutcome & { readonly title: string; readonly detail: string; readonly fix: string };

/** Every policy that applies to an observation, in order, with its verdict, the controls it gives evidence for and how to make it pass; the instant now says how old the observation may be. */
export function evaluate(o: Observed, now: string): readonly PolicyResult[] {
  const out: PolicyResult[] = [];
  for (const p of POLICIES) {
    const v = p.assert(o, now);
    if (v !== undefined) out.push({ id: p.id, title: p.title, status: v.status, controls: p.controls, detail: v.detail, fix: p.fix(o) });
  }
  return out;
}
