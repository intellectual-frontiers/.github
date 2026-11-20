// Spec: 0005-grc-runners FR-009
/**
 * The `external` runner (0005-grc-runners FR-009): the input is `{ evaluator, policy, data? }` and the question is delegated to an evaluator found by id in a registry of evaluators. GRC ships none:
 * a policy language's engine is an optional adapter that a third party registers, so that the core depends on no such engine.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type Check, createRegistry, type Json, objectOf, type Registry } from "@intellectual-frontiers/grc/governance";
import type { Observation, RunContext, Runner, RunnerProblem } from "@intellectual-frontiers/grc/physical";

/** An evaluator: its id names it in a check's input. */
export type Evaluator = { readonly id: string; evaluate(policy: Json, data: Json): Promise<Result<Json, string>> };

/** A registry of evaluators. */
export type Evaluators = Registry<Evaluator>;

/** A registry of evaluators, empty. */
export function createEvaluators(): Evaluators {
  return createRegistry<Evaluator>("evaluator");
}

/** The `external` runner over a registry of evaluators. */
export function externalRunner(evaluators: Evaluators): Runner {
  return {
    id: "external",
    async run(check: Check, ctx: RunContext): Promise<Result<Observation, RunnerProblem>> {
      const i = objectOf(check.runner.input);
      if (i === undefined || typeof i["evaluator"] !== "string" || i["policy"] === undefined) {
        return err({ kind: "refused", message: "the input of an external check is { evaluator, policy, data? }" });
      }
      const e = evaluators.get(i["evaluator"]);
      if (e === undefined) return err({ kind: "unavailable", message: `no evaluator ${i["evaluator"]} is registered: ${evaluators.list().map((x) => x.id).join(", ") || "none"}` });
      const t0 = Date.now();
      const r = await e.evaluate(i["policy"], i["data"] ?? null);
      if (r.kind === "err") return err({ kind: "failed", message: r.error });
      return ok({ value: r.value, observedAt: ctx.now(), via: `external ${e.id}`, tookMs: Date.now() - t0 });
    },
  };
}
