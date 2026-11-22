// Spec: 0007-repoctl-hygiene FR-007
/**
 * The identity of the merge commits of a history (commons repoctl 0007-repoctl-hygiene FR-007): a merge made by a `git pull` where no `user.name` and `user.email` were set takes the identity of the machine or the session, and the history then credits another name. The check is pure: it
 * reads the merges as data (`git log --merges` gives one line for each) and the identity and the held list of the configuration, and gives the findings; history is never rewritten, so a merge that was made wrongly is held by its hash and the held list only shrinks (a held hash that matches
 * no merge is a warning).
 *
 * @example
 * ```ts
 * import { identityFindings, parseMerges } from "./history.ts";
 * identityFindings(parseMerges(""), { name: "A B", email: "a@example.test" }, []); // []
 * ```
 *
 * @module
 */
import type { Identity } from "@intellectual-frontiers/repoctl/governance";
import { finding } from "./findings.ts";
import type { HygieneFinding } from "./hygiene.ts";

/** The `git log` arguments that give one line for each merge: the hash, the author's name and address and the committer's name and address, separated by tabs. */
export const MERGE_LOG: readonly string[] = ["log", "--merges", "--format=%H%x09%an%x09%ae%x09%cn%x09%ce"];

/** One merge commit of the history, as `git log` says it. */
export type MergeFact = { readonly hash: string; readonly author: Identity; readonly committer: Identity };

/** The merges of the output of `MERGE_LOG`; a line that is not five fields is left out. */
export function parseMerges(output: string): readonly MergeFact[] {
  const out: MergeFact[] = [];
  for (const line of output.split("\n")) {
    const f = line.split("\t");
    if (f.length !== 5 || !/^[0-9a-f]{40,64}$/.test(f[0] ?? "")) continue;
    out.push({ hash: f[0] ?? "", author: { name: f[1] ?? "", email: f[2] ?? "" }, committer: { name: f[3] ?? "", email: f[4] ?? "" } });
  }
  return out;
}

const same = (a: Identity, b: Identity): boolean => a.name === b.name && a.email.toLowerCase() === b.email.toLowerCase();
const who = (i: Identity): string => `${i.name} <${i.email}>`;

/** The findings of the merges against the identity: one for each merge not made by it and not held, and a warning for each held hash that matches no merge. */
export function identityFindings(merges: readonly MergeFact[], identity: Identity, held: readonly string[]): readonly HygieneFinding[] {
  const out: HygieneFinding[] = [];
  const fix = "git config user.name and user.email to the identity of the configuration before a pull, or merge with repoctl merge; list an old offender in commit.heldMerges";
  for (const m of merges) {
    if (same(m.author, identity) && same(m.committer, identity)) continue;
    if (held.some((h) => m.hash.startsWith(h))) continue;
    out.push({ ...finding("fail", "E-HYGIENE-IDENTITY", `the merge ${m.hash.slice(0, 12)} was authored by ${who(m.author)} and committed by ${who(m.committer)}, and the identity of the repository is ${who(identity)}`, fix), path: "history" });
  }
  for (const h of held) {
    if (merges.some((m) => m.hash.startsWith(h))) continue;
    out.push({ ...finding("warn", "E-HYGIENE-IDENTITY", `commit.heldMerges holds ${h}, which is no merge of the history: remove it`, "remove the hash from commit.heldMerges"), path: "history" });
  }
  return out;
}
