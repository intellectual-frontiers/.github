// Spec: 0003-repoctl-sync FR-002
/**
 * How a step of a configuration is run (commons repoctl 0003-repoctl-sync FR-002; 0009-repoctl-config FR-003): a program goes through the port that runs programs, from the repository's root; a typed function is called with the root. A function that throws is
 * a run that could not be made (status 2 with the message), never a throw of the verb.
 *
 * @example
 * ```ts
 * import { runStep } from "./step.ts";
 * const world = { repo: "/r", process: { run: () => Promise.resolve({ code: 0, stdout: "", stderr: "" }) } };
 * const r = await runStep(world, { kind: "function", label: "f", call: () => Promise.resolve({ code: 1, stdout: "", stderr: "x" }) });
 * r.code; // 1
 * ```
 *
 * @module
 */
import type { Step } from "@intellectual-frontiers/repoctl/governance";
import type { Run, World } from "./ports.ts";

/** Runs a step in the world: the program from the repository's root, or the function with it. */
export async function runStep(w: Pick<World, "process" | "repo">, step: Step): Promise<Run> {
  if (step.kind === "program") return await w.process.run(step.argv, { cwd: w.repo });
  try {
    return await step.call({ repo: w.repo });
  } catch (e) {
    return { code: 2, stdout: "", stderr: `${step.label} threw: ${e instanceof Error ? e.message : String(e)}` };
  }
}
