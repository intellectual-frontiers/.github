/**
 * The two policy scans that are judgements and not reads (commons 0023-if-workspaces FR-032, FR-033, 0025-ifws FR-011): the module-source rule (an `ifws-*` executable that the catalog does not
 * list and that was not registered with its hash is informational for 90 days from the day it is first seen and a warning after) and the signed-commits policy (a commit that is not signed and
 * verified is an error where the policy names a regulated domain and a warning elsewhere), each a pure function of the policy and the facts.
 *
 * @remarks
 * The facts are read by the host layer (`host/signatures.ts` runs `git log` for the signature letters; the module scan walks the `PATH`); the day is an argument and nothing here reads a clock.
 * A person approves a module on the `PATH` by adding it to the catalog within the grace days or by registering it with its hash (0025-ifws FR-011).
 *
 * @module
 */
import { absurd } from "../../kernel/absurd.ts";
import { type Finding, type Severity, unapprovedSeverity } from "../findings.ts";
import { type Policy, unsignedCommitSeverity } from "../policy.ts";
import { type ToolCatalog, providedBy } from "../tools/catalog.ts";

/** An `ifws-*` executable that was found, and how. */
export type FoundModule = {
  /** Its command name, `ifws-<name>`. */
  readonly name: string;
  /** Where it was found: registered in `modules.auto.json` (with its hash, or without), or only on the `PATH`. */
  readonly source: "registered-with-hash" | "registered" | "path";
  /** The day it was first seen, from the state record (never restarted by a later run). */
  readonly firstSeen: string;
};

/** The rule of an `ifws-*` executable outside the catalog. */
export const MODULE_RULE = "ifws/module-outside-catalog";

/** Whether a command name is the name of a module (`ifws-<something>`). */
export function isModuleName(name: string): boolean {
  return /^ifws-[a-z0-9][a-z0-9._-]*$/.test(name);
}

/**
 * The finding of each module that is outside the catalog: nothing for a module the catalog lists or that is registered with its hash; informational from the day it is first seen and a warning
 * once it is more than `graceDays` old (0023-if-workspaces FR-033).
 */
export function moduleSourceFindings(
  catalog: ToolCatalog,
  modules: readonly FoundModule[],
  today: string,
  graceDays?: number,
): readonly Finding[] {
  const out: Finding[] = [];
  for (const m of modules) {
    if (m.source === "registered-with-hash" || providedBy(catalog, m.name) !== undefined) continue;
    const severity = unapprovedSeverity(m.firstSeen, today, graceDays);
    const how = m.source === "registered" ? "registered without its hash" : "found on the PATH";
    out.push({
      ruleId: MODULE_RULE,
      severity,
      message: `${m.name} is ${how} and the tool catalog does not list it (first seen ${m.firstSeen}); add it to the catalog or register it with its SHA-256 within the grace period${severity === "Warning" ? " (the grace period is over)" : ""}`,
      subject: m.name,
      firstSeen: m.firstSeen,
    });
  }
  return out;
}

/** The signature letter Git prints for a commit (`%G?`): `G` good, `B` bad, `U` good with an unknown validity, `X` and `Y` expired signature and key, `R` revoked key, `E` cannot be checked, `N` none. */
export type SignatureLetter = "G" | "B" | "U" | "X" | "Y" | "R" | "E" | "N";

/** The letter from Git's output, or undefined where it is not one Git prints. */
export function signatureLetter(text: string): SignatureLetter | undefined {
  switch (text) {
    case "G":
    case "B":
    case "U":
    case "X":
    case "Y":
    case "R":
    case "E":
    case "N":
      return text;
    default:
      return undefined;
  }
}

/** The facts of a commit's signature. */
export type CommitSignature = { readonly repo: string; readonly commit: string; readonly letter: SignatureLetter };

/** What a signature letter says, as the reason a commit is not verified. */
export function signatureReason(letter: SignatureLetter): string {
  switch (letter) {
    case "G":
      return "signed and verified";
    case "N":
      return "it is not signed";
    case "B":
      return "its signature is bad";
    case "U":
      return "its signature is good but its key is not trusted (no allowed signer or trust says whose it is)";
    case "X":
      return "its signature has expired";
    case "Y":
      return "the key of its signature has expired";
    case "R":
      return "the key of its signature was revoked";
    case "E":
      return "its signature could not be checked (the key or the program to check it is missing)";
    default:
      return absurd(letter);
  }
}

/** Whether a commit is signed and verified (`G` alone). */
export function isVerified(letter: SignatureLetter): boolean {
  return letter === "G";
}

/** The rule of an unsigned or unverified commit. */
export const SIGNED_COMMITS_RULE = "ifws/commit-not-signed";

/**
 * The finding of each commit in a managed repository that is not signed and verified: an error where the policy names a regulated domain (which requires signed commits), a warning elsewhere
 * (0023-if-workspaces FR-032).
 */
export function signedCommitFindings(policy: Policy, commits: readonly CommitSignature[], today: string): readonly Finding[] {
  const out: Finding[] = [];
  for (const c of commits) {
    const verified = isVerified(c.letter);
    const severity: Severity | undefined = unsignedCommitSeverity(policy, verified);
    if (severity === undefined) continue;
    out.push({
      ruleId: SIGNED_COMMITS_RULE,
      severity,
      message: `commit ${c.commit.slice(0, 12)} of ${c.repo} is not signed and verified: ${signatureReason(c.letter)}; sign it (OpenPGP or SSH signing in Git) and push the signed commit`,
      subject: `${c.repo}@${c.commit.slice(0, 12)}`,
      firstSeen: today,
    });
  }
  return out;
}
