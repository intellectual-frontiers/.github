// Spec: 0006-workload-split FR-005
/**
 * The agent runner: it passes a `judge` node to the agent port with the type of the answer, decodes what comes back into that type and refuses what does not decode. The agent port is given no verb, so what a judge
 * returns is only a proposal; the runner records it and applies nothing.
 *
 * @example
 * ```ts
 * import { runJudge } from "./agent-runner.ts";
 * // await runJudge(step, agent)
 * ```
 *
 * @module
 */
import { err, type Result } from "@intellectual-frontiers/core";
import { decodeProposal, type ProposedValue } from "@intellectual-frontiers/workload/logical";
import type { NodeId, OutputSchema } from "@intellectual-frontiers/workload/governance";
import type { AgentPort } from "./ports.ts";

/** The proposal of the agent for a judge step, in the declared type, or why it is refused. */
export async function runJudge(step: { readonly id: NodeId; readonly question: string; readonly output: OutputSchema }, agent: AgentPort): Promise<Result<Readonly<Record<string, ProposedValue>>, string>> {
  let raw: unknown;
  try {
    raw = await agent.propose({ step: step.id, question: step.question, output: step.output });
  } catch (e) {
    return err(`the agent did not answer ${step.id}: ${e instanceof Error ? e.message : "an error"}`);
  }
  const r = decodeProposal(step.output, raw);
  return r.kind === "ok" ? r : err(`the answer to ${step.id} is not the declared type: ${r.error.join("; ")}`);
}
