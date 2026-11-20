// Spec: 0003-repoctl-sync FR-002
/**
 * `repoctl sync` and `repoctl merge` on Headless (commons repoctl 0003-repoctl-sync FR-002 to FR-006): the verbs that keep the generated files as their generators make them. `sync` makes them in dependency order, rerunning only the
 * stale ones; with `--check` it writes nothing and ends with 1 naming each generator that is stale and the command that fixes it, which is what CI and the hooks run; `--dry-run` says what it would make. `merge` merges a reference and
 * makes the generated files that conflict again, never by hand.
 *
 * @example
 * ```ts
 * import { syncVerb } from "@intellectual-frontiers/repoctl/physical";
 * typeof syncVerb; // "function"
 * ```
 *
 * @module
 */
import { type Generator, type GeneratorId, parseGitRef } from "@intellectual-frontiers/repoctl/governance";
import { findingsOfSync, type Finding, finding, type MergeReport, orderGenerators, runMerge, runSync, type SyncReport } from "@intellectual-frontiers/repoctl/logical";
import { value } from "@intellectual-frontiers/terminal/args";
import { type Done, defineVerb, generatorsOf, outcomeOfDone, outcomeOfEnvironment, outcomeOfUsage } from "../define.ts";

/** The ids a comma-separated list names, or the one that is not a generator. */
function idsOf(table: readonly Generator[], text: string | undefined): { readonly ids: readonly GeneratorId[] } | { readonly unknown: string } {
  if (text === undefined || text === "") return { ids: [] };
  const ids: GeneratorId[] = [];
  for (const word of text.split(",").map((w) => w.trim())) {
    const g = table.find((x) => x.id === word);
    if (g === undefined) return { unknown: word };
    ids.push(g.id);
  }
  return { ids };
}

/** The lines of a sync for a person. */
export function syncText(r: SyncReport, wouldOnly: boolean): string {
  return r.outcomes
    .map((o) => {
      switch (o.kind) {
        case "fresh":
          return `ok       ${o.id}`;
        case "regenerated":
          return `made     ${o.id}`;
        case "stale":
          return `${wouldOnly ? "would make" : "stale   "} ${o.id}  (${o.fix})`;
        case "failed":
          return `failed   ${o.id}  (${o.fix})`;
        default:
          return "";
      }
    })
    .join("\n");
}

/** The data of a sync, for `--json`. */
export function syncData(r: SyncReport): unknown {
  return { mode: r.mode, generators: r.outcomes.map((o) => ({ id: o.id, state: o.kind, ...(o.kind === "stale" || o.kind === "failed" ? { fix: o.fix } : {}) })) };
}

/** `repoctl sync`. */
export const syncVerb = defineVerb({
  name: "sync",
  id: "sync",
  options: { only: value<never>({ help: "Only these generators, as ids separated by commas (libraries, packaging, ontology, workflows, register, readme, license, installers).", valueName: "ID[,ID]" }) },
  examples: [
    { args: [], says: "Make every generated file that is stale, in dependency order." },
    { args: ["--check"], says: "Write nothing; exit 1 naming each stale generator and the command that fixes it (what CI and the hooks run)." },
    { args: ["--dry-run"], says: "Say which generators would be run." },
    { args: ["--only", "readme,license"], says: "Only the generators of the README and the licenses." },
  ],
  run: async (args, ctx, w, host) => {
    const order = orderGenerators(generatorsOf(host));
    if (order.kind === "err") return outcomeOfEnvironment(`the table of generators waits for itself: ${order.error.join(", ")}`);
    const only = idsOf(generatorsOf(host), args.options.only);
    if ("unknown" in only) return outcomeOfUsage(`${only.unknown} is not a generator`, "E-USAGE", "repoctl sync --help");
    const report = await runSync(w, ctx.mode === "apply" ? "write" : "check", order.value, only.ids);
    const findings = ctx.mode === "dry-run" ? [] : findingsOfSync(report);
    const done: Done = {
      data: syncData(report),
      text: syncText(report, ctx.mode === "dry-run"),
      findings,
      next: findings.length > 0 && ctx.mode === "check" ? ["repoctl sync"] : [],
      title: ctx.mode === "apply" ? "Generated files made" : "Generated files are current",
    };
    return outcomeOfDone(done);
  },
});

/** The findings and the lines of a merge. */
export function mergeDone(r: MergeReport, ref: string): Done {
  switch (r.kind) {
    case "refused":
      return { data: { kind: r.kind, why: r.why }, text: `the merge of ${ref} was refused: ${r.why.join("; ")}`, findings: [finding("fail", "E-MERGE-FAILED", `git did not merge ${ref}: ${r.why.join("; ")}`, "git status")] };
    case "merged": {
      const stale = findingsOfSync(r.sync);
      return { data: { kind: r.kind, sync: syncData(r.sync) }, text: `merged ${ref}`, findings: stale, next: stale.length > 0 ? ["repoctl sync"] : [], title: `Merged ${ref}` };
    }
    case "conflicts": {
      const found: Finding[] = [
        ...r.written.map((p) => finding("fail", "E-MERGE-CONFLICT", `${p} conflicts and is left as git left it: resolve it by hand`, `git add ${p}`)),
        ...r.unresolved.map((p) => finding("fail", "E-REGENERATE-FAILED", `${p} is generated and could not be made again`, "repoctl sync")),
        ...findingsOfSync(r.sync),
      ];
      const lines = [
        `merge of ${ref} conflicted`,
        ...r.regenerated.map((p) => (r.unioned.includes(p) ? `made again  ${p}  (the lines of both sides were kept and its generated part made again: read its diff)` : `made again  ${p}`)),
        ...r.unresolved.map((p) => `unresolved  ${p}`),
        ...r.written.map((p) => `conflict    ${p}  (written by a person, untouched)`),
        r.committed ? "the merge is committed" : "the merge is not committed yet",
      ];
      return {
        data: { kind: r.kind, regenerated: r.regenerated, unioned: r.unioned, unresolved: r.unresolved, written: r.written, committed: r.committed },
        text: lines.join("\n"),
        findings: found,
        next: r.written.length > 0 ? ["resolve the conflicts above, git add them, then git commit"] : r.unresolved.length > 0 ? ["repoctl sync"] : [],
        ...(r.committed ? { title: `Merged ${ref}` } : {}),
      };
    }
    default:
      return { data: null, text: "", findings: [] };
  }
}

/** `repoctl merge <ref>`. */
export const mergeVerb = defineVerb({
  name: "merge",
  id: "merge",
  options: {},
  operands: [{ name: "REF", help: "The branch, tag or commit to merge into the checkout.", arity: "one" }],
  examples: [
    { args: ["origin/main"], says: "Merge main; a generated file that conflicts is made again, never resolved by hand." },
    { args: ["some-branch"], says: "Merge a branch; a conflict in a file a person wrote is reported and left as Git left it." },
  ],
  run: async (args, _ctx, w, host) => {
    const word = args.positionals[0];
    const ref = parseGitRef(word ?? "");
    if (ref.kind === "err") return outcomeOfUsage(ref.error, "E-USAGE", "repoctl merge --help");
    const order = orderGenerators(generatorsOf(host));
    if (order.kind === "err") return outcomeOfEnvironment(`the table of generators waits for itself: ${order.error.join(", ")}`);
    return outcomeOfDone(mergeDone(await runMerge(w, ref.value, order.value), ref.value));
  },
});

