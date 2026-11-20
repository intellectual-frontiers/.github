// Spec: 0003-repoctl-sync FR-002
/**
 * `repoctl sync` (commons repoctl 0003-repoctl-sync FR-002 to FR-004): every generator in the order of its table, rerunning only the ones whose own check says their files are stale, and proving each rewrite by checking it again;
 * with the mode `check` nothing is written, and each generator that is stale is named with the command that fixes it. A generator's status is read as its programs end: 0 its files are what it makes, 1 they are not (or a source of
 * it is wrong, which its own lines say), anything else it could not run.
 *
 * @example
 * ```ts
 * import { classify } from "./sync.ts";
 * classify({ code: 0, stdout: "", stderr: "" }); // "fresh"
 * classify({ code: 1, stdout: "", stderr: "README.md is not what the manifests make" }); // "stale"
 * ```
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import type { Generator, GeneratorId } from "@intellectual-frontiers/repoctl/governance";
import { finding, type Finding, tailLines } from "./findings.ts";
import { fixOf } from "./order.ts";
import type { Run, World } from "./ports.ts";

/** What a generator did in a run of `sync`. */
export type Outcome =
  | { readonly kind: "fresh"; readonly id: GeneratorId }
  | { readonly kind: "regenerated"; readonly id: GeneratorId }
  | { readonly kind: "stale"; readonly id: GeneratorId; readonly fix: string; readonly detail: readonly string[] }
  | { readonly kind: "failed"; readonly id: GeneratorId; readonly fix: string; readonly detail: readonly string[] };

/** Whether `sync` writes, or only checks. */
export type Mode = "write" | "check";

/** The run of `sync`: its mode and what each generator did, in the order they ran. */
export type SyncReport = { readonly mode: Mode; readonly outcomes: readonly Outcome[] };

/** What a generator's check says of its files, from how it ended. */
export function classify(run: Run): "fresh" | "stale" | "failed" {
  return run.code === 0 ? "fresh" : run.code === 1 ? "stale" : "failed";
}

const linesOf = (run: Run): readonly string[] => tailLines(`${run.stdout}\n${run.stderr}`, 8);

/** Runs `sync` over the generators, which are given in the order to run them. `only` limits it to some of them. */
export async function runSync(w: Pick<World, "process" | "repo">, mode: Mode, order: readonly Generator[], only: readonly GeneratorId[] = []): Promise<SyncReport> {
  const outcomes: Outcome[] = [];
  for (const g of order) {
    if (only.length > 0 && !only.includes(g.id)) continue;
    const here = { cwd: w.repo };
    const checked = await w.process.run(["bun", ...g.command, "--check"], here);
    const state = classify(checked);
    const fix = fixOf(g);
    if (state === "fresh") outcomes.push({ kind: "fresh", id: g.id });
    else if (state === "failed") outcomes.push({ kind: "failed", id: g.id, fix, detail: linesOf(checked) });
    else if (mode === "check") outcomes.push({ kind: "stale", id: g.id, fix, detail: linesOf(checked) });
    else {
      const wrote = await w.process.run(["bun", ...g.command], here);
      const again = wrote.code === 0 ? await w.process.run(["bun", ...g.command, "--check"], here) : wrote;
      outcomes.push(again.code === 0 ? { kind: "regenerated", id: g.id } : { kind: "failed", id: g.id, fix, detail: linesOf(again) });
    }
  }
  return { mode, outcomes };
}

/** The findings of a run: a generator that is stale (in the mode `check`) and one that could not be made. */
export function findingsOfSync(report: SyncReport): readonly Finding[] {
  return report.outcomes.flatMap((o): readonly Finding[] => {
    switch (o.kind) {
      case "fresh":
      case "regenerated":
        return [];
      case "stale":
        return [finding("fail", "E-STALE-GENERATED", `${o.id}: its files are not what its sources make${o.detail.length > 0 ? ` (${o.detail.join("; ")})` : ""}`, o.fix)];
      case "failed":
        return [finding("fail", "E-GENERATOR-FAILED", `${o.id}: it could not be made${o.detail.length > 0 ? ` (${o.detail.join("; ")})` : ""}`, o.fix)];
      default:
        return absurd(o);
    }
  });
}
