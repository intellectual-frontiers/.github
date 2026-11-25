// Spec: 0006-workload-split FR-004
/**
 * The verb runner: it calls a verb by its registered id, with inputs decoded against the verb's declared inputs, and it refuses an id that is not registered, an effect above the verb's and an id the host has no binding
 * for. It takes no shell string and runs none: the binding of the host is called with the typed values and nothing else.
 *
 * @example
 * ```ts
 * import { runVerb } from "./verb-runner.ts";
 * // await runVerb(registry, bindings, "store.checkpoint", { store: "synthetic-db-01" }, effect)
 * ```
 *
 * @module
 */
import { err, type Result } from "@intellectual-frontiers/core";
import { type Effect, type Finding, finding, type Inputs, modeRank, type VerbRegistry } from "@intellectual-frontiers/workload/governance";
import { inputProblems } from "@intellectual-frontiers/workload/logical";
import type { ResolvedInputs, VerbBindings, VerbOutcome } from "./ports.ts";

/** Why a verb was not run: a finding of the catalog, or what the verb itself reported. */
export type VerbFailure = { readonly kind: "refused"; readonly finding: Finding } | { readonly kind: "failed"; readonly reason: string };

/** Runs the verb `id` with the typed inputs, once the id, the inputs and the effect are held to the registry. */
export async function runVerb(registry: VerbRegistry, bindings: VerbBindings, id: string, declared: Inputs, resolved: ResolvedInputs, effect: Effect): Promise<Result<VerbOutcome, VerbFailure>> {
  const verb = registry.get(id);
  if (verb === undefined) return err({ kind: "refused", finding: finding("E-WL-VERB-UNKNOWN", "", `${id} is not registered`, { verb: id }) });
  if (!verb.classes.includes(effect.class) || modeRank(effect.mode) > modeRank(verb.maxMode)) return err({ kind: "refused", finding: finding("E-WL-EFFECT-EXCEEDS-VERB", "", `the effect declared for ${id} is more than it is registered with`, { verb: id }) });
  const bad = inputProblems(verb, declared);
  if (bad.length > 0) return err({ kind: "refused", finding: finding("E-WL-VERB-INPUTS-INVALID", "", `${id}: ${bad.join("; ")}`, { verb: id }) });
  const binding = bindings.get(id);
  if (binding === undefined) return err({ kind: "failed", reason: `the host has no binding for ${id}` });
  const r = await binding(resolved);
  return r.kind === "ok" ? r : err({ kind: "failed", reason: r.error });
}
