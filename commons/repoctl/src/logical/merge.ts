// Spec: 0003-repoctl-sync FR-005
/**
 * `repoctl merge <ref>` (commons repoctl 0003-repoctl-sync FR-005, FR-006): Git merges the reference; where files conflict, the ones a generator writes are never resolved by hand but made again by their generators (taking one side
 * to clear the markers, running `sync`, and staging what is then as its generator makes it), and the ones a person wrote are left exactly as Git left them and named. The merge is completed only where nothing conflicts any more.
 *
 * @example
 * ```ts
 * import { partitionConflicts } from "./merge.ts";
 * partitionConflicts([], ["README.md"]); // { generated: [], written: ["README.md"] }
 * ```
 *
 * @module
 */
import type { Generator, GitRef } from "@intellectual-frontiers/repoctl/governance";
import { identityArgs, type Identity } from "@intellectual-frontiers/repoctl/governance";
import { matches } from "./glob.ts";
import { generatorOf } from "./order.ts";
import type { World } from "./ports.ts";
import { runSync, type SyncReport } from "./sync.ts";
import { tailLines } from "./findings.ts";

/** What a merge came to. */
export type MergeReport =
  | { readonly kind: "refused"; readonly why: readonly string[] }
  | { readonly kind: "merged"; readonly sync: SyncReport }
  | {
      readonly kind: "conflicts";
      /** The generated files that conflicted and were made again and staged. */
      readonly regenerated: readonly string[];
      /** Of those, the ones that also hold what a person wrote: the lines of both sides were kept and the generated part was made again, so that nothing a side wrote is lost. */
      readonly unioned: readonly string[];
      /** The generated files that conflicted and could not be made again: they stay conflicted. */
      readonly unresolved: readonly string[];
      /** The files a person wrote that conflict, untouched. */
      readonly written: readonly string[];
      /** Whether the merge was completed with a commit. */
      readonly committed: boolean;
      readonly sync: SyncReport;
    };

/** The conflicted paths split into the ones a generator writes and the ones a person wrote. */
export function partitionConflicts(table: readonly Generator[], paths: readonly string[]): { readonly generated: readonly string[]; readonly written: readonly string[] } {
  return {
    generated: paths.filter((p) => generatorOf(table, p) !== undefined),
    written: paths.filter((p) => generatorOf(table, p) === undefined),
  };
}

/** Whether a conflicted generated file also holds text a person wrote. */
export function isMixed(table: readonly Generator[], path: string): boolean {
  return (generatorOf(table, path)?.mixed ?? []).some((glob) => matches(glob, path));
}

const lines = (text: string): readonly string[] =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "");

/** Makes a conflicted file hold the lines of both sides where they conflict (`git merge-file --union` of the three versions Git kept of it, the merged reference's lines first, since what it holds is what the other branches have already seen), and writes it; whether it could. */
async function union(w: Pick<World, "files" | "process" | "repo">, path: string): Promise<boolean> {
  const here = { cwd: w.repo };
  const dir = await w.files.makeTemp("repoctl-merge-");
  try {
    const names = ["base", "ours", "theirs"] as const;
    for (const [i, name] of names.entries()) {
      const shown = await w.process.run(["git", "show", `:${i + 1}:${path}`], here);
      await w.files.write(`${dir}/${name}`, shown.code === 0 ? shown.stdout : "");
    }
    const merged = await w.process.run(["git", "merge-file", "-p", "--union", `${dir}/theirs`, `${dir}/base`, `${dir}/ours`], here);
    if (merged.code !== 0) return false;
    await w.files.write(`${w.repo}/${path}`, merged.stdout);
    return true;
  } finally {
    await w.files.removeTree(dir);
  }
}

/** Merges `ref` into the checkout, in the order the generators are given. */
export async function runMerge(w: Pick<World, "files" | "process" | "repo">, ref: GitRef, order: readonly Generator[], identity: Identity): Promise<MergeReport> {
  const here = { cwd: w.repo };
  const git = (...args: readonly string[]) => w.process.run(["git", ...identityArgs(identity), ...args], here);
  const merged = await git("merge", "--no-edit", ref);
  if (merged.code === 0) return { kind: "merged", sync: await runSync(w, "check", order) };
  const unmerged = lines((await git("diff", "--name-only", "--diff-filter=U")).stdout);
  if (unmerged.length === 0) return { kind: "refused", why: tailLines(`${merged.stdout}\n${merged.stderr}`, 6) };
  const { generated, written } = partitionConflicts(order, unmerged);
  const cleared: string[] = [];
  const stuck: string[] = [];
  const unioned: string[] = [];
  for (const path of generated) {
    // a file that is only generated takes one side to clear the markers (its generator writes all of it); a file that holds written text too keeps the lines of both sides (the generator leaves them as they are)
    const mixed = isMixed(order, path);
    const taken = mixed ? await union(w, path) : (await git("checkout", "--ours", "--", path)).code === 0;
    if (taken && mixed) unioned.push(path);
    (taken ? cleared : stuck).push(path);
  }
  const sync = await runSync(w, "write", order);
  const fresh = new Set(sync.outcomes.filter((o) => o.kind === "fresh" || o.kind === "regenerated").map((o) => o.id));
  const regenerated: string[] = [];
  const unresolved: string[] = [...stuck];
  for (const path of cleared) {
    const g = generatorOf(order, path);
    if (g !== undefined && fresh.has(g.id)) {
      const added = await git("add", "--", path);
      (added.code === 0 ? regenerated : unresolved).push(path);
    } else unresolved.push(path);
  }
  // the generated files that merged cleanly and that `sync` made again are staged with the merge, so that no regenerated file is left out of it
  const changed = [...lines((await git("diff", "--name-only")).stdout), ...lines((await git("ls-files", "--others", "--exclude-standard")).stdout)];
  for (const path of changed) if (!written.includes(path) && !unresolved.includes(path) && generatorOf(order, path) !== undefined) await git("add", "--", path);
  const committed = written.length === 0 && unresolved.length === 0 ? (await git("commit", "--no-edit")).code === 0 : false;
  return { kind: "conflicts", regenerated, unioned: unioned.filter((p) => regenerated.includes(p)), unresolved, written, committed, sync };
}
