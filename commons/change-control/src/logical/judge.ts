// Spec: 0002-change-control-policy FR-001, FR-002, FR-003, FR-004
/**
 * The judgement of a range of changes: the policy parsed with every reason it is refused, the `allowed_signers` text Git verifies with, and each commit accepted, refused (not signed by a signer of the fleet) or blocked (it changes a controlled path and no different signer of an approving role has approved it, by a commit that
 * says `Approves: <commit>` in a line of its own). A merge is judged by its parents. Nothing here runs Git.
 *
 * @example
 * ```ts
 * import { judgeRange } from "./judge.ts";
 * judgeRange([], { signers: [], controlled: [] }); // { accepted: [], refused: [], blocked: [], ok: true, verdicts: [] }
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { KEY_LINE, SIGNER_NAME, type Controlled, type Policy, type SignatureState, type Signer } from "@intellectual-frontiers/change-control/governance";

/** A policy from what a fleet wrote, or every reason it is refused (a signer with no name, a role or a key Git can use, one named twice, a controlled path that names an approver no signer has). */
export function parsePolicy(input: unknown): Result<Policy, readonly string[]> {
  const o = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : undefined;
  if (o === undefined) return err(["a policy is an object"]);
  const problems: string[] = [];
  const signers: Signer[] = [];
  const list = Array.isArray(o["signers"]) ? (o["signers"] as unknown[]) : [];
  if (!Array.isArray(o["signers"]) || list.length === 0) problems.push("signers: a list with at least one signer");
  list.forEach((s, i) => {
    const r = typeof s === "object" && s !== null ? (s as Record<string, unknown>) : {};
    if (typeof r["name"] !== "string" || !SIGNER_NAME.test(r["name"])) problems.push(`signers[${i}].name: lowercase letters, digits, dots and dashes`);
    if (typeof r["role"] !== "string" || !SIGNER_NAME.test(r["role"])) problems.push(`signers[${i}].role: a role name`);
    if (typeof r["key"] !== "string" || !KEY_LINE.test(r["key"].trim()) || /PRIVATE KEY/.test(r["key"])) problems.push(`signers[${i}].key: one public key line`);
    if (problems.length === 0 || (typeof r["name"] === "string" && typeof r["role"] === "string" && typeof r["key"] === "string" && SIGNER_NAME.test(r["name"]) && SIGNER_NAME.test(r["role"]) && KEY_LINE.test(r["key"].trim()))) {
      signers.push({ name: String(r["name"]), role: String(r["role"]), key: String(r["key"]).trim(), ...(typeof r["added"] === "string" ? { added: r["added"] } : {}) });
    }
  });
  const names = signers.map((s) => s.name);
  if (new Set(names).size !== names.length) problems.push("a signer is named once");
  const controlled: Controlled[] = [];
  const paths = Array.isArray(o["controlled"]) ? (o["controlled"] as unknown[]) : [];
  paths.forEach((c, i) => {
    const r = typeof c === "object" && c !== null ? (c as Record<string, unknown>) : {};
    const approvers = Array.isArray(r["approvers"]) ? (r["approvers"] as unknown[]).filter((a): a is string => typeof a === "string") : [];
    if (typeof r["path"] !== "string" || r["path"] === "" || r["path"].startsWith("/") || r["path"].includes("..")) problems.push(`controlled[${i}].path: a path of the repository, with no leading / and no ..`);
    else if (approvers.length === 0) problems.push(`controlled[${i}].approvers: at least one role`);
    else if (approvers.some((a) => !signers.some((s) => s.role === a))) problems.push(`controlled[${i}].approvers: ${approvers.filter((a) => !signers.some((s) => s.role === a)).join(", ")} is the role of no signer, so nothing could ever be approved`);
    else controlled.push({ path: r["path"], approvers });
  });
  return problems.length > 0 ? err(problems) : ok({ signers, controlled });
}

/** The text of an `allowed_signers` file that Git verifies with (`gpg.ssh.allowedSignersFile`): a line for each signer, the name as the principal, for signatures made for Git. */
export function allowedSigners(signers: readonly Signer[]): string {
  return `${signers.map((s) => `${s.name} namespaces="git" ${s.key}`).join("\n")}\n`;
}

/** Whether a path is one a pattern names (`*` any characters but `/`, `**` any characters). */
export function matches(pattern: string, path: string): boolean {
  const re = pattern.split("**").map((part) => part.split("*").map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[^/]*")).join(".*");
  return new RegExp(`^${re}$`).test(path);
}

/** A commit as read: its identity, who it says made it, what it says, the paths it changed, the state of its signature and the signer Git found (the principal of the `allowed_signers` line). */
export type Commit = { readonly sha: string; readonly author: string; readonly subject: string; readonly body: string; readonly files: readonly string[]; readonly signature: SignatureState; readonly signer: string };

/** What was found of one commit. */
export type Verdict = { readonly sha: string; readonly subject: string; readonly state: "accepted" | "refused" | "blocked"; readonly signer: string; readonly reasons: readonly string[]; readonly controlled: readonly string[]; readonly approvedBy: string | undefined };

/** What was found of a range. */
export type Judgement = { readonly verdicts: readonly Verdict[]; readonly accepted: readonly string[]; readonly refused: readonly string[]; readonly blocked: readonly string[]; readonly ok: boolean };

const SAYS: Readonly<Record<SignatureState, string>> = {
  G: "",
  N: "it is not signed",
  U: "it is signed by a key that is not a signer of the fleet",
  B: "its signature is bad",
  E: "its signature could not be checked",
  X: "its signature has expired",
  Y: "it is signed by a key that has expired",
  R: "it is signed by a key that was revoked",
};

const APPROVES = /^Approves:[ \t]+([0-9a-f]{7,40})[ \t]*$/gim;

/** Each commit of a range, oldest first, accepted, refused or blocked by the policy; a range is `ok` where every commit is accepted. An approval is a later commit of the range, signed by a signer who is not the signer of the commit approved and whose role the controlled path names. */
export function judgeRange(commits: readonly Commit[], policy: Policy): Judgement {
  const roleOf = new Map(policy.signers.map((s) => [s.name, s.role]));
  const verdicts: Verdict[] = commits.map((c, i) => {
    const reasons: string[] = [];
    if (c.signature !== "G") reasons.push(SAYS[c.signature] ?? "it is not signed");
    else if (!roleOf.has(c.signer)) reasons.push(`it is signed by ${c.signer === "" ? "a key" : c.signer}, who is not a signer of the fleet`);
    if (reasons.length > 0) return { sha: c.sha, subject: c.subject, state: "refused", signer: c.signer, reasons, controlled: [], approvedBy: undefined };
    const hits = policy.controlled.filter((rule) => c.files.some((f) => matches(rule.path, f)));
    if (hits.length === 0) return { sha: c.sha, subject: c.subject, state: "accepted", signer: c.signer, reasons: [], controlled: [], approvedBy: undefined };
    const need = [...new Set(hits.flatMap((h) => h.approvers))];
    const controlled0 = [...new Set(c.files.filter((f) => hits.some((h) => matches(h.path, f))))];
    if (need.includes(roleOf.get(c.signer) ?? "")) return { sha: c.sha, subject: c.subject, state: "accepted", signer: c.signer, reasons: [], controlled: controlled0, approvedBy: c.signer };
    const approver = commits.slice(i + 1).find((later) => later.signature === "G" && roleOf.has(later.signer) && later.signer !== c.signer && need.includes(roleOf.get(later.signer) ?? "") && [...later.body.matchAll(APPROVES)].some((m) => c.sha.startsWith(m[1] ?? "~")));
    const controlled = [...new Set(c.files.filter((f) => hits.some((h) => matches(h.path, f))))];
    if (approver !== undefined) return { sha: c.sha, subject: c.subject, state: "accepted", signer: c.signer, reasons: [], controlled, approvedBy: approver.signer };
    return { sha: c.sha, subject: c.subject, state: "blocked", signer: c.signer, reasons: [`it changes ${controlled.join(", ")}, which needs the approval of a signer of the role ${need.join(" or ")} other than ${c.signer}, by a later commit that says \`Approves: ${c.sha.slice(0, 12)}\``], controlled, approvedBy: undefined };
  });
  const of = (s: Verdict["state"]): readonly string[] => verdicts.filter((v) => v.state === s).map((v) => v.sha);
  return { verdicts, accepted: of("accepted"), refused: of("refused"), blocked: of("blocked"), ok: verdicts.every((v) => v.state === "accepted") };
}
