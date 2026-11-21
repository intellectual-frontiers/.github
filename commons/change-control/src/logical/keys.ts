// Spec: 0004-change-control-keys FR-001, FR-002, FR-003
/**
 * Custody of the keys that sign a fleet's changes: what is known of this machine's keys and Git (facts), the checks made from them with a stable code and the one fix each, whether the recovery key was proved lately, and the text of the file that lists the signers. Nothing here reads a key or runs a program: the facts are given,
 * and a passphrase is never seen (it is typed into OpenSSH and Git only).
 *
 * @example
 * ```ts
 * import { recoveryOverdue } from "./keys.ts";
 * recoveryOverdue("2026-01-01", "2026-12-01"); // true
 * ```
 *
 * @module
 */
import type { Signer } from "@intellectual-frontiers/change-control/governance";

/** What is known of the machine: OpenSSH, the daily key, Git's settings for the repository, the signers and the recovery key. */
export type Facts = {
  /** The version of OpenSSH, like `9.6`, or nothing where it is not there. */
  readonly openssh: string | undefined;
  readonly daily: { readonly exists: boolean; readonly hasPassphrase: boolean; readonly inAgent: boolean };
  readonly git: { readonly signs: boolean; readonly formatSsh: boolean; readonly signingKeyIsDaily: boolean; readonly identity: boolean };
  readonly signers: { readonly dailyListed: boolean; readonly recoveryListed: boolean };
  /** The recovery key: its private file is on this machine (it should not be), and the day it was last proved (a day, `YYYY-MM-DD`). */
  readonly recovery: { readonly privateHere: boolean; readonly checkedAt: string | undefined };
  readonly hookInstalled: boolean;
};

/** One check: whether it holds, its code, what is wrong, and the one thing to do. */
export type Finding = { readonly code: string; readonly ok: boolean; readonly says: string; readonly fix: string };

/** The days after which the recovery key is to be proved again. */
export const RECOVERY_DAYS = 183;

/** Whether the recovery key was never proved or was proved more than `days` days before `now` (both days, `YYYY-MM-DD`, or instants). */
export function recoveryOverdue(checkedAt: string | undefined, now: string, days: number = RECOVERY_DAYS): boolean {
  if (checkedAt === undefined) return true;
  const a = Date.parse(checkedAt);
  const b = Date.parse(now);
  return Number.isNaN(a) || Number.isNaN(b) || (b - a) / 86_400_000 > days;
}

/** The version of OpenSSH from the first line `ssh -V` prints (`OpenSSH_9.6p1 ...`), or nothing. */
export function opensshVersion(text: string): string | undefined {
  const m = /OpenSSH_(\d+\.\d+)/.exec(text);
  return m?.[1];
}

/** Whether a version of OpenSSH can sign for Git (8.2 and after). */
export const opensshSigns = (version: string | undefined): boolean => {
  if (version === undefined) return false;
  const [major = 0, minor = 0] = version.split(".").map(Number);
  return major > 8 || (major === 8 && minor >= 2);
};

/** Every check, in order, each with its code and its one fix. Signing works where the first six hold (OpenSSH, the daily key and its passphrase, Git signing with it, the identity, the daily key listed). */
export function checkKeys(f: Facts, now: string): readonly Finding[] {
  const c = (code: string, ok: boolean, says: string, fix: string): Finding => ({ code, ok, says, fix });
  return [
    c("E-KEY-SSH", opensshSigns(f.openssh), f.openssh === undefined ? "OpenSSH is not here" : `OpenSSH ${f.openssh} cannot sign for Git (8.2 or later can)`, "install OpenSSH 8.2 or later"),
    c("E-KEY-DAILY", f.daily.exists, "the daily signing key does not exist", "opsfolio keys setup"),
    c("E-KEY-PASSPHRASE", !f.daily.exists || f.daily.hasPassphrase, "the daily key has no passphrase", "opsfolio keys rotate (a new key with a passphrase)"),
    c("E-KEY-AGENT", !f.daily.inAgent, "the daily key is loaded in an ssh-agent, where anything running as you can sign with it", "ssh-add -d <the key>, and keep it out of the agent"),
    c("E-KEY-GIT", f.git.signs && f.git.formatSsh && f.git.signingKeyIsDaily, "Git does not sign every commit of this repository with the daily key", "opsfolio keys setup"),
    c("E-KEY-IDENTITY", f.git.identity, "Git has no name and email for this repository, so it cannot make a commit", "git config user.name and user.email for this repository"),
    c("E-KEY-LISTED", f.signers.dailyListed, "the daily key is not in signers.ts, so the fleet will not accept what it signs", "opsfolio keys setup"),
    c("E-KEY-RECOVERY-LISTED", f.signers.recoveryListed, "no recovery key is in signers.ts: a lost daily key could not be replaced", "opsfolio keys setup --recovery-dir <a folder you will keep off this machine>"),
    c("E-KEY-RECOVERY-HERE", !f.recovery.privateHere, "the private file of the recovery key is on this machine, so it protects nothing a stolen laptop does not", "move it to a place that is not this machine"),
    c("E-KEY-RECOVERY-OLD", !recoveryOverdue(f.recovery.checkedAt, now), f.recovery.checkedAt === undefined ? "the recovery key was never proved to work" : `the recovery key was last proved on ${f.recovery.checkedAt}, more than ${RECOVERY_DAYS} days ago`, "opsfolio keys check-recovery --key <the recovery key file>"),
    c("E-KEY-HOOK", f.hookInstalled, "the pre-push check is not installed, so an unsigned commit can be pushed", "opsfolio keys setup"),
  ];
}

/** Whether signing works: the checks that stop a commit being made and accepted all hold. */
export function signingWorks(findings: readonly Finding[]): boolean {
  return ["E-KEY-SSH", "E-KEY-DAILY", "E-KEY-GIT", "E-KEY-IDENTITY", "E-KEY-LISTED"].every((code) => findings.find((x) => x.code === code)?.ok === true);
}

/** The text of the file that lists a fleet's signers, as a tenant keeps it (`signers.ts`): a header, and the signers by name, role and public key. */
export function renderSigners(signers: readonly Signer[], header = "Who may approve this fleet's changes, by public key. Written by `opsfolio keys`; every change to it is a controlled change."): string {
  const body = signers.map((s) => `  {\n    "name": ${JSON.stringify(s.name)},\n    "role": ${JSON.stringify(s.role)},\n    "key": ${JSON.stringify(s.key)},\n    "added": ${JSON.stringify(s.added ?? "")}\n  }`).join(",\n");
  return `// ${header}\nexport const signers = [\n${body}\n] as const;\n`;
}

/** The signers with the key of one replaced (the name and the role kept), or nothing where there is no such signer. */
export function replaceKey(signers: readonly Signer[], name: string, key: string, added: string): readonly Signer[] | undefined {
  if (!signers.some((s) => s.name === name)) return undefined;
  return signers.map((s) => (s.name === name ? { ...s, key, added } : s));
}

/** The signers with one added, or the same where the key is already listed; a name is used once. */
export function withSigner(signers: readonly Signer[], signer: Signer): readonly Signer[] | string {
  if (signers.some((s) => s.key.split(" ").slice(0, 2).join(" ") === signer.key.split(" ").slice(0, 2).join(" "))) return signers;
  if (signers.some((s) => s.name === signer.name)) return `a signer is already named ${signer.name}`;
  return [...signers, signer];
}

/** The two key lines are the same key (the type and the key, not the comment). */
export const sameKey = (a: string, b: string): boolean => a.trim().split(" ").slice(0, 2).join(" ") === b.trim().split(" ").slice(0, 2).join(" ");
