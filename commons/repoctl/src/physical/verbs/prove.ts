// Spec: 0007-repoctl-prove FR-001
/**
 * `repoctl prove` on Headless (commons repoctl 0007-repoctl-prove FR-001, FR-009): the proof a change needs, from its blast radius. It prints the plan (`--plan` as one JSON document, `--why` with the sentence for every proof and every
 * proof left out) and runs the proofs of the tiers T0 to T3 that apply (`--tier N` one tier, `--all` every proof of every tier planned and the cheap ones run), each proof as one program in its folder, the tiers in order and the proofs of a
 * tier several at a time.
 *
 * @example
 * ```ts
 * import { proveVerb } from "@intellectual-frontiers/repoctl/physical";
 * typeof proveVerb; // "function"
 * ```
 *
 * @module
 */
import { parseProofTier, PROOF_TIER_IDS, PROOF_TIERS, proofKey, type ProofTier } from "@intellectual-frontiers/repoctl/governance";
import { finding, type Finding, pool, proofLabel, skipSentence, whySentence, type PlannedProof, type ProofPlan } from "@intellectual-frontiers/repoctl/logical";
import { flag, value } from "@intellectual-frontiers/terminal/args";
import { defineVerb, outcomeOfDone, outcomeOfEnvironment, outcomeOfUsage } from "../define.ts";
import { commandOf, DEFAULT_BASE, LOCAL_TIERS, makePlan, type ProofOutcome, runProof } from "../prove.ts";

const seconds = (n: number): string => `${n.toFixed(1)}s`;

/** The lines of a plan for a person: the classes, then each tier with its proofs (and, with `why`, the sentence for each), then what was left out. */
export function proofPlanText(plan: ProofPlan, why: boolean): string {
  const lines: string[] = [`${plan.files.length} changed ${plan.files.length === 1 ? "file" : "files"} since ${plan.base}; classes: ${plan.classes.join(", ") || "none"}`];
  for (const t of PROOF_TIER_IDS) {
    const here = plan.proofs.filter((p) => p.tier === t);
    if (here.length === 0) continue;
    lines.push(`${t} ${PROOF_TIERS[t].name} (budget ${PROOF_TIERS[t].budgetSeconds}s)`);
    for (const p of here) lines.push(`  run   ${proofLabel(p.proof)}${why ? `\n          ${whySentence(p.why)}` : ""}`);
  }
  const shown = why ? plan.skipped : plan.skipped.filter((s) => s.reason !== "tier-scheduled");
  const wide = plan.skipped.length - shown.length;
  for (const s of shown) lines.push(`  skip  ${s.tier} ${why ? skipSentence(s) : s.subject} (${s.reason})`);
  if (wide > 0) lines.push(`  skip  ${wide} proofs that run on main, nightly or at the release (--why lists them)`);
  lines.push(`${plan.libraries.proven.length} of ${plan.libraries.total} libraries are proved`);
  return lines.join("\n");
}

/** `repoctl prove`. */
export const proveVerb = defineVerb({
  name: "prove",
  id: "prove",
  options: {
    base: value<never>({ help: "The revision the change starts at (origin/main, else main, else HEAD).", valueName: "REF" }),
    plan: flag<never>({ help: "Print the plan as one JSON document and run nothing." }),
    why: flag<never>({ help: "Say, for every proof and every proof left out, why." }),
    tier: value<never>({ help: "Run only this tier (0 to 6 or T0 to T6).", valueName: "N" }),
    all: flag<never>({ help: "Plan every proof of every tier, whatever changed." }),
  },
  examples: [
    { args: [], says: "Prove what the working tree changes since origin/main: the tiers T0 to T3 that apply, and only those." },
    { args: ["--why"], says: "The same, with the sentence that says why each proof runs and why each skipped proof is safe to skip." },
    { args: ["--plan"], says: "The plan as JSON, run nothing: what CI and the development loop read." },
    { args: ["--tier", "0"], says: "Only the static proofs of the plan." },
    { args: ["--all", "--plan"], says: "Every proof of every tier, as the nightly run and the release plan it." },
  ],
  run: async (args, _ctx, w) => {
    const tierText = args.options.tier;
    let only: ProofTier | undefined;
    if (tierText !== undefined) {
      const t = parseProofTier(tierText);
      if (t.kind === "err") return outcomeOfUsage(t.error, "E-USAGE", "repoctl prove --help");
      only = t.value;
    }
    let base = args.options.base;
    if (base === undefined) {
      base = "HEAD";
      for (const ref of [DEFAULT_BASE, "main"]) {
        if ((await w.process.run(["git", "-C", w.repo, "rev-parse", "--verify", "--quiet", ref])).code === 0) {
          base = ref;
          break;
        }
      }
    }
    const made = await makePlan(w, base, args.options.all);
    if (made.kind === "err") return outcomeOfEnvironment(made.error);
    const { plan } = made.value;
    if (args.options.plan) return outcomeOfDone({ data: plan, text: JSON.stringify(plan, null, 2), findings: [] });
    const header = proofPlanText(plan, args.options.why);
    const tiers = only === undefined ? LOCAL_TIERS : [only];
    const todo: PlannedProof[] = plan.proofs.filter((p) => tiers.includes(p.tier));
    const results: { readonly proof: PlannedProof; readonly outcome: ProofOutcome }[] = [];
    const ran = new Set<string>();
    for (const tier of tiers) {
      const here = todo.filter((p) => p.tier === tier).filter((p) => {
        const c = commandOf(w.repo, p.proof, base);
        const key = c === undefined ? proofKey(p.proof) : `${c.cwd}\u0000${c.argv.join(" ")}`;
        if (ran.has(key)) return false;
        ran.add(key);
        return true;
      });
      const width = Math.max(2, Math.min(8, globalThis.navigator?.hardwareConcurrency ?? 4));
      const done = await pool(here, width, async (p) => ({ proof: p, outcome: await runProof(w, p.proof, base) }));
      results.push(...done);
    }
    const lines = results.map(({ proof, outcome }) => {
      switch (outcome.kind) {
        case "passed":
          return `  ${proof.tier} passed  ${proofLabel(proof.proof)} (${seconds(outcome.seconds)})`;
        case "failed":
          return `  ${proof.tier} FAILED  ${proofLabel(proof.proof)} (${seconds(outcome.seconds)})\n${outcome.output.map((l) => `      ${l}`).join("\n")}`;
        case "not-here":
          return `  ${proof.tier} not run ${proofLabel(proof.proof)}: ${outcome.why}`;
      }
    });
    const findings: readonly Finding[] = results.flatMap(({ proof, outcome }) =>
      outcome.kind === "failed" ? [finding("fail", "E-PROVE-FAILED", `${proofLabel(proof.proof)} failed: ${outcome.output.at(-1) ?? "no output"}`, "repoctl prove --why")] : [],
    );
    const total = results.reduce((n, r) => n + (r.outcome.kind === "not-here" ? 0 : r.outcome.seconds), 0);
    return outcomeOfDone({
      data: { plan, results: results.map((r) => ({ proof: r.proof.proof, tier: r.proof.tier, outcome: r.outcome })) },
      text: [header, "", ...lines, `proofs took ${seconds(total)} of process time`].join("\n"),
      findings,
      title: "Every proof of the plan passes",
    });
  },
});
